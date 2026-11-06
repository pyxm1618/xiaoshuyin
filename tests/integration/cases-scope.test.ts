/**
 * T031 — Scope guard (FR-018 / FR-020 / SC-008).
 *
 * Case Core exposes exactly three operations and nothing else; the database
 * contains no participant / evidence / formulation / safety / plan / task /
 * notification objects, and `cases` carries no content columns.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import { buildApp } from '../../apps/server/api/src/app.js';
import { createAdminPool } from '../setup/db.js';

let verifyPool: pg.Pool;

const FORBIDDEN_ROUTE_FRAGMENTS = [
  '/cases/current',
  '/pause',
  '/resume',
  '/switch-primary',
  '/close',
  '/recurrences',
  '/messages',
  '/assessments',
  '/participants',
  '/scene',
  '/problem-formulations',
  '/evidence',
  '/statements',
  '/observations',
];

const FORBIDDEN_TABLES = [
  'case_participants',
  'participation_invites',
  'assertions',
  'observations',
  'dialogue_messages',
  'problem_formulations',
  'scene_node_states',
  'scene_artifacts',
  'safety_states',
  'goals',
  'intervention_instances',
  'plan_versions',
  'tasks',
  'checkins',
  'reviews',
  'case_followup_schedules',
  'notifications',
  'notification_attempts',
  'ai_runs',
  'data_requests',
];

const FORBIDDEN_CASE_COLUMNS = [
  'title', 'summary', 'description', 'problem_description', 'problem_summary',
  'visibility', 'case_role', 'participant_id', 'deleted_at',
];

describe('Case scope guard (T031)', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
    verifyPool = createAdminPool();
  });

  afterAll(async () => {
    await verifyPool.end();
    await app.close();
  });

  it('exposes exactly the three frozen Case operations', () => {
    const routes = app.printRoutes({ commonPrefix: false });
    // Collection: POST + GET (+ implicit HEAD). Detail: GET (+ HEAD).
    expect(routes).toContain('/api/v1/cases (POST, GET, HEAD)');
    const caseBlock = routes.slice(routes.indexOf('/api/v1/cases'));
    expect(caseBlock).toContain('/:id (GET, HEAD)');
    // Exactly one Case subtree: no second `/cases/...` root line.
    const roots = routes.split('\n').filter((line) => line.includes('/api/v1/cases'));
    expect(roots.length).toBe(1);
  });

  it('does not register any out-of-scope Case route', () => {
    const routes = app.printRoutes({ commonPrefix: false });
    for (const fragment of FORBIDDEN_ROUTE_FRAGMENTS) {
      expect(routes, `route fragment ${fragment}`).not.toContain(fragment);
    }
  });

  it('unregistered Case sub-paths really 404 at runtime', async () => {
    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/wechat',
      payload: { code: `t031_${Date.now()}` },
    });
    const token = login.json().token as string;
    // `/cases/current` is not a registered route: it can only fall into the
    // `:id` parameter, where it is not a UUID and therefore a validation
    // error — never a Case payload.
    const current = await app.inject({
      method: 'GET',
      url: '/api/v1/cases/current',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(current.statusCode).toBe(422);
    expect(current.json().code).toBe('VALIDATION_ERROR');
    expect(JSON.stringify(current.json())).not.toMatch(/primary|phase|createdAt/);

    const nested = await app.inject({
      method: 'GET',
      url: '/api/v1/cases/x/switch-primary',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(nested.statusCode).toBe(404);
    const nestedBody = nested.json();
    for (const key of ['id', 'status', 'phase', 'primary', 'version', 'createdAt']) {
      expect(Object.keys(nestedBody)).not.toContain(key);
    }
  });

  it('database contains none of the out-of-scope tables', async () => {
    const { rows } = await verifyPool.query(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public'`
    );
    const names = rows.map((r: any) => r.tablename);
    for (const table of FORBIDDEN_TABLES) {
      expect(names, `forbidden table ${table}`).not.toContain(table);
    }
  });

  it('cases carries none of the forbidden content columns', async () => {
    const { rows } = await verifyPool.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'cases'`
    );
    const cols = rows.map((r: any) => r.column_name);
    for (const col of FORBIDDEN_CASE_COLUMNS) {
      expect(cols, `forbidden column ${col}`).not.toContain(col);
    }
  });

  it('case_events exposes only CASE_CREATED and no read-audit vocabulary', async () => {
    const { rows } = await verifyPool.query(`
      SELECT pg_get_constraintdef(oid) AS def
      FROM pg_constraint
      WHERE conrelid = 'case_events'::regclass AND contype = 'c'
    `);
    const text = rows.map((r: any) => r.def).join(' ');
    expect(text).toContain('CASE_CREATED');
    for (const forbidden of ['CASE_VIEWED', 'CASE_LISTED', 'CASE_ACCESSED']) {
      expect(text).not.toContain(forbidden);
    }
  });

  it('no access-log table exists', async () => {
    const { rows } = await verifyPool.query(
      `SELECT tablename FROM pg_tables
       WHERE schemaname = 'public' AND (tablename LIKE '%access%' OR tablename LIKE '%audit_log%')`
    );
    expect(rows).toEqual([]);
  });
});
