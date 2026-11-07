/**
 * Transaction wrappers with RLS context.
 * Per plan.md D-5.5: four entry points, each does one narrow thing.
 * Business code must NOT call set_config directly.
 */

import pg from 'pg';

type TxClient = pg.PoolClient;

export async function withAccountTransaction<T>(
  pool: pg.Pool,
  opts: { accountId: string; purpose: string },
  fn: (tx: TxClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT app.set_account_context($1, $2)', [opts.accountId, opts.purpose]);
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function withIdentityTransaction<T>(
  pool: pg.Pool,
  opts: { accountId: string; purpose: string },
  fn: (tx: TxClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT app.set_identity_context($1, $2)', [opts.accountId, opts.purpose]);
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function withFamilyCreationTransaction<T>(
  pool: pg.Pool,
  opts: { accountId: string; personId: string; newFamilyId: string; displayName: string | null },
  fn: (tx: TxClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT app.set_identity_context($1, $2)', [opts.accountId, 'FAMILY_MANAGEMENT']);
    await client.query('SELECT app.create_family($1, $2, $3)', [
      opts.newFamilyId,
      opts.personId,
      opts.displayName,
    ]);
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function withRlsTransaction<T>(
  pool: pg.Pool,
  opts: { familyId: string; accountId: string; personId: string; purpose: string },
  fn: (tx: TxClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT app.set_identity_context($1, $2)', [opts.accountId, opts.purpose]);
    await client.query('SELECT app.set_family_context($1, $2, $3)', [
      opts.familyId,
      opts.personId,
      opts.purpose,
    ]);
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
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
