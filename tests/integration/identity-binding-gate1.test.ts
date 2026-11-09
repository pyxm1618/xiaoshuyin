/**
 * T053 — Gate 1 blocks before any Phase B attempt: ADULT / UNKNOWN /
 * multi-family / terminal invitation. No Account, Person, session or attempt.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  bootstrap,
  buildBindingApp,
  createTarget,
  type BindingHarness,
} from '../setup/identity-binding.js';

describe('Gate 1 blocked branches', () => {
  let h: BindingHarness;

  beforeAll(async () => {
    h = await buildBindingApp();
  });

  afterAll(async () => {
    await h.close();
  });

  async function expectBlocked(label: string, invitationToken: string): Promise<void> {
    const code = `gate1_${label}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const res = await bootstrap(h, invitationToken, code);
    expect(res.statusCode).toBe(200);
    expect(res.json().binding).toBe('NOT_COMPLETED');
    expect(Object.keys(res.json()).sort()).toEqual(['binding', 'pendingContextToken']);

    const accounts = await h.admin.query(
      'SELECT count(*)::int AS n FROM accounts WHERE wechat_openid = $1',
      [`fake_${code}`]
    );
    expect(accounts.rows[0].n).toBe(0);
  }

  it('ADULT is NOT SUPPORTED', async () => {
    const target = await createTarget(h, 'gate1_adult', { ageBand: 'ADULT' });
    await expectBlocked('adult', target.invitationToken);
    const attempts = await h.admin.query(
      'SELECT count(*)::int AS n FROM binding_attempts WHERE target_person_id = $1',
      [target.targetPersonId]
    );
    expect(attempts.rows[0].n).toBe(0);
  });

  it('UNKNOWN is BLOCK', async () => {
    const target = await createTarget(h, 'gate1_unknown', { ageBand: 'UNKNOWN' });
    await expectBlocked('unknown', target.invitationToken);
    const attempts = await h.admin.query(
      'SELECT count(*)::int AS n FROM binding_attempts WHERE target_person_id = $1',
      [target.targetPersonId]
    );
    expect(attempts.rows[0].n).toBe(0);
  });

  it('multi-family P1 is BLOCK', async () => {
    const guardian2 = await createTarget(h, 'gate1_other_family', { ageBand: 'MINOR_14_17' });
    const target = await createTarget(h, 'gate1_multi', {
      ageBand: 'MINOR_14_17',
      extraFamilyIds: [guardian2.familyId],
    });
    await expectBlocked('multi', target.invitationToken);
    const attempts = await h.admin.query(
      'SELECT count(*)::int AS n FROM binding_attempts WHERE target_person_id = $1',
      [target.targetPersonId]
    );
    expect(attempts.rows[0].n).toBe(0);
  });

  it('terminal invitation is generic and writes no target association', async () => {
    const target = await createTarget(h, 'gate1_terminal', { ageBand: 'UNDER_14' });
    h.port.remove(target.invitationToken);
    await expectBlocked('terminal', target.invitationToken);

    const audit = await h.admin.query(
      `SELECT event_type, target_person_id, target_family_id, invitation_participation_id
         FROM identity_binding_audit_events
        WHERE event_type = 'BINDING_GATE1_BLOCKED'
        ORDER BY occurred_at DESC LIMIT 1`
    );
    expect(audit.rows[0].event_type).toBe('BINDING_GATE1_BLOCKED');
    expect(audit.rows[0].target_person_id).toBeNull();
    expect(audit.rows[0].target_family_id).toBeNull();
    expect(audit.rows[0].invitation_participation_id).toBeNull();
  });
});