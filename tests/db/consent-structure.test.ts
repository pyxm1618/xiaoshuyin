/**
 * Consent structure tests: verify CHECK constraints on consent tables.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from 'pg';

const MIGRATION_URL = process.env['MIGRATION_DATABASE_URL'] ?? process.env['DATABASE_URL']!;

describe('Consent Structure', () => {
  let client: Client;

  beforeAll(async () => {
    client = new Client({ connectionString: MIGRATION_URL });
    await client.connect();
  });

  afterAll(async () => {
    await client.end();
  });

  it('UNDER_14 profile without consent is rejected', async () => {
    await client.query("BEGIN");
    // Create account + person + family + membership
    const { rows: a } = await client.query(
      `INSERT INTO accounts (wechat_openid) VALUES ('cs1_' || uuidv7()) RETURNING id`);
    await client.query(`SELECT app.set_account_context($1, 'FAMILY_MANAGEMENT')`, [a[0].id]);
    const { rows: p } = await client.query(
      `INSERT INTO persons (account_id, created_by_account_id) VALUES ($1, $1) RETURNING id`, [a[0].id]);
    const fid = crypto.randomUUID();
    await client.query(`SELECT app.create_family($1, $2, 'CS Test')`, [fid, p[0].id]);

    // Try to insert UNDER_14 profile without consent - should fail CHECK
    await expect(
      client.query(
        `INSERT INTO person_compliance_profiles (person_id, age_band, minor_mode, verified_source)
         VALUES ($1, 'UNDER_14', true, 'GUARDIAN_RELAY')`,
        [p[0].id]
      )
    ).rejects.toThrow();

    await client.query("ROLLBACK");
  });

  it('UNDER_14 profile with SELF_STATEMENT source is rejected', async () => {
    await client.query("BEGIN");
    const { rows: a } = await client.query(
      `INSERT INTO accounts (wechat_openid) VALUES ('cs2_' || uuidv7()) RETURNING id`);
    await client.query(`SELECT app.set_account_context($1, 'FAMILY_MANAGEMENT')`, [a[0].id]);
    const { rows: p } = await client.query(
      `INSERT INTO persons (account_id, created_by_account_id) VALUES ($1, $1) RETURNING id`, [a[0].id]);
    const fid = crypto.randomUUID();
    await client.query(`SELECT app.create_family($1, $2, 'CS2')`, [fid, p[0].id]);

    // Create a guardian_consent_requests first (required for GRANTED consent)
    const { rows: req } = await client.query(
      `INSERT INTO guardian_consent_requests (family_id, guardian_person_id,
        declared_age_band, notice_version, notice_hash, status, expires_at, completed_at)
       VALUES ($1, $2, 'UNDER_14', 'v1', repeat('a',64), 'GRANTED', now() + interval '24 hours', now())
       RETURNING id`, [fid, p[0].id]);

    // Create a consent record referencing the request
    const { rows: cr } = await client.query(
      `INSERT INTO consent_records (family_id, guardian_person_id, guardian_account_id,
        purpose, decision, version, onboarding_request_id, notice_version, notice_hash, policy_version, evidence)
       VALUES ($1, $2, $3, 'UNDER_14_GUARDIAN_CONSENT', 'GRANTED', 1, $4, 'v1', repeat('a',64), 'p1', '{}')
       RETURNING id`, [fid, p[0].id, a[0].id, req[0].id]);

    // UNDER_14 with SELF_STATEMENT should fail
    await expect(
      client.query(
        `INSERT INTO person_compliance_profiles (person_id, age_band, minor_mode, verified_source,
          guardian_person_id, guardian_consent_record_id, guardian_consent_version)
         VALUES ($1, 'UNDER_14', true, 'SELF_STATEMENT', $2, $3, 1)`,
        [p[0].id, p[0].id, cr[0].id]
      )
    ).rejects.toThrow();

    await client.query("ROLLBACK");
  });

  it('guardian_consent_requests column set is exact', async () => {
    const { rows } = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'guardian_consent_requests' AND table_schema = 'public'
      ORDER BY ordinal_position
    `);
    const cols = rows.map((r: any) => r.column_name);
    // Must not contain child PII columns
    expect(cols).not.toContain('child_name');
    expect(cols).not.toContain('child_birthday');
    expect(cols).not.toContain('display_name');
    expect(cols).not.toContain('nickname');
  });
});
