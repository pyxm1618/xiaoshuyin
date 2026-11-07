/**
 * RLS isolation for binding tables and purpose-scoped Slice 1 reads.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import {
  buildBindingApp,
  createAppPool,
  createTarget,
  startBinding,
  type BindingHarness,
} from '../setup/identity-binding.js';
import {
  withAccountTransaction,
  withBindingContextTransaction,
  withBindingCommitTransaction,
  withBindingGateTransaction,
  withBindingTargetTransaction,
} from '../../apps/server/api/src/db/tx.js';
import { hashToken } from '../../apps/server/api/src/identity-binding/crypto.js';

describe('binding RLS isolation', () => {
  let h: BindingHarness;
  let pool: pg.Pool;

  beforeAll(async () => {
    h = await buildBindingApp();
    pool = createAppPool();
  });

  afterAll(async () => {
    await pool.end();
    await h.close();
  });

  it('no binding context → 0 rows on every new table', async () => {
    const { rows } = await pool.query(
      `SELECT
         (SELECT count(*) FROM binding_pending_contexts)::int AS contexts,
         (SELECT count(*) FROM binding_attempts)::int AS attempts,
         (SELECT count(*) FROM binding_confirmations)::int AS confirmations,
         (SELECT count(*) FROM binding_operation_keys)::int AS operations`
    );
    expect(rows[0]).toEqual({ contexts: 0, attempts: 0, confirmations: 0, operations: 0 });
  });

  it('candidate context cannot read P1 profile / consent', async () => {
    const target = await createTarget(h, 'rls_cand', { ageBand: 'UNDER_14' });
    const boot = await (await import('../setup/identity-binding.js')).bootstrap(
      h,
      target.invitationToken,
      `rls_cand_${Date.now()}`
    );
    const token = boot.json().pendingContextToken as string;

    const rows = await withBindingContextTransaction(
      pool,
      { tokenHash: hashToken(token) },
      async (tx) => {
        const pcp = await tx.query('SELECT count(*)::int AS cnt FROM person_compliance_profiles');
        const consent = await tx.query('SELECT count(*)::int AS cnt FROM consent_records');
        return { pcp: pcp.rows[0].cnt, consent: consent.rows[0].cnt };
      }
    );
    expect(rows).toEqual({ pcp: 0, consent: 0 });
  });

  it('wrong target / wrong family sees 0 binding rows', async () => {
    const target = await createTarget(h, 'rls_wrong', { ageBand: 'UNDER_14' });
    await startBinding(h, target, `rls_wrong_${Date.now()}`);

    const rows = await withBindingGateTransaction(
      pool,
      {
        targetPersonId: '01a1b5c0-0000-7000-8000-0000000000ff',
        targetFamilyId: '01a1b5c0-0000-7000-8000-0000000000fe',
      },
      async (tx) => {
        const attempts = await tx.query('SELECT count(*)::int AS cnt FROM binding_attempts');
        const persons = await tx.query('SELECT count(*)::int AS cnt FROM persons');
        return { attempts: attempts.rows[0].cnt, persons: persons.rows[0].cnt };
      }
    );
    expect(rows).toEqual({ attempts: 0, persons: 0 });
  });

  it('target-person read is visible only under the binding purpose', async () => {
    const target = await createTarget(h, 'rls_purpose', { ageBand: 'UNDER_14' });
    const visible = await withBindingTargetTransaction(
      pool,
      { targetPersonId: target.targetPersonId },
      async (tx) => {
        const { rows } = await tx.query('SELECT count(*)::int AS cnt FROM persons WHERE id = $1', [
          target.targetPersonId,
        ]);
        return rows[0].cnt;
      }
    );
    expect(visible).toBe(1);

    const hidden = await withAccountTransaction(
      pool,
      {
        accountId: '01a1b5c0-0000-7000-8000-0000000000ff',
        purpose: 'SELF_IDENTITY',
      },
      async (tx) => {
        const { rows } = await tx.query('SELECT count(*)::int AS cnt FROM persons WHERE id = $1', [
          target.targetPersonId,
        ]);
        return rows[0].cnt;
      }
    );
    expect(hidden).toBe(0);
  });

  it('commit cannot update a non-target Person', async () => {
    const targetA = await createTarget(h, 'rls_a', { ageBand: 'UNDER_14' });
    const targetB = await createTarget(h, 'rls_b', { ageBand: 'UNDER_14' });

    const rows = await withBindingCommitTransaction(
      pool,
      {
        attemptId: '01a1b5c0-0000-7000-8000-000000000001',
        targetPersonId: targetA.targetPersonId,
        targetFamilyId: targetA.familyId,
        actorAccountId: '01a1b5c0-0000-7000-8000-000000000002',
        commitAccountId: '01a1b5c0-0000-7000-8000-000000000002',
      },
      async (tx) => {
        const result = await tx.query(
          'UPDATE persons SET updated_at = now() WHERE id = $1',
          [targetB.targetPersonId]
        );
        return result.rowCount;
      }
    );
    expect(rows).toBe(0);
  });
});