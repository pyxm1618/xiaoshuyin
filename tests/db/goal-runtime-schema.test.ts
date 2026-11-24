import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client } from 'pg';
import { getCurrentNoticeHash } from '@xiaoshuyin/compliance';

const ADMIN_URL = process.env['TEST_ADMIN_DATABASE_URL']!;
const APP_URL = process.env['DATABASE_URL']!;

describe('Common Core Goal DB guards', () => {
  let admin: Client;
  let app: Client;
  let accountId: string;
  let personId: string;
  let familyId: string;
  let caseId: string;
  let formulationId: string;

  beforeAll(async () => {
    admin = new Client({ connectionString: ADMIN_URL });
    app = new Client({ connectionString: APP_URL });
    await admin.connect();
    await app.connect();

    accountId = (await admin.query(
      "INSERT INTO accounts (wechat_openid) VALUES ('goal-db-' || uuidv7()) RETURNING id"
    )).rows[0].id;
    personId = (await admin.query(
      'INSERT INTO persons (account_id, created_by_account_id) VALUES ($1,$1) RETURNING id',
      [accountId]
    )).rows[0].id;
    familyId = (await admin.query('SELECT uuidv7() AS id')).rows[0].id;
    await admin.query('SELECT app.create_family($1,$2,$3)', [
      familyId,
      personId,
      'GOAL-DB',
    ]);
    await admin.query(
      'INSERT INTO family_members (family_id, person_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
      [familyId, personId]
    );
    caseId = (await admin.query(
      "INSERT INTO cases (family_id,created_by_person_id,status,phase,is_primary,version) " +
      "VALUES ($1,$2,'OPEN','GOALS',true,7) RETURNING id",
      [familyId, personId]
    )).rows[0].id;

    const evidence = [
      { type: 'ASSERTION', id: '11111111-1111-4111-8111-111111111111' },
    ];
    formulationId = (await admin.query(
      "INSERT INTO problem_formulations " +
      "(family_id,case_id,version,status,review_state,primary_problem,key_factors," +
      "evidence_refs,unknowns,conflicts,scene_fit,alternative_explanations," +
      "reassessment_conditions,exit_conditions,user_response,confirmed_by_person_id," +
      "confirmed_at,dependency_refs,supersedes_version) " +
      "VALUES ($1,$2,1,'CONFIRMED','CURRENT'," +
      "jsonb_build_object('text','goal basis','evidenceRefs',$3::jsonb)," +
      "'[]'::jsonb,$3::jsonb,'[]'::jsonb,'[]'::jsonb,'digital-use'," +
      "'[]'::jsonb,'[]'::jsonb,'[]'::jsonb," +
      "jsonb_build_object('kind','CONFIRM','actorPersonId',$4::uuid::text,'respondedAt',now()::text)," +
      "$4::uuid,now(),$5::jsonb,NULL) RETURNING id",
      [
        familyId,
        caseId,
        JSON.stringify(evidence),
        personId,
        JSON.stringify([{ type: 'EVIDENCE', evidence: evidence[0] }]),
      ]
    )).rows[0].id;
  });

  afterAll(async () => {
    await app.end().catch(() => undefined);
    await admin.query("DELETE FROM scene_node_states WHERE case_id=$1", [caseId]).catch(() => undefined);
    await admin.query("DELETE FROM assertions WHERE case_id=$1 AND supersedes_id='11111111-1111-4111-8111-111111111111'::uuid", [caseId]).catch(() => undefined);
    await admin.query("DELETE FROM assertions WHERE case_id=$1 AND id='11111111-1111-4111-8111-111111111111'::uuid", [caseId]).catch(() => undefined);
    await admin.query('DELETE FROM person_compliance_profiles WHERE person_id=$1', [personId]).catch(() => undefined);
    await admin.query('DELETE FROM goals WHERE family_id=$1', [familyId]).catch(() => undefined);
    await admin.query('DELETE FROM problem_formulations WHERE family_id=$1', [familyId]).catch(() => undefined);
    await admin.query('DELETE FROM cases WHERE family_id=$1', [familyId]).catch(() => undefined);
    await admin.query('DELETE FROM family_members WHERE family_id=$1', [familyId]).catch(() => undefined);
    await admin.query('DELETE FROM families WHERE id=$1', [familyId]).catch(() => undefined);
    await admin.query('DELETE FROM persons WHERE id=$1', [personId]).catch(() => undefined);
    await admin.query('DELETE FROM accounts WHERE id=$1', [accountId]).catch(() => undefined);
    await admin.end().catch(() => undefined);
  });

  function directInsertSql() {
    return "INSERT INTO goals " +
      "(family_id,case_id,version,problem_formulation_id,problem_formulation_version," +
      "baseline_refs,target_description,observation_method,observation_window," +
      "protective_conditions,parent_actions,review_point,dependency_refs," +
      "participant_responsibilities,saved_by_person_id,confirmation_state," +
      "confirmed_by_person_id,confirmed_at) " +
      "VALUES ($1,$2,1,$3,1," +
      "'[{\"type\":\"ASSERTION\",\"id\":\"11111111-1111-4111-8111-111111111111\"}]'::jsonb," +
      "'target','observe','14 days','[\"protect\"]'::jsonb,'[\"parent action\"]'::jsonb," +
      "'review','[{\"type\":\"EVIDENCE\",\"evidence\":{\"type\":\"ASSERTION\",\"id\":\"11111111-1111-4111-8111-111111111111\"}}]'::jsonb," +
      "'[]'::jsonb,$4,'CONFIRMED',$4,now())";
  }

  function savedInsertSql() {
    return "INSERT INTO goals " +
      "(family_id,case_id,version,problem_formulation_id,problem_formulation_version," +
      "baseline_refs,target_description,observation_method,observation_window," +
      "protective_conditions,parent_actions,review_point,dependency_refs," +
      "participant_responsibilities,saved_by_person_id) " +
      "VALUES ($1,$2,1,$3,1," +
      "'[{\"type\":\"ASSERTION\",\"id\":\"11111111-1111-4111-8111-111111111111\"}]'::jsonb," +
      "'target','observe','14 days','[\"protect\"]'::jsonb,'[\"parent action\"]'::jsonb," +
      "'review','[{\"type\":\"EVIDENCE\",\"evidence\":{\"type\":\"ASSERTION\",\"id\":\"11111111-1111-4111-8111-111111111111\"}}]'::jsonb," +
      "'[]'::jsonb,$4) RETURNING id";
  }

  async function seedPrivilegedTransitionPrerequisites(
    ageBand: 'ADULT' | 'UNKNOWN' = 'ADULT'
  ) {
    await admin.query(
      `INSERT INTO assertions (
         id,family_id,case_id,subject_person_id,source_kind,source_person_id,
         occurred_time_state,occurred_at,valid_from,confirmation_status,kind,content
       ) VALUES (
         '11111111-1111-4111-8111-111111111111'::uuid,$1,$2,$3,
         'SELF_STATEMENT',$3,'KNOWN',now(),now()-interval '1 day',
         'SOURCE_CONFIRMED','STATEMENT','goal db authoritative evidence'
       )`,
      [familyId, caseId, personId]
    );
    await admin.query(
      `INSERT INTO person_compliance_profiles
         (person_id,age_band,minor_mode,verified_source)
       VALUES ($1,$2::age_band,false,'SELF_STATEMENT')`,
      [personId, ageBand]
    );
    await admin.query(
      `INSERT INTO scene_node_states
         (family_id,case_id,scene_package_version,node_code,source_node_code,status,completed_at)
       VALUES ($1,$2,'goal-db-v1','A1001','A1001','COMPLETED',now())`,
      [familyId, caseId]
    );
    await admin.query(
      `INSERT INTO scene_node_states
         (family_id,case_id,scene_package_version,node_code,source_node_code,status,completed_at)
       VALUES ($1,$2,'goal-db-v1','A2010','A2007','COMPLETED',now())`,
      [familyId, caseId]
    );
  }

  async function cleanupPrivilegedTransitionPrerequisites() {
    await admin.query(
      "DELETE FROM scene_node_states WHERE case_id=$1 AND node_code IN ('A2010','A1001')",
      [caseId]
    );
    await admin.query(
      "DELETE FROM assertions WHERE case_id=$1 AND supersedes_id='11111111-1111-4111-8111-111111111111'::uuid",
      [caseId]
    );
    await admin.query(
      "DELETE FROM assertions WHERE case_id=$1 AND id='11111111-1111-4111-8111-111111111111'::uuid",
      [caseId]
    );
    await admin.query(
      'DELETE FROM person_compliance_profiles WHERE person_id=$1',
      [personId]
    );
  }

  it('forces RLS and denies content mutation / delete to runtime', async () => {
    const rel = await admin.query(
      "SELECT relrowsecurity,relforcerowsecurity FROM pg_class WHERE relname='goals'"
    );
    expect(rel.rows[0]).toEqual({
      relrowsecurity: true,
      relforcerowsecurity: true,
    });

    const priv = await admin.query(
      "SELECT " +
      "has_table_privilege('xiaoshuyin_app','goals','SELECT') AS sel," +
      "has_table_privilege('xiaoshuyin_app','goals','INSERT') AS ins," +
      "has_table_privilege('xiaoshuyin_app','goals','DELETE') AS del," +
      "has_column_privilege('xiaoshuyin_app','goals','target_description','UPDATE') AS content"
    );
    expect(priv.rows[0]).toEqual({
      sel: true,
      ins: true,
      del: false,
      content: false,
    });

    const role = await admin.query(
      "SELECT rolbypassrls FROM pg_roles WHERE rolname='xiaoshuyin_app'"
    );
    expect(role.rows[0].rolbypassrls).toBe(false);

    const constraints = await admin.query(
      "SELECT conname,pg_get_constraintdef(oid,true) AS def " +
      "FROM pg_constraint WHERE conrelid='goals'::regclass " +
      "AND conname IN ('goals_case_family_fk','goals_formulation_exact_fk') " +
      "ORDER BY conname"
    );
    expect(constraints.rows).toHaveLength(2);
    expect(constraints.rows.find((r: any) => r.conname === 'goals_case_family_fk')?.def)
      .toContain('FOREIGN KEY (case_id, family_id)');
    expect(constraints.rows.find((r: any) => r.conname === 'goals_formulation_exact_fk')?.def)
      .toContain('FOREIGN KEY (problem_formulation_id, case_id, family_id, problem_formulation_version)');
  });

  it('rejects constructing a pre-confirmed Goal through the runtime role', async () => {
    await app.query('BEGIN');
    try {
      await app.query('SELECT app.set_identity_context($1,$2)', [
        accountId,
        'FAMILY_MANAGEMENT',
      ]);
      await app.query('SELECT app.set_family_context($1,$2,$3)', [
        familyId,
        personId,
        'FAMILY_MANAGEMENT',
      ]);
      await expect(
        app.query(directInsertSql(), [
          familyId,
          caseId,
          formulationId,
          personId,
        ])
      ).rejects.toThrow(/GOAL_INSERT_MUST_BE_UNCONFIRMED/);
    } finally {
      await app.query('ROLLBACK');
    }
  });

  it('enforces Family RLS on a legal unconfirmed Goal', async () => {
    const inserted = await admin.query(savedInsertSql(), [
      familyId,
      caseId,
      formulationId,
      personId,
    ]);
    const goalRowId = inserted.rows[0].id;

    await app.query('BEGIN');
    try {
      await app.query('SELECT app.set_identity_context($1,$2)', [
        accountId,
        'FAMILY_MANAGEMENT',
      ]);
      const hidden = await app.query(
        'SELECT count(*)::int AS n FROM goals WHERE id=$1',
        [goalRowId]
      );
      expect(hidden.rows[0].n).toBe(0);

      await app.query('SELECT app.set_family_context($1,$2,$3)', [
        familyId,
        personId,
        'FAMILY_MANAGEMENT',
      ]);
      const visible = await app.query(
        'SELECT count(*)::int AS n FROM goals WHERE id=$1',
        [goalRowId]
      );
      expect(visible.rows[0].n).toBe(1);
    } finally {
      await app.query('ROLLBACK');
      await admin.query('DELETE FROM goals WHERE id=$1', [goalRowId]);
    }
  });

  it('binds saved_by_person_id to the authenticated production actor', async () => {
    await app.query('BEGIN');
    try {
      await app.query('SELECT app.set_identity_context($1,$2)', [
        accountId,
        'FAMILY_MANAGEMENT',
      ]);
      await app.query('SELECT app.set_family_context($1,$2,$3)', [
        familyId,
        personId,
        'FAMILY_MANAGEMENT',
      ]);
      await expect(
        app.query(savedInsertSql(), [
          familyId,
          caseId,
          formulationId,
          crypto.randomUUID(),
        ])
      ).rejects.toThrow(/GOAL_SAVER_MUST_BE_AUTHENTICATED_ACTOR/);
    } finally {
      await app.query('ROLLBACK');
    }
  });

  it('denies direct Goal confirmation writes to the runtime role', async () => {
    const inserted = await admin.query(savedInsertSql(), [
      familyId,
      caseId,
      formulationId,
      personId,
    ]);
    const goalRowId = inserted.rows[0].id as string;

    await app.query('BEGIN');
    try {
      await app.query('SELECT app.set_identity_context($1,$2)', [
        accountId,
        'FAMILY_MANAGEMENT',
      ]);
      await app.query('SELECT app.set_family_context($1,$2,$3)', [
        familyId,
        personId,
        'FAMILY_MANAGEMENT',
      ]);
      await expect(
        app.query(
          "UPDATE goals SET confirmation_state='CONFIRMED'," +
            "confirmed_by_person_id=$2,confirmed_at=now(),updated_at=now() " +
            "WHERE id=$1",
          [goalRowId, personId]
        )
      ).rejects.toMatchObject({ code: '42501' });
    } finally {
      await app.query('ROLLBACK');
    }

    const row = await admin.query(
      'SELECT confirmation_state,confirmed_by_person_id,confirmed_at FROM goals WHERE id=$1',
      [goalRowId]
    );
    expect(row.rows[0]).toMatchObject({
      confirmation_state: 'UNCONFIRMED',
      confirmed_by_person_id: null,
      confirmed_at: null,
    });
    await admin.query('DELETE FROM goals WHERE id=$1', [goalRowId]);
  });

  it('does not expose an unguarded formal transition function to the app role', async () => {
    const inserted = await admin.query(savedInsertSql(), [
      familyId,
      caseId,
      formulationId,
      personId,
    ]);
    const goalRow = await admin.query(
      'SELECT goal_id,version FROM goals WHERE id=$1',
      [inserted.rows[0].id]
    );

    await app.query('BEGIN');
    try {
      await app.query('SELECT app.set_identity_context($1,$2)', [
        accountId,
        'FAMILY_MANAGEMENT',
      ]);
      await app.query('SELECT app.set_family_context($1,$2,$3)', [
        familyId,
        personId,
        'FAMILY_MANAGEMENT',
      ]);
      await expect(
        app.query(
          'SELECT app.confirm_goal_transition($1,$2,$3,$4,$5)',
          [
            caseId,
            7,
            goalRow.rows[0].goal_id,
            goalRow.rows[0].version,
            personId,
          ]
        )
      ).rejects.toMatchObject({
        code: '23514',
        message: expect.stringMatching(/GOAL_CONFIRM_TRANSITION_A2010_REQUIRED/),
      });
    } finally {
      await app.query('ROLLBACK');
    }

    const finalState = await admin.query(
      'SELECT c.phase,g.confirmation_state ' +
        'FROM cases c JOIN goals g ON g.case_id=c.id ' +
        'WHERE c.id=$1 AND g.id=$2',
      [caseId, inserted.rows[0].id]
    );
    expect(finalState.rows[0]).toEqual({
      phase: 'GOALS',
      confirmation_state: 'UNCONFIRMED',
    });
    await admin.query('DELETE FROM goals WHERE id=$1', [inserted.rows[0].id]);
  });


  it('binds privileged ConfirmGoal to the authenticated Account Person', async () => {
    const inserted = await admin.query(savedInsertSql(), [
      familyId,
      caseId,
      formulationId,
      personId,
    ]);
    const goalRow = await admin.query(
      'SELECT goal_id,version FROM goals WHERE id=$1',
      [inserted.rows[0].id]
    );

    await app.query('BEGIN');
    try {
      await app.query('SELECT app.set_identity_context($1,$2)', [
        crypto.randomUUID(),
        'FAMILY_MANAGEMENT',
      ]);
      await app.query('SELECT app.set_family_context($1,$2,$3)', [
        familyId,
        personId,
        'FAMILY_MANAGEMENT',
      ]);
      await expect(
        app.query(
          'SELECT app.confirm_goal_transition($1,$2,$3,$4,$5)',
          [
            caseId,
            7,
            goalRow.rows[0].goal_id,
            goalRow.rows[0].version,
            personId,
          ]
        )
      ).rejects.toMatchObject({
        code: '23514',
        message: expect.stringMatching(/GOAL_CONFIRM_TRANSITION_CONTEXT_INVALID/),
      });
    } finally {
      await app.query('ROLLBACK');
    }

    await admin.query('DELETE FROM goals WHERE id=$1', [inserted.rows[0].id]);
  });

  it('cannot use the privileged transition to bypass authoritative Evidence revalidation', async () => {
    await seedPrivilegedTransitionPrerequisites('ADULT');
    const inserted = await admin.query(savedInsertSql(), [
      familyId,
      caseId,
      formulationId,
      personId,
    ]);
    const goalRow = await admin.query(
      'SELECT goal_id,version FROM goals WHERE id=$1',
      [inserted.rows[0].id]
    );
    const successorId = crypto.randomUUID();
    await admin.query(
      `INSERT INTO assertions (
         id,family_id,case_id,subject_person_id,source_kind,source_person_id,
         occurred_time_state,occurred_at,valid_from,confirmation_status,
         supersedes_id,kind,content
       ) VALUES (
         $1,$2,$3,$4,'SELF_STATEMENT',$4,'KNOWN',now(),now(),
         'SOURCE_CONFIRMED','11111111-1111-4111-8111-111111111111'::uuid,
         'STATEMENT','superseding goal db evidence'
       )`,
      [successorId, familyId, caseId, personId]
    );

    try {
      await app.query('BEGIN');
      try {
        await app.query('SELECT app.set_identity_context($1,$2)', [
          accountId,
          'FAMILY_MANAGEMENT',
        ]);
        await app.query('SELECT app.set_family_context($1,$2,$3)', [
          familyId,
          personId,
          'FAMILY_MANAGEMENT',
        ]);
        await expect(
          app.query(
            'SELECT app.confirm_goal_transition($1,$2,$3,$4,$5)',
            [
              caseId,
              7,
              goalRow.rows[0].goal_id,
              goalRow.rows[0].version,
              personId,
            ]
          )
        ).rejects.toMatchObject({
          code: '23514',
          message: expect.stringMatching(/GOAL_CONFIRM_TRANSITION_EVIDENCE_INVALID/),
        });
      } finally {
        await app.query('ROLLBACK');
      }

      const finalState = await admin.query(
        'SELECT c.phase,g.confirmation_state FROM cases c JOIN goals g ON g.case_id=c.id WHERE c.id=$1 AND g.id=$2',
        [caseId, inserted.rows[0].id]
      );
      expect(finalState.rows[0]).toEqual({
        phase: 'GOALS',
        confirmation_state: 'UNCONFIRMED',
      });
    } finally {
      await admin.query('DELETE FROM goals WHERE id=$1', [inserted.rows[0].id]);
      await cleanupPrivilegedTransitionPrerequisites();
    }
  });

  it('cannot use the privileged transition to bypass the formal Compliance gate', async () => {
    await seedPrivilegedTransitionPrerequisites('UNKNOWN');
    const inserted = await admin.query(savedInsertSql(), [
      familyId,
      caseId,
      formulationId,
      personId,
    ]);
    const goalRow = await admin.query(
      'SELECT goal_id,version FROM goals WHERE id=$1',
      [inserted.rows[0].id]
    );

    try {
      await app.query('BEGIN');
      try {
        await app.query('SELECT app.set_identity_context($1,$2)', [
          accountId,
          'FAMILY_MANAGEMENT',
        ]);
        await app.query('SELECT app.set_family_context($1,$2,$3)', [
          familyId,
          personId,
          'FAMILY_MANAGEMENT',
        ]);
        await expect(
          app.query(
            'SELECT app.confirm_goal_transition($1,$2,$3,$4,$5)',
            [
              caseId,
              7,
              goalRow.rows[0].goal_id,
              goalRow.rows[0].version,
              personId,
            ]
          )
        ).rejects.toMatchObject({
          code: '23514',
          message: expect.stringMatching(/GOAL_CONFIRM_TRANSITION_COMPLIANCE_INVALID/),
        });
      } finally {
        await app.query('ROLLBACK');
      }

      const finalState = await admin.query(
        'SELECT c.phase,g.confirmation_state FROM cases c JOIN goals g ON g.case_id=c.id WHERE c.id=$1 AND g.id=$2',
        [caseId, inserted.rows[0].id]
      );
      expect(finalState.rows[0]).toEqual({
        phase: 'GOALS',
        confirmation_state: 'UNCONFIRMED',
      });
    } finally {
      await admin.query('DELETE FROM goals WHERE id=$1', [inserted.rows[0].id]);
      await cleanupPrivilegedTransitionPrerequisites();
    }
  });

  it('blocks a bound UNDER_14 Digital Use target even with valid guardian consent and no ACTIVE participation', async () => {
    await seedPrivilegedTransitionPrerequisites('ADULT');
    const targetPersonId=(await admin.query(
      'INSERT INTO persons (account_id,created_by_account_id) VALUES (NULL,$1) RETURNING id',
      [accountId]
    )).rows[0].id as string;
    await admin.query('INSERT INTO family_members (family_id,person_id) VALUES ($1,$2)',[familyId,targetPersonId]);
    const requestId=(await admin.query(
      `INSERT INTO guardian_consent_requests
         (family_id,guardian_person_id,subject_person_id,declared_age_band,notice_version,notice_hash,status,expires_at,completed_at)
       VALUES ($1,$2,$3,'UNDER_14','v1',$4,'GRANTED',now()+interval '1 hour',now()) RETURNING id`,
      [familyId,personId,targetPersonId,getCurrentNoticeHash()]
    )).rows[0].id as string;
    const consent=(await admin.query(
      `INSERT INTO consent_records
         (family_id,guardian_person_id,guardian_account_id,purpose,decision,version,onboarding_request_id,bound_person_id,bound_at,notice_version,notice_hash,policy_version,evidence)
       VALUES ($1,$2,$3,'UNDER_14_GUARDIAN_CONSENT','GRANTED',1,$4,$5,now(),'v1',$6,'v1',$7::jsonb)
       RETURNING id,version`,
      [familyId,personId,accountId,requestId,targetPersonId,getCurrentNoticeHash(),JSON.stringify({
        channel:'TEST',accepted_text_hash:'b'.repeat(64),declared_age_band:'UNDER_14',
        client_ip_hash:'c'.repeat(64),user_agent_hash:'d'.repeat(64),
      })]
    )).rows[0] as {id:string;version:number};
    await admin.query(
      `INSERT INTO person_compliance_profiles
         (person_id,age_band,minor_mode,guardian_person_id,guardian_consent_record_id,guardian_consent_version,verified_source)
       VALUES ($1,'UNDER_14',true,$2,$3,$4,'GUARDIAN_RELAY')`,
      [targetPersonId,personId,consent.id,consent.version]
    );
    await admin.query(
      'INSERT INTO digital_use_assessment_context (case_id,family_id,target_person_id,created_by_person_id) VALUES ($1,$2,$3,$4)',
      [caseId,familyId,targetPersonId,personId]
    );
    const inserted=await admin.query(savedInsertSql(),[familyId,caseId,formulationId,personId]);
    const goalRowId=inserted.rows[0].id as string;
    const goalRow=await admin.query('SELECT goal_id,version FROM goals WHERE id=$1',[goalRowId]);
    try {
      const participants=await admin.query(
        "SELECT count(*)::int AS n FROM case_participants WHERE case_id=$1 AND person_id=$2 AND state='ACTIVE'",
        [caseId,targetPersonId]
      );
      expect(participants.rows[0].n).toBe(0);
      await app.query('BEGIN');
      try {
        await app.query('SELECT app.set_identity_context($1,$2)',[accountId,'FAMILY_MANAGEMENT']);
        await app.query('SELECT app.set_family_context($1,$2,$3)',[familyId,personId,'FAMILY_MANAGEMENT']);
        await expect(app.query(
          'SELECT app.confirm_goal_transition($1,$2,$3,$4,$5)',
          [caseId,7,goalRow.rows[0].goal_id,goalRow.rows[0].version,personId]
        )).rejects.toMatchObject({
          code:'23514',
          message:expect.stringMatching(/GOAL_CONFIRM_TRANSITION_COMPLIANCE_INVALID/),
        });
      } finally {
        await app.query('ROLLBACK');
      }
      const state=await admin.query(
        'SELECT c.phase,g.confirmation_state FROM cases c JOIN goals g ON g.case_id=c.id WHERE c.id=$1 AND g.id=$2',
        [caseId,goalRowId]
      );
      expect(state.rows[0]).toEqual({phase:'GOALS',confirmation_state:'UNCONFIRMED'});
    } finally {
      await admin.query('DELETE FROM goals WHERE id=$1',[goalRowId]).catch(()=>undefined);
      await admin.query('DELETE FROM digital_use_assessment_context WHERE case_id=$1',[caseId]).catch(()=>undefined);
      await admin.query('DELETE FROM person_compliance_profiles WHERE person_id=$1',[targetPersonId]).catch(()=>undefined);
      await admin.query('DELETE FROM consent_records WHERE id=$1',[consent.id]).catch(()=>undefined);
      await admin.query('DELETE FROM guardian_consent_requests WHERE id=$1',[requestId]).catch(()=>undefined);
      await admin.query('DELETE FROM family_members WHERE family_id=$1 AND person_id=$2',[familyId,targetPersonId]).catch(()=>undefined);
      await admin.query('DELETE FROM persons WHERE id=$1',[targetPersonId]).catch(()=>undefined);
      await cleanupPrivilegedTransitionPrerequisites();
    }
  });

  it('writes the Case, Goal, Case Event and Business Audit in the persistence primitive', async () => {
    await seedPrivilegedTransitionPrerequisites();
    const inserted = await admin.query(savedInsertSql(), [familyId, caseId, formulationId, personId]);
    const goalRowId = inserted.rows[0].id;
    const { rows: [goal] } = await admin.query(
      'SELECT goal_id,version FROM goals WHERE id=$1',
      [goalRowId]
    );

    await app.query('BEGIN');
    try {
      await app.query('SELECT app.set_identity_context($1,$2)', [accountId, 'FAMILY_MANAGEMENT']);
      await app.query('SELECT app.set_family_context($1,$2,$3)', [familyId, personId, 'FAMILY_MANAGEMENT']);

      const transition = await app.query(
        'SELECT app.confirm_goal_transition($1,$2,$3,$4,$5) AS case_version',
        [caseId, 7, goal.goal_id, goal.version, personId]
      );
      expect(transition.rows).toEqual([{ case_version: 8 }]);

      const { rows } = await app.query(
        `SELECT c.phase,c.version,g.confirmation_state,
                (SELECT count(*)::int FROM case_events
                  WHERE case_id=c.id AND event_type='CASE_GOAL_CONFIRMED') AS events,
                (SELECT count(*)::int FROM business_audit_events
                  WHERE family_id=c.family_id AND resource_id=g.goal_id
                    AND event_type='GOAL_CONFIRMED') AS audits
           FROM cases c JOIN goals g ON g.case_id=c.id
          WHERE c.id=$1 AND g.id=$2`,
        [caseId, goalRowId]
      );
      expect(rows).toEqual([{
        phase: 'PLANNING', version: 8, confirmation_state: 'CONFIRMED',
        events: 1, audits: 1,
      }]);
    } finally {
      await app.query('ROLLBACK');
      await admin.query('DELETE FROM goals WHERE id=$1', [goalRowId]);
      await cleanupPrivilegedTransitionPrerequisites();
    }
  });

  it('blocks direct app-role GOALS -> PLANNING plus Goal confirmation bypass', async () => {
    const inserted = await admin.query(savedInsertSql(), [
      familyId,
      caseId,
      formulationId,
      personId,
    ]);
    const goalRowId = inserted.rows[0].id as string;

    let attackError: unknown = null;
    await app.query('BEGIN');
    try {
      await app.query('SELECT app.set_identity_context($1,$2)', [
        accountId,
        'FAMILY_MANAGEMENT',
      ]);
      await app.query('SELECT app.set_family_context($1,$2,$3)', [
        familyId,
        personId,
        'FAMILY_MANAGEMENT',
      ]);

      await app.query(
        "UPDATE cases SET phase='PLANNING', version=version+1, updated_at=now() WHERE id=$1",
        [caseId]
      );
      await app.query(
        "UPDATE goals SET confirmation_state='CONFIRMED'," +
          "confirmed_by_person_id=$2,confirmed_at=now(),updated_at=now() " +
          "WHERE id=$1",
        [goalRowId, personId]
      );
    } catch (error) {
      attackError = error;
    } finally {
      await app.query('ROLLBACK');
    }

    if (attackError === null) {
      throw new Error('HIGH_001_BYPASS_SUCCEEDED');
    }

    const pgError = attackError as { code?: string; message?: string };
    expect(pgError.code).toBe('23514');

    const finalState = await admin.query(
      "SELECT c.phase, g.confirmation_state, g.confirmed_by_person_id, g.confirmed_at " +
        "FROM cases c JOIN goals g ON g.case_id=c.id WHERE c.id=$1 AND g.id=$2",
      [caseId, goalRowId]
    );
    expect(finalState.rows[0]).toMatchObject({
      phase: 'GOALS',
      confirmation_state: 'UNCONFIRMED',
      confirmed_by_person_id: null,
      confirmed_at: null,
    });

    await admin.query('DELETE FROM goals WHERE id=$1', [goalRowId]);
  });

});
