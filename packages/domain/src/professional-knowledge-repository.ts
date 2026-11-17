/**
 * Slice 17 Professional Knowledge persistence primitives.
 *
 * All Professional Knowledge SQL lives in @xiaoshuyin/domain. Callers own the
 * transaction, identity context, Staff authorization, external qualification
 * and approval resolution. This module never manufactures those authorities.
 */
import type { Tx } from './repository.js';
import type {
  ProfessionalKnowledgeSourceSnapshot,
  ProfessionalKnowledgeVersionSnapshot,
  ProfessionalKnowledgeScopeMetadata,
  StaffProfessionalReviewAuthorityResult,
  ProfessionalApprovalProof,
} from './professional-knowledge.js';

interface KnowledgeVersionDbRow {
  id: string;
  knowledge_id: string;
  knowledge_key: string;
  semantic_version: string;
  revision: number;
  lifecycle_status: ProfessionalKnowledgeVersionSnapshot['lifecycleStatus'];
  review_state: ProfessionalKnowledgeVersionSnapshot['reviewState'];
  validity_state: ProfessionalKnowledgeVersionSnapshot['validityState'];
  content: Readonly<Record<string, unknown>>;
  content_hash: string;
  source_set_hash: string;
  scope_metadata: ProfessionalKnowledgeScopeMetadata;
  locale: string;
  released_at: Date | null;
  effective_from: Date | null;
  effective_to: Date | null;
}

interface KnowledgeSourceDbRow {
  source_ref: string;
  source_version: string;
  source_hash: string;
  locator: string | null;
  snapshot_metadata: Readonly<Record<string, string | number | boolean | null>>;
}

function iso(value: Date | null): string | null {
  return value === null ? null : value.toISOString();
}

export async function setProfessionalKnowledgeAdminContext(
  tx: Tx,
  assignmentId: string
): Promise<void> {
  await tx.query('SELECT app.set_professional_review_context($1)', [assignmentId]);
}

export async function resolveProfessionalReviewStaffAuthority(
  tx: Tx,
  input: {
    assignmentRef: string;
    accountId: string;
    personId: string;
  }
): Promise<StaffProfessionalReviewAuthorityResult> {
  const identity = await tx.query<{ account_id: string | null; person_id: string | null }>(
    `SELECT app_account_id()::text AS account_id,
            app_person_id()::text AS person_id`
  );
  if (
    identity.rows[0]?.account_id !== input.accountId ||
    identity.rows[0]?.person_id !== input.personId
  ) {
    // Current merged Staff owner exposes only the authenticated Staff actor's
    // rows under FORCE RLS. A different reviewer's proof is therefore not
    // guessed invalid and is never bypassed; it remains unavailable until an
    // authoritative cross-Staff verification seam exists.
    return { status: 'UNAVAILABLE', reason: 'STAFF_AUTHORITY_LOOKUP_UNAVAILABLE' };
  }

  const { rows } = await tx.query<{ valid: boolean }>(
    `SELECT app.validate_professional_review_assignment($1,$2,$3) AS valid`,
    [input.assignmentRef, input.accountId, input.personId]
  );
  if (rows[0]?.valid !== true) {
    return { status: 'INVALID', reason: 'STAFF_ASSIGNMENT_INVALID' };
  }
  return {
    status: 'RESOLVED',
    assignmentRef: input.assignmentRef,
    accountId: input.accountId,
    personId: input.personId,
    capability: 'PROFESSIONAL_REVIEW',
    scope: 'GLOBAL',
  };
}

async function insertSources(
  tx: Tx,
  versionId: string,
  knowledgeRevision: number,
  sources: readonly ProfessionalKnowledgeSourceSnapshot[]
): Promise<void> {
  for (let index = 0; index < sources.length; index += 1) {
    const source = sources[index]!;
    await tx.query(
      `INSERT INTO professional_knowledge_sources
         (knowledge_version_id, knowledge_revision, ordinal, source_ref, source_version,
          source_hash, locator, snapshot_metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)`,
      [
        versionId,
        knowledgeRevision,
        index + 1,
        source.sourceRef,
        source.sourceVersion,
        source.sourceHash,
        source.locator,
        JSON.stringify(source.metadata),
      ]
    );
  }
}

