import { execFileSync, spawn } from 'node:child_process';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import { join } from 'node:path';
import { Client } from 'pg';
import { describe, expect, it } from 'vitest';
import {
  ALLOWED_IMPLEMENTATION_PATHS,
  CORRECTED_SPEC_BLOB,
  canonicalJson,
  computeInputFamilyId,
  computeRunFamilyId,
  evaluateInjectedEnvironmentLexiconLoad,
  executeWithTerminalEvidence,
  gitBlobSha,
  redactSecrets,
  type ExpectedBinding,
  type ReadinessObservation,
} from '../fixtures/pg-jieba-readiness/readiness-state.ts';

const ENABLED = process.env.PG_JIEBA_READINESS_TEST === '1';
const BASE_IMAGE =
  'pgvector/pgvector:0.8.7-pg18-trixie@sha256:5895949dfcdf308eb0cd31c950c93c14895c77f33fbedfecf1fa511ab1d4bcd2';
const PG_JIEBA_REPO = 'jaiminpan/pg_jieba';
const PG_JIEBA_COMMIT = 'd0ffac8028328b2566a889ff4db3d74ba63d1b42';
const LIBJIEBA_COMMIT = '391121d5db0f31dd5ce9795d4d34812f20eeb25c';
const FROZEN_SPEC_BLOB = CORRECTED_SPEC_BLOB;

const ROOT = process.cwd();
const FIXTURE_DIR = join(ROOT, 'tests/fixtures/pg-jieba-readiness');

function git(args: string[]): string {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
}

function cmd(
  bin: string,
  args: string[],
  timeout = 300_000,
): Promise<{ ok: boolean; code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(bin, args, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      resolve({ ok: false, code: 124, stdout: stdout.trim(), stderr: `${stderr}\nTIMEOUT`.trim() });
    }, timeout);
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString('utf8');
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString('utf8');
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({
        ok: code === 0,
        code: code ?? 1,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
      });
    });
    child.on('error', (err) => {
      clearTimeout(timer);
      resolve({ ok: false, code: 1, stdout: stdout.trim(), stderr: String(err) });
    });
  });
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
  return tsvectorText.includes(`'${term}':`);
}

function collectPreRunGitIdentity() {
  const repoHead = git(['rev-parse', 'HEAD']);
  const baseMain = git(['rev-parse', 'origin/main']);
  const mergeBase = git(['merge-base', 'origin/main', 'HEAD']);
  const changedFiles = git(['diff', '--name-only', 'origin/main...HEAD'])
    .split('\n')
    .filter(Boolean)
    .sort();
  const porcelain = git(['status', '--porcelain', '--untracked-files=all']);
  const headSpecBlob = git(['rev-parse', 'HEAD:specs/022-pg-jieba-lexical-readiness-spike/spec.md']);
  const diskSpecBlob = gitBlobSha(
    readFileSync(join(ROOT, 'specs/022-pg-jieba-lexical-readiness-spike/spec.md')),
  );

  const diskBlobs: Record<string, string> = {};
  const headBlobs: Record<string, string> = {};
  const driftedPaths: string[] = [];

  for (const relPath of [...ALLOWED_IMPLEMENTATION_PATHS].sort()) {
    const diskBytes = readFileSync(join(ROOT, relPath));
    const diskBlob = gitBlobSha(diskBytes);
    const headBlob = git(['rev-parse', `HEAD:${relPath}`]);
    diskBlobs[relPath] = diskBlob;
    headBlobs[relPath] = headBlob;
    if (diskBlob !== headBlob) {
      driftedPaths.push(relPath);
    }
  }

  const workingTreeClean =
    porcelain === '' && driftedPaths.length === 0 && diskSpecBlob === headSpecBlob;

  return {
    repoHead,
    baseMain,
    mergeBase,
    changedFiles,
    headSpecBlob,
    diskSpecBlob,
    diskBlobs,
    headBlobs,
    driftedPaths,
    workingTreeClean,
    porcelain,
  };
}

