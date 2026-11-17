import { readFileSync } from 'node:fs';
import pg from 'pg';
import { afterAll, describe, expect, it } from 'vitest';
import { createAdminPool } from './setup/db.js';
import { withProfessionalKnowledgeAdminTransaction } from '../apps/server/api/src/db/tx.js';
import {
  propagateKnowledgeDependencyImpact,
  readProfessionalKnowledgeMutationOutcome,
  recordKnowledgeReview,
  releaseKnowledgeVersion,
  resolveCurrentInterventionDefinition,
} from '../apps/server/api/src/services/professional-knowledge.js';
import {
  insertInterventionDefinitionCandidate,
  resolveProfessionalReviewStaffAuthority,
  transitionInterventionDefinitionStateCas,
} from '../packages/domain/src/intervention-definition-repository.js';
import {
  hashProfessionalKnowledgeContent,
  hashProfessionalKnowledgeSourceSet,
  prepareInterventionDefinition,
  type ProfessionalApprovalProof,
  type ProfessionalKnowledgeInterventionRef,
  type ProfessionalKnowledgeScopeMetadata,
} from '../packages/domain/src/index.js';
import { interventionSemantic } from './support/intervention.js';

const admin = createAdminPool();
const app = new pg.Pool({
  connectionString: process.env['DATABASE_URL'],
  max: 5,
});

afterAll(async () => {
  await app.end();
  await admin.end();
});

type Actor = {
  accountId: string;
  personId: string;
  assignmentId: string;
};

type SeededKnowledge = {
  knowledgeId: string;
  versionId: string;
  contentHash: string;
  sourceSetHash: string;
  sourceRef: string;
  scope: ProfessionalKnowledgeScopeMetadata;
};

async function seedActor(
  label: string,
  capability: 'PROFESSIONAL_REVIEW' | 'QUALITY_REVIEW' = 'PROFESSIONAL_REVIEW'
): Promise<Actor> {
  const tag = crypto.randomUUID();
  const account = await admin.query<{ id: string }>(
    'INSERT INTO accounts (wechat_openid) VALUES ($1) RETURNING id',
    [`s17-aud2-${label}-${tag}`]
  );
  const accountId = account.rows[0]!.id;
  const person = await admin.query<{ id: string }>(
    `INSERT INTO persons (account_id, created_by_account_id)
     VALUES ($1,$1) RETURNING id`,
    [accountId]
  );
  const personId = person.rows[0]!.id;
  const assignment = await admin.query<{ id: string }>(
    `INSERT INTO staff_assignments
       (account_id, person_id, capability, scope_type, granted_by_account_id, valid_from)
     VALUES ($1,$2,$3,'GLOBAL',$1,clock_timestamp() - interval '1 minute')
     RETURNING id`,
    [accountId, personId, capability]
  );
  return { accountId, personId, assignmentId: assignment.rows[0]!.id };
}

