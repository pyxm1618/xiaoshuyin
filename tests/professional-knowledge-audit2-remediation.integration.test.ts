import { readFileSync } from 'node:fs';
import pg from 'pg';
import { afterAll, describe, expect, it } from 'vitest';
import { createAdminPool } from './setup/db.js';
import {
  withProfessionalKnowledgeAdminTransaction,
  withProfessionalKnowledgeAuthorityTransaction,
} from '../apps/server/api/src/db/tx.js';
import {
  editKnowledgeCandidate,
  propagateKnowledgeDependencyImpact,
  readProfessionalKnowledgeMutationOutcome,
  recordKnowledgeReview,
  releaseKnowledgeVersion,
  resolveCurrentInterventionDefinition,
} from '../apps/server/api/src/services/professional-knowledge.js';
import {
  insertInterventionDefinitionCandidate,
  transitionInterventionDefinitionStateCas,
} from '../packages/domain/src/intervention-definition-repository.js';
import {
  resolveProfessionalReviewStaffAuthority,
} from '../packages/domain/src/professional-knowledge-repository.js';
import {
  hashProfessionalKnowledgeApprovalBinding,
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
const authority = new pg.Pool({
  connectionString: process.env['MIGRATION_DATABASE_URL'],
  max: 5,
});

afterAll(async () => {
  await authority.end();
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
  knowledgeKey: string;
  versionId: string;
  content: Readonly<Record<string, unknown>>;
  contentHash: string;
  sources: readonly { sourceRef: string; sourceVersion: string; sourceHash: string; locator: string | null; metadata: Readonly<Record<string, string | number | boolean | null>> }[];
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
  const knowledgeKey = `audit2-${tag}`;
  const item = await admin.query<{ id: string }>(
    `INSERT INTO professional_knowledge_items
       (knowledge_key, created_by_account_id, created_by_person_id)
     VALUES ($1,$2,$3) RETURNING id`,
    [knowledgeKey, actor.accountId, actor.personId]
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
  return { knowledgeId, knowledgeKey, versionId, content, contentHash, sources, sourceSetHash, sourceRef, scope };
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
    semanticBindingHash: hashProfessionalKnowledgeApprovalBinding({
      knowledgeId: knowledge.knowledgeId,
      knowledgeKey: knowledge.knowledgeKey,
      semanticVersion: '1.0.0',
      contentHash: knowledge.contentHash,
      sourceSetHash: knowledge.sourceSetHash,
      scope: knowledge.scope,
    }),
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
  it('FINAL HIGH-002: creator Account/Person cannot self-review; identity-string spoof fails and a different reviewer succeeds', async () => {
    const creator = await seedActor('final-self-review-creator');
    const knowledge = await seedKnowledge(creator, {
      reviewState: 'PENDING',
      validityState: 'UNKNOWN',
    });
    const reviewedAt = new Date('2026-11-17T00:30:00Z');

    for (const reviewerIdentity of [
      `reviewer:${creator.personId}`,
      `spoofed-reviewer:${crypto.randomUUID()}`,
    ]) {
      await expect(
        recordKnowledgeReview({
          pool: app,
          authorityPool: authority,
          accountId: creator.accountId,
          personId: creator.personId,
          assignmentId: creator.assignmentId,
          idempotencyKey: `self-review-${crypto.randomUUID()}`,
          versionId: knowledge.versionId,
          expectedRevision: 1,
          reviewerIdentity,
          qualificationRef: `qualification:${creator.personId}`,
          qualificationProvider: qualificationProvider(),
          outcome: 'REVIEWED',
          reviewedAt,
          now: reviewedAt,
        })
      ).rejects.toMatchObject({
        code: 'PROFESSIONAL_AUTHORITY_INVALID',
        reason: 'PROFESSIONAL_KNOWLEDGE_SELF_REVIEW_FORBIDDEN',
      });
    }

    // DB defense-in-depth: bypassing the service and inserting creator-authored
    // review evidence through the controlled executor must still fail on the
    // persisted Account/Person identity, regardless of reviewerIdentity text.
    await expect(
      withProfessionalKnowledgeAuthorityTransaction(
        authority,
        { accountId: creator.accountId },
        async (tx) => {
          await tx.query('SELECT app.set_professional_review_context($1)', [
            creator.assignmentId,
          ]);
          await tx.query(
            `INSERT INTO professional_knowledge_review_evidence
               (knowledge_version_id, reviewed_revision, content_hash,
                source_set_hash, reviewer_identity, reviewer_account_id,
                reviewer_person_id, staff_assignment_ref, qualification_ref,
                review_outcome, reviewed_at)
             VALUES ($1,1,$2,$3,$4,$5,$6,$7,$8,'REVIEWED',$9)`,
            [
              knowledge.versionId,
              knowledge.contentHash,
              knowledge.sourceSetHash,
              `spoofed-reviewer:${crypto.randomUUID()}`,
              creator.accountId,
              creator.personId,
              creator.assignmentId,
              `qualification:${creator.personId}`,
              reviewedAt,
            ]
          );
        }
      )
    ).rejects.toMatchObject({ code: '42501' });

    const afterDenied = await admin.query<{
      revision: number;
      review_state: string;
      validity_state: string;
      evidence_count: string;
      success_audit_count: string;
    }>(
      `SELECT v.revision, v.review_state, v.validity_state,
              (SELECT count(*)::text FROM professional_knowledge_review_evidence e
                WHERE e.knowledge_version_id=v.id) AS evidence_count,
              (SELECT count(*)::text FROM business_audit_events a
                WHERE a.resource_id=v.id
                  AND a.event_type='PROFESSIONAL_KNOWLEDGE_REVIEW_RECORDED')
                AS success_audit_count
         FROM professional_knowledge_versions v
        WHERE v.id=$1`,
      [knowledge.versionId]
    );
    expect(afterDenied.rows[0]).toEqual({
      revision: 1,
      review_state: 'PENDING',
      validity_state: 'UNKNOWN',
      evidence_count: '0',
      success_audit_count: '0',
    });

    const reviewer = await seedActor('final-different-reviewer');
    await expect(
      recordKnowledgeReview({
        pool: app,
        authorityPool: authority,
        accountId: reviewer.accountId,
        personId: reviewer.personId,
        assignmentId: reviewer.assignmentId,
        idempotencyKey: `different-reviewer-${crypto.randomUUID()}`,
        versionId: knowledge.versionId,
        expectedRevision: 1,
        reviewerIdentity: `reviewer:${reviewer.personId}`,
        qualificationRef: `qualification:${reviewer.personId}`,
        qualificationProvider: qualificationProvider(),
        outcome: 'REVIEWED',
        reviewedAt,
        now: reviewedAt,
      })
    ).resolves.toMatchObject({
      versionId: knowledge.versionId,
      revision: 2,
      reviewState: 'CURRENT',
      validityState: 'VALID',
    });

    const evidence = await admin.query<{
      reviewer_account_id: string;
      reviewer_person_id: string;
    }>(
      `SELECT reviewer_account_id, reviewer_person_id
         FROM professional_knowledge_review_evidence
        WHERE knowledge_version_id=$1`,
      [knowledge.versionId]
    );
    expect(evidence.rows).toEqual([{
      reviewer_account_id: reviewer.accountId,
      reviewer_person_id: reviewer.personId,
    }]);
  });

  it('FINAL HIGH-001: xiaoshuyin_app cannot directly mint review authority/evidence or publish with valid Staff context', async () => {
    const creator = await seedActor('final-db-bypass-creator');
    const reviewer = await seedActor('final-db-bypass-reviewer');
    const pending = await seedKnowledge(creator, {
      reviewState: 'PENDING',
      validityState: 'UNKNOWN',
    });

    await expect(
      withProfessionalKnowledgeAdminTransaction(
        app,
        { accountId: reviewer.accountId, assignmentId: reviewer.assignmentId },
        async (tx) => {
          await tx.query(
            `UPDATE professional_knowledge_versions
                SET review_state='CURRENT',
                    validity_state='VALID',
                    revision=revision+1
              WHERE id=$1`,
            [pending.versionId]
          );
        }
      )
    ).rejects.toMatchObject({ code: '42501' });

    await expect(
      withProfessionalKnowledgeAdminTransaction(
        app,
        { accountId: reviewer.accountId, assignmentId: reviewer.assignmentId },
        async (tx) => {
          await tx.query(
            `INSERT INTO professional_knowledge_review_evidence
               (knowledge_version_id, reviewed_revision, content_hash,
                source_set_hash, reviewer_identity, reviewer_account_id,
                reviewer_person_id, staff_assignment_ref, qualification_ref,
                review_outcome, reviewed_at)
             VALUES ($1,1,$2,$3,$4,$5,$6,$7,$8,'REVIEWED',clock_timestamp())`,
            [
              pending.versionId,
              pending.contentHash,
              pending.sourceSetHash,
              `reviewer:${reviewer.personId}`,
              reviewer.accountId,
              reviewer.personId,
              reviewer.assignmentId,
              `qualification:${reviewer.personId}`,
            ]
          );
        }
      )
    ).rejects.toMatchObject({ code: '42501' });

    const twoStage = await seedKnowledge(creator, {
      reviewState: 'PENDING',
      validityState: 'UNKNOWN',
    });
    await expect(
      withProfessionalKnowledgeAdminTransaction(
        app,
        { accountId: reviewer.accountId, assignmentId: reviewer.assignmentId },
        async (tx) => {
          await tx.query(
            `UPDATE professional_knowledge_versions
                SET review_state='CURRENT',
                    validity_state='VALID',
                    revision=revision+1
              WHERE id=$1`,
            [twoStage.versionId]
          );
          await tx.query(
            'SELECT app.lock_professional_review_assignment_target($1,$2,$3)',
            [reviewer.assignmentId, reviewer.accountId, reviewer.personId]
          );
          await tx.query(
            `UPDATE professional_knowledge_versions
                SET lifecycle_status='PUBLISHED',
                    revision=revision+1
              WHERE id=$1`,
            [twoStage.versionId]
          );
        }
      )
    ).rejects.toMatchObject({ code: '42501' });

    const publishableShape = await seedKnowledge(creator, {
      reviewState: 'CURRENT',
      validityState: 'VALID',
    });
    await expect(
      withProfessionalKnowledgeAdminTransaction(
        app,
        { accountId: reviewer.accountId, assignmentId: reviewer.assignmentId },
        async (tx) => {
          await tx.query(
            'SELECT app.lock_professional_review_assignment_target($1,$2,$3)',
            [reviewer.assignmentId, reviewer.accountId, reviewer.personId]
          );
          await tx.query(
            `UPDATE professional_knowledge_versions
                SET lifecycle_status='PUBLISHED',
                    released_at=clock_timestamp(),
                    effective_from=clock_timestamp(),
                    revision=revision+1
              WHERE id=$1`,
            [publishableShape.versionId]
          );
        }
      )
    ).rejects.toMatchObject({ code: '42501' });

    const final = await admin.query<{
      id: string;
      lifecycle_status: string;
      review_state: string;
      validity_state: string;
      revision: number;
    }>(
      `SELECT id, lifecycle_status, review_state, validity_state, revision
         FROM professional_knowledge_versions
        WHERE id=ANY($1::uuid[])`,
      [[pending.versionId, twoStage.versionId, publishableShape.versionId]]
    );
    const byId = new Map(final.rows.map((row) => [row.id, row]));
    expect(byId.get(pending.versionId)).toMatchObject({
      lifecycle_status: 'CANDIDATE',
      review_state: 'PENDING',
      validity_state: 'UNKNOWN',
      revision: 1,
    });
    expect(byId.get(twoStage.versionId)).toMatchObject({
      lifecycle_status: 'CANDIDATE',
      review_state: 'PENDING',
      validity_state: 'UNKNOWN',
      revision: 1,
    });
    expect(byId.get(publishableShape.versionId)).toMatchObject({
      lifecycle_status: 'CANDIDATE',
      review_state: 'CURRENT',
      validity_state: 'VALID',
      revision: 1,
    });
    expect(final.rows.some((row) =>
      row.lifecycle_status === 'PUBLISHED' &&
      row.review_state === 'CURRENT' &&
      row.validity_state === 'VALID'
    )).toBe(false);
  });

  it('FR-028 / FR-031: review commit then lost-response retry exact-replays before stale revision; semantic mismatches conflict', async () => {
    const actor = await seedActor('review-replay');
    const creator = await seedActor('review-replay-creator');
    const knowledge = await seedKnowledge(creator, {
      reviewState: 'PENDING',
      validityState: 'UNKNOWN',
    });
    const idempotencyKey = `review-replay-${crypto.randomUUID()}`;
    const reviewedAt = new Date('2026-11-17T01:00:00Z');
    const request = {
      pool: app,
      authorityPool: authority,
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

    await admin.query(
      `UPDATE staff_assignments
          SET revoked_at=clock_timestamp(), revoked_by_account_id=$2
        WHERE id=$1`,
      [actor.assignmentId, actor.accountId]
    );

    // Replay must resolve before both current Staff authority and the
    // post-commit revision can veto the already-settled command.
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

    // A genuinely new command still enters the Staff boundary and fails
    // closed after revocation; replay ordering does not weaken authority.
    await expect(
      recordKnowledgeReview({
        ...request,
        idempotencyKey: `review-new-after-revoke-${crypto.randomUUID()}`,
        expectedRevision: 2,
        reviewedAt: new Date('2026-11-17T01:00:02Z'),
      })
    ).rejects.toMatchObject({ code: '42501' });

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
      { accountId: reviewer.accountId, assignmentId: reviewer.assignmentId },
      async (tx) => {
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
      }
    );

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
      authorityPool: authority,
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
        authorityPool: authority,
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

    const retiredPrepared = prepareInterventionDefinition({
      sceneId: 'DIGITAL_USE',
      interventionCode: `AUDIT2_RET_${crypto.randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()}`,
      version: 1,
      semantic: interventionSemantic(),
    });
    const retired = await insertInterventionDefinitionCandidate(admin as any, {
      ...retiredPrepared,
      supersedesId: null,
      createdByPersonId: actor.personId,
    });
    await transitionInterventionDefinitionStateCas(admin as any, {
      id: retired.id,
      expectedRevision: 1,
      expectedState: 'CANDIDATE',
      nextState: 'RETIRED',
    });
    await expect(
      resolveCurrentInterventionDefinition(admin as any, {
        definitionId: retired.id,
        definitionVersion: retired.version,
        contentHash: retired.contentHash,
      })
    ).resolves.toMatchObject({
      status: 'INVALID',
      reason: 'INTERVENTION_DEFINITION_RETIRED',
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

  it('PHASE2 HIGH-001: real edit -> review rejects stale semantic proof and releases only with fresh exact proof', async () => {
    const reviewer = await seedActor('phase2-semantic-reviewer');
    const releaseActor = await seedActor('phase2-semantic-release');
    const creator = await seedActor('phase2-semantic-creator');
    const knowledge = await seedKnowledge(creator, {
      reviewState: 'CURRENT',
      validityState: 'VALID',
    });
    const staleProof = approvalProof(
      knowledge,
      reviewer,
      `phase2-stale-${crypto.randomUUID()}`
    );
    const changedScope: ProfessionalKnowledgeScopeMetadata = {
      ...knowledge.scope,
      applicability: ['sleep-impact', 'family-conflict'],
      exclusions: ['acute-safety-risk'],
      riskLevels: ['LOW', 'MODERATE'],
    };

    await expect(
      editKnowledgeCandidate({
        pool: app,
        accountId: releaseActor.accountId,
        personId: releaseActor.personId,
        assignmentId: releaseActor.assignmentId,
        idempotencyKey: `phase2-edit-${crypto.randomUUID()}`,
        versionId: knowledge.versionId,
        expectedRevision: 1,
        content: knowledge.content,
        contentHash: knowledge.contentHash,
        sourceSetHash: knowledge.sourceSetHash,
        sources: knowledge.sources,
        scope: changedScope,
      })
    ).resolves.toEqual({ versionId: knowledge.versionId, revision: 2 });

    const reviewedAt = new Date('2026-11-17T04:00:00Z');
    await expect(
      recordKnowledgeReview({
        pool: app,
        authorityPool: authority,
        accountId: releaseActor.accountId,
        personId: releaseActor.personId,
        assignmentId: releaseActor.assignmentId,
        idempotencyKey: `phase2-review-${crypto.randomUUID()}`,
        versionId: knowledge.versionId,
        expectedRevision: 2,
        reviewerIdentity: `reviewer:${releaseActor.personId}`,
        qualificationRef: `qualification:${releaseActor.personId}`,
        qualificationProvider: qualificationProvider(),
        outcome: 'REVIEWED',
        reviewedAt,
        now: reviewedAt,
      })
    ).resolves.toMatchObject({
      revision: 3,
      reviewState: 'CURRENT',
      validityState: 'VALID',
    });

    const changedKnowledge: SeededKnowledge = { ...knowledge, scope: changedScope };
    const staleKey = `phase2-stale-release-${crypto.randomUUID()}`;
    await expect(
      releaseKnowledgeVersion({
        pool: app,
        authorityPool: authority,
        accountId: releaseActor.accountId,
        personId: releaseActor.personId,
        assignmentId: releaseActor.assignmentId,
        idempotencyKey: staleKey,
        versionId: knowledge.versionId,
        expectedRevision: 3,
        approvalProofId: staleProof.proofId,
        approvalProvider: approvalProvider(staleProof),
        qualificationProvider: qualificationProvider(),
        sceneBindingResolver: sceneBinding(changedKnowledge),
        now: new Date('2026-11-17T05:00:00Z'),
      })
    ).rejects.toMatchObject({
      code: 'PROFESSIONAL_AUTHORITY_INVALID',
      reason: 'APPROVAL_PROOF_MISMATCH',
    });

    const afterStale = await admin.query<{
      lifecycle_status: string;
      revision: number;
    }>(
      'SELECT lifecycle_status, revision FROM professional_knowledge_versions WHERE id=$1',
      [knowledge.versionId]
    );
    expect(afterStale.rows[0]).toEqual({
      lifecycle_status: 'CANDIDATE',
      revision: 3,
    });
    const afterStaleEvidence = await admin.query<{ n: string }>(
      'SELECT count(*)::text AS n FROM professional_knowledge_approval_evidence WHERE knowledge_version_id=$1',
      [knowledge.versionId]
    );
    expect(afterStaleEvidence.rows[0]!.n).toBe('0');

    const freshProof = approvalProof(
      changedKnowledge,
      reviewer,
      `phase2-fresh-${crypto.randomUUID()}`
    );
    expect(freshProof.contentHash).toBe(staleProof.contentHash);
    expect(freshProof.semanticBindingHash).not.toBe(staleProof.semanticBindingHash);

    await expect(
      releaseKnowledgeVersion({
        pool: app,
        authorityPool: authority,
        accountId: releaseActor.accountId,
        personId: releaseActor.personId,
        assignmentId: releaseActor.assignmentId,
        idempotencyKey: `phase2-fresh-release-${crypto.randomUUID()}`,
        versionId: knowledge.versionId,
        expectedRevision: 3,
        approvalProofId: freshProof.proofId,
        approvalProvider: approvalProvider(freshProof),
        qualificationProvider: qualificationProvider(),
        sceneBindingResolver: sceneBinding(changedKnowledge),
        now: new Date('2026-11-17T05:00:00Z'),
      })
    ).resolves.toMatchObject({
      versionId: knowledge.versionId,
      revision: 4,
      lifecycleStatus: 'PUBLISHED',
    });
  });

  it('PHASE2 MEDIUM-002: review exact-validates qualification facts with zero business side effects on mismatch', async () => {
    const mutations = [
      ['qualificationRef', (r: any) => ({ ...r, qualificationRef: 'qualification:wrong' })],
      ['reviewerIdentity', (r: any) => ({ ...r, reviewerIdentity: 'reviewer:wrong' })],
      ['reviewerAccountId', (r: any) => ({ ...r, reviewerAccountId: crypto.randomUUID() })],
      ['reviewerPersonId', (r: any) => ({ ...r, reviewerPersonId: crypto.randomUUID() })],
      ['scope', (r: any) => ({ ...r, scope: { ...r.scope, locale: 'en-US' } })],
      ['expired', (r: any) => ({ ...r, validTo: '2026-11-17T03:59:59Z' })],
    ] as const;

    for (const [label, mutate] of mutations) {
      const actor = await seedActor(`phase2-review-q-${label}`);
      const creator = await seedActor(`phase2-review-q-creator-${label}`);
      const knowledge = await seedKnowledge(creator, {
        reviewState: 'PENDING',
        validityState: 'UNKNOWN',
      });
      const idempotencyKey = `phase2-review-q-${label}-${crypto.randomUUID()}`;
      const now = new Date('2026-11-17T04:00:00Z');
      const provider = {
        async resolve(input: {
          qualificationRef: string;
          reviewerIdentity: string;
          reviewerAccountId: string;
          reviewerPersonId: string;
          scope: any;
        }) {
          return mutate({
            status: 'RESOLVED' as const,
            qualificationRef: input.qualificationRef,
            reviewerIdentity: input.reviewerIdentity,
            reviewerAccountId: input.reviewerAccountId,
            reviewerPersonId: input.reviewerPersonId,
            scope: input.scope,
            validFrom: '2026-01-01T00:00:00Z',
            validTo: '2027-01-01T00:00:00Z',
          });
        },
      };

      await expect(
        recordKnowledgeReview({
          pool: app,
          authorityPool: authority,
          accountId: actor.accountId,
          personId: actor.personId,
          assignmentId: actor.assignmentId,
          idempotencyKey,
          versionId: knowledge.versionId,
          expectedRevision: 1,
          reviewerIdentity: `reviewer:${actor.personId}`,
          qualificationRef: `qualification:${actor.personId}`,
          qualificationProvider: provider,
          outcome: 'REVIEWED',
          reviewedAt: now,
          now,
        })
      ).rejects.toMatchObject({
        code: 'PROFESSIONAL_AUTHORITY_INVALID',
        reason: 'PROFESSIONAL_QUALIFICATION_MISMATCH',
      });

      const state = await admin.query<{
        revision: number;
        review_state: string;
        validity_state: string;
      }>(
        'SELECT revision, review_state, validity_state FROM professional_knowledge_versions WHERE id=$1',
        [knowledge.versionId]
      );
      expect(state.rows[0]).toEqual({
        revision: 1,
        review_state: 'PENDING',
        validity_state: 'UNKNOWN',
      });
      const evidence = await admin.query<{ n: string }>(
        'SELECT count(*)::text AS n FROM professional_knowledge_review_evidence WHERE knowledge_version_id=$1',
        [knowledge.versionId]
      );
      expect(evidence.rows[0]!.n).toBe('0');
      const successAudit = await admin.query<{ n: string }>(
        `SELECT count(*)::text AS n FROM business_audit_events
          WHERE resource_id=$1 AND event_type='PROFESSIONAL_KNOWLEDGE_REVIEW_RECORDED'`,
        [knowledge.versionId]
      );
      expect(successAudit.rows[0]!.n).toBe('0');
      const outcome = await readProfessionalKnowledgeMutationOutcome({
        pool: app,
        accountId: actor.accountId,
        assignmentId: actor.assignmentId,
        commandType: 'PROFESSIONAL_KNOWLEDGE_REVIEW_RECORD',
        idempotencyKey,
        versionId: knowledge.versionId,
      });
      expect(outcome.status).toBe('OUTCOME_UNKNOWN');
    }
  });

  it('PHASE2 MEDIUM-005/006: Scene exact-binding denials rollback business state and leave one durable bounded receipt', async () => {
    const cases = [
      ['wrong-scene', 'INVALID', (k: SeededKnowledge) => () => ({
        status: 'RESOLVED' as const,
        sceneCode: 'OTHER_SCENE',
        scenePackageVersion: k.scope.scenePackageVersion,
        refs: [{ knowledgeId: k.knowledgeId, semanticVersion: '1.0.0', contentHash: k.contentHash, sourceSetHash: k.sourceSetHash }],
      })],
      ['wrong-version', 'INVALID', (k: SeededKnowledge) => () => ({
        status: 'RESOLVED' as const,
        sceneCode: k.scope.sceneCode,
        scenePackageVersion: 'wrong-version',
        refs: [{ knowledgeId: k.knowledgeId, semanticVersion: '1.0.0', contentHash: k.contentHash, sourceSetHash: k.sourceSetHash }],
      })],
      ['missing-ref', 'INVALID', (k: SeededKnowledge) => () => ({
        status: 'RESOLVED' as const,
        sceneCode: k.scope.sceneCode,
        scenePackageVersion: k.scope.scenePackageVersion,
        refs: [],
      })],
      ['wrong-semantic-version', 'INVALID', (k: SeededKnowledge) => () => ({
        status: 'RESOLVED' as const,
        sceneCode: k.scope.sceneCode,
        scenePackageVersion: k.scope.scenePackageVersion,
        refs: [{ knowledgeId: k.knowledgeId, semanticVersion: '9.9.9', contentHash: k.contentHash, sourceSetHash: k.sourceSetHash }],
      })],
      ['wrong-content-hash', 'INVALID', (k: SeededKnowledge) => () => ({
        status: 'RESOLVED' as const,
        sceneCode: k.scope.sceneCode,
        scenePackageVersion: k.scope.scenePackageVersion,
        refs: [{ knowledgeId: k.knowledgeId, semanticVersion: '1.0.0', contentHash: 'f'.repeat(64), sourceSetHash: k.sourceSetHash }],
      })],
      ['wrong-source-set-hash', 'INVALID', (k: SeededKnowledge) => () => ({
        status: 'RESOLVED' as const,
        sceneCode: k.scope.sceneCode,
        scenePackageVersion: k.scope.scenePackageVersion,
        refs: [{ knowledgeId: k.knowledgeId, semanticVersion: '1.0.0', contentHash: k.contentHash, sourceSetHash: 'e'.repeat(64) }],
      })],
      ['owner-unavailable', 'UNAVAILABLE', (_k: SeededKnowledge) => () => ({
        status: 'UNAVAILABLE' as const,
        reason: 'SCENE_OWNER_OUTAGE',
      })],
    ] as const;

    for (const [label, decision, resolverFactory] of cases) {
      const reviewer = await seedActor(`phase2-scene-reviewer-${label}`);
      const actor = await seedActor(`phase2-scene-actor-${label}`);
      const knowledge = await seedKnowledge(actor);
      const p = approvalProof(knowledge, reviewer, `proof-${crypto.randomUUID()}`);
      const idempotencyKey = `phase2-scene-${label}-${crypto.randomUUID()}`;
      const request = {
        pool: app,
        authorityPool: authority,
        accountId: actor.accountId,
        personId: actor.personId,
        assignmentId: actor.assignmentId,
        idempotencyKey,
        versionId: knowledge.versionId,
        expectedRevision: 1,
        approvalProofId: p.proofId,
        approvalProvider: approvalProvider(p),
        qualificationProvider: qualificationProvider(),
        sceneBindingResolver: resolverFactory(knowledge),
        now: new Date('2026-11-17T06:00:00Z'),
      };

      await expect(releaseKnowledgeVersion(request)).rejects.toMatchObject(
        decision === 'INVALID'
          ? { code: 'PROFESSIONAL_AUTHORITY_INVALID', reason: 'SCENE_PACKAGE_BINDING_INVALID' }
          : { code: 'DEPENDENCY_UNAVAILABLE', dependency: 'SCENE_PACKAGE_BINDING' }
      );

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
      const settlement = await readProfessionalKnowledgeMutationOutcome({
        pool: app,
        accountId: actor.accountId,
        assignmentId: actor.assignmentId,
        commandType: 'PROFESSIONAL_KNOWLEDGE_RELEASE',
        idempotencyKey,
        versionId: knowledge.versionId,
      });
      expect(settlement.status).toBe('OUTCOME_UNKNOWN');
      const receipt = await admin.query<{
        metadata: { decisionCategory: string; reasonCode: string; dependencyCategory: string };
      }>(
        `SELECT metadata FROM business_audit_events
          WHERE resource_id=$1 AND event_type='PROFESSIONAL_KNOWLEDGE_AUTHORITY_DENIED'`,
        [knowledge.versionId]
      );
      expect(receipt.rowCount).toBe(1);
      expect(receipt.rows[0]!.metadata).toMatchObject({
        decisionCategory: decision,
        reasonCode: decision === 'INVALID'
          ? 'SCENE_PACKAGE_BINDING_INVALID'
          : 'SCENE_PACKAGE_BINDING_UNAVAILABLE',
        dependencyCategory: 'SCENE_PACKAGE_BINDING',
      });

      // Exact failed logical-command retry may record no more than one receipt.
      await expect(releaseKnowledgeVersion(request)).rejects.toBeDefined();
      const deduped = await admin.query<{ n: string }>(
        `SELECT count(*)::text AS n FROM business_audit_events
          WHERE resource_id=$1 AND event_type='PROFESSIONAL_KNOWLEDGE_AUTHORITY_DENIED'`,
        [knowledge.versionId]
      );
      expect(deduped.rows[0]!.n).toBe('1');
    }
  });

  it('PHASE2 MEDIUM-001/006: approval/qualification/Staff INVALID and UNAVAILABLE remain distinct in durable receipts', async () => {
    const reviewer = await seedActor('phase2-denial-reviewer');
    const actor = await seedActor('phase2-denial-actor');

    const runCase = async (
      label: string,
      configure: (knowledge: SeededKnowledge, p: ProfessionalApprovalProof) => {
        approvalProvider: any;
        qualificationProvider: any;
        approvalProofId?: string;
      },
      expected: { code: string; reasonOrDependency: string; decision: string; reasonCode: string }
    ) => {
      const knowledge = await seedKnowledge(actor);
      const p = approvalProof(knowledge, reviewer, `proof-${label}-${crypto.randomUUID()}`);
      const configured = configure(knowledge, p);
      const idempotencyKey = `phase2-denial-${label}-${crypto.randomUUID()}`;
      const promise = releaseKnowledgeVersion({
        pool: app,
        authorityPool: authority,
        accountId: actor.accountId,
        personId: actor.personId,
        assignmentId: actor.assignmentId,
        idempotencyKey,
        versionId: knowledge.versionId,
        expectedRevision: 1,
        approvalProofId: configured.approvalProofId ?? p.proofId,
        approvalProvider: configured.approvalProvider,
        qualificationProvider: configured.qualificationProvider,
        sceneBindingResolver: sceneBinding(knowledge),
        now: new Date('2026-11-17T07:00:00Z'),
      });
      await expect(promise).rejects.toMatchObject(
        expected.code === 'PROFESSIONAL_AUTHORITY_INVALID'
          ? { code: expected.code, reason: expected.reasonOrDependency }
          : { code: expected.code, dependency: expected.reasonOrDependency }
      );
      const receipt = await admin.query<{ metadata: Record<string, string> }>(
        `SELECT metadata FROM business_audit_events
          WHERE resource_id=$1 AND event_type='PROFESSIONAL_KNOWLEDGE_AUTHORITY_DENIED'`,
        [knowledge.versionId]
      );
      expect(receipt.rowCount).toBe(1);
      expect(receipt.rows[0]!.metadata).toMatchObject({
        decisionCategory: expected.decision,
        reasonCode: expected.reasonCode,
      });
      const sideEffects = await admin.query<{ approvals: string; success_audits: string }>(
        `SELECT
           (SELECT count(*)::text FROM professional_knowledge_approval_evidence WHERE knowledge_version_id=$1) AS approvals,
           (SELECT count(*)::text FROM business_audit_events
             WHERE resource_id=$1 AND event_type='PROFESSIONAL_KNOWLEDGE_RELEASED') AS success_audits`,
        [knowledge.versionId]
      );
      expect(sideEffects.rows[0]).toEqual({ approvals: '0', success_audits: '0' });
    };

    await runCase(
      'approval-invalid',
      (_k, _p) => ({
        approvalProvider: {
          async resolve() { return { status: 'INVALID' as const, reason: 'REVOKED' }; },
          async revalidate() { return { status: 'INVALID' as const, reason: 'REVOKED' }; },
        },
        qualificationProvider: qualificationProvider(),
      }),
      { code: 'PROFESSIONAL_AUTHORITY_INVALID', reasonOrDependency: 'APPROVAL:REVOKED', decision: 'INVALID', reasonCode: 'APPROVAL_INVALID' }
    );

    await runCase(
      'approval-unavailable',
      (_k, _p) => ({
        approvalProvider: {
          async resolve() { return { status: 'UNAVAILABLE' as const, reason: 'TIMEOUT' as const }; },
          async revalidate() { return { status: 'UNAVAILABLE' as const, reason: 'TIMEOUT' as const }; },
        },
        qualificationProvider: qualificationProvider(),
      }),
      { code: 'DEPENDENCY_UNAVAILABLE', reasonOrDependency: 'APPROVAL:TIMEOUT', decision: 'UNAVAILABLE', reasonCode: 'APPROVAL_UNAVAILABLE' }
    );

    await runCase(
      'proof-id-mismatch',
      (_k, p) => ({
        approvalProvider: approvalProvider({ ...p, proofId: `substitute-${crypto.randomUUID()}` }),
        qualificationProvider: qualificationProvider(),
        approvalProofId: p.proofId,
      }),
      { code: 'PROFESSIONAL_AUTHORITY_INVALID', reasonOrDependency: 'APPROVAL_PROOF_ID_MISMATCH', decision: 'INVALID', reasonCode: 'APPROVAL_PROOF_ID_MISMATCH' }
    );

    await runCase(
      'qualification-invalid',
      (_k, p) => ({
        approvalProvider: approvalProvider(p),
        qualificationProvider: { async resolve() { return { status: 'INVALID' as const, reason: 'REVOKED' }; } },
      }),
      { code: 'PROFESSIONAL_AUTHORITY_INVALID', reasonOrDependency: 'PROFESSIONAL_QUALIFICATION_INVALID', decision: 'INVALID', reasonCode: 'PROFESSIONAL_QUALIFICATION_INVALID' }
    );

    await runCase(
      'qualification-unavailable',
      (_k, p) => ({
        approvalProvider: approvalProvider(p),
        qualificationProvider: { async resolve() { return { status: 'UNAVAILABLE' as const, reason: 'OUTAGE' }; } },
      }),
      { code: 'DEPENDENCY_UNAVAILABLE', reasonOrDependency: 'PROFESSIONAL_QUALIFICATION', decision: 'UNAVAILABLE', reasonCode: 'PROFESSIONAL_QUALIFICATION_UNAVAILABLE' }
    );

    const revokedKnowledge = await seedKnowledge(actor);
    const revokedProof = approvalProof(
      revokedKnowledge,
      reviewer,
      `proof-revoked-${crypto.randomUUID()}`
    );
    await admin.query(
      `UPDATE staff_assignments
          SET revoked_at=clock_timestamp(), revoked_by_account_id=$2
        WHERE id=$1`,
      [reviewer.assignmentId, actor.accountId]
    );
    const revokedKey = `phase2-denial-staff-invalid-${crypto.randomUUID()}`;
    await expect(
      releaseKnowledgeVersion({
        pool: app,
        authorityPool: authority,
        accountId: actor.accountId,
        personId: actor.personId,
        assignmentId: actor.assignmentId,
        idempotencyKey: revokedKey,
        versionId: revokedKnowledge.versionId,
        expectedRevision: 1,
        approvalProofId: revokedProof.proofId,
        approvalProvider: approvalProvider(revokedProof),
        qualificationProvider: qualificationProvider(),
        sceneBindingResolver: sceneBinding(revokedKnowledge),
        now: new Date('2026-11-17T07:00:00Z'),
      })
    ).rejects.toMatchObject({
      code: 'PROFESSIONAL_AUTHORITY_INVALID',
      reason: 'STAFF_AUTHORITY_INVALID',
    });
    const staffReceipt = await admin.query<{ metadata: Record<string, string> }>(
      `SELECT metadata FROM business_audit_events
        WHERE resource_id=$1 AND event_type='PROFESSIONAL_KNOWLEDGE_AUTHORITY_DENIED'`,
      [revokedKnowledge.versionId]
    );
    expect(staffReceipt.rows[0]!.metadata).toMatchObject({
      decisionCategory: 'INVALID',
      reasonCode: 'STAFF_AUTHORITY_INVALID',
      dependencyCategory: 'STAFF_AUTHORITY',
    });
  });

  it('PHASE2 HIGH-002: malformed approval and qualification expiry fail closed in a real release', async () => {
    const reviewer = await seedActor('phase2-time-reviewer');
    const actor = await seedActor('phase2-time-actor');

    for (const target of ['approval', 'qualification'] as const) {
      const knowledge = await seedKnowledge(actor);
      const base = approvalProof(knowledge, reviewer, `proof-time-${target}-${crypto.randomUUID()}`);
      const p = target === 'approval' ? { ...base, effectiveTo: 'not-a-time' } : base;
      const q = target === 'qualification'
        ? {
            async resolve(input: any) {
              return {
                status: 'RESOLVED' as const,
                qualificationRef: input.qualificationRef,
                reviewerIdentity: input.reviewerIdentity,
                reviewerAccountId: input.reviewerAccountId,
                reviewerPersonId: input.reviewerPersonId,
                scope: input.scope,
                validFrom: '2026-01-01T00:00:00Z',
                validTo: 'not-a-time',
              };
            },
          }
        : qualificationProvider();

      await expect(
        releaseKnowledgeVersion({
          pool: app,
          authorityPool: authority,
          accountId: actor.accountId,
          personId: actor.personId,
          assignmentId: actor.assignmentId,
          idempotencyKey: `phase2-time-${target}-${crypto.randomUUID()}`,
          versionId: knowledge.versionId,
          expectedRevision: 1,
          approvalProofId: p.proofId,
          approvalProvider: approvalProvider(p),
          qualificationProvider: q,
          sceneBindingResolver: sceneBinding(knowledge),
          now: new Date('2026-11-17T08:00:00Z'),
        })
      ).rejects.toMatchObject({
        code: 'PROFESSIONAL_AUTHORITY_INVALID',
      });

      const state = await admin.query<{ lifecycle_status: string; revision: number }>(
        'SELECT lifecycle_status, revision FROM professional_knowledge_versions WHERE id=$1',
        [knowledge.versionId]
      );
      expect(state.rows[0]).toEqual({ lifecycle_status: 'CANDIDATE', revision: 1 });
    }
  });

  it('PHASE2 HIGH-003: reviewer revocation serializes after a release that already locked exact Reviewer authority', async () => {
    const reviewer = await seedActor('phase2-race-revoke-reviewer');
    const actor = await seedActor('phase2-race-revoke-actor');
    const knowledge = await seedKnowledge(actor);
    const p = approvalProof(knowledge, reviewer, `proof-race-${crypto.randomUUID()}`);

    let qualificationEntered!: () => void;
    const entered = new Promise<void>((resolve) => { qualificationEntered = resolve; });
    let continueQualification!: () => void;
    const proceed = new Promise<void>((resolve) => { continueQualification = resolve; });
    const gatedQualification = {
      async resolve(input: any) {
        qualificationEntered();
        await proceed;
        return {
          status: 'RESOLVED' as const,
          qualificationRef: input.qualificationRef,
          reviewerIdentity: input.reviewerIdentity,
          reviewerAccountId: input.reviewerAccountId,
          reviewerPersonId: input.reviewerPersonId,
          scope: input.scope,
          validFrom: '2026-01-01T00:00:00Z',
          validTo: '2027-01-01T00:00:00Z',
        };
      },
    };

    const release = releaseKnowledgeVersion({
      pool: app,
      authorityPool: authority,
      accountId: actor.accountId,
      personId: actor.personId,
      assignmentId: actor.assignmentId,
      idempotencyKey: `phase2-race-release-${crypto.randomUUID()}`,
      versionId: knowledge.versionId,
      expectedRevision: 1,
      approvalProofId: p.proofId,
      approvalProvider: approvalProvider(p),
      qualificationProvider: gatedQualification,
      sceneBindingResolver: sceneBinding(knowledge),
      now: new Date('2026-11-17T09:00:00Z'),
    });

    await entered;
    const revoker = await admin.connect();
    try {
      const pid = (await revoker.query<{ pid: number }>('SELECT pg_backend_pid() AS pid')).rows[0]!.pid;
      const revocation = revoker.query(
        `UPDATE staff_assignments
            SET revoked_at=clock_timestamp(), revoked_by_account_id=$2
          WHERE id=$1`,
        [reviewer.assignmentId, actor.accountId]
      );

      let blocked = false;
      for (let i = 0; i < 100 && !blocked; i += 1) {
        const check = await admin.query<{ blocked: boolean }>(
          'SELECT cardinality(pg_blocking_pids($1)) > 0 AS blocked',
          [pid]
        );
        blocked = check.rows[0]?.blocked === true;
      }
      expect(blocked).toBe(true);

      continueQualification();
      await expect(release).resolves.toMatchObject({ lifecycleStatus: 'PUBLISHED' });
      await revocation;

      const staffState = await admin.query<{ revoked: boolean }>(
        'SELECT revoked_at IS NOT NULL AS revoked FROM staff_assignments WHERE id=$1',
        [reviewer.assignmentId]
      );
      expect(staffState.rows[0]!.revoked).toBe(true);
    } finally {
      revoker.release();
    }
  });

  it('PHASE2 HIGH-003: reviewer Account disable serializes after a release that already locked exact Reviewer authority', async () => {
    const reviewer = await seedActor('phase2-race-disable-reviewer');
    const actor = await seedActor('phase2-race-disable-actor');
    const knowledge = await seedKnowledge(actor);
    const p = approvalProof(knowledge, reviewer, `proof-race-disable-${crypto.randomUUID()}`);

    let enteredResolve!: () => void;
    const entered = new Promise<void>((resolve) => { enteredResolve = resolve; });
    let proceedResolve!: () => void;
    const proceed = new Promise<void>((resolve) => { proceedResolve = resolve; });
    const gatedQualification = {
      async resolve(input: any) {
        enteredResolve();
        await proceed;
        return {
          status: 'RESOLVED' as const,
          qualificationRef: input.qualificationRef,
          reviewerIdentity: input.reviewerIdentity,
          reviewerAccountId: input.reviewerAccountId,
          reviewerPersonId: input.reviewerPersonId,
          scope: input.scope,
          validFrom: '2026-01-01T00:00:00Z',
          validTo: '2027-01-01T00:00:00Z',
        };
      },
    };
    const release = releaseKnowledgeVersion({
      pool: app,
      authorityPool: authority,
      accountId: actor.accountId,
      personId: actor.personId,
      assignmentId: actor.assignmentId,
      idempotencyKey: `phase2-disable-release-${crypto.randomUUID()}`,
      versionId: knowledge.versionId,
      expectedRevision: 1,
      approvalProofId: p.proofId,
      approvalProvider: approvalProvider(p),
      qualificationProvider: gatedQualification,
      sceneBindingResolver: sceneBinding(knowledge),
      now: new Date('2026-11-17T09:00:00Z'),
    });

    await entered;
    const disabler = await admin.connect();
    try {
      const pid = (await disabler.query<{ pid: number }>('SELECT pg_backend_pid() AS pid')).rows[0]!.pid;
      const disable = disabler.query(
        `UPDATE accounts SET status='DISABLED' WHERE id=$1`,
        [reviewer.accountId]
      );
      let blocked = false;
      for (let i = 0; i < 100 && !blocked; i += 1) {
        const check = await admin.query<{ blocked: boolean }>(
          'SELECT cardinality(pg_blocking_pids($1)) > 0 AS blocked',
          [pid]
        );
        blocked = check.rows[0]?.blocked === true;
      }
      expect(blocked).toBe(true);

      proceedResolve();
      await expect(release).resolves.toMatchObject({ lifecycleStatus: 'PUBLISHED' });
      await disable;
      const account = await admin.query<{ status: string }>(
        'SELECT status FROM accounts WHERE id=$1',
        [reviewer.accountId]
      );
      expect(account.rows[0]!.status).toBe('DISABLED');
    } finally {
      disabler.release();
    }
  });

  it('PHASE2 HIGH-003: Reviewer authority expiring after validation but before transition is rejected by the final DB guard', async () => {
    const reviewer = await seedActor('phase2-race-expiry-reviewer');
    const actor = await seedActor('phase2-race-expiry-actor');
    const knowledge = await seedKnowledge(actor);
    const p = approvalProof(knowledge, reviewer, `proof-race-expiry-${crypto.randomUUID()}`);
    await admin.query(
      `UPDATE staff_assignments
          SET valid_until = clock_timestamp() + interval '250 milliseconds'
        WHERE id=$1`,
      [reviewer.assignmentId]
    );

    let enteredResolve!: () => void;
    const entered = new Promise<void>((resolve) => { enteredResolve = resolve; });
    let proceedResolve!: () => void;
    const proceed = new Promise<void>((resolve) => { proceedResolve = resolve; });
    const gatedQualification = {
      async resolve(input: any) {
        enteredResolve();
        await proceed;
        return {
          status: 'RESOLVED' as const,
          qualificationRef: input.qualificationRef,
          reviewerIdentity: input.reviewerIdentity,
          reviewerAccountId: input.reviewerAccountId,
          reviewerPersonId: input.reviewerPersonId,
          scope: input.scope,
          validFrom: '2026-01-01T00:00:00Z',
          validTo: '2027-01-01T00:00:00Z',
        };
      },
    };

    const release = releaseKnowledgeVersion({
      pool: app,
      authorityPool: authority,
      accountId: actor.accountId,
      personId: actor.personId,
      assignmentId: actor.assignmentId,
      idempotencyKey: `phase2-expiry-release-${crypto.randomUUID()}`,
      versionId: knowledge.versionId,
      expectedRevision: 1,
      approvalProofId: p.proofId,
      approvalProvider: approvalProvider(p),
      qualificationProvider: gatedQualification,
      sceneBindingResolver: sceneBinding(knowledge),
      now: new Date('2026-11-17T09:00:00Z'),
    });

    await entered;
    // Explicit barrier above proves the initial Staff validation already
    // completed. Poll the authoritative DB clock until the known expiry boundary
    // is crossed; no sleep/timer race and no iteration-count timing assumption.
    let expired = false;
    while (!expired) {
      const check = await admin.query<{ expired: boolean }>(
        `SELECT clock_timestamp() >= valid_until AS expired
           FROM staff_assignments WHERE id=$1`,
        [reviewer.assignmentId]
      );
      expired = check.rows[0]?.expired === true;
    }

    proceedResolve();
    await expect(release).rejects.toMatchObject({ code: '42501' });

    const state = await admin.query<{ lifecycle_status: string; revision: number }>(
      'SELECT lifecycle_status, revision FROM professional_knowledge_versions WHERE id=$1',
      [knowledge.versionId]
    );
    expect(state.rows[0]).toEqual({ lifecycle_status: 'CANDIDATE', revision: 1 });
    const receipt = await admin.query<{ metadata: Record<string, string> }>(
      `SELECT metadata FROM business_audit_events
        WHERE resource_id=$1 AND event_type='PROFESSIONAL_KNOWLEDGE_AUTHORITY_DENIED'`,
      [knowledge.versionId]
    );
    expect(receipt.rowCount).toBe(1);
    expect(receipt.rows[0]!.metadata).toMatchObject({
      decisionCategory: 'INVALID',
      reasonCode: 'STAFF_AUTHORITY_INVALID',
    });
  });


  it('PHASE2 MEDIUM-006: Staff owner timeout is UNAVAILABLE, rolls back release, and leaves one durable receipt', async () => {
    const reviewer = await seedActor('phase2-staff-unavailable-reviewer');
    const actor = await seedActor('phase2-staff-unavailable-actor');
    const knowledge = await seedKnowledge(actor);
    const p = approvalProof(
      knowledge,
      reviewer,
      `proof-staff-unavailable-${crypto.randomUUID()}`
    );

    const blocker = await admin.connect();
    const timedApp = new pg.Pool({
      connectionString: process.env['DATABASE_URL'],
      max: 2,
      options: '-c statement_timeout=150',
    });
    const timedAuthority = new pg.Pool({
      connectionString: process.env['MIGRATION_DATABASE_URL'],
      max: 2,
      options: '-c statement_timeout=150',
    });
    try {
      await blocker.query('BEGIN');
      await blocker.query(
        `SELECT pg_advisory_xact_lock(
           hashtextextended('AUTH_ACCOUNT:' || $1::text, 0)
         )`,
        [reviewer.accountId]
      );

      await expect(
        releaseKnowledgeVersion({
          pool: timedApp,
          authorityPool: timedAuthority,
          accountId: actor.accountId,
          personId: actor.personId,
          assignmentId: actor.assignmentId,
          idempotencyKey: `phase2-staff-unavailable-${crypto.randomUUID()}`,
          versionId: knowledge.versionId,
          expectedRevision: 1,
          approvalProofId: p.proofId,
          approvalProvider: approvalProvider(p),
          qualificationProvider: qualificationProvider(),
          sceneBindingResolver: sceneBinding(knowledge),
          now: new Date('2026-11-17T10:00:00Z'),
        })
      ).rejects.toMatchObject({
        code: 'DEPENDENCY_UNAVAILABLE',
        dependency: 'STAFF_AUTHORITY',
      });

      const state = await admin.query<{ lifecycle_status: string; revision: number }>(
        'SELECT lifecycle_status, revision FROM professional_knowledge_versions WHERE id=$1',
        [knowledge.versionId]
      );
      expect(state.rows[0]).toEqual({ lifecycle_status: 'CANDIDATE', revision: 1 });
      const receipt = await admin.query<{ metadata: Record<string, string> }>(
        `SELECT metadata FROM business_audit_events
          WHERE resource_id=$1 AND event_type='PROFESSIONAL_KNOWLEDGE_AUTHORITY_DENIED'`,
        [knowledge.versionId]
      );
      expect(receipt.rowCount).toBe(1);
      expect(receipt.rows[0]!.metadata).toMatchObject({
        decisionCategory: 'UNAVAILABLE',
        reasonCode: 'STAFF_AUTHORITY_UNAVAILABLE',
        dependencyCategory: 'STAFF_AUTHORITY',
      });
    } finally {
      await blocker.query('ROLLBACK').catch(() => undefined);
      blocker.release();
      await timedAuthority.end();
      await timedApp.end();
    }
  });


  it('PHASE3 P1: runtime SQL cannot INSERT a pre-reviewed or directly consumable Professional Knowledge version', async () => {
    const actor = await seedActor('phase3-direct-insert');
    const seeded = await seedKnowledge(actor, {
      reviewState: 'PENDING',
      validityState: 'UNKNOWN',
    });

    const attempts = [
      {
        semanticVersion: '2.0.0',
        lifecycleStatus: 'PUBLISHED',
        reviewState: 'CURRENT',
        validityState: 'VALID',
        revision: 1,
        releasedAt: new Date('2026-11-19T00:00:00Z'),
        effectiveFrom: new Date('2026-11-19T00:00:00Z'),
      },
      {
        semanticVersion: '2.0.1',
        lifecycleStatus: 'CANDIDATE',
        reviewState: 'CURRENT',
        validityState: 'VALID',
        revision: 1,
        releasedAt: null,
        effectiveFrom: null,
      },
      {
        semanticVersion: '2.0.2',
        lifecycleStatus: 'CANDIDATE',
        reviewState: 'PENDING',
        validityState: 'UNKNOWN',
        revision: 2,
        releasedAt: null,
        effectiveFrom: null,
      },
    ] as const;

    for (const attempt of attempts) {
      await expect(
        withProfessionalKnowledgeAdminTransaction(
          app,
          { accountId: actor.accountId, assignmentId: actor.assignmentId },
          async (tx) => {
            await tx.query(
              `INSERT INTO professional_knowledge_versions
                 (knowledge_id, semantic_version, revision, lifecycle_status,
                  review_state, validity_state, content, content_hash,
                  source_set_hash, scope_metadata, locale, released_at,
                  effective_from, created_by_account_id, created_by_person_id)
               VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10::jsonb,'zh-CN',
                       $11,$12,$13,$14)`,
              [
                seeded.knowledgeId,
                attempt.semanticVersion,
                attempt.revision,
                attempt.lifecycleStatus,
                attempt.reviewState,
                attempt.validityState,
                JSON.stringify(seeded.content),
                seeded.contentHash,
                seeded.sourceSetHash,
                JSON.stringify(seeded.scope),
                attempt.releasedAt,
                attempt.effectiveFrom,
                actor.accountId,
                actor.personId,
              ]
            );
          }
        )
      ).rejects.toMatchObject({ code: '42501' });
    }

    const { rows } = await admin.query<{ n: string }>(
      `SELECT count(*)::text AS n
         FROM professional_knowledge_versions
        WHERE knowledge_id=$1 AND semantic_version LIKE '2.%'`,
      [seeded.knowledgeId]
    );
    expect(rows[0]!.n).toBe('0');

    const legal = await withProfessionalKnowledgeAdminTransaction(
      app,
      { accountId: actor.accountId, assignmentId: actor.assignmentId },
      async (tx) => tx.query<{
        lifecycle_status: string;
        review_state: string;
        validity_state: string;
        revision: number;
        released_at: Date | null;
        effective_from: Date | null;
        effective_to: Date | null;
      }>(
        `INSERT INTO professional_knowledge_versions
           (knowledge_id, semantic_version, revision, lifecycle_status,
            review_state, validity_state, content, content_hash,
            source_set_hash, scope_metadata, locale, released_at,
            effective_from, effective_to, created_by_account_id, created_by_person_id)
         VALUES ($1,'2.0.3',1,'CANDIDATE','PENDING','UNKNOWN',$2::jsonb,$3,$4,$5::jsonb,
                 'zh-CN',NULL,NULL,NULL,$6,$7)
         RETURNING lifecycle_status, review_state, validity_state, revision,
                   released_at, effective_from, effective_to`,
        [
          seeded.knowledgeId,
          JSON.stringify(seeded.content),
          seeded.contentHash,
          seeded.sourceSetHash,
          JSON.stringify(seeded.scope),
          actor.accountId,
          actor.personId,
        ]
      )
    );

    expect(legal.rows[0]).toEqual({
      lifecycle_status: 'CANDIDATE',
      review_state: 'PENDING',
      validity_state: 'UNKNOWN',
      revision: 1,
      released_at: null,
      effective_from: null,
      effective_to: null,
    });
  });

});
