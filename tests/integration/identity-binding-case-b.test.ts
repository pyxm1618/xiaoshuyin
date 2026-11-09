/**
 * T051 — Case B: P1 already has an Account. Correct Account reuses the
 * existing binding and gets a session; a different Account is rejected
 * generically. Neither path creates Person / binding.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  bootstrap,
  buildBindingApp,
  createTarget,
  personAccountId,
  type BindingHarness,
} from '../setup/identity-binding.js';

describe('Case B — existing Account', () => {
  let h: BindingHarness;

  beforeAll(async () => {
    h = await buildBindingApp();
  });

  afterAll(async () => {
    await h.close();
  });

  it('correct Account reuses the binding with a session; no Person / binding increment', async () => {
    const target = await createTarget(h, 'case_b_ok', { ageBand: 'UNDER_14' });
    const code = `case_b_ok_${Date.now()}`;
    const account = await h.admin.query(
      'INSERT INTO accounts (wechat_openid, session_epoch) VALUES ($1, 0) RETURNING id',
      [`fake_${code}`]
    );
    const accountId = account.rows[0].id as string;
    await h.admin.query('UPDATE persons SET account_id = $1 WHERE id = $2', [
      accountId,
      target.targetPersonId,
    ]);
    expect(await personAccountId(h, target.targetPersonId)).toBe(accountId);

    const beforePersons = await h.admin.query(
      'SELECT count(*)::int AS n FROM persons WHERE account_id = $1',
      [accountId]
    );

    const res = await bootstrap(h, target.invitationToken, code);
    expect(res.statusCode).toBe(200);
    expect(res.json().binding).toBe('REUSED');
    expect(res.json().account.id).toBe(accountId);
    expect(res.json().person.id).toBe(target.targetPersonId);

    const afterPersons = await h.admin.query(
      'SELECT count(*)::int AS n FROM persons WHERE account_id = $1',
      [accountId]
    );
    expect(afterPersons.rows[0].n).toBe(beforePersons.rows[0].n);

    const attempts = await h.admin.query(
      'SELECT count(*)::int AS n FROM binding_attempts WHERE target_person_id = $1',
      [target.targetPersonId]
    );
    expect(attempts.rows[0].n).toBe(0);
  });

  it('wrong Account is rejected generically without rebinding', async () => {
    const target = await createTarget(h, 'case_b_wrong', { ageBand: 'UNDER_14' });
    const boundCode = `case_b_bound_${Date.now()}`;
    const account = await h.admin.query(
      'INSERT INTO accounts (wechat_openid, session_epoch) VALUES ($1, 0) RETURNING id',
      [`fake_${boundCode}`]
    );
    const accountId = account.rows[0].id as string;
    await h.admin.query('UPDATE persons SET account_id = $1 WHERE id = $2', [
      accountId,
      target.targetPersonId,
    ]);

    const res = await bootstrap(
      h,
      target.invitationToken,
      `case_b_other_${Date.now()}`
    );
    expect(res.statusCode).toBe(200);
    expect(res.json().binding).toBe('NOT_COMPLETED');
    expect(await personAccountId(h, target.targetPersonId)).toBe(accountId);

    const attempts = await h.admin.query(
      'SELECT count(*)::int AS n FROM binding_attempts WHERE target_person_id = $1',
      [target.targetPersonId]
    );
    expect(attempts.rows[0].n).toBe(0);
  });
});