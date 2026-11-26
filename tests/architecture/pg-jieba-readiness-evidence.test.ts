import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ALLOWED_IMPLEMENTATION_PATHS,
  LOWER_PREDICATE_NAMES,
  READINESS_STATES,
  computeRunFamilyId,
  deriveAggregateState,
  evaluateReadinessEvidence,
  type ExpectedBinding,
  type LowerPredicates,
  type ReadinessObservation,
} from '../fixtures/pg-jieba-readiness/readiness-state.ts';

const FIXTURE_DIR = join(process.cwd(), 'tests/fixtures/pg-jieba-readiness');
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

const BASE_EXPECTED: ExpectedBinding = {
  repo_head: 'a'.repeat(40),
  base_main: 'b'.repeat(40),
  merge_base: 'c'.repeat(40),
  frozen_spec_blob: 'c11c595d3fc9390bb569651562ba52c36cf9546b',
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

function makePassingObservation(): ReadinessObservation {
  return {
    repo_head: BASE_EXPECTED.repo_head,
    base_main: BASE_EXPECTED.base_main,
    merge_base: BASE_EXPECTED.merge_base,
    changed_files: [...ALLOWED_IMPLEMENTATION_PATHS],
    frozen_spec_blob: BASE_EXPECTED.frozen_spec_blob,
    run_family_id: 'rf-123',
    fallback_or_mock_used: false,
    compatibility: {
      attempted: true,
      docker_available: true,
      base_image_available: true,
      source_available: true,
      build_prerequisites_available: true,
      base_image_ref: BASE_EXPECTED.base_image_ref,
      derived_image_id: 'sha256:' + 'd'.repeat(64),
      pg_major: 18,
      pg_server_version: '18.6',
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
    cleanup: {
      attempted: true,
      containers_removed: true,
      volumes_removed: true,
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

  it('derives PASS only when all 5 predicates are PASS', () => {
    const res = evaluateReadinessEvidence(makePassingObservation(), BASE_EXPECTED);
    expect(res.aggregate_state).toBe('PASS');
    expect(res.aggregate_reasons).toEqual([]);
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

describe('Slice 22 adversarial negative classifications (C22-NEG-01..12, C22-HEAD-01..07)', () => {
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

  it('rejects mixed-head or incomplete identity evidence and binds run_family_id deterministically', () => {
    const obsMixed = makePassingObservation();
    obsMixed.repo_head = 'f'.repeat(40);
    const resMixed = evaluateReadinessEvidence(obsMixed, BASE_EXPECTED);
    expect(resMixed.aggregate_state).toBe('UNKNOWN');
    expect(resMixed.aggregate_reasons).toContain('IDENTITY_INCOMPLETE');

    const id1 = computeRunFamilyId({
      repo_head: BASE_EXPECTED.repo_head,
      base_main: BASE_EXPECTED.base_main,
      merge_base: BASE_EXPECTED.merge_base,
      changed_files: [...ALLOWED_IMPLEMENTATION_PATHS],
      frozen_spec_blob: BASE_EXPECTED.frozen_spec_blob,
      derived_image_id: 'img1',
      pg_server_version: '18.6',
      pg_jieba_commit: BASE_EXPECTED.pg_jieba_commit,
      libjieba_commit: BASE_EXPECTED.libjieba_commit,
      lexicon_sha256: dictSha,
      corpus_sha256: corpusSha,
    });
    const id2 = computeRunFamilyId({
      repo_head: BASE_EXPECTED.repo_head,
      base_main: BASE_EXPECTED.base_main,
      merge_base: BASE_EXPECTED.merge_base,
      changed_files: [...ALLOWED_IMPLEMENTATION_PATHS].reverse(),
      frozen_spec_blob: BASE_EXPECTED.frozen_spec_blob,
      derived_image_id: 'img1',
      pg_server_version: '18.6',
      pg_jieba_commit: BASE_EXPECTED.pg_jieba_commit,
      libjieba_commit: BASE_EXPECTED.libjieba_commit,
      lexicon_sha256: dictSha,
      corpus_sha256: corpusSha,
    });
    expect(id1).toBe(id2);
  });
});
