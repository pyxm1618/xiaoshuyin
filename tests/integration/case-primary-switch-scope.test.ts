/**
 * T730 — Case command scope (FR-020, plan D-14.1 / D-14.2).
 *
 * Real current-main baseline: FOUR Case business operations
 *   createCase / listCases / getCase / createCaseMessage
 * Slice 7 adds EXACTLY ONE Case business operation:
 *   switchPrimaryCase
 * Final: FIVE Case business operations.
 *
 * `createParticipationInvite` is a real current-main Case path operation but is
 * NOT a Case business operation under the approved frozen Scope classification
 * (Slice 4). It stays in the real path set and is excluded by operationId only —
 * never by filtering `/messages` or any other genuine Case path.
 *
 * Slice 7 introduces no other Case business operation.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import pg from 'pg';
import { createAdminPool } from '../setup/db.js';

const spec = JSON.parse(
  readFileSync(new URL('../../packages/generated/openapi.json', import.meta.url), 'utf8')
);

const CASE_PATH_PREFIX = '/api/v1/cases';
const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const;

/** Existing current-main Case business operations (no Slice 7). */
const BASE_CASE_OPERATION_IDS = [
  'createCase',
  'listCases',
  'getCase',
  'createCaseMessage',
] as const;

/** The only Case business operation Slice 7 adds. */
const SLICE7_ADDED_OPERATION_IDS = ['switchPrimaryCase'] as const;

/** The four Case business operations Slice 8 adds. */
const SLICE8_ADDED_OPERATION_IDS = [
  'getCurrentProblemFormulation',
  'confirmProblemFormulation',
  'disputeProblemFormulation',
  'correctProblemFormulation',
] as const;

/** The four reviewed Slice 12 Case business operations. */
const SLICE12_ADDED_OPERATION_IDS = [
  'startDigitalUseAssessment',
  'getDigitalUseScene',
  'getDigitalUseSceneNode',
  'completeDigitalUseSceneNode',
] as const;

/** Real Case path operations that are not Case business operations. */
const NON_BUSINESS_OPERATION_IDS = ['createParticipationInvite'] as const;

/** Real Case paths on current main + Slice 7. */
const KNOWN_CASE_PATHS = [
  '/api/v1/cases',
  '/api/v1/cases/{id}',
  '/api/v1/cases/{id}/messages',
  '/api/v1/cases/{id}/participation-invites',
  '/api/v1/cases/{id}/switch-primary',
  '/api/v1/cases/{id}/problem-formulations/current',
  '/api/v1/cases/{id}/problem-formulations/{version}/confirm',
  '/api/v1/cases/{id}/problem-formulations/{version}/dispute',
  '/api/v1/cases/{id}/problem-formulations/{version}/corrections',
  '/api/v1/cases/{id}/assessments',
  '/api/v1/cases/{id}/scene',
  '/api/v1/cases/{id}/scene/nodes/{nodeCode}',
  '/api/v1/cases/{id}/scene/nodes/{nodeCode}/responses',
] as const;

interface OperationRef {
  method: string;
  path: string;
  operationId: string;
}

function casePathKeys(): string[] {
  return Object.keys(spec.paths).filter(
    (path) => path === CASE_PATH_PREFIX || path.startsWith(`${CASE_PATH_PREFIX}/`)
  );
}

function caseOperations(): OperationRef[] {
  const operations: OperationRef[] = [];
  for (const path of casePathKeys()) {
    const item = spec.paths[path] ?? {};
    for (const method of HTTP_METHODS) {
      const operation = item[method];
      if (operation?.operationId) {
        operations.push({ method: method.toUpperCase(), path, operationId: operation.operationId });
      }
    }
  }
  return operations;
}

