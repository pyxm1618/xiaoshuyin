import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ALLOWED_IMPLEMENTATION_PATHS,
  CORRECTED_SPEC_BLOB,
  LOWER_PREDICATE_NAMES,
  READINESS_STATES,
  canonicalJson,
  computeInputFamilyId,
  computeRunFamilyId,
  deriveAggregateState,
  evaluateInjectedEnvironmentLexiconLoad,
  evaluateReadinessEvidence,
  executeWithTerminalEvidence,
  type ExpectedBinding,
  type LowerPredicates,
  type ReadinessObservation,
  type RunFamilyInput,
} from '../fixtures/pg-jieba-readiness/readiness-state.ts';

const ROOT = process.cwd();
const FIXTURE_DIR = join(ROOT, 'tests/fixtures/pg-jieba-readiness');
const dictBytes = readFileSync(join(FIXTURE_DIR, 'xiaoshuyin_022_test.dict'));
const lexiconManifest = JSON.parse(
  readFileSync(join(FIXTURE_DIR, 'lexicon-manifest.json'), 'utf8'),
);
const corpusManifest = JSON.parse(
  readFileSync(join(FIXTURE_DIR, 'corpus-manifest.json'), 'utf8'),
);
const dictSha = createHash('sha256').update(dictBytes).digest('hex');
const corpusSha = createHash('sha256')
  .update(readFileSync(join(FIXTURE_DIR, 'corpus-manifest.json')))
  .digest('hex');
const queryManifestIdentity = createHash('sha256')
  .update(canonicalJson(corpusManifest.queries), 'utf8')
  .digest('hex');

const BASE_IMPL_BLOBS: Record<string, string> = {
  'tests/fixtures/pg-jieba-readiness/Dockerfile': '1'.repeat(40),
  'tests/fixtures/pg-jieba-readiness/xiaoshuyin_022_test.dict': '2'.repeat(40),
  'tests/fixtures/pg-jieba-readiness/lexicon-manifest.json': '3'.repeat(40),
  'tests/fixtures/pg-jieba-readiness/corpus-manifest.json': '4'.repeat(40),
  'tests/fixtures/pg-jieba-readiness/readiness-state.ts': '5'.repeat(40),
  'tests/architecture/pg-jieba-readiness-evidence.test.ts': '6'.repeat(40),
  'tests/db/pg-jieba-readiness.test.ts': '7'.repeat(40),
};

const BASE_EXPECTED: ExpectedBinding = {
  repo_head: 'a'.repeat(40),
  base_main: 'b'.repeat(40),
  merge_base: 'c'.repeat(40),
  frozen_spec_blob: CORRECTED_SPEC_BLOB,
  implementation_file_blobs: BASE_IMPL_BLOBS,
  lexicon_dict_blob: BASE_IMPL_BLOBS['tests/fixtures/pg-jieba-readiness/xiaoshuyin_022_test.dict'],
  lexicon_manifest_blob: BASE_IMPL_BLOBS['tests/fixtures/pg-jieba-readiness/lexicon-manifest.json'],
  corpus_manifest_blob: BASE_IMPL_BLOBS['tests/fixtures/pg-jieba-readiness/corpus-manifest.json'],
  query_manifest_identity: queryManifestIdentity,
  base_image_ref:
    'pgvector/pgvector:0.8.7-pg18-trixie@sha256:5895949dfcdf308eb0cd31c950c93c14895c77f33fbedfecf1fa511ab1d4bcd2',
  pg_jieba_repo: 'jaiminpan/pg_jieba',
  pg_jieba_commit: 'd0ffac8028328b2566a889ff4db3d74ba63d1b42',
  libjieba_commit: '391121d5db0f31dd5ce9795d4d34812f20eeb25c',
  extension_version: '1.1.1',
  lexicon_sha256: dictSha,
  corpus_sha256: corpusSha,
  expected_q01_ids: ['D02'],
  expected_q02_ids: ['D01'],
};

