/**
 * S8-FINAL-04 — PostgreSQL integer Case version boundary is enforced BEFORE SQL.
 *
 * Both Slice 8 increment seams (`advanceCasePhaseAndVersion` and
 * `bumpCaseVersionWithoutPhaseChange`) used `version = version + 1`. At
 * 2147483647 PostgreSQL raised 22003 and the API leaked a 500. The frozen
 * business-conflict code for a non-incrementable Case version is
 * STALE_CASE_VERSION (409).
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import {
  advanceCasePhaseAndVersion,
  bumpCaseVersionWithoutPhaseChange,
  ProblemFormulationError,
  PG_INTEGER_MAX,
} from '@xiaoshuyin/domain';
import { withRlsTransaction } from '../../apps/server/api/src/db/tx.js';
import { createAdminPool } from '../setup/db.js';

const PREFIX = 't8final04_';
const MAX = PG_INTEGER_MAX;

describe('S8-FINAL-04 Case version boundary (pre-SQL)', () => {
  let admin: pg.Pool;
  let pool: pg.Pool;
  let accountId: string;
  let personId: string;
  let familyId: string;
  let phaseCaseId: string;
  let versionCaseId: string;

  beforeAll(async () => {
    admin = createAdminPool();
    pool = new pg.Pool({ connectionString: process.env['DATABASE_URL'] });

    accountId = (
      await admin.query('INSERT INTO accounts (wechat_openid) VALUES ($1) RETURNING id', [
        `${PREFIX}${Date.now()}`,
      ])
    ).rows[0].id;
    personId = (
      await admin.query(
        'INSERT INTO persons (account_id, created_by_account_id) VALUES ($1, $1) RETURNING id',
        [accountId]
      )
    ).rows[0].id;
    familyId = (await admin.query('SELECT uuidv7() AS id')).rows[0].id;
    await admin.query('SELECT app.create_family($1, $2, $3)', [
      familyId,
      personId,
      'T8FINAL04',
    ]);
    await admin.query('INSERT INTO family_members (family_id, person_id) VALUES ($1, $2)', [
      familyId,
      personId,
    ]);

    const insertCase = async (phase: string) =>
      (
        await admin.query(
          `INSERT INTO cases (family_id, created_by_person_id, status, phase, is_primary, version)
           VALUES ($1, $2, 'OPEN', $3, false, $4) RETURNING id`,
          [familyId, personId, phase, MAX - 1]
        )
      ).rows[0].id as string;

    phaseCaseId = await insertCase('ASSESSMENT');
    versionCaseId = await insertCase('PROBLEM_FORMULATION');
  });

  afterAll(async () => {
    try {
      await admin.query('DELETE FROM cases WHERE family_id = $1', [familyId]);
      await admin.query('DELETE FROM family_members WHERE family_id = $1', [familyId]);
      await admin.query('DELETE FROM families WHERE id = $1', [familyId]);
      await admin.query('DELETE FROM persons WHERE account_id = $1', [accountId]);
      await admin.query('DELETE FROM accounts WHERE id = $1', [accountId]);
    } catch {
      // best-effort cleanup
    }
    await pool.end();
    await admin.end();
  });

  function inFamily<T>(fn: (tx: pg.PoolClient) => Promise<T>): Promise<T> {
    return withRlsTransaction(
      pool,
      { familyId, accountId, personId, purpose: 'FAMILY_MANAGEMENT' },
      fn
    );
  }

  async function caseRow(caseId: string) {
    return (
      await admin.query('SELECT phase, version FROM cases WHERE id = $1', [caseId])
    ).rows[0] as { phase: string; version: number };
  }

  it('phase-changing seam increments 2147483646 → 2147483647, then rejects before SQL', async () => {
    const advanced = await inFamily((tx) =>
      advanceCasePhaseAndVersion(tx, {
        caseId: phaseCaseId,
        expectedVersion: MAX - 1,
        fromPhase: 'ASSESSMENT',
        toPhase: 'PROBLEM_FORMULATION',
      })
    );
    expect(advanced.version).toBe(MAX);
    expect(advanced.phase).toBe('PROBLEM_FORMULATION');
    expect(await caseRow(phaseCaseId)).toEqual({ phase: 'PROBLEM_FORMULATION', version: MAX });

    const error = await inFamily((tx) =>
      advanceCasePhaseAndVersion(tx, {
        caseId: phaseCaseId,
        expectedVersion: MAX,
        fromPhase: 'PROBLEM_FORMULATION',
        toPhase: 'GOALS',
      })
    ).catch((err: unknown) => err);

    expect(error).toBeInstanceOf(ProblemFormulationError);
    expect((error as ProblemFormulationError).code).toBe('STALE_CASE_VERSION');
    // Never a PostgreSQL overflow leaked through the driver.
    expect((error as { code: string }).code).not.toBe('22003');
    expect(await caseRow(phaseCaseId)).toEqual({ phase: 'PROBLEM_FORMULATION', version: MAX });
  });

  it('version-only seam increments 2147483646 → 2147483647, then rejects before SQL', async () => {
    const bumped = await inFamily((tx) =>
      bumpCaseVersionWithoutPhaseChange(tx, {
        caseId: versionCaseId,
        expectedVersion: MAX - 1,
      })
    );
    expect(bumped.version).toBe(MAX);
    expect(bumped.phase).toBe('PROBLEM_FORMULATION');
    expect(await caseRow(versionCaseId)).toEqual({ phase: 'PROBLEM_FORMULATION', version: MAX });

    const error = await inFamily((tx) =>
      bumpCaseVersionWithoutPhaseChange(tx, {
        caseId: versionCaseId,
        expectedVersion: MAX,
      })
    ).catch((err: unknown) => err);

    expect(error).toBeInstanceOf(ProblemFormulationError);
    expect((error as ProblemFormulationError).code).toBe('STALE_CASE_VERSION');
    expect((error as { code: string }).code).not.toBe('22003');
    expect(await caseRow(versionCaseId)).toEqual({ phase: 'PROBLEM_FORMULATION', version: MAX });
  });
});