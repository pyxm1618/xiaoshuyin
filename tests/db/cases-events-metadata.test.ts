/**
 * T023 — case_events metadata shape CHECK (data-model.md §3.2, CHK068).
 *
 * The check is a real executable invariant: exactly {primary, version},
 * boolean + integer-compatible version >= 1, no extra keys, no default.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from 'pg';

const MIGRATION_URL = process.env['MIGRATION_DATABASE_URL'] ?? process.env['DATABASE_URL']!;
const PREFIX = 't023_';

describe('case_events metadata shape check (T023)', () => {
  let admin: Client;
  let familyId: string;
  let caseId: string;
  let accountId: string;
  let personId: string;

  beforeAll(async () => {
    admin = new Client({ connectionString: MIGRATION_URL });
    await admin.connect();

    await admin.query('BEGIN');
    const acc = await admin.query(
      `INSERT INTO accounts (wechat_openid) VALUES ($1 || uuidv7()) RETURNING id`,
      [PREFIX]
    );
    accountId = acc.rows[0].id;
    await admin.query('SELECT app.set_account_context($1, $2)', [accountId, 'FAMILY_MANAGEMENT']);
    const per = await admin.query(
      'INSERT INTO persons (account_id, created_by_account_id) VALUES ($1, $1) RETURNING id',
      [accountId]
    );
    personId = per.rows[0].id;
    familyId = (await admin.query('SELECT uuidv7() AS id')).rows[0].id;
    await admin.query('SELECT app.create_family($1, $2, $3)', [familyId, personId, 'T023']);
    await admin.query(
      'INSERT INTO family_members (family_id, person_id) VALUES ($1, $2)',
      [familyId, personId]
    );
    caseId = (await admin.query(
      `INSERT INTO cases (family_id, created_by_person_id, status, phase, is_primary, version)
       VALUES ($1, $2, 'OPEN', 'INTAKE', true, 1) RETURNING id`,
      [familyId, personId]
    )).rows[0].id;
    await admin.query('COMMIT');
  });

  afterAll(async () => {
    try {
      await admin.query('ROLLBACK');
      await admin.query('DELETE FROM case_events WHERE family_id = $1', [familyId]);
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

  // Context is transaction-local (`set_config(..., true)`), so every insert
  // sets its own Family context inside its own transaction.
  async function insertEvent(metadata: string, eventType = 'CASE_CREATED') {
    await admin.query('BEGIN');
    try {
      await admin.query('SELECT app.set_family_context($1, $2, $3)', [familyId, personId, 'FAMILY_MANAGEMENT']);
      const result = await admin.query(
        `INSERT INTO case_events (family_id, case_id, actor_account_id, event_type, metadata)
         VALUES ($1, $2, $3, $4, $5::jsonb) RETURNING id`,
        [familyId, caseId, accountId, eventType, metadata]
      );
      await admin.query('COMMIT');
      return result;
    } catch (err) {
      await admin.query('ROLLBACK');
      throw err;
    }
  }

  it('declare the metadata shape constraint', async () => {
    const { rows } = await admin.query(`
      SELECT conname FROM pg_constraint
      WHERE conrelid = 'case_events'::regclass AND conname = 'case_events_metadata_shape_check'
    `);
    expect(rows.length).toBe(1);
  });

  it('accepts {primary: boolean, version: integer >= 1}', async () => {
    const r1 = await insertEvent('{"primary": true, "version": 1}');
    expect(r1.rows[0].id).toBeTruthy();
    const r2 = await insertEvent('{"primary": false, "version": 7}');
    expect(r2.rows[0].id).toBeTruthy();
    await admin.query('DELETE FROM case_events WHERE id = ANY($1)', [[r1.rows[0].id, r2.rows[0].id]]);
  });

  it('rejects extra keys (title / description / PII)', async () => {
    await expect(insertEvent('{"primary": true, "version": 1, "title": "x"}')).rejects.toThrow(/check/i);
    await expect(insertEvent('{"primary": true, "version": 1, "description": "x"}')).rejects.toThrow(/check/i);
    await expect(insertEvent('{"primary": true, "version": 1, "note": "child name"}')).rejects.toThrow(/check/i);
  });

  it('rejects non-object, empty object and missing keys', async () => {
    await expect(insertEvent('"text"')).rejects.toThrow(/check/i);
    await expect(insertEvent('[]')).rejects.toThrow(/check/i);
    await expect(insertEvent('{}')).rejects.toThrow(/check/i);
    await expect(insertEvent('{"primary": true}')).rejects.toThrow(/check/i);
    await expect(insertEvent('{"version": 1}')).rejects.toThrow(/check/i);
  });

  it('rejects non-boolean primary', async () => {
    await expect(insertEvent('{"primary": "true", "version": 1}')).rejects.toThrow(/check/i);
    await expect(insertEvent('{"primary": 1, "version": 1}')).rejects.toThrow(/check/i);
  });

  it('rejects non-integer-compatible or out-of-range version', async () => {
    await expect(insertEvent('{"primary": true, "version": 1.5}')).rejects.toThrow(/check/i);
    await expect(insertEvent('{"primary": true, "version": 0}')).rejects.toThrow(/check/i);
    await expect(insertEvent('{"primary": true, "version": -1}')).rejects.toThrow(/check/i);
    await expect(insertEvent('{"primary": true, "version": "1"}')).rejects.toThrow(/check/i);
  });

  it('has no default: metadata must be written explicitly', async () => {
    const { rows } = await admin.query(`
      SELECT column_default, is_nullable FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'case_events' AND column_name = 'metadata'
    `);
    expect(rows[0].column_default).toBeNull();
    expect(rows[0].is_nullable).toBe('NO');
  });

  it('event_type vocabulary is closed to CASE_CREATED', async () => {
    await expect(
      insertEvent('{"primary": true, "version": 1}', 'CASE_VIEWED')
    ).rejects.toThrow(/check/i);
  });
});