function makeRunFamilyInput(
  overrides: Partial<RunFamilyInput> = {},
): RunFamilyInput {
  return {
    repo_head: BASE_EXPECTED.repo_head,
    base_main: BASE_EXPECTED.base_main,
    merge_base: BASE_EXPECTED.merge_base,
    changed_files: [...ALLOWED_IMPLEMENTATION_PATHS].sort(),
    frozen_spec_blob: BASE_EXPECTED.frozen_spec_blob,
    working_tree_clean: true,
    implementation_file_blobs: { ...BASE_IMPL_BLOBS },
    dockerfile_blob: BASE_IMPL_BLOBS['tests/fixtures/pg-jieba-readiness/Dockerfile'],
    readiness_state_blob: BASE_IMPL_BLOBS['tests/fixtures/pg-jieba-readiness/readiness-state.ts'],
    db_harness_blob: BASE_IMPL_BLOBS['tests/db/pg-jieba-readiness.test.ts'],
    architecture_test_blob: BASE_IMPL_BLOBS['tests/architecture/pg-jieba-readiness-evidence.test.ts'],
    lexicon_identity: {
      dict_blob: BASE_EXPECTED.lexicon_dict_blob,
      manifest_blob: BASE_EXPECTED.lexicon_manifest_blob,
      dict_sha256: dictSha,
    },
    corpus_identity: {
      manifest_blob: BASE_EXPECTED.corpus_manifest_blob,
      corpus_sha256: corpusSha,
      query_manifest_identity: queryManifestIdentity,
    },
    upstream_source_identity: {
      pg_jieba_repo: BASE_EXPECTED.pg_jieba_repo,
      pg_jieba_commit: BASE_EXPECTED.pg_jieba_commit,
      libjieba_commit: BASE_EXPECTED.libjieba_commit,
      extension_version: BASE_EXPECTED.extension_version,
    },
    environment_identity: {
      base_image_ref: BASE_EXPECTED.base_image_ref,
      derived_image_id: 'sha256:' + 'd'.repeat(64),
      pg_server_version: '18.6',
      pg_server_version_num: '180006',
      runtime_role: 'xiaoshuyin_app',
    },
    attempt_identity: {
      attempt_id: 'attempt-1',
      attempt_nonce: 'nonce-1111',
      attempt_started_at: '2026-11-26T00:00:00.000Z',
    },
    ...overrides,
  };
}

function makePassingObservation(
  attemptOverrides: Partial<RunFamilyInput['attempt_identity']> = {},
): ReadinessObservation {
  const rfInput = makeRunFamilyInput({
    attempt_identity: {
      attempt_id: attemptOverrides.attempt_id ?? 'attempt-1',
      attempt_nonce: attemptOverrides.attempt_nonce ?? 'nonce-1111',
      attempt_started_at: attemptOverrides.attempt_started_at ?? '2026-11-26T00:00:00.000Z',
    },
  });
  const { attempt_identity: _att, ...inputOnly } = rfInput;
  const inputFamilyId = computeInputFamilyId(inputOnly);
  const runFamilyId = computeRunFamilyId(rfInput);

  return {
    repo_head: rfInput.repo_head,
    base_main: rfInput.base_main,
    merge_base: rfInput.merge_base,
    changed_files: [...rfInput.changed_files],
    frozen_spec_blob: rfInput.frozen_spec_blob,
    working_tree_clean: rfInput.working_tree_clean,
    implementation_file_blobs: { ...rfInput.implementation_file_blobs },
    dockerfile_blob: rfInput.dockerfile_blob,
    readiness_state_blob: rfInput.readiness_state_blob,
    db_harness_blob: rfInput.db_harness_blob,
    architecture_test_blob: rfInput.architecture_test_blob,
    lexicon_identity: { ...rfInput.lexicon_identity },
    corpus_identity: { ...rfInput.corpus_identity },
    upstream_source_identity: { ...rfInput.upstream_source_identity },
    environment_identity: { ...rfInput.environment_identity },
    attempt_identity: { ...rfInput.attempt_identity },
    input_family_id: inputFamilyId,
    run_family_id: runFamilyId,
    fallback_or_mock_used: false,
    stage_exceptions: [],
    compatibility: {
      attempted: true,
      docker_available: true,
      base_image_available: true,
      source_available: true,
      build_prerequisites_available: true,
      base_image_ref: BASE_EXPECTED.base_image_ref,
      derived_image_id: rfInput.environment_identity.derived_image_id,
      pg_major: 18,
      pg_server_version: rfInput.environment_identity.pg_server_version,
      pg_server_version_num: rfInput.environment_identity.pg_server_version_num,
      pg_jieba_repo: BASE_EXPECTED.pg_jieba_repo,
      pg_jieba_commit: BASE_EXPECTED.pg_jieba_commit,
      libjieba_commit: BASE_EXPECTED.libjieba_commit,
      source_patched: false,
      build_succeeded: true,
      extension_created: true,
      extension_version: '1.1.1',
      jiebacfg_exists: true,
      shared_preload_libraries: 'pg_jieba',
      runtime_role: 'xiaoshuyin_app',
      runtime_superuser: false,
      runtime_bypassrls: false,
      runtime_public_create: false,
      binary_hashes_present: true,
    },
    lexicon_load: {
      attempted: true,
      provenance_valid: true,
      lexicon_sha256: dictSha,
      container_dict_sha256: dictSha,
      baseline_user_dict: 'jieba_user',
      loaded_user_dict: 'jieba_user,xiaoshuyin_022_test',
      loaded_startup_succeeded: true,
      used_reload_dict_as_positive_proof: false,
    },
    tokenization: {
      attempted: true,
      actual_pg_jieba: true,
      baseline_repetitions: 3,
      loaded_repetitions: 3,
      baseline_stable: true,
      loaded_stable: true,
      baseline_d02_has_primary_term: false,
      loaded_d02_has_primary_term: true,
      raw_outputs_captured: true,
      crash_or_empty_output: false,
    },
    lexical_query: {
      attempted: true,
      corpus_sha256: corpusSha,
      disposable_in_memory_only: true,
      permanent_index_or_table_created: false,
      ranking_or_fusion_used: false,
      repetitions: 3,
      q01_matched_ids: ['D02'],
      q02_matched_ids: ['D01'],
      stable_across_runs: true,
    },
    failure_injection: {
      attempted: true,
      injected_user_dict: 'nonexistent_022_dict',
      runtime_failure_observed: true,
      observed_lexicon_load_pass: false,
      misclassified_as_pg18_incompatibility: false,
      cleanup_verified: true,
      detail: 'nonexistent_022_dict failed startup as expected',
    },
    cleanup: {
      attempted: true,
      containers_removed: true,
      volumes_removed: true,
      failure_injection_containers_removed: true,
      failure_injection_volumes_removed: true,
      derived_image_removed: true,
      host_and_prod_untouched: true,
    },
  };
}

