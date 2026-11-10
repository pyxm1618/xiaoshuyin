/**
 * S7-M01 — deterministic Case lock ordering, repository / route source proof.
 *
 * Plan D-3.3 freezes a single lock statement for the current + target rows:
 *   SELECT ... WHERE id = ANY($ids) ORDER BY id FOR UPDATE
 *
 * The behavioural proof is in `tests/db/case-primary-switch-concurrency.test.ts`
 * (a real `pg_locks` observation). This test pins the implementation shape so a
 * future edit cannot silently reintroduce the removed unordered double lock
 * (current first, target second) that created a lock-cycle risk.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const repositorySource = readFileSync(
  fileURLToPath(new URL('../../packages/domain/src/cases.ts', import.meta.url)),
  'utf8'
);

const routeSource = readFileSync(
  fileURLToPath(new URL('../../apps/server/api/src/routes/cases.ts', import.meta.url)),
  'utf8'
);

function sliceBetween(source: string, from: string, to: string): string {
  const start = source.indexOf(from);
  expect(start).toBeGreaterThanOrEqual(0);
  const end = source.indexOf(to, start + from.length);
  expect(end).toBeGreaterThan(start);
  return source.slice(start, end);
}

describe('S7-M01 deterministic Case lock ordering', () => {
  it('locks all Case rows with ONE `id = ANY(...) ORDER BY id FOR UPDATE` statement', () => {
    const lockFn = sliceBetween(
      repositorySource,
      'export async function lockCasesForSwitchPrimary',
      'export async function getCaseForUpdate'
    );

    // Collect → de-duplicate → sort ascending → one statement.
    expect(lockFn).toContain('new Set(');
    expect(lockFn).toContain('.sort()');
    expect(lockFn).toContain('id = ANY($1::uuid[])');
    expect(lockFn).toContain('ORDER BY id');
    expect(lockFn).toContain('FOR UPDATE');

    // ORDER BY must precede FOR UPDATE in the statement.
    expect(lockFn.indexOf('ORDER BY id')).toBeLessThan(lockFn.indexOf('FOR UPDATE'));

    // Exactly one locking statement in this function.
    expect(lockFn.match(/FOR UPDATE/g)).toHaveLength(1);
    // The target must be re-mapped from the locked rows, not locked separately.
    expect(lockFn).not.toContain('WHERE id = $1');
  });

  it('the switch route uses the single ordered lock, not two per-row locks', () => {
    const handler = routeSource.slice(
      routeSource.indexOf("'/api/v1/cases/:id/switch-primary'")
    );
    expect(handler).toContain('lockCasesForSwitchPrimary');
    expect(handler).not.toContain('getCurrentPrimaryForUpdate');
    expect(handler).not.toContain('getCaseForUpdate');
    // Family lock stays before the Case lock (plan D-3.3 order ②→③).
    expect(handler.indexOf('lockFamilyForPrimaryDecision')).toBeLessThan(
      handler.indexOf('lockCasesForSwitchPrimary')
    );
  });

  it('switch-primary audit writes all six frozen metadata fields', () => {
    const auditFn = sliceBetween(
      repositorySource,
      'export async function insertPrimarySwitchAudit',
      'export type IdempotencySlot'
    );
    for (const field of [
      'targetCaseId',
      'previousPrimaryCaseId',
      'newPrimaryCaseId',
      'previousVersion',
      'newVersion',
      'reason',
    ]) {
      expect(auditFn).toContain(field);
    }
  });
});