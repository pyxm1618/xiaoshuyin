import { createHash } from 'node:crypto';

export const SPARSE_D = 1_000_000_000;
export const SPARSE_IP_REL_TOL = 1e-5;
export const DENSE_COSINE_ABS_TOL = 1.25e-4;
export const FUSION_RECOMPUTE_ABS_TOL = 1e-12;
export const EVIDENCE_PATH = 'tests/evidence/sparsevec-readiness-stage-a.json';
export const MANIFEST_PATH = 'tests/fixtures/sparsevec-readiness/chinese-sample-manifest.json';

export const PINNED_PGVECTOR_VERSION = '0.8.7';
export const PINNED_PGVECTOR_IMAGE_REF =
  'pgvector/pgvector:0.8.7-pg18-trixie@sha256:5895949dfcdf308eb0cd31c950c93c14895c77f33fbedfecf1fa511ab1d4bcd2';
export const FROZEN_SPEC_HEAD = '8792c4cf4e366b5507ac451a68cd31b73e7f5261';
export const FROZEN_SPEC_BLOB = '77d1caf4de6fdead3efcdb0cf3e8c594d444efbd';

export type SparseRejectCode =
  | 'SPARSE_MISSING'
  | 'INDEX_OUT_OF_RANGE'
  | 'NON_CANONICAL_ORDER'
  | 'DUPLICATE_INDEX'
  | 'NONFINITE_VALUE'
  | 'FLOAT32_OVERFLOW'
  | 'FLOAT32_UNDERFLOW_TO_ZERO'
  | 'EMPTY_SPARSE'
  | 'INVALID_EXPERIMENT_CONFIG'
  | 'DENSE_ZERO_VECTOR';

export type VerificationFlag = 'VERIFIED' | 'FAIL' | 'BLOCKED' | 'UNKNOWN' | 'NOT_EVALUATED';

export interface SparseEntryInput {
  readonly index: number;
  readonly value: number;
}

export interface MappedSparseCoordinate {
  readonly coord: number; // 1-based SQL coordinate = index + 1
  readonly value: number; // Math.fround(value)
}

export interface SparseMappingResult {
  readonly ok: true;
  readonly dimension: number;
  readonly entries: readonly MappedSparseCoordinate[];
  readonly canonicalText: string;
  readonly nnz: number;
  readonly observedMinIndex: number;
  readonly observedMaxIndex: number;
  readonly sparseVocabularyBound: number | 'NOT_PROVIDED';
}

export interface SparseMappingFailure {
  readonly ok: false;
  readonly code: SparseRejectCode;
  readonly detail: string;
}

export interface SparsePreflightResult {
  readonly ok: true;
  readonly sparseVocabularyBound: number | 'NOT_PROVIDED';
}

export interface SparsePreflightFailure {
  readonly ok: false;
  readonly code: 'INVALID_EXPERIMENT_CONFIG';
  readonly detail: string;
}

export function preflightSparseVocabularyBound(
  sparseVocabularyMax?: number,
): SparsePreflightResult | SparsePreflightFailure {
  if (sparseVocabularyMax === undefined) {
    return { ok: true, sparseVocabularyBound: 'NOT_PROVIDED' };
  }
  if (!Number.isSafeInteger(sparseVocabularyMax) || sparseVocabularyMax <= 0 || sparseVocabularyMax > SPARSE_D) {
    return {
      ok: false,
      code: 'INVALID_EXPERIMENT_CONFIG',
      detail: `sparseVocabularyMax=${String(sparseVocabularyMax)} exceeds D=${SPARSE_D} or is invalid`,
    };
  }
  return { ok: true, sparseVocabularyBound: sparseVocabularyMax };
}

function validateEntryIndexAndValue(
  entry: SparseEntryInput,
  bound: number | 'NOT_PROVIDED',
): SparseMappingFailure | null {
  if (!entry || typeof entry !== 'object') {
    return { ok: false, code: 'SPARSE_MISSING', detail: 'Sparse entry must be an object' };
  }
  const { index, value } = entry;
  if (typeof index !== 'number' || !Number.isSafeInteger(index) || index < 0 || index >= SPARSE_D) {
    return { ok: false, code: 'INDEX_OUT_OF_RANGE', detail: `index ${String(index)} out of [0, ${SPARSE_D - 1}]` };
  }
  if (bound !== 'NOT_PROVIDED' && index >= bound) {
    return {
      ok: false,
      code: 'INDEX_OUT_OF_RANGE',
      detail: `index ${index} >= sparseVocabularyMax ${bound}`,
    };
  }
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return { ok: false, code: 'NONFINITE_VALUE', detail: `non-finite value at index ${index}` };
  }
  const f = Math.fround(value);
  if (!Number.isFinite(f)) {
    return { ok: false, code: 'FLOAT32_OVERFLOW', detail: `float32 overflow at index ${index}` };
  }
  if (value !== 0 && f === 0) {
    return { ok: false, code: 'FLOAT32_UNDERFLOW_TO_ZERO', detail: `float32 underflow at index ${index}` };
  }
  return null;
}

