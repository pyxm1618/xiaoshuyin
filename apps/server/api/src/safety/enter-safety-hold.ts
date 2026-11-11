/**
 * Slice 9 — `EnterSafetyHold` internal Domain Command (plan §6.2 / §9).
 *
 * Internal only: NO HTTP route is registered for this command.
 *
 * One Drizzle-owned RLS transaction performs, in the frozen order:
 *   authorize → idempotency slot/replay → Family lock → Case lock/re-read →
 *   precheck freshness + policy identity revalidation → Case status/version →
 *   Risk Event → Case Event → Business Audit → idempotency completion.
 *
 * Every write joins the SAME checked-out client; there is no nested raw
 * transaction and no second connection.
 */

import pg from 'pg';
import {
  acquireIdempotencySlot,
  assertDecisionFreshForCase,
  caseIdempotencyKeyBytes,
  completeIdempotency,
  getCaseForUpdate,
  hashPayload,
  insertHoldEnteredRiskEvent,
  insertSafetyAuditEvent,
  insertSafetyCaseEvent,
  isSafetyError,
  lockFamilyForPrimaryDecision,
  transitionCaseStatus,
  type ApprovedPolicyIdentity,
  type SafetyPrecheckDecision,
  type SafetyWriteTx,
} from '@xiaoshuyin/domain';
import { withDrizzleRlsTransaction, type SafetyDrizzleTx } from '../db/drizzle-tx.js';
import { withIdentityTransaction } from '../db/tx.js';
import { requireCurrentFamily } from '../family-context.js';
import { requireFamilyAction } from '../authz.js';
import { toHttpError } from '../plugins/error-handler.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const ENTER_SAFETY_HOLD_COMMAND = 'CASE_ENTER_SAFETY_HOLD' as const;

export interface EnterSafetyHoldInput {
  accountId: string;
  personId: string;
  caseId: string;
  idempotencyKey: string;
  /** The Case revision the decision was made against. */
  expectedCaseVersion: number;
  /** Decision produced by the trusted deterministic precheck seam. */
  decision: SafetyPrecheckDecision;
  /** The currently approved policy/rule identity (trusted deterministic seam). */
  trustedPolicyIdentity: ApprovedPolicyIdentity;
}

export interface EnterSafetyHoldResponse {
  caseId: string;
  status: 'SAFETY_HOLD';
  phase: string;
  fromStatus: string;
  fromVersion: number;
  version: number;
  riskEventId: string;
}

function httpError(code: string, message?: string) {
  const error = toHttpError(code, message);
  return Object.assign(new Error(error.message), error);
}

/**
 * Drizzle's transaction handle and its database handle expose the same
 * `insert`/`select`/`execute` surface. The cast is centralised here so no
 * individual write site weakens typing.
 */
function asSafetyWriteTx(tx: SafetyDrizzleTx): SafetyWriteTx {
  return tx as unknown as SafetyWriteTx;
}

function sameIdentity(a: ApprovedPolicyIdentity, b: ApprovedPolicyIdentity): boolean {
  return (
    a.policyRef === b.policyRef &&
    a.policyVersion === b.policyVersion &&
    a.ruleRef === b.ruleRef &&
    a.ruleVersion === b.ruleVersion
  );
}

function buildRequestHash(input: {
  familyId: string;
  caseId: string;
  expectedCaseVersion: number;
  decision: SafetyPrecheckDecision;
}): string {
  const decision = input.decision;
  const evidenceRefs =
    decision.kind === 'ENTER_HOLD'
      ? [...decision.evidenceRefs]
          .map((reference) => ({ kind: reference.kind, ref: reference.ref }))
          .sort((a, b) => `${a.kind}:${a.ref}`.localeCompare(`${b.kind}:${b.ref}`))
      : [];
  return hashPayload({
    familyId: input.familyId,
    caseId: input.caseId,
    expectedCaseVersion: input.expectedCaseVersion,
    decisionKind: decision.kind,
    identity:
      decision.kind === 'ENTER_HOLD'
        ? {
            policyRef: decision.identity.policyRef,
            policyVersion: decision.identity.policyVersion,
            ruleRef: decision.identity.ruleRef,
            ruleVersion: decision.identity.ruleVersion,
          }
        : null,
    riskCategoryRef: decision.kind === 'ENTER_HOLD' ? decision.riskCategoryRef : null,
    evidenceRefs,
  });
}

