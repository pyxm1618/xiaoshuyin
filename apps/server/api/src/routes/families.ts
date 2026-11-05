/**
 * Family routes: POST /api/v1/families, GET /api/v1/families/current.
 * Data access via packages/domain repository (guard R4).
 */

import type { FastifyInstance } from 'fastify';
import { CreateFamilyRequest } from '@xiaoshuyin/contracts';
import { withIdentityTransaction } from '../db/tx.js';
import { runIdempotentCommand, sendCommandOutcome } from '../idempotency.js';
import { toHttpError } from '../plugins/error-handler.js';
import {
  hashPayload,
  insertFamilyMember,
  insertProfileValue,
  insertAuditEvent,
  getCurrentFamily,
} from '@xiaoshuyin/domain';
import { insertComplianceProfile } from '@xiaoshuyin/compliance';
import type pg from 'pg';

export function registerFamilyRoutes(app: FastifyInstance, pool: pg.Pool) {
  app.post('/api/v1/families', async (req, reply) => {
    const actor = req.actor;
    const accountId = actor?.accountId;
    const personId = actor?.personId;
    if (!accountId || !personId) {
      const err = toHttpError('UNAUTHENTICATED');
      return reply.status(err.statusCode).send(err);
    }

    const parsed = CreateFamilyRequest.safeParse(req.body);
    if (!parsed.success) {
      const err = toHttpError('VALIDATION_ERROR', 'Invalid request body');
      return reply.status(err.statusCode).send(err);
    }

    const { displayName, ageBand, ageBandSource, profileValues, idempotencyKey } = parsed.data;
    const requestHash = hashPayload({ displayName, ageBand, ageBandSource, profileValues });
    const newFamilyId = crypto.randomUUID();

    try {
      const outcome = await runIdempotentCommand(
        pool,
        {
          accountId,
          personId,
          purpose: 'FAMILY_MANAGEMENT',
          commandType: 'FAMILY_CREATE',
          idempotencyKey,
          requestHash,
          createFamily: { newFamilyId, displayName: displayName ?? null },
        },
        async (tx) => {
          // Validate ageBandSource: creator must use SELF_STATEMENT
          if (ageBandSource !== 'SELF_STATEMENT') {
            throw Object.assign(new Error('Creator must use SELF_STATEMENT'), {
              statusCode: 422,
              code: 'AGE_BAND_SOURCE_NOT_ALLOWED',
            });
          }

          await insertFamilyMember(tx, newFamilyId, personId);
          await insertComplianceProfile(tx, personId, 'ADULT', false, 'SELF_STATEMENT');

          if (profileValues) {
            for (const pv of profileValues) {
              await insertProfileValue(
                tx, personId, pv.attribute, pv.valueText,
                pv.sourceKind, personId, accountId
              );
            }
          }

          await insertAuditEvent(tx, newFamilyId, accountId, 'FAMILY_CREATED', 'FAMILY', newFamilyId);

          return {
            status: 201,
            body: {
              id: newFamilyId,
              displayName: displayName ?? null,
              isManager: true,
              createdAt: new Date().toISOString(),
            },
          };
        }
      );

      return sendCommandOutcome(reply, outcome);
    } catch (err: any) {
      if (err.statusCode) {
        return reply.status(err.statusCode).send({ code: err.code, message: err.message });
      }
      if (err.code === '23505') {
        const e = toHttpError('FAMILY_ALREADY_OWNED');
        return reply.status(e.statusCode).send(e);
      }
      throw err;
    }
  });

  app.get('/api/v1/families/current', async (req, reply) => {
    const actor = req.actor;
    const accountId = actor?.accountId;
    const personId = actor?.personId;
    if (!accountId || !personId) {
      const err = toHttpError('UNAUTHENTICATED');
      return reply.status(err.statusCode).send(err);
    }

    const family = await withIdentityTransaction(
      pool,
      { accountId, purpose: 'SELF_IDENTITY' },
      (tx) => getCurrentFamily(tx, personId)
    );

    if (!family) {
      const err = toHttpError('CURRENT_FAMILY_NOT_FOUND');
      return reply.status(err.statusCode).send(err);
    }

    return reply.status(200).send({
      id: family.id,
      displayName: family.display_name,
      isManager: family.created_by_person_id === personId,
      createdAt: family.created_at,
    });
  });
}