function finalizeMappedEntries(
  nonZeroZeroBased: readonly { index: number; value: number }[],
  sparseVocabularyBound: number | 'NOT_PROVIDED',
): SparseMappingResult | SparseMappingFailure {
  if (nonZeroZeroBased.length === 0) {
    return { ok: false, code: 'EMPTY_SPARSE', detail: 'Sparse vector is empty after zero removal' };
  }
  const mapped: MappedSparseCoordinate[] = nonZeroZeroBased.map((e) => ({
    coord: e.index + 1,
    value: Math.fround(e.value),
  }));
  const canonicalText = `{${mapped.map((e) => `${e.coord}:${e.value}`).join(',')}}/${SPARSE_D}`;
  return {
    ok: true,
    dimension: SPARSE_D,
    entries: mapped,
    canonicalText,
    nnz: mapped.length,
    observedMinIndex: nonZeroZeroBased[0].index,
    observedMaxIndex: nonZeroZeroBased[nonZeroZeroBased.length - 1].index,
    sparseVocabularyBound,
  };
}

/**
 * Actual Slice 20 Port -> DB mapping (Plan §6).
 * Strictly rejects non-ascending payloads without sorting.
 */
export function mapActualPortSparseToPgSparsevec(
  sparse: readonly SparseEntryInput[] | null | undefined,
  options: { readonly sparseVocabularyMax?: number } = {},
): SparseMappingResult | SparseMappingFailure {
  const preflight = preflightSparseVocabularyBound(options.sparseVocabularyMax);
  if (!preflight.ok) return preflight;

  if (sparse === null || sparse === undefined || !Array.isArray(sparse)) {
    return { ok: false, code: 'SPARSE_MISSING', detail: 'Sparse payload is null or missing' };
  }

  let prevIndex = -1;
  const nonZero: { index: number; value: number }[] = [];
  for (const entry of sparse) {
    const err = validateEntryIndexAndValue(entry, preflight.sparseVocabularyBound);
    if (err) return err;

    if (entry.index === prevIndex) {
      return { ok: false, code: 'DUPLICATE_INDEX', detail: `Duplicate index ${entry.index}` };
    }
    if (entry.index < prevIndex) {
      return {
        ok: false,
        code: 'NON_CANONICAL_ORDER',
        detail: `Non-ascending actual Port index ${entry.index} after ${prevIndex}`,
      };
    }
    prevIndex = entry.index;

    const f = Math.fround(entry.value);
    if (f !== 0) {
      nonZero.push({ index: entry.index, value: f });
    }
  }

  return finalizeMappedEntries(nonZero, preflight.sparseVocabularyBound);
}

/**
 * Architecture-only synthetic fixture canonicalizer (Plan §6 AS-02).
 * Never callable from the actual Provider -> DB execution path.
 */
export function canonicalizeSyntheticSparseForArchitectureTest(
  sparse: readonly SparseEntryInput[] | null | undefined,
  options: { readonly sparseVocabularyMax?: number } = {},
): SparseMappingResult | SparseMappingFailure {
  const preflight = preflightSparseVocabularyBound(options.sparseVocabularyMax);
  if (!preflight.ok) return preflight;

  if (sparse === null || sparse === undefined || !Array.isArray(sparse)) {
    return { ok: false, code: 'SPARSE_MISSING', detail: 'Sparse payload is null or missing' };
  }

  const seen = new Set<number>();
  const validated: { index: number; value: number }[] = [];
  for (const entry of sparse) {
    const err = validateEntryIndexAndValue(entry, preflight.sparseVocabularyBound);
    if (err) return err;
    if (seen.has(entry.index)) {
      return { ok: false, code: 'DUPLICATE_INDEX', detail: `Duplicate index ${entry.index}` };
    }
    seen.add(entry.index);
    validated.push({ index: entry.index, value: Math.fround(entry.value) });
  }

  validated.sort((a, b) => a.index - b.index);
  const nonZero = validated.filter((e) => e.value !== 0);
  return finalizeMappedEntries(nonZero, preflight.sparseVocabularyBound);
}

