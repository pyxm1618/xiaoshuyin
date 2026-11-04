/**
 * Member routes: POST /api/v1/families/:id/members, PATCH /api/v1/families/:id/members/:personId.
 * Per plan.md D-4: per-value provenance, source rules by path.
 */

import type { FastifyInstance } from 'fastify';
import { CreateMemberRequest, UpdateMemberRequest } from '@xiaoshuyin/contracts';
import { withRlsTransaction, withIdentityTransaction } from '../db/tx.js';
import { toHttpError } from '../plugins/error-handler.js';
import { hashPayload, checkSourceAcceptability, computeSupersede } from '@xiaoshuyin/domain';
import type pg from 'pg';

export function registerMemberRoutes(app: FastifyInstance, pool: pg.Pool) {
  // POST /api/v1/families/:id/members
  app.post('/api/v1/families/:id/members', async (req, reply) => {
    const actor = req.actor;
    if (!actor?.accountId || !actor?.personId) {
      const err = toHttpError('UNAUTHENTICATED');
      return reply.status(err.statusCode).send(err);
    }

    const familyId = (req.params as any).id;
    const parsed = CreateMemberRequest.safeParse(req.body);
    if (!parsed.success) {
      const err = toHttpError('VALIDATION_ERROR', 'Invalid request body');
      return reply.status(err.statusCode).send(err);
    }

    const { ageBand, ageBandSource, profileValues, guardianConsentId, idempotencyKey } = parsed.data;

    // Source acceptability check
    const path = ageBand === 'UNDER_14' ? 'MEMBER_CREATE_UNDER_14' : 'MEMBER_CREATE_OTHER';
    const sourceError = checkSourceAcceptability(path, ageBand, ageBandSource);
    if (sourceError) {
      const err = toHttpError(sourceError);
      return reply.status(err.statusCode).send(err);
    }

    // Check idempotency
    const requestHash = hashPayload({ ageBand, ageBandSource, profileValues, guardianConsentId });
    const { rows: idemRows } = await withIdentityTransaction(
      pool,
      { accountId: actor.accountId, purpose: 'SELF_IDENTITY' },
      async (tx) => {
        return tx.query(
          `SELECT response_status, response_body, request_hash FROM idempotency_keys
           WHERE actor_account_id = $1 AND command_type = 'MEMBER_CREATE' AND idempotency_key = $2`,
          [actor.accountId, idempotencyKey]
        );
      }
    );

    if (idemRows.length > 0) {
      if (idemRows[0].request_hash === requestHash) {
        return reply.status(idemRows[0].response_status).send(idemRows[0].response_body);
      }
      const err = toHttpError('IDEMPOTENCY_PAYLOAD_MISMATCH');
      return reply.status(err.statusCode).send(err);
    }

    try {
      const result = await withRlsTransaction(
        pool,
        { familyId, accountId: actor.accountId, personId: actor.personId, purpose: 'FAMILY_MANAGEMENT' },
        async (tx) => {
          // Check manager permission
          const { rows: famRows } = await tx.query(
            'SELECT created_by_person_id FROM families WHERE id = $1',
            [familyId]
          );
          if (famRows.length === 0) {
            throw Object.assign(new Error('Family not found'), { statusCode: 404, code: 'CURRENT_FAMILY_NOT_FOUND' });
          }
          if (famRows[0].created_by_person_id !== actor.personId) {
            throw Object.assign(new Error('Not manager'), { statusCode: 403, code: 'NOT_FAMILY_MANAGER' });
          }

          // Pre-generate personId
          const personId = crypto.randomUUID();

          // Insert membership (deferrable FK)
          await tx.query(
            `INSERT INTO family_members (family_id, person_id) VALUES ($1, $2)`,
            [familyId, personId]
          );

          // Insert person (account_id = NULL for members)
          await tx.query(
            `INSERT INTO persons (id, account_id, created_by_account_id) VALUES ($1, NULL, $2)`,
            [personId, actor.accountId]
          );

          // Insert compliance profile
          const isUnder14 = ageBand === 'UNDER_14';
          const minorMode = ageBand === 'MINOR_14_17' || ageBand === 'UNDER_14';

          if (isUnder14) {
            // Must have guardian consent
            if (!guardianConsentId) {
              throw Object.assign(new Error('Consent required'), { statusCode: 403, code: 'GUARDIAN_CONSENT_REQUIRED' });
            }
            // Lock and validate consent
            const { rows: consentRows } = await tx.query(
              `SELECT id, guardian_person_id, decision, bound_person_id, notice_hash
               FROM consent_records WHERE id = $1 FOR UPDATE`,
              [guardianConsentId]
            );
            if (consentRows.length === 0 || consentRows[0].decision !== 'GRANTED') {
              throw Object.assign(new Error('Invalid consent'), { statusCode: 403, code: 'GUARDIAN_CONSENT_REQUIRED' });
            }
            if (consentRows[0].bound_person_id !== null) {
              throw Object.assign(new Error('Already bound'), { statusCode: 409, code: 'GUARDIAN_CONSENT_ALREADY_BOUND' });
            }

            // Bind consent
            await tx.query(
              `UPDATE consent_records SET bound_person_id = $1, bound_at = now() WHERE id = $2 AND bound_person_id IS NULL`,
              [personId, guardianConsentId]
            );

            await tx.query(
              `INSERT INTO person_compliance_profiles (person_id, age_band, minor_mode, verified_source, guardian_person_id, guardian_consent_record_id, guardian_consent_version)
               VALUES ($1, $2, $3, $4, $5, $6, 1)`,
              [personId, ageBand, minorMode, ageBandSource, consentRows[0].guardian_person_id, guardianConsentId]
            );
          } else {
            await tx.query(
              `INSERT INTO person_compliance_profiles (person_id, age_band, minor_mode, verified_source)
               VALUES ($1, $2, $3, $4)`,
              [personId, ageBand, minorMode, ageBandSource]
            );
          }

          // Insert profile values with provenance
          if (profileValues) {
            for (const pv of profileValues) {
              await tx.query(
                `INSERT INTO person_profile_values (person_id, attribute, value_text, source_kind, provided_by_person_id, recorded_by_account_id)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [personId, pv.attribute, pv.valueText, pv.sourceKind, pv.providedByPersonId ?? actor.personId, actor.accountId]
              );
            }
          }

          // Audit
          await tx.query(
            `INSERT INTO business_audit_events (family_id, actor_account_id, event_type, resource_type, resource_id)
             VALUES ($1, $2, 'MEMBER_CREATED', 'PERSON', $3)`,
            [familyId, actor.accountId, personId]
          );

          return { personId };
        }
      );

      const responseBody = {
        personId: result.personId,
        accountBound: false,
        profile: {
          ageBand,
          minorMode: ageBand === 'MINOR_14_17' || ageBand === 'UNDER_14',
          verifiedSource: ageBandSource,
        },
        values: (profileValues ?? []).map((pv) => ({
          attribute: pv.attribute,
          valueText: pv.valueText,
          sourceKind: pv.sourceKind,
          status: 'RECORDED',
        })),
      };

      // Store idempotency
      await withIdentityTransaction(
        pool,
        { accountId: actor.accountId, purpose: 'SELF_IDENTITY' },
        async (tx) => {
          await tx.query(
            `INSERT INTO idempotency_keys (actor_account_id, command_type, idempotency_key, request_hash, response_status, response_body)
             VALUES ($1, 'MEMBER_CREATE', $2, $3, 201, $4)`,
            [actor.accountId, idempotencyKey, requestHash, JSON.stringify(responseBody)]
          );
        }
      );

      return reply.status(201).send(responseBody);
    } catch (err: any) {
      if (err.statusCode) {
        return reply.status(err.statusCode).send({ code: err.code, message: err.message });
      }
      if (err.code === '23505') {
        const e = toHttpError('MEMBER_ALREADY_EXISTS');
        return reply.status(e.statusCode).send(e);
      }
      // PG error from set_family_context: FAMILY_MEMBERSHIP_REQUIRED
      if (err.code === '42501' && err.message?.includes('FAMILY_MEMBERSHIP_REQUIRED')) {
        const e = toHttpError('NOT_FAMILY_MEMBER');
        return reply.status(e.statusCode).send(e);
      }
      throw err;
    }
  });

  // PATCH /api/v1/families/:id/members/:personId
  app.patch('/api/v1/families/:id/members/:personId', async (req, reply) => {
    const actor = req.actor;
    if (!actor?.accountId || !actor?.personId) {
      const err = toHttpError('UNAUTHENTICATED');
      return reply.status(err.statusCode).send(err);
    }

    const familyId = (req.params as any).id;
    const targetPersonId = (req.params as any).personId;
    const parsed = UpdateMemberRequest.safeParse(req.body);
    if (!parsed.success) {
      const err = toHttpError('VALIDATION_ERROR', 'Invalid request body');
      return reply.status(err.statusCode).send(err);
    }

    const { profileValues, idempotencyKey } = parsed.data;

    try {
      await withRlsTransaction(
        pool,
        { familyId, accountId: actor.accountId, personId: actor.personId, purpose: 'FAMILY_MANAGEMENT' },
        async (tx) => {
          // Check manager
          const { rows: famRows } = await tx.query(
            'SELECT created_by_person_id FROM families WHERE id = $1',
            [familyId]
          );
          if (famRows.length === 0 || famRows[0].created_by_person_id !== actor.personId) {
            throw Object.assign(new Error('Not manager'), { statusCode: 403, code: 'NOT_FAMILY_MANAGER' });
          }

          // Check target person is a member of this family
          const { rows: memberCheck } = await tx.query(
            'SELECT 1 FROM family_members WHERE family_id = $1 AND person_id = $2',
            [familyId, targetPersonId]
          );
          if (memberCheck.length === 0) {
            throw Object.assign(new Error('Target not in family'), { statusCode: 404, code: 'CURRENT_FAMILY_NOT_FOUND' });
          }

          // Update profile values (append with supersede)
          for (const pv of profileValues) {
            // Get existing RECORDED values for same (person, attribute, source)
            const { rows: existing } = await tx.query(
              `SELECT id FROM person_profile_values
               WHERE person_id = $1 AND attribute = $2 AND source_kind = $3 AND status = 'RECORDED'`,
              [targetPersonId, pv.attribute, pv.sourceKind]
            );

            // Supersede old values
            for (const ex of existing) {
              await tx.query(
                `UPDATE person_profile_values SET status = 'SUPERSEDED' WHERE id = $1`,
                [ex.id]
              );
            }

            // Insert new value
            await tx.query(
              `INSERT INTO person_profile_values (person_id, attribute, value_text, source_kind, provided_by_person_id, recorded_by_account_id, supersedes_id)
               VALUES ($1, $2, $3, $4, $5, $6, $7)`,
              [targetPersonId, pv.attribute, pv.valueText, pv.sourceKind, pv.providedByPersonId ?? actor.personId, actor.accountId, existing[0]?.id ?? null]
            );
          }

          // Audit
          await tx.query(
            `INSERT INTO business_audit_events (family_id, actor_account_id, event_type, resource_type, resource_id)
             VALUES ($1, $2, 'MEMBER_PROFILE_VALUE_RECORDED', 'PERSON', $3)`,
            [familyId, actor.accountId, targetPersonId]
          );
        }
      );

      return reply.status(200).send({ success: true });
    } catch (err: any) {
      if (err.statusCode) {
        return reply.status(err.statusCode).send({ code: err.code, message: err.message });
      }
      // PG error from set_family_context: FAMILY_MEMBERSHIP_REQUIRED
      if (err.code === '42501' && err.message?.includes('FAMILY_MEMBERSHIP_REQUIRED')) {
        const e = toHttpError('NOT_FAMILY_MEMBER');
        return reply.status(e.statusCode).send(e);
      }
      throw err;
    }
  });
}
