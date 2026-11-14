/**
 * Slice 1 Consent Owner — 01004 narrow post-merge remediation.
 *
 * Contract-level boundary: the internal authoritative vocabulary knows the
 * supplemental purpose, while the frozen public guardian contract does not.
 */

import { describe, expect, it } from 'vitest';
import {
  ConsentDecision,
  ConsentPurpose,
  ConsentRecord,
  GuardianConsentDecision,
  GuardianConsentPurpose,
  Notice,
  SupplementalAssessmentConsentEvidence,
  ConsentEvidence,
} from '@xiaoshuyin/contracts';
import { buildSupplementalAssessmentConsentEvidence } from '../../packages/compliance/src/evidence.js';

const sha = (char: string) => char.repeat(64);

describe('Consent internal/public vocabulary boundary', () => {
  it('internal purpose vocabulary contains exactly the two approved purposes', () => {
    expect(ConsentPurpose.options).toEqual([
      'UNDER_14_GUARDIAN_CONSENT',
      'DIGITAL_USE_SUPPLEMENTAL_ASSESSMENT',
    ]);
  });

  it('DECLINED exists internally but never in the guardian decision contract', () => {
    expect(ConsentDecision.options).toEqual(['GRANTED', 'DECLINED', 'REVOKED']);
    expect(GuardianConsentDecision.options).toEqual(['GRANTED', 'REVOKED']);
    expect(GuardianConsentDecision.safeParse('DECLINED').success).toBe(false);
    expect(GuardianConsentPurpose.safeParse('DIGITAL_USE_SUPPLEMENTAL_ASSESSMENT').success)
      .toBe(false);
  });

  it('the public ConsentRecord / Notice projections stay guardian-only', () => {
    const record = {
      id: crypto.randomUUID(),
      purpose: 'DIGITAL_USE_SUPPLEMENTAL_ASSESSMENT',
      decision: 'GRANTED',
      version: 1,
      decidedAt: new Date().toISOString(),
    };
    expect(ConsentRecord.safeParse(record).success).toBe(false);
    expect(
      Notice.safeParse({
        version: 'v1',
        hash: sha('a'),
        title: 'x',
        purpose: 'DIGITAL_USE_SUPPLEMENTAL_ASSESSMENT',
        effectiveAt: new Date().toISOString(),
      }).success
    ).toBe(false);
  });

  it('supplemental evidence is purpose-discriminated and rejects guardian shape', () => {
    const supplemental = {
      evidence_kind: 'DIGITAL_USE_SUPPLEMENTAL_ASSESSMENT',
      purpose: 'DIGITAL_USE_SUPPLEMENTAL_ASSESSMENT',
      disclosure_reference: 'test-only-01004-disclosure-fixture',
      disclosure_version: 'v1',
      disclosure_hash: sha('a'),
      confirmation_statement_hash: sha('b'),
      decision: 'DECLINED',
      decision_actor_person_id: crypto.randomUUID(),
      case_id: crypto.randomUUID(),
      decided_at: new Date().toISOString(),
      client_ip_hash: sha('c'),
      user_agent_hash: sha('d'),
    };
    expect(SupplementalAssessmentConsentEvidence.safeParse(supplemental).success).toBe(true);

    const guardian = {
      channel: 'TEST',
      accepted_text_hash: sha('a'),
      declared_age_band: 'UNDER_14',
      client_ip_hash: sha('c'),
      user_agent_hash: sha('d'),
    };
    expect(SupplementalAssessmentConsentEvidence.safeParse(guardian).success).toBe(false);
    expect(ConsentEvidence.safeParse(supplemental).success).toBe(false);
  });

  it('evidence builder stores only HMAC digests (no raw IP / User-Agent)', () => {
    const evidence = buildSupplementalAssessmentConsentEvidence({
      decision: 'GRANTED',
      decisionActorPersonId: crypto.randomUUID(),
      caseId: crypto.randomUUID(),
      disclosureReference: 'test-only-01004-disclosure-fixture',
      disclosureVersion: 'v1',
      disclosureHash: sha('a'),
      confirmationStatementHash: sha('b'),
      decidedAt: new Date('2026-11-12T00:00:00.000Z'),
      clientIp: '198.51.100.9',
      userAgent: 'raw-agent/9.9',
      pepper: 'domain-test-pepper',
    });
    expect(evidence.client_ip_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(evidence.user_agent_hash).toMatch(/^[0-9a-f]{64}$/);
    const serialized = JSON.stringify(evidence);
    expect(serialized).not.toContain('198.51.100.9');
    expect(serialized).not.toContain('raw-agent');
  });
});