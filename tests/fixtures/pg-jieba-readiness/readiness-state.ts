import { createHash } from 'node:crypto';

export const READINESS_STATES = [
  'PASS',
  'FAIL',
  'BLOCKED',
  'UNKNOWN',
  'NOT_EVALUATED',
] as const;

export type ReadinessState = (typeof READINESS_STATES)[number];

export const LOWER_PREDICATE_NAMES = [
  'PG_JIEBA_COMPATIBILITY',
  'LEXICON_LOAD',
  'TOKENIZATION',
  'LEXICAL_QUERY',
  'CLEANUP',
] as const;

export type LowerPredicateName = (typeof LOWER_PREDICATE_NAMES)[number];

export const REASON_CODES = [
  'SOURCE_UNAVAILABLE',
  'BASE_IMAGE_UNAVAILABLE',
  'DOCKER_UNAVAILABLE',
  'BUILD_PREREQUISITE_UNAVAILABLE',
  'PG18_BUILD_INCOMPATIBLE',
  'EXTENSION_INSTALL_INCOMPATIBLE',
  'EXTENSION_LOAD_INCOMPATIBLE',
  'RUNTIME_ROLE_INCOMPATIBLE',
  'IDENTITY_INCOMPLETE',
  'LEXICON_PROVENANCE_INVALID',
  'LEXICON_FINGERPRINT_MISMATCH',
  'LEXICON_LOAD_FAILED',
  'PRIMARY_DIFFERENTIAL_NOT_OBSERVED',
  'TOKENIZATION_FAILED',
  'TOKENIZATION_NON_REPRODUCIBLE',
  'LEXICAL_QUERY_MISMATCH',
  'FALLBACK_FORBIDDEN',
  'FIXTURE_DRIFT',
  'CLEANUP_FAILED',
] as const;

export type ReasonCode = (typeof REASON_CODES)[number];

export interface PredicateResult {
  state: ReadinessState;
  reasons: ReasonCode[];
}

export type LowerPredicates = Record<LowerPredicateName, PredicateResult>;

export interface ExpectedBinding {
  repo_head: string;
  base_main: string;
  merge_base: string;
  frozen_spec_blob: string;
  base_image_ref: string;
  pg_jieba_repo: string;
  pg_jieba_commit: string;
  libjieba_commit: string;
  extension_version: string;
  lexicon_sha256: string;
  corpus_sha256: string;
  expected_q01_ids: string[];
  expected_q02_ids: string[];
}

export interface ReadinessObservation {
  repo_head?: string | null;
  base_main?: string | null;
  merge_base?: string | null;
  changed_files?: string[] | null;
  frozen_spec_blob?: string | null;
  run_family_id?: string | null;
  fallback_or_mock_used?: boolean;
  compatibility: {
    attempted: boolean;
    docker_available?: boolean;
    base_image_available?: boolean;
    source_available?: boolean;
    build_prerequisites_available?: boolean;
    base_image_ref?: string | null;
    derived_image_id?: string | null;
    pg_major?: number | null;
    pg_server_version?: string | null;
    pg_jieba_repo?: string | null;
    pg_jieba_commit?: string | null;
    libjieba_commit?: string | null;
    source_patched?: boolean;
    build_succeeded?: boolean;
    extension_created?: boolean;
    extension_version?: string | null;
    jiebacfg_exists?: boolean;
    shared_preload_libraries?: string | null;
    runtime_role?: string | null;
    runtime_superuser?: boolean | null;
    runtime_bypassrls?: boolean | null;
    runtime_public_create?: boolean | null;
    binary_hashes_present?: boolean;
  };
  lexicon_load: {
    attempted: boolean;
    provenance_valid?: boolean;
    lexicon_sha256?: string | null;
    container_dict_sha256?: string | null;
    baseline_user_dict?: string | null;
    loaded_user_dict?: string | null;
    loaded_startup_succeeded?: boolean;
    used_reload_dict_as_positive_proof?: boolean;
  };
  tokenization: {
    attempted: boolean;
    actual_pg_jieba?: boolean;
    baseline_repetitions?: number;
    loaded_repetitions?: number;
    baseline_stable?: boolean;
    loaded_stable?: boolean;
    baseline_d02_has_primary_term?: boolean;
    loaded_d02_has_primary_term?: boolean;
    raw_outputs_captured?: boolean;
    crash_or_empty_output?: boolean;
  };
  lexical_query: {
    attempted: boolean;
    corpus_sha256?: string | null;
    disposable_in_memory_only?: boolean;
    permanent_index_or_table_created?: boolean;
    ranking_or_fusion_used?: boolean;
    repetitions?: number;
    q01_matched_ids?: string[] | null;
    q02_matched_ids?: string[] | null;
    stable_across_runs?: boolean;
  };
  cleanup: {
    attempted: boolean;
    containers_removed?: boolean;
    volumes_removed?: boolean;
    derived_image_removed?: boolean;
    host_and_prod_untouched?: boolean;
  };
}