describe('Slice 22 frozen fixtures & provenance (C22-AUTH, C22-LEX, C22-CORP)', () => {
  it('freezes exactly 3 authorized formal terms with no frequency or POS tags', () => {
    const lines = dictBytes.toString('utf8').trimEnd().split('\n');
    expect(lines).toEqual(['家庭联盟', '手机使用合约', '小树荫']);
    expect(lexiconManifest.dictionary_filename).toBe('xiaoshuyin_022_test.dict');
    expect(lexiconManifest.dictionary_sha256).toBe(dictSha);
    expect(lexiconManifest.primary_differential_term).toBe('手机使用合约');
    expect(lexiconManifest.primary_differential_probe_doc_id).toBe('D02');
    expect(lexiconManifest.terms).toHaveLength(3);
    for (const term of lexiconManifest.terms) {
      expect(term.source_path).toBe('Docs/总产品需求.md');
      expect(term.source_blob).toBe('97c69bb8d9c7c42070f5763fe81a3ab1ae2ecf29');
      expect(term.test_use_permission).toBe('FROZEN_SPEC_OPTION_A_FORMAL_TERM');
      expect(term.no_new_professional_judgment).toBe(true);
    }
  });

  it('freezes exactly 4 corpus docs and 2 literal queries with SHA-256 verification', () => {
    expect(corpusManifest.privacy_classification).toBe('NON_PERSONAL_FORMAL_PRODUCT_DOC');
    expect(corpusManifest.permission).toBe('FROZEN_SPEC_PERMITTED_FORMAL_DOC_FIXTURE');
    expect(corpusManifest.documents.map((d: any) => d.doc_id)).toEqual(['D01', 'D02', 'D03', 'D04']);
    for (const doc of corpusManifest.documents) {
      const actual = createHash('sha256').update(doc.text, 'utf8').digest('hex');
      expect(doc.sha256).toBe(actual);
    }
    expect(corpusManifest.queries.map((q: any) => q.query_id)).toEqual(['Q01', 'Q02']);
    expect(corpusManifest.queries[0].expected_literal_match_ids).toEqual(['D02']);
    expect(corpusManifest.queries[1].expected_literal_match_ids).toEqual(['D01']);
  });
});

