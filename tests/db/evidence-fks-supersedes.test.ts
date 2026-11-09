/**
 * T014 — composite FKs, source-message provenance and supersedes history.
 *
 * RED before the migration: the tables do not exist, so every fixture insert
 * fails before reaching the intended assertion.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';

const ADMIN_URL = process.env['TEST_ADMIN_DATABASE_URL']!;
const APP_URL = process.env['DATABASE_URL']!;

interface Fixture {
  familyA: string;
  caseA: string;
  managerA: string;
  subjectA: string;
  guardianA: string;
  familyB: string;
  caseB: string;
  managerB: string;
  messageA: string;
  messageB: string;
}

describe('Evidence composite FKs / supersedes (T014)', () => {
  let admin: pg.Client;
  let app: pg.Pool;
  let fx: Seed;
  let seq = 0;

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

  async function insertAssertion(overrides: Record<string, unknown> = {}) {
    seq += 1;
    const row: Record<string, unknown> = {
      family_id: fx.familyA,
      case_id: fx.caseA,
      subject_person_id: fx.subjectA,
      source_kind: 'GUARDIAN_RELAY',
      source_person_id: fx.guardianA,
      source_message_id: null,
      occurred_time_state: 'UNKNOWN',
      occurred_at: null,
      valid_from: null,
      valid_until: null,
      confirmation_status: 'UNCONFIRMED',
      supersedes_id: null,
      conflict_group_id: null,
      kind: 'STATEMENT',
      content: `statement ${seq}`,
      ...overrides,
    };
    const cols = Object.keys(row);
    const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
    return admin.query(
      `INSERT INTO assertions (${cols.join(', ')}) VALUES (${placeholders}) RETURNING id`,
      cols.map((c) => row[c])
    );
  }

  it('rejects a subject Person that is only a member of another Family', async () => {
    await expect(
      insertAssertion({ subject_person_id: fx.managerB })
    ).rejects.toThrow(/foreign key|violates/i);
  });

  it('rejects a source Person that is only a member of another Family', async () => {
    await expect(
      insertAssertion({ source_person_id: fx.managerB })
    ).rejects.toThrow(/foreign key|violates/i);
  });

  it('rejects a source message that belongs to another Family/Case', async () => {
    await expect(
      insertAssertion({ source_message_id: fx.messageB })
    ).rejects.toThrow(/foreign key|violates/i);
  });

  it('accepts a source message in the same Family/Case with a source person', async () => {
    await expect(
      insertAssertion({ source_message_id: fx.messageA })
    ).resolves.toBeDefined();
  });

  it('rejects source_message_id without source_person_id', async () => {
    await expect(
      insertAssertion({
        source_message_id: fx.messageA,
        source_person_id: null,
      })
    ).rejects.toThrow(/check constraint/i);
  });

  it('rejects a self-supersede reference', async () => {
    const created = await insertAssertion();
    const id = created.rows[0].id;
    await expect(
      admin.query(`UPDATE assertions SET supersedes_id = id WHERE id = $1`, [id])
    ).rejects.toThrow(/check constraint/i);
  });

  it('rejects supersedes across Cases and across Families', async () => {
    const oldA = (await insertAssertion()).rows[0].id;
    await expect(
      insertAssertion({ case_id: fx.caseB, supersedes_id: oldA })
    ).rejects.toThrow(/foreign key|violates/i);

    const oldB = (
      await admin.query(
        `INSERT INTO assertions
           (family_id, case_id, subject_person_id, source_kind, source_person_id,
            occurred_time_state, occurred_at, confirmation_status, kind, content)
         VALUES ($1, $2, $3, 'SELF_STATEMENT', $3, 'UNKNOWN', NULL, 'UNCONFIRMED',
                 'STATEMENT', 'other family')
         RETURNING id`,
        [fx.familyB, fx.caseB, fx.managerB]
      )
    ).rows[0].id;
    await expect(insertAssertion({ supersedes_id: oldB })).rejects.toThrow(
      /foreign key|violates/i
    );
  });

  it('an Assertion cannot supersede an Observation id', async () => {
    const obs = await admin.query(
      `INSERT INTO observations
         (family_id, case_id, subject_person_id, source_kind, source_person_id,
          occurred_time_state, occurred_at, confirmation_status, observation_code,
          value_state)
       VALUES ($1, $2, $3, 'GUARDIAN_OBSERVATION', $4, 'UNKNOWN', NULL,
               'UNCONFIRMED', 'sleep', 'UNKNOWN')
       RETURNING id`,
      [fx.familyA, fx.caseA, fx.subjectA, fx.guardianA]
    );
    await expect(
      insertAssertion({ supersedes_id: obs.rows[0].id })
    ).rejects.toThrow(/foreign key|violates/i);
  });

  it('keeps the old row intact and links the new row to it', async () => {
    const oldRow = (await insertAssertion({ content: 'old value' })).rows[0].id;
    const newRow = (
      await insertAssertion({ content: 'new value', supersedes_id: oldRow })
    ).rows[0].id;

    const { rows } = await admin.query(
      `SELECT id, content, supersedes_id FROM assertions WHERE id IN ($1, $2)`,
      [oldRow, newRow]
    );
    const old = rows.find((r: any) => r.id === oldRow);
    const next = rows.find((r: any) => r.id === newRow);
    expect(old.content).toBe('old value');
    expect(old.supersedes_id).toBeNull();
    expect(next.content).toBe('new value');
    expect(next.supersedes_id).toBe(oldRow);
  });

  it('runtime role can never UPDATE supersedes_id / content / provenance', async () => {
    const rowId = (await insertAssertion()).rows[0].id;
    for (const statement of [
      `UPDATE assertions SET supersedes_id = NULL WHERE id = '${rowId}'`,
      `UPDATE assertions SET content = 'rewrite' WHERE id = '${rowId}'`,
      `UPDATE assertions SET source_person_id = '${fx.managerA}' WHERE id = '${rowId}'`,
    ]) {
      const client = await app.connect();
      try {
        await client.query('BEGIN');
        await client.query('SELECT app.set_identity_context($1, $2)', [
          fx.accountA,
          'FAMILY_MANAGEMENT',
        ]);
        await client.query('SELECT app.set_family_context($1, $2, $3)', [
          fx.familyA,
          fx.managerA,
          'FAMILY_MANAGEMENT',
        ]);
        await expect(client.query(statement)).rejects.toThrow();
      } finally {
        await client.query('ROLLBACK').catch(() => {});
        client.release();
      }
    }
  });
});

interface Seed extends Fixture {
  accountA: string;
  accountB: string;
}

async function seed(admin: pg.Client): Promise<Seed> {
  const suffix = `${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
  const out: Record<string, string> = {};

  for (const key of ['A', 'B']) {
    const { rows: acc } = await admin.query(
      `INSERT INTO accounts (wechat_openid) VALUES ($1) RETURNING id`,
      [`t014_${key}_${suffix}`]
    );
    out[`account${key}`] = acc[0].id;
    const { rows: person } = await admin.query(
      `INSERT INTO persons (account_id, created_by_account_id) VALUES ($1, $1) RETURNING id`,
      [acc[0].id]
    );
    out[`manager${key}`] = person[0].id;
    const { rows: fam } = await admin.query(
      `INSERT INTO families (display_name, created_by_person_id) VALUES ($1, $2) RETURNING id`,
      [`t014-${key}`, person[0].id]
    );
    out[`family${key}`] = fam[0].id;
    await admin.query(
      `INSERT INTO family_members (family_id, person_id) VALUES ($1, $2)`,
      [fam[0].id, person[0].id]
    );
    const { rows: c } = await admin.query(
      `INSERT INTO cases (family_id, created_by_person_id, status, phase, is_primary, version)
       VALUES ($1, $2, 'OPEN', 'INTAKE', true, 1) RETURNING id`,
      [fam[0].id, person[0].id]
    );
    out[`case${key}`] = c[0].id;
  }

  // Family A subject + guardian (both members; guardian relation recorded).
  const { rows: subject } = await admin.query(
    `INSERT INTO persons (created_by_account_id) VALUES ($1) RETURNING id`,
    [out['accountA']]
  );
  out['subjectA'] = subject[0].id;
  await admin.query(`INSERT INTO family_members (family_id, person_id) VALUES ($1, $2)`, [
    out['familyA'],
    subject[0].id,
  ]);
  const { rows: guardian } = await admin.query(
    `INSERT INTO persons (created_by_account_id) VALUES ($1) RETURNING id`,
    [out['accountA']]
  );
  out['guardianA'] = guardian[0].id;
  await admin.query(`INSERT INTO family_members (family_id, person_id) VALUES ($1, $2)`, [
    out['familyA'],
    guardian[0].id,
  ]);
  await admin.query(
    `INSERT INTO person_compliance_profiles
       (person_id, age_band, minor_mode, guardian_person_id, verified_source)
     VALUES ($1, 'MINOR_14_17', true, $2, 'GUARDIAN_OBSERVATION')`,
    [subject[0].id, guardian[0].id]
  );

  const { rows: msgA } = await admin.query(
    `INSERT INTO dialogue_messages (family_id, case_id, actor_account_id, source_person_id, content)
     VALUES ($1, $2, $3, $4, 'family A raw message') RETURNING id`,
    [out['familyA'], out['caseA'], out['accountA'], guardian[0].id]
  );
  out['messageA'] = msgA[0].id;
  const { rows: msgB } = await admin.query(
    `INSERT INTO dialogue_messages (family_id, case_id, actor_account_id, source_person_id, content)
     VALUES ($1, $2, $3, $4, 'family B raw message') RETURNING id`,
    [out['familyB'], out['caseB'], out['accountB'], out['managerB']]
  );
  out['messageB'] = msgB[0].id;

  return out as unknown as Seed;
}

async function cleanup(admin: pg.Client) {
  try {
    await admin.query(
      `DELETE FROM assertions WHERE family_id IN (SELECT id FROM families WHERE display_name LIKE 't014%')`
    );
    await admin.query(
      `DELETE FROM observations WHERE family_id IN (SELECT id FROM families WHERE display_name LIKE 't014%')`
    );
    await admin.query(
      `DELETE FROM dialogue_messages WHERE family_id IN (SELECT id FROM families WHERE display_name LIKE 't014%')`
    );
    await admin.query(
      `DELETE FROM cases WHERE family_id IN (SELECT id FROM families WHERE display_name LIKE 't014%')`
    );
    await admin.query(
      `DELETE FROM person_compliance_profiles WHERE person_id IN (
         SELECT person_id FROM family_members WHERE family_id IN (
           SELECT id FROM families WHERE display_name LIKE 't014%'))`
    );
    await admin.query(
      `DELETE FROM family_members WHERE family_id IN (SELECT id FROM families WHERE display_name LIKE 't014%')`
    );
    await admin.query(`DELETE FROM families WHERE display_name LIKE 't014%'`);
    await admin.query(
      `DELETE FROM persons WHERE created_by_account_id IN (
         SELECT id FROM accounts WHERE wechat_openid LIKE 't014\\_%')`
    );
    await admin.query(`DELETE FROM accounts WHERE wechat_openid LIKE 't014\\_%'`);
  } catch {
    // best-effort cleanup
  }
}