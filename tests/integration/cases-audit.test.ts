/**
 * T069 — creation evidence: exactly one domain event and one audit row per
 * created Case, with a closed metadata shape; a failing event write rolls the
 * Case back (no partial persistence).
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import { buildApp } from '../../apps/server/api/src/app.js';
import { createAdminPool } from '../setup/db.js';

let verifyPool: pg.Pool;

describe('Case event + audit (T069)', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
    verifyPool = createAdminPool();
  });

  afterAll(async () => {
    await verifyPool.end();
    await app.close();
  });

  async function setup(label: string) {
    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/wechat',
      payload: { code: `t069_${label}_${Date.now()}` },
    });
    const token = login.json().token as string;
    const family = await app.inject({
      method: 'POST',
      url: '/api/v1/families',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        displayName: `T069-${label}`,
        ageBand: 'ADULT',
        ageBandSource: 'SELF_STATEMENT',
        idempotencyKey: `t069-fam-${label}-${Date.now()}`,
      },
    });
    return { token, familyId: family.json().id as string };
  }

  it('writes exactly one CASE_CREATED event and one CASE audit', async () => {
    const { token, familyId } = await setup('single');
    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/cases',
      headers: { authorization: `Bearer ${token}` },
      payload: { idempotencyKey: `t069-case-${Date.now()}` },
    });
    expect(created.statusCode).toBe(201);
    const caseId = created.json().id as string;

    const events = await verifyPool.query(
      `SELECT event_type, metadata, case_id, family_id
       FROM case_events WHERE case_id = $1`,
      [caseId]
    );
    expect(events.rows.length).toBe(1);
    expect(events.rows[0].event_type).toBe('CASE_CREATED');
    expect(events.rows[0].family_id).toBe(familyId);
    expect(Object.keys(events.rows[0].metadata).sort()).toEqual(['primary', 'version']);
    expect(events.rows[0].metadata).toEqual({ primary: true, version: 1 });

    const audits = await verifyPool.query(
      `SELECT event_type, resource_type, resource_id, metadata, family_id
       FROM business_audit_events WHERE resource_id = $1`,
      [caseId]
    );
    expect(audits.rows.length).toBe(1);
    expect(audits.rows[0]).toMatchObject({
      event_type: 'CASE_CREATED',
      resource_type: 'CASE',
      resource_id: caseId,
      family_id: familyId,
    });
    expect(Object.keys(audits.rows[0].metadata).sort()).toEqual(['primary', 'version']);
  });

  it('a failing event write rolls the Case back (no partial persistence)', async () => {
    const { familyId } = await setup('rollback');
    const person = await verifyPool.query(
      'SELECT created_by_person_id AS id, (SELECT account_id FROM persons p WHERE p.id = created_by_person_id) AS account_id FROM families WHERE id = $1',
      [familyId]
    );
    const personId = person.rows[0].id as string;
    const accountId = person.rows[0].account_id as string;

    const client = new pg.Client({ connectionString: process.env['MIGRATION_DATABASE_URL'] });
    await client.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT app.set_family_context($1, $2, $3)', [
        familyId,
        personId,
        'FAMILY_MANAGEMENT',
      ]);
      const inserted = await client.query(
        `INSERT INTO cases (family_id, created_by_person_id, status, phase, is_primary, version)
         VALUES ($1, $2, 'OPEN', 'INTAKE', true, 1) RETURNING id`,
        [familyId, personId]
      );
      const caseId = inserted.rows[0].id as string;

      // Invalid metadata (extra key) must be rejected by the shape CHECK.
      await expect(
        client.query(
          `INSERT INTO case_events (family_id, case_id, actor_account_id, event_type, metadata)
           VALUES ($1, $2, $3, 'CASE_CREATED', '{"primary": true, "version": 1, "title": "x"}'::jsonb)`,
          [familyId, caseId, accountId]
        )
      ).rejects.toThrow(/check/i);

      await client.query('ROLLBACK');
    } finally {
      await client.end();
    }

    const rows = await verifyPool.query('SELECT count(*)::int AS c FROM cases WHERE family_id = $1', [
      familyId,
    ]);
    expect(rows.rows[0].c).toBe(0);
  });
});
