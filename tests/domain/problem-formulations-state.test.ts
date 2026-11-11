/**
 * Slice 8 — pure Problem Formulation state/version/dependency policy.
 */

import { describe, it, expect } from 'vitest';
import {
  assertStatusAllows,
  canonicalDependencies,
  canonicalEvidenceRefs,
  deriveMandatoryDependencyRefs,
  deriveProcessingPersonIds,
  isDependencySubset,
  mergeCorrection,
  nextFormulationVersion,
  parseIfMatchCaseVersion,
  caseVersionEtag,
  ProblemFormulationError,
  type ProblemFormulationContent,
  type ProblemFormulationRow,
} from '@xiaoshuyin/domain';

function content(overrides: Partial<ProblemFormulationContent> = {}): ProblemFormulationContent {
  const ref = { type: 'ASSERTION' as const, id: '11111111-1111-4111-8111-111111111111' };
  return {
    primaryProblem: { text: '主问题', evidenceRefs: [ref] },
    keyFactors: [],
    evidenceRefs: [ref],
    unknowns: [],
    conflicts: [],
    sceneFit: 'family',
    alternativeExplanations: [],
    reassessmentConditions: [],
    exitConditions: [],
    dependencyRefs: [],
    ...overrides,
  };
}

function row(overrides: Partial<ProblemFormulationRow> = {}): ProblemFormulationRow {
  const value = content();
  return {
    id: '22222222-2222-4222-8222-222222222222',
    family_id: '33333333-3333-4333-8333-333333333333',
    case_id: '44444444-4444-4444-8444-444444444444',
    version: 1,
    status: 'PRESENTED',
    primary_problem: value.primaryProblem,
    key_factors: value.keyFactors,
    evidence_refs: value.evidenceRefs,
    unknowns: value.unknowns,
    conflicts: value.conflicts,
    scene_fit: value.sceneFit,
    alternative_explanations: value.alternativeExplanations,
    reassessment_conditions: value.reassessmentConditions,
    exit_conditions: value.exitConditions,
    user_response: null,
    confirmed_by_person_id: null,
    confirmed_at: null,
    dependency_refs: value.dependencyRefs,
    supersedes_version: null,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

describe('problem formulation state policy', () => {
  it('accepts exactly the frozen legal transitions', () => {
    expect(() => assertStatusAllows('CONFIRM', 'PRESENTED')).not.toThrow();
    expect(() => assertStatusAllows('DISPUTE', 'PRESENTED')).not.toThrow();
    for (const status of ['PRESENTED', 'DISPUTED', 'NEEDS_REVIEW'] as const) {
      expect(() => assertStatusAllows('CORRECTION', status)).not.toThrow();
    }
  });

  it('fails closed on illegal transitions', () => {
    for (const status of ['CONFIRMED', 'SUPERSEDED', 'DRAFT'] as const) {
      expect(() => assertStatusAllows('CONFIRM', status)).toThrow(ProblemFormulationError);
      expect(() => assertStatusAllows('DISPUTE', status)).toThrow(ProblemFormulationError);
      expect(() => assertStatusAllows('CORRECTION', status)).toThrow(ProblemFormulationError);
    }
  });

  it('allocates versions from 1 and rejects overflow', () => {
    expect(nextFormulationVersion(null)).toBe(1);
    expect(nextFormulationVersion(row({ version: 5 }))).toBe(6);
    expect(() => nextFormulationVersion(row({ version: 2147483647 }))).toThrow(
      ProblemFormulationError
    );
  });

  it('canonicalises evidence refs by type and id', () => {
    const refs = [
      { type: 'OBSERVATION' as const, id: 'B' },
      { type: 'ASSERTION' as const, id: 'A' },
      { type: 'ASSERTION' as const, id: 'A' },
    ];
    expect(canonicalEvidenceRefs(refs as any)).toEqual([
      { type: 'ASSERTION', id: 'a' },
      { type: 'OBSERVATION', id: 'b' },
    ]);
  });

  it('derives sorted distinct processing Persons from every source', () => {
    const ids = deriveProcessingPersonIds({
      actorPersonId: 'p-actor',
      caseCreatorPersonId: 'p-creator',
      activeParticipantPersonIds: ['p-part', 'p-actor'],
      authoritativeMembers: [
        {
          ref: { type: 'OBSERVATION', id: 'x' },
          kind: 'OBSERVATION',
          caseId: 'c',
          familyId: 'f',
          personIds: ['p-subject', 'p-source'],
          usable: true,
          unknownState: null,
          conflictGroupId: null,
          assertionKind: null,
        },
      ],
    });
    expect(ids).toEqual(['p-actor', 'p-creator', 'p-part', 'p-source', 'p-subject']);
  });

  it('derives mandatory Evidence + UNDER_14 Consent dependencies', () => {
    const refs = [
      { type: 'ASSERTION' as const, id: 'a' },
      { type: 'OBSERVATION' as const, id: 'b' },
    ];
    const deps = deriveMandatoryDependencyRefs({
      authoritativeRefs: refs,
      under14Consents: [{ id: 'consent', version: 2 }],
    });
    expect(deps).toHaveLength(3);
    expect(canonicalDependencies(deps)).toHaveLength(3);
    expect(isDependencySubset(deps, deps)).toBe(true);
    expect(isDependencySubset(deps, deps.slice(1))).toBe(false);
  });

  it('merges a correction into a complete version and rejects no-ops', () => {
    const current = content();
    const merged = mergeCorrection(current, {
      primaryProblem: {
        text: '更正后的问题',
        evidenceRefs: [{ type: 'ASSERTION', id: '11111111-1111-4111-8111-111111111111' }],
      },
    });
    expect(merged.primaryProblem.text).toBe('更正后的问题');
    expect(merged.sceneFit).toBe(current.sceneFit);
    expect(() => mergeCorrection(current, {})).toThrow(ProblemFormulationError);
  });

  it('parses If-Match only inside PostgreSQL integer range', () => {
    expect(parseIfMatchCaseVersion('"case-v2147483647"')).toBe(2147483647);
    expect(() => parseIfMatchCaseVersion('"case-v2147483648"')).toThrow(ProblemFormulationError);
    expect(() => parseIfMatchCaseVersion('case-v1')).toThrow(ProblemFormulationError);
    expect(caseVersionEtag(3)).toBe('"case-v3"');
  });
});