/**
 * Compliance routes: guardian consent requests + grants.
 * Per plan.md D-3.2/D-3.3: minimal state, no child PII.
 */

import type { FastifyInstance } from 'fastify';
import {
  CreateConsentRequestRequest,
  GrantConsentRequest,
} from '@xiaoshuyin/contracts';
import { withRlsTransaction, withIdentityTransaction } from '../db/tx.js';
import { toHttpError } from '../plugins/error-handler.js';
import { getNoticeHash } from '@xiaoshuyin/compliance';
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

export function registerComplianceRoutes(app: FastifyInstance, pool: pg.Pool) {
  // POST /api/v1/compliance/guardian-consents/requests
  app.post('/api/v1/compliance/guardian-consents/requests', async (req, reply) => {
    const actor = req.actor;
    if (!actor?.accountId || !actor?.personId) {
      const err = toHttpError('UNAUTHENTICATED');
      return reply.status(err.statusCode).send(err);
    }

    const parsed = CreateConsentRequestRequest.safeParse(req.body);
    if (!parsed.success) {
      const err = toHttpError('VALIDATION_ERROR', 'Invalid request body');
      return reply.status(err.statusCode).send(err);
    }

    const { noticeVersion, subjectPersonId, idempotencyKey } = parsed.data;

    // Validate notice version exists
    const noticeHash = getNoticeHash(noticeVersion);
    if (!noticeHash) {
      const err = toHttpError('VALIDATION_ERROR', 'Invalid notice version');
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
          // Create consent request (minimal state, no child PII)
          const { rows } = await tx.query(
            `INSERT INTO guardian_consent_requests
               (family_id, guardian_person_id, subject_person_id, declared_age_band,
                notice_version, notice_hash, status, expires_at)
             VALUES ($1, $2, $3, 'UNDER_14', $4, $5, 'PENDING', now() + interval '24 hours')
             RETURNING id, status, notice_version, expires_at`,
            [familyId, actor.personId, subjectPersonId ?? null, noticeVersion, noticeHash]
          );
          return rows[0];
        }
      );

      return reply.status(201).send({
        id: result.id,
        status: result.status,
        noticeVersion: result.notice_version,
        expiresAt: result.expires_at,
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

  // POST /api/v1/compliance/guardian-consents
  app.post('/api/v1/compliance/guardian-consents', async (req, reply) => {
    const actor = req.actor;
    if (!actor?.accountId || !actor?.personId) {
      const err = toHttpError('UNAUTHENTICATED');
      return reply.status(err.statusCode).send(err);
    }

    const parsed = GrantConsentRequest.safeParse(req.body);
    if (!parsed.success) {
      const err = toHttpError('VALIDATION_ERROR', 'Invalid request body');
      return reply.status(err.statusCode).send(err);
    }

    const { consentRequestId, accepted, noticeVersion, noticeHash, idempotencyKey } = parsed.data;

    // Validate notice hash matches
    const expectedHash = getNoticeHash(noticeVersion);
    if (!expectedHash || expectedHash !== noticeHash) {
      const err = toHttpError('GUARDIAN_CONSENT_NOTICE_MISMATCH');
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
          // Lock and validate consent request
          const { rows: reqRows } = await tx.query(
            `SELECT id, status, expires_at, notice_version, notice_hash
             FROM guardian_consent_requests WHERE id = $1 FOR UPDATE`,
            [consentRequestId]
          );
          if (reqRows.length === 0) {
            throw Object.assign(new Error('Request not found'), {
              statusCode: 404,
              code: 'CURRENT_FAMILY_NOT_FOUND',
            });
          }
          const request = reqRows[0];

          // Check not already granted
          if (request.status !== 'PENDING') {
            throw Object.assign(new Error('Already granted'), {
              statusCode: 409,
              code: 'GUARDIAN_CONSENT_ALREADY_GRANTED',
            });
          }

          // Check not expired
          if (new Date(request.expires_at) < new Date()) {
            throw Object.assign(new Error('Expired'), {
              statusCode: 403,
              code: 'GUARDIAN_CONSENT_EXPIRED',
            });
          }

          // Check notice matches
          if (request.notice_version !== noticeVersion || request.notice_hash !== noticeHash) {
            throw Object.assign(new Error('Notice mismatch'), {
              statusCode: 403,
              code: 'GUARDIAN_CONSENT_NOTICE_MISMATCH',
            });
          }

          // Update request status
          await tx.query(
            `UPDATE guardian_consent_requests SET status = 'GRANTED', completed_at = now() WHERE id = $1`,
            [consentRequestId]
          );

          // Create consent record (GRANTED v1, bound_person_id NULL)
          const { rows: consentRows } = await tx.query(
            `INSERT INTO consent_records
               (family_id, guardian_person_id, guardian_account_id, purpose, decision,
                version, onboarding_request_id, bound_person_id, bound_at,
                notice_version, notice_hash, policy_version, evidence)
             VALUES ($1, $2, $3, 'UNDER_14_GUARDIAN_CONSENT', 'GRANTED', 1, $4, NULL, NULL,
                     $5, $6, 'v1', $7)
             RETURNING id, decision, version, notice_version, decided_at, bound_person_id`,
            [
              familyId,
              actor.personId,
              actor.accountId,
              consentRequestId,
              noticeVersion,
              noticeHash,
              JSON.stringify({ accepted: true, timestamp: new Date().toISOString() }),
            ]
          );

          return consentRows[0];
        }
      );

      return reply.status(201).send({
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
}
