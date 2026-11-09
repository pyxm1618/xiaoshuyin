/**
 * T049 — bootstrap orchestration: Case B / Case C, Gate 1, invalid invitation,
 * pending context and replay. Real app + real PostgreSQL + contract-level
 * invitation fixture. No Person / Account is created on the bootstrapping path.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import {
  bootstrap,
  buildBindingApp,
  candidateDecision,
  createTarget,
  type BindingHarness,
} from '../setup/identity-binding.js';
import { loginWithLabel } from '../setup/api.js';
import { deriveIdentityDigest, hashToken } from '../../apps/server/api/src/identity-binding/crypto.js';

describe('bootstrap orchestration (T049)', () => {
  let h: BindingHarness;

  beforeAll(async () => {
    h = await buildBindingApp();
  });

  afterAll(async () => {
    await h.close();
  });

  it('Case B match returns REUSED without attempt / confirmation', async () => {
    const target = await createTarget(h, 'boot_caseb', { ageBand: 'UNDER_14' });
    const code = `boot_caseb_${randomUUID()}`;
    const account = await h.admin.query(
      'INSERT INTO accounts (wechat_openid, session_epoch) VALUES ($1, 0) RETURNING id',
      [`fake_${code}`]
    );
    const accountId = account.rows[0].id as string;
    await h.admin.query('UPDATE persons SET account_id = $1 WHERE id = $2', [
      accountId,
      target.targetPersonId,
    ]);

    const res = await bootstrap(h, target.invitationToken, code);
    expect(res.statusCode).toBe(200);
    expect(res.json().binding).toBe('REUSED');
    expect(res.json().account.id).toBe(accountId);
    expect(res.json().person.id).toBe(target.targetPersonId);

    const attempts = await h.admin.query(
      'SELECT count(*)::int AS n FROM binding_attempts WHERE target_person_id = $1',
      [target.targetPersonId]
    );
    expect(attempts.rows[0].n).toBe(0);
    const confirmations = await h.admin.query(
      `SELECT count(*)::int AS n FROM binding_confirmations c
         JOIN binding_attempts a ON a.id = c.attempt_id
        WHERE a.target_person_id = $1`,
      [target.targetPersonId]
    );
    expect(confirmations.rows[0].n).toBe(0);
  });

  it('Gate 1 failure creates a pending context and audit but no attempt', async () => {
    const target = await createTarget(h, 'boot_gate1', { ageBand: 'ADULT' });
    const code = `boot_gate1_${randomUUID()}`;
    const res = await bootstrap(h, target.invitationToken, code);
    expect(res.statusCode).toBe(200);
    expect(Object.keys(res.json()).sort()).toEqual(['binding', 'pendingContextToken']);
    expect(res.json().binding).toBe('NOT_COMPLETED');

    const attempts = await h.admin.query(
      'SELECT count(*)::int AS n FROM binding_attempts WHERE target_person_id = $1',
      [target.targetPersonId]
    );
    expect(attempts.rows[0].n).toBe(0);
    const accounts = await h.admin.query(
      'SELECT count(*)::int AS n FROM accounts WHERE wechat_openid = $1',
      [`fake_${code}`]
    );
    expect(accounts.rows[0].n).toBe(0);

    const audit = await h.admin.query(
      `SELECT event_type, result, terminal_reason, target_person_id, target_family_id,
              invitation_participation_id
         FROM identity_binding_audit_events
        WHERE event_type = 'BINDING_GATE1_BLOCKED'
          AND terminal_reason = 'AGE_BAND_ADULT_UNSUPPORTED'
        ORDER BY occurred_at DESC LIMIT 1`
    );
    expect(audit.rows[0]).toMatchObject({
      event_type: 'BINDING_GATE1_BLOCKED',
      result: 'TERMINAL',
      terminal_reason: 'AGE_BAND_ADULT_UNSUPPORTED',
      target_person_id: null,
      target_family_id: null,
      invitation_participation_id: null,
    });

    // The ciphertext is cleared for every pre-attempt blocked outcome.
    const digest = deriveIdentityDigest(
      process.env['IDENTITY_BINDING_SECRET']!,
      `fake_${code}`
    );
    const context = await h.admin.query(
      'SELECT openid_ciphertext FROM binding_pending_contexts WHERE candidate_identity_digest = $1',
      [digest]
    );
    expect(context.rows).toHaveLength(1);
    expect(context.rows[0].openid_ciphertext).toBeNull();
  });

  it('candidate Account already bound to P2 is IDENTITY_CONFLICT at Gate 1', async () => {
    const target = await createTarget(h, 'boot_p2', { ageBand: 'UNDER_14' });
    const candidate = await loginWithLabel(h.app, 'boot_p2_candidate');
    // Resolve the openid the ordinary login used, then bootstrap that identity
    // against P1. The identity already owns another Person (P2).
    const account = await h.admin.query(
      'SELECT wechat_openid FROM accounts WHERE id = $1',
      [candidate.accountId]
    );
    const openid = account.rows[0].wechat_openid as string;
    const code = openid.replace(/^fake_/, '');

    const p2Before = await h.admin.query(
      'SELECT count(*)::int AS n FROM persons WHERE account_id = $1',
      [candidate.accountId]
    );
    expect(p2Before.rows[0].n).toBe(1);

    const res = await bootstrap(h, target.invitationToken, code);
    expect(res.statusCode).toBe(200);
    expect(res.json().binding).toBe('NOT_COMPLETED');

    const p2After = await h.admin.query(
      'SELECT count(*)::int AS n FROM persons WHERE account_id = $1',
      [candidate.accountId]
    );
    expect(p2After.rows[0].n).toBe(1);
    const attempt = await h.admin.query(
      'SELECT count(*)::int AS n FROM binding_attempts WHERE target_person_id = $1',
      [target.targetPersonId]
    );
    expect(attempt.rows[0].n).toBe(0);
    const audit = await h.admin.query(
      `SELECT terminal_reason FROM identity_binding_audit_events
        WHERE event_type = 'BINDING_GATE1_BLOCKED' AND terminal_reason = 'IDENTITY_CONFLICT'
        ORDER BY occurred_at DESC LIMIT 1`
    );
    expect(audit.rows[0]?.terminal_reason).toBe('IDENTITY_CONFLICT');
  });

  it('TERMINAL replay stays generic and does not re-create the attempt', async () => {
    const target = await createTarget(h, 'boot_terminal', { ageBand: 'UNDER_14' });
    const code = `boot_terminal_${randomUUID()}`;
    const key = `boot-terminal-${randomUUID()}`;

    const first = await bootstrap(h, target.invitationToken, code, key);
    expect(first.statusCode).toBe(200);
    const token = first.json().pendingContextToken as string;
    const decision = await candidateDecision(
      h,
      token,
      'REJECT',
      `reject-${randomUUID()}`
    );
    expect(decision.statusCode).toBe(200);

    const replay = await bootstrap(h, target.invitationToken, code, key);
    expect(replay.statusCode).toBe(200);
    expect(replay.json().binding).toBe('NOT_COMPLETED');
    expect(Object.keys(replay.json()).sort()).toEqual(['binding', 'pendingContextToken']);

    const attempts = await h.admin.query(
      'SELECT id, state, terminal_reason FROM binding_attempts WHERE target_person_id = $1',
      [target.targetPersonId]
    );
    expect(attempts.rows).toHaveLength(1);
    expect(attempts.rows[0]).toMatchObject({
      state: 'TERMINAL',
      terminal_reason: 'CANDIDATE_REJECTED',
    });
    const created = await h.admin.query(
      `SELECT count(*)::int AS n FROM identity_binding_audit_events
        WHERE attempt_id = $1 AND event_type = 'BINDING_ATTEMPT_CREATED'`,
      [attempts.rows[0].id]
    );
    expect(created.rows[0].n).toBe(1);
  });

  it('M-02: settled, pre-attempt and Case B replay contexts retain no OpenID secret', async () => {
    const secretsOf = async (token: string) => {
      const { rows } = await h.admin.query(
        `SELECT openid_ciphertext, openid_nonce, openid_tag
           FROM binding_pending_contexts WHERE token_hash = $1`,
        [hashToken(token)]
      );
      expect(rows).toHaveLength(1);
      return rows[0];
    };

    // Pre-attempt blocked replay.
    const missingToken = `missing-${randomUUID()}`;
    const pre = await bootstrap(h, missingToken, `m02_pre_${randomUUID()}`);
    expect(pre.statusCode).toBe(200);
    expect(await secretsOf(pre.json().pendingContextToken as string)).toEqual({
      openid_ciphertext: null,
      openid_nonce: null,
      openid_tag: null,
    });

    // TERMINAL replay.
    const terminalTarget = await createTarget(h, 'm02_terminal', { ageBand: 'UNDER_14' });
    const key = `m02-term-${randomUUID()}`;
    const code = `m02_term_${randomUUID()}`;
    const boot = await bootstrap(h, terminalTarget.invitationToken, code, key);
    await candidateDecision(
      h,
      boot.json().pendingContextToken as string,
      'REJECT',
      `m02-rej-${randomUUID()}`
    );
    const replay = await bootstrap(h, terminalTarget.invitationToken, code, key);
    expect(replay.statusCode).toBe(200);
    expect(await secretsOf(replay.json().pendingContextToken as string)).toEqual({
      openid_ciphertext: null,
      openid_nonce: null,
      openid_tag: null,
    });

    // Case B REUSED fresh context.
    const caseB = await createTarget(h, 'm02_caseb', { ageBand: 'UNDER_14' });
    const caseBCode = `m02_caseb_${randomUUID()}`;
    const account = await h.admin.query(
      'INSERT INTO accounts (wechat_openid, session_epoch) VALUES ($1, 0) RETURNING id',
      [`fake_${caseBCode}`]
    );
    await h.admin.query('UPDATE persons SET account_id = $1 WHERE id = $2', [
      account.rows[0].id,
      caseB.targetPersonId,
    ]);
    const reused = await bootstrap(h, caseB.invitationToken, caseBCode);
    expect(reused.json().binding).toBe('REUSED');
    const reusedRow = await h.admin.query(
      `SELECT openid_ciphertext, openid_nonce, openid_tag
         FROM binding_pending_contexts
        WHERE candidate_identity_digest = $1
        ORDER BY created_at DESC LIMIT 1`,
      [deriveIdentityDigest(process.env['IDENTITY_BINDING_SECRET']!, `fake_${caseBCode}`)]
    );
    expect(reusedRow.rows[0]).toEqual({
      openid_ciphertext: null,
      openid_nonce: null,
      openid_tag: null,
    });
  });
});