export async function createProfessionalKnowledgeCandidate(
  tx: Tx,
  input: {
    knowledgeKey: string;
    semanticVersion: string;
    content: Readonly<Record<string, unknown>>;
    contentHash: string;
    sourceSetHash: string;
    sources: readonly ProfessionalKnowledgeSourceSnapshot[];
    scope: ProfessionalKnowledgeScopeMetadata;
    accountId: string;
    personId: string;
  }
): Promise<{ knowledgeId: string; versionId: string; revision: number }> {
  const item = await tx.query<{ id: string }>(
    `INSERT INTO professional_knowledge_items
       (knowledge_key, created_by_account_id, created_by_person_id)
     VALUES ($1,$2,$3)
     RETURNING id`,
    [input.knowledgeKey, input.accountId, input.personId]
  );
  const knowledgeId = item.rows[0]!.id;
  const version = await tx.query<{ id: string; revision: number }>(
    `INSERT INTO professional_knowledge_versions
       (knowledge_id, semantic_version, content, content_hash, source_set_hash,
        scope_metadata, locale, created_by_account_id, created_by_person_id)
     VALUES ($1,$2,$3::jsonb,$4,$5,$6::jsonb,$7,$8,$9)
     RETURNING id, revision`,
    [
      knowledgeId,
      input.semanticVersion,
      JSON.stringify(input.content),
      input.contentHash,
      input.sourceSetHash,
      JSON.stringify(input.scope),
      input.scope.locale,
      input.accountId,
      input.personId,
    ]
  );
  const row = version.rows[0]!;
  await insertSources(tx, row.id, row.revision, input.sources);
  return { knowledgeId, versionId: row.id, revision: row.revision };
}

export async function createProfessionalKnowledgeSuccessor(
  tx: Tx,
  input: {
    knowledgeId: string;
    predecessorVersionId: string;
    semanticVersion: string;
    content: Readonly<Record<string, unknown>>;
    contentHash: string;
    sourceSetHash: string;
    sources: readonly ProfessionalKnowledgeSourceSnapshot[];
    scope: ProfessionalKnowledgeScopeMetadata;
    accountId: string;
    personId: string;
  }
): Promise<{ versionId: string; revision: number }> {
  const predecessor = await tx.query<{ lifecycle_status: string }>(
    `SELECT lifecycle_status
       FROM professional_knowledge_versions
      WHERE id = $1 AND knowledge_id = $2
      FOR UPDATE`,
    [input.predecessorVersionId, input.knowledgeId]
  );
  if (predecessor.rows[0]?.lifecycle_status !== 'PUBLISHED') {
    throw Object.assign(new Error('PROFESSIONAL_KNOWLEDGE_PREDECESSOR_NOT_PUBLISHED'), {
      code: 'PROFESSIONAL_KNOWLEDGE_STATE_CONFLICT',
    });
  }

  const version = await tx.query<{ id: string; revision: number }>(
    `INSERT INTO professional_knowledge_versions
       (knowledge_id, semantic_version, content, content_hash, source_set_hash,
        scope_metadata, locale, supersedes_version_id,
        created_by_account_id, created_by_person_id)
     VALUES ($1,$2,$3::jsonb,$4,$5,$6::jsonb,$7,$8,$9,$10)
     RETURNING id, revision`,
    [
      input.knowledgeId,
      input.semanticVersion,
      JSON.stringify(input.content),
      input.contentHash,
      input.sourceSetHash,
      JSON.stringify(input.scope),
      input.scope.locale,
      input.predecessorVersionId,
      input.accountId,
      input.personId,
    ]
  );
  const row = version.rows[0]!;
  await insertSources(tx, row.id, row.revision, input.sources);
  return { versionId: row.id, revision: row.revision };
}