describe('Slice 22 evidence state machine & precedence (C22-STATE-01..10)', () => {
  it('enforces exact 5 predicates and state vocabulary', () => {
    expect(LOWER_PREDICATE_NAMES).toHaveLength(5);
    expect(READINESS_STATES).toEqual(['PASS', 'FAIL', 'BLOCKED', 'UNKNOWN', 'NOT_EVALUATED']);
  });

  it('derives PASS only when all 5 predicates, failure_injection, clean tree, and recomputed run_family_id pass', () => {
    const obs = makePassingObservation();
    const res = evaluateReadinessEvidence(obs, BASE_EXPECTED);
    expect(res.aggregate_state).toBe('PASS');
    expect(res.aggregate_reasons).toEqual([]);
    expect(res.recomputed_run_family_id).toBe(obs.run_family_id);
    expect(res.recomputed_input_family_id).toBe(obs.input_family_id);
  });

  it('gives CLEANUP FAIL highest precedence over all other predicates', () => {
    const predicates: LowerPredicates = {
      PG_JIEBA_COMPATIBILITY: { state: 'BLOCKED', reasons: ['DOCKER_UNAVAILABLE'] },
      LEXICON_LOAD: { state: 'UNKNOWN', reasons: ['IDENTITY_INCOMPLETE'] },
      TOKENIZATION: { state: 'NOT_EVALUATED', reasons: [] },
      LEXICAL_QUERY: { state: 'PASS', reasons: [] },
      CLEANUP: { state: 'FAIL', reasons: ['CLEANUP_FAILED'] },
    };
    expect(deriveAggregateState(predicates)).toBe('FAIL');
  });

  it.each<[string, Partial<Record<keyof LowerPredicates, 'PASS' | 'FAIL' | 'BLOCKED' | 'UNKNOWN' | 'NOT_EVALUATED'>>, string]>([
    ['any FAIL -> FAIL', { TOKENIZATION: 'FAIL', LEXICAL_QUERY: 'BLOCKED' }, 'FAIL'],
    ['no FAIL + BLOCKED -> BLOCKED', { PG_JIEBA_COMPATIBILITY: 'BLOCKED', LEXICON_LOAD: 'UNKNOWN' }, 'BLOCKED'],
    ['no FAIL/BLOCKED + UNKNOWN -> UNKNOWN', { LEXICON_LOAD: 'UNKNOWN', TOKENIZATION: 'NOT_EVALUATED' }, 'UNKNOWN'],
    ['PASS + NOT_EVALUATED -> NOT_EVALUATED', { LEXICAL_QUERY: 'NOT_EVALUATED' }, 'NOT_EVALUATED'],
  ])('%s', (_label, overrides, expectedState) => {
    const predicates: LowerPredicates = {
      PG_JIEBA_COMPATIBILITY: { state: overrides.PG_JIEBA_COMPATIBILITY ?? 'PASS', reasons: [] },
      LEXICON_LOAD: { state: overrides.LEXICON_LOAD ?? 'PASS', reasons: [] },
      TOKENIZATION: { state: overrides.TOKENIZATION ?? 'PASS', reasons: [] },
      LEXICAL_QUERY: { state: overrides.LEXICAL_QUERY ?? 'PASS', reasons: [] },
      CLEANUP: { state: overrides.CLEANUP ?? 'PASS', reasons: [] },
    };
    expect(deriveAggregateState(predicates)).toBe(expectedState);
  });
});

