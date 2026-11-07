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
// ── Slice 006 identity-binding wrappers ─────────────────────
// Five thin wrappers reusing the same BEGIN/COMMIT/ROLLBACK + transaction-bound
// `set_config` discipline. Business code never calls set_config directly.

export interface BindingContextTxOptions {
  tokenHash: string;
}

export async function withBindingContextTransaction<T>(
  pool: pg.Pool,
  opts: BindingContextTxOptions,
  fn: (tx: TxClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT app.set_binding_context($1, $2)', [
      opts.tokenHash,
      'IDENTITY_BINDING_PENDING',
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

export interface BindingBootstrapTxOptions {
  contextHash: string;
  identityDigest: string;
}

export async function withBindingBootstrapTransaction<T>(
  pool: pg.Pool,
  opts: BindingBootstrapTxOptions,
  fn: (tx: TxClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT app.set_binding_context($1, $2)', [
      opts.contextHash,
      'IDENTITY_BINDING_PENDING',
    ]);
    await client.query('SELECT app.set_binding_identity_context($1, $2)', [
      opts.identityDigest,
      'IDENTITY_BINDING_PENDING',
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

export interface BindingTargetTxOptions {
  targetPersonId: string;
  actorAccountId?: string | null;
}

/** Target-person-only Gate context (used to resolve P1's unique Family). */
export async function withBindingTargetTransaction<T>(
  pool: pg.Pool,
  opts: BindingTargetTxOptions,
  fn: (tx: TxClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT app.set_binding_target_context($1, $2)', [
      opts.targetPersonId,
      opts.actorAccountId ?? null,
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

/** Set attempt visibility inside an already-open binding transaction. */
export async function setBindingAttemptContext(
  tx: TxClient,
  opts: {
    attemptId: string;
    identityDigest: string;
    invitationId: string | null;
    targetPersonId?: string | null;
    targetFamilyId?: string | null;
    purpose?: string;
  }
): Promise<void> {
  await tx.query('SELECT app.set_binding_attempt_context($1, $2, $3, $4, $5, $6)', [
    opts.attemptId,
    opts.identityDigest,
    opts.invitationId,
    opts.targetPersonId ?? null,
    opts.targetFamilyId ?? null,
    opts.purpose ?? 'IDENTITY_BINDING_PENDING',
  ]);
}

export interface BindingGateTxOptions {
  targetPersonId: string;
  targetFamilyId?: string | null;
  actorAccountId?: string | null;
  identityDigest?: string | null;
  attemptId?: string | null;
}

export async function withBindingGateTransaction<T>(
  pool: pg.Pool,
  opts: BindingGateTxOptions,
  fn: (tx: TxClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (opts.identityDigest) {
      await client.query('SELECT app.set_binding_identity_context($1, $2)', [
        opts.identityDigest,
        'IDENTITY_BINDING_GATE',
      ]);
    }
    if (opts.attemptId) {
      await client.query('SELECT app.set_binding_attempt_context($1, $2, $3, $4, $5, $6)', [
        opts.attemptId,
        opts.identityDigest ?? '',
        null,
        opts.targetPersonId,
        opts.targetFamilyId ?? null,
        'IDENTITY_BINDING_GATE',
      ]);
    }
    await client.query('SELECT app.set_binding_gate_context($1, $2, $3, $4)', [
      opts.targetPersonId,
      opts.targetFamilyId ?? null,
      null,
      opts.actorAccountId ?? null,
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

export interface BindingCommitTxOptions {
  attemptId: string;
  targetPersonId: string;
  targetFamilyId: string;
  contextId?: string | null;
  actorAccountId?: string | null;
  commitAccountId?: string | null;
}

export async function withBindingCommitTransaction<T>(
  pool: pg.Pool,
  opts: BindingCommitTxOptions,
  fn: (tx: TxClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT app.set_binding_commit_context($1, $2, $3, $4, $5)', [
      opts.attemptId,
      opts.targetPersonId,
      opts.targetFamilyId,
      opts.contextId ?? null,
      opts.actorAccountId ?? null,
    ]);
    if (opts.commitAccountId) {
      await client.query('SELECT app.set_binding_commit_account_id($1)', [opts.commitAccountId]);
    }
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

export interface BindingAttemptTxOptions {
  attemptId: string;
  identityDigest: string;
  invitationId: string;
  targetPersonId?: string | null;
  targetFamilyId?: string | null;
  actorAccountId?: string | null;
}

export async function withBindingAttemptTransaction<T>(
  pool: pg.Pool,
  opts: BindingAttemptTxOptions,
  fn: (tx: TxClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT app.set_binding_attempt_context($1, $2, $3, $4, $5, $6)', [
      opts.attemptId,
      opts.identityDigest,
      opts.invitationId,
      opts.targetPersonId ?? null,
      opts.targetFamilyId ?? null,
      'IDENTITY_BINDING_PENDING',
    ]);
    if (opts.actorAccountId) {
      await client.query(`SELECT set_config('app.account_id', $1, true)`, [opts.actorAccountId]);
    }
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

/** Resolve the target Family after reading P1's unique membership, same tx. */
export async function setBindingGateContext(
  tx: TxClient,
  opts: {
    targetPersonId: string;
    targetFamilyId: string;
    invitationId?: string | null;
    actorAccountId?: string | null;
  }
): Promise<void> {
  await tx.query('SELECT app.set_binding_gate_context($1, $2, $3, $4)', [
    opts.targetPersonId,
    opts.targetFamilyId,
    opts.invitationId ?? null,
    opts.actorAccountId ?? null,
  ]);
}

/** Set the exact account id used by the Phase C `persons` conditional update. */
export async function setBindingCommitAccountId(
  tx: TxClient,
  accountId: string
): Promise<void> {
  await tx.query('SELECT app.set_binding_commit_account_id($1)', [accountId]);
}

export async function setBindingCandidateAccountId(
  tx: TxClient,
  accountId: string
): Promise<void> {
  await tx.query('SELECT app.set_binding_candidate_account_id($1)', [accountId]);
}

export async function setBindingOperationScope(
  tx: TxClient,
  scopeKey: string
): Promise<void> {
  await tx.query('SELECT app.set_binding_operation_scope($1)', [scopeKey]);
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
