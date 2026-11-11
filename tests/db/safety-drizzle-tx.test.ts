/**
 * T902 — narrow Drizzle §7.0 transaction seam.
 *
 * Proves, against a real PostgreSQL 18 database:
 *   1. Drizzle owns COMMIT and ROLLBACK on the checked-out client;
 *   2. `app.set_identity_context` runs inside the Drizzle transaction and the
 *      identity-consistency assertion rejects a wrong actor BEFORE the trusted
 *      Family context is established;
 *   3. `app.set_family_context` + RLS visibility apply inside the same
 *      transaction;
 *   4. the Drizzle transaction and the retained raw helper use the exact same
 *      checked-out connection (never a second client, never a nested raw
 *      transaction);
 *   5. the pool is left healthy and connection-count neutral after success and
 *      after a failure.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import { eq, sql } from 'drizzle-orm';
import { buildApp } from '../../apps/server/api/src/app.js';
import { withDrizzleRlsTransaction } from '../../apps/server/api/src/db/drizzle-tx.js';
import { safetySchema } from '@xiaoshuyin/domain';
import { createAdminPool } from '../setup/db.js';

const PREFIX = 't902_';
const { cases } = safetySchema;

describe('T902 Drizzle RLS transaction seam', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let admin: pg.Pool;
  let pool: pg.Pool;
  let seq = 0;

  let accountId: string;
  let personId: string;
  let familyId: string;
  let caseId: string;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
    admin = createAdminPool();
    pool = new pg.Pool({ connectionString: process.env['DATABASE_URL'], max: 5 });

    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/wechat',
      payload: { code: `${PREFIX}owner_${Date.now()}_${seq++}` },
    });
    expect(login.statusCode).toBe(200);
    const session = login.json();
    accountId = session.accountId;
    personId = session.person.id;

    const family = await app.inject({
      method: 'POST',
      url: '/api/v1/families',
      headers: {
        authorization: `Bearer ${session.sessionToken}`,
        'idempotency-key': `t902-fam-${Date.now()}-${seq++}`,
      },
      payload: {
        displayName: `T902-${Date.now()}`,
        creator: { ageBand: 'ADULT', ageBandSource: 'SELF_STATEMENT' },
      },
    });
    expect(family.statusCode).toBe(201);
    familyId = family.json().id;

    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/cases',
      headers: {
        authorization: `Bearer ${session.sessionToken}`,
        'idempotency-key': `t902-case-${Date.now()}-${seq++}`,
      },
      payload: {},
    });
    expect(created.statusCode).toBe(201);
    caseId = created.json().id;
  });

  afterAll(async () => {
    try {
      const familyIds = `SELECT id FROM families WHERE display_name LIKE 'T902-%'`;
      await admin.query(`DELETE FROM business_audit_events WHERE family_id IN (${familyIds})`);
      await admin.query(`DELETE FROM case_events WHERE family_id IN (${familyIds})`);
      await admin.query(`DELETE FROM cases WHERE family_id IN (${familyIds})`);
      await admin.query(
        `DELETE FROM idempotency_keys WHERE actor_account_id IN (SELECT id FROM accounts WHERE wechat_openid LIKE '${PREFIX}%')`
      );
      await admin.query(`DELETE FROM family_members WHERE family_id IN (${familyIds})`);
      await admin.query(`DELETE FROM families WHERE display_name LIKE 'T902-%'`);
      await admin.query(
        `DELETE FROM persons WHERE created_by_account_id IN (SELECT id FROM accounts WHERE wechat_openid LIKE '${PREFIX}%')`
      );
      await admin.query(`DELETE FROM accounts WHERE wechat_openid LIKE '${PREFIX}%'`);
    } catch {
      // best-effort cleanup
    }
    await pool.end();
    await admin.end();
    await app.close();
  });

  const rlsOpts = () => ({ familyId, accountId, personId, purpose: 'FAMILY_MANAGEMENT' });

  async function versionOf(id: string): Promise<number> {
    const { rows } = await admin.query<{ version: number }>(
      'SELECT version FROM cases WHERE id = $1',
      [id]
    );
    return rows[0]!.version;
  }

  it('Drizzle owns COMMIT: a query-builder write is persisted', async () => {
    const before = await versionOf(caseId);
    await withDrizzleRlsTransaction(pool, rlsOpts(), async (tx) => {
      await tx
        .update(cases)
        .set({ version: before + 1 })
        .where(eq(cases.id, caseId));
    });
    expect(await versionOf(caseId)).toBe(before + 1);
  });

  it('Drizzle owns ROLLBACK: a thrown error leaves zero writes', async () => {
    const before = await versionOf(caseId);
    await expect(
      withDrizzleRlsTransaction(pool, rlsOpts(), async (tx) => {
        await tx
          .update(cases)
          .set({ version: before + 1 })
          .where(eq(cases.id, caseId));
        throw new Error('INJECTED_FAILURE');
      })
    ).rejects.toThrow('INJECTED_FAILURE');
    expect(await versionOf(caseId)).toBe(before);
  });

  it('rejects a wrong identity context before the Family context is trusted', async () => {
    const before = await versionOf(caseId);
    await expect(
      withDrizzleRlsTransaction(
        pool,
        { ...rlsOpts(), personId: '00000000-0000-0000-0000-000000000000' },
        async (tx) => {
          // Must never be reached.
          await tx.update(cases).set({ version: before + 1 }).where(eq(cases.id, caseId));
        }
      )
    ).rejects.toMatchObject({ code: '42501', message: 'RLS_IDENTITY_CONTEXT_MISMATCH' });
    expect(await versionOf(caseId)).toBe(before);
  });

  it('applies Family RLS inside the same transaction', async () => {
    const visible = await withDrizzleRlsTransaction(pool, rlsOpts(), async (tx) => {
      const rows = await tx
        .select({ id: cases.id, familyId: cases.familyId })
        .from(cases);
      return rows;
    });
    expect(visible.length).toBeGreaterThan(0);
    for (const row of visible) expect(row.familyId).toBe(familyId);
  });

  it('uses one checked-out client for both Drizzle and the retained raw helper', async () => {
    const totalBefore = pool.totalCount;
    const result = await withDrizzleRlsTransaction(pool, rlsOpts(), async (tx, client) => {
      const viaRaw = await client.query<{ pid: number }>('SELECT pg_backend_pid() AS pid');
      // Explicit SQL is justified here: connection identity probe on the same
      // Drizzle-owned transaction.
      const viaDrizzle = await tx.execute<{ pid: number }>(
        sql`SELECT pg_backend_pid() AS pid`
      );
      return {
        rawPid: viaRaw.rows[0]!.pid,
        drizzlePid: viaDrizzle.rows[0]!.pid,
        totalDuringTx: pool.totalCount,
        idleDuringTx: pool.idleCount,
      };
    });

    // Both paths observed the same backend → same checked-out connection.
    expect(result.drizzlePid).toBe(result.rawPid);
    // Exactly one connection is checked out for the whole command.
    expect(result.totalDuringTx).toBe(Math.max(totalBefore, 1));
    expect(result.idleDuringTx).toBe(0);
    // The pool is connection-count neutral after release.
    expect(pool.totalCount).toBe(Math.max(totalBefore, 1));
    expect(pool.idleCount).toBe(Math.max(totalBefore, 1));
  });

  it('never returns a broken client to the healthy pool after a connection failure', async () => {
    let sawSocket: unknown = null;
    await expect(
      withDrizzleRlsTransaction(pool, rlsOpts(), async (_tx, client) => {
        // Simulate a hard connection failure on the checked-out client. This
        // fires the connection-level `error` listener that marks the client
        // broken, so `release(true)` must destroy instead of recycling it.
        const connection = (client as unknown as {
          connection?: { stream?: { destroy: (err: Error) => void } };
        }).connection;
        sawSocket = connection?.stream ?? null;
        connection?.stream?.destroy(new Error('INJECTED_CONNECTION_LOSS'));
        throw new Error('INJECTED_CONNECTION_LOSS');
      })
    ).rejects.toBeTruthy();

    expect(sawSocket).not.toBeNull();
    // A destroyed client is removed from the pool, never handed to the next
    // checkout as a "healthy" idle connection.
    expect(pool.totalCount).toBe(0);
    expect(pool.idleCount).toBe(0);

    // The pool recovers for the next command.
    const recovered = await withDrizzleRlsTransaction(pool, rlsOpts(), async (tx) => {
      const rows = await tx.select({ id: cases.id }).from(cases).limit(1);
      return rows.length;
    });
    expect(recovered).toBe(1);
  });
});