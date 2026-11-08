/**
 * H1 — the four candidate-facing surfaces MUST go through the single
 * `authorize()` entry and fail closed on DENY without business writes.
 *
 * The mock keeps the real implementation for ALLOW and forces DENY on demand,
 * so the test proves the surface actually consults `authorize()` (a surface
 * that never calls it leaves the action list empty).
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { randomUUID } from 'node:crypto';

const authState = vi.hoisted(() => ({
  deny: false,
  actions: [] as string[],
}));

vi.mock('@xiaoshuyin/authorization', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@xiaoshuyin/authorization')>();
  return {
    ...actual,
    authorize: (input: Parameters<typeof actual.authorize>[0]) => {
      authState.actions.push(input.action);
      if (authState.deny) return { decision: 'DENY', reason: 'NO_ACTOR' } as const;
      return actual.authorize(input);
    },
  };
});

import {
  buildBindingApp,
  candidateDecision,
  candidateSession,
  candidateStatus,
  createTarget,
  bootstrap,
  type BindingHarness,
} from '../setup/identity-binding.js';
import { deriveIdentityDigest, hashToken } from '../../apps/server/api/src/identity-binding/crypto.js';
import { computeOperationScope } from '@xiaoshuyin/domain';


describe('identity binding candidate surfaces use the single authorize()', () => {
  let h: BindingHarness;

  beforeAll(async () => {
    h = await buildBindingApp();
  });

  afterAll(async () => {
    await h.close();
  });

  beforeEach(() => {
    authState.deny = false;
    authState.actions = [];
  });

  it('bootstrap / decision / status / session all consult authorize()', async () => {
    const target = await createTarget(h, 'authz_surface', { ageBand: 'UNDER_14' });
    const code = `authz_${Date.now()}_${randomUUID()}`;

    const boot = await bootstrap(h, target.invitationToken, code);
    expect(boot.statusCode).toBe(200);
    const token = boot.json().pendingContextToken as string;

    const decision = await candidateDecision(h, token, 'AFFIRM', undefined, 'candidate-binding-v1');
    expect(decision.statusCode).toBe(200);
    const status = await candidateStatus(h, token);
    expect(status.statusCode).toBe(200);
    const session = await candidateSession(h, token);
    expect(session.statusCode).toBe(200);

    const actions = new Set(authState.actions);
    expect(actions.has('IDENTITY_BINDING_BOOTSTRAP')).toBe(true);
    expect(actions.has('IDENTITY_BINDING_CANDIDATE_DECIDE')).toBe(true);
    expect(actions.has('IDENTITY_BINDING_STATUS_SELF')).toBe(true);
    expect(actions.has('IDENTITY_BINDING_SESSION_EXCHANGE')).toBe(true);
  });

  it('DENY on bootstrap stays anti-enumeration generic with no business write', async () => {
    const target = await createTarget(h, 'authz_deny_boot', { ageBand: 'UNDER_14' });
    const code = `deny_${randomUUID()}`;
    const digest = deriveIdentityDigest(
      process.env['IDENTITY_BINDING_SECRET']!,
      `fake_${code}`
    );

    authState.deny = true;
    const boot = await bootstrap(h, target.invitationToken, code);
    // plan D-10.3: authorize() DENY is NOT a WeChat authentication failure.
    // The candidate sees the same frozen generic bootstrap shape.
    expect(boot.statusCode).toBe(200);
    expect(Object.keys(boot.json()).sort()).toEqual(['binding', 'pendingContextToken']);
    expect(boot.json().binding).toBe('NOT_COMPLETED');

    // The transport context is created (same observable shape), but the
    // ciphertext is cleared and no operation key / attempt / confirmation /
    // business audit / account / person is written.
    const contexts = await h.admin.query(
      'SELECT count(*)::int AS n, count(openid_ciphertext)::int AS cipher FROM binding_pending_contexts WHERE candidate_identity_digest = $1',
      [digest]
    );
    expect(contexts.rows[0].n).toBe(1);
    expect(contexts.rows[0].cipher).toBe(0);
    const keys = await h.admin.query(
      'SELECT count(*)::int AS n FROM binding_operation_keys WHERE scope_key = $1',
      [
        computeOperationScope({
          commandType: 'BOOTSTRAP',
          invitationParticipationId: target.participationId,
          candidateIdentityDigest: digest,
        }).scopeKey,
      ]
    );
    expect(keys.rows[0].n).toBe(0);
    const attempts = await h.admin.query(
      'SELECT count(*)::int AS n FROM binding_attempts WHERE candidate_identity_digest = $1',
      [digest]
    );
    expect(attempts.rows[0].n).toBe(0);
    const audits = await h.admin.query(
      'SELECT count(*)::int AS n FROM identity_binding_audit_events WHERE candidate_identity_digest = $1',
      [digest]
    );
    expect(audits.rows[0].n).toBe(0);
    const accounts = await h.admin.query(
      'SELECT count(*)::int AS n FROM accounts WHERE wechat_openid = $1',
      [`fake_${code}`]
    );
    expect(accounts.rows[0].n).toBe(0);
  });

  it('DENY on context surfaces is generic and writes nothing', async () => {
    const target = await createTarget(h, 'authz_deny_ctx', { ageBand: 'UNDER_14' });
    const token = `opaque-${randomUUID()}-opaque`;
    const id = randomUUID();
    await h.admin.query(
      `INSERT INTO binding_pending_contexts
         (id, token_hash, candidate_identity_digest, expires_at)
       VALUES ($1, $2, $3, now() + interval '10 minutes')`,
      [id, hashToken(token), 'a'.repeat(64)]
    );

    const digest = 'a'.repeat(64);
    const beforeKeys = await h.admin
      .query('SELECT count(*)::int AS n FROM binding_operation_keys WHERE scope_key = $1', [id])
      .then((r) => r.rows[0].n);
    const beforeConfirmations = await h.admin
      .query(
        'SELECT count(*)::int AS n FROM binding_confirmations WHERE actor_pending_context_id = $1',
        [id]
      )
      .then((r) => r.rows[0].n);
    const beforeAudits = await h.admin
      .query(
        'SELECT count(*)::int AS n FROM identity_binding_audit_events WHERE candidate_identity_digest = $1',
        [digest]
      )
      .then((r) => r.rows[0].n);

    authState.deny = true;

    const decision = await candidateDecision(h, token, 'AFFIRM', undefined, 'candidate-binding-v1');
    expect(decision.statusCode).toBe(200);
    expect(decision.json()).toEqual({ binding: 'NOT_COMPLETED' });

    const status = await candidateStatus(h, token);
    expect(status.statusCode).toBe(200);
    expect(status.json()).toEqual({ binding: 'NOT_COMPLETED' });

    const session = await candidateSession(h, token);
    expect(session.statusCode).toBe(200);
    expect(session.json()).toEqual({ binding: 'NOT_COMPLETED' });

    const afterKeys = await h.admin
      .query('SELECT count(*)::int AS n FROM binding_operation_keys WHERE scope_key = $1', [id])
      .then((r) => r.rows[0].n);
    const afterConfirmations = await h.admin
      .query(
        'SELECT count(*)::int AS n FROM binding_confirmations WHERE actor_pending_context_id = $1',
        [id]
      )
      .then((r) => r.rows[0].n);
    const afterAudits = await h.admin
      .query(
        'SELECT count(*)::int AS n FROM identity_binding_audit_events WHERE candidate_identity_digest = $1',
        [digest]
      )
      .then((r) => r.rows[0].n);

    expect(afterKeys).toBe(beforeKeys);
    expect(afterConfirmations).toBe(beforeConfirmations);
    expect(afterAudits).toBe(beforeAudits);

    const ctx = await h.admin.query(
      'SELECT attempt_id, committed_account_id FROM binding_pending_contexts WHERE id = $1',
      [id]
    );
    expect(ctx.rows[0].attempt_id).toBeNull();
    expect(ctx.rows[0].committed_account_id).toBeNull();
    // The target fixture ids stay unused; keep the variable meaningful.
    expect(target.targetPersonId).toMatch(/^[0-9a-f-]{36}$/);
  });
});