export async function enterSafetyHold(
  pool: pg.Pool,
  input: EnterSafetyHoldInput
): Promise<{ status: number; body: unknown }> {
  const caseId = input.caseId.toLowerCase();
  if (!UUID_PATTERN.test(caseId)) {
    throw httpError('CASE_NOT_FOUND', 'Case not found');
  }
  if (
    !Number.isInteger(input.expectedCaseVersion) ||
    input.expectedCaseVersion < 1
  ) {
    throw httpError('SAFETY_PRECHECK_INVALID', 'Invalid expected Case version');
  }
  if (input.decision.kind !== 'ENTER_HOLD') {
    throw httpError('SAFETY_PRECHECK_INVALID', 'Decision cannot enter safety hold');
  }
  if (!sameIdentity(input.decision.identity, input.trustedPolicyIdentity)) {
    // The decision was produced by a superseded policy/rule identity.
    throw httpError('SAFETY_PRECHECK_STALE');
  }

  // Step 2 — resolve the Family (read-only identity transaction).
  const familyId = await withIdentityTransaction(
    pool,
    { accountId: input.accountId, purpose: 'FAMILY_MANAGEMENT' },
    (tx) => requireCurrentFamily(tx, input.personId)
  );

  const requestHash = buildRequestHash({
    familyId,
    caseId,
    expectedCaseVersion: input.expectedCaseVersion,
    decision: input.decision,
  });
  const keyBytes = caseIdempotencyKeyBytes(input.idempotencyKey);

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
        // Step 3 — same-transaction authorization (never a route shortcut).
        await requireFamilyAction(client, {
          accountId: input.accountId,
          personId: input.personId,
          familyId,
          action: 'CASE_ENTER_SAFETY_HOLD',
          purpose: 'FAMILY_MANAGEMENT',
          resource: { type: 'CASE', familyId, caseId },
          caseId,
        });

        // Step 4 — idempotency slot / replay / mismatch BEFORE any lock.
        const slot = await acquireIdempotencySlot(client, {
          actorAccountId: input.accountId,
          commandType: ENTER_SAFETY_HOLD_COMMAND,
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

        // Steps 5–6 — Family lock then Case lock (existing aggregate order).
        const familyVisible = await lockFamilyForPrimaryDecision(client, familyId);
        if (!familyVisible) throw httpError('CASE_NOT_FOUND', 'Case not found');

        const locked = await getCaseForUpdate(client, caseId);
        if (!locked) throw httpError('CASE_NOT_FOUND', 'Case not found');

        // Step 7 — the decision must still match the LOCKED revision. This
        // rejects a precheck made for version N once the Case is N+1, and
        // refuses CLOSED / already-held without any write.
        const fresh = assertDecisionFreshForCase(input.decision, {
          caseId: locked.id,
          status: locked.status,
          version: locked.version,
        });

        // Step 8 — approved policy/rule identity must still be current.
        if (!sameIdentity(fresh.identity, input.trustedPolicyIdentity)) {
          throw httpError('SAFETY_PRECHECK_STALE');
        }

        // Step 9 — one optimistic status/version transition (phase preserved).
        const transitioned = await transitionCaseStatus(asSafetyWriteTx(tx), {
          caseId,
          expectedVersion: locked.version,
          toStatus: 'SAFETY_HOLD',
        });
        if (!transitioned) throw httpError('STALE_CASE_VERSION');

        // Steps 10–12 — Risk Event, Case Event, Business Audit.
        const riskEventId = await insertHoldEnteredRiskEvent(asSafetyWriteTx(tx), {
          familyId,
          caseId,
          actorAccountId: input.accountId,
          decisionCaseVersion: locked.version,
          identity: fresh.identity,
          riskCategoryRef: fresh.riskCategoryRef,
          evidenceRefs: fresh.evidenceRefs,
        });

        await insertSafetyCaseEvent(asSafetyWriteTx(tx), {
          familyId,
          caseId,
          actorAccountId: input.accountId,
          eventType: 'CASE_SAFETY_HOLD_ENTERED',
          fromStatus: locked.status,
          toStatus: 'SAFETY_HOLD',
          fromVersion: locked.version,
          toVersion: transitioned.version,
          riskEventId,
        });

        await insertSafetyAuditEvent(asSafetyWriteTx(tx), {
          familyId,
          caseId,
          actorAccountId: input.accountId,
          eventType: 'CASE_SAFETY_HOLD_ENTERED',
          riskEventId,
          fromVersion: locked.version,
          toVersion: transitioned.version,
        });

        const body: EnterSafetyHoldResponse = {
          caseId,
          status: 'SAFETY_HOLD',
          phase: transitioned.phase,
          fromStatus: locked.status,
          fromVersion: locked.version,
          version: transitioned.version,
          riskEventId,
        };

        // Step 13 — idempotency completion stays in the same transaction.
        await completeIdempotency(client, {
          actorAccountId: input.accountId,
          commandType: ENTER_SAFETY_HOLD_COMMAND,
          keyBytes,
          status: 200,
          body,
        });

        return { status: 200, body };
      }
    );
  } catch (error) {
    if (isSafetyError(error)) {
      throw httpError(error.code);
    }
    throw error;
  }
}