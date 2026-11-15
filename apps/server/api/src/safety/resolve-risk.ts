/**
 * Slice 9 — `ResolveRisk` internal Domain Command (plan §6.3 / §9).
 *
 * The ONLY legal exit from SAFETY_HOLD. Internal only: NO HTTP route exists.
 *
 * AUTH-007/AUTH-008 production posture:
 *   - one database-backed Staff authority source establishes SAFETY_RESOLVE;
 *   - exact current Case assignment is mandatory in addition to capability;
 *   - Family Manager / Guardian / participant / ordinary Account / AI never
 *     produce the resolver fact;
 *   - existing Review Evidence + approved/versioned hold policy context remain
 *     mandatory before SAFETY_HOLD may transition to WAITING.
 */

import pg from 'pg';
import {
  acquireIdempotencySlot,
  caseIdempotencyKeyBytes,
  completeIdempotency,
  createProductionSafetyResolutionAuthoritySource,
  getCaseForUpdate,
  hashPayload,
  insertRiskResolvedRiskEvent,
  insertSafetyAuditEvent,
  insertSafetyCaseEvent,
  isSafetyError,

  type ApprovedPolicyIdentity,
  type OpaqueEvidenceReference,
  type SafetyWriteTx,
} from '@xiaoshuyin/domain';
// S9-H01: package-internal primitive, deliberately not part of the
// `@xiaoshuyin/domain` production root export surface.
import { transitionCaseStatus } from '../../../../../packages/domain/src/safety/case-transition.js';
import { withDrizzleIdentityTransaction, type SafetyDrizzleTx } from '../db/drizzle-tx.js';
import { requireFamilyAction } from '../authz.js';
import { toHttpError } from '../plugins/error-handler.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const RESOLVE_RISK_COMMAND = 'CASE_RESOLVE_RISK' as const;

/** Existing Evidence carriers a review reference may point at. */
const REVIEW_CARRIERS: Record<string, { table: string }> = {
  ASSERTION: { table: 'assertions' },
  OBSERVATION: { table: 'observations' },
  MESSAGE: { table: 'dialogue_messages' },
};

export interface ResolveRiskInput {
  accountId: string;
  personId: string;
  caseId: string;
  idempotencyKey: string;
  expectedCaseVersion: number;
  reviewEvidenceRefs: OpaqueEvidenceReference[];
  /** Current approved/versioned Safety Policy + Rule identity from the trusted seam. */
  trustedPolicyIdentity: ApprovedPolicyIdentity;
}

export interface ResolveRiskResponse {
  caseId: string;
  status: 'WAITING';
  phase: string;
  fromStatus: 'SAFETY_HOLD';
  fromVersion: number;
  version: number;
  riskEventId: string;
}

function httpError(code: string, message?: string) {
  const error = toHttpError(code, message);
  return Object.assign(new Error(error.message), error);
}

function isStaffAuthorityDatabaseDenial(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === '42501' &&
    'message' in error &&
    (error as { message?: unknown }).message === 'STAFF_ASSIGNMENT_REQUIRED'
  );
}

function asSafetyWriteTx(tx: SafetyDrizzleTx): SafetyWriteTx {
  return tx as unknown as SafetyWriteTx;
}

function sortedRefs(refs: OpaqueEvidenceReference[]) {
  return [...refs]
    .map((reference) => ({ kind: reference.kind, ref: reference.ref }))
    .sort((a, b) => `${a.kind}:${a.ref}`.localeCompare(`${b.kind}:${b.ref}`));
}

function buildRequestHash(input: {
  familyId: string;
  caseId: string;
  expectedCaseVersion: number;
  reviewEvidenceRefs: OpaqueEvidenceReference[];
  authorityRef: string;
  trustedPolicyIdentity: ApprovedPolicyIdentity;
}): string {
  return hashPayload({
    familyId: input.familyId,
    caseId: input.caseId,
    expectedCaseVersion: input.expectedCaseVersion,
    reviewEvidenceRefs: sortedRefs(input.reviewEvidenceRefs),
    authorityRef: input.authorityRef,
    trustedPolicyIdentity: input.trustedPolicyIdentity,
  });
}


