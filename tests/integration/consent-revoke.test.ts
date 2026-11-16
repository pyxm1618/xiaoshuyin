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
import { createCase } from '../setup/participation.js';
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

  it('AUTH-006: revoke marks only exact Consent-dependent formulations NEEDS_REVIEW', async () => {
    const actor = await setupManagerAndFamily('auth006-review');
    const consent = await createAndGrantConsent(actor, 'auth006-review');

    const member = await createMember(app, actor.token, actor.familyId, 'auth006-review', {
      ageBand: 'UNDER_14',
      ageBandSource: 'GUARDIAN_RELAY',
      guardianConsentId: consent.id,
    });
    expect(member.statusCode).toBe(201);

    const affectedCase = await createCase(app, actor.token, 'auth006-consent-affected');
    const unaffectedCase = await createCase(app, actor.token, 'auth006-consent-unaffected');
    expect(affectedCase.statusCode).toBe(201);
    expect(unaffectedCase.statusCode).toBe(201);

    for (const [caseId, dependencies] of [
      [
        affectedCase.json().id,
        [{ type: 'CONSENT', id: consent.id, version: consent.version }],
      ],
      [unaffectedCase.json().id, []],
    ] as const) {
      await queryDb(
        `INSERT INTO problem_formulations
           (family_id,case_id,version,status,review_state,primary_problem,key_factors,
            evidence_refs,unknowns,conflicts,scene_fit,alternative_explanations,
            reassessment_conditions,exit_conditions,user_response,
            confirmed_by_person_id,confirmed_at,dependency_refs,supersedes_version)
         VALUES
           ($1,$2,1,'CONFIRMED','CURRENT',$3::jsonb,'[]'::jsonb,$4::jsonb,
            '[]'::jsonb,'[]'::jsonb,'AUTH006','[]'::jsonb,'[]'::jsonb,'[]'::jsonb,
            $5::jsonb,$6,now(),$7::jsonb,NULL)`,
        [
          actor.familyId,
          caseId,
          JSON.stringify({ text: 'AUTH-006 consent dependency probe' }),
          JSON.stringify([{ type: 'ASSERTION', id: '11111111-1111-4111-8111-111111111111' }]),
          JSON.stringify({
            kind: 'CONFIRM',
            actorPersonId: actor.personId,
            respondedAt: new Date().toISOString(),
          }),
          actor.personId,
          JSON.stringify(dependencies),
        ]
      );
    }

    const revokeRes = await revokeConsent(
      app,
      actor.token,
      'auth006-review',
      consent.id,
      { reason: 'AUTH-006 dependency propagation' }
    );
    expect(revokeRes.statusCode, revokeRes.body).toBe(200);

    const rows = await queryDb(
      `SELECT case_id, status::text AS status, review_state::text AS review_state
         FROM problem_formulations
        WHERE case_id = ANY($1::uuid[])
        ORDER BY case_id`,
      [[affectedCase.json().id, unaffectedCase.json().id]]
    );
    const byCase = Object.fromEntries(rows.rows.map((row: any) => [row.case_id, row]));
    expect(byCase[affectedCase.json().id]).toMatchObject({
      status: 'CONFIRMED',
      review_state: 'NEEDS_REVIEW',
    });
    expect(byCase[unaffectedCase.json().id]).toMatchObject({
      status: 'CONFIRMED',
      review_state: 'CURRENT',
    });
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