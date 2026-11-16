import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');

const a5001Service = read(
  'apps/server/api/src/services/digital-use-family-alliance-review.ts'
);
const a5002Service = read(
  'apps/server/api/src/services/digital-use-phone-contract-review.ts'
);
const phoneGates = read(
  'apps/server/api/src/services/digital-use-phone-contract-gates.ts'
);
const nodeResponse = read(
  'apps/server/api/src/services/digital-use-node-response.ts'
);
const route = read('apps/server/api/src/routes/digital-use-assessment.ts');
const contracts = read(
  'packages/contracts/src/digital-use-assessment-schemas.ts'
);
const reviewSchemas = read(
  'packages/contracts/src/digital-use-review-schemas.ts'
);
const migration = read('db/migrations/022_digital_use_review_runtime.sql');

const acceptanceFiles = [
  'tests/integration/digital-use-a5001-review-runtime.test.ts',
  'tests/integration/digital-use-a5002-review-runtime.test.ts',
  'tests/domain/digital-use-review-a5001-contracts.test.ts',
  'tests/domain/digital-use-review-slice15-closeout.test.ts',
] as const;

function expandAcceptanceMarkers(text: string): Set<number> {
  const out = new Set<number>();
  for (const match of text.matchAll(/AS-([0-9]{2}(?:[/-][0-9]{2})*)/g)) {
    for (const token of match[1]!.split('/')) {
      if (token.includes('-')) {
        const [rawStart, rawEnd] = token.split('-');
        const start = Number(rawStart);
        const end = Number(rawEnd);
        for (let n = start; n <= end; n += 1) out.add(n);
      } else {
        out.add(Number(token));
      }
    }
  }
  return out;
}

const FR_TO_AS: Record<number, readonly number[]> = {
  1: [1, 2], 2: [5, 6], 3: [1], 4: [2], 5: [67], 6: [67],
  7: [57, 58], 8: [60], 9: [1, 2], 10: [65, 70],
  11: [3, 4], 12: [3, 4], 13: [3, 4], 14: [1, 2], 15: [68],
  16: [47, 48, 49], 17: [1], 18: [1], 19: [1], 20: [20],
  21: [23], 22: [16, 17, 18, 19], 23: [5, 57], 24: [2, 24],
  25: [2], 26: [24, 27], 27: [27, 28, 29], 28: [27, 28],
  29: [6, 58], 30: [51, 52], 31: [53, 55], 32: [53],
  33: [53], 34: [54, 63, 64], 35: [50, 56], 36: [13, 14, 15, 30, 31],
  37: [34], 38: [33], 39: [32], 40: [15], 41: [37, 38, 39],
  42: [42, 43], 43: [40, 41], 44: [44, 45], 45: [47, 48, 49],
  46: [44], 47: [65, 70], 48: [66], 49: [69], 50: [59, 60, 61, 62, 63, 64],
};

function gitBlobSha(content: string): string {
  const bytes = Buffer.from(content, 'utf8');
  return createHash('sha1')
    .update(`blob ${bytes.length}\0`)
    .update(bytes)
    .digest('hex');
}

