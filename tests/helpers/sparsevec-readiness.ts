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

export function validateChineseManifest(raw: unknown): { ok: true; manifest: ChineseSampleManifest } | { ok: false; errors: string[] } {
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
