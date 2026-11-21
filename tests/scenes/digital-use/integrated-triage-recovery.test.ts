import { describe, expect, it } from 'vitest';
import {
  evaluateIntegratedTriage,
  type EmotionOption,
  type IntegratedTriageEvidence,
  type TriageEvidenceState,
} from '@xiaoshuyin/scenes/digital-use';

const v = <T>(value: T): TriageEvidenceState<T> => ({ kind: 'VALUE', value });
const missing = (
  reason: 'NO_RECORD' | 'UNKNOWN' | 'NOT_COLLECTED' | 'DECLINED' | 'NOT_APPLICABLE' = 'NO_RECORD'
) => ({ kind: 'MISSING', reason } as const);

function fixture(overrides: Partial<IntegratedTriageEvidence> = {}): IntegratedTriageEvidence {
  return {
    emotion01002: v(['A'] as readonly EmotionOption[]),
    family01003: v('A'),
    directImpact: {
      sleep: v(false),
      studyOrNecessaryAffairs: v(false),
      realWorldActivityDisplacement: v(false),
    },
    ...overrides,
  };
}

describe('R1 Integrated Triage structured recovery', () => {
  it('reports 01002 as the canonical correction target while emotion is unresolved', () => {
    const result = evaluateIntegratedTriage(fixture({ emotion01002: missing('UNKNOWN') }));
    expect(result.outcome).toBe('INSUFFICIENT');
    expect(result.correctionTargetNodeCode).toBe('01002');
    expect(result.missingRequirements).toEqual([
      {
        nodeCode: '01002',
        evidenceCode: '01002.emotion',
        evidenceFamily: 'EMOTION',
        missingState: 'UNKNOWN',
        reasonCode: '01002_MISSING_FAMILY',
      },
    ]);
  });

  it('reports 01003 only after 01002 has a usable value', () => {
    const result = evaluateIntegratedTriage(fixture({ family01003: missing('NOT_COLLECTED') }));
    expect(result.outcome).toBe('INSUFFICIENT');
    expect(result.correctionTargetNodeCode).toBe('01003');
    expect(result.missingRequirements).toEqual([
      {
        nodeCode: '01003',
        evidenceCode: '01003.family_relationship',
        evidenceFamily: 'FAMILY_RELATIONSHIP',
        missingState: 'NOT_COLLECTED',
        reasonCode: '01003_MISSING_FAMILY',
      },
    ]);
  });

  it('reports A1001 direct-impact evidence with canonical evidence codes', () => {
    const result = evaluateIntegratedTriage(
      fixture({
        directImpact: {
          sleep: missing('UNKNOWN'),
          studyOrNecessaryAffairs: missing('DECLINED'),
          realWorldActivityDisplacement: v(false),
        },
      })
    );
    expect(result.outcome).toBe('INSUFFICIENT');
    expect(result.correctionTargetNodeCode).toBe('A1001');
    expect(result.missingRequirements).toEqual([
      {
        nodeCode: 'A1001',
        evidenceCode: 'a1001.impact.sleep',
        evidenceFamily: 'SLEEP',
        missingState: 'UNKNOWN',
        reasonCode: 'DIRECT_IMPACT_MISSING_FAMILY',
      },
      {
        nodeCode: 'A1001',
        evidenceCode: 'a1001.impact.study_or_necessary_affairs',
        evidenceFamily: 'STUDY_OR_NECESSARY_AFFAIRS',
        missingState: 'DECLINED',
        reasonCode: 'DIRECT_IMPACT_MISSING_FAMILY',
      },
    ]);
  });

  it('never reports recovery for a normal outcome', () => {
    const result = evaluateIntegratedTriage(fixture());
    expect(result.outcome).toBe('A2001');
    expect(result.correctionTargetNodeCode).toBeNull();
    expect(result.missingRequirements).toEqual([]);
  });
});