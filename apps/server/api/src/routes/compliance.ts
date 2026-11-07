/**
 * Compliance routes: guardian consent requests + grants.
 * Per plan.md D-3.2/D-3.3: minimal state, no child PII.
 * Data access via packages repository (guard R4).
 *
 * Transaction order follows contracts/authorization-and-rls.md §4.4 and the
 * Owner ruling on C2:
 *   - request: identity → resolve → authorize(REQUEST) → set_family_context → write
 *   - grant:   identity → resolve → membership authorize → set_family_context
 *              → read target → guardian authorize → write
 * Both authorize calls go through the single `@xiaoshuyin/authorization` entry.
 */

import type { FastifyInstance } from 'fastify';
import {
  CreateConsentRequestRequest,
  GrantConsentRequest,
} from '@xiaoshuyin/contracts';
import { setFamilyContext } from '../db/tx.js';
import { readIdempotencyKey, runIdempotentCommand, sendCommandOutcome } from '../idempotency.js';
import { toHttpError } from '../plugins/error-handler.js';
import {
  getNoticeHash,
  buildConsentEvidence,
  getAcceptanceTextHash,
  runtimeConsentChannel,
} from '@xiaoshuyin/compliance';
import { hashPayload, isFamilyMember } from '@xiaoshuyin/domain';
import { requireCurrentFamily } from '../family-context.js';
import { requireFamilyAction } from '../authz.js';
import { requireEvidencePepper } from '../evidence-pepper.js';
import { consentRecordDto } from '../consent-dto.js';
import {
  insertConsentRequest,
  getConsentRequestForUpdate,
  updateConsentRequestGranted,
  insertConsentRecord,
  getComplianceProfileForUpdate,
  getComplianceProfile,
  getConsentRecordForGate,
  updateComplianceProfileConsent,

} from '@xiaoshuyin/compliance';
import { insertAuditEvent } from '@xiaoshuyin/domain';
import type pg from 'pg';

const ACTIVITY_PURPOSE = 'GUARDIAN_CONSENT';

function forbidden(message: string) {
  const err = toHttpError('FORBIDDEN', message);
  return Object.assign(new Error(err.message), err);
}

function validationError(message: string) {
  const err = toHttpError('VALIDATION_ERROR', message);
  return Object.assign(new Error(err.message), err);
}

/**
 * F4: validate a re-consent subject BEFORE writing any onboarding row.
 *
 * The caller has already established family context. Every failure that could
 * reveal whether another family's Person exists is collapsed into the same
 * 403 FORBIDDEN (no existence oracle). A still-active GRANTED chain is a
 * conflict the actor is already authorized to know about (409).
 */
async function assertReConsentCandidate(
  tx: pg.PoolClient,
  familyId: string,
  subjectPersonId: string,
  actorPersonId: string
): Promise<void> {
  const inFamily = await isFamilyMember(tx, familyId, subjectPersonId);
  if (!inFamily) throw forbidden('Subject is not a re-consent candidate');

  const profile = await getComplianceProfileForUpdate(tx, subjectPersonId);
  if (!profile) throw forbidden('Subject is not a re-consent candidate');
  if (profile.age_band !== 'UNDER_14') throw forbidden('Subject is not a re-consent candidate');

  const currentId = profile.guardian_consent_record_id ?? null;
  if (!currentId) throw forbidden('Subject is not a re-consent candidate');

  const current = await getConsentRecordForGate(tx, currentId);
  if (!current) throw forbidden('Subject is not a re-consent candidate');

  if (current.decision !== 'REVOKED') {
    const err = toHttpError('GUARDIAN_CONSENT_ALREADY_GRANTED');
    throw Object.assign(new Error(err.message), err);
  }
  if (current.bound_person_id !== subjectPersonId) {
    throw forbidden('Subject is not a re-consent candidate');
  }
  if (current.guardian_person_id !== actorPersonId || profile.guardian_person_id !== actorPersonId) {
    throw Object.assign(new Error('Not the guardian of this subject'), {
      statusCode: 403, code: 'NOT_GUARDIAN',
    });
  }
}

