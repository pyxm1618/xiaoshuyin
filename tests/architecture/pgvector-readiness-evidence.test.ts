import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  classifyPgvectorReadiness,
  isPinnedPgvectorImageRef,
} from '../../scripts/lib/pgvector-readiness.mjs';

const IMAGE =
  'pgvector/pgvector:0.8.7-pg18-trixie@sha256:5895949dfcdf308eb0cd31c950c93c14895c77f33fbedfecf1fa511ab1d4bcd2';

const expected = {
  stage: 'STAGE_A',
  environment_kind: 'CI_INTEGRATION',
  environment_id: 'github:pyxm1618/xiaoshuyin:123:1:integration',
  repository_commit: 'a'.repeat(40),
  workflow_run_id: '123',
  workflow_run_attempt: '1',
  image_ref: IMAGE,
  pgvector_version: '0.8.7',
};

function evidence(overrides: Record<string, any> = {}) {
  const base: Record<string, any> = {
    probe_mode: 'REAL_DATABASE',
    environment_reachable: true,
    ...expected,
    postgres: { version: '18.6', version_num: '180006', major: 18 },
    pgvector: {
      available: true,
      installed: true,
      version: '0.8.7',
      extension_owner: 'postgres',
      setup_result: 'ENABLED',
    },
    security: {
      runtime_role: 'xiaoshuyin_app',
      runtime_superuser: false,
      runtime_bypassrls: false,
      runtime_public_schema_create: false,
      runtime_business_table_owner: false,
      extension_owner: 'postgres',
    },
    probe: {
      vector_type: true,
      insert: true,
      readback: true,
      distance_query: true,
      distance_order: true,
      temporary_cleanup: true,
    },
  };
  return {
    ...base,
    ...overrides,
    postgres: { ...base.postgres, ...(overrides.postgres ?? {}) },
    pgvector: { ...base.pgvector, ...(overrides.pgvector ?? {}) },
    security: { ...base.security, ...(overrides.security ?? {}) },
    probe: { ...base.probe, ...(overrides.probe ?? {}) },
  };
}

function expectResult(
  sample: Record<string, any>,
  status: string,
  reason?: string,
  expectedIdentity: Record<string, any> = expected,
) {
  const result = classifyPgvectorReadiness(sample, expectedIdentity);
  expect(result.status).toBe(status);
  if (reason) expect(result.reasons).toContain(reason);
}

