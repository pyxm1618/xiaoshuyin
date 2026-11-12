/**
 * Slice 8 — authoritative evidence set closure (S8-PA-001).
 *
 * A group-only ConflictItem forces the server to expand the real conflict
 * group. The expanded sides MUST enter authoritativeEvidenceSet and therefore
 * drive processing-Person compliance and mandatory EVIDENCE dependencies even
 * when the client omits ConflictItem.evidenceRefs.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import { buildApp } from '../../apps/server/api/src/app.js';
import { createAdminPool } from '../setup/db.js';
import { getCurrentNoticeHash } from '@xiaoshuyin/compliance';
import {
  presentProblemFormulation,
  startAssessment,
} from '../../apps/server/api/src/services/problem-formulations.js';

const PREFIX = 't8pa1_';

describe('problem formulation authoritative evidence closure (S8-PA-001)', () => {
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
      await admin.query(`DELETE FROM problem_formulations WHERE family_id IN (SELECT id FROM families WHERE display_name LIKE 'T8PA1-%')`);
      await admin.query(`DELETE FROM business_audit_events WHERE family_id IN (SELECT id FROM families WHERE display_name LIKE 'T8PA1-%')`);
      await admin.query(`DELETE FROM case_events WHERE family_id IN (SELECT id FROM families WHERE display_name LIKE 'T8PA1-%')`);
      await admin.query(`DELETE FROM cases WHERE family_id IN (SELECT id FROM families WHERE display_name LIKE 'T8PA1-%')`);
      await admin.query(`DELETE FROM dialogue_messages WHERE family_id IN (SELECT id FROM families WHERE display_name LIKE 'T8PA1-%')`);
      await admin.query(`DELETE FROM assertions WHERE family_id IN (SELECT id FROM families WHERE display_name LIKE 'T8PA1-%')`);
      await admin.query(`DELETE FROM idempotency_keys WHERE actor_account_id IN (SELECT id FROM accounts WHERE wechat_openid LIKE '${PREFIX}%')`);
      await admin.query(`DELETE FROM family_members WHERE family_id IN (SELECT id FROM families WHERE display_name LIKE 'T8PA1-%')`);
      await admin.query(`DELETE FROM families WHERE display_name LIKE 'T8PA1-%'`);
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

  async function prepare(label: string) {
    const owner = await login(label);
    const fam = await app.inject({
      method: 'POST',
      url: '/api/v1/families',
      headers: { authorization: `Bearer ${owner.token}`, 'idempotency-key': `t8pa1-f-${label}-${Date.now()}-${seq++}` },
      payload: { displayName: `T8PA1-${label}`, creator: { ageBand: 'ADULT', ageBandSource: 'SELF_STATEMENT' } },
    });
    expect(fam.statusCode).toBe(201);
    const familyId = fam.json().id as string;

    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/cases',
      headers: { authorization: `Bearer ${owner.token}`, 'idempotency-key': `t8pa1-c-${label}-${Date.now()}-${seq++}` },
      payload: {},
    });
    expect(created.statusCode).toBe(201);
    const caseRow = created.json() as { id: string; version: number };

    const msg = await app.inject({
      method: 'POST',
      url: `/api/v1/cases/${caseRow.id}/messages`,
      headers: { authorization: `Bearer ${owner.token}`, 'idempotency-key': `t8pa1-m-${label}-${Date.now()}-${seq++}` },
      payload: { content: '基础问题陈述' },
    });
    expect(msg.statusCode).toBe(201);

    const started = await startAssessment(pool, {
      actor: { accountId: owner.accountId, personId: owner.personId },
      familyId,
      caseId: caseRow.id,
      expectedCaseVersion: caseRow.version,
      idempotencyKey: `t8pa1-start-${Date.now()}-${seq++}`,
    });

    return {
      owner,
      familyId,
      caseId: caseRow.id,
      caseVersion: started.body.caseVersion,
      messageId: msg.json().id as string,
    };
  }

  async function createExtraPerson(
    familyId: string,
    accountId: string,
    label: string
  ): Promise<string> {
    const person = await admin.query(
      `INSERT INTO persons (account_id, created_by_account_id)
       VALUES (NULL, $1) RETURNING id`,
      [accountId]
    );
    const personId = person.rows[0].id;
    await admin.query(
      'INSERT INTO family_members (family_id, person_id) VALUES ($1, $2)',
      [familyId, personId]
    );
    return personId;
  }

  async function insertConflictingAssertion(input: {
    familyId: string;
    caseId: string;
    subjectPersonId: string;
    sourcePersonId: string;
    groupId: string;
    content: string;
  }) {
    const row = await admin.query(
      `INSERT INTO assertions
         (family_id, case_id, subject_person_id, source_kind, source_person_id,
          occurred_time_state, confirmation_status, kind, content, conflict_group_id)
       VALUES ($1, $2, $3, 'SELF_STATEMENT', $4,
               'UNKNOWN', 'UNCONFIRMED', 'STATEMENT', $5, $6)
       RETURNING id`,
      [
        input.familyId,
        input.caseId,
        input.subjectPersonId,
        input.sourcePersonId,
        input.content,
        input.groupId,
      ]
    );
    return row.rows[0].id as string;
  }

  function baseContent(messageId: string, refs: { type: 'DIALOGUE_MESSAGE'; id: string }[]) {
    return {
      primaryProblem: {
        text: '主要问题',
        evidenceRefs: [{ type: 'DIALOGUE_MESSAGE' as const, id: messageId }],
      },
      keyFactors: [],
      evidenceRefs: refs,
      unknowns: [],
      conflicts: [] as Record<string, unknown>[],
      sceneFit: 'family_common_core',
      alternativeExplanations: [],
      reassessmentConditions: [],
      exitConditions: [],
      dependencyRefs: [] as Record<string, unknown>[],
    };
  }

  it('group-only conflict expands a side whose Person enters the compliance gate', async () => {
    const { owner, familyId, caseId, caseVersion, messageId } = await prepare('under14');
    const extra = await createExtraPerson(familyId, owner.accountId, 'u14');

    const groupId = crypto.randomUUID();
    const sideA = await insertConflictingAssertion({
      familyId,
      caseId,
      subjectPersonId: owner.personId,
      sourcePersonId: owner.personId,
      groupId,
      content: '来源 A 的说法',
    });
    const sideB = await insertConflictingAssertion({
      familyId,
      caseId,
      subjectPersonId: extra,
      sourcePersonId: owner.personId,
      groupId,
      content: '来源 B 的说法',
    });

    const messageRef = { type: 'DIALOGUE_MESSAGE' as const, id: messageId };
    const candidate = baseContent(messageId, [messageRef]);
    candidate.conflicts = [
      {
        topic: '两个来源说法不一致',
        conflictGroupId: groupId,
      },
    ];
    candidate.dependencyRefs = [
      { type: 'EVIDENCE', evidence: messageRef },
      { type: 'EVIDENCE', evidence: { type: 'ASSERTION', id: sideA } },
      { type: 'EVIDENCE', evidence: { type: 'ASSERTION', id: sideB } },
    ];

    const blocked = await presentProblemFormulation(pool, {
      actor: { accountId: owner.accountId, personId: owner.personId },
      familyId,
      caseId,
      expectedCaseVersion: caseVersion,
      idempotencyKey: `t8pa1-u14-${Date.now()}-${seq++}`,
      content: candidate,
    });
    expect(blocked.status).toBe(403);
    expect(blocked.body).toMatchObject({ code: 'PROFILE_MISSING' });

    const rows = await admin.query(
      'SELECT count(*)::int AS n FROM problem_formulations WHERE case_id = $1',
      [caseId]
    );
    expect(rows.rows[0].n).toBe(0);
  });

  it('group-only conflict requires both resolved sides in mandatory dependencies', async () => {
    const { owner, familyId, caseId, caseVersion, messageId } = await prepare('omit');

    const groupId = crypto.randomUUID();
    const sideA = await insertConflictingAssertion({
      familyId,
      caseId,
      subjectPersonId: owner.personId,
      sourcePersonId: owner.personId,
      groupId,
      content: '来源 A',
    });
    const sideB = await insertConflictingAssertion({
      familyId,
      caseId,
      subjectPersonId: owner.personId,
      sourcePersonId: owner.personId,
      groupId,
      content: '来源 B',
    });

    const messageRef = { type: 'DIALOGUE_MESSAGE' as const, id: messageId };
    const candidate = baseContent(messageId, [messageRef]);
    candidate.conflicts = [
      { topic: '冲突组', conflictGroupId: groupId },
    ];
    candidate.dependencyRefs = [
      { type: 'EVIDENCE', evidence: messageRef },
      { type: 'EVIDENCE', evidence: { type: 'ASSERTION', id: sideA } },
      // sideB is deliberately omitted.
    ];

    const omitted = await presentProblemFormulation(pool, {
      actor: { accountId: owner.accountId, personId: owner.personId },
      familyId,
      caseId,
      expectedCaseVersion: caseVersion,
      idempotencyKey: `t8pa1-omit-${Date.now()}-${seq++}`,
      content: candidate,
    });
    expect(omitted.status).toBe(409);
    expect(omitted.body).toMatchObject({
      code: 'PROBLEM_FORMULATION_DEPENDENCY_INVALID',
    });

    const rows = await admin.query(
      'SELECT count(*)::int AS n FROM problem_formulations WHERE case_id = $1',
      [caseId]
    );
    expect(rows.rows[0].n).toBe(0);
  });

  async function createSecondFamily(accountId: string) {
    const account = await admin.query('INSERT INTO accounts (wechat_openid) VALUES ($1) RETURNING id', [`t8pa1b_${Date.now()}`]);
    const accountB = account.rows[0].id as string;
    const person = await admin.query('INSERT INTO persons (account_id, created_by_account_id) VALUES ($1,$1) RETURNING id', [accountB]);
    const personB = person.rows[0].id as string;
    const family = (await admin.query('SELECT uuidv7() AS id')).rows[0].id as string;
    await admin.query('SELECT app.create_family($1,$2,$3)', [family, personB, 'T8PA1-ORPHAN']);
    await admin.query('INSERT INTO family_members (family_id, person_id) VALUES ($1,$2)', [family, personB]);
    return { familyId: family, accountId: accountB, personId: personB };
  }

  async function createUnder14(input: {
    familyId: string;
    guardianPersonId: string;
    guardianAccountId: string;
    scenario: 'valid' | 'revoked' | 'stale-version' | 'notice-mismatch' | 'missing';
  }) {
    const person = await admin.query(
      'INSERT INTO persons (account_id, created_by_account_id) VALUES (NULL,$1) RETURNING id',
      [input.guardianAccountId]
    );
    const under14 = person.rows[0].id as string;
    await admin.query('INSERT INTO family_members (family_id, person_id) VALUES ($1,$2)', [input.familyId, under14]);

    let consentFamily = input.familyId;
    if (input.scenario === 'missing') {
      const other = await createSecondFamily(input.guardianAccountId);
      consentFamily = other.familyId;
    }
    const noticeHash =
      input.scenario === 'notice-mismatch' ? 'a'.repeat(64) : getCurrentNoticeHash();
    let requestId: string | null = null;
    if (input.scenario !== 'revoked') {
      const request = await admin.query(
        `INSERT INTO guardian_consent_requests
           (family_id, guardian_person_id, subject_person_id, declared_age_band,
            notice_version, notice_hash, status, expires_at, completed_at)
         VALUES ($1,$2,$3,'UNDER_14','v1',$4,'GRANTED',now()+interval '1 hour',now())
         RETURNING id`,
        [consentFamily, input.guardianPersonId, under14, noticeHash]
      );
      requestId = request.rows[0].id as string;
    }
    const consent = await admin.query(
      `INSERT INTO consent_records
         (family_id, guardian_person_id, guardian_account_id, purpose, decision,
          version, onboarding_request_id, bound_person_id, bound_at,
          notice_version, notice_hash, policy_version, evidence)
       VALUES ($1,$2,$3,'UNDER_14_GUARDIAN_CONSENT',$4,1,$5,$6,now(),'v1',$7,'v1',$8::jsonb)
       RETURNING id, version`,
      [consentFamily, input.guardianPersonId, input.guardianAccountId,
       input.scenario === 'revoked' ? 'REVOKED' : 'GRANTED', requestId, under14, noticeHash,
       JSON.stringify({
         channel: 'TEST',
         accepted_text_hash: 'b'.repeat(64),
         declared_age_band: 'UNDER_14',
         client_ip_hash: 'c'.repeat(64),
         user_agent_hash: 'd'.repeat(64),
       })]
    );
    const consentId = consent.rows[0].id as string;
    const consentVersion = input.scenario === 'stale-version' ? 2 : (consent.rows[0].version as number);
    await admin.query(
      `INSERT INTO person_compliance_profiles
         (person_id, age_band, minor_mode, guardian_person_id, guardian_consent_record_id,
          guardian_consent_version, verified_source)
       VALUES ($1,'UNDER_14',true,$2,$3,$4,'GUARDIAN_RELAY')`,
      [under14, input.guardianPersonId, consentId, consentVersion]
    );
    return { under14, consentId, consentVersion };
  }

  it('UNDER_14 group-only evidence always passes through the real consent gate', async () => {
    for (const scenario of ['valid', 'revoked', 'stale-version', 'notice-mismatch', 'missing'] as const) {
      const p = await prepare(`under14-${scenario}`);
      const { under14, consentId, consentVersion } = await createUnder14({
        familyId: p.familyId,
        guardianPersonId: p.owner.personId,
        guardianAccountId: p.owner.accountId,
        scenario,
      });
      const groupId = crypto.randomUUID();
      const sideA = await insertConflictingAssertion({
        familyId: p.familyId, caseId: p.caseId,
        subjectPersonId: under14, sourcePersonId: p.owner.personId,
        groupId, content: '未成年人来源 A',
      });
      const sideB = await insertConflictingAssertion({
        familyId: p.familyId, caseId: p.caseId,
        subjectPersonId: p.owner.personId, sourcePersonId: p.owner.personId,
        groupId, content: '成人来源 B',
      });
      const messageRef = { type: 'DIALOGUE_MESSAGE' as const, id: p.messageId };
      const candidate = baseContent(p.messageId, [messageRef]);
      candidate.conflicts = [{ topic: '冲突', conflictGroupId: groupId }];
      candidate.dependencyRefs = [
        { type: 'EVIDENCE', evidence: messageRef },
        { type: 'EVIDENCE', evidence: { type: 'ASSERTION', id: sideA } },
        { type: 'EVIDENCE', evidence: { type: 'ASSERTION', id: sideB } },
        { type: 'CONSENT', id: consentId, version: consentVersion },
      ];

      const before = await admin.query(
        `SELECT (SELECT count(*)::int FROM problem_formulations WHERE case_id=$1) AS f,
                (SELECT count(*)::int FROM case_events WHERE case_id=$1) AS e,
                (SELECT count(*)::int FROM business_audit_events WHERE resource_id=$1) AS a`,
        [p.caseId]
      );
      const res = await presentProblemFormulation(pool, {
        actor: { accountId: p.owner.accountId, personId: p.owner.personId },
        familyId: p.familyId, caseId: p.caseId,
        expectedCaseVersion: p.caseVersion,
        idempotencyKey: `t8pa1-u14-${scenario}-${Date.now()}-${seq++}`,
        content: candidate,
      });
      if (scenario === 'valid') {
        expect(res.status, scenario).toBe(200);
      } else {
        expect(res.status, scenario).toBe(403);
        const expected =
          scenario === 'revoked'
            ? 'GUARDIAN_CONSENT_REVOKED'
            : scenario === 'notice-mismatch'
              ? 'NOTICE_VERSION_MISMATCH'
              : 'GUARDIAN_CONSENT_REQUIRED';
        expect((res.body as { code: string }).code, scenario).toBe(expected);
        expect(await admin.query(
          `SELECT (SELECT count(*)::int FROM problem_formulations WHERE case_id=$1) AS f,
                  (SELECT count(*)::int FROM case_events WHERE case_id=$1) AS e,
                  (SELECT count(*)::int FROM business_audit_events WHERE resource_id=$1) AS a`,
          [p.caseId]
        )).toEqual(before);
      }
    }
  });
});