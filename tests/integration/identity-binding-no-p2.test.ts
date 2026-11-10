/**
 * T105 — no-P2 / object-count invariants. `Person increment = 0` on every
 * failure, replay, concurrent and invitation-terminal path.
 *
 * Every scenario in this file goes through the same object-count helper and
 * the same response-material helper, so all six frozen rows prove the full
 * invariant set instead of cherry-picking a couple of counters.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { randomUUID } from 'node:crypto';

// Controlled infrastructure failure / concurrency loss for the retry and
// rollback rows of the T105 matrix. Delegates to the real implementation for
// every other test in this file.
const injection = vi.hoisted(() => ({ failBinding: false, loseRace: false }));

vi.mock('@xiaoshuyin/domain', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@xiaoshuyin/domain')>();
  return {
    ...actual,
    bindPersonAccountIfUnbound: async (
      tx: Parameters<typeof actual.bindPersonAccountIfUnbound>[0],
      personId: string,
      accountId: string
    ) => {
      if (injection.failBinding) throw new Error('INFRA_FAILURE_INJECTION');
      if (injection.loseRace) return 0;
      return actual.bindPersonAccountIfUnbound(tx, personId, accountId);
    },
  };
});

import {
  bootstrap,
  buildBindingApp,
  candidateDecision,
  candidateSession,
  confirmerDecision,
  createTarget,
  personAccountId,
  startBinding,
  type BindingHarness,
} from '../setup/identity-binding.js';
import { loginWithLabel } from '../setup/api.js';

interface ObjectSnapshot {
  /** Accounts created for this candidate openid only. */
  accounts: number;
  /** Persons created BY the candidate account (a Slice-5-created P2). */
  persons: number;
  /** Candidate accounts with neither a Person nor a committed binding. */
  orphanAccounts: number;
  /** 1 when the target P1 has an Account, else 0. */
  p1Bound: number;
  /** COMMITTED attempts for the target P1. */
  committedAttempts: number;
  /** Pending contexts of this target that already carry a committed Account. */
  boundContexts: number;
  /** Slice 5 must not create or mutate Slice 4 participation rows. */
  participantRows: number;
}

