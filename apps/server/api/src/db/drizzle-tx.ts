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
import { isBrokenClientError } from './tx.js';

/** Observe Drizzle's own rollback without taking transaction ownership. */
function observeTransactionQueries(client: pg.PoolClient, markBroken: () => void) {
  let originalFailure: unknown;
  let hasOriginalFailure = false;
  let rollbackFailed = false;
  const rememberFailure = (error: unknown) => {
    if (!hasOriginalFailure) {
      originalFailure = error;
      hasOriginalFailure = true;
    }
  };
  const observedClient = new Proxy(client, {
    get(target, property) {
      if (property !== 'query') return Reflect.get(target, property, target);
      return async (...args: unknown[]) => {
        const query = args[0];
        const text = typeof query === 'string' ? query : (query as { text?: string })?.text;
        try {
          return await Reflect.apply(target.query, target, args);
        } catch (error) {
          if (text?.trim().toLowerCase() === 'rollback') {
            rollbackFailed = true;
            markBroken();
            if (hasOriginalFailure) throw originalFailure;
          }
          rememberFailure(error);
          throw error;
        }
      };
    },
  });
  return {
    observedClient,
    rememberFailure,
    requestFailure: (error: unknown) => rollbackFailed && hasOriginalFailure ? originalFailure : error,
  };
}

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
  /**
   * Optional caller-requested isolation for a multi-read decision that must
   * observe ONE authoritative snapshot (e.g. policy + Person + guardian
   * consent). Existing business commands keep the PostgreSQL default
   * (READ COMMITTED) because they omit this option.
   */
  isolationLevel?: 'REPEATABLE READ';
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
  opts: { accountId: string; personId: string; purpose: string }
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

export interface DrizzleIdentityTransactionOptions {
  accountId: string;
  personId: string;
  purpose: string;
  isolationLevel?: 'REPEATABLE READ';
}

/**
 * AUTH-007 Staff authority transaction seam.
 *
 * This is deliberately identity-scoped: it proves Account→Person first but
 * does NOT call app.set_family_context(), which would incorrectly require
 * household membership. ResolveRisk establishes its exact Staff Case context
 * only after the production resolver source verifies SAFETY_RESOLVE + the
 * Case assignment.
 */
export async function withDrizzleIdentityTransaction<T>(
  pool: pg.Pool,
  opts: DrizzleIdentityTransactionOptions,
  fn: (tx: SafetyDrizzleTx, client: pg.PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  let broken = false;

  const onClientError = (_err: Error) => {
    broken = true;
  };
  client.on('error', onClientError);

  const { observedClient, rememberFailure, requestFailure } = observeTransactionQueries(client, () => {
    broken = true;
  });
  const db = drizzle(observedClient, { schema: safetySchema });

  try {
    const transactionConfig =
      opts.isolationLevel === 'REPEATABLE READ'
        ? ({ isolationLevel: 'repeatable read' } as const)
        : undefined;

    return await db.transaction(async (tx) => {
      try {
        await tx.execute(
          sql`SELECT app.set_identity_context(${opts.accountId}, ${opts.purpose})`
        );
        await assertIdentityContextMatches(tx, opts);
        return await fn(tx, client);
      } catch (error) {
        rememberFailure(error);
        throw error;
      }
    }, transactionConfig);
  } catch (error) {
    broken = broken || isBrokenClientError(error);
    throw requestFailure(error);
  } finally {
    try {
      client.release(broken);
    } finally {
      client.removeListener('error', onClientError);
    }
  }
}

/** A lost/failed rollback means this connection must never rejoin the pool. */
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

  const { observedClient, rememberFailure, requestFailure } = observeTransactionQueries(client, () => {
    broken = true;
  });
  const db = drizzle(observedClient, { schema: safetySchema });

  try {
    // Drizzle owns BEGIN / COMMIT / ROLLBACK for this whole callback. The
    // isolation level is applied by the same seam; no second transaction
    // abstraction and no second checked-out client are introduced.
    const transactionConfig =
      opts.isolationLevel === 'REPEATABLE READ'
        ? ({ isolationLevel: 'repeatable read' } as const)
        : undefined;

    return await db.transaction(async (tx) => {
      try {
        await tx.execute(
          sql`SELECT app.set_identity_context(${opts.accountId}, ${opts.purpose})`
        );
        await assertIdentityContextMatches(tx, opts);
        await tx.execute(
          sql`SELECT app.set_family_context(${opts.familyId}, ${opts.personId}, ${opts.purpose})`
        );
        return await fn(tx, client);
      } catch (error) {
        rememberFailure(error);
        throw error;
      }
    }, transactionConfig);
  } catch (error) {
    broken = broken || isBrokenClientError(error);
    throw requestFailure(error);
  } finally {
    try {
      client.release(broken);
    } finally {
      client.removeListener('error', onClientError);
    }
  }
}