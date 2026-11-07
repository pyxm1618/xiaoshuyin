/**
 * HIGH-02: ConsentEvidence typed contract tests.
 *
 * The evidence object is generated and validated by the SAME Zod schema
 * (`ConsentEvidence`) that guards JSON storage (contracts/consent-onboarding.md §4).
 */

import { describe, it, expect } from 'vitest';
import { createHmac } from 'node:crypto';
import { ConsentEvidence } from '../../packages/contracts/src/schemas.js';
import {
  buildConsentEvidence,
  hmacSha256Hex,
} from '../../packages/compliance/src/evidence.js';
import {
  getAcceptanceTextHash,
  getRevocationTextHash,
  getNoticeHash,
} from '../../packages/compliance/src/notices.js';

const PEPPER = 'unit-test-evidence-pepper-value';

describe('ConsentEvidence schema', () => {
  it('accepts exactly the frozen five-field shape', () => {
    const parsed = ConsentEvidence.parse({
      channel: 'MINIPROGRAM',
      accepted_text_hash: 'a'.repeat(64),
      declared_age_band: 'UNDER_14',
      client_ip_hash: 'b'.repeat(64),
      user_agent_hash: 'c'.repeat(64),
    });
    expect(Object.keys(parsed).sort()).toEqual(
      ['accepted_text_hash', 'channel', 'client_ip_hash', 'declared_age_band', 'user_agent_hash']
    );
  });

  it('rejects unknown extra fields (no free-form jsonb)', () => {
    expect(() =>
      ConsentEvidence.parse({
        channel: 'MINIPROGRAM',
        accepted_text_hash: 'a'.repeat(64),
        declared_age_band: 'UNDER_14',
        client_ip_hash: 'b'.repeat(64),
        user_agent_hash: 'c'.repeat(64),
        timestamp: new Date().toISOString(),
      })
    ).toThrow();
  });

  it('rejects channel / age band outside the frozen domain', () => {
    expect(() =>
      ConsentEvidence.parse({
        channel: 'WEB',
        accepted_text_hash: 'a'.repeat(64),
        declared_age_band: 'UNDER_14',
        client_ip_hash: 'b'.repeat(64),
        user_agent_hash: 'c'.repeat(64),
      })
    ).toThrow();
    expect(() =>
      ConsentEvidence.parse({
        channel: 'MINIPROGRAM',
        accepted_text_hash: 'a'.repeat(64),
        declared_age_band: 'ADULT',
        client_ip_hash: 'b'.repeat(64),
        user_agent_hash: 'c'.repeat(64),
      })
    ).toThrow();
  });

  it('rejects non-hex hashes', () => {
    expect(() =>
      ConsentEvidence.parse({
        channel: 'MINIPROGRAM',
        accepted_text_hash: 'not-a-hash',
        declared_age_band: 'UNDER_14',
        client_ip_hash: 'b'.repeat(64),
        user_agent_hash: 'c'.repeat(64),
      })
    ).toThrow();
  });
});

describe('buildConsentEvidence', () => {
  const acceptedTextHash = getAcceptanceTextHash('v1')!;

  it('produces exactly the schema keys and frozen values', () => {
    const evidence = buildConsentEvidence({
      channel: 'TEST',
      acceptedTextHash,
      clientIp: '203.0.113.9',
      userAgent: 'TestAgent/1.0',
      pepper: PEPPER,
    });
    expect(Object.keys(evidence).sort()).toEqual(
      ['accepted_text_hash', 'channel', 'client_ip_hash', 'declared_age_band', 'user_agent_hash']
    );
    expect(evidence.channel).toBe('TEST');
    expect(evidence.declared_age_band).toBe('UNDER_14');
    expect(evidence.accepted_text_hash).toBe(acceptedTextHash);
  });

  it('hashes client IP / User-Agent with HMAC-SHA256(pepper)', () => {
    const evidence = buildConsentEvidence({
      channel: 'TEST',
      acceptedTextHash,
      clientIp: '203.0.113.9',
      userAgent: 'TestAgent/1.0',
      pepper: PEPPER,
    });
    expect(evidence.client_ip_hash).toBe(
      createHmac('sha256', PEPPER).update('203.0.113.9').digest('hex')
    );
    expect(evidence.user_agent_hash).toBe(
      createHmac('sha256', PEPPER).update('TestAgent/1.0').digest('hex')
    );
    expect(evidence.client_ip_hash).toBe(hmacSha256Hex(PEPPER, '203.0.113.9'));
  });

  it('represents a missing IP / UA deterministically without fabricating raw values', () => {
    const evidence = buildConsentEvidence({
      channel: 'TEST',
      acceptedTextHash,
      clientIp: null,
      userAgent: null,
      pepper: PEPPER,
    });
    expect(evidence.client_ip_hash).toBe(hmacSha256Hex(PEPPER, ''));
    expect(evidence.user_agent_hash).toBe(hmacSha256Hex(PEPPER, ''));
  });

  it('never leaks raw IP / UA or the pepper', () => {
    const rawIp = '198.51.100.23';
    const rawUa = 'SensitiveAgent/9.9';
    const serialized = JSON.stringify(
      buildConsentEvidence({
        channel: 'TEST',
        acceptedTextHash,
        clientIp: rawIp,
        userAgent: rawUa,
        pepper: PEPPER,
      })
    );
    expect(serialized).not.toContain(rawIp);
    expect(serialized).not.toContain(rawUa);
    expect(serialized).not.toContain(PEPPER);
  });

  it('accepted_text_hash is distinct from notice_hash', () => {
    const noticeHash = getNoticeHash('v1')!;
    expect(acceptedTextHash).toMatch(/^[0-9a-f]{64}$/);
    expect(acceptedTextHash).not.toBe(noticeHash);
  });

  it('revocation evidence hash is versioned and distinct from acceptance/notice', () => {
    const revocationHash = getRevocationTextHash('v1')!;
    expect(revocationHash).toMatch(/^[0-9a-f]{64}$/);
    expect(revocationHash).not.toBe(acceptedTextHash);
    expect(revocationHash).not.toBe(getNoticeHash('v1'));
    expect(getAcceptanceTextHash('v999')).toBeNull();
    expect(getRevocationTextHash('v999')).toBeNull();
  });
});