describe('Slice 22 negative classifications (C22-NEG-01..12)', () => {
  it('classifies unavailable Docker/base/source as BLOCKED, never FAIL', () => {
    for (const [patch, reason] of [
      [{ docker_available: false }, 'DOCKER_UNAVAILABLE'],
      [{ base_image_available: false }, 'BASE_IMAGE_UNAVAILABLE'],
      [{ source_available: false }, 'SOURCE_UNAVAILABLE'],
      [{ build_prerequisites_available: false }, 'BUILD_PREREQUISITE_UNAVAILABLE'],
    ] as const) {
      const obs = makePassingObservation();
      obs.compatibility = { ...obs.compatibility, ...patch };
      const res = evaluateReadinessEvidence(obs, BASE_EXPECTED);
      expect(res.predicates.PG_JIEBA_COMPATIBILITY.state).toBe('BLOCKED');
      expect(res.predicates.PG_JIEBA_COMPATIBILITY.reasons).toContain(reason);
      expect(res.aggregate_state).toBe('BLOCKED');
    }
  });

  it('classifies observed PG18 build/install/load/role incompatibility as FAIL, never BLOCKED', () => {
    for (const [patch, reason] of [
      [{ build_succeeded: false }, 'PG18_BUILD_INCOMPATIBLE'],
      [{ extension_created: false }, 'EXTENSION_INSTALL_INCOMPATIBLE'],
      [{ jiebacfg_exists: false }, 'EXTENSION_LOAD_INCOMPATIBLE'],
      [{ runtime_superuser: true }, 'RUNTIME_ROLE_INCOMPATIBLE'],
    ] as const) {
      const obs = makePassingObservation();
      obs.compatibility = { ...obs.compatibility, ...patch };
      const res = evaluateReadinessEvidence(obs, BASE_EXPECTED);
      expect(res.predicates.PG_JIEBA_COMPATIBILITY.state).toBe('FAIL');
      expect(res.predicates.PG_JIEBA_COMPATIBILITY.reasons).toContain(reason);
      expect(res.aggregate_state).toBe('FAIL');
    }
  });

  it('rejects unauthorized lexicon provenance, fingerprint drift, and jieba_reload_dict positive proof', () => {
    const obsProv = makePassingObservation();
    obsProv.lexicon_load.provenance_valid = false;
    expect(evaluateReadinessEvidence(obsProv, BASE_EXPECTED).predicates.LEXICON_LOAD).toEqual({
      state: 'BLOCKED',
      reasons: ['LEXICON_PROVENANCE_INVALID'],
    });

    const obsDrift = makePassingObservation();
    obsDrift.lexicon_load.container_dict_sha256 = '0'.repeat(64);
    expect(evaluateReadinessEvidence(obsDrift, BASE_EXPECTED).predicates.LEXICON_LOAD).toEqual({
      state: 'FAIL',
      reasons: ['LEXICON_FINGERPRINT_MISMATCH'],
    });

    const obsReload = makePassingObservation();
    obsReload.lexicon_load.used_reload_dict_as_positive_proof = true;
    expect(evaluateReadinessEvidence(obsReload, BASE_EXPECTED).predicates.LEXICON_LOAD).toEqual({
      state: 'FAIL',
      reasons: ['LEXICON_LOAD_FAILED'],
    });
  });

  it('rejects fallback/mock tokenizer, missing primary differential, and query mismatch', () => {
    const obsMock = makePassingObservation();
    obsMock.fallback_or_mock_used = true;
    expect(evaluateReadinessEvidence(obsMock, BASE_EXPECTED).aggregate_state).toBe('FAIL');

    const obsDiff = makePassingObservation();
    obsDiff.tokenization.loaded_d02_has_primary_term = false;
    const resDiff = evaluateReadinessEvidence(obsDiff, BASE_EXPECTED);
    expect(resDiff.predicates.TOKENIZATION).toEqual({
      state: 'FAIL',
      reasons: ['PRIMARY_DIFFERENTIAL_NOT_OBSERVED'],
    });
    expect(resDiff.aggregate_state).toBe('FAIL');

    const obsQuery = makePassingObservation();
    obsQuery.lexical_query.q01_matched_ids = ['D01', 'D02'];
    const resQuery = evaluateReadinessEvidence(obsQuery, BASE_EXPECTED);
    expect(resQuery.predicates.LEXICAL_QUERY).toEqual({
      state: 'FAIL',
      reasons: ['LEXICAL_QUERY_MISMATCH'],
    });
    expect(resQuery.aggregate_state).toBe('FAIL');
  });
});

