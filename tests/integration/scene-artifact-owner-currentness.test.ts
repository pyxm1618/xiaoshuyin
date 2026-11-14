import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import pg from 'pg';
import { buildApp } from '../../apps/server/api/src/app.js';
import { withRlsTransaction } from '../../apps/server/api/src/db/tx.js';
import {
  insertSceneArtifact,
  listSceneArtifacts,
  resolveSceneArtifactRefCurrentness,
} from '@xiaoshuyin/domain';
import { createAdminPool } from '../setup/db.js';
import {
  createFamily,
  loginWithLabel,
  type LoginResult,
} from '../setup/api.js';
import { createCase } from '../setup/participation.js';

interface Fixture {
  manager: LoginResult;
  familyId: string;
  caseA: string;
  caseB: string;
}

describe('Scene Artifact owner exact-ref currentness seam', () => {
  let app: FastifyInstance;
  let admin: pg.Pool;
  let appPool: pg.Pool;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
    admin = createAdminPool();
    appPool = new pg.Pool({
      connectionString: process.env['DATABASE_URL']!,
      max: 5,
    });
  });

  afterAll(async () => {
    await appPool.end();
    await admin.end();
    await app.close();
  });

  async function fixture(label: string): Promise<Fixture> {
    const manager = await loginWithLabel(app, `scene-artifact-owner-${label}`);
    const family = await createFamily(
      app,
      manager.token,
      `scene-artifact-owner-${label}`
    );
    expect(family.statusCode, family.body).toBe(201);
    const familyId = family.json().id as string;

    const firstCase = await createCase(app, manager.token, `${label}-a`);
    expect(firstCase.statusCode, firstCase.body).toBe(201);
    const secondCase = await createCase(app, manager.token, `${label}-b`);
    expect(secondCase.statusCode, secondCase.body).toBe(201);

    const caseA = firstCase.json().id as string;
    const caseB = secondCase.json().id as string;

    await admin.query(
      `INSERT INTO scene_node_states
         (family_id, case_id, scene_package_version, node_code, source_node_code,
          status, branch_reason_codes, input_refs, output_refs, revision)
       VALUES
         ($1,$2,'v1','A1001','A1001','AVAILABLE',ARRAY[]::text[],'[]'::jsonb,'[]'::jsonb,1),
         ($1,$3,'v1','A1001','A1001','AVAILABLE',ARRAY[]::text[],'[]'::jsonb,'[]'::jsonb,1)`,
      [familyId, caseA, caseB]
    );

    return { manager, familyId, caseA, caseB };
  }

  function inFamily<T>(f: Fixture, fn: (tx: pg.PoolClient) => Promise<T>): Promise<T> {
    return withRlsTransaction(
      appPool,
      {
        familyId: f.familyId,
        accountId: f.manager.accountId,
        personId: f.manager.personId,
        purpose: 'FAMILY_MANAGEMENT',
      },
      fn
    );
  }

  it('preserves history while resolving A1 -> A2 -> A3 by exact scoped supersession', async () => {
    const familyA = await fixture('chain-a');
    const familyB = await fixture('chain-b');

    const chain = await inFamily(familyA, async (tx) => {
      const a1 = await insertSceneArtifact(tx, {
        familyId: familyA.familyId,
        caseId: familyA.caseA,
        scenePackageVersion: 'v1',
        artifactType: 'TIMELINE',
        schemaVersion: 'v1',
        sourceNodeCode: 'A2007',
        data: { version: 1 },
        ownerPersonId: familyA.manager.personId,
        sourceRefs: [],
        revision: 1,
      });

      expect(
        await resolveSceneArtifactRefCurrentness(tx, {
          artifactId: a1.id,
          familyId: familyA.familyId,
          caseId: familyA.caseA,
        })
      ).toEqual({
        status: 'CURRENT',
        artifactId: a1.id,
        revision: 1,
      });

      const a2 = await insertSceneArtifact(tx, {
        familyId: familyA.familyId,
        caseId: familyA.caseA,
        scenePackageVersion: 'v1',
        artifactType: 'TIMELINE',
        schemaVersion: 'v1',
        sourceNodeCode: 'A2007',
        data: { version: 2 },
        ownerPersonId: familyA.manager.personId,
        sourceRefs: [],
        revision: 2,
        supersedesId: a1.id,
      });

      expect(
        await resolveSceneArtifactRefCurrentness(tx, {
          artifactId: a1.id,
          familyId: familyA.familyId,
          caseId: familyA.caseA,
        })
      ).toEqual({
        status: 'SUPERSEDED',
        artifactId: a1.id,
        revision: 1,
        successorId: a2.id,
      });
      expect(
        await resolveSceneArtifactRefCurrentness(tx, {
          artifactId: a2.id,
          familyId: familyA.familyId,
          caseId: familyA.caseA,
        })
      ).toEqual({
        status: 'CURRENT',
        artifactId: a2.id,
        revision: 2,
      });

      const historyAfterA2 = await listSceneArtifacts(tx, familyA.caseA);
      expect(historyAfterA2.map((row) => row.id)).toContain(a1.id);
      expect(historyAfterA2.map((row) => row.id)).toContain(a2.id);

      const a3 = await insertSceneArtifact(tx, {
        familyId: familyA.familyId,
        caseId: familyA.caseA,
        scenePackageVersion: 'v1',
        artifactType: 'TIMELINE',
        schemaVersion: 'v1',
        sourceNodeCode: 'A2007',
        data: { version: 3 },
        ownerPersonId: familyA.manager.personId,
        sourceRefs: [],
        revision: 3,
        supersedesId: a2.id,
      });

      expect(
        await resolveSceneArtifactRefCurrentness(tx, {
          artifactId: a1.id,
          familyId: familyA.familyId,
          caseId: familyA.caseA,
        })
      ).toMatchObject({ status: 'SUPERSEDED', successorId: a2.id });
      expect(
        await resolveSceneArtifactRefCurrentness(tx, {
          artifactId: a2.id,
          familyId: familyA.familyId,
          caseId: familyA.caseA,
        })
      ).toMatchObject({ status: 'SUPERSEDED', successorId: a3.id });
      expect(
        await resolveSceneArtifactRefCurrentness(tx, {
          artifactId: a3.id,
          familyId: familyA.familyId,
          caseId: familyA.caseA,
        })
      ).toEqual({
        status: 'CURRENT',
        artifactId: a3.id,
        revision: 3,
      });

      const history = await listSceneArtifacts(tx, familyA.caseA);
      expect(history.map((row) => row.revision).sort((a, b) => a - b)).toEqual([1, 2, 3]);

      expect(
        await resolveSceneArtifactRefCurrentness(tx, {
          artifactId: a3.id,
          familyId: familyA.familyId,
          caseId: familyA.caseB,
        })
      ).toEqual({ status: 'MISSING_OR_OUT_OF_SCOPE' });

      return { a1, a2, a3 };
    });

    await inFamily(familyB, async (tx) => {
      expect(
        await resolveSceneArtifactRefCurrentness(tx, {
          artifactId: chain.a3.id,
          familyId: familyA.familyId,
          caseId: familyA.caseA,
        })
      ).toEqual({ status: 'MISSING_OR_OUT_OF_SCOPE' });
    });

    const noContext = await appPool.connect();
    try {
      await noContext.query('BEGIN');
      expect(
        await resolveSceneArtifactRefCurrentness(noContext, {
          artifactId: chain.a3.id,
          familyId: familyA.familyId,
          caseId: familyA.caseA,
        })
      ).toEqual({ status: 'MISSING_OR_OUT_OF_SCOPE' });
      await noContext.query('ROLLBACK');
    } finally {
      noContext.release();
    }
  });

  it('keeps the existing single-successor fence and append-only runtime grants unchanged', async () => {
    const { rows: indexes } = await admin.query<{ indexdef: string }>(
      `SELECT indexdef
         FROM pg_indexes
        WHERE schemaname = 'public'
          AND indexname = 'scene_artifacts_supersedes_key'`
    );
    expect(indexes).toHaveLength(1);
    expect(indexes[0]!.indexdef).toMatch(
      /CREATE UNIQUE INDEX scene_artifacts_supersedes_key .* \(supersedes_id\)/i
    );

    const { rows: grants } = await admin.query<Record<string, boolean>>(
      `SELECT
         has_table_privilege('xiaoshuyin_app','scene_artifacts','SELECT') AS artifact_select,
         has_table_privilege('xiaoshuyin_app','scene_artifacts','INSERT') AS artifact_insert,
         has_table_privilege('xiaoshuyin_app','scene_artifacts','UPDATE') AS artifact_update,
         has_table_privilege('xiaoshuyin_app','scene_artifacts','DELETE') AS artifact_delete`
    );
    expect(grants[0]).toEqual({
      artifact_select: true,
      artifact_insert: true,
      artifact_update: false,
      artifact_delete: false,
    });
  });
});
