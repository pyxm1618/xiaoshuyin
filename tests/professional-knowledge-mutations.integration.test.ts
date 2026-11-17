import { describe, expect, it } from 'vitest';
import {
  hashPayload,
  IDEMPOTENCY_COMMAND_TYPES,
} from '../packages/domain/src/idempotency.js';
import {
  hashProfessionalKnowledgeContent,
  hashProfessionalKnowledgeSourceSet,
  releasedSemanticMutationAllowed,
} from '../packages/domain/src/professional-knowledge.js';

describe('professional knowledge mutations contract', () => {
  it('registers the shared idempotency commands with canonical hashes', () => {
    expect(IDEMPOTENCY_COMMAND_TYPES).toEqual(
      expect.arrayContaining([
        'PROFESSIONAL_KNOWLEDGE_CANDIDATE_CREATE',
        'PROFESSIONAL_KNOWLEDGE_SUCCESSOR_CREATE',
        'PROFESSIONAL_KNOWLEDGE_CANDIDATE_EDIT',
        'PROFESSIONAL_KNOWLEDGE_REVIEW_RECORD',
        'PROFESSIONAL_KNOWLEDGE_RELEASE',
        'PROFESSIONAL_KNOWLEDGE_RETIRE',
      ])
    );
    expect(hashPayload({ b: 2, a: 1 })).toBe(hashPayload({ a: 1, b: 2 }));
  });

  it('uses successor versions rather than semantic overwrite after release', () => {
    const content = { body: 'v1' };
    const sources = [{
      sourceRef: 's1',
      sourceVersion: '1',
      sourceHash: '1'.repeat(64),
      locator: null,
      metadata: {},
    }];
    const before = {
      id: 'v1',
      knowledgeId: 'k1',
      knowledgeKey: 'k',
      semanticVersion: '1.0.0',
      revision: 2,
      lifecycleStatus: 'PUBLISHED' as const,
      reviewState: 'CURRENT' as const,
      validityState: 'VALID' as const,
      content,
      contentHash: hashProfessionalKnowledgeContent(content),
      sourceSetHash: hashProfessionalKnowledgeSourceSet(sources),
      sources,
      scope: {
        product: 'V1' as const,
        sceneCode: 'DIGITAL_USE',
        scenePackageVersion: 'v1',
        stages: ['ASSESSMENT'],
        ageBands: ['MINOR_14_17'] as const,
        applicability: ['a'],
        exclusions: [],
        riskLevels: ['LOW'] as const,
        locale: 'zh-CN',
      },
      releasedAt: '2026-11-01T00:00:00Z',
      effectiveFrom: null,
      effectiveTo: null,
    };
    expect(releasedSemanticMutationAllowed(before, { ...before, revision: 3 })).toBe(true);
    expect(
      releasedSemanticMutationAllowed(before, {
        ...before,
        content: { body: 'changed' },
        contentHash: '2'.repeat(64),
      })
    ).toBe(false);
  });
});
