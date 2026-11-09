/**
 * T059/T060 — candidate decision: AFFIRM / REJECT / CANCEL, dynamic eligibility
 * (M-01), exact pairing challenge replay/rotation, and generic results.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createHash, randomUUID } from 'node:crypto';
import {
  bootstrap,
  buildBindingApp,
  candidateDecision,
  candidateStatus,
  createTarget,
  startBinding,
  type BindingHarness,
} from '../setup/identity-binding.js';
import { createFamily, loginWithLabel, revokeConsent } from '../setup/api.js';

const CHALLENGE = /^[A-Za-z0-9_-]{192}$/;

describe('candidate decision', () => {
  let h: BindingHarness;

  beforeAll(async () => {
    h = await buildBindingApp();
  });

  afterAll(async () => {
    await h.close();
  });

  it('invalid context is 401 and writes nothing', async () => {
    const res = await candidateDecision(
      h,
      'not-a-valid-context-token',
      'AFFIRM',
      undefined,
      'candidate-binding-v1'
    );
    expect(res.statusCode).toBe(401);
    expect(res.json().code).toBe('BINDING_CONTEXT_INVALID');
  });

  it('AFFIRM without an attempt returns the fixed AFFIRM shape with a decoy', async () => {
    const target = await createTarget(h, 'cand_no_attempt', { ageBand: 'ADULT' });
    const boot = await bootstrap(h, target.invitationToken, `cand_no_attempt_${Date.now()}`);
    const token = boot.json().pendingContextToken as string;

    const res = await candidateDecision(
      h,
      token,
      'AFFIRM',
      `cand-k-${Date.now()}`,
      'candidate-binding-v1'
    );
    expect(res.statusCode).toBe(200);
    expect(Object.keys(res.json()).sort()).toEqual(['binding', 'pairingChallenge']);
    expect(res.json().binding).toBe('NOT_COMPLETED');
    expect(res.json().pairingChallenge).toMatch(CHALLENGE);

    const confirmations = await h.admin.query(
      `SELECT count(*)::int AS n
         FROM binding_confirmations c
         JOIN binding_attempts a ON a.id = c.attempt_id
        WHERE a.target_person_id = $1`,
      [target.targetPersonId]
    );
    expect(confirmations.rows[0].n).toBe(0);
  });

  it('AFFIRM same key + same issuance replays the exact original challenge bytes', async () => {
    const target = await createTarget(h, 'cand_affirm', { ageBand: 'UNDER_14' });
    const boot = await bootstrap(h, target.invitationToken, `cand_affirm_${Date.now()}`);
    const contextToken = boot.json().pendingContextToken as string;
    const key = `cand-idem-${Date.now()}`;

    const first = await candidateDecision(h, contextToken, 'AFFIRM', key, 'candidate-binding-v1');
    expect(first.statusCode).toBe(200);
    expect(first.json().pairingChallenge).toMatch(CHALLENGE);
    const firstExpiry = await h.admin.query(
      `SELECT c.pairing_expires_at
         FROM binding_pending_contexts c
        WHERE c.attempt_id = (
          SELECT id FROM binding_attempts WHERE target_person_id = $1
          ORDER BY created_at DESC LIMIT 1
        )`,
      [target.targetPersonId]
    );

    const replay = await candidateDecision(h, contextToken, 'AFFIRM', key, 'candidate-binding-v1');
    expect(replay.statusCode).toBe(200);
    expect(replay.json().pairingChallenge).toBe(first.json().pairingChallenge);

    const secondExpiry = await h.admin.query(
      `SELECT c.pairing_expires_at
         FROM binding_pending_contexts c
        WHERE c.attempt_id = (
          SELECT id FROM binding_attempts WHERE target_person_id = $1
          ORDER BY created_at DESC LIMIT 1
        )`,
      [target.targetPersonId]
    );
    expect(secondExpiry.rows[0].pairing_expires_at).toEqual(firstExpiry.rows[0].pairing_expires_at);

    const confirmations = await h.admin.query(
      `SELECT count(*)::int AS n FROM binding_confirmations
        WHERE attempt_id = (
          SELECT id FROM binding_attempts WHERE target_person_id = $1
          ORDER BY created_at DESC LIMIT 1
        ) AND kind = 'CANDIDATE'`,
      [target.targetPersonId]
    );
    expect(confirmations.rows[0].n).toBe(1);
  });

  it('M-01: consent revoked after bootstrap blocks AFFIRM and scrubs every context', async () => {
    const target = await createTarget(h, 'cand_revoked', { ageBand: 'UNDER_14' });
    const code = `cand_revoked_${Date.now()}`;
    const boot = await bootstrap(h, target.invitationToken, code);
    const contextToken = boot.json().pendingContextToken as string;
    await bootstrap(h, target.invitationToken, code, `boot2-${Date.now()}`);
    expect(target.consentId).toBeTruthy();

    const revoke = await revokeConsent(
      h.app,
      target.guardian.token,
      'cand_revoked',
      target.consentId!
    );
    expect([200, 201]).toContain(revoke.statusCode);

    const res = await candidateDecision(
      h,
      contextToken,
      'AFFIRM',
      `cand-revoked-${Date.now()}`,
      'candidate-binding-v1'
    );
    expect(res.statusCode).toBe(200);
    expect(Object.keys(res.json()).sort()).toEqual(['binding', 'pairingChallenge']);
    expect(res.json().pairingChallenge).toMatch(CHALLENGE);

    const attempt = await h.admin.query(
      'SELECT id, state, terminal_reason FROM binding_attempts WHERE target_person_id = $1 ORDER BY created_at DESC LIMIT 1',
      [target.targetPersonId]
    );
    expect(attempt.rows[0]).toMatchObject({
      state: 'TERMINAL',
      terminal_reason: 'GUARDIAN_CONSENT_INVALID',
    });
    const attemptId = attempt.rows[0].id as string;

    const confirmations = await h.admin.query(
      `SELECT count(*)::int AS n FROM binding_confirmations
        WHERE attempt_id = $1 AND kind = 'CANDIDATE'`,
      [attemptId]
    );
    expect(confirmations.rows[0].n).toBe(0);

    const audit = await h.admin.query(
      `SELECT count(*)::int AS n FROM identity_binding_audit_events
        WHERE attempt_id = $1 AND event_type = 'BINDING_TERMINAL'
          AND terminal_reason = 'GUARDIAN_CONSENT_INVALID'`,
      [attemptId]
    );
    expect(audit.rows[0].n).toBe(1);

    const contexts = await h.admin.query(
      `SELECT count(*)::int AS n FROM binding_pending_contexts
        WHERE attempt_id = $1
          AND (openid_ciphertext IS NOT NULL OR openid_nonce IS NOT NULL OR openid_tag IS NOT NULL)`,
      [attemptId]
    );
    expect(contexts.rows[0].n).toBe(0);
    const binding = await h.admin.query(
      'SELECT account_id FROM persons WHERE id = $1',
      [target.targetPersonId]
    );
    expect(binding.rows[0].account_id).toBeNull();
  });

  it('M-01: terminal invitation, P1 bound externally and multi-family all block AFFIRM', async () => {
    const cases: Array<{
      label: string;
      mutate: () => Promise<string>;
      reason: string;
    }> = [];

    {
      const target = await createTarget(h, 'cand_inv', { ageBand: 'UNDER_14' });
      cases.push({
        label: 'invitation',
        mutate: async () => {
          const boot = await bootstrap(h, target.invitationToken, `cand_inv_${Date.now()}`);
          h.port.remove(target.invitationToken);
          return boot.json().pendingContextToken as string;
        },
        reason: 'INVITATION_TERMINAL',
      });
    }

    {
      const target = await createTarget(h, 'cand_bound', { ageBand: 'UNDER_14' });
      cases.push({
        label: 'bound',
        mutate: async () => {
          const boot = await bootstrap(h, target.invitationToken, `cand_bound_${Date.now()}`);
          const other = await h.admin.query(
            'INSERT INTO accounts (wechat_openid, session_epoch) VALUES ($1, 0) RETURNING id',
            [`cand_bound_${Date.now()}`]
          );
          await h.admin.query('UPDATE persons SET account_id = $1 WHERE id = $2', [
            other.rows[0].id,
            target.targetPersonId,
          ]);
          return boot.json().pendingContextToken as string;
        },
        reason: 'TARGET_ALREADY_BOUND',
      });
    }

    {
      const target = await createTarget(h, 'cand_multi', { ageBand: 'UNDER_14' });
      cases.push({
        label: 'multi',
        mutate: async () => {
          const boot = await bootstrap(h, target.invitationToken, `cand_multi_${Date.now()}`);
          // A Family has exactly one owner, so a second Family for P1 needs a
          // different authenticated owner; the target Person is then added to it.
          const otherGuardian = await loginWithLabel(h.app, `cand_multi_${randomUUID()}`);
          const fam = await createFamily(
            h.app,
            otherGuardian.token,
            `cand_multi_extra_${randomUUID()}`
          );
          if (fam.statusCode !== 201) {
            throw new Error(`extra family create failed: ${fam.statusCode} ${fam.body}`);
          }
          await h.admin.query(
            'INSERT INTO family_members (family_id, person_id) VALUES ($1, $2)',
            [fam.json().id as string, target.targetPersonId]
          );
          return boot.json().pendingContextToken as string;
        },
        reason: 'MULTI_FAMILY_BLOCK',
      });
    }

    for (const c of cases) {
      const contextToken = await c.mutate();
      const res = await candidateDecision(
        h,
        contextToken,
        'AFFIRM',
        `cand-case-${c.label}-${Date.now()}`,
        'candidate-binding-v1'
      );
      expect(res.statusCode).toBe(200);
      expect(res.json().pairingChallenge).toMatch(CHALLENGE);
      const ctx = await h.admin.query(
        'SELECT attempt_id FROM binding_pending_contexts WHERE token_hash = $1',
        [createHash('sha256').update(contextToken).digest('hex')]
      );
      const attempt = await h.admin.query(
        'SELECT state, terminal_reason FROM binding_attempts WHERE id = $1',
        [ctx.rows[0].attempt_id]
      );
      expect(attempt.rows[0].state).toBe('TERMINAL');
      expect(attempt.rows[0].terminal_reason).toBe(c.reason);
    }
  });

  it('confirmationVersion matrix is preserved for AFFIRM and REJECT/CANCEL', async () => {
    const target = await createTarget(h, 'cand_ver', { ageBand: 'UNDER_14' });
    const boot = await bootstrap(h, target.invitationToken, `cand_ver_${Date.now()}`);
    const token = boot.json().pendingContextToken as string;

    const omitted = await h.app.inject({
      method: 'POST',
      url: '/api/v1/identity-bindings/candidate-decision',
      headers: { 'x-binding-context': token },
      payload: { decision: 'AFFIRM', idempotencyKey: `ver-${Date.now()}` },
    });
    expect(omitted.statusCode).toBe(422);
    const wrong = await candidateDecision(
      h,
      token,
      'AFFIRM',
      `ver-wrong-${Date.now()}`,
      'candidate-binding-v2'
    );
    expect(wrong.statusCode).toBe(422);

    for (const decision of ['REJECT', 'CANCEL'] as const) {
      const present = await h.app.inject({
        method: 'POST',
        url: '/api/v1/identity-bindings/candidate-decision',
        headers: { 'x-binding-context': token },
        payload: {
          decision,
          confirmationVersion: 'candidate-binding-v1',
          idempotencyKey: `ver-${decision}-${Date.now()}`,
        },
      });
      expect(present.statusCode).toBe(422);
    }
  });

  it('REJECT and CANCEL both settle TERMINAL with the frozen reasons', async () => {
    for (const [decision, reason] of [
      ['REJECT', 'CANDIDATE_REJECTED'],
      ['CANCEL', 'CANDIDATE_CANCELLED'],
    ] as const) {
      const target = await createTarget(h, `cand_${decision.toLowerCase()}`, {
        ageBand: 'UNDER_14',
      });
      const { contextToken, attemptId } = await startBinding(
        h,
        target,
        `cand_${decision}_${Date.now()}`
      );
      const res = await candidateDecision(
        h,
        contextToken,
        decision,
        `cand-${decision}-${Date.now()}`
      );
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ binding: 'NOT_COMPLETED' });

      const attempt = await h.admin.query(
        'SELECT state, terminal_reason FROM binding_attempts WHERE id = $1',
        [attemptId]
      );
      expect(attempt.rows[0]).toEqual({ state: 'TERMINAL', terminal_reason: reason });

      const status = await candidateStatus(h, contextToken);
      expect(status.json()).toEqual({ binding: 'NOT_COMPLETED' });
    }
  });
});