/**
 * AUTH-006 forward-migration regression for Problem Formulation review state.
 *
 * Historical 008 remains immutable. This test applies the historical
 * Problem Formulation schema first, then exercises 020 directly so the
 * reconstruction cases are mechanical:
 *   - legacy lifecycle=NEEDS_REVIEW rows recover PRESENTED / DISPUTED /
 *     CONFIRMED from persisted authoritative facts and keep review=NEEDS_REVIEW;
 *   - contradictory history aborts atomically before any row or schema change.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from 'pg';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ADMIN_URL = process.env['TEST_ADMIN_DATABASE_URL']!;
const MIGRATION_URL = process.env['MIGRATION_DATABASE_URL']!;
const ROOT = new URL('../..', import.meta.url).pathname;

const PRE_AUTH006_MIGRATIONS = [
  '001_initial_schema.sql',
  '002_case_core.sql',
  '003_case_idempotency_key_bytes.sql',
  '004_evidence_core.sql',
  '004_identity_binding_runtime.sql',
  '005_case_participant_core.sql',
  '006_case_status_paused_removal.sql',
  '007_case_primary_switch.sql',
  '008_problem_formulation_core.sql',
] as const;

const AUTH006_MIGRATION = '020_problem_formulation_review_state.sql';
const CORRECTION_AT = '2026-01-01T03:04:05.000Z';
const CONFIRMED_AT = '2026-01-02T03:04:05.000Z';

function urlForDatabase(baseUrl: string, database: string): string {
  const url = new URL(baseUrl);
  url.pathname = `/${database}`;
  return url.toString();
}

async function applySqlFile(client: Client, filename: string): Promise<void> {
  const sql = readFileSync(join(ROOT, 'db', 'migrations', filename), 'utf8');
  await client.query('BEGIN');
  try {
    await client.query(sql);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  }
}

async function enumLabels(client: Client, typeName: string): Promise<string[]> {
  const { rows } = await client.query(
    `SELECT e.enumlabel
       FROM pg_enum e
       JOIN pg_type t ON t.oid = e.enumtypid
       JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = 'public' AND t.typname = $1
      ORDER BY e.enumsortorder`,
    [typeName]
  );
  return rows.map((row: any) => row.enumlabel);
}

interface SeedOptions {
  status: 'PRESENTED' | 'NEEDS_REVIEW';
  userResponse?: Record<string, unknown> | null;
  confirmationAudit?: boolean;
}

interface SeededFormulation {
  id: string;
  caseId: string;
  familyId: string;
  accountId: string;
  personId: string;
}

async function seedProblemFormulation(
  client: Client,
  options: SeedOptions
): Promise<SeededFormulation> {
  const suffix = `${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
  const { rows: account } = await client.query(
    'INSERT INTO accounts (wechat_openid) VALUES ($1) RETURNING id',
    [`auth006_migration_${suffix}`]
  );
  const accountId = account[0].id;
  const { rows: person } = await client.query(
    'INSERT INTO persons (account_id, created_by_account_id) VALUES ($1, $1) RETURNING id',
    [accountId]
  );
  const personId = person[0].id;
  const { rows: family } = await client.query(
    'INSERT INTO families (display_name, created_by_person_id) VALUES ($1, $2) RETURNING id',
    [`AUTH006 migration ${suffix}`, personId]
  );
  const familyId = family[0].id;
  await client.query(
    'INSERT INTO family_members (family_id, person_id) VALUES ($1, $2)',
    [familyId, personId]
  );
  const { rows: kase } = await client.query(
    `INSERT INTO cases
       (family_id, created_by_person_id, status, phase, is_primary, version)
     VALUES ($1, $2, 'OPEN', 'PROBLEM_FORMULATION', true, 1)
     RETURNING id`,
    [familyId, personId]
  );
  const caseId = kase[0].id;
  const evidenceId = '11111111-1111-4111-8111-111111111111';
  const { rows: formulation } = await client.query(
    `INSERT INTO problem_formulations
       (family_id, case_id, version, status, primary_problem, key_factors,
        evidence_refs, unknowns, conflicts, scene_fit, alternative_explanations,
        reassessment_conditions, exit_conditions, user_response,
        confirmed_by_person_id, confirmed_at, dependency_refs, supersedes_version)
     VALUES
       ($1, $2, 1, $3,
        $4::jsonb, '[]'::jsonb, $5::jsonb, '[]'::jsonb, '[]'::jsonb,
        'AUTH006_MIGRATION', '[]'::jsonb, '[]'::jsonb, '[]'::jsonb,
        $6::jsonb, NULL, NULL, $7::jsonb, NULL)
     RETURNING id`,
    [
      familyId,
      caseId,
      options.status,
      JSON.stringify({
        text: 'legacy formulation',
        evidenceRefs: [{ type: 'ASSERTION', id: evidenceId }],
      }),
      JSON.stringify([{ type: 'ASSERTION', id: evidenceId }]),
      options.userResponse === undefined
        ? null
        : options.userResponse === null
          ? null
          : JSON.stringify(options.userResponse),
      JSON.stringify([
        {
          type: 'EVIDENCE',
          evidence: { type: 'ASSERTION', id: evidenceId },
        },
      ]),
    ]
  );
  const formulationId = formulation[0].id;

  if (options.confirmationAudit) {
    await client.query(
      `INSERT INTO business_audit_events
         (family_id, actor_account_id, event_type, resource_type, resource_id,
          metadata, occurred_at)
       VALUES ($1, $2, 'CASE_PROBLEM_FORMULATION_CONFIRMED',
               'PROBLEM_FORMULATION', $3, $4::jsonb, $5)`,
      [
        familyId,
        accountId,
        formulationId,
        JSON.stringify({
          formulationVersion: 1,
          fromStatus: 'PRESENTED',
          toStatus: 'CONFIRMED',
          fromPhase: 'PROBLEM_FORMULATION',
          toPhase: 'GOALS',
          version: 2,
        }),
        CONFIRMED_AT,
      ]
    );
  }

  return { id: formulationId, caseId, familyId, accountId, personId };
}

type CorrectionTerminal = 'PRESENTED' | 'DISPUTED' | 'CONFIRMED';

async function insertLifecycleEvent(
  client: Client,
  input: SeededFormulation,
  formulationId: string,
  eventType:
    | 'CASE_PROBLEM_FORMULATION_CORRECTED'
    | 'CASE_PROBLEM_FORMULATION_DISPUTED'
    | 'CASE_PROBLEM_FORMULATION_CONFIRMED',
  metadata: Record<string, unknown>,
  occurredAt: string
): Promise<void> {
  await client.query(
    `INSERT INTO case_events
       (family_id, case_id, actor_account_id, event_type, metadata, occurred_at)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6)`,
    [input.familyId, input.caseId, input.accountId, eventType, JSON.stringify(metadata), occurredAt]
  );
  await client.query(
    `INSERT INTO business_audit_events
       (family_id, actor_account_id, event_type, resource_type, resource_id,
        metadata, occurred_at)
     VALUES ($1, $2, $3, 'PROBLEM_FORMULATION', $4, $5::jsonb, $6)`,
    [input.familyId, input.accountId, eventType, formulationId, JSON.stringify(metadata), occurredAt]
  );
}

async function seedCorrectionCreatedLegacy(
  client: Client,
  terminal: CorrectionTerminal
): Promise<SeededFormulation & { v1Id: string; version: 2; dependencyRefs: unknown }> {
  const base = await seedProblemFormulation(client, {
    status: 'PRESENTED',
    userResponse: null,
  });
  await client.query(
    `UPDATE problem_formulations
        SET status = 'SUPERSEDED', updated_at = now()
      WHERE id = $1`,
    [base.id]
  );

  const userResponse =
    terminal === 'PRESENTED'
      ? { kind: 'CORRECTION', respondedAt: CORRECTION_AT }
      : terminal === 'DISPUTED'
        ? { kind: 'DISPUTE', respondedAt: CONFIRMED_AT }
        : { kind: 'CONFIRM', respondedAt: CONFIRMED_AT };

  const { rows } = await client.query(
    `INSERT INTO problem_formulations
       (family_id, case_id, version, status, primary_problem, key_factors,
        evidence_refs, unknowns, conflicts, scene_fit, alternative_explanations,
        reassessment_conditions, exit_conditions, user_response,
        confirmed_by_person_id, confirmed_at, dependency_refs, supersedes_version)
     SELECT family_id, case_id, 2, 'NEEDS_REVIEW', primary_problem, key_factors,
            evidence_refs, unknowns, conflicts, scene_fit, alternative_explanations,
            reassessment_conditions, exit_conditions, $2::jsonb,
            NULL, NULL, dependency_refs, 1
       FROM problem_formulations
      WHERE id = $1
     RETURNING id, dependency_refs`,
    [base.id, JSON.stringify(userResponse)]
  );
  const v2Id = rows[0].id as string;

  await insertLifecycleEvent(
    client,
    base,
    v2Id,
    'CASE_PROBLEM_FORMULATION_CORRECTED',
    {
      fromFormulationVersion: 1,
      toFormulationVersion: 2,
      fromStatus: 'PRESENTED',
      toStatus: 'PRESENTED',
      version: 2,
    },
    CORRECTION_AT
  );

  if (terminal === 'DISPUTED') {
    await insertLifecycleEvent(
      client,
      base,
      v2Id,
      'CASE_PROBLEM_FORMULATION_DISPUTED',
      {
        formulationVersion: 2,
        fromStatus: 'PRESENTED',
        toStatus: 'DISPUTED',
        version: 3,
      },
      CONFIRMED_AT
    );
  } else if (terminal === 'CONFIRMED') {
    await insertLifecycleEvent(
      client,
      base,
      v2Id,
      'CASE_PROBLEM_FORMULATION_CONFIRMED',
      {
        formulationVersion: 2,
        fromStatus: 'PRESENTED',
        toStatus: 'CONFIRMED',
        fromPhase: 'PROBLEM_FORMULATION',
        toPhase: 'GOALS',
        version: 3,
      },
      CONFIRMED_AT
    );
  }

  return {
    ...base,
    id: v2Id,
    v1Id: base.id,
    version: 2,
    dependencyRefs: rows[0].dependency_refs,
  };
}

async function lifecycleHistoryCounts(
  client: Client,
  caseId: string
): Promise<{ caseEvents: number; auditEvents: number }> {
  const caseEvents = await client.query(
    `SELECT count(*)::int AS count
       FROM case_events
      WHERE case_id = $1
        AND event_type IN (
          'CASE_PROBLEM_FORMULATION_CORRECTED',
          'CASE_PROBLEM_FORMULATION_DISPUTED',
          'CASE_PROBLEM_FORMULATION_CONFIRMED'
        )`,
    [caseId]
  );
  const auditEvents = await client.query(
    `SELECT count(*)::int AS count
       FROM business_audit_events
      WHERE resource_type = 'PROBLEM_FORMULATION'
        AND event_type IN (
          'CASE_PROBLEM_FORMULATION_CORRECTED',
          'CASE_PROBLEM_FORMULATION_DISPUTED',
          'CASE_PROBLEM_FORMULATION_CONFIRMED'
        )
        AND resource_id IN (
          SELECT id FROM problem_formulations WHERE case_id = $1
        )`,
    [caseId]
  );
  return {
    caseEvents: caseEvents.rows[0].count,
    auditEvents: auditEvents.rows[0].count,
  };
}

async function formulationFacts(
  client: Client,
  id: string
): Promise<Record<string, unknown>> {
  const { rows } = await client.query(
    `SELECT id,
            version,
            status::text AS status,
            review_state::text AS review_state,
            confirmed_by_person_id,
            confirmed_at,
            supersedes_version,
            dependency_refs
       FROM problem_formulations
      WHERE id = $1`,
    [id]
  );
  return rows[0];
}

describe('AUTH-006 Problem Formulation review-state migration', () => {
  let admin: Client;
  const databases: string[] = [];

  beforeAll(async () => {
    admin = new Client({ connectionString: ADMIN_URL });
    await admin.connect();
  }, 60_000);

  afterAll(async () => {
    for (const database of databases) {
      await admin.query(
        'SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()',
        [database]
      ).catch(() => {});
      await admin.query(`DROP DATABASE IF EXISTS "${database}"`).catch(() => {});
    }
    await admin.end().catch(() => {});
  }, 120_000);

  async function prepare(prefix: string): Promise<{ database: string; migrator: Client; seed: Client }> {
    const database = `xiaoshuyin_auth006_${prefix}_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
    await admin.query(`CREATE DATABASE "${database}" OWNER xiaoshuyin_migrator`);
    databases.push(database);

    const migrator = new Client({ connectionString: urlForDatabase(MIGRATION_URL, database) });
    const seed = new Client({ connectionString: urlForDatabase(ADMIN_URL, database) });
    await migrator.connect();
    await seed.connect();
    for (const filename of PRE_AUTH006_MIGRATIONS) {
      await applySqlFile(migrator, filename);
    }
    return { database, migrator, seed };
  }

  it('reconstructs correction-created v2 PRESENTED and preserves version/history/dependencies', async () => {
    const { migrator, seed } = await prepare('correction-presented');
    try {
      const legacy = await seedCorrectionCreatedLegacy(seed, 'PRESENTED');
      const beforeHistory = await lifecycleHistoryCounts(seed, legacy.caseId);
      await applySqlFile(migrator, AUTH006_MIGRATION);

      expect(await formulationFacts(seed, legacy.id)).toMatchObject({
        id: legacy.id,
        version: 2,
        status: 'PRESENTED',
        review_state: 'NEEDS_REVIEW',
        confirmed_by_person_id: null,
        confirmed_at: null,
        supersedes_version: 1,
        dependency_refs: legacy.dependencyRefs,
      });
      expect(await lifecycleHistoryCounts(seed, legacy.caseId)).toEqual(beforeHistory);
      const v1 = await seed.query(
        'SELECT status::text AS status FROM problem_formulations WHERE id = $1',
        [legacy.v1Id]
      );
      expect(v1.rows[0]).toEqual({ status: 'SUPERSEDED' });
    } finally {
      await migrator.end();
      await seed.end();
    }
  }, 180_000);

  it('reconstructs correction-created v2 DISPUTED from later lifecycle history', async () => {
    const { migrator, seed } = await prepare('correction-disputed');
    try {
      const legacy = await seedCorrectionCreatedLegacy(seed, 'DISPUTED');
      const beforeHistory = await lifecycleHistoryCounts(seed, legacy.caseId);
      await applySqlFile(migrator, AUTH006_MIGRATION);

      expect(await formulationFacts(seed, legacy.id)).toMatchObject({
        id: legacy.id,
        version: 2,
        status: 'DISPUTED',
        review_state: 'NEEDS_REVIEW',
        confirmed_by_person_id: null,
        confirmed_at: null,
        supersedes_version: 1,
        dependency_refs: legacy.dependencyRefs,
      });
      expect(await lifecycleHistoryCounts(seed, legacy.caseId)).toEqual(beforeHistory);
    } finally {
      await migrator.end();
      await seed.end();
    }
  }, 180_000);

  it('reconstructs correction-created v2 CONFIRMED from later lifecycle history and preserves confirmation metadata', async () => {
    const { migrator, seed } = await prepare('correction-confirmed');
    try {
      const legacy = await seedCorrectionCreatedLegacy(seed, 'CONFIRMED');
      const beforeHistory = await lifecycleHistoryCounts(seed, legacy.caseId);
      await applySqlFile(migrator, AUTH006_MIGRATION);

      const facts = await formulationFacts(seed, legacy.id);
      expect(facts).toMatchObject({
        id: legacy.id,
        version: 2,
        status: 'CONFIRMED',
        review_state: 'NEEDS_REVIEW',
        confirmed_by_person_id: legacy.personId,
        supersedes_version: 1,
        dependency_refs: legacy.dependencyRefs,
      });
      expect(new Date(facts['confirmed_at'] as string).toISOString()).toBe(CONFIRMED_AT);
      expect(await lifecycleHistoryCounts(seed, legacy.caseId)).toEqual(beforeHistory);
    } finally {
      await migrator.end();
      await seed.end();
    }
  }, 180_000);

  it('recovers an unambiguous PRESENTED legacy row and keeps NEEDS_REVIEW', async () => {
    const { migrator, seed } = await prepare('presented');
    try {
      const legacy = await seedProblemFormulation(seed, {
        status: 'NEEDS_REVIEW',
        userResponse: null,
      });
      await applySqlFile(migrator, AUTH006_MIGRATION);

      expect(await formulationFacts(seed, legacy.id)).toMatchObject({
        status: 'PRESENTED',
        review_state: 'NEEDS_REVIEW',
        confirmed_by_person_id: null,
        confirmed_at: null,
      });
    } finally {
      await migrator.end();
      await seed.end();
    }
  }, 180_000);

  it('recovers an unambiguous DISPUTED legacy row and keeps NEEDS_REVIEW', async () => {
    const { migrator, seed } = await prepare('disputed');
    try {
      const legacy = await seedProblemFormulation(seed, {
        status: 'NEEDS_REVIEW',
        userResponse: { kind: 'DISPUTE', respondedAt: CONFIRMED_AT },
      });
      await applySqlFile(migrator, AUTH006_MIGRATION);

      expect(await formulationFacts(seed, legacy.id)).toMatchObject({
        status: 'DISPUTED',
        review_state: 'NEEDS_REVIEW',
        confirmed_by_person_id: null,
        confirmed_at: null,
      });
    } finally {
      await migrator.end();
      await seed.end();
    }
  }, 180_000);

  it('recovers CONFIRMED from an authoritative confirmation audit and preserves confirmer facts', async () => {
    const { migrator, seed } = await prepare('confirmed');
    try {
      const legacy = await seedProblemFormulation(seed, {
        status: 'NEEDS_REVIEW',
        userResponse: { kind: 'CONFIRM', respondedAt: CONFIRMED_AT },
        confirmationAudit: true,
      });
      await applySqlFile(migrator, AUTH006_MIGRATION);

      const facts = await formulationFacts(seed, legacy.id);
      expect(facts).toMatchObject({
        status: 'CONFIRMED',
        review_state: 'NEEDS_REVIEW',
        confirmed_by_person_id: legacy.personId,
      });
      expect(new Date(facts['confirmed_at'] as string).toISOString()).toBe(
        CONFIRMED_AT
      );
    } finally {
      await migrator.end();
      await seed.end();
    }
  }, 180_000);

  it('fails closed atomically when legacy history is contradictory', async () => {
    const { migrator, seed } = await prepare('ambiguous');
    try {
      const legacy = await seedProblemFormulation(seed, {
        status: 'NEEDS_REVIEW',
        userResponse: { kind: 'DISPUTE', respondedAt: CONFIRMED_AT },
        confirmationAudit: true,
      });
      const before = await seed.query(
        'SELECT status::text AS status FROM problem_formulations WHERE id = $1',
        [legacy.id]
      );
      expect(before.rows[0].status).toBe('NEEDS_REVIEW');

      const sql = readFileSync(join(ROOT, 'db', 'migrations', AUTH006_MIGRATION), 'utf8');
      await migrator.query('BEGIN');
      let error: unknown;
      try {
        await migrator.query(sql);
      } catch (caught) {
        error = caught;
      }
      expect(error).toBeDefined();
      expect(String((error as any)?.message ?? error)).toContain(
        'AUTH006_AMBIGUOUS_LEGACY_NEEDS_REVIEW rows=1'
      );
      await migrator.query('ROLLBACK');

      expect(await enumLabels(seed, 'problem_formulation_status')).toEqual([
        'DRAFT', 'PRESENTED', 'CONFIRMED', 'DISPUTED', 'NEEDS_REVIEW', 'SUPERSEDED',
      ]);
      expect(await enumLabels(seed, 'problem_formulation_review_state')).toEqual([]);
      const column = await seed.query(
        `SELECT column_name
           FROM information_schema.columns
          WHERE table_name = 'problem_formulations' AND column_name = 'review_state'`
      );
      expect(column.rows).toEqual([]);
      const after = await seed.query(
        'SELECT status::text AS status FROM problem_formulations WHERE id = $1',
        [legacy.id]
      );
      expect(after.rows[0].status).toBe('NEEDS_REVIEW');
    } finally {
      await migrator.end();
      await seed.end();
    }
  }, 180_000);

  it('preserves legal lifecycle and installs independent CURRENT / NEEDS_REVIEW storage', async () => {
    const { migrator, seed } = await prepare('upgrade');
    try {
      const current = await seedProblemFormulation(seed, {
        status: 'PRESENTED',
        userResponse: null,
      });
      await applySqlFile(migrator, AUTH006_MIGRATION);

      expect(await enumLabels(seed, 'problem_formulation_status')).toEqual([
        'DRAFT', 'PRESENTED', 'CONFIRMED', 'DISPUTED', 'SUPERSEDED',
      ]);
      expect(await enumLabels(seed, 'problem_formulation_review_state')).toEqual([
        'CURRENT', 'NEEDS_REVIEW',
      ]);

      expect(await formulationFacts(seed, current.id)).toMatchObject({
        status: 'PRESENTED',
        review_state: 'CURRENT',
      });

      const privilege = await seed.query(
        `SELECT
           has_type_privilege('xiaoshuyin_app', 'problem_formulation_review_state', 'USAGE') AS type_usage,
           has_column_privilege('xiaoshuyin_app', 'problem_formulations', 'review_state', 'UPDATE') AS review_update`
      );
      expect(privilege.rows[0]).toEqual({
        type_usage: true,
        review_update: true,
      });

      await expect(
        seed.query("SELECT 'NEEDS_REVIEW'::problem_formulation_status")
      ).rejects.toThrow(/invalid input value for enum problem_formulation_status/);
    } finally {
      await migrator.end();
      await seed.end();
    }
  }, 180_000);
});