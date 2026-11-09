/**
 * F-05 — sensitive context cleanup.
 *
 * Every settled path must scrub the decryptable OpenID material from ALL
 * transport contexts associated with the authoritative attempt, not only the
 * context that happened to trigger settlement. Pre-attempt branches
 * (`attempt_id IS NULL`) must scrub every transport context in the candidate
 * identity scope so repeated bootstrap replays cannot accumulate plaintext-
 * equivalent material.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import {
  bootstrap,
  buildBindingApp,
  candidateDecision,
  confirmerDecision,
  createTarget,
  type BindingHarness,
} from '../setup/identity-binding.js';
import { revokeConsent } from '../setup/api.js';
import { deriveIdentityDigest } from '../../apps/server/api/src/identity-binding/crypto.js';

const SECRET = process.env['IDENTITY_BINDING_SECRET']!;

async function attemptSecrets(h: BindingHarness, attemptId: string): Promise<number> {
  const { rows } = await h.admin.query(
    `SELECT count(*)::int AS n FROM binding_pending_contexts
      WHERE attempt_id = $1
        AND (openid_ciphertext IS NOT NULL OR openid_nonce IS NOT NULL OR openid_tag IS NOT NULL)`,
    [attemptId]
  );
  return rows[0].n;
}

async function noAttemptSecrets(h: BindingHarness, digest: string): Promise<number> {
  const { rows } = await h.admin.query(
    `SELECT count(*)::int AS n FROM binding_pending_contexts
      WHERE attempt_id IS NULL
        AND candidate_identity_digest = $1
        AND (openid_ciphertext IS NOT NULL OR openid_nonce IS NOT NULL OR openid_tag IS NOT NULL)`,
    [digest]
  );
  return rows[0].n;
}

async function latestAttemptId(h: BindingHarness, personId: string): Promise<string> {
  const { rows } = await h.admin.query(
    'SELECT id FROM binding_attempts WHERE target_person_id = $1 ORDER BY created_at DESC LIMIT 1',
    [personId]
  );
  return rows[0].id as string;
}

/** Bootstrap twice with distinct operation keys: two contexts, one attempt. */
async function twoContexts(
  h: BindingHarness,
  target: Awaited<ReturnType<typeof createTarget>>,
  code: string
): Promise<{ contextToken: string; attemptId: string }> {
  const first = await bootstrap(h, target.invitationToken, code, `ctx-1-${randomUUID()}`);
  const contextToken = first.json().pendingContextToken as string;
  const second = await bootstrap(h, target.invitationToken, code, `ctx-2-${randomUUID()}`);
  expect(second.statusCode).toBe(200);

  const attemptId = await latestAttemptId(h, target.targetPersonId);
  const count = await h.admin.query(
    'SELECT count(*)::int AS n FROM binding_pending_contexts WHERE attempt_id = $1',
    [attemptId]
  );
  expect(count.rows[0].n).toBeGreaterThanOrEqual(2);
  return { contextToken, attemptId };
}

