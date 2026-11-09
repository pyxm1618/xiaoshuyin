/**
 * T065/T066 — confirmer authority matrix + personId / attempt association.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import {
  bootstrap,
  buildBindingApp,
  candidateDecision,
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

  it('an old key bound to attempt A never operates on a later attempt B (F-02)', async () => {
    const target = await createTarget(h, 'conf_oldkey', { ageBand: 'UNDER_14' });
    const code = `conf_oldkey_${randomUUID()}`;
    const { attemptId: attemptA } = await startBinding(h, target, code);
    const key = `sp-old-${randomUUID()}`;

    // K is recorded against attempt A as a canonical REJECT (false/false).
    const aRes = await confirmerDecision(h, target.guardian.token, attemptA, {
      personId: target.targetPersonId,
      decision: 'REJECT',
      idempotencyKey: key,
    });
    expect(aRes.statusCode).toBe(200);
    expect(aRes.json().state).toBe('TERMINAL');

    // A later attempt for the same triple, created by a new bootstrap.
    const boot = await bootstrap(h, target.invitationToken, code, `boot-b-${randomUUID()}`);
    expect(boot.statusCode).toBe(200);
    const contextB = boot.json().pendingContextToken as string;
    const candB = await candidateDecision(h, contextB, 'AFFIRM', undefined, 'candidate-binding-v1');
    expect(candB.statusCode).toBe(200);

    const bRows = await h.admin.query(
      `SELECT id FROM binding_attempts
        WHERE target_person_id = $1 AND id <> $2
        ORDER BY created_at DESC LIMIT 1`,
      [target.targetPersonId, attemptA]
    );
    expect(bRows.rows[0]).toBeTruthy();
    const attemptB = bRows.rows[0].id as string;

    const snapshotB = async () => {
      const attempt = await h.admin.query(
        'SELECT state, terminal_reason, committed_account_id FROM binding_attempts WHERE id = $1',
        [attemptB]
      );
      const confirmations = await h.admin.query(
        'SELECT count(*)::int AS n FROM binding_confirmations WHERE attempt_id = $1',
        [attemptB]
      );
      const audit = await h.admin.query(
        'SELECT count(*)::int AS n FROM identity_binding_audit_events WHERE attempt_id = $1',
        [attemptB]
      );
      return {
        attempt: attempt.rows[0],
        confirmations: confirmations.rows[0].n as number,
        audit: audit.rows[0].n as number,
      };
    };

    const before = await snapshotB();
    const res = await confirmerDecision(h, target.guardian.token, attemptB, {
      personId: target.targetPersonId,
      decision: 'AFFIRM',
      idempotencyKey: key,
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().code).toBe('IDEMPOTENCY_PAYLOAD_MISMATCH');

    const after = await snapshotB();
    expect(after).toEqual(before);
    expect(after.confirmations).toBe(1);
    expect(after.attempt.state).toBe('PENDING');
    expect(after.attempt.committed_account_id).toBeNull();

    // The same key replayed against attempt A with the exact same canonical
    // REJECT request still returns A's historical TERMINAL outcome and never
    // touches B.
    const replayA = await confirmerDecision(h, target.guardian.token, attemptA, {
      personId: target.targetPersonId,
      decision: 'REJECT',
      idempotencyKey: key,
    });
    expect(replayA.statusCode).toBe(200);
    expect(replayA.json().state).toBe('TERMINAL');
    expect(await snapshotB()).toEqual(before);
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

  it('H-01: wrong challenge bindings fail closed with zero mutation', async () => {
    const targetA = await createTarget(h, 'h01_a', { ageBand: 'UNDER_14' });
    const targetB = await createTarget(h, 'h01_b', { ageBand: 'UNDER_14' });
    const a = await startBinding(h, targetA, `h01_a_${randomUUID()}`);
    const b = await startBinding(h, targetB, `h01_b_${randomUUID()}`);

    const snapshotB = async () => {
      const attempt = await h.admin.query(
        'SELECT state, committed_account_id FROM binding_attempts WHERE id = $1',
        [b.attemptId]
      );
      const confirmations = await h.admin.query(
        "SELECT count(*)::int AS n FROM binding_confirmations WHERE attempt_id = $1 AND kind = 'SECOND_PARTY'",
        [b.attemptId]
      );
      return { attempt: attempt.rows[0], confirmations: confirmations.rows[0].n };
    };
    const before = await snapshotB();

    const attempts = [
      // Challenge A submitted with Person B.
      await confirmerDecision(h, targetA.guardian.token, a.pairingChallenge, {
        personId: targetB.targetPersonId,
        decision: 'AFFIRM',
      }),
      // Challenge A submitted by B's guardian for B's Person.
      await confirmerDecision(h, targetB.guardian.token, a.pairingChallenge, {
        personId: targetB.targetPersonId,
        decision: 'AFFIRM',
      }),
      // Unrelated challenge B submitted for Person A.
      await confirmerDecision(h, targetA.guardian.token, b.pairingChallenge, {
        personId: targetA.targetPersonId,
        decision: 'AFFIRM',
      }),
      // Tampered challenge.
      await confirmerDecision(
        h,
        targetA.guardian.token,
        `${a.pairingChallenge.slice(0, 191)}${a.pairingChallenge.endsWith('A') ? 'B' : 'A'}`,
        { personId: targetA.targetPersonId, decision: 'AFFIRM' }
      ),
      // Expired / no longer current issuance on A.
      await (async () => {
        await h.admin.query(
          "UPDATE binding_pending_contexts SET pairing_issued_at = now() - interval '10 seconds', pairing_expires_at = now() - interval '1 second' WHERE attempt_id = $1",
          [a.attemptId]
        );
        return confirmerDecision(h, targetA.guardian.token, a.pairingChallenge, {
          personId: targetA.targetPersonId,
          decision: 'AFFIRM',
        });
      })(),
    ];

    for (const res of attempts) {
      expect(res.statusCode).toBe(404);
      expect(res.json()).toEqual({
        code: 'BINDING_NOT_FOUND',
        message: 'Binding not found',
      });
    }
    expect(await snapshotB()).toEqual(before);

    const attemptA = await h.admin.query(
      'SELECT state FROM binding_attempts WHERE id = $1',
      [a.attemptId]
    );
    expect(attemptA.rows[0].state).toBe('PENDING');
  });
});