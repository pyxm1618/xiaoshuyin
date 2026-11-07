/**
 * Member routes: POST /api/v1/families/:id/members, PATCH /api/v1/families/:id/members/:personId.
 * Per plan.md D-4: per-value provenance, source rules by path.
 * Data access via packages repository (guard R4).
 *
 * Frozen OpenAPI is the source of truth for request/response shapes and the
 * `Idempotency-Key` header.
 */

import type { FastifyInstance } from 'fastify';
import { CreateMemberRequest, UpdateMemberRequest } from '@xiaoshuyin/contracts';
import { setFamilyContext } from '../db/tx.js';
import { readIdempotencyKey, runIdempotentCommand, sendCommandOutcome } from '../idempotency.js';
import { toHttpError } from '../plugins/error-handler.js';
import {
  hashPayload,
  checkSourceAcceptability,
  resolveProvenanceProvider,
  insertFamilyMember,
  insertPerson,
  insertProfileValue,
  supersedeProfileValue,
  getProfileValuesBySource,
  getProfileValuesFull,
  insertAuditEvent,
  isFamilyMember,
  generateUuidv7,
} from '@xiaoshuyin/domain';
import { requireFamilyAction } from '../authz.js';
import {
  assertMinorProcessingAllowed,
  getCurrentNoticeHash,
  getConsentRecordById,
  getValidConsentForBinding,
  getComplianceProfileForUpdate,
  getComplianceProfile,
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
 *
 * Concurrency (Round 2 CRITICAL): the profile row is read FOR UPDATE and the
 * lock is held until the command's transaction commits. That is the single
 * serialization primitive shared with consent revocation — revoke's pointer
 * advance (`UPDATE person_compliance_profiles`) must wait for it, so a PATCH
 * that already observed the old GRANTED state can never commit after a revoke
 * has returned. The consent row is read WITHOUT a lock on purpose: processing
 * commands must never block on `consent_records`, otherwise they would form an
 * opposite lock order with revoke (which locks consent first, then profile).
 */
async function runProcessingGate(
  tx: pg.PoolClient,
  personId: string
): Promise<{ decision: 'ALLOW'; minorMode: boolean } | { decision: 'BLOCK'; reason: string }> {
  const row = await getComplianceProfileForUpdate(tx, personId);
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

function profileValueDto(v: any) {
  return {
    id: v.id,
    attribute: v.attribute,
    value: v.value_text,
    source: v.source_kind,
    providedByPersonId: v.provided_by_person_id,
    observedAt: v.observed_at ? v.observed_at.toISOString() : null,
    recordedAt: v.recorded_at.toISOString(),
    status: v.status,
    supersedesId: v.supersedes_id,
  };
}

async function buildMemberResponse(
  tx: pg.PoolClient,
  personId: string,
  familyId: string
) {
  const profile = await getComplianceProfile(tx, personId);
  if (!profile) {
    throw Object.assign(new Error('Profile missing'), {
      statusCode: 500,
      code: 'INTERNAL_ERROR',
    });
  }
  const values = await getProfileValuesFull(tx, personId);
  return {
    personId,
    familyId,
    accountBound: false,
    profile: {
      ageBand: profile.age_band,
      minorMode: profile.minor_mode,
      guardianPersonId: profile.guardian_person_id,
      guardianConsentVersion: profile.guardian_consent_version,
      verifiedSource: profile.verified_source,
      effectiveAt: profile.effective_at.toISOString(),
    },
    values: values.map(profileValueDto),
  };
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

    const { ageBand, ageBandSource, values, guardianConsentId } = parsed.data;
    const idempotencyKey = readIdempotencyKey(req);
    const requestHash = hashPayload({ familyId, ageBand, ageBandSource, values, guardianConsentId });

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
        },
        async (tx) => {
          // FR-011: member creation is decided by the unified authorize().
          await requireFamilyAction(tx, {
            accountId,
            personId,
            familyId,
            action: 'MEMBER_CREATE',
            purpose: 'FAMILY_MANAGEMENT',
            resource: { type: 'FAMILY', familyId },
          });

          // §4.4: establish family context before any family-scoped read/write.
          await setFamilyContext(tx, familyId, personId, 'FAMILY_MANAGEMENT');

          // Source acceptability check
          const path = ageBand === 'UNDER_14' ? 'MEMBER_CREATE_UNDER_14' : 'MEMBER_CREATE_OTHER';
          const sourceError = checkSourceAcceptability(path, ageBand, ageBandSource);
          if (sourceError) {
            throw Object.assign(new Error(sourceError), {
              statusCode: toHttpError(sourceError).statusCode,
              code: sourceError,
            });
          }

          const isUnder14 = ageBand === 'UNDER_14';
          const minorMode = ageBand === 'MINOR_14_17' || ageBand === 'UNDER_14';

          // consent-first (quickstart §2.3 / D-3): lock + validate the consent
          // BEFORE any child Person or Compliance Profile is created.
          // F2/F6: only the current, still-valid chain head with a schema-valid
          // evidence object may be bound.
          let lockedConsentId: string | null = null;
          let lockedGuardianPersonId: string | null = null;
          if (isUnder14) {
            if (!guardianConsentId) {
              throw Object.assign(new Error('Consent required'), { statusCode: 403, code: 'GUARDIAN_CONSENT_REQUIRED' });
            }
            const consent = await getConsentRecordById(tx, guardianConsentId);
            if (!consent) {
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
            const valid = await getValidConsentForBinding(tx, guardianConsentId, {
              familyId,
              guardianPersonId: personId,
              guardianAccountId: accountId,
              currentNoticeHash: getCurrentNoticeHash(),
            });
            if (!valid) {
              throw Object.assign(new Error('Invalid consent'), {
                statusCode: 403, code: 'GUARDIAN_CONSENT_REQUIRED',
              });
            }
            lockedConsentId = guardianConsentId;
            lockedGuardianPersonId = consent.guardian_person_id;
          }

          // UUIDv7 comes from PostgreSQL 18, never from crypto.randomUUID().
          const newPersonId = await generateUuidv7(tx);

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
          for (const pv of values ?? []) {
            const provider = await resolveProviderForValue(tx, familyId, {
              sourceKind: pv.source,
              subjectPersonId: newPersonId,
              actorPersonId: personId,
              providedByPersonId: pv.providedByPersonId ?? null,
              pinnedProvider: lockedGuardianPersonId,
            });

            // F9: at most one RECORDED per (person, attribute, source).
            const existing = await getProfileValuesBySource(
              tx, newPersonId, pv.attribute, pv.source
            );
            for (const ex of existing) {
              await supersedeProfileValue(tx, ex.id);
            }

            await insertProfileValue(
              tx,
              newPersonId,
              pv.attribute,
              pv.value,
              pv.source,
              provider,
              accountId,
              existing[0]?.id ?? null,
              pv.observedAt ? new Date(pv.observedAt) : null
            );
          }

          // Audit
          await insertAuditEvent(tx, familyId, accountId, 'MEMBER_CREATED', 'PERSON', newPersonId);

          return {
            status: 201,
            body: await buildMemberResponse(tx, newPersonId, familyId),
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

    const { values } = parsed.data;
    const idempotencyKey = readIdempotencyKey(req);
    const requestHash = hashPayload({ familyId, targetPersonId, values });

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
        },
        async (tx) => {
          // §4.4 / C2: the first authorization only proves membership, which is
          // readable from the actor's own self branch. The target-membership
          // fact used by MEMBER_UPDATE is family-scoped and only readable after
          // `set_family_context`, so the second authorize() runs there.
          await requireFamilyAction(tx, {
            accountId,
            personId,
            familyId,
            action: 'FAMILY_READ',
            purpose: 'FAMILY_MANAGEMENT',
            resource: { type: 'FAMILY', familyId },
          });

          await setFamilyContext(tx, familyId, personId, 'FAMILY_MANAGEMENT');

          // FR-011: manager + target-membership are decided by authorize().
          // A target person outside this family is a denial, not a new context.
          await requireFamilyAction(tx, {
            accountId,
            personId,
            familyId,
            action: 'MEMBER_UPDATE',
            purpose: 'FAMILY_MANAGEMENT',
            resource: { type: 'MEMBER', familyId, personId: targetPersonId },
            targetPersonId,
          });


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
          for (const pv of values) {
            const existing = await getProfileValuesBySource(tx, targetPersonId, pv.attribute, pv.source);

            const provider = await resolveProviderForValue(tx, familyId, {
              sourceKind: pv.source,
              subjectPersonId: targetPersonId,
              actorPersonId: personId,
              providedByPersonId: pv.providedByPersonId ?? null,
            });

            // Supersede old values
            for (const ex of existing) {
              await supersedeProfileValue(tx, ex.id);
            }

            // Insert new value (F8 keeps observedAt exactly when supplied)
            await insertProfileValue(
              tx,
              targetPersonId,
              pv.attribute,
              pv.value,
              pv.source,
              provider,
              accountId,
              existing[0]?.id ?? null,
              pv.observedAt ? new Date(pv.observedAt) : null
            );
          }

          // Audit
          await insertAuditEvent(tx, familyId, accountId, 'MEMBER_PROFILE_VALUE_RECORDED', 'PERSON', targetPersonId);

          return {
            status: 200,
            body: await buildMemberResponse(tx, targetPersonId, familyId),
          };
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