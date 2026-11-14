/**
 * Slice 19 — narrow pgvector readiness evidence contract.
 *
 * This module classifies one exact database environment. It is intentionally
 * not a generic capability registry and contains no retrieval/model concepts.
 */

export const PGVECTOR_READINESS_STATUS = Object.freeze({
  READY: 'READY',
  BLOCKED: 'BLOCKED',
  UNAVAILABLE: 'UNAVAILABLE',
  UNKNOWN: 'UNKNOWN',
  NOT_EVALUATED: 'NOT_EVALUATED',
});

export const PGVECTOR_REASON = Object.freeze({
  POSTGRES_MAJOR_MISMATCH: 'POSTGRES_MAJOR_MISMATCH',
  POSTGRES_VERSION_UNKNOWN: 'POSTGRES_VERSION_UNKNOWN',
  PGVECTOR_NOT_AVAILABLE: 'PGVECTOR_NOT_AVAILABLE',
  PGVECTOR_NOT_ENABLED: 'PGVECTOR_NOT_ENABLED',
  PGVECTOR_ENABLE_FAILED: 'PGVECTOR_ENABLE_FAILED',
  PGVECTOR_VERSION_UNKNOWN: 'PGVECTOR_VERSION_UNKNOWN',
  PGVECTOR_VERSION_MISMATCH: 'PGVECTOR_VERSION_MISMATCH',
  VECTOR_TYPE_UNAVAILABLE: 'VECTOR_TYPE_UNAVAILABLE',
  VECTOR_INSERT_FAILED: 'VECTOR_INSERT_FAILED',
  VECTOR_READBACK_FAILED: 'VECTOR_READBACK_FAILED',
  VECTOR_DISTANCE_QUERY_FAILED: 'VECTOR_DISTANCE_QUERY_FAILED',
  VECTOR_DISTANCE_ORDER_MISMATCH: 'VECTOR_DISTANCE_ORDER_MISMATCH',
  TEMPORARY_CLEANUP_FAILED: 'TEMPORARY_CLEANUP_FAILED',
  ROLE_OR_PERMISSION_INVALID: 'ROLE_OR_PERMISSION_INVALID',
  ENVIRONMENT_UNREACHABLE: 'ENVIRONMENT_UNREACHABLE',
  EVIDENCE_INCOMPLETE: 'EVIDENCE_INCOMPLETE',
  EVIDENCE_IDENTITY_MISMATCH: 'EVIDENCE_IDENTITY_MISMATCH',
  IMAGE_REFERENCE_NOT_IMMUTABLE: 'IMAGE_REFERENCE_NOT_IMMUTABLE',
  PROBE_MODE_INVALID: 'PROBE_MODE_INVALID',
});

const REQUIRED_IDENTITY_FIELDS = [
  'stage',
  'environment_kind',
  'environment_id',
  'repository_commit',
  'workflow_run_id',
  'workflow_run_attempt',
  'image_ref',
];

export function isPinnedPgvectorImageRef(value) {
  if (typeof value !== 'string') return false;
  return /^pgvector\/pgvector:[0-9]+\.[0-9]+\.[0-9]+-pg18(?:-[a-z0-9][a-z0-9.-]*)?@sha256:[0-9a-f]{64}$/.test(value);
}

function result(status, ...reasons) {
  return Object.freeze({
    status,
    reasons: Object.freeze([...new Set(reasons.filter(Boolean))]),
  });
}

function identityMissing(evidence) {
  return REQUIRED_IDENTITY_FIELDS.filter((field) => {
    const value = evidence?.[field];
    return value === undefined || value === null || String(value).trim() === '';
  });
}

function identityMismatch(evidence, expected) {
  if (!expected) return false;
  for (const field of REQUIRED_IDENTITY_FIELDS) {
    if (expected[field] !== undefined && String(evidence?.[field] ?? '') !== String(expected[field])) {
      return true;
    }
  }
  return false;
}

