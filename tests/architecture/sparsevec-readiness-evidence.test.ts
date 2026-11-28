import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  MANIFEST_PATH,
  PINNED_PGVECTOR_IMAGE_REF,
  PINNED_PGVECTOR_VERSION,
  SPARSE_D,
  canonicalizeSyntheticSparseForArchitectureTest,
  deriveMappingContractVerified,
  mapActualPortSparseToPgSparsevec,
  resolveDbProbeMode,
  sha256Utf8,
  validateChineseManifest,
  type ChineseSampleManifest,
} from '../helpers/sparsevec-readiness.js';

const ROOT = resolve(import.meta.dirname, '../..');
const manifestRaw = JSON.parse(readFileSync(resolve(ROOT, MANIFEST_PATH), 'utf8')) as ChineseSampleManifest;

describe('Slice 21 T003 — Frozen Chinese sample manifest', () => {
  it('passes full manifest structural, SHA-256, anchor, length, rights, outbound, and privacy checks', () => {
    const validation = validateChineseManifest(manifestRaw);
    expect(validation).toEqual({ ok: true, manifest: manifestRaw });
  });

  it('freezes exact 6 documents and 3 queries with expected IDs, corrected D04 URL, and distractor sets', () => {
    expect(manifestRaw.documents.map((d) => d.doc_id)).toEqual(['D01', 'D02', 'D03', 'D04', 'D05', 'D06']);
    const d04 = manifestRaw.documents.find((d) => d.doc_id === 'D04');
    expect(d04?.source_url).toBe('http://fx.xwapp.moe.gov.cn/article/202209/63214de5f858056a22552341.html');

    expect(manifestRaw.queries.map((q) => q.query_id)).toEqual(['Q01', 'Q02', 'Q03']);
    const byQuery = Object.fromEntries(manifestRaw.queries.map((q) => [q.query_id, q]));
    expect(byQuery.Q01.expected_doc_id).toBe('D01');
    expect(byQuery.Q01.distractor_doc_ids).toEqual(['D04', 'D05']);
    expect(byQuery.Q02.expected_doc_id).toBe('D02');
    expect(byQuery.Q02.distractor_doc_ids).toEqual(['D04', 'D06']);
    expect(byQuery.Q03.expected_doc_id).toBe('D03');
    expect(byQuery.Q03.distractor_doc_ids).toEqual(['D05', 'D06']);
  });

  it('verifies every excerpt starts with its NFKC anchor, has 30..400 code points, and recomputes text_sha256', () => {
    for (const doc of manifestRaw.documents) {
      expect(doc.excerpt.startsWith(doc.anchor.normalize('NFKC'))).toBe(true);
      const codePoints = Array.from(doc.excerpt).length;
      expect(codePoints).toBeGreaterThanOrEqual(30);
      expect(codePoints).toBeLessThanOrEqual(400);
      expect(sha256Utf8(doc.excerpt)).toBe(doc.text_sha256);
    }
  });

  it('verifies mechanical key-term presence in query + target and absence in declared distractors', () => {
    const docsById = new Map(manifestRaw.documents.map((d) => [d.doc_id, d]));
    for (const q of manifestRaw.queries) {
      const key = q.key_term.normalize('NFKC');
      expect(q.query_text.normalize('NFKC').includes(key)).toBe(true);
      expect(docsById.get(q.expected_doc_id)?.excerpt.includes(key)).toBe(true);
      for (const distId of q.distractor_doc_ids) {
        expect(docsById.get(distId)?.excerpt.includes(key)).toBe(false);
      }
    }
  });
});

