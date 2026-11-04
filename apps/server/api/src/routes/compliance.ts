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
import { withRlsTransaction, withIdentityTransaction } from '../db/tx.js';
import { toHttpError } from '../plugins/error-handler.js';
import { getNoticeHash } from '@xiaoshuyin/compliance';
import { getFamilyIdByPersonId } from '@xiaoshuyin/domain';
import {
  insertConsentRequest,
  getConsentRequestForUpdate,
  updateConsentRequestGranted,
  insertConsentRecord,
} from '@xiaoshuyin/compliance';
import type pg from 'pg';

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

    const noticeHash = getNoticeHash(noticeVersion);
    if (!noticeHash) {
      const err = toHttpError('VALIDATION_ERROR', 'Invalid notice version');
      return reply.status(err.statusCode).send(err);
    }

    const familyId = await withIdentityTransaction(
      pool,
      { accountId: actor.accountId, purpose: 'SELF_IDENTITY' },
      (tx) => getFamilyIdByPersonId(tx, actor.personId)
    );
    if (!familyId) {
      const err = toHttpError('CURRENT_FAMILY_NOT_FOUND');
      return reply.status(err.statusCode).send(err);
    }

    try {
      const result = await withRlsTransaction(
        pool,
        { familyId, accountId: actor.accountId, personId: actor.personId, purpose: 'FAMILY_MANAGEMENT' },
        (tx) =>
          insertConsentRequest(tx, familyId, actor.personId, subjectPersonId ?? null, noticeVersion, noticeHash)
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

    const expectedHash = getNoticeHash(noticeVersion);
    if (!expectedHash || expectedHash !== noticeHash) {
      const err = toHttpError('GUARDIAN_CONSENT_NOTICE_MISMATCH');
      return reply.status(err.statusCode).send(err);
    }

    const familyId = await withIdentityTransaction(
      pool,
      { accountId: actor.accountId, purpose: 'SELF_IDENTITY' },
      (tx) => getFamilyIdByPersonId(tx, actor.personId)
    );
    if (!familyId) {
      const err = toHttpError('CURRENT_FAMILY_NOT_FOUND');
      return reply.status(err.statusCode).send(err);
    }

    try {
      const result = await withRlsTransaction(
        pool,
        { familyId, accountId: actor.accountId, personId: actor.personId, purpose: 'FAMILY_MANAGEMENT' },
        async (tx) => {
          const request = await getConsentRequestForUpdate(tx, consentRequestId);
          if (!request) {
            throw Object.assign(new Error('Request not found'), {
              statusCode: 404,
              code: 'CURRENT_FAMILY_NOT_FOUND',
            });
          }
          if (request.status !== 'PENDING') {
            throw Object.assign(new Error('Already granted'), {
              statusCode: 409,
              code: 'GUARDIAN_CONSENT_ALREADY_GRANTED',
            });
          }
          if (new Date(request.expires_at) < new Date()) {
            throw Object.assign(new Error('Expired'), {
              statusCode: 403,
              code: 'GUARDIAN_CONSENT_EXPIRED',
            });
          }
          if (request.notice_version !== noticeVersion || request.notice_hash !== noticeHash) {
            throw Object.assign(new Error('Notice mismatch'), {
              statusCode: 403,
              code: 'GUARDIAN_CONSENT_NOTICE_MISMATCH',
            });
          }

          await updateConsentRequestGranted(tx, consentRequestId);

          return insertConsentRecord(
            tx, familyId, actor.personId, actor.accountId,
            'GRANTED', 1, consentRequestId, null, null,
            noticeVersion, noticeHash, 'v1',
            JSON.stringify({ accepted: true, timestamp: new Date().toISOString() })
          );
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
