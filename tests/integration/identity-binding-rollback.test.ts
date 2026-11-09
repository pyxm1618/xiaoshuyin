/**
 * H4 — a Phase C commit that loses the P1 conditional update MUST NOT leave an
 * orphan Account. The Account insert and the binding update share a savepoint;
 * the loser rolls the Account back before settling TERMINAL.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';

const injection = vi.hoisted(() => ({ loseBindingRace: false }));

vi.mock('@xiaoshuyin/domain', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@xiaoshuyin/domain')>();
  return {
    ...actual,
    bindPersonAccountIfUnbound: async (
      tx: Parameters<typeof actual.bindPersonAccountIfUnbound>[0],
      personId: string,
      accountId: string
    ) => {
      if (injection.loseBindingRace) return 0;
      return actual.bindPersonAccountIfUnbound(tx, personId, accountId);
    },
  };
});

import {
  buildBindingApp,
  confirmerDecision,
  createTarget,
  startBinding,
  type BindingHarness,
} from '../setup/identity-binding.js';

describe('Phase C concurrency loser leaves no orphan Account (H4)', () => {
  let h: BindingHarness;

  beforeAll(async () => {
    h = await buildBindingApp();
  });

  afterAll(async () => {
    await h.close();
    injection.loseBindingRace = false;
  });

  it('rolls back the newly created Account when the P1 binding update loses', async () => {
    const target = await createTarget(h, 'rollback_p1', { ageBand: 'UNDER_14' });
    const code = `rollback_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const { attemptId } = await startBinding(h, target, code);

    const accountsBefore = await h.admin.query(
      `SELECT count(*)::int AS n FROM accounts WHERE wechat_openid = $1`,
      [`fake_${code}`]
    );
    expect(accountsBefore.rows[0].n).toBe(0);

    injection.loseBindingRace = true;
    const res = await confirmerDecision(h, target.guardian.token, attemptId, {
      personId: target.targetPersonId,
      decision: 'AFFIRM',
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().state).toBe('TERMINAL');

    const accountsAfter = await h.admin.query(
      `SELECT count(*)::int AS n FROM accounts WHERE wechat_openid = $1`,
      [`fake_${code}`]
    );
    expect(accountsAfter.rows[0].n).toBe(0);

    const person = await h.admin.query(
      `SELECT account_id FROM persons WHERE id = $1`,
      [target.targetPersonId]
    );
    expect(person.rows[0].account_id).toBeNull();

    const attempt = await h.admin.query(
      `SELECT state, terminal_reason FROM binding_attempts WHERE id = $1`,
      [attemptId]
    );
    expect(attempt.rows[0].state).toBe('TERMINAL');
    expect(attempt.rows[0].terminal_reason).toBe('CONCURRENCY_LOSER');
  });
});