describe('Slice 21 T004 — Sparse Mapping and Numeric Contract', () => {
  it('index 0 -> 1', () => {
    const res = mapActualPortSparseToPgSparsevec([{ index: 0, value: 0.5 }]);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.entries).toEqual([{ coord: 1, value: 0.5 }]);
      expect(res.canonicalText).toBe(`{1:0.5}/${SPARSE_D}`);
    }
  });

  it('D-1 -> D', () => {
    const res = mapActualPortSparseToPgSparsevec([{ index: SPARSE_D - 1, value: -0.25 }]);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.entries).toEqual([{ coord: SPARSE_D, value: -0.25 }]);
      expect(res.canonicalText).toBe(`{${SPARSE_D}:-0.25}/${SPARSE_D}`);
    }
  });

  it('D reject', () => {
    const res = mapActualPortSparseToPgSparsevec([{ index: SPARSE_D, value: 0.5 }]);
    expect(res).toEqual({ ok: false, code: 'INDEX_OUT_OF_RANGE', detail: expect.any(String) });
  });

  it('key 5000 + dense dim 1024 accepted', () => {
    const res = mapActualPortSparseToPgSparsevec([{ index: 5000, value: 0.125 }]);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.dimension).toBe(SPARSE_D);
      expect(res.entries).toEqual([{ coord: 5001, value: 0.125 }]);
    }
  });

  it('synthetic unsorted unique fixture canonicalizes correctly', () => {
    const res = canonicalizeSyntheticSparseForArchitectureTest([
      { index: 10, value: 0.25 },
      { index: 2, value: -0 },
      { index: 1, value: 0.5 },
    ]);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.entries).toEqual([
        { coord: 2, value: 0.5 },
        { coord: 11, value: 0.25 },
      ]);
      expect(res.canonicalText).toBe(`{2:0.5,11:0.25}/${SPARSE_D}`);
    }
  });

  it('synthetic duplicate including zero rejects before zero removal', () => {
    const res = canonicalizeSyntheticSparseForArchitectureTest([
      { index: 3, value: 0 },
      { index: 1, value: 0.5 },
      { index: 3, value: 0.25 },
    ]);
    expect(res).toEqual({ ok: false, code: 'DUPLICATE_INDEX', detail: expect.any(String) });
  });

  it('actual non-ascending normalized Port payload rejects', () => {
    const res = mapActualPortSparseToPgSparsevec([
      { index: 10, value: 0.5 },
      { index: 2, value: 0.25 },
    ]);
    expect(res).toEqual({ ok: false, code: 'NON_CANONICAL_ORDER', detail: expect.any(String) });
  });

  it('actual duplicate including zero rejects', () => {
    const res = mapActualPortSparseToPgSparsevec([
      { index: 2, value: 0 },
      { index: 2, value: 0.5 },
    ]);
    expect(res).toEqual({ ok: false, code: 'DUPLICATE_INDEX', detail: expect.any(String) });
  });

  it('NaN / ±Inf reject', () => {
    expect(mapActualPortSparseToPgSparsevec([{ index: 0, value: Number.NaN }]).ok).toBe(false);
    expect(mapActualPortSparseToPgSparsevec([{ index: 0, value: Number.POSITIVE_INFINITY }])).toEqual({
      ok: false,
      code: 'NONFINITE_VALUE',
      detail: expect.any(String),
    });
    expect(mapActualPortSparseToPgSparsevec([{ index: 0, value: Number.NEGATIVE_INFINITY }])).toEqual({
      ok: false,
      code: 'NONFINITE_VALUE',
      detail: expect.any(String),
    });
  });

  it('3.5e38 overflow reject', () => {
    const res = mapActualPortSparseToPgSparsevec([{ index: 0, value: 3.5e38 }]);
    expect(res).toEqual({ ok: false, code: 'FLOAT32_OVERFLOW', detail: expect.any(String) });
  });

  it('1e-46 underflow reject', () => {
    const res = mapActualPortSparseToPgSparsevec([{ index: 0, value: 1e-46 }]);
    expect(res).toEqual({ ok: false, code: 'FLOAT32_UNDERFLOW_TO_ZERO', detail: expect.any(String) });
  });

  it('±0 removal', () => {
    const res = mapActualPortSparseToPgSparsevec([
      { index: 0, value: +0 },
      { index: 1, value: 0.5 },
      { index: 2, value: -0 },
    ]);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.entries).toEqual([{ coord: 2, value: 0.5 }]);
      expect(res.nnz).toBe(1);
    }
  });

  it('all-zero reject', () => {
    const res = mapActualPortSparseToPgSparsevec([
      { index: 0, value: 0 },
      { index: 1, value: -0 },
    ]);
    expect(res).toEqual({ ok: false, code: 'EMPTY_SPARSE', detail: expect.any(String) });
  });

  it('empty reject', () => {
    const res = mapActualPortSparseToPgSparsevec([]);
    expect(res).toEqual({ ok: false, code: 'EMPTY_SPARSE', detail: expect.any(String) });
  });

  it('null reject', () => {
    expect(mapActualPortSparseToPgSparsevec(null)).toEqual({
      ok: false,
      code: 'SPARSE_MISSING',
      detail: expect.any(String),
    });
    expect(mapActualPortSparseToPgSparsevec(undefined)).toEqual({
      ok: false,
      code: 'SPARSE_MISSING',
      detail: expect.any(String),
    });
  });

  it('sparseVocabularyMax = D allowed', () => {
    const res = mapActualPortSparseToPgSparsevec([{ index: SPARSE_D - 1, value: 0.5 }], {
      sparseVocabularyMax: SPARSE_D,
    });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.sparseVocabularyBound).toBe(SPARSE_D);
  });

  it('sparseVocabularyMax > D rejects experiment', () => {
    const res = mapActualPortSparseToPgSparsevec([{ index: 0, value: 0.5 }], {
      sparseVocabularyMax: SPARSE_D + 1,
    });
    expect(res).toEqual({ ok: false, code: 'INVALID_EXPERIMENT_CONFIG', detail: expect.any(String) });
  });

  it('index >= sparseVocabularyMax rejects when bound <= D (including zero-valued entry)', () => {
    const res = mapActualPortSparseToPgSparsevec(
      [
        { index: 0, value: 0.5 },
        { index: 100, value: 0 },
      ],
      { sparseVocabularyMax: 100 },
    );
    expect(res).toEqual({ ok: false, code: 'INDEX_OUT_OF_RANGE', detail: expect.any(String) });
  });

  it('missing sparseVocabularyMax records NOT_PROVIDED and observed-only compatibility', () => {
    const res = mapActualPortSparseToPgSparsevec([{ index: 5, value: 0.5 }]);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.sparseVocabularyBound).toBe('NOT_PROVIDED');
  });

  it('derives MAPPING_CONTRACT_VERIFIED = VERIFIED only when all mapping checks pass', () => {
    expect(deriveMappingContractVerified({ a: true, b: true })).toBe('VERIFIED');
    expect(deriveMappingContractVerified({ a: true, b: false })).toBe('FAIL');
    expect(deriveMappingContractVerified({})).toBe('NOT_EVALUATED');
  });
});

