/**
 * Constraint tests: verify unique constraints and CHECK constraints work.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from 'pg';

const MIGRATION_URL = process.env['MIGRATION_DATABASE_URL'] ?? process.env['DATABASE_URL']!;

describe('Database Constraints', () => {
  let client: Client;

  beforeAll(async () => {
    client = new Client({ connectionString: MIGRATION_URL });
    await client.connect();
  });

  afterAll(async () => {
    await client.end();
  });

  it('same person cannot create second family (UNIQUE created_by_person_id)', async () => {
    // Create account + person
    await client.query("BEGIN");
    await client.query(`SELECT app.set_account_context(uuidv7(), 'FAMILY_MANAGEMENT')`);
    const { rows: accRows } = await client.query(
      `INSERT INTO accounts (wechat_openid) VALUES ('test_constraint_' || uuidv7()) RETURNING id`
    );
    const accountId = accRows[0].id;
    await client.query(`SELECT app.set_account_context($1, 'FAMILY_MANAGEMENT')`, [accountId]);
    const { rows: perRows } = await client.query(
      `INSERT INTO persons (account_id, created_by_account_id) VALUES ($1, $1) RETURNING id`,
      [accountId]
    );
    const personId = perRows[0].id;

    // First family creation should succeed
    await client.query(`SELECT app.create_family(uuidv7(), $1, 'Test Family')`, [personId]);

    // Second family by same person should fail
    await expect(
      client.query(`SELECT app.create_family(uuidv7(), $1, 'Second Family')`, [personId])
    ).rejects.toThrow();

    await client.query("ROLLBACK");
  });

  it('duplicate membership is rejected (UNIQUE family_id, person_id)', async () => {
    await client.query("BEGIN");
    const { rows: accRows } = await client.query(
      `INSERT INTO accounts (wechat_openid) VALUES ('test_member_' || uuidv7()) RETURNING id`
    );
    const accountId = accRows[0].id;
    await client.query(`SELECT app.set_account_context($1, 'FAMILY_MANAGEMENT')`, [accountId]);
    const { rows: perRows } = await client.query(
      `INSERT INTO persons (account_id, created_by_account_id) VALUES ($1, $1) RETURNING id`,
      [accountId]
    );
    const personId = perRows[0].id;
    const familyId = crypto.randomUUID();
    await client.query(`SELECT app.create_family($1, $2, 'Dup Test')`, [familyId, personId]);

    // First membership should succeed
    await client.query(
      `INSERT INTO family_members (family_id, person_id) VALUES ($1, $2)`,
      [familyId, personId]
    );

    // Second membership for same person in same family should fail
    await expect(
      client.query(
        `INSERT INTO family_members (family_id, person_id) VALUES ($1, $2)`,
        [familyId, personId]
      )
    ).rejects.toThrow();

    await client.query("ROLLBACK");
  });

  it('same (actor, command, key) second insert rejected', async () => {
    await client.query("BEGIN");
    const { rows: accRows } = await client.query(
      `INSERT INTO accounts (wechat_openid) VALUES ('test_idem_' || uuidv7()) RETURNING id`
    );
    const accountId = accRows[0].id;
    await client.query(`SELECT app.set_account_context($1, 'SELF_IDENTITY')`, [accountId]);

    await client.query(
      `INSERT INTO idempotency_keys (actor_account_id, command_type, idempotency_key, request_hash, response_status, response_body)
       VALUES ($1, 'FAMILY_CREATE', 'test-key-12345', repeat('a', 64), 200, '{}')`,
      [accountId]
    );

    await expect(
      client.query(
        `INSERT INTO idempotency_keys (actor_account_id, command_type, idempotency_key, request_hash, response_status, response_body)
         VALUES ($1, 'FAMILY_CREATE', 'test-key-12345', repeat('b', 64), 200, '{}')`,
        [accountId]
      )
    ).rejects.toThrow();

    await client.query("ROLLBACK");
  });
});