describe('Slice 15 T1517 deterministic closeout coverage', () => {
  it('FR Coverage: 50/50 maps every Frozen functional requirement to executable AS evidence', () => {
    const keys = Object.keys(FR_TO_AS).map(Number).sort((a, b) => a - b);
    expect(keys).toEqual(Array.from({ length: 50 }, (_, i) => i + 1));

    const covered = new Set<number>();
    for (const path of acceptanceFiles) {
      for (const n of expandAcceptanceMarkers(read(path))) covered.add(n);
    }
    for (const [fr, scenarios] of Object.entries(FR_TO_AS)) {
      expect(scenarios.length, `FR-${fr} has no acceptance evidence`).toBeGreaterThan(0);
      for (const scenario of scenarios) {
        expect(
          covered.has(scenario),
          `FR-${fr} references missing AS-${String(scenario).padStart(2, '0')}`
        ).toBe(true);
      }
    }
  });

  it('Acceptance Coverage: 70/70 has no missing or out-of-range scenario marker', () => {
    const covered = new Set<number>();
    for (const path of acceptanceFiles) {
      for (const n of expandAcceptanceMarkers(read(path))) covered.add(n);
    }
    expect([...covered].filter((n) => n < 1 || n > 70)).toEqual([]);
    expect([...covered].sort((a, b) => a - b)).toEqual(
      Array.from({ length: 70 }, (_, i) => i + 1)
    );
  });

  it('NS-01-28 / AS-57-69 repository negative-space guards remain mechanically closed', () => {
    const productionReview = [
      a5001Service,
      a5002Service,
      phoneGates,
      nodeResponse,
      route,
      reviewSchemas,
    ].join('\n');
    const routeFiles = readdirSync(join(root, 'apps/server/api/src/routes'));

    const completeStart = contracts.indexOf(
      'export const CompleteDigitalUseNodeRequest'
    );
    const completeEnd = contracts.indexOf(
      'export type CompleteDigitalUseNodeRequestType',
      completeStart
    );
    const completeContract = contracts.slice(completeStart, completeEnd);

    const checks: Array<[string, () => void]> = [
      ['NS-01 generic Review domain owner', () => {
        expect(productionReview).not.toMatch(/class\s+Review\b|interface\s+ReviewAggregate\b/);
      }],
      ['NS-02 reviews table/repository/API', () => {
        expect(migration).not.toMatch(/CREATE\s+TABLE/i);
        expect(routeFiles).not.toContain('reviews.ts');
        expect(routeFiles).not.toContain('digital-use-reviews.ts');
      }],
      ['NS-03 CASE_OVERALL Review', () => {
        expect(productionReview).not.toContain('CASE_OVERALL');
      }],
      ['NS-04 Outcome write', () => {
        expect(productionReview).not.toMatch(/INSERT\s+INTO\s+outcomes\b/i);
      }],
      ['NS-05 Plan Task Checkin write', () => {
        expect(productionReview).not.toMatch(/INSERT\s+INTO\s+(plans|tasks|checkins)\b/i);
      }],
      ['NS-06 Follow-up Schedule write', () => {
        expect(productionReview).not.toMatch(/INSERT\s+INTO\s+followup_?schedules?\b/i);
      }],
      ['NS-07 scheduler/cron/pg-boss', () => {
        expect(productionReview).not.toMatch(/pg-boss|node-cron|cron\.schedule/i);
      }],
      ['NS-08 notification/delivery truth', () => {
        expect(productionReview).not.toMatch(/INSERT\s+INTO\s+notifications?\b|delivery_status/i);
      }],
      ['NS-09 questionnaire/form builder', () => {
        expect(productionReview).not.toMatch(/questionnaire|form[_ -]?builder/i);
      }],
      ['NS-10 generic scoring engine', () => {
        expect(productionReview).not.toMatch(/universalScore|effectivenessScore|successPercentage/i);
      }],
      ['NS-11 AI evaluator authority', () => {
        expect(productionReview).not.toMatch(/@openai|\bopenai\b|anthropic|generateText|model_ref/i);
      }],
      ['NS-12 second node manifest/registry', () => {
        expect(a5001Service + a5002Service).not.toMatch(/const\s+digitalUseNodeManifest\b|new\s+Map\([^)]*A500[12]/);
      }],
      ['NS-13 second routing table', () => {
        expect(a5001Service + a5002Service).not.toContain('allowedNext');
        expect(a5001Service + a5002Service).toContain('routeDigitalUseTopology');
      }],
      ['NS-14 numeric next-node inference', () => {
        expect(a5001Service + a5002Service).not.toMatch(/parseInt\([^)]*node|charCodeAt\(|nodeCode\s*\+\s*1/i);
      }],
      ['NS-15 client-authoritative node/stream/route', () => {
        expect(completeContract).not.toMatch(/nextNode|\bstream\b|entryMode|scheduled/i);
      }],
      ['NS-16 second Scene owner', () => {
        expect(migration).not.toMatch(/CREATE\s+TABLE/i);
        expect(a5001Service + a5002Service).toContain('insertSceneArtifact');
        expect(a5001Service + a5002Service).toContain('casCompleteSceneNodeState');
      }],
      ['NS-17 second Evidence store', () => {
        expect(migration).not.toMatch(/assertions|observations|dialogue_messages/i);
        expect(a5001Service + a5002Service).toContain('recordStatement');
      }],
      ['NS-18 second control-plane owner', () => {
        expect(migration).not.toMatch(/CREATE\s+POLICY|consent|compliance|safety|authorization/i);
        expect(a5001Service + a5002Service).toContain('assertOrdinaryProgressionAllowedRaw');
      }],
      ['NS-19 second idempotency/audit system', () => {
        expect(migration).not.toMatch(/idempotency|business_audit_events|case_events/i);
        expect(nodeResponse).toContain('runIdempotentCommandInTransaction');
      }],
      ['NS-20 destructive history overwrite', () => {
        expect(a5001Service).toContain('supersedesId');
        expect(a5002Service).toContain('supersedesId');
        expect(a5001Service + a5002Service).not.toMatch(/UPDATE\s+scene_artifacts/i);
      }],
      ['NS-21 A5001/A5002 semantic collapse', () => {
        expect(reviewSchemas).toContain('FAMILY_ALLIANCE_REVIEW');
        expect(reviewSchemas).toContain('PHONE_USE_CONTRACT_REVIEW');
        expect(reviewSchemas).toContain('DIGITAL_USE_A5001_EFFECT_EVALUATION');
        expect(reviewSchemas).toContain('DIGITAL_USE_A5002_EFFECT_EVALUATION');
      }],
      ['NS-22 A5001 auto-completes A5002', () => {
        expect(a5001Service).not.toContain('DIGITAL_USE_A5002_EFFECT_EVALUATION');
        expect(a5001Service).not.toMatch(/nodeCode:\s*'A5002'/);
      }],
      ['NS-23 A5002 executes A4012', () => {
        expect(a5002Service).not.toMatch(/revisePhoneUseContract|activatePhoneUseContract|supersedePhoneUseContract/);
        expect(a5002Service).not.toMatch(/nodeCode:\s*'A4012'/);
      }],
      ['NS-24 fake scheduled execution', () => {
        expect(route).toContain("params.nodeCode === 'A5002'");
        expect(route).toContain('DEPENDENCY_UNAVAILABLE');
        expect(productionReview).not.toMatch(/schedule_trigger_id|scheduled_at/i);
      }],
      ['NS-25 fake notification', () => {
        expect(productionReview).not.toMatch(/sendNotification|notificationAdapter|enqueueNotification/i);
      }],
      ['NS-26 fake child input', () => {
        expect(a5001Service).toContain('sourcePersonId: input.actor.personId');
        expect(a5002Service).toContain('sourcePersonId: input.actor.personId');
      }],
      ['NS-27 Phase 3/4 implementation pulled forward', () => {
        expect(a5001Service + a5002Service).not.toMatch(/@xiaoshuyin\/(ai|rag|plans|outcomes)|vector|embedding/i);
      }],
      ['NS-28 Docs/frozen upstream mutation', () => {
        const baseline = '67d20ca2dab892b480184261be47997d90a0b2f2';
        const changed = execFileSync(
          'git',
          ['diff', '--name-only', baseline, 'HEAD', '--', 'Docs', 'specs/008-problem-formulation-core', 'specs/009-safety-hold-control-foundation', 'specs/010-compliance-feature-policy-foundation', 'specs/011-digital-use-node-manifest-routing-foundation', 'specs/012-digital-use-assessment-runtime', 'specs/013-digital-use-family-alliance-runtime', 'specs/014-digital-use-phone-use-contract-runtime'],
          { cwd: root, encoding: 'utf8' }
        ).trim();
        expect(changed).toBe('');

        const frozen = [
          ['specs/015-digital-use-review-runtime/spec.md', '0c6e9dd80fa74734d641ad9ff7b4b66ba3930801'],
          ['specs/015-digital-use-review-runtime/plan.md', '142aa099628b51341e59bcfa15fa30643df127fc'],
          ['specs/015-digital-use-review-runtime/checklist.md', 'ba3cc4ab135502289e7f8720fee66e089fed9316'],
          ['specs/015-digital-use-review-runtime/tasks.md', 'b1d8ecbf98aff0e5f42c7f9af67da0009b4618d6'],
        ] as const;
        for (const [path, expected] of frozen) {
          expect(gitBlobSha(read(path)), path).toBe(expected);
        }
      }],
    ];

    expect(checks.map(([id]) => id.match(/^NS-(\d{2})/)?.[1])).toEqual(
      Array.from({ length: 28 }, (_, i) => String(i + 1).padStart(2, '0'))
    );
    for (const [, check] of checks) check();
  });
});
