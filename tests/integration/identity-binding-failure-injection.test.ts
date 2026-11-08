/**
 * F-08 — rollback failure-injection matrix.
 *
 * Six independent failure points inside the Phase C commit transaction:
 *  1. Gate 2 recheck throws
 *  2. Account create/reuse fails
 *  3. Person binding update fails
 *  4. attempt settlement fails
 *  5. all-context cleanup fails
 *  6. audit insert fails
 *
 * Every injection must roll back mutations, surface operation-level RETRYABLE,
 * and leave no orphan Account / partial binding / false COMMITTED / false
 * TERMINAL. Only injection (1) is application-level (mocked composition); the
 * other five use real PostgreSQL triggers.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { randomUUID } from 'node:crypto';

const injection = vi.hoisted(() => ({ gateRecheckFail: false }));

vi.mock('../../apps/server/api/src/identity-binding/gate.js', async (importOriginal) => {
  const actual = await importOriginal<
    typeof import('../../apps/server/api/src/identity-binding/gate.js')
  >();
  return {
    ...actual,
    evaluateGateForTarget: async (...args: Parameters<typeof actual.evaluateGateForTarget>) => {
      if (injection.gateRecheckFail) throw new Error('INJECTED_GATE_RECHECK_FAILURE');
      return actual.evaluateGateForTarget(...args);
    },
  };
});

import {
  buildBindingApp,
  createAppPool,
  createTarget,
  startBinding,
  type BindingHarness,
  type TargetFixture,
} from '../setup/identity-binding.js';
import { commitAttempt } from '../../apps/server/api/src/identity-binding/commit.js';

const SECRET = process.env['IDENTITY_BINDING_SECRET']!;

async function prepare(
  h: BindingHarness,
  label: string
): Promise<{ target: TargetFixture; code: string; attemptId: string }> {
  const target = await createTarget(h, label, { ageBand: 'UNDER_14' });
  const code = `${label}_${randomUUID()}`;
  const { attemptId } = await startBinding(h, target, code);
  await h.admin.query(
    `INSERT INTO binding_confirmations
       (attempt_id, kind, actor_account_id, actor_person_id, authority,
        target_confirmed, candidate_recognized, statement_version)
     VALUES ($1, 'SECOND_PARTY', $2, $3, 'GUARDIAN', true, true, 'second-party-recognition-v1')`,
    [attemptId, target.guardian.accountId, target.guardian.personId]
  );
  return { target, code, attemptId };
}

async function runCommit(
  h: BindingHarness,
  target: TargetFixture,
  attemptId: string
) {
  const pool = createAppPool(1);
  try {
    return await commitAttempt(
      { pool, invitationPort: h.port, identityBindingSecret: SECRET },
      {
        attemptId,
        targetPersonId: target.targetPersonId,
        targetFamilyId: target.familyId,
        actorAccountId: target.guardian.accountId,
      }
    );
  } finally {
    await pool.end();
  }
}

async function assertRolledBack(
  h: BindingHarness,
  target: TargetFixture,
  code: string,
  attemptId: string
): Promise<void> {
  const accounts = await h.admin.query(
    'SELECT count(*)::int AS n FROM accounts WHERE wechat_openid = $1',
    [`fake_${code}`]
  );
  expect(accounts.rows[0].n).toBe(0);

  const person = await h.admin.query('SELECT account_id FROM persons WHERE id = $1', [
    target.targetPersonId,
  ]);
  expect(person.rows[0].account_id).toBeNull();

  const attempt = await h.admin.query(
    'SELECT state, terminal_reason, committed_account_id FROM binding_attempts WHERE id = $1',
    [attemptId]
  );
  expect(attempt.rows[0]).toEqual({
    state: 'PENDING',
    terminal_reason: null,
    committed_account_id: null,
  });

  const committed = await h.admin.query(
    `SELECT count(*)::int AS n FROM identity_binding_audit_events
      WHERE attempt_id = $1 AND event_type = 'BINDING_COMMITTED'`,
    [attemptId]
  );
  expect(committed.rows[0].n).toBe(0);
}

async function withFailTrigger<T>(
  h: BindingHarness,
  table: string,
  event: 'INSERT' | 'UPDATE',
  column: string,
  targetValue: string,
  fn: () => Promise<T>
): Promise<T> {
  const suffix = randomUUID().replace(/-/g, '_');
  const fnName = `test_fail_${suffix}`;
  const trgName = `test_fail_${suffix}`;
  // Row-scoped injection: only the exact target row fails, so parallel test
  // files (which share this database) are never affected.
  await h.admin.query(
    `CREATE FUNCTION ${fnName}() RETURNS trigger LANGUAGE plpgsql AS $$
     BEGIN
       IF NEW.${column}::text = TG_ARGV[0] THEN
         RAISE EXCEPTION 'INJECTED_FAILURE' USING ERRCODE = 'P0001';
       END IF;
       RETURN NEW;
     END $$;`
  );
  await h.admin.query(
    `CREATE TRIGGER ${trgName} BEFORE ${event} ON ${table}
       FOR EACH ROW EXECUTE FUNCTION ${fnName}('${targetValue}');`
  );
  try {
    return await fn();
  } finally {
    await h.admin.query(`DROP TRIGGER IF EXISTS ${trgName} ON ${table}`);
    await h.admin.query(`DROP FUNCTION IF EXISTS ${fnName}();`);
  }
}

describe('Phase C rollback failure-injection matrix (F-08)', () => {
  let h: BindingHarness;

  beforeAll(async () => {
    h = await buildBindingApp();
  });

  afterAll(async () => {
    await h.close();
    injection.gateRecheckFail = false;
  });

  it('Gate 2 recheck failure rolls back and returns RETRYABLE', async () => {
    const { target, code, attemptId } = await prepare(h, 'inj_gate2');
    injection.gateRecheckFail = true;
    try {
      const outcome = await runCommit(h, target, attemptId);
      expect(outcome.outcome).toBe('RETRYABLE');
    } finally {
      injection.gateRecheckFail = false;
    }
    await assertRolledBack(h, target, code, attemptId);
  });

  it('Account create/reuse failure rolls back and returns RETRYABLE', async () => {
    const { target, code, attemptId } = await prepare(h, 'inj_account');
    const outcome = await withFailTrigger(h, 'accounts', 'INSERT', 'wechat_openid', `fake_${code}`, () =>
      runCommit(h, target, attemptId)
    );
    expect(outcome.outcome).toBe('RETRYABLE');
    await assertRolledBack(h, target, code, attemptId);
  });

  it('Person binding update failure rolls back and returns RETRYABLE', async () => {
    const { target, code, attemptId } = await prepare(h, 'inj_person');
    const outcome = await withFailTrigger(h, 'persons', 'UPDATE', 'id', target.targetPersonId, () =>
      runCommit(h, target, attemptId)
    );
    expect(outcome.outcome).toBe('RETRYABLE');
    await assertRolledBack(h, target, code, attemptId);
  });

  it('attempt settlement failure rolls back and returns RETRYABLE', async () => {
    const { target, code, attemptId } = await prepare(h, 'inj_settle');
    const outcome = await withFailTrigger(h, 'binding_attempts', 'UPDATE', 'id', attemptId, () =>
      runCommit(h, target, attemptId)
    );
    expect(outcome.outcome).toBe('RETRYABLE');
    await assertRolledBack(h, target, code, attemptId);
  });

  it('all-context cleanup failure rolls back and returns RETRYABLE', async () => {
    const { target, code, attemptId } = await prepare(h, 'inj_cleanup');
    const outcome = await withFailTrigger(h, 'binding_pending_contexts', 'UPDATE', 'attempt_id', attemptId, () =>
      runCommit(h, target, attemptId)
    );
    expect(outcome.outcome).toBe('RETRYABLE');
    await assertRolledBack(h, target, code, attemptId);
  });

  it('audit insert failure rolls back and returns RETRYABLE', async () => {
    const { target, code, attemptId } = await prepare(h, 'inj_audit');
    const outcome = await withFailTrigger(h, 'identity_binding_audit_events', 'INSERT', 'attempt_id', attemptId, () =>
      runCommit(h, target, attemptId)
    );
    expect(outcome.outcome).toBe('RETRYABLE');
    await assertRolledBack(h, target, code, attemptId);
  });
});