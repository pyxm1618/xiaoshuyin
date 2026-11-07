/**
 * AUD-II-002 — Conflict Group assignment under real concurrency.
 *
 * Frozen invariant: once `conflict_group_id` is assigned it can never migrate
 * to a different group. The repository now uses a conditional UPDATE:
 *
 *   SET conflict_group_id = $1
 *   WHERE id = $2 AND (conflict_group_id IS NULL OR conflict_group_id = $1)
 *
 * Two concurrent transactions that both read NULL therefore cannot both win:
 * the second one blocks on the row lock, then re-evaluates the predicate after
 * the first commits and gets rowCount = 0 → fail closed.
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

const CONDITIONAL_UPDATE = `UPDATE assertions
   SET conflict_group_id = $1
 WHERE id = $2
   AND (conflict_group_id IS NULL OR conflict_group_id = $1)`;

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

async function insertAssertions(count: number): Promise<string[]> {
  const ids: string[] = [];
  for (let i = 0; i < count; i++) {
    const { rows } = await admin.query(
      `INSERT INTO assertions
         (family_id, case_id, subject_person_id, source_kind, source_person_id,
          occurred_time_state, confirmation_status, kind, content)
       VALUES ($1, $2, $3, 'SELF_STATEMENT', $3, 'UNKNOWN', 'UNCONFIRMED', 'STATEMENT', $4)
       RETURNING id`,
      [fx.familyId, fx.caseId, fx.personId, `conflict-probe-${i}`]
    );
    ids.push(rows[0].id);
  }
  return ids;
}

async function finalGroup(id: string): Promise<string | null> {
  const { rows } = await admin.query(
    'SELECT conflict_group_id FROM assertions WHERE id = $1',
    [id]
  );
  return rows[0]?.conflict_group_id ?? null;
}

describe('Conflict group concurrency (AUD-II-002)', () => {
  beforeAll(async () => {
    admin = new pg.Client({ connectionString: ADMIN_URL });
    await admin.connect();
    app = new pg.Pool({ connectionString: APP_URL, max: 6 });
    fx = await seed(admin);
  });

  afterAll(async () => {
    await cleanup(admin);
    await app.end();
    await admin.end();
  });

  it(
    'two concurrent conditional UPDATEs: exactly one group wins, the other fails closed',
    async () => {
      const [assertionId] = await insertAssertions(1);
      const group1 = randomUUID();
      const group2 = randomUUID();

      const first = await app.connect();
      const second = await app.connect();
      try {
        await first.query('BEGIN');
        await second.query('BEGIN');
        await setContext(first);
        await setContext(second);

        // First transaction assigns G1 and holds the row lock.
        const win = await first.query(CONDITIONAL_UPDATE, [group1, assertionId]);
        expect(win.rowCount).toBe(1);

        // Second transaction read NULL before the first committed; its UPDATE
        // blocks on the row lock and must re-evaluate to 0 rows after commit.
        const losing = second.query(CONDITIONAL_UPDATE, [group2, assertionId]);
        await new Promise((resolve) => setTimeout(resolve, 100));
        await first.query('COMMIT');
        const lose = await losing;
        await second.query('COMMIT');

        expect(lose.rowCount).toBe(0);
        expect(await finalGroup(assertionId)).toBe(group1);
      } finally {
        first.release();
        second.release();
      }
    },
    30000
  );

  it(
    'NULL -> group and same -> same are allowed; existing different -> new is rejected',
    async () => {
      const [assertionId] = await insertAssertions(1);
      const group = randomUUID();
      const other = randomUUID();

      const client = await app.connect();
      try {
        await client.query('BEGIN');
        await setContext(client);

        const assignNull = await client.query(CONDITIONAL_UPDATE, [group, assertionId]);
        expect(assignNull.rowCount).toBe(1);

        const same = await client.query(CONDITIONAL_UPDATE, [group, assertionId]);
        expect(same.rowCount).toBe(1);

        const migrate = await client.query(CONDITIONAL_UPDATE, [other, assertionId]);
        expect(migrate.rowCount).toBe(0);

        await client.query('COMMIT');
        expect(await finalGroup(assertionId)).toBe(group);
      } finally {
        client.release();
      }
    },
    30000
  );

  it(
    'concurrent assignConflictGroup calls converge on one group and never migrate',
    async () => {
      const ids = await insertAssertions(2);
      const refs = ids.map((id) => ({ kind: 'ASSERTION' as const, id }));

      const run = async (client: pg.PoolClient) => {
        await client.query('BEGIN');
        try {
          await setContext(client);
          const result = await assignConflictGroup(
            client,
            {
              familyId: fx.familyId,
              caseId: fx.caseId,
              actorAccountId: fx.accountId,
              actorPersonId: fx.personId,
            },
            refs
          );
          await client.query('COMMIT');
          return { ok: true as const, groupId: result.conflictGroupId };
        } catch (err: any) {
          await client.query('ROLLBACK');
          return { ok: false as const, code: err?.code as string };
        }
      };

      const first = await app.connect();
      const second = await app.connect();
      try {
        const [a, b] = await Promise.all([run(first), run(second)]);
        const fulfilled = [a, b].filter((r) => r.ok) as Array<{
          ok: true;
          groupId: string;
        }>;
        expect(fulfilled.length).toBeGreaterThanOrEqual(1);

        if (fulfilled.length === 2) {
          expect(fulfilled[0]!.groupId).toBe(fulfilled[1]!.groupId);
        }
        for (const result of [a, b]) {
          if (!result.ok) {
            expect(result.code).toBe('EVIDENCE_CONFLICT_GROUP_IMMUTABLE');
          }
        }

        const groups = await Promise.all(ids.map(finalGroup));
        expect(groups[0]).not.toBeNull();
        expect(groups[1]).toBe(groups[0]);
        if (fulfilled.length > 0) {
          expect(groups[0]).toBe(fulfilled[0]!.groupId);
        }
      } finally {
        first.release();
        second.release();
      }
    },
    30000
  );
});

async function seed(adminClient: pg.Client): Promise<Fixture> {
  const suffix = `${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
  const { rows: account } = await adminClient.query(
    `INSERT INTO accounts (wechat_openid) VALUES ($1) RETURNING id`,
    [`aud002_${suffix}`]
  );
  const accountId = account[0].id;
  const { rows: person } = await adminClient.query(
    `INSERT INTO persons (account_id, created_by_account_id) VALUES ($1, $1) RETURNING id`,
    [accountId]
  );
  const personId = person[0].id;
  const { rows: family } = await adminClient.query(
    `INSERT INTO families (display_name, created_by_person_id) VALUES ($1, $2) RETURNING id`,
    [`aud002-${suffix}`, personId]
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
  try {
    await adminClient.query(
      `DELETE FROM assertions WHERE family_id IN (
         SELECT id FROM families WHERE display_name LIKE 'aud002-%')`
    );
    await adminClient.query(
      `DELETE FROM cases WHERE family_id IN (
         SELECT id FROM families WHERE display_name LIKE 'aud002-%')`
    );
    await adminClient.query(
      `DELETE FROM family_members WHERE family_id IN (
         SELECT id FROM families WHERE display_name LIKE 'aud002-%')`
    );
    await adminClient.query(
      `DELETE FROM families WHERE display_name LIKE 'aud002-%'`
    );
    await adminClient.query(
      `DELETE FROM persons WHERE created_by_account_id IN (
         SELECT id FROM accounts WHERE wechat_openid LIKE 'aud002\\_%')`
    );
    await adminClient.query(
      `DELETE FROM accounts WHERE wechat_openid LIKE 'aud002\\_%'`
    );
  } catch {
    // best-effort cleanup
  }
}