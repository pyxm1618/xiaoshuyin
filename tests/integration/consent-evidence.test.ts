/**
 * HIGH-02 remediation: stored consent evidence shape.
 *
 * Asserts the persisted `consent_records.evidence` JSON is exactly the frozen
 * object from contracts/consent-onboarding.md §4, with real HMAC digests from
 * the deployment pepper and no raw IP / UA / pepper leakage.
 *
 * C1 / option d: `channel` is server-decided (`TEST` under NODE_ENV=test).
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createHmac } from 'node:crypto';
import pg from 'pg';
import { buildApp } from '../../apps/server/api/src/app.js';
import { createAdminPool } from '../setup/db.js';
import {
  getAcceptanceTextHash,
  getRevocationTextHash,
} from '../../packages/compliance/src/notices.js';
import {
  commandHeaders,
  createConsentRequest,
  createFamily,
  loginWithLabel,
} from '../setup/api.js';

const PEPPER = process.env['EVIDENCE_HASH_PEPPER']!;
const EXPECTED_CHANNEL = process.env['NODE_ENV'] === 'test' ? 'TEST' : 'MINIPROGRAM';
const EXPECTED_KEYS = [
  'accepted_text_hash',
  'channel',
  'client_ip_hash',
  'declared_age_band',
  'user_agent_hash',
];

function hmac(value: string): string {
  return createHmac('sha256', PEPPER).update(value).digest('hex');
}

let adminPool: pg.Pool;

describe('Consent evidence storage (HIGH-02)', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
    adminPool = createAdminPool();
    expect(PEPPER.length).toBeGreaterThanOrEqual(16);
  });

  afterAll(async () => {
    await adminPool.end();
    await app.close();
  });

  async function setupManager(label: string) {
    const actor = await loginWithLabel(app, `ev_${label}`);
    const fam = await createFamily(app, actor.token, `ev_${label}`);
    expect(fam.statusCode).toBe(201);
    return { token: actor.token, familyId: fam.json().id as string };
  }

  async function createRequest(token: string, label: string) {
    const res = await createConsentRequest(app, token, `ev_${label}`);
    expect(res.statusCode).toBe(201);
    return res.json().requestId as string;
  }

  function grant(
    token: string,
    requestId: string,
    label: string,
    opts: { userAgent?: string; remoteAddress?: string } = {}
  ) {
    const headers: Record<string, string> = commandHeaders(token, `ev-${label}`);
    if (opts.userAgent !== undefined) headers['user-agent'] = opts.userAgent;
    return app.inject({
      method: 'POST',
      url: '/api/v1/compliance/guardian-consents',
      headers,
      ...(opts.remoteAddress ? { remoteAddress: opts.remoteAddress } : {}),
      payload: {
        onboardingRequestId: requestId,
        noticeVersion: 'v1',
        accepted: true,
      },
    });
  }

  async function readEvidence(consentId: string) {
    const { rows } = await adminPool.query(
      'SELECT evidence, notice_hash FROM consent_records WHERE id = $1',
      [consentId]
    );
    expect(rows.length).toBe(1);
    return {
      evidence: rows[0].evidence as Record<string, unknown>,
      noticeHash: rows[0].notice_hash as string,
    };
  }

  it('GRANTED evidence matches the frozen schema exactly and uses real HMAC', async () => {
    const { token } = await setupManager('grant');
    const requestId = await createRequest(token, 'grant');

    const rawIp = '203.0.113.9';
    const rawUa = 'XiaoshuyinEvidenceAgent/1.0';
    const res = await grant(token, requestId, 'grant', { userAgent: rawUa, remoteAddress: rawIp });
    expect(res.statusCode).toBe(201);

    const { evidence, noticeHash } = await readEvidence(res.json().id);

    expect(Object.keys(evidence).sort()).toEqual(EXPECTED_KEYS);
    expect(evidence.channel).toBe(EXPECTED_CHANNEL);
    expect(evidence.declared_age_band).toBe('UNDER_14');
    expect(evidence.accepted_text_hash).toBe(getAcceptanceTextHash('v1'));
    expect(evidence.accepted_text_hash).not.toBe(noticeHash);
    expect(evidence.client_ip_hash).toBe(hmac(rawIp));
    expect(evidence.user_agent_hash).toBe(hmac(rawUa));

    const serialized = JSON.stringify(evidence);
    expect(serialized).not.toContain(rawIp);
    expect(serialized).not.toContain(rawUa);
    expect(serialized).not.toContain(PEPPER);
    expect(serialized).not.toContain('accepted":true');
    expect(serialized).not.toContain('timestamp');
  });

  it('missing User-Agent is hashed deterministically (no fabricated raw value)', async () => {
    const { token } = await setupManager('noua');
    const requestId = await createRequest(token, 'noua');

    // light-my-request injects its own default UA; send an explicit empty
    // header to exercise the real "no client UA" path deterministically.
    const res = await grant(token, requestId, 'noua', { userAgent: '' });
    expect(res.statusCode).toBe(201);

    const { evidence } = await readEvidence(res.json().id);
    expect(Object.keys(evidence).sort()).toEqual(EXPECTED_KEYS);
    expect(evidence.user_agent_hash).toBe(hmac(''));
  });

  it('REVOKED evidence uses the same frozen five-field shape', async () => {
    const { token } = await setupManager('revoke');
    const requestId = await createRequest(token, 'revoke');

    const grantRes = await grant(token, requestId, 'revoke');
    expect(grantRes.statusCode).toBe(201);
    const consentId = grantRes.json().id as string;

    const rawIp = '203.0.113.10';
    const rawUa = 'XiaoshuyinEvidenceAgent/2.0';
    const revokeRes = await app.inject({
      method: 'POST',
      url: `/api/v1/consents/${consentId}/revoke`,
      headers: { ...commandHeaders(token, 'ev-rv'), 'user-agent': rawUa },
      remoteAddress: rawIp,
      payload: {},
    });
    expect(revokeRes.statusCode).toBe(200);

    const { evidence } = await readEvidence(revokeRes.json().id);
    expect(Object.keys(evidence).sort()).toEqual(EXPECTED_KEYS);
    expect(evidence.channel).toBe(EXPECTED_CHANNEL);
    expect(evidence.declared_age_band).toBe('UNDER_14');
    expect(evidence.accepted_text_hash).toBe(getRevocationTextHash('v1'));
    expect(evidence.client_ip_hash).toBe(hmac(rawIp));
    expect(evidence.user_agent_hash).toBe(hmac(rawUa));

    const serialized = JSON.stringify(evidence);
    expect(serialized).not.toContain(rawIp);
    expect(serialized).not.toContain(rawUa);
    expect(serialized).not.toContain(PEPPER);

    // Business audit payload must not carry raw network identifiers either.
    const audit = await adminPool.query(
      `SELECT event_type, resource_type, resource_id FROM business_audit_events
       WHERE resource_id = $1`,
      [revokeRes.json().id]
    );
    expect(audit.rows.length).toBeGreaterThanOrEqual(1);
    const auditSerialized = JSON.stringify(audit.rows);
    expect(auditSerialized).not.toContain(rawIp);
    expect(auditSerialized).not.toContain(rawUa);
    expect(auditSerialized).not.toContain(PEPPER);
  });
});