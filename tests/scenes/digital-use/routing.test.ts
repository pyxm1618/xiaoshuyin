import { describe, expect, it } from 'vitest';
import { routeDigitalUseTopology } from '../../../packages/scenes/digital-use/routing.js';

function route(
  currentNodeCode: string,
  conditions: Record<string, boolean | 'UNKNOWN' | 'NOT_COLLECTED' | 'DECLINED' | 'CONFLICT'>,
  evidenceBasis?: readonly ('PURPOSE' | 'FUNCTIONAL_IMPACT' | 'SLEEP' | 'REAL_WORLD_ACTIVITY_DISPLACEMENT' | 'EMOTION' | 'FAMILY_RELATIONSHIP_OR_CONFLICT' | 'OTHER_APPROVED_EVIDENCE' | 'TOTAL_DURATION' | 'HISTORICAL_DURATION_BAND')[]
) {
  return routeDigitalUseTopology({
    sceneCode: 'DIGITAL_USE',
    packageVersion: 'v1',
    currentNodeCode,
    conditions,
    ...(evidenceBasis === undefined ? {} : { evidenceBasis }),
  });
}

describe('Slice 11 pure deterministic routing', () => {
  it('routes only through explicit manifest conditions', () => {
    expect(route('A1001', { A1001_ASSESSMENT_COMPLETE: true })).toMatchObject({
      kind: 'NODE_ROUTE', authority: 'TOPOLOGY_ONLY', fromNodeCode: 'A1001', nextNodeCode: '01002',
    });
    expect(route('A2004', { COLLABORATIVE_DURATION_YES: true })).toMatchObject({ kind: 'NODE_ROUTE', nextNodeCode: 'A2005' });
    expect(route('A2004', { COLLABORATIVE_DURATION_NO: true })).toMatchObject({ kind: 'NODE_ROUTE', nextNodeCode: 'A2006' });
  });

  it('preserves 01002F and 01003F priority even if a lower-priority condition is also asserted', () => {
    expect(route('01002', { EMOTION_SEVERE_F: true, EMOTION_ASSESSMENT_NON_SEVERE: true })).toMatchObject({
      kind: 'NODE_ROUTE', nextNodeCode: '01005', reasonCode: 'EMOTION_SEVERE_F',
    });
    expect(route('01003', { FAMILY_CONFLICT_SEVERE_F: true, TRIAGE_CONTINUE_DIGITAL_USE_INTEGRATED: true }, ['PURPOSE'])).toMatchObject({
      kind: 'NODE_ROUTE', nextNodeCode: '01006', reasonCode: 'FAMILY_CONFLICT_SEVERE_F',
    });
  });

  it('fails closed when a higher-priority condition is unresolved, without blocking resolved false', () => {
    for (const state of ['UNKNOWN', 'NOT_COLLECTED', 'CONFLICT'] as const) {
      expect(route('01002', { EMOTION_SEVERE_F: state, EMOTION_ASSESSMENT_NON_SEVERE: true })).toMatchObject({
        kind: 'UNKNOWN', code: 'UNKNOWN_OR_UNSUPPORTED_CONDITION',
      });
    }

    expect(route('01003', {
      FAMILY_CONFLICT_SEVERE_F: 'UNKNOWN',
      TRIAGE_NO_INTERVENTION_INTEGRATED: true,
    }, ['PURPOSE'])).toMatchObject({
      kind: 'UNKNOWN', code: 'UNKNOWN_OR_UNSUPPORTED_CONDITION',
    });
    expect(route('01003', {
      FAMILY_CONFLICT_SEVERE_F: 'DECLINED',
      TRIAGE_CONTINUE_DIGITAL_USE_INTEGRATED: true,
    }, ['FUNCTIONAL_IMPACT'])).toMatchObject({
      kind: 'UNKNOWN', code: 'UNKNOWN_OR_UNSUPPORTED_CONDITION',
    });

    expect(route('01002', {
      EMOTION_SEVERE_F: false,
      EMOTION_ASSESSMENT_NON_SEVERE: true,
    })).toMatchObject({
      kind: 'NODE_ROUTE', nextNodeCode: '01003', reasonCode: 'EMOTION_ASSESSMENT_NON_SEVERE',
    });
  });

  it('requires integrated Evidence basis and refuses duration-only triage', () => {
    expect(route('01003', { TRIAGE_CONTINUE_DIGITAL_USE_INTEGRATED: true }, ['TOTAL_DURATION'])).toMatchObject({
      kind: 'BLOCKED', code: 'INSUFFICIENT_INTEGRATED_EVIDENCE',
    });
    expect(route('01003', { TRIAGE_NO_INTERVENTION_INTEGRATED: true }, ['HISTORICAL_DURATION_BAND'])).toMatchObject({
      kind: 'BLOCKED', code: 'INSUFFICIENT_INTEGRATED_EVIDENCE',
    });
    expect(route('01003', { TRIAGE_CONTINUE_DIGITAL_USE_INTEGRATED: true }, ['FUNCTIONAL_IMPACT'])).toMatchObject({
      kind: 'NODE_ROUTE', nextNodeCode: 'A2003',
    });
  });

  it('fails closed on no match, unresolved state, multiple match and unknown node', () => {
    expect(route('A2004', {})).toMatchObject({ kind: 'BLOCKED', code: 'NO_APPROVED_ROUTE' });
    expect(route('A2004', { COLLABORATIVE_DURATION_YES: 'UNKNOWN' })).toMatchObject({ kind: 'UNKNOWN', code: 'UNKNOWN_OR_UNSUPPORTED_CONDITION' });
    expect(route('A2004', { COLLABORATIVE_DURATION_YES: true, COLLABORATIVE_DURATION_NO: true })).toMatchObject({ kind: 'BLOCKED', code: 'AMBIGUOUS_ROUTE' });
    expect(route('A9999', {})).toMatchObject({ kind: 'UNKNOWN', code: 'UNKNOWN_NODE' });
  });

  it('returns explicit terminal destinations rather than fabricating nodes', () => {
    expect(route('01004', { CONSENT_DECLINED: true })).toMatchObject({
      kind: 'TERMINAL_ROUTE', terminalCode: 'MAIN', reasonCode: 'CONSENT_DECLINED',
    });
  });

  it('is deterministic, side-effect free, and ignores an illegal model-proposed extra property', () => {
    const input = {
      sceneCode: 'DIGITAL_USE' as const,
      packageVersion: 'v1' as const,
      currentNodeCode: 'A2004',
      conditions: { COLLABORATIVE_DURATION_YES: true },
      modelProposedNextNodeCode: 'A9999',
    };
    const first = routeDigitalUseTopology(input);
    const second = routeDigitalUseTopology(input);
    expect(second).toEqual(first);
    expect(first).toMatchObject({ kind: 'NODE_ROUTE', nextNodeCode: 'A2005' });
  });

  it('does not treat topology ALLOW as business authorization', () => {
    const result = route('A1001', { A1001_ASSESSMENT_COMPLETE: true });
    expect(result.authority).toBe('TOPOLOGY_ONLY');
    expect(result).not.toHaveProperty('authorized', true);
    expect(result).not.toHaveProperty('safetyAllowed', true);
    expect(result).not.toHaveProperty('complianceAllowed', true);
  });
});