export function registerComplianceRoutes(app: FastifyInstance, pool: pg.Pool) {
  // POST /api/v1/compliance/guardian-consents/requests
  app.post('/api/v1/compliance/guardian-consents/requests', async (req, reply) => {
    const actor = req.actor;
    const accountId = actor?.accountId;
    const personId = actor?.personId;
    if (!accountId || !personId) {
      const err = toHttpError('UNAUTHENTICATED');
      return reply.status(err.statusCode).send(err);
    }

    const parsed = CreateConsentRequestRequest.safeParse(req.body);
    if (!parsed.success) {
      const err = toHttpError('VALIDATION_ERROR', 'Invalid request body');
      return reply.status(err.statusCode).send(err);
    }

    const { declaredAgeBand, noticeVersion, channel, existingSubjectPersonId } = parsed.data;

    // C1 / option d: channel is server-decided. The request may only declare
    // the channel implied by this runtime; it never drives stored evidence.
    if (channel !== runtimeConsentChannel()) {
      const err = toHttpError('VALIDATION_ERROR', 'channel does not match runtime');
      return reply.status(err.statusCode).send(err);
    }

    const idempotencyKey = readIdempotencyKey(req);
    const requestHash = hashPayload({
      declaredAgeBand,
      noticeVersion,
      channel,
      existingSubjectPersonId,
    });

    try {
      const outcome = await runIdempotentCommand(
        pool,
        {
          accountId,
          personId,
          purpose: ACTIVITY_PURPOSE,
          commandType: 'GUARDIAN_CONSENT_REQUEST',
          idempotencyKey,
          requestHash,
        },
        async (tx) => {
          const noticeHash = getNoticeHash(noticeVersion);
          if (!noticeHash) {
            throw validationError('Invalid notice version');
          }

          const familyId = await requireCurrentFamily(tx, personId);

          // Frozen action table (§2.3): membership + manager + actor ADULT.
          await requireFamilyAction(tx, {
            accountId,
            personId,
            familyId,
            action: 'GUARDIAN_CONSENT_REQUEST',
            purpose: ACTIVITY_PURPOSE,
            resource: { type: 'FAMILY', familyId },
          });

          // §4.4: family context before subject validation / write.
          await setFamilyContext(tx, familyId, personId, ACTIVITY_PURPOSE);

          if (existingSubjectPersonId) {
            await assertReConsentCandidate(tx, familyId, existingSubjectPersonId, personId);
          }

          const result = await insertConsentRequest(
            tx, familyId, personId, existingSubjectPersonId ?? null, noticeVersion, noticeHash
          );

          await insertAuditEvent(
            tx, familyId, accountId, 'CONSENT_REQUEST_CREATED', 'CONSENT', result.id
          );

          return {
            status: 201,
            body: {
              requestId: result.id,
              declaredAgeBand: 'UNDER_14',
              noticeVersion: result.notice_version,
              noticeHash: result.notice_hash,
              expiresAt: new Date(result.expires_at).toISOString(),
              status: result.status,
            },
          };
        }
      );

      return sendCommandOutcome(reply, outcome);
    } catch (err: any) {
      if (err.statusCode) {
        return reply.status(err.statusCode).send({ code: err.code, message: err.message });
      }
      if (err.code === '42501' && err.message?.includes('FAMILY_MEMBERSHIP_REQUIRED')) {
        const e = toHttpError('NOT_FAMILY_MEMBER');
        return reply.status(e.statusCode).send(e);
      }
      throw err;
    }
  });

  // POST /api/v1/compliance/guardian-consents
  app.post('/api/v1/compliance/guardian-consents', async (req, reply) => {
    const actor = req.actor;
    const accountId = actor?.accountId;
    const personId = actor?.personId;
    if (!accountId || !personId) {
      const err = toHttpError('UNAUTHENTICATED');
      return reply.status(err.statusCode).send(err);
    }

    const parsed = GrantConsentRequest.safeParse(req.body);
    if (!parsed.success) {
      const err = toHttpError('VALIDATION_ERROR', 'Invalid request body');
      return reply.status(err.statusCode).send(err);
    }

    const { onboardingRequestId, noticeVersion, accepted } = parsed.data;
    const idempotencyKey = readIdempotencyKey(req);
    const requestHash = hashPayload({ onboardingRequestId, noticeVersion, accepted });

    try {
      const outcome = await runIdempotentCommand(
        pool,
        {
          accountId,
          personId,
          purpose: ACTIVITY_PURPOSE,
          commandType: 'GUARDIAN_CONSENT_GRANT',
          idempotencyKey,
          requestHash,
        },
        async (tx) => {
          const expectedHash = getNoticeHash(noticeVersion);
          if (!expectedHash) {
            throw Object.assign(new Error('Notice mismatch'), {
              statusCode: 403, code: 'GUARDIAN_CONSENT_NOTICE_MISMATCH',
            });
          }

          const familyId = await requireCurrentFamily(tx, personId);

          // First authorize: membership-level family authorization.
          await requireFamilyAction(tx, {
            accountId,
            personId,
            familyId,
            action: 'FAMILY_READ',
            purpose: ACTIVITY_PURPOSE,
            resource: { type: 'FAMILY', familyId },
          });

          await setFamilyContext(tx, familyId, personId, ACTIVITY_PURPOSE);

          const request = await getConsentRequestForUpdate(tx, onboardingRequestId);
          if (!request) {
            // Frozen OpenAPI declares no 404 for this endpoint.
            throw forbidden('Consent request not found');
          }

          // Second authorize: guardian dimension, from the real DB row.
          await requireFamilyAction(tx, {
            accountId,
            personId,
            familyId,
            action: 'GUARDIAN_CONSENT_GRANT',
            purpose: ACTIVITY_PURPOSE,
            resource: { type: 'CONSENT', familyId, consentId: onboardingRequestId },
            guardianPersonId: request.guardian_person_id,
          });

          // F3: grant is an ADULT-only action (consent-onboarding.md §3 C2).
          // Re-read the actor profile inside this transaction; never trust the
          // request-time check. UNKNOWN / MINOR / UNDER_14 / missing → 403.
          const actorProfile = await getComplianceProfile(tx, personId);
          if (!actorProfile || actorProfile.age_band !== 'ADULT') {
            throw forbidden('Guardian consent requires an ADULT actor');
          }

          if (request.status !== 'PENDING') {
            throw Object.assign(new Error('Already granted'), {
              statusCode: 409, code: 'GUARDIAN_CONSENT_ALREADY_GRANTED',
            });
          }
          if (new Date(request.expires_at) < new Date()) {
            throw Object.assign(new Error('Expired'), {
              statusCode: 403, code: 'GUARDIAN_CONSENT_EXPIRED',
            });
          }
          if (request.notice_version !== noticeVersion || request.notice_hash !== expectedHash) {
            throw Object.assign(new Error('Notice mismatch'), {
              statusCode: 403, code: 'GUARDIAN_CONSENT_NOTICE_MISMATCH',
            });
          }

          // Mode A vs Mode B (contracts/consent-onboarding.md §6.1):
          //   Mode A — first onboarding: subject_person_id IS NULL
          //            → GRANTED v1, unbound, supersedes NULL
          //   Mode B — re-consent:       subject_person_id != NULL
          //            → the chain continues at v(N+1); preconditions are
          //              fully validated and Mode B NEVER falls back to Mode A.
          // v1 GRANTED(A) → v2 REVOKED(supersedes v1) → v3 GRANTED(B, bound P, supersedes v2)
          let newVersion = 1;
          let supersedesId: string | null = null;
          let boundPersonId: string | null = null;
          let boundAt: Date | null = null;

          const subjectPersonId = request.subject_person_id;
          if (subjectPersonId) {
            // Same candidate contract as the request path; state may have
            // changed between request and grant.
            await assertReConsentCandidate(tx, familyId, subjectPersonId, personId);

            const profile = await getComplianceProfileForUpdate(tx, subjectPersonId);
            const currentId = profile!.guardian_consent_record_id!;
            const current = await getConsentRecordForGate(tx, currentId);

            newVersion = current!.version + 1;
            supersedesId = current!.id;
            boundPersonId = subjectPersonId;
            boundAt = new Date();
          }

          // Frozen evidence contract (contracts/consent-onboarding.md §4):
          // exactly {channel, accepted_text_hash, declared_age_band,
          // client_ip_hash, user_agent_hash}. Raw IP / UA never stored; the
          // pepper never leaves this call. `channel` is server-decided (C1 d).
          const acceptanceTextHash = getAcceptanceTextHash(noticeVersion);
          if (!acceptanceTextHash) {
            throw validationError('Invalid notice version');
          }
          const evidence = buildConsentEvidence({
            channel: runtimeConsentChannel(),
            acceptedTextHash: acceptanceTextHash,
            clientIp: req.ip,
            userAgent: req.headers['user-agent'] ?? null,
            pepper: requireEvidencePepper(),
          });

          await updateConsentRequestGranted(tx, onboardingRequestId);

          const record = await insertConsentRecord(
            tx, familyId, personId, accountId,
            'GRANTED', newVersion, onboardingRequestId, boundPersonId, boundAt,
            noticeVersion, expectedHash, 'v1',
            evidence,
            supersedesId
          );

          // Advance the compliance pointer for a re-consent (subject already exists).
          if (boundPersonId) {
            await updateComplianceProfileConsent(tx, boundPersonId, record.id, newVersion);
          }

          return {
            status: 201,
            body: consentRecordDto(record),
          };
        }
      );

      return sendCommandOutcome(reply, outcome);
    } catch (err: any) {
      if (err.statusCode) {
        return reply.status(err.statusCode).send({ code: err.code, message: err.message });
      }
      if (err.code === '42501' && err.message?.includes('FAMILY_MEMBERSHIP_REQUIRED')) {
        const e = toHttpError('NOT_FAMILY_MEMBER');
        return reply.status(e.statusCode).send(e);
      }
      throw err;
    }
  });
}