function samePolicyIdentity(
  context: {
    policyRef: string;
    policyVersion: string;
    ruleRef: string;
    ruleVersion: string;
  },
  trusted: ApprovedPolicyIdentity
): boolean {
  return (
    context.policyRef === trusted.policyRef &&
    context.policyVersion === trusted.policyVersion &&
    context.ruleRef === trusted.ruleRef &&
    context.ruleVersion === trusted.ruleVersion
  );
}

function assertEvidenceShape(refs: OpaqueEvidenceReference[]): void {
  if (!Array.isArray(refs) || refs.length === 0) {
    throw new SafetyShapeError();
  }
  for (const reference of refs) {
    if (
      typeof reference !== 'object' ||
      reference === null ||
      typeof reference.kind !== 'string' ||
      typeof reference.ref !== 'string' ||
      !REVIEW_CARRIERS[reference.kind] ||
      !UUID_PATTERN.test(reference.ref)
    ) {
      throw new SafetyShapeError();
    }
  }
}

class SafetyShapeError extends Error {
  readonly code = 'SAFETY_REVIEW_EVIDENCE_INVALID' as const;
}

/**
 * Every reference must resolve to a row of the SAME Family and SAME Case under
 * its own carrier contract. Explicit SQL is justified: cross-carrier reference
 * validation inside the already-open RLS transaction.
 */
async function assertEvidenceBelongsToCase(
  client: pg.PoolClient,
  input: {
    familyId: string;
    caseId: string;
    refs: OpaqueEvidenceReference[];
  }
): Promise<void> {
  for (const reference of input.refs) {
    const carrier = REVIEW_CARRIERS[reference.kind]!;
    const { rows } = await client.query(
      `SELECT 1 FROM ${carrier.table} WHERE id = $1 AND family_id = $2 AND case_id = $3`,
      [reference.ref, input.familyId, input.caseId]
    );
    if (rows.length === 0) {
      throw httpError('SAFETY_REVIEW_EVIDENCE_INVALID');
    }
  }
}

/**
 * Exactly one unresolved HOLD_ENTERED trace must exist for the held period.
 *
 * That trace is the existing approved/versioned Safety Policy context: it could
 * only have been persisted by EnterSafetyHold after trusted policy-identity
 * validation. ResolveRisk re-reads the complete opaque identity here instead
 * of inventing a second Safety-policy model.
 */
async function findActiveHoldPolicyContext(
  client: pg.PoolClient,
  input: { familyId: string; caseId: string }
): Promise<{
  id: string;
  policyRef: string;
  policyVersion: string;
  ruleRef: string;
  ruleVersion: string;
}> {
  const { rows } = await client.query<{
    id: string;
    policy_ref: string | null;
    policy_version: string | null;
    rule_ref: string | null;
    rule_version: string | null;
  }>(
    `SELECT r.id, r.policy_ref, r.policy_version, r.rule_ref, r.rule_version
       FROM risk_events r
      WHERE r.family_id = $1
        AND r.case_id = $2
        AND r.event_kind = 'HOLD_ENTERED'
        AND NOT EXISTS (
          SELECT 1 FROM risk_events resolved
           WHERE resolved.resolution_of_risk_event_id = r.id
        )`,
    [input.familyId, input.caseId]
  );

  const row = rows[0];
  if (
    rows.length !== 1 ||
    !row ||
    typeof row.policy_ref !== 'string' ||
    row.policy_ref.trim() === '' ||
    typeof row.policy_version !== 'string' ||
    row.policy_version.trim() === '' ||
    typeof row.rule_ref !== 'string' ||
    row.rule_ref.trim() === '' ||
    typeof row.rule_version !== 'string' ||
    row.rule_version.trim() === ''
  ) {
    throw httpError('INTERNAL_ERROR', 'Safety policy context inconsistent');
  }

  return {
    id: row.id,
    policyRef: row.policy_ref,
    policyVersion: row.policy_version,
    ruleRef: row.rule_ref,
    ruleVersion: row.rule_version,
  };
}

