/**
 * R02 — Evidence conflict-group immutability is enforced by the database on
 * both Evidence tables through the real runtime role.
 *
 * Frozen invariant (domain `validateConflictAssignment` / `assignConflictGroup`):
 *   NULL -> A   ALLOW  first legal grouping
 *   A    -> A   ALLOW  repeat / idempotent assignment
 *   A    -> B   DENY   silent migration
 *   A    -> NULL DENY  silent history erasure
 *
 * Before migration 041 the database accepted every one of those transitions
 * through the column-level runtime grant. These tests prove the DB now fails
 * closed exactly where the domain does, without widening any grant.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { assignConflictGroup } from '../../packages/domain/src/index.js';

const ADMIN_URL = process.env['TEST_ADMIN_DATABASE_URL']!;
const APP_URL = process.env['DATABASE_URL']!;

interface Fixture {
  accountId: string;
  personId: string;
  familyId: string;
  caseId: string;
}

let admin: pg.Client;
let app: pg.Pool;
let fx: Fixture;

const SET_ASSERTION_GROUP = `UPDATE assertions SET conflict_group_id = $1 WHERE id = $2`;
const SET_OBSERVATION_GROUP = `UPDATE observations SET conflict_group_id = $1 WHERE id = $2`;

async function setContext(client: pg.PoolClient) {
  await client.query('SELECT app.set_identity_context($1, $2)', [
    fx.accountId,
    'FAMILY_MANAGEMENT',
  ]);
  await client.query('SELECT app.set_family_context($1, $2, $3)', [
    fx.familyId,
    fx.personId,
    'FAMILY_MANAGEMENT',
  ]);
}

async function insertAssertion(content: string): Promise<string> {
  const { rows } = await admin.query(
    `INSERT INTO assertions
       (family_id, case_id, subject_person_id, source_kind, source_person_id,
        occurred_time_state, confirmation_status, kind, content)
     VALUES ($1, $2, $3, 'SELF_STATEMENT', $3, 'UNKNOWN', 'UNCONFIRMED', 'STATEMENT', $4)
     RETURNING id`,
    [fx.familyId, fx.caseId, fx.personId, content]
  );
  return rows[0].id;
}

async function insertObservation(value: string): Promise<string> {
  const { rows } = await admin.query(
    `INSERT INTO observations
       (family_id, case_id, subject_person_id, source_kind, source_person_id,
        occurred_time_state, confirmation_status, observation_code,
        value_state, value_type, value_text)
     VALUES ($1, $2, $3, 'SELF_STATEMENT', $3, 'UNKNOWN', 'UNCONFIRMED',
             'sleep.quality', 'KNOWN', 'TEXT', $4)
     RETURNING id`,
    [fx.familyId, fx.caseId, fx.personId, value]
  );
  return rows[0].id;
}

async function storedGroup(table: 'assertions' | 'observations', id: string) {
  const { rows } = await admin.query(
    `SELECT conflict_group_id FROM ${table} WHERE id = $1`,
    [id]
  );
  return rows[0]?.conflict_group_id ?? null;
}

async function asRuntime(
  fn: (client: pg.PoolClient) => Promise<void>
): Promise<void> {
  const client = await app.connect();
  try {
    await client.query('BEGIN');
    await setContext(client);
    try {
      await fn(client);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }
  } finally {
    client.release();
  }
}

async function expectSqlState(
  fn: (client: pg.PoolClient) => Promise<unknown>,
  code: string
) {
  const client = await app.connect();
  try {
    await client.query('BEGIN');
    await setContext(client);
    await expect(fn(client)).rejects.toMatchObject({ code });
  } finally {
    await client.query('ROLLBACK');
    client.release();
  }
}

describe('Evidence conflict-group DB immutability (R02)', () => {
  beforeAll(async () => {
    admin = new pg.Client({ connectionString: ADMIN_URL });
    await admin.connect();
    app = new pg.Pool({ connectionString: APP_URL, max: 4 });
    fx = await seed(admin);
  });

  afterAll(async () => {
    await cleanup(admin);
    await app.end();
    await admin.end();
  });

  it('assertions: NULL -> A is allowed and is the legal first grouping', async () => {
    const id = await insertAssertion('r02-first-assertion');
    const group = randomUUID();
    expect(await storedGroup('assertions', id)).toBeNull();

    await asRuntime(async (client) => {
      const result = await client.query(SET_ASSERTION_GROUP, [group, id]);
      expect(result.rowCount).toBe(1);
    });

    expect(await storedGroup('assertions', id)).toBe(group);
  });

  it('assertions: A -> A repeat assignment is allowed', async () => {
    const id = await insertAssertion('r02-repeat-assertion');
    const group = randomUUID();

    await asRuntime(async (client) => {
      await client.query(SET_ASSERTION_GROUP, [group, id]);
      const repeat = await client.query(SET_ASSERTION_GROUP, [group, id]);
      expect(repeat.rowCount).toBe(1);
    });

    expect(await storedGroup('assertions', id)).toBe(group);
  });

  it('assertions: A -> B migration is rejected with 23514', async () => {
    const id = await insertAssertion('r02-migrate-assertion');
    const group = randomUUID();
    const other = randomUUID();

    await asRuntime(async (client) => {
      await client.query(SET_ASSERTION_GROUP, [group, id]);
    });

    await expectSqlState(async (client) => {
      await client.query(SET_ASSERTION_GROUP, [other, id]);
    }, '23514');

    expect(await storedGroup('assertions', id)).toBe(group);
  });

  it('assertions: A -> NULL clearing is rejected with 23514', async () => {
    const id = await insertAssertion('r02-clear-assertion');
    const group = randomUUID();

    await asRuntime(async (client) => {
      await client.query(SET_ASSERTION_GROUP, [group, id]);
    });

    await expectSqlState(async (client) => {
      await client.query(SET_ASSERTION_GROUP, [null, id]);
    }, '23514');

    expect(await storedGroup('assertions', id)).toBe(group);
  });

  it('observations: NULL -> B, B -> B allowed; B -> C and B -> NULL rejected', async () => {
    const id = await insertObservation('r02-observation');
    const group = randomUUID();
    const other = randomUUID();

    await asRuntime(async (client) => {
      const first = await client.query(SET_OBSERVATION_GROUP, [group, id]);
      expect(first.rowCount).toBe(1);
      const repeat = await client.query(SET_OBSERVATION_GROUP, [group, id]);
      expect(repeat.rowCount).toBe(1);
    });

    await expectSqlState(async (client) => {
      await client.query(SET_OBSERVATION_GROUP, [other, id]);
    }, '23514');

    await expectSqlState(async (client) => {
      await client.query(SET_OBSERVATION_GROUP, [null, id]);
    }, '23514');

    expect(await storedGroup('observations', id)).toBe(group);
  });

  it('domain assignConflictGroup still groups unassigned evidence and never migrates', async () => {
    const ids = [await insertAssertion('r02-domain-1'), await insertAssertion('r02-domain-2')];
    const client = await app.connect();
    try {
      await client.query('BEGIN');
      await setContext(client);
      const result = await assignConflictGroup(
        client,
        {
          familyId: fx.familyId,
          caseId: fx.caseId,
          actorAccountId: fx.accountId,
          actorPersonId: fx.personId,
          purpose: 'FAMILY_MANAGEMENT',
        },
        ids.map((id) => ({ kind: 'ASSERTION' as const, id }))
      );
      await client.query('COMMIT');

      for (const id of ids) {
        expect(await storedGroup('assertions', id)).toBe(result.conflictGroupId);
      }
    } finally {
      client.release();
    }
  });

  it('superseding INSERT (append-only correction path) is not blocked by the trigger', async () => {
    const original = await insertAssertion('r02-superseded-original');
    const group = randomUUID();
    await asRuntime(async (client) => {
      await client.query(SET_ASSERTION_GROUP, [group, original]);
    });

    const { rows } = await admin.query(
      `INSERT INTO assertions
         (family_id, case_id, subject_person_id, source_kind, source_person_id,
          occurred_time_state, confirmation_status, kind, content, supersedes_id)
       VALUES ($1, $2, $3, 'SELF_STATEMENT', $3, 'UNKNOWN', 'UNCONFIRMED',
               'STATEMENT', 'r02-superseding', $4)
       RETURNING id`,
      [fx.familyId, fx.caseId, fx.personId, original]
    );
    expect(rows[0].id).toBeDefined();
    expect(await storedGroup('assertions', rows[0].id)).toBeNull();
    expect(await storedGroup('assertions', original)).toBe(group);
  });

  it('runtime role still has only the conflict_group_id column UPDATE grant', async () => {
    const { rows } = await admin.query(
      `SELECT table_name, column_name, privilege_type
         FROM information_schema.column_privileges
        WHERE grantee = 'xiaoshuyin_app'
          AND table_schema = 'public'
          AND table_name IN ('assertions', 'observations')
        ORDER BY table_name, column_name`
    );
    const updateGrants = rows.filter((r: any) => r.privilege_type === 'UPDATE');
    expect(
      updateGrants.map((r: any) => `${r.table_name}.${r.column_name}`).sort()
    ).toEqual(['assertions.conflict_group_id', 'observations.conflict_group_id']);
  });
});

async function seed(adminClient: pg.Client): Promise<Fixture> {
  const suffix = `${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
  const { rows: account } = await adminClient.query(
    `INSERT INTO accounts (wechat_openid) VALUES ($1) RETURNING id`,
    [`r02_${suffix}`]
  );
  const accountId = account[0].id;
  const { rows: person } = await adminClient.query(
    `INSERT INTO persons (account_id, created_by_account_id) VALUES ($1, $1) RETURNING id`,
    [accountId]
  );
  const personId = person[0].id;
  const { rows: family } = await adminClient.query(
    `INSERT INTO families (display_name, created_by_person_id) VALUES ($1, $2) RETURNING id`,
    [`r02-${suffix}`, personId]
  );
  const familyId = family[0].id;
  await adminClient.query(
    'INSERT INTO family_members (family_id, person_id) VALUES ($1, $2)',
    [familyId, personId]
  );
  const { rows: kase } = await adminClient.query(
    `INSERT INTO cases (family_id, created_by_person_id, status, phase, is_primary, version)
     VALUES ($1, $2, 'OPEN', 'INTAKE', true, 1) RETURNING id`,
    [familyId, personId]
  );
  return { accountId, personId, familyId, caseId: kase[0].id };
}

async function cleanup(adminClient: pg.Client) {
  const familyIds = `SELECT id FROM families WHERE display_name LIKE 'r02-%'`;
  await adminClient.query(
    `UPDATE assertions SET supersedes_id = NULL WHERE family_id IN (${familyIds})`
  );
  await adminClient.query(`DELETE FROM assertions WHERE family_id IN (${familyIds})`);
  await adminClient.query(`DELETE FROM observations WHERE family_id IN (${familyIds})`);
  await adminClient.query(`DELETE FROM cases WHERE family_id IN (${familyIds})`);
  await adminClient.query(`DELETE FROM family_members WHERE family_id IN (${familyIds})`);
  await adminClient.query(`DELETE FROM families WHERE display_name LIKE 'r02-%'`);
  await adminClient.query(
    `DELETE FROM persons WHERE account_id IN (
       SELECT id FROM accounts WHERE wechat_openid LIKE 'r02_%')`
  );
  await adminClient.query(`DELETE FROM accounts WHERE wechat_openid LIKE 'r02_%'`);
}