describe('F-05 sensitive context cleanup', () => {
  let h: BindingHarness;

  beforeAll(async () => {
    h = await buildBindingApp();
  });

  afterAll(async () => {
    await h.close();
  });

  it('COMMITTED scrubs every context of the attempt', async () => {
    const target = await createTarget(h, 'clean_commit', { ageBand: 'UNDER_14' });
    const code = `clean_commit_${randomUUID()}`;
    const { contextToken, attemptId } = await twoContexts(h, target, code);
    expect(await attemptSecrets(h, attemptId)).toBeGreaterThan(0);

    await candidateDecision(h, contextToken, 'AFFIRM', undefined, 'candidate-binding-v1');
    const res = await confirmerDecision(h, target.guardian.token, attemptId, {
      personId: target.targetPersonId,
      decision: 'AFFIRM',
    });
    expect(res.json().state).toBe('COMMITTED');
    expect(await attemptSecrets(h, attemptId)).toBe(0);
  });

  it('candidate CANCEL scrubs every context of the attempt', async () => {
    const target = await createTarget(h, 'clean_cancel', { ageBand: 'UNDER_14' });
    const code = `clean_cancel_${randomUUID()}`;
    const { contextToken, attemptId } = await twoContexts(h, target, code);

    const res = await candidateDecision(h, contextToken, 'CANCEL');
    expect(res.statusCode).toBe(200);
    expect(await attemptSecrets(h, attemptId)).toBe(0);
  });

  it('confirmer REJECT scrubs every context of the attempt', async () => {
    const target = await createTarget(h, 'clean_reject', { ageBand: 'UNDER_14' });
    const code = `clean_reject_${randomUUID()}`;
    const { contextToken, attemptId } = await twoContexts(h, target, code);

    await candidateDecision(h, contextToken, 'AFFIRM', undefined, 'candidate-binding-v1');
    const res = await confirmerDecision(h, target.guardian.token, attemptId, {
      personId: target.targetPersonId,
      decision: 'REJECT',

    });
    expect(res.json().state).toBe('TERMINAL');
    expect(await attemptSecrets(h, attemptId)).toBe(0);
  });

  it('attempt expiry scrubs every context of the attempt', async () => {
    const target = await createTarget(h, 'clean_expiry', { ageBand: 'UNDER_14' });
    const code = `clean_expiry_${randomUUID()}`;
    const { contextToken, attemptId } = await twoContexts(h, target, code);

    await h.admin.query(
      `UPDATE binding_attempts
          SET created_at = now() - interval '2 hours',
              expires_at = now() - interval '1 hour'
        WHERE id = $1`,
      [attemptId]
    );

    await candidateDecision(h, contextToken, 'AFFIRM', undefined, 'candidate-binding-v1');
    const state = await h.admin.query(
      'SELECT state, terminal_reason FROM binding_attempts WHERE id = $1',
      [attemptId]
    );
    expect(state.rows[0]).toEqual({ state: 'TERMINAL', terminal_reason: 'ATTEMPT_EXPIRED' });
    expect(await attemptSecrets(h, attemptId)).toBe(0);
  });

  it('Gate 2 block scrubs every context of the attempt', async () => {
    const target = await createTarget(h, 'clean_gate2', { ageBand: 'UNDER_14' });
    const code = `clean_gate2_${randomUUID()}`;
    const { contextToken, attemptId } = await twoContexts(h, target, code);

    await candidateDecision(h, contextToken, 'AFFIRM', undefined, 'candidate-binding-v1');
    await revokeConsent(h.app, target.guardian.token, 'clean_gate2', target.consentId!);

    const res = await confirmerDecision(h, target.guardian.token, attemptId, {
      personId: target.targetPersonId,
      decision: 'AFFIRM',
    });
    expect(res.json().state).toBe('TERMINAL');
    expect(await attemptSecrets(h, attemptId)).toBe(0);
  });

  it('invalid invitation and repeated same-key replay leave no decryptable no-attempt context', async () => {
    const code = `clean_invalid_${randomUUID()}`;
    const digest = deriveIdentityDigest(SECRET, `fake_${code}`);
    const invitationToken = `missing_${randomUUID()}`;
    const key = `invalid-${randomUUID()}`;

    const first = await bootstrap(h, invitationToken, code, key);
    expect(first.statusCode).toBe(200);
    expect(first.json().binding).toBe('NOT_COMPLETED');
    // same-key exact replay
    const replay = await bootstrap(h, invitationToken, code, key);
    expect(replay.statusCode).toBe(200);
    // different key, same identity
    const another = await bootstrap(h, invitationToken, code, `invalid-2-${randomUUID()}`);
    expect(another.statusCode).toBe(200);

    expect(await noAttemptSecrets(h, digest)).toBe(0);
  });

  it('authorize-independent pre-attempt blocks scrub no-attempt contexts by identity scope', async () => {
    const target = await createTarget(h, 'clean_caseb', { ageBand: 'UNDER_14' });
    // Bind P1 to Account A.
    const codeA = `clean_caseb_a_${randomUUID()}`;
    const account = await h.admin.query(
      'INSERT INTO accounts (wechat_openid, session_epoch) VALUES ($1, 0) RETURNING id',
      [`fake_${codeA}`]
    );
    await h.admin.query('UPDATE persons SET account_id = $1 WHERE id = $2', [
      account.rows[0].id,
      target.targetPersonId,
    ]);

    // A different candidate identity triggers the Case B mismatch branch.
    const codeB = `clean_caseb_b_${randomUUID()}`;
    const digestB = deriveIdentityDigest(SECRET, `fake_${codeB}`);
    const first = await bootstrap(h, target.invitationToken, codeB, `caseb-1-${randomUUID()}`);
    const second = await bootstrap(h, target.invitationToken, codeB, `caseb-2-${randomUUID()}`);
    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    expect(first.json().binding).toBe('NOT_COMPLETED');

    expect(await noAttemptSecrets(h, digestB)).toBe(0);
    const attempts = await h.admin.query(
      'SELECT count(*)::int AS n FROM binding_attempts WHERE target_person_id = $1',
      [target.targetPersonId]
    );
    expect(attempts.rows[0].n).toBe(0);
  });
});