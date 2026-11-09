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
    // M-03: an expired pending context is scrubbed inside this transaction
    // before the error is raised. Rolling back would resurrect the decryptable
    // OpenID, so the scrub-only exit path commits the cleanup and nothing else.
    if (
      (err as { bindingContextScrubbed?: boolean }).bindingContextScrubbed === true
    ) {
      await client.query('COMMIT');
    } else {
      await client.query('ROLLBACK');
    }
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

/**
 * Exact operation-key replay context for the confirmer.
 *
 * The operation-key's attempt id is the authoritative historical mapping, so a
 * replay reads THAT attempt by exact id. It must NOT re-derive mutable current
 * target facts (guardian / membership / consent) just to make the row visible.
 * RLS still requires the exact target Person, and the row is SELECT-only.
 */
export async function setBindingConfirmerReplayContext(
  tx: TxClient,
  opts: { attemptId: string; targetPersonId: string }
): Promise<void> {
  await tx.query('SELECT app.set_binding_confirmer_replay_context($1, $2)', [
    opts.attemptId,
    opts.targetPersonId,
  ]);
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


// ── Slice 4 participation invitation context ────────────────

export async function setInviteTokenContext(
  tx: TxClient,
  tokenHash: string
): Promise<void> {
  await tx.query('SELECT app.set_invite_token_context($1)', [tokenHash]);
}

/**
 * Public invite lookup: token hash is the only RLS credential. No Account,
 * Person or Family identity is fabricated for this transaction.
 */
export async function withInviteTokenTransaction<T>(
  pool: pg.Pool,
  opts: { tokenHash: string },
  fn: (tx: TxClient) => Promise<T>
): Promise<T> {
  return withTransactionClient(pool, async (tx) => {
    await setInviteTokenContext(tx, opts.tokenHash);
    return fn(tx);
  });
}