describe('case primary switch scope (T730)', () => {
  let admin: pg.Pool;

  beforeAll(async () => {
    admin = createAdminPool();
  });

  afterAll(async () => {
    await admin.end();
  });

  it('keeps Base=4, Slice7=1, Slice8=4 and Slice12=4 as an exact 13-operation set', () => {
    // Path layer: every real Case path is present, and nothing unexpected was added.
    const paths = casePathKeys();
    expect(paths.sort()).toEqual([...KNOWN_CASE_PATHS].sort());
    expect(paths.filter((path) => !(KNOWN_CASE_PATHS as readonly string[]).includes(path))).toEqual(
      []
    );

    // Operation layer: collect every Case path operation by operationId.
    const operations = caseOperations();
    expect(operations.map((op) => `${op.method} ${op.path}`).sort()).toEqual(
      [
        'GET /api/v1/cases',
        'GET /api/v1/cases/{id}',
        'POST /api/v1/cases',
        'POST /api/v1/cases/{id}/messages',
        'POST /api/v1/cases/{id}/participation-invites',
        'POST /api/v1/cases/{id}/switch-primary',
        'GET /api/v1/cases/{id}/problem-formulations/current',
        'POST /api/v1/cases/{id}/problem-formulations/{version}/confirm',
        'POST /api/v1/cases/{id}/problem-formulations/{version}/dispute',
        'POST /api/v1/cases/{id}/problem-formulations/{version}/corrections',
        'POST /api/v1/cases/{id}/assessments',
        'GET /api/v1/cases/{id}/scene',
        'GET /api/v1/cases/{id}/scene/nodes/{nodeCode}',
        'POST /api/v1/cases/{id}/scene/nodes/{nodeCode}/responses',
      ].sort()
    );

    // The non-business operation must still be real; excluding it may not shrink
    // the path set into a false green.
    const nonBusiness = operations.filter((op) =>
      (NON_BUSINESS_OPERATION_IDS as readonly string[]).includes(op.operationId)
    );
    expect(nonBusiness.map((op) => `${op.method} ${op.path}`)).toEqual([
      'POST /api/v1/cases/{id}/participation-invites',
    ]);

    const businessOperationIds = operations
      .filter((op) => !(NON_BUSINESS_OPERATION_IDS as readonly string[]).includes(op.operationId))
      .map((op) => op.operationId)
      .sort();

    // Base = 4: every pre-Slice-7 business operation is really present.
    for (const base of BASE_CASE_OPERATION_IDS) {
      expect(businessOperationIds, `missing Base operation ${base}`).toContain(base);
    }
    expect(BASE_CASE_OPERATION_IDS).toHaveLength(4);

    // Final = 13, exact equality (contains/>= would hide an extra operation).
    expect(businessOperationIds).toEqual(
      [
        ...BASE_CASE_OPERATION_IDS,
        ...SLICE7_ADDED_OPERATION_IDS,
        ...SLICE8_ADDED_OPERATION_IDS,
        ...SLICE12_ADDED_OPERATION_IDS,
      ].sort()
    );
    expect(businessOperationIds).toHaveLength(13);

    // Slice 7 delta = exactly 1.
    const slice7Delta = businessOperationIds.filter(
      (id) =>
        !(BASE_CASE_OPERATION_IDS as readonly string[]).includes(id) &&
        !(SLICE8_ADDED_OPERATION_IDS as readonly string[]).includes(id) &&
        !(SLICE12_ADDED_OPERATION_IDS as readonly string[]).includes(id)
    );
    expect(slice7Delta).toEqual(['switchPrimaryCase']);
    expect(slice7Delta).toHaveLength(1);

    const slice8Delta = businessOperationIds.filter(
      (id) =>
        !(BASE_CASE_OPERATION_IDS as readonly string[]).includes(id) &&
        !(SLICE7_ADDED_OPERATION_IDS as readonly string[]).includes(id) &&
        !(SLICE12_ADDED_OPERATION_IDS as readonly string[]).includes(id)
    );
    expect(slice8Delta.sort()).toEqual([...SLICE8_ADDED_OPERATION_IDS].sort());
    expect(slice8Delta).toHaveLength(4);

    const slice12Delta = businessOperationIds.filter(
      (id) =>
        !(BASE_CASE_OPERATION_IDS as readonly string[]).includes(id) &&
        !(SLICE7_ADDED_OPERATION_IDS as readonly string[]).includes(id) &&
        !(SLICE8_ADDED_OPERATION_IDS as readonly string[]).includes(id) &&
        !(SLICE12_ADDED_OPERATION_IDS as readonly string[]).includes(id)
    );
    expect(slice12Delta.sort()).toEqual([...SLICE12_ADDED_OPERATION_IDS].sort());
    expect(slice12Delta).toHaveLength(4);

    // Unexpected Case business operations = 0.
    const unexpected = businessOperationIds.filter(
      (id) =>
        !(BASE_CASE_OPERATION_IDS as readonly string[]).includes(id) &&
        !(SLICE7_ADDED_OPERATION_IDS as readonly string[]).includes(id) &&
        !(SLICE8_ADDED_OPERATION_IDS as readonly string[]).includes(id)
    );
    expect(unexpected).toEqual([]);
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
      '/cases/{id}/participants',
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
      // `case_participants` (Slice 4), `problem_formulations` (Slice 8) and
      // `risk_events` (Slice 9) are approved tables. Slice 7's zero-schema
      // expansion proof lives in migration-repro / db:evidence.
      'referrals',
      'safety_states',
    ]) {
      expect(names, forbidden).not.toContain(forbidden);
    }
    // Slice 9 adds exactly one approved trace table.
    expect(names).toContain('risk_events');

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