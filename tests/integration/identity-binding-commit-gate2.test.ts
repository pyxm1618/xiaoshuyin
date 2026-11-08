/**
 * T073 — Gate 2 commit-time recheck: current facts, never a stale Gate 1
 * snapshot. Every invalidated branch rolls back with zero binding and settles
 * the attempt TERMINAL (never PENDING).
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import {
  buildBindingApp,
  confirmerDecision,
  createAppPool,
  createTarget,
  startBinding,
  type BindingHarness,
} from '../setup/identity-binding.js';
import { commitAttempt } from '../../apps/server/api/src/identity-binding/commit.js';
import { revokeConsent } from '../setup/api.js';

describe('Gate 2 commit-time recheck (T073)', () => {
  let h: BindingHarness;

  beforeAll(async () => {
    h = await buildBindingApp();
  });

  afterAll(async () => {
    await h.close();
  });

  async function assertTerminal(
    attemptId: string,
    targetPersonId: string,
    reason: string
  ): Promise<void> {
    const attempt = await h.admin.query(
      'SELECT state, terminal_reason, settled_at, committed_account_id FROM binding_attempts WHERE id = $1',
      [attemptId]
    );
    expect(attempt.rows[0]).toMatchObject({
      state: 'TERMINAL',
      terminal_reason: reason,
      committed_account_id: null,
    });
    expect(attempt.rows[0].settled_at).not.toBeNull();

    const person = await h.admin.query('SELECT account_id FROM persons WHERE id = $1', [
      targetPersonId,
    ]);
    expect(person.rows[0].account_id).toBeNull();
  }

  it('consent revoked between Gate 1 and Gate 2 blocks the commit', async () => {
    const target = await createTarget(h, 'g2_consent', { ageBand: 'UNDER_14' });
    const { attemptId } = await startBinding(h, target, `g2_consent_${randomUUID()}`);
    expect(target.consentId).toBeTruthy();

    const revoke = await revokeConsent(
      h.app,
      target.guardian.token,
      'g2_consent',
      target.consentId!
    );
    expect([200, 201]).toContain(revoke.statusCode);

    const res = await confirmerDecision(h, target.guardian.token, attemptId, {
      personId: target.targetPersonId,
      decision: 'AFFIRM',
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().state).toBe('TERMINAL');
    await assertTerminal(attemptId, target.targetPersonId, 'GUARDIAN_CONSENT_INVALID');

    const audit = await h.admin.query(
      `SELECT count(*)::int AS n FROM identity_binding_audit_events
        WHERE attempt_id = $1 AND event_type = 'BINDING_TERMINAL'
          AND terminal_reason = 'GUARDIAN_CONSENT_INVALID'`,
      [attemptId]
    );
    expect(audit.rows[0].n).toBe(1);
  });

  it('invitation terminal between gates blocks the commit', async () => {
    const target = await createTarget(h, 'g2_invite', { ageBand: 'UNDER_14' });
    const { attemptId } = await startBinding(h, target, `g2_invite_${randomUUID()}`);
    h.port.remove(target.invitationToken);

    const res = await confirmerDecision(h, target.guardian.token, attemptId, {
      personId: target.targetPersonId,
      decision: 'AFFIRM',
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().state).toBe('TERMINAL');
    await assertTerminal(attemptId, target.targetPersonId, 'INVITATION_TERMINAL');
  });

  it('P1 bound externally between gates yields TARGET_ALREADY_BOUND', async () => {
    const target = await createTarget(h, 'g2_bound', { ageBand: 'UNDER_14' });
    const { attemptId } = await startBinding(h, target, `g2_bound_${randomUUID()}`);

    const other = await h.admin.query(
      'INSERT INTO accounts (wechat_openid, session_epoch) VALUES ($1, 0) RETURNING id',
      [`external_${randomUUID()}`]
    );
    await h.admin.query('UPDATE persons SET account_id = $1 WHERE id = $2', [
      other.rows[0].id,
      target.targetPersonId,
    ]);

    const res = await confirmerDecision(h, target.guardian.token, attemptId, {
      personId: target.targetPersonId,
      decision: 'AFFIRM',
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().state).toBe('TERMINAL');

    const attempt = await h.admin.query(
      'SELECT state, terminal_reason, committed_account_id FROM binding_attempts WHERE id = $1',
      [attemptId]
    );
    expect(attempt.rows[0]).toMatchObject({
      state: 'TERMINAL',
      terminal_reason: 'TARGET_ALREADY_BOUND',
      committed_account_id: null,
    });
  });

  it('confirmer authority changed between confirmation and commit blocks the commit', async () => {
    const target = await createTarget(h, 'g2_authority', { ageBand: 'UNDER_14' });
    const { attemptId, contextToken } = await startBinding(
      h,
      target,
      `g2_authority_${randomUUID()}`
    );
    // Candidate confirmation is already recorded by startBinding.
    const attempt = await h.admin.query(
      'SELECT candidate_identity_digest, invitation_participation_id FROM binding_attempts WHERE id = $1',
      [attemptId]
    );
    expect(attempt.rows[0].candidate_identity_digest).toMatch(/^[0-9a-f]{64}$/);
    const context = await h.admin.query(
      'SELECT id FROM binding_pending_contexts WHERE attempt_id = $1',
      [attemptId]
    );
    expect(context.rows).toHaveLength(1);
    expect(contextToken.length).toBeGreaterThan(0);

    // Pick a Person that is NOT the current guardian. The second-party
    // confirmation below is recorded for that wrong actor, so at Gate 2 the
    // current authority (guardian) no longer matches the confirmer (D-8.2).
    const replacement = await h.admin.query(
      'SELECT id FROM persons WHERE id <> $1 LIMIT 1',
      [target.guardian.personId]
    );
    expect(replacement.rows[0]).toBeTruthy();

    await h.admin.query(
      `INSERT INTO binding_confirmations
         (attempt_id, kind, actor_account_id, actor_person_id, authority,
          target_confirmed, candidate_recognized, statement_version)
       VALUES ($1, 'SECOND_PARTY', $2, $3, 'GUARDIAN', true, true, 'second-party-recognition-v1')`,
      [attemptId, target.guardian.accountId, replacement.rows[0].id]
    );

    const pool = createAppPool(1);
    try {
      const commit = await commitAttempt(
        {
          pool,
          invitationPort: h.port,
          identityBindingSecret: process.env['IDENTITY_BINDING_SECRET']!,
        },
        {
          attemptId,
          targetPersonId: target.targetPersonId,
          targetFamilyId: target.familyId,
          actorAccountId: target.guardian.accountId,
        }
      );
      expect(commit.outcome).toBe('TERMINAL');
      expect(commit).toMatchObject({ outcome: 'TERMINAL', reason: 'WRONG_CONFIRMER' });
      await assertTerminal(attemptId, target.targetPersonId, 'WRONG_CONFIRMER');
    } finally {
      await pool.end();
    }
  });

  it('concurrent consent revoke committed before the linearization point blocks the commit (F-01)', async () => {
    const target = await createTarget(h, 'g2_race', { ageBand: 'UNDER_14' });
    const code = `g2_race_${randomUUID()}`;
    const { attemptId } = await startBinding(h, target, code);
    expect(target.consentId).toBeTruthy();

    // A committed candidate Account exists before the commit transaction; it is
    // the row used as the pre-linearization barrier below.
    await h.admin.query(
      'INSERT INTO accounts (wechat_openid, session_epoch) VALUES ($1, 0)',
      [`fake_${code}`]
    );

    const accountCount = async () =>
      (
        await h.admin.query('SELECT count(*)::int AS n FROM accounts WHERE wechat_openid = $1', [
          `fake_${code}`,
        ])
      ).rows[0].n;
    const before = await accountCount();

    // A completed second-party confirmation is required for the commit to
    // reach Gate 2 / the binding mutation; the candidate already affirmed.
    await h.admin.query(
      `INSERT INTO binding_confirmations
         (attempt_id, kind, actor_account_id, actor_person_id, authority,
          target_confirmed, candidate_recognized, statement_version)
       VALUES ($1, 'SECOND_PARTY', $2, $3, 'GUARDIAN', true, true, 'second-party-recognition-v1')`,
      [attemptId, target.guardian.accountId, target.guardian.personId]
    );

    // Hold P1's row lock so the commit transaction parks before its binding
    // linearization point. With the F-01 boundary the commit has NOT evaluated
    // Gate 2 yet (it locks the authoritative facts first); the legacy flow
    // evaluated Gate 2 before this lock and would race through.
    const locker = await h.admin.connect();
    const commitPool = createAppPool(1);
    try {
      await locker.query('BEGIN');
      await locker.query(
        'SELECT id FROM accounts WHERE wechat_openid = $1 FOR UPDATE',
        [`fake_${code}`]
      );

      const commitPromise = commitAttempt(
        {
          pool: commitPool,
          invitationPort: h.port,
          identityBindingSecret: process.env['IDENTITY_BINDING_SECRET']!,
        },
        {
          attemptId,
          targetPersonId: target.targetPersonId,
          targetFamilyId: target.familyId,
          actorAccountId: target.guardian.accountId,
        }
      );

      // Let the commit reach the barrier (eventually blocked on the P1 row).
      await new Promise((resolve) => setTimeout(resolve, 250));

      // Authoritative invalidating change commits while binding is parked.
      const revoke = await revokeConsent(
        h.app,
        target.guardian.token,
        'g2_race',
        target.consentId!
      );
      expect([200, 201]).toContain(revoke.statusCode);

      await locker.query('COMMIT');

      const outcome = await commitPromise;
      expect(outcome.outcome).toBe('TERMINAL');
      expect(outcome).toMatchObject({
        outcome: 'TERMINAL',
        reason: 'GUARDIAN_CONSENT_INVALID',
      });

      await assertTerminal(attemptId, target.targetPersonId, 'GUARDIAN_CONSENT_INVALID');

      const committedAudit = await h.admin.query(
        `SELECT count(*)::int AS n FROM identity_binding_audit_events
          WHERE attempt_id = $1 AND event_type = 'BINDING_COMMITTED'`,
        [attemptId]
      );
      expect(committedAudit.rows[0].n).toBe(0);

      const after = await accountCount();
      expect(after).toBe(before);
    } finally {
      try {
        await locker.query('ROLLBACK');
      } catch {
        // Already committed.
      }
      locker.release();
      await commitPool.end();
    }
  });
});