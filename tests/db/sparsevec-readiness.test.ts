import { describe, expect, it } from 'vitest';
import { Client } from 'pg';
import {
  DENSE_COSINE_ABS_TOL,
  PINNED_PGVECTOR_IMAGE_REF,
  PINNED_PGVECTOR_VERSION,
  SPARSE_D,
  SPARSE_IP_REL_TOL,
  mapActualPortSparseToPgSparsevec,
  parsePgSparsevecText,
  referenceDenseCosine,
  referenceSparseInnerProduct,
  resolveDbProbeMode,
  type MappedSparseCoordinate,
} from '../helpers/sparsevec-readiness.js';

const modeInfo = resolveDbProbeMode(process.env);
const DB_URL = process.env.DATABASE_URL;

function buildDeterministicSparseText(nnz: number, dim: number = SPARSE_D): {
  text: string;
  entries: MappedSparseCoordinate[];
} {
  const parts: string[] = [];
  const entries: MappedSparseCoordinate[] = [];
  for (let k = 1; k <= nnz; k++) {
    const val = Math.fround(1 / (k + 1));
    parts.push(`${k}:${val}`);
    entries.push({ coord: k, value: val });
  }
  return { text: `{${parts.join(',')}}/${dim}`, entries };
}

function findIndexNameInPlan(node: unknown, targetIndexName: string): boolean {
  if (!node || typeof node !== 'object') return false;
  if (Array.isArray(node)) {
    return node.some((item) => findIndexNameInPlan(item, targetIndexName));
  }
  const obj = node as Record<string, unknown>;
  if (obj['Index Name'] === targetIndexName) return true;
  return Object.values(obj).some((val) => findIndexNameInPlan(val, targetIndexName));
}

