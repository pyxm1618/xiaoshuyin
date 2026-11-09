/**
 * M-01 direct substantive proof — candidate AFFIRM current dynamic eligibility.
 *
 * Every required fact class is re-read at AFFIRM time. A hidden failure must:
 *   - settle the attempt TERMINAL with the authoritative reason
 *   - write ZERO candidate confirmation
 *   - issue ZERO valid pairing challenge (decoy only)
 *   - write exactly one terminal audit and scrub every attempt context
 *   - leave the external response in the fixed AFFIRM shape
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createHash, randomUUID } from 'node:crypto';
import {
  bootstrap,
  buildBindingApp,
  candidateDecision,
  createTarget,
  type BindingHarness,
  type TargetFixture,
} from '../setup/identity-binding.js';
import { createFamily, loginWithLabel, revokeConsent } from '../setup/api.js';

const CHALLENGE = /^[A-Za-z0-9_-]{192}$/;

describe('M-01 candidate AFFIRM current eligibility (MEDIUM-03)', () => {
  let h: BindingHarness;

  beforeAll(async () => {
    h = await buildBindingApp();
  });

  afterAll(async () => {
    await h.close();
  });

  async function runHiddenFailure(input: {
    label: string;
    target: TargetFixture;
    reason: string;
    mutate: () => Promise<void>;
    code: string;
    /** Set when the invalidation itself is an external binding of P1. */
    expectedP1AccountId?: string;
  }): Promise<void> {
    const boot = await bootstrap(h, input.target.invitationToken, input.code);
    expect(boot.statusCode, input.label).toBe(200);
    const token = boot.json().pendingContextToken as string;
    const tokenHash = createHash('sha256').update(token).digest('hex');

    await input.mutate();

    const res = await candidateDecision(
      h,
      token,
      'AFFIRM',
      `elig-${randomUUID()}`,
      'candidate-binding-v1'
    );

    // Fixed AFFIRM shape + decoy challenge: no internal reason leaks.
    expect(res.statusCode, input.label).toBe(200);
    expect(Object.keys(res.json()).sort(), input.label).toEqual([
      'binding',
      'pairingChallenge',
    ]);
    expect(res.json().binding, input.label).toBe('NOT_COMPLETED');
    expect(res.json().pairingChallenge, input.label).toMatch(CHALLENGE);

    const context = await h.admin.query(
      `SELECT id, attempt_id, pairing_issuance_id, openid_ciphertext,
              openid_nonce, openid_tag
         FROM binding_pending_contexts WHERE token_hash = $1`,
      [tokenHash]
    );
    expect(context.rows, input.label).toHaveLength(1);
    const attemptId = context.rows[0].attempt_id as string;
    expect(attemptId, input.label).toBeTruthy();

    // Zero valid pairing issuance: the returned challenge is a decoy.
    expect(context.rows[0].pairing_issuance_id, input.label).toBeNull();
    // All-context secret scrub (settlement is attempt-scoped).
    expect(context.rows[0].openid_ciphertext, input.label).toBeNull();
    expect(context.rows[0].openid_nonce, input.label).toBeNull();
    expect(context.rows[0].openid_tag, input.label).toBeNull();

    const attempt = await h.admin.query(
      'SELECT state, terminal_reason, committed_account_id FROM binding_attempts WHERE id = $1',
      [attemptId]
    );
    expect(attempt.rows[0], input.label).toMatchObject({
      state: 'TERMINAL',
      terminal_reason: input.reason,
      committed_account_id: null,
    });

    // Zero candidate confirmation.
    const candidateConfirmation = await h.admin.query(
      `SELECT count(*)::int AS n FROM binding_confirmations
        WHERE attempt_id = $1 AND kind = 'CANDIDATE'`,
      [attemptId]
    );
    expect(candidateConfirmation.rows[0].n, input.label).toBe(0);

    // Exactly one terminal audit for the authoritative reason.
    const terminalAudit = await h.admin.query(
      `SELECT count(*)::int AS n FROM identity_binding_audit_events
        WHERE attempt_id = $1 AND event_type = 'BINDING_TERMINAL'
          AND terminal_reason = $2`,
      [attemptId, input.reason]
    );
    expect(terminalAudit.rows[0].n, input.label).toBe(1);

    const allContexts = await h.admin.query(
      `SELECT count(*)::int AS n FROM binding_pending_contexts
        WHERE attempt_id = $1
          AND (openid_ciphertext IS NOT NULL OR openid_nonce IS NOT NULL OR openid_tag IS NOT NULL)`,
      [attemptId]
    );
    expect(allContexts.rows[0].n, input.label).toBe(0);

    const person = await h.admin.query('SELECT account_id FROM persons WHERE id = $1', [
      input.target.targetPersonId,
    ]);
    expect(person.rows[0].account_id, input.label).toBe(
      input.expectedP1AccountId ?? null
    );
  }

  it('M-01: consent invalidation blocks AFFIRM', async () => {
    const target = await createTarget(h, 'm01_consent', { ageBand: 'UNDER_14' });
    await runHiddenFailure({
      label: 'consent',
      target,
      code: `m01_consent_${randomUUID()}`,
      reason: 'GUARDIAN_CONSENT_INVALID',
      mutate: async () => {
        const revoke = await revokeConsent(
          h.app,
          target.guardian.token,
          'm01_consent',
          target.consentId!
        );
        expect([200, 201]).toContain(revoke.statusCode);
      },
    });
  });

  it('M-01: profile invalidation blocks AFFIRM', async () => {
    const target = await createTarget(h, 'm01_profile', { ageBand: 'MINOR_14_17' });
    await runHiddenFailure({
      label: 'profile',
      target,
      code: `m01_profile_${randomUUID()}`,
      reason: 'COMPLIANCE_BLOCKED',
      mutate: async () => {
        await h.admin.query('DELETE FROM person_compliance_profiles WHERE person_id = $1', [
          target.targetPersonId,
        ]);
      },
    });
  });

  it('M-01: age-band invalidation blocks AFFIRM', async () => {
    const target = await createTarget(h, 'm01_age', { ageBand: 'MINOR_14_17' });
    await runHiddenFailure({
      label: 'age-band',
      target,
      code: `m01_age_${randomUUID()}`,
      reason: 'AGE_BAND_ADULT_UNSUPPORTED',
      mutate: async () => {
        await h.admin.query(
          "UPDATE person_compliance_profiles SET age_band = 'ADULT', minor_mode = false WHERE person_id = $1",
          [target.targetPersonId]
        );
      },
    });
  });

  it('M-01: guardian relationship invalidation blocks AFFIRM', async () => {
    const target = await createTarget(h, 'm01_guardian', { ageBand: 'UNDER_14' });
    const alt = await createTarget(h, 'm01_guardian_alt', { ageBand: 'UNDER_14' });
    await runHiddenFailure({
      label: 'guardian',
      target,
      code: `m01_guardian_${randomUUID()}`,
      reason: 'GUARDIAN_CONSENT_INVALID',
      mutate: async () => {
        await h.admin.query(
          'UPDATE person_compliance_profiles SET guardian_person_id = $1 WHERE person_id = $2',
          [alt.guardian.personId, target.targetPersonId]
        );
      },
    });
  });

  it('M-01: membership invalidation blocks AFFIRM', async () => {
    const target = await createTarget(h, 'm01_member', { ageBand: 'MINOR_14_17' });
    const otherOwner = await loginWithLabel(h.app, `m01_member_extra_${randomUUID()}`);
    const extra = await createFamily(h.app, otherOwner.token, `m01_member_extra_${randomUUID()}`);
    expect(extra.statusCode).toBe(201);
    await runHiddenFailure({
      label: 'membership',
      target,
      code: `m01_member_${randomUUID()}`,
      reason: 'MULTI_FAMILY_BLOCK',
      mutate: async () => {
        await h.admin.query(
          'INSERT INTO family_members (family_id, person_id) VALUES ($1, $2)',
          [extra.json().id as string, target.targetPersonId]
        );
      },
    });
  });

  it('M-01: invitation invalidation blocks AFFIRM', async () => {
    const target = await createTarget(h, 'm01_invitation', { ageBand: 'MINOR_14_17' });
    await runHiddenFailure({
      label: 'invitation',
      target,
      code: `m01_invitation_${randomUUID()}`,
      reason: 'INVITATION_TERMINAL',
      mutate: async () => {
        h.port.remove(target.invitationToken);
      },
    });
  });

  it('M-01: P1 binding conflict blocks AFFIRM', async () => {
    const target = await createTarget(h, 'm01_p1', { ageBand: 'MINOR_14_17' });
    const external = await h.admin.query(
      'INSERT INTO accounts (wechat_openid, session_epoch) VALUES ($1, 0) RETURNING id',
      [`m01_p1_${randomUUID()}`]
    );
    const externalAccountId = external.rows[0].id as string;
    await runHiddenFailure({
      label: 'P1-conflict',
      target,
      code: `m01_p1_${randomUUID()}`,
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

  it('M-01: candidate identity / account conflict blocks AFFIRM', async () => {
    const target = await createTarget(h, 'm01_candidate', { ageBand: 'MINOR_14_17' });
    const other = await createTarget(h, 'm01_candidate_other', { ageBand: 'MINOR_14_17' });
    const code = `m01_candidate_${randomUUID()}`;
    await runHiddenFailure({
      label: 'candidate-conflict',
      target,
      code,
      reason: 'IDENTITY_CONFLICT',
      mutate: async () => {
        const account = await h.admin.query(
          'INSERT INTO accounts (wechat_openid, session_epoch) VALUES ($1, 0) RETURNING id',
          [`fake_${code}`]
        );
        await h.admin.query('UPDATE persons SET account_id = $1 WHERE id = $2', [
          account.rows[0].id,
          other.targetPersonId,
        ]);
      },
    });
  });
});