export function classifyPgvectorReadiness(evidence, expectedIdentity = undefined) {
  if (!evidence || typeof evidence !== 'object') {
    return result(PGVECTOR_READINESS_STATUS.BLOCKED, PGVECTOR_REASON.EVIDENCE_INCOMPLETE);
  }

  if (evidence.probe_mode === 'NOT_EVALUATED') {
    return result(PGVECTOR_READINESS_STATUS.NOT_EVALUATED);
  }

  if (evidence.environment_reachable === false) {
    return result(PGVECTOR_READINESS_STATUS.UNKNOWN, PGVECTOR_REASON.ENVIRONMENT_UNREACHABLE);
  }

  if (identityMissing(evidence).length > 0) {
    return result(PGVECTOR_READINESS_STATUS.BLOCKED, PGVECTOR_REASON.EVIDENCE_INCOMPLETE);
  }

  if (identityMismatch(evidence, expectedIdentity)) {
    return result(PGVECTOR_READINESS_STATUS.BLOCKED, PGVECTOR_REASON.EVIDENCE_IDENTITY_MISMATCH);
  }

  if (!isPinnedPgvectorImageRef(evidence.image_ref)) {
    return result(PGVECTOR_READINESS_STATUS.BLOCKED, PGVECTOR_REASON.IMAGE_REFERENCE_NOT_IMMUTABLE);
  }

  if (evidence.probe_mode !== 'REAL_DATABASE') {
    return result(PGVECTOR_READINESS_STATUS.BLOCKED, PGVECTOR_REASON.PROBE_MODE_INVALID);
  }

  const pg = evidence.postgres ?? {};
  if (!Number.isInteger(pg.major) || typeof pg.version !== 'string' || !pg.version.trim()) {
    return result(PGVECTOR_READINESS_STATUS.UNKNOWN, PGVECTOR_REASON.POSTGRES_VERSION_UNKNOWN);
  }
  if (pg.major !== 18) {
    return result(PGVECTOR_READINESS_STATUS.BLOCKED, PGVECTOR_REASON.POSTGRES_MAJOR_MISMATCH);
  }

  const vector = evidence.pgvector ?? {};
  if (vector.available === false) {
    return result(PGVECTOR_READINESS_STATUS.UNAVAILABLE, PGVECTOR_REASON.PGVECTOR_NOT_AVAILABLE);
  }
  if (vector.available !== true) {
    return result(PGVECTOR_READINESS_STATUS.UNKNOWN, PGVECTOR_REASON.PGVECTOR_NOT_AVAILABLE);
  }
  if (vector.installed !== true) {
    return result(
      PGVECTOR_READINESS_STATUS.BLOCKED,
      vector.setup_result === 'DENIED' || vector.setup_result === 'FAILED'
        ? PGVECTOR_REASON.PGVECTOR_ENABLE_FAILED
        : PGVECTOR_REASON.PGVECTOR_NOT_ENABLED
    );
  }
  if (typeof vector.version !== 'string' || !vector.version.trim()) {
    return result(PGVECTOR_READINESS_STATUS.UNKNOWN, PGVECTOR_REASON.PGVECTOR_VERSION_UNKNOWN);
  }
  if (
    expectedIdentity?.pgvector_version !== undefined &&
    vector.version !== expectedIdentity.pgvector_version
  ) {
    return result(PGVECTOR_READINESS_STATUS.BLOCKED, PGVECTOR_REASON.PGVECTOR_VERSION_MISMATCH);
  }

  const security = evidence.security ?? {};
  if (
    security.runtime_role !== 'xiaoshuyin_app' ||
    security.runtime_superuser !== false ||
    security.runtime_bypassrls !== false ||
    security.runtime_public_schema_create !== false ||
    security.runtime_business_table_owner !== false ||
    !security.extension_owner ||
    security.extension_owner === 'xiaoshuyin_app'
  ) {
    return result(PGVECTOR_READINESS_STATUS.BLOCKED, PGVECTOR_REASON.ROLE_OR_PERMISSION_INVALID);
  }

  const probe = evidence.probe ?? {};
  if (probe.vector_type !== true) {
    return result(PGVECTOR_READINESS_STATUS.BLOCKED, PGVECTOR_REASON.VECTOR_TYPE_UNAVAILABLE);
  }
  if (probe.insert !== true) {
    return result(PGVECTOR_READINESS_STATUS.BLOCKED, PGVECTOR_REASON.VECTOR_INSERT_FAILED);
  }
  if (probe.readback !== true) {
    return result(PGVECTOR_READINESS_STATUS.BLOCKED, PGVECTOR_REASON.VECTOR_READBACK_FAILED);
  }
  if (probe.distance_query !== true) {
    return result(PGVECTOR_READINESS_STATUS.BLOCKED, PGVECTOR_REASON.VECTOR_DISTANCE_QUERY_FAILED);
  }
  if (probe.distance_order !== true) {
    return result(PGVECTOR_READINESS_STATUS.BLOCKED, PGVECTOR_REASON.VECTOR_DISTANCE_ORDER_MISMATCH);
  }
  if (probe.temporary_cleanup !== true) {
    return result(PGVECTOR_READINESS_STATUS.BLOCKED, PGVECTOR_REASON.TEMPORARY_CLEANUP_FAILED);
  }

  return result(PGVECTOR_READINESS_STATUS.READY);
}

export function finalizePgvectorEvidence(evidence, expectedIdentity = undefined) {
  const classified = classifyPgvectorReadiness(evidence, expectedIdentity);
  return {
    ...evidence,
    readiness_status: classified.status,
    failure_reasons: [...classified.reasons],
  };
}
