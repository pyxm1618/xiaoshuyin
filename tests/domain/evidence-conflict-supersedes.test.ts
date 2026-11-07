/**
 * T021 — conflict group / supersedes domain invariants.
 *
 * RED before the Evidence conflict/supersedes validators exist.
 */

import { describe, it, expect } from 'vitest';
import * as evidence from '../../packages/domain/src/evidence.js';

const FAMILY = 'family-1';
const CASE = 'case-1';

function ref(overrides: Record<string, unknown> = {}) {
  return {
    kind: 'ASSERTION',
    id: 'assertion-1',
    familyId: FAMILY,
    caseId: CASE,
    conflictGroupId: null,
    ...overrides,
  } as any;
}

describe('assignConflictGroup invariants (T021)', () => {
  it('accepts >= 2 refs in the same Family/Case, mixed Assertion and Observation', () => {
    const result = evidence.validateConflictAssignment(
      [
        ref({ kind: 'ASSERTION', id: 'a1' }),
        ref({ kind: 'OBSERVATION', id: 'o1' }),
      ],
      FAMILY,
      CASE
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.existingGroupId).toBeNull();
  });

  it('rejects fewer than two refs', () => {
    const result = evidence.validateConflictAssignment([ref()], FAMILY, CASE);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('EVIDENCE_CONFLICT_INVALID');
  });

  it('rejects cross-Family / cross-Case refs', () => {
    expect(
      evidence.validateConflictAssignment(
        [ref({ id: 'a1' }), ref({ id: 'a2', familyId: 'family-2' })],
        FAMILY,
        CASE
      ).ok
    ).toBe(false);
    expect(
      evidence.validateConflictAssignment(
        [ref({ id: 'a1' }), ref({ id: 'a2', caseId: 'case-2' })],
        FAMILY,
        CASE
      ).ok
    ).toBe(false);
  });

  it('rejects duplicate refs and unknown kinds', () => {
    expect(
      evidence.validateConflictAssignment([ref({ id: 'a1' }), ref({ id: 'a1' })], FAMILY, CASE).ok
    ).toBe(false);
    expect(
      evidence.validateConflictAssignment(
        [ref({ id: 'a1' }), ref({ id: 'a2', kind: 'EVIDENCE' })],
        FAMILY,
        CASE
      ).ok
    ).toBe(false);
  });

  it('treats an already shared group as an idempotent same-value write', () => {
    const result = evidence.validateConflictAssignment(
      [
        ref({ id: 'a1', conflictGroupId: 'group-1' }),
        ref({ id: 'o1', kind: 'OBSERVATION', conflictGroupId: 'group-1' }),
      ],
      FAMILY,
      CASE
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.existingGroupId).toBe('group-1');
  });

  it('refuses to migrate an existing group', () => {
    const result = evidence.validateConflictAssignment(
      [
        ref({ id: 'a1', conflictGroupId: 'group-1' }),
        ref({ id: 'o1', kind: 'OBSERVATION', conflictGroupId: 'group-2' }),
      ],
      FAMILY,
      CASE
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('EVIDENCE_CONFLICT_GROUP_IMMUTABLE');
  });

  it('has no winner / rank / confidence / majority / graph-cycle machinery', () => {
    for (const forbidden of [
      'winner',
      'rank',
      'confidence',
      'majority',
      'detectCycle',
      'resolveConflict',
      'computeWinner',
    ]) {
      expect((evidence as any)[forbidden], forbidden).toBeUndefined();
    }
    const result: any = evidence.validateConflictAssignment(
      [ref({ id: 'a1' }), ref({ id: 'o1', kind: 'OBSERVATION' })],
      FAMILY,
      CASE
    );
    expect(result.winner).toBeUndefined();
    expect(result.rank).toBeUndefined();
  });
});

describe('supersedes invariants (T021)', () => {
  it('accepts new -> existing old of the same type/Family/Case', () => {
    for (const kind of ['ASSERTION', 'OBSERVATION'] as const) {
      const result = evidence.validateSupersedes({
        kind,
        newId: 'new-1',
        supersedesId: 'old-1',
        target: { id: 'old-1', kind, familyId: FAMILY, caseId: CASE },
        familyId: FAMILY,
        caseId: CASE,
      });
      expect(result.ok, kind).toBe(true);
    }
  });

  it('accepts no supersedes reference', () => {
    expect(
      evidence.validateSupersedes({
        kind: 'ASSERTION',
        newId: 'new-1',
        supersedesId: null,
        target: null,
        familyId: FAMILY,
        caseId: CASE,
      }).ok
    ).toBe(true);
  });

  it('rejects self-reference, missing target, wrong kind and cross-scope', () => {
    const base = {
      kind: 'ASSERTION' as const,
      newId: 'new-1',
      supersedesId: 'old-1',
      target: { id: 'old-1', kind: 'ASSERTION' as const, familyId: FAMILY, caseId: CASE },
      familyId: FAMILY,
      caseId: CASE,
    };
    expect(evidence.validateSupersedes({ ...base, newId: 'old-1' }).ok).toBe(false);
    expect(evidence.validateSupersedes({ ...base, target: null }).ok).toBe(false);
    expect(
      evidence.validateSupersedes({
        ...base,
        target: { ...base.target, kind: 'OBSERVATION' },
      }).ok
    ).toBe(false);
    expect(
      evidence.validateSupersedes({
        ...base,
        target: { ...base.target, familyId: 'family-2' },
      }).ok
    ).toBe(false);
    expect(
      evidence.validateSupersedes({
        ...base,
        target: { ...base.target, caseId: 'case-2' },
      }).ok
    ).toBe(false);
  });
});