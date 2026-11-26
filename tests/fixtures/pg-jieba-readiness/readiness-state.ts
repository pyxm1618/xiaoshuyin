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

export const EXECUTION_STAGES = [
  'preflight',
  'build',
  'startup',
  'SQL',
  'tokenization',
  'query',
  'failure_injection',
  'cleanup',
] as const;

export type ExecutionStage = (typeof EXECUTION_STAGES)[number];

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
  'RUN_FAMILY_ID_MISMATCH',
  'WORKING_TREE_DRIFT',
  'STALE_OR_MIXED_HEAD_EVIDENCE',
  'LEXICON_PROVENANCE_INVALID',
  'LEXICON_FINGERPRINT_MISMATCH',
  'LEXICON_LOAD_FAILED',
  'FAILURE_INJECTION_NOT_CONSUMED',
  'FAILURE_INJECTION_UNEXPECTED_PASS',
  'FAILURE_INJECTION_MISCLASSIFIED_INCOMPATIBLE',
  'PRIMARY_DIFFERENTIAL_NOT_OBSERVED',
  'TOKENIZATION_FAILED',
  'TOKENIZATION_NON_REPRODUCIBLE',
  'LEXICAL_QUERY_MISMATCH',
  'FALLBACK_FORBIDDEN',
  'FIXTURE_DRIFT',
  'STAGE_EXCEPTION_CAPTURED',
  'CLEANUP_FAILED',
] as const;

export type ReasonCode = (typeof REASON_CODES)[number];

export interface PredicateResult {
  state: ReadinessState;
  reasons: ReasonCode[];
}

export type LowerPredicates = Record<LowerPredicateName, PredicateResult>;

export interface LexiconIdentity {
  dict_blob: string;
  manifest_blob: string;
  dict_sha256: string;
}

export interface CorpusIdentity {
  manifest_blob: string;
  corpus_sha256: string;
  query_manifest_identity: string;
}

export interface UpstreamSourceIdentity {
  pg_jieba_repo: string;
  pg_jieba_commit: string;
  libjieba_commit: string;
  extension_version: string;
}

export interface EnvironmentIdentity {
  base_image_ref: string;
  derived_image_id: string;
  pg_server_version: string;
  pg_server_version_num: string;
  runtime_role: string;
}

export interface AttemptIdentity {
  attempt_id: string;
  attempt_nonce: string;
  attempt_started_at: string;
}

export interface RunFamilyInput {
  repo_head: string;
  base_main: string;
  merge_base: string;
  changed_files: string[];
  frozen_spec_blob: string;
  working_tree_clean: boolean;
  implementation_file_blobs: Record<string, string>;
  dockerfile_blob: string;
  readiness_state_blob: string;
  db_harness_blob: string;
  architecture_test_blob: string;
  lexicon_identity: LexiconIdentity;
  corpus_identity: CorpusIdentity;
  upstream_source_identity: UpstreamSourceIdentity;
  environment_identity: EnvironmentIdentity;
  attempt_identity: AttemptIdentity;
}

