/**
 * Slice 9 — `ResolveRisk` internal Domain Command (plan §6.3 / §9).
 *
 * The ONLY legal exit from SAFETY_HOLD. Internal only: NO HTTP route exists.
 *
 * Production posture (Frozen Spec §8.3 / C4 / FR-014):
 *   - the default authority source returns `UNAVAILABLE`, so a production
 *     caller can never resolve a hold;
 *   - Family manager / guardian / participant / ordinary Account / admin-like
 *     strings are never promoted to resolver authority;
 *   - a controlled test composition may inject a verified fact.
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
  lockFamilyForPrimaryDecision,

  type OpaqueEvidenceReference,
  type SafetyResolutionAuthoritySource,
  type SafetyWriteTx,
} from '@xiaoshuyin/domain';
// S9-H01: package-internal primitive, deliberately not part of the
// `@xiaoshuyin/domain` production root export surface.
import { transitionCaseStatus } from '../../../../../packages/domain/src/safety/case-transition.js';
import { withDrizzleRlsTransaction, type SafetyDrizzleTx } from '../db/drizzle-tx.js';
import { withIdentityTransaction } from '../db/tx.js';
import { requireCurrentFamily } from '../family-context.js';
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
  /**
   * Composition seam. Production omits it and therefore fails closed; tests
   * inject a verified capability from `tests/setup/safety-resolver.ts`.
   */
  authoritySource?: SafetyResolutionAuthoritySource;
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
}): string {
  return hashPayload({
    familyId: input.familyId,
    caseId: input.caseId,
    expectedCaseVersion: input.expectedCaseVersion,
    reviewEvidenceRefs: sortedRefs(input.reviewEvidenceRefs),
    authorityRef: input.authorityRef,
  });
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

/** Exactly one unresolved HOLD_ENTERED trace must exist for the held period. */
async function findActiveHoldTrace(
  client: pg.PoolClient,
  input: { familyId: string; caseId: string }
): Promise<string> {
  const { rows } = await client.query<{ id: string }>(
    `SELECT r.id
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
  // Trace inconsistency is an internal invariant failure, never a second
  // source of status truth.
  if (rows.length !== 1) throw httpError('INTERNAL_ERROR', 'Safety trace inconsistent');
  return rows[0]!.id;
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

  const familyId = await withIdentityTransaction(
    pool,
    { accountId: input.accountId, purpose: 'FAMILY_MANAGEMENT' },
    (tx) => requireCurrentFamily(tx, input.personId)
  );

  const authoritySource =
    input.authoritySource ?? createProductionSafetyResolutionAuthoritySource();

  try {
    return await withDrizzleRlsTransaction(
      pool,
      {
        familyId,
        accountId: input.accountId,
        personId: input.personId,
        purpose: 'FAMILY_MANAGEMENT',
      },
      async (tx, client) => {
        // Resolve the separate capability BEFORE any disclosure or mutation.
        const authority = await authoritySource.resolve({
          familyId,
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

        await requireFamilyAction(client, {
          accountId: input.accountId,
          personId: input.personId,
          familyId,
          action: 'CASE_RESOLVE_RISK',
          purpose: 'FAMILY_MANAGEMENT',
          resource: { type: 'CASE', familyId, caseId },
          caseId,
          safetyResolution: { verified: true, authorityRef: authority.authorityRef },
        });

        const requestHash = buildRequestHash({
          familyId,
          caseId,
          expectedCaseVersion: input.expectedCaseVersion,
          reviewEvidenceRefs: input.reviewEvidenceRefs,
          authorityRef: authority.authorityRef,
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

        const familyVisible = await lockFamilyForPrimaryDecision(client, familyId);
        if (!familyVisible) throw httpError('CASE_NOT_FOUND', 'Case not found');

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
        const holdTraceId = await findActiveHoldTrace(client, { familyId, caseId });

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
          resolutionOfRiskEventId: holdTraceId,
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
    if (isSafetyError(error)) throw httpError(error.code);
    throw error;
  }
}