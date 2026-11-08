/**
 * H3 — same key + same payload replay must read back the authoritative attempt,
 * keep status / session usable, and never duplicate business facts.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  buildBindingApp,
  bootstrap,
  candidateDecision,
  candidateSession,
  candidateStatus,
  confirmerDecision,
  createTarget,
  startBinding,
  type BindingHarness,
} from '../setup/identity-binding.js';

describe('bootstrap replay reads back the authoritative attempt (H3)', () => {
  let h: BindingHarness;

  beforeAll(async () => {
    h = await buildBindingApp();
  });

  afterAll(async () => {
    await h.close();
  });

  it('replays PENDING / COMMITTED without duplicate attempt / confirmation / audit', async () => {
    const target = await createTarget(h, 'replay', { ageBand: 'UNDER_14' });
    const code = `replay_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const key = `boot-replay-${Date.now()}`;

    const first = await bootstrap(h, target.invitationToken, code, key);
    expect(first.statusCode).toBe(200);
    expect(first.json().binding).toBe('NOT_COMPLETED');
    const firstToken = first.json().pendingContextToken as string;

    const attempt = await h.admin.query(
      `SELECT id FROM binding_attempts WHERE target_person_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [target.targetPersonId]
    );
    const attemptId = attempt.rows[0].id as string;
    const keysAfterFirst = await h.admin.query(
      `SELECT count(*)::int AS n FROM binding_operation_keys WHERE command_type = 'BOOTSTRAP'`
    );

    // ── PENDING replay ──
    const second = await bootstrap(h, target.invitationToken, code, key);
    expect(second.statusCode).toBe(200);
    expect(second.json().binding).toBe('NOT_COMPLETED');
    const secondToken = second.json().pendingContextToken as string;

    const attempts = await h.admin.query(
      `SELECT count(*)::int AS n FROM binding_attempts WHERE target_person_id = $1`,
      [target.targetPersonId]
    );
    expect(attempts.rows[0].n).toBe(1);

    const keys = await h.admin.query(
      `SELECT count(*)::int AS n FROM binding_operation_keys WHERE command_type = 'BOOTSTRAP'`
    );
    expect(keys.rows[0].n).toBe(keysAfterFirst.rows[0].n);

    const createdAudit = await h.admin.query(
      `SELECT count(*)::int AS n FROM identity_binding_audit_events
        WHERE attempt_id = $1 AND event_type = 'BINDING_ATTEMPT_CREATED'`,
      [attemptId]
    );
    expect(createdAudit.rows[0].n).toBe(1);

    const status = await candidateStatus(h, secondToken);
    expect(status.statusCode).toBe(200);
    expect(status.json()).toEqual({ binding: 'NOT_COMPLETED' });

    // The replay token must be linked to the authoritative attempt: a
    // candidate AFFIRM through it is the only confirmation for that attempt.
    const affirm = await candidateDecision(h, secondToken, 'AFFIRM', undefined, 'candidate-binding-v1');
    expect(affirm.statusCode).toBe(200);
    const confirmations = await h.admin.query(
      `SELECT count(*)::int AS n FROM binding_confirmations WHERE attempt_id = $1 AND kind = 'CANDIDATE'`,
      [attemptId]
    );
    expect(confirmations.rows[0].n).toBe(1);

    const commit = await confirmerDecision(h, target.guardian.token, attemptId, {
      personId: target.targetPersonId,
      decision: 'AFFIRM',
    });
    expect(commit.statusCode).toBe(200);
    expect(commit.json().state).toBe('COMMITTED');

    // ── COMMITTED replay: frozen settled replay body `{ binding: "COMMITTED" }` ──
    const third = await bootstrap(h, target.invitationToken, code, key);
    expect(third.statusCode).toBe(200);
    expect(third.json()).toEqual({ binding: 'COMMITTED' });

    // The replay must not mint a transport credential for a settled attempt.
    const replayStatus = await candidateStatus(h, secondToken);
    expect(replayStatus.statusCode).toBe(200);
    expect(replayStatus.json()).toEqual({ binding: 'COMMITTED' });

    const replaySession = await candidateSession(h, secondToken);
    expect(replaySession.statusCode).toBe(200);
    expect(replaySession.json().binding).toBe('COMMITTED');

    const accounts = await h.admin.query(
      `SELECT count(*)::int AS n FROM accounts WHERE wechat_openid = $1`,
      [`fake_${code}`]
    );
    expect(accounts.rows[0].n).toBe(1);

    const persons = await h.admin.query(
      `SELECT count(*)::int AS n FROM persons WHERE account_id = $1`,
      [replaySession.json().account.id]
    );
    expect(persons.rows[0].n).toBe(1);

    const committedAudit = await h.admin.query(
      `SELECT count(*)::int AS n FROM identity_binding_audit_events
        WHERE attempt_id = $1 AND event_type = 'BINDING_COMMITTED'`,
      [attemptId]
    );
    expect(committedAudit.rows[0].n).toBe(1);

    // first token remains a valid pre-commit context; no extra attempt.
    expect(firstToken).not.toBe(secondToken);
    expect(third.json()).not.toHaveProperty('pendingContextToken');
  });
});