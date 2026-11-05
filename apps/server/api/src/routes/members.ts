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
  resolveProvenanceProvider,
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
  assertMinorProcessingAllowed,
  getCurrentNoticeHash,
  getConsentRecordById,
  getComplianceProfileForGate,
  getConsentRecordForGate,
  bindConsentToPerson,
  insertComplianceProfile,
} from '@xiaoshuyin/compliance';
import type pg from 'pg';

/**
 * Resolve + validate the provenance provider for one profile-value write.
 * Violations → 422 AGE_BAND_SOURCE_NOT_ALLOWED (frozen provenance contract).
 */
async function resolveProviderForValue(
  tx: pg.PoolClient,
  familyId: string,
  args: {
    sourceKind: 'SELF_STATEMENT' | 'GUARDIAN_OBSERVATION' | 'GUARDIAN_RELAY' | 'OTHER_MEMBER_RELAY' | 'MANUAL_DEVICE_DATA' | 'STAFF_RECORD' | 'AI_HYPOTHESIS' | 'SOURCE_CONFIRMED';
    subjectPersonId: string;
    actorPersonId: string;
    providedByPersonId?: string | null;
    pinnedProvider?: string | null;
  }
): Promise<string> {
  const resolution = resolveProvenanceProvider(args);
  if (resolution.kind === 'INVALID') {
    throw Object.assign(new Error('Provenance provider not allowed'), {
      statusCode: 422, code: 'AGE_BAND_SOURCE_NOT_ALLOWED',
    });
  }
  if (resolution.kind === 'CANDIDATE') {
    const inFamily = await isFamilyMember(tx, familyId, resolution.provider);
    if (!inFamily) {
      throw Object.assign(new Error('Provenance provider is not a family member'), {
        statusCode: 422, code: 'AGE_BAND_SOURCE_NOT_ALLOWED',
      });
    }
  }
  return resolution.provider;
}

/**
 * Run the frozen processing gate against a Person.
 * `assertMinorProcessingAllowed` is a pure sync function; the profile/consent
 * rows are fetched first so the gate itself stays read-only.
 */
async function runProcessingGate(
  tx: pg.PoolClient,
  personId: string
): Promise<{ decision: 'ALLOW'; minorMode: boolean } | { decision: 'BLOCK'; reason: string }> {
  const row = await getComplianceProfileForGate(tx, personId);
  const profile = row
    ? {
        ageBand: row.age_band as 'ADULT' | 'MINOR_14_17' | 'UNDER_14' | 'UNKNOWN',
        minorMode: row.minor_mode as boolean,
        guardianPersonId: (row.guardian_person_id ?? null) as string | null,
        guardianConsentRecordId: (row.guardian_consent_record_id ?? null) as string | null,
        guardianConsentVersion: (row.guardian_consent_version ?? null) as number | null,
        verifiedSource: row.verified_source as string,
      }
    : null;

  let consent: {
    id: string;
    decision: 'GRANTED' | 'REVOKED';
    boundPersonId: string | null;
    noticeHash: string;
    guardianPersonId: string;
  } | null = null;
  if (profile?.guardianConsentRecordId) {
    const c = await getConsentRecordForGate(tx, profile.guardianConsentRecordId);
    consent = c
      ? {
          id: c.id,
          decision: c.decision,
          boundPersonId: c.bound_person_id,
          noticeHash: c.notice_hash,
          guardianPersonId: c.guardian_person_id,
        }
      : null;
  }

  return assertMinorProcessingAllowed(personId, {
    getProfile: () => profile,
    getConsentRecord: () => consent,
    getCurrentNoticeHash,
  });
}

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

          // Insert profile values with provenance.
          // UNDER_14: provider is PINNED to consent.guardian_person_id.
          if (profileValues) {
            for (const pv of profileValues) {
              const provider = await resolveProviderForValue(tx, familyId, {
                sourceKind: pv.sourceKind,
                subjectPersonId: newPersonId,
                actorPersonId: personId,
                providedByPersonId: pv.providedByPersonId ?? null,
                pinnedProvider: lockedGuardianPersonId,
              });
              await insertProfileValue(
                tx, newPersonId, pv.attribute, pv.valueText,
                pv.sourceKind, provider, accountId
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

          // Processing gate (contracts/consent-onboarding.md §7): must run BEFORE
          // any profile-value write. An UNDER_14 Person whose current consent
          // pointer is no longer GRANTED must not be processed any further.
          const gateResult = await runProcessingGate(tx, targetPersonId);
          if (gateResult.decision === 'BLOCK') {
            throw Object.assign(new Error(gateResult.reason), {
              statusCode: toHttpError(gateResult.reason).statusCode,
              code: gateResult.reason,
            });
          }

          // Update profile values (append with supersede)
          for (const pv of profileValues) {
            const existing = await getProfileValuesBySource(tx, targetPersonId, pv.attribute, pv.sourceKind);

            const provider = await resolveProviderForValue(tx, familyId, {
              sourceKind: pv.sourceKind,
              subjectPersonId: targetPersonId,
              actorPersonId: personId,
              providedByPersonId: pv.providedByPersonId ?? null,
            });

            // Supersede old values
            for (const ex of existing) {
              await supersedeProfileValue(tx, ex.id);
            }

            // Insert new value
            await insertProfileValue(
              tx, targetPersonId, pv.attribute, pv.valueText,
              pv.sourceKind, provider, accountId,
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
