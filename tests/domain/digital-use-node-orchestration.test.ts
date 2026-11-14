import { describe, expect, it } from 'vitest';
import {
  assertNodeCasePreconditions,
  requireResolvedRoute,
} from '../../apps/server/api/src/services/digital-use-node-response.js';

describe('T1209 canonical node orchestration guards', () => {
  const node = { phase: 'ASSESSMENT' as const };
  const row = {
    status: 'OPEN' as const,
    phase: 'ASSESSMENT' as const,
    is_primary: true,
    version: 7,
  };

  it('accepts only the current primary/open/version/phase tuple', () => {
    expect(() => assertNodeCasePreconditions(row, node, 7)).not.toThrow();
    expect(() =>
      assertNodeCasePreconditions({ ...row, is_primary: false }, node, 7)
    ).toThrow('CASE_NOT_PRIMARY');
    expect(() =>
      assertNodeCasePreconditions({ ...row, version: 8 }, node, 7)
    ).toThrow('STALE_CASE_VERSION');
    expect(() =>
      assertNodeCasePreconditions({ ...row, phase: 'PROBLEM_FORMULATION' }, node, 7)
    ).toThrow('CASE_PHASE_CONFLICT');
    expect(() =>
      assertNodeCasePreconditions({ ...row, status: 'WAITING' }, node, 7)
    ).toThrow('CASE_NOT_OPEN');
  });

  it('accepts only resolved Slice 11 router outcomes', () => {
    expect(
      requireResolvedRoute({
        kind: 'NODE_ROUTE',
        authority: 'TOPOLOGY_ONLY',
        fromNodeCode: 'A1001',
        nextNodeCode: '01002',
        reasonCode: 'A1001_ASSESSMENT_COMPLETE',
        packageVersion: 'v1',
      })
    ).toEqual({
      kind: 'NODE',
      nextNodeCode: '01002',
      reasonCode: 'A1001_ASSESSMENT_COMPLETE',
    });

    expect(() =>
      requireResolvedRoute({
        kind: 'UNKNOWN',
        authority: 'TOPOLOGY_ONLY',
        fromNodeCode: 'A1001',
        code: 'UNKNOWN_OR_UNSUPPORTED_CONDITION',
        packageVersion: 'v1',
      })
    ).toThrow('UNKNOWN_OR_UNSUPPORTED_CONDITION');

    expect(() =>
      requireResolvedRoute({
        kind: 'BLOCKED',
        authority: 'TOPOLOGY_ONLY',
        fromNodeCode: 'A1001',
        code: 'NO_APPROVED_ROUTE',
        packageVersion: 'v1',
      })
    ).toThrow('NO_APPROVED_ROUTE');
  });
});
