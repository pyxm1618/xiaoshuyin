/**
 * T089/T090 — ordinary login is unchanged by the binding capability.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildBindingApp, type BindingHarness } from '../setup/identity-binding.js';

describe('ordinary login regression', () => {
  let h: BindingHarness;

  beforeAll(async () => {
    h = await buildBindingApp();
  });

  afterAll(async () => {
    await h.close();
  });

  it('new openid creates Account + Person; existing openid reuses them', async () => {
    const code = `ordinary_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const first = await h.app.inject({
      method: 'POST',
      url: '/api/v1/auth/wechat',
      payload: { code },
    });
    expect(first.statusCode).toBe(200);
    const accountId = first.json().accountId as string;
    const personId = first.json().person.id as string;

    const second = await h.app.inject({
      method: 'POST',
      url: '/api/v1/auth/wechat',
      payload: { code },
    });
    expect(second.statusCode).toBe(200);
    expect(second.json().accountId).toBe(accountId);
    expect(second.json().person.id).toBe(personId);

    const persons = await h.admin.query(
      'SELECT count(*)::int AS n FROM persons WHERE account_id = $1',
      [accountId]
    );
    expect(persons.rows[0].n).toBe(1);
  });

  it('does not accept mode / inviteMode / binding switches', async () => {
    const code = `ordinary_mode_${Date.now()}`;
    const res = await h.app.inject({
      method: 'POST',
      url: '/api/v1/auth/wechat',
      payload: { code, mode: 'invite', inviteMode: true, binding: true },
    });
    // The frozen ordinary login body is strictly `{ code }`; binding switches
    // are rejected as an invalid request, never silently enabled.
    expect(res.statusCode).toBe(422);
    expect(res.json().code).toBe('VALIDATION_ERROR');
  });
});