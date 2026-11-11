/**
 * Slice 9 — reusable ordinary-progression Safety guard (plan §7, tasks T908).
 *
 * One policy, two thin accessors:
 *   - `assertOrdinaryProgressionAllowed(tx, …)`        — Drizzle-owned writes
 *   - `assertOrdinaryProgressionAllowedRaw(client, …)` — the existing raw
 *     transaction framework (SwitchPrimaryCase / future Slice 8 commands)
 *
 * Both call the SAME `decideOrdinaryProgression` policy, so there is exactly
 * one Safety decision rule.
 *
 * The guard:
 *   - re-reads the real Case state INSIDE the caller-owned transaction;
 *   - never trusts a caller-supplied status snapshot;
 *   - fails closed with a stable, non-leaking `SAFETY_HOLD_BLOCKED`;
 *   - performs no mutation and advances no version;
 *   - is NOT globally installed: Evidence capture, Consent, Authorization and
 *     Data Rights paths are not blocked merely because a Case is held.
 */

import { eq } from 'drizzle-orm';
import { cases } from './schema.js';
import { SafetyError } from './errors.js';
import type { SafetyCaseStatus } from './precheck.js';
import type { SafetyWriteTx } from './persistence.js';

/** Minimal structural type of the existing raw `pg.PoolClient` seam. */
export interface RawTxClient {
  query<T = Record<string, unknown>>(
    text: string,
    values?: unknown[]
  ): Promise<{ rows: T[] }>;
}

export type OrdinaryProgressionDecision =
  | { allowed: true }
  | { allowed: false; code: 'SAFETY_HOLD_BLOCKED' };

/** The single Safety decision rule for ordinary progression. */
export function decideOrdinaryProgression(
  status: SafetyCaseStatus | null
): OrdinaryProgressionDecision {
  // A row that is not visible must be indistinguishable from a held Case:
  // callers perform their own visibility contract first, and the Safety guard
  // never reveals another Family's existence.
  if (status === null) return { allowed: false, code: 'SAFETY_HOLD_BLOCKED' };
  if (status === 'SAFETY_HOLD') return { allowed: false, code: 'SAFETY_HOLD_BLOCKED' };
  return { allowed: true };
}

export function isSafetyHoldStatus(status: SafetyCaseStatus | null): boolean {
  return status === 'SAFETY_HOLD';
}

function enforce(decision: OrdinaryProgressionDecision): void {
  if (!decision.allowed) throw new SafetyError(decision.code);
}

/**
 * Drizzle-owned accessor. Reads the Case again inside the caller's transaction
 * and applies the shared policy.
 */
export async function assertOrdinaryProgressionAllowed(
  tx: SafetyWriteTx,
  input: { caseId: string }
): Promise<void> {
  const rows = await tx
    .select({ status: cases.status })
    .from(cases)
    .where(eq(cases.id, input.caseId));
  const row = rows[0];
  enforce(decideOrdinaryProgression(row ? (row.status as SafetyCaseStatus) : null));
}

/**
 * Raw-transaction accessor used by commands that still run on the existing
 * `pg.PoolClient` seam (SwitchPrimaryCase and future Slice 8 commands).
 *
 * Explicit SQL is justified: it is a single RLS-scoped primary-key read inside
 * an already-open transaction, and RLS is the visibility boundary.
 */
export async function assertOrdinaryProgressionAllowedRaw(
  client: RawTxClient,
  input: { caseId: string }
): Promise<void> {
  const { rows } = await client.query<{ status: SafetyCaseStatus }>(
    'SELECT status FROM cases WHERE id = $1',
    [input.caseId]
  );
  const row = rows[0];
  enforce(decideOrdinaryProgression(row ? row.status : null));
}