describe('F-01: Failure Injection Enforcement (C22-NEG-13..15)', () => {
  it('fails if failure_injection is bypassed, missing, or only logged as unconsumed failed_as_expected', () => {
    const baselinePass = makePassingObservation();
    expect(evaluateReadinessEvidence(baselinePass, BASE_EXPECTED).aggregate_state).toBe('PASS');

    // Removing or skipping failure_injection on the exact same passing observation MUST fail
    const obsMissing = makePassingObservation();
    obsMissing.failure_injection = null;
    const resMissing = evaluateReadinessEvidence(obsMissing, BASE_EXPECTED);
    expect(resMissing.predicates.LEXICON_LOAD.state).toBe('FAIL');
    expect(resMissing.predicates.LEXICON_LOAD.reasons).toContain('FAILURE_INJECTION_NOT_CONSUMED');
    expect(resMissing.aggregate_state).toBe('FAIL');

    const obsNotAttempted = makePassingObservation();
    obsNotAttempted.failure_injection = { attempted: false };
    const resNotAttempted = evaluateReadinessEvidence(obsNotAttempted, BASE_EXPECTED);
    expect(resNotAttempted.predicates.LEXICON_LOAD.state).toBe('FAIL');
    expect(resNotAttempted.predicates.LEXICON_LOAD.reasons).toContain('FAILURE_INJECTION_NOT_CONSUMED');
    expect(resNotAttempted.aggregate_state).toBe('FAIL');

    const obsUnconsumedFlag = makePassingObservation();
    obsUnconsumedFlag.failure_injection = {
      attempted: true,
      injected_user_dict: 'nonexistent_022_dict',
      failed_as_expected: true,
    };
    const resUnconsumed = evaluateReadinessEvidence(obsUnconsumedFlag, BASE_EXPECTED);
    expect(resUnconsumed.predicates.LEXICON_LOAD.state).toBe('FAIL');
    expect(resUnconsumed.predicates.LEXICON_LOAD.reasons).toContain('FAILURE_INJECTION_NOT_CONSUMED');
    expect(resUnconsumed.aggregate_state).toBe('FAIL');
  });

  it('forces LEXICON_LOAD FAIL and prevents aggregate PASS when nonexistent_022_dict yields LEXICON_LOAD PASS', () => {
    const injectedEval = evaluateInjectedEnvironmentLexiconLoad({
      injected_user_dict: 'nonexistent_022_dict',
      startup_succeeded: true,
      sql_succeeded: true,
      observed_user_dict: 'nonexistent_022_dict',
      dict_file_present_in_tsearch_data: false,
      container_dict_sha256: null,
      expected: BASE_EXPECTED,
    });
    expect(injectedEval.state).toBe('FAIL');
    expect(injectedEval.state).not.toBe('PASS');

    const obsUnexpectedPass = makePassingObservation();
    obsUnexpectedPass.failure_injection = {
      attempted: true,
      injected_user_dict: 'nonexistent_022_dict',
      runtime_failure_observed: false,
      observed_lexicon_load_pass: true,
      misclassified_as_pg18_incompatibility: false,
      cleanup_verified: true,
    };
    const res = evaluateReadinessEvidence(obsUnexpectedPass, BASE_EXPECTED);
    expect(res.predicates.LEXICON_LOAD.state).toBe('FAIL');
    expect(res.predicates.LEXICON_LOAD.reasons).toContain('LEXICON_LOAD_FAILED');
    expect(res.predicates.LEXICON_LOAD.reasons).toContain('FAILURE_INJECTION_UNEXPECTED_PASS');
    expect(res.aggregate_state).toBe('FAIL');
  });

  it('rejects misclassifying failure_injection as PG18 incompatibility and enforces failure_injection cleanup proof', () => {
    const obsMisclassified = makePassingObservation();
    obsMisclassified.failure_injection = {
      attempted: true,
      injected_user_dict: 'nonexistent_022_dict',
      runtime_failure_observed: true,
      observed_lexicon_load_pass: false,
      misclassified_as_pg18_incompatibility: true,
      cleanup_verified: true,
    };
    const resMis = evaluateReadinessEvidence(obsMisclassified, BASE_EXPECTED);
    expect(resMis.aggregate_state).toBe('FAIL');
    expect(resMis.aggregate_reasons).toContain('FAILURE_INJECTION_MISCLASSIFIED_INCOMPATIBLE');

    const obsBadCleanup = makePassingObservation();
    obsBadCleanup.failure_injection!.cleanup_verified = false;
    obsBadCleanup.cleanup.failure_injection_containers_removed = false;
    const resCln = evaluateReadinessEvidence(obsBadCleanup, BASE_EXPECTED);
    expect(resCln.predicates.CLEANUP).toEqual({
      state: 'FAIL',
      reasons: ['CLEANUP_FAILED'],
    });
    expect(resCln.aggregate_state).toBe('FAIL');
  });
});

