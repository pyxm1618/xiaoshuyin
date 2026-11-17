import { describe, expect, it } from 'vitest';
import {
  canonicalInterventionDefinitionBytes,
  canonicalInterventionDefinitionJson,
  interventionDefinitionContentHash,
  parseInterventionDefinitionSemanticPayload,
  prepareInterventionDefinition,
} from '../../packages/domain/src/index.js';
import { interventionSemantic } from '../support/intervention.js';

describe('Slice 16 InterventionDefinition schema / canonical hash', () => {
  it('validates every frozen semantic field before hashing and rejects unknown authority fields', () => {
    const semantic = interventionSemantic();
    expect(parseInterventionDefinitionSemanticPayload(semantic)).toEqual(semantic);
    expect(() =>
      parseInterventionDefinitionSemanticPayload({
        ...semantic,
        approved: true,
      })
    ).toThrowError(/INTERVENTION_DEFINITION_INVALID/);
    expect(() =>
      parseInterventionDefinitionSemanticPayload({
        ...semantic,
        content_hash: 'client-supplied',
      })
    ).toThrowError(/INTERVENTION_DEFINITION_INVALID/);
  });

  it('uses schema field order, exact UTF-8 bytes and SHA-256', () => {
    const semantic = interventionSemantic();
    const json = canonicalInterventionDefinitionJson(semantic);
    expect(json.indexOf('"target_problem_or_mechanism"')).toBeLessThan(
      json.indexOf('"professional_source_refs"')
    );
    expect(new TextDecoder().decode(canonicalInterventionDefinitionBytes(semantic))).toBe(json);
    expect(interventionDefinitionContentHash(semantic)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('preserves semantically ordered arrays', () => {
    const left = interventionSemantic({ intervention_steps: ['A', 'B'] });
    const right = interventionSemantic({ intervention_steps: ['B', 'A'] });
    expect(interventionDefinitionContentHash(left)).not.toBe(
      interventionDefinitionContentHash(right)
    );
  });

  it('canonicalizes nested object key order without changing semantic array order', () => {
    const a = interventionSemantic({
      age_and_development_scope: {
        min_age_years: 10,
        max_age_years: 17,
        development_stages: ['ADOLESCENCE'],
      },
    });
    const b = {
      ...a,
      age_and_development_scope: {
        development_stages: ['ADOLESCENCE'],
        max_age_years: 17,
        min_age_years: 10,
      },
    };
    expect(interventionDefinitionContentHash(parseInterventionDefinitionSemanticPayload(a))).toBe(
      interventionDefinitionContentHash(parseInterventionDefinitionSemanticPayload(b))
    );
  });

  it('material professional source-ref change creates a different content hash', () => {
    expect(
      interventionDefinitionContentHash(interventionSemantic({ professional_source_refs: ['SOURCE:A'] }))
    ).not.toBe(
      interventionDefinitionContentHash(interventionSemantic({ professional_source_refs: ['SOURCE:B'] }))
    );
  });

  it('rejects NaN, Infinity and -Infinity condition scalars before canonical hashing', () => {
    for (const value of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      const semantic = interventionSemantic({
        applicable_conditions: [
          { fact_ref: 'numeric.scalar', operator: 'EQUALS', value },
        ],
      });
      expect(() =>
        prepareInterventionDefinition({
          sceneId: 'DIGITAL_USE',
          interventionCode: 'TEST_NON_FINITE_SCALAR',
          version: 1,
          semantic,
        })
      ).toThrowError(/INTERVENTION_DEFINITION_INVALID/);
    }
  });

  it('rejects arrays containing NaN, Infinity or -Infinity before canonical hashing', () => {
    for (const value of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      const semantic = interventionSemantic({
        applicable_conditions: [
          { fact_ref: 'numeric.array', operator: 'IN', value: [1, value] },
        ],
      });
      expect(() =>
        prepareInterventionDefinition({
          sceneId: 'DIGITAL_USE',
          interventionCode: 'TEST_NON_FINITE_ARRAY',
          version: 1,
          semantic,
        })
      ).toThrowError(/INTERVENTION_DEFINITION_INVALID/);
    }
  });

  it('enforces one parser/evaluator condition shape contract', () => {
    const scalar = (operator: 'EQUALS' | 'NOT_EQUALS') =>
      interventionSemantic({
        applicable_conditions: [
          { fact_ref: 'family.ready', operator, value: true },
        ],
      });
    const list = (operator: 'IN' | 'NOT_IN') =>
      interventionSemantic({
        applicable_conditions: [
          { fact_ref: 'family.state', operator, value: ['READY', 'STABLE'] },
        ],
      });

    expect(() => parseInterventionDefinitionSemanticPayload(scalar('EQUALS'))).not.toThrow();
    expect(() => parseInterventionDefinitionSemanticPayload(scalar('NOT_EQUALS'))).not.toThrow();
    expect(() => parseInterventionDefinitionSemanticPayload(list('IN'))).not.toThrow();
    expect(() => parseInterventionDefinitionSemanticPayload(list('NOT_IN'))).not.toThrow();

    for (const condition of [
      { fact_ref: 'bad.equals', operator: 'EQUALS', value: ['READY'] },
      { fact_ref: 'bad.notEquals', operator: 'NOT_EQUALS', value: ['READY'] },
      { fact_ref: 'bad.in', operator: 'IN', value: 'READY' },
      { fact_ref: 'bad.notIn', operator: 'NOT_IN', value: 'READY' },
      { fact_ref: 'bad.exists', operator: 'EXISTS', value: true },
    ]) {
      expect(() =>
        parseInterventionDefinitionSemanticPayload(
          interventionSemantic({
            applicable_conditions: [condition as never],
          })
        )
      ).toThrowError(/INTERVENTION_DEFINITION_INVALID/);
    }
  });

  it('detaches and recursively freezes the canonical semantic snapshot before hashing', () => {
    const conditionValues = ['READY', 'STABLE'];
    const steps = ['STEP:A'];
    const stages = ['ADOLESCENCE'];
    const semantic = interventionSemantic({
      applicable_conditions: [
        { fact_ref: 'family.state', operator: 'IN', value: conditionValues },
      ],
      intervention_steps: steps,
      age_and_development_scope: {
        min_age_years: 10,
        max_age_years: 17,
        development_stages: stages,
      },
    });
    const prepared = prepareInterventionDefinition({
      sceneId: 'DIGITAL_USE',
      interventionCode: 'SNAPSHOT_ALIAS',
      version: 1,
      semantic,
    });
    const before = JSON.stringify(prepared.semantic);
    const beforeHash = prepared.contentHash;

    conditionValues.push('MUTATED');
    steps.push('STEP:MUTATED');
    stages.push('MUTATED_STAGE');

    expect(JSON.stringify(prepared.semantic)).toBe(before);
    expect(prepared.contentHash).toBe(beforeHash);
    expect(prepared.contentHash).toBe(
      interventionDefinitionContentHash(prepared.semantic)
    );
    expect(Object.isFrozen(prepared.semantic)).toBe(true);
    expect(Object.isFrozen(prepared.semantic.applicable_conditions)).toBe(true);
    expect(
      Object.isFrozen(prepared.semantic.applicable_conditions[0]!.value)
    ).toBe(true);
    expect(Object.isFrozen(prepared.semantic.age_and_development_scope)).toBe(true);
    expect(
      Object.isFrozen(prepared.semantic.age_and_development_scope.development_stages)
    ).toBe(true);
  });

  it('normalizes stable intervention_code and never trusts client version/hash fields', () => {
    const prepared = prepareInterventionDefinition({
      sceneId: 'DIGITAL_USE',
      interventionCode: 'test_intervention',
      version: 3,
      semantic: interventionSemantic(),
    });
    expect(prepared.interventionCode).toBe('TEST_INTERVENTION');
    expect(prepared.version).toBe(3);
    expect(prepared.contentHash).toBe(interventionDefinitionContentHash(prepared.semantic));
  });
});
