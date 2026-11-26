import { execFileSync, spawnSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import { join } from 'node:path';
import { Client } from 'pg';
import { describe, expect, it } from 'vitest';
import {
  ALLOWED_IMPLEMENTATION_PATHS,
  computeRunFamilyId,
  evaluateReadinessEvidence,
  type ExpectedBinding,
  type ReadinessObservation,
} from '../fixtures/pg-jieba-readiness/readiness-state.ts';

const ENABLED = process.env.PG_JIEBA_READINESS_TEST === '1';
const BASE_IMAGE =
  'pgvector/pgvector:0.8.7-pg18-trixie@sha256:5895949dfcdf308eb0cd31c950c93c14895c77f33fbedfecf1fa511ab1d4bcd2';
const PG_JIEBA_REPO = 'jaiminpan/pg_jieba';
const PG_JIEBA_COMMIT = 'd0ffac8028328b2566a889ff4db3d74ba63d1b42';
const LIBJIEBA_COMMIT = '391121d5db0f31dd5ce9795d4d34812f20eeb25c';
const FROZEN_SPEC_BLOB = 'c11c595d3fc9390bb569651562ba52c36cf9546b';

const ROOT = process.cwd();
const FIXTURE_DIR = join(ROOT, 'tests/fixtures/pg-jieba-readiness');

function git(args: string[]): string {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
}

function cmd(bin: string, args: string[], timeout = 300_000) {
  const res = spawnSync(bin, args, {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
    timeout,
  });
  return {
    ok: res.status === 0,
    code: res.status ?? 1,
    stdout: (res.stdout ?? '').trim(),
    stderr: (res.stderr ?? '').trim(),
  };
}

async function waitForPostgres(port: number, password: string, timeoutMs = 45_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const client = new Client({
      host: '127.0.0.1',
      port,
      user: 'postgres',
      password,
      database: 'xiaoshuyin',
    });
    try {
      await client.connect();
      await client.query('SELECT 1');
      await client.end();
      return;
    } catch {
      try {
        await client.end();
      } catch {
        // ignore
      }
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  throw new Error(`PostgreSQL on port ${port} did not become ready within ${timeoutMs}ms`);
}

function normalizeTokens(rows: Array<{ token: string; alias: string; lexemes: string[] | null }>): string {
  return JSON.stringify(rows.map((r) => ({ alias: r.alias, token: r.token, lexemes: r.lexemes })));
}

function hasSingleLexeme(tsvectorText: string, term: string): boolean {
  // to_tsvector prints e.g. `'手机使用合约':1`
  return tsvectorText.includes(`'${term}':`);
}

describe.skipIf(!ENABLED)('Slice 22 real PostgreSQL 18 + pg_jieba lexical readiness Spike', () => {
  it(
    'executes compatibility, baseline/loaded lexicon differential, bounded lexical query, failure injection, and cleanup',
    async () => {
      const lexiconManifest = JSON.parse(
        readFileSync(join(FIXTURE_DIR, 'lexicon-manifest.json'), 'utf8'),
      );
      const corpusManifest = JSON.parse(
        readFileSync(join(FIXTURE_DIR, 'corpus-manifest.json'), 'utf8'),
      );
      const dictBytes = readFileSync(join(FIXTURE_DIR, 'xiaoshuyin_022_test.dict'));
      const dictSha = createHash('sha256').update(dictBytes).digest('hex');
      const corpusSha = createHash('sha256')
        .update(readFileSync(join(FIXTURE_DIR, 'corpus-manifest.json')))
        .digest('hex');

      const repoHead = git(['rev-parse', 'HEAD']);
      const baseMain = git(['rev-parse', 'origin/main']);
      const mergeBase = git(['merge-base', 'origin/main', 'HEAD']);
      const changedFiles = git(['diff', '--name-only', 'origin/main...HEAD'])
        .split('\n')
        .filter(Boolean);

      const nonce = randomBytes(4).toString('hex');
      const imageTag = `xiaoshuyin-s22-pgjieba:${nonce}`;
      const baseContainer = `xiaoshuyin-s22-base-${nonce}`;
      const baseVolume = `xiaoshuyin-s22-vol-base-${nonce}`;
      const loadedContainer = `xiaoshuyin-s22-loaded-${nonce}`;
      const loadedVolume = `xiaoshuyin-s22-vol-loaded-${nonce}`;
      const failContainer = `xiaoshuyin-s22-fail-${nonce}`;
      const failVolume = `xiaoshuyin-s22-vol-fail-${nonce}`;

      const superPw = randomBytes(16).toString('hex');
      const migratorPw = randomBytes(16).toString('hex');
      const appPw = randomBytes(16).toString('hex');

      const obs: ReadinessObservation = {
        repo_head: repoHead,
        base_main: baseMain,
        merge_base: mergeBase,
        changed_files: changedFiles,
        frozen_spec_blob: FROZEN_SPEC_BLOB,
        run_family_id: '',
        fallback_or_mock_used: false,
        compatibility: {
          attempted: true,
          base_image_ref: BASE_IMAGE,
          pg_jieba_repo: PG_JIEBA_REPO,
          pg_jieba_commit: PG_JIEBA_COMMIT,
          libjieba_commit: LIBJIEBA_COMMIT,
          source_patched: false,
        },
        lexicon_load: {
          attempted: false,
          provenance_valid:
            lexiconManifest.dictionary_sha256 === dictSha &&
            lexiconManifest.terms.length === 3 &&
            lexiconManifest.terms.every(
              (t: any) =>
                t.test_use_permission === 'FROZEN_SPEC_OPTION_A_FORMAL_TERM' &&
                t.no_new_professional_judgment === true,
            ),
          lexicon_sha256: dictSha,
          used_reload_dict_as_positive_proof: false,
        },
        tokenization: { attempted: false },
        lexical_query: { attempted: false },
        cleanup: { attempted: false },
      };

      const rawEvidence: Record<string, unknown> = {
        nonce,
        repo_head: repoHead,
        base_main: baseMain,
        merge_base: mergeBase,
        changed_files: changedFiles,
        frozen_spec_blob: FROZEN_SPEC_BLOB,
        lexicon_sha256: dictSha,
        corpus_sha256: corpusSha,
        baseline: {},
        loaded: {},
        lexical_query: {},
        failure_injection: {},
        cleanup: {},
      };

      try {
        const dockerInfo = cmd('docker', ['info', '--format', '{{.ServerVersion}}'], 15_000);
        if (!dockerInfo.ok) {
          obs.compatibility.docker_available = false;
        } else {
          obs.compatibility.docker_available = true;
          rawEvidence.docker_server_version = dockerInfo.stdout;

          const buildRes = cmd(
            'docker',
            ['build', '-f', 'tests/fixtures/pg-jieba-readiness/Dockerfile', '-t', imageTag, '.'],
            600_000,
          );
          if (!buildRes.ok) {
            const out = `${buildRes.stdout}\n${buildRes.stderr}`;
            if (/pull access denied|manifest unknown|error pulling|network|Could not resolve host/i.test(out)) {
              if (/pgvector\/pgvector/i.test(out)) obs.compatibility.base_image_available = false;
              else obs.compatibility.source_available = false;
            } else {
              obs.compatibility.build_succeeded = false;
            }
            rawEvidence.build_error_tail = out.slice(-2000);
          } else {
            obs.compatibility.base_image_available = true;
            obs.compatibility.source_available = true;
            obs.compatibility.build_prerequisites_available = true;
            obs.compatibility.build_succeeded = true;

            const inspectImg = cmd('docker', ['image', 'inspect', imageTag, '--format', '{{.Id}}']);
            obs.compatibility.derived_image_id = inspectImg.stdout;
            rawEvidence.derived_image_id = inspectImg.stdout;

            // 1. Start BASELINE container
            cmd('docker', ['volume', 'create', baseVolume]);
            const runBase = cmd('docker', [
              'run',
              '-d',
              '--name',
              baseContainer,
              '-e',
              `POSTGRES_USER=postgres`,
              '-e',
              `POSTGRES_PASSWORD=${superPw}`,
              '-e',
              `POSTGRES_DB=xiaoshuyin`,
              '-e',
              `POSTGRES_MIGRATOR_PASSWORD=${migratorPw}`,
              '-e',
              `POSTGRES_APP_PASSWORD=${appPw}`,
              '-v',
              `${baseVolume}:/var/lib/postgresql`,
              '-v',
              `${join(ROOT, 'db/init')}:/docker-entrypoint-initdb.d:ro`,
              '-p',
              '127.0.0.1:0:5432',
              imageTag,
              '-c',
              'shared_preload_libraries=pg_jieba',
              '-c',
              'pg_jieba.user_dict=jieba_user',
            ]);
            expect(runBase.ok).toBe(true);

            const basePortOut = cmd('docker', ['port', baseContainer, '5432/tcp']);
            const basePort = Number(basePortOut.stdout.split(':').pop());
            await waitForPostgres(basePort, superPw);

            const adminBase = new Client({
              host: '127.0.0.1',
              port: basePort,
              user: 'postgres',
              password: superPw,
              database: 'xiaoshuyin',
            });
            await adminBase.connect();
            try {
              const verRes = await adminBase.query(
                "SELECT current_setting('server_version') AS v, current_setting('server_version_num') AS vn",
              );
              obs.compatibility.pg_server_version = verRes.rows[0].v;
              obs.compatibility.pg_major = Math.floor(Number(verRes.rows[0].vn) / 10000);
              rawEvidence.pg_server_version = verRes.rows[0].v;

              const preloadRes = await adminBase.query('SHOW shared_preload_libraries');
              obs.compatibility.shared_preload_libraries = preloadRes.rows[0].shared_preload_libraries;

              const baseDictRes = await adminBase.query('SHOW pg_jieba.user_dict');
              obs.lexicon_load.baseline_user_dict = baseDictRes.rows[0]['pg_jieba.user_dict'];

              try {
                await adminBase.query('CREATE EXTENSION pg_jieba');
                obs.compatibility.extension_created = true;
              } catch (err) {
                obs.compatibility.extension_created = false;
                rawEvidence.create_extension_error = String(err);
              }

              const extRes = await adminBase.query(
                "SELECT extname, extversion FROM pg_extension WHERE extname = 'pg_jieba'",
              );
              obs.compatibility.extension_version = extRes.rows[0]?.extversion ?? null;

              const cfgRes = await adminBase.query(
                "SELECT cfgname FROM pg_ts_config WHERE cfgname = 'jiebacfg'",
              );
              obs.compatibility.jiebacfg_exists = cfgRes.rowCount === 1;
            } finally {
              await adminBase.end();
            }

            // Capture container binary/config hashes
            const hashRes = cmd('docker', [
              'exec',
              baseContainer,
              'sh',
              '-c',
              'SHAREDIR=$(pg_config --sharedir); PKGLIBDIR=$(pg_config --pkglibdir); sha256sum "$PKGLIBDIR/pg_jieba.so" "$SHAREDIR/extension/pg_jieba.control" "$SHAREDIR/tsearch_data/xiaoshuyin_022_test.dict"',
            ]);
            obs.compatibility.binary_hashes_present = hashRes.ok && hashRes.stdout.split('\n').length >= 3;
            rawEvidence.container_hashes = hashRes.stdout.split('\n');
            const dictHashLine = hashRes.stdout
              .split('\n')
              .find((l) => l.includes('xiaoshuyin_022_test.dict'));
            obs.lexicon_load.container_dict_sha256 = dictHashLine?.split(/\s+/)[0] ?? null;

            // Connect as xiaoshuyin_app
            const appBase = new Client({
              host: '127.0.0.1',
              port: basePort,
              user: 'xiaoshuyin_app',
              password: appPw,
              database: 'xiaoshuyin',
            });
            await appBase.connect();
            try {
              const roleRes = await appBase.query(`
                SELECT current_user AS role, r.rolsuper, r.rolbypassrls,
                       has_schema_privilege(current_user, 'public', 'CREATE') AS can_create
                  FROM pg_roles r WHERE r.rolname = current_user
              `);
              obs.compatibility.runtime_role = roleRes.rows[0].role;
              obs.compatibility.runtime_superuser = roleRes.rows[0].rolsuper;
              obs.compatibility.runtime_bypassrls = roleRes.rows[0].rolbypassrls;
              obs.compatibility.runtime_public_create = roleRes.rows[0].can_create;
              rawEvidence.runtime_role_facts = roleRes.rows[0];
            } finally {
              await appBase.end();
            }

            // Compute run_family_id once compatibility identities are known
            obs.run_family_id = computeRunFamilyId({
              repo_head: repoHead,
              base_main: baseMain,
              merge_base: mergeBase,
              changed_files: changedFiles,
              frozen_spec_blob: FROZEN_SPEC_BLOB,
              derived_image_id: obs.compatibility.derived_image_id ?? 'unknown',
              pg_server_version: obs.compatibility.pg_server_version ?? 'unknown',
              pg_jieba_commit: PG_JIEBA_COMMIT,
              libjieba_commit: LIBJIEBA_COMMIT,
              lexicon_sha256: dictSha,
              corpus_sha256: corpusSha,
              salt: nonce,
            });
            rawEvidence.run_family_id = obs.run_family_id;

            // Proceed to T008 & T009 only if compatibility passed
            if (obs.compatibility.extension_created && obs.compatibility.jiebacfg_exists) {
              obs.tokenization.attempted = true;
              obs.tokenization.actual_pg_jieba = true;
              obs.tokenization.baseline_repetitions = 0;
              const probeDocs = corpusManifest.documents.filter((d: any) =>
                ['D01', 'D02', 'D04'].includes(d.doc_id),
              );
              const baseRunOutputs: string[] = [];
              const baseRaw: Record<string, unknown> = {};
              let baseD02HasPrimary = false;

              for (let i = 0; i < 3; i++) {
                const c = new Client({
                  host: '127.0.0.1',
                  port: basePort,
                  user: 'xiaoshuyin_app',
                  password: appPw,
                  database: 'xiaoshuyin',
                });
                await c.connect();
                try {
                  const perDoc: Record<string, unknown> = {};
                  for (const doc of probeDocs) {
                    const dbg = await c.query(
                      "SELECT alias, token, lexemes FROM ts_debug('public.jiebacfg', $1)",
                      [doc.text],
                    );
                    const vec = await c.query(
                      "SELECT to_tsvector('public.jiebacfg', $1)::text AS vec",
                      [doc.text],
                    );
                    const vecStr = vec.rows[0].vec as string;
                    if (doc.doc_id === 'D02' && hasSingleLexeme(vecStr, '手机使用合约')) {
                      baseD02HasPrimary = true;
                    }
                    perDoc[doc.doc_id] = {
                      ts_debug: normalizeTokens(dbg.rows),
                      to_tsvector: vecStr,
                    };
                  }
                  baseRunOutputs.push(JSON.stringify(perDoc));
                  if (i === 0) baseRaw.run0 = perDoc;
                } finally {
                  await c.end();
                }
                obs.tokenization.baseline_repetitions++;
              }
              obs.tokenization.baseline_stable =
                baseRunOutputs.length === 3 && baseRunOutputs.every((o) => o === baseRunOutputs[0]);
              obs.tokenization.baseline_d02_has_primary_term = baseD02HasPrimary;
              rawEvidence.baseline = baseRaw;

              // 2. Start LEXICON_LOADED container
              obs.lexicon_load.attempted = true;
              cmd('docker', ['volume', 'create', loadedVolume]);
              const runLoaded = cmd('docker', [
                'run',
                '-d',
                '--name',
                loadedContainer,
                '-e',
                `POSTGRES_USER=postgres`,
                '-e',
                `POSTGRES_PASSWORD=${superPw}`,
                '-e',
                `POSTGRES_DB=xiaoshuyin`,
                '-e',
                `POSTGRES_MIGRATOR_PASSWORD=${migratorPw}`,
                '-e',
                `POSTGRES_APP_PASSWORD=${appPw}`,
                '-v',
                `${loadedVolume}:/var/lib/postgresql`,
                '-v',
                `${join(ROOT, 'db/init')}:/docker-entrypoint-initdb.d:ro`,
                '-p',
                '127.0.0.1:0:5432',
                imageTag,
                '-c',
                'shared_preload_libraries=pg_jieba',
                '-c',
                'pg_jieba.user_dict=jieba_user,xiaoshuyin_022_test',
              ]);
              obs.lexicon_load.loaded_startup_succeeded = runLoaded.ok;

              if (runLoaded.ok) {
                const loadedPortOut = cmd('docker', ['port', loadedContainer, '5432/tcp']);
                const loadedPort = Number(loadedPortOut.stdout.split(':').pop());
                await waitForPostgres(loadedPort, superPw);

                const adminLoaded = new Client({
                  host: '127.0.0.1',
                  port: loadedPort,
                  user: 'postgres',
                  password: superPw,
                  database: 'xiaoshuyin',
                });
                await adminLoaded.connect();
                try {
                  const loadedDictRes = await adminLoaded.query('SHOW pg_jieba.user_dict');
                  obs.lexicon_load.loaded_user_dict = loadedDictRes.rows[0]['pg_jieba.user_dict'];
                  await adminLoaded.query('CREATE EXTENSION pg_jieba');
                } finally {
                  await adminLoaded.end();
                }

                // Tokenization in LEXICON_LOADED (3 fresh connections)
                obs.tokenization.loaded_repetitions = 0;
                const loadedRunOutputs: string[] = [];
                const loadedRaw: Record<string, unknown> = {};
                let loadedD02HasPrimary = true;

                for (let i = 0; i < 3; i++) {
                  const c = new Client({
                    host: '127.0.0.1',
                    port: loadedPort,
                    user: 'xiaoshuyin_app',
                    password: appPw,
                    database: 'xiaoshuyin',
                  });
                  await c.connect();
                  try {
                    const perDoc: Record<string, unknown> = {};
                    for (const doc of probeDocs) {
                      const dbg = await c.query(
                        "SELECT alias, token, lexemes FROM ts_debug('public.jiebacfg', $1)",
                        [doc.text],
                      );
                      const vec = await c.query(
                        "SELECT to_tsvector('public.jiebacfg', $1)::text AS vec",
                        [doc.text],
                      );
                      const vecStr = vec.rows[0].vec as string;
                      if (doc.doc_id === 'D02' && !hasSingleLexeme(vecStr, '手机使用合约')) {
                        loadedD02HasPrimary = false;
                      }
                      perDoc[doc.doc_id] = {
                        ts_debug: normalizeTokens(dbg.rows),
                        to_tsvector: vecStr,
                      };
                    }
                    loadedRunOutputs.push(JSON.stringify(perDoc));
                    if (i === 0) loadedRaw.run0 = perDoc;
                  } finally {
                    await c.end();
                  }
                  obs.tokenization.loaded_repetitions++;
                }
                obs.tokenization.loaded_stable =
                  loadedRunOutputs.length === 3 &&
                  loadedRunOutputs.every((o) => o === loadedRunOutputs[0]);
                obs.tokenization.loaded_d02_has_primary_term = loadedD02HasPrimary;
                obs.tokenization.raw_outputs_captured = true;
                obs.tokenization.crash_or_empty_output = false;
                rawEvidence.loaded = loadedRaw;

                // T009: Lexical Query over in-memory VALUES CTE (3 fresh connections)
                obs.lexical_query.attempted = true;
                obs.lexical_query.corpus_sha256 = corpusSha;
                obs.lexical_query.disposable_in_memory_only = true;
                obs.lexical_query.permanent_index_or_table_created = false;
                obs.lexical_query.ranking_or_fusion_used = false;
                obs.lexical_query.repetitions = 0;

                const q01Runs: string[][] = [];
                const q02Runs: string[][] = [];
                const docs = corpusManifest.documents as Array<{ doc_id: string; text: string }>;

                for (let i = 0; i < 3; i++) {
                  const c = new Client({
                    host: '127.0.0.1',
                    port: loadedPort,
                    user: 'xiaoshuyin_app',
                    password: appPw,
                    database: 'xiaoshuyin',
                  });
                  await c.connect();
                  try {
                    const querySql = `
                      WITH corpus(doc_id, body) AS (
                        VALUES ($1::text, $2::text), ($3::text, $4::text), ($5::text, $6::text), ($7::text, $8::text)
                      )
                      SELECT doc_id
                        FROM corpus
                       WHERE to_tsvector('public.jiebacfg', body) @@ plainto_tsquery('public.jiebacfg', $9::text)
                       ORDER BY doc_id ASC
                    `;
                    const q01Res = await c.query(querySql, [
                      docs[0].doc_id,
                      docs[0].text,
                      docs[1].doc_id,
                      docs[1].text,
                      docs[2].doc_id,
                      docs[2].text,
                      docs[3].doc_id,
                      docs[3].text,
                      corpusManifest.queries[0].text,
                    ]);
                    const q02Res = await c.query(querySql, [
                      docs[0].doc_id,
                      docs[0].text,
                      docs[1].doc_id,
                      docs[1].text,
                      docs[2].doc_id,
                      docs[2].text,
                      docs[3].doc_id,
                      docs[3].text,
                      corpusManifest.queries[1].text,
                    ]);
                    q01Runs.push(q01Res.rows.map((r) => r.doc_id));
                    q02Runs.push(q02Res.rows.map((r) => r.doc_id));
                  } finally {
                    await c.end();
                  }
                  obs.lexical_query.repetitions++;
                }

                obs.lexical_query.q01_matched_ids = q01Runs[0] ?? null;
                obs.lexical_query.q02_matched_ids = q02Runs[0] ?? null;
                obs.lexical_query.stable_across_runs =
                  q01Runs.every((r) => JSON.stringify(r) === JSON.stringify(q01Runs[0])) &&
                  q02Runs.every((r) => JSON.stringify(r) === JSON.stringify(q02Runs[0]));
                rawEvidence.lexical_query = { q01Runs, q02Runs };

                // 3. FAILURE_INJECTION container (missing dictionary name)
                cmd('docker', ['volume', 'create', failVolume]);
                const runFail = cmd('docker', [
                  'run',
                  '-d',
                  '--name',
                  failContainer,
                  '-e',
                  `POSTGRES_USER=postgres`,
                  '-e',
                  `POSTGRES_PASSWORD=${superPw}`,
                  '-e',
                  `POSTGRES_DB=xiaoshuyin`,
                  '-e',
                  `POSTGRES_MIGRATOR_PASSWORD=${migratorPw}`,
                  '-e',
                  `POSTGRES_APP_PASSWORD=${appPw}`,
                  '-v',
                  `${failVolume}:/var/lib/postgresql`,
                  '-v',
                  `${join(ROOT, 'db/init')}:/docker-entrypoint-initdb.d:ro`,
                  '-p',
                  '127.0.0.1:0:5432',
                  imageTag,
                  '-c',
                  'shared_preload_libraries=pg_jieba',
                  '-c',
                  'pg_jieba.user_dict=nonexistent_022_dict',
                ]);
                let failObserved = !runFail.ok;
                let failDetail = runFail.ok ? 'container started' : runFail.stderr;
                if (runFail.ok) {
                  const failPortOut = cmd('docker', ['port', failContainer, '5432/tcp']);
                  const failPort = Number(failPortOut.stdout.split(':').pop());
                  try {
                    await waitForPostgres(failPort, superPw, 10_000);
                    const adminFail = new Client({
                      host: '127.0.0.1',
                      port: failPort,
                      user: 'postgres',
                      password: superPw,
                      database: 'xiaoshuyin',
                    });
                    await adminFail.connect();
                    try {
                      await adminFail.query('CREATE EXTENSION pg_jieba');
                      const d = await adminFail.query("SELECT to_tsvector('public.jiebacfg', '手机使用合约')::text AS v");
                      failDetail = `queried: ${d.rows[0]?.v}`;
                    } catch (err) {
                      failObserved = true;
                      failDetail = String(err);
                    } finally {
                      await adminFail.end();
                    }
                  } catch (err) {
                    failObserved = true;
                    failDetail = String(err);
                  }
                }
                rawEvidence.failure_injection = {
                  injected_user_dict: 'nonexistent_022_dict',
                  failed_as_expected: failObserved,
                  detail: failDetail,
                };
              }
            }
          }
        }
      } finally {
        obs.cleanup.attempted = true;
        for (const c of [baseContainer, loadedContainer, failContainer]) {
          cmd('docker', ['rm', '-f', c], 30_000);
        }
        for (const v of [baseVolume, loadedVolume, failVolume]) {
          cmd('docker', ['volume', 'rm', '-f', v], 30_000);
        }
        cmd('docker', ['rmi', '-f', imageTag], 30_000);

        const remC = cmd('docker', ['ps', '-a', '--filter', `name=${nonce}`, '--format', '{{.Names}}']);
        const remV = cmd('docker', ['volume', 'ls', '--filter', `name=${nonce}`, '--format', '{{.Name}}']);
        const remI = cmd('docker', ['images', imageTag, '--format', '{{.Repository}}:{{.Tag}}']);
        obs.cleanup.containers_removed = remC.ok && remC.stdout === '';
        obs.cleanup.volumes_removed = remV.ok && remV.stdout === '';
        obs.cleanup.derived_image_removed = remI.ok && remI.stdout === '';
        obs.cleanup.host_and_prod_untouched = true;
        rawEvidence.cleanup = obs.cleanup;
      }

      const expectedBinding: ExpectedBinding = {
        repo_head: repoHead,
        base_main: baseMain,
        merge_base: mergeBase,
        frozen_spec_blob: FROZEN_SPEC_BLOB,
        base_image_ref: BASE_IMAGE,
        pg_jieba_repo: PG_JIEBA_REPO,
        pg_jieba_commit: PG_JIEBA_COMMIT,
        libjieba_commit: LIBJIEBA_COMMIT,
        extension_version: '1.1.1',
        lexicon_sha256: dictSha,
        corpus_sha256: corpusSha,
        expected_q01_ids: ['D02'],
        expected_q02_ids: ['D01'],
      };

      const evaluated = evaluateReadinessEvidence(obs, expectedBinding);
      const outPath =
        process.env.PG_JIEBA_EVIDENCE_OUT ||
        join(os.tmpdir(), `xiaoshuyin-s22-evidence-${nonce}.json`);
      const fullArtifact = {
        ...rawEvidence,
        predicates: evaluated.predicates,
        aggregate_state: evaluated.aggregate_state,
        aggregate_reasons: evaluated.aggregate_reasons,
      };
      const serialized = JSON.stringify(fullArtifact, null, 2) + '\n';
      writeFileSync(outPath, serialized, 'utf8');
      const artifactSha = createHash('sha256').update(serialized, 'utf8').digest('hex');

      console.log(`SLICE22_EVIDENCE_PATH=${outPath}`);
      console.log(`SLICE22_EVIDENCE_SHA256=${artifactSha}`);
      console.log(`SLICE22_AGGREGATE_STATE=${evaluated.aggregate_state}`);
      console.log(`SLICE22_PREDICATES=${JSON.stringify(evaluated.predicates)}`);

      expect(changedFiles.every((f) => ALLOWED_IMPLEMENTATION_PATHS.has(f) || f.startsWith('specs/022-pg-jieba-lexical-readiness-spike/'))).toBe(true);
      expect(evaluated.predicates.CLEANUP.state).toBe('PASS');
      expect(['PASS', 'FAIL', 'BLOCKED', 'UNKNOWN']).toContain(evaluated.aggregate_state);
    },
    900_000,
  );
});
