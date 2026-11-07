/**
 * T013 — Observation typed-value / occurred-time / validity storage.
 *
 * RED before the migration: the table/enums/CHECKs are absent, so both the
 * positive and negative cases fail at the very first query.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';

const ADMIN_URL = process.env['TEST_ADMIN_DATABASE_URL']!;

const PREFIX = 't013_';

interface Fixture {
  familyId: string;
  caseId: string;
  subjectPersonId: string;
  guardianPersonId: string;
}

describe('Observation storage CHECKs (T013)', () => {
  let admin: pg.Client;
  let fx: Fixture;
  let seq = 0;

  beforeAll(async () => {
    admin = new pg.Client({ connectionString: ADMIN_URL });
    await admin.connect();
    fx = await seed(admin);
  });

  afterAll(async () => {
    await cleanup(admin);
    await admin.end();
  });

  async function insertObservation(overrides: Record<string, unknown> = {}) {
    seq += 1;
    const row: Record<string, unknown> = {
      family_id: fx.familyId,
      case_id: fx.caseId,
      subject_person_id: fx.subjectPersonId,
      source_kind: 'GUARDIAN_OBSERVATION',
      source_person_id: fx.guardianPersonId,
      source_message_id: null,
      occurred_time_state: 'UNKNOWN',
      occurred_at: null,
      valid_from: null,
      valid_until: null,
      confirmation_status: 'UNCONFIRMED',
      supersedes_id: null,
      conflict_group_id: null,
      observation_code: `probe_${seq}`,
      value_state: 'UNKNOWN',
      value_type: null,
      value_text: null,
      value_number: null,
      value_boolean: null,
      unit: null,
      ...overrides,
    };
    const cols = Object.keys(row);
    const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
    return admin.query(
      `INSERT INTO observations (${cols.join(', ')}) VALUES (${placeholders}) RETURNING id, value_state, value_type, value_text, value_number, value_boolean, unit`,
      cols.map((c) => row[c])
    );
  }

  it('accepts KNOWN TEXT with only value_text', async () => {
    const res = await insertObservation({
      value_state: 'KNOWN',
      value_type: 'TEXT',
      value_text: '晚上不愿睡',
    });
    expect(res.rows[0].value_text).toBe('晚上不愿睡');
  });

  it('accepts KNOWN NUMBER 0 as a real value (not unknown)', async () => {
    const res = await insertObservation({
      value_state: 'KNOWN',
      value_type: 'NUMBER',
      value_number: 0,
      unit: 'hours',
    });
    expect(Number(res.rows[0].value_number)).toBe(0);
    expect(res.rows[0].value_state).toBe('KNOWN');
    expect(res.rows[0].unit).toBe('hours');
  });

  it('accepts KNOWN BOOLEAN false as a real value (not unknown)', async () => {
    const res = await insertObservation({
      value_state: 'KNOWN',
      value_type: 'BOOLEAN',
      value_boolean: false,
    });
    expect(res.rows[0].value_boolean).toBe(false);
    expect(res.rows[0].value_state).toBe('KNOWN');
  });

  it('accepts UNKNOWN / NOT_COLLECTED / DECLINED / NOT_APPLICABLE with all value columns NULL', async () => {
    for (const state of ['UNKNOWN', 'NOT_COLLECTED', 'DECLINED', 'NOT_APPLICABLE']) {
      const res = await insertObservation({ value_state: state });
      expect(res.rows[0].value_state, state).toBe(state);
      expect(res.rows[0].value_type, state).toBeNull();
      expect(res.rows[0].value_text, state).toBeNull();
      expect(res.rows[0].value_number, state).toBeNull();
      expect(res.rows[0].value_boolean, state).toBeNull();
      expect(res.rows[0].unit, state).toBeNull();
    }
  });

  it('rejects KNOWN with no typed value', async () => {
    await expect(
      insertObservation({ value_state: 'KNOWN', value_type: 'TEXT' })
    ).rejects.toThrow(/check constraint/i);
  });

  it('rejects two typed values at once', async () => {
    await expect(
      insertObservation({
        value_state: 'KNOWN',
        value_type: 'TEXT',
        value_text: 'x',
        value_number: 1,
      })
    ).rejects.toThrow(/check constraint/i);
  });

  it('rejects TEXT carrying a numeric value and BOOLEAN carrying text', async () => {
    await expect(
      insertObservation({
        value_state: 'KNOWN',
        value_type: 'TEXT',
        value_number: 1,
      })
    ).rejects.toThrow(/check constraint/i);
    await expect(
      insertObservation({
        value_state: 'KNOWN',
        value_type: 'BOOLEAN',
        value_text: 'true',
        value_boolean: true,
      })
    ).rejects.toThrow(/check constraint/i);
  });

  it('rejects unit on TEXT / BOOLEAN but allows unit on KNOWN NUMBER', async () => {
    await expect(
      insertObservation({
        value_state: 'KNOWN',
        value_type: 'TEXT',
        value_text: 'x',
        unit: 'hours',
      })
    ).rejects.toThrow(/check constraint/i);
    await expect(
      insertObservation({
        value_state: 'KNOWN',
        value_type: 'BOOLEAN',
        value_boolean: true,
        unit: 'hours',
      })
    ).rejects.toThrow(/check constraint/i);
  });

  it('rejects unknown-like states that smuggle a type / value / unit', async () => {
    await expect(
      insertObservation({ value_state: 'UNKNOWN', value_type: 'TEXT' })
    ).rejects.toThrow(/check constraint/i);
    await expect(
      insertObservation({ value_state: 'DECLINED', value_text: 'no' })
    ).rejects.toThrow(/check constraint/i);
    await expect(
      insertObservation({ value_state: 'NOT_APPLICABLE', unit: 'hours' })
    ).rejects.toThrow(/check constraint/i);
  });

  it('enforces occurred_time_state KNOWN <=> occurred_at non-null', async () => {
    await expect(
      insertObservation({ occurred_time_state: 'KNOWN', occurred_at: null })
    ).rejects.toThrow(/check constraint/i);
    await expect(
      insertObservation({
        occurred_time_state: 'UNKNOWN',
        occurred_at: new Date('2026-01-01T00:00:00Z'),
      })
    ).rejects.toThrow(/check constraint/i);
    const shown = await insertObservation({
      occurred_time_state: 'KNOWN',
      occurred_at: new Date('2026-01-01T00:00:00Z'),
    });
    expect(shown.rows[0]).toBeDefined();
  });

  it('enforces valid_until > valid_from when both are present', async () => {
    await expect(
      insertObservation({
        valid_from: new Date('2026-02-01T00:00:00Z'),
        valid_until: new Date('2026-01-01T00:00:00Z'),
      })
    ).rejects.toThrow(/check constraint/i);
    await expect(
      insertObservation({
        valid_from: new Date('2026-01-01T00:00:00Z'),
        valid_until: new Date('2026-01-01T00:00:00Z'),
      })
    ).rejects.toThrow(/check constraint/i);
    const ok = await insertObservation({
      valid_from: new Date('2026-01-01T00:00:00Z'),
      valid_until: new Date('2026-02-01T00:00:00Z'),
    });
    expect(ok.rows[0]).toBeDefined();
  });

  it('enforces the observation_code pattern', async () => {
    await expect(
      insertObservation({ observation_code: 'Sleep Hours' })
    ).rejects.toThrow(/check constraint/i);
    await expect(
      insertObservation({ observation_code: '1sleep' })
    ).rejects.toThrow(/check constraint/i);
  });
});

async function seed(admin: pg.Client): Promise<Fixture> {
  const suffix = `${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
  const { rows: acc } = await admin.query(
    `INSERT INTO accounts (wechat_openid) VALUES ($1) RETURNING id`,
    [`${PREFIX}${suffix}`]
  );
  const accountId = acc[0].id;
  const { rows: p } = await admin.query(
    `INSERT INTO persons (account_id, created_by_account_id) VALUES ($1, $1) RETURNING id`,
    [accountId]
  );
  const subjectPersonId = p[0].id;
  const { rows: fam } = await admin.query(
    `INSERT INTO families (display_name, created_by_person_id) VALUES ('t013', $1) RETURNING id`,
    [subjectPersonId]
  );
  const familyId = fam[0].id;
  await admin.query(
    `INSERT INTO family_members (family_id, person_id) VALUES ($1, $2)`,
    [familyId, subjectPersonId]
  );

  // Second Person is a family member and the guardian of the subject.
  const { rows: g } = await admin.query(
    `INSERT INTO persons (created_by_account_id) VALUES ($1) RETURNING id`,
    [accountId]
  );
  const guardianPersonId = g[0].id;
  await admin.query(
    `INSERT INTO family_members (family_id, person_id) VALUES ($1, $2)`,
    [familyId, guardianPersonId]
  );
  await admin.query(
    `INSERT INTO person_compliance_profiles
       (person_id, age_band, minor_mode, guardian_person_id, verified_source)
     VALUES ($1, 'MINOR_14_17', true, $2, 'GUARDIAN_OBSERVATION')`,
    [subjectPersonId, guardianPersonId]
  );

  const { rows: c } = await admin.query(
    `INSERT INTO cases (family_id, created_by_person_id, status, phase, is_primary, version)
     VALUES ($1, $2, 'OPEN', 'INTAKE', true, 1) RETURNING id`,
    [familyId, subjectPersonId]
  );

  return {
    familyId,
    caseId: c[0].id,
    subjectPersonId,
    guardianPersonId,
  };
}

async function cleanup(admin: pg.Client) {
  try {
    await admin.query(
      `DELETE FROM observations WHERE family_id IN (
         SELECT id FROM families WHERE display_name = 't013')`
    );
    await admin.query(
      `DELETE FROM cases WHERE family_id IN (
         SELECT id FROM families WHERE display_name = 't013')`
    );
    await admin.query(
      `DELETE FROM person_compliance_profiles WHERE person_id IN (
         SELECT person_id FROM family_members WHERE family_id IN (
           SELECT id FROM families WHERE display_name = 't013'))`
    );
    await admin.query(
      `DELETE FROM family_members WHERE family_id IN (
         SELECT id FROM families WHERE display_name = 't013')`
    );
    await admin.query(`DELETE FROM families WHERE display_name = 't013'`);
    await admin.query(
      `DELETE FROM persons WHERE created_by_account_id IN (
         SELECT id FROM accounts WHERE wechat_openid LIKE 't013\\_%')`
    );
    await admin.query(`DELETE FROM accounts WHERE wechat_openid LIKE 't013\\_%'`);
  } catch {
    // best-effort cleanup; assertions already ran
  }
}