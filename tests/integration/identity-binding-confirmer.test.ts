/**
 * T065/T066 — confirmer authority matrix + personId / attempt association.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  buildBindingApp,
  confirmerDecision,
  createTarget,
  startBinding,
  type BindingHarness,
} from '../setup/identity-binding.js';
import { loginWithLabel } from '../setup/api.js';

describe('confirmer authority', () => {
  let h: BindingHarness;

  beforeAll(async () => {
    h = await buildBindingApp();
  });

  afterAll(async () => {
    await h.close();
  });

  it('guardian can confirm an UNDER_14 attempt and writes one second-party confirmation', async () => {
    const target = await createTarget(h, 'conf_u14', { ageBand: 'UNDER_14' });
    const { attemptId } = await startBinding(h, target, `conf_u14_${Date.now()}`);

    const res = await confirmerDecision(h, target.guardian.token, attemptId, {
      personId: target.targetPersonId,
      decision: 'AFFIRM',
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().state).toBe('COMMITTED');

    const confirmations = await h.admin.query(
      `SELECT kind, authority FROM binding_confirmations WHERE attempt_id = $1 ORDER BY kind`,
      [attemptId]
    );
    expect(confirmations.rows).toEqual([
      { kind: 'CANDIDATE', authority: null },
      { kind: 'SECOND_PARTY', authority: 'GUARDIAN' },
    ]);
  });

  it('non-guardian Account gets generic 404', async () => {
    const target = await createTarget(h, 'conf_deny', { ageBand: 'UNDER_14' });
    const { attemptId } = await startBinding(h, target, `conf_deny_${Date.now()}`);
    const outsider = await loginWithLabel(h.app, 'conf_deny_outsider');

    const res = await confirmerDecision(h, outsider.token, attemptId, {
      personId: target.targetPersonId,
      decision: 'AFFIRM',
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe('BINDING_NOT_FOUND');
  });

  it('personId that does not match the attempt target gets generic 404', async () => {
    const target = await createTarget(h, 'conf_mismatch', { ageBand: 'UNDER_14' });
    const other = await createTarget(h, 'conf_mismatch_other', { ageBand: 'UNDER_14' });
    const { attemptId } = await startBinding(h, target, `conf_mismatch_${Date.now()}`);

    const res = await confirmerDecision(h, other.guardian.token, attemptId, {
      personId: other.targetPersonId,
      decision: 'AFFIRM',
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe('BINDING_NOT_FOUND');
  });
});