describe('no-P2 invariants (T105)', () => {
  let h: BindingHarness;

  beforeAll(async () => {
    h = await buildBindingApp();
  });

  afterAll(async () => {
    injection.failBinding = false;
    injection.loseRace = false;
    await h.close();
  });

  /** Flow-scoped object counts: nothing is asserted on other suites' rows. */
  async function snapshot(code: string, targetPersonId: string): Promise<ObjectSnapshot> {
    const openid = `fake_${code}`;
    const [accounts, persons, orphanAccounts, p1, committed, bound, participant] =
      await Promise.all([
        h.admin.query('SELECT count(*)::int AS n FROM accounts WHERE wechat_openid = $1', [openid]),
        h.admin.query(
          `SELECT count(*)::int AS n FROM persons p
             JOIN accounts a ON a.id = p.created_by_account_id
            WHERE a.wechat_openid = $1`,
          [openid]
        ),
        h.admin.query(
          `SELECT count(*)::int AS n FROM accounts a
            WHERE a.wechat_openid = $1
              AND NOT EXISTS (SELECT 1 FROM persons p WHERE p.account_id = a.id OR p.created_by_account_id = a.id)
              AND NOT EXISTS (SELECT 1 FROM binding_pending_contexts c WHERE c.committed_account_id = a.id)`,
          [openid]
        ),
        h.admin.query(
          'SELECT count(*)::int AS n FROM persons WHERE id = $1 AND account_id IS NOT NULL',
          [targetPersonId]
        ),
        h.admin.query(
          "SELECT count(*)::int AS n FROM binding_attempts WHERE target_person_id = $1 AND state = 'COMMITTED'",
          [targetPersonId]
        ),
        h.admin.query(
          `SELECT count(*)::int AS n FROM binding_pending_contexts c
             JOIN binding_attempts a ON a.id = c.attempt_id
            WHERE a.target_person_id = $1 AND c.committed_account_id IS NOT NULL`,
          [targetPersonId]
        ),
        h.admin.query('SELECT count(*)::int AS n FROM case_participants WHERE person_id = $1', [targetPersonId]),
      ]);
    return {
      accounts: accounts.rows[0].n as number,
      persons: persons.rows[0].n as number,
      orphanAccounts: orphanAccounts.rows[0].n as number,
      p1Bound: p1.rows[0].n as number,
      committedAttempts: committed.rows[0].n as number,
      boundContexts: bound.rows[0].n as number,
      participantRows: participant.rows[0].n as number,
    };
  }

  /**
   * The complete frozen invariant set for one T105 row. `expectCommit` marks
   * the only legal difference: a successful row must end with exactly one P1
   * binding, while every other row keeps P1 unbound and adds nothing.
   */
  function assertInvariantSet(
    label: string,
    before: ObjectSnapshot,
    after: ObjectSnapshot,
    options: { expectCommit: boolean }
  ) {
    // Person increment = 0: Slice 5 never creates a Person, even on success.
    expect(after.persons, `${label}: Person increment`).toBe(before.persons);
    // No orphan Account (Phase C atomicity / rollback).
    expect(after.orphanAccounts, `${label}: orphan candidate accounts`).toBe(0);
    // No participant / invitation lifecycle side effect (Slice 4 boundary).
    expect(after.participantRows, `${label}: participant row delta`).toBe(before.participantRows);
    expect(after.participantRows, `${label}: participant rows`).toBe(0);

    if (options.expectCommit) {
      // A successful commit may create exactly one candidate Account; anything
      // beyond that is an unexpected object.
      expect(after.accounts - before.accounts, `${label}: candidate account delta`).toBeLessThanOrEqual(1);
      expect(after.p1Bound, `${label}: expected P1 binding`).toBe(1);
      expect(
        after.committedAttempts - before.committedAttempts,
        `${label}: successful commits`
      ).toBe(1);
      expect(after.boundContexts, `${label}: expected committed context`).toBe(1);
    } else {
      // Failure / replay rows must not create any candidate Account.
      expect(after.accounts, `${label}: candidate account delta`).toBe(before.accounts);
      // Partial / unexpected binding = 0.
      expect(after.p1Bound, `${label}: P1 must stay unbound`).toBe(before.p1Bound);
      expect(after.p1Bound, `${label}: P1 must stay unbound`).toBe(0);
      expect(after.committedAttempts, `${label}: no commit`).toBe(before.committedAttempts);
      expect(after.boundContexts, `${label}: no committed context`).toBe(0);
    }
  }

  /** No ordinary session / Account / Person material leaks from a failure. */
  function assertNoAuthzMaterial(
    label: string,
    ...responses: Array<{ body: string; headers: Record<string, unknown> }>
  ) {
    for (const res of responses) {
      const body = JSON.parse(res.body) as Record<string, unknown>;
      expect(body, label).not.toHaveProperty('sessionToken');
      expect(body, label).not.toHaveProperty('account');
      expect(body, label).not.toHaveProperty('person');
      expect(res.headers['set-cookie'], label).toBeUndefined();
    }
  }

  async function personsForAccount(accountId: string): Promise<number> {
    const res = await h.admin.query(
      'SELECT count(*)::int AS n FROM persons WHERE account_id = $1',
      [accountId]
    );
    return res.rows[0].n;
  }

  it('ordinary-login-first never becomes a binding or a second Person', async () => {
    const target = await createTarget(h, 'nop2_first', { ageBand: 'UNDER_14' });
    const candidate = await loginWithLabel(h.app, 'nop2_first_candidate');
    // Pre-existing ordinary-login P2 is an external fact; Slice 5 must not
    // create another one or rebind it.
    expect(await personsForAccount(candidate.accountId)).toBe(1);

    const openid = await h.admin.query('SELECT wechat_openid FROM accounts WHERE id = $1', [
      candidate.accountId,
    ]);
    const code = (openid.rows[0].wechat_openid as string).replace(/^fake_/, '');
    const before = await snapshot(code, target.targetPersonId);

    const res = await bootstrap(h, target.invitationToken, code);
    expect(res.json().binding).toBe('NOT_COMPLETED');
    assertNoAuthzMaterial('ordinary-login-first', res);

    const after = await snapshot(code, target.targetPersonId);
    assertInvariantSet('ordinary-login-first', before, after, { expectCommit: false });
    // The pre-existing P2 is unchanged and P1 stays unbound.
    expect(after.persons).toBe(1);
    expect(await personsForAccount(candidate.accountId)).toBe(1);
    expect(await personAccountId(h, target.targetPersonId)).toBeNull();

    const attempts = await h.admin.query(
      'SELECT count(*)::int AS n FROM binding_attempts WHERE target_person_id = $1',
      [target.targetPersonId]
    );
    expect(attempts.rows[0].n).toBe(0);
  });

  it('invitation terminal retry keeps Person increment 0 and 0 commit', async () => {
    const target = await createTarget(h, 'nop2_invite', { ageBand: 'UNDER_14' });
    const code = `nop2_invite_${randomUUID()}`;
    const { attemptId } = await startBinding(h, target, code);
    const before = await snapshot(code, target.targetPersonId);
    expect(before.p1Bound).toBe(0);
    expect(before.accounts).toBe(0);

    h.port.remove(target.invitationToken);
    const commit = await confirmerDecision(h, target.guardian.token, attemptId, {
      personId: target.targetPersonId,
      decision: 'AFFIRM',
    });
    expect(commit.json().state).toBe('TERMINAL');
    assertNoAuthzMaterial('invitation terminal commit', commit);

    const retry = await bootstrap(h, target.invitationToken, `nop2_retry_${randomUUID()}`);
    expect(retry.json().binding).toBe('NOT_COMPLETED');
    assertNoAuthzMaterial('invitation terminal retry', retry);

    const after = await snapshot(code, target.targetPersonId);
    assertInvariantSet('invitation terminal', before, after, { expectCommit: false });
    expect(await personAccountId(h, target.targetPersonId)).toBeNull();
  });

  it('concurrent claims on the same P1 produce at most one commit and no P2', async () => {
    const target = await createTarget(h, 'nop2_concurrent', { ageBand: 'UNDER_14' });
    const codeA = `nop2_ca_${randomUUID()}`;
    const codeB = `nop2_cb_${randomUUID()}`;
    const beforeA = await snapshot(codeA, target.targetPersonId);
    const beforeB = await snapshot(codeB, target.targetPersonId);
    expect(beforeA.p1Bound).toBe(0);

    const bootA = await bootstrap(h, target.invitationToken, codeA);
    const bootB = await bootstrap(h, target.invitationToken, codeB);
    const tokenA = bootA.json().pendingContextToken as string;
    const tokenB = bootB.json().pendingContextToken as string;

    await Promise.all([
      candidateDecision(h, tokenA, 'AFFIRM', `a-${randomUUID()}`, 'candidate-binding-v1'),
      candidateDecision(h, tokenB, 'AFFIRM', `b-${randomUUID()}`, 'candidate-binding-v1'),
    ]);

    const attempts = await h.admin.query(
      'SELECT id FROM binding_attempts WHERE target_person_id = $1 ORDER BY created_at',
      [target.targetPersonId]
    );
    expect(attempts.rows.length).toBe(2);
    const attemptA = attempts.rows[0].id as string;
    const attemptB = attempts.rows[1].id as string;

    const [commitA, commitB] = await Promise.all([
      confirmerDecision(h, target.guardian.token, attemptA, {
        personId: target.targetPersonId,
        decision: 'AFFIRM',
      }),
      confirmerDecision(h, target.guardian.token, attemptB, {
        personId: target.targetPersonId,
        decision: 'AFFIRM',
      }),
    ]);
    assertNoAuthzMaterial('concurrent loser', ...(commitA.json().state === 'COMMITTED' ? [commitB] : [commitA]));

    const afterA = await snapshot(codeA, target.targetPersonId);
    const afterB = await snapshot(codeB, target.targetPersonId);
    // Person increment = 0 for both candidates; no orphan Account survives a
    // losing Phase C.
    for (const [label, before, after] of [
      ['concurrent A', beforeA, afterA],
      ['concurrent B', beforeB, afterB],
    ] as const) {
      expect(after.persons, `${label}: Person increment`).toBe(before.persons);
      expect(after.orphanAccounts, `${label}: orphan candidate accounts`).toBe(0);
      expect(after.participantRows, `${label}: participant row delta`).toBe(before.participantRows);
      expect(after.participantRows, `${label}: participant rows`).toBe(0);
    }

    // successful commits ∈ {0,1}; binding increase <= 1.
    const committedDelta = afterA.committedAttempts - beforeA.committedAttempts;
    expect(committedDelta).toBeGreaterThanOrEqual(0);
    expect(committedDelta).toBeLessThanOrEqual(1);
    expect(afterA.p1Bound).toBeLessThanOrEqual(1);

    const person = await h.admin.query(
      'SELECT id, account_id FROM persons WHERE id = $1',
      [target.targetPersonId]
    );
    expect(person.rows).toHaveLength(1);
    expect(afterA.persons).toBe(0);
    if (person.rows[0].account_id) {
      expect(await personsForAccount(person.rows[0].account_id)).toBe(1);
    }

    const targetAfter = await h.admin.query(
      'SELECT count(*)::int AS n FROM persons WHERE id = $1',
      [target.targetPersonId]
    );
    expect(targetAfter.rows[0].n).toBe(1);

    const sessions = await candidateSession(h, tokenA);
    expect(sessions.statusCode).toBe(200);
  });

  it('bootstrap replay adds no Person / P2 / binding / session, and no participation row', async () => {
    const target = await createTarget(h, 'nop2_replay', { ageBand: 'UNDER_14' });
    const code = `nop2_replay_${randomUUID()}`;
    const key = `nop2-replay-${randomUUID()}`;
    const before = await snapshot(code, target.targetPersonId);

    const first = await bootstrap(h, target.invitationToken, code, key);
    const second = await bootstrap(h, target.invitationToken, code, key);
    expect(first.json().binding).toBe('NOT_COMPLETED');
    expect(second.json().binding).toBe('NOT_COMPLETED');
    expect(second.json().pendingContextToken).not.toBe(first.json().pendingContextToken);
    assertNoAuthzMaterial('bootstrap replay', first, second);

    const after = await snapshot(code, target.targetPersonId);
    assertInvariantSet('bootstrap replay', before, after, { expectCommit: false });
    expect(await personAccountId(h, target.targetPersonId)).toBeNull();

    const attempts = await h.admin.query(
      'SELECT count(*)::int AS n FROM binding_attempts WHERE target_person_id = $1',
      [target.targetPersonId]
    );
    expect(attempts.rows[0].n).toBe(1);
    const audits = await h.admin.query(
      "SELECT count(*)::int AS n FROM identity_binding_audit_events WHERE target_person_id = $1 AND event_type = 'BINDING_COMMITTED'",
      [target.targetPersonId]
    );
    expect(audits.rows[0].n).toBe(0);
  });

  it('RETRYABLE infrastructure failure commits nothing, and retry converges once', async () => {
    const target = await createTarget(h, 'nop2_retryable', { ageBand: 'UNDER_14' });
    const code = `nop2_retryable_${randomUUID()}`;
    const { attemptId } = await startBinding(h, target, code);
    const before = await snapshot(code, target.targetPersonId);

    injection.failBinding = true;
    const retryKey = `nop2-retry-${randomUUID()}`;
    const failed = await confirmerDecision(h, target.guardian.token, attemptId, {
      personId: target.targetPersonId,
      decision: 'AFFIRM',
      idempotencyKey: retryKey,
    });
    injection.failBinding = false;
    expect(failed.statusCode).toBe(500);
    expect(failed.json()).toEqual({
      code: 'INTERNAL_ERROR',
      message: 'An internal error occurred',
    });
    assertNoAuthzMaterial('retryable failure', failed);

    // Operation result RETRYABLE only: attempt is still PENDING, the committed
    // second-party confirmation survives, P1 is unbound and no Account exists.
    const attemptAfterFail = await h.admin.query(
      'SELECT state FROM binding_attempts WHERE id = $1',
      [attemptId]
    );
    expect(attemptAfterFail.rows[0].state).toBe('PENDING');
    const sp = await h.admin.query(
      "SELECT count(*)::int AS n FROM binding_confirmations WHERE attempt_id = $1 AND kind = 'SECOND_PARTY'",
      [attemptId]
    );
    expect(sp.rows[0].n).toBe(1);
    expect(await personAccountId(h, target.targetPersonId)).toBeNull();
    assertInvariantSet('retryable failure', before, await snapshot(code, target.targetPersonId), {
      expectCommit: false,
    });

    // Retry / read-back converges to exactly one COMMITTED.
    const retry = await confirmerDecision(h, target.guardian.token, attemptId, {
      personId: target.targetPersonId,
      decision: 'AFFIRM',
      idempotencyKey: retryKey,
    });
    expect(retry.statusCode).toBe(200);
    expect(retry.json().state).toBe('COMMITTED');
    assertNoAuthzMaterial('retryable success response', retry);

    const after = await snapshot(code, target.targetPersonId);
    assertInvariantSet('retryable retry', before, after, { expectCommit: true });

    const commitAudit = await h.admin.query(
      "SELECT count(*)::int AS n FROM identity_binding_audit_events WHERE attempt_id = $1 AND event_type = 'BINDING_COMMITTED'",
      [attemptId]
    );
    expect(commitAudit.rows[0].n).toBe(1);
  });

  it('rollback (P1 binding update loses) leaves no Account, no partial binding, no P2', async () => {
    const target = await createTarget(h, 'nop2_rollback', { ageBand: 'UNDER_14' });
    const code = `nop2_rollback_${randomUUID()}`;
    const { attemptId } = await startBinding(h, target, code);
    const before = await snapshot(code, target.targetPersonId);

    injection.loseRace = true;
    const res = await confirmerDecision(h, target.guardian.token, attemptId, {
      personId: target.targetPersonId,
      decision: 'AFFIRM',
      idempotencyKey: `nop2-rollback-${randomUUID()}`,
    });
    injection.loseRace = false;

    expect(res.statusCode).toBe(200);
    expect(res.json().state).toBe('TERMINAL');
    assertNoAuthzMaterial('rollback', res);
    expect(await personAccountId(h, target.targetPersonId)).toBeNull();

    const after = await snapshot(code, target.targetPersonId);
    assertInvariantSet('rollback', before, after, { expectCommit: false });

    const attempt = await h.admin.query(
      'SELECT state, terminal_reason FROM binding_attempts WHERE id = $1',
      [attemptId]
    );
    expect(attempt.rows[0]).toEqual({ state: 'TERMINAL', terminal_reason: 'CONCURRENCY_LOSER' });
  });
});