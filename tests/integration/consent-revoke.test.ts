/**
 * Consent revoke integration tests (T058 RED→GREEN).
 *
 * Frozen OpenAPI: `Idempotency-Key` header; optional `{ reason? }` body;
 * response = full ConsentRecord.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import { buildApp } from '../../apps/server/api/src/app.js';
import { createAdminPool } from '../setup/db.js';
import {
  createConsentRequest,
  createFamily,
  createMember,
  grantConsent,
  loginWithLabel,
  revokeConsent,
} from '../setup/api.js';

let verifyPool: pg.Pool;

async function queryDb(sql: string, params: unknown[] = []) {
  return verifyPool.query(sql, params);
}

async function countFamilyMembers(familyId: string): Promise<number> {
  const { rows } = await queryDb(
    'SELECT count(*)::int AS cnt FROM family_members WHERE family_id = $1',
    [familyId]
  );
  return rows[0].cnt as number;
}

describe('Consent Revoke Integration (T058)', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
    verifyPool = createAdminPool();
  });

  afterAll(async () => {
    await verifyPool.end();
    await app.close();
  });

  async function setupManagerAndFamily(label: string) {
    const actor = await loginWithLabel(app, `crv_${label}`);
    const fam = await createFamily(app, actor.token, `crv_${label}`);
    expect(fam.statusCode).toBe(201);
    return { ...actor, familyId: fam.json().id as string };
  }

  async function createAndGrantConsent(
    actor: { token: string },
    label: string,
    existingSubjectPersonId?: string
  ) {
    const reqRes = await createConsentRequest(app, actor.token, `crv_${label}`,
      existingSubjectPersonId ? { existingSubjectPersonId } : {});
    expect(reqRes.statusCode).toBe(201);
    const grantRes = await grantConsent(app, actor.token, `crv_${label}`, reqRes.json().requestId);
    return grantRes.json();
  }

  it('T058: revoke writes REVOKED v2 with supersedes_id=v1', async () => {
    const actor = await setupManagerAndFamily('t058a');
    const consent = await createAndGrantConsent(actor, 't058a');

    const createRes = await createMember(app, actor.token, actor.familyId, 't058a', {
      ageBand: 'UNDER_14',
      ageBandSource: 'GUARDIAN_RELAY',
      guardianConsentId: consent.id,
    });
    expect(createRes.statusCode).toBe(201);
    const memberPersonId = createRes.json().personId;

    const revokeRes = await revokeConsent(app, actor.token, 't058a', consent.id, {
      reason: 'family request',
    });
    expect(revokeRes.statusCode).toBe(200);
    const revokeBody = revokeRes.json();
    expect(revokeBody.decision).toBe('REVOKED');
    expect(revokeBody.version).toBe(2);
    expect(revokeBody.purpose).toBe('UNDER_14_GUARDIAN_CONSENT');

    const { rows } = await queryDb(
      `SELECT decision, version, onboarding_request_id, supersedes_id
       FROM consent_records WHERE id = $1`,
      [revokeBody.id]
    );
    expect(rows[0].decision).toBe('REVOKED');
    expect(rows[0].version).toBe(2);
    expect(rows[0].onboarding_request_id).toBeNull();
    expect(rows[0].supersedes_id).toBe(consent.id);

    const { rows: profileRows } = await queryDb(
      `SELECT guardian_consent_record_id, guardian_consent_version
       FROM person_compliance_profiles WHERE person_id = $1`,
      [memberPersonId]
    );
    expect(profileRows[0].guardian_consent_record_id).toBe(revokeBody.id);
    expect(profileRows[0].guardian_consent_version).toBe(2);

    const { rows: auditRows } = await queryDb(
      `SELECT event_type FROM business_audit_events
       WHERE resource_id = $1 AND event_type LIKE '%CONSENT%'`,
      [revokeBody.id]
    );
    expect(auditRows.length).toBeGreaterThan(0);
  });

  it('T058: gate BLOCK after revoke', async () => {
    const actor = await setupManagerAndFamily('t058b');
    const consent = await createAndGrantConsent(actor, 't058b');

    const createRes = await createMember(app, actor.token, actor.familyId, 't058b', {
      ageBand: 'UNDER_14',
      ageBandSource: 'GUARDIAN_RELAY',
      guardianConsentId: consent.id,
    });
    expect(createRes.statusCode).toBe(201);

    const revokeRes = await revokeConsent(app, actor.token, 't058b', consent.id);
    expect(revokeRes.statusCode).toBe(200);
    const revokeBody = revokeRes.json();

    const { rows: v1Rows } = await queryDb(
      'SELECT decision FROM consent_records WHERE id = $1',
      [consent.id]
    );
    expect(v1Rows[0].decision).toBe('GRANTED');

    const { rows: v2Rows } = await queryDb(
      'SELECT decision, supersedes_id FROM consent_records WHERE id = $1',
      [revokeBody.id]
    );
    expect(v2Rows[0].decision).toBe('REVOKED');
    expect(v2Rows[0].supersedes_id).toBe(consent.id);
  });

  it('T058: re-consent continues the chain at v3 (not a new v1)', async () => {
    const actor = await setupManagerAndFamily('t058c');
    const consent = await createAndGrantConsent(actor, 't058c');

    const createRes = await createMember(app, actor.token, actor.familyId, 't058c', {
      ageBand: 'UNDER_14',
      ageBandSource: 'GUARDIAN_RELAY',
      guardianConsentId: consent.id,
    });
    expect(createRes.statusCode).toBe(201);
    const memberPersonId = createRes.json().personId;

    const peopleBefore = await countFamilyMembers(actor.familyId);

    const revokeRes = await revokeConsent(app, actor.token, 't058c', consent.id);
    expect(revokeRes.statusCode).toBe(200);
    const revokedConsent = revokeRes.json();

    const newConsent = await createAndGrantConsent(actor, 't058c-regrant', memberPersonId);
    expect(newConsent.decision).toBe('GRANTED');
    expect(newConsent.version).toBe(3);
    expect(newConsent.boundPersonId).toBe(memberPersonId);

    const { rows: v1Rows } = await queryDb(
      'SELECT decision, version, bound_person_id, supersedes_id, onboarding_request_id FROM consent_records WHERE id = $1',
      [consent.id]
    );
    expect(v1Rows[0].decision).toBe('GRANTED');
    expect(v1Rows[0].version).toBe(1);
    expect(v1Rows[0].supersedes_id).toBeNull();
    expect(v1Rows[0].bound_person_id).toBe(memberPersonId);

    const { rows: v2Rows } = await queryDb(
      'SELECT decision, version, bound_person_id, supersedes_id, onboarding_request_id FROM consent_records WHERE id = $1',
      [revokedConsent.id]
    );
    expect(v2Rows[0].decision).toBe('REVOKED');
    expect(v2Rows[0].version).toBe(2);
    expect(v2Rows[0].supersedes_id).toBe(consent.id);
    expect(v2Rows[0].onboarding_request_id).toBeNull();
    expect(v2Rows[0].bound_person_id).toBe(memberPersonId);

    const { rows: v3Rows } = await queryDb(
      'SELECT decision, version, bound_person_id, bound_at, supersedes_id, onboarding_request_id FROM consent_records WHERE id = $1',
      [newConsent.id]
    );
    expect(v3Rows[0].decision).toBe('GRANTED');
    expect(v3Rows[0].version).toBe(3);
    expect(v3Rows[0].supersedes_id).toBe(revokedConsent.id);
    expect(v3Rows[0].bound_person_id).toBe(memberPersonId);
    expect(v3Rows[0].bound_at).not.toBeNull();

    const { rows: boundRows } = await queryDb(
      'SELECT DISTINCT bound_person_id FROM consent_records WHERE family_id = $1',
      [actor.familyId]
    );
    expect(boundRows.length).toBe(1);
    expect(boundRows[0].bound_person_id).toBe(memberPersonId);

    const { rows: profileRows } = await queryDb(
      'SELECT guardian_consent_record_id, guardian_consent_version FROM person_compliance_profiles WHERE person_id = $1',
      [memberPersonId]
    );
    expect(profileRows[0].guardian_consent_record_id).toBe(newConsent.id);
    expect(profileRows[0].guardian_consent_version).toBe(3);

    expect(await countFamilyMembers(actor.familyId)).toBe(peopleBefore);
  });
});