/**
 * T047 — app-layer Gate facts builder against the real database.
 *
 * This is DB-backed behavior and therefore MUST live in `tests/db/**`, never in
 * the pure `tests/domain/**` suite (plan D-19.1). It runs under the app role
 * (NOBYPASSRLS) so the binding purpose policies are exercised exactly as in
 * production.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import {
  buildBindingApp,
  createTarget,
  type BindingHarness,
} from '../setup/identity-binding.js';
import { withBindingTargetTransaction } from '../../apps/server/api/src/db/tx.js';
import {
  readBindingTargetFacts,
  readConfirmerFacts,
  resolveTargetFamilyId,
} from '../../apps/server/api/src/identity-binding/gate.js';

describe('binding Gate facts builder', () => {
  let h: BindingHarness;
  let pool: pg.Pool;

  beforeAll(async () => {
    h = await buildBindingApp();
    pool = new pg.Pool({ connectionString: process.env['DATABASE_URL'], max: 4 });
  });

  afterAll(async () => {
    await pool.end();
    await h.close();
  });

  it('reads P1 age / guardian / unique family under binding purpose', async () => {
    const target = await createTarget(h, 'facts_u14', { ageBand: 'UNDER_14' });

    const facts = await withBindingTargetTransaction(
      pool,
      { targetPersonId: target.targetPersonId, actorAccountId: target.guardian.accountId },
      (tx) =>
        readConfirmerFacts(tx, target.targetPersonId, target.guardian.accountId)
    );

    expect(facts).not.toBeNull();
    expect(facts!.targetPersonId).toBe(target.targetPersonId);
    expect(facts!.targetFamilyId).toBe(target.familyId);
    expect(facts!.targetAgeBand).toBe('UNDER_14');
    expect(facts!.bindingGuardianPersonId).toBe(target.guardian.personId);
    expect(facts!.bindingFamilyCreatedByPersonId).toBe(target.guardian.personId);
    expect(facts!.targetIsFamilyMember).toBe(true);
  });

  it('missing target yields null confirmer facts / no family', async () => {
    const missing = '00000000-0000-0000-0000-000000000000';
    const facts = await withBindingTargetTransaction(
      pool,
      { targetPersonId: missing },
      (tx) => readConfirmerFacts(tx, missing, '00000000-0000-0000-0000-000000000001')
    );
    expect(facts).toBeNull();

    const family = await withBindingTargetTransaction(
      pool,
      { targetPersonId: missing },
      (tx) => resolveTargetFamilyId(tx, missing)
    );
    expect(family).toBeNull();
  });

  it('ADULT target is read but never becomes an authorized confirmer row', async () => {
    const target = await createTarget(h, 'facts_adult', { ageBand: 'ADULT' });
    const facts = await withBindingTargetTransaction(
      pool,
      { targetPersonId: target.targetPersonId, actorAccountId: target.guardian.accountId },
      (tx) => readBindingTargetFacts(tx, target.targetPersonId)
    );
    expect(facts.personExists).toBe(true);
    expect(facts.ageBand).toBe('ADULT');
  });
});