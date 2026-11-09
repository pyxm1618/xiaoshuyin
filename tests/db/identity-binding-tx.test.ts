import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import { createAppPool } from '../setup/identity-binding.js';
import {
  withAccountTransaction,
  withBindingAttemptTransaction,
  withBindingBootstrapTransaction,
  withBindingCommitTransaction,
  withBindingContextTransaction,
  withBindingGateTransaction,
  withBindingTargetTransaction,
} from '../../apps/server/api/src/db/tx.js';

const UUID_A = '01a1b5c0-0000-7000-8000-000000000001';
const UUID_B = '01a1b5c0-0000-7000-8000-000000000002';
const UUID_C = '01a1b5c0-0000-7000-8000-000000000003';
const DIGEST = 'a'.repeat(64);
const HASH = 'b'.repeat(64);

describe('binding transaction wrappers', () => {
  let pool: pg.Pool;

  beforeAll(() => {
    pool = createAppPool();
  });

  afterAll(async () => {
    await pool.end();
  });

  async function settings(tx: pg.PoolClient) {
    const { rows } = await tx.query(
      `SELECT current_setting('app.purpose', true) AS purpose,
              current_setting('app.binding_context_hash', true) AS context_hash,
              current_setting('app.binding_identity_digest', true) AS identity,
              current_setting('app.binding_invitation_id', true) AS invitation,
              current_setting('app.binding_attempt_id', true) AS attempt,
              current_setting('app.binding_target_person_id', true) AS person,
              current_setting('app.binding_target_family_id', true) AS family,
              current_setting('app.binding_commit_account_id', true) AS commit_account,
              current_setting('app.account_id', true) AS account`
    );
    return rows[0];
  }

  it('context wrapper sets token hash + PENDING purpose only', async () => {
    const s = await withBindingContextTransaction(pool, { tokenHash: HASH }, (tx) =>
      settings(tx)
    );
    expect(s.purpose).toBe('IDENTITY_BINDING_PENDING');
    expect(s.context_hash).toBe(HASH);
    expect(s.family).toBeNull();
  });

  it('bootstrap wrapper sets identity digest + PENDING purpose', async () => {
    const s = await withBindingBootstrapTransaction(
      pool,
      { contextHash: HASH, identityDigest: DIGEST },
      (tx) => settings(tx)
    );
    expect(s.purpose).toBe('IDENTITY_BINDING_PENDING');
    expect(s.identity).toBe(DIGEST);
  });

  it('target wrapper sets person/account + GATE purpose', async () => {
    const s = await withBindingTargetTransaction(
      pool,
      { targetPersonId: UUID_A, actorAccountId: UUID_B },
      (tx) => settings(tx)
    );
    expect(s.purpose).toBe('IDENTITY_BINDING_GATE');
    expect(s.person).toBe(UUID_A);
    expect(s.account).toBe(UUID_B);
    expect(s.family).toBeNull();
  });

  it('gate wrapper sets target person/family/account + GATE purpose', async () => {
    const s = await withBindingGateTransaction(
      pool,
      { targetPersonId: UUID_A, targetFamilyId: UUID_C, actorAccountId: UUID_B },
      (tx) => settings(tx)
    );
    expect(s.purpose).toBe('IDENTITY_BINDING_GATE');
    expect(s.person).toBe(UUID_A);
    expect(s.family).toBe(UUID_C);
    expect(s.account).toBe(UUID_B);
  });

  it('commit wrapper sets attempt/target/context/account + COMMIT purpose', async () => {
    const s = await withBindingCommitTransaction(
      pool,
      {
        attemptId: UUID_A,
        targetPersonId: UUID_B,
        targetFamilyId: UUID_C,
        contextId: UUID_A,
        actorAccountId: UUID_B,
      },
      (tx) => settings(tx)
    );
    expect(s.purpose).toBe('IDENTITY_BINDING_COMMIT');
    expect(s.attempt).toBe(UUID_A);
    expect(s.person).toBe(UUID_B);
    expect(s.family).toBe(UUID_C);
    expect(s.account).toBe(UUID_B);
  });

  it('attempt wrapper sets attempt identity + PENDING purpose', async () => {
    const s = await withBindingAttemptTransaction(
      pool,
      { attemptId: UUID_A, identityDigest: DIGEST, invitationId: UUID_B },
      (tx) => settings(tx)
    );
    expect(s.purpose).toBe('IDENTITY_BINDING_PENDING');
    expect(s.attempt).toBe(UUID_A);
    expect(s.identity).toBe(DIGEST);
    expect(s.invitation).toBe(UUID_B);
  });

  it('ordinary account wrapper behaviour is unchanged', async () => {
    const s = await withAccountTransaction(
      pool,
      { accountId: UUID_A, purpose: 'SELF_IDENTITY' },
      (tx) => settings(tx)
    );
    expect(s.purpose).toBe('SELF_IDENTITY');
    expect(s.account).toBe(UUID_A);
  });
});