/**
 * T730 — Case command scope (FR-020, plan D-14.1).
 *
 * Exactly four Case operations after this Slice:
 *   createCase / listCases / getCase / switchPrimaryCase.
 * Only `POST /api/v1/cases/{id}/switch-primary` is added; every other
 * out-of-scope path, table and `cases` column stays absent.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import pg from 'pg';
import { createAdminPool } from '../setup/db.js';

const spec = JSON.parse(
  readFileSync(new URL('../../packages/generated/openapi.json', import.meta.url), 'utf8')
);

describe('case primary switch scope (T730)', () => {
  let admin: pg.Pool;

  beforeAll(async () => {
    admin = createAdminPool();
  });

  afterAll(async () => {
    await admin.end();
  });

  it('registers exactly four Case operations', () => {
    const casePaths = Object.keys(spec.paths).filter((p) =>
      p === '/api/v1/cases' ||
      p === '/api/v1/cases/{id}' ||
      p === '/api/v1/cases/{id}/switch-primary'
    );
    expect(casePaths.sort()).toEqual([
      '/api/v1/cases',
      '/api/v1/cases/{id}',
      '/api/v1/cases/{id}/switch-primary',
    ]);
    const operations = casePaths.flatMap((p) =>
      Object.values(spec.paths[p]).map((op: any) => op.operationId)
    );
    expect(operations.sort()).toEqual([
      'createCase',
      'getCase',
      'listCases',
      'switchPrimaryCase',
    ]);
  });

  it('does not register any out-of-scope Case path', () => {
    const all = Object.keys(spec.paths).join('\n');
    for (const forbidden of [
      '/cases/current',
      '/cases/{id}/primary',
      '/cases/{id}/pause',
      '/cases/{id}/resume',
      '/cases/{id}/close',
      '/cases/{id}/recurrences',
      '/cases/{id}/assessments',
      '/cases/{id}/participants',
      '/cases/{id}/scene',
      '/cases/{id}/problem-formulations',
      '/cases/{id}/evidence',
      '/cases/{id}/statements',
      '/cases/{id}/observations',
    ]) {
      expect(all.includes(forbidden), forbidden).toBe(false);
    }
  });

  it('does not create out-of-scope tables or columns', async () => {
    const { rows: tables } = await admin.query(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public'`
    );
    const names = tables.map((r: any) => r.tablename);
    for (const forbidden of [
      'risk_events',
      'problem_formulations',
      'case_participants',
      'scene_node_states',
      'scene_artifacts',
      'referrals',
      'safety_states',
    ]) {
      expect(names, forbidden).not.toContain(forbidden);
    }

    const { rows: columns } = await admin.query(
      `SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'cases'`
    );
    const cols = columns.map((r: any) => r.column_name);
    for (const forbidden of [
      'switch_reason',
      'previous_primary_id',
      'primary_since',
      'switched_at',
      'title',
      'summary',
      'description',
    ]) {
      expect(cols, forbidden).not.toContain(forbidden);
    }
  });

  it('keeps exactly one primary index per Family', async () => {
    const { rows } = await admin.query(
      `SELECT count(*)::int c FROM pg_indexes WHERE indexname = 'cases_one_primary_open_per_family'`
    );
    expect(rows[0].c).toBe(1);
  });
});