describe('Slice 21 T004 — DB probe execution mode helper (Plan §7.1)', () => {
  it('returns RUN for CI_STAGE_A_IDENTITY', () => {
    expect(
      resolveDbProbeMode({
        PGVECTOR_STAGE: 'STAGE_A',
        PGVECTOR_ENVIRONMENT_KIND: 'CI_INTEGRATION',
        PGVECTOR_EXPECTED_VERSION: PINNED_PGVECTOR_VERSION,
        PGVECTOR_IMAGE_REF: PINNED_PGVECTOR_IMAGE_REF,
        PGVECTOR_ENVIRONMENT_ID: 'ci-1',
        PGVECTOR_REPOSITORY_COMMIT: 'abc',
        GITHUB_RUN_ID: '123',
      }).mode,
    ).toBe('RUN');
  });

  it('returns RUN for MANUAL_OPT_IN', () => {
    expect(
      resolveDbProbeMode({
        SPARSEVEC_DB_READINESS_TEST: '1',
        PGVECTOR_EXPECTED_VERSION: PINNED_PGVECTOR_VERSION,
        PGVECTOR_IMAGE_REF: PINNED_PGVECTOR_IMAGE_REF,
      }).mode,
    ).toBe('RUN');
  });

  it('returns FAIL for PARTIAL_IDENTITY', () => {
    expect(
      resolveDbProbeMode({
        SPARSEVEC_DB_READINESS_TEST: '1',
        PGVECTOR_EXPECTED_VERSION: PINNED_PGVECTOR_VERSION,
      }).mode,
    ).toBe('FAIL');
  });

  it('returns SKIP when only DATABASE_URL is set', () => {
    expect(
      resolveDbProbeMode({
        DATABASE_URL: 'postgres://user:pass@localhost:5432/db',
      }).mode,
    ).toBe('SKIP');
  });
});

import { existsSync } from 'node:fs';
import {
  EVIDENCE_PATH,
  FROZEN_SPEC_BLOB,
  FROZEN_SPEC_HEAD,
  FUSION_RECOMPUTE_ABS_TOL,
  computeFixedFusion,
  deriveFusionPrototypeVerified,
  deriveSpikeEvidenceStates,
  validateSanitizedEvidence,
} from '../helpers/sparsevec-readiness.js';

