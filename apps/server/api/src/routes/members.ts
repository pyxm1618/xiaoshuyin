/**
 * Member routes: POST /api/v1/families/:id/members, PATCH /api/v1/families/:id/members/:personId.
 * Per plan.md D-4: per-value provenance, source rules by path.
 * Data access via packages repository (guard R4).
 */

import type { FastifyInstance } from 'fastify';
import { CreateMemberRequest, UpdateMemberRequest } from '@xiaoshuyin/contracts';
import { runIdempotentCommand, sendCommandOutcome } from '../idempotency.js';
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
    const accountId = actor?.accountId;
    const personId = actor?.personId;
    if (!accountId || !personId) {
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
    const requestHash = hashPayload({ familyId, ageBand, ageBandSource, profileValues, guardianConsentId });

    try {
      const outcome = await runIdempotentCommand(
        pool,
        {
          accountId,
          personId,
          purpose: 'FAMILY_MANAGEMENT',
          commandType: 'MEMBER_CREATE',
          idempotencyKey,
          requestHash,
          resolveFamilyId: async () => familyId,
        },
        async (tx) => {
          // Source acceptability check
          const path = ageBand === 'UNDER_14' ? 'MEMBER_CREATE_UNDER_14' : 'MEMBER_CREATE_OTHER';
          const sourceError = checkSourceAcceptability(path, ageBand, ageBandSource);
          if (sourceError) {
            throw Object.assign(new Error(sourceError), {
              statusCode: toHttpError(sourceError).statusCode,
              code: sourceError,
            });
          }

          // Check manager permission
          const family = await getFamilyById(tx, familyId);
          if (!family) {
            throw Object.assign(new Error('Family not found'), { statusCode: 404, code: 'CURRENT_FAMILY_NOT_FOUND' });
          }
          if (family.created_by_person_id !== personId) {
            throw Object.assign(new Error('Not manager'), { statusCode: 403, code: 'NOT_FAMILY_MANAGER' });
          }

          const isUnder14 = ageBand === 'UNDER_14';
          const minorMode = ageBand === 'MINOR_14_17' || ageBand === 'UNDER_14';

          // consent-first (quickstart §2.3 / D-3): lock + validate the consent
          // BEFORE any child Person or Compliance Profile is created.
          let lockedConsentId: string | null = null;
          let lockedGuardianPersonId: string | null = null;
          if (isUnder14) {
            if (!guardianConsentId) {
              throw Object.assign(new Error('Consent required'), { statusCode: 403, code: 'GUARDIAN_CONSENT_REQUIRED' });
            }
            // Lock and validate consent
            const consent = await getConsentRecordById(tx, guardianConsentId);
            if (!consent || consent.decision !== 'GRANTED') {
              throw Object.assign(new Error('Invalid consent'), { statusCode: 403, code: 'GUARDIAN_CONSENT_REQUIRED' });
            }
            if (consent.guardian_person_id !== personId) {
              throw Object.assign(new Error('Not the guardian of this consent'), {
                statusCode: 403, code: 'NOT_GUARDIAN',
              });
            }
            if (consent.bound_person_id !== null) {
              throw Object.assign(new Error('Already bound'), { statusCode: 409, code: 'GUARDIAN_CONSENT_ALREADY_BOUND' });
            }
            lockedConsentId = guardianConsentId;
            lockedGuardianPersonId = consent.guardian_person_id;
          }

          // Pre-generate personId
          const newPersonId = crypto.randomUUID();

          // Insert membership (deferrable FK)
          await insertFamilyMember(tx, familyId, newPersonId);

          // Insert person (account_id = NULL for members)
          await insertPerson(tx, newPersonId, null, accountId);

          if (lockedConsentId && lockedGuardianPersonId) {
            // Bind consent AFTER the Person exists (immediate FK on bound_person_id)
            await bindConsentToPerson(tx, lockedConsentId, newPersonId);

            await insertComplianceProfile(
              tx, newPersonId, ageBand, minorMode, ageBandSource,
              lockedGuardianPersonId, lockedConsentId, 1
            );
          } else {
            await insertComplianceProfile(tx, newPersonId, ageBand, minorMode, ageBandSource);
          }

          // Insert profile values with provenance
          if (profileValues) {
            for (const pv of profileValues) {
              await insertProfileValue(
                tx, newPersonId, pv.attribute, pv.valueText,
                pv.sourceKind, pv.providedByPersonId ?? personId, accountId
              );
            }
          }

          // Audit
          await insertAuditEvent(tx, familyId, accountId, 'MEMBER_CREATED', 'PERSON', newPersonId);

          return {
            status: 201,
            body: {
              personId: newPersonId,
              accountBound: false,
              profile: {
                ageBand,
                minorMode,
                verifiedSource: ageBandSource,
              },
              values: (profileValues ?? []).map((pv) => ({
                attribute: pv.attribute,
                valueText: pv.valueText,
                sourceKind: pv.sourceKind,
                status: 'RECORDED',
              })),
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
    const accountId = actor?.accountId;
    const personId = actor?.personId;
    if (!accountId || !personId) {
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
    const requestHash = hashPayload({ familyId, targetPersonId, profileValues });

    try {
      const outcome = await runIdempotentCommand(
        pool,
        {
          accountId,
          personId,
          purpose: 'FAMILY_MANAGEMENT',
          commandType: 'MEMBER_UPDATE',
          idempotencyKey,
          requestHash,
          resolveFamilyId: async () => familyId,
        },
        async (tx) => {
          // Check manager
          const family = await getFamilyById(tx, familyId);
          if (!family || family.created_by_person_id !== personId) {
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
              pv.sourceKind, pv.providedByPersonId ?? personId, accountId,
              existing[0]?.id ?? null
            );
          }

          // Audit
          await insertAuditEvent(tx, familyId, accountId, 'MEMBER_PROFILE_VALUE_RECORDED', 'PERSON', targetPersonId);

          return { status: 200, body: { success: true } };
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
}