export interface EvaluatedReadiness {
  predicates: LowerPredicates;
  aggregate_state: ReadinessState;
  aggregate_reasons: ReasonCode[];
}

export const ALLOWED_IMPLEMENTATION_PATHS = new Set([
  'tests/fixtures/pg-jieba-readiness/Dockerfile',
  'tests/fixtures/pg-jieba-readiness/xiaoshuyin_022_test.dict',
  'tests/fixtures/pg-jieba-readiness/lexicon-manifest.json',
  'tests/fixtures/pg-jieba-readiness/corpus-manifest.json',
  'tests/fixtures/pg-jieba-readiness/readiness-state.ts',
  'tests/architecture/pg-jieba-readiness-evidence.test.ts',
  'tests/db/pg-jieba-readiness.test.ts',
]);

function isValidState(value: unknown): value is ReadinessState {
  return typeof value === 'string' && (READINESS_STATES as readonly string[]).includes(value);
}

/**
 * Pure deterministic aggregate derivation per Plan §15.
 * Never allows manual PASS override.
 */
export function deriveAggregateState(predicates: LowerPredicates): ReadinessState {
  for (const name of LOWER_PREDICATE_NAMES) {
    if (!predicates[name] || !isValidState(predicates[name].state)) {
      return 'UNKNOWN';
    }
  }

  if (predicates.CLEANUP.state === 'FAIL') {
    return 'FAIL';
  }
  for (const name of LOWER_PREDICATE_NAMES) {
    if (predicates[name].state === 'FAIL') {
      return 'FAIL';
    }
  }
  for (const name of LOWER_PREDICATE_NAMES) {
    if (predicates[name].state === 'BLOCKED') {
      return 'BLOCKED';
    }
  }
  for (const name of LOWER_PREDICATE_NAMES) {
    if (predicates[name].state === 'UNKNOWN') {
      return 'UNKNOWN';
    }
  }
  for (const name of LOWER_PREDICATE_NAMES) {
    if (predicates[name].state === 'NOT_EVALUATED') {
      return 'NOT_EVALUATED';
    }
  }
  if (LOWER_PREDICATE_NAMES.every((name) => predicates[name].state === 'PASS')) {
    return 'PASS';
  }
  return 'UNKNOWN';
}

export function computeRunFamilyId(input: {
  repo_head: string;
  base_main: string;
  merge_base: string;
  changed_files: string[];
  frozen_spec_blob: string;
  derived_image_id: string;
  pg_server_version: string;
  pg_jieba_commit: string;
  libjieba_commit: string;
  lexicon_sha256: string;
  corpus_sha256: string;
  salt?: string;
}): string {
  const canonical = JSON.stringify({
    ...input,
    changed_files: [...input.changed_files].sort(),
  });
  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}

function sameArray(actual: string[] | null | undefined, expected: string[]): boolean {
  if (!actual || actual.length !== expected.length) return false;
  return actual.every((v, idx) => v === expected[idx]);
}

