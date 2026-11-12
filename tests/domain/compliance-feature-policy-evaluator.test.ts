/**
 * T1005 — Pure deterministic policy selection / evaluation / obligations.
 *
 * Frozen Scenarios 1–5, 10–12, 14–15 (domain level) plus malformed-policy and
 * capability-unavailable fail-closed behavior.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  assertComplianceObligationsSupported,
  createServerFeatureDescriptor,
  evaluateCompliance,
  type ComplianceEvaluationSnapshot,
  type ComplianceFeaturePolicyRecord,
  type CompliancePersonSnapshot,
} from '@xiaoshuyin/compliance';

const FEATURE = createServerFeatureDescriptor({
  featureCode: 'TEST_POLICY_CORE',
  featureContractRevision: 'v1',
  capabilityLabel: 'Test policy capability',
});

const NOW = '2026-06-01T12:00:00.000Z';
const OPEN_START = '2026-01-01T00:00:00.000Z';

function policy(
  overrides: Partial<ComplianceFeaturePolicyRecord> = {}
): ComplianceFeaturePolicyRecord {
  return {
    policyId: '00000000-0000-7000-8000-000000000001',
    featureCode: FEATURE.featureCode,
    featureContractRevision: FEATURE.featureContractRevision,
    policyVersion: 1,
    anthropomorphicApplicability: 'NOT_APPLICABLE',
    minorAccessRule: 'BASELINE',
    aiDisclosureRule: 'BASELINE',
    generatedContentLabelRule: 'BASELINE',
    usageReminderRule: 'BASELINE',
    effectiveFrom: OPEN_START,
    effectiveUntil: null,
    ...overrides,
  };
}

function snapshot(
  candidatePolicies: readonly ComplianceFeaturePolicyRecord[],
  overrides: Partial<ComplianceEvaluationSnapshot> = {}
): ComplianceEvaluationSnapshot {
  return {
    feature: FEATURE,
    evaluatedAt: NOW,
    candidatePolicies,
    personProcessingRequired: false,
    person: null,
    currentNoticeHash: 'f'.repeat(64),
    ...overrides,
  };
}

const ADULT: CompliancePersonSnapshot = {
  personId: '00000000-0000-7000-8000-0000000000a1',
  ageBand: 'ADULT',
  minorMode: false,
  guardianPersonId: null,
  guardianConsent: null,
  verifiedSource: 'SELF_STATEMENT',
};

describe('pure compliance feature-policy evaluator', () => {
  it('SC-01: NOT_APPLICABLE returns exact provenance and no anthropomorphic obligation', () => {
    const selected = policy();
    const result = evaluateCompliance(snapshot([selected]));

    expect(result.gate).toBe('ALLOW');
    expect(result.reasonCode).toBeNull();
    expect(result.obligations).toEqual([]);
    expect(result.policyId).toBe(selected.policyId);
    expect(result.policyVersion).toBe(1);
    expect(result.applicability).toBe('NOT_APPLICABLE');
    expect(result.featureCode).toBe(FEATURE.featureCode);
    expect(result.featureContractRevision).toBe(FEATURE.featureContractRevision);
    expect(result.evaluatedAt).toBe(NOW);
    expect(result.effectiveFrom).toBe(OPEN_START);
    expect(result.effectiveUntil).toBeNull();
  });

  it('SC-02: REQUIRED emits AI disclosure and usage-reminder obligations', () => {
    const result = evaluateCompliance(
      snapshot([
        policy({
          anthropomorphicApplicability: 'REQUIRED',
          aiDisclosureRule: 'REQUIRED',
          usageReminderRule: 'REQUIRED',
        }),
      ])
    );

    expect(result.gate).toBe('ALLOW');
    expect(result.obligations).toContain('REQUIRE_AI_DISCLOSURE');
    expect(result.obligations).toContain('REQUIRE_USAGE_REMINDER');
  });

  it('SC-02 / SC-11: REQUIRED on a minor composes minor mode, AI disclosure, label and usage reminder', () => {
    const minor = {
      ...ADULT,
      ageBand: 'MINOR_14_17' as const,
      minorMode: true,
    };

    const result = evaluateCompliance(
      snapshot(
        [
          policy({
            anthropomorphicApplicability: 'REQUIRED',
            aiDisclosureRule: 'REQUIRED',
            generatedContentLabelRule: 'REQUIRED',
            usageReminderRule: 'REQUIRED',
          }),
        ],
        { personProcessingRequired: true, person: minor }
      )
    );

    expect(result.gate).toBe('ALLOW');
    expect(result.obligations).toEqual([
      'REQUIRE_MINOR_MODE',
      'REQUIRE_AI_DISCLOSURE',
      'REQUIRE_GENERATED_CONTENT_LABEL',
      'REQUIRE_USAGE_REMINDER',
    ]);
  });

  it('SC-03: UNKNOWN fails closed and is never NOT_APPLICABLE/ALLOW', () => {
    const result = evaluateCompliance(
      snapshot([policy({ anthropomorphicApplicability: 'UNKNOWN' })])
    );

    expect(result.gate).toBe('BLOCK');
    expect(result.reasonCode).toBe('COMPLIANCE_APPLICABILITY_UNKNOWN');
    expect(result.obligations).toContain('REQUIRE_REGULATORY_EVIDENCE');
    expect(result.applicability).toBe('UNKNOWN');
  });

  it('SC-04: missing / future-only / expired-only all fail closed as POLICY_MISSING', () => {
    const cases: readonly (readonly ComplianceFeaturePolicyRecord[])[] = [
      [],
      [policy({ effectiveFrom: '2026-07-01T00:00:00.000Z' })],
      [policy({ effectiveUntil: '2026-05-31T00:00:00.000Z' })],
      [policy({ effectiveFrom: OPEN_START, effectiveUntil: OPEN_START })],
    ];

    for (const candidates of cases) {
      const result = evaluateCompliance(snapshot(candidates));
      expect(result.gate).toBe('BLOCK');
      expect(result.reasonCode).toBe('COMPLIANCE_POLICY_MISSING');
      expect(result.policyId).toBeNull();
      expect(result.applicability).toBeNull();
    }
  });

  it('SC-05: two simultaneously effective policies fail closed as ambiguous', () => {
    const result = evaluateCompliance(
      snapshot([
        policy({ policyId: '00000000-0000-7000-8000-00000000000a' }),
        policy({ policyId: '00000000-0000-7000-8000-00000000000b', policyVersion: 2 }),
      ])
    );

    expect(result.gate).toBe('BLOCK');
    expect(result.reasonCode).toBe('COMPLIANCE_POLICY_AMBIGUOUS');
    expect(result.policyId).toBeNull();
  });

  it('does not select an expired row when a current row exists (half-open boundary)', () => {
    const result = evaluateCompliance(
      snapshot([
        policy({
          policyId: '00000000-0000-7000-8000-00000000000c',
          policyVersion: 1,
          effectiveUntil: NOW,
        }),
        policy({
          policyId: '00000000-0000-7000-8000-00000000000d',
          policyVersion: 2,
          effectiveFrom: NOW,
        }),
      ])
    );

    expect(result.gate).toBe('ALLOW');
    expect(result.policyVersion).toBe(2);
  });

  it('SC-14: returns the exact effective version and never mutates earlier provenance', () => {
    const v1 = policy({ policyVersion: 1, effectiveUntil: NOW });
    const v2 = policy({ policyId: '00000000-0000-7000-8000-0000000000e2', policyVersion: 2, effectiveFrom: NOW });

    const before = evaluateCompliance(snapshot([v1, v2], { evaluatedAt: '2026-05-01T00:00:00.000Z' }));
    expect(before.gate).toBe('ALLOW');
    expect(before.policyVersion).toBe(1);

    const after = evaluateCompliance(snapshot([v1, v2], { evaluatedAt: NOW }));
    expect(after.policyVersion).toBe(2);
    expect(before.policyVersion).toBe(1);
  });

  it('malformed / internally incoherent policy rows fail closed as POLICY_INVALID', () => {
    const malformed = [
      policy({ anthropomorphicApplicability: 'REQUIRED', aiDisclosureRule: 'BASELINE', usageReminderRule: 'REQUIRED' }),
      policy({ anthropomorphicApplicability: 'NOT_APPLICABLE', usageReminderRule: 'REQUIRED' }),
      policy({ anthropomorphicApplicability: 'MAYBE' as never }),
      policy({ minorAccessRule: 'ALLOW_ALL' as never }),
      policy({ policyVersion: 0 }),
    ];

    for (const row of malformed) {
      const result = evaluateCompliance(snapshot([row]));
      expect(result.gate).toBe('BLOCK');
      expect(result.reasonCode).toBe('COMPLIANCE_POLICY_INVALID');
    }
  });

  it('is deterministic for identical snapshot and evaluation time (no clock/model/network)', () => {
    const value = policy({
      anthropomorphicApplicability: 'REQUIRED',
      aiDisclosureRule: 'REQUIRED',
      usageReminderRule: 'REQUIRED',
      minorAccessRule: 'MINORS_BLOCKED',
    });

    const first = evaluateCompliance(snapshot([value], { personProcessingRequired: true, person: ADULT }));
    const second = evaluateCompliance(snapshot([value], { personProcessingRequired: true, person: ADULT }));

    expect(first).toEqual(second);
  });

  it('SC-12 / capability guard: a required unsupported obligation fails closed', () => {
    const result = evaluateCompliance(
      snapshot([
        policy({
          anthropomorphicApplicability: 'REQUIRED',
          aiDisclosureRule: 'REQUIRED',
          usageReminderRule: 'REQUIRED',
        }),
      ])
    );

    expect(result.gate).toBe('ALLOW');

    const blocked = assertComplianceObligationsSupported(result, [
      'REQUIRE_AI_DISCLOSURE',
      'REQUIRE_GENERATED_CONTENT_LABEL',
      'REQUIRE_MINOR_MODE',
      'REQUIRE_GUARDIAN_CONSENT',
      'REQUIRE_SEPARATE_CONSENT',
      'REQUIRE_REGULATORY_EVIDENCE',
    ]);

    expect(blocked.gate).toBe('BLOCK');
    expect(blocked.reasonCode).toBe('COMPLIANCE_CAPABILITY_UNAVAILABLE');
    expect(blocked.obligations).toContain('REQUIRE_USAGE_REMINDER');
  });

  it('capability guard keeps supported obligations allowed and preserves existing BLOCK', () => {
    const allowed = evaluateCompliance(snapshot([policy()]));
    expect(assertComplianceObligationsSupported(allowed, []).gate).toBe('ALLOW');

    const unknown = evaluateCompliance(
      snapshot([policy({ anthropomorphicApplicability: 'UNKNOWN' })])
    );
    expect(assertComplianceObligationsSupported(unknown, []).reasonCode).toBe(
      'COMPLIANCE_APPLICABILITY_UNKNOWN'
    );
  });

  it('evaluator source contains no clock / network / model import', () => {
    const source = readFileSync(
      join(process.cwd(), 'packages', 'compliance', 'src', 'feature-policy.ts'),
      'utf-8'
    );
    for (const forbidden of [
      'Date.now(',
      "from 'node:http'",
      "from 'node:net'",
      'fetch(',
      'openai',
      'anthropic',
      'embedding',
    ]) {
      expect(source.includes(forbidden), forbidden).toBe(false);
    }
  });
});