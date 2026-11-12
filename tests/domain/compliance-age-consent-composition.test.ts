/**
 * T1006 — Composition with the existing Person Compliance Profile, age band,
 * minor mode, guardian relationship and current guardian-consent gate.
 *
 * Frozen Scenarios 7–10. No second age/minor/guardian/consent truth is created:
 * every case is expressed through the existing profile/consent facts.
 */

import { describe, expect, it } from 'vitest';
import {
  createServerFeatureDescriptor,
  evaluateCompliance,
  getCurrentNoticeHash,
  type ComplianceEvaluationSnapshot,
  type ComplianceFeaturePolicyRecord,
  type CompliancePersonSnapshot,
} from '@xiaoshuyin/compliance';

const FEATURE = createServerFeatureDescriptor({
  featureCode: 'TEST_MINOR_COMPOSITION',
  featureContractRevision: 'v1',
  capabilityLabel: 'Minor composition capability',
});

const NOW = '2026-06-01T12:00:00.000Z';
const PERSON_ID = '00000000-0000-7000-8000-0000000000a1';
const GUARDIAN_ID = '00000000-0000-7000-8000-0000000000b1';
const CURRENT_NOTICE_HASH = getCurrentNoticeHash();

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
    effectiveFrom: '2026-01-01T00:00:00.000Z',
    effectiveUntil: null,
    ...overrides,
  };
}

function snapshot(
  person: CompliancePersonSnapshot | null,
  policyRow: ComplianceFeaturePolicyRecord = policy()
): ComplianceEvaluationSnapshot {
  return {
    feature: FEATURE,
    evaluatedAt: NOW,
    candidatePolicies: [policyRow],
    personProcessingRequired: true,
    person,
    currentNoticeHash: CURRENT_NOTICE_HASH,
  };
}

function adult(): CompliancePersonSnapshot {
  return {
    personId: PERSON_ID,
    ageBand: 'ADULT',
    minorMode: false,
    guardianPersonId: null,
    guardianConsent: null,
    verifiedSource: 'SELF_STATEMENT',
  };
}

function minor14(): CompliancePersonSnapshot {
  return {
    personId: PERSON_ID,
    ageBand: 'MINOR_14_17',
    minorMode: true,
    guardianPersonId: null,
    guardianConsent: null,
    verifiedSource: 'SELF_STATEMENT',
  };
}

function under14(
  overrides: Partial<NonNullable<CompliancePersonSnapshot['guardianConsent']>> = {},
  profileOverrides: Partial<CompliancePersonSnapshot> = {}
): CompliancePersonSnapshot {
  return {
    personId: PERSON_ID,
    ageBand: 'UNDER_14',
    minorMode: true,
    guardianPersonId: GUARDIAN_ID,
    guardianConsent: {
      id: '00000000-0000-7000-8000-0000000000c1',
      decision: 'GRANTED',
      boundPersonId: PERSON_ID,
      noticeHash: CURRENT_NOTICE_HASH,
      guardianPersonId: GUARDIAN_ID,
      version: 1,
      ...overrides,
    },
    verifiedSource: 'GUARDIAN_RELAY',
    ...profileOverrides,
  };
}

