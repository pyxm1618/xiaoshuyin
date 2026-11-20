import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  digitalUseProfessionalKnowledgePackageBindings,
  resolveDigitalUseProfessionalKnowledgeBinding,
  resolveProfessionalKnowledgeBindingFromRegistry,
} from '../packages/scenes/digital-use/professional-knowledge-binding.js';
import {
  projectProfessionalKnowledgeDependencyImpact,
} from '../packages/domain/src/professional-knowledge.js';

const ref = {
  knowledgeId: 'knowledge-1',
  semanticVersion: '1.0.0',
  contentHash: '1'.repeat(64),
  sourceSetHash: '2'.repeat(64),
};

describe('Scene-owned exact Professional Knowledge binding', () => {
  it('keeps production v1 history as an exact immutable empty set', () => {
    expect(resolveDigitalUseProfessionalKnowledgeBinding('v1')).toEqual({
      status: 'RESOLVED',
      sceneCode: 'DIGITAL_USE',
      scenePackageVersion: 'v1',
      refs: [],
    });
    expect(Object.isFrozen(digitalUseProfessionalKnowledgePackageBindings)).toBe(true);
  });

  it('allows a successor package version to own an independent exact set', () => {
    const registry = [
      ...digitalUseProfessionalKnowledgePackageBindings,
      {
        sceneCode: 'DIGITAL_USE' as const,
        scenePackageVersion: 'v2',
        professionalKnowledgeRefs: [ref],
      },
    ];
    expect(resolveProfessionalKnowledgeBindingFromRegistry(registry, 'v1')).toMatchObject({ refs: [] });
    expect(resolveProfessionalKnowledgeBindingFromRegistry(registry, 'v2')).toMatchObject({ refs: [ref] });
  });

  it('fails closed on wrong version and never floats to latest', () => {
    expect(resolveDigitalUseProfessionalKnowledgeBinding('latest')).toEqual({
      status: 'INVALID',
      reason: 'SCENE_PACKAGE_VERSION_NOT_FOUND',
    });
    expect(resolveDigitalUseProfessionalKnowledgeBinding('v2')).toEqual({
      status: 'INVALID',
      reason: 'SCENE_PACKAGE_VERSION_NOT_FOUND',
    });
  });

  it('does not mark Knowledge NEEDS_REVIEW for Scene package supersession alone', () => {
    expect(projectProfessionalKnowledgeDependencyImpact({
      current: { reviewState: 'CURRENT', validityState: 'VALID' },
      impact: 'SCENE_PACKAGE_SUPERSEDED',
      exactDependent: true,
    })).toEqual({
      reviewState: 'CURRENT', validityState: 'VALID', eligibilitySuppressed: false,
    });
  });

  it('has one Scene binding owner and no knowledge_package_inclusions table', () => {
    const source = readFileSync(
      new URL('../packages/scenes/digital-use/professional-knowledge-binding.ts', import.meta.url),
      'utf8'
    );
    expect(source).toContain('digitalUseProfessionalKnowledgePackageBindings');
    expect(source).not.toContain('knowledge_package_inclusions');
    expect(source).not.toContain('CREATE TABLE');
  });
});