export async function editProfessionalKnowledgeCandidate(
  tx: Tx,
  input: {
    versionId: string;
    expectedRevision: number;
    content: Readonly<Record<string, unknown>>;
    contentHash: string;
    sourceSetHash: string;
    sources: readonly ProfessionalKnowledgeSourceSnapshot[];
    scope: ProfessionalKnowledgeScopeMetadata;
  }
): Promise<number> {
  const locked = await tx.query<{ lifecycle_status: string; revision: number }>(
    `SELECT lifecycle_status, revision
       FROM professional_knowledge_versions
      WHERE id = $1
      FOR UPDATE`,
    [input.versionId]
  );
  const current = locked.rows[0];
  if (
    !current ||
    current.lifecycle_status !== 'CANDIDATE' ||
    current.revision !== input.expectedRevision
  ) {
    throw Object.assign(new Error('PROFESSIONAL_KNOWLEDGE_STALE_REVISION'), {
      code: 'PROFESSIONAL_KNOWLEDGE_CONFLICT',
    });
  }

  const updated = await tx.query<{ revision: number }>(
    `UPDATE professional_knowledge_versions
        SET content = $2::jsonb,
            content_hash = $3,
            source_set_hash = $4,
            scope_metadata = $5::jsonb,
            locale = $6,
            review_state = 'PENDING',
            validity_state = 'UNKNOWN',
            revision = revision + 1
      WHERE id = $1 AND revision = $7 AND lifecycle_status = 'CANDIDATE'
      RETURNING revision`,
    [
      input.versionId,
      JSON.stringify(input.content),
      input.contentHash,
      input.sourceSetHash,
      JSON.stringify(input.scope),
      input.scope.locale,
      input.expectedRevision,
    ]
  );
  if (updated.rowCount !== 1) {
    throw Object.assign(new Error('PROFESSIONAL_KNOWLEDGE_STALE_REVISION'), {
      code: 'PROFESSIONAL_KNOWLEDGE_CONFLICT',
    });
  }

  await insertSources(tx, input.versionId, updated.rows[0]!.revision, input.sources);
  return updated.rows[0]!.revision;
}

export async function lockProfessionalKnowledgeVersion(
  tx: Tx,
  versionId: string
): Promise<ProfessionalKnowledgeVersionSnapshot | null> {
  const version = await tx.query<KnowledgeVersionDbRow>(
    `SELECT
       v.id, v.knowledge_id, i.knowledge_key, v.semantic_version, v.revision,
       v.lifecycle_status, v.review_state, v.validity_state, v.content,
       v.content_hash, v.source_set_hash, v.scope_metadata, v.locale,
       v.released_at, v.effective_from, v.effective_to
     FROM professional_knowledge_versions v
     JOIN professional_knowledge_items i ON i.id = v.knowledge_id
     WHERE v.id = $1
     FOR UPDATE OF v`,
    [versionId]
  );
  const row = version.rows[0];
  if (!row) return null;

  const sources = await tx.query<KnowledgeSourceDbRow>(
    `SELECT source_ref, source_version, source_hash, locator, snapshot_metadata
       FROM professional_knowledge_sources
      WHERE knowledge_version_id = $1
        AND knowledge_revision = $2
      ORDER BY ordinal`,
    [versionId, row.revision]
  );

  return {
    id: row.id,
    knowledgeId: row.knowledge_id,
    knowledgeKey: row.knowledge_key,
    semanticVersion: row.semantic_version,
    revision: row.revision,
    lifecycleStatus: row.lifecycle_status,
    reviewState: row.review_state,
    validityState: row.validity_state,
    content: row.content,
    contentHash: row.content_hash,
    sourceSetHash: row.source_set_hash,
    sources: sources.rows.map((source) => ({
      sourceRef: source.source_ref,
      sourceVersion: source.source_version,
      sourceHash: source.source_hash,
      locator: source.locator,
      metadata: source.snapshot_metadata,
    })),
    scope: row.scope_metadata,
    releasedAt: iso(row.released_at),
    effectiveFrom: iso(row.effective_from),
    effectiveTo: iso(row.effective_to),
  };
}

