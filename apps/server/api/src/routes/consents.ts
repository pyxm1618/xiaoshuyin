/**
 * Consent routes: revoke + read endpoints.
 * Per plan.md D-3.7: revoke creates new version, advances pointer.
 * Data access via packages repository (guard R4).
 *
 * Frozen OpenAPI is the source of truth for request/response shapes and the
 * `Idempotency-Key` header (`reason` is an optional body field).
 */

import type { FastifyInstance } from 'fastify';
import { RevokeConsentRequest } from '@xiaoshuyin/contracts';
import { withIdentityTransaction, setFamilyContext } from '../db/tx.js';
import { readIdempotencyKey, runIdempotentCommand, sendCommandOutcome } from '../idempotency.js';
import { toHttpError } from '../plugins/error-handler.js';
import {
  getCatalog,
  buildConsentEvidence,
  getRevocationTextHash,
  runtimeConsentChannel,
} from '@xiaoshuyin/compliance';
import { insertAuditEvent, hashPayload } from '@xiaoshuyin/domain';
import { resolveCurrentFamily, requireCurrentFamily } from '../family-context.js';
import { requireFamilyAction, requireSelfAction } from '../authz.js';
import { requireEvidencePepper } from '../evidence-pepper.js';
import { consentRecordDto } from '../consent-dto.js';
import {
  getConsentRecordForUpdate,
  insertConsentRecord,
  updateComplianceProfileConsent,
  getConsentsByFamily,
  getComplianceProfile,
} from '@xiaoshuyin/compliance';
import type pg from 'pg';

