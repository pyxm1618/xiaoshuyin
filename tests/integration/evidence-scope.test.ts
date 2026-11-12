/**
 * T029 / T059 — Slice 3 scope guard.
 *
 * Enumerates the real database, routes and production exports; requires the
 * approved three tables / one route / four writers and forbids every future
 * Slice object. RED before the Slice 3 objects exist.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { existsSync } from 'node:fs';
import pg from 'pg';
import { buildApp } from '../../apps/server/api/src/app.js';
import { createAdminPool } from '../setup/db.js';
import * as domain from '../../packages/domain/src/index.js';

let verifyPool: pg.Pool;
let app: Awaited<ReturnType<typeof buildApp>>;

const APPROVED_TABLES = ['assertions', 'dialogue_messages', 'observations'];

const FORBIDDEN_TABLES = [
  'evidence_items',
  'participation_invites',
  'assessments',
  'scene_node_states',
  'scene_artifacts',
  'safety_states',
  'goals',
  'intervention_instances',
  'plan_versions',
  'plans',
  'tasks',
  'checkins',
  'reviews',
  'case_followup_schedules',
  'notifications',
  'notification_attempts',
  'ai_runs',
  'data_requests',
];

const FORBIDDEN_FRAGMENTS = [
  '/assertions',
  '/observations',
  '/evidence',
  '/facts',
  '/fact',
  '/assessments',
  '/scene',
  '/participants',
];

const FORBIDDEN_EXPORTS = [
  'recordFact',
  'createFact',
  'confirmFact',
  'promoteToFact',
  'updateAssertionKind',
  'createAssertion',
  'createEvidence',
  'extractEvidence',
  'runExtraction',
];

describe('Evidence scope guard (T029)', () => {
  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
    verifyPool = createAdminPool();
  });

  afterAll(async () => {
    await verifyPool.end();
    await app.close();
  });

  it('database contains exactly the three approved Slice 3 tables and no future object', async () => {
    const { rows } = await verifyPool.query(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public'`
    );
    const names = rows.map((r: any) => r.tablename);
    for (const table of APPROVED_TABLES) {
      expect(names, `missing approved table ${table}`).toContain(table);
    }
    for (const table of FORBIDDEN_TABLES) {
      expect(names, `forbidden table ${table}`).not.toContain(table);
    }
    const evidenceLike = names.filter((n: string) => /evidence|assert|observ|dialogue/i.test(n));
    expect(evidenceLike.sort()).toEqual(APPROVED_TABLES);
  });

  it('routes expose one new message POST and no generic Evidence / FACT endpoint', () => {
    const routes = app.printRoutes({ commonPrefix: false });
    expect(routes).toContain('/messages (POST)');
    for (const fragment of FORBIDDEN_FRAGMENTS) {
      expect(routes, `route fragment ${fragment}`).not.toContain(fragment);
    }
  });

  it('production exports contain the four writers and no forbidden capability', () => {
    for (const name of [
      'recordStatement',
      'recordHypothesis',
      'recordObservation',
      'assignConflictGroup',
    ]) {
      expect(typeof (domain as any)[name], name).toBe('function');
    }
    for (const name of FORBIDDEN_EXPORTS) {
      expect((domain as any)[name], name).toBeUndefined();
    }
  });

  it('no AI / RAG / Memory / Notification / Participant package or app exists', () => {
    for (const path of [
      'packages/ai',
      'packages/rag',
      'packages/memory',
      'packages/notifications',

      'apps/miniprogram',
      'apps/operations',
    ]) {
      expect(existsSync(path), path).toBe(false);
    }
  });

  it('evidence tables carry no future placeholder columns', async () => {
    const { rows } = await verifyPool.query(
      `SELECT table_name, column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = ANY($1::text[])`,
      [APPROVED_TABLES]
    );
    const names = rows.map((r: any) => r.column_name);
    for (const forbidden of [
      'winner',
      'rank',
      'confidence',
      'majority',
      'embedding',
      'scene_node',
      'participant',
      'deleted_at',
      'fact_confirmed_at',
    ]) {
      expect(names, forbidden).not.toContain(forbidden);
    }
  });
});