async function withAppClient<T>(fn: (client: Client) => Promise<T>): Promise<T> {
  if (!DB_URL) throw new Error('DATABASE_URL is required in RUN mode');
  const client = new Client({ connectionString: DB_URL });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

async function assertNoS21Relations(client: Client): Promise<void> {
  const res = await client.query(`
    SELECT count(*)::int AS cnt
      FROM pg_class
     WHERE relname LIKE 's21_%'
  `);
  expect(res.rows[0].cnt).toBe(0);
}

if (modeInfo.mode === 'SKIP') {
  describe.skip(`Slice 21 T005/T006 — Real DB sparsevec readiness (${modeInfo.reason})`, () => {
    it('skipped when no Stage A identity is configured', () => {});
  });
} else if (modeInfo.mode === 'FAIL') {
  describe('Slice 21 T005/T006 — Real DB sparsevec readiness (PARTIAL_IDENTITY)', () => {
    it('fails closed on partial Stage-A DB identity', () => {
      throw new Error(modeInfo.reason);
    });
  });
} else {
  describe('Slice 21 T005/T006 — Real PostgreSQL 18 + pgvector 0.8.7 sparsevec readiness', () => {
    it('verifies PG18, pgvector 0.8.7, pinned image ref, and xiaoshuyin_app least-privilege role', async () => {
      await withAppClient(async (client) => {
        expect(process.env.PGVECTOR_IMAGE_REF).toBe(PINNED_PGVECTOR_IMAGE_REF);

        const ver = await client.query(
          "SELECT current_setting('server_version') AS version, current_setting('server_version_num') AS version_num",
        );
        expect(Math.floor(Number(ver.rows[0].version_num) / 10000)).toBe(18);

        const ext = await client.query("SELECT extversion FROM pg_extension WHERE extname = 'vector'");
        expect(ext.rowCount).toBe(1);
        expect(ext.rows[0].extversion).toBe(PINNED_PGVECTOR_VERSION);

        const role = await client.query(`
          SELECT current_user AS runtime_role,
                 r.rolsuper,
                 r.rolbypassrls,
                 has_schema_privilege(current_user, 'public', 'CREATE') AS can_create
            FROM pg_roles r
           WHERE r.rolname = current_user
        `);
        expect(role.rows[0]).toEqual({
          runtime_role: 'xiaoshuyin_app',
          rolsuper: false,
          rolbypassrls: false,
          can_create: false,
        });

        const owner = await client.query(`
          SELECT r.rolname AS owner
            FROM pg_extension e
            JOIN pg_roles r ON r.oid = e.extowner
           WHERE e.extname = 'vector'
        `);
        expect(owner.rowCount).toBe(1);
        expect(owner.rows[0].owner).not.toBe('xiaoshuyin_app');
      });
    });

    it('verifies sparsevec(1e9) insert/readback, <#> analytical fixture, <=> dense fixture, and dimension errors', async () => {
      await withAppClient(async (client) => {
        await client.query('BEGIN');
        try {
          await client.query(`
            CREATE TEMP TABLE s21_sparse (
              sample_id text PRIMARY KEY,
              sparse sparsevec(1000000000) NOT NULL
            ) ON COMMIT DROP
          `);
          await client.query(`
            CREATE TEMP TABLE s21_dense (
              sample_id text PRIMARY KEY,
              dense vector(3) NOT NULL
            ) ON COMMIT DROP
          `);

          // Exact readback of {1:0.5, 1000000000:-0.25}/1000000000
          const boundaryMapped = mapActualPortSparseToPgSparsevec([
            { index: 0, value: 0.5 },
            { index: SPARSE_D - 1, value: -0.25 },
          ]);
          expect(boundaryMapped.ok).toBe(true);
          if (!boundaryMapped.ok) throw new Error(boundaryMapped.detail);

          await client.query('INSERT INTO s21_sparse (sample_id, sparse) VALUES ($1, $2::sparsevec(1000000000))', [
            'BOUNDARY',
            boundaryMapped.canonicalText,
          ]);
          const readBoundary = await client.query(
            "SELECT sparse::text AS text FROM s21_sparse WHERE sample_id = 'BOUNDARY'",
          );
          const parsedBoundary = parsePgSparsevecText(readBoundary.rows[0].text);
          expect(parsedBoundary.dimension).toBe(SPARSE_D);
          expect(parsedBoundary.entries).toEqual(boundaryMapped.entries);

          // Analytical sparse fixture (Plan §8.1)
          const vecA = `{1:0.5,8:-0.25}/${SPARSE_D}`;
          const vecB = `{1:0.25,8:0.5}/${SPARSE_D}`;
          await client.query('DELETE FROM s21_sparse');
          await client.query(
            "INSERT INTO s21_sparse (sample_id, sparse) VALUES ('A', $1::sparsevec(1000000000)), ('B', $2::sparsevec(1000000000))",
            [vecA, vecB],
          );
          const sparseDist = await client.query(
            `SELECT sample_id, (sparse <#> $1::sparsevec(1000000000)) AS dist
               FROM s21_sparse
              ORDER BY sparse <#> $1::sparsevec(1000000000) ASC, sample_id ASC`,
            [vecA],
          );
          expect(sparseDist.rows.map((r) => r.sample_id)).toEqual(['A', 'B']);
          const simA = -Number(sparseDist.rows[0].dist);
          const simB = -Number(sparseDist.rows[1].dist);
          const refA = referenceSparseInnerProduct(
            parsePgSparsevecText(vecA).entries,
            parsePgSparsevecText(vecA).entries,
          );
          const refB = referenceSparseInnerProduct(
            parsePgSparsevecText(vecB).entries,
            parsePgSparsevecText(vecA).entries,
          );
          expect(refA).toBeCloseTo(0.3125, 10);
          expect(refB).toBe(0);
          expect(Math.abs(simA - refA)).toBeLessThanOrEqual(SPARSE_IP_REL_TOL * Math.max(1, Math.abs(refA)));
          expect(Math.abs(simB - refB)).toBeLessThanOrEqual(SPARSE_IP_REL_TOL * Math.max(1, Math.abs(refB)));

          // Analytical dense fixture (Plan §8.2)
          await client.query(`
            INSERT INTO s21_dense (sample_id, dense)
            VALUES ('a', '[1,0,0]'), ('b', '[1,1,0]'), ('c', '[0,1,0]')
          `);
          const denseDist = await client.query(`
            SELECT sample_id, (1 - (dense <=> '[1,0,0]'::vector(3))) AS sim
              FROM s21_dense
             ORDER BY dense <=> '[1,0,0]'::vector(3) ASC, sample_id ASC
          `);
          expect(denseDist.rows.map((r) => r.sample_id)).toEqual(['a', 'b', 'c']);
          const refDense = [
            referenceDenseCosine([1, 0, 0], [1, 0, 0]),
            referenceDenseCosine([1, 1, 0], [1, 0, 0]),
            referenceDenseCosine([0, 1, 0], [1, 0, 0]),
          ];
          expect(refDense[1]).toBeCloseTo(Math.SQRT1_2, 12);
          for (let i = 0; i < 3; i++) {
            expect(Math.abs(Number(denseDist.rows[i].sim) - refDense[i])).toBeLessThanOrEqual(DENSE_COSINE_ABS_TOL);
          }
          expect(() => referenceDenseCosine([0, 0, 0], [1, 0, 0])).toThrow('DENSE_ZERO_VECTOR');

          // Dimension mismatch insert and distance under SAVEPOINT
          await client.query('SAVEPOINT sp_dim_insert');
          let insertErr: unknown = null;
          try {
            await client.query("INSERT INTO s21_sparse (sample_id, sparse) VALUES ('BAD', '{1:0.5}/10'::sparsevec(10))");
          } catch (e) {
            insertErr = e;
          }
          await client.query('ROLLBACK TO SAVEPOINT sp_dim_insert');
          expect(insertErr).toBeTruthy();

          await client.query('SAVEPOINT sp_dim_dist');
          let distErr: unknown = null;
          try {
            await client.query("SELECT sparse <#> '{1:0.5}/10'::sparsevec(10) FROM s21_sparse LIMIT 1");
          } catch (e) {
            distErr = e;
          }
          await client.query('ROLLBACK TO SAVEPOINT sp_dim_dist');
          expect(distErr).toBeTruthy();

          await client.query('COMMIT');
        } catch (err) {
          await client.query('ROLLBACK');
          throw err;
        }
        await assertNoS21Relations(client);
      });
    });

    it('verifies cleanup on injected-failure path and consecutive reruns without collision', async () => {
      await withAppClient(async (client) => {
        await client.query('BEGIN');
        let injectedCaught = false;
        try {
          await client.query(
            'CREATE TEMP TABLE s21_cleanup_probe (id text PRIMARY KEY, sparse sparsevec(1000000000)) ON COMMIT DROP',
          );
          throw new Error('INJECTED_FAILURE');
        } catch (err) {
          if (err instanceof Error && err.message === 'INJECTED_FAILURE') {
            injectedCaught = true;
          }
          await client.query('ROLLBACK');
        }
        expect(injectedCaught).toBe(true);
        await assertNoS21Relations(client);

        // Rerun without collision
        await client.query('BEGIN');
        await client.query(
          'CREATE TEMP TABLE s21_cleanup_probe (id text PRIMARY KEY, sparse sparsevec(1000000000)) ON COMMIT DROP',
        );
        await client.query('COMMIT');
        await assertNoS21Relations(client);
      });
    });

    it('T006 boundary: D (1e9) valid boundary', async () => {
      await withAppClient(async (client) => {
        await client.query('BEGIN');
        try {
          await client.query(
            'CREATE TEMP TABLE s21_bound_d (id text PRIMARY KEY, sparse sparsevec(1000000000)) ON COMMIT DROP',
          );
          await client.query(
            `INSERT INTO s21_bound_d VALUES ('D', $1::sparsevec(1000000000))`,
            [`{1:0.5,${SPARSE_D}:-0.25}/${SPARSE_D}`],
          );
          await client.query('COMMIT');
        } catch (e) {
          await client.query('ROLLBACK');
          throw e;
        }
        await assertNoS21Relations(client);
      });
    });

    it('T006 boundary: D+1 rejects', async () => {
      await withAppClient(async (client) => {
        await client.query('BEGIN');
        let failed = false;
        try {
          await client.query('SAVEPOINT sp_d_plus_1');
          try {
            await client.query(
              'CREATE TEMP TABLE s21_bound_d1 (id text PRIMARY KEY, sparse sparsevec(1000000001)) ON COMMIT DROP',
            );
          } catch {
            failed = true;
          }
          await client.query('ROLLBACK TO SAVEPOINT sp_d_plus_1');
          await client.query('COMMIT');
        } catch (e) {
          await client.query('ROLLBACK');
          throw e;
        }
        expect(failed).toBe(true);
        await assertNoS21Relations(client);
      });
    });

    it('T006 boundary: 16,000 nnz PASS and 16,001 nnz FAIL', async () => {
      await withAppClient(async (client) => {
        const ok16k = buildDeterministicSparseText(16_000);
        const bad16k1 = buildDeterministicSparseText(16_001);

        await client.query('BEGIN');
        try {
          await client.query(
            'CREATE TEMP TABLE s21_nnz_16k (id text PRIMARY KEY, sparse sparsevec(1000000000)) ON COMMIT DROP',
          );
          await client.query('INSERT INTO s21_nnz_16k VALUES ($1, $2::sparsevec(1000000000))', [
            'ok16k',
            ok16k.text,
          ]);

          await client.query('SAVEPOINT sp_16001');
          let failed16001 = false;
          try {
            await client.query('INSERT INTO s21_nnz_16k VALUES ($1, $2::sparsevec(1000000000))', [
              'bad16001',
              bad16k1.text,
            ]);
          } catch {
            failed16001 = true;
          }
          await client.query('ROLLBACK TO SAVEPOINT sp_16001');
          expect(failed16001).toBe(true);

          await client.query('COMMIT');
        } catch (e) {
          await client.query('ROLLBACK');
          throw e;
        }
        await assertNoS21Relations(client);
      });
    });

    it('T006 boundary: HNSW 1,000 nnz compatible, 1,001 nnz incompatible, EXPLAIN index path, and planner restore', async () => {
      await withAppClient(async (client) => {
        const preShow = await client.query('SHOW enable_seqscan');
        const preSeqscan = preShow.rows[0].enable_seqscan;

        const row1k = buildDeterministicSparseText(1_000);
        const row1k1 = buildDeterministicSparseText(1_001);

        await client.query('BEGIN');
        try {
          await client.query(`
            CREATE TEMP TABLE s21_hnsw_probe (
              sample_id text PRIMARY KEY,
              sparse sparsevec(1000000000) NOT NULL
            ) ON COMMIT DROP
          `);
          await client.query('INSERT INTO s21_hnsw_probe VALUES ($1, $2::sparsevec(1000000000))', [
            'R1000',
            row1k.text,
          ]);
          await client.query('INSERT INTO s21_hnsw_probe VALUES ($1, $2::sparsevec(1000000000))', [
            'R2',
            `{1:0.5,2:0.25}/${SPARSE_D}`,
          ]);

          await client.query(
            'CREATE INDEX s21_hnsw_idx ON pg_temp.s21_hnsw_probe USING hnsw (sparse sparsevec_ip_ops)',
          );

          // 1,001 nnz row insert into HNSW-indexed table must fail
          await client.query('SAVEPOINT sp_hnsw_1001');
          let failed1001 = false;
          try {
            await client.query('INSERT INTO s21_hnsw_probe VALUES ($1, $2::sparsevec(1000000000))', [
              'R1001',
              row1k1.text,
            ]);
          } catch {
            failed1001 = true;
          }
          await client.query('ROLLBACK TO SAVEPOINT sp_hnsw_1001');
          expect(failed1001).toBe(true);

          // EXPLAIN (FORMAT JSON, COSTS OFF) with SET LOCAL enable_seqscan = off
          await client.query('SET LOCAL enable_seqscan = off');
          const explainRes = await client.query(
            `EXPLAIN (FORMAT JSON, COSTS OFF)
             SELECT sample_id FROM s21_hnsw_probe
              ORDER BY sparse <#> $1::sparsevec(1000000000) ASC
              LIMIT 5`,
            [row1k.text],
          );
          const planJson = explainRes.rows[0]['QUERY PLAN'];
          expect(findIndexNameInPlan(planJson, 's21_hnsw_idx')).toBe(true);

          // Observe ANN query result
          const annRes = await client.query(
            `SELECT sample_id FROM s21_hnsw_probe
              ORDER BY sparse <#> $1::sparsevec(1000000000) ASC
              LIMIT 5`,
            [row1k.text],
          );
          expect(annRes.rows.map((r) => r.sample_id)).toContain('R1000');

          await client.query('COMMIT');
        } catch (e) {
          await client.query('ROLLBACK');
          throw e;
        }

        // Planner restored & no s21_% residue
        const postShow = await client.query('SHOW enable_seqscan');
        expect(postShow.rows[0].enable_seqscan).toBe(preSeqscan);
        await assertNoS21Relations(client);
      });
    });
  });
}