export function parsePgSparsevecText(text: string): {
  readonly dimension: number;
  readonly entries: readonly MappedSparseCoordinate[];
} {
  const slashIdx = text.lastIndexOf('/');
  if (slashIdx <= 0 || !text.startsWith('{') || text[slashIdx - 1] !== '}') {
    throw new Error(`Invalid pgvector sparsevec text: ${text}`);
  }
  const dimension = Number(text.slice(slashIdx + 1));
  const body = text.slice(1, slashIdx - 1);
  if (body.length === 0) {
    return { dimension, entries: [] };
  }
  const entries: MappedSparseCoordinate[] = body.split(',').map((pair) => {
    const colon = pair.indexOf(':');
    if (colon <= 0) throw new Error(`Invalid sparsevec pair: ${pair}`);
    return {
      coord: Number(pair.slice(0, colon)),
      value: Math.fround(Number(pair.slice(colon + 1))),
    };
  });
  return { dimension, entries };
}

export function referenceSparseInnerProduct(
  a: readonly MappedSparseCoordinate[],
  b: readonly MappedSparseCoordinate[],
): number {
  let i = 0;
  let j = 0;
  let sum = 0;
  while (i < a.length && j < b.length) {
    if (a[i].coord === b[j].coord) {
      sum += Math.fround(a[i].value) * Math.fround(b[j].value);
      i++;
      j++;
    } else if (a[i].coord < b[j].coord) {
      i++;
    } else {
      j++;
    }
  }
  return sum;
}