describe('F-02: Exception Terminal Evidence Lifecycle (C22-EVD-12, C22-CLN-05)', () => {
  it.each([
    ['build', 'PG_JIEBA_COMPATIBILITY', 'PG18_BUILD_INCOMPATIBLE'],
    ['startup', 'PG_JIEBA_COMPATIBILITY', 'EXTENSION_LOAD_INCOMPATIBLE'],
    ['SQL', 'PG_JIEBA_COMPATIBILITY', 'EXTENSION_INSTALL_INCOMPATIBLE'],
    ['tokenization', 'TOKENIZATION', 'TOKENIZATION_FAILED'],
    ['query', 'LEXICAL_QUERY', 'LEXICAL_QUERY_MISMATCH'],
  ] as const)(
    'stage %s exception runs capture -> classify -> cleanup -> terminal evidence artifact without leaking secrets',
    async (stage, expectedPred, expectedReason) => {
      const obs = makePassingObservation();
      obs.stage_exceptions = [];
      const rawEvidence: Record<string, unknown> = {};
      const secret = 'super-secret-pw-9988';
      let cleanupRan = false;
      let artifactEmitted = false;
      let capturedJson = '';

      const { evaluated } = await executeWithTerminalEvidence({
        obs,
        rawEvidence,
        expectedBinding: BASE_EXPECTED,
        secrets: [secret],
        executeStages: async ({ setStage }) => {
          setStage(stage, 'baseline');
          throw new Error(`boom at ${stage} with password=${secret}`);
        },
        performCleanup: async () => {
          cleanupRan = true;
          obs.cleanup.attempted = true;
          obs.cleanup.containers_removed = true;
          obs.cleanup.volumes_removed = true;
          obs.cleanup.failure_injection_containers_removed = true;
          obs.cleanup.failure_injection_volumes_removed = true;
          obs.cleanup.derived_image_removed = true;
          obs.cleanup.host_and_prod_untouched = true;
        },
        emitArtifact: (evalRes) => {
          artifactEmitted = true;
          capturedJson = JSON.stringify({ rawEvidence, evalRes });
          return capturedJson;
        },
      });

      expect(cleanupRan).toBe(true);
      expect(artifactEmitted).toBe(true);
      expect(capturedJson).not.toContain(secret);
      expect(obs.stage_exceptions).toHaveLength(1);
      expect(obs.stage_exceptions![0].stage).toBe(stage);
      expect(evaluated.predicates[expectedPred].state).toBe('FAIL');
      expect(evaluated.predicates[expectedPred].reasons).toContain(expectedReason);
      expect(evaluated.predicates[expectedPred].reasons).toContain('STAGE_EXCEPTION_CAPTURED');
      expect(evaluated.aggregate_state).toBe('FAIL');
    },
  );

  it('captures cleanup stage exceptions without aborting terminal evidence artifact emission', async () => {
    const obs = makePassingObservation();
    obs.stage_exceptions = [];
    const rawEvidence: Record<string, unknown> = {};
    let artifactEmitted = false;

    const { evaluated } = await executeWithTerminalEvidence({
      obs,
      rawEvidence,
      expectedBinding: BASE_EXPECTED,
      executeStages: async ({ setStage }) => {
        setStage('query');
      },
      performCleanup: async () => {
        throw new Error('docker rm failed during cleanup');
      },
      emitArtifact: (evalRes) => {
        artifactEmitted = true;
        return evalRes;
      },
    });

    expect(artifactEmitted).toBe(true);
    expect(evaluated.predicates.CLEANUP.state).toBe('FAIL');
    expect(evaluated.predicates.CLEANUP.reasons).toContain('CLEANUP_FAILED');
    expect(evaluated.predicates.CLEANUP.reasons).toContain('STAGE_EXCEPTION_CAPTURED');
    expect(evaluated.aggregate_state).toBe('FAIL');
  });
});