describe('Slice 21 T009 — Fixed Fusion Reference (S21-MINMAX-0.5-0.5-V1)', () => {
  const sixIds = ['D01', 'D02', 'D03', 'D04', 'D05', 'D06'];

  it('computes per-channel min-max and 0.5/0.5 fusion within 1e-12 recompute tolerance', () => {
    const res = computeFixedFusion('Q01', 'D01', [
      { sample_id: 'D01', raw_dense: 0.9, raw_sparse: 10 },
      { sample_id: 'D02', raw_dense: 0.5, raw_sparse: 2 },
      { sample_id: 'D03', raw_dense: 0.3, raw_sparse: 1 },
      { sample_id: 'D04', raw_dense: 0.1, raw_sparse: 0 },
      { sample_id: 'D05', raw_dense: 0.2, raw_sparse: 0.5 },
      { sample_id: 'D06', raw_dense: 0.4, raw_sparse: 1.5 },
    ]);
    expect(res.ranked_doc_ids[0]).toBe('D01');
    expect(res.strict_first).toBe(true);
    expect(res.recompute_max_abs_diff).toBeLessThanOrEqual(FUSION_RECOMPUTE_ABS_TOL);
  });

  it('maps constant channel to 0 without NaN', () => {
    const res = computeFixedFusion('Q01', 'D01', [
      { sample_id: 'D01', raw_dense: 0.5, raw_sparse: 4 },
      { sample_id: 'D02', raw_dense: 0.5, raw_sparse: 2 },
      { sample_id: 'D03', raw_dense: 0.5, raw_sparse: 1 },
      { sample_id: 'D04', raw_dense: 0.5, raw_sparse: 0 },
      { sample_id: 'D05', raw_dense: 0.5, raw_sparse: 0 },
      { sample_id: 'D06', raw_dense: 0.5, raw_sparse: 0 },
    ]);
    for (const c of res.candidates) {
      expect(c.norm_dense).toBe(0);
    }
    expect(res.strict_first).toBe(true);
  });

  it('rejects missing channel, duplicate sample_id, non-finite score, and count != 6', () => {
    expect(() =>
      computeFixedFusion('Q01', 'D01', [
        { sample_id: 'D01', raw_dense: 0.9, raw_sparse: 1 },
        { sample_id: 'D02', raw_dense: 0.8, raw_sparse: 1 },
      ]),
    ).toThrow(/FUSION_INVALID_CANDIDATE_COUNT/);

    expect(() =>
      computeFixedFusion(
        'Q01',
        'D01',
        ['D01', 'D01', 'D03', 'D04', 'D05', 'D06'].map((id) => ({ sample_id: id, raw_dense: 0.5, raw_sparse: 1 })),
      ),
    ).toThrow(/FUSION_DUPLICATE_OR_INVALID_ID/);

    expect(() =>
      computeFixedFusion(
        'Q01',
        'D01',
        sixIds.map((id, idx) => ({ sample_id: id, raw_dense: idx === 0 ? Number.NaN : 0.5, raw_sparse: 1 })),
      ),
    ).toThrow(/FUSION_NONFINITE_DENSE/);

    expect(() =>
      computeFixedFusion(
        'Q01',
        'D01',
        sixIds.map((id, idx) => ({ sample_id: id, raw_dense: 0.5, raw_sparse: idx === 1 ? Number.POSITIVE_INFINITY : 1 })),
      ),
    ).toThrow(/FUSION_NONFINITE_SPARSE/);
  });

  it('handles exact tie deterministically by sample_id ASC with strict_first = false', () => {
    const res = computeFixedFusion('Q02', 'D02', [
      { sample_id: 'D01', raw_dense: 1, raw_sparse: 1 },
      { sample_id: 'D02', raw_dense: 1, raw_sparse: 1 },
      { sample_id: 'D03', raw_dense: 0, raw_sparse: 0 },
      { sample_id: 'D04', raw_dense: 0, raw_sparse: 0 },
      { sample_id: 'D05', raw_dense: 0, raw_sparse: 0 },
      { sample_id: 'D06', raw_dense: 0, raw_sparse: 0 },
    ]);
    expect(res.ranked_doc_ids.slice(0, 2)).toEqual(['D01', 'D02']);
    expect(res.strict_first).toBe(false);
  });

  it('derives FUSION_PROTOTYPE_VERIFIED = UNKNOWN when technical chain is VERIFIED but chinese_queries_passed < 3', () => {
    expect(
      deriveFusionPrototypeVerified({
        fusionMechanicsOk: true,
        lowerTechnicalFlagsVerified: true,
        chineseQueriesPassed: 2,
      }),
    ).toBe('UNKNOWN');
    expect(
      deriveFusionPrototypeVerified({
        fusionMechanicsOk: true,
        lowerTechnicalFlagsVerified: true,
        chineseQueriesPassed: 3,
      }),
    ).toBe('VERIFIED');
  });
});

