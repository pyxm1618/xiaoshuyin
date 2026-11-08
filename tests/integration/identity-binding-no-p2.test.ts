/**
 * T105 — no-P2 / object-count invariants. `Person increment = 0` on every
 * failure, replay, concurrent and invitation-terminal path.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
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
    await h.close();
  });

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
    const { attemptId } = await startBinding(h, target, `nop2_invite_${randomUUID()}`);
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
});