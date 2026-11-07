/**
 * Confirmation append-only / one-per-kind evidence.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  buildBindingApp,
  createTarget,
  startBinding,
  candidateDecision,
  type BindingHarness,
} from '../setup/identity-binding.js';

describe('binding confirmation repository', () => {
  let h: BindingHarness;

  beforeAll(async () => {
    h = await buildBindingApp();
  });

  afterAll(async () => {
    await h.close();
  });

  it('candidate AFFIRM appends one CANDIDATE row; replay appends none', async () => {
    const target = await createTarget(h, 'conf_one', { ageBand: 'UNDER_14' });
    const { contextToken, attemptId } = await startBinding(
      h,
      target,
      `conf_one_${Date.now()}`
    );

    const replay = await candidateDecision(
      h,
      contextToken,
      'AFFIRM',
      `conf_replay_${Date.now()}`,
      'candidate-binding-v1'
    );
    expect(replay.statusCode).toBe(200);

    const { rows } = await h.admin.query(
      `SELECT count(*)::int AS cnt FROM binding_confirmations
       WHERE attempt_id = $1 AND kind = 'CANDIDATE'`,
      [attemptId]
    );
    expect(rows[0].cnt).toBe(1);
  });

  it('confirmation rows reject UPDATE and DELETE', async () => {
    const target = await createTarget(h, 'conf_imm', { ageBand: 'UNDER_14' });
    await startBinding(h, target, `conf_imm_${Date.now()}`);
    const { rows } = await h.admin.query(
      'SELECT id FROM binding_confirmations WHERE attempt_id = (SELECT id FROM binding_attempts WHERE target_person_id = $1 LIMIT 1)',
      [target.targetPersonId]
    );
    const id = rows[0].id as string;
    await expect(
      h.admin.query('UPDATE binding_confirmations SET recorded_at = now() WHERE id = $1', [id])
    ).rejects.toMatchObject({ code: '23514' });
    await expect(
      h.admin.query('DELETE FROM binding_confirmations WHERE id = $1', [id])
    ).rejects.toMatchObject({ code: '23514' });
  });

  it('cross-attempt reuse is structurally impossible (one row per attempt/kind)', async () => {
    const target = await createTarget(h, 'conf_cross', { ageBand: 'UNDER_14' });
    await startBinding(h, target, `conf_cross_${Date.now()}`);
    const { rows } = await h.admin.query(
      'SELECT id FROM binding_attempts WHERE target_person_id = $1 LIMIT 1',
      [target.targetPersonId]
    );
    const attemptId = rows[0].id as string;
    await expect(
      h.admin.query(
        `INSERT INTO binding_confirmations
           (attempt_id, kind, actor_pending_context_id, target_confirmed,
            candidate_recognized, statement_version)
         VALUES ($1, 'CANDIDATE', gen_random_uuid(), true, false, 'candidate-binding-v1')`,
        [attemptId]
      )
    ).rejects.toMatchObject({ code: '23505' });
  });
});