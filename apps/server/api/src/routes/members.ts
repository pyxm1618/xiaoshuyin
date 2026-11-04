/**
 * Member routes: POST /api/v1/families/:id/members, PATCH /api/v1/families/:id/members/:personId.
 * Per plan.md D-4: per-value provenance, source rules by path.
 * Data access via packages repository (guard R4).
 */

import type { FastifyInstance } from 'fastify';
import { CreateMemberRequest, UpdateMemberRequest } from '@xiaoshuyin/contracts';
import { withRlsTransaction, withIdentityTransaction } from '../db/tx.js';
import { toHttpError } from '../plugins/error-handler.js';
import {
  hashPayload,
  checkSourceAcceptability,
  getFamilyById,
  insertFamilyMember,
  insertPerson,
  insertProfileValue,
  supersedeProfileValue,
  getProfileValuesBySource,
  insertAuditEvent,
  getIdempotencyKey,
  insertIdempotencyKey,
  isFamilyMember,
} from '@xiaoshuyin/domain';
import {
  getConsentRecordById,
  bindConsentToPerson,
  insertComplianceProfile,
} from '@xiaoshuyin/compliance';
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
    const existing = await withIdentityTransaction(
      pool,
      { accountId: actor.accountId, purpose: 'SELF_IDENTITY' },
      (tx) => getIdempotencyKey(tx, actor.accountId, 'MEMBER_CREATE', idempotencyKey)
    );

    if (existing) {
      if (existing.request_hash === requestHash) {
        return reply.status(existing.response_status).send(existing.response_body);
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
          const family = await getFamilyById(tx, familyId);
          if (!family) {
            throw Object.assign(new Error('Family not found'), { statusCode: 404, code: 'CURRENT_FAMILY_NOT_FOUND' });
          }
          if (family.created_by_person_id !== actor.personId) {
            throw Object.assign(new Error('Not manager'), { statusCode: 403, code: 'NOT_FAMILY_MANAGER' });
          }

          // Pre-generate personId
          const personId = crypto.randomUUID();

          // Insert membership (deferrable FK)
          await insertFamilyMember(tx, familyId, personId);

          // Insert person (account_id = NULL for members)
          await insertPerson(tx, personId, null, actor.accountId);

          // Insert compliance profile
          const isUnder14 = ageBand === 'UNDER_14';
          const minorMode = ageBand === 'MINOR_14_17' || ageBand === 'UNDER_14';

          if (isUnder14) {
            if (!guardianConsentId) {
              throw Object.assign(new Error('Consent required'), { statusCode: 403, code: 'GUARDIAN_CONSENT_REQUIRED' });
            }
            // Lock and validate consent
            const consent = await getConsentRecordById(tx, guardianConsentId);
            if (!consent || consent.decision !== 'GRANTED') {
              throw Object.assign(new Error('Invalid consent'), { statusCode: 403, code: 'GUARDIAN_CONSENT_REQUIRED' });
            }
            if (consent.bound_person_id !== null) {
              throw Object.assign(new Error('Already bound'), { statusCode: 409, code: 'GUARDIAN_CONSENT_ALREADY_BOUND' });
            }

            // Bind consent
            await bindConsentToPerson(tx, guardianConsentId, personId);

            await insertComplianceProfile(
              tx, personId, ageBand, minorMode, ageBandSource,
              consent.guardian_person_id, guardianConsentId, 1
            );
          } else {
            await insertComplianceProfile(tx, personId, ageBand, minorMode, ageBandSource);
          }

          // Insert profile values with provenance
          if (profileValues) {
            for (const pv of profileValues) {
              await insertProfileValue(
                tx, personId, pv.attribute, pv.valueText,
                pv.sourceKind, pv.providedByPersonId ?? actor.personId, actor.accountId
              );
            }
          }

          // Audit
          await insertAuditEvent(tx, familyId, actor.accountId, 'MEMBER_CREATED', 'PERSON', personId);

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

      await withIdentityTransaction(
        pool,
        { accountId: actor.accountId, purpose: 'SELF_IDENTITY' },
        (tx) =>
          insertIdempotencyKey(
            tx, actor.accountId, 'MEMBER_CREATE', idempotencyKey,
            requestHash, 201, JSON.stringify(responseBody)
          )
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
          const family = await getFamilyById(tx, familyId);
          if (!family || family.created_by_person_id !== actor.personId) {
            throw Object.assign(new Error('Not manager'), { statusCode: 403, code: 'NOT_FAMILY_MANAGER' });
          }

          // Check target person is a member of this family
          const isMember = await isFamilyMember(tx, familyId, targetPersonId);
          if (!isMember) {
            throw Object.assign(new Error('Target not in family'), { statusCode: 404, code: 'CURRENT_FAMILY_NOT_FOUND' });
          }

          // Update profile values (append with supersede)
          for (const pv of profileValues) {
            const existing = await getProfileValuesBySource(tx, targetPersonId, pv.attribute, pv.sourceKind);

            // Supersede old values
            for (const ex of existing) {
              await supersedeProfileValue(tx, ex.id);
            }

            // Insert new value
            await insertProfileValue(
              tx, targetPersonId, pv.attribute, pv.valueText,
              pv.sourceKind, pv.providedByPersonId ?? actor.personId, actor.accountId,
              existing[0]?.id ?? null
            );
          }

          // Audit
          await insertAuditEvent(tx, familyId, actor.accountId, 'MEMBER_PROFILE_VALUE_RECORDED', 'PERSON', targetPersonId);
        }
      );

      return reply.status(200).send({ success: true });
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
