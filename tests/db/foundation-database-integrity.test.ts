/**
 * Foundation Remediation 1 — executable database privilege / RLS proof.
 *
 * This uses the real PostgreSQL roles and policies. No mocked authorization.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client } from 'pg';

const APP_URL = process.env['DATABASE_URL']!;
const ADMIN_URL = process.env['TEST_ADMIN_DATABASE_URL']!;

async function withAppTransaction<T>(
  setup: (client: Client) => Promise<void>,
  fn: (client: Client) => Promise<T>
): Promise<T> {
  const client = new Client({ connectionString: APP_URL });
  await client.connect();
  try {
    await client.query('BEGIN');
    await setup(client);
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch {}
    throw err;
  } finally {
    await client.end();
  }
}

describe('Foundation Remediation 1 — database integrity', () => {
  let admin: Client;
  const marker = `foundation_${Date.now()}_${Math.random().toString(16).slice(2)}`;

  beforeAll(async () => {
    if (!APP_URL || !ADMIN_URL) {
      throw new Error('DATABASE_URL and TEST_ADMIN_DATABASE_URL are required');
    }
    admin = new Client({ connectionString: ADMIN_URL });
    await admin.connect();
  });

  afterAll(async () => {
    await admin.end();
  });

  it('accounts is FORCE RLS and an identity context cannot read or mutate another Account', async () => {
    const a = await admin.query(
      `INSERT INTO accounts (wechat_openid)
       VALUES ($1), ($2)
       RETURNING id, wechat_openid, session_epoch`,
      [`${marker}_a`, `${marker}_b`]
    );
    const [a1, a2] = a.rows;

    const noContext = await withAppTransaction(
      async () => {},
      async (client) => client.query(
        'SELECT id FROM accounts WHERE id = ANY($1::uuid[]) ORDER BY id',
        [[a1.id, a2.id]]
      )
    );
    expect(noContext.rows).toEqual([]);

    const own = await withAppTransaction(
      async (client) => {
        await client.query('SELECT app.set_account_context($1, $2)', [a1.id, 'SELF_IDENTITY']);
      },
      async (client) => {
        const visible = await client.query(
          'SELECT id FROM accounts WHERE id = ANY($1::uuid[]) ORDER BY id',
          [[a1.id, a2.id]]
        );
        const ownUpdate = await client.query(
          'UPDATE accounts SET session_epoch = session_epoch + 1 WHERE id = $1',
          [a1.id]
        );
        const otherUpdate = await client.query(
          'UPDATE accounts SET session_epoch = session_epoch + 1 WHERE id = $1',
          [a2.id]
        );
        return { visible: visible.rows, ownUpdate: ownUpdate.rowCount, otherUpdate: otherUpdate.rowCount };
      }
    );
    expect(own.visible.map((row: any) => row.id)).toEqual([a1.id]);
    expect(own.ownUpdate).toBe(1);
    expect(own.otherUpdate).toBe(0);

    const exactOpenid = await withAppTransaction(
      async (client) => {
        await client.query(`SELECT set_config('app.purpose', 'SELF_IDENTITY', true)`);
        await client.query('SELECT app.set_account_openid_context($1)', [a2.wechat_openid]);
      },
      async (client) => client.query(
        'SELECT id FROM accounts WHERE id = ANY($1::uuid[]) ORDER BY id',
        [[a1.id, a2.id]]
      )
    );
    expect(exactOpenid.rows.map((row: any) => row.id)).toEqual([a2.id]);

    await expect(
      withAppTransaction(
        async (client) => {
          await client.query('SELECT app.set_account_context($1, $2)', [a1.id, 'SELF_IDENTITY']);
        },
        async (client) => client.query('DELETE FROM accounts WHERE id = $1', [a1.id])
      )
    ).rejects.toMatchObject({ code: '42501' });
  });

  it('guardian Consent keeps one-time binding but historical fact mutation/delete is denied', async () => {
    const account = await admin.query(
      'INSERT INTO accounts (wechat_openid) VALUES ($1) RETURNING id',
      [`${marker}_guardian`]
    );
    const accountId = account.rows[0].id;
    const people = await admin.query(
      `INSERT INTO persons (account_id, created_by_account_id)
         VALUES ($1, $1), (NULL, $1), (NULL, $1)
       RETURNING id`,
      [accountId]
    );
    const [guardian, child1, child2] = people.rows;

    const family = await admin.query(
      'INSERT INTO families (display_name, created_by_person_id) VALUES ($1, $2) RETURNING id',
      [`${marker}_family`, guardian.id]
    );
    const familyId = family.rows[0].id;
    await admin.query(
      `INSERT INTO family_members (family_id, person_id)
       VALUES ($1, $2), ($1, $3), ($1, $4)`,
      [familyId, guardian.id, child1.id, child2.id]
    );

    const noticeHash = 'a'.repeat(64);
    const request = await admin.query(
      `INSERT INTO guardian_consent_requests
         (family_id, guardian_person_id, declared_age_band, notice_version, notice_hash,
          status, expires_at, completed_at)
       VALUES ($1, $2, 'UNDER_14', 'v1', $3, 'GRANTED', now() + interval '1 day', now())
       RETURNING id`,
      [familyId, guardian.id, noticeHash]
    );
    const consent = await admin.query(
      `INSERT INTO consent_records
         (family_id, guardian_person_id, guardian_account_id, purpose, decision, version,
          onboarding_request_id, notice_version, notice_hash, policy_version, evidence)
       VALUES ($1, $2, $3, 'UNDER_14_GUARDIAN_CONSENT', 'GRANTED', 1,
               $4, 'v1', $5, 'v1', '{}'::jsonb)
       RETURNING id`,
      [familyId, guardian.id, accountId, request.rows[0].id, noticeHash]
    );
    const consentId = consent.rows[0].id;

    const setFamily = async (client: Client) => {
      await client.query('SELECT app.set_identity_context($1, $2)', [accountId, 'GUARDIAN_CONSENT']);
      await client.query('SELECT app.set_family_context($1, $2, $3)', [
        familyId, guardian.id, 'GUARDIAN_CONSENT',
      ]);
    };

    const bound = await withAppTransaction(
      setFamily,
      async (client) => client.query(
        `UPDATE consent_records
            SET bound_person_id = $1, bound_at = now()
          WHERE id = $2
          RETURNING bound_person_id`,
        [child1.id, consentId]
      )
    );
    expect(bound.rows[0].bound_person_id).toBe(child1.id);

    await expect(
      withAppTransaction(
        setFamily,
        async (client) => client.query(
          `UPDATE consent_records SET decision = 'REVOKED' WHERE id = $1`,
          [consentId]
        )
      )
    ).rejects.toMatchObject({ code: '42501' });

    await expect(
      withAppTransaction(
        setFamily,
        async (client) => client.query(
          'UPDATE consent_records SET bound_person_id = $1, bound_at = now() WHERE id = $2',
          [child2.id, consentId]
        )
      )
    ).rejects.toThrow(/CONSENT_BINDING_IS_IMMUTABLE/);

    await expect(
      withAppTransaction(
        setFamily,
        async (client) => client.query('DELETE FROM consent_records WHERE id = $1', [consentId])
      )
    ).rejects.toMatchObject({ code: '42501' });
  });

  it('business audit events remain insertable but cannot be updated or deleted by runtime', async () => {
    const account = await admin.query(
      'INSERT INTO accounts (wechat_openid) VALUES ($1) RETURNING id',
      [`${marker}_audit`]
    );
    const accountId = account.rows[0].id;
    const person = await admin.query(
      'INSERT INTO persons (account_id, created_by_account_id) VALUES ($1, $1) RETURNING id',
      [accountId]
    );
    const personId = person.rows[0].id;
    const family = await admin.query(
      'INSERT INTO families (display_name, created_by_person_id) VALUES ($1, $2) RETURNING id',
      [`${marker}_audit_family`, personId]
    );
    const familyId = family.rows[0].id;
    await admin.query(
      'INSERT INTO family_members (family_id, person_id) VALUES ($1, $2)',
      [familyId, personId]
    );

    const setFamily = async (client: Client) => {
      await client.query('SELECT app.set_identity_context($1, $2)', [accountId, 'FAMILY_MANAGEMENT']);
      await client.query('SELECT app.set_family_context($1, $2, $3)', [
        familyId, personId, 'FAMILY_MANAGEMENT',
      ]);
    };

    const inserted = await withAppTransaction(
      setFamily,
      async (client) => client.query(
        `INSERT INTO business_audit_events
           (family_id, actor_account_id, event_type, resource_type, resource_id)
         VALUES ($1, $2, 'FAMILY_CREATED', 'FAMILY', $1)
         RETURNING id`,
        [familyId, accountId]
      )
    );
    const eventId = inserted.rows[0].id;

    await expect(
      withAppTransaction(
        setFamily,
        async (client) => client.query(
          `UPDATE business_audit_events SET metadata = '{"tampered":true}'::jsonb WHERE id = $1`,
          [eventId]
        )
      )
    ).rejects.toMatchObject({ code: '42501' });

    await expect(
      withAppTransaction(
        setFamily,
        async (client) => client.query('DELETE FROM business_audit_events WHERE id = $1', [eventId])
      )
    ).rejects.toMatchObject({ code: '42501' });
  });
});
