/**
 * Slice 9 — Case status/version transition through the Drizzle query builder.
 *
 * This is the ONLY reviewed primitive that mutates `cases.status`. It is used
 * exclusively by `EnterSafetyHold` and `ResolveRisk`; every other Case command
 * keeps its own contract.
 *
 * `phase` is never written: a Safety transition must preserve it.
 */

import { and, eq, sql } from 'drizzle-orm';
import { cases } from './schema.js';
import type { SafetyWriteTx } from './persistence.js';
import type { SafetyCaseStatus } from './precheck.js';

export interface CaseTransitionRow {
  id: string;
  familyId: string;
  status: SafetyCaseStatus;
  phase: string;
  version: number;
  isPrimary: boolean;
}

/**
 * Optimistic transition: the row only changes when the locked revision still
 * equals `expectedVersion`. A mismatch writes nothing and returns null, so the
 * caller can never apply a stale decision.
 */
export async function transitionCaseStatus(
  tx: SafetyWriteTx,
  input: {
    caseId: string;
    expectedVersion: number;
    toStatus: SafetyCaseStatus;
  }
): Promise<CaseTransitionRow | null> {
  const [row] = await tx
    .update(cases)
    .set({
      status: input.toStatus,
      version: sql`${cases.version} + 1`,
      updatedAt: sql`now()`,
    })
    .where(and(eq(cases.id, input.caseId), eq(cases.version, input.expectedVersion)))
    .returning({
      id: cases.id,
      familyId: cases.familyId,
      status: cases.status,
      phase: cases.phase,
      version: cases.version,
      isPrimary: cases.isPrimary,
    });
  if (!row) return null;
  return {
    id: row.id,
    familyId: row.familyId,
    status: row.status as SafetyCaseStatus,
    phase: row.phase,
    version: row.version,
    isPrimary: row.isPrimary,
  };
}