async function seedKnowledge(
  actor: Actor,
  input: {
    reviewState?: 'PENDING' | 'CURRENT' | 'NEEDS_REVIEW';
    validityState?: 'UNKNOWN' | 'VALID' | 'INVALID';
    interventionDefinitionRef?: ProfessionalKnowledgeInterventionRef | null;
  } = {}
): Promise<SeededKnowledge> {
  const tag = crypto.randomUUID();
  const content = { body: `audit2-${tag}` };
  const sourceRef = `source:audit2:${tag}`;
  const sources = [{
    sourceRef,
    sourceVersion: '1',
    sourceHash: 'a'.repeat(64),
    locator: null,
    metadata: {},
  }];
  const contentHash = hashProfessionalKnowledgeContent(content);
  const sourceSetHash = hashProfessionalKnowledgeSourceSet(sources);
  const scope: ProfessionalKnowledgeScopeMetadata = {
    product: 'V1',
    sceneCode: 'DIGITAL_USE',
    scenePackageVersion: `audit2-scene-${tag}`,
    stages: ['ASSESSMENT'],
    ageBands: ['MINOR_14_17'],
    applicability: ['sleep-impact'],
    exclusions: [],
    riskLevels: ['LOW'],
    locale: 'zh-CN',
    interventionDefinitionRef: input.interventionDefinitionRef ?? null,
  };
  const item = await admin.query<{ id: string }>(
    `INSERT INTO professional_knowledge_items
       (knowledge_key, created_by_account_id, created_by_person_id)
     VALUES ($1,$2,$3) RETURNING id`,
    [`audit2-${tag}`, actor.accountId, actor.personId]
  );
  const knowledgeId = item.rows[0]!.id;
  const version = await admin.query<{ id: string }>(
    `INSERT INTO professional_knowledge_versions
       (knowledge_id, semantic_version, review_state, validity_state,
        content, content_hash, source_set_hash, scope_metadata, locale,
        created_by_account_id, created_by_person_id)
     VALUES ($1,'1.0.0',$2,$3,$4::jsonb,$5,$6,$7::jsonb,'zh-CN',$8,$9)
     RETURNING id`,
    [
      knowledgeId,
      input.reviewState ?? 'CURRENT',
      input.validityState ?? 'VALID',
      JSON.stringify(content),
      contentHash,
      sourceSetHash,
      JSON.stringify(scope),
      actor.accountId,
      actor.personId,
    ]
  );
  const versionId = version.rows[0]!.id;
  await admin.query(
    `INSERT INTO professional_knowledge_sources
       (knowledge_version_id, knowledge_revision, ordinal, source_ref,
        source_version, source_hash, locator, snapshot_metadata)
     VALUES ($1,1,1,$2,'1',$3,NULL,'{}'::jsonb)`,
    [versionId, sourceRef, 'a'.repeat(64)]
  );
  return { knowledgeId, versionId, contentHash, sourceSetHash, sourceRef, scope };
}

function qualificationProvider() {
  return {
    async resolve(input: {
      qualificationRef: string;
      reviewerIdentity: string;
      reviewerAccountId: string;
      reviewerPersonId: string;
      scope: any;
    }) {
      return {
        status: 'RESOLVED' as const,
        qualificationRef: input.qualificationRef,
        reviewerIdentity: input.reviewerIdentity,
        reviewerAccountId: input.reviewerAccountId,
        reviewerPersonId: input.reviewerPersonId,
        scope: input.scope,
        validFrom: '2026-01-01T00:00:00Z',
        validTo: '2027-12-31T00:00:00Z',
      };
    },
  };
}

function approvalProof(
  knowledge: SeededKnowledge,
  reviewer: Actor,
  proofId: string
): ProfessionalApprovalProof {
  const scope = {
    product: 'V1' as const,
    sceneCode: knowledge.scope.sceneCode,
    scenePackageVersion: knowledge.scope.scenePackageVersion,
    stages: knowledge.scope.stages,
    ageBands: knowledge.scope.ageBands,
    locale: knowledge.scope.locale,
  };
  return {
    proofId,
    knowledgeId: knowledge.knowledgeId,
    semanticVersion: '1.0.0',
    contentHash: knowledge.contentHash,
    sourceSetHash: knowledge.sourceSetHash,
    sourceRefs: [knowledge.sourceRef],
    scope,
    reviewerIdentity: `reviewer:${reviewer.personId}`,
    reviewerAccountId: reviewer.accountId,
    reviewerPersonId: reviewer.personId,
    staffAssignmentRef: reviewer.assignmentId,
    staffCapability: 'PROFESSIONAL_REVIEW',
    qualificationRef: `qualification:${reviewer.personId}`,
    qualificationScope: scope,
    approvalStatus: 'APPROVED',
    publicationStatus: 'EFFECTIVE',
    reviewedAt: '2026-11-01T00:00:00Z',
    effectiveFrom: '2026-11-01T00:00:00Z',
    effectiveTo: '2027-11-01T00:00:00Z',
  };
}

function approvalProvider(proof: ProfessionalApprovalProof) {
  return {
    async resolve() {
      return { status: 'RESOLVED' as const, proof };
    },
    async revalidate() {
      return { status: 'RESOLVED' as const, proof };
    },
  };
}

