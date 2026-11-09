/**
 * T075 — Account create / reuse at Phase C and the frozen conflict branches.
 * No Person is ever inserted; `Person increment = 0`.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import {
  bootstrap,
  buildBindingApp,
  confirmerDecision,
  createTarget,
  personAccountId,
  startBinding,
  type BindingHarness,
} from '../setup/identity-binding.js';
import { loginWithLabel } from '../setup/api.js';

describe('Account create / reuse at commit (T075)', () => {
  let h: BindingHarness;

  beforeAll(async () => {
    h = await buildBindingApp();
  });

  afterAll(async () => {
    await h.close();
  });

  it('creates exactly one Account and binds existing P1 when none exists', async () => {
    const target = await createTarget(h, 'acct_create', { ageBand: 'UNDER_14' });
    const code = `acct_create_${randomUUID()}`;
    const { attemptId } = await startBinding(h, target, code);

    const res = await confirmerDecision(h, target.guardian.token, attemptId, {
      personId: target.targetPersonId,
      decision: 'AFFIRM',
    });
    expect(res.json().state).toBe('COMMITTED');

    const account = await h.admin.query(
      'SELECT id FROM accounts WHERE wechat_openid = $1',
      [`fake_${code}`]
    );
    expect(account.rows).toHaveLength(1);
    expect(await personAccountId(h, target.targetPersonId)).toBe(account.rows[0].id);

    // No second Person was created for this Account (no-P2).
    const p2 = await h.admin.query(
      'SELECT count(*)::int AS n FROM persons WHERE created_by_account_id = $1',
      [account.rows[0].id]
    );
    expect(p2.rows[0].n).toBe(0);
    const bound = await h.admin.query(
      'SELECT count(*)::int AS n FROM persons WHERE account_id = $1',
      [account.rows[0].id]
    );
    expect(bound.rows[0].n).toBe(1);
  });

  it('reuses an existing unbound Account for the same openid', async () => {
    const target = await createTarget(h, 'acct_reuse', { ageBand: 'UNDER_14' });
    const code = `acct_reuse_${randomUUID()}`;
    const existing = await h.admin.query(
      'INSERT INTO accounts (wechat_openid, session_epoch) VALUES ($1, 0) RETURNING id',
      [`fake_${code}`]
    );
    const existingId = existing.rows[0].id as string;

    const { attemptId } = await startBinding(h, target, code);
    const res = await confirmerDecision(h, target.guardian.token, attemptId, {
      personId: target.targetPersonId,
      decision: 'AFFIRM',
    });
    expect(res.json().state).toBe('COMMITTED');
    expect(await personAccountId(h, target.targetPersonId)).toBe(existingId);

    const accounts = await h.admin.query(
      'SELECT count(*)::int AS n FROM accounts WHERE wechat_openid = $1',
      [`fake_${code}`]
    );
    expect(accounts.rows[0].n).toBe(1);
  });

  it('P1 already bound is Case B reuse, never a new binding', async () => {
    const target = await createTarget(h, 'acct_p1bound', { ageBand: 'UNDER_14' });
    const code = `acct_p1bound_${randomUUID()}`;
    const account = await h.admin.query(
      'INSERT INTO accounts (wechat_openid, session_epoch) VALUES ($1, 0) RETURNING id',
      [`fake_${code}`]
    );
    await h.admin.query('UPDATE persons SET account_id = $1 WHERE id = $2', [
      account.rows[0].id,
      target.targetPersonId,
    ]);

    const res = await bootstrap(h, target.invitationToken, code);
    expect(res.json().binding).toBe('REUSED');
    expect(res.json().account.id).toBe(account.rows[0].id);

    const attempts = await h.admin.query(
      'SELECT count(*)::int AS n FROM binding_attempts WHERE target_person_id = $1',
      [target.targetPersonId]
    );
    expect(attempts.rows[0].n).toBe(0);
    expect(await personAccountId(h, target.targetPersonId)).toBe(account.rows[0].id);
  });

  it('candidate Account already bound to P2 fails as IDENTITY_CONFLICT', async () => {
    const target = await createTarget(h, 'acct_p2', { ageBand: 'UNDER_14' });
    const candidate = await loginWithLabel(h.app, 'acct_p2_candidate');
    const p2 = await h.admin.query(
      'SELECT id, account_id FROM persons WHERE account_id = $1',
      [candidate.accountId]
    );
    expect(p2.rows).toHaveLength(1);

    const openid = await h.admin.query('SELECT wechat_openid FROM accounts WHERE id = $1', [
      candidate.accountId,
    ]);
    const code = (openid.rows[0].wechat_openid as string).replace(/^fake_/, '');

    const res = await bootstrap(h, target.invitationToken, code);
    expect(res.statusCode).toBe(200);
    expect(res.json().binding).toBe('NOT_COMPLETED');
    expect(await personAccountId(h, target.targetPersonId)).toBeNull();

    const p2After = await h.admin.query(
      'SELECT id, account_id FROM persons WHERE account_id = $1',
      [candidate.accountId]
    );
    expect(p2After.rows).toEqual(p2.rows);
    const attempts = await h.admin.query(
      'SELECT count(*)::int AS n FROM binding_attempts WHERE target_person_id = $1',
      [target.targetPersonId]
    );
    expect(attempts.rows[0].n).toBe(0);
  });
});