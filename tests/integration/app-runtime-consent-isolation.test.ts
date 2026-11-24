/**
 * Finding #40 — instance-level dependency injection for consent evidence.
 *
 * These tests build TWO real Fastify apps in the SAME process with different
 * runtime environment objects and prove that:
 *
 *   - `buildApp` never mutates `process.env` (no global pepper / channel write);
 *   - App A always hashes evidence with pepper A, App B with pepper B;
 *   - building App B does not change what App A produces afterwards;
 *   - the server-decided consent channel is likewise per-instance;
 *   - no route / service in the API app reads either value from ambient
 *     process state.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { buildApp } from '../../apps/server/api/src/app.js';
import { createAdminPool } from '../setup/db.js';
import { createSafetyFixture, type SafetyFixture } from '../setup/safety.js';
import { getCurrentNoticeHash, hmacSha256Hex } from '@xiaoshuyin/compliance';

const PREFIX = `S10F40_${Date.now()}_`;
const PEPPER_A = 'app-a-evidence-hash-pepper-0001';
const PEPPER_B = 'app-b-evidence-hash-pepper-0002';
const CLIENT_IP = '203.0.113.7';
const USER_AGENT = 'xiaoshuyin-instance-isolation-test';

const VALID_EVIDENCE = JSON.stringify({
  channel: 'TEST',
  accepted_text_hash: 'b'.repeat(64),
  declared_age_band: 'UNDER_14',
  client_ip_hash: 'c'.repeat(64),
  user_agent_hash: 'd'.repeat(64),
});

function envWith(pepper: string, mode: 'test' | 'production'): NodeJS.ProcessEnv {
  return {
    ...process.env,
    NODE_ENV: mode,
    EVIDENCE_HASH_PEPPER: pepper,
  };
}

describe('Finding #40: per-instance consent runtime injection', () => {
  let appA: Awaited<ReturnType<typeof buildApp>>;
  let appB: Awaited<ReturnType<typeof buildApp>>;
  let admin: pg.Pool;
  let fixture: SafetyFixture;
  let owner: { token: string; accountId: string; personId: string };
  let familyId: string;
  let ambientPepperBefore: string | undefined;
  const childIds: string[] = [];

  async function seedChildConsent(): Promise<{ consentId: string }> {
    const child = await admin.query<{ id: string }>(
      `INSERT INTO persons (created_by_account_id) VALUES ($1) RETURNING id`,
      [owner.accountId]
    );
    const childId = child.rows[0]!.id;
    childIds.push(childId);
    await admin.query(`INSERT INTO family_members (family_id, person_id) VALUES ($1,$2)`, [
      familyId,
      childId,
    ]);

    const request = await admin.query<{ id: string }>(
      `INSERT INTO guardian_consent_requests
         (family_id, guardian_person_id, subject_person_id, declared_age_band,
          notice_version, notice_hash, status, expires_at, completed_at)
       VALUES ($1,$2,$3,'UNDER_14','v1',$4,'GRANTED',now()+interval '1 hour',now())
       RETURNING id`,
      [familyId, owner.personId, childId, getCurrentNoticeHash()]
    );

    const consent = await admin.query<{ id: string }>(
      `INSERT INTO consent_records
         (family_id, guardian_person_id, guardian_account_id, purpose, decision,
          version, onboarding_request_id, bound_person_id, bound_at,
          notice_version, notice_hash, policy_version, evidence, supersedes_id)
       VALUES ($1,$2,$3,'UNDER_14_GUARDIAN_CONSENT','GRANTED',1,$4,$5,now(),'v1',$6,'v1',$7::jsonb,NULL)
       RETURNING id`,
      [
        familyId,
        owner.personId,
        owner.accountId,
        request.rows[0]!.id,
        childId,
        getCurrentNoticeHash(),
        VALID_EVIDENCE,
      ]
    );

    await admin.query(
      `INSERT INTO person_compliance_profiles
         (person_id, age_band, minor_mode, guardian_person_id, guardian_consent_record_id,
          guardian_consent_version, verified_source)
       VALUES ($1,'UNDER_14',true,$2,$3,1,'GUARDIAN_RELAY')`,
      [childId, owner.personId, consent.rows[0]!.id]
    );

    return { consentId: consent.rows[0]!.id };
  }

  async function revoke(
    app: Awaited<ReturnType<typeof buildApp>>,
    consentId: string
  ): Promise<{ statusCode: number; evidence: Record<string, unknown> }> {
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/consents/${consentId}/revoke`,
      headers: {
        authorization: `Bearer ${owner.token}`,
        'idempotency-key': `${PREFIX}revoke-${consentId}`,
        'user-agent': USER_AGENT,
      },
      payload: {},
      remoteAddress: CLIENT_IP,
    });
    expect(response.statusCode, response.body).toBe(200);

    const stored = await admin.query<{ evidence: Record<string, unknown> }>(
      `SELECT evidence FROM consent_records
        WHERE supersedes_id = $1 AND decision = 'REVOKED'
        ORDER BY decided_at DESC LIMIT 1`,
      [consentId]
    );
    return { statusCode: response.statusCode, evidence: stored.rows[0]!.evidence };
  }

  beforeAll(async () => {
    ambientPepperBefore = process.env['EVIDENCE_HASH_PEPPER'];
    // App A: test mode (TEST channel), pepper A.
    appA = await buildApp({ env: envWith(PEPPER_A, 'test') });
    await appA.ready();
    // App B: production mode (MINIPROGRAM channel), pepper B — built while A is
    // already live in the same process.
    appB = await buildApp({ env: envWith(PEPPER_B, 'production') });
    await appB.ready();

    admin = createAdminPool();
    fixture = createSafetyFixture({ app: appA, admin, prefix: PREFIX });
    owner = await fixture.login('owner');
    familyId = await fixture.createFamily(owner, 'finding40');
  }, 120_000);

  afterAll(async () => {
    if (familyId) {
      await admin
        .query(`DELETE FROM person_compliance_profiles WHERE person_id = ANY($1::uuid[])`, [
          childIds,
        ])
        .catch(() => undefined);
      await admin
        .query(`DELETE FROM consent_records WHERE family_id = $1`, [familyId])
        .catch(() => undefined);
      await admin
        .query(`DELETE FROM guardian_consent_requests WHERE family_id = $1`, [familyId])
        .catch(() => undefined);
    }
    await fixture?.cleanup();
    await fixture?.close();
    await admin?.end().catch(() => undefined);
    await appA?.close();
    await appB?.close();
  }, 120_000);

  it('buildApp never mutates the ambient process environment', () => {
    expect(process.env['EVIDENCE_HASH_PEPPER']).toBe(ambientPepperBefore);
    expect(process.env['EVIDENCE_HASH_PEPPER']).not.toBe(PEPPER_A);
    expect(process.env['EVIDENCE_HASH_PEPPER']).not.toBe(PEPPER_B);
    expect(process.env['CONSENT_CHANNEL']).toBeUndefined();
  });

  it('App A hashes consent evidence with pepper A only', async () => {
    const seeded = await seedChildConsent();
    const { evidence } = await revoke(appA, seeded.consentId);

    expect(evidence['client_ip_hash']).toBe(hmacSha256Hex(PEPPER_A, CLIENT_IP));
    expect(evidence['client_ip_hash']).not.toBe(hmacSha256Hex(PEPPER_B, CLIENT_IP));
    expect(evidence['user_agent_hash']).toBe(hmacSha256Hex(PEPPER_A, USER_AGENT));
    expect(evidence['channel']).toBe('TEST');
  }, 120_000);

  it('App B hashes consent evidence with pepper B only', async () => {
    const seeded = await seedChildConsent();
    const { evidence } = await revoke(appB, seeded.consentId);

    expect(evidence['client_ip_hash']).toBe(hmacSha256Hex(PEPPER_B, CLIENT_IP));
    expect(evidence['client_ip_hash']).not.toBe(hmacSha256Hex(PEPPER_A, CLIENT_IP));
    expect(evidence['user_agent_hash']).toBe(hmacSha256Hex(PEPPER_B, USER_AGENT));
    // Channel is also per-instance: App B runs in production mode.
    expect(evidence['channel']).toBe('MINIPROGRAM');
  }, 120_000);

  it('App A keeps its own pepper after App B was built', async () => {
    const seeded = await seedChildConsent();
    const { evidence } = await revoke(appA, seeded.consentId);

    expect(evidence['client_ip_hash']).toBe(hmacSha256Hex(PEPPER_A, CLIENT_IP));
    expect(evidence['channel']).toBe('TEST');
  }, 120_000);

  it('no API route or service reads the pepper or channel from ambient env', () => {
    const root = fileURLToPath(new URL('../../apps/server/api/src/', import.meta.url));
    const offenders: string[] = [];
    const ambientAccessorConsumers: string[] = [];

    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) {
          walk(full);
          continue;
        }
        if (!entry.endsWith('.ts')) continue;
        const source = readFileSync(full, 'utf8');
        const relative = full.slice(root.length);
        // The single validated runtime contract owns the env read.
        if (relative === 'runtime-env.ts') continue;
        // The legacy standalone accessor is not a route or service and has no
        // consumer left (asserted below); its removal is blocked by the
        // implementation-ownership registry, which must change separately.
        if (relative !== 'evidence-pepper.ts') {
          if (source.includes("process.env['EVIDENCE_HASH_PEPPER']")) {
            offenders.push(`${relative}:EVIDENCE_HASH_PEPPER`);
          }
          if (source.includes("process.env['CONSENT_CHANNEL']")) {
            offenders.push(`${relative}:CONSENT_CHANNEL`);
          }
        }
        if (
          relative !== 'evidence-pepper.ts' &&
          source.includes('requireEvidencePepper')
        ) {
          ambientAccessorConsumers.push(relative);
        }
      }
    };

    walk(root);
    expect(offenders).toEqual([]);
    // Nothing in the app still consumes the ambient pepper accessor.
    expect(ambientAccessorConsumers).toEqual([]);
  });
});
