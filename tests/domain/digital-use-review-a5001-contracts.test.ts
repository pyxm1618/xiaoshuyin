import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  A5001FamilyAllianceReviewResponse,
  CompleteDigitalUseNodeRequest,
} from '@xiaoshuyin/contracts';
import { IDEMPOTENCY_COMMAND_TYPES } from '@xiaoshuyin/domain';
import {
  resolveDigitalUseRuntimeNode,
  routeDigitalUseTopology,
} from '@xiaoshuyin/scenes/digital-use';

function dimension(state: 'UNKNOWN' | 'NOT_COLLECTED' | 'DECLINED') {
  return { state };
}

function validPayload() {
  return {
    kind: 'FAMILY_ALLIANCE_REVIEW' as const,
    familyDimensions: {
      emotionalSupport: { state: 'KNOWN' as const, note: 'More calm support was attempted.' },
      childVoiceNegotiation: dimension('UNKNOWN'),
      trust: dimension('DECLINED'),
      coordination: dimension('NOT_COLLECTED'),
      parentStability: { state: 'KNOWN' as const, note: 'Parent stayed more consistent.' },
      parentPromiseConsistency: dimension('UNKNOWN'),
    },
    targetEvaluations: [
      {
        targetCode: 'SLEEP' as const,
        expectedTargetRevision: 3,
        dimensions: {
          attempted: { state: 'KNOWN' as const, note: 'Tried on two evenings.' },
          partialOrNotAttempted: dimension('UNKNOWN'),
          barriers: dimension('DECLINED'),
          help: dimension('NOT_COLLECTED'),
          change: { state: 'KNOWN' as const, note: 'Bedtime conflict was shorter.' },
          adverseChange: dimension('UNKNOWN'),
          uncertainty: dimension('NOT_COLLECTED'),
        },
      },
    ],
    evidenceRefs: [],
  };
}

function syntheticScheduledTriggerFixture() {
  const node = resolveDigitalUseRuntimeNode('A5001');
  if (!node.entryMode.includes('SCHEDULED')) {
    throw new Error('A5001 manifest lost SCHEDULED eligibility');
  }
  return {
    testOnly: true as const,
    nodeCode: 'A5001' as const,
    entryMode: 'SCHEDULED' as const,
  };
}

