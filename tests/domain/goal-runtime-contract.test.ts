import { describe, expect, it } from 'vitest';
import {
  assertGoalDependenciesCoverProblemFormulation,
  normalizedGoalContract,
  validateGoalContract,
  type DependencyRef,
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

  it.each([
    ['POLICY', { type: 'POLICY', key: 'policy', version: 'v1' }],
    ['CONTENT_VERSION', { type: 'CONTENT_VERSION', key: 'content', version: 'v1' }],
  ] as const)('rejects unsupported Goal %s dependency in the domain', (_type, dependency) => {
    const input = valid();
    (input.dependencyRefs as DependencyRef[]).push(dependency);
    expect(() => validateGoalContract(input)).toThrow(/only support EVIDENCE, CONSENT, or PACKAGE/);
  });

  it('accepts authorized PACKAGE dependency in Goal contract', () => {
    const input = valid();
    input.dependencyRefs.push({
      type: 'PACKAGE',
      key: 'DIGITAL_USE',
      version: 'v1',
    });
    expect(() => validateGoalContract(input)).not.toThrow();
  });

  it.each([
    ['empty key', { type: 'PACKAGE' as const, key: '', version: 'v1' }],
    ['empty version', { type: 'PACKAGE' as const, key: 'DIGITAL_USE', version: ' ' }],
  ])('rejects invalid PACKAGE dependency format: %s', (_name, dependency) => {
    const input = valid();
    input.dependencyRefs.push(dependency as any);
    expect(() => validateGoalContract(input)).toThrow(/invalid Package reference/);
  });

  it.each([
    ['POLICY', { type: 'POLICY', key: 'policy', version: 'v1' }],
    ['CONTENT_VERSION', { type: 'CONTENT_VERSION', key: 'content', version: 'v1' }],
  ] as const)(
    'fails closed when the current Problem Formulation requires unsupported %s',
    (_type, dependency) => {
      expect(() =>
        assertGoalDependenciesCoverProblemFormulation([dependency], valid().dependencyRefs)
      ).toThrow(/unsupported by Goal V1/);
    }
  );

  it('accepts Problem Formulation requiring PACKAGE:DIGITAL_USE:v1 and requires candidate to cover it', () => {
    const packageDep: DependencyRef = {
      type: 'PACKAGE',
      key: 'DIGITAL_USE',
      version: 'v1',
    };
    const base = valid();

    // Fails when Goal candidate does not cover the required PACKAGE dependency
    expect(() =>
      assertGoalDependenciesCoverProblemFormulation([packageDep], base.dependencyRefs)
    ).toThrow(/Goal dependencyRefs must include the current Problem Formulation dependencies/);

    // Passes when Goal candidate includes the required PACKAGE dependency
    const candidateWithPackage = [...base.dependencyRefs, packageDep];
    expect(() =>
      assertGoalDependenciesCoverProblemFormulation([packageDep], candidateWithPackage)
    ).not.toThrow();
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
