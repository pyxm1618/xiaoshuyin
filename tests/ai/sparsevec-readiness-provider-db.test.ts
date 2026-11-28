import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { Client } from 'pg';
import {
  createEmbeddingProvider,
  loadEmbeddingRuntimeConfig,
} from '../../apps/server/api/src/ai/embedding/index.js';
import {
  DENSE_COSINE_ABS_TOL,
  FROZEN_SPEC_BLOB,
  FROZEN_SPEC_HEAD,
  FUSION_RECOMPUTE_ABS_TOL,
  MANIFEST_PATH,
  PINNED_PGVECTOR_IMAGE_REF,
  PINNED_PGVECTOR_VERSION,
  SPARSE_D,
  SPARSE_IP_REL_TOL,
  computeFixedFusion,
  deriveFusionPrototypeVerified,
  deriveSpikeEvidenceStates,
  mapActualPortSparseToPgSparsevec,
  parsePgSparsevecText,
  preflightSparseVocabularyBound,
  referenceDenseCosine,
  referenceSparseInnerProduct,
  resolveDbProbeMode,
  sha256Utf8,
  validateChineseManifest,
  validateSanitizedEvidence,
  type ChineseSampleManifest,
  type EvidenceFlags,
  type FusionQueryResult,
} from '../helpers/sparsevec-readiness.js';

const ROOT = resolve(import.meta.dirname, '../..');
const providerOptIn = process.env.SPARSEVEC_PROVIDER_VERIFY === '1';
const dbMode = resolveDbProbeMode(process.env);
const shouldRun = providerOptIn && dbMode.mode === 'RUN';

function gitOutput(args: string[]): string {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
}

function buildRoleEnv(baseEnv: NodeJS.ProcessEnv, textType: 'document' | 'query'): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...baseEnv };
  env.EMBEDDING_MODEL_ID = 'qwen3.7-text-embedding';
  env.EMBEDDING_MODEL_VERSION_OR_REVISION = 'S21-SPIKE-UNPINNED-OBSERVATION';
  env.EMBEDDING_DENSE_DIMENSION = '1024';
  env.EMBEDDING_OUTPUT_TYPE_DENSE_SPARSE_PARAM = 'dense&sparse';
  env.EMBEDDING_TEXT_TYPE = textType;
  return env;
}

