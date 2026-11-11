/**
 * Slice 8 — real application-service lifecycle (start → present → confirm /
 * dispute / correction) against a migrated PostgreSQL database.
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
  startAssessment,
} from '../../apps/server/api/src/services/problem-formulations.js';

const PREFIX = 't8life_';

describe('problem formulation lifecycle (Slice 8)', () => {
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
    try {
      await admin.query(
        `DELETE FROM problem_formulations WHERE family_id IN (SELECT id FROM families WHERE display_name LIKE 'T8LIFE-%')`
      );
      await admin.query(
        `DELETE FROM business_audit_events WHERE family_id IN (SELECT id FROM families WHERE display_name LIKE 'T8LIFE-%')`
      );
      await admin.query(
        `DELETE FROM case_events WHERE family_id IN (SELECT id FROM families WHERE display_name LIKE 'T8LIFE-%')`
      );
      await admin.query(
        `DELETE FROM cases WHERE family_id IN (SELECT id FROM families WHERE display_name LIKE 'T8LIFE-%')`
      );
      await admin.query(
        `DELETE FROM dialogue_messages WHERE family_id IN (SELECT id FROM families WHERE display_name LIKE 'T8LIFE-%')`
      );
      await admin.query(
        `DELETE FROM idempotency_keys WHERE actor_account_id IN (SELECT id FROM accounts WHERE wechat_openid LIKE '${PREFIX}%')`
      );
      await admin.query(
        `DELETE FROM family_members WHERE family_id IN (SELECT id FROM families WHERE display_name LIKE 'T8LIFE-%')`
      );
      await admin.query(`DELETE FROM families WHERE display_name LIKE 'T8LIFE-%'`);
      await admin.query(
        `DELETE FROM persons WHERE created_by_account_id IN (SELECT id FROM accounts WHERE wechat_openid LIKE '${PREFIX}%')`
      );
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
    return {
      token: body.sessionToken as string,
      personId: body.person.id as string,
      accountId: body.accountId as string,
    };
  }

  async function family(token: string, label: string) {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/families',
      headers: {
        authorization: `Bearer ${token}`,
        'idempotency-key': `t8life-fam-${label}-${Date.now()}-${seq++}`,
      },
      payload: {
        displayName: `T8LIFE-${label}`,
        creator: { ageBand: 'ADULT', ageBandSource: 'SELF_STATEMENT' },
      },
    });
    expect(res.statusCode).toBe(201);
    return res.json().id as string;
  }

  async function createCase(token: string, label: string) {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/cases',
      headers: {
        authorization: `Bearer ${token}`,
        'idempotency-key': `t8life-case-${label}-${Date.now()}-${seq++}`,
      },
      payload: {},
    });
    expect(res.statusCode).toBe(201);
    return res.json() as { id: string; version: number; phase: string };
  }

  async function message(token: string, caseId: string, label: string) {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/cases/${caseId}/messages`,
      headers: {
        authorization: `Bearer ${token}`,
        'idempotency-key': `t8life-msg-${label}-${Date.now()}-${seq++}`,
      },
      payload: { content: '孩子最近不愿意上学，可能需要先了解发生了什么。' },
    });
    expect(res.statusCode).toBe(201);
    return res.json().id as string;
  }

  function key(label: string) {
    return `t8life-${label}-${Date.now()}-${seq++}`;
  }

  function content(messageId: string) {
    const ref = { type: 'DIALOGUE_MESSAGE' as const, id: messageId };
    return {
      primaryProblem: { text: '当前主要问题是拒绝上学', evidenceRefs: [ref] },
      keyFactors: [],
      evidenceRefs: [ref],
      unknowns: [],
      conflicts: [],
      sceneFit: 'family_common_core',
      alternativeExplanations: [{ text: '也可能是短期身体不适' }],
      reassessmentConditions: [{ text: '出现新的持续拒学证据' }],
      exitConditions: [{ text: '已确认不再属于当前服务范围' }],
      dependencyRefs: [{ type: 'EVIDENCE' as const, evidence: ref }],
    };
  }

  async function prepare(label: string) {
    const owner = await login(label);
    const familyId = await family(owner.token, label);
    const created = await createCase(owner.token, `${label}-case`);
    const messageId = await message(owner.token, created.id, label);
    return { owner, familyId, created, messageId };
  }

  it('StartAssessment → Present → Confirm advances the Case to GOALS', async () => {
    const { owner, familyId, created, messageId } = await prepare('happy');

    const started = await startAssessment(pool, {
      actor: { accountId: owner.accountId, personId: owner.personId },
      familyId,
      caseId: created.id,
      expectedCaseVersion: created.version,
      idempotencyKey: key('start'),
    });
    expect(started.status).toBe(200);
    expect(started.body.caseVersion).toBe(created.version + 1);
    expect(started.body.current).toBeNull();

    const presented = await presentProblemFormulation(pool, {
      actor: { accountId: owner.accountId, personId: owner.personId },
      familyId,
      caseId: created.id,
      expectedCaseVersion: started.body.caseVersion,
      idempotencyKey: key('present'),
      content: content(messageId),
    });
    expect(presented.status).toBe(200);
    expect(presented.body.current?.status).toBe('PRESENTED');
    expect(presented.body.current?.version).toBe(1);
    expect(presented.body.current?.confirmedBy).toBeNull();

    const confirmed = await confirmProblemFormulation(pool, {
      actor: { accountId: owner.accountId, personId: owner.personId },
      familyId,
      caseId: created.id,
      expectedCaseVersion: presented.body.caseVersion,
      idempotencyKey: key('confirm'),
      formulationVersion: 1,
      body: { note: '确认这个问题理解' },
    });
    expect(confirmed.status).toBe(200);
    expect(confirmed.body.current?.status).toBe('CONFIRMED');
    expect(confirmed.body.current?.confirmedBy).toBe(owner.personId);

    const view = await app.inject({
      method: 'GET',
      url: `/api/v1/cases/${created.id}`,
      headers: { authorization: `Bearer ${owner.token}` },
    });
    expect(view.statusCode).toBe(200);
    expect(view.json().phase).toBe('GOALS');
  });

  it('Dispute keeps PROBLEM_FORMULATION and blocks a later Confirm', async () => {
    const { owner, familyId, created, messageId } = await prepare('dispute');

    const started = await startAssessment(pool, {
      actor: { accountId: owner.accountId, personId: owner.personId },
      familyId,
      caseId: created.id,
      expectedCaseVersion: created.version,
      idempotencyKey: key('start'),
    });
    const presented = await presentProblemFormulation(pool, {
      actor: { accountId: owner.accountId, personId: owner.personId },
      familyId,
      caseId: created.id,
      expectedCaseVersion: started.body.caseVersion,
      idempotencyKey: key('present'),
      content: content(messageId),
    });

    const disputed = await disputeProblemFormulation(pool, {
      actor: { accountId: owner.accountId, personId: owner.personId },
      familyId,
      caseId: created.id,
      expectedCaseVersion: presented.body.caseVersion,
      idempotencyKey: key('dispute'),
      formulationVersion: 1,
      body: { note: '不同意这个判断' },
    });
    expect(disputed.status).toBe(200);
    expect(disputed.body.current?.status).toBe('DISPUTED');

    const view = await app.inject({
      method: 'GET',
      url: `/api/v1/cases/${created.id}`,
      headers: { authorization: `Bearer ${owner.token}` },
    });
    expect(view.json().phase).toBe('PROBLEM_FORMULATION');

    const blocked = await confirmProblemFormulation(pool, {
      actor: { accountId: owner.accountId, personId: owner.personId },
      familyId,
      caseId: created.id,
      expectedCaseVersion: disputed.body.caseVersion,
      idempotencyKey: key('confirm-after-dispute'),
      formulationVersion: 1,
      body: {},
    });
    expect(blocked.status).toBe(409);
    expect(blocked.body).toMatchObject({ code: 'PROBLEM_FORMULATION_STATE_CONFLICT' });
  });

  it('Correction supersedes v1, creates v2 PRESENTED, and clears confirmation', async () => {
    const { owner, familyId, created, messageId } = await prepare('correct');

    const started = await startAssessment(pool, {
      actor: { accountId: owner.accountId, personId: owner.personId },
      familyId,
      caseId: created.id,
      expectedCaseVersion: created.version,
      idempotencyKey: key('start'),
    });
    const presented = await presentProblemFormulation(pool, {
      actor: { accountId: owner.accountId, personId: owner.personId },
      familyId,
      caseId: created.id,
      expectedCaseVersion: started.body.caseVersion,
      idempotencyKey: key('present'),
      content: content(messageId),
    });

    const corrected = await correctProblemFormulation(pool, {
      actor: { accountId: owner.accountId, personId: owner.personId },
      familyId,
      caseId: created.id,
      expectedCaseVersion: presented.body.caseVersion,
      idempotencyKey: key('correct'),
      formulationVersion: 1,
      changes: { primaryProblem: { text: '更精确的主要问题', evidenceRefs: [{ type: 'DIALOGUE_MESSAGE', id: messageId }] } },
      note: '补充更准确的描述',
    });
    expect(corrected.status).toBe(201);
    expect(corrected.body.current?.version).toBe(2);
    expect(corrected.body.current?.status).toBe('PRESENTED');
    expect(corrected.body.current?.supersedesVersion).toBe(1);
    expect(corrected.body.current?.confirmedBy).toBeNull();

    const rows = await admin.query(
      `SELECT version, status, primary_problem FROM problem_formulations
       WHERE case_id = $1 ORDER BY version`,
      [created.id]
    );
    expect(rows.rows.map((row: any) => row.status)).toEqual(['SUPERSEDED', 'PRESENTED']);
    expect(rows.rows[0].primary_problem.text).toBe('当前主要问题是拒绝上学');
  });
});