/**
 * PR #16 review Finding 2 — Phase C must deterministically use the authoritative
 * *usable* transport context of the exact attempt.
 *
 * A live attempt can legitimately own several transport contexts: an older one
 * may have expired and been scrubbed while a bootstrap replay minted a fresh
 * decryptable one for the same attempt. Phase C must never rely on PostgreSQL
 * heap order and must never pick the scrubbed row.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import {
  bootstrap,
  buildBindingApp,
  candidateDecision,
  confirmerDecision,
  createAppPool,
  createTarget,
  startBinding,
  type BindingHarness,
} from '../setup/identity-binding.js';
import { commitAttempt, type CommitOutcome } from '../../apps/server/api/src/identity-binding/commit.js';

const SECRET = process.env['IDENTITY_BINDING_SECRET']!;

function deps(h: BindingHarness, pool: ReturnType<typeof createAppPool>) {
  return { pool, invitationPort: h.port, identityBindingSecret: SECRET };
}

async function latestAttemptId(h: BindingHarness, personId: string): Promise<string> {
  const { rows } = await h.admin.query(
    'SELECT id FROM binding_attempts WHERE target_person_id = $1 ORDER BY created_at DESC LIMIT 1',
    [personId]
  );
  return rows[0].id as string;
}

async function latestContextId(h: BindingHarness, attemptId: string): Promise<string> {
  const { rows } = await h.admin.query(
    `SELECT id FROM binding_pending_contexts
      WHERE attempt_id = $1
      ORDER BY created_at DESC, id DESC
      LIMIT 1`,
    [attemptId]
  );
  return rows[0].id as string;
}

async function addSecondPartyConfirmation(
  h: BindingHarness,
  target: Awaited<ReturnType<typeof createTarget>>,
  attemptId: string
): Promise<void> {
  await h.admin.query(
    `INSERT INTO binding_confirmations
       (attempt_id, kind, actor_account_id, actor_person_id, authority,
        target_confirmed, candidate_recognized, statement_version)
     VALUES ($1, 'SECOND_PARTY', $2, $3, 'GUARDIAN', true, true,
             'second-party-recognition-v1')`,
    [attemptId, target.guardian.accountId, target.guardian.personId]
  );
}

async function secretContextCount(h: BindingHarness, attemptId: string): Promise<number> {
  const { rows } = await h.admin.query(
    `SELECT count(*)::int AS n FROM binding_pending_contexts
      WHERE attempt_id = $1
        AND (openid_ciphertext IS NOT NULL OR openid_nonce IS NOT NULL OR openid_tag IS NOT NULL)`,
    [attemptId]
  );
  return rows[0].n;
}

describe('Phase C context selection (PR #16 review Finding 2)', () => {
  let h: BindingHarness;

  beforeAll(async () => {
    h = await buildBindingApp();
  });

  afterAll(async () => {
    await h.close();
  });

  it('uses the fresh usable context B after historical context A has expired and been scrubbed', async () => {
    const target = await createTarget(h, 'ctx_commit_replay', { ageBand: 'UNDER_14' });
    const code = `ctx_commit_replay_${randomUUID()}`;

    // Context A: the first transport context linked to the live attempt.
    const first = await bootstrap(h, target.invitationToken, code, `a-${randomUUID()}`);
    expect(first.statusCode).toBe(200);
    const contextAToken = first.json().pendingContextToken as string;
    const attemptId = await latestAttemptId(h, target.targetPersonId);

    const { rows: aRows } = await h.admin.query(
      `SELECT id FROM binding_pending_contexts
        WHERE attempt_id = $1
        ORDER BY created_at ASC, id ASC
        LIMIT 1`,
      [attemptId]
    );
    const contextAId = aRows[0].id as string;
    expect(contextAId).toBeTruthy();

    // A expires. The access-time path scrubs its decryptable OpenID; the row
    // remains linked to the SAME live attempt (exactly the review scenario).
    await h.admin.query(
      `UPDATE binding_pending_contexts
          SET created_at = now() - interval '2 hours',
              expires_at = now() - interval '1 second'
        WHERE id = $1`,
      [contextAId]
    );
    const expiredUse = await candidateDecision(
      h,
      contextAToken,
      'AFFIRM',
      `a-expired-${randomUUID()}`,
      'candidate-binding-v1'
    );
    expect(expiredUse.statusCode).toBe(401);
    const scrubbedA = await h.admin.query(
      'SELECT openid_ciphertext, openid_nonce, openid_tag FROM binding_pending_contexts WHERE id = $1',
      [contextAId]
    );
    expect(scrubbedA.rows[0]).toEqual({
      openid_ciphertext: null,
      openid_nonce: null,
      openid_tag: null,
    });

    // Bootstrap replay with a NEW operation key creates context B for the same
    // live attempt (createAttempt converges on the frozen triple).
    const replay = await bootstrap(h, target.invitationToken, code, `b-${randomUUID()}`);
    expect(replay.statusCode).toBe(200);
    const contextBToken = replay.json().pendingContextToken as string;

    const { rows: bRows } = await h.admin.query(
      `SELECT id FROM binding_pending_contexts
        WHERE attempt_id = $1 AND openid_ciphertext IS NOT NULL
        ORDER BY created_at DESC, id DESC
        LIMIT 1`,
      [attemptId]
    );
    const contextBId = bRows[0].id as string;
    expect(contextBId).toBeTruthy();
    expect(contextBId).not.toBe(contextAId);
    expect(
      (
        await h.admin.query('SELECT count(*)::int AS n FROM binding_attempts WHERE id = $1', [
          attemptId,
        ])
      ).rows[0].n
    ).toBe(1);

    // Candidate confirms only through B. The challenge carries B's issuance.
    const affirm = await candidateDecision(
      h,
      contextBToken,
      'AFFIRM',
      `b-${randomUUID()}`,
      'candidate-binding-v1'
    );
    expect(affirm.statusCode).toBe(200);
    const challenge = affirm.json().pairingChallenge as string;
    expect(challenge).toMatch(/^[A-Za-z0-9_-]{192}$/);

    const confirmed = await confirmerDecision(h, target.guardian.token, challenge, {
      personId: target.targetPersonId,
      decision: 'AFFIRM',
    });
    expect(confirmed.statusCode).toBe(200);
    expect(confirmed.json().state).toBe('COMMITTED');

    // The commit used B. A stays scrubbed and all contexts are cleaned.
    const attempt = await h.admin.query(
      'SELECT state, terminal_reason, committed_account_id FROM binding_attempts WHERE id = $1',
      [attemptId]
    );
    expect(attempt.rows[0].state).toBe('COMMITTED');
    expect(attempt.rows[0].terminal_reason).toBeNull();
    expect(attempt.rows[0].committed_account_id).toBeTruthy();

    const person = await h.admin.query('SELECT account_id FROM persons WHERE id = $1', [
      target.targetPersonId,
    ]);
    expect(person.rows[0].account_id).toBe(attempt.rows[0].committed_account_id);
    expect(await secretContextCount(h, attemptId)).toBe(0);

    const contexts = await h.admin.query(
      'SELECT id, committed_account_id, openid_ciphertext FROM binding_pending_contexts WHERE attempt_id = $1 ORDER BY created_at ASC',
      [attemptId]
    );
    const a = contexts.rows.find((row: { id: string }) => row.id === contextAId);
    const b = contexts.rows.find((row: { id: string }) => row.id === contextBId);
    // A stays scrubbed: it never regains decryptable material.
    expect(a.openid_ciphertext).toBeNull();
    // B is the context Phase C actually used.
    expect(b.committed_account_id).toBe(attempt.rows[0].committed_account_id);
    expect(b.openid_ciphertext).toBeNull();

    const committedAudit = await h.admin.query(
      "SELECT count(*)::int AS n FROM identity_binding_audit_events WHERE attempt_id = $1 AND event_type = 'BINDING_COMMITTED'",
      [attemptId]
    );
    expect(committedAudit.rows[0].n).toBe(1);
  });

  it('fails closed (no commit) when only scrubbed contexts exist', async () => {
    const target = await createTarget(h, 'ctx_only_scrubbed', { ageBand: 'UNDER_14' });
    const { attemptId } = await startBinding(
      h,
      target,
      `ctx_only_scrubbed_${randomUUID()}`
    );
    await addSecondPartyConfirmation(h, target, attemptId);
    const contextId = await latestContextId(h, attemptId);

    // Every context of the attempt loses its decryptable material.
    await h.admin.query(
      `UPDATE binding_pending_contexts
          SET openid_ciphertext = NULL, openid_nonce = NULL, openid_tag = NULL
        WHERE attempt_id = $1`,
      [attemptId]
    );
    expect(await secretContextCount(h, attemptId)).toBe(0);

    const pool = createAppPool(1);
    try {
      const explicit: CommitOutcome = await commitAttempt(deps(h, pool), {
        attemptId,
        targetPersonId: target.targetPersonId,
        targetFamilyId: target.familyId,
        actorAccountId: target.guardian.accountId,
        contextId,
      });
      expect(explicit).toEqual({ outcome: 'RETRYABLE' });

      const implicit: CommitOutcome = await commitAttempt(deps(h, pool), {
        attemptId,
        targetPersonId: target.targetPersonId,
        targetFamilyId: target.familyId,
        actorAccountId: target.guardian.accountId,
      });
      expect(implicit).toEqual({ outcome: 'RETRYABLE' });
    } finally {
      await pool.end();
    }

    const attempt = await h.admin.query(
      'SELECT state, terminal_reason, committed_account_id FROM binding_attempts WHERE id = $1',
      [attemptId]
    );
    expect(attempt.rows[0]).toEqual({
      state: 'PENDING',
      terminal_reason: null,
      committed_account_id: null,
    });
    const person = await h.admin.query('SELECT account_id FROM persons WHERE id = $1', [
      target.targetPersonId,
    ]);
    expect(person.rows[0].account_id).toBeNull();
    const committedAudit = await h.admin.query(
      "SELECT count(*)::int AS n FROM identity_binding_audit_events WHERE attempt_id = $1 AND event_type = 'BINDING_COMMITTED'",
      [attemptId]
    );
    expect(committedAudit.rows[0].n).toBe(0);
  });

  it('fails closed when the supplied context belongs to a different attempt', async () => {
    const target = await createTarget(h, 'ctx_wrong_attempt', { ageBand: 'UNDER_14' });
    const other = await createTarget(h, 'ctx_wrong_attempt_other', { ageBand: 'UNDER_14' });
    const { attemptId } = await startBinding(
      h,
      target,
      `ctx_wrong_attempt_${randomUUID()}`
    );
    await addSecondPartyConfirmation(h, target, attemptId);

    const otherBinding = await startBinding(
      h,
      other,
      `ctx_wrong_attempt_other_${randomUUID()}`
    );
    const otherContextId = await latestContextId(h, otherBinding.attemptId);
    expect(otherContextId).toBeTruthy();

    const pool = createAppPool(1);
    try {
      const outcome = await commitAttempt(deps(h, pool), {
        attemptId,
        targetPersonId: target.targetPersonId,
        targetFamilyId: target.familyId,
        actorAccountId: target.guardian.accountId,
        contextId: otherContextId,
      });
      expect(outcome).toEqual({ outcome: 'RETRYABLE' });
    } finally {
      await pool.end();
    }

    const attempt = await h.admin.query(
      'SELECT state, committed_account_id FROM binding_attempts WHERE id = $1',
      [attemptId]
    );
    expect(attempt.rows[0]).toEqual({ state: 'PENDING', committed_account_id: null });
    const person = await h.admin.query('SELECT account_id FROM persons WHERE id = $1', [
      target.targetPersonId,
    ]);
    expect(person.rows[0].account_id).toBeNull();
  });
});