export function referenceDenseCosine(a: readonly number[], b: readonly number[]): number {
  if (a.length !== b.length || a.length === 0) {
    throw new Error(`Dense dimension mismatch: ${a.length} vs ${b.length}`);
  }
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    const va = Math.fround(a[i]);
    const vb = Math.fround(b[i]);
    dot += va * vb;
    normA += va * va;
    normB += vb * vb;
  }
  if (normA === 0 || normB === 0) {
    throw new Error('DENSE_ZERO_VECTOR');
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export type DbProbeMode = 'RUN' | 'FAIL' | 'SKIP';

export function resolveDbProbeMode(env: NodeJS.ProcessEnv): {
  readonly mode: DbProbeMode;
  readonly kind: 'CI_STAGE_A_IDENTITY' | 'MANUAL_OPT_IN' | 'PARTIAL_IDENTITY' | 'NONE';
  readonly reason: string;
} {
  const nonEmpty = (k: string) => typeof env[k] === 'string' && env[k]!.trim().length > 0;
  const ciStageA =
    env.PGVECTOR_STAGE === 'STAGE_A' &&
    env.PGVECTOR_ENVIRONMENT_KIND === 'CI_INTEGRATION' &&
    env.PGVECTOR_EXPECTED_VERSION === PINNED_PGVECTOR_VERSION &&
    env.PGVECTOR_IMAGE_REF === PINNED_PGVECTOR_IMAGE_REF &&
    nonEmpty('PGVECTOR_ENVIRONMENT_ID') &&
    nonEmpty('PGVECTOR_REPOSITORY_COMMIT') &&
    nonEmpty('GITHUB_RUN_ID');

  if (ciStageA) {
    return { mode: 'RUN', kind: 'CI_STAGE_A_IDENTITY', reason: 'CI Stage-A identity verified' };
  }

  const manualOptIn =
    env.SPARSEVEC_DB_READINESS_TEST === '1' &&
    env.PGVECTOR_EXPECTED_VERSION === PINNED_PGVECTOR_VERSION &&
    env.PGVECTOR_IMAGE_REF === PINNED_PGVECTOR_IMAGE_REF;

  if (manualOptIn) {
    return { mode: 'RUN', kind: 'MANUAL_OPT_IN', reason: 'Manual Stage-A opt-in verified' };
  }

  const anyIdentitySet =
    nonEmpty('PGVECTOR_STAGE') ||
    nonEmpty('PGVECTOR_ENVIRONMENT_KIND') ||
    nonEmpty('PGVECTOR_EXPECTED_VERSION') ||
    nonEmpty('PGVECTOR_IMAGE_REF') ||
    nonEmpty('SPARSEVEC_DB_READINESS_TEST');

  if (anyIdentitySet) {
    return {
      mode: 'FAIL',
      kind: 'PARTIAL_IDENTITY',
      reason: 'Partial Stage-A DB identity supplied without complete CI_STAGE_A_IDENTITY or MANUAL_OPT_IN',
    };
  }

  return {
    mode: 'SKIP',
    kind: 'NONE',
    reason: 'NOT_EVALUATED: no Stage A identity',
  };
}

export function deriveMappingContractVerified(checks: Record<string, boolean>): VerificationFlag {
  const values = Object.values(checks);
  if (values.length === 0) return 'NOT_EVALUATED';
  return values.every(Boolean) ? 'VERIFIED' : 'FAIL';
}

export interface ManifestDocument {
  readonly doc_id: string;
  readonly source_title: string;
  readonly source_authority: string;
  readonly source_url: string;
  readonly source_published: string;
  readonly anchor: string;
  readonly extraction_rule_id: string;
  readonly excerpt: string;
  readonly text_sha256: string;
  readonly source_fetched_at: string;
  readonly http_status: number;
  readonly rights_basis: string;
  readonly outbound_permission: string;
  readonly contains_personal_data: boolean;
}

export interface ManifestQuery {
  readonly query_id: string;
  readonly query_text: string;
  readonly query_sha256: string;
  readonly expected_doc_id: string;
  readonly key_term: string;
  readonly distractor_doc_ids: readonly string[];
}

export interface ChineseSampleManifest {
  readonly manifest_id: string;
  readonly manifest_version: number;
  readonly privacy_assertion: string;
  readonly documents: readonly ManifestDocument[];
  readonly queries: readonly ManifestQuery[];
}

export function sha256Utf8(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

export function validateChineseManifest(
  raw: unknown,
): { ok: true; manifest: ChineseSampleManifest } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  if (!raw || typeof raw !== 'object') {
    return { ok: false, errors: ['Manifest must be an object'] };
  }
  const m = raw as Record<string, unknown>;
  if (m.manifest_id !== 's21-chinese-sample-v1') errors.push('manifest_id mismatch');
  if (m.manifest_version !== 1) errors.push('manifest_version must be 1');
  if (m.privacy_assertion !== 'NO_FAMILY_MINOR_PATIENT_PRIVATE_DATA') errors.push('privacy_assertion mismatch');

  const docs = Array.isArray(m.documents) ? (m.documents as ManifestDocument[]) : null;
  const queries = Array.isArray(m.queries) ? (m.queries as ManifestQuery[]) : null;
  if (!docs || docs.length !== 6) errors.push('documents must have length 6');
  if (!queries || queries.length !== 3) errors.push('queries must have length 3');
  if (errors.length > 0 || !docs || !queries) {
    return { ok: false, errors };
  }

  const docMap = new Map<string, ManifestDocument>();
  for (const d of docs) {
    if (docMap.has(d.doc_id)) errors.push(`duplicate doc_id ${d.doc_id}`);
    docMap.set(d.doc_id, d);
    if (d.source_authority !== '中华人民共和国教育部（moe.gov.cn）') errors.push(`${d.doc_id}: invalid source_authority`);
    if (d.extraction_rule_id !== 'S21-EXTRACT-V1') errors.push(`${d.doc_id}: invalid extraction_rule_id`);
    if (d.http_status !== 200) errors.push(`${d.doc_id}: http_status must be 200`);
    if (d.rights_basis !== 'PUBLIC_OFFICIAL_GOVERNMENT_INFORMATION') errors.push(`${d.doc_id}: invalid rights_basis`);
    if (d.outbound_permission !== 'PERMITTED_PUBLIC_NONPERSONAL') errors.push(`${d.doc_id}: invalid outbound_permission`);
    if (d.contains_personal_data !== false) errors.push(`${d.doc_id}: contains_personal_data must be false`);

    const anchorNfkc = d.anchor.normalize('NFKC');
    if (!d.excerpt.startsWith(anchorNfkc)) errors.push(`${d.doc_id}: excerpt does not start with NFKC anchor`);
    const cpLen = Array.from(d.excerpt).length;
    if (cpLen < 30 || cpLen > 400) errors.push(`${d.doc_id}: excerpt length ${cpLen} outside [30, 400]`);
    if (sha256Utf8(d.excerpt) !== d.text_sha256) errors.push(`${d.doc_id}: text_sha256 mismatch`);
  }

  const expectedTargets = new Set<string>();
  const queryIds = new Set<string>();
  for (const q of queries) {
    if (queryIds.has(q.query_id)) errors.push(`duplicate query_id ${q.query_id}`);
    queryIds.add(q.query_id);
    if (sha256Utf8(q.query_text.normalize('NFKC')) !== q.query_sha256) {
      errors.push(`${q.query_id}: query_sha256 mismatch`);
    }
    expectedTargets.add(q.expected_doc_id);
    const keyNfkc = q.key_term.normalize('NFKC');
    if (!q.query_text.normalize('NFKC').includes(keyNfkc)) {
      errors.push(`${q.query_id}: key_term absent from query_text`);
    }
    const target = docMap.get(q.expected_doc_id);
    if (!target) {
      errors.push(`${q.query_id}: expected_doc_id ${q.expected_doc_id} not found`);
    } else if (!target.excerpt.includes(keyNfkc)) {
      errors.push(`${q.query_id}: key_term absent from target ${q.expected_doc_id}`);
    }
    for (const distId of q.distractor_doc_ids) {
      const dist = docMap.get(distId);
      if (!dist) {
        errors.push(`${q.query_id}: distractor ${distId} not found`);
      } else if (dist.excerpt.includes(keyNfkc)) {
        errors.push(`${q.query_id}: key_term present in distractor ${distId}`);
      }
    }
  }

  if (expectedTargets.size !== 3 || !expectedTargets.has('D01') || !expectedTargets.has('D02') || !expectedTargets.has('D03')) {
    errors.push('target set must be exactly {D01, D02, D03}');
  }

  return errors.length === 0 ? { ok: true, manifest: m as unknown as ChineseSampleManifest } : { ok: false, errors };
}

export interface FusionCandidateInput {
  readonly sample_id: string;
  readonly raw_dense: number;
  readonly raw_sparse: number;
}

export interface FusionScoredCandidate {
  readonly sample_id: string;
  readonly raw_dense: number;
  readonly raw_sparse: number;
  readonly norm_dense: number;
  readonly norm_sparse: number;
  readonly fused: number;
}

export interface FusionQueryResult {
  readonly query_id: string;
  readonly expected_doc_id: string;
  readonly ranked_doc_ids: readonly string[];
  readonly candidates: readonly FusionScoredCandidate[];
  readonly strict_first: boolean;
  readonly recompute_max_abs_diff: number;
}

export function computeFixedFusion(
  queryId: string,
  expectedDocId: string,
  candidates: readonly FusionCandidateInput[],
): FusionQueryResult {
  if (!Array.isArray(candidates) || candidates.length !== 6) {
    throw new Error(`FUSION_INVALID_CANDIDATE_COUNT: expected 6, got ${Array.isArray(candidates) ? candidates.length : 0}`);
  }
  const seen = new Set<string>();
  for (const c of candidates) {
    if (!c || typeof c.sample_id !== 'string' || seen.has(c.sample_id)) {
      throw new Error(`FUSION_DUPLICATE_OR_INVALID_ID: ${String(c?.sample_id)}`);
    }
    seen.add(c.sample_id);
    if (typeof c.raw_dense !== 'number' || !Number.isFinite(c.raw_dense)) {
      throw new Error(`FUSION_NONFINITE_DENSE: ${c.sample_id}`);
    }
    if (typeof c.raw_sparse !== 'number' || !Number.isFinite(c.raw_sparse)) {
      throw new Error(`FUSION_NONFINITE_SPARSE: ${c.sample_id}`);
    }
  }

  const minDense = Math.min(...candidates.map((c) => c.raw_dense));
  const maxDense = Math.max(...candidates.map((c) => c.raw_dense));
  const minSparse = Math.min(...candidates.map((c) => c.raw_sparse));
  const maxSparse = Math.max(...candidates.map((c) => c.raw_sparse));

  const scored: FusionScoredCandidate[] = candidates.map((c) => {
    const norm_dense = maxDense > minDense ? (c.raw_dense - minDense) / (maxDense - minDense) : 0;
    const norm_sparse = maxSparse > minSparse ? (c.raw_sparse - minSparse) / (maxSparse - minSparse) : 0;
    const fused = 0.5 * norm_dense + 0.5 * norm_sparse;
    return {
      sample_id: c.sample_id,
      raw_dense: c.raw_dense,
      raw_sparse: c.raw_sparse,
      norm_dense,
      norm_sparse,
      fused,
    };
  });

  scored.sort((a, b) => {
    if (b.fused !== a.fused) return b.fused - a.fused;
    return a.sample_id < b.sample_id ? -1 : a.sample_id > b.sample_id ? 1 : 0;
  });

  const target = scored.find((s) => s.sample_id === expectedDocId);
  const strict_first = Boolean(
    target && scored.every((s) => s.sample_id === expectedDocId || target.fused > s.fused),
  );

  // Independent recomputation check
  let maxAbsDiff = 0;
  for (const s of scored) {
    const nd = maxDense > minDense ? (s.raw_dense - minDense) / (maxDense - minDense) : 0;
    const ns = maxSparse > minSparse ? (s.raw_sparse - minSparse) / (maxSparse - minSparse) : 0;
    const f = 0.5 * nd + 0.5 * ns;
    maxAbsDiff = Math.max(
      maxAbsDiff,
      Math.abs(s.norm_dense - nd),
      Math.abs(s.norm_sparse - ns),
      Math.abs(s.fused - f),
    );
  }

  return {
    query_id: queryId,
    expected_doc_id: expectedDocId,
    ranked_doc_ids: scored.map((s) => s.sample_id),
    candidates: scored,
    strict_first,
    recompute_max_abs_diff: maxAbsDiff,
  };
}

export function deriveFusionPrototypeVerified(params: {
  readonly fusionMechanicsOk: boolean;
  readonly lowerTechnicalFlagsVerified: boolean;
  readonly chineseQueriesPassed: number;
}): VerificationFlag {
  if (!params.fusionMechanicsOk) return 'FAIL';
  if (!params.lowerTechnicalFlagsVerified) return 'NOT_EVALUATED';
  return params.chineseQueriesPassed === 3 ? 'VERIFIED' : 'UNKNOWN';
}

export interface EvidenceFlags {
  readonly MAPPING_CONTRACT_VERIFIED: VerificationFlag;
  readonly SPARSE_PAYLOAD_VERIFIED: VerificationFlag;
  readonly PGVECTOR_SPARSEVEC_VERIFIED: VerificationFlag;
  readonly FUSION_PROTOTYPE_VERIFIED: VerificationFlag;
}

export interface DerivedSpikeStates {
  readonly SPARSEVEC_SPIKE_PASS_STAGE_A: boolean;
  readonly candidate_a_readiness_state: 'PASS' | 'FAIL' | 'BLOCKED' | 'UNKNOWN' | 'NOT_EVALUATED';
  readonly execution_completion_state: 'COMPLETED_WITH_PASS' | 'COMPLETED_WITH_FAIL' | 'BLOCKED' | 'INCONCLUSIVE' | 'NOT_EVALUATED';
  readonly sparsevec_spike_status: 'PASS_STAGE_A' | 'FAIL' | 'BLOCKED' | 'UNKNOWN' | 'NOT_EVALUATED';
  readonly readiness_status: 'PASS_STAGE_A' | 'FAIL' | 'BLOCKED' | 'UNKNOWN' | 'NOT_EVALUATED';
  readonly rag_candidate_status:
    | 'CANDIDATE_A_SPARSEVEC_PREREQUISITE_MET_STAGE_A'
    | 'CANDIDATE_A_SPARSEVEC_PREREQUISITE_FAILED'
    | 'CANDIDATE_A_SPARSEVEC_PREREQUISITE_BLOCKED'
    | 'CANDIDATE_A_SPARSEVEC_PREREQUISITE_UNKNOWN'
    | 'CANDIDATE_A_SPARSEVEC_PREREQUISITE_NOT_EVALUATED';
}

export function deriveSpikeEvidenceStates(params: {
  readonly flags: EvidenceFlags;
  readonly cleanup_status: 'CLEAN' | 'FAILED';
  readonly gateAndLineageValid: boolean;
}): DerivedSpikeStates {
  const vals = Object.values(params.flags);
  if (vals.includes('FAIL') || params.cleanup_status === 'FAILED' || !params.gateAndLineageValid) {
    return {
      SPARSEVEC_SPIKE_PASS_STAGE_A: false,
      candidate_a_readiness_state: 'FAIL',
      execution_completion_state: 'COMPLETED_WITH_FAIL',
      sparsevec_spike_status: 'FAIL',
      readiness_status: 'FAIL',
      rag_candidate_status: 'CANDIDATE_A_SPARSEVEC_PREREQUISITE_FAILED',
    };
  }
  if (vals.includes('BLOCKED')) {
    return {
      SPARSEVEC_SPIKE_PASS_STAGE_A: false,
      candidate_a_readiness_state: 'BLOCKED',
      execution_completion_state: 'BLOCKED',
      sparsevec_spike_status: 'BLOCKED',
      readiness_status: 'BLOCKED',
      rag_candidate_status: 'CANDIDATE_A_SPARSEVEC_PREREQUISITE_BLOCKED',
    };
  }
  if (vals.includes('UNKNOWN')) {
    return {
      SPARSEVEC_SPIKE_PASS_STAGE_A: false,
      candidate_a_readiness_state: 'UNKNOWN',
      execution_completion_state: 'INCONCLUSIVE',
      sparsevec_spike_status: 'UNKNOWN',
      readiness_status: 'UNKNOWN',
      rag_candidate_status: 'CANDIDATE_A_SPARSEVEC_PREREQUISITE_UNKNOWN',
    };
  }
  if (vals.includes('NOT_EVALUATED')) {
    return {
      SPARSEVEC_SPIKE_PASS_STAGE_A: false,
      candidate_a_readiness_state: 'NOT_EVALUATED',
      execution_completion_state: 'NOT_EVALUATED',
      sparsevec_spike_status: 'NOT_EVALUATED',
      readiness_status: 'NOT_EVALUATED',
      rag_candidate_status: 'CANDIDATE_A_SPARSEVEC_PREREQUISITE_NOT_EVALUATED',
    };
  }
  return {
    SPARSEVEC_SPIKE_PASS_STAGE_A: true,
    candidate_a_readiness_state: 'PASS',
    execution_completion_state: 'COMPLETED_WITH_PASS',
    sparsevec_spike_status: 'PASS_STAGE_A',
    readiness_status: 'PASS_STAGE_A',
    rag_candidate_status: 'CANDIDATE_A_SPARSEVEC_PREREQUISITE_MET_STAGE_A',
  };
}

const REQUIRED_EVIDENCE_KEYS = [
  'schema_version',
  'evidence_kind',
  'run_id',
  'checked_at',
  'evidence_ref',
  'implementation_subject_head',
  'implementation_subject_tree_clean',
  'manifest_commit',
  'frozen_spec_head',
  'frozen_spec_blob',
  'planning_head',
  'slice19_provenance',
  'slice20_provenance',
  'stage',
  'stage_b',
  'stage_c',
  'postgres_version',
  'postgres_version_num',
  'tencentdb_kernel_version',
  'extension_name',
  'extension_version',
  'image_ref',
  'image_digest_source',
  'execution_role',
  'runtime_superuser',
  'runtime_bypassrls',
  'runtime_public_schema_create',
  'extension_owner',
  'provider_calls',
  'configured_sparse_cap',
  'sparse_vocabulary_bound',
  'sparse_dimension',
  'dense_dimension',
  'dimension_policy',
  'items',
  'observed_nnz_max',
  'observed_min_index',
  'observed_max_index',
  'normalized_payload_evidence_ref',
  'normalized_payload_evidence_sha256',
  'normalized_payload_evidence_version',
  'normalized_payload_evidence_media_type',
  'normalized_payload_evidence_run_id',
  'normalized_payload_evidence_subject_head',
  'mapping_result',
  'db_roundtrip_result',
  'distance_result',
  'independent_calculation',
  'tolerances',
  'index_behavior',
  'chinese_manifest_id',
  'chinese_manifest_sha256',
  'source_fingerprints',
  'queries',
  'chinese_queries_passed',
  'fusion_reference',
  'negative_probes',
  'cleanup_status',
  'limitations',
  'flags',
  'SPARSEVEC_SPIKE_PASS_STAGE_A',
  'candidate_a_readiness_state',
  'execution_completion_state',
  'sparsevec_spike_status',
  'rag_candidate_status',
  'readiness_status',
  'readiness_scope',
  'candidate_b_status',
  'candidate_c_status',
  'rag_readiness',
  'production_route_selection',
] as const;

const FORBIDDEN_SELF_REF_KEYS = new Set(['repo_head', 'final_pr_head', 'containing_commit']);
const FORBIDDEN_PRIVACY_KEYS = new Set([
  'apiKey',
  'api_key',
  'authorization',
  'raw_body',
  'raw_response',
  'excerpt',
  'text',
  'sparse_embedding',
  'embedding',
]);
const FORBIDDEN_STATUS_TOKENS = new Set(['READY', 'SELECTED', 'WINNER', 'PRODUCTION']);

function collectAllKeys(obj: unknown, out: Set<string>): void {
  if (!obj || typeof obj !== 'object') return;
  if (Array.isArray(obj)) {
    for (const item of obj) collectAllKeys(item, out);
    return;
  }
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    out.add(k);
    collectAllKeys(v, out);
  }
}