export async function resolveRisk(
  pool: pg.Pool,
  input: ResolveRiskInput
): Promise<{ status: number; body: unknown }> {
  const caseId = input.caseId.toLowerCase();
  if (!UUID_PATTERN.test(caseId)) {
    throw httpError('CASE_NOT_FOUND', 'Case not found');
  }
  if (!Number.isInteger(input.expectedCaseVersion) || input.expectedCaseVersion < 1) {
    throw httpError('STALE_CASE_VERSION');
  }
  try {
    assertEvidenceShape(input.reviewEvidenceRefs);
  } catch {
    throw httpError('SAFETY_REVIEW_EVIDENCE_INVALID');
  }

  try {
    return await withDrizzleIdentityTransaction(
      pool,
      {
        accountId: input.accountId,
        personId: input.personId,
        purpose: 'SAFETY_RESOLUTION',
      },
      async (tx, client) => {
        // Resolve Staff authority facts in the SAME transaction used by the
        // command. No test/provider injection exists in production.
        const authoritySource = createProductionSafetyResolutionAuthoritySource({
          async query(text, values) {
            const result = await client.query(text, values);
            return { rows: result.rows };
          },
        });
        const authority = await authoritySource.resolve({
          caseId,
          accountId: input.accountId,
          personId: input.personId,
        });
        if (authority.status === 'UNAVAILABLE') {
          throw httpError('SAFETY_RESOLUTION_AUTHORITY_UNAVAILABLE');
        }
        if (authority.status === 'DENIED') {
          throw httpError('SAFETY_RESOLUTION_AUTHORITY_DENIED');
        }

        // The production authority source has already passed the one DB gate:
        // revoke/disable serialization is held, exact Case context is set, and
        // the Case row is locked. No household app.family_id is established.
        const familyId = authority.familyId;

        await requireFamilyAction(client, {
          accountId: input.accountId,
          personId: input.personId,
          familyId,
          action: 'CASE_RESOLVE_RISK',
          purpose: 'SAFETY_RESOLUTION',
          resource: { type: 'CASE', familyId, caseId },
          caseId,
          safetyResolution: {
            verified: true,
            authorityRef: authority.authorityRef,
            capability: authority.capability,
            capabilityGrantId: authority.capabilityGrantId,
            assignmentId: authority.assignmentId,
            familyId: authority.familyId,
            caseId: authority.caseId,
            accountId: authority.accountId,
            personId: authority.personId,
          },
        });

        const requestHash = buildRequestHash({
          familyId,
          caseId,
          expectedCaseVersion: input.expectedCaseVersion,
          reviewEvidenceRefs: input.reviewEvidenceRefs,
          authorityRef: authority.authorityRef,
          trustedPolicyIdentity: input.trustedPolicyIdentity,
        });
        const keyBytes = caseIdempotencyKeyBytes(input.idempotencyKey);

        const slot = await acquireIdempotencySlot(client, {
          actorAccountId: input.accountId,
          commandType: RESOLVE_RISK_COMMAND,
          keyBytes,
          requestHash,
        });
        if (slot.kind === 'REPLAY') return { status: slot.status, body: slot.body };
        if (slot.kind === 'MISMATCH') {
          throw httpError('IDEMPOTENCY_PAYLOAD_MISMATCH', 'Idempotency payload mismatch');
        }
        if (slot.kind === 'POISONED' || slot.kind === 'CONTENTION') {
          throw httpError('INTERNAL_ERROR', 'Idempotency slot unavailable');
        }

        const locked = await getCaseForUpdate(client, caseId);
        if (!locked) throw httpError('CASE_NOT_FOUND', 'Case not found');

        // Held state + current revision.
        if (locked.status !== 'SAFETY_HOLD') {
          throw httpError('SAFETY_HOLD_REQUIRED');
        }
        if (locked.version !== input.expectedCaseVersion) {
          throw httpError('STALE_CASE_VERSION');
        }

        // Review evidence must exist under its own carrier contract.
        await assertEvidenceBelongsToCase(client, {
          familyId,
          caseId,
          refs: input.reviewEvidenceRefs,
        });

        // The trace is linkage evidence, never a second status source.
        const holdPolicyContext = await findActiveHoldPolicyContext(client, { familyId, caseId });
        if (!samePolicyIdentity(holdPolicyContext, input.trustedPolicyIdentity)) {
          throw httpError('SAFETY_PRECHECK_STALE');
        }

        // Wall-clock revalidation immediately before the state change. The
        // first DB gate still holds the Account/grant/assignment serialization
        // and exact Case row lock; this second pass catches expiry. The Case
        // UPDATE RLS policy repeats the same clock_timestamp() predicate inside
        // the transition statement, so the mutation itself is authority-bound.
        const revalidated = await authoritySource.resolve({
          caseId,
          accountId: input.accountId,
          personId: input.personId,
        });
        if (
          revalidated.status !== 'VERIFIED' ||
          revalidated.authorityRef !== authority.authorityRef ||
          revalidated.capabilityGrantId !== authority.capabilityGrantId ||
          revalidated.assignmentId !== authority.assignmentId ||
          revalidated.familyId !== familyId
        ) {
          throw httpError('SAFETY_RESOLUTION_AUTHORITY_DENIED');
        }

        const transitioned = await transitionCaseStatus(asSafetyWriteTx(tx), {
          caseId,
          expectedVersion: locked.version,
          toStatus: 'WAITING',
        });
        if (!transitioned) throw httpError('STALE_CASE_VERSION');

        const riskEventId = await insertRiskResolvedRiskEvent(asSafetyWriteTx(tx), {
          familyId,
          caseId,
          actorAccountId: input.accountId,
          decisionCaseVersion: locked.version,
          resolutionOfRiskEventId: holdPolicyContext.id,
          evidenceRefs: input.reviewEvidenceRefs,
          resolutionAuthorityRef: authority.authorityRef,
        });

        await insertSafetyCaseEvent(asSafetyWriteTx(tx), {
          familyId,
          caseId,
          actorAccountId: input.accountId,
          eventType: 'CASE_RISK_RESOLVED',
          fromStatus: 'SAFETY_HOLD',
          toStatus: 'WAITING',
          fromVersion: locked.version,
          toVersion: transitioned.version,
          riskEventId,
        });

        await insertSafetyAuditEvent(asSafetyWriteTx(tx), {
          familyId,
          caseId,
          actorAccountId: input.accountId,
          eventType: 'CASE_RISK_RESOLVED',
          riskEventId,
          fromVersion: locked.version,
          toVersion: transitioned.version,
          resolutionAuthorityRef: authority.authorityRef,
        });

        const body: ResolveRiskResponse = {
          caseId,
          status: 'WAITING',
          phase: transitioned.phase,
          fromStatus: 'SAFETY_HOLD',
          fromVersion: locked.version,
          version: transitioned.version,
          riskEventId,
        };

        // Idempotency completion stays in the same transaction. No previous
        // phase/task/plan/reminder/schedule is resumed or recreated.
        await completeIdempotency(client, {
          actorAccountId: input.accountId,
          commandType: RESOLVE_RISK_COMMAND,
          keyBytes,
          status: 200,
          body,
        });

        return { status: 200, body };
      }
    );
  } catch (error) {
    if (isStaffAuthorityDatabaseDenial(error)) {
      throw httpError('SAFETY_RESOLUTION_AUTHORITY_DENIED');
    }
    if (isSafetyError(error)) throw httpError(error.code);
    throw error;
  }
}