/**
 * T838 — transaction atomicity for Present / Confirm / Correction at all four
 * frozen write seams: after formulation write, after Case write, after event
 * write, after audit write. Every failure must roll back the whole command.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import { buildApp } from '../../apps/server/api/src/app.js';
import { createAdminPool } from '../setup/db.js';
import {
  confirmProblemFormulation,
  correctProblemFormulation,
  presentProblemFormulation,
  startAssessment,
} from '../../apps/server/api/src/services/problem-formulations.js';

const PREFIX = 't838_';

describe('T838 atomicity matrix', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let admin: pg.Pool;
  let pool: pg.Pool;
  let seq = 0;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
    admin = createAdminPool();
    pool = new pg.Pool({ connectionString: process.env['DATABASE_URL'], max: 20 });
  });

  afterAll(async () => {
    const fam = `(SELECT id FROM families WHERE display_name LIKE 'T838-%')`;
    try {
      await admin.query(`DELETE FROM problem_formulations WHERE family_id IN ${fam}`);
      await admin.query(`DELETE FROM business_audit_events WHERE family_id IN ${fam}`);
      await admin.query(`DELETE FROM case_events WHERE family_id IN ${fam}`);
      await admin.query(`DELETE FROM cases WHERE family_id IN ${fam}`);
      await admin.query(`DELETE FROM dialogue_messages WHERE family_id IN ${fam}`);
      await admin.query(`DELETE FROM idempotency_keys WHERE actor_account_id IN (SELECT id FROM accounts WHERE wechat_openid LIKE '${PREFIX}%')`);
      await admin.query(`DELETE FROM family_members WHERE family_id IN ${fam}`);
      await admin.query(`DELETE FROM families WHERE display_name LIKE 'T838-%'`);
      await admin.query(`DELETE FROM persons WHERE created_by_account_id IN (SELECT id FROM accounts WHERE wechat_openid LIKE '${PREFIX}%')`);
      await admin.query(`DELETE FROM accounts WHERE wechat_openid LIKE '${PREFIX}%'`);
    } catch {}
    await pool.end();
    await admin.end();
    await app.close();
  });

  async function prepare(label: string, command: 'present' | 'confirm' | 'correct') {
    const login = await app.inject({ method: 'POST', url: '/api/v1/auth/wechat', payload: { code: `${PREFIX}${label}_${Date.now()}_${seq++}` } });
    const owner = login.json();
    const fam = await app.inject({
      method: 'POST', url: '/api/v1/families',
      headers: { authorization: `Bearer ${owner.sessionToken}`, 'idempotency-key': `t838-f-${label}-${Date.now()}-${seq++}` },
      payload: { displayName: `T838-${label}`, creator: { ageBand: 'ADULT', ageBandSource: 'SELF_STATEMENT' } },
    });
    const familyId = fam.json().id as string;
    const created = await app.inject({
      method: 'POST', url: '/api/v1/cases',
      headers: { authorization: `Bearer ${owner.sessionToken}`, 'idempotency-key': `t838-c-${label}-${Date.now()}-${seq++}` },
      payload: {},
    });
    const caseId = created.json().id as string;
    const msg = await app.inject({
      method: 'POST', url: `/api/v1/cases/${caseId}/messages`,
      headers: { authorization: `Bearer ${owner.sessionToken}`, 'idempotency-key': `t838-m-${label}-${Date.now()}-${seq++}` },
      payload: { content: '原子性' },
    });
    const actor = { accountId: owner.accountId as string, personId: owner.person.id as string };
    const started = await startAssessment(pool, {
      actor, familyId, caseId, expectedCaseVersion: created.json().version as number,
      idempotencyKey: `t838-s-${label}-${Date.now()}-${seq++}`,
    });
    expect(started.status).toBe(200);
    const ref = { type: 'DIALOGUE_MESSAGE' as const, id: msg.json().id as string };
    const content = {
      primaryProblem: { text: '原子性', evidenceRefs: [ref] },
      keyFactors: [], evidenceRefs: [ref], unknowns: [], conflicts: [],
      sceneFit: 'family_common_core', alternativeExplanations: [], reassessmentConditions: [],
      exitConditions: [], dependencyRefs: [{ type: 'EVIDENCE' as const, evidence: ref }],
    };
    let caseVersion = started.body.caseVersion;
    if (command !== 'present') {
      const presented = await presentProblemFormulation(pool, {
        actor, familyId, caseId, expectedCaseVersion: caseVersion,
        idempotencyKey: `t838-p-${label}-${Date.now()}-${seq++}`, content,
      });
      expect(presented.status).toBe(200);
      caseVersion = presented.body.caseVersion;
    }
    return { actor, familyId, caseId, caseVersion, content };
  }

  async function snapshot(caseId: string, accountId: string) {
    const r = await admin.query(
      `SELECT
        (SELECT count(*)::int FROM problem_formulations WHERE case_id=$1) AS formulations,
        (SELECT count(*)::int FROM problem_formulations WHERE case_id=$1 AND status<>'SUPERSEDED') AS currents,
        (SELECT version FROM cases WHERE id=$1) AS version,
        (SELECT phase FROM cases WHERE id=$1) AS phase,
        (SELECT count(*)::int FROM case_events WHERE case_id=$1) AS events,
        (SELECT count(*)::int FROM business_audit_events WHERE resource_id=$1) AS audits,
        (SELECT count(*)::int FROM idempotency_keys WHERE actor_account_id=$2) AS idem`,
      [caseId, accountId]
    );
    return r.rows[0];
  }

  async function inject(table: string, name: string, column: string, value: string) {
    await admin.query(`CREATE OR REPLACE FUNCTION ${name}() RETURNS trigger AS $$
      BEGIN RAISE EXCEPTION 'T838_ATOMICITY_INJECTED' USING ERRCODE='P0001'; END; $$ LANGUAGE plpgsql`);
    await admin.query(
      `CREATE TRIGGER ${name}_trg BEFORE INSERT OR UPDATE ON ${table}
       FOR EACH ROW WHEN (NEW.${column} = '${value}') EXECUTE FUNCTION ${name}()`
    );
  }

  async function remove(table: string, name: string) {
    await admin.query(`DROP TRIGGER IF EXISTS ${name}_trg ON ${table}`);
    await admin.query(`DROP FUNCTION IF EXISTS ${name}()`);
  }

  const seams = [
    ['after-formulation-write', 'cases', 'family_id', 'case'],
    ['after-case-write', 'case_events', 'family_id', 'event'],
    ['after-event-write', 'business_audit_events', 'family_id', 'audit'],
    ['after-audit-write', 'idempotency_keys', 'actor_account_id', 'idem'],
  ] as const;

  it.each(['present', 'confirm', 'correct'] as const)('%s rolls back every write when any seam fails', async (command) => {
    for (const [seam, table, column, kind] of seams) {
      const p = await prepare(`${command}-${seam}`, command);
      const before = await snapshot(p.caseId, p.actor.accountId);
      const name = `t838_${command}_${kind}_${Date.now()}`;
      await inject(table, name, column, column === 'actor_account_id' ? p.actor.accountId : p.familyId);
      try {
        const call = command === 'present'
          ? presentProblemFormulation(pool, { actor: p.actor, familyId: p.familyId, caseId: p.caseId, expectedCaseVersion: p.caseVersion, idempotencyKey: `t838-x-${Date.now()}-${seq++}`, content: p.content })
          : command === 'confirm'
            ? confirmProblemFormulation(pool, { actor: p.actor, familyId: p.familyId, caseId: p.caseId, expectedCaseVersion: p.caseVersion, idempotencyKey: `t838-x-${Date.now()}-${seq++}`, formulationVersion: 1, body: {} })
            : correctProblemFormulation(pool, { actor: p.actor, familyId: p.familyId, caseId: p.caseId, expectedCaseVersion: p.caseVersion, idempotencyKey: `t838-x-${Date.now()}-${seq++}`, formulationVersion: 1, changes: { sceneFit: 'family_common_core_v2' } });
        await expect(call).rejects.toMatchObject({ code: 'P0001' });
      } finally {
        await remove(table, name);
      }
      expect(await snapshot(p.caseId, p.actor.accountId), `${command}/${seam}`).toEqual(before);
    }
  });
});