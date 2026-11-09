/**
 * T087/T088 — session exchange only after COMMITTED; it creates no Account /
 * Person and does not bump session_epoch.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  buildBindingApp,
  candidateSession,
  candidateStatus,
  confirmerDecision,
  confirmerList,
  createTarget,
  personAccountId,
  startBinding,
  type BindingHarness,
} from '../setup/identity-binding.js';

describe('session exchange', () => {
  let h: BindingHarness;

  beforeAll(async () => {
    h = await buildBindingApp();
  });

  afterAll(async () => {
    await h.close();
  });

  it('is generic before commit and issues the ordinary session after commit', async () => {
    const target = await createTarget(h, 'session', { ageBand: 'UNDER_14' });
    const { contextToken } = await startBinding(h, target, `session_${Date.now()}`);

    const before = await candidateSession(h, contextToken);
    expect(before.statusCode).toBe(200);
    expect(before.json()).toEqual({ binding: 'NOT_COMPLETED' });

    const confirm = await confirmerList(h, target.guardian.token, target.targetPersonId);
    expect(confirm.statusCode).toBe(200);
    const attemptId = confirm.json().attempts[0].attemptId as string;

    const commit = await confirmerDecision(h, target.guardian.token, attemptId, {
      personId: target.targetPersonId,
      decision: 'AFFIRM',
    });
    expect(commit.json().state).toBe('COMMITTED');

    const boundAccount = await personAccountId(h, target.targetPersonId);
    const epochBefore = await h.admin.query(
      'SELECT session_epoch FROM accounts WHERE id = $1',
      [boundAccount]
    );

    const after = await candidateSession(h, contextToken);
    expect(after.statusCode).toBe(200);
    expect(after.json().binding).toBe('COMMITTED');
    expect(after.json().account.id).toBe(boundAccount);

    const me = await h.app.inject({
      method: 'GET',
      url: '/api/v1/me',
      headers: { authorization: `Bearer ${after.json().sessionToken}` },
    });
    expect(me.statusCode).toBe(200);
    expect(me.json().person.id).toBe(target.targetPersonId);

    const epochAfter = await h.admin.query(
      'SELECT session_epoch FROM accounts WHERE id = $1',
      [boundAccount]
    );
    expect(epochAfter.rows[0].session_epoch).toBe(epochBefore.rows[0].session_epoch);

    const accounts = await h.admin.query(
      'SELECT count(*)::int AS n FROM accounts WHERE id = $1',
      [boundAccount]
    );
    expect(accounts.rows[0].n).toBe(1);

    const status = await candidateStatus(h, contextToken);
    expect(status.json()).toEqual({ binding: 'COMMITTED' });
  });
});