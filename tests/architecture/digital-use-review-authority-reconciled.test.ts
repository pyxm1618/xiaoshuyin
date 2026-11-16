import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  A5001FamilyAllianceReviewSubmission,
  A5002PhoneUseContractReviewSubmission,
} from '@xiaoshuyin/contracts';
import {
  TEST_A5001_PACKAGE,
  TEST_A5002_PACKAGE,
  normalizedReviewResponse,
} from '../support/digital-use-review-professional-content.js';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');

function productionFiles(dir: string): string[] {
  const absolute = join(root, dir);
  const out: string[] = [];
  for (const entry of readdirSync(absolute)) {
    const path = join(absolute, entry);
    const relative = path.slice(root.length + 1);
    if (statSync(path).isDirectory()) out.push(...productionFiles(relative));
    else if (/\.(ts|mjs|sql)$/.test(entry)) out.push(relative);
  }
  return out;
}

describe('Slice 15 authority-reconciled architecture boundaries', () => {
  it('production provider is structurally unavailable and production cannot import the test fixture', () => {
    const provider = read(
      'apps/server/api/src/services/digital-use-review-professional-content.ts'
    );
    expect(provider).toContain(
      'unavailableProductionProfessionalReviewContentProvider'
    );
    expect(provider.match(/async (resolve|revalidate)\(\) \{\s*return null;/g))
      .toHaveLength(2);

    expect(
      existsSync(
        join(root, 'tests/support/digital-use-review-professional-content.ts')
      )
    ).toBe(true);

    const production = productionFiles('apps')
      .map((path) => read(path))
      .join('\n');
    expect(production).not.toContain('TestProfessionalReviewContentProvider');
    expect(production).not.toContain('test:professional-review:a5001');
    expect(production).not.toContain('test:professional-review:a5002');
    expect(production).not.toMatch(/tests\/support\/digital-use-review/i);
  });

  it('review contracts bind package + exact subject without candidate professional dimensions or scoring', () => {
    const a5001 = A5001FamilyAllianceReviewSubmission.parse({
      kind: 'FAMILY_ALLIANCE_REVIEW',
      subject: {
        selectionRevision: 3,
        selectedTargets: [{
          targetId: '00000000-0000-4000-8000-000000000001',
          targetCode: 'SLEEP',
          targetRevision: 4,
        }],
      },
      professionalPackage: TEST_A5001_PACKAGE,
      packageResponse: normalizedReviewResponse,
      evidenceRefs: [],
      provenance: [],
    });
    expect(a5001.professionalPackage).toEqual(TEST_A5001_PACKAGE);

    const a5002 = A5002PhoneUseContractReviewSubmission.parse({
      kind: 'PHONE_USE_CONTRACT_REVIEW',
      subject: {
        contractId: '00000000-0000-4000-8000-000000000002',
        contractVersion: 2,
        contractRevision: 7,
        contractStatus: 'ACTIVE',
      },
      professionalPackage: TEST_A5002_PACKAGE,
      packageResponse: normalizedReviewResponse,
      evidenceRefs: [],
      provenance: [],
    });
    expect(a5002.subject.contractVersion).toBe(2);

    const source = read('packages/contracts/src/digital-use-review-schemas.ts');
    for (const forbidden of [
      'familyDimensions',
      'targetEvaluations',
      'A5001_DIMENSION_KEYS',
      'A5002_DIMENSION_KEYS',
      'emotionalSupport',
      'executionConsistency',
      'effectivenessScore',
      'successPercentage',
      'universalScore',
    ]) {
      expect(source, forbidden).not.toContain(forbidden);
    }
  });

  it('professional response normalization is package-owned rather than client-asserted', () => {
    const contracts = read('packages/contracts/src/digital-use-review-schemas.ts');
    const provider = read(
      'apps/server/api/src/services/digital-use-review-professional-content.ts'
    );
    const a5001 = read(
      'apps/server/api/src/services/digital-use-family-alliance-review.ts'
    );
    const a5002 = read(
      'apps/server/api/src/services/digital-use-phone-contract-review.ts'
    );

    expect(contracts).toContain('packageResponse: PackageOwnedResponse');
    expect(contracts).not.toContain('normalizedResponse: PackageOwnedResponse');
    expect(provider).toContain('validateAndNormalizeResponse(');
    expect(a5001).toContain(
      'professionalPackage.validateAndNormalizeResponse'
    );
    expect(a5002).toContain(
      'professionalPackage.validateAndNormalizeResponse'
    );
    expect(a5001).toContain('normalizedResponse,');
    expect(a5002).toContain('normalizedResponse,');
  });

  it('adds no generic Review owner, CMS, reviewer platform, scheduler, AI/RAG or Phase-4 storage', () => {
    const files = [
      'apps/server/api/src/services/digital-use-family-alliance-review.ts',
      'apps/server/api/src/services/digital-use-phone-contract-review.ts',
      'apps/server/api/src/services/digital-use-review-professional-content.ts',
      'packages/contracts/src/digital-use-review-schemas.ts',
      'db/migrations/023_digital_use_review_runtime_authority_reconciled.sql',
    ];
    const production = files.map(read).join('\n');
    expect(production).not.toMatch(/CREATE\s+TABLE/i);
    expect(production).not.toMatch(/INSERT\s+INTO\s+reviews\b/i);
    expect(production).not.toMatch(/professional_packages|reviewers\b/i);
    expect(production).not.toMatch(/pg-boss|node-cron|cron\.schedule|scheduler table/i);
    expect(production).not.toMatch(/@openai|anthropic|generateText|embeddings?|pgvector|reranker/i);
    expect(production).not.toMatch(/INSERT\s+INTO\s+(outcomes|goals|plans|tasks|checkins|notifications)\b/i);
  });

  it('A5001/A5002 remain independent and A5002 cannot execute A4012', () => {
    const a5001 = read(
      'apps/server/api/src/services/digital-use-family-alliance-review.ts'
    );
    const a5002 = read(
      'apps/server/api/src/services/digital-use-phone-contract-review.ts'
    );
    expect(a5001).not.toContain('DIGITAL_USE_A5002_EFFECT_EVALUATION');
    expect(a5001).not.toMatch(/nodeCode:\s*'A5002'/);
    expect(a5002).not.toContain('DIGITAL_USE_A5001_EFFECT_EVALUATION');
    expect(a5002).not.toMatch(/revisePhoneUseContract|activatePhoneUseContract|supersedePhoneUseContract/);
    expect(a5002).not.toMatch(/nodeCode:\s*'A4012'/);
    expect(a5002).toContain("a4012Boundary: 'OBSERVE_ONLY'");
  });

  it('SCHEDULED remains manifest eligibility only', () => {
    const production = [
      read('apps/server/api/src/services/digital-use-family-alliance-review.ts'),
      read('apps/server/api/src/services/digital-use-phone-contract-review.ts'),
      read('apps/server/api/src/services/digital-use-node-response.ts'),
    ].join('\n');
    expect(production).not.toMatch(/scheduled_at|schedule_trigger|enqueue|cron|notification/i);
    expect(production).toContain("entryMode.includes('USER_INITIATED')");
  });
});
