/**
 * T067/T068 — confirmer REJECT: TERMINAL, no partial binding, invitation
 * unchanged, and an existing affirmative confirmation cannot be revoked.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  bootstrap,
  buildBindingApp,
  confirmerDecision,
  createTarget,
  personAccountId,
  startBinding,
  type BindingHarness,
} from '../setup/identity-binding.js';

describe('confirmer reject', () => {
  let h: BindingHarness;

  beforeAll(async () => {
    h = await buildBindingApp();
  });

  afterAll(async () => {
    await h.close();
  });

  it('rejects without binding, Account or Person increment; invitation stays VALID', async () => {
    const target = await createTarget(h, 'conf_rej', { ageBand: 'UNDER_14' });
    const code = `conf_rej_${Date.now()}`;
    const { attemptId } = await startBinding(h, target, code);

    const res = await confirmerDecision(h, target.guardian.token, attemptId, {
      personId: target.targetPersonId,
      decision: 'REJECT',
      targetConfirmed: false,
      candidateRecognized: false,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().state).toBe('TERMINAL');

    const attempt = await h.admin.query(
      'SELECT state, terminal_reason FROM binding_attempts WHERE id = $1',
      [attemptId]
    );
    expect(attempt.rows[0].state).toBe('TERMINAL');
    expect(attempt.rows[0].terminal_reason).toBe('RECOGNITION_REJECTED');
    expect(await personAccountId(h, target.targetPersonId)).toBeNull();

    const accounts = await h.admin.query(
      'SELECT count(*)::int AS n FROM accounts WHERE wechat_openid = $1',
      [`fake_${code}`]
    );
    expect(accounts.rows[0].n).toBe(0);

    const invitation = await h.port.resolveByToken({} as never, target.invitationToken);
    expect(invitation.status).toBe('VALID');
  });

  it('rejects after an affirmative confirmation with 409 and no state change', async () => {
    const target = await createTarget(h, 'conf_rej_after', { ageBand: 'UNDER_14' });
    const code = `conf_rej_after_${Date.now()}`;
    const { attemptId } = await startBinding(h, target, code);

    const affirm = await confirmerDecision(h, target.guardian.token, attemptId, {
      personId: target.targetPersonId,
      decision: 'AFFIRM',
    });
    expect(affirm.statusCode).toBe(200);
    expect(affirm.json().state).toBe('COMMITTED');

    const reject = await confirmerDecision(h, target.guardian.token, attemptId, {
      personId: target.targetPersonId,
      decision: 'REJECT',
    });
    expect(reject.statusCode).toBe(409);
    expect(reject.json().code).toBe('BINDING_STATE_CONFLICT');

    const attempt = await h.admin.query(
      'SELECT state FROM binding_attempts WHERE id = $1',
      [attemptId]
    );
    expect(attempt.rows[0].state).toBe('COMMITTED');
  });
});