export async function appendProfessionalKnowledgeReviewEvidence(
  tx: Tx,
  input: {
    version: ProfessionalKnowledgeVersionSnapshot;
    reviewerIdentity: string;
    reviewerAccountId: string;
    reviewerPersonId: string;
    staffAssignmentRef: string;
    qualificationRef: string;
    reviewOutcome: 'REVIEWED' | 'NEEDS_REVIEW' | 'NO_MATERIAL_IMPACT';
    reviewReasonCode?: string | null;
    reviewedAt: Date;
    nextReviewState: ProfessionalKnowledgeVersionSnapshot['reviewState'];
    nextValidityState: ProfessionalKnowledgeVersionSnapshot['validityState'];
  }
): Promise<number> {
  await tx.query(
    `INSERT INTO professional_knowledge_review_evidence
       (knowledge_version_id, reviewed_revision, content_hash, source_set_hash,
        reviewer_identity, reviewer_account_id, reviewer_person_id,
        staff_assignment_ref, qualification_ref, review_outcome,
        review_reason_code, reviewed_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
    [
      input.version.id,
      input.version.revision,
      input.version.contentHash,
      input.version.sourceSetHash,
      input.reviewerIdentity,
      input.reviewerAccountId,
      input.reviewerPersonId,
      input.staffAssignmentRef,
      input.qualificationRef,
      input.reviewOutcome,
      input.reviewReasonCode ?? null,
      input.reviewedAt,
    ]
  );
  const updated = await tx.query<{ revision: number }>(
    `UPDATE professional_knowledge_versions
        SET review_state = $2,
            validity_state = $3,
            revision = revision + 1
      WHERE id = $1 AND revision = $4
      RETURNING revision`,
    [
      input.version.id,
      input.nextReviewState,
      input.nextValidityState,
      input.version.revision,
    ]
  );
  if (updated.rowCount !== 1) {
    throw Object.assign(new Error('PROFESSIONAL_KNOWLEDGE_STALE_REVISION'), {
      code: 'PROFESSIONAL_KNOWLEDGE_CONFLICT',
    });
  }
  return updated.rows[0]!.revision;
}

export async function appendConsumedProfessionalApprovalEvidence(
  tx: Tx,
  versionId: string,
  proof: ProfessionalApprovalProof,
  sceneBindingRef: {
    readonly sceneCode: string;
    readonly scenePackageVersion: string;
    readonly knowledgeId: string;
    readonly semanticVersion: string;
    readonly contentHash: string;
    readonly sourceSetHash: string;
  }
): Promise<void> {
  await tx.query(
    `INSERT INTO professional_knowledge_approval_evidence
       (knowledge_version_id, approval_proof_ref, content_hash, source_set_hash,
        approval_scope, reviewer_identity, reviewer_account_id, reviewer_person_id,
        staff_assignment_ref, qualification_ref, qualification_scope,
        reviewed_at, effective_from, effective_to,
        professional_content_package_ref, scene_binding_ref)
     VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10,$11::jsonb,$12,$13,$14,$15::jsonb,$16::jsonb)`,
    [
      versionId,
      proof.proofId,
      proof.contentHash,
      proof.sourceSetHash,
      JSON.stringify(proof.scope),
      proof.reviewerIdentity,
      proof.reviewerAccountId,
      proof.reviewerPersonId,
      proof.staffAssignmentRef,
      proof.qualificationRef,
      JSON.stringify(proof.qualificationScope),
      proof.reviewedAt,
      proof.effectiveFrom,
      proof.effectiveTo,
      proof.professionalContentPackageRef === undefined
        ? null
        : JSON.stringify(proof.professionalContentPackageRef),
      JSON.stringify(sceneBindingRef),
    ]
  );
}

export async function appendProfessionalKnowledgeAudit(
  tx: Tx,
  input: {
    actorAccountId: string;
    eventType:
      | 'PROFESSIONAL_KNOWLEDGE_CANDIDATE_CREATED'
      | 'PROFESSIONAL_KNOWLEDGE_CANDIDATE_EDITED'
      | 'PROFESSIONAL_KNOWLEDGE_REVIEW_RECORDED'
      | 'PROFESSIONAL_KNOWLEDGE_RELEASED'
      | 'PROFESSIONAL_KNOWLEDGE_SUPERSEDED'
      | 'PROFESSIONAL_KNOWLEDGE_RETIRED'
      | 'PROFESSIONAL_KNOWLEDGE_VALIDITY_CHANGED';
    versionId: string;
    metadata: Readonly<Record<string, unknown>>;
  }
): Promise<void> {
  await tx.query(
    `INSERT INTO business_audit_events
       (family_id, actor_account_id, event_type, resource_type, resource_id, metadata)
     VALUES (NULL,$1,$2,'PROFESSIONAL_KNOWLEDGE',$3,$4::jsonb)`,
    [
      input.actorAccountId,
      input.eventType,
      input.versionId,
      JSON.stringify(input.metadata),
    ]
  );
}


export async function releaseProfessionalKnowledgeVersion(
  tx: Tx,
  input: {
    versionId: string;
    expectedRevision: number;
    effectiveFrom: Date;
  }
): Promise<number> {
  const updated = await tx.query<{ revision: number }>(
    `UPDATE professional_knowledge_versions
        SET lifecycle_status = 'PUBLISHED',
            released_at = clock_timestamp(),
            effective_from = $3,
            revision = revision + 1
      WHERE id = $1
        AND revision = $2
        AND lifecycle_status = 'CANDIDATE'
        AND review_state = 'CURRENT'
        AND validity_state = 'VALID'
      RETURNING revision`,
    [input.versionId, input.expectedRevision, input.effectiveFrom]
  );
  if (updated.rowCount !== 1) {
    throw Object.assign(new Error('PROFESSIONAL_KNOWLEDGE_RELEASE_CONFLICT'), {
      code: 'PROFESSIONAL_KNOWLEDGE_CONFLICT',
    });
  }
  return updated.rows[0]!.revision;
}

export async function getProfessionalKnowledgePredecessorId(
  tx: Tx,
  versionId: string
): Promise<string | null> {
  const { rows } = await tx.query<{ supersedes_version_id: string | null }>(
    `SELECT supersedes_version_id
       FROM professional_knowledge_versions
      WHERE id = $1`,
    [versionId]
  );
  return rows[0]?.supersedes_version_id ?? null;
}

export async function markProfessionalKnowledgeVersionSuperseded(
  tx: Tx,
  input: { versionId: string }
): Promise<void> {
  const updated = await tx.query(
    `UPDATE professional_knowledge_versions
        SET lifecycle_status = 'SUPERSEDED',
            revision = revision + 1
      WHERE id = $1 AND lifecycle_status = 'PUBLISHED'`,
    [input.versionId]
  );
  if (updated.rowCount !== 1) {
    throw Object.assign(new Error('PROFESSIONAL_KNOWLEDGE_SUPERSEDE_CONFLICT'), {
      code: 'PROFESSIONAL_KNOWLEDGE_CONFLICT',
    });
  }
}

export async function retireProfessionalKnowledgeVersion(
  tx: Tx,
  input: { versionId: string; expectedRevision: number }
): Promise<number> {
  const updated = await tx.query<{ revision: number }>(
    `UPDATE professional_knowledge_versions
        SET lifecycle_status = 'RETIRED',
            revision = revision + 1
      WHERE id = $1
        AND revision = $2
        AND lifecycle_status IN ('CANDIDATE','PUBLISHED')
      RETURNING revision`,
    [input.versionId, input.expectedRevision]
  );
  if (updated.rowCount !== 1) {
    throw Object.assign(new Error('PROFESSIONAL_KNOWLEDGE_RETIRE_CONFLICT'), {
      code: 'PROFESSIONAL_KNOWLEDGE_CONFLICT',
    });
  }
  return updated.rows[0]!.revision;
}

export async function applyProfessionalKnowledgeDependencyState(
  tx: Tx,
  input: {
    versionId: string;
    expectedRevision: number;
    reviewState: ProfessionalKnowledgeVersionSnapshot['reviewState'];
    validityState: ProfessionalKnowledgeVersionSnapshot['validityState'];
  }
): Promise<number> {
  const updated = await tx.query<{ revision: number }>(
    `UPDATE professional_knowledge_versions
        SET review_state = $3,
            validity_state = $4,
            revision = revision + 1
      WHERE id = $1 AND revision = $2
      RETURNING revision`,
    [
      input.versionId,
      input.expectedRevision,
      input.reviewState,
      input.validityState,
    ]
  );
  if (updated.rowCount !== 1) {
    throw Object.assign(new Error('PROFESSIONAL_KNOWLEDGE_DEPENDENCY_CONFLICT'), {
      code: 'PROFESSIONAL_KNOWLEDGE_CONFLICT',
    });
  }
  return updated.rows[0]!.revision;
}


export async function getProfessionalKnowledgeVersion(
  tx: Tx,
  versionId: string
): Promise<ProfessionalKnowledgeVersionSnapshot | null> {
  const version = await tx.query<KnowledgeVersionDbRow>(
    `SELECT
       v.id, v.knowledge_id, i.knowledge_key, v.semantic_version, v.revision,
       v.lifecycle_status, v.review_state, v.validity_state, v.content,
       v.content_hash, v.source_set_hash, v.scope_metadata, v.locale,
       v.released_at, v.effective_from, v.effective_to
     FROM professional_knowledge_versions v
     JOIN professional_knowledge_items i ON i.id = v.knowledge_id
     WHERE v.id = $1`,
    [versionId]
  );
  const row = version.rows[0];
  if (!row) return null;
  const sources = await tx.query<KnowledgeSourceDbRow>(
    `SELECT source_ref, source_version, source_hash, locator, snapshot_metadata
       FROM professional_knowledge_sources
      WHERE knowledge_version_id = $1
        AND knowledge_revision = $2
      ORDER BY ordinal`,
    [versionId, row.revision]
  );
  return {
    id: row.id,
    knowledgeId: row.knowledge_id,
    knowledgeKey: row.knowledge_key,
    semanticVersion: row.semantic_version,
    revision: row.revision,
    lifecycleStatus: row.lifecycle_status,
    reviewState: row.review_state,
    validityState: row.validity_state,
    content: row.content,
    contentHash: row.content_hash,
    sourceSetHash: row.source_set_hash,
    sources: sources.rows.map((source) => ({
      sourceRef: source.source_ref,
      sourceVersion: source.source_version,
      sourceHash: source.source_hash,
      locator: source.locator,
      metadata: source.snapshot_metadata,
    })),
    scope: row.scope_metadata,
    releasedAt: iso(row.released_at),
    effectiveFrom: iso(row.effective_from),
    effectiveTo: iso(row.effective_to),
  };
}

export interface ProfessionalKnowledgeAuditRow {
  id: string;
  actor_account_id: string;
  event_type: string;
  resource_id: string;
  metadata: Readonly<Record<string, unknown>>;
  occurred_at: Date;
}

export async function readProfessionalKnowledgeAuditHistory(
  tx: Tx,
  versionId: string
): Promise<ProfessionalKnowledgeAuditRow[]> {
  const { rows } = await tx.query<ProfessionalKnowledgeAuditRow>(
    `SELECT id, actor_account_id, event_type, resource_id, metadata, occurred_at
       FROM business_audit_events
      WHERE family_id IS NULL
        AND resource_type = 'PROFESSIONAL_KNOWLEDGE'
        AND resource_id = $1
      ORDER BY occurred_at, id`,
    [versionId]
  );
  return rows;
}
