/**
 * Audit sink: append-only, runtime write-only, no secret / PII.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import {
  buildBindingApp,
  createAppPool,
  createTarget,
  bootstrap,
  startBinding,
  confirmerDecision,
  type BindingHarness,
} from '../setup/identity-binding.js';

describe('identity binding audit', () => {
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

  it('records bootstrap / attempt / candidate / second-party / committed outcomes', async () => {
    const target = await createTarget(h, 'audit_ok', { ageBand: 'UNDER_14' });
    const { attemptId } = await startBinding(h, target, `audit_ok_${Date.now()}`);
    const confirm = await confirmerDecision(h, target.guardian.token, attemptId, {
      personId: target.targetPersonId,
      decision: 'AFFIRM',
    });
    expect(confirm.json().state).toBe('COMMITTED');

    const { rows } = await h.admin.query(
      'SELECT event_type, result FROM identity_binding_audit_events WHERE attempt_id = $1 ORDER BY occurred_at',
      [attemptId]
    );
    const events = rows.map((r) => `${r.event_type}:${r.result}`);
    expect(events).toEqual(
      expect.arrayContaining([
        'BINDING_ATTEMPT_CREATED:PENDING',
        'BINDING_CANDIDATE_CONFIRMED:PENDING',
        'BINDING_SECOND_PARTY_CONFIRMED:PENDING',
        'BINDING_COMMITTED:COMMITTED',
      ])
    );
  });

  it('runtime role cannot SELECT audit; UPDATE / DELETE are rejected', async () => {
    const { rows } = await h.admin.query('SELECT id FROM identity_binding_audit_events LIMIT 1');
    const id = rows[0].id as string;

    await expect(
      appPool.query('SELECT count(*) FROM identity_binding_audit_events')
    ).rejects.toMatchObject({ code: '42501' });
    await expect(
      h.admin.query('UPDATE identity_binding_audit_events SET result = result WHERE id = $1', [id])
    ).rejects.toMatchObject({ code: '23514' });
    await expect(
      h.admin.query('DELETE FROM identity_binding_audit_events WHERE id = $1', [id])
    ).rejects.toMatchObject({ code: '23514' });
  });

  it('Phase A blocks have no target person / family / invitation association', async () => {
    const target = await createTarget(h, 'audit_block', { ageBand: 'ADULT' });
    const res = await bootstrap(h, target.invitationToken, `audit_block_${Date.now()}`);
    expect(res.statusCode).toBe(200);
    expect(res.json().binding).toBe('NOT_COMPLETED');

    const { rows } = await h.admin.query(
      `SELECT target_person_id, target_family_id, invitation_participation_id,
              terminal_reason, candidate_identity_digest
       FROM identity_binding_audit_events
       WHERE event_type = 'BINDING_GATE1_BLOCKED'
       ORDER BY occurred_at DESC LIMIT 1`
    );
    expect(rows[0].target_person_id).toBeNull();
    expect(rows[0].target_family_id).toBeNull();
    expect(rows[0].invitation_participation_id).toBeNull();
    expect(rows[0].terminal_reason).toBe('AGE_BAND_ADULT_UNSUPPORTED');
    expect(rows[0].candidate_identity_digest).toMatch(/^[0-9a-f]{64}$/);
  });

  it('invalid invitation is audited without target association', async () => {
    const res = await bootstrap(h, `missing_${Date.now()}`, `audit_inv_${Date.now()}`);
    expect(res.statusCode).toBe(200);
    const { rows } = await h.admin.query(
      `SELECT target_person_id, target_family_id, invitation_participation_id, terminal_reason
       FROM identity_binding_audit_events
       WHERE event_type = 'BINDING_GATE1_BLOCKED'
       ORDER BY occurred_at DESC LIMIT 1`
    );
    expect(rows[0]).toEqual({
      target_person_id: null,
      target_family_id: null,
      invitation_participation_id: null,
      terminal_reason: 'INVITATION_TERMINAL',
    });
  });

  it('audit content contains no token / openid / ciphertext', async () => {
    const { rows } = await h.admin.query(
      `SELECT event_type, terminal_reason, metadata::text AS metadata
       FROM identity_binding_audit_events`
    );
    const text = JSON.stringify(rows);
    expect(text).not.toContain('fake_');
    expect(text).not.toContain('pendingContextToken');
    expect(text).not.toContain('openid_ciphertext');
    expect(text).not.toContain('wechat_openid');
  });
});