export function registerConsentRoutes(app: FastifyInstance, pool: pg.Pool) {
  // POST /api/v1/consents/:id/revoke
  app.post('/api/v1/consents/:id/revoke', async (req, reply) => {
    const actor = req.actor;
    const accountId = actor?.accountId;
    const personId = actor?.personId;
    if (!accountId || !personId) {
      const err = toHttpError('UNAUTHENTICATED');
      return reply.status(err.statusCode).send(err);
    }

    const consentId = (req.params as any).id;
    const parsed = RevokeConsentRequest.safeParse(req.body ?? {});
    if (!parsed.success) {
      const err = toHttpError('VALIDATION_ERROR', 'Invalid request body');
      return reply.status(err.statusCode).send(err);
    }

    const idempotencyKey = readIdempotencyKey(req);
    const requestHash = hashPayload({ consentId, reason: parsed.data.reason ?? null });

    try {
      const outcome = await runIdempotentCommand(
        pool,
        {
          accountId,
          personId,
          purpose: 'GUARDIAN_CONSENT',
          commandType: 'GUARDIAN_CONSENT_REVOKE',
          idempotencyKey,
          requestHash,
        },
        async (tx) => {
          const familyId = await requireCurrentFamily(tx, personId);

          // First authorize: membership-level family authorization.
          await requireFamilyAction(tx, {
            accountId,
            personId,
            familyId,
            action: 'FAMILY_READ',
            purpose: 'GUARDIAN_CONSENT',
            resource: { type: 'FAMILY', familyId },
          });

          await setFamilyContext(tx, familyId, personId, 'GUARDIAN_CONSENT');

          const consent = await getConsentRecordForUpdate(tx, consentId);
          if (!consent) {
            // Frozen OpenAPI declares no 404 for this endpoint.
            const err = toHttpError('FORBIDDEN', 'Consent not found');
            throw Object.assign(new Error(err.message), err);
          }
          if (consent.family_id !== familyId) {
            throw Object.assign(new Error('Not in family'), {
              statusCode: 403, code: 'NOT_FAMILY_MEMBER',
            });
          }

          // Second authorize: guardian dimension, from the real DB row.
          await requireFamilyAction(tx, {
            accountId,
            personId,
            familyId,
            action: 'GUARDIAN_CONSENT_REVOKE',
            purpose: 'GUARDIAN_CONSENT',
            resource: { type: 'CONSENT', familyId, consentId },
            guardianPersonId: consent.guardian_person_id,
          });
          if (consent.decision === 'REVOKED') {
            throw Object.assign(new Error('Already revoked'), {
              statusCode: 409, code: 'GUARDIAN_CONSENT_ALREADY_GRANTED',
            });
          }

          // Create REVOKED version (v+1). Evidence keeps the frozen five-field shape.
          const revocationTextHash = getRevocationTextHash(consent.notice_version);
          if (!revocationTextHash) {
            const err = toHttpError('VALIDATION_ERROR', 'Invalid notice version');
            throw Object.assign(new Error(err.message), err);
          }
          const evidence = buildConsentEvidence({
            channel: runtimeConsentChannel(),
            acceptedTextHash: revocationTextHash,
            clientIp: req.ip,
            userAgent: req.headers['user-agent'] ?? null,
            pepper: requireEvidencePepper(),
          });
          const newVersion = consent.version + 1;
          const newConsent = await insertConsentRecord(
            tx, consent.family_id, consent.guardian_person_id, consent.guardian_account_id,
            'REVOKED', newVersion, null, consent.bound_person_id, consent.bound_at,
            consent.notice_version, consent.notice_hash, 'v1',
            evidence,
            consent.id
          );

          // Advance profile pointer if bound
          if (consent.bound_person_id) {
            await updateComplianceProfileConsent(tx, consent.bound_person_id, newConsent.id, newVersion);
          }

          // Audit
          await insertAuditEvent(tx, familyId, accountId, 'CONSENT_REVOKED', 'CONSENT', newConsent.id);

          return {
            status: 200,
            body: consentRecordDto(newConsent),
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

  // GET /api/v1/consents
  app.get('/api/v1/consents', async (req, reply) => {
    const actor = req.actor;
    const accountId = actor?.accountId;
    const personId = actor?.personId;
    if (!accountId || !personId) {
      const err = toHttpError('UNAUTHENTICATED');
      return reply.status(err.statusCode).send(err);
    }

    // §4.4: identity → resolve → authorize → set_family_context → read, all in
    // ONE transaction (no second RLS transaction).
    const resolution = await withIdentityTransaction(
      pool,
      { accountId, purpose: 'FAMILY_MANAGEMENT' },
      async (tx) => {
        const current = await resolveCurrentFamily(tx, personId);
        if (current.status !== 'RESOLVED') return current;

        // FR-011: family-scoped read through the unified entry point.
        await requireFamilyAction(tx, {
          accountId,
          personId,
          familyId: current.family.id,
          action: 'FAMILY_READ',
          purpose: 'FAMILY_MANAGEMENT',
          resource: { type: 'FAMILY', familyId: current.family.id },
        });

        await setFamilyContext(tx, current.family.id, personId, 'FAMILY_MANAGEMENT');

        const items = await getConsentsByFamily(tx, current.family.id);
        return { ...current, items };
      }
    );

    if (resolution.status === 'NONE') {
      // Frozen OpenAPI contract: collection endpoint → { "items": [...] }
      return reply.status(200).send({ items: [] });
    }
    if (resolution.status === 'AMBIGUOUS') {
      const err = toHttpError('CURRENT_FAMILY_AMBIGUOUS');
      return reply.status(err.statusCode).send(err);
    }

    return reply.status(200).send({
      items: resolution.items.map(consentRecordDto),
    });
  });

  // GET /api/v1/compliance/profile
  app.get('/api/v1/compliance/profile', async (req, reply) => {
    const actor = req.actor;
    const accountId = actor?.accountId;
    const personId = actor?.personId;
    if (!accountId || !personId) {
      const err = toHttpError('UNAUTHENTICATED');
      return reply.status(err.statusCode).send(err);
    }

    // FR-011: identity self-read through the unified entry point.
    requireSelfAction(accountId, personId, 'SELF_IDENTITY');

    try {
      const result = await withIdentityTransaction(
        pool,
        { accountId, purpose: 'SELF_IDENTITY' },
        (tx) => getComplianceProfile(tx, personId)
      );

      if (!result) {
        const err = toHttpError('CURRENT_FAMILY_NOT_FOUND', 'No compliance profile');
        return reply.status(err.statusCode).send(err);
      }

      return reply.status(200).send({
        personId: result.person_id,
        ageBand: result.age_band,
        minorMode: result.minor_mode,
        guardianPersonId: result.guardian_person_id,
        guardianConsentVersion: result.guardian_consent_version,
        guardianConsentRecordId: result.guardian_consent_record_id,
        verifiedSource: result.verified_source,
        effectiveAt: result.effective_at.toISOString(),
      });
    } catch (err: any) {
      if (err.statusCode) {
        return reply.status(err.statusCode).send({ code: err.code, message: err.message });
      }
      throw err;
    }
  });

  // GET /api/v1/compliance/notices
  app.get('/api/v1/compliance/notices', async (req, reply) => {
    return reply.status(200).send({ notices: getCatalog() });
  });
}