describe('Slice 19 pgvector readiness failure semantics', () => {
  it('accepts only an explicit semantic pgvector PG18 tag plus immutable digest', () => {
    expect(isPinnedPgvectorImageRef(IMAGE)).toBe(true);
    expect(isPinnedPgvectorImageRef('pgvector/pgvector:latest')).toBe(false);
    expect(isPinnedPgvectorImageRef('pgvector/pgvector:0.8.7-pg18-trixie')).toBe(false);
    expect(isPinnedPgvectorImageRef('postgres:18@sha256:' + 'a'.repeat(64))).toBe(false);
  });

  it.each([
    ['PostgreSQL 17', { postgres: { major: 17 } }, 'BLOCKED', 'POSTGRES_MAJOR_MISMATCH'],
    ['PostgreSQL version unknown', { postgres: { version: '', version_num: null, major: null } }, 'UNKNOWN', 'POSTGRES_VERSION_UNKNOWN'],
    ['extension unavailable', { pgvector: { available: false, installed: false } }, 'UNAVAILABLE', 'PGVECTOR_NOT_AVAILABLE'],
    ['extension not enabled', { pgvector: { installed: false, setup_result: 'NOT_ENABLED' } }, 'BLOCKED', 'PGVECTOR_NOT_ENABLED'],
    ['extension setup denied', { pgvector: { installed: false, setup_result: 'DENIED' } }, 'BLOCKED', 'PGVECTOR_ENABLE_FAILED'],
    ['extension version unknown', { pgvector: { version: null } }, 'UNKNOWN', 'PGVECTOR_VERSION_UNKNOWN'],
    ['vector type failure', { probe: { vector_type: false } }, 'BLOCKED', 'VECTOR_TYPE_UNAVAILABLE'],
    ['insert failure', { probe: { insert: false } }, 'BLOCKED', 'VECTOR_INSERT_FAILED'],
    ['read mismatch', { probe: { readback: false } }, 'BLOCKED', 'VECTOR_READBACK_FAILED'],
    ['distance execution failure', { probe: { distance_query: false } }, 'BLOCKED', 'VECTOR_DISTANCE_QUERY_FAILED'],
    ['wrong distance ordering', { probe: { distance_order: false } }, 'BLOCKED', 'VECTOR_DISTANCE_ORDER_MISMATCH'],
    ['environment unreachable', { environment_reachable: false }, 'UNKNOWN', 'ENVIRONMENT_UNREACHABLE'],
    ['MOCK probe mode', { probe_mode: 'MOCK' }, 'BLOCKED', 'PROBE_MODE_INVALID'],
    ['runtime superuser', { security: { runtime_superuser: true } }, 'BLOCKED', 'ROLE_OR_PERMISSION_INVALID'],
    ['runtime BYPASSRLS', { security: { runtime_bypassrls: true } }, 'BLOCKED', 'ROLE_OR_PERMISSION_INVALID'],
    ['runtime schema CREATE', { security: { runtime_public_schema_create: true } }, 'BLOCKED', 'ROLE_OR_PERMISSION_INVALID'],
    ['partial success', { probe: { insert: false, readback: false } }, 'BLOCKED', 'VECTOR_INSERT_FAILED'],
  ])('%s remains non-READY with a specific semantic', (_name, patch, status, reason) => {
    expectResult(evidence(patch as Record<string, any>), status as string, reason as string);
  });

  it('missing exact Head is incomplete and wrong Head is stale evidence', () => {
    expectResult(evidence({ repository_commit: '' }), 'BLOCKED', 'EVIDENCE_INCOMPLETE');

    const wrong = evidence({ repository_commit: 'b'.repeat(40) });
    expectResult(wrong, 'BLOCKED', 'EVIDENCE_IDENTITY_MISMATCH');
  });

  it('floating image and missing digest cannot produce READY', () => {
    const floating = evidence({ image_ref: 'pgvector/pgvector:0.8.7-pg18-bookworm' });
    expectResult(
      floating,
      'BLOCKED',
      'IMAGE_REFERENCE_NOT_IMMUTABLE',
      { ...expected, image_ref: undefined },
    );
  });

  it('wrong stage and wrong environment reject stale evidence', () => {
    expectResult(evidence({ stage: 'STAGE_B' }), 'BLOCKED', 'EVIDENCE_IDENTITY_MISMATCH');
    expectResult(
      evidence({ environment_id: 'github:pyxm1618/xiaoshuyin:999:1:integration' }),
      'BLOCKED',
      'EVIDENCE_IDENTITY_MISMATCH',
    );
  });

  it('changing image/version requires fresh exact evidence', () => {
    const otherImage =
      'pgvector/pgvector:0.8.8-pg18-bookworm@sha256:' + 'b'.repeat(64);
    expectResult(evidence({ image_ref: otherImage }), 'BLOCKED', 'EVIDENCE_IDENTITY_MISMATCH');
    expectResult(
      evidence({ pgvector: { version: '0.8.6' } }),
      'BLOCKED',
      'PGVECTOR_VERSION_MISMATCH',
    );
  });

  it('unevaluated downstream stages remain NOT_EVALUATED rather than inheriting Stage A READY', () => {
    for (const stage of ['STAGE_B', 'STAGE_C']) {
      const result = classifyPgvectorReadiness(
        { probe_mode: 'NOT_EVALUATED', stage },
        { stage },
      );
      expect(result).toEqual({ status: 'NOT_EVALUATED', reasons: [] });
    }
  });
});

describe('Slice 19 CI substrate contract', () => {
  it('pins the same official pgvector PG18 semantic tag + immutable digest in both DB jobs', () => {
    const workflow = readFileSync('.github/workflows/ci.yml', 'utf8');
    expect(workflow.split(IMAGE).length - 1).toBeGreaterThanOrEqual(3);
    expect(workflow).not.toMatch(/image:\s+postgres:18(?:\s|$)/);
    expect((workflow.match(/Bootstrap pgvector/g) ?? []).length).toBe(2);
  });

  it('binds readiness to exact CI identity and uploads the evidence artifact', () => {
    const workflow = readFileSync('.github/workflows/ci.yml', 'utf8');
    for (const token of [
      'PGVECTOR_STAGE: STAGE_A',
      'PGVECTOR_ENVIRONMENT_KIND: CI_INTEGRATION',
      'PGVECTOR_ENVIRONMENT_ID:',
      'PGVECTOR_REPOSITORY_COMMIT:',
      'PGVECTOR_IMAGE_REF:',
      'PGVECTOR_EXPECTED_VERSION:',
      'PGVECTOR_READINESS_EVIDENCE:',
      'pgvector-readiness.json',
      'github.run_id',
      'github.run_attempt',
      'github.sha',
    ]) {
      expect(workflow).toContain(token);
    }
  });
});
