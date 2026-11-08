/**
 * T105 — no-P2 / object-count invariants. `Person increment = 0` on every
 * failure, replay, concurrent and invitation-terminal path.
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
  async function counts(code: string, targetPersonId: string) {
    const openid = `fake_${code}`;
    const [accounts, persons, p2, bound, sessions] = await Promise.all([
      h.admin.query('SELECT count(*)::int AS n FROM accounts WHERE wechat_openid = $1', [openid]),
      h.admin.query(
        `SELECT count(*)::int AS n FROM persons p
          JOIN accounts a ON a.id = p.created_by_account_id
         WHERE a.wechat_openid = $1`,
        [openid]
      ),
      h.admin.query(
        `SELECT count(*)::int AS n FROM persons p
          JOIN accounts a ON a.id = p.created_by_account_id
         WHERE a.wechat_openid = $1`,
        [openid]
      ),
      h.admin.query(
        'SELECT count(*)::int AS n FROM persons WHERE id = $1 AND account_id IS NOT NULL',
        [targetPersonId]
      ),
      h.admin.query(
        `SELECT count(*)::int AS n FROM binding_pending_contexts c
          JOIN binding_attempts a ON a.id = c.attempt_id
         WHERE a.target_person_id = $1 AND c.committed_account_id IS NOT NULL`,
        [targetPersonId]
      ),
    ]);
    return {
      accounts: accounts.rows[0].n as number,
      persons: persons.rows[0].n as number,
      p2: p2.rows[0].n as number,
      bound: bound.rows[0].n as number,
      sessionsTagged: sessions.rows[0].n as number,
    };
  }

  async function participantTable() {
    const r = await h.admin.query("SELECT to_regclass('public.case_participants') AS t");
    return r.rows[0].t as string | null;
  }

  function expectNoUnexpectedAuthz(res: { body: string; headers: Record<string, unknown> }) {
    const body = JSON.parse(res.body);
    expect(body).not.toHaveProperty('sessionToken');
    expect(body).not.toHaveProperty('account');
    expect(body).not.toHaveProperty('person');
    expect(res.headers['set-cookie']).toBeUndefined();
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
    expect(await personsForAccount(candidate.accountId)).toBe(1);

    const openid = await h.admin.query('SELECT wechat_openid FROM accounts WHERE id = $1', [
      candidate.accountId,
    ]);
    const code = (openid.rows[0].wechat_openid as string).replace(/^fake_/, '');

    const res = await bootstrap(h, target.invitationToken, code);
    expect(res.json().binding).toBe('NOT_COMPLETED');
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
    const targetPersonBefore = await h.admin.query(
      'SELECT id, account_id FROM persons WHERE id = $1',
      [target.targetPersonId]
    );
    expect(targetPersonBefore.rows).toHaveLength(1);
    expect(targetPersonBefore.rows[0].account_id).toBeNull();

    h.port.remove(target.invitationToken);
    const commit = await confirmerDecision(h, target.guardian.token, attemptId, {
      personId: target.targetPersonId,
      decision: 'AFFIRM',
    });
    expect(commit.json().state).toBe('TERMINAL');

    const retry = await bootstrap(h, target.invitationToken, `nop2_retry_${randomUUID()}`);
    expect(retry.json().binding).toBe('NOT_COMPLETED');

    const targetPersonAfter = await h.admin.query(
      'SELECT id, account_id FROM persons WHERE id = $1',
      [target.targetPersonId]
    );
    expect(targetPersonAfter.rows).toHaveLength(1);
    expect(targetPersonAfter.rows[0]).toEqual(targetPersonBefore.rows[0]);
    expect(await personAccountId(h, target.targetPersonId)).toBeNull();

    const c = await counts(code, target.targetPersonId);
    expect(c.accounts).toBe(0);
    expect(c.persons).toBe(0);
    expect(c.p2).toBe(0);
    expect(c.bound).toBe(0);
    expect(c.sessionsTagged).toBe(0);
    expect(await participantTable()).toBeNull();
    const committed = await h.admin.query(
      "SELECT count(*)::int AS n FROM binding_attempts WHERE target_person_id = $1 AND state = 'COMMITTED'",
      [target.targetPersonId]
    );
    expect(committed.rows[0].n).toBe(0);
  });

  it('concurrent claims on the same P1 produce at most one commit and no P2', async () => {
    const target = await createTarget(h, 'nop2_concurrent', { ageBand: 'UNDER_14' });
    const targetPersonBefore = await h.admin.query(
      'SELECT id, account_id FROM persons WHERE id = $1',
      [target.targetPersonId]
    );
    expect(targetPersonBefore.rows).toHaveLength(1);
    expect(targetPersonBefore.rows[0].account_id).toBeNull();

    const codeA = `nop2_ca_${randomUUID()}`;
    const codeB = `nop2_cb_${randomUUID()}`;
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

    await Promise.all([
      confirmerDecision(h, target.guardian.token, attemptA, {
        personId: target.targetPersonId,
        decision: 'AFFIRM',
      }),
      confirmerDecision(h, target.guardian.token, attemptB, {
        personId: target.targetPersonId,
        decision: 'AFFIRM',
      }),
    ]);

    const settled = await h.admin.query(
      'SELECT state, count(*)::int AS n FROM binding_attempts WHERE target_person_id = $1 GROUP BY state',
      [target.targetPersonId]
    );
    const committed = settled.rows.find((r) => r.state === 'COMMITTED');
    expect(Number(committed?.n ?? 0)).toBeLessThanOrEqual(1);

    const person = await h.admin.query(
      'SELECT id, account_id FROM persons WHERE id = $1',
      [target.targetPersonId]
    );
    expect(person.rows).toHaveLength(1);
    expect(person.rows[0].account_id).toBeTruthy();
    expect(await personsForAccount(person.rows[0].account_id)).toBe(1);

    const targetAfter = await h.admin.query(
      'SELECT count(*)::int AS n FROM persons WHERE id = $1',
      [target.targetPersonId]
    );
    expect(targetAfter.rows[0].n).toBe(1);

    const sessions = await candidateSession(h, tokenA);
    expect(sessions.statusCode).toBe(200);
  });

  it('bootstrap replay adds no Person / P2 / binding / session, and no participant', async () => {
    const target = await createTarget(h, 'nop2_replay', { ageBand: 'UNDER_14' });
    const code = `nop2_replay_${randomUUID()}`;
    const key = `nop2-replay-${randomUUID()}`;

    const first = await bootstrap(h, target.invitationToken, code, key);
    const second = await bootstrap(h, target.invitationToken, code, key);
    expect(first.json().binding).toBe('NOT_COMPLETED');
    expect(second.json().binding).toBe('NOT_COMPLETED');
    expect(second.json().pendingContextToken).not.toBe(first.json().pendingContextToken);
    expectNoUnexpectedAuthz(first);
    expectNoUnexpectedAuthz(second);

    const c = await counts(code, target.targetPersonId);
    expect(c.accounts).toBe(0);
    expect(c.persons).toBe(0);
    expect(c.p2).toBe(0);
    expect(c.bound).toBe(0);
    expect(c.sessionsTagged).toBe(0);
    expect(await personAccountId(h, target.targetPersonId)).toBeNull();
    expect(await participantTable()).toBeNull();

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

    injection.failBinding = true;
    const failed = await confirmerDecision(h, target.guardian.token, attemptId, {
      personId: target.targetPersonId,
      decision: 'AFFIRM',
      idempotencyKey: `nop2-retry-a-${randomUUID()}`,
    });
    injection.failBinding = false;
    expect(failed.statusCode).toBe(500);
    expect(failed.json()).toEqual({
      code: 'INTERNAL_ERROR',
      message: 'An internal error occurred',
    });
    expectNoUnexpectedAuthz(failed);

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
    let c = await counts(code, target.targetPersonId);
    expect(c.accounts).toBe(0);
    expect(c.p2).toBe(0);
    expect(c.bound).toBe(0);
    expect(await participantTable()).toBeNull();

    // Retry / read-back converges to exactly one COMMITTED.
    const retry = await confirmerDecision(h, target.guardian.token, attemptId, {
      personId: target.targetPersonId,
      decision: 'AFFIRM',
      idempotencyKey: `nop2-retry-b-${randomUUID()}`,
    });
    expect(retry.statusCode).toBe(200);
    expect(retry.json().state).toBe('COMMITTED');

    const committed = await h.admin.query(
      "SELECT count(*)::int AS n FROM binding_attempts WHERE target_person_id = $1 AND state = 'COMMITTED'",
      [target.targetPersonId]
    );
    expect(committed.rows[0].n).toBe(1);
    const commitAudit = await h.admin.query(
      "SELECT count(*)::int AS n FROM identity_binding_audit_events WHERE attempt_id = $1 AND event_type = 'BINDING_COMMITTED'",
      [attemptId]
    );
    expect(commitAudit.rows[0].n).toBe(1);
    c = await counts(code, target.targetPersonId);
    expect(c.persons).toBe(0); // no Person increment beyond P1 binding
    expect(c.p2).toBe(0);
    expect(c.bound).toBe(1);
    expect(await participantTable()).toBeNull();
  });

  it('rollback (P1 binding update loses) leaves no Account, no partial binding, no P2', async () => {
    const target = await createTarget(h, 'nop2_rollback', { ageBand: 'UNDER_14' });
    const code = `nop2_rollback_${randomUUID()}`;
    const { attemptId } = await startBinding(h, target, code);

    injection.loseRace = true;
    const res = await confirmerDecision(h, target.guardian.token, attemptId, {
      personId: target.targetPersonId,
      decision: 'AFFIRM',
      idempotencyKey: `nop2-rollback-${randomUUID()}`,
    });
    injection.loseRace = false;

    expect(res.statusCode).toBe(200);
    expect(res.json().state).toBe('TERMINAL');
    expectNoUnexpectedAuthz(res);
    expect(await personAccountId(h, target.targetPersonId)).toBeNull();

    const c = await counts(code, target.targetPersonId);
    expect(c.accounts).toBe(0);
    expect(c.persons).toBe(0);
    expect(c.p2).toBe(0);
    expect(c.bound).toBe(0);
    expect(c.sessionsTagged).toBe(0);
    expect(await participantTable()).toBeNull();

    const committed = await h.admin.query(
      "SELECT count(*)::int AS n FROM binding_attempts WHERE target_person_id = $1 AND state = 'COMMITTED'",
      [target.targetPersonId]
    );
    expect(committed.rows[0].n).toBe(0);
    const attempt = await h.admin.query(
      'SELECT state, terminal_reason FROM binding_attempts WHERE id = $1',
      [attemptId]
    );
    expect(attempt.rows[0]).toEqual({ state: 'TERMINAL', terminal_reason: 'CONCURRENCY_LOSER' });
  });
});