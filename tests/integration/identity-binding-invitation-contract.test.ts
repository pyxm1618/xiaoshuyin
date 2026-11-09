/**
 * T098 contract-level invitation seam. 006 consumes only VALID /
 * TERMINAL_UNUSABLE from the Slice 4 contract. On this Slice 4 feature branch
 * the authoritative case_participants lifecycle now exists, but the production
 * adapter remains Slice 5 T121 post-merge work; 006 keeps no second model.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import {
  InMemoryInvitationPort,
  UnavailableInvitationPort,
} from '../../apps/server/api/src/identity-binding/invitation-port.js';
import {
  bootstrap,
  buildBindingApp,
  createTarget,
  type BindingHarness,
} from '../setup/identity-binding.js';

describe('contract-level invitation seam (T098)', () => {
  let h: BindingHarness;

  beforeAll(async () => {
    h = await buildBindingApp();
  });

  afterAll(async () => {
    await h.close();
  });

  it('port exposes only VALID and TERMINAL_UNUSABLE', async () => {
    const port = new InMemoryInvitationPort();
    const token = `contract_${randomUUID()}`;
    port.add(token, {
      status: 'VALID',
      participationId: randomUUID(),
      targetPersonId: randomUUID(),
      targetFamilyId: randomUUID(),
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    });

    const valid = await port.resolveByToken(undefined as never, token);
    expect(valid.status).toBe('VALID');
    const terminal = await port.resolveByToken(undefined as never, `missing_${randomUUID()}`);
    expect(terminal).toEqual({ status: 'TERMINAL_UNUSABLE' });
    expect(Object.keys(terminal)).toEqual(['status']);
  });

  it('UnavailableInvitationPort remains fail-closed until Slice 5 T121 post-merge wiring', async () => {
    const port = new UnavailableInvitationPort();
    expect(await port.resolveByToken(undefined as never, 'any')).toEqual({
      status: 'TERMINAL_UNUSABLE',
    });
    expect(await port.resolveByParticipationId(undefined as never, randomUUID())).toEqual({
      status: 'TERMINAL_UNUSABLE',
    });
  });

  it('invalid invitation creates a pending context + pre-attempt audit, no attempt', async () => {
    const target = await createTarget(h, 'inv_contract', { ageBand: 'UNDER_14' });
    h.port.remove(target.invitationToken);
    const code = `inv_contract_${randomUUID()}`;

    const res = await bootstrap(h, target.invitationToken, code);
    expect(res.statusCode).toBe(200);
    expect(res.json().binding).toBe('NOT_COMPLETED');
    expect(Object.keys(res.json()).sort()).toEqual(['binding', 'pendingContextToken']);

    const attempts = await h.admin.query(
      'SELECT count(*)::int AS n FROM binding_attempts WHERE target_person_id = $1',
      [target.targetPersonId]
    );
    expect(attempts.rows[0].n).toBe(0);

    const audit = await h.admin.query(
      `SELECT event_type, terminal_reason, target_person_id, target_family_id,
              invitation_participation_id
         FROM identity_binding_audit_events
        WHERE event_type = 'BINDING_GATE1_BLOCKED'
          AND terminal_reason = 'INVITATION_TERMINAL'
        ORDER BY occurred_at DESC LIMIT 1`
    );
    expect(audit.rows[0]).toMatchObject({
      event_type: 'BINDING_GATE1_BLOCKED',
      terminal_reason: 'INVITATION_TERMINAL',
      target_person_id: null,
      target_family_id: null,
      invitation_participation_id: null,
    });

    const contexts = await h.admin.query(
      'SELECT count(*)::int AS n FROM binding_pending_contexts'
    );
    expect(contexts.rows[0].n).toBeGreaterThan(0);
  });

  it('Slice 4 case_participants is the only invitation/participation lifecycle table', async () => {
    const tables = await h.admin.query(
      `SELECT tablename FROM pg_tables
        WHERE schemaname = 'public'
          AND (tablename LIKE '%invitation%' OR tablename LIKE '%participation%')
        ORDER BY tablename`
    );
    expect(tables.rows.map((r:any)=>r.tablename)).toEqual(['case_participants']);
  });
});