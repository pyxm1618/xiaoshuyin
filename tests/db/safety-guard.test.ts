/**
 * T908 — transaction-backed ordinary-progression Safety guard.
 *
 * Proves the guard reads real DB state (not caller parameters), fails closed
 * with a stable non-leaking code, and performs no writes.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import { buildApp } from '../../apps/server/api/src/app.js';
import { withDrizzleRlsTransaction } from '../../apps/server/api/src/db/drizzle-tx.js';
import {
  assertOrdinaryProgressionAllowed,
  assertOrdinaryProgressionAllowedRaw,
  decideOrdinaryProgression,
  isSafetyHoldStatus,
  type SafetyWriteTx,
} from '../../packages/domain/src/safety/index.js';
import { createAdminPool } from '../setup/db.js';
import { createSafetyFixture, type SafetyFixture } from '../setup/safety.js';

const PREFIX = 't908_';

describe('T908 AssertOrdinaryProgressionAllowed', () => {
  let fixture: SafetyFixture;
  let admin: pg.Pool;
  let owner: { token: string; accountId: string; personId: string };
  let familyId: string;

  beforeAll(async () => {
    const app = await buildApp();
    await app.ready();
    admin = createAdminPool();
    fixture = createSafetyFixture({ app, admin, prefix: PREFIX });
    owner = await fixture.login('owner');
    familyId = await fixture.createFamily(owner, 'main');
  });

  afterAll(async () => {
    await fixture.cleanup();
    await fixture.close();
    await admin.end();
    await fixture.app.close();
  });

  const rls = () => ({
    familyId,
    accountId: owner.accountId,
    personId: owner.personId,
    purpose: 'FAMILY_MANAGEMENT',
  });

  async function guardedCase(status: string): Promise<string> {
    const created = await fixture.createCase(owner);
    if (status !== 'OPEN') await fixture.setCaseStatus(created.id, status);
    return created.id;
  }

  it('blocks a held Case with SAFETY_HOLD_BLOCKED', async () => {
    const caseId = await guardedCase('SAFETY_HOLD');
    await expect(
      withDrizzleRlsTransaction(fixture.pool, rls(), (tx) =>
        assertOrdinaryProgressionAllowed(tx as unknown as SafetyWriteTx, { caseId })
      )
    ).rejects.toMatchObject({ code: 'SAFETY_HOLD_BLOCKED', name: 'SafetyError' });
  });

  it('allows every non-held status from the Safety perspective', async () => {
    for (const status of ['OPEN', 'WAITING', 'LOST_CONTACT', 'CLOSED']) {
      const caseId = await guardedCase(status);
      await expect(
        withDrizzleRlsTransaction(fixture.pool, rls(), (tx) =>
          assertOrdinaryProgressionAllowed(tx as unknown as SafetyWriteTx, { caseId })
        )
      ).resolves.toBeUndefined();
    }
  });

  it('ignores a caller-supplied stale status snapshot', async () => {
    const caseId = await guardedCase('SAFETY_HOLD');
    // The signature does not accept a status; even if a caller attaches one it
    // cannot change the decision, because the guard re-reads the row.
    await expect(
      withDrizzleRlsTransaction(fixture.pool, rls(), (tx) =>
        assertOrdinaryProgressionAllowed(tx as unknown as SafetyWriteTx, {
          caseId,
          status: 'OPEN',
        } as unknown as { caseId: string })
      )
    ).rejects.toMatchObject({ code: 'SAFETY_HOLD_BLOCKED' });
  });

  it('fails closed for a Case outside the Family without revealing it', async () => {
    const other = await fixture.login('other');
    await fixture.createFamily(other, 'other');
    const otherCase = await fixture.createCase(other);

    // Owner's Family context cannot see the other Family's Case.
    await expect(
      withDrizzleRlsTransaction(fixture.pool, rls(), (tx) =>
        assertOrdinaryProgressionAllowed(tx as unknown as SafetyWriteTx, { caseId: otherCase.id })
      )
    ).rejects.toMatchObject({ code: 'SAFETY_HOLD_BLOCKED' });
  });

  it('performs no write and advances no version', async () => {
    const caseId = await guardedCase('WAITING');
    const before = await fixture.getCase(caseId);
    await withDrizzleRlsTransaction(fixture.pool, rls(), (tx) =>
      assertOrdinaryProgressionAllowed(tx as unknown as SafetyWriteTx, { caseId })
    );
    const after = await fixture.getCase(caseId);
    expect(after.version).toBe(before.version);
    expect(after.status).toBe('WAITING');
  });

  it('shares the same policy through the raw transaction accessor', async () => {
    const heldCase = await guardedCase('SAFETY_HOLD');
    const openCase = await guardedCase('OPEN');

    await withDrizzleRlsTransaction(fixture.pool, rls(), async (tx, client) => {
      await expect(
        assertOrdinaryProgressionAllowedRaw(client, { caseId: heldCase })
      ).rejects.toMatchObject({ code: 'SAFETY_HOLD_BLOCKED' });
      await expect(
        assertOrdinaryProgressionAllowedRaw(client, { caseId: openCase })
      ).resolves.toBeUndefined();
      // Both accessors must agree with the pure policy.
      expect(decideOrdinaryProgression('SAFETY_HOLD').allowed).toBe(false);
      expect(decideOrdinaryProgression('OPEN').allowed).toBe(true);
      expect(decideOrdinaryProgression(null).allowed).toBe(false);
      expect(isSafetyHoldStatus('SAFETY_HOLD')).toBe(true);
      expect(isSafetyHoldStatus('CLOSED')).toBe(false);
      void tx;
    });
  });
});