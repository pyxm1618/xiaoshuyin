import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  unavailableProductionProfessionalApprovalProvider,
  unavailableProductionProfessionalQualificationProvider,
} from '../apps/server/api/src/services/professional-knowledge.js';
import {
  digitalUseProfessionalKnowledgePackageBindings,
} from '../packages/scenes/digital-use/professional-knowledge-binding.js';

const productionFiles = [
  '../packages/domain/src/professional-knowledge.ts',
  '../packages/domain/src/professional-knowledge-repository.ts',
  '../apps/server/api/src/services/professional-knowledge.ts',
  '../apps/server/api/src/services/professional-knowledge-consumption.ts',
  '../packages/scenes/digital-use/professional-knowledge-binding.ts',
].map((path) => readFileSync(new URL(path, import.meta.url), 'utf8'));

describe('Professional Knowledge production composition guard', () => {
  it('has no real production approval/qualification provider while reviewer is unassigned', async () => {
    await expect(
      unavailableProductionProfessionalApprovalProvider.resolve({
        knowledgeId: 'k', semanticVersion: '1.0.0',
        contentHash: 'a'.repeat(64), sourceSetHash: 'b'.repeat(64),
      })
    ).resolves.toEqual({ status: 'UNAVAILABLE', reason: 'PROVIDER_UNAVAILABLE' });
    await expect(
      unavailableProductionProfessionalQualificationProvider.resolve({
        qualificationRef: 'q', reviewerIdentity: 'r',
        reviewerAccountId: 'a', reviewerPersonId: 'p',
        scope: {
          product: 'V1', sceneCode: 'DIGITAL_USE', scenePackageVersion: 'v1',
          stages: ['ASSESSMENT'], ageBands: ['ADULT'], locale: 'zh-CN',
        },
      })
    ).resolves.toMatchObject({ status: 'UNAVAILABLE' });
  });

  it('consumes the merged Slice 16 authoritative owner without candidate-era branch assumptions', () => {
    const source = productionFiles.join('\n');
    expect(source).toContain('getExactInterventionDefinition');
    expect(source).not.toContain('SLICE_16_AUTHORITATIVE_OWNER_NOT_MERGED');
    expect(source).not.toMatch(/PR\s*#?57|feat\/016-/i);
  });

  it('has an exact empty production-approved Knowledge set for current Scene v1', () => {
    expect(digitalUseProfessionalKnowledgePackageBindings).toEqual([
      {
        sceneCode: 'DIGITAL_USE',
        scenePackageVersion: 'v1',
        professionalKnowledgeRefs: [],
      },
    ]);
  });

  it('cannot import test fixtures or enable synthetic authority through env/config', () => {
    const source = productionFiles.join('\n');
    expect(source).not.toMatch(/from\s+['"][^'"]*(?:tests|fixtures)\//i);
    expect(source).not.toMatch(/process\.env[^\n]*(?:APPROV|QUALIF|SYNTHETIC|FAKE)/i);
    expect(source).not.toMatch(/approved\s*=\s*true/i);
  });

  it('adds no Slice 18/19 RAG or AI runtime implementation', () => {
    const imports = productionFiles
      .join('\n')
      .split('\n')
      .filter((line) => /^\s*import\b/.test(line))
      .join('\n');
    for (const forbidden of [
      'pgvector', 'sparsevec', 'pg_jieba', 'promptfoo',
      'TaskModelRegistry', 'Context Builder', 'AI Task Runtime',
      'hybrid-search', 'reranker',
    ]) {
      expect(imports).not.toContain(forbidden);
    }
  });
});