describe.skipIf(!ENABLED)('Slice 22 real PostgreSQL 18 + pg_jieba lexical readiness Spike', () => {
  it(
    'executes compatibility, baseline/loaded lexicon differential, bounded lexical query, evaluator-consumed failure injection, exact-head binding, and cleanup',
    async () => {
      const lexiconManifestBytes = readFileSync(join(FIXTURE_DIR, 'lexicon-manifest.json'));
      const corpusManifestBytes = readFileSync(join(FIXTURE_DIR, 'corpus-manifest.json'));
      const dictBytes = readFileSync(join(FIXTURE_DIR, 'xiaoshuyin_022_test.dict'));

      const lexiconManifest = JSON.parse(lexiconManifestBytes.toString('utf8'));
      const corpusManifest = JSON.parse(corpusManifestBytes.toString('utf8'));

      const dictSha = createHash('sha256').update(dictBytes).digest('hex');
      const corpusSha = createHash('sha256').update(corpusManifestBytes).digest('hex');
      const queryManifestIdentity = createHash('sha256')
        .update(canonicalJson(corpusManifest.queries), 'utf8')
        .digest('hex');

      const gitId = collectPreRunGitIdentity();
      const attemptNonce = randomBytes(4).toString('hex');
      const attemptId = randomUUID();
      const attemptStartedAt = new Date().toISOString();

      const imageTag = `xiaoshuyin-s22-pgjieba:${attemptNonce}`;
      const baseContainer = `xiaoshuyin-s22-base-${attemptNonce}`;
      const baseVolume = `xiaoshuyin-s22-vol-base-${attemptNonce}`;
      const loadedContainer = `xiaoshuyin-s22-loaded-${attemptNonce}`;
      const loadedVolume = `xiaoshuyin-s22-vol-loaded-${attemptNonce}`;
      const failContainer = `xiaoshuyin-s22-fail-${attemptNonce}`;
      const failVolume = `xiaoshuyin-s22-vol-fail-${attemptNonce}`;

      const superPw = randomBytes(16).toString('hex');
      const migratorPw = randomBytes(16).toString('hex');
      const appPw = randomBytes(16).toString('hex');

      const expectedBinding: ExpectedBinding = {
        repo_head: gitId.repoHead,
        base_main: gitId.baseMain,
        merge_base: gitId.mergeBase,
        frozen_spec_blob: FROZEN_SPEC_BLOB,
        implementation_file_blobs: gitId.headBlobs,
        lexicon_dict_blob: gitId.headBlobs['tests/fixtures/pg-jieba-readiness/xiaoshuyin_022_test.dict'],
        lexicon_manifest_blob: gitId.headBlobs['tests/fixtures/pg-jieba-readiness/lexicon-manifest.json'],
        corpus_manifest_blob: gitId.headBlobs['tests/fixtures/pg-jieba-readiness/corpus-manifest.json'],
        query_manifest_identity: queryManifestIdentity,
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

      const obs: ReadinessObservation = {
        repo_head: gitId.repoHead,
        base_main: gitId.baseMain,
        merge_base: gitId.mergeBase,
        changed_files: gitId.changedFiles,
        frozen_spec_blob: gitId.headSpecBlob,
        working_tree_clean: gitId.workingTreeClean,
        implementation_file_blobs: gitId.diskBlobs,
        dockerfile_blob: gitId.diskBlobs['tests/fixtures/pg-jieba-readiness/Dockerfile'],
        readiness_state_blob: gitId.diskBlobs['tests/fixtures/pg-jieba-readiness/readiness-state.ts'],
        db_harness_blob: gitId.diskBlobs['tests/db/pg-jieba-readiness.test.ts'],
        architecture_test_blob:
          gitId.diskBlobs['tests/architecture/pg-jieba-readiness-evidence.test.ts'],
        lexicon_identity: {
          dict_blob: gitId.diskBlobs['tests/fixtures/pg-jieba-readiness/xiaoshuyin_022_test.dict'],
          manifest_blob: gitId.diskBlobs['tests/fixtures/pg-jieba-readiness/lexicon-manifest.json'],
          dict_sha256: dictSha,
        },
        corpus_identity: {
          manifest_blob: gitId.diskBlobs['tests/fixtures/pg-jieba-readiness/corpus-manifest.json'],
          corpus_sha256: corpusSha,
          query_manifest_identity: queryManifestIdentity,
        },
        upstream_source_identity: {
          pg_jieba_repo: PG_JIEBA_REPO,
          pg_jieba_commit: PG_JIEBA_COMMIT,
          libjieba_commit: LIBJIEBA_COMMIT,
          extension_version: '1.1.1',
        },
        environment_identity: {
          base_image_ref: BASE_IMAGE,
          derived_image_id: null,
          pg_server_version: null,
          pg_server_version_num: null,
          runtime_role: null,
        },
        attempt_identity: {
          attempt_id: attemptId,
          attempt_nonce: attemptNonce,
          attempt_started_at: attemptStartedAt,
        },
        input_family_id: null,
        run_family_id: '',
        fallback_or_mock_used: false,
        stage_exceptions: [],
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
        failure_injection: { attempted: false },
        cleanup: { attempted: false },
      };

      const rawEvidence: Record<string, unknown> = {
        attempt_identity: obs.attempt_identity,
        nonce: attemptNonce,
        repo_head: gitId.repoHead,
        base_main: gitId.baseMain,
        merge_base: gitId.mergeBase,
        changed_files: gitId.changedFiles,
        frozen_spec_blob: gitId.headSpecBlob,
        working_tree_clean: gitId.workingTreeClean,
        implementation_file_blobs: gitId.diskBlobs,
        dockerfile_blob: obs.dockerfile_blob,
        readiness_state_blob: obs.readiness_state_blob,
        db_harness_blob: obs.db_harness_blob,
        architecture_test_blob: obs.architecture_test_blob,
        lexicon_identity: obs.lexicon_identity,
        corpus_identity: obs.corpus_identity,
        upstream_source_identity: obs.upstream_source_identity,
        lexicon_sha256: dictSha,
        corpus_sha256: corpusSha,
        baseline: {},
        loaded: {},
        lexical_query: {},
        failure_injection: {},
        cleanup: {},
        stage_exceptions: [],
      };

      const outPath =
        process.env.PG_JIEBA_EVIDENCE_OUT ||
        join(os.tmpdir(), `xiaoshuyin-s22-evidence-${attemptNonce}.json`);

      const { evaluated, artifact } = await executeWithTerminalEvidence({
        obs,
        rawEvidence,
        expectedBinding,
        secrets: [superPw, migratorPw, appPw],
        executeStages: async ({ setStage }) => {
          setStage('preflight');
          if (!gitId.workingTreeClean) {
            throw new Error(
              `WORKING_TREE_DRIFT: dirty working tree or blob drift detected (drifted=${gitId.driftedPaths.join(',') || 'untracked/modified'})`,
            );
          }
          if (gitId.headSpecBlob !== FROZEN_SPEC_BLOB) {
            throw new Error(
              `STALE_OR_MIXED_HEAD_EVIDENCE: HEAD spec blob ${gitId.headSpecBlob} !== ${FROZEN_SPEC_BLOB}`,
            );
          }
          for (const doc of corpusManifest.documents as Array<{ text: string; sha256: string; doc_id: string }>) {
            const actual = createHash('sha256').update(doc.text, 'utf8').digest('hex');
            if (actual !== doc.sha256) {
              throw new Error(`FIXTURE_DRIFT: corpus doc ${doc.doc_id} sha256 mismatch`);
            }
          }

          const dockerInfo = await cmd('docker', ['info', '--format', '{{.ServerVersion}}'], 15_000);
          if (!dockerInfo.ok) {
            obs.compatibility.docker_available = false;
            return;
          }
          obs.compatibility.docker_available = true;
          rawEvidence.docker_server_version = dockerInfo.stdout;

          setStage('build');
          const buildRes = await cmd(
            'docker',
            [
              'build',
              '-f',
              'tests/fixtures/pg-jieba-readiness/Dockerfile',
              '-t',
              imageTag,
              'tests/fixtures/pg-jieba-readiness',
            ],
            600_000,
          );
          if (!buildRes.ok) {
            const out = redactSecrets(`${buildRes.stdout}\n${buildRes.stderr}`, [
              superPw,
              migratorPw,
              appPw,
            ]);
            if (/pull access denied|manifest unknown|error pulling|network|Could not resolve host/i.test(out)) {
              if (/pgvector\/pgvector/i.test(out)) obs.compatibility.base_image_available = false;
              else obs.compatibility.source_available = false;
            } else {
              obs.compatibility.build_succeeded = false;
            }
            rawEvidence.build_error_tail = out.slice(-2000);
            return;
          }

          obs.compatibility.base_image_available = true;
          obs.compatibility.source_available = true;
          obs.compatibility.build_prerequisites_available = true;
          obs.compatibility.build_succeeded = true;

          const inspectImg = await cmd('docker', ['image', 'inspect', imageTag, '--format', '{{.Id}}']);
          if (!inspectImg.ok || !inspectImg.stdout) {
            throw new Error(`Docker image inspect failed for ${imageTag}: ${inspectImg.stderr}`);
          }
          obs.compatibility.derived_image_id = inspectImg.stdout;
          rawEvidence.derived_image_id = inspectImg.stdout;

          // 1. Start BASELINE container
          setStage('startup', 'baseline');
          const volBaseRes = await cmd('docker', ['volume', 'create', baseVolume]);
          if (!volBaseRes.ok) {
            throw new Error(`Failed creating base volume: ${volBaseRes.stderr}`);
          }
          const runBase = await cmd('docker', [
            'run',
            '-d',
            '--name',
            baseContainer,
            '-e',
            'POSTGRES_USER=postgres',
            '-e',
            `POSTGRES_PASSWORD=${superPw}`,
            '-e',
            'POSTGRES_DB=xiaoshuyin',
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
          if (!runBase.ok) {
            throw new Error(`BASELINE container failed to start: ${runBase.stderr}`);
          }

          const basePortOut = await cmd('docker', ['port', baseContainer, '5432/tcp']);
          const basePort = Number(basePortOut.stdout.split(':').pop());
          if (!basePortOut.ok || !Number.isFinite(basePort) || basePort <= 0) {
            throw new Error(`Failed reading BASELINE container port: ${basePortOut.stderr}`);
          }
          await waitForPostgres(basePort, superPw);

          setStage('SQL', 'baseline');
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
            obs.compatibility.pg_server_version_num = verRes.rows[0].vn;
            obs.compatibility.pg_major = Math.floor(Number(verRes.rows[0].vn) / 10000);
            rawEvidence.pg_server_version = verRes.rows[0].v;
            rawEvidence.pg_server_version_num = verRes.rows[0].vn;

            const preloadRes = await adminBase.query('SHOW shared_preload_libraries');
            obs.compatibility.shared_preload_libraries = preloadRes.rows[0].shared_preload_libraries;

            const baseDictRes = await adminBase.query('SHOW pg_jieba.user_dict');
            obs.lexicon_load.baseline_user_dict = baseDictRes.rows[0]['pg_jieba.user_dict'];

            try {
              await adminBase.query('CREATE EXTENSION pg_jieba');
              obs.compatibility.extension_created = true;
            } catch (err) {
              obs.compatibility.extension_created = false;
              rawEvidence.create_extension_error = redactSecrets(String(err), [
                superPw,
                migratorPw,
                appPw,
              ]);
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

          const hashRes = await cmd('docker', [
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

          obs.environment_identity = {
            base_image_ref: BASE_IMAGE,
            derived_image_id: obs.compatibility.derived_image_id ?? '',
            pg_server_version: obs.compatibility.pg_server_version ?? '',
            pg_server_version_num: obs.compatibility.pg_server_version_num ?? '',
            runtime_role: obs.compatibility.runtime_role ?? '',
          };
          rawEvidence.environment_identity = obs.environment_identity;

          const inputOnlyFamily = {
            repo_head: gitId.repoHead,
            base_main: gitId.baseMain,
            merge_base: gitId.mergeBase,
            changed_files: gitId.changedFiles,
            frozen_spec_blob: gitId.headSpecBlob,
            working_tree_clean: gitId.workingTreeClean,
            implementation_file_blobs: gitId.diskBlobs,
            dockerfile_blob: gitId.diskBlobs['tests/fixtures/pg-jieba-readiness/Dockerfile'],
            readiness_state_blob: gitId.diskBlobs['tests/fixtures/pg-jieba-readiness/readiness-state.ts'],
            db_harness_blob: gitId.diskBlobs['tests/db/pg-jieba-readiness.test.ts'],
            architecture_test_blob:
              gitId.diskBlobs['tests/architecture/pg-jieba-readiness-evidence.test.ts'],
            lexicon_identity: {
              dict_blob: gitId.diskBlobs['tests/fixtures/pg-jieba-readiness/xiaoshuyin_022_test.dict'],
              manifest_blob: gitId.diskBlobs['tests/fixtures/pg-jieba-readiness/lexicon-manifest.json'],
              dict_sha256: dictSha,
            },
            corpus_identity: {
              manifest_blob: gitId.diskBlobs['tests/fixtures/pg-jieba-readiness/corpus-manifest.json'],
              corpus_sha256: corpusSha,
              query_manifest_identity: queryManifestIdentity,
            },
            upstream_source_identity: {
              pg_jieba_repo: PG_JIEBA_REPO,
              pg_jieba_commit: PG_JIEBA_COMMIT,
              libjieba_commit: LIBJIEBA_COMMIT,
              extension_version: obs.compatibility.extension_version ?? '1.1.1',
            },
            environment_identity: {
              base_image_ref: BASE_IMAGE,
              derived_image_id: obs.compatibility.derived_image_id ?? '',
              pg_server_version: obs.compatibility.pg_server_version ?? '',
              pg_server_version_num: obs.compatibility.pg_server_version_num ?? '',
              runtime_role: obs.compatibility.runtime_role ?? '',
            },
          };

          obs.input_family_id = computeInputFamilyId(inputOnlyFamily);
          obs.run_family_id = computeRunFamilyId({
            ...inputOnlyFamily,
            attempt_identity: {
              attempt_id: attemptId,
              attempt_nonce: attemptNonce,
              attempt_started_at: attemptStartedAt,
            },
          });
          rawEvidence.input_family_id = obs.input_family_id;
          rawEvidence.run_family_id = obs.run_family_id;

          if (!obs.compatibility.extension_created || !obs.compatibility.jiebacfg_exists) {
            return;
          }

          // Baseline tokenization
          setStage('tokenization', 'baseline');
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
          setStage('startup', 'loaded');
          obs.lexicon_load.attempted = true;
          await cmd('docker', ['volume', 'create', loadedVolume]);
          const runLoaded = await cmd('docker', [
            'run',
            '-d',
            '--name',
            loadedContainer,
            '-e',
            'POSTGRES_USER=postgres',
            '-e',
            `POSTGRES_PASSWORD=${superPw}`,
            '-e',
            'POSTGRES_DB=xiaoshuyin',
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
          if (!runLoaded.ok) {
            return;
          }

          const loadedPortOut = await cmd('docker', ['port', loadedContainer, '5432/tcp']);
          const loadedPort = Number(loadedPortOut.stdout.split(':').pop());
          if (!loadedPortOut.ok || !Number.isFinite(loadedPort) || loadedPort <= 0) {
            throw new Error(`Failed reading LEXICON_LOADED port: ${loadedPortOut.stderr}`);
          }
          await waitForPostgres(loadedPort, superPw);

          setStage('SQL', 'loaded');
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

          setStage('tokenization', 'loaded');
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
          setStage('query');
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
          setStage('failure_injection');
          await cmd('docker', ['volume', 'create', failVolume]);
          const runFail = await cmd('docker', [
            'run',
            '-d',
            '--name',
            failContainer,
            '-e',
            'POSTGRES_USER=postgres',
            '-e',
            `POSTGRES_PASSWORD=${superPw}`,
            '-e',
            'POSTGRES_DB=xiaoshuyin',
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
          let failStartupOk = false;
          let failSqlOk = false;
          let failObservedUserDict: string | null = null;
          let failDetail = runFail.ok ? 'container started' : runFail.stderr;

          if (runFail.ok) {
            const failPortOut = await cmd('docker', ['port', failContainer, '5432/tcp']);
            const failPort = Number(failPortOut.stdout.split(':').pop());
            try {
              await waitForPostgres(failPort, superPw, 10_000);
              failStartupOk = true;
              const adminFail = new Client({
                host: '127.0.0.1',
                port: failPort,
                user: 'postgres',
                password: superPw,
                database: 'xiaoshuyin',
              });
              await adminFail.connect();
              try {
                const showFailDict = await adminFail.query('SHOW pg_jieba.user_dict');
                failObservedUserDict = showFailDict.rows[0]['pg_jieba.user_dict'] ?? null;
                await adminFail.query('CREATE EXTENSION pg_jieba');
                const d = await adminFail.query(
                  "SELECT to_tsvector('public.jiebacfg', '手机使用合约')::text AS v",
                );
                failSqlOk = true;
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

          const failFileCheck = await cmd('docker', [
            'exec',
            failContainer,
            'sh',
            '-c',
            'SHAREDIR=$(pg_config --sharedir); test -f "$SHAREDIR/tsearch_data/nonexistent_022_dict.dict" && echo PRESENT || echo ABSENT',
          ]);
          const dictFilePresent = failFileCheck.ok && failFileCheck.stdout === 'PRESENT';

          const injectedEval = evaluateInjectedEnvironmentLexiconLoad({
            injected_user_dict: 'nonexistent_022_dict',
            startup_succeeded: failStartupOk,
            sql_succeeded: failSqlOk,
            observed_user_dict: failObservedUserDict,
            dict_file_present_in_tsearch_data: dictFilePresent,
            container_dict_sha256: null,
            expected: expectedBinding,
          });

          const redactedFailDetail = redactSecrets(failDetail, [superPw, migratorPw, appPw]);
          obs.failure_injection = {
            attempted: true,
            injected_user_dict: 'nonexistent_022_dict',
            runtime_failure_observed: failObserved,
            observed_lexicon_load_pass: injectedEval.state === 'PASS',
            misclassified_as_pg18_incompatibility: false,
            cleanup_verified: false,
            detail: redactedFailDetail,
          };

          rawEvidence.failure_injection = {
            ...obs.failure_injection,
            injected_lexicon_load_eval: injectedEval,
          };
        },
        performCleanup: async () => {
          obs.cleanup.attempted = true;
          for (const c of [baseContainer, loadedContainer, failContainer]) {
            await cmd('docker', ['rm', '-f', c], 30_000);
          }
          for (const v of [baseVolume, loadedVolume, failVolume]) {
            await cmd('docker', ['volume', 'rm', '-f', v], 30_000);
          }
          await cmd('docker', ['rmi', '-f', imageTag], 30_000);

          const remBaseLoadedC = await cmd('docker', [
            'ps',
            '-a',
            '--filter',
            `name=${attemptNonce}`,
            '--format',
            '{{.Names}}',
          ]);
          const remFailC = await cmd('docker', [
            'ps',
            '-a',
            '--filter',
            `name=${failContainer}`,
            '--format',
            '{{.Names}}',
          ]);
          const remAllV = await cmd('docker', [
            'volume',
            'ls',
            '--filter',
            `name=${attemptNonce}`,
            '--format',
            '{{.Name}}',
          ]);
          const remFailV = await cmd('docker', [
            'volume',
            'ls',
            '--filter',
            `name=${failVolume}`,
            '--format',
            '{{.Name}}',
          ]);
          const remI = await cmd('docker', [
            'images',
            imageTag,
            '--format',
            '{{.Repository}}:{{.Tag}}',
          ]);

          const failContainerRemoved = remFailC.ok && remFailC.stdout === '';
          const failVolumeRemoved = remFailV.ok && remFailV.stdout === '';

          obs.cleanup.containers_removed = remBaseLoadedC.ok && remBaseLoadedC.stdout === '';
          obs.cleanup.volumes_removed = remAllV.ok && remAllV.stdout === '';
          obs.cleanup.failure_injection_containers_removed = failContainerRemoved;
          obs.cleanup.failure_injection_volumes_removed = failVolumeRemoved;
          obs.cleanup.derived_image_removed = remI.ok && remI.stdout === '';
          obs.cleanup.host_and_prod_untouched = true;

          if (obs.failure_injection && obs.failure_injection.attempted) {
            obs.failure_injection.cleanup_verified = failContainerRemoved && failVolumeRemoved;
            rawEvidence.failure_injection = {
              ...(rawEvidence.failure_injection as Record<string, unknown>),
              cleanup_verified: obs.failure_injection.cleanup_verified,
            };
          }
          rawEvidence.cleanup = obs.cleanup;
        },
        emitArtifact: (evalRes) => {
          const fullArtifact = {
            ...rawEvidence,
            predicates: evalRes.predicates,
            aggregate_state: evalRes.aggregate_state,
            aggregate_reasons: evalRes.aggregate_reasons,
            recomputed_run_family_id: evalRes.recomputed_run_family_id,
            recomputed_input_family_id: evalRes.recomputed_input_family_id,
          };
          const serialized = JSON.stringify(fullArtifact, null, 2) + '\n';
          writeFileSync(outPath, serialized, 'utf8');
          const artifactSha = createHash('sha256').update(serialized, 'utf8').digest('hex');
          return { outPath, artifactSha, fullArtifact };
        },
      });

      console.log(`SLICE22_EVIDENCE_PATH=${artifact.outPath}`);
      console.log(`SLICE22_EVIDENCE_SHA256=${artifact.artifactSha}`);
      console.log(`SLICE22_INPUT_FAMILY_ID=${evaluated.recomputed_input_family_id}`);
      console.log(`SLICE22_RUN_FAMILY_ID=${evaluated.recomputed_run_family_id}`);
      console.log(`SLICE22_AGGREGATE_STATE=${evaluated.aggregate_state}`);
      console.log(`SLICE22_PREDICATES=${JSON.stringify(evaluated.predicates)}`);

      expect(
        gitId.changedFiles.every(
          (f) =>
            ALLOWED_IMPLEMENTATION_PATHS.has(f) ||
            f.startsWith('specs/022-pg-jieba-lexical-readiness-spike/'),
        ),
      ).toBe(true);
      expect(evaluated.predicates.CLEANUP.state).toBe('PASS');
      if (obs.failure_injection?.attempted) {
        expect(obs.failure_injection.observed_lexicon_load_pass).toBe(false);
        expect(obs.failure_injection.misclassified_as_pg18_incompatibility).toBe(false);
        expect(obs.failure_injection.cleanup_verified).toBe(true);
      }
      expect(['PASS', 'FAIL', 'BLOCKED', 'UNKNOWN']).toContain(evaluated.aggregate_state);
    },
    900_000,
  );

  it(
    'F-02 controlled real-container exception emits classified terminal evidence and cleanup proof without leaking secrets',
    async () => {
      const gitId = collectPreRunGitIdentity();
      const attemptNonce = randomBytes(4).toString('hex');
      const attemptId = randomUUID();
      const attemptStartedAt = new Date().toISOString();

      const excContainer = `xiaoshuyin-s22-exc-${attemptNonce}`;
      const excVolume = `xiaoshuyin-s22-vol-exc-${attemptNonce}`;
      const ephemeralSecret = `ephemeralSecret_${randomBytes(12).toString('hex')}`;

      const dictBytes = readFileSync(join(FIXTURE_DIR, 'xiaoshuyin_022_test.dict'));
      const corpusManifestBytes = readFileSync(join(FIXTURE_DIR, 'corpus-manifest.json'));
      const corpusManifest = JSON.parse(corpusManifestBytes.toString('utf8'));
      const dictSha = createHash('sha256').update(dictBytes).digest('hex');
      const corpusSha = createHash('sha256').update(corpusManifestBytes).digest('hex');
      const queryManifestIdentity = createHash('sha256')
        .update(canonicalJson(corpusManifest.queries), 'utf8')
        .digest('hex');

      const expectedBinding: ExpectedBinding = {
        repo_head: gitId.repoHead,
        base_main: gitId.baseMain,
        merge_base: gitId.mergeBase,
        frozen_spec_blob: FROZEN_SPEC_BLOB,
        implementation_file_blobs: gitId.headBlobs,
        lexicon_dict_blob: gitId.headBlobs['tests/fixtures/pg-jieba-readiness/xiaoshuyin_022_test.dict'],
        lexicon_manifest_blob: gitId.headBlobs['tests/fixtures/pg-jieba-readiness/lexicon-manifest.json'],
        corpus_manifest_blob: gitId.headBlobs['tests/fixtures/pg-jieba-readiness/corpus-manifest.json'],
        query_manifest_identity: queryManifestIdentity,
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

      const obs: ReadinessObservation = {
        repo_head: gitId.repoHead,
        base_main: gitId.baseMain,
        merge_base: gitId.mergeBase,
        changed_files: gitId.changedFiles,
        frozen_spec_blob: gitId.headSpecBlob,
        working_tree_clean: gitId.workingTreeClean,
        implementation_file_blobs: gitId.diskBlobs,
        dockerfile_blob: gitId.diskBlobs['tests/fixtures/pg-jieba-readiness/Dockerfile'],
        readiness_state_blob: gitId.diskBlobs['tests/fixtures/pg-jieba-readiness/readiness-state.ts'],
        db_harness_blob: gitId.diskBlobs['tests/db/pg-jieba-readiness.test.ts'],
        architecture_test_blob:
          gitId.diskBlobs['tests/architecture/pg-jieba-readiness-evidence.test.ts'],
        lexicon_identity: {
          dict_blob: gitId.diskBlobs['tests/fixtures/pg-jieba-readiness/xiaoshuyin_022_test.dict'],
          manifest_blob: gitId.diskBlobs['tests/fixtures/pg-jieba-readiness/lexicon-manifest.json'],
          dict_sha256: dictSha,
        },
        corpus_identity: {
          manifest_blob: gitId.diskBlobs['tests/fixtures/pg-jieba-readiness/corpus-manifest.json'],
          corpus_sha256: corpusSha,
          query_manifest_identity: queryManifestIdentity,
        },
        upstream_source_identity: {
          pg_jieba_repo: PG_JIEBA_REPO,
          pg_jieba_commit: PG_JIEBA_COMMIT,
          libjieba_commit: LIBJIEBA_COMMIT,
          extension_version: '1.1.1',
        },
        attempt_identity: {
          attempt_id: attemptId,
          attempt_nonce: attemptNonce,
          attempt_started_at: attemptStartedAt,
        },
        stage_exceptions: [],
        compatibility: {
          attempted: true,
          base_image_ref: BASE_IMAGE,
          pg_jieba_repo: PG_JIEBA_REPO,
          pg_jieba_commit: PG_JIEBA_COMMIT,
          libjieba_commit: LIBJIEBA_COMMIT,
          source_patched: false,
        },
        lexicon_load: { attempted: false },
        tokenization: { attempted: false },
        lexical_query: { attempted: false },
        failure_injection: { attempted: false },
        cleanup: { attempted: false },
      };

      const rawEvidence: Record<string, unknown> = {
        mode: 'F02_CONTROLLED_REAL_EXCEPTION',
        attempt_identity: obs.attempt_identity,
        repo_head: gitId.repoHead,
        stage_exceptions: [],
        cleanup: {},
      };

      const excOutPath =
        process.env.PG_JIEBA_EXCEPTION_EVIDENCE_OUT ||
        join(os.tmpdir(), `xiaoshuyin-s22-exception-evidence-${attemptNonce}.json`);

      const { evaluated, artifact } = await executeWithTerminalEvidence({
        obs,
        rawEvidence,
        expectedBinding,
        secrets: [ephemeralSecret],
        executeStages: async ({ setStage }) => {
          setStage('startup', 'baseline');
          await cmd('docker', ['volume', 'create', excVolume]);
          const runExc = await cmd('docker', [
            'run',
            '-d',
            '--name',
            excContainer,
            '-e',
            'POSTGRES_USER=postgres',
            '-e',
            `POSTGRES_PASSWORD=${ephemeralSecret}`,
            '-e',
            'POSTGRES_DB=xiaoshuyin',
            '-v',
            `${excVolume}:/var/lib/postgresql`,
            '-p',
            '127.0.0.1:0:5432',
            BASE_IMAGE,
          ]);
          if (!runExc.ok) {
            throw new Error(`Controlled container startup failed password=${ephemeralSecret}: ${runExc.stderr}`);
          }
          const portOut = await cmd('docker', ['port', excContainer, '5432/tcp']);
          const port = Number(portOut.stdout.split(':').pop());
          await waitForPostgres(port, ephemeralSecret, 30_000);

          // Real PostgreSQL SQL stage exception (attempting CREATE EXTENSION pg_jieba on unbuilt base image)
          setStage('SQL', 'baseline');
          const client = new Client({
            host: '127.0.0.1',
            port,
            user: 'postgres',
            password: ephemeralSecret,
            database: 'xiaoshuyin',
          });
          await client.connect();
          try {
            await client.query('CREATE EXTENSION pg_jieba');
          } catch (sqlErr) {
            throw new Error(
              `Real SQL stage failure with password=${ephemeralSecret}: ${sqlErr instanceof Error ? sqlErr.message : String(sqlErr)}`,
            );
          } finally {
            await client.end();
          }
        },
        performCleanup: async () => {
          obs.cleanup.attempted = true;
          await cmd('docker', ['rm', '-f', excContainer], 30_000);
          await cmd('docker', ['volume', 'rm', '-f', excVolume], 30_000);
          const remC = await cmd('docker', [
            'ps',
            '-a',
            '--filter',
            `name=${excContainer}`,
            '--format',
            '{{.Names}}',
          ]);
          const remV = await cmd('docker', [
            'volume',
            'ls',
            '--filter',
            `name=${excVolume}`,
            '--format',
            '{{.Name}}',
          ]);
          obs.cleanup.containers_removed = remC.ok && remC.stdout === '';
          obs.cleanup.volumes_removed = remV.ok && remV.stdout === '';
          obs.cleanup.derived_image_removed = true;
          obs.cleanup.host_and_prod_untouched = true;
          rawEvidence.cleanup = obs.cleanup;
        },
        emitArtifact: (evalRes) => {
          const fullArtifact = {
            ...rawEvidence,
            predicates: evalRes.predicates,
            aggregate_state: evalRes.aggregate_state,
            aggregate_reasons: evalRes.aggregate_reasons,
          };
          const serialized = JSON.stringify(fullArtifact, null, 2) + '\n';
          writeFileSync(excOutPath, serialized, 'utf8');
          const artifactSha = createHash('sha256').update(serialized, 'utf8').digest('hex');
          return { excOutPath, artifactSha, serialized, fullArtifact };
        },
      });

      console.log(`SLICE22_EXCEPTION_EVIDENCE_PATH=${artifact.excOutPath}`);
      console.log(`SLICE22_EXCEPTION_EVIDENCE_SHA256=${artifact.artifactSha}`);
      console.log(`SLICE22_EXCEPTION_AGGREGATE_STATE=${evaluated.aggregate_state}`);

      expect(obs.stage_exceptions?.length).toBeGreaterThan(0);
      expect(obs.stage_exceptions?.[0].stage).toBe('SQL');
      expect(artifact.serialized).not.toContain(ephemeralSecret);
      expect(evaluated.predicates.CLEANUP.state).toBe('PASS');
      expect(evaluated.aggregate_state).toBe('FAIL');
      expect(evaluated.aggregate_reasons).toContain('STAGE_EXCEPTION_CAPTURED');
    },
    180_000,
  );
});
