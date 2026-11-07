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
});