describe('F-03: Exact-Head & Recomputable Run-Family Adversarial Rejections (C22-HEAD-01..12)', () => {
  it('rejects fake run_family_id (arbitrary strings like rf-123 or random UUID)', () => {
    for (const fakeId of ['rf-123', randomUUID(), 'arbitrary-nonempty-string']) {
      const obs = makePassingObservation();
      obs.run_family_id = fakeId;
      const res = evaluateReadinessEvidence(obs, BASE_EXPECTED);
      expect(res.aggregate_state).toBe('FAIL');
      expect(res.aggregate_reasons).toContain('RUN_FAMILY_ID_MISMATCH');
    }
  });

  it('rejects working-tree drift (working_tree_clean !== true)', () => {
    const obs = makePassingObservation();
    obs.working_tree_clean = false;
    const res = evaluateReadinessEvidence(obs, BASE_EXPECTED);
    expect(res.aggregate_state).toBe('FAIL');
    expect(res.aggregate_reasons).toContain('WORKING_TREE_DRIFT');
  });

  it('rejects fixture drift (lexicon or corpus blob / SHA-256 mismatch)', () => {
    const obsLexDrift = makePassingObservation();
    obsLexDrift.lexicon_identity!.dict_blob = '9'.repeat(40);
    const resLex = evaluateReadinessEvidence(obsLexDrift, BASE_EXPECTED);
    expect(resLex.aggregate_state).toBe('FAIL');
    expect(resLex.aggregate_reasons).toContain('FIXTURE_DRIFT');

    const obsCorpDrift = makePassingObservation();
    obsCorpDrift.corpus_identity!.corpus_sha256 = '8'.repeat(64);
    const resCorp = evaluateReadinessEvidence(obsCorpDrift, BASE_EXPECTED);
    expect(resCorp.aggregate_state).toBe('FAIL');
    expect(resCorp.aggregate_reasons).toContain('FIXTURE_DRIFT');
  });

  it('rejects mixed-head evidence (Dockerfile, readiness-state, DB harness, or architecture test blob drift)', () => {
    for (const field of [
      'dockerfile_blob',
      'readiness_state_blob',
      'db_harness_blob',
      'architecture_test_blob',
    ] as const) {
      const obs = makePassingObservation();
      obs[field] = 'e'.repeat(40);
      const res = evaluateReadinessEvidence(obs, BASE_EXPECTED);
      expect(res.aggregate_state).toBe('FAIL');
      expect(res.aggregate_reasons).toContain('STALE_OR_MIXED_HEAD_EVIDENCE');
    }

    const obsMapDrift = makePassingObservation();
    obsMapDrift.implementation_file_blobs!['tests/fixtures/pg-jieba-readiness/Dockerfile'] =
      'f'.repeat(40);
    const resMap = evaluateReadinessEvidence(obsMapDrift, BASE_EXPECTED);
    expect(resMap.aggregate_state).toBe('FAIL');
    expect(resMap.aggregate_reasons).toContain('STALE_OR_MIXED_HEAD_EVIDENCE');
  });

  it('rejects head mismatch and stale evidence from a prior commit/attempt', () => {
    const obsHeadMismatch = makePassingObservation();
    obsHeadMismatch.repo_head = 'f'.repeat(40);
    const resMismatch = evaluateReadinessEvidence(obsHeadMismatch, BASE_EXPECTED);
    expect(resMismatch.aggregate_state).toBe('FAIL');
    expect(resMismatch.aggregate_reasons).toContain('STALE_OR_MIXED_HEAD_EVIDENCE');

    // Stale evidence: internally consistent run_family_id built against an older repo_head
    const oldHead = '0'.repeat(40);
    const staleInput = makeRunFamilyInput({ repo_head: oldHead });
    const staleObs = makePassingObservation();
    staleObs.repo_head = oldHead;
    staleObs.run_family_id = computeRunFamilyId(staleInput);
    const resStale = evaluateReadinessEvidence(staleObs, BASE_EXPECTED);
    expect(resStale.aggregate_state).toBe('FAIL');
    expect(resStale.aggregate_reasons).toContain('STALE_OR_MIXED_HEAD_EVIDENCE');
    expect(resStale.aggregate_reasons).toContain('RUN_FAMILY_ID_MISMATCH');
  });

  it('rejects incomplete identity as UNKNOWN without passing', () => {
    const obsIncomplete = makePassingObservation();
    obsIncomplete.run_family_id = '';
    obsIncomplete.compatibility.pg_server_version = null;
    obsIncomplete.environment_identity!.pg_server_version = undefined;
    const res = evaluateReadinessEvidence(obsIncomplete, BASE_EXPECTED);
    expect(res.aggregate_state).toBe('UNKNOWN');
    expect(res.aggregate_reasons).toContain('IDENTITY_INCOMPLETE');
  });

  it('produces distinct run_family_id values sharing the same frozen input family across two clean reruns', () => {
    const run1 = makePassingObservation({
      attempt_id: 'attempt-1',
      attempt_nonce: 'aaaa1111',
      attempt_started_at: '2026-11-26T01:00:00.000Z',
    });
    const run2 = makePassingObservation({
      attempt_id: 'attempt-2',
      attempt_nonce: 'bbbb2222',
      attempt_started_at: '2026-11-26T02:00:00.000Z',
    });

    const eval1 = evaluateReadinessEvidence(run1, BASE_EXPECTED);
    const eval2 = evaluateReadinessEvidence(run2, BASE_EXPECTED);

    expect(eval1.aggregate_state).toBe('PASS');
    expect(eval2.aggregate_state).toBe('PASS');
    expect(eval1.recomputed_input_family_id).toBe(eval2.recomputed_input_family_id);
    expect(eval1.recomputed_run_family_id).not.toBe(eval2.recomputed_run_family_id);
  });

  it('verifies DB harness source enforces Corrected Spec blob, terminal-evidence wrapper, failure injection evaluator, and preflight blob checks', () => {
    const dbHarnessSrc = readFileSync(
      join(ROOT, 'tests/db/pg-jieba-readiness.test.ts'),
      'utf8',
    );
    expect(CORRECTED_SPEC_BLOB).toBe('b489bf974032b3bfed678443cda42001ec162f63');
    expect(dbHarnessSrc).toContain('executeWithTerminalEvidence');
    expect(dbHarnessSrc).toContain('evaluateInjectedEnvironmentLexiconLoad');
    expect(dbHarnessSrc).toContain('computeRunFamilyId');
    expect(dbHarnessSrc).toContain('gitBlobSha');
    expect(dbHarnessSrc).toContain('workingTreeClean');
  });
});
