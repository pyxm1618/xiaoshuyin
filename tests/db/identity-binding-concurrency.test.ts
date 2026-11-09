/**
 * Concurrency convergence: successful commits ∈ {0,1}, binding increase ≤ 1.
 */

import { randomUUID } from 'node:crypto';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  buildBindingApp,
  createTarget,
  bootstrap,
  candidateDecision,
  confirmerDecision,
  startBinding,
  type BindingHarness,
} from '../setup/identity-binding.js';

describe('binding commit concurrency', () => {
  let h: BindingHarness;

  beforeAll(async () => {
    h = await buildBindingApp();
  });

  afterAll(async () => {
    await h.close();
  });

  it('two attempts claim the same P1 → exactly one COMMITTED', async () => {
    const target = await createTarget(h, 'conc_p1', { ageBand: 'MINOR_14_17' });

    // Two invitations for the same P1 / Family.
    const token2 = `invite2_${Date.now()}`;
    h.port.add(token2, {
      status: 'VALID',
      participationId: randomUUID(),
      targetPersonId: target.targetPersonId,
      targetFamilyId: target.familyId,
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    });

    const codeA = `conc_a_${Date.now()}`;
    const codeB = `conc_b_${Date.now()}`;
    const first = await startBinding(h, target, codeA);
    const bootB = await bootstrap(h, token2, codeB);
    const ctxB = bootB.json().pendingContextToken as string;
    await candidateDecision(h, ctxB, 'AFFIRM', undefined, 'candidate-binding-v1');

    const attempts = await h.admin.query(
      `SELECT id FROM binding_attempts WHERE target_person_id = $1 AND state = 'PENDING'`,
      [target.targetPersonId]
    );
    expect(attempts.rows.length).toBe(2);
    const ids = attempts.rows.map((r) => r.id as string);
    const idA = ids.find((id) => id === first.attemptId) ?? ids[0]!;
    const idB = ids.find((id) => id !== idA) ?? ids[1]!;

    const [resA, resB] = await Promise.all([
      confirmerDecision(h, target.guardian.token, idA, {
        personId: target.targetPersonId,
        decision: 'AFFIRM',
        idempotencyKey: `sp-a-${Date.now()}`,
      }),
      confirmerDecision(h, target.guardian.token, idB, {
        personId: target.targetPersonId,
        decision: 'AFFIRM',
        idempotencyKey: `sp-b-${Date.now()}`,
      }),
    ]);

    const states = [resA.json().state, resB.json().state].sort();
    expect(states).toEqual(['COMMITTED', 'TERMINAL']);

    const bound = await h.admin.query(
      `SELECT count(*)::int AS cnt FROM persons WHERE id = $1 AND account_id IS NOT NULL`,
      [target.targetPersonId]
    );
    expect(bound.rows[0].cnt).toBe(1);
    const committed = await h.admin.query(
      `SELECT count(*)::int AS cnt FROM binding_attempts
       WHERE target_person_id = $1 AND state = 'COMMITTED'`,
      [target.targetPersonId]
    );
    expect(committed.rows[0].cnt).toBe(1);
    // Persons created by THIS flow's Accounts (a P2 would be created by one of
    // them). Other suites run in parallel, so the count is flow-scoped rather
    // than a global table count.
    const p2 = await h.admin.query(
      `SELECT count(*)::int AS cnt
         FROM persons p JOIN accounts a ON a.id = p.created_by_account_id
        WHERE a.wechat_openid = ANY($1::text[])`,
      [[`fake_${codeA}`, `fake_${codeB}`]]
    );
    expect(p2.rows[0].cnt).toBe(0);
  });

  it('two Persons claim the same candidate Account concurrently → at most one binding', async () => {
    const code = `conc_account_${randomUUID()}`;
    const targetA = await createTarget(h, 'conc_account_a', { ageBand: 'UNDER_14' });
    const targetB = await createTarget(h, 'conc_account_b', { ageBand: 'UNDER_14' });

    const bootA = await bootstrap(h, targetA.invitationToken, code);
    const bootB = await bootstrap(h, targetB.invitationToken, code);
    const tokenA = bootA.json().pendingContextToken as string;
    const tokenB = bootB.json().pendingContextToken as string;
    expect(bootA.json().binding).toBe('NOT_COMPLETED');
    expect(bootB.json().binding).toBe('NOT_COMPLETED');
    await Promise.all([
      candidateDecision(h, tokenA, 'AFFIRM', `ca-${randomUUID()}`, 'candidate-binding-v1'),
      candidateDecision(h, tokenB, 'AFFIRM', `cb-${randomUUID()}`, 'candidate-binding-v1'),
    ]);

    const attemptsA = await h.admin.query(
      'SELECT id FROM binding_attempts WHERE target_person_id = $1',
      [targetA.targetPersonId]
    );
    const attemptsB = await h.admin.query(
      'SELECT id FROM binding_attempts WHERE target_person_id = $1',
      [targetB.targetPersonId]
    );
    expect(attemptsA.rows).toHaveLength(1);
    expect(attemptsB.rows).toHaveLength(1);

    const [resA, resB] = await Promise.all([
      confirmerDecision(h, targetA.guardian.token, attemptsA.rows[0].id, {
        personId: targetA.targetPersonId,
        decision: 'AFFIRM',
        idempotencyKey: `sa-${randomUUID()}`,
      }),
      confirmerDecision(h, targetB.guardian.token, attemptsB.rows[0].id, {
        personId: targetB.targetPersonId,
        decision: 'AFFIRM',
        idempotencyKey: `sb-${randomUUID()}`,
      }),
    ]);
    expect([resA.json().state, resB.json().state].sort()).toEqual(['COMMITTED', 'TERMINAL']);

    const accounts = await h.admin.query('SELECT count(*)::int AS n FROM accounts WHERE wechat_openid = $1', [
      `fake_${code}`,
    ]);
    expect(accounts.rows[0].n).toBe(1);
    const account = await h.admin.query('SELECT id FROM accounts WHERE wechat_openid = $1', [
      `fake_${code}`,
    ]);
    const bound = await h.admin.query('SELECT count(*)::int AS n FROM persons WHERE account_id = $1', [
      account.rows[0].id,
    ]);
    expect(bound.rows[0].n).toBe(1);
    const committed = await h.admin.query(
      `SELECT count(*)::int AS n FROM binding_attempts
        WHERE target_person_id = ANY($1::uuid[]) AND state = 'COMMITTED'`,
      [[targetA.targetPersonId, targetB.targetPersonId]]
    );
    expect(committed.rows[0].n).toBe(1);
    const p2 = await h.admin.query(
      `SELECT count(*)::int AS n FROM persons p
        JOIN accounts a ON a.id = p.created_by_account_id
       WHERE a.wechat_openid = $1`,
      [`fake_${code}`]
    );
    expect(p2.rows[0].n).toBe(0);
  });

  it('double confirmation / commit-vs-retry converges to exactly one commit', async () => {
    const target = await createTarget(h, 'conc_double', { ageBand: 'UNDER_14' });
    const code = `conc_double_${randomUUID()}`;
    const { attemptId } = await startBinding(h, target, code);

    const [a, b] = await Promise.all([
      confirmerDecision(h, target.guardian.token, attemptId, {
        personId: target.targetPersonId,
        decision: 'AFFIRM',
        idempotencyKey: `dc-a-${randomUUID()}`,
      }),
      confirmerDecision(h, target.guardian.token, attemptId, {
        personId: target.targetPersonId,
        decision: 'AFFIRM',
        idempotencyKey: `dc-b-${randomUUID()}`,
      }),
    ]);
    const outcomes = [a, b].map((r) => ({ status: r.statusCode, state: r.json().state }));
    expect(outcomes.filter((o) => o.status === 200).map((o) => o.state)).toEqual([
      'COMMITTED',
    ]);
    expect(outcomes.filter((o) => o.status === 404)).toHaveLength(1);

    const confirmations = await h.admin.query(
      "SELECT count(*)::int AS n FROM binding_confirmations WHERE attempt_id = $1 AND kind = 'SECOND_PARTY'",
      [attemptId]
    );
    expect(confirmations.rows[0].n).toBe(1);
    const commitAudit = await h.admin.query(
      "SELECT count(*)::int AS n FROM identity_binding_audit_events WHERE attempt_id = $1 AND event_type = 'BINDING_COMMITTED'",
      [attemptId]
    );
    expect(commitAudit.rows[0].n).toBe(1);
    const bound = await h.admin.query(
      'SELECT count(*)::int AS n FROM persons WHERE id = $1 AND account_id IS NOT NULL',
      [target.targetPersonId]
    );
    expect(bound.rows[0].n).toBe(1);
    const p2 = await h.admin.query(
      `SELECT count(*)::int AS n FROM persons p
        JOIN accounts a ON a.id = p.created_by_account_id
       WHERE a.wechat_openid = $1`,
      [`fake_${code}`]
    );
    expect(p2.rows[0].n).toBe(0);
  });

  it('all-failure concurrent commits produce zero commits and no Person increment', async () => {
    const target = await createTarget(h, 'conc_all_fail', { ageBand: 'UNDER_14' });
    const code = `conc_all_fail_${randomUUID()}`;
    const { attemptId } = await startBinding(h, target, code);
    const personsBefore = await h.admin.query(
      'SELECT count(*)::int AS n FROM persons WHERE id = $1',
      [target.targetPersonId]
    );

    // Invitation is now terminal: Gate 2 must fail for every concurrent retry.
    h.port.remove(target.invitationToken);
    const results = await Promise.all([
      confirmerDecision(h, target.guardian.token, attemptId, {
        personId: target.targetPersonId,
        decision: 'AFFIRM',
        idempotencyKey: `af-a-${randomUUID()}`,
      }),
      confirmerDecision(h, target.guardian.token, attemptId, {
        personId: target.targetPersonId,
        decision: 'AFFIRM',
        idempotencyKey: `af-b-${randomUUID()}`,
      }),
    ]);
    const failed = results
      .map((r) => (r.statusCode === 200 ? r.json().state : `HTTP_${r.statusCode}`))
      .sort();
    expect(failed).toEqual(['HTTP_404', 'TERMINAL']);

    const committed = await h.admin.query(
      "SELECT count(*)::int AS n FROM binding_attempts WHERE target_person_id = $1 AND state = 'COMMITTED'",
      [target.targetPersonId]
    );
    expect(committed.rows[0].n).toBe(0);
    const bound = await h.admin.query(
      'SELECT count(*)::int AS n FROM persons WHERE id = $1 AND account_id IS NOT NULL',
      [target.targetPersonId]
    );
    expect(bound.rows[0].n).toBe(0);
    const accounts = await h.admin.query('SELECT count(*)::int AS n FROM accounts WHERE wechat_openid = $1', [
      `fake_${code}`,
    ]);
    expect(accounts.rows[0].n).toBe(0);
    const personsAfter = await h.admin.query(
      'SELECT count(*)::int AS n FROM persons WHERE id = $1',
      [target.targetPersonId]
    );
    expect(personsAfter.rows[0].n).toBe(personsBefore.rows[0].n);
  });
});