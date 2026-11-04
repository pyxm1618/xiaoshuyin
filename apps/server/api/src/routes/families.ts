/**
 * Family routes: POST /api/v1/families, GET /api/v1/families/current.
 * Data access via packages/domain repository (guard R4).
 */

import type { FastifyInstance } from 'fastify';
import { CreateFamilyRequest } from '@xiaoshuyin/contracts';
import { withFamilyCreationTransaction, withIdentityTransaction } from '../db/tx.js';
import { toHttpError } from '../plugins/error-handler.js';
import {
  hashPayload,
  insertFamilyMember,
  insertProfileValue,
  insertAuditEvent,
  getIdempotencyKey,
  insertIdempotencyKey,
  getCurrentFamily,
} from '@xiaoshuyin/domain';
import { insertComplianceProfile } from '@xiaoshuyin/compliance';
import type pg from 'pg';

export function registerFamilyRoutes(app: FastifyInstance, pool: pg.Pool) {
  app.post('/api/v1/families', async (req, reply) => {
    const actor = req.actor;
    if (!actor?.accountId || !actor?.personId) {
      const err = toHttpError('UNAUTHENTICATED');
      return reply.status(err.statusCode).send(err);
    }

    const parsed = CreateFamilyRequest.safeParse(req.body);
    if (!parsed.success) {
      const err = toHttpError('VALIDATION_ERROR', 'Invalid request body');
      return reply.status(err.statusCode).send(err);
    }

    const { displayName, ageBandSource, profileValues, idempotencyKey } = parsed.data;

    // Validate ageBandSource: creator must use SELF_STATEMENT
    if (ageBandSource !== 'SELF_STATEMENT') {
      const err = toHttpError('AGE_BAND_SOURCE_NOT_ALLOWED', 'Creator must use SELF_STATEMENT');
      return reply.status(err.statusCode).send(err);
    }

    // Check idempotency
    const requestHash = hashPayload({ displayName, ageBandSource, profileValues });
    const existing = await withIdentityTransaction(
      pool,
      { accountId: actor.accountId, purpose: 'SELF_IDENTITY' },
      (tx) => getIdempotencyKey(tx, actor.accountId, 'FAMILY_CREATE', idempotencyKey)
    );

    if (existing) {
      if (existing.request_hash === requestHash) {
        return reply.status(existing.response_status).send(existing.response_body);
      }
      const err = toHttpError('IDEMPOTENCY_PAYLOAD_MISMATCH');
      return reply.status(err.statusCode).send(err);
    }

    const newFamilyId = crypto.randomUUID();

    try {
      const result = await withFamilyCreationTransaction(
        pool,
        {
          accountId: actor.accountId,
          personId: actor.personId,
          newFamilyId,
          displayName: displayName ?? null,
        },
        async (tx) => {
          await insertFamilyMember(tx, newFamilyId, actor.personId);
          await insertComplianceProfile(tx, actor.personId, 'ADULT', false, 'SELF_STATEMENT');

          if (profileValues) {
            for (const pv of profileValues) {
              await insertProfileValue(
                tx, actor.personId, pv.attribute, pv.valueText,
                pv.sourceKind, actor.personId, actor.accountId
              );
            }
          }

          await insertAuditEvent(tx, newFamilyId, actor.accountId, 'FAMILY_CREATED', 'FAMILY', newFamilyId);

          return { familyId: newFamilyId };
        }
      );

      const responseBody = {
        id: result.familyId,
        displayName: displayName ?? null,
        isManager: true,
        createdAt: new Date().toISOString(),
      };

      await withIdentityTransaction(
        pool,
        { accountId: actor.accountId, purpose: 'SELF_IDENTITY' },
        (tx) =>
          insertIdempotencyKey(
            tx, actor.accountId, 'FAMILY_CREATE', idempotencyKey,
            requestHash, 201, JSON.stringify(responseBody)
          )
      );

      return reply.status(201).send(responseBody);
    } catch (err: any) {
      if (err.code === '23505') {
        const e = toHttpError('FAMILY_ALREADY_OWNED');
        return reply.status(e.statusCode).send(e);
      }
      throw err;
    }
  });

  app.get('/api/v1/families/current', async (req, reply) => {
    const actor = req.actor;
    if (!actor?.accountId || !actor?.personId) {
      const err = toHttpError('UNAUTHENTICATED');
      return reply.status(err.statusCode).send(err);
    }

    const family = await withIdentityTransaction(
      pool,
      { accountId: actor.accountId, purpose: 'SELF_IDENTITY' },
      (tx) => getCurrentFamily(tx, actor.personId)
    );

    if (!family) {
      const err = toHttpError('CURRENT_FAMILY_NOT_FOUND');
      return reply.status(err.statusCode).send(err);
    }

    return reply.status(200).send({
      id: family.id,
      displayName: family.display_name,
      isManager: family.created_by_person_id === actor.personId,
      createdAt: family.created_at,
    });
  });
}