describe('Slice 21 T010 — Evidence State Machine, Schema, Vocabulary, and Privacy', () => {
  function makeValidEvidenceSkeleton(overrides: Record<string, unknown> = {}) {
    const baseFlags = {
      MAPPING_CONTRACT_VERIFIED: 'VERIFIED' as const,
      SPARSE_PAYLOAD_VERIFIED: 'BLOCKED' as const,
      PGVECTOR_SPARSEVEC_VERIFIED: 'VERIFIED' as const,
      FUSION_PROTOTYPE_VERIFIED: 'NOT_EVALUATED' as const,
    };
    const states = deriveSpikeEvidenceStates({
      flags: baseFlags,
      cleanup_status: 'CLEAN',
      gateAndLineageValid: true,
    });
    return {
      schema_version: 1,
      evidence_kind: 'S21_SPARSEVEC_READINESS_SPIKE',
      run_id: 'run-test-1',
      checked_at: '2026-11-28T00:00:00.000Z',
      evidence_ref: 'tests/evidence/sparsevec-readiness-stage-a.json#subject=abc#run=run-test-1',
      implementation_subject_head: 'abc',
      implementation_subject_tree_clean: true,
      manifest_commit: 'def',
      frozen_spec_head: FROZEN_SPEC_HEAD,
      frozen_spec_blob: FROZEN_SPEC_BLOB,
      planning_head: 'plan-head',
      slice19_provenance: { pgvector_readiness_ci_run: '46103105108', image_ref: PINNED_PGVECTOR_IMAGE_REF },
      slice20_provenance: { implementation_pr: 142 },
      stage: 'STAGE_A',
      stage_b: 'NOT_EVALUATED',
      stage_c: 'NOT_EVALUATED',
      postgres_version: '18.0',
      postgres_version_num: 180000,
      tencentdb_kernel_version: 'NOT_APPLICABLE_STAGE_A',
      extension_name: 'vector',
      extension_version: '0.8.7',
      image_ref: PINNED_PGVECTOR_IMAGE_REF,
      image_digest_source: 'operator_docker_inspect',
      execution_role: 'xiaoshuyin_app',
      runtime_superuser: false,
      runtime_bypassrls: false,
      runtime_public_schema_create: false,
      extension_owner: 'postgres',
      provider_calls: [],
      configured_sparse_cap: 1000,
      sparse_vocabulary_bound: 'NOT_PROVIDED',
      sparse_dimension: SPARSE_D,
      dense_dimension: 1024,
      dimension_policy: 'S21_SPIKE_ONLY_D_1E9',
      items: [],
      observed_nnz_max: 0,
      observed_min_index: 0,
      observed_max_index: 0,
      normalized_payload_evidence_ref: 'BLOCKED:MISSING_CREDENTIALS',
      normalized_payload_evidence_sha256: 'BLOCKED:MISSING_CREDENTIALS',
      normalized_payload_evidence_version: 'BLOCKED:MISSING_CREDENTIALS',
      normalized_payload_evidence_media_type: 'BLOCKED:MISSING_CREDENTIALS',
      normalized_payload_evidence_run_id: 'run-test-1',
      normalized_payload_evidence_subject_head: 'abc',
      mapping_result: 'VERIFIED',
      db_roundtrip_result: 'VERIFIED',
      distance_result: 'VERIFIED',
      independent_calculation: 'VERIFIED',
      tolerances: { sparse_ip_rel: 1e-5, dense_cosine_abs: 1.25e-4, fusion_recompute_abs: 1e-12 },
      index_behavior: {
        hnsw_explain_index_used: true,
        planner_restored: true,
        synthetic_boundaries: [],
        actual_hnsw_compatible: false,
      },
      chinese_manifest_id: manifestRaw.manifest_id,
      chinese_manifest_sha256: 'abc',
      source_fingerprints: [],
      queries: [],
      chinese_queries_passed: 0,
      fusion_reference: { formula_id: 'S21-MINMAX-0.5-0.5-V1', recompute_max_abs_diff: 0 },
      negative_probes: [],
      cleanup_status: 'CLEAN',
      limitations: [],
      flags: baseFlags,
      ...states,
      readiness_scope: 'CANDIDATE_A_SPARSEVEC_SPIKE_STAGE_A_ONLY',
      candidate_b_status: 'UNAFFECTED',
      candidate_c_status: 'UNAFFECTED',
      rag_readiness: 'NOT_DERIVED',
      production_route_selection: 'DEFERRED_TO_GOLD_DATASET',
      ...overrides,
    };
  }

  it('derives precedence FAIL > BLOCKED > UNKNOWN > NOT_EVALUATED > PASS and cleanup FAILED forces FAIL', () => {
    expect(
      deriveSpikeEvidenceStates({
        flags: {
          MAPPING_CONTRACT_VERIFIED: 'VERIFIED',
          SPARSE_PAYLOAD_VERIFIED: 'BLOCKED',
          PGVECTOR_SPARSEVEC_VERIFIED: 'VERIFIED',
          FUSION_PROTOTYPE_VERIFIED: 'NOT_EVALUATED',
        },
        cleanup_status: 'FAILED',
        gateAndLineageValid: true,
      }).candidate_a_readiness_state,
    ).toBe('FAIL');

    expect(
      deriveSpikeEvidenceStates({
        flags: {
          MAPPING_CONTRACT_VERIFIED: 'VERIFIED',
          SPARSE_PAYLOAD_VERIFIED: 'VERIFIED',
          PGVECTOR_SPARSEVEC_VERIFIED: 'VERIFIED',
          FUSION_PROTOTYPE_VERIFIED: 'UNKNOWN',
        },
        cleanup_status: 'CLEAN',
        gateAndLineageValid: true,
      }).execution_completion_state,
    ).toBe('INCONCLUSIVE');
  });

  it('rejects forbidden self-reference keys, privacy keys, overclaim tokens, and absent positive bundle metadata', () => {
    expect(validateSanitizedEvidence(makeValidEvidenceSkeleton({ repo_head: 'bad' }), manifestRaw).ok).toBe(false);
    expect(validateSanitizedEvidence(makeValidEvidenceSkeleton({ raw_response: {} }), manifestRaw).ok).toBe(false);
    expect(validateSanitizedEvidence(makeValidEvidenceSkeleton({ readiness_status: 'RAG_READY' }), manifestRaw).ok).toBe(
      false,
    );
    expect(
      validateSanitizedEvidence(
        makeValidEvidenceSkeleton({
          flags: {
            MAPPING_CONTRACT_VERIFIED: 'VERIFIED',
            SPARSE_PAYLOAD_VERIFIED: 'VERIFIED',
            PGVECTOR_SPARSEVEC_VERIFIED: 'VERIFIED',
            FUSION_PROTOTYPE_VERIFIED: 'VERIFIED',
          },
          SPARSEVEC_SPIKE_PASS_STAGE_A: true,
          candidate_a_readiness_state: 'PASS',
          execution_completion_state: 'COMPLETED_WITH_PASS',
          sparsevec_spike_status: 'PASS_STAGE_A',
          readiness_status: 'PASS_STAGE_A',
          rag_candidate_status: 'CANDIDATE_A_SPARSEVEC_PREREQUISITE_MET_STAGE_A',
          normalized_payload_evidence_ref: 'BLOCKED:MISSING',
        }),
        manifestRaw,
      ).ok,
    ).toBe(false);
  });

  it('validates the written repository evidence file if present', () => {
    const absEvidence = resolve(ROOT, EVIDENCE_PATH);
    if (existsSync(absEvidence)) {
      const ev = JSON.parse(readFileSync(absEvidence, 'utf8'));
      const check = validateSanitizedEvidence(ev, manifestRaw);
      expect(check).toEqual({ ok: true });
    }
  });
});
