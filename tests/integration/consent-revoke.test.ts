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

  it('FND-REM-001: only the locked current chain head may be revoked', async () => {
    const actor = await setupManagerAndFamily('fnd-current-head');
    const v1 = await createAndGrantConsent(actor, 'fnd-current-head');
    const member = await createMember(app, actor.token, actor.familyId, 'fnd-current-head', {
      ageBand: 'UNDER_14',
      ageBandSource: 'GUARDIAN_RELAY',
      guardianConsentId: v1.id,
    });
    expect(member.statusCode).toBe(201);
    const subjectId = member.json().personId as string;

    const revokeV1 = await revokeConsent(app, actor.token, 'fnd-current-v1', v1.id);
    expect(revokeV1.statusCode).toBe(200);
    const v2 = revokeV1.json();

    const v3 = await createAndGrantConsent(actor, 'fnd-current-v3', subjectId);
    expect(v3.version).toBe(3);

    for (const staleId of [v1.id, v2.id]) {
      const stale = await revokeConsent(app, actor.token, `fnd-stale-${staleId}`, staleId);
      expect(stale.statusCode).toBe(409);
      expect(stale.json().code).toBe('GUARDIAN_CONSENT_STALE');
    }

    const current = await revokeConsent(app, actor.token, 'fnd-current-v3-revoke', v3.id);
    expect(current.statusCode).toBe(200);
    expect(current.json()).toMatchObject({
      decision: 'REVOKED',
      version: 4,
      supersedesId: v3.id,
    });
  });

  it('FND-REM-001: concurrent revoke race creates exactly one successor head', async () => {
    const actor = await setupManagerAndFamily('fnd-revoke-race');
    // Keep v1 unbound: old code had no bound-person version uniqueness here,
    // so two serialized revoke requests could create two v2 successors.
    const v1 = await createAndGrantConsent(actor, 'fnd-revoke-race');

    const [a, b] = await Promise.all([
      revokeConsent(app, actor.token, 'fnd-revoke-race-a', v1.id),
      revokeConsent(app, actor.token, 'fnd-revoke-race-b', v1.id),
    ]);

    expect([a.statusCode, b.statusCode].sort()).toEqual([200, 409]);
    const loser = a.statusCode === 409 ? a : b;
    expect(loser.json().code).toBe('GUARDIAN_CONSENT_STALE');

    const successors = await queryDb(
      `SELECT id, decision, version
         FROM consent_records
        WHERE supersedes_id = $1
          AND purpose = 'UNDER_14_GUARDIAN_CONSENT'`,
      [v1.id]
    );
    expect(successors.rows).toHaveLength(1);
    expect(successors.rows[0]).toMatchObject({ decision: 'REVOKED', version: 2 });
  });

  it('FND-REM-001: concurrent supersede/revoke race preserves one authoritative head', async () => {
    const actor = await setupManagerAndFamily('fnd-supersede-revoke-race');
    const v1 = await createAndGrantConsent(actor, 'fnd-supersede-revoke-race');
    const member = await createMember(
      app,
      actor.token,
      actor.familyId,
      'fnd-supersede-revoke-race',
      {
        ageBand: 'UNDER_14',
        ageBandSource: 'GUARDIAN_RELAY',
        guardianConsentId: v1.id,
      }
    );
    expect(member.statusCode).toBe(201);
    const subjectId = member.json().personId as string;

    const revokeV1 = await revokeConsent(
      app,
      actor.token,
      'fnd-supersede-revoke-race-v2',
      v1.id
    );
    expect(revokeV1.statusCode).toBe(200);
    const v2 = revokeV1.json();

    const request = await createConsentRequest(
      app,
      actor.token,
      'fnd-supersede-revoke-race-v3',
      { existingSubjectPersonId: subjectId }
    );
    expect(request.statusCode).toBe(201);

    const [grantV3, revokeV2] = await Promise.all([
      grantConsent(
        app,
        actor.token,
        'fnd-supersede-revoke-race-v3',
        request.json().requestId
      ),
      revokeConsent(
        app,
        actor.token,
        'fnd-supersede-revoke-race-v2-again',
        v2.id
      ),
    ]);

    expect(grantV3.statusCode).toBe(201);
    expect(revokeV2.statusCode).toBe(409);

    const successors = await queryDb(
      `SELECT id, decision, version
         FROM consent_records
        WHERE supersedes_id = $1
          AND purpose = 'UNDER_14_GUARDIAN_CONSENT'`,
      [v2.id]
    );
    expect(successors.rows).toHaveLength(1);
    expect(successors.rows[0]).toMatchObject({
      decision: 'GRANTED',
      version: 3,
    });

    const profile = await queryDb(
      `SELECT guardian_consent_record_id, guardian_consent_version
         FROM person_compliance_profiles
        WHERE person_id = $1`,
      [subjectId]
    );
    expect(profile.rows[0]).toEqual({
      guardian_consent_record_id: successors.rows[0].id,
      guardian_consent_version: 3,
    });
  });

  it('FND-REM-001: revoke audit failure rolls back the successor and pointer', async () => {
    const actor = await setupManagerAndFamily('fnd-revoke-rollback');
    const v1 = await createAndGrantConsent(actor, 'fnd-revoke-rollback');
    const member = await createMember(app, actor.token, actor.familyId, 'fnd-revoke-rollback', {
      ageBand: 'UNDER_14',
      ageBandSource: 'GUARDIAN_RELAY',
      guardianConsentId: v1.id,
    });
    expect(member.statusCode).toBe(201);
    const subjectId = member.json().personId as string;

    await queryDb(`
      CREATE OR REPLACE FUNCTION fnd_rem_fail_revoke_audit() RETURNS trigger
      LANGUAGE plpgsql AS $fnd$
      BEGIN
        IF NEW.event_type = 'CONSENT_REVOKED'
           AND NEW.family_id = '${actor.familyId}'::uuid THEN
          RAISE EXCEPTION 'FND_REM_REVOKE_AUDIT_FAILURE';
        END IF;
        RETURN NEW;
      END $fnd$;
      DROP TRIGGER IF EXISTS fnd_rem_fail_revoke_audit_trigger ON business_audit_events;
      CREATE TRIGGER fnd_rem_fail_revoke_audit_trigger
        BEFORE INSERT ON business_audit_events
        FOR EACH ROW EXECUTE FUNCTION fnd_rem_fail_revoke_audit();
    `);

    try {
      const failed = await revokeConsent(app, actor.token, 'fnd-revoke-rollback', v1.id);
      expect(failed.statusCode).toBe(500);

      const successors = await queryDb(
        'SELECT count(*)::int AS count FROM consent_records WHERE supersedes_id = $1',
        [v1.id]
      );
      expect(successors.rows[0].count).toBe(0);

      const profile = await queryDb(
        `SELECT guardian_consent_record_id, guardian_consent_version
           FROM person_compliance_profiles WHERE person_id = $1`,
        [subjectId]
      );
      expect(profile.rows[0]).toEqual({
        guardian_consent_record_id: v1.id,
        guardian_consent_version: 1,
      });
    } finally {
      await queryDb(
        `DROP TRIGGER IF EXISTS fnd_rem_fail_revoke_audit_trigger ON business_audit_events;
         DROP FUNCTION IF EXISTS fnd_rem_fail_revoke_audit()`
      );
    }
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


  it('C3 same-family non-guardian cannot distinguish current from stale Consent chain state', async () => {
    const guardian = await setupManagerAndFamily('c3-ordering');
    const v1 = await createAndGrantConsent(guardian, 'c3-ordering');
    const member = await createMember(app, guardian.token, guardian.familyId, 'c3-ordering', {
      ageBand: 'UNDER_14',
      ageBandSource: 'GUARDIAN_RELAY',
      guardianConsentId: v1.id,
    });
    expect(member.statusCode).toBe(201);
    const subjectId = member.json().personId as string;

    const v2Res = await revokeConsent(app, guardian.token, 'c3-ordering-v2', v1.id);
    expect(v2Res.statusCode).toBe(200);
    const v3 = await createAndGrantConsent(
      guardian,
      'c3-ordering-v3',
      subjectId
    );
    expect(v3.version).toBe(3);

    const nonGuardian = await loginWithLabel(app, 'crv_c3_non_guardian');
    await queryDb(
      `INSERT INTO family_members(family_id,person_id) VALUES($1,$2)
       ON CONFLICT DO NOTHING`,
      [guardian.familyId, nonGuardian.personId]
    );

    const currentAttempt = await revokeConsent(
      app,
      nonGuardian.token,
      'c3-current-non-guardian',
      v3.id
    );
    const staleAttempt = await revokeConsent(
      app,
      nonGuardian.token,
      'c3-stale-non-guardian',
      v1.id
    );

    expect(currentAttempt.statusCode).toBe(403);
    expect(staleAttempt.statusCode).toBe(403);
    expect(staleAttempt.json()).toEqual(currentAttempt.json());
    expect(currentAttempt.json().code).toBe('NOT_GUARDIAN');
  });
});