export interface ExpectedBinding {
  repo_head: string;
  base_main: string;
  merge_base: string;
  frozen_spec_blob: string;
  implementation_file_blobs: Record<string, string>;
  lexicon_dict_blob: string;
  lexicon_manifest_blob: string;
  corpus_manifest_blob: string;
  query_manifest_identity: string;
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

export interface StageExceptionRecord {
  stage: ExecutionStage;
  error_name: string;
  redacted_message: string;
  classified_predicate: LowerPredicateName;
  classified_state: ReadinessState;
  reason_code: ReasonCode;
  captured_at: string;
}

export interface FailureInjectionObservation {
  attempted: boolean;
  injected_user_dict?: string | null;
  runtime_failure_observed?: boolean;
  observed_lexicon_load_pass?: boolean;
  misclassified_as_pg18_incompatibility?: boolean;
  cleanup_verified?: boolean;
  detail?: string | null;
  /** Legacy unconsumed flag — if present without structured fields, evaluator rejects. */
  failed_as_expected?: boolean;
}

export interface ReadinessObservation {
  repo_head?: string | null;
  base_main?: string | null;
  merge_base?: string | null;
  changed_files?: string[] | null;
  frozen_spec_blob?: string | null;
  working_tree_clean?: boolean | null;
  implementation_file_blobs?: Record<string, string> | null;
  dockerfile_blob?: string | null;
  readiness_state_blob?: string | null;
  db_harness_blob?: string | null;
  architecture_test_blob?: string | null;
  lexicon_identity?: Partial<LexiconIdentity> | null;
  corpus_identity?: Partial<CorpusIdentity> | null;
  upstream_source_identity?: Partial<UpstreamSourceIdentity> | null;
  environment_identity?: Partial<EnvironmentIdentity> | null;
  attempt_identity?: Partial<AttemptIdentity> | null;
  input_family_id?: string | null;
  run_family_id?: string | null;
  fallback_or_mock_used?: boolean;
  stage_exceptions?: StageExceptionRecord[] | null;
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
    pg_server_version_num?: string | null;
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
  failure_injection?: FailureInjectionObservation | null;
  cleanup: {
    attempted: boolean;
    containers_removed?: boolean;
    volumes_removed?: boolean;
    failure_injection_containers_removed?: boolean;
    failure_injection_volumes_removed?: boolean;
    derived_image_removed?: boolean;
    host_and_prod_untouched?: boolean;
  };
}

export interface EvaluatedReadiness {
  predicates: LowerPredicates;
  aggregate_state: ReadinessState;
  aggregate_reasons: ReasonCode[];
  recomputed_run_family_id?: string | null;
  recomputed_input_family_id?: string | null;
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

export const CORRECTED_SPEC_BLOB = 'b489bf974032b3bfed678443cda42001ec162f63';

const PG18_INCOMPATIBILITY_REASONS = new Set<ReasonCode>([
  'PG18_BUILD_INCOMPATIBLE',
  'EXTENSION_INSTALL_INCOMPATIBLE',
  'EXTENSION_LOAD_INCOMPATIBLE',
]);

function isValidState(value: unknown): value is ReadinessState {
  return typeof value === 'string' && (READINESS_STATES as readonly string[]).includes(value);
}

function dedupeReasons(reasons: ReasonCode[]): ReasonCode[] {
  return Array.from(new Set(reasons));
}

function sortJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sortJsonValue(item));
  }
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(record).sort()) {
      const v = record[key];
      if (v !== undefined) {
        sorted[key] = sortJsonValue(v);
      }
    }
    return sorted;
  }
  return value;
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortJsonValue(value));
}

