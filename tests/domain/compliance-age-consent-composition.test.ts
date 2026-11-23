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
const CONSENT_ID = '00000000-0000-7000-8000-0000000000c1';
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
    // These composition fixtures model self-use unless a test explicitly
    // separates actor and target. Actor eligibility and target protections are
    // distinct fields even when they refer to the same Person.
    actor: person,
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
    guardianConsentRecordId: null,
    guardianConsentVersion: null,
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
    guardianConsentRecordId: null,
    guardianConsentVersion: null,
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
    guardianConsentRecordId: CONSENT_ID,
    guardianConsentVersion: 1,
    guardianConsent: {
      id: CONSENT_ID,
      decision: 'GRANTED',
      boundPersonId: PERSON_ID,
      noticeHash: CURRENT_NOTICE_HASH,
      guardianPersonId: GUARDIAN_ID,
      version: 1,
      purpose: 'UNDER_14_GUARDIAN_CONSENT',
      noticeVersion: 'v1',
      policyVersion: 'v1',
      isChainHead: true,
      evidenceValid: true,
      ...overrides,
    },
    verifiedSource: 'GUARDIAN_RELAY',
    ...profileOverrides,
  };
}

/**
 * Build the same UNDER_14 person with an intentionally malformed consent object
 * so "field omitted" can be exercised without TypeScript filling a default.
 */
function personWithConsent(consent: unknown): CompliancePersonSnapshot {
  return {
    ...under14(),
    guardianConsent: consent as NonNullable<
      CompliancePersonSnapshot['guardianConsent']
    >,
  };
}

describe('compliance composition with existing person/guardian/consent truth', () => {  it('ADULT is never treated as minor', () => {
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

  it('SC-10: generic MINORS_BLOCKED blocks minor actors and spares adult actors', () => {
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

  describe('Finding #3: guardian consent snapshot authority completeness', () => {
    it('UNDER_14 with wrong-purpose consent fails closed as COMPLIANCE_GUARDIAN_CONSENT_INVALID', () => {
      const result = evaluateCompliance(
        snapshot(under14({ purpose: 'DIGITAL_USE_SUPPLEMENTAL_ASSESSMENT' }))
      );
      expect(result.gate).toBe('BLOCK');
      expect(result.reasonCode).toBe('COMPLIANCE_GUARDIAN_CONSENT_INVALID');
      expect(result.obligations).toContain('REQUIRE_GUARDIAN_CONSENT');
    });

    it('UNDER_14 with malformed evidence (evidenceValid: false) fails closed as COMPLIANCE_GUARDIAN_CONSENT_INVALID', () => {
      const result = evaluateCompliance(
        snapshot(under14({ evidenceValid: false }))
      );
      expect(result.gate).toBe('BLOCK');
      expect(result.reasonCode).toBe('COMPLIANCE_GUARDIAN_CONSENT_INVALID');
      expect(result.obligations).toContain('REQUIRE_GUARDIAN_CONSENT');
    });

    it('UNDER_14 with superseded consent (isChainHead: false) fails closed as COMPLIANCE_GUARDIAN_CONSENT_INVALID', () => {
      const result = evaluateCompliance(
        snapshot(under14({ isChainHead: false }))
      );
      expect(result.gate).toBe('BLOCK');
      expect(result.reasonCode).toBe('COMPLIANCE_GUARDIAN_CONSENT_INVALID');
      expect(result.obligations).toContain('REQUIRE_GUARDIAN_CONSENT');
    });

    it('UNDER_14 with revoked consent fails closed as COMPLIANCE_GUARDIAN_CONSENT_INVALID', () => {
      const result = evaluateCompliance(
        snapshot(under14({ decision: 'REVOKED' }))
      );
      expect(result.gate).toBe('BLOCK');
      expect(result.reasonCode).toBe('COMPLIANCE_GUARDIAN_CONSENT_INVALID');
      expect(result.obligations).toContain('REQUIRE_GUARDIAN_CONSENT');
    });

    it('a missing purpose can never satisfy the guardian gate', () => {
      const consent: Record<string, unknown> = { ...under14().guardianConsent! };
      delete consent['purpose'];
      const result = evaluateCompliance(snapshot(personWithConsent(consent)));
      expect(result.gate).toBe('BLOCK');
      expect(result.reasonCode).toBe('COMPLIANCE_GUARDIAN_CONSENT_INVALID');
    });

    it('an empty purpose string can never satisfy the guardian gate', () => {
      const result = evaluateCompliance(snapshot(under14({ purpose: '' })));
      expect(result.gate).toBe('BLOCK');
      expect(result.reasonCode).toBe('COMPLIANCE_GUARDIAN_CONSENT_INVALID');
    });

    it('unproven evidence (missing evidenceValid) fails closed', () => {
      const consent: Record<string, unknown> = { ...under14().guardianConsent! };
      delete consent['evidenceValid'];
      const result = evaluateCompliance(snapshot(personWithConsent(consent)));
      expect(result.gate).toBe('BLOCK');
      expect(result.reasonCode).toBe('COMPLIANCE_GUARDIAN_CONSENT_INVALID');
    });

    it('an unknown chain-head state (missing isChainHead) fails closed', () => {
      const consent: Record<string, unknown> = { ...under14().guardianConsent! };
      delete consent['isChainHead'];
      const result = evaluateCompliance(snapshot(personWithConsent(consent)));
      expect(result.gate).toBe('BLOCK');
      expect(result.reasonCode).toBe('COMPLIANCE_GUARDIAN_CONSENT_INVALID');
    });

    it('a profile pointer to a different consent record fails closed', () => {
      const result = evaluateCompliance(
        snapshot(
          under14({}, {
            guardianConsentRecordId: '00000000-0000-7000-8000-0000000000d1',
          })
        )
      );
      expect(result.gate).toBe('BLOCK');
      expect(result.reasonCode).toBe('COMPLIANCE_GUARDIAN_CONSENT_INVALID');
    });

    it('a profile consent version that is not the record version fails closed', () => {
      const result = evaluateCompliance(
        snapshot(under14({ version: 2 }, { guardianConsentVersion: 1 }))
      );
      expect(result.gate).toBe('BLOCK');
      expect(result.reasonCode).toBe('COMPLIANCE_GUARDIAN_CONSENT_INVALID');
    });

    it('a profile without a recorded consent version fails closed', () => {
      const result = evaluateCompliance(
        snapshot(under14({}, { guardianConsentVersion: null }))
      );
      expect(result.gate).toBe('BLOCK');
      expect(result.reasonCode).toBe('COMPLIANCE_GUARDIAN_CONSENT_REQUIRED');
    });

    it('a stale notice version label fails closed even with the current hash', () => {
      const result = evaluateCompliance(
        snapshot(under14({ noticeVersion: 'v0' }))
      );
      expect(result.gate).toBe('BLOCK');
      expect(result.reasonCode).toBe('COMPLIANCE_GUARDIAN_CONSENT_INVALID');
    });

    it('a consent recorded under another policy scope fails closed', () => {
      const result = evaluateCompliance(
        snapshot(under14({ policyVersion: 'v2' }))
      );
      expect(result.gate).toBe('BLOCK');
      expect(result.reasonCode).toBe('COMPLIANCE_GUARDIAN_CONSENT_INVALID');
    });

    it('an unbound consent (no subject) fails closed', () => {
      const result = evaluateCompliance(
        snapshot(under14({ boundPersonId: null }))
      );
      expect(result.gate).toBe('BLOCK');
      expect(result.reasonCode).toBe('COMPLIANCE_GUARDIAN_CONSENT_INVALID');
    });
  });
});