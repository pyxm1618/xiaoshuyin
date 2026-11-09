/**
 * MEDIUM-02 — H-02 direct barrier matrix on the REAL PostgreSQL runtime role.
 *
 * Each authoritative fact class is proven independently:
 *   1. Gate 2 reads healthy current facts and returns PASS.
 *   2. The binding transaction is parked before its Gate 2 read.
 *   3. A concurrent invalidating transaction commits / linearizes.
 *   4. The binding transaction resumes and MUST fail closed.
 *
 * The invitation row is a CONTRACT-SEAM proof only (in-memory invitation port).
 * It is NOT a production Slice 4 barrier and does not close T121–T124.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import {
  buildBindingApp,
  createAppPool,
  createTarget,
  startBinding,
  type BindingHarness,
  type TargetFixture,
} from '../setup/identity-binding.js';
import { loginWithLabel, revokeConsent } from '../setup/api.js';
import { commitAttempt } from '../../apps/server/api/src/identity-binding/commit.js';
import { evaluateGateForTarget } from '../../apps/server/api/src/identity-binding/gate.js';
import { withBindingGateTransaction } from '../../apps/server/api/src/db/tx.js';

function requireValidInvitation(invitation: { status: string }) {
  expect(invitation.status).toBe('VALID');
}

describe('H-02 Gate 2 barrier matrix (MEDIUM-02)', () => {
  let h: BindingHarness;
  let pool: ReturnType<typeof createAppPool>;

  beforeAll(async () => {
    h = await buildBindingApp();
    pool = createAppPool();
  });

  afterAll(async () => {
    await pool.end();
    await h.close();
  });

  /** Prove the Gate 2 initial read is a healthy PASS on the current facts. */
  async function assertGate2InitialPass(
    target: TargetFixture,
    confirmerPersonId: string,
    confirmerAccountId: string
  ): Promise<void> {
    const result = await withBindingGateTransaction(
      pool,
      { targetPersonId: target.targetPersonId, targetFamilyId: target.familyId },
      async (tx) => {
        const invitation = await h.port.resolveByParticipationId(tx, target.participationId);
        requireValidInvitation(invitation);
        const { result: gate } = await evaluateGateForTarget(tx, {
          stage: 'GATE_2',
          targetPersonId: target.targetPersonId,
          targetFamilyId: target.familyId,
          invitation,
          candidateAccountId: null,
          candidateAccountBoundPersonId: null,
          confirmer: { accountId: confirmerAccountId, personId: confirmerPersonId },
          confirmations: { candidate: true, secondParty: true },
        });
        return gate;
      }
    );
    expect(result.decision).toBe('PASS');
  }

  async function seedSecondPartyConfirmation(
    target: TargetFixture,
    confirmerPersonId: string,
    attemptId: string
  ): Promise<void> {
    await h.admin.query(
      `INSERT INTO binding_confirmations
         (attempt_id, kind, actor_account_id, actor_person_id, authority,
          target_confirmed, candidate_recognized, statement_version)
       VALUES ($1, 'SECOND_PARTY', $2, $3, 'GUARDIAN', true, true, 'second-party-recognition-v1')`,
      [attemptId, target.guardian.accountId, confirmerPersonId]
    );
  }

  async function countTerminalAudit(attemptId: string, reason?: string): Promise<number> {
    const { rows } = await h.admin.query(
      `SELECT count(*)::int AS n FROM identity_binding_audit_events
        WHERE attempt_id = $1 AND event_type = 'BINDING_TERMINAL'
          ${reason ? 'AND terminal_reason = $2' : ''}`,
      reason ? [attemptId, reason] : [attemptId]
    );
    return rows[0].n as number;
  }

  async function assertNoResidualSecret(attemptId: string): Promise<void> {
    const { rows } = await h.admin.query(
      `SELECT count(*)::int AS n FROM binding_pending_contexts
        WHERE attempt_id = $1
          AND (openid_ciphertext IS NOT NULL OR openid_nonce IS NOT NULL OR openid_tag IS NOT NULL)`,
      [attemptId]
    );
    expect(rows[0].n).toBe(0);
  }

  /**
   * Park the binding transaction on the attempt row, let a concurrent
   * invalidating transaction commit, then release and assert a fail-closed
   * settlement with no binding / no partial Account.
   */
  async function runBarrier(input: {
    label: string;
    target: TargetFixture;
    attemptId: string;
    reason: string;
    mutate: () => Promise<void>;
    candidateOpenid?: string;
    candidateBoundPersonId?: string;
    /** Set when the invalidation itself is an external binding of P1. */
    expectedP1AccountId?: string;
  }): Promise<void> {
    const locker = await h.admin.connect();
    const commitPool = createAppPool(1);
    let outcome: Awaited<ReturnType<typeof commitAttempt>> | undefined;
    try {
      await locker.query('BEGIN');
      await locker.query('SELECT id FROM binding_attempts WHERE id = $1 FOR UPDATE', [
        input.attemptId,
      ]);

      const pending = commitAttempt(
        {
          pool: commitPool,
          invitationPort: h.port,
          identityBindingSecret: process.env['IDENTITY_BINDING_SECRET']!,
        },
        {
          attemptId: input.attemptId,
          targetPersonId: input.target.targetPersonId,
          targetFamilyId: input.target.familyId,
          actorAccountId: input.target.guardian.accountId,
        }
      );

      // Let the binding transaction reach the parked attempt lock.
      await new Promise((resolve) => setTimeout(resolve, 250));

      // The invalidation commits / linearizes while the binding transaction is
      // paused before its Gate 2 read.
      await input.mutate();

      await locker.query('COMMIT');
      outcome = await pending;
    } finally {
      try {
        await locker.query('ROLLBACK');
      } catch {
        // Already committed.
      }
      locker.release();
      await commitPool.end();
    }

    expect(outcome, input.label).toMatchObject({ outcome: 'TERMINAL', reason: input.reason });

    const attempt = await h.admin.query(
      'SELECT state, terminal_reason, committed_account_id FROM binding_attempts WHERE id = $1',
      [input.attemptId]
    );
    expect(attempt.rows[0], input.label).toMatchObject({
      state: 'TERMINAL',
      terminal_reason: input.reason,
      committed_account_id: null,
    });

    const person = await h.admin.query('SELECT account_id FROM persons WHERE id = $1', [
      input.target.targetPersonId,
    ]);
    expect(person.rows[0].account_id, input.label).toBe(input.expectedP1AccountId ?? null);
    expect(await countTerminalAudit(input.attemptId, input.reason), input.label).toBe(1);
    await assertNoResidualSecret(input.attemptId);

    const committedAudit = await h.admin.query(
      `SELECT count(*)::int AS n FROM identity_binding_audit_events
        WHERE attempt_id = $1 AND event_type = 'BINDING_COMMITTED'`,
      [input.attemptId]
    );
    expect(committedAudit.rows[0].n).toBe(0);

    if (input.candidateOpenid) {
      const accounts = await h.admin.query(
        'SELECT id FROM accounts WHERE wechat_openid = $1',
        [input.candidateOpenid]
      );
      if (input.candidateBoundPersonId) {
        // The pre-existing conflicting Account is not duplicated and its other
        // Person binding is untouched: no orphan / partial Account.
        expect(accounts.rows).toHaveLength(1);
        const other = await h.admin.query('SELECT account_id FROM persons WHERE id = $1', [
          input.candidateBoundPersonId,
        ]);
        expect(other.rows[0].account_id).toBe(accounts.rows[0].id);
      } else {
        expect(accounts.rows).toHaveLength(0);
      }
    }
  }

  function minorFixture(label: string) {
    return createTarget(h, label, { ageBand: 'MINOR_14_17' });
  }
  void minorFixture;

  it('profile / age-band barrier blocks the commit', async () => {
    const target = await createTarget(h, 'h02_age', { ageBand: 'MINOR_14_17' });
    const { attemptId } = await startBinding(h, target, `h02_age_${randomUUID()}`);
    await seedSecondPartyConfirmation(target, target.guardian.personId, attemptId);
    await assertGate2InitialPass(target, target.guardian.personId, target.guardian.accountId);

    await runBarrier({
      label: 'age-band',
      target,
      attemptId,
      reason: 'AGE_BAND_ADULT_UNSUPPORTED',
      mutate: async () => {
        await h.admin.query(
          "UPDATE person_compliance_profiles SET age_band = 'ADULT', minor_mode = false WHERE person_id = $1",
          [target.targetPersonId]
        );
      },
    });
  });

  it('missing compliance profile barrier blocks the commit', async () => {
    const target = await createTarget(h, 'h02_profile', { ageBand: 'MINOR_14_17' });
    const { attemptId } = await startBinding(h, target, `h02_profile_${randomUUID()}`);
    await seedSecondPartyConfirmation(target, target.guardian.personId, attemptId);
    await assertGate2InitialPass(target, target.guardian.personId, target.guardian.accountId);

    await runBarrier({
      label: 'profile',
      target,
      attemptId,
      reason: 'COMPLIANCE_BLOCKED',
      mutate: async () => {
        await h.admin.query('DELETE FROM person_compliance_profiles WHERE person_id = $1', [
          target.targetPersonId,
        ]);
      },
    });
  });

  it('consent barrier blocks the commit', async () => {
    const target = await createTarget(h, 'h02_consent', { ageBand: 'UNDER_14' });
    const { attemptId } = await startBinding(h, target, `h02_consent_${randomUUID()}`);
    await seedSecondPartyConfirmation(target, target.guardian.personId, attemptId);
    await assertGate2InitialPass(target, target.guardian.personId, target.guardian.accountId);

    await runBarrier({
      label: 'consent',
      target,
      attemptId,
      reason: 'GUARDIAN_CONSENT_INVALID',
      mutate: async () => {
        const revoke = await revokeConsent(
          h.app,
          target.guardian.token,
          'h02_consent',
          target.consentId!
        );
        expect([200, 201]).toContain(revoke.statusCode);
      },
    });
  });

  it('guardian relationship barrier blocks the commit', async () => {
    const target = await createTarget(h, 'h02_guardian', { ageBand: 'MINOR_14_17' });
    const alt = await createTarget(h, 'h02_guardian_alt', { ageBand: 'MINOR_14_17' });
    // Give the minor a current guardian so the Gate authority is GUARDIAN.
    await h.admin.query(
      'UPDATE person_compliance_profiles SET guardian_person_id = $1 WHERE person_id = $2',
      [target.guardian.personId, target.targetPersonId]
    );
    const { attemptId } = await startBinding(h, target, `h02_guardian_${randomUUID()}`);
    await seedSecondPartyConfirmation(target, target.guardian.personId, attemptId);
    await assertGate2InitialPass(target, target.guardian.personId, target.guardian.accountId);

    await runBarrier({
      label: 'guardian',
      target,
      attemptId,
      reason: 'WRONG_CONFIRMER',
      mutate: async () => {
        await h.admin.query(
          'UPDATE person_compliance_profiles SET guardian_person_id = $1 WHERE person_id = $2',
          [alt.guardian.personId, target.targetPersonId]
        );
      },
    });
  });

  it('membership barrier blocks the commit', async () => {
    const target = await createTarget(h, 'h02_member', { ageBand: 'MINOR_14_17' });
    const other = await createTarget(h, 'h02_member_other', { ageBand: 'MINOR_14_17' });
    const { attemptId } = await startBinding(h, target, `h02_member_${randomUUID()}`);
    await seedSecondPartyConfirmation(target, target.guardian.personId, attemptId);
    await assertGate2InitialPass(target, target.guardian.personId, target.guardian.accountId);

    await runBarrier({
      label: 'membership',
      target,
      attemptId,
      reason: 'MULTI_FAMILY_BLOCK',
      mutate: async () => {
        await h.admin.query(
          'INSERT INTO family_members (family_id, person_id) VALUES ($1, $2)',
          [other.familyId, target.targetPersonId]
        );
      },
    });
  });

  it('P1 binding conflict barrier blocks the commit', async () => {
    const target = await createTarget(h, 'h02_p1_race', { ageBand: 'MINOR_14_17' });
    const { attemptId } = await startBinding(h, target, `h02_p1_race_${randomUUID()}`);
    await seedSecondPartyConfirmation(target, target.guardian.personId, attemptId);
    await assertGate2InitialPass(target, target.guardian.personId, target.guardian.accountId);

    const external = await h.admin.query(
      'INSERT INTO accounts (wechat_openid, session_epoch) VALUES ($1, 0) RETURNING id',
      [`h02_p1_race_${randomUUID()}`]
    );
    const externalAccountId = external.rows[0].id as string;

    await runBarrier({
      label: 'P1-conflict',
      target,
      attemptId,
      reason: 'TARGET_ALREADY_BOUND',
      expectedP1AccountId: externalAccountId,
      mutate: async () => {
        await h.admin.query('UPDATE persons SET account_id = $1 WHERE id = $2', [
          externalAccountId,
          target.targetPersonId,
        ]);
      },
    });
  });

  it('candidate Account conflict barrier blocks the commit', async () => {
    const target = await createTarget(h, 'h02_cand_conflict', { ageBand: 'MINOR_14_17' });
    const other = await createTarget(h, 'h02_cand_conflict_other', { ageBand: 'MINOR_14_17' });
    const code = `h02_cand_conflict_${randomUUID()}`;
    const { attemptId } = await startBinding(h, target, code);
    await seedSecondPartyConfirmation(target, target.guardian.personId, attemptId);
    await assertGate2InitialPass(target, target.guardian.personId, target.guardian.accountId);

    const candidateOpenid = `fake_${code}`;
    await runBarrier({
      label: 'candidate-account-conflict',
      target,
      attemptId,
      reason: 'IDENTITY_CONFLICT',
      candidateOpenid,
      candidateBoundPersonId: other.targetPersonId,
      mutate: async () => {
        const account = await h.admin.query(
          'SELECT id FROM accounts WHERE wechat_openid = $1',
          [candidateOpenid]
        );
        // The candidate's WeChat identity becomes an Account bound to another
        // Person by an ordinary path, concurrently with the binding.
        await h.admin.query('UPDATE persons SET account_id = $1 WHERE id = $2', [
          account.rows[0]?.id ??
            (
              await h.admin.query(
                'INSERT INTO accounts (wechat_openid, session_epoch) VALUES ($1, 0) RETURNING id',
                [candidateOpenid]
              )
            ).rows[0].id,
          other.targetPersonId,
        ]);
      },
    });
  });

  it('invitation seam barrier blocks the commit (CONTRACT-SEAM PROOF ONLY)', async () => {
    const target = await createTarget(h, 'h02_invite', { ageBand: 'MINOR_14_17' });
    const { attemptId } = await startBinding(h, target, `h02_invite_${randomUUID()}`);
    await seedSecondPartyConfirmation(target, target.guardian.personId, attemptId);
    await assertGate2InitialPass(target, target.guardian.personId, target.guardian.accountId);

    await runBarrier({
      label: 'invitation-seam',
      target,
      attemptId,
      reason: 'INVITATION_TERMINAL',
      mutate: async () => {
        h.port.remove(target.invitationToken);
      },
    });
  });
});