function evaluateCompatibility(
  obs: ReadinessObservation,
  expected: ExpectedBinding,
): PredicateResult {
  const c = obs.compatibility;
  if (!c.attempted) {
    return { state: 'NOT_EVALUATED', reasons: [] };
  }
  if (obs.fallback_or_mock_used) {
    return { state: 'FAIL', reasons: ['FALLBACK_FORBIDDEN'] };
  }
  if (c.docker_available === false) {
    return { state: 'BLOCKED', reasons: ['DOCKER_UNAVAILABLE'] };
  }
  if (c.base_image_available === false) {
    return { state: 'BLOCKED', reasons: ['BASE_IMAGE_UNAVAILABLE'] };
  }
  if (c.source_available === false) {
    return { state: 'BLOCKED', reasons: ['SOURCE_UNAVAILABLE'] };
  }
  if (c.build_prerequisites_available === false) {
    return { state: 'BLOCKED', reasons: ['BUILD_PREREQUISITE_UNAVAILABLE'] };
  }
  if (c.source_patched) {
    return { state: 'FAIL', reasons: ['FALLBACK_FORBIDDEN'] };
  }
  if (c.build_succeeded === false) {
    return { state: 'FAIL', reasons: ['PG18_BUILD_INCOMPATIBLE'] };
  }
  if (c.extension_created === false) {
    return { state: 'FAIL', reasons: ['EXTENSION_INSTALL_INCOMPATIBLE'] };
  }
  if (c.jiebacfg_exists === false) {
    return { state: 'FAIL', reasons: ['EXTENSION_LOAD_INCOMPATIBLE'] };
  }
  if (
    c.runtime_role !== undefined &&
    c.runtime_role !== null &&
    (c.runtime_role !== 'xiaoshuyin_app' ||
      c.runtime_superuser !== false ||
      c.runtime_bypassrls !== false ||
      c.runtime_public_create !== false)
  ) {
    return { state: 'FAIL', reasons: ['RUNTIME_ROLE_INCOMPATIBLE'] };
  }
  if (
    !c.derived_image_id ||
    !c.pg_server_version ||
    c.pg_major !== 18 ||
    c.base_image_ref !== expected.base_image_ref ||
    c.pg_jieba_repo !== expected.pg_jieba_repo ||
    c.pg_jieba_commit !== expected.pg_jieba_commit ||
    c.libjieba_commit !== expected.libjieba_commit ||
    c.extension_version !== expected.extension_version ||
    !c.shared_preload_libraries ||
    !c.shared_preload_libraries.includes('pg_jieba') ||
    !c.binary_hashes_present ||
    !c.runtime_role
  ) {
    return { state: 'UNKNOWN', reasons: ['IDENTITY_INCOMPLETE'] };
  }
  if (
    c.build_succeeded === true &&
    c.extension_created === true &&
    c.jiebacfg_exists === true &&
    c.runtime_superuser === false &&
    c.runtime_bypassrls === false &&
    c.runtime_public_create === false
  ) {
    return { state: 'PASS', reasons: [] };
  }
  return { state: 'UNKNOWN', reasons: ['IDENTITY_INCOMPLETE'] };
}

function evaluateLexiconLoad(
  obs: ReadinessObservation,
  expected: ExpectedBinding,
): PredicateResult {
  const l = obs.lexicon_load;
  if (!l.attempted) {
    return { state: 'NOT_EVALUATED', reasons: [] };
  }
  if (l.provenance_valid === false) {
    return { state: 'BLOCKED', reasons: ['LEXICON_PROVENANCE_INVALID'] };
  }
  if (
    !l.lexicon_sha256 ||
    !l.container_dict_sha256 ||
    !l.baseline_user_dict ||
    !l.loaded_user_dict
  ) {
    return { state: 'UNKNOWN', reasons: ['IDENTITY_INCOMPLETE'] };
  }
  if (
    l.lexicon_sha256 !== expected.lexicon_sha256 ||
    l.container_dict_sha256 !== expected.lexicon_sha256
  ) {
    return { state: 'FAIL', reasons: ['LEXICON_FINGERPRINT_MISMATCH'] };
  }
  if (
    l.used_reload_dict_as_positive_proof ||
    l.loaded_startup_succeeded === false ||
    l.baseline_user_dict !== 'jieba_user' ||
    l.loaded_user_dict !== 'jieba_user,xiaoshuyin_022_test'
  ) {
    return { state: 'FAIL', reasons: ['LEXICON_LOAD_FAILED'] };
  }
  if (l.provenance_valid === true && l.loaded_startup_succeeded === true) {
    return { state: 'PASS', reasons: [] };
  }
  return { state: 'UNKNOWN', reasons: ['IDENTITY_INCOMPLETE'] };
}

function evaluateTokenization(obs: ReadinessObservation): PredicateResult {
  const t = obs.tokenization;
  if (!t.attempted) {
    return { state: 'NOT_EVALUATED', reasons: [] };
  }
  if (obs.fallback_or_mock_used || t.actual_pg_jieba === false) {
    return { state: 'FAIL', reasons: ['FALLBACK_FORBIDDEN'] };
  }
  if (t.crash_or_empty_output) {
    return { state: 'FAIL', reasons: ['TOKENIZATION_FAILED'] };
  }
  if (t.baseline_stable === false || t.loaded_stable === false) {
    return { state: 'FAIL', reasons: ['TOKENIZATION_NON_REPRODUCIBLE'] };
  }
  if (
    t.baseline_d02_has_primary_term === true ||
    t.loaded_d02_has_primary_term === false
  ) {
    return { state: 'FAIL', reasons: ['PRIMARY_DIFFERENTIAL_NOT_OBSERVED'] };
  }
  if (
    t.actual_pg_jieba !== true ||
    t.raw_outputs_captured !== true ||
    (t.baseline_repetitions ?? 0) < 3 ||
    (t.loaded_repetitions ?? 0) < 3 ||
    t.baseline_stable !== true ||
    t.loaded_stable !== true ||
    t.baseline_d02_has_primary_term !== false ||
    t.loaded_d02_has_primary_term !== true
  ) {
    return { state: 'UNKNOWN', reasons: ['IDENTITY_INCOMPLETE'] };
  }
  return { state: 'PASS', reasons: [] };
}