export function gitBlobSha(content: Buffer | string): string {
  const buf = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8');
  const header = Buffer.from(`blob ${buf.length}\0`, 'utf8');
  return createHash('sha1').update(header).update(buf).digest('hex');
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

export function computeInputFamilyId(
  input: Omit<RunFamilyInput, 'attempt_identity'>,
): string {
  const canonical = canonicalJson({
    ...input,
    changed_files: [...input.changed_files].sort(),
  });
  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}

export function computeRunFamilyId(input: RunFamilyInput): string {
  const canonical = canonicalJson({
    ...input,
    changed_files: [...input.changed_files].sort(),
  });
  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}

export function redactSecrets(message: string, secrets: string[] = []): string {
  let out = message;
  for (const s of secrets) {
    if (s && s.length >= 4) {
      out = out.split(s).join('[REDACTED]');
    }
  }
  out = out.replace(/(postgres(?:ql)?:\/\/[^:\s/]+:)[^@\s]+(@)/gi, '$1[REDACTED]$2');
  out = out.replace(
    /\b(POSTGRES_(?:MIGRATOR_|APP_)?PASSWORD|PGPASSWORD|PASSWORD|SECRET|TOKEN|API_KEY)\s*=\s*([^\s'"]+)/gi,
    '$1=[REDACTED]',
  );
  out = out.replace(/(password\s*[:=]\s*['"]?)([^'"\s,}]+)/gi, '$1[REDACTED]');
  return out;
}

export function classifyStageException(
  stage: ExecutionStage,
  err: unknown,
  context: { subphase?: 'baseline' | 'loaded' | 'failure_injection'; secrets?: string[] } = {},
): StageExceptionRecord {
  const errorName = err instanceof Error ? err.name : 'UnknownError';
  const rawMessage = err instanceof Error ? err.message : String(err);
  const redactedMessage = redactSecrets(rawMessage, context.secrets ?? []);
  const capturedAt = new Date().toISOString();

  let classified_predicate: LowerPredicateName = 'PG_JIEBA_COMPATIBILITY';
  let classified_state: ReadinessState = 'FAIL';
  let reason_code: ReasonCode = 'STAGE_EXCEPTION_CAPTURED';

  if (stage === 'cleanup') {
    classified_predicate = 'CLEANUP';
    classified_state = 'FAIL';
    reason_code = 'CLEANUP_FAILED';
  } else if (stage === 'preflight') {
    if (/WORKING_TREE_DRIFT/i.test(rawMessage)) {
      classified_predicate = 'PG_JIEBA_COMPATIBILITY';
      classified_state = 'FAIL';
      reason_code = 'WORKING_TREE_DRIFT';
    } else if (/FIXTURE_DRIFT/i.test(rawMessage)) {
      classified_predicate = 'LEXICON_LOAD';
      classified_state = 'FAIL';
      reason_code = 'FIXTURE_DRIFT';
    } else if (/STALE_OR_MIXED_HEAD_EVIDENCE/i.test(rawMessage)) {
      classified_predicate = 'PG_JIEBA_COMPATIBILITY';
      classified_state = 'FAIL';
      reason_code = 'STALE_OR_MIXED_HEAD_EVIDENCE';
    } else {
      classified_predicate = 'PG_JIEBA_COMPATIBILITY';
      classified_state = 'UNKNOWN';
      reason_code = 'IDENTITY_INCOMPLETE';
    }
  } else if (stage === 'build') {
    classified_predicate = 'PG_JIEBA_COMPATIBILITY';
    if (/pull access denied|manifest unknown|error pulling|network|Could not resolve host/i.test(rawMessage)) {
      classified_state = 'BLOCKED';
      reason_code = /pgvector\/pgvector/i.test(rawMessage)
        ? 'BASE_IMAGE_UNAVAILABLE'
        : 'SOURCE_UNAVAILABLE';
    } else if (/docker.*not found|Cannot connect to the Docker daemon/i.test(rawMessage)) {
      classified_state = 'BLOCKED';
      reason_code = 'DOCKER_UNAVAILABLE';
    } else {
      classified_state = 'FAIL';
      reason_code = 'PG18_BUILD_INCOMPATIBLE';
    }
  } else if (stage === 'startup') {
    if (context.subphase === 'loaded') {
      classified_predicate = 'LEXICON_LOAD';
      classified_state = 'FAIL';
      reason_code = 'LEXICON_LOAD_FAILED';
    } else if (context.subphase === 'failure_injection') {
      classified_predicate = 'LEXICON_LOAD';
      classified_state = 'FAIL';
      reason_code = 'FAILURE_INJECTION_NOT_CONSUMED';
    } else if (/Cannot connect to the Docker daemon|docker.*not found/i.test(rawMessage)) {
      classified_predicate = 'PG_JIEBA_COMPATIBILITY';
      classified_state = 'BLOCKED';
      reason_code = 'DOCKER_UNAVAILABLE';
    } else {
      classified_predicate = 'PG_JIEBA_COMPATIBILITY';
      classified_state = 'FAIL';
      reason_code = 'EXTENSION_LOAD_INCOMPATIBLE';
    }
  } else if (stage === 'SQL') {
    if (context.subphase === 'loaded') {
      classified_predicate = 'LEXICON_LOAD';
      classified_state = 'FAIL';
      reason_code = 'LEXICON_LOAD_FAILED';
    } else if (/role|permission|superuser|bypassrls|public/i.test(rawMessage)) {
      classified_predicate = 'PG_JIEBA_COMPATIBILITY';
      classified_state = 'FAIL';
      reason_code = 'RUNTIME_ROLE_INCOMPATIBLE';
    } else {
      classified_predicate = 'PG_JIEBA_COMPATIBILITY';
      classified_state = 'FAIL';
      reason_code = 'EXTENSION_INSTALL_INCOMPATIBLE';
    }
  } else if (stage === 'tokenization') {
    classified_predicate = 'TOKENIZATION';
    classified_state = 'FAIL';
    reason_code = 'TOKENIZATION_FAILED';
  } else if (stage === 'query') {
    classified_predicate = 'LEXICAL_QUERY';
    classified_state = 'FAIL';
    reason_code = 'LEXICAL_QUERY_MISMATCH';
  } else if (stage === 'failure_injection') {
    classified_predicate = 'LEXICON_LOAD';
    classified_state = 'FAIL';
    reason_code = 'FAILURE_INJECTION_NOT_CONSUMED';
  }

  return {
    stage,
    error_name: errorName,
    redacted_message: redactedMessage,
    classified_predicate,
    classified_state,
    reason_code,
    captured_at: capturedAt,
  };
}

export interface StageExecutionControls {
  setStage: (stage: ExecutionStage, subphase?: 'baseline' | 'loaded' | 'failure_injection') => void;
}

/**
 * Enforces capture -> classify -> cleanup -> terminal evidence artifact across all stages.
 * Never allows uncaught stage or cleanup exceptions to skip terminal evidence emission.
 */
export async function executeWithTerminalEvidence<TArtifact>(params: {
  obs: ReadinessObservation;
  rawEvidence: Record<string, unknown>;
  expectedBinding: ExpectedBinding;
  secrets?: string[];
  executeStages: (controls: StageExecutionControls) => Promise<void>;
  performCleanup: () => Promise<void>;
  emitArtifact: (evaluated: EvaluatedReadiness) => Promise<TArtifact> | TArtifact;
}): Promise<{ evaluated: EvaluatedReadiness; artifact: TArtifact }> {
  const { obs, rawEvidence, expectedBinding, secrets = [], executeStages, performCleanup, emitArtifact } =
    params;
  let currentStage: ExecutionStage = 'preflight';
  let currentSubphase: 'baseline' | 'loaded' | 'failure_injection' | undefined;

  if (!Array.isArray(obs.stage_exceptions)) {
    obs.stage_exceptions = [];
  }

  try {
    await executeStages({
      setStage: (stage, subphase) => {
        currentStage = stage;
        currentSubphase = subphase;
      },
    });
  } catch (err) {
    const rec = classifyStageException(currentStage, err, {
      subphase: currentSubphase,
      secrets,
    });
    obs.stage_exceptions.push(rec);
  } finally {
    try {
      await performCleanup();
    } catch (cleanupErr) {
      const rec = classifyStageException('cleanup', cleanupErr, { secrets });
      obs.stage_exceptions.push(rec);
      obs.cleanup.attempted = true;
      obs.cleanup.containers_removed = false;
      obs.cleanup.volumes_removed = false;
    }

    rawEvidence.stage_exceptions = obs.stage_exceptions;
  }

  const evaluated = evaluateReadinessEvidence(obs, expectedBinding);
  const artifact = await emitArtifact(evaluated);
  return { evaluated, artifact };
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
    !c.pg_server_version_num ||
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

export function evaluateLexiconLoad(
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

/**
 * Evaluates whether a failure-injection environment could reach LEXICON_LOAD PASS.
 */
export function evaluateInjectedEnvironmentLexiconLoad(params: {
  injected_user_dict: string;
  startup_succeeded: boolean;
  sql_succeeded: boolean;
  observed_user_dict: string | null;
  dict_file_present_in_tsearch_data: boolean;
  container_dict_sha256: string | null;
  expected: ExpectedBinding;
}): PredicateResult {
  const syntheticObs: ReadinessObservation = {
    compatibility: { attempted: false },
    lexicon_load: {
      attempted: true,
      provenance_valid: false,
      lexicon_sha256: params.expected.lexicon_sha256,
      container_dict_sha256: params.container_dict_sha256,
      baseline_user_dict: 'jieba_user',
      loaded_user_dict: params.observed_user_dict,
      loaded_startup_succeeded: params.startup_succeeded && params.sql_succeeded,
      used_reload_dict_as_positive_proof: false,
    },
    tokenization: { attempted: false },
    lexical_query: { attempted: false },
    cleanup: { attempted: false },
  };
  if (
    !params.startup_succeeded ||
    !params.sql_succeeded ||
    !params.dict_file_present_in_tsearch_data ||
    params.injected_user_dict !== 'jieba_user,xiaoshuyin_022_test'
  ) {
    return { state: 'FAIL', reasons: ['LEXICON_LOAD_FAILED'] };
  }
  return evaluateLexiconLoad(syntheticObs, params.expected);
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
    cln.failure_injection_containers_removed === false ||
    cln.failure_injection_volumes_removed === false ||
    cln.derived_image_removed === false ||
    cln.host_and_prod_untouched === false
  ) {
    return { state: 'FAIL', reasons: ['CLEANUP_FAILED'] };
  }
  if (
    obs.failure_injection?.attempted === true &&
    (obs.failure_injection.cleanup_verified !== true ||
      cln.failure_injection_containers_removed !== true ||
      cln.failure_injection_volumes_removed !== true)
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

function isAllowedChangedFile(file: string): boolean {
  return (
    ALLOWED_IMPLEMENTATION_PATHS.has(file) ||
    file.startsWith('specs/022-pg-jieba-lexical-readiness-spike/')
  );
}

function applyPredicateOverride(
  predicates: LowerPredicates,
  target: LowerPredicateName,
  state: ReadinessState,
  reason: ReasonCode,
): void {
  const cur = predicates[target];
  if (cur.state === 'FAIL') {
    predicates[target] = { state: 'FAIL', reasons: dedupeReasons([...cur.reasons, reason]) };
    return;
  }
  if (state === 'FAIL') {
    predicates[target] = { state: 'FAIL', reasons: dedupeReasons([...cur.reasons, reason]) };
    return;
  }
  if (cur.state === 'BLOCKED') {
    predicates[target] = { state: 'BLOCKED', reasons: dedupeReasons([...cur.reasons, reason]) };
    return;
  }
  predicates[target] = { state, reasons: dedupeReasons([...cur.reasons, reason]) };
}

function buildRunFamilyInputFromObservation(
  obs: ReadinessObservation,
): RunFamilyInput | null {
  const implBlobs = obs.implementation_file_blobs;
  const lexId = obs.lexicon_identity;
  const corpId = obs.corpus_identity;
  const upId = obs.upstream_source_identity;
  const envId = obs.environment_identity;
  const attId = obs.attempt_identity;

  if (
    !obs.repo_head ||
    !obs.base_main ||
    !obs.merge_base ||
    !Array.isArray(obs.changed_files) ||
    obs.changed_files.length === 0 ||
    !obs.frozen_spec_blob ||
    obs.working_tree_clean !== true ||
    !implBlobs ||
    !obs.dockerfile_blob ||
    !obs.readiness_state_blob ||
    !obs.db_harness_blob ||
    !obs.architecture_test_blob ||
    !lexId?.dict_blob ||
    !lexId?.manifest_blob ||
    !lexId?.dict_sha256 ||
    !corpId?.manifest_blob ||
    !corpId?.corpus_sha256 ||
    !corpId?.query_manifest_identity ||
    !upId?.pg_jieba_repo ||
    !upId?.pg_jieba_commit ||
    !upId?.libjieba_commit ||
    !upId?.extension_version ||
    !envId?.base_image_ref ||
    !envId?.derived_image_id ||
    !envId?.pg_server_version ||
    !envId?.pg_server_version_num ||
    !envId?.runtime_role ||
    !attId?.attempt_id ||
    !attId?.attempt_nonce ||
    !attId?.attempt_started_at
  ) {
    return null;
  }

  for (const requiredPath of ALLOWED_IMPLEMENTATION_PATHS) {
    if (!implBlobs[requiredPath]) {
      return null;
    }
  }

  return {
    repo_head: obs.repo_head,
    base_main: obs.base_main,
    merge_base: obs.merge_base,
    changed_files: [...obs.changed_files].sort(),
    frozen_spec_blob: obs.frozen_spec_blob,
    working_tree_clean: obs.working_tree_clean,
    implementation_file_blobs: implBlobs,
    dockerfile_blob: obs.dockerfile_blob,
    readiness_state_blob: obs.readiness_state_blob,
    db_harness_blob: obs.db_harness_blob,
    architecture_test_blob: obs.architecture_test_blob,
    lexicon_identity: {
      dict_blob: lexId.dict_blob,
      manifest_blob: lexId.manifest_blob,
      dict_sha256: lexId.dict_sha256,
    },
    corpus_identity: {
      manifest_blob: corpId.manifest_blob,
      corpus_sha256: corpId.corpus_sha256,
      query_manifest_identity: corpId.query_manifest_identity,
    },
    upstream_source_identity: {
      pg_jieba_repo: upId.pg_jieba_repo,
      pg_jieba_commit: upId.pg_jieba_commit,
      libjieba_commit: upId.libjieba_commit,
      extension_version: upId.extension_version,
    },
    environment_identity: {
      base_image_ref: envId.base_image_ref,
      derived_image_id: envId.derived_image_id,
      pg_server_version: envId.pg_server_version,
      pg_server_version_num: envId.pg_server_version_num,
      runtime_role: envId.runtime_role,
    },
    attempt_identity: {
      attempt_id: attId.attempt_id,
      attempt_nonce: attId.attempt_nonce,
      attempt_started_at: attId.attempt_started_at,
    },
  };
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

  // F-02: Apply captured stage exceptions truthfully so no stage exception can be hidden or PASS
  if (Array.isArray(obs.stage_exceptions) && obs.stage_exceptions.length > 0) {
    for (const exc of obs.stage_exceptions) {
      applyPredicateOverride(
        predicates,
        exc.classified_predicate,
        exc.classified_state,
        exc.reason_code,
      );
      if (exc.reason_code !== 'STAGE_EXCEPTION_CAPTURED' && exc.classified_state === 'FAIL') {
        applyPredicateOverride(
          predicates,
          exc.classified_predicate,
          exc.classified_state,
          'STAGE_EXCEPTION_CAPTURED',
        );
      }
    }
  }

  // F-01: Enforce failure_injection consumption
  const fi = obs.failure_injection;
  const upstreamBlockedOrFailed =
    predicates.PG_JIEBA_COMPATIBILITY.state === 'BLOCKED' ||
    predicates.PG_JIEBA_COMPATIBILITY.state === 'FAIL' ||
    predicates.PG_JIEBA_COMPATIBILITY.state === 'UNKNOWN' ||
    predicates.PG_JIEBA_COMPATIBILITY.state === 'NOT_EVALUATED';

  if (fi && fi.attempted === true) {
    if (fi.observed_lexicon_load_pass === true || fi.runtime_failure_observed === false) {
      applyPredicateOverride(predicates, 'LEXICON_LOAD', 'FAIL', 'LEXICON_LOAD_FAILED');
      applyPredicateOverride(
        predicates,
        'LEXICON_LOAD',
        'FAIL',
        'FAILURE_INJECTION_UNEXPECTED_PASS',
      );
    } else if (typeof fi.observed_lexicon_load_pass !== 'boolean') {
      applyPredicateOverride(predicates, 'LEXICON_LOAD', 'FAIL', 'FAILURE_INJECTION_NOT_CONSUMED');
    }

    const compatMisclassified =
      fi.misclassified_as_pg18_incompatibility === true ||
      (obs.compatibility.build_succeeded === true &&
        obs.compatibility.extension_created === true &&
        obs.compatibility.jiebacfg_exists === true &&
        predicates.PG_JIEBA_COMPATIBILITY.reasons.some((r) => PG18_INCOMPATIBILITY_REASONS.has(r)));

    if (compatMisclassified || typeof fi.misclassified_as_pg18_incompatibility !== 'boolean') {
      applyPredicateOverride(
        predicates,
        'LEXICON_LOAD',
        'FAIL',
        'FAILURE_INJECTION_MISCLASSIFIED_INCOMPATIBLE',
      );
    }

    if (
      fi.cleanup_verified !== true ||
      obs.cleanup.failure_injection_containers_removed !== true ||
      obs.cleanup.failure_injection_volumes_removed !== true
    ) {
      applyPredicateOverride(predicates, 'CLEANUP', 'FAIL', 'CLEANUP_FAILED');
    }
  } else if (!upstreamBlockedOrFailed && obs.lexicon_load.attempted) {
    // Positive lexicon path ran without executing/consuming failure_injection
    applyPredicateOverride(predicates, 'LEXICON_LOAD', 'FAIL', 'FAILURE_INJECTION_NOT_CONSUMED');
  }

  // F-03: Enforce working_tree_clean, exact-head, blob & fixture bindings, and recomputable run_family_id
  if (obs.working_tree_clean === false) {
    applyPredicateOverride(predicates, 'PG_JIEBA_COMPATIBILITY', 'FAIL', 'WORKING_TREE_DRIFT');
  }

  const headMismatch =
    (obs.repo_head !== undefined && obs.repo_head !== null && obs.repo_head !== expected.repo_head) ||
    (obs.base_main !== undefined && obs.base_main !== null && obs.base_main !== expected.base_main) ||
    (obs.merge_base !== undefined &&
      obs.merge_base !== null &&
      obs.merge_base !== expected.merge_base) ||
    (obs.frozen_spec_blob !== undefined &&
      obs.frozen_spec_blob !== null &&
      obs.frozen_spec_blob !== expected.frozen_spec_blob);

  const changedFilesMismatch =
    Array.isArray(obs.changed_files) && !obs.changed_files.every((f) => isAllowedChangedFile(f));

  const implBlobs = obs.implementation_file_blobs;
  const implBlobsMismatch =
    (implBlobs !== undefined &&
      implBlobs !== null &&
      Object.entries(expected.implementation_file_blobs).some(
        ([k, v]) => implBlobs[k] !== undefined && implBlobs[k] !== v,
      )) ||
    (obs.dockerfile_blob !== undefined &&
      obs.dockerfile_blob !== null &&
      obs.dockerfile_blob !==
        expected.implementation_file_blobs['tests/fixtures/pg-jieba-readiness/Dockerfile']) ||
    (obs.readiness_state_blob !== undefined &&
      obs.readiness_state_blob !== null &&
      obs.readiness_state_blob !==
        expected.implementation_file_blobs['tests/fixtures/pg-jieba-readiness/readiness-state.ts']) ||
    (obs.db_harness_blob !== undefined &&
      obs.db_harness_blob !== null &&
      obs.db_harness_blob !==
        expected.implementation_file_blobs['tests/db/pg-jieba-readiness.test.ts']) ||
    (obs.architecture_test_blob !== undefined &&
      obs.architecture_test_blob !== null &&
      obs.architecture_test_blob !==
        expected.implementation_file_blobs['tests/architecture/pg-jieba-readiness-evidence.test.ts']);

  const upstreamMismatch =
    obs.upstream_source_identity !== undefined &&
    obs.upstream_source_identity !== null &&
    ((obs.upstream_source_identity.pg_jieba_repo !== undefined &&
      obs.upstream_source_identity.pg_jieba_repo !== expected.pg_jieba_repo) ||
      (obs.upstream_source_identity.pg_jieba_commit !== undefined &&
        obs.upstream_source_identity.pg_jieba_commit !== expected.pg_jieba_commit) ||
      (obs.upstream_source_identity.libjieba_commit !== undefined &&
        obs.upstream_source_identity.libjieba_commit !== expected.libjieba_commit) ||
      (obs.upstream_source_identity.extension_version !== undefined &&
        obs.upstream_source_identity.extension_version !== expected.extension_version));

  if (headMismatch || changedFilesMismatch || implBlobsMismatch || upstreamMismatch) {
    applyPredicateOverride(
      predicates,
      'PG_JIEBA_COMPATIBILITY',
      'FAIL',
      'STALE_OR_MIXED_HEAD_EVIDENCE',
    );
  }

  const lexiconDrift =
    obs.lexicon_identity !== undefined &&
    obs.lexicon_identity !== null &&
    ((obs.lexicon_identity.dict_blob !== undefined &&
      obs.lexicon_identity.dict_blob !== expected.lexicon_dict_blob) ||
      (obs.lexicon_identity.manifest_blob !== undefined &&
        obs.lexicon_identity.manifest_blob !== expected.lexicon_manifest_blob) ||
      (obs.lexicon_identity.dict_sha256 !== undefined &&
        obs.lexicon_identity.dict_sha256 !== expected.lexicon_sha256));

  if (lexiconDrift) {
    applyPredicateOverride(predicates, 'LEXICON_LOAD', 'FAIL', 'FIXTURE_DRIFT');
  }

  const corpusDrift =
    obs.corpus_identity !== undefined &&
    obs.corpus_identity !== null &&
    ((obs.corpus_identity.manifest_blob !== undefined &&
      obs.corpus_identity.manifest_blob !== expected.corpus_manifest_blob) ||
      (obs.corpus_identity.corpus_sha256 !== undefined &&
        obs.corpus_identity.corpus_sha256 !== expected.corpus_sha256) ||
      (obs.corpus_identity.query_manifest_identity !== undefined &&
        obs.corpus_identity.query_manifest_identity !== expected.query_manifest_identity));

  if (corpusDrift) {
    applyPredicateOverride(predicates, 'LEXICAL_QUERY', 'FAIL', 'FIXTURE_DRIFT');
  }

  const runFamilyInput = buildRunFamilyInputFromObservation(obs);
  let recomputed_run_family_id: string | null = null;
  let recomputed_input_family_id: string | null = null;

  if (runFamilyInput) {
    recomputed_run_family_id = computeRunFamilyId(runFamilyInput);
    const { attempt_identity: _att, ...inputOnly } = runFamilyInput;
    recomputed_input_family_id = computeInputFamilyId(inputOnly);

    if (!obs.run_family_id || obs.run_family_id !== recomputed_run_family_id) {
      applyPredicateOverride(
        predicates,
        'PG_JIEBA_COMPATIBILITY',
        'FAIL',
        'RUN_FAMILY_ID_MISMATCH',
      );
    }
    if (obs.input_family_id && obs.input_family_id !== recomputed_input_family_id) {
      applyPredicateOverride(
        predicates,
        'PG_JIEBA_COMPATIBILITY',
        'FAIL',
        'RUN_FAMILY_ID_MISMATCH',
      );
    }
  } else {
    const anyAttempted = LOWER_PREDICATE_NAMES.some(
      (n) => predicates[n].state !== 'NOT_EVALUATED',
    );
    const compatBlockedOrFailed =
      predicates.PG_JIEBA_COMPATIBILITY.state === 'BLOCKED' ||
      predicates.PG_JIEBA_COMPATIBILITY.state === 'FAIL';
    if (anyAttempted && !compatBlockedOrFailed) {
      if (obs.run_family_id) {
        // Non-empty run_family_id provided without complete recomputable inputs cannot pass
        applyPredicateOverride(
          predicates,
          'PG_JIEBA_COMPATIBILITY',
          'FAIL',
          'RUN_FAMILY_ID_MISMATCH',
        );
      } else {
        applyPredicateOverride(
          predicates,
          'PG_JIEBA_COMPATIBILITY',
          'UNKNOWN',
          'IDENTITY_INCOMPLETE',
        );
      }
    }
  }

  const aggregate_state = deriveAggregateState(predicates);
  const aggregate_reasons = dedupeReasons(
    LOWER_PREDICATE_NAMES.flatMap((name) => predicates[name].reasons),
  );

  return {
    predicates,
    aggregate_state,
    aggregate_reasons,
    recomputed_run_family_id,
    recomputed_input_family_id,
  };
}
