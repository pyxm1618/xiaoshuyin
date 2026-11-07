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
import { hashToken } from '../../apps/server/api/src/identity-binding/crypto.js';

function countSql(h: BindingHarness, table: string): Promise<number> {
  return h.admin.query(`SELECT count(*)::int AS n FROM ${table}`).then((r) => r.rows[0].n);
}

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

  it('DENY on bootstrap fails closed with no business write', async () => {
    const target = await createTarget(h, 'authz_deny_boot', { ageBand: 'UNDER_14' });
    const before = {
      contexts: await countSql(h, 'binding_pending_contexts'),
      attempts: await countSql(h, 'binding_attempts'),
      audits: await countSql(h, 'identity_binding_audit_events'),
      accounts: await countSql(h, 'accounts'),
      persons: await countSql(h, 'persons'),
    };

    authState.deny = true;
    const boot = await bootstrap(h, target.invitationToken, `deny_${randomUUID()}`);
    expect(boot.statusCode).toBe(401);
    expect(boot.json()).toEqual({
      code: 'WECHAT_AUTH_FAILED',
      message: 'WeChat authentication failed',
    });

    expect(await countSql(h, 'binding_pending_contexts')).toBe(before.contexts);
    expect(await countSql(h, 'binding_attempts')).toBe(before.attempts);
    expect(await countSql(h, 'identity_binding_audit_events')).toBe(before.audits);
    expect(await countSql(h, 'accounts')).toBe(before.accounts);
    expect(await countSql(h, 'persons')).toBe(before.persons);
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

    const beforeKeys = await countSql(h, 'binding_operation_keys');
    const beforeConfirmations = await countSql(h, 'binding_confirmations');
    const beforeAudits = await countSql(h, 'identity_binding_audit_events');
    const beforeAccounts = await countSql(h, 'accounts');
    const beforePersons = await countSql(h, 'persons');

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

    expect(await countSql(h, 'binding_operation_keys')).toBe(beforeKeys);
    expect(await countSql(h, 'binding_confirmations')).toBe(beforeConfirmations);
    expect(await countSql(h, 'identity_binding_audit_events')).toBe(beforeAudits);
    expect(await countSql(h, 'accounts')).toBe(beforeAccounts);
    expect(await countSql(h, 'persons')).toBe(beforePersons);
    // The target fixture ids stay unused; keep the variable meaningful.
    expect(target.targetPersonId).toMatch(/^[0-9a-f-]{36}$/);
  });
});