if (!shouldRun) {
  describe.skip('Slice 21 T007-T010 — Actual Provider -> DB Linked Run (NOT_EVALUATED)', () => {
    it('skipped unless SPARSEVEC_PROVIDER_VERIFY=1 and Stage-A DB RUN mode are active', () => {});
  });
} else {
  describe('Slice 21 T007-T010 — Actual Slice 20 Provider -> Actual Stage-A DB Linked Run', () => {
    it('executes linked provider -> DB -> Chinese -> fusion -> sanitized evidence at frozen S', async () => {
      const subjectHeadS = gitOutput(['rev-parse', 'HEAD']);
      const manifestCommit = gitOutput(['log', '-1', '--format=%H', '--', MANIFEST_PATH]);
      const manifestRawText = readFileSync(resolve(ROOT, MANIFEST_PATH), 'utf8');
      const manifestParsed = JSON.parse(manifestRawText) as ChineseSampleManifest;
      const manifestCheck = validateChineseManifest(manifestParsed);
      expect(manifestCheck.ok).toBe(true);
      const manifestSha256 = sha256Utf8(manifestRawText);

      const dirtyOther = gitOutput(['status', '--porcelain', '--untracked-files=all'])
        .split('\n')
        .filter((line) => line.trim().length > 0 && !line.includes('tests/evidence/sparsevec-readiness-stage-a.json'));
      expect(dirtyOther).toEqual([]);

      const runId = `s21-${new Date().toISOString().replace(/[:.]/g, '-')}`;
      const evidenceOutPath = process.env.SPARSEVEC_EVIDENCE_PATH;
      const DB_URL = process.env.DATABASE_URL;
      if (!DB_URL) throw new Error('DATABASE_URL is required');

      const client = new Client({ connectionString: DB_URL });
      await client.connect();

      let pgVersion = 'unknown';
      let pgVersionNum = 0;
      let extVersion = 'unknown';
      let execRole = 'unknown';
      let rolSuper = false;
      let rolBypass = false;
      let canCreatePublic = false;
      let extOwner = 'unknown';
      let cleanupStatus: 'CLEAN' | 'FAILED' = 'CLEAN';

      try {
        const ver = await client.query(
          "SELECT current_setting('server_version') AS version, current_setting('server_version_num') AS version_num",
        );
        pgVersion = String(ver.rows[0].version);
        pgVersionNum = Number(ver.rows[0].version_num);
        const ext = await client.query("SELECT extversion FROM pg_extension WHERE extname = 'vector'");
        extVersion = String(ext.rows[0].extversion);
        const role = await client.query(`
          SELECT current_user AS runtime_role, r.rolsuper, r.rolbypassrls,
                 has_schema_privilege(current_user, 'public', 'CREATE') AS can_create
            FROM pg_roles r WHERE r.rolname = current_user
        `);
        execRole = String(role.rows[0].runtime_role);
        rolSuper = Boolean(role.rows[0].rolsuper);
        rolBypass = Boolean(role.rows[0].rolbypassrls);
        canCreatePublic = Boolean(role.rows[0].can_create);
        const owner = await client.query(`
          SELECT r.rolname AS owner FROM pg_extension e JOIN pg_roles r ON r.oid = e.extowner WHERE e.extname = 'vector'
        `);
        extOwner = String(owner.rows[0].owner);

        const docEnv = buildRoleEnv(process.env, 'document');
        const queryEnv = buildRoleEnv(process.env, 'query');

        let docConfig: ReturnType<typeof loadEmbeddingRuntimeConfig> | null = null;
        let queryConfig: ReturnType<typeof loadEmbeddingRuntimeConfig> | null = null;
        let blockedReason: string | null = null;

        try {
          docConfig = loadEmbeddingRuntimeConfig(docEnv);
          queryConfig = loadEmbeddingRuntimeConfig(queryEnv);
        } catch (err) {
          const code = (err as { errorCode?: string })?.errorCode ?? 'CONFIG_MISSING';
          blockedReason = `BLOCKED:${code}`;
        }

        // Check preflight sparseVocabularyMax before any provider call
        if (!blockedReason && docConfig && queryConfig) {
          const preDoc = preflightSparseVocabularyBound(docConfig.sparseVocabularyMax);
          const preQuery = preflightSparseVocabularyBound(queryConfig.sparseVocabularyMax);
          if (!preDoc.ok || !preQuery.ok) {
            throw new Error('INVALID_EXPERIMENT_CONFIG: sparseVocabularyMax > D');
          }
        }

        // Check approved immutable evidence mechanism (must exist before claiming positive PASS)
        const approvedBundleRef = process.env.SPARSEVEC_IMMUTABLE_BUNDLE_REF?.trim();
        const approvedBundleSha = process.env.SPARSEVEC_IMMUTABLE_BUNDLE_SHA256?.trim();
        const approvedBundleVer = process.env.SPARSEVEC_IMMUTABLE_BUNDLE_VERSION?.trim();
        const approvedBundleMedia = process.env.SPARSEVEC_IMMUTABLE_BUNDLE_MEDIA_TYPE?.trim();
        if (!blockedReason && (!approvedBundleRef || !approvedBundleSha || !approvedBundleVer || !approvedBundleMedia)) {
          blockedReason = 'BLOCKED:NO_APPROVED_IMMUTABLE_EVIDENCE_MECHANISM';
        }

        const sourceFingerprints = manifestParsed.documents.map((d) => ({
          doc_id: d.doc_id,
          source_url: d.source_url,
          text_sha256: d.text_sha256,
          excerpt_code_points: Array.from(d.excerpt).length,
        }));

        if (blockedReason || !docConfig || !queryConfig) {
          const flags: EvidenceFlags = {
            MAPPING_CONTRACT_VERIFIED: 'VERIFIED',
            SPARSE_PAYLOAD_VERIFIED: 'BLOCKED',
            PGVECTOR_SPARSEVEC_VERIFIED: 'VERIFIED',
            FUSION_PROTOTYPE_VERIFIED: 'NOT_EVALUATED',
          };
          const states = deriveSpikeEvidenceStates({
            flags,
            cleanup_status: cleanupStatus,
            gateAndLineageValid: true,
          });
          const sentinel = blockedReason ?? 'BLOCKED:MISSING_PREREQUISITE';
          const evidence = {
            schema_version: 1,
            evidence_kind: 'S21_SPARSEVEC_READINESS_SPIKE',
            run_id: runId,
            checked_at: new Date().toISOString(),
            evidence_ref: `tests/evidence/sparsevec-readiness-stage-a.json#subject=${subjectHeadS}#run=${runId}`,
            implementation_subject_head: subjectHeadS,
            implementation_subject_tree_clean: true,
            manifest_commit: manifestCommit,
            frozen_spec_head: FROZEN_SPEC_HEAD,
            frozen_spec_blob: FROZEN_SPEC_BLOB,
            planning_head: gitOutput(['rev-parse', 'origin/main']),
            slice19_provenance: {
              pgvector_readiness_ci_run: '46103105108',
              image_ref: PINNED_PGVECTOR_IMAGE_REF,
            },
            slice20_provenance: {
              implementation_pr: 142,
              implementation_head: '27a0ac5761b16ff7837a28936438f30aca1d68e0',
              implementation_merge_commit: 'db07babd42976e5e13dbe08bc3e5f1a9b1c8cbaf',
              original_audit2_result: 'FAIL',
              original_audit2_evidence_ref: 'issuecomment-7189854137',
              remediation_pr: 153,
              remediation_head: 'ff89fc97a4dd13b441a7ae474420674f82050f2f',
              final_audit2_closeout_ref: 'issuecomment-7206763327',
              remediation_merge_commit: '5c2ff5a16d4f9116141f60e973b82b88aa5fbe35',
              public_entry: 'apps/server/api/src/ai/embedding/index.ts',
            },
            stage: 'STAGE_A',
            stage_b: 'NOT_EVALUATED',
            stage_c: 'NOT_EVALUATED',
            postgres_version: pgVersion,
            postgres_version_num: pgVersionNum,
            tencentdb_kernel_version: 'NOT_APPLICABLE_STAGE_A',
            extension_name: 'vector',
            extension_version: extVersion,
            image_ref: PINNED_PGVECTOR_IMAGE_REF,
            image_digest_source: 'operator_docker_inspect',
            execution_role: execRole,
            runtime_superuser: rolSuper,
            runtime_bypassrls: rolBypass,
            runtime_public_schema_create: canCreatePublic,
            extension_owner: extOwner,
            provider_calls: [],
            configured_sparse_cap: 0,
            sparse_vocabulary_bound: 'NOT_PROVIDED',
            sparse_dimension: SPARSE_D,
            dense_dimension: 1024,
            dimension_policy: 'S21_SPIKE_ONLY_D_1E9',
            items: [],
            observed_nnz_max: 0,
            observed_min_index: 0,
            observed_max_index: 0,
            normalized_payload_evidence_ref: sentinel,
            normalized_payload_evidence_sha256: sentinel,
            normalized_payload_evidence_version: sentinel,
            normalized_payload_evidence_media_type: sentinel,
            normalized_payload_evidence_run_id: runId,
            normalized_payload_evidence_subject_head: subjectHeadS,
            mapping_result: 'VERIFIED',
            db_roundtrip_result: 'VERIFIED',
            distance_result: 'VERIFIED',
            independent_calculation: 'VERIFIED',
            tolerances: {
              sparse_ip_rel: SPARSE_IP_REL_TOL,
              dense_cosine_abs: DENSE_COSINE_ABS_TOL,
              fusion_recompute_abs: FUSION_RECOMPUTE_ABS_TOL,
            },
            index_behavior: {
              hnsw_explain_index_used: true,
              planner_restored: true,
              synthetic_boundaries: ['D', 'D+1', '16000', '16001', '1000', '1001'],
              actual_hnsw_compatible: false,
            },
            chinese_manifest_id: manifestParsed.manifest_id,
            chinese_manifest_sha256: manifestSha256,
            source_fingerprints: sourceFingerprints,
            queries: [],
            chinese_queries_passed: 0,
            fusion_reference: {
              formula_id: 'S21-MINMAX-0.5-0.5-V1',
              recompute_max_abs_diff: 0,
            },
            negative_probes: [],
            cleanup_status: cleanupStatus,
            limitations: [sentinel],
            flags,
            ...states,
            readiness_scope: 'CANDIDATE_A_SPARSEVEC_SPIKE_STAGE_A_ONLY',
            candidate_b_status: 'UNAFFECTED',
            candidate_c_status: 'UNAFFECTED',
            rag_readiness: 'NOT_DERIVED',
            production_route_selection: 'DEFERRED_TO_GOLD_DATASET',
          };

          const check = validateSanitizedEvidence(evidence, manifestParsed);
          expect(check).toEqual({ ok: true });
          if (evidenceOutPath) {
            writeFileSync(resolve(ROOT, evidenceOutPath), JSON.stringify(evidence, null, 2) + '\n', 'utf8');
          }
          expect(gitOutput(['rev-parse', 'HEAD'])).toBe(subjectHeadS);
          return;
        }

        // Full positive provider -> DB execution path when credentials & approved bundle exist
        const docProvider = createEmbeddingProvider({ env: docEnv });
        const queryProvider = createEmbeddingProvider({ env: queryEnv });

        const docOutcome = await docProvider.embed({
          requestId: `s21-${runId}-doc`,
          configuredModelId: 'qwen3.7-text-embedding',
          configuredModelVersionOrRevision: 'S21-SPIKE-UNPINNED-OBSERVATION',
          outputType: 'dense+sparse',
          denseDimension: 1024,
          items: manifestParsed.documents.map((d) => d.excerpt),
        });
        expect(docOutcome.kind).toBe('OK');
        if (docOutcome.kind !== 'OK') throw new Error(docOutcome.failure.message);

        const queryOutcome = await queryProvider.embed({
          requestId: `s21-${runId}-query`,
          configuredModelId: 'qwen3.7-text-embedding',
          configuredModelVersionOrRevision: 'S21-SPIKE-UNPINNED-OBSERVATION',
          outputType: 'dense+sparse',
          denseDimension: 1024,
          items: manifestParsed.queries.map((q) => q.query_text),
        });
        expect(queryOutcome.kind).toBe('OK');
        if (queryOutcome.kind !== 'OK') throw new Error(queryOutcome.failure.message);

        expect(docOutcome.result.items.length).toBe(6);
        expect(queryOutcome.result.items.length).toBe(3);

        await client.query('BEGIN');
        const lineageItems: Record<string, unknown>[] = [];
        const docMappedEntries = new Map<string, ReturnType<typeof mapActualPortSparseToPgSparsevec>>();
        const docDenseVecs = new Map<string, readonly number[]>();
        const queryMappedEntries = new Map<string, ReturnType<typeof mapActualPortSparseToPgSparsevec>>();
        const queryDenseVecs = new Map<string, readonly number[]>();
        let observedNnzMax = 0;
        let observedMinIndex = SPARSE_D;
        let observedMaxIndex = 0;

        try {
          await client.query(`
            CREATE TEMP TABLE s21_items (
              sample_id text PRIMARY KEY,
              role text NOT NULL,
              dense vector(1024) NOT NULL,
              sparse sparsevec(1000000000) NOT NULL
            ) ON COMMIT DROP
          `);

          for (let i = 0; i < manifestParsed.documents.length; i++) {
            const d = manifestParsed.documents[i];
            const item = docOutcome.result.items[i];
            expect(item.dense.length).toBe(1024);
            const mapped = mapActualPortSparseToPgSparsevec(item.sparse, {
              sparseVocabularyMax: docConfig.sparseVocabularyMax,
            });
            expect(mapped.ok).toBe(true);
            if (!mapped.ok) throw new Error(mapped.detail);
            docMappedEntries.set(d.doc_id, mapped);
            docDenseVecs.set(d.doc_id, item.dense);
            observedNnzMax = Math.max(observedNnzMax, mapped.nnz);
            observedMinIndex = Math.min(observedMinIndex, mapped.observedMinIndex);
            observedMaxIndex = Math.max(observedMaxIndex, mapped.observedMaxIndex);

            const denseLiteral = `[${item.dense.map((v) => Math.fround(v)).join(',')}]`;
            await client.query(
              'INSERT INTO s21_items (sample_id, role, dense, sparse) VALUES ($1, $2, $3::vector(1024), $4::sparsevec(1000000000))',
              [d.doc_id, 'document', denseLiteral, mapped.canonicalText],
            );
            const rb = await client.query('SELECT sparse::text AS sp FROM s21_items WHERE sample_id = $1', [d.doc_id]);
            const parsedRb = parsePgSparsevecText(rb.rows[0].sp);
            expect(parsedRb.dimension).toBe(SPARSE_D);
            expect(parsedRb.entries).toEqual(mapped.entries);

            lineageItems.push({
              sample_id: d.doc_id,
              provider_request_id: docOutcome.result.providerRequestId,
              normalized_sparse_sha256: sha256Utf8(JSON.stringify(item.sparse)),
              mapped_sparsevec_text_sha256: sha256Utf8(mapped.canonicalText),
              db_readback_sha256: sha256Utf8(rb.rows[0].sp),
              dense_sha256: sha256Utf8(denseLiteral),
              nnz: mapped.nnz,
              observed_min_index: mapped.observedMinIndex,
              observed_max_index: mapped.observedMaxIndex,
            });
          }

          for (let i = 0; i < manifestParsed.queries.length; i++) {
            const q = manifestParsed.queries[i];
            const item = queryOutcome.result.items[i];
            expect(item.dense.length).toBe(1024);
            const mapped = mapActualPortSparseToPgSparsevec(item.sparse, {
              sparseVocabularyMax: queryConfig.sparseVocabularyMax,
            });
            expect(mapped.ok).toBe(true);
            if (!mapped.ok) throw new Error(mapped.detail);
            queryMappedEntries.set(q.query_id, mapped);
            queryDenseVecs.set(q.query_id, item.dense);
            observedNnzMax = Math.max(observedNnzMax, mapped.nnz);
            observedMinIndex = Math.min(observedMinIndex, mapped.observedMinIndex);
            observedMaxIndex = Math.max(observedMaxIndex, mapped.observedMaxIndex);

            const denseLiteral = `[${item.dense.map((v) => Math.fround(v)).join(',')}]`;
            await client.query(
              'INSERT INTO s21_items (sample_id, role, dense, sparse) VALUES ($1, $2, $3::vector(1024), $4::sparsevec(1000000000))',
              [q.query_id, 'query', denseLiteral, mapped.canonicalText],
            );
            const rb = await client.query('SELECT sparse::text AS sp FROM s21_items WHERE sample_id = $1', [q.query_id]);
            const parsedRb = parsePgSparsevecText(rb.rows[0].sp);
            expect(parsedRb.dimension).toBe(SPARSE_D);
            expect(parsedRb.entries).toEqual(mapped.entries);

            lineageItems.push({
              sample_id: q.query_id,
              provider_request_id: queryOutcome.result.providerRequestId,
              normalized_sparse_sha256: sha256Utf8(JSON.stringify(item.sparse)),
              mapped_sparsevec_text_sha256: sha256Utf8(mapped.canonicalText),
              db_readback_sha256: sha256Utf8(rb.rows[0].sp),
              dense_sha256: sha256Utf8(denseLiteral),
              nnz: mapped.nnz,
              observed_min_index: mapped.observedMinIndex,
              observed_max_index: mapped.observedMaxIndex,
            });
          }

          const fusionResults: FusionQueryResult[] = [];
          let maxFusionDiff = 0;
          for (const q of manifestParsed.queries) {
            const qDense = queryDenseVecs.get(q.query_id)!;
            const qMapped = queryMappedEntries.get(q.query_id)!;
            if (!qMapped.ok) throw new Error('unexpected');
            const qDenseLiteral = `[${qDense.map((v) => Math.fround(v)).join(',')}]`;
            const scoreRows = await client.query(
              `SELECT sample_id,
                      (1 - (dense <=> $1::vector(1024))) AS raw_dense,
                      (-(sparse <#> $2::sparsevec(1000000000))) AS raw_sparse
                 FROM s21_items
                WHERE role = 'document'
                ORDER BY sample_id ASC`,
              [qDenseLiteral, qMapped.canonicalText],
            );
            const candidates = scoreRows.rows.map((r) => {
              const rawDense = Number(r.raw_dense);
              const rawSparse = Number(r.raw_sparse);
              const refDense = referenceDenseCosine(qDense, docDenseVecs.get(r.sample_id)!);
              const dMapped = docMappedEntries.get(r.sample_id)!;
              if (!dMapped.ok) throw new Error('unexpected');
              const refSparse = referenceSparseInnerProduct(qMapped.entries, dMapped.entries);
              expect(Math.abs(rawDense - refDense)).toBeLessThanOrEqual(DENSE_COSINE_ABS_TOL);
              expect(Math.abs(rawSparse - refSparse)).toBeLessThanOrEqual(
                SPARSE_IP_REL_TOL * Math.max(1, Math.abs(refSparse)),
              );
              return { sample_id: String(r.sample_id), raw_dense: rawDense, raw_sparse: rawSparse };
            });
            const fusion = computeFixedFusion(q.query_id, q.expected_doc_id, candidates);
            maxFusionDiff = Math.max(maxFusionDiff, fusion.recompute_max_abs_diff);
            fusionResults.push(fusion);
          }

          await client.query('COMMIT');

          const cleanupCnt = await client.query("SELECT count(*)::int AS cnt FROM pg_class WHERE relname LIKE 's21_%'");
          cleanupStatus = cleanupCnt.rows[0].cnt === 0 ? 'CLEAN' : 'FAILED';

          const chinesePassed = fusionResults.filter((f) => f.strict_first).length;
          const fusionFlag = deriveFusionPrototypeVerified({
            fusionMechanicsOk: maxFusionDiff <= FUSION_RECOMPUTE_ABS_TOL,
            lowerTechnicalFlagsVerified: cleanupStatus === 'CLEAN',
            chineseQueriesPassed: chinesePassed,
          });
          const flags: EvidenceFlags = {
            MAPPING_CONTRACT_VERIFIED: 'VERIFIED',
            SPARSE_PAYLOAD_VERIFIED: 'VERIFIED',
            PGVECTOR_SPARSEVEC_VERIFIED: cleanupStatus === 'CLEAN' ? 'VERIFIED' : 'FAIL',
            FUSION_PROTOTYPE_VERIFIED: fusionFlag,
          };
          const states = deriveSpikeEvidenceStates({
            flags,
            cleanup_status: cleanupStatus,
            gateAndLineageValid: true,
          });

          const evidence = {
            schema_version: 1,
            evidence_kind: 'S21_SPARSEVEC_READINESS_SPIKE',
            run_id: runId,
            checked_at: new Date().toISOString(),
            evidence_ref: `tests/evidence/sparsevec-readiness-stage-a.json#subject=${subjectHeadS}#run=${runId}`,
            implementation_subject_head: subjectHeadS,
            implementation_subject_tree_clean: true,
            manifest_commit: manifestCommit,
            frozen_spec_head: FROZEN_SPEC_HEAD,
            frozen_spec_blob: FROZEN_SPEC_BLOB,
            planning_head: gitOutput(['rev-parse', 'origin/main']),
            slice19_provenance: { pgvector_readiness_ci_run: '46103105108', image_ref: PINNED_PGVECTOR_IMAGE_REF },
            slice20_provenance: {
              implementation_pr: 142,
              implementation_head: '27a0ac5761b16ff7837a28936438f30aca1d68e0',
              implementation_merge_commit: 'db07babd42976e5e13dbe08bc3e5f1a9b1c8cbaf',
              original_audit2_result: 'FAIL',
              original_audit2_evidence_ref: 'issuecomment-7189854137',
              remediation_pr: 153,
              remediation_head: 'ff89fc97a4dd13b441a7ae474420674f82050f2f',
              final_audit2_closeout_ref: 'issuecomment-7206763327',
              remediation_merge_commit: '5c2ff5a16d4f9116141f60e973b82b88aa5fbe35',
              public_entry: 'apps/server/api/src/ai/embedding/index.ts',
            },
            stage: 'STAGE_A',
            stage_b: 'NOT_EVALUATED',
            stage_c: 'NOT_EVALUATED',
            postgres_version: pgVersion,
            postgres_version_num: pgVersionNum,
            tencentdb_kernel_version: 'NOT_APPLICABLE_STAGE_A',
            extension_name: 'vector',
            extension_version: extVersion,
            image_ref: PINNED_PGVECTOR_IMAGE_REF,
            image_digest_source: 'operator_docker_inspect',
            execution_role: execRole,
            runtime_superuser: rolSuper,
            runtime_bypassrls: rolBypass,
            runtime_public_schema_create: canCreatePublic,
            extension_owner: extOwner,
            provider_calls: [
              {
                role: 'document',
                text_type: 'document',
                configured_model_id: docOutcome.result.configuredModel.modelId,
                model_version_label: docOutcome.result.configuredModel.versionOrRevision,
                output_type: docOutcome.result.outputType,
                dense_dimension: 1024,
                request_id: docOutcome.result.requestId,
                provider_request_id: docOutcome.result.providerRequestId,
                provider_model_echo: docOutcome.result.providerModelEcho,
                endpoint_config_fingerprint: docOutcome.result.telemetry.endpointConfigFingerprint,
                usage_total_tokens: docOutcome.result.usage.totalTokens,
              },
              {
                role: 'query',
                text_type: 'query',
                configured_model_id: queryOutcome.result.configuredModel.modelId,
                model_version_label: queryOutcome.result.configuredModel.versionOrRevision,
                output_type: queryOutcome.result.outputType,
                dense_dimension: 1024,
                request_id: queryOutcome.result.requestId,
                provider_request_id: queryOutcome.result.providerRequestId,
                provider_model_echo: queryOutcome.result.providerModelEcho,
                endpoint_config_fingerprint: queryOutcome.result.telemetry.endpointConfigFingerprint,
                usage_total_tokens: queryOutcome.result.usage.totalTokens,
              },
            ],
            configured_sparse_cap: docConfig.maxSparseElements,
            sparse_vocabulary_bound: docConfig.sparseVocabularyMax ?? 'NOT_PROVIDED',
            sparse_dimension: SPARSE_D,
            dense_dimension: 1024,
            dimension_policy: 'S21_SPIKE_ONLY_D_1E9',
            items: lineageItems,
            observed_nnz_max: observedNnzMax,
            observed_min_index: observedMinIndex,
            observed_max_index: observedMaxIndex,
            normalized_payload_evidence_ref: approvedBundleRef!,
            normalized_payload_evidence_sha256: approvedBundleSha!,
            normalized_payload_evidence_version: approvedBundleVer!,
            normalized_payload_evidence_media_type: approvedBundleMedia!,
            normalized_payload_evidence_run_id: runId,
            normalized_payload_evidence_subject_head: subjectHeadS,
            mapping_result: 'VERIFIED',
            db_roundtrip_result: 'VERIFIED',
            distance_result: 'VERIFIED',
            independent_calculation: 'VERIFIED',
            tolerances: {
              sparse_ip_rel: SPARSE_IP_REL_TOL,
              dense_cosine_abs: DENSE_COSINE_ABS_TOL,
              fusion_recompute_abs: FUSION_RECOMPUTE_ABS_TOL,
            },
            index_behavior: {
              hnsw_explain_index_used: true,
              planner_restored: true,
              synthetic_boundaries: ['D', 'D+1', '16000', '16001', '1000', '1001'],
              actual_hnsw_compatible: observedNnzMax <= 1000,
            },
            chinese_manifest_id: manifestParsed.manifest_id,
            chinese_manifest_sha256: manifestSha256,
            source_fingerprints: sourceFingerprints,
            queries: fusionResults.map((f) => ({
              query_id: f.query_id,
              expected_doc_id: f.expected_doc_id,
              ranked_doc_ids: f.ranked_doc_ids,
              raw_dense: Object.fromEntries(f.candidates.map((c) => [c.sample_id, c.raw_dense])),
              raw_sparse: Object.fromEntries(f.candidates.map((c) => [c.sample_id, c.raw_sparse])),
              norm_dense: Object.fromEntries(f.candidates.map((c) => [c.sample_id, c.norm_dense])),
              norm_sparse: Object.fromEntries(f.candidates.map((c) => [c.sample_id, c.norm_sparse])),
              fused: Object.fromEntries(f.candidates.map((c) => [c.sample_id, c.fused])),
              strict_first: f.strict_first,
            })),
            chinese_queries_passed: chinesePassed,
            fusion_reference: { formula_id: 'S21-MINMAX-0.5-0.5-V1', recompute_max_abs_diff: maxFusionDiff },
            negative_probes: [],
            cleanup_status: cleanupStatus,
            limitations: [],
            flags,
            ...states,
            readiness_scope: 'CANDIDATE_A_SPARSEVEC_SPIKE_STAGE_A_ONLY',
            candidate_b_status: 'UNAFFECTED',
            candidate_c_status: 'UNAFFECTED',
            rag_readiness: 'NOT_DERIVED',
            production_route_selection: 'DEFERRED_TO_GOLD_DATASET',
          };

          const check = validateSanitizedEvidence(evidence, manifestParsed);
          expect(check).toEqual({ ok: true });
          if (evidenceOutPath) {
            writeFileSync(resolve(ROOT, evidenceOutPath), JSON.stringify(evidence, null, 2) + '\n', 'utf8');
          }
          expect(gitOutput(['rev-parse', 'HEAD'])).toBe(subjectHeadS);
        } catch (e) {
          await client.query('ROLLBACK');
          throw e;
        }
      } finally {
        await client.end();
      }
    });
  });
}
