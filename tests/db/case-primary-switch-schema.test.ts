/**
 * T722 — SwitchPrimaryCase schema invariants (plan D-9.2 / D-9.3).
 *
 * RED until the reviewed migration replaces the five CHECK constraints:
 *   - case_events vocabulary is exactly the three PRIMARY event types
 *   - metadata shape is per-event-type, with reason 1..500 after btrim
 *   - idempotency_keys accepts CASE_SWITCH_PRIMARY bytea-only rows only
 *   - cases keeps its nine frozen columns
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from 'pg';

const ADMIN_URL = process.env['TEST_ADMIN_DATABASE_URL']!;
const PREFIX = 't722_';

describe('case primary switch schema (T722)', () => {
  let admin: Client;
  let accountId: string;
  let personId: string;
  let familyId: string;
  let caseId: string;
  let targetId: string;

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
    await admin.query('SELECT app.create_family($1, $2, $3)', [familyId, personId, 'T722']);
    await admin.query('INSERT INTO family_members (family_id, person_id) VALUES ($1, $2)', [
      familyId,
      personId,
    ]);
    caseId = (
      await admin.query(
        `INSERT INTO cases (family_id, created_by_person_id, status, phase, is_primary, version)
         VALUES ($1, $2, 'OPEN', 'INTAKE', true, 1) RETURNING id`,
        [familyId, personId]
      )
    ).rows[0].id;
    targetId = (
      await admin.query(
        `INSERT INTO cases (family_id, created_by_person_id, status, phase, is_primary, version)
         VALUES ($1, $2, 'OPEN', 'INTAKE', false, 1) RETURNING id`,
        [familyId, personId]
      )
    ).rows[0].id;
  });

  afterAll(async () => {
    try {
      await admin.query('DELETE FROM business_audit_events WHERE family_id = $1', [familyId]);
      await admin.query('DELETE FROM case_events WHERE family_id = $1', [familyId]);
      await admin.query('DELETE FROM cases WHERE family_id = $1', [familyId]);
      await admin.query('DELETE FROM family_members WHERE family_id = $1', [familyId]);
      await admin.query('DELETE FROM families WHERE id = $1', [familyId]);
      await admin.query('DELETE FROM idempotency_keys WHERE actor_account_id = $1', [accountId]);
      await admin.query('DELETE FROM persons WHERE account_id = $1', [accountId]);
      await admin.query('DELETE FROM accounts WHERE id = $1', [accountId]);
    } catch {
      // best-effort cleanup
    }
    await admin.end();
  });

  async function constraint(name: string): Promise<string> {
    const { rows } = await admin.query(
      'SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conname = $1',
      [name]
    );
    expect(rows.length, `constraint ${name}`).toBe(1);
    return rows[0].def;
  }

  async function insertEvent(eventType: string, metadata: unknown) {
    return admin.query(
      `INSERT INTO case_events (family_id, case_id, actor_account_id, event_type, metadata)
       VALUES ($1, $2, $3, $4, $5::jsonb)`,
      [familyId, caseId, accountId, eventType, JSON.stringify(metadata)]
    );
  }

  it('case_events vocabulary is exactly CASE_CREATED / ASSIGNED / REVOKED', async () => {
    const def = await constraint('case_events_event_type_check');
    expect(def).toContain('CASE_CREATED');
    expect(def).toContain('CASE_PRIMARY_ASSIGNED');
    expect(def).toContain('CASE_PRIMARY_REVOKED');
    expect(def).not.toContain('CASE_VIEWED');
  });

  it('rejects CASE_VIEWED and unknown event types', async () => {
    await expect(insertEvent('CASE_VIEWED', { primary: true, version: 1 })).rejects.toThrow();
    await expect(
      insertEvent('CASE_UNKNOWN', {
        primary: true,
        version: 1,
        previousPrimaryCaseId: null,
        reason: 'x',
      })
    ).rejects.toThrow();
  });

  it('accepts the two PRIMARY metadata shapes', async () => {
    await insertEvent('CASE_PRIMARY_ASSIGNED', {
      primary: true,
      version: 2,
      previousPrimaryCaseId: caseId,
      reason: 'switch to target',
    });
    await insertEvent('CASE_PRIMARY_REVOKED', {
      primary: false,
      version: 2,
      newPrimaryCaseId: targetId,
      reason: 'switch to target',
    });
  });

  it('rejects extra keys, non-boolean primary, bad version, blank/oversized reason', async () => {
    const bad = [
      { primary: true, version: 2, previousPrimaryCaseId: null, reason: 'x', extra: 1 },
      { primary: 'true', version: 2, previousPrimaryCaseId: null, reason: 'x' },
      { primary: true, version: 1.5, previousPrimaryCaseId: null, reason: 'x' },
      { primary: true, version: 2, previousPrimaryCaseId: null, reason: '   ' },
      { primary: true, version: 2, previousPrimaryCaseId: null, reason: 'x'.repeat(501) },
      { primary: true, version: 2, previousPrimaryCaseId: null },
    ];
    for (const metadata of bad) {
      await expect(insertEvent('CASE_PRIMARY_ASSIGNED', metadata)).rejects.toThrow();
    }
  });

  it('keeps CASE_CREATED closed to extra keys', async () => {
    await insertEvent('CASE_CREATED', { primary: true, version: 1 });
    await expect(
      insertEvent('CASE_CREATED', { primary: true, version: 1, title: 'leak' })
    ).rejects.toThrow();
  });

  it('idempotency_keys accepts bytea-only CASE_SWITCH_PRIMARY and rejects text-only', async () => {
    const bytes = Buffer.from('t722-switch-key', 'utf16le');
    await admin.query(
      `INSERT INTO idempotency_keys
         (actor_account_id, command_type, idempotency_key, idempotency_key_bytes,
          request_hash, response_status, response_body)
       VALUES ($1, 'CASE_SWITCH_PRIMARY', NULL, $2, $3, 200, '{}'::jsonb)`,
      [accountId, bytes, 'a'.repeat(64)]
    );

    await expect(
      admin.query(
        `INSERT INTO idempotency_keys
           (actor_account_id, command_type, idempotency_key, idempotency_key_bytes,
            request_hash, response_status, response_body)
         VALUES ($1, 'CASE_SWITCH_PRIMARY', 'text-key-123', NULL, $2, 200, '{}'::jsonb)`,
        [accountId, 'b'.repeat(64)]
      )
    ).rejects.toThrow();
  });

  it('cases still has exactly nine columns', async () => {
    const { rows } = await admin.query(
      `SELECT count(*)::int AS c
         FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'cases'`
    );
    expect(rows[0].c).toBe(9);
  });
});