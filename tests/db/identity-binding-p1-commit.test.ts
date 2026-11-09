/**
 * P1 conditional update / Account ↔ Person uniqueness evidence.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import {
  buildBindingApp,
  createAppPool,
  createTarget,
  startBinding,
  confirmerDecision,
  type BindingHarness,
} from '../setup/identity-binding.js';
import { withBindingCommitTransaction } from '../../apps/server/api/src/db/tx.js';
import {
  bindPersonAccountIfUnbound,
  lockPersonForBinding,
} from '../../packages/domain/src/repository.js';

describe('P1 conditional binding', () => {
  let h: BindingHarness;
  let appPool: pg.Pool;

  beforeAll(async () => {
    h = await buildBindingApp();
    appPool = createAppPool();
  });

  afterAll(async () => {
    await appPool.end();
    await h.close();
  });

  it('updates exactly one unbound Person; a second attempt updates zero', async () => {
    const target = await createTarget(h, 'p1_cond', { ageBand: 'UNDER_14' });
    // A fresh, unbound Account keeps the conditional-update assertion exact.
    const { rows } = await h.admin.query(
      `INSERT INTO accounts (wechat_openid) VALUES ($1) RETURNING id`,
      [`p1_cond_${Date.now()}_${Math.random().toString(36).slice(2)}`]
    );
    const accountId = rows[0].id as string;

    const first = await withBindingCommitTransaction(
      appPool,
      {
        attemptId: '01a1b5c0-0000-7000-8000-000000000001',
        targetPersonId: target.targetPersonId,
        targetFamilyId: target.familyId,
        actorAccountId: accountId,
        commitAccountId: accountId,
      },
      async (tx) => {
        await lockPersonForBinding(tx, target.targetPersonId);
        return bindPersonAccountIfUnbound(tx, target.targetPersonId, accountId);
      }
    );
    expect(first).toBe(1);

    const second = await withBindingCommitTransaction(
      appPool,
      {
        attemptId: '01a1b5c0-0000-7000-8000-000000000001',
        targetPersonId: target.targetPersonId,
        targetFamilyId: target.familyId,
        actorAccountId: accountId,
        commitAccountId: accountId,
      },
      (tx) => bindPersonAccountIfUnbound(tx, target.targetPersonId, accountId)
    );
    expect(second).toBe(0);
  });

  it('persons.account_id is globally unique', async () => {
    const targetA = await createTarget(h, 'p1_uniq_a', { ageBand: 'UNDER_14' });
    const targetB = await createTarget(h, 'p1_uniq_b', { ageBand: 'UNDER_14' });
    const { rows } = await h.admin.query(
      `INSERT INTO accounts (wechat_openid) VALUES ($1) RETURNING id`,
      [`p1_uniq_${Date.now()}_${Math.random().toString(36).slice(2)}`]
    );
    const accountId = rows[0].id as string;

    const bound = await withBindingCommitTransaction(
      appPool,
      {
        attemptId: '01a1b5c0-0000-7000-8000-000000000001',
        targetPersonId: targetA.targetPersonId,
        targetFamilyId: targetA.familyId,
        actorAccountId: accountId,
        commitAccountId: accountId,
      },
      (tx) => bindPersonAccountIfUnbound(tx, targetA.targetPersonId, accountId)
    );
    expect(bound).toBe(1);

    await expect(
      h.admin.query('UPDATE persons SET account_id = $1 WHERE id = $2', [
        accountId,
        targetB.targetPersonId,
      ])
    ).rejects.toMatchObject({ code: '23505' });
  });

  it('committed binding survives downstream invitation terminal state', async () => {
    const target = await createTarget(h, 'p1_survive', { ageBand: 'UNDER_14' });
    const { attemptId } = await startBinding(h, target, `p1_survive_${Date.now()}`);
    const confirm = await confirmerDecision(h, target.guardian.token, attemptId, {
      personId: target.targetPersonId,
      decision: 'AFFIRM',
    });
    expect(confirm.json().state).toBe('COMMITTED');

    // Invitation becomes unusable after commit.
    h.port.remove(target.invitationToken);
    const { rows } = await h.admin.query(
      'SELECT account_id FROM persons WHERE id = $1',
      [target.targetPersonId]
    );
    expect(rows[0].account_id).not.toBeNull();
  });
});