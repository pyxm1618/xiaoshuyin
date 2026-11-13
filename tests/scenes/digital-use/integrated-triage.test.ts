import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  evaluateIntegratedTriage,
  type IntegratedTriageEvidence,
  type TriageEvidenceState,
} from '@xiaoshuyin/scenes/digital-use';

const v = <T>(value: T): TriageEvidenceState<T> => ({ kind: 'VALUE', value });
const missing = (reason: 'NO_RECORD' | 'UNKNOWN' | 'NOT_COLLECTED' | 'DECLINED' = 'NO_RECORD') =>
  ({ kind: 'MISSING', reason } as const);
const conflict = (reason: 'CONFLICTING' | 'CONTRADICTORY' | 'INCOMPATIBLE' | 'INVALID' = 'CONFLICTING') =>
  ({ kind: 'CONFLICT', reason } as const);

function fixture(overrides: Partial<IntegratedTriageEvidence> = {}): IntegratedTriageEvidence {
  return {
    emotion01002: v(['A']),
    family01003: v('A'),
    directImpact: {
      sleep: v(false),
      studyOrNecessaryAffairs: v(false),
      realWorldActivityDisplacement: v(false),
    },
    ...overrides,
  };
}

describe('T1211 Integrated Triage authority matrix', () => {
  it.each([
    ['01002 missing', fixture({ emotion01002: missing() }), 'INSUFFICIENT'],
    ['01002 NOT_COLLECTED', fixture({ emotion01002: missing('NOT_COLLECTED') }), 'INSUFFICIENT'],
    ['01002 DECLINED', fixture({ emotion01002: missing('DECLINED') }), 'INSUFFICIENT'],
    ['01002 UNKNOWN', fixture({ emotion01002: missing('UNKNOWN') }), 'INSUFFICIENT'],
    ['01002 conflict', fixture({ emotion01002: conflict('CONTRADICTORY') }), 'BLOCKED'],
    ['01002 F', fixture({ emotion01002: v(['F']) }), '01005'],
    ['01003 missing', fixture({ family01003: missing() }), 'INSUFFICIENT'],
    ['01003 NOT_COLLECTED', fixture({ family01003: missing('NOT_COLLECTED') }), 'INSUFFICIENT'],
    ['01003 DECLINED', fixture({ family01003: missing('DECLINED') }), 'INSUFFICIENT'],
    ['01003 UNKNOWN', fixture({ family01003: missing('UNKNOWN') }), 'INSUFFICIENT'],
    ['01003 conflict', fixture({ family01003: conflict('INCOMPATIBLE') }), 'BLOCKED'],
    ['01003 F', fixture({ family01003: v('F') }), '01006'],
    ['both F', fixture({ emotion01002: v(['F']), family01003: v('F') }), '01005'],
    ['direct impact missing', fixture({
      directImpact: {
        sleep: missing(),
        studyOrNecessaryAffairs: v(false),
        realWorldActivityDisplacement: v(false),
      },
    }), 'INSUFFICIENT'],
    ['direct impact conflict', fixture({
      directImpact: {
        sleep: conflict(),
        studyOrNecessaryAffairs: v(false),
        realWorldActivityDisplacement: v(false),
      },
    }), 'BLOCKED'],
    ['duration only', fixture({
      directImpact: {
        sleep: missing(),
        studyOrNecessaryAffairs: missing(),
        realWorldActivityDisplacement: missing(),
      },
      durationOnlyEvidencePresent: true,
    }), 'INSUFFICIENT'],
    ['clean low-impact', fixture(), 'A2001'],
    ['material unknown other needs', fixture({ otherNeeds: missing('UNKNOWN') }), 'A2002'],
    ['material conflict other needs', fixture({ otherNeeds: conflict() }), 'A2002'],
    ['other-needs positive', fixture({ emotion01002: v(['B']) }), 'A2002'],
    ['mixed positive + other needs', fixture({
      emotion01002: v(['C']),
      directImpact: {
        sleep: v(true),
        studyOrNecessaryAffairs: v(false),
        realWorldActivityDisplacement: v(false),
      },
    }), 'A2003'],
    ['no normal predicate proven', fixture({
      directImpact: {
        sleep: v(false),
        studyOrNecessaryAffairs: v(false),
        realWorldActivityDisplacement: v(false),
        otherApproved: [missing('UNKNOWN')],
      },
    }), 'INSUFFICIENT'],
  ] as const)('%s -> %s', (_name, evidence, expected) => {
    expect(evaluateIntegratedTriage(evidence).outcome).toBe(expected);
  });

  it('requires positive direct-impact proof for A2003 and never duration-only', () => {
    const positive = evaluateIntegratedTriage(fixture({
      directImpact: {
        sleep: v(false),
        studyOrNecessaryAffairs: v(true),
        realWorldActivityDisplacement: v(false),
      },
      durationOnlyEvidencePresent: false,
    }));
    expect(positive.outcome).toBe('A2003');
    expect(positive.predicates.DIRECT_DIGITAL_USE_IMPACT_POSITIVE).toBe(true);

    const durationOnly = evaluateIntegratedTriage(fixture({
      directImpact: {
        sleep: missing(),
        studyOrNecessaryAffairs: missing(),
        realWorldActivityDisplacement: missing(),
      },
      durationOnlyEvidencePresent: true,
    }));
    expect(durationOnly.outcome).toBe('INSUFFICIENT');
  });

  it('requires positive proof for A2001 and A2002', () => {
    const clean = evaluateIntegratedTriage(fixture());
    expect(clean.outcome).toBe('A2001');
    expect(clean.predicates.CLEAN_NON_DIGITAL_USE_STATE).toBe(true);

    const other = evaluateIntegratedTriage(fixture({ family01003: v('D') }));
    expect(other.outcome).toBe('A2002');
    expect(other.predicates.DIRECT_DIGITAL_USE_IMPACT_NEGATIVE).toBe(true);
    expect(other.predicates.OTHER_NEEDS_POSITIVE).toBe(true);
  });

  it('emits at most one normal routing condition', () => {
    for (const evidence of [
      fixture(),
      fixture({ emotion01002: v(['B']) }),
      fixture({
        directImpact: {
          sleep: v(true),
          studyOrNecessaryAffairs: v(false),
          realWorldActivityDisplacement: v(false),
        },
      }),
    ]) {
      const result = evaluateIntegratedTriage(evidence);
      const normal = [
        result.conditions.TRIAGE_NO_INTERVENTION_INTEGRATED,
        result.conditions.TRIAGE_FURTHER_ASSESSMENT_INTEGRATED,
        result.conditions.TRIAGE_CONTINUE_DIGITAL_USE_INTEGRATED,
      ].filter((value) => value === true);
      expect(normal.length).toBeLessThanOrEqual(1);
    }
  });

  it('is deterministic and has no model/RAG/network truth dependency', () => {
    const evidence = fixture({
      emotion01002: v(['B']),
      directImpact: {
        sleep: v(true),
        studyOrNecessaryAffairs: v(false),
        realWorldActivityDisplacement: v(false),
      },
    });
    expect(evaluateIntegratedTriage(evidence)).toEqual(evaluateIntegratedTriage(evidence));

    const source = readFileSync(
      new URL('../../../packages/scenes/digital-use/integrated-triage.ts', import.meta.url),
      'utf8'
    );
    expect(source).not.toMatch(/openai|anthropic|llm|embedding|classifier|fetch\s*\(|http[s]?:\/\//i);
    expect(source).not.toMatch(/@xiaoshuyin\/(?:ai|rag|memory)/i);
  });

  it('01002 F wins when both F are valid and family F remains in input Evidence', () => {
    const evidence = fixture({ emotion01002: v(['F']), family01003: v('F') });
    const result = evaluateIntegratedTriage(evidence);
    expect(result.outcome).toBe('01005');
    expect(evidence.family01003).toEqual(v('F'));
    expect(result.conditions).toEqual({ EMOTION_SEVERE_F: true });
  });
});
