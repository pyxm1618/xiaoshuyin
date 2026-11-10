/**
 * T098 contract-level invitation seam + T121 production Slice 4 adapter.
 *
 * 006 consumes only VALID / TERMINAL_UNUSABLE from Slice 4. The production
 * implementation `Slice4InvitationPort` reads real `case_participants` facts
 * under Slice 4 RLS; 006 keeps no second invitation model and writes no
 * participation state.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import {
  InMemoryInvitationPort,
  UnavailableInvitationPort,
} from '../../apps/server/api/src/identity-binding/invitation-port.js';
import { Slice4InvitationPort } from '../../apps/server/api/src/identity-binding/invitation-slice4-adapter.js';
import {
  bootstrap,
  buildBindingApp,
  createAppPool,
  createTarget,
  type BindingHarness,
} from '../setup/identity-binding.js';
import {
  buildParticipationApp,
  createParticipationFixture,
  invite,
  type ParticipationHarness,
} from '../setup/participation.js';

const TERMINAL = { status: 'TERMINAL_UNUSABLE' };

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

  it('explicit fail-closed port stays TERMINAL_UNUSABLE', async () => {
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
          AND (tablename LIKE '%invitation%' OR tablename LIKE '%participation%' OR tablename LIKE '%participant%')
        ORDER BY tablename`
    );
    expect(tables.rows.map((r:any)=>r.tablename)).toEqual(['case_participants']);
  });
});

describe('production Slice 4 invitation adapter (T121)', () => {
  let h: ParticipationHarness;
  let pool: pg.Pool;
  const port = new Slice4InvitationPort();

  beforeAll(async () => {
    // No injected port: buildApp wires the production Slice4InvitationPort.
    h = await buildParticipationApp();
    pool = createAppPool(2);
  });

  afterAll(async () => {
    await pool.end();
    await h.close();
  });

  it('resolves the real pending invitation token and re-resolves it by trusted target', async () => {
    const f = await createParticipationFixture(h, 't121-resolve', {
      target: 'member',
      ageBand: 'MINOR_14_17',
    });
    const created = await invite(
      h.app,
      f.manager.token,
      f.caseId,
      f.targetPersonId,
      `t121-invite-${randomUUID()}`
    );
    expect(created.statusCode).toBe(201);
    const participationId = created.json().participationId as string;
    const invitationToken = created.json().inviteToken as string;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const byToken = await port.resolveByToken(client, invitationToken);
      expect(byToken).toMatchObject({
        status: 'VALID',
        participationId,
        targetPersonId: f.targetPersonId,
        targetFamilyId: f.familyId,
      });
      expect(new Date(byToken.status === 'VALID' ? byToken.expiresAt : '').getTime())
        .toBeGreaterThan(Date.now());

      // No binding target facts: Gate 2-style resolution fails closed.
      expect(await port.resolveByParticipationId(client, participationId)).toEqual(TERMINAL);

      // Same transaction with the exact binding target context resolves from
      // the authoritative Slice 4 row (family-scoped RLS).
      await client.query('SELECT app.set_binding_gate_context($1, $2, $3, $4)', [
        f.targetPersonId,
        f.familyId,
        participationId,
        null,
      ]);
      expect(await port.resolveByParticipationId(client, participationId)).toMatchObject({
        status: 'VALID',
        participationId,
        targetPersonId: f.targetPersonId,
        targetFamilyId: f.familyId,
      });

      // The adapter must not leave the token credential or family scope open.
      const restored = await client.query(
        `SELECT COALESCE(current_setting('app.invite_token_hash', true), '') AS token,
                COALESCE(current_setting('app.family_id', true), '') AS family`
      );
      expect(restored.rows[0]).toEqual({ token: '', family: '' });

      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  });

  it('missing token, unknown participation and expired invitation are TERMINAL_UNUSABLE', async () => {
    const f = await createParticipationFixture(h, 't121-terminal', {
      target: 'member',
      ageBand: 'MINOR_14_17',
    });
    const created = await invite(
      h.app,
      f.manager.token,
      f.caseId,
      f.targetPersonId,
      `t121-terminal-invite-${randomUUID()}`
    );
    expect(created.statusCode).toBe(201);

    await h.admin.query(
      `UPDATE case_participants
          SET created_at = now() - interval '2 hours',
              invite_expires_at = now() - interval '1 hour'
        WHERE id = $1`,
      [created.json().participationId]
    );

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      expect(await port.resolveByToken(client, `missing_${randomUUID()}`)).toEqual(TERMINAL);
      expect(await port.resolveByParticipationId(client, randomUUID())).toEqual(TERMINAL);
      expect(await port.resolveByToken(client, created.json().inviteToken)).toEqual(TERMINAL);
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }

    const row = await h.admin.query(
      'SELECT state FROM case_participants WHERE id = $1',
      [created.json().participationId]
    );
    expect(row.rows[0].state).toBe('PENDING');
  });
});