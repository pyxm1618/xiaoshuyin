import { describe, expect, it } from 'vitest';
import {
  normalizedGoalContract,
  validateGoalContract,
  type GoalContractInput,
} from '@xiaoshuyin/domain';

const EVIDENCE_ID = '11111111-1111-4111-8111-111111111111';
const PERSON_ID = '22222222-2222-4222-8222-222222222222';
const PF_ID = '33333333-3333-4333-8333-333333333333';

function valid(): GoalContractInput {
  return {
    problemFormulationId: PF_ID,
    problemFormulationVersion: 1,
    baselineRefs: [{ type: 'ASSERTION', id: EVIDENCE_ID }],
    targetDescription: 'Reduce disruptive evening device use.',
    observationMethod: 'Record bedtime and conflict observations.',
    observationWindow: '14 days',
    protectiveConditions: ['Preserve required school contact.'],
    parentActions: ['Use the agreed transition prompt.'],
    reviewPoint: 'Review after 14 days.',
    dependencyRefs: [
      { type: 'EVIDENCE', evidence: { type: 'ASSERTION', id: EVIDENCE_ID } },
    ],
    participantResponsibilities: [],
  };
}

describe('Common Core Goal contract', () => {
  it('accepts the complete frozen minimum contract', () => {
    expect(() => validateGoalContract(valid())).not.toThrow();
  });

  it.each([
    ['baselineRefs', (x: GoalContractInput) => { x.baselineRefs = []; }],
    ['targetDescription', (x: GoalContractInput) => { x.targetDescription = ' '; }],
    ['observationMethod', (x: GoalContractInput) => { x.observationMethod = ''; }],
    ['observationWindow', (x: GoalContractInput) => { x.observationWindow = ''; }],
    ['protectiveConditions', (x: GoalContractInput) => { x.protectiveConditions = []; }],
    ['parentActions', (x: GoalContractInput) => { x.parentActions = []; }],
    ['reviewPoint', (x: GoalContractInput) => { x.reviewPoint = ''; }],
    ['dependencyRefs', (x: GoalContractInput) => { x.dependencyRefs = []; }],
  ] as const)('rejects incomplete %s', (_name, mutate) => {
    const input = valid();
    mutate(input);
    expect(() => validateGoalContract(input)).toThrow();
  });

  it('requires traceable Evidence for represented participant responsibility', () => {
    const input = valid();
    input.participantResponsibilities = [{
      personId: PERSON_ID,
      responsibility: 'Follow the agreed device handoff.',
      evidenceRefs: [],
    }];
    expect(() => validateGoalContract(input)).toThrow(
      /participantResponsibilities\.evidenceRefs/
    );
  });

  it('canonicalizes identity refs for stable idempotency hashing', () => {
    const input = valid();
    input.problemFormulationId = PF_ID.toUpperCase();
    input.baselineRefs = [
      { type: 'ASSERTION', id: EVIDENCE_ID.toUpperCase() },
      { type: 'ASSERTION', id: EVIDENCE_ID },
    ];
    const normalized = normalizedGoalContract(input);
    expect(normalized.problemFormulationId).toBe(PF_ID);
    expect(normalized.baselineRefs).toEqual([
      { type: 'ASSERTION', id: EVIDENCE_ID },
    ]);
  });
});
