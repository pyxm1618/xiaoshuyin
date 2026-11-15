/**
 * AUTH-008 — minimum Staff capability / Case-assignment persistence and RLS
 * foundation.  This is authority infrastructure only; there is no Staff UI,
 * IAM platform, directory, or workflow in this suite.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { buildApp } from '../../apps/server/api/src/app.js';
import { createAdminPool } from '../setup/db.js';
import { createSafetyFixture, type ActorSession, type SafetyFixture } from '../setup/safety.js';

const PREFIX = 'auth008_db_';

describe('AUTH-008 staff authority foundation', () => {
  let fixture: SafetyFixture;
  let admin: pg.Pool;
  let owner: ActorSession;
  let staff: ActorSession;
  let familyId: string;
  let caseId: string;

  beforeAll(async () => {
    const app = await buildApp();
    await app.ready();
    admin = createAdminPool();
    fixture = createSafetyFixture({ app, admin, prefix: PREFIX });
    owner = await fixture.login('owner');
    staff = await fixture.login('staff');
    familyId = await fixture.createFamily(owner, 'main');
    caseId = (await fixture.createCase(owner)).id;
  });

  afterAll(async () => {
    await admin
      .query(
        `DELETE FROM staff_assignments
          WHERE account_id IN (
            SELECT id FROM accounts WHERE wechat_openid LIKE $1
          )`,
        [`${PREFIX}%`]
      )
      .catch(() => undefined);
    await fixture.cleanup();
    await fixture.close();
    await admin.end();
    await fixture.app.close();
  });

  async function privilege(privilege: string): Promise<boolean> {
    const result = await admin.query<{ has: boolean }>(
      `SELECT has_table_privilege('xiaoshuyin_app', 'staff_assignments', $1) AS has`,
      [privilege]
    );
    return result.rows[0]!.has;
  }

  async function insertGrant(
    actor: ActorSession,
    capability = 'SAFETY_RESOLVE',
    overrides: {
      validFrom?: Date;
      validUntil?: Date | null;
      revokedAt?: Date | null;
    } = {}
  ): Promise<string> {
    const result = await admin.query<{ id: string }>(
      `INSERT INTO staff_assignments
         (account_id, person_id, capability, scope_type,
          granted_by_account_id, granted_at, valid_from, valid_until,
          revoked_by_account_id, revoked_at)
       VALUES ($1, $2, $3, 'GLOBAL',
               $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [
        actor.accountId,
        actor.personId,
        capability,
        owner.accountId,
        overrides.validFrom ?? new Date(Date.now() - 60_000),
        overrides.validFrom ?? new Date(Date.now() - 60_000),
        overrides.validUntil ?? new Date(Date.now() + 60 * 60_000),
        overrides.revokedAt ? owner.accountId : null,
        overrides.revokedAt ?? null,
      ]
    );
    return result.rows[0]!.id;
  }

  async function insertAssignment(
    actor: ActorSession,
    grantId: string,
    targetCaseId: string,
    overrides: {
      capability?: string;
      validFrom?: Date;
      validUntil?: Date | null;
      revokedAt?: Date | null;
    } = {}
  ): Promise<string> {
    const target = await fixture.getCase(targetCaseId);
    const result = await admin.query<{ id: string }>(
      `INSERT INTO staff_assignments
         (account_id, person_id, capability, scope_type,
          family_id, case_id, capability_grant_id,
          granted_by_account_id, granted_at, valid_from, valid_until,
          revoked_by_account_id, revoked_at)
       VALUES ($1, $2, $3, 'CASE',
               $4, $5, $6,
               $7, $8, $9, $10, $11, $12)
       RETURNING id`,
      [
        actor.accountId,
        actor.personId,
        overrides.capability ?? 'SAFETY_RESOLVE',
        target.familyId,
        targetCaseId,
        grantId,
        owner.accountId,
        overrides.validFrom ?? new Date(Date.now() - 60_000),
        overrides.validFrom ?? new Date(Date.now() - 60_000),
        overrides.validUntil ?? new Date(Date.now() + 60 * 60_000),
        overrides.revokedAt ? owner.accountId : null,
        overrides.revokedAt ?? null,
      ]
    );
    return result.rows[0]!.id;
  }

  async function setStaffContext(
    actor: ActorSession,
    assignmentId: string,
    targetCaseId: string
  ): Promise<{
    familyId: string;
    familyContext: string | null;
    staffCaseId: string | null;
    visibleCaseIds: string[];
  }> {
    const client = await fixture.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`SELECT app.set_identity_context($1, 'SAFETY_RESOLUTION')`, [
        actor.accountId,
      ]);
      const context = await client.query<{ family_id: string }>(
        'SELECT app.set_staff_case_context($1, $2)::text AS family_id',
        [assignmentId, targetCaseId]
      );
      const gucs = await client.query<{
        family_id: string | null;
        staff_case_id: string | null;
      }>(
        `SELECT app_family_id()::text AS family_id,
                app_staff_case_id()::text AS staff_case_id`
      );
      const visible = await client.query<{ id: string }>(
        'SELECT id::text AS id FROM cases ORDER BY id'
      );
      await client.query('ROLLBACK');
      return {
        familyId: context.rows[0]!.family_id,
        familyContext: gucs.rows[0]!.family_id,
        staffCaseId: gucs.rows[0]!.staff_case_id,
        visibleCaseIds: visible.rows.map((row) => row.id),
      };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  it('is FORCE-RLS and runtime-read-only', async () => {
    const relation = await admin.query<{
      relrowsecurity: boolean;
      relforcerowsecurity: boolean;
      owner: string;
    }>(
      `SELECT c.relrowsecurity, c.relforcerowsecurity,
              pg_get_userbyid(c.relowner) AS owner
         FROM pg_class c
        WHERE c.oid = 'public.staff_assignments'::regclass`
    );
    expect(relation.rows[0]).toMatchObject({
      relrowsecurity: true,
      relforcerowsecurity: true,
      owner: 'xiaoshuyin_migrator',
    });

    expect(await privilege('SELECT')).toBe(true);
    for (const denied of ['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE']) {
      expect(await privilege(denied), denied).toBe(false);
    }
  });

  it('keeps the canonical capability vocabulary explicit and rejects ADMIN-style authority', async () => {
    const constraint = await admin.query<{ definition: string }>(
      `SELECT pg_get_constraintdef(oid) AS definition
         FROM pg_constraint
        WHERE conname = 'staff_assignments_capability_check'`
    );
    expect(constraint.rows).toHaveLength(1);
    const definition = constraint.rows[0]!.definition;
    for (const capability of [
      'PROFESSIONAL_REVIEW',
      'SAFETY_REVIEW',
      'SAFETY_RESOLVE',
      'DATA_RIGHTS',
      'QUALITY_REVIEW',
      'EXCEPTION_SUPPORT',
      'SERVICE_CONTROL',
    ]) {
      expect(definition).toContain(capability);
    }
    expect(definition).not.toContain('ADMIN');

    await expect(
      admin.query(
        `INSERT INTO staff_assignments
           (account_id, person_id, capability, scope_type, granted_by_account_id)
         VALUES ($1, $2, 'ADMIN', 'GLOBAL', $3)`,
        [staff.accountId, staff.personId, owner.accountId]
      )
    ).rejects.toMatchObject({ code: '23514' });
  });

  it('mechanically binds Staff Account and Person identity', async () => {
    await expect(
      admin.query(
        `INSERT INTO staff_assignments
           (account_id, person_id, capability, scope_type, granted_by_account_id)
         VALUES ($1, $2, 'SAFETY_RESOLVE', 'GLOBAL', $3)`,
        [staff.accountId, owner.personId, owner.accountId]
      )
    ).rejects.toMatchObject({ code: '23503' });
  });

  it('does not require or manufacture household membership and remains exact-Case scoped', async () => {
    const membership = await admin.query(
      'SELECT 1 FROM family_members WHERE family_id = $1 AND person_id = $2',
      [familyId, staff.personId]
    );
    expect(membership.rowCount).toBe(0);

    const sibling = await fixture.createCase(owner);
    const grantId = await insertGrant(staff);
    const assignmentId = await insertAssignment(staff, grantId, caseId);
    const context = await setStaffContext(staff, assignmentId, caseId);

    expect(context.familyId).toBe(familyId);
    expect(context.familyContext).toBeNull();
    expect(context.staffCaseId).toBe(caseId);
    expect(context.visibleCaseIds).toEqual([caseId]);
    expect(context.visibleCaseIds).not.toContain(sibling.id);

    const forged = await fixture.pool.connect();
    try {
      await forged.query('BEGIN');
      await forged.query(`SELECT app.set_identity_context($1, 'SAFETY_RESOLUTION')`, [
        staff.accountId,
      ]);
      await forged.query(
        `SELECT set_config('app.staff_case_id', $1, true)`,
        [sibling.id]
      );
      const visible = await forged.query<{ count: string }>(
        'SELECT count(*)::text AS count FROM cases WHERE id = $1',
        [sibling.id]
      );
      expect(visible.rows[0]!.count).toBe('0');
      await forged.query('ROLLBACK');
    } finally {
      forged.release();
    }
  });

  it('mechanically rejects invalid CASE-to-GLOBAL authority graphs and accepts the valid graph', async () => {
    const validGrant = await insertGrant(staff);
    const validAssignment = await insertAssignment(staff, validGrant, caseId);
    expect(validAssignment).toBeTruthy();

    const reviewGrant = await insertGrant(staff, 'SAFETY_REVIEW');
    await expect(
      insertAssignment(staff, reviewGrant, caseId, { capability: 'SAFETY_RESOLVE' })
    ).rejects.toMatchObject({ code: '23503' });

    const ownerGrant = await insertGrant(owner);
    await expect(
      insertAssignment(staff, ownerGrant, caseId)
    ).rejects.toMatchObject({ code: '23503' });

    await expect(
      admin.query(
        `INSERT INTO staff_assignments
           (account_id, person_id, capability, scope_type,
            family_id, case_id, capability_grant_id,
            granted_by_account_id, valid_from, valid_until)
         VALUES ($1, $2, 'SAFETY_RESOLVE', 'CASE',
                 $3, $4, $5, $6, clock_timestamp() - interval '1 minute',
                 clock_timestamp() + interval '1 hour')`,
        [
          staff.accountId,
          owner.personId,
          familyId,
          caseId,
          validGrant,
          owner.accountId,
        ]
      )
    ).rejects.toMatchObject({ code: '23503' });

    const sibling = await fixture.createCase(owner);
    await expect(
      insertAssignment(staff, validAssignment, sibling.id)
    ).rejects.toMatchObject({ code: '23503' });
  });

  it('the Staff RLS context refuses another Case and revoked/expired/inactive authority', async () => {
    const another = await fixture.createCase(owner);

    {
      const grantId = await insertGrant(staff);
      const assignmentId = await insertAssignment(staff, grantId, another.id);
      await expect(setStaffContext(staff, assignmentId, caseId)).rejects.toMatchObject({
        code: '42501',
      });
    }

    for (const state of ['revoked', 'expired', 'inactive'] as const) {
      const now = Date.now();
      const grantId = await insertGrant(staff);
      const assignmentId = await insertAssignment(staff, grantId, caseId, {
        ...(state === 'revoked'
          ? { revokedAt: new Date(now - 30_000) }
          : state === 'expired'
            ? {
                validFrom: new Date(now - 2 * 60_000),
                validUntil: new Date(now - 60_000),
              }
            : {
                validFrom: new Date(now + 60_000),
                validUntil: new Date(now + 2 * 60_000),
              }),
      });
      await expect(setStaffContext(staff, assignmentId, caseId)).rejects.toMatchObject({
        code: '42501',
      });
    }
  });

  it('persists who granted/revoked the capability/assignment and when', async () => {
    const revokedAt = new Date();
    const grantId = await insertGrant(staff);
    const assignmentId = await insertAssignment(staff, grantId, caseId, { revokedAt });
    const row = await admin.query(
      `SELECT capability, scope_type, family_id, case_id, capability_grant_id,
              granted_by_account_id, granted_at, valid_from, valid_until,
              revoked_by_account_id, revoked_at
         FROM staff_assignments
        WHERE id = $1`,
      [assignmentId]
    );
    expect(row.rows[0]).toMatchObject({
      capability: 'SAFETY_RESOLVE',
      scope_type: 'CASE',
      family_id: familyId,
      case_id: caseId,
      capability_grant_id: grantId,
      granted_by_account_id: owner.accountId,
      revoked_by_account_id: owner.accountId,
    });
    expect(row.rows[0].granted_at).toBeTruthy();
    expect(row.rows[0].valid_from).toBeTruthy();
    expect(row.rows[0].valid_until).toBeTruthy();
    expect(row.rows[0].revoked_at).toBeTruthy();
  });
});
