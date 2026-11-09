/**
 * Attempt repository / partial unique convergence evidence.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import {
  buildBindingApp,
  createTarget,
  bootstrap,
  candidateDecision,
  type BindingHarness,
} from '../setup/identity-binding.js';

describe('binding attempt repository', () => {
  let h: BindingHarness;

  beforeAll(async () => {
    h = await buildBindingApp();
  });

  afterAll(async () => {
    await h.close();
  });

  it('second bootstrap for the same candidate/invitation converges to one live attempt', async () => {
    const target = await createTarget(h, 'att_conv', { ageBand: 'UNDER_14' });
    const code = `att_conv_${Date.now()}`;
    const first = await bootstrap(h, target.invitationToken, code, `k1-${Date.now()}`);
    expect(first.statusCode).toBe(200);
    const second = await bootstrap(h, target.invitationToken, code, `k2-${Date.now()}`);
    expect(second.statusCode).toBe(200);

    const { rows } = await h.admin.query(
      `SELECT count(*)::int AS cnt FROM binding_attempts
       WHERE target_person_id = $1 AND state = 'PENDING'`,
      [target.targetPersonId]
    );
    expect(rows[0].cnt).toBe(1);
  });

  it('terminal attempt does not block a new attempt (new identity)', async () => {
    const target = await createTarget(h, 'att_new', { ageBand: 'UNDER_14' });
    const code = `att_new_${Date.now()}`;
    const boot = await bootstrap(h, target.invitationToken, code, `kn1-${Date.now()}`);
    const token = boot.json().pendingContextToken as string;
    expect((await candidateDecision(h, token, 'REJECT')).statusCode).toBe(200);

    const terminal = await h.admin.query(
      `SELECT id, terminal_reason FROM binding_attempts
       WHERE target_person_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [target.targetPersonId]
    );
    expect(terminal.rows[0].terminal_reason).toBe('CANDIDATE_REJECTED');

    const again = await bootstrap(h, target.invitationToken, code, `kn2-${Date.now()}`);
    expect(again.statusCode).toBe(200);
    const states = await h.admin.query(
      `SELECT state, terminal_reason FROM binding_attempts
       WHERE target_person_id = $1 ORDER BY created_at ASC`,
      [target.targetPersonId]
    );
    expect(states.rows.map((r) => r.state)).toEqual(['TERMINAL', 'PENDING']);
  });

  it('partial unique live index rejects a second PENDING triple', async () => {
    const target = await createTarget(h, 'att_unique', { ageBand: 'UNDER_14' });
    const code = `att_unique_${Date.now()}`;
    await bootstrap(h, target.invitationToken, code, `ku1-${Date.now()}`);

    const row = await h.admin.query(
      `SELECT target_person_id, target_family_id, candidate_identity_digest,
              invitation_participation_id
       FROM binding_attempts WHERE target_person_id = $1 LIMIT 1`,
      [target.targetPersonId]
    );
    const attempt = row.rows[0];

    await expect(
      h.admin.query(
        `INSERT INTO binding_attempts
           (target_person_id, target_family_id, invitation_participation_id,
            candidate_identity_digest, expires_at)
         VALUES ($1, $2, $3, $4, now() + interval '600 seconds')`,
        [
          attempt.target_person_id,
          attempt.target_family_id,
          attempt.invitation_participation_id,
          attempt.candidate_identity_digest,
        ]
      )
    ).rejects.toMatchObject({ code: '23505' });
  });

  it('expiration materializes TERMINAL / ATTEMPT_EXPIRED on access', async () => {
    const target = await createTarget(h, 'att_exp', { ageBand: 'UNDER_14' });
    const boot = await bootstrap(h, target.invitationToken, `exp_${Date.now()}`, `ke-${Date.now()}`);
    const token = boot.json().pendingContextToken as string;
    await h.admin.query(
      `UPDATE binding_attempts SET created_at = now() - interval '20 seconds',
         expires_at = now() - interval '10 seconds'
       WHERE target_person_id = $1`,
      [target.targetPersonId]
    );
    expect((await candidateDecision(h, token, 'AFFIRM', undefined, 'candidate-binding-v1')).statusCode).toBe(200);
    const { rows } = await h.admin.query(
      'SELECT state, terminal_reason FROM binding_attempts WHERE target_person_id = $1',
      [target.targetPersonId]
    );
    expect(rows[0]).toEqual({ state: 'TERMINAL', terminal_reason: 'ATTEMPT_EXPIRED' });
  });
});