export function validateSanitizedEvidence(
  raw: unknown,
  manifest: ChineseSampleManifest,
): { ok: true } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, errors: ['Evidence must be a JSON object'] };
  }
  const ev = raw as Record<string, unknown>;

  for (const key of REQUIRED_EVIDENCE_KEYS) {
    if (!(key in ev)) errors.push(`Missing required key: ${key}`);
  }

  const allKeys = new Set<string>();
  collectAllKeys(ev, allKeys);
  for (const fk of FORBIDDEN_SELF_REF_KEYS) {
    if (allKeys.has(fk)) errors.push(`Forbidden self-reference key: ${fk}`);
  }
  for (const pk of FORBIDDEN_PRIVACY_KEYS) {
    if (allKeys.has(pk)) errors.push(`Forbidden privacy key: ${pk}`);
  }

  if (ev.schema_version !== 1) errors.push('schema_version must be 1');
  if (ev.evidence_kind !== 'S21_SPARSEVEC_READINESS_SPIKE') errors.push('evidence_kind mismatch');
  if (ev.frozen_spec_head !== FROZEN_SPEC_HEAD) errors.push('frozen_spec_head mismatch');
  if (ev.frozen_spec_blob !== FROZEN_SPEC_BLOB) errors.push('frozen_spec_blob mismatch');
  if (ev.tencentdb_kernel_version !== 'NOT_APPLICABLE_STAGE_A') errors.push('tencentdb_kernel_version mismatch');
  if (ev.readiness_scope !== 'CANDIDATE_A_SPARSEVEC_SPIKE_STAGE_A_ONLY') errors.push('readiness_scope mismatch');
  if (ev.candidate_b_status !== 'UNAFFECTED') errors.push('candidate_b_status must be UNAFFECTED');
  if (ev.candidate_c_status !== 'UNAFFECTED') errors.push('candidate_c_status must be UNAFFECTED');
  if (ev.rag_readiness !== 'NOT_DERIVED') errors.push('rag_readiness must be NOT_DERIVED');
  if (ev.production_route_selection !== 'DEFERRED_TO_GOLD_DATASET') {
    errors.push('production_route_selection must be DEFERRED_TO_GOLD_DATASET');
  }

  // Vocabulary & no-overclaim check on status-typed fields
  const statusFields: unknown[] = [
    ev.SPARSEVEC_SPIKE_PASS_STAGE_A,
    ev.candidate_a_readiness_state,
    ev.execution_completion_state,
    ev.sparsevec_spike_status,
    ev.rag_candidate_status,
    ev.readiness_status,
    ev.readiness_scope,
    ev.candidate_b_status,
    ev.candidate_c_status,
    ev.rag_readiness,
    ev.production_route_selection,
    ev.cleanup_status,
  ];
  if (ev.flags && typeof ev.flags === 'object') {
    statusFields.push(...Object.values(ev.flags as Record<string, unknown>));
  }
  for (const val of statusFields) {
    if (typeof val === 'string') {
      const tokens = val.split('_');
      for (const tok of tokens) {
        if (FORBIDDEN_STATUS_TOKENS.has(tok)) {
          errors.push(`Forbidden overclaim token "${tok}" in status field "${val}"`);
        }
      }
    }
  }

  // Privacy scan against manifest excerpts (20 code-point windows)
  const serialized = JSON.stringify(ev);
  for (const doc of manifest.documents) {
    const cps = Array.from(doc.excerpt);
    for (let i = 0; i <= cps.length - 20; i += 10) {
      const sub = cps.slice(i, i + 20).join('');
      if (serialized.includes(sub)) {
        errors.push(`Evidence leaks 20-code-point excerpt substring from ${doc.doc_id}`);
        break;
      }
    }
  }

  // Validate external immutable bundle metadata rules
  const flags = ev.flags as EvidenceFlags | undefined;
  const isPositiveSparse = flags?.SPARSE_PAYLOAD_VERIFIED === 'VERIFIED';
  if (isPositiveSparse) {
    const ref = ev.normalized_payload_evidence_ref;
    const sha = ev.normalized_payload_evidence_sha256;
    const ver = ev.normalized_payload_evidence_version;
    const media = ev.normalized_payload_evidence_media_type;
    const runId = ev.normalized_payload_evidence_run_id;
    const subj = ev.normalized_payload_evidence_subject_head;
    if (
      typeof ref !== 'string' ||
      ref.length === 0 ||
      ref.startsWith('/') ||
      ref.startsWith('./') ||
      ref.startsWith('../') ||
      ref.startsWith('file://') ||
      ref.startsWith('BLOCKED') ||
      ref.startsWith('NOT_EVALUATED')
    ) {
      errors.push('Positive SPARSE_PAYLOAD_VERIFIED requires concrete non-local immutable bundle ref');
    }
    if (typeof sha !== 'string' || !/^[0-9a-f]{64}$/.test(sha)) {
      errors.push('normalized_payload_evidence_sha256 must be 64 lowercase hex chars');
    }
    if (typeof ver !== 'string' || ver.length === 0 || ver.startsWith('BLOCKED') || ver.startsWith('NOT_EVALUATED')) {
      errors.push('normalized_payload_evidence_version must be concrete');
    }
    if (typeof media !== 'string' || media.length === 0 || media.startsWith('BLOCKED') || media.startsWith('NOT_EVALUATED')) {
      errors.push('normalized_payload_evidence_media_type must be concrete');
    }
    if (runId !== ev.run_id) {
      errors.push('normalized_payload_evidence_run_id must equal run_id');
    }
    if (subj !== ev.implementation_subject_head) {
      errors.push('normalized_payload_evidence_subject_head must equal implementation_subject_head');
    }
  }

  // Verify derived state machine consistency
  if (flags && (ev.cleanup_status === 'CLEAN' || ev.cleanup_status === 'FAILED')) {
    const derived = deriveSpikeEvidenceStates({
      flags,
      cleanup_status: ev.cleanup_status,
      gateAndLineageValid: true,
    });
    if (flags.SPARSE_PAYLOAD_VERIFIED === 'VERIFIED' && errors.length === 0) {
      if (ev.SPARSEVEC_SPIKE_PASS_STAGE_A !== derived.SPARSEVEC_SPIKE_PASS_STAGE_A) {
        errors.push('SPARSEVEC_SPIKE_PASS_STAGE_A does not match state machine');
      }
    }
    if (
      ev.candidate_a_readiness_state !== derived.candidate_a_readiness_state ||
      ev.execution_completion_state !== derived.execution_completion_state ||
      ev.sparsevec_spike_status !== derived.sparsevec_spike_status ||
      ev.readiness_status !== derived.readiness_status ||
      ev.rag_candidate_status !== derived.rag_candidate_status
    ) {
      errors.push('Derived aggregate state fields do not match state machine');
    }
  }

  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}