describe('Slice 15 A5001 typed contract and negative space', () => {
  it('preserves the exact A5001 identity, dimensions and explicit unknown states', () => {
    const parsed = A5001FamilyAllianceReviewResponse.parse(validPayload());
    expect(parsed.kind).toBe('FAMILY_ALLIANCE_REVIEW');
    expect(parsed.familyDimensions.childVoiceNegotiation).toEqual({ state: 'UNKNOWN' });
    expect(parsed.familyDimensions.trust).toEqual({ state: 'DECLINED' });
    expect(parsed.familyDimensions.coordination).toEqual({ state: 'NOT_COLLECTED' });
    expect(parsed.targetEvaluations[0]!.dimensions.uncertainty).toEqual({
      state: 'NOT_COLLECTED',
    });
    expect(parsed).not.toHaveProperty('score');
    expect(parsed.targetEvaluations[0]).not.toHaveProperty('score');
  });

  it('rejects A5002/Contract semantics, universal scoring and extra authority fields', () => {
    expect(
      A5001FamilyAllianceReviewResponse.safeParse({
        ...validPayload(),
        kind: 'PHONE_USE_CONTRACT_REVIEW',
      }).success
    ).toBe(false);
    expect(
      A5001FamilyAllianceReviewResponse.safeParse({
        ...validPayload(),
        universalScore: 92,
      }).success
    ).toBe(false);
    expect(
      A5001FamilyAllianceReviewResponse.safeParse({
        ...validPayload(),
        contractVersionId: '00000000-0000-7000-8000-000000000001',
      }).success
    ).toBe(false);
    expect(
      A5001FamilyAllianceReviewResponse.safeParse({
        ...validPayload(),
        stream: 'FAMILY_ALLIANCE_REVIEW',
      }).success
    ).toBe(false);
  });

  it('requires the full frozen semantic dimension set and unique selected-target evaluations', () => {
    const missing = validPayload();
    const { uncertainty: _omitted, ...targetDimensions } =
      missing.targetEvaluations[0]!.dimensions;
    expect(
      A5001FamilyAllianceReviewResponse.safeParse({
        ...missing,
        targetEvaluations: [
          { ...missing.targetEvaluations[0], dimensions: targetDimensions },
        ],
      }).success
    ).toBe(false);

    expect(
      A5001FamilyAllianceReviewResponse.safeParse({
        ...validPayload(),
        targetEvaluations: [
          validPayload().targetEvaluations[0],
          validPayload().targetEvaluations[0],
        ],
      }).success
    ).toBe(false);
  });

  it('keeps node/stream/scheduled authority server-owned at the existing Scene API', () => {
    const base = {
      expectedCaseVersion: 1,
      expectedNodeRevision: 0,
      expectedScenePackageVersion: 'v1',
      expectedSelectionRevision: 1,
      response: validPayload(),
    };
    expect(CompleteDigitalUseNodeRequest.safeParse(base).success).toBe(true);
    for (const extra of [
      { nextNode: 'A5002' },
      { stream: 'FAMILY_ALLIANCE_REVIEW' },
      { subjectId: 'client-owned' },
      { entryMode: 'SCHEDULED' },
      { scheduled: true },
    ]) {
      expect(
        CompleteDigitalUseNodeRequest.safeParse({ ...base, ...extra }).success
      ).toBe(false);
    }
  });

  it('keeps SCHEDULED as test-only future eligibility, not production trigger truth', () => {
    expect(syntheticScheduledTriggerFixture()).toEqual({
      testOnly: true,
      nodeCode: 'A5001',
      entryMode: 'SCHEDULED',
    });
  });

  it('uses the sole manifest/routing owner and exact REVIEW_COMPLETE semantics', () => {
    const node = resolveDigitalUseRuntimeNode('A5001');
    expect(node).toMatchObject({
      nodeCode: 'A5001',
      stream: 'FAMILY_ALLIANCE_REVIEW',
      role: 'FAMILY_ALLIANCE_REVIEW',
    });
    expect(node.entryMode).toEqual(
      expect.arrayContaining(['USER_INITIATED', 'SCHEDULED'])
    );
    expect(node.helpOrReentryRefs).toContain('USER_TIMELINE_REVIEW');

    const route = routeDigitalUseTopology({
      sceneCode: 'DIGITAL_USE',
      packageVersion: 'v1',
      currentNodeCode: 'A5001',
      conditions: { FAMILY_ALLIANCE_REVIEW_COMPLETE: true },
    });
    expect(route).toMatchObject({
      kind: 'TERMINAL_ROUTE',
      terminalCode: 'REVIEW_COMPLETE',
      reasonCode: 'FAMILY_ALLIANCE_REVIEW_COMPLETE',
    });
  });

  it('reuses the existing idempotency vocabulary instead of creating a private A5001 ledger', () => {
    expect(IDEMPOTENCY_COMMAND_TYPES).toContain('DIGITAL_USE_NODE_RESPONSE');
    expect(IDEMPOTENCY_COMMAND_TYPES).not.toContain('DIGITAL_USE_A5001_REVIEW');
  });

  it('contains no blocked-stream dependency, generic Review API, scheduler or AI authority', () => {
    const root = process.cwd();
    const service = readFileSync(
      join(root, 'apps/server/api/src/services/digital-use-family-alliance-review.ts'),
      'utf8'
    );
    expect(service).not.toMatch(/digital-use-phone-use-contract/);
    expect(service).not.toMatch(/@openai|openai\b|pg-boss|node-cron/i);
    expect(service).not.toMatch(/INSERT\s+INTO\s+(?:reviews|review_results|outcomes|plans|tasks|checkins|notifications)/i);

    const routes = readdirSync(join(root, 'apps/server/api/src/routes'));
    expect(routes).not.toContain('reviews.ts');
    expect(routes).not.toContain('digital-use-reviews.ts');

    const migrations = readdirSync(join(root, 'db/migrations'));
    expect(migrations).toContain('018_digital_use_review_runtime.sql');
    const migration = readFileSync(
      join(root, 'db/migrations/018_digital_use_review_runtime.sql'),
      'utf8'
    );
    expect(migration).not.toMatch(/CREATE\s+TABLE|CREATE\s+POLICY|PHONE_USE_CONTRACT|A5002/i);
    expect(migration).toContain('DIGITAL_USE_A5001_EFFECT_EVALUATION');
    expect(migration).toContain('A5001');
  });
});