function evaluateLexicalQuery(
  obs: ReadinessObservation,
  expected: ExpectedBinding,
): PredicateResult {
  const q = obs.lexical_query;
  if (!q.attempted) {
    return { state: 'NOT_EVALUATED', reasons: [] };
  }
  if (q.ranking_or_fusion_used || q.permanent_index_or_table_created) {
    return { state: 'FAIL', reasons: ['FALLBACK_FORBIDDEN'] };
  }
  if (q.corpus_sha256 && q.corpus_sha256 !== expected.corpus_sha256) {
    return { state: 'FAIL', reasons: ['FIXTURE_DRIFT'] };
  }
  if (
    q.stable_across_runs === false ||
    (q.q01_matched_ids && !sameArray(q.q01_matched_ids, expected.expected_q01_ids)) ||
    (q.q02_matched_ids && !sameArray(q.q02_matched_ids, expected.expected_q02_ids))
  ) {
    return { state: 'FAIL', reasons: ['LEXICAL_QUERY_MISMATCH'] };
  }
  if (
    !q.corpus_sha256 ||
    q.disposable_in_memory_only !== true ||
    (q.repetitions ?? 0) < 3 ||
    !q.q01_matched_ids ||
    !q.q02_matched_ids ||
    q.stable_across_runs !== true
  ) {
    return { state: 'UNKNOWN', reasons: ['IDENTITY_INCOMPLETE'] };
  }
  return { state: 'PASS', reasons: [] };
}

function evaluateCleanup(obs: ReadinessObservation): PredicateResult {
  const cln = obs.cleanup;
  if (!cln.attempted) {
    return { state: 'NOT_EVALUATED', reasons: [] };
  }
  if (
    cln.containers_removed === false ||
    cln.volumes_removed === false ||
    cln.derived_image_removed === false ||
    cln.host_and_prod_untouched === false
  ) {
    return { state: 'FAIL', reasons: ['CLEANUP_FAILED'] };
  }
  if (
    cln.containers_removed === true &&
    cln.volumes_removed === true &&
    cln.derived_image_removed === true &&
    cln.host_and_prod_untouched === true
  ) {
    return { state: 'PASS', reasons: [] };
  }
  return { state: 'UNKNOWN', reasons: ['IDENTITY_INCOMPLETE'] };
}

export function evaluateReadinessEvidence(
  obs: ReadinessObservation,
  expected: ExpectedBinding,
): EvaluatedReadiness {
  const predicates: LowerPredicates = {
    PG_JIEBA_COMPATIBILITY: evaluateCompatibility(obs, expected),
    LEXICON_LOAD: evaluateLexiconLoad(obs, expected),
    TOKENIZATION: evaluateTokenization(obs),
    LEXICAL_QUERY: evaluateLexicalQuery(obs, expected),
    CLEANUP: evaluateCleanup(obs),
  };

  // Enforce exact-head & fixture binding across the entire run family
  const headValid =
    Boolean(obs.repo_head) &&
    obs.repo_head === expected.repo_head &&
    obs.base_main === expected.base_main &&
    obs.merge_base === expected.merge_base &&
    obs.frozen_spec_blob === expected.frozen_spec_blob &&
    Boolean(obs.run_family_id);

  if (!headValid) {
    const anyAttempted = LOWER_PREDICATE_NAMES.some((n) => predicates[n].state !== 'NOT_EVALUATED');
    if (anyAttempted && predicates.PG_JIEBA_COMPATIBILITY.state === 'PASS') {
      predicates.PG_JIEBA_COMPATIBILITY = {
        state: 'UNKNOWN',
        reasons: ['IDENTITY_INCOMPLETE'],
      };
    }
  }

  const aggregate_state = deriveAggregateState(predicates);
  const aggregate_reasons = Array.from(
    new Set(LOWER_PREDICATE_NAMES.flatMap((name) => predicates[name].reasons)),
  );

  return {
    predicates,
    aggregate_state,
    aggregate_reasons,
  };
}
