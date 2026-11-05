/**
 * Compliance routes: guardian consent requests + grants.
 * Per plan.md D-3.2/D-3.3: minimal state, no child PII.
 * Data access via packages repository (guard R4).
 */

import type { FastifyInstance } from 'fastify';
import {
  CreateConsentRequestRequest,
  GrantConsentRequest,
} from '@xiaoshuyin/contracts';
import { runIdempotentCommand, sendCommandOutcome } from '../idempotency.js';
import { toHttpError } from '../plugins/error-handler.js';
import { getNoticeHash } from '@xiaoshuyin/compliance';
import { getFamilyIdByPersonId, hashPayload } from '@xiaoshuyin/domain';
import {
  insertConsentRequest,
  getConsentRequestForUpdate,
  updateConsentRequestGranted,
  insertConsentRecord,
  getComplianceProfileForUpdate,
  getConsentRecordForUpdate,
  updateComplianceProfileConsent,
} from '@xiaoshuyin/compliance';
import type pg from 'pg';

function notFoundFamily() {
  return Object.assign(new Error('Current family not found'), {
    statusCode: 404,
    code: 'CURRENT_FAMILY_NOT_FOUND',
  });
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

    const { noticeVersion, subjectPersonId, idempotencyKey } = parsed.data;
    const requestHash = hashPayload({ noticeVersion, subjectPersonId });

    try {
      const outcome = await runIdempotentCommand(
        pool,
        {
          accountId: accountId,
          personId: personId,
          purpose: 'FAMILY_MANAGEMENT',
          commandType: 'GUARDIAN_CONSENT_REQUEST',
          idempotencyKey,
          requestHash,
          resolveFamilyId: async (tx) => {
            const familyId = await getFamilyIdByPersonId(tx, personId);
            if (!familyId) throw notFoundFamily();
            return familyId;
          },
        },
        async (tx) => {
          const noticeHash = getNoticeHash(noticeVersion);
          if (!noticeHash) {
            throw Object.assign(new Error('Invalid notice version'), {
              statusCode: 422, code: 'VALIDATION_ERROR',
            });
          }

          const familyId = await getFamilyIdByPersonId(tx, personId);
          if (!familyId) throw notFoundFamily();

          const result = await insertConsentRequest(
            tx, familyId, personId, subjectPersonId ?? null, noticeVersion, noticeHash
          );

          return {
            status: 201,
            body: {
              id: result.id,
              status: result.status,
              noticeVersion: result.notice_version,
              expiresAt: result.expires_at,
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

    const { consentRequestId, accepted, noticeVersion, noticeHash, idempotencyKey } = parsed.data;
    const requestHash = hashPayload({ consentRequestId, accepted, noticeVersion, noticeHash });

    try {
      const outcome = await runIdempotentCommand(
        pool,
        {
          accountId: accountId,
          personId: personId,
          purpose: 'FAMILY_MANAGEMENT',
          commandType: 'GUARDIAN_CONSENT_GRANT',
          idempotencyKey,
          requestHash,
          resolveFamilyId: async (tx) => {
            const familyId = await getFamilyIdByPersonId(tx, personId);
            if (!familyId) throw notFoundFamily();
            return familyId;
          },
        },
        async (tx) => {
          const expectedHash = getNoticeHash(noticeVersion);
          if (!expectedHash || expectedHash !== noticeHash) {
            throw Object.assign(new Error('Notice mismatch'), {
              statusCode: 403, code: 'GUARDIAN_CONSENT_NOTICE_MISMATCH',
            });
          }

          const familyId = await getFamilyIdByPersonId(tx, personId);
          if (!familyId) throw notFoundFamily();

          const request = await getConsentRequestForUpdate(tx, consentRequestId);
          if (!request) {
            throw Object.assign(new Error('Request not found'), {
              statusCode: 404, code: 'CURRENT_FAMILY_NOT_FOUND',
            });
          }
          // Guardian authority is a separate dimension from family membership.
          if (request.guardian_person_id !== personId) {
            throw Object.assign(new Error('Not the guardian of this consent request'), {
              statusCode: 403, code: 'NOT_GUARDIAN',
            });
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
          if (request.notice_version !== noticeVersion || request.notice_hash !== noticeHash) {
            throw Object.assign(new Error('Notice mismatch'), {
              statusCode: 403, code: 'GUARDIAN_CONSENT_NOTICE_MISMATCH',
            });
          }

          // Re-consent vs first onboarding (contracts/consent-onboarding.md §6.1):
          // v1 GRANTED(A, unbound) → v2 REVOKED(supersedes v1) → v3 GRANTED(B, bound P, supersedes v2)
          let newVersion = 1;
          let supersedesId: string | null = null;
          let boundPersonId: string | null = null;
          let boundAt: Date | null = null;

          if (request.subject_person_id) {
            const profile = await getComplianceProfileForUpdate(tx, request.subject_person_id);
            const existingConsentId = profile?.guardian_consent_record_id ?? null;
            if (profile && profile.age_band === 'UNDER_14' && existingConsentId) {
              const current = await getConsentRecordForUpdate(tx, existingConsentId);
              if (!current) {
                throw Object.assign(new Error('Consent chain broken'), {
                  statusCode: 409, code: 'GUARDIAN_CONSENT_ALREADY_GRANTED',
                });
              }
              // The chain can only continue once the current version is REVOKED.
              if (current.decision !== 'REVOKED') {
                throw Object.assign(new Error('Current consent is still active'), {
                  statusCode: 409, code: 'GUARDIAN_CONSENT_ALREADY_GRANTED',
                });
              }
              if (current.guardian_person_id !== personId || profile.guardian_person_id !== personId) {
                throw Object.assign(new Error('Not the guardian of this subject'), {
                  statusCode: 403, code: 'NOT_GUARDIAN',
                });
              }
              newVersion = current.version + 1;
              supersedesId = current.id;
              boundPersonId = request.subject_person_id;
              boundAt = new Date();
            }
          }

          await updateConsentRequestGranted(tx, consentRequestId);

          const record = await insertConsentRecord(
            tx, familyId, personId, accountId,
            'GRANTED', newVersion, consentRequestId, boundPersonId, boundAt,
            noticeVersion, noticeHash, 'v1',
            JSON.stringify({ accepted: true, timestamp: new Date().toISOString() }),
            supersedesId
          );

          // Advance the compliance pointer for a re-consent (subject already exists).
          if (boundPersonId) {
            await updateComplianceProfileConsent(tx, boundPersonId, record.id, newVersion);
          }

          return {
            status: 201,
            body: {
              id: record.id,
              decision: record.decision,
              version: record.version,
              noticeVersion: record.notice_version,
              decidedAt: record.decided_at,
              boundPersonId: record.bound_person_id,
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
}
