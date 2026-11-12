/** S8-M06/T838 — transaction fault injection at four write stages. */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import { buildApp } from '../../apps/server/api/src/app.js';
import { createAdminPool } from '../setup/db.js';
import { presentProblemFormulation, startAssessment } from '../../apps/server/api/src/services/problem-formulations.js';

const PREFIX = 't8atom_';

describe('S8 atomicity fault injection', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let admin: pg.Pool;
  let pool: pg.Pool;
  let seq = 0;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
    admin = createAdminPool();
    pool = new pg.Pool({ connectionString: process.env['DATABASE_URL'] });
  });

  afterAll(async () => {
    const fam = `(SELECT id FROM families WHERE display_name LIKE 'T8ATOM-%')`;
    try {
      await admin.query(`DELETE FROM problem_formulations WHERE family_id IN ${fam}`);
      await admin.query(`DELETE FROM business_audit_events WHERE family_id IN ${fam}`);
      await admin.query(`DELETE FROM case_events WHERE family_id IN ${fam}`);
      await admin.query(`DELETE FROM cases WHERE family_id IN ${fam}`);
      await admin.query(`DELETE FROM dialogue_messages WHERE family_id IN ${fam}`);
      await admin.query(`DELETE FROM idempotency_keys WHERE actor_account_id IN (SELECT id FROM accounts WHERE wechat_openid LIKE '${PREFIX}%')`);
      await admin.query(`DELETE FROM family_members WHERE family_id IN ${fam}`);
      await admin.query(`DELETE FROM families WHERE display_name LIKE 'T8ATOM-%'`);
      await admin.query(`DELETE FROM persons WHERE created_by_account_id IN (SELECT id FROM accounts WHERE wechat_openid LIKE '${PREFIX}%')`);
      await admin.query(`DELETE FROM accounts WHERE wechat_openid LIKE '${PREFIX}%'`);
    } catch {}
    await pool.end();
    await admin.end();
    await app.close();
  });

  async function prepare(label: string) {
    const login = await app.inject({ method: 'POST', url: '/api/v1/auth/wechat', payload: { code: `${PREFIX}${label}_${Date.now()}_${seq++}` } });
    const owner = login.json();
    const fam = await app.inject({
      method: 'POST', url: '/api/v1/families',
      headers: { authorization: `Bearer ${owner.sessionToken}`, 'idempotency-key': `t8a-f-${label}-${Date.now()}-${seq++}` },
      payload: { displayName: `T8ATOM-${label}`, creator: { ageBand: 'ADULT', ageBandSource: 'SELF_STATEMENT' } },
    });
    const familyId = fam.json().id as string;
    const created = await app.inject({
      method: 'POST', url: '/api/v1/cases',
      headers: { authorization: `Bearer ${owner.sessionToken}`, 'idempotency-key': `t8a-c-${label}-${Date.now()}-${seq++}` },
      payload: {},
    });
    const caseRow = created.json() as { id: string; version: number };
    const msg = await app.inject({
      method: 'POST', url: `/api/v1/cases/${caseRow.id}/messages`,
      headers: { authorization: `Bearer ${owner.sessionToken}`, 'idempotency-key': `t8a-m-${label}-${Date.now()}-${seq++}` },
      payload: { content: '原子性' },
    });
    const started = await startAssessment(pool, {
      actor: { accountId: owner.accountId as string, personId: owner.person.id as string },
      familyId, caseId: caseRow.id, expectedCaseVersion: caseRow.version,
      idempotencyKey: `t8a-s-${Date.now()}-${seq++}`,
    });
    expect(started.status).toBe(200);
    const base = await admin.query(
      `SELECT (SELECT count(*)::int FROM case_events WHERE case_id=$1) AS e,
              (SELECT count(*)::int FROM business_audit_events WHERE resource_id=$1) AS a`,
      [caseRow.id]
    );
    return {
      actor: { accountId: owner.accountId as string, personId: owner.person.id as string },
      familyId, caseId: caseRow.id, caseVersion: started.body.caseVersion, messageId: msg.json().id as string,
      baseline: base.rows[0] as { e: number; a: number },
    };
  }

  function content(messageId: string) {
    const ref = { type: 'DIALOGUE_MESSAGE' as const, id: messageId };
    return {
      primaryProblem: { text: '原子性', evidenceRefs: [ref] },
      keyFactors: [], evidenceRefs: [ref], unknowns: [], conflicts: [],
      sceneFit: 'family_common_core', alternativeExplanations: [], reassessmentConditions: [],
      exitConditions: [], dependencyRefs: [{ type: 'EVIDENCE' as const, evidence: ref }],
    };
  }

  async function inject(table: string, name: string, column: string, value: string) {
    await admin.query(`CREATE OR REPLACE FUNCTION ${name}() RETURNS trigger AS $$
      BEGIN RAISE EXCEPTION 'S8_ATOMICITY_INJECTED' USING ERRCODE='P0001'; END; $$ LANGUAGE plpgsql`);
    await admin.query(
      `CREATE TRIGGER ${name}_trg BEFORE INSERT OR UPDATE ON ${table}
       FOR EACH ROW WHEN (NEW.${column} = '${value}') EXECUTE FUNCTION ${name}()`
    );
  }

  async function remove(table: string, name: string) {
    await admin.query(`DROP TRIGGER IF EXISTS ${name}_trg ON ${table}`);
    await admin.query(`DROP FUNCTION IF EXISTS ${name}()`);
  }

  it.each([
    ['formulation-write', 'cases', 't8a_inj_case', 'family_id'],
    ['case-phase-write', 'case_events', 't8a_inj_event', 'family_id'],
    ['event-write', 'business_audit_events', 't8a_inj_eventb', 'family_id'],
    ['history-write', 'idempotency_keys', 't8a_inj_idem', 'actor_account_id'],
  ] as const)('rolls back all writes when %s fails', async (stage, table, name, column) => {
    const p = await prepare(stage);
    await inject(table, name, column, column === 'actor_account_id' ? p.actor.accountId : p.familyId);
    try {
      await expect(
        presentProblemFormulation(pool, {
          actor: p.actor, familyId: p.familyId, caseId: p.caseId,
          expectedCaseVersion: p.caseVersion,
          idempotencyKey: `t8a-p-${Date.now()}-${seq++}`,
          content: content(p.messageId),
        })
      ).rejects.toMatchObject({ code: 'P0001' });
    } finally {
      await remove(table, name);
    }
    const rows = await admin.query(
      `SELECT
        (SELECT count(*)::int FROM problem_formulations WHERE case_id=$1) AS f,
        (SELECT count(*)::int FROM case_events WHERE case_id=$1) AS e,
        (SELECT count(*)::int FROM business_audit_events WHERE resource_id=$1) AS a,
        (SELECT version FROM cases WHERE id=$1) AS version,
        (SELECT phase FROM cases WHERE id=$1) AS phase,
        (SELECT count(*)::int FROM idempotency_keys WHERE actor_account_id=$2) AS k`,
      [p.caseId, p.actor.accountId]
    );
    expect(rows.rows[0]).toMatchObject({ f: 0, e: p.baseline.e, a: p.baseline.a, version: p.caseVersion, phase: 'ASSESSMENT' });
  });
});