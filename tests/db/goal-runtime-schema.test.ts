import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client } from 'pg';

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

  it('cannot directly confirm a Goal while the Case remains GOALS', async () => {
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
      ).rejects.toThrow(/GOAL_CONFIRMATION_REQUIRES_PLANNING_TRANSITION/);
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
