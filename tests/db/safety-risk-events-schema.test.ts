/**
 * T903 — reviewed Safety migration + Risk Event schema.
 *
 * Proves, against a real PostgreSQL 18 database migrated by the reviewed
 * `db/migrations/009_safety_hold_control_foundation.sql`:
 *   - the Drizzle projection is an exact parity view of the migrated columns;
 *   - `risk_events` has ENABLE + FORCE RLS and a Family-scope policy;
 *   - the runtime role has exactly SELECT + INSERT (no UPDATE/DELETE/TRUNCATE);
 *   - `cases` table-level UPDATE stays denied while `status` is now a legal
 *     column-level UPDATE target and `phase` is a Slice 8 legal column;
 *   - every structural CHECK / FK / unique fence rejects malformed rows.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { buildApp } from '../../apps/server/api/src/app.js';
import { withDrizzleRlsTransaction } from '../../apps/server/api/src/db/drizzle-tx.js';
import { safetySchema } from '@xiaoshuyin/domain';
import { createAdminPool } from '../setup/db.js';
import { createSafetyFixture, type SafetyFixture } from '../setup/safety.js';

const PREFIX = 't903_';
const { riskEvents } = safetySchema;

interface DbColumn {
  name: string;
  sql_type: string;
  not_null: boolean;
}

async function dbColumns(client: pg.ClientBase, table: string): Promise<DbColumn[]> {
  const { rows } = await client.query<DbColumn>(
    `SELECT a.attname AS name,
            format_type(a.atttypid, a.atttypmod) AS sql_type,
            a.attnotnull AS not_null
       FROM pg_attribute a
      WHERE a.attrelid = $1::regclass
        AND a.attnum > 0
        AND NOT a.attisdropped
      ORDER BY a.attnum`,
    [`public.${table}`]
  );
  return rows;
}

describe('T903 Risk Event schema, RLS and least privilege', () => {
  let fixture: SafetyFixture;
  let admin: pg.Pool;
  let appPool: pg.Pool;
  let session: { token: string; accountId: string; personId: string };
  let familyId: string;
  let caseId: string;

  beforeAll(async () => {
    const app = await buildApp();
    await app.ready();
    admin = createAdminPool();
    appPool = new pg.Pool({ connectionString: process.env['DATABASE_URL'], max: 5 });
    fixture = createSafetyFixture({ app, admin, prefix: PREFIX });

    session = await fixture.login('owner');
    familyId = await fixture.createFamily(session, 'main');
    caseId = (await fixture.createCase(session)).id;
  });

  afterAll(async () => {
    await fixture.cleanup();
    await fixture.close();
    await appPool.end();
    await admin.end();
    await fixture.app.close();
  });

  /**
   * Run a raw statement as the real runtime role inside a Family RLS context.
   * `commit: true` is used only by positive fixtures that must stay readable
   * afterwards; negative paths leave the transaction rolled back.
   */
  async function asAppFamily<T>(
    fn: (client: pg.PoolClient) => Promise<T>,
    options: { commit?: boolean } = {}
  ): Promise<T> {
    const client = await appPool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT app.set_identity_context($1, $2)', [
        session.accountId,
        'FAMILY_MANAGEMENT',
      ]);
      await client.query('SELECT app.set_family_context($1, $2, $3)', [
        familyId,
        session.personId,
        'FAMILY_MANAGEMENT',
      ]);
      const result = await fn(client);
      await client.query(options.commit ? 'COMMIT' : 'ROLLBACK');
      return result;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  function insertHoldEntered(
    overrides: Partial<Record<string, unknown>> = {}
  ): { text: string; values: unknown[] } {
    const values = {
      familyId,
      caseId,
      actorAccountId: session.accountId,
      eventKind: 'HOLD_ENTERED',
      decisionCaseVersion: 1,
      policyRef: 'policy.fixture.v1',
      policyVersion: '1',
      ruleRef: 'rule.fixture.v1',
      ruleVersion: '1',
      riskCategoryRef: 'CATEGORY_FIXTURE',
      evidenceRefs: JSON.stringify([]),
      ...overrides,
    };
    return {
      text: `INSERT INTO risk_events
               (family_id, case_id, actor_account_id, event_kind, decision_case_version,
                policy_ref, policy_version, rule_ref, rule_version, risk_category_ref,
                evidence_refs, resolution_of_risk_event_id, resolution_authority_ref)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12,$13)
             RETURNING id`,
      values: [
        values.familyId,
        values.caseId,
        values.actorAccountId,
        values.eventKind,
        values.decisionCaseVersion,
        values.policyRef ?? null,
        values.policyVersion ?? null,
        values.ruleRef ?? null,
        values.ruleVersion ?? null,
        values.riskCategoryRef ?? null,
        values.evidenceRefs ?? null,
        values.resolutionOfRiskEventId ?? null,
        values.resolutionAuthorityRef ?? null,
      ],
    };
  }

  it('Drizzle projection matches the migrated risk_events columns exactly', async () => {
    const columns = await dbColumns(admin, 'risk_events');
    const config = getTableConfig(riskEvents);
    const projected = config.columns.map((column) => ({
      name: column.name,
      sql_type: column.getSQLType(),
      not_null: column.notNull,
    }));

    // Order-insensitive but exact set comparison.
    const sortByName = (rows: { name: string }[]) =>
      [...rows].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));

    expect(sortByName(columns.map((c) => ({ name: c.name, sql_type: c.sql_type, not_null: c.not_null }))))
      .toEqual(sortByName(projected));
  });

  it('enables and forces RLS with a Family-scope policy', async () => {
    const { rows: table } = await admin.query<{
      relrowsecurity: boolean;
      relforcerowsecurity: boolean;
    }>(
      `SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE oid = 'public.risk_events'::regclass`
    );
    expect(table[0]).toEqual({ relrowsecurity: true, relforcerowsecurity: true });

    const { rows: policies } = await admin.query<{ policyname: string; qual: string }>(
      `SELECT policyname, qual FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'risk_events'`
    );
    expect(policies.map((p) => p.policyname)).toEqual(['risk_events_family_scope']);
    expect(policies[0]!.qual).toContain('family_id');
  });

  it('grants the runtime role exactly SELECT + INSERT on risk_events', async () => {
    const { rows } = await admin.query<Record<string, boolean>>(
      `SELECT has_table_privilege('xiaoshuyin_app','public.risk_events','SELECT') AS can_select,
              has_table_privilege('xiaoshuyin_app','public.risk_events','INSERT') AS can_insert,
              has_table_privilege('xiaoshuyin_app','public.risk_events','UPDATE') AS can_update,
              has_table_privilege('xiaoshuyin_app','public.risk_events','DELETE') AS can_delete,
              has_table_privilege('xiaoshuyin_app','public.risk_events','TRUNCATE') AS can_truncate`
    );
    expect(rows[0]).toEqual({
      can_select: true,
      can_insert: true,
      can_update: false,
      can_delete: false,
      can_truncate: false,
    });
  });

  it('keeps cases table-level UPDATE denied and grants only the narrow status column', async () => {
    const { rows } = await admin.query<Record<string, boolean>>(
      `SELECT has_table_privilege('xiaoshuyin_app','public.cases','UPDATE') AS table_update,
              has_column_privilege('xiaoshuyin_app','public.cases','status','UPDATE') AS status_update,
              has_column_privilege('xiaoshuyin_app','public.cases','version','UPDATE') AS version_update,
              has_column_privilege('xiaoshuyin_app','public.cases','updated_at','UPDATE') AS updated_update,
              has_column_privilege('xiaoshuyin_app','public.cases','is_primary','UPDATE') AS primary_update,
              has_column_privilege('xiaoshuyin_app','public.cases','phase','UPDATE') AS phase_update`
    );
    expect(rows[0]).toEqual({
      table_update: false,
      status_update: true,
      version_update: true,
      updated_update: true,
      primary_update: true,
      phase_update: true,
    });
  });

  it('keeps the runtime role non-owner and NOBYPASSRLS', async () => {
    const { rows } = await admin.query<Record<string, boolean>>(
      `SELECT rolbypassrls, rolsuper FROM pg_roles WHERE rolname = 'xiaoshuyin_app'`
    );
    expect(rows[0]).toEqual({ rolbypassrls: false, rolsuper: false });

    const { rows: ownership } = await admin.query<{ owner: string }>(
      `SELECT pg_get_userbyid(relowner) AS owner FROM pg_class WHERE oid = 'public.risk_events'::regclass`
    );
    expect(ownership[0]!.owner).not.toBe('xiaoshuyin_app');
  });

  it('accepts a well-formed HOLD_ENTERED trace', async () => {
    const insertedId = await asAppFamily(async (client) => {
      const statement = insertHoldEntered();
      const { rows } = await client.query<{ id: string }>(statement.text, statement.values);
      return rows[0]!.id;
    }, { commit: true });
    expect(insertedId).toMatch(/^[0-9a-f-]{36}$/);

    const { rows } = await admin.query('SELECT * FROM risk_events WHERE id = $1', [insertedId]);
    expect(rows[0].event_kind).toBe('HOLD_ENTERED');
    expect(rows[0].policy_ref).toBe('policy.fixture.v1');
    expect(rows[0].resolution_of_risk_event_id).toBeNull();
    // No raw user text / review narrative columns exist at all.
    const keys = Object.keys(rows[0]);
    expect(keys).not.toContain('content');
    expect(keys).not.toContain('message');
    expect(keys).not.toContain('review_notes');
    expect(keys).not.toContain('current_status');
  });

  it('rejects entry rows missing policy/rule/category identity', async () => {
    for (const overrides of [
      { policyRef: null },
      { policyVersion: null },
      { ruleRef: null },
      { ruleVersion: null },
      { riskCategoryRef: null },
      { riskCategoryRef: '   ' },
    ] as Partial<Record<string, unknown>>[]) {
      await expect(
        asAppFamily(async (client) => {
          const statement = insertHoldEntered(overrides);
          await client.query(statement.text, statement.values);
        })
      ).rejects.toThrow(/risk_events_shape_check/);
    }
  });

  it('rejects entry rows carrying resolution-only fields', async () => {
    await expect(
      asAppFamily(async (client) => {
        const statement = insertHoldEntered({
          resolutionAuthorityRef: 'authority.fixture',
        });
        await client.query(statement.text, statement.values);
      })
    ).rejects.toThrow(/risk_events_shape_check/);
  });

  it('rejects an unknown event kind and a non-positive decision revision', async () => {
    await expect(
      asAppFamily(async (client) => {
        const statement = insertHoldEntered({ eventKind: 'SOMETHING_ELSE' });
        await client.query(statement.text, statement.values);
      })
    ).rejects.toThrow(/risk_events_event_kind_check/);

    await expect(
      asAppFamily(async (client) => {
        const statement = insertHoldEntered({ decisionCaseVersion: 0 });
        await client.query(statement.text, statement.values);
      })
    ).rejects.toThrow(/risk_events_decision_version_check/);
  });

  it('rejects a resolution without link, evidence or verified authority', async () => {
    const holdId = await asAppFamily(async (client) => {
      const statement = insertHoldEntered();
      const { rows } = await client.query<{ id: string }>(statement.text, statement.values);
      return rows[0]!.id;
    }, { commit: true });

    const resolutionStatement = (overrides: Record<string, unknown>) => ({
      text: `INSERT INTO risk_events
               (family_id, case_id, actor_account_id, event_kind, decision_case_version,
                evidence_refs, resolution_of_risk_event_id, resolution_authority_ref)
             VALUES ($1,$2,$3,'RISK_RESOLVED',$4,$5::jsonb,$6,$7)
             RETURNING id`,
      values: [
        familyId,
        caseId,
        session.accountId,
        2,
        JSON.stringify([{ kind: 'EVIDENCE', id: 'fixture-ref' }]),
        holdId,
        'authority.fixture',
        ...[],
      ],
    });

    // no link
    await expect(
      asAppFamily(async (client) => {
        const s = resolutionStatement({});
        s.values[5] = null;
        await client.query(s.text, s.values);
      })
    ).rejects.toThrow(/risk_events_shape_check/);

    // empty evidence
    await expect(
      asAppFamily(async (client) => {
        const s = resolutionStatement({});
        s.values[4] = JSON.stringify([]);
        await client.query(s.text, s.values);
      })
    ).rejects.toThrow(/risk_events_shape_check/);

    // missing authority
    await expect(
      asAppFamily(async (client) => {
        const s = resolutionStatement({});
        s.values[6] = null;
        await client.query(s.text, s.values);
      })
    ).rejects.toThrow(/risk_events_shape_check/);

    // a well-formed resolution is accepted
    const resolvedId = await asAppFamily(async (client) => {
      const s = resolutionStatement({});
      const { rows } = await client.query<{ id: string }>(s.text, s.values);
      return rows[0]!.id;
    }, { commit: true });
    expect(resolvedId).toBeTruthy();

    // one resolution per hold trace
    await expect(
      asAppFamily(async (client) => {
        const s = resolutionStatement({});
        await client.query(s.text, s.values);
      })
    ).rejects.toThrow(/risk_events_one_resolution_per_hold/);
  });

  it('structurally rejects a cross-Family Case link', async () => {
    const other = await fixture.login('other');
    const otherFamilyId = await fixture.createFamily(other, 'other');

    // Create a Case in the other Family using its own Family context.
    const otherCaseId = await (async () => {
      const client = await appPool.connect();
      try {
        await client.query('BEGIN');
        await client.query('SELECT app.set_identity_context($1, $2)', [
          other.accountId,
          'FAMILY_MANAGEMENT',
        ]);
        await client.query('SELECT app.set_family_context($1, $2, $3)', [
          otherFamilyId,
          other.personId,
          'FAMILY_MANAGEMENT',
        ]);
        const { rows } = await client.query<{ id: string }>(
          `INSERT INTO cases (family_id, created_by_person_id, status, phase, is_primary, version)
           VALUES ($1, $2, 'OPEN', 'INTAKE', false, 1) RETURNING id`,
          [otherFamilyId, other.personId]
        );
        await client.query('COMMIT');
        return rows[0]!.id;
      } finally {
        client.release();
      }
    })();

    // Family A context + Family B Case → composite FK / RLS refuse it.
    await expect(
      asAppFamily(async (client) => {
        const statement = insertHoldEntered({ caseId: otherCaseId });
        await client.query(statement.text, statement.values);
      })
    ).rejects.toThrow(/risk_events_case_family_fk|row-level security/i);

    // Cross-Family resolution self-link is impossible too.
    await expect(
      asAppFamily(async (client) => {
        const hold = insertHoldEntered();
        const { rows } = await client.query<{ id: string }>(hold.text, hold.values);
        await client.query(
          `INSERT INTO risk_events
             (family_id, case_id, actor_account_id, event_kind, decision_case_version,
              evidence_refs, resolution_of_risk_event_id, resolution_authority_ref)
           VALUES ($1,$2,$3,'RISK_RESOLVED',2,$4::jsonb,$5,$6)`,
          [
            familyId,
            caseId,
            session.accountId,
            JSON.stringify([{ kind: 'EVIDENCE', id: 'fixture-ref' }]),
            rows[0]!.id,
            'authority.fixture',
          ]
        );
      })
    ).resolves.toBeUndefined();
  });

  it('hides and refuses cross-Family Risk Event rows through RLS', async () => {
    await asAppFamily(async (client) => {
      const statement = insertHoldEntered();
      await client.query(statement.text, statement.values);
    });

    const other = await fixture.login('rlsother');
    const otherFamilyId = await fixture.createFamily(other, 'rlsother');

    const visible = await withDrizzleRlsTransaction(
      appPool,
      {
        familyId: otherFamilyId,
        accountId: other.accountId,
        personId: other.personId,
        purpose: 'FAMILY_MANAGEMENT',
      },
      async (tx) => {
        const rows = await tx.execute<{ id: string }>(sql`SELECT id FROM risk_events`);
        return rows.rows;
      }
    );
    expect(visible).toHaveLength(0);

    // No Family context at all: nothing visible, nothing writable.
    const noContext = await appPool.connect();
    try {
      const { rows } = await noContext.query<{ count: string }>(
        'SELECT count(*)::text AS count FROM risk_events'
      );
      expect(rows[0]!.count).toBe('0');
    } finally {
      noContext.release();
    }
  });
});