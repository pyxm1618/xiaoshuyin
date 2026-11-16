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
