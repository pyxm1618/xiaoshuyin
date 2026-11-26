import { describe, it, expect } from 'vitest';
import {
  evaluateProfessionalKnowledgeEligibility,
  type ProfessionalKnowledgeVersionSnapshot,
} from '../../packages/domain/src/professional-knowledge.js';

describe('Finding #21: Professional Knowledge Effective Window', () => {
  const baseVersion: ProfessionalKnowledgeVersionSnapshot = {
    id: '018f0000-0000-7000-8000-000000000001',
    knowledgeId: '018f0000-0000-7000-8000-000000000002',
    knowledgeKey: 'KNOWLEDGE_KEY_1',
    semanticVersion: '1.0.0',
    revision: 2,
    lifecycleStatus: 'PUBLISHED',
    reviewState: 'CURRENT',
    validityState: 'VALID',
    content: { key: 'value' },
    contentHash: 'a'.repeat(64),
    sourceSetHash: 'b'.repeat(64),
    sources: [],
    scope: {
      product: 'XIAOSHUYIN',
      sceneCode: 'DIGITAL_USE',
      scenePackageVersion: '1.0.0',
      stages: ['STAGE_1'],
      ageBands: ['ADULT'],
      locale: 'zh-CN',
      riskLevels: ['LOW'],
      applicability: ['app_1'],
      exclusions: [],
      interventionDefinitionRef: null,
    },
    releasedAt: '2026-01-01T00:00:00.000Z',
    effectiveFrom: '2026-01-01T00:00:00.000Z',
    effectiveTo: '2026-12-31T23:59:59.999Z',
  };

  const baseInput = {
    version: baseVersion,
    approval: { status: 'VALID' } as any,
    sceneBinding: {
      status: 'RESOLVED',
      sceneCode: 'DIGITAL_USE',
      scenePackageVersion: '1.0.0',
      refs: [
        {
          knowledgeId: baseVersion.knowledgeId,
          semanticVersion: baseVersion.semanticVersion,
          contentHash: baseVersion.contentHash,
          sourceSetHash: baseVersion.sourceSetHash,
        },
      ],
    } as any,
    stage: 'STAGE_1',
    ageBand: 'ADULT' as const,
    locale: 'zh-CN',
    applicabilityFacts: ['app_1'],
    exclusionFacts: [],
    riskLevel: 'LOW' as const,
    intervention: { status: 'NOT_REQUIRED' } as const,
  };

  it('1. current effective version -> ALLOW (ELIGIBLE)', () => {
    const now = new Date('2026-06-01T12:00:00.000Z');
    const result = evaluateProfessionalKnowledgeEligibility({
      ...baseInput,
      now,
    });
    expect(result).toEqual({ status: 'ELIGIBLE' });
  });

  it('2. future-effective version -> BLOCK (EFFECTIVE_WINDOW_FUTURE)', () => {
    const now = new Date('2025-12-31T23:59:59.000Z'); // before effectiveFrom
    const result = evaluateProfessionalKnowledgeEligibility({
      ...baseInput,
      now,
    });
    expect(result).toEqual({
      status: 'INELIGIBLE',
      reason: 'EFFECTIVE_WINDOW_FUTURE',
    });
  });

  it('3. expired version -> BLOCK (EFFECTIVE_WINDOW_EXPIRED)', () => {
    const now = new Date('2027-01-01T00:00:00.000Z'); // after effectiveTo
    const result = evaluateProfessionalKnowledgeEligibility({
      ...baseInput,
      now,
    });
    expect(result).toEqual({
      status: 'INELIGIBLE',
      reason: 'EFFECTIVE_WINDOW_EXPIRED',
    });
  });

  it('4. no effective_to (null) -> ALLOW (regular current version)', () => {
    const now = new Date('2030-01-01T00:00:00.000Z');
    const versionNoTo: ProfessionalKnowledgeVersionSnapshot = {
      ...baseVersion,
      effectiveTo: null,
    };
    const result = evaluateProfessionalKnowledgeEligibility({
      ...baseInput,
      version: versionNoTo,
      now,
    });
    expect(result).toEqual({ status: 'ELIGIBLE' });
  });

  it('5. boundary timestamp exact matching', () => {
    // Exactly at effectiveFrom -> ALLOW
    const exactlyFrom = new Date('2026-01-01T00:00:00.000Z');
    expect(
      evaluateProfessionalKnowledgeEligibility({ ...baseInput, now: exactlyFrom })
    ).toEqual({ status: 'ELIGIBLE' });

    // 1 millisecond before effectiveTo -> ALLOW
    const justBeforeTo = new Date('2026-12-31T23:59:59.998Z');
    expect(
      evaluateProfessionalKnowledgeEligibility({ ...baseInput, now: justBeforeTo })
    ).toEqual({ status: 'ELIGIBLE' });

    // Exactly at effectiveTo -> BLOCK (expired, because rule is now < effective_to)
    const exactlyTo = new Date('2026-12-31T23:59:59.999Z');
    expect(
      evaluateProfessionalKnowledgeEligibility({ ...baseInput, now: exactlyTo })
    ).toEqual({
      status: 'INELIGIBLE',
      reason: 'EFFECTIVE_WINDOW_EXPIRED',
    });
  });

  it.each([
    { effectiveFrom: null },
    { effectiveFrom: '2026' },
    { effectiveFrom: '2026-02-30T00:00:00Z' },
    { effectiveTo: 'invalid' },
  ])('fails closed for invalid effective bounds %j', (bounds) => {
    expect(evaluateProfessionalKnowledgeEligibility({
      ...baseInput,
      version: { ...baseVersion, ...bounds },
      now: new Date('2026-06-01T00:00:00Z'),
    })).toEqual({ status: 'INELIGIBLE', reason: 'EFFECTIVE_WINDOW_INVALID' });
  });

  it('6. migration 031 structure compliance (no top-level transaction control & hardened search_path)', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const migrationPath = path.resolve(
      __dirname,
      '../../db/migrations/031_professional_knowledge_effective_window_remediation.sql'
    );
    const content = fs.readFileSync(migrationPath, 'utf8');

    // Rule 1: No top-level BEGIN / COMMIT / ROLLBACK outside plpgsql blocks
    const lines = content
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => !l.startsWith('--') && l.length > 0);

    // Matches top-level statements that are standalone transaction controls
    const topLevelTxControls = lines.filter((l) =>
      /^(BEGIN|COMMIT|ROLLBACK)\s*;/i.test(l)
    );
    expect(topLevelTxControls).toEqual([]);

    // Rule 2: Hardened search_path with pg_temp at the end (Finding #15 prevention)
    expect(content).toContain(
      'SET search_path = pg_catalog, public, app, pg_temp'
    );

    // Rule 3: Persistence and RLS include effective window rules
    expect(content).toContain(
      "effective_to = NULLIF(p_evidence ->> 'effectiveTo', '')::timestamptz"
    );
    expect(content).toContain('effective_from <= transaction_timestamp()');
    expect(content).toContain('transaction_timestamp() < effective_to');
  });
});
