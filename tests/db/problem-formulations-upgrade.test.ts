/**
 * Slice 8 — populated pre-008 database upgrade evidence.
 *
 * Applies 001–007, inserts representative legacy rows, then applies 008 and
 * proves existing data survives while the new schema/whitelists are added.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { Client } from 'pg';

const ADMIN_URL = process.env['TEST_ADMIN_DATABASE_URL']!;
const MIGRATIONS_DIR = join(process.cwd(), 'db', 'migrations');

function sqlFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith('.sql'))
    .sort();
}

describe('slice 8 migration upgrade (populated 001-007)', () => {
  it('applies 008 without losing legacy Case/Evidence data', async () => {
    const dbName = `xiaoshuyin_s8_upgrade_${Date.now()}`;
    const admin = new Client({ connectionString: ADMIN_URL });
    await admin.connect();
    await admin.query(`CREATE DATABASE ${dbName}`);
    await admin.end();

    const dbUrl = ADMIN_URL.replace(/\/[^/?]+(\?.*)?$/, `/${dbName}$1`);
    const client = new Client({ connectionString: dbUrl });
    await client.connect();

    try {
      const all = sqlFiles();
      const pre = all.filter((name) => name < '008_problem_formulation_core.sql');
      const eight = all.find((name) => name === '008_problem_formulation_core.sql');
      expect(pre.length).toBe(8);
      expect(eight).toBeDefined();

      for (const name of pre) {
        await client.query(readFileSync(join(MIGRATIONS_DIR, name), 'utf-8'));
      }

      const accountId = (
        await client.query(
          'INSERT INTO accounts (wechat_openid) VALUES ($1) RETURNING id',
          [`t8upgrade_${Date.now()}`]
        )
      ).rows[0].id;
      const personId = (
        await client.query(
          'INSERT INTO persons (account_id, created_by_account_id) VALUES ($1, $1) RETURNING id',
          [accountId]
        )
      ).rows[0].id;
      const familyId = (await client.query('SELECT uuidv7() AS id')).rows[0].id;
      await client.query('SELECT app.create_family($1, $2, $3)', [
        familyId,
        personId,
        'T8UPGRADE',
      ]);
      await client.query(
        'INSERT INTO family_members (family_id, person_id) VALUES ($1, $2)',
        [familyId, personId]
      );
      const caseId = (
        await client.query(
          `INSERT INTO cases (family_id, created_by_person_id, status, phase, is_primary, version)
           VALUES ($1, $2, 'OPEN', 'INTAKE', true, 1) RETURNING id`,
          [familyId, personId]
        )
      ).rows[0].id;
      const messageId = (
        await client.query(
          `INSERT INTO dialogue_messages (family_id, case_id, actor_account_id, source_person_id, content)
           VALUES ($1, $2, $3, $4, 'legacy message') RETURNING id`,
          [familyId, caseId, accountId, personId]
        )
      ).rows[0].id;

      await client.query(readFileSync(join(MIGRATIONS_DIR, eight!), 'utf-8'));

      const legacy = await client.query(
        `SELECT (SELECT count(*)::int FROM cases) AS cases,
                (SELECT count(*)::int FROM dialogue_messages) AS messages`
      );
      expect(legacy.rows[0]).toEqual({ cases: 1, messages: 1 });

      const messageRow = await client.query(
        'SELECT id FROM dialogue_messages WHERE id = $1',
        [messageId]
      );
      expect(messageRow.rows).toHaveLength(1);

      const enumLabels = await client.query(
        `SELECT string_agg(enumlabel, ',' ORDER BY enumsortorder) AS labels
         FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
         WHERE t.typname = 'problem_formulation_status'`
      );
      expect(enumLabels.rows[0].labels).toBe(
        'DRAFT,PRESENTED,CONFIRMED,DISPUTED,NEEDS_REVIEW,SUPERSEDED'
      );

      const resourceDef = await client.query(
        `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint
         WHERE conname = 'business_audit_events_resource_type_check'`
      );
      for (const literal of ['PERSON', 'DIALOGUE_MESSAGE', 'CASE_PARTICIPANT', 'PROBLEM_FORMULATION']) {
        expect(resourceDef.rows[0].def).toContain(literal);
      }

      const eventDef = await client.query(
        `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint
         WHERE conname = 'business_audit_events_event_type_check'`
      );
      for (const literal of ['CASE_PRIMARY_SWITCHED', 'CASE_REASSESSMENT_STARTED']) {
        expect(eventDef.rows[0].def).toContain(literal);
      }

      const rls = await client.query(
        `SELECT relrowsecurity, relforcerowsecurity FROM pg_class
         WHERE relname = 'problem_formulations'`
      );
      expect(rls.rows[0]).toEqual({ relrowsecurity: true, relforcerowsecurity: true });
    } finally {
      await client.end();
      const cleanup = new Client({ connectionString: ADMIN_URL });
      await cleanup.connect();
      await cleanup.query(
        `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1`,
        [dbName]
      );
      await cleanup.query(`DROP DATABASE IF EXISTS ${dbName}`);
      await cleanup.end();
    }
  }, 60000);
});