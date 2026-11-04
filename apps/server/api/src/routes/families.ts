/**
 * Family routes: POST /api/v1/families, GET /api/v1/families/current.
 */

import type { FastifyInstance } from 'fastify';
import { CreateFamilyRequest } from '@xiaoshuyin/contracts';
import { withFamilyCreationTransaction, withIdentityTransaction } from '../db/tx.js';
import { toHttpError } from '../plugins/error-handler.js';
import { hashPayload } from '@xiaoshuyin/domain';
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
    const { rows: idemRows } = await pool.query(
      `SELECT response_status, response_body, request_hash
       FROM idempotency_keys
       WHERE actor_account_id = $1 AND command_type = 'FAMILY_CREATE' AND idempotency_key = $2`,
      [actor.accountId, idempotencyKey]
    );

    if (idemRows.length > 0) {
      if (idemRows[0].request_hash === requestHash) {
        return reply.status(idemRows[0].response_status).send(idemRows[0].response_body);
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
          // Insert membership
          await tx.query(
            `INSERT INTO family_members (family_id, person_id) VALUES ($1, $2)`,
            [newFamilyId, actor.personId]
          );

          // Insert ADULT compliance profile
          await tx.query(
            `INSERT INTO person_compliance_profiles (person_id, age_band, minor_mode, verified_source)
             VALUES ($1, 'ADULT', false, 'SELF_STATEMENT')`,
            [actor.personId]
          );

          // Insert profile values
          if (profileValues) {
            for (const pv of profileValues) {
              await tx.query(
                `INSERT INTO person_profile_values (person_id, attribute, value_text, source_kind, provided_by_person_id, recorded_by_account_id)
                 VALUES ($1, $2, $3, $4, $5, $1)`,
                [actor.personId, pv.attribute, pv.valueText, pv.sourceKind, actor.personId]
              );
            }
          }

          // Insert audit event
          await tx.query(
            `INSERT INTO business_audit_events (family_id, actor_account_id, event_type, resource_type, resource_id)
             VALUES ($1, $2, 'FAMILY_CREATED', 'FAMILY', $1)`,
            [newFamilyId, actor.accountId]
          );

          return { familyId: newFamilyId };
        }
      );

      const responseBody = {
        id: result.familyId,
        displayName: displayName ?? null,
        isManager: true,
        createdAt: new Date().toISOString(),
      };

      // Store idempotency (needs identity context for RLS)
      await withIdentityTransaction(
        pool,
        { accountId: actor.accountId, purpose: 'SELF_IDENTITY' },
        async (tx) => {
          await tx.query(
            `INSERT INTO idempotency_keys (actor_account_id, command_type, idempotency_key, request_hash, response_status, response_body)
             VALUES ($1, 'FAMILY_CREATE', $2, $3, 201, $4)`,
            [actor.accountId, idempotencyKey, requestHash, JSON.stringify(responseBody)]
          );
        }
      );

      return reply.status(201).send(responseBody);
    } catch (err: any) {
      if (err.code === '23505') {
        const e = toHttpError('FAMILY_ALREADY_OWNED');
        return reply.status(e.statusCode).send(e);
      }
      console.error('Family creation error:', err.message, err.code, err.detail);
      throw err;
    }
  });

  app.get('/api/v1/families/current', async (req, reply) => {
    const actor = req.actor;
    if (!actor?.accountId || !actor?.personId) {
      const err = toHttpError('UNAUTHENTICATED');
      return reply.status(err.statusCode).send(err);
    }

    // Find family where actor is a member
    const { rows } = await pool.query(
      `SELECT f.id, f.display_name, f.created_by_person_id, f.created_at
       FROM families f
       JOIN family_members fm ON fm.family_id = f.id
       WHERE fm.person_id = $1`,
      [actor.personId]
    );

    if (rows.length === 0) {
      const err = toHttpError('CURRENT_FAMILY_NOT_FOUND');
      return reply.status(err.statusCode).send(err);
    }

    const family = rows[0];
    return reply.status(200).send({
      id: family.id,
      displayName: family.display_name,
      isManager: family.created_by_person_id === actor.personId,
      createdAt: family.created_at,
    });
  });
}
