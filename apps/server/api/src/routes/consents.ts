/**
 * Consent routes: revoke + read endpoints.
 * Per plan.md D-3.7: revoke creates new version, advances pointer.
 */

import type { FastifyInstance } from 'fastify';
import { RevokeConsentRequest } from '@xiaoshuyin/contracts';
import { withRlsTransaction, withIdentityTransaction } from '../db/tx.js';
import { toHttpError } from '../plugins/error-handler.js';
import { getCatalog } from '@xiaoshuyin/compliance';
import type pg from 'pg';

async function resolveFamilyId(pool: pg.Pool, accountId: string, personId: string): Promise<string | null> {
  const { rows } = await withIdentityTransaction(
    pool,
    { accountId, purpose: 'SELF_IDENTITY' },
    async (tx) => {
      return tx.query(
        `SELECT f.id FROM families f
         JOIN family_members fm ON fm.family_id = f.id
         WHERE fm.person_id = $1`,
        [personId]
      );
    }
  );
  return rows[0]?.id ?? null;
}

export function registerConsentRoutes(app: FastifyInstance, pool: pg.Pool) {
  // POST /api/v1/consents/:id/revoke
  app.post('/api/v1/consents/:id/revoke', async (req, reply) => {
    const actor = req.actor;
    if (!actor?.accountId || !actor?.personId) {
      const err = toHttpError('UNAUTHENTICATED');
      return reply.status(err.statusCode).send(err);
    }

    const consentId = (req.params as any).id;
    const parsed = RevokeConsentRequest.safeParse(req.body);
    if (!parsed.success) {
      const err = toHttpError('VALIDATION_ERROR', 'Invalid request body');
      return reply.status(err.statusCode).send(err);
    }

    // Resolve family
    const familyId = await resolveFamilyId(pool, actor.accountId, actor.personId);
    if (!familyId) {
      const err = toHttpError('CURRENT_FAMILY_NOT_FOUND');
      return reply.status(err.statusCode).send(err);
    }

    try {
      const result = await withRlsTransaction(
        pool,
        { familyId, accountId: actor.accountId, personId: actor.personId, purpose: 'FAMILY_MANAGEMENT' },
        async (tx) => {
          // Lock consent record
          const { rows: consentRows } = await tx.query(
            `SELECT id, decision, version, bound_person_id, notice_version, notice_hash,
                    guardian_person_id, guardian_account_id, family_id, bound_at
             FROM consent_records WHERE id = $1 FOR UPDATE`,
            [consentId]
          );
          if (consentRows.length === 0) {
            throw Object.assign(new Error('Consent not found'), {
              statusCode: 404,
              code: 'CURRENT_FAMILY_NOT_FOUND',
            });
          }
          const consent = consentRows[0];

          // Check family matches
          if (consent.family_id !== familyId) {
            throw Object.assign(new Error('Not in family'), {
              statusCode: 403,
              code: 'NOT_FAMILY_MEMBER',
            });
          }

          // Check not already revoked
          if (consent.decision === 'REVOKED') {
            throw Object.assign(new Error('Already revoked'), {
              statusCode: 409,
              code: 'GUARDIAN_CONSENT_ALREADY_GRANTED',
            });
          }

          // Create REVOKED version (v+1)
          const newVersion = consent.version + 1;
          const { rows: newConsentRows } = await tx.query(
            `INSERT INTO consent_records
               (family_id, guardian_person_id, guardian_account_id, purpose, decision,
                version, onboarding_request_id, bound_person_id, bound_at,
                notice_version, notice_hash, policy_version, evidence, supersedes_id)
             VALUES ($1, $2, $3, 'UNDER_14_GUARDIAN_CONSENT', 'REVOKED', $4, NULL, $5, $6,
                     $7, $8, 'v1', $9, $10)
             RETURNING id, decision, version, notice_version, decided_at, bound_person_id`,
            [
              consent.family_id,
              consent.guardian_person_id,
              consent.guardian_account_id,
              newVersion,
              consent.bound_person_id,
              consent.bound_at,
              consent.notice_version,
              consent.notice_hash,
              JSON.stringify({ revoked: true, timestamp: new Date().toISOString() }),
              consent.id,
            ]
          );

          // Advance profile pointer if bound
          if (consent.bound_person_id) {
            await tx.query(
              `UPDATE person_compliance_profiles
               SET guardian_consent_record_id = $1, guardian_consent_version = $2, updated_at = now()
               WHERE person_id = $3`,
              [newConsentRows[0].id, newVersion, consent.bound_person_id]
            );
          }

          // Audit
          await tx.query(
            `INSERT INTO business_audit_events (family_id, actor_account_id, event_type, resource_type, resource_id)
             VALUES ($1, $2, 'CONSENT_REVOKED', 'CONSENT', $3)`,
            [familyId, actor.accountId, newConsentRows[0].id]
          );

          return newConsentRows[0];
        }
      );

      return reply.status(200).send({
        id: result.id,
        decision: result.decision,
        version: result.version,
        noticeVersion: result.notice_version,
        decidedAt: result.decided_at,
        boundPersonId: result.bound_person_id,
      });
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
    if (!actor?.accountId || !actor?.personId) {
      const err = toHttpError('UNAUTHENTICATED');
      return reply.status(err.statusCode).send(err);
    }

    // Resolve family
    const familyId = await resolveFamilyId(pool, actor.accountId, actor.personId);
    if (!familyId) {
      return reply.status(200).send([]); // No family → empty list
    }

    try {
      const result = await withRlsTransaction(
        pool,
        { familyId, accountId: actor.accountId, personId: actor.personId, purpose: 'FAMILY_MANAGEMENT' },
        async (tx) => {
          const { rows } = await tx.query(
            `SELECT id, decision, version, notice_version, decided_at, bound_person_id
             FROM consent_records WHERE family_id = $1
             ORDER BY decided_at DESC`,
            [familyId]
          );
          return rows;
        }
      );

      return reply.status(200).send(
        result.map((r: any) => ({
          id: r.id,
          decision: r.decision,
          version: r.version,
          noticeVersion: r.notice_version,
          decidedAt: r.decided_at,
          boundPersonId: r.bound_person_id,
        }))
      );
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
    if (!actor?.accountId || !actor?.personId) {
      const err = toHttpError('UNAUTHENTICATED');
      return reply.status(err.statusCode).send(err);
    }

    try {
      const result = await withIdentityTransaction(
        pool,
        { accountId: actor.accountId, purpose: 'SELF_IDENTITY' },
        async (tx) => {
          const { rows } = await tx.query(
            `SELECT age_band, minor_mode, verified_source, guardian_consent_version, effective_at
             FROM person_compliance_profiles WHERE person_id = $1`,
            [actor.personId]
          );
          return rows[0] ?? null;
        }
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
