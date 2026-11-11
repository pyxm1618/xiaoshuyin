/**
 * T914 — Safety integration matrix across the real application surface.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import { buildApp } from '../../apps/server/api/src/app.js';
import { createAdminPool } from '../setup/db.js';
import { createSafetyFixture, type SafetyFixture } from '../setup/safety.js';

const PREFIX = 't914_';

describe('T914 Safety integration matrix', () => {
  let fixture: SafetyFixture;
  let admin: pg.Pool;
  let owner: { token: string; accountId: string; personId: string };
  let seq = 0;

  beforeAll(async () => {
    const app = await buildApp();
    await app.ready();
    admin = createAdminPool();
    fixture = createSafetyFixture({ app, admin, prefix: PREFIX });
    owner = await fixture.login('owner');
    await fixture.createFamily(owner, 'main');
  });

  afterAll(async () => {
    await fixture.cleanup();
    await fixture.close();
    await admin.end();
    await fixture.app.close();
  });

  async function makeOnlyPrimary(caseId: string): Promise<void> {
    const row = await fixture.getCase(caseId);
    // Two ordered statements inside one transaction: demote first (0 primary is
    // a legal intermediate state for the partial unique index), then promote.
    const client = await admin.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        'UPDATE cases SET is_primary = false WHERE family_id = $1 AND is_primary',
        [row.familyId]
      );
      await client.query('UPDATE cases SET is_primary = true WHERE id = $1', [caseId]);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  function switchPrimary(targetId: string, expectedPrimary: { caseId: string; version: number } | null) {
    return fixture.app.inject({
      method: 'POST',
      url: `/api/v1/cases/${targetId}/switch-primary`,
      headers: {
        authorization: `Bearer ${owner.token}`,
        'idempotency-key': `t914-sw-${Date.now()}-${seq++}`,
      },
      payload: {
        reason: 'safety regression',
        expectedPrimaryCaseId: expectedPrimary?.caseId ?? null,
        expectedPrimaryVersion: expectedPrimary?.version ?? null,
      },
    });
  }

  it('SwitchPrimaryCase cannot promote a held target', async () => {
    const current = await fixture.createCase(owner);
    const target = await fixture.createCase(owner);
    await makeOnlyPrimary(current.id);
    await fixture.setCaseStatus(target.id, 'SAFETY_HOLD');
    const heldTarget = await fixture.getCase(target.id);
    const currentRow = await fixture.getCase(current.id);

    const res = await switchPrimary(heldTarget.id, {
      caseId: currentRow.id,
      version: currentRow.version,
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().code).toBe('SAFETY_HOLD_BLOCKED');

    // No-write semantics preserved.
    const afterCurrent = await fixture.getCase(current.id);
    const afterTarget = await fixture.getCase(target.id);
    expect(afterCurrent.isPrimary).toBe(true);
    expect(afterCurrent.version).toBe(currentRow.version);
    expect(afterTarget.isPrimary).toBe(false);
    expect(afterTarget.version).toBe(heldTarget.version);
  });

  it('SwitchPrimaryCase cannot switch away from a held current primary', async () => {
    const current = await fixture.createCase(owner);
    const target = await fixture.createCase(owner);
    await makeOnlyPrimary(current.id);
    await fixture.setCaseStatus(current.id, 'SAFETY_HOLD');
    const heldCurrent = await fixture.getCase(current.id);

    const res = await switchPrimary(target.id, {
      caseId: heldCurrent.id,
      version: heldCurrent.version,
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().code).toBe('SAFETY_HOLD_BLOCKED');

    expect((await fixture.getCase(current.id)).isPrimary).toBe(true);
    expect((await fixture.getCase(target.id)).isPrimary).toBe(false);
  });

  it('keeps closed-over-hold precedence unchanged', async () => {
    const current = await fixture.createCase(owner);
    const target = await fixture.createCase(owner);
    await makeOnlyPrimary(current.id);
    await fixture.setCaseStatus(target.id, 'CLOSED');
    const closedTarget = await fixture.getCase(target.id);
    const currentRow = await fixture.getCase(current.id);

    const res = await switchPrimary(closedTarget.id, {
      caseId: currentRow.id,
      version: currentRow.version,
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().code).toBe('CASE_CLOSED');
  });

  it('does not globally block reads or evidence capture while held', async () => {
    const created = await fixture.createCase(owner);
    await fixture.setCaseStatus(created.id, 'SAFETY_HOLD');

    const read = await fixture.app.inject({
      method: 'GET',
      url: `/api/v1/cases/${created.id}`,
      headers: { authorization: `Bearer ${owner.token}` },
    });
    expect(read.statusCode).toBe(200);
    expect(read.json().status).toBe('SAFETY_HOLD');

    const message = await fixture.app.inject({
      method: 'POST',
      url: `/api/v1/cases/${created.id}/messages`,
      headers: {
        authorization: `Bearer ${owner.token}`,
        'idempotency-key': `t914-msg-${Date.now()}-${seq++}`,
      },
      payload: { content: 'evidence while held' },
    });
    expect(message.statusCode).toBe(201);
  });

  it('exposes no public Safety mutation route or OpenAPI path', async () => {
    const routes = fixture.app.printRoutes({ commonPrefix: false });
    for (const forbidden of ['/safety', '/enter-hold', '/resolve-risk', '/hold']) {
      expect(routes).not.toContain(forbidden);
    }
    const spec = fixture.app.swagger?.() as { paths?: Record<string, unknown> } | undefined;
    if (spec?.paths) {
      for (const path of Object.keys(spec.paths)) {
        expect(path).not.toMatch(/safety|resolve-risk|enter-hold/i);
      }
    }
  });

  it('has no AI/system principal entry point', async () => {
    const res = await fixture.app.inject({
      method: 'POST',
      url: '/api/v1/cases/00000000-0000-0000-0000-000000000000/resolve-risk',
      headers: { 'x-system-principal': 'ai', authorization: 'Bearer none' },
      payload: { resolved: true },
    });
    // The path does not exist at all: no model/system route is registered.
    expect([404, 401]).toContain(res.statusCode);
    expect(res.body).not.toContain('WAITING');
  });
});