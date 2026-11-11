/**
 * Slice 8 — real concurrent command races.
 *
 * Present/Present, Confirm/Confirm, Correction/SwitchPrimaryCase and
 * Reassess/SwitchPrimaryCase must serialize on Family → Case → current
 * formulation and leave exactly one valid outcome.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import { buildApp } from '../../apps/server/api/src/app.js';
import { createAdminPool } from '../setup/db.js';
import {
  confirmProblemFormulation,
  correctProblemFormulation,
  disputeProblemFormulation,
  presentProblemFormulation,
  reassessFromFormulation,
  startAssessment,
} from '../../apps/server/api/src/services/problem-formulations.js';

const PREFIX = 't8race_';

describe('problem formulation concurrency (Slice 8)', () => {
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
    try {
      await admin.query(`DELETE FROM problem_formulations WHERE family_id IN (SELECT id FROM families WHERE display_name LIKE 'T8RACE-%')`);
      await admin.query(`DELETE FROM business_audit_events WHERE family_id IN (SELECT id FROM families WHERE display_name LIKE 'T8RACE-%')`);
      await admin.query(`DELETE FROM case_events WHERE family_id IN (SELECT id FROM families WHERE display_name LIKE 'T8RACE-%')`);
      await admin.query(`DELETE FROM cases WHERE family_id IN (SELECT id FROM families WHERE display_name LIKE 'T8RACE-%')`);
      await admin.query(`DELETE FROM dialogue_messages WHERE family_id IN (SELECT id FROM families WHERE display_name LIKE 'T8RACE-%')`);
      await admin.query(`DELETE FROM idempotency_keys WHERE actor_account_id IN (SELECT id FROM accounts WHERE wechat_openid LIKE '${PREFIX}%')`);
      await admin.query(`DELETE FROM family_members WHERE family_id IN (SELECT id FROM families WHERE display_name LIKE 'T8RACE-%')`);
      await admin.query(`DELETE FROM families WHERE display_name LIKE 'T8RACE-%'`);
      await admin.query(`DELETE FROM persons WHERE created_by_account_id IN (SELECT id FROM accounts WHERE wechat_openid LIKE '${PREFIX}%')`);
      await admin.query(`DELETE FROM accounts WHERE wechat_openid LIKE '${PREFIX}%'`);
    } catch {
      // best-effort
    }
    await pool.end();
    await admin.end();
    await app.close();
  });

  async function login(label: string) {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/wechat',
      payload: { code: `${PREFIX}${label}_${Date.now()}_${seq++}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    return { token: body.sessionToken as string, personId: body.person.id as string, accountId: body.accountId as string };
  }

  async function family(owner: { token: string }, label: string) {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/families',
      headers: { authorization: `Bearer ${owner.token}`, 'idempotency-key': `t8race-f-${label}-${Date.now()}-${seq++}` },
      payload: { displayName: `T8RACE-${label}`, creator: { ageBand: 'ADULT', ageBandSource: 'SELF_STATEMENT' } },
    });
    expect(res.statusCode).toBe(201);
    return res.json().id as string;
  }

  async function createCase(owner: { token: string }, label: string) {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/cases',
      headers: { authorization: `Bearer ${owner.token}`, 'idempotency-key': `t8race-c-${label}-${Date.now()}-${seq++}` },
      payload: {},
    });
    expect(res.statusCode).toBe(201);
    return res.json() as { id: string; version: number };
  }

  async function message(owner: { token: string }, caseId: string, label: string) {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/cases/${caseId}/messages`,
      headers: { authorization: `Bearer ${owner.token}`, 'idempotency-key': `t8race-m-${label}-${Date.now()}-${seq++}` },
      payload: { content: '并发测试消息' },
    });
    expect(res.statusCode).toBe(201);
    return res.json().id as string;
  }

  function content(messageId: string) {
    const ref = { type: 'DIALOGUE_MESSAGE' as const, id: messageId };
    return {
      primaryProblem: { text: '并发主问题', evidenceRefs: [ref] },
      keyFactors: [],
      evidenceRefs: [ref],
      unknowns: [],
      conflicts: [],
      sceneFit: 'family_common_core',
      alternativeExplanations: [],
      reassessmentConditions: [{ text: 'new evidence' }],
      exitConditions: [],
      dependencyRefs: [{ type: 'EVIDENCE' as const, evidence: ref }],
    };
  }

  async function prepare(label: string) {
    const owner = await login(label);
    const familyId = await family(owner, label);
    const created = await createCase(owner, label);
    const messageId = await message(owner, created.id, label);
    const started = await startAssessment(pool, {
      actor: { accountId: owner.accountId, personId: owner.personId },
      familyId,
      caseId: created.id,
      expectedCaseVersion: created.version,
      idempotencyKey: `t8race-start-${Date.now()}-${seq++}`,
    });
    return { owner, familyId, caseId: created.id, caseVersion: started.body.caseVersion, messageId };
  }

  it('concurrent Present/Present yields one version and one current row', async () => {
    const { owner, familyId, caseId, caseVersion, messageId } = await prepare('present');
    const results = await Promise.allSettled([
      presentProblemFormulation(pool, {
        actor: { accountId: owner.accountId, personId: owner.personId },
        familyId,
        caseId,
        expectedCaseVersion: caseVersion,
        idempotencyKey: `t8race-p1-${Date.now()}-${seq++}`,
        content: content(messageId),
      }),
      presentProblemFormulation(pool, {
        actor: { accountId: owner.accountId, personId: owner.personId },
        familyId,
        caseId,
        expectedCaseVersion: caseVersion,
        idempotencyKey: `t8race-p2-${Date.now()}-${seq++}`,
        content: content(messageId),
      }),
    ]);
    const fulfilled = results.filter(
      (r) => r.status === 'fulfilled' && r.value.status < 300
    );
    expect(fulfilled).toHaveLength(1);

    const rows = await admin.query(
      `SELECT count(*)::int AS n FROM problem_formulations WHERE case_id = $1`,
      [caseId]
    );
    expect(rows.rows[0].n).toBe(1);
    const current = await admin.query(
      `SELECT count(*)::int AS n FROM problem_formulations
       WHERE case_id = $1 AND status <> 'SUPERSEDED'`,
      [caseId]
    );
    expect(current.rows[0].n).toBe(1);
  });

  it('concurrent Confirm/Confirm yields exactly one confirmation and one GOALS transition', async () => {
    const { owner, familyId, caseId, caseVersion, messageId } = await prepare('confirm');
    const presented = await presentProblemFormulation(pool, {
      actor: { accountId: owner.accountId, personId: owner.personId },
      familyId,
      caseId,
      expectedCaseVersion: caseVersion,
      idempotencyKey: `t8race-p-${Date.now()}-${seq++}`,
      content: content(messageId),
    });
    const results = await Promise.allSettled([
      confirmProblemFormulation(pool, {
        actor: { accountId: owner.accountId, personId: owner.personId },
        familyId,
        caseId,
        expectedCaseVersion: presented.body.caseVersion,
        idempotencyKey: `t8race-c1-${Date.now()}-${seq++}`,
        formulationVersion: 1,
        body: {},
      }),
      confirmProblemFormulation(pool, {
        actor: { accountId: owner.accountId, personId: owner.personId },
        familyId,
        caseId,
        expectedCaseVersion: presented.body.caseVersion,
        idempotencyKey: `t8race-c2-${Date.now()}-${seq++}`,
        formulationVersion: 1,
        body: {},
      }),
    ]);
    expect(
      results.filter((r) => r.status === 'fulfilled' && r.value.status < 300)
    ).toHaveLength(1);

    const cases = await admin.query(
      'SELECT phase, version FROM cases WHERE id = $1',
      [caseId]
    );
    expect(cases.rows[0].phase).toBe('GOALS');
    const events = await admin.query(
      `SELECT count(*)::int AS n FROM case_events
       WHERE case_id = $1 AND event_type = 'CASE_PROBLEM_FORMULATION_CONFIRMED'`,
      [caseId]
    );
    expect(events.rows[0].n).toBe(1);
  });

  it('Correction vs SwitchPrimaryCase never leaves a split state', async () => {
    const owner = await login('corr-switch');
    const familyId = await family(owner, 'corr-switch');
    const caseA = await createCase(owner, 'corr-switch-a');
    const caseB = await createCase(owner, 'corr-switch-b');
    const messageId = await message(owner, caseA.id, 'corr-switch');
    const started = await startAssessment(pool, {
      actor: { accountId: owner.accountId, personId: owner.personId },
      familyId,
      caseId: caseA.id,
      expectedCaseVersion: caseA.version,
      idempotencyKey: `t8race-start-${Date.now()}-${seq++}`,
    });
    const presented = await presentProblemFormulation(pool, {
      actor: { accountId: owner.accountId, personId: owner.personId },
      familyId,
      caseId: caseA.id,
      expectedCaseVersion: started.body.caseVersion,
      idempotencyKey: `t8race-p-${Date.now()}-${seq++}`,
      content: content(messageId),
    });

    const viewA = await app.inject({
      method: 'GET',
      url: `/api/v1/cases/${caseA.id}`,
      headers: { authorization: `Bearer ${owner.token}` },
    });
    const caseAView = viewA.json() as { version: number; primary: boolean };

    const results = await Promise.allSettled([
      correctProblemFormulation(pool, {
        actor: { accountId: owner.accountId, personId: owner.personId },
        familyId,
        caseId: caseA.id,
        expectedCaseVersion: presented.body.caseVersion,
        idempotencyKey: `t8race-corr-${Date.now()}-${seq++}`,
        formulationVersion: 1,
        changes: { sceneFit: 'family_common_core_v2' },
      }),
      app.inject({
        method: 'POST',
        url: `/api/v1/cases/${caseB.id}/switch-primary`,
        headers: {
          authorization: `Bearer ${owner.token}`,
          'idempotency-key': `t8race-sw-${Date.now()}-${seq++}`,
        },
        payload: {
          reason: 'race to secondary case',
          expectedPrimaryCaseId: caseA.id,
          expectedPrimaryVersion: caseAView.version,
        },
      }),
    ]);

    const rows = await admin.query(
      `SELECT version, status, supersedes_version FROM problem_formulations
       WHERE case_id = $1 ORDER BY version`,
      [caseA.id]
    );
    const current = rows.rows.filter((r: any) => r.status !== 'SUPERSEDED');
    expect(current).toHaveLength(1);

    const correctionOk =
      results[0].status === 'fulfilled' && results[0].value.status < 300;
    if (correctionOk) {
      expect(rows.rows).toHaveLength(2);
      expect(rows.rows[0].status).toBe('SUPERSEDED');
      expect(current[0].version).toBe(2);
      expect(current[0].supersedes_version).toBe(1);
    } else {
      expect(rows.rows).toHaveLength(1);
      expect(current[0].version).toBe(1);
    }
  });

  it('Reassess vs SwitchPrimaryCase races two independently valid commands', async () => {
    // Prove the fixture is valid on its own before racing.
    const solo = await prepare('reassess-solo');
    const soloPresented = await presentProblemFormulation(pool, {
      actor: { accountId: solo.owner.accountId, personId: solo.owner.personId },
      familyId: solo.familyId, caseId: solo.caseId,
      expectedCaseVersion: solo.caseVersion,
      idempotencyKey: `t8race-solo-p-${Date.now()}-${seq++}`,
      content: content(solo.messageId),
    });
    expect(soloPresented.status).toBe(200);
    const soloReassess = await reassessFromFormulation(pool, {
      actor: { accountId: solo.owner.accountId, personId: solo.owner.personId },
      familyId: solo.familyId, caseId: solo.caseId,
      expectedCaseVersion: soloPresented.body.caseVersion,
      idempotencyKey: `t8race-solo-re-${Date.now()}-${seq++}`,
      formulationVersion: 1,
      basis: { kind: 'REASSESSMENT_CONDITION', text: 'new evidence' },
    });
    expect(soloReassess.status).toBe(200);

    const p = await prepare('reassess');
    const presented = await presentProblemFormulation(pool, {
      actor: { accountId: p.owner.accountId, personId: p.owner.personId },
      familyId: p.familyId, caseId: p.caseId,
      expectedCaseVersion: p.caseVersion,
      idempotencyKey: `t8race-p-${Date.now()}-${seq++}`,
      content: content(p.messageId),
    });
    expect(presented.status).toBe(200);
    const other = await createCase(p.owner, 'reassess-b');
    const viewA = await app.inject({
      method: 'GET',
      url: `/api/v1/cases/${p.caseId}`,
      headers: { authorization: `Bearer ${p.owner.token}` },
    });
    const raceStartVersion = viewA.json().version as number;
    const beforeFormulation = await admin.query(
      `SELECT status, version FROM problem_formulations WHERE case_id=$1`,
      [p.caseId]
    );

    const results = await Promise.allSettled([
      reassessFromFormulation(pool, {
        actor: { accountId: p.owner.accountId, personId: p.owner.personId },
        familyId: p.familyId, caseId: p.caseId,
        expectedCaseVersion: presented.body.caseVersion,
        idempotencyKey: `t8race-re-${Date.now()}-${seq++}`,
        formulationVersion: 1,
        basis: { kind: 'REASSESSMENT_CONDITION', text: 'new evidence' },
      }),
      app.inject({
        method: 'POST',
        url: `/api/v1/cases/${other.id}/switch-primary`,
        headers: {
          authorization: `Bearer ${p.owner.token}`,
          'idempotency-key': `t8race-sw2-${Date.now()}-${seq++}`,
        },
        payload: {
          reason: 'race to other case',
          expectedPrimaryCaseId: p.caseId,
          expectedPrimaryVersion: raceStartVersion,
        },
      }),
    ]);

    const reassessOk = results[0].status === 'fulfilled' && results[0].value.status < 300;
    const switchOk = results[1].status === 'fulfilled' && results[1].value.statusCode === 200;
    expect([reassessOk, switchOk].filter(Boolean)).toHaveLength(1);
    if (!reassessOk) {
      expect(results[0].status).toBe('fulfilled');
      if (results[0].status === 'fulfilled') expect(results[0].value.status).toBe(409);
    }

    const rows = await admin.query('SELECT phase, is_primary FROM cases WHERE id=$1', [p.caseId]);
    expect(rows.rows).toHaveLength(1);
    if (reassessOk) {
      expect(rows.rows[0].phase).toBe('ASSESSMENT');
    } else {
      expect(rows.rows[0].is_primary).toBe(false);
      expect(rows.rows[0].phase).toBe('PROBLEM_FORMULATION');
    }
    const afterFormulation = await admin.query(
      `SELECT status, version FROM problem_formulations WHERE case_id=$1`,
      [p.caseId]
    );
    expect(afterFormulation.rows).toEqual(beforeFormulation.rows);
  });

  it('same-current race matrix keeps one legal winner for every command pair', async () => {
    const pairs = [
      ['confirm-correction', 'confirm', 'correction'],
      ['confirm-dispute', 'confirm', 'dispute'],
      ['confirm-reassess', 'confirm', 'reassess'],
      ['correction-correction', 'correction', 'correction'],
      ['correction-dispute', 'correction', 'dispute'],
      ['reassess-confirm', 'reassess', 'confirm'],
    ] as const;
    for (const [label, left, right] of pairs) {
      const p = await prepare(`pair-${label}`);
      const presented = await presentProblemFormulation(pool, {
        actor: { accountId: p.owner.accountId, personId: p.owner.personId },
        familyId: p.familyId, caseId: p.caseId,
        expectedCaseVersion: p.caseVersion,
        idempotencyKey: `t8race-pair-p-${Date.now()}-${seq++}`,
        content: content(p.messageId),
      });
      expect(presented.status).toBe(200);
      const invoke = (kind: string) => {
        const common = {
          actor: { accountId: p.owner.accountId, personId: p.owner.personId },
          familyId: p.familyId, caseId: p.caseId,
          expectedCaseVersion: presented.body.caseVersion,
          idempotencyKey: `t8race-pair-${kind}-${label}-${Date.now()}-${seq++}`,
          formulationVersion: 1,
        };
        if (kind === 'confirm') return confirmProblemFormulation(pool, { ...common, body: {} });
        if (kind === 'dispute') return disputeProblemFormulation(pool, { ...common, body: {} });
        if (kind === 'reassess') return reassessFromFormulation(pool, { ...common, basis: { kind: 'REASSESSMENT_CONDITION', text: 'new evidence' } });
        return correctProblemFormulation(pool, { ...common, changes: { sceneFit: 'family_common_core_v2' } });
      };
      const beforeRace = await admin.query(
        `SELECT (SELECT count(*)::int FROM case_events WHERE case_id=$1) AS e,
                (SELECT count(*)::int FROM business_audit_events WHERE family_id=$2) AS a`,
        [p.caseId, p.familyId]
      );
      const results = await Promise.allSettled([invoke(left), invoke(right)]);
      const wins = results.filter((r) => r.status === 'fulfilled' && r.value.status < 300);
      expect(wins, label).toHaveLength(1);
      for (const loser of results.filter(
        (r) => r.status === 'fulfilled' && r.value.status >= 300
      )) {
        expect(loser.status).toBe('fulfilled');
        if (loser.status === 'fulfilled') expect(loser.value.status).toBe(409);
      }
      const afterRace = await admin.query(
        `SELECT (SELECT count(*)::int FROM case_events WHERE case_id=$1) AS e,
                (SELECT count(*)::int FROM business_audit_events WHERE family_id=$2) AS a,
                (SELECT count(*)::int FROM problem_formulations WHERE case_id=$1 AND status<>'SUPERSEDED') AS n`,
        [p.caseId, p.familyId]
      );
      expect(afterRace.rows[0].e - beforeRace.rows[0].e, label).toBe(1);
      expect(afterRace.rows[0].a - beforeRace.rows[0].a, label).toBe(1);
      expect(afterRace.rows[0].n).toBe(1);
    }
  });

  it('Present and Confirm serialize against SwitchPrimaryCase', async () => {
    for (const kind of ['present', 'confirm'] as const) {
      const p = await prepare(`switch-${kind}`);
      const other = await createCase(p.owner, `switch-${kind}-b`);
      const presented = kind === 'confirm'
        ? await presentProblemFormulation(pool, {
            actor: { accountId: p.owner.accountId, personId: p.owner.personId },
            familyId: p.familyId, caseId: p.caseId,
            expectedCaseVersion: p.caseVersion,
            idempotencyKey: `t8race-sw-p-${Date.now()}-${seq++}`,
            content: content(p.messageId),
          })
        : null;
      const view = await app.inject({
        method: 'GET', url: `/api/v1/cases/${p.caseId}`,
        headers: { authorization: `Bearer ${p.owner.token}` },
      });
      const expectedCaseVersion = presented ? presented.body.caseVersion : p.caseVersion;

      const business = kind === 'present'
        ? presentProblemFormulation(pool, {
            actor: { accountId: p.owner.accountId, personId: p.owner.personId },
            familyId: p.familyId, caseId: p.caseId,
            expectedCaseVersion,
            idempotencyKey: `t8race-sw-b-${Date.now()}-${seq++}`,
            content: content(p.messageId),
          })
        : confirmProblemFormulation(pool, {
            actor: { accountId: p.owner.accountId, personId: p.owner.personId },
            familyId: p.familyId, caseId: p.caseId,
            expectedCaseVersion,
            idempotencyKey: `t8race-sw-b-${Date.now()}-${seq++}`,
            formulationVersion: 1, body: {},
          });

      const results = await Promise.allSettled([
        business,
        app.inject({
          method: 'POST', url: `/api/v1/cases/${other.id}/switch-primary`,
          headers: { authorization: `Bearer ${p.owner.token}`, 'idempotency-key': `t8race-sw-s-${Date.now()}-${seq++}` },
          payload: { reason: 'race', expectedPrimaryCaseId: p.caseId, expectedPrimaryVersion: view.json().version },
        }),
      ]);
      const businessOk = results[0].status === 'fulfilled' && results[0].value.status < 300;
      if (businessOk) {
        expect(['PROBLEM_FORMULATION', 'GOALS']).toContain(
          (await admin.query('SELECT phase FROM cases WHERE id=$1', [p.caseId])).rows[0].phase
        );
      } else {
        expect(results[0].status).toBe('fulfilled');
        if (results[0].status === 'fulfilled') expect(results[0].value.status).toBe(409);
      }
      const caseRows = await admin.query('SELECT phase, version FROM cases WHERE id=$1', [p.caseId]);
      expect(caseRows.rows).toHaveLength(1);
      const current = await admin.query(
        `SELECT count(*)::int AS n FROM problem_formulations WHERE case_id=$1 AND status<>'SUPERSEDED'`,
        [p.caseId]
      );
      expect(current.rows[0].n).toBeLessThanOrEqual(1);
    }
  });
});