describe('compliance composition with existing person/guardian/consent truth', () => {
  it('ADULT is never treated as minor', () => {
    const result = evaluateCompliance(snapshot(adult()));
    expect(result.gate).toBe('ALLOW');
    expect(result.obligations).not.toContain('REQUIRE_MINOR_MODE');
    expect(result.obligations).not.toContain('REQUIRE_GUARDIAN_CONSENT');
  });

  it('SC-09: MINOR_14_17 keeps server-side minor mode without UNDER_14 consent', () => {
    const result = evaluateCompliance(snapshot(minor14()));
    expect(result.gate).toBe('ALLOW');
    expect(result.obligations).toContain('REQUIRE_MINOR_MODE');
    expect(result.reasonCode).toBeNull();
    // The UNDER_14 consent gate is not applied merely because of age.
    expect(result.reasonCode).not.toBe('COMPLIANCE_GUARDIAN_CONSENT_REQUIRED');
  });

  it('UNDER_14 with current valid guardian consent is allowed through the existing gate', () => {
    const result = evaluateCompliance(snapshot(under14()));
    expect(result.gate).toBe('ALLOW');
    expect(result.obligations).toContain('REQUIRE_MINOR_MODE');
    expect(result.obligations).toContain('REQUIRE_GUARDIAN_CONSENT');
  });

  it('SC-08: UNDER_14 missing consent fails closed with guardian-consent obligation', () => {
    const result = evaluateCompliance(snapshot(under14({}, { guardianConsent: null })));
    expect(result.gate).toBe('BLOCK');
    expect(result.reasonCode).toBe('COMPLIANCE_GUARDIAN_CONSENT_REQUIRED');
    expect(result.obligations).toContain('REQUIRE_GUARDIAN_CONSENT');
  });

  it('SC-08: revoked consent is invalid', () => {
    const result = evaluateCompliance(snapshot(under14({ decision: 'REVOKED' })));
    expect(result.gate).toBe('BLOCK');
    expect(result.reasonCode).toBe('COMPLIANCE_GUARDIAN_CONSENT_INVALID');
    expect(result.obligations).toContain('REQUIRE_GUARDIAN_CONSENT');
  });

  it('SC-08: subject mismatch is invalid', () => {
    const result = evaluateCompliance(
      snapshot(
        under14({ boundPersonId: '00000000-0000-7000-8000-0000000000ff' })
      )
    );
    expect(result.gate).toBe('BLOCK');
    expect(result.reasonCode).toBe('COMPLIANCE_GUARDIAN_CONSENT_INVALID');
  });

  it('SC-08: guardian identity mismatch cannot satisfy the gate', () => {
    const result = evaluateCompliance(
      snapshot(
        under14({ guardianPersonId: '00000000-0000-7000-8000-0000000000ee' })
      )
    );
    expect(result.gate).toBe('BLOCK');
    expect(result.reasonCode).toBe('COMPLIANCE_GUARDIAN_CONSENT_REQUIRED');
  });

  it('SC-08: stale notice hash is invalid', () => {
    const result = evaluateCompliance(
      snapshot(under14({ noticeHash: 'a'.repeat(64) }))
    );
    expect(result.gate).toBe('BLOCK');
    expect(result.reasonCode).toBe('COMPLIANCE_GUARDIAN_CONSENT_INVALID');
  });

  it('SC-07: age UNKNOWN blocks and never falls back to ADULT', () => {
    const result = evaluateCompliance(
      snapshot({ ...adult(), ageBand: 'UNKNOWN', minorMode: false })
    );
    expect(result.gate).toBe('BLOCK');
    expect(result.reasonCode).toBe('COMPLIANCE_AGE_UNKNOWN');
  });

  it('missing compliance profile blocks (no default adult path)', () => {
    const result = evaluateCompliance(snapshot(null));
    expect(result.gate).toBe('BLOCK');
    expect(result.reasonCode).toBe('COMPLIANCE_PROFILE_MISSING');
  });

  it('SC-10: generic MINORS_BLOCKED blocks both minor bands and spares adults', () => {
    const blockingPolicy = policy({ minorAccessRule: 'MINORS_BLOCKED' });

    for (const person of [minor14(), under14()]) {
      const result = evaluateCompliance(snapshot(person, blockingPolicy));
      expect(result.gate).toBe('BLOCK');
      expect(result.reasonCode).toBe('COMPLIANCE_FEATURE_BLOCKED');
    }

    const adultResult = evaluateCompliance(snapshot(adult(), blockingPolicy));
    expect(adultResult.gate).toBe('ALLOW');
  });

  it('feature policy can never relax the existing baseline consent gate', () => {
    // Even a permissive-looking policy row cannot make UNDER_14 without consent
    // pass; the baseline age gate runs before any feature-level rule.
    const result = evaluateCompliance(
      snapshot(under14({}, { guardianConsent: null }), policy({ minorAccessRule: 'BASELINE' }))
    );
    expect(result.gate).toBe('BLOCK');
    expect(result.reasonCode).toBe('COMPLIANCE_GUARDIAN_CONSENT_REQUIRED');
  });
});