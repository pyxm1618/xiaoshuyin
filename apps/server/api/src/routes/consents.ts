/**
 * Consent routes: revoke + read endpoints.
 * Per plan.md D-3.7: revoke creates new version, advances pointer.
 * Data access via packages repository (guard R4).
 */

import type { FastifyInstance } from 'fastify';
import { RevokeConsentRequest } from '@xiaoshuyin/contracts';
import { withRlsTransaction, withIdentityTransaction } from '../db/tx.js';
import { runIdempotentCommand, sendCommandOutcome } from '../idempotency.js';
import { toHttpError } from '../plugins/error-handler.js';
import { getCatalog } from '@xiaoshuyin/compliance';
import { getFamilyIdByPersonId, insertAuditEvent, hashPayload } from '@xiaoshuyin/domain';
import {
  getConsentRecordForUpdate,
  insertConsentRecord,
  updateComplianceProfileConsent,
  getConsentsByFamily,
  getComplianceProfile,
} from '@xiaoshuyin/compliance';
import type pg from 'pg';

function notFoundFamily() {
  return Object.assign(new Error('Current family not found'), {
    statusCode: 404,
    code: 'CURRENT_FAMILY_NOT_FOUND',
  });
}

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
    const parsed = RevokeConsentRequest.safeParse(req.body);
    if (!parsed.success) {
      const err = toHttpError('VALIDATION_ERROR', 'Invalid request body');
      return reply.status(err.statusCode).send(err);
    }

    const { idempotencyKey } = parsed.data;
    const requestHash = hashPayload({ consentId });

    try {
      const outcome = await runIdempotentCommand(
        pool,
        {
          accountId: accountId,
          personId: personId,
          purpose: 'FAMILY_MANAGEMENT',
          commandType: 'GUARDIAN_CONSENT_REVOKE',
          idempotencyKey,
          requestHash,
          resolveFamilyId: async (tx) => {
            const familyId = await getFamilyIdByPersonId(tx, personId);
            if (!familyId) throw notFoundFamily();
            return familyId;
          },
        },
        async (tx) => {
          const familyId = await getFamilyIdByPersonId(tx, personId);
          if (!familyId) throw notFoundFamily();

          const consent = await getConsentRecordForUpdate(tx, consentId);
          if (!consent) {
            throw Object.assign(new Error('Consent not found'), {
              statusCode: 404, code: 'CURRENT_FAMILY_NOT_FOUND',
            });
          }
          if (consent.family_id !== familyId) {
            throw Object.assign(new Error('Not in family'), {
              statusCode: 403, code: 'NOT_FAMILY_MEMBER',
            });
          }
          // Guardian authority is a separate dimension from family membership.
          if (consent.guardian_person_id !== personId) {
            throw Object.assign(new Error('Not the guardian of this consent'), {
              statusCode: 403, code: 'NOT_GUARDIAN',
            });
          }
          if (consent.decision === 'REVOKED') {
            throw Object.assign(new Error('Already revoked'), {
              statusCode: 409, code: 'GUARDIAN_CONSENT_ALREADY_GRANTED',
            });
          }

          // Create REVOKED version (v+1)
          const newVersion = consent.version + 1;
          const newConsent = await insertConsentRecord(
            tx, consent.family_id, consent.guardian_person_id, consent.guardian_account_id,
            'REVOKED', newVersion, null, consent.bound_person_id, consent.bound_at,
            consent.notice_version, consent.notice_hash, 'v1',
            JSON.stringify({ revoked: true, timestamp: new Date().toISOString() }),
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
            body: {
              id: newConsent.id,
              decision: newConsent.decision,
              version: newConsent.version,
              noticeVersion: newConsent.notice_version,
              decidedAt: newConsent.decided_at,
              boundPersonId: newConsent.bound_person_id,
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

  // GET /api/v1/consents
  app.get('/api/v1/consents', async (req, reply) => {
    const actor = req.actor;
    const accountId = actor?.accountId;
    const personId = actor?.personId;
    if (!accountId || !personId) {
      const err = toHttpError('UNAUTHENTICATED');
      return reply.status(err.statusCode).send(err);
    }

    const familyId = await withIdentityTransaction(
      pool,
      { accountId: accountId, purpose: 'SELF_IDENTITY' },
      (tx) => getFamilyIdByPersonId(tx, personId)
    );
    if (!familyId) {
      // Frozen OpenAPI contract: collection endpoint → { "items": [...] }
      return reply.status(200).send({ items: [] });
    }

    try {
      const result = await withRlsTransaction(
        pool,
        { familyId, accountId: accountId, personId: personId, purpose: 'FAMILY_MANAGEMENT' },
        (tx) => getConsentsByFamily(tx, familyId)
      );

      return reply.status(200).send({
        items: result.map((r: any) => ({
          id: r.id,
          decision: r.decision,
          version: r.version,
          noticeVersion: r.notice_version,
          decidedAt: r.decided_at,
          boundPersonId: r.bound_person_id,
        })),
      });
    } catch (err: any) {
      if (err.statusCode) {
        return reply.status(err.statusCode).send({ code: err.code, message: err.message });
      }
      throw err;
    }
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

    try {
      const result = await withIdentityTransaction(
        pool,
        { accountId: accountId, purpose: 'SELF_IDENTITY' },
        (tx) => getComplianceProfile(tx, personId)
      );

      if (!result) {
        const err = toHttpError('CURRENT_FAMILY_NOT_FOUND', 'No compliance profile');
        return reply.status(err.statusCode).send(err);
      }

      return reply.status(200).send({
        ageBand: result.age_band,
        minorMode: result.minor_mode,
        verifiedSource: result.verified_source,
        guardianConsentVersion: result.guardian_consent_version,
        effectiveAt: result.effective_at,
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