function sceneBinding(knowledge: SeededKnowledge) {
  return (scenePackageVersion: string) => ({
    status: 'RESOLVED' as const,
    sceneCode: knowledge.scope.sceneCode,
    scenePackageVersion,
    refs: [{
      knowledgeId: knowledge.knowledgeId,
      semanticVersion: '1.0.0',
      contentHash: knowledge.contentHash,
      sourceSetHash: knowledge.sourceSetHash,
    }],
  });
}

describe('Slice 17 Audit 2 targeted remediation — real service semantics', () => {
  it('FR-028 / FR-031: review commit then lost-response retry exact-replays before stale revision; semantic mismatches conflict', async () => {
    const actor = await seedActor('review-replay');
    const knowledge = await seedKnowledge(actor, {
      reviewState: 'PENDING',
      validityState: 'UNKNOWN',
    });
    const idempotencyKey = `review-replay-${crypto.randomUUID()}`;
    const reviewedAt = new Date('2026-11-17T01:00:00Z');
    const request = {
      pool: app,
      accountId: actor.accountId,
      personId: actor.personId,
      assignmentId: actor.assignmentId,
      idempotencyKey,
      versionId: knowledge.versionId,
      expectedRevision: 1,
      reviewerIdentity: `reviewer:${actor.personId}`,
      qualificationRef: `qualification:${actor.personId}`,
      qualificationProvider: qualificationProvider(),
      outcome: 'REVIEWED' as const,
      reviewedAt,
    };

    // Simulate a committed request whose response was lost: do not use its
    // returned revision to construct the retry.
    await recordKnowledgeReview(request);

    const reviewReadback = await readProfessionalKnowledgeMutationOutcome({
      pool: app,
      accountId: actor.accountId,
      assignmentId: actor.assignmentId,
      commandType: 'PROFESSIONAL_KNOWLEDGE_REVIEW_RECORD',
      idempotencyKey,
      versionId: knowledge.versionId,
    });
    expect(reviewReadback.status).toBe('SETTLED');

    await expect(recordKnowledgeReview(request)).resolves.toMatchObject({
      versionId: knowledge.versionId,
      revision: 2,
      reviewState: 'CURRENT',
      validityState: 'VALID',
    });
    await expect(
      recordKnowledgeReview({ ...request, reviewerIdentity: 'reviewer:changed' })
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_PAYLOAD_MISMATCH' });
    await expect(
      recordKnowledgeReview({
        ...request,
        reviewedAt: new Date('2026-11-17T01:00:01Z'),
      })
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_PAYLOAD_MISMATCH' });

    const reviewEvidence = await admin.query<{ n: string }>(
      `SELECT count(*)::text AS n
         FROM professional_knowledge_review_evidence
        WHERE knowledge_version_id=$1`,
      [knowledge.versionId]
    );
    expect(Number(reviewEvidence.rows[0]!.n)).toBe(1);
    const audit = await admin.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM business_audit_events
        WHERE resource_id=$1 AND event_type='PROFESSIONAL_KNOWLEDGE_REVIEW_RECORDED'`,
      [knowledge.versionId]
    );
    expect(Number(audit.rows[0]!.n)).toBe(1);
  });

  it('FR-028 / FR-031: dependency propagation exact-replays after mutation and changed semantics mismatch without duplicate audit', async () => {
    const actor = await seedActor('dependency-replay');
    const knowledge = await seedKnowledge(actor);
    const idempotencyKey = `dependency-replay-${crypto.randomUUID()}`;
    const request = {
      pool: app,
      accountId: actor.accountId,
      personId: actor.personId,
      assignmentId: actor.assignmentId,
      idempotencyKey,
      versionId: knowledge.versionId,
      expectedRevision: 1,
      impact: 'SOURCE_CORRECTION' as const,
      exactDependent: true,
    };

    await propagateKnowledgeDependencyImpact(request);
    await expect(propagateKnowledgeDependencyImpact(request)).resolves.toEqual({
      versionId: knowledge.versionId,
      revision: 2,
      changed: true,
    });
    await expect(
      propagateKnowledgeDependencyImpact({ ...request, exactDependent: false })
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_PAYLOAD_MISMATCH' });

    const row = await admin.query<{ revision: number; review_state: string; validity_state: string }>(
      `SELECT revision, review_state, validity_state
         FROM professional_knowledge_versions WHERE id=$1`,
      [knowledge.versionId]
    );
    expect(row.rows[0]).toEqual({
      revision: 2,
      review_state: 'NEEDS_REVIEW',
      validity_state: 'UNKNOWN',
    });
    const audit = await admin.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM business_audit_events
        WHERE resource_id=$1 AND event_type='PROFESSIONAL_KNOWLEDGE_VALIDITY_CHANGED'`,
      [knowledge.versionId]
    );
    expect(Number(audit.rows[0]!.n)).toBe(1);
  });

  it('FR-046 / FR-052: release actor B may consume exact reviewer A Staff authority; replay precedes CAS and effectiveFrom changes mismatch', async () => {
    const reviewer = await seedActor('reviewer-a');
    const releaseActor = await seedActor('release-actor-b');
    const knowledge = await seedKnowledge(releaseActor);
    const proof = approvalProof(knowledge, reviewer, `proof-${crypto.randomUUID()}`);
    const idempotencyKey = `release-replay-${crypto.randomUUID()}`;
    const now = new Date('2026-11-17T02:00:00Z');
    const effectiveFrom = new Date('2026-11-17T02:00:00Z');

    await withProfessionalKnowledgeAdminTransaction(
      app,
      { accountId: releaseActor.accountId, assignmentId: releaseActor.assignmentId },
      async (tx) => {
        const hiddenReviewer = await tx.query<{ n: string }>(
          'SELECT count(*)::text AS n FROM staff_assignments WHERE id=$1',
          [reviewer.assignmentId]
        );
        expect(hiddenReviewer.rows[0]!.n).toBe('0');
        await expect(
          resolveProfessionalReviewStaffAuthority(tx, {
            assignmentRef: reviewer.assignmentId,
            accountId: reviewer.accountId,
            personId: reviewer.personId,
          })
        ).resolves.toMatchObject({
          status: 'RESOLVED',
          assignmentRef: reviewer.assignmentId,
          accountId: reviewer.accountId,
          personId: reviewer.personId,
        });
        await expect(
          resolveProfessionalReviewStaffAuthority(tx, {
            assignmentRef: reviewer.assignmentId,
            accountId: releaseActor.accountId,
            personId: releaseActor.personId,
          })
        ).resolves.toMatchObject({ status: 'INVALID' });
        await expect(
          resolveProfessionalReviewStaffAuthority(tx, {
            assignmentRef: crypto.randomUUID(),
            accountId: reviewer.accountId,
            personId: reviewer.personId,
          })
        ).resolves.toMatchObject({ status: 'INVALID' });
      }
    );

    const request = {
      pool: app,
      accountId: releaseActor.accountId,
      personId: releaseActor.personId,
      assignmentId: releaseActor.assignmentId,
      idempotencyKey,
      versionId: knowledge.versionId,
      expectedRevision: 1,
      approvalProofId: proof.proofId,
      approvalProvider: approvalProvider(proof),
      qualificationProvider: qualificationProvider(),
      sceneBindingResolver: sceneBinding(knowledge),
      now,
      effectiveFrom,
    };

    await releaseKnowledgeVersion(request);
    await expect(releaseKnowledgeVersion(request)).resolves.toEqual({
      versionId: knowledge.versionId,
      revision: 2,
      lifecycleStatus: 'PUBLISHED',
    });
    await expect(
      releaseKnowledgeVersion({
        ...request,
        effectiveFrom: new Date('2026-11-17T02:00:01Z'),
      })
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_PAYLOAD_MISMATCH' });

    const releaseEvidence = await admin.query<{ n: string }>(
      `SELECT count(*)::text AS n
         FROM professional_knowledge_approval_evidence
        WHERE knowledge_version_id=$1`,
      [knowledge.versionId]
    );
    expect(Number(releaseEvidence.rows[0]!.n)).toBe(1);
    const audit = await admin.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM business_audit_events
        WHERE resource_id=$1 AND event_type='PROFESSIONAL_KNOWLEDGE_RELEASED'`,
      [knowledge.versionId]
    );
    expect(Number(audit.rows[0]!.n)).toBe(1);

    const qualificationBlocked = await seedKnowledge(releaseActor);
    const qualificationBlockedProof = approvalProof(
      qualificationBlocked,
      reviewer,
      `proof-${crypto.randomUUID()}`
    );
    await expect(
      releaseKnowledgeVersion({
        ...request,
        idempotencyKey: `qualification-invalid-${crypto.randomUUID()}`,
        versionId: qualificationBlocked.versionId,
        approvalProofId: qualificationBlockedProof.proofId,
        approvalProvider: approvalProvider(qualificationBlockedProof),
        qualificationProvider: {
          async resolve() {
            return { status: 'INVALID' as const, reason: 'REVOKED' };
          },
        },
        sceneBindingResolver: sceneBinding(qualificationBlocked),
      })
    ).rejects.toMatchObject({
      code: 'PROFESSIONAL_AUTHORITY_INVALID',
      reason: 'PROFESSIONAL_QUALIFICATION_INVALID',
    });

    const wrongCapability = await seedActor('wrong-capability', 'QUALITY_REVIEW');
    await withProfessionalKnowledgeAdminTransaction(
      app,
      { accountId: releaseActor.accountId, assignmentId: releaseActor.assignmentId },
      async (tx) => {
        await expect(
          resolveProfessionalReviewStaffAuthority(tx, {
            assignmentRef: wrongCapability.assignmentId,
            accountId: wrongCapability.accountId,
            personId: wrongCapability.personId,
          })
        ).resolves.toMatchObject({ status: 'INVALID' });
      }
    );

    await admin.query(
      `UPDATE staff_assignments
          SET revoked_at=clock_timestamp(), revoked_by_account_id=$2
        WHERE id=$1`,
      [reviewer.assignmentId, releaseActor.accountId]
    );
    await withProfessionalKnowledgeAdminTransaction(
      app,
      { accountId: releaseActor.accountId, assignmentId: releaseActor.assignmentId },
      async (tx) => {
        await expect(
          resolveProfessionalReviewStaffAuthority(tx, {
            assignmentRef: reviewer.assignmentId,
            accountId: reviewer.accountId,
            personId: reviewer.personId,
          })
        ).resolves.toMatchObject({ status: 'INVALID' });
      }
    );
  });

  it('FR-046: requested approval proof identity is exact-bound; provider proof substitution rolls back release/evidence/audit/idempotency', async () => {
    const reviewer = await seedActor('proof-reviewer');
    const releaseActor = await seedActor('proof-release');
    const knowledge = await seedKnowledge(releaseActor);
    const requestedProofId = `proof-requested-${crypto.randomUUID()}`;
    const substituted = approvalProof(
      knowledge,
      reviewer,
      `proof-substituted-${crypto.randomUUID()}`
    );
    const idempotencyKey = `proof-substitution-${crypto.randomUUID()}`;

    await expect(
      releaseKnowledgeVersion({
        pool: app,
        accountId: releaseActor.accountId,
        personId: releaseActor.personId,
        assignmentId: releaseActor.assignmentId,
        idempotencyKey,
        versionId: knowledge.versionId,
        expectedRevision: 1,
        approvalProofId: requestedProofId,
        approvalProvider: approvalProvider(substituted),
        qualificationProvider: qualificationProvider(),
        sceneBindingResolver: sceneBinding(knowledge),
        now: new Date('2026-11-17T03:00:00Z'),
      })
    ).rejects.toMatchObject({
      code: 'PROFESSIONAL_AUTHORITY_INVALID',
      reason: 'APPROVAL_PROOF_ID_MISMATCH',
    });

    const state = await admin.query<{ lifecycle_status: string; revision: number }>(
      'SELECT lifecycle_status, revision FROM professional_knowledge_versions WHERE id=$1',
      [knowledge.versionId]
    );
    expect(state.rows[0]).toEqual({ lifecycle_status: 'CANDIDATE', revision: 1 });
    const evidence = await admin.query<{ n: string }>(
      'SELECT count(*)::text AS n FROM professional_knowledge_approval_evidence WHERE knowledge_version_id=$1',
      [knowledge.versionId]
    );
    expect(evidence.rows[0]!.n).toBe('0');
    const audit = await admin.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM business_audit_events
        WHERE resource_id=$1 AND event_type='PROFESSIONAL_KNOWLEDGE_RELEASED'`,
      [knowledge.versionId]
    );
    expect(audit.rows[0]!.n).toBe('0');
    const wrongProofOutcome = await readProfessionalKnowledgeMutationOutcome({
      pool: app,
      accountId: releaseActor.accountId,
      assignmentId: releaseActor.assignmentId,
      commandType: 'PROFESSIONAL_KNOWLEDGE_RELEASE',
      idempotencyKey,
      versionId: knowledge.versionId,
    });
    expect(wrongProofOutcome.status).toBe('OUTCOME_UNKNOWN');
  });

  it('HIGH-001: exact Slice 16 InterventionDefinition owner is consumed read-only; wrong/missing/terminal/outage refs fail closed', async () => {
    const actor = await seedActor('intervention');
    const prepared = prepareInterventionDefinition({
      sceneId: 'DIGITAL_USE',
      interventionCode: `AUDIT2_${crypto.randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()}`,
      version: 1,
      semantic: interventionSemantic(),
    });
    const created = await insertInterventionDefinitionCandidate(admin as any, {
      ...prepared,
      supersedesId: null,
      createdByPersonId: actor.personId,
    });
    const ref = {
      definitionId: created.id,
      definitionVersion: created.version,
      contentHash: created.contentHash,
    };

    const validIntervention = await resolveCurrentInterventionDefinition(admin as any, ref);
    expect(validIntervention.status).toBe('RESOLVED');
    await expect(
      resolveCurrentInterventionDefinition(admin as any, {
        ...ref,
        definitionVersion: ref.definitionVersion + 1,
      })
    ).resolves.toMatchObject({ status: 'INVALID' });
    await expect(
      resolveCurrentInterventionDefinition(admin as any, {
        ...ref,
        contentHash: 'f'.repeat(64),
      })
    ).resolves.toMatchObject({ status: 'INVALID' });
    await expect(
      resolveCurrentInterventionDefinition(admin as any, {
        ...ref,
        definitionId: crypto.randomUUID(),
      })
    ).resolves.toMatchObject({ status: 'INVALID' });

    const unchanged = await admin.query<{ definition_state: string; revision: number }>(
      'SELECT definition_state, revision FROM intervention_definitions WHERE id=$1',
      [created.id]
    );
    expect(unchanged.rows[0]).toEqual({ definition_state: 'CANDIDATE', revision: 1 });

    await transitionInterventionDefinitionStateCas(admin as any, {
      id: created.id,
      expectedRevision: 1,
      expectedState: 'CANDIDATE',
      nextState: 'SUPERSEDED',
    });
    await expect(
      resolveCurrentInterventionDefinition(admin as any, ref)
    ).resolves.toMatchObject({
      status: 'INVALID',
      reason: 'INTERVENTION_DEFINITION_SUPERSEDED',
    });

    const unavailableTx = {
      async query() {
        throw new Error('synthetic upstream outage');
      },
    };
    await expect(
      resolveCurrentInterventionDefinition(unavailableTx as any, ref)
    ).resolves.toMatchObject({
      status: 'UNAVAILABLE',
      reason: 'INTERVENTION_DEFINITION_DEPENDENCY_UNAVAILABLE',
    });

    const serviceSource = readFileSync(
      new URL('../apps/server/api/src/services/professional-knowledge.ts', import.meta.url),
      'utf8'
    );
    expect(serviceSource).not.toMatch(/UPDATE\s+intervention_definitions/i);
    expect(serviceSource).not.toContain('evaluateInterventionEligibility');
    expect(serviceSource).not.toContain('SLICE_16_AUTHORITATIVE_OWNER_NOT_MERGED');
  });
});
