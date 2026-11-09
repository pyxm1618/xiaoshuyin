/**
 * F-04 — confirmer pairing ceremony.
 *
 * The confirmer snapshots the pending list (S0), personally recognizes the
 * physically present candidate, the candidate performs a fresh bootstrap, then
 * the confirmer refreshes (S1). Only `S1 - S0` with exactly one element is a
 * valid selector. Zero or more than one delta fails closed. The candidate never
 * receives an attemptId and never shares its pendingContextToken.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import {
  bootstrap,
  buildBindingApp,
  candidateDecision,
  confirmerDecision,
  confirmerList,
  createTarget,
  type BindingHarness,
} from '../setup/identity-binding.js';

async function pendingIds(h: BindingHarness, token: string, personId: string): Promise<string[]> {
  const res = await confirmerList(h, token, personId);
  expect(res.statusCode).toBe(200);
  return (res.json().attempts as Array<{ attemptId: string }>).map((a) => a.attemptId);
}

describe('F-04 confirmer pairing ceremony', () => {
  let h: BindingHarness;

  beforeAll(async () => {
    h = await buildBindingApp();
  });

  afterAll(async () => {
    await h.close();
  });

  it('|D| = 1 selects exactly one attempt and completes the binding', async () => {
    const target = await createTarget(h, 'pair_one', { ageBand: 'UNDER_14' });

    const s0 = await pendingIds(h, target.guardian.token, target.targetPersonId);
    expect(s0).toHaveLength(0);

    const code = `pair_one_${randomUUID()}`;
    const boot = await bootstrap(h, target.invitationToken, code);
    expect(boot.statusCode).toBe(200);
    const contextToken = boot.json().pendingContextToken as string;
    // Candidate never receives an attemptId.
    expect(boot.json()).not.toHaveProperty('attemptId');
    expect(JSON.stringify(boot.json())).not.toContain('attemptId');

    const listRes = await confirmerList(h, target.guardian.token, target.targetPersonId);
    expect(listRes.statusCode).toBe(200);
    const s1Items = listRes.json().attempts as Array<Record<string, unknown>>;
    // Confirmer sees ONLY the minimal selector fields and never the candidate token.
    for (const item of s1Items) {
      expect(Object.keys(item).sort()).toEqual(['attemptId', 'createdAt', 'expiresAt']);
    }
    expect(JSON.stringify(listRes.json())).not.toContain(contextToken);

    const s1 = s1Items.map((item) => item.attemptId as string);
    const delta = s1.filter((id) => !s0.includes(id));
    expect(delta).toHaveLength(1);
    const selected = delta[0]!;

    const candidate = await candidateDecision(
      h,
      contextToken,
      'AFFIRM',
      undefined,
      'candidate-binding-v1'
    );
    expect(candidate.statusCode).toBe(200);

    const confirmed = await confirmerDecision(h, target.guardian.token, selected, {
      personId: target.targetPersonId,
      decision: 'AFFIRM',
    });
    expect(confirmed.statusCode).toBe(200);
    expect(confirmed.json().state).toBe('COMMITTED');

    const person = await h.admin.query('SELECT account_id FROM persons WHERE id = $1', [
      target.targetPersonId,
    ]);
    expect(person.rows[0].account_id).not.toBeNull();
  });

  it('|D| = 0 fails closed (a replay converges onto the existing attempt)', async () => {
    const target = await createTarget(h, 'pair_zero', { ageBand: 'UNDER_14' });
    const code = `pair_zero_${randomUUID()}`;

    const first = await bootstrap(h, target.invitationToken, code);
    const firstContext = first.json().pendingContextToken as string;
    await candidateDecision(h, firstContext, 'AFFIRM', undefined, 'candidate-binding-v1');

    const s0 = await pendingIds(h, target.guardian.token, target.targetPersonId);
    expect(s0).toHaveLength(1);

    // A fresh bootstrap with the same identity/triple converges onto the same
    // live attempt, so the confirmer's refresh adds nothing.
    const replay = await bootstrap(h, target.invitationToken, code, `pair-zero-${randomUUID()}`);
    expect(replay.statusCode).toBe(200);

    const s1 = await pendingIds(h, target.guardian.token, target.targetPersonId);
    const delta = s1.filter((id) => !s0.includes(id));
    expect(delta).toHaveLength(0);

    // Fail closed: no selector exists, so the ceremony must not proceed.
    const attempts = await h.admin.query(
      'SELECT count(*)::int AS n FROM binding_attempts WHERE target_person_id = $1',
      [target.targetPersonId]
    );
    expect(attempts.rows[0].n).toBe(1);
  });

  it('|D| > 1 fails closed (two distinct candidate identities create two attempts)', async () => {
    const target = await createTarget(h, 'pair_many', { ageBand: 'UNDER_14' });

    const s0 = await pendingIds(h, target.guardian.token, target.targetPersonId);
    expect(s0).toHaveLength(0);

    const codeA = `pair_many_a_${randomUUID()}`;
    const codeB = `pair_many_b_${randomUUID()}`;
    expect((await bootstrap(h, target.invitationToken, codeA)).statusCode).toBe(200);
    expect((await bootstrap(h, target.invitationToken, codeB)).statusCode).toBe(200);

    const s1 = await pendingIds(h, target.guardian.token, target.targetPersonId);
    const delta = s1.filter((id) => !s0.includes(id));
    expect(delta.length).toBeGreaterThan(1);
  });
});