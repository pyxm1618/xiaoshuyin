/**
 * Slice 8 — problem_formulations schema / RLS / privilege invariants.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from 'pg';

const ADMIN_URL = process.env['TEST_ADMIN_DATABASE_URL']!;
const PREFIX = 't8schema_';

describe('problem formulation schema (Slice 8)', () => {
  let admin: Client;
  let accountId: string;
  let personId: string;
  let familyId: string;
  let caseId: string;

  beforeAll(async () => {
    admin = new Client({ connectionString: ADMIN_URL });
    await admin.connect();

    accountId = (
      await admin.query('INSERT INTO accounts (wechat_openid) VALUES ($1 || uuidv7()) RETURNING id', [
        PREFIX,
      ])
    ).rows[0].id;
    personId = (
      await admin.query(
        'INSERT INTO persons (account_id, created_by_account_id) VALUES ($1, $1) RETURNING id',
        [accountId]
      )
    ).rows[0].id;
    familyId = (await admin.query('SELECT uuidv7() AS id')).rows[0].id;
    await admin.query('SELECT app.create_family($1, $2, $3)', [familyId, personId, 'T8SCHEMA']);
    await admin.query('INSERT INTO family_members (family_id, person_id) VALUES ($1, $2)', [
      familyId,
      personId,
    ]);
    caseId = (
      await admin.query(
        `INSERT INTO cases (family_id, created_by_person_id, status, phase, is_primary, version)
         VALUES ($1, $2, 'OPEN', 'ASSESSMENT', true, 1) RETURNING id`,
        [familyId, personId]
      )
    ).rows[0].id;
  });

  afterAll(async () => {
    try {
      await admin.query('DELETE FROM problem_formulations WHERE family_id = $1', [familyId]);
      await admin.query('DELETE FROM cases WHERE family_id = $1', [familyId]);
      await admin.query('DELETE FROM family_members WHERE family_id = $1', [familyId]);
      await admin.query('DELETE FROM families WHERE id = $1', [familyId]);
      await admin.query('DELETE FROM persons WHERE account_id = $1', [accountId]);
      await admin.query('DELETE FROM accounts WHERE id = $1', [accountId]);
    } catch {
      // best-effort cleanup
    }
    await admin.end();
  });

  function ref(id: string) {
    return { type: 'ASSERTION', id };
  }

  async function insert(input: {
    status?: string;
    version?: number;
    supersedes?: number | null;
    confirmedBy?: string | null;
    confirmedAt?: Date | null;
  }) {
    const evidence = ref('11111111-1111-4111-8111-111111111111');
    return admin.query(
      `INSERT INTO problem_formulations
         (family_id, case_id, version, status, primary_problem, key_factors,
          evidence_refs, unknowns, conflicts, scene_fit, alternative_explanations,
          reassessment_conditions, exit_conditions, user_response,
          confirmed_by_person_id, confirmed_at, dependency_refs, supersedes_version)
       VALUES ($1, $2, $3, $4,
               jsonb_build_object('text', 'x', 'evidenceRefs', $5::jsonb),
               '[]'::jsonb, $5::jsonb, '[]'::jsonb, '[]'::jsonb, 'scene',
               '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, NULL,
               $6, $7, '[]'::jsonb, $8)`,
      [
        familyId,
        caseId,
        input.version ?? 1,
        input.status ?? 'PRESENTED',
        JSON.stringify([evidence]),
        input.confirmedBy ?? null,
        input.confirmedAt ?? null,
        input.supersedes ?? null,
      ]
    );
  }

  it('enum has the exact frozen six labels in order', async () => {
    const { rows } = await admin.query(
      `SELECT string_agg(enumlabel, ',' ORDER BY enumsortorder) AS labels
       FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
       WHERE t.typname = 'problem_formulation_status'`
    );
    expect(rows[0].labels).toBe(
      'DRAFT,PRESENTED,CONFIRMED,DISPUTED,NEEDS_REVIEW,SUPERSEDED'
    );
  });

  it('RLS is enabled and forced with Family policies and no DELETE policy', async () => {
    const rel = await admin.query(
      `SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname = 'problem_formulations'`
    );
    expect(rel.rows[0].relrowsecurity).toBe(true);
    expect(rel.rows[0].relforcerowsecurity).toBe(true);

    const policies = await admin.query(
      `SELECT polname AS policyname,
              CASE polcmd WHEN 'r' THEN 'SELECT' WHEN 'a' THEN 'INSERT'
                          WHEN 'w' THEN 'UPDATE' WHEN 'd' THEN 'DELETE' END AS cmd
       FROM pg_policy p JOIN pg_class c ON c.oid = p.polrelid
       WHERE c.relname = 'problem_formulations' ORDER BY polname`
    );
    expect(policies.rows.map((r: any) => r.policyname)).toEqual([
      'problem_formulations_insert',
      'problem_formulations_select',
      'problem_formulations_update',
    ]);
    expect(policies.rows.some((r: any) => r.cmd === 'd')).toBe(false);
  });

  it('runtime privileges are least-privilege', async () => {
    const { rows } = await admin.query(
      `SELECT
         has_table_privilege('xiaoshuyin_app','problem_formulations','SELECT') AS sel,
         has_table_privilege('xiaoshuyin_app','problem_formulations','INSERT') AS ins,
         has_table_privilege('xiaoshuyin_app','problem_formulations','DELETE') AS del,
         has_column_privilege('xiaoshuyin_app','problem_formulations','status','UPDATE') AS st,
         has_column_privilege('xiaoshuyin_app','problem_formulations','primary_problem','UPDATE') AS content,
         has_table_privilege('xiaoshuyin_app','cases','UPDATE') AS case_table_update,
         has_column_privilege('xiaoshuyin_app','cases','phase','UPDATE') AS case_phase_update`
    );
    expect(rows[0]).toMatchObject({
      sel: true,
      ins: true,
      del: false,
      st: true,
      content: false,
      case_table_update: false,
      case_phase_update: true,
    });
  });

  it('rejects at-rest DRAFT', async () => {
    await admin.query('DELETE FROM problem_formulations WHERE family_id = $1', [familyId]);
    await expect(insert({ status: 'DRAFT' })).rejects.toThrow();
  });

  it('rejects a non-contiguous version chain', async () => {
    await admin.query('DELETE FROM problem_formulations WHERE family_id = $1', [familyId]);
    await expect(insert({ version: 2, supersedes: null })).rejects.toThrow();
    await expect(insert({ version: 3, supersedes: 1 })).rejects.toThrow();
  });

  it('rejects a second current row for the same Case', async () => {
    await admin.query('DELETE FROM problem_formulations WHERE family_id = $1', [familyId]);
    await insert({ status: 'PRESENTED', version: 1 });
    await expect(
      insert({ status: 'DISPUTED', version: 2, supersedes: 1 })
    ).rejects.toThrow();
  });

  it('accepts a contiguous supersedes chain', async () => {
    await admin.query('DELETE FROM problem_formulations WHERE family_id = $1', [familyId]);
    await insert({ status: 'SUPERSEDED', version: 1 });
    await insert({ status: 'DISPUTED', version: 2, supersedes: 1 });
    const { rows } = await admin.query(
      `SELECT version, status, supersedes_version FROM problem_formulations
       WHERE family_id = $1 ORDER BY version`,
      [familyId]
    );
    expect(rows).toHaveLength(2);
    expect(rows[1]).toMatchObject({ version: 2, status: 'DISPUTED', supersedes_version: 1 });
  });

  it('rejects CONFIRMED without the confirmation pair', async () => {
    await admin.query('DELETE FROM problem_formulations WHERE family_id = $1', [familyId]);
    await expect(
      insert({ status: 'CONFIRMED', version: 1, confirmedBy: null, confirmedAt: null })
    ).rejects.toThrow();
  });
});