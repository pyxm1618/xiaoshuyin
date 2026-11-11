/**
 * Slice 9 — narrow Drizzle transaction seam (V1技术设计 §7.0).
 *
 * Contract (plan.md §5.3 / tasks.md T902):
 *
 *   - exactly ONE checked-out `pg.PoolClient` per command;
 *   - Drizzle OWNS `BEGIN` / `COMMIT` / `ROLLBACK` for that transaction;
 *   - `app.set_identity_context` runs inside the Drizzle transaction;
 *   - the existing `assertIdentityContextMatches` defence is preserved:
 *     `app.set_family_context` (which overwrites `app.person_id` with a
 *     caller-supplied value) is only reached after the identity context has
 *     been proven consistent with the authenticated actor;
 *   - `app.set_family_context` runs inside that same transaction;
 *   - authorization reads, retained raw helpers and idempotency helpers all
 *     receive the *same* checked-out client, so they join the same transaction;
 *   - no nested raw transaction and no second checked-out client exist;
 *   - the connection-level error listener / broken-client eviction discipline
 *     of `tx.ts` is preserved.
 *
 * This seam does NOT replace the existing raw transaction framework: it adds
 * the Drizzle-owned path Slice 9 owns.
 */

import pg from 'pg';
import { sql } from 'drizzle-orm';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { safetySchema } from '@xiaoshuyin/domain';

/** The typed Drizzle database bound to the Slice 9 schema projection. */
export type SafetyDrizzleDb = NodePgDatabase<typeof safetySchema>;

/**
 * A Drizzle-owned transaction handle. Derived from the database type so the
 * public signature can never drift from the installed drizzle-orm version.
 */
export type SafetyDrizzleTx = Parameters<
  Parameters<SafetyDrizzleDb['transaction']>[0]
>[0];

export interface DrizzleRlsTransactionOptions {
  familyId: string;
  accountId: string;
  personId: string;
  purpose: string;
}

function identityContextMismatch(): never {
  throw Object.assign(new Error('RLS_IDENTITY_CONTEXT_MISMATCH'), {
    code: '42501',
  });
}

function readIdentityContext(
  tx: SafetyDrizzleTx
): Promise<{ account_id: string; person_id: string; purpose: string }[]> {
  // Same statement as `assertIdentityContextMatches` in tx.ts. Explicit SQL is
  // justified here: it calls the frozen RLS context accessors.
  return tx
    .execute<{ account_id: string; person_id: string; purpose: string }>(
      sql`SELECT
            app_account_id()::text AS account_id,
            app_person_id()::text AS person_id,
            app_current_purpose() AS purpose`
    )
    .then((result) => result.rows);
}

/**
 * UFA-001 shared-seam defence, preserved verbatim in semantics:
 * `app.set_identity_context()` derives `person_id` from `account_id`, so the
 * authoritative result must be verified before `app.set_family_context()` is
 * allowed to overwrite `app.person_id`.
 */
async function assertIdentityContextMatches(
  tx: SafetyDrizzleTx,
  opts: DrizzleRlsTransactionOptions
): Promise<void> {
  const rows = await readIdentityContext(tx);
  const row = rows[0] ?? ({} as { account_id?: string; person_id?: string; purpose?: string });
  if (
    row.account_id !== opts.accountId ||
    row.person_id !== opts.personId ||
    row.purpose !== opts.purpose
  ) {
    identityContextMismatch();
  }
}

/** A lost/failed rollback means this connection must never rejoin the pool. */
function isBrokenClientError(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code;
  if (typeof code !== 'string') return false;
  // Connection exceptions (08xxx), admin shutdown (57P01), and "current
  // transaction is aborted" (25P02 — a failed ROLLBACK leaves the session
  // unusable for further work).
  return /^08/.test(code) || code === '57P01' || code === '25P02';
}

/**
 * Run `fn` inside one Drizzle-owned RLS transaction on one checked-out client.
 *
 * `fn` receives both the Drizzle transaction (for query-builder writes) and the
 * exact underlying `PoolClient` (for retained raw helpers such as idempotency
 * locking). Both are the same transaction; neither opens a new one.
 */
export async function withDrizzleRlsTransaction<T>(
  pool: pg.Pool,
  opts: DrizzleRlsTransactionOptions,
  fn: (tx: SafetyDrizzleTx, client: pg.PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  let broken = false;

  const onClientError = (_err: Error) => {
    broken = true;
  };
  client.on('error', onClientError);

  const db = drizzle(client, { schema: safetySchema });

  try {
    // Drizzle owns BEGIN / COMMIT / ROLLBACK for this whole callback.
    return await db.transaction(async (tx) => {
      await tx.execute(
        sql`SELECT app.set_identity_context(${opts.accountId}, ${opts.purpose})`
      );
      await assertIdentityContextMatches(tx, opts);
      await tx.execute(
        sql`SELECT app.set_family_context(${opts.familyId}, ${opts.personId}, ${opts.purpose})`
      );
      return fn(tx, client);
    });
  } catch (error) {
    broken = broken || isBrokenClientError(error);
    throw error;
  } finally {
    try {
      client.release(broken);
    } finally {
      client.removeListener('error', onClientError);
    }
  }
}