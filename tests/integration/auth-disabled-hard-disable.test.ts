/**
 * AUTH-001 permanent counterfactual matrix — Account DISABLED is a hard
 * authenticated-authority boundary, not a UI state.
 *
 * Regression-first: this suite is intentionally committed before production
 * changes so the pre-AUTH-001 runtime demonstrates the violations mechanically.
 */

import { randomUUID } from 'node:crypto';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  bootstrap,
  buildBindingApp,
  candidateSession,
  confirmerDecision,
  createTarget,
  personAccountId,
  startBinding,
  type BindingHarness,
} from '../setup/identity-binding.js';

describe('AUTH-001 — DISABLED Account hard disable', () => {
  let h: BindingHarness;

  beforeAll(async () => {
    h = await buildBindingApp();
  });

  afterAll(async () => {
    await h.close();
  });

  async function login(code: string) {
    return h.app.inject({
      method: 'POST',
      url: '/api/v1/auth/wechat',
      payload: { code },
    });
  }

  async function me(token: string) {
    return h.app.inject({
      method: 'GET',
      url: '/api/v1/me',
      headers: { authorization: `Bearer ${token}` },
    });
  }

  async function accountFacts(accountId: string) {
    const { rows } = await h.admin.query(
      'SELECT status, session_epoch FROM accounts WHERE id = $1',
      [accountId]
    );
    return rows[0] as { status: 'ACTIVE' | 'DISABLED'; session_epoch: number };
  }

  it('Case A + E: disable rejects token A; re-enable never revives it; fresh login token B works', async () => {
    const code = `auth001_epoch_${randomUUID()}`;
    const initial = await login(code);
    expect(initial.statusCode).toBe(200);

    const accountId = initial.json().accountId as string;
    const personId = initial.json().person.id as string;
    const tokenA = initial.json().sessionToken as string;

    expect((await me(tokenA)).statusCode).toBe(200);
    const beforeDisable = await accountFacts(accountId);

    await h.admin.query(
      "UPDATE accounts SET status = 'DISABLED' WHERE id = $1",
      [accountId]
    );
    const disabled = await accountFacts(accountId);
    expect(disabled.status).toBe('DISABLED');
    expect(disabled.session_epoch).toBe(beforeDisable.session_epoch + 1);
    expect((await me(tokenA)).statusCode).toBe(401);

    // Hard disable is authority revocation, not identity destruction.
    const preservedWhileDisabled = await h.admin.query(
      'SELECT account_id FROM persons WHERE id = $1',
      [personId]
    );
    expect(preservedWhileDisabled.rows[0].account_id).toBe(accountId);

    await h.admin.query(
      "UPDATE accounts SET status = 'ACTIVE' WHERE id = $1",
      [accountId]
    );
    const reenabled = await accountFacts(accountId);
    expect(reenabled.status).toBe('ACTIVE');
    expect(reenabled.session_epoch).toBe(disabled.session_epoch + 1);

    // Critical counterfactual: token A must stay dead BEFORE any fresh login.
    expect((await me(tokenA)).statusCode).toBe(401);

    const fresh = await login(code);
    expect(fresh.statusCode).toBe(200);
    expect(fresh.json().accountId).toBe(accountId);
    const tokenB = fresh.json().sessionToken as string;
    expect(tokenB).not.toBe(tokenA);
    expect((await me(tokenB)).statusCode).toBe(200);
    expect((await me(tokenA)).statusCode).toBe(401);

    const preservedAfterReenable = await h.admin.query(
      'SELECT account_id FROM persons WHERE id = $1',
      [personId]
    );
    expect(preservedAfterReenable.rows[0].account_id).toBe(accountId);
  });

  it('Case B: ordinary login for a DISABLED existing Account fails before session issuance', async () => {
    const code = `auth001_login_${randomUUID()}`;
    const initial = await login(code);
    expect(initial.statusCode).toBe(200);
    const accountId = initial.json().accountId as string;

    await h.admin.query(
      "UPDATE accounts SET status = 'DISABLED' WHERE id = $1",
      [accountId]
    );
    const afterDisable = await accountFacts(accountId);

    const retry = await login(code);
    expect(retry.statusCode).toBe(401);
    expect(retry.json().code).toBe('UNAUTHENTICATED');
    expect(retry.json().sessionToken).toBeUndefined();

    const afterRejectedLogin = await accountFacts(accountId);
    expect(afterRejectedLogin).toEqual(afterDisable);

    const accountCount = await h.admin.query(
      'SELECT count(*)::int AS n FROM accounts WHERE wechat_openid = $1',
      [`fake_${code}`]
    );
    expect(accountCount.rows[0].n).toBe(1);

    const personCount = await h.admin.query(
      'SELECT count(*)::int AS n FROM persons WHERE account_id = $1',
      [accountId]
    );
    expect(personCount.rows[0].n).toBe(1);
  });

  it('Case C: Case B existing-account reuse cannot issue a session for DISABLED Account', async () => {
    const target = await createTarget(h, `auth001_caseb_${randomUUID()}`, {
      ageBand: 'UNDER_14',
    });
    const code = `auth001_caseb_${randomUUID()}`;
    const account = await h.admin.query(
      'INSERT INTO accounts (wechat_openid, session_epoch) VALUES ($1, 0) RETURNING id',
      [`fake_${code}`]
    );
    const accountId = account.rows[0].id as string;
    await h.admin.query('UPDATE persons SET account_id = $1 WHERE id = $2', [
      accountId,
      target.targetPersonId,
    ]);
    await h.admin.query(
      "UPDATE accounts SET status = 'DISABLED' WHERE id = $1",
      [accountId]
    );

    const res = await bootstrap(h, target.invitationToken, code);
    expect(res.statusCode).toBe(200);
    expect(res.json().binding).toBe('NOT_COMPLETED');
    expect(res.json().sessionToken).toBeUndefined();
    expect(res.json().account).toBeUndefined();
    expect(res.json().person).toBeUndefined();
    expect(await personAccountId(h, target.targetPersonId)).toBe(accountId);

    const attempts = await h.admin.query(
      'SELECT count(*)::int AS n FROM binding_attempts WHERE target_person_id = $1',
      [target.targetPersonId]
    );
    expect(attempts.rows[0].n).toBe(0);
  });

  it('Case C: unbound existing DISABLED Account is not reusable by a new binding attempt', async () => {
    const target = await createTarget(h, `auth001_reuse_${randomUUID()}`, {
      ageBand: 'UNDER_14',
    });
    const code = `auth001_reuse_${randomUUID()}`;
    const account = await h.admin.query(
      'INSERT INTO accounts (wechat_openid, session_epoch) VALUES ($1, 0) RETURNING id',
      [`fake_${code}`]
    );
    const accountId = account.rows[0].id as string;
    await h.admin.query(
      "UPDATE accounts SET status = 'DISABLED' WHERE id = $1",
      [accountId]
    );

    const res = await bootstrap(h, target.invitationToken, code);
    expect(res.statusCode).toBe(200);
    expect(res.json().binding).toBe('NOT_COMPLETED');
    expect(await personAccountId(h, target.targetPersonId)).toBeNull();

    const attempts = await h.admin.query(
      'SELECT count(*)::int AS n FROM binding_attempts WHERE target_person_id = $1',
      [target.targetPersonId]
    );
    expect(attempts.rows[0].n).toBe(0);

    const accounts = await h.admin.query(
      'SELECT id, status FROM accounts WHERE wechat_openid = $1',
      [`fake_${code}`]
    );
    expect(accounts.rows).toEqual([{ id: accountId, status: 'DISABLED' }]);
  });

  it('Case D: binding session exchange emits no session after committed Account becomes DISABLED', async () => {
    const target = await createTarget(h, `auth001_exchange_${randomUUID()}`, {
      ageBand: 'MINOR_14_17',
    });
    const code = `auth001_exchange_${randomUUID()}`;
    const { contextToken, attemptId } = await startBinding(h, target, code);

    const commit = await confirmerDecision(h, target.guardian.token, attemptId, {
      personId: target.targetPersonId,
      decision: 'AFFIRM',
    });
    expect(commit.statusCode).toBe(200);
    expect(commit.json().state).toBe('COMMITTED');

    const accountId = await personAccountId(h, target.targetPersonId);
    expect(accountId).not.toBeNull();
    await h.admin.query(
      "UPDATE accounts SET status = 'DISABLED' WHERE id = $1",
      [accountId]
    );

    const exchange = await candidateSession(h, contextToken);
    expect(exchange.statusCode).toBe(200);
    expect(exchange.json().binding).toBe('NOT_COMPLETED');
    expect(exchange.json().sessionToken).toBeUndefined();
    expect(exchange.json().account).toBeUndefined();
    expect(exchange.json().person).toBeUndefined();

    // Disable revokes authority only; the historical identity binding remains.
    expect(await personAccountId(h, target.targetPersonId)).toBe(accountId);
  });
});
