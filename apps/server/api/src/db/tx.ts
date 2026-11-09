/**
 * Transaction wrappers with RLS context.
 * Per plan.md D-5.5: four entry points, each does one narrow thing.
 * Business code must NOT call set_config directly.
 */

import pg from 'pg';

type TxClient = pg.PoolClient;

/**
 * Shared checked-out-client lifecycle.
 *
 * A connection-level error on a checked-out client is an EventEmitter error,
 * so it needs a listener for the full checkout lifetime. Any such error marks
 * the client broken. Rollback is best-effort and can never replace the
 * original request failure; a client whose connection errored (or whose
 * rollback fails) is destroyed with release(true), per node-postgres.
 */
export async function withTransactionClient<T>(
  pool: pg.Pool,
  fn: (tx: TxClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  let broken = false;

  const onClientError = (_err: Error) => {
    broken = true;
  };
  client.on('error', onClientError);

  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (originalError) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Preserve the original request failure. A failed rollback means this
      // connection must never be returned to the healthy idle pool.
      broken = true;
    }
    throw originalError;
  } finally {
    try {
      client.release(broken);
    } finally {
      client.removeListener('error', onClientError);
    }
  }
}

function identityContextMismatch(): never {
  throw Object.assign(new Error('RLS_IDENTITY_CONTEXT_MISMATCH'), {
    code: '42501',
  });
}

/**
 * UFA-001 shared-seam defence: app.set_identity_context() derives person_id
 * from account_id. Verify that authoritative result before set_family_context()
 * is allowed to overwrite app.person_id with a caller-supplied value.
 */
async function assertIdentityContextMatches(
  tx: TxClient,
  opts: { accountId: string; personId: string; purpose: string }
): Promise<void> {
  const { rows } = await tx.query(
    `SELECT
       app_account_id()::text AS account_id,
       app_person_id()::text AS person_id,
       app_current_purpose() AS purpose`
  );
  const row = rows[0] ?? {};
  if (
    row.account_id !== opts.accountId ||
    row.person_id !== opts.personId ||
    row.purpose !== opts.purpose
  ) {
    identityContextMismatch();
  }
}

export async function withAccountTransaction<T>(
  pool: pg.Pool,
  opts: { accountId: string; purpose: string },
  fn: (tx: TxClient) => Promise<T>
): Promise<T> {
  return withTransactionClient(pool, async (client) => {
    await client.query('SELECT app.set_account_context($1, $2)', [opts.accountId, opts.purpose]);
    return fn(client);
  });
}

export async function withIdentityTransaction<T>(
  pool: pg.Pool,
  opts: { accountId: string; purpose: string },
  fn: (tx: TxClient) => Promise<T>
): Promise<T> {
  return withTransactionClient(pool, async (client) => {
    await client.query('SELECT app.set_identity_context($1, $2)', [opts.accountId, opts.purpose]);
    return fn(client);
  });
}

export async function withFamilyCreationTransaction<T>(
  pool: pg.Pool,
  opts: { accountId: string; personId: string; newFamilyId: string; displayName: string | null },
  fn: (tx: TxClient) => Promise<T>
): Promise<T> {
  return withTransactionClient(pool, async (client) => {
    await client.query('SELECT app.set_identity_context($1, $2)', [opts.accountId, 'FAMILY_MANAGEMENT']);
    await client.query('SELECT app.create_family($1, $2, $3)', [
      opts.newFamilyId,
      opts.personId,
      opts.displayName,
    ]);
    return fn(client);
  });
}

export async function withRlsTransaction<T>(
  pool: pg.Pool,
  opts: { familyId: string; accountId: string; personId: string; purpose: string },
  fn: (tx: TxClient) => Promise<T>
): Promise<T> {
  return withTransactionClient(pool, async (client) => {
    await client.query('SELECT app.set_identity_context($1, $2)', [opts.accountId, opts.purpose]);
    await assertIdentityContextMatches(client, opts);
    await client.query('SELECT app.set_family_context($1, $2, $3)', [
      opts.familyId,
      opts.personId,
      opts.purpose,
    ]);
    return fn(client);
  });
}

/**
 * Thin adapter for the frozen `app.set_family_context` entry (§4.3 entry B).
 * Used inside an already-open identity transaction so that
 * `resolve → authorize → set_family_context → target read/write` stay in ONE
 * transaction (§4.4) without introducing a second context framework.
 */
export async function setFamilyContext(
  tx: TxClient,
  familyId: string,
  personId: string,
  purpose: string
): Promise<void> {
  await tx.query('SELECT app.set_family_context($1, $2, $3)', [familyId, personId, purpose]);
}
