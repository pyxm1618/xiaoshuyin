import pg from 'pg';
import { afterAll, describe, expect, it } from 'vitest';
import { createAdminPool } from './setup/db.js';
import { withTransactionClient } from '../apps/server/api/src/db/tx.js';
import { runIdempotentCommandInTransaction } from '../apps/server/api/src/idempotency.js';
import { releaseKnowledgeVersion } from '../apps/server/api/src/services/professional-knowledge.js';
import {
  appendProfessionalKnowledgeReviewEvidence,
  applyProfessionalKnowledgeDependencyState,
  createProfessionalKnowledgeSuccessor,
  editProfessionalKnowledgeCandidate,
  lockProfessionalKnowledgeVersion,
  releaseProfessionalKnowledgeVersion,
  retireProfessionalKnowledgeVersion,
} from '../packages/domain/src/professional-knowledge-repository.js';
import {
  hashPayload,
  hashProfessionalKnowledgeApprovalBinding,
  hashProfessionalKnowledgeContent,
  hashProfessionalKnowledgeSourceSet,
  validateProfessionalApproval,
  type ProfessionalApprovalProof,
  type ProfessionalKnowledgeVersionSnapshot,
} from '../packages/domain/src/index.js';
import {
  resolveProfessionalKnowledgeBindingFromRegistry,
} from '../packages/scenes/digital-use/professional-knowledge-binding.js';

const admin = createAdminPool();
const authority = new pg.Pool({
  connectionString: process.env['MIGRATION_DATABASE_URL'],
  max: 5,
});

afterAll(async () => {
  await authority.end();
  await admin.end();
});

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function seedCandidate(input: {
  lifecycle?: 'CANDIDATE' | 'PUBLISHED';
  reviewState?: 'PENDING' | 'CURRENT' | 'NEEDS_REVIEW';
  validityState?: 'UNKNOWN' | 'VALID' | 'INVALID';
} = {}) {
  const tag = crypto.randomUUID();
  const account = await admin.query<{ id: string }>(
    'INSERT INTO accounts (wechat_openid) VALUES ($1) RETURNING id',
    [`slice17-rel-${tag}`]
  );
  const accountId = account.rows[0]!.id;
  const person = await admin.query<{ id: string }>(
    `INSERT INTO persons (account_id, created_by_account_id)
     VALUES ($1,$1) RETURNING id`,
    [accountId]
  );
  const personId = person.rows[0]!.id;
  const item = await admin.query<{ id: string }>(
    `INSERT INTO professional_knowledge_items
       (knowledge_key, created_by_account_id, created_by_person_id)
     VALUES ($1,$2,$3) RETURNING id`,
    [`reliability-${tag}`, accountId, personId]
  );
  const knowledgeId = item.rows[0]!.id;
  const lifecycle = input.lifecycle ?? 'CANDIDATE';
  const releasedAt = lifecycle === 'PUBLISHED' ? new Date('2026-11-01T00:00:00Z') : null;
  const version = await admin.query<{ id: string; revision: number }>(
    `INSERT INTO professional_knowledge_versions
       (knowledge_id, semantic_version, lifecycle_status, review_state, validity_state,
        content, content_hash, source_set_hash, scope_metadata, locale, released_at,
        created_by_account_id, created_by_person_id)
     VALUES ($1,'1.0.0',$2,$3,$4,$5::jsonb,$6,$7,$8::jsonb,'zh-CN',$9,$10,$11)
     RETURNING id, revision`,
    [
      knowledgeId,
      lifecycle,
      input.reviewState ?? 'PENDING',
      input.validityState ?? 'UNKNOWN',
      JSON.stringify({ body: 'v1' }),
      'a'.repeat(64),
      'b'.repeat(64),
      JSON.stringify({
        product: 'V1',
        sceneCode: 'DIGITAL_USE',
        scenePackageVersion: 'v-test',
        stages: ['ASSESSMENT'],
        ageBands: ['MINOR_14_17'],
        applicability: ['sleep-impact'],
        exclusions: [],
        riskLevels: ['LOW'],
        locale: 'zh-CN',
      }),
      releasedAt,
      accountId,
      personId,
    ]
  );
  const versionId = version.rows[0]!.id;
  await admin.query(
    `INSERT INTO professional_knowledge_sources
       (knowledge_version_id, knowledge_revision, ordinal,
        source_ref, source_version, source_hash, snapshot_metadata)
     VALUES ($1,1,1,'source:reliability','1',$2,'{}'::jsonb)`,
    [versionId, 'c'.repeat(64)]
  );
  const staff = await admin.query<{ id: string }>(
    `INSERT INTO staff_assignments
       (account_id, person_id, capability, scope_type, granted_by_account_id)
     VALUES ($1,$2,'PROFESSIONAL_REVIEW','GLOBAL',$1)
     RETURNING id`,
    [accountId, personId]
  );
  return {
    accountId,
    personId,
    knowledgeId,
    versionId,
    revision: version.rows[0]!.revision,
    staffAssignmentId: staff.rows[0]!.id,
  };
}

async function seedIndependentReviewer() {
  const tag = crypto.randomUUID();
  const account = await admin.query<{ id: string }>(
    'INSERT INTO accounts (wechat_openid) VALUES ($1) RETURNING id',
    [`slice17-independent-reviewer-${tag}`]
  );
  const accountId = account.rows[0]!.id;
  const person = await admin.query<{ id: string }>(
    `INSERT INTO persons (account_id, created_by_account_id)
     VALUES ($1,$1) RETURNING id`,
    [accountId]
  );
  const personId = person.rows[0]!.id;
  const staff = await admin.query<{ id: string }>(
    `INSERT INTO staff_assignments
       (account_id, person_id, capability, scope_type, granted_by_account_id)
     VALUES ($1,$2,'PROFESSIONAL_REVIEW','GLOBAL',$1)
     RETURNING id`,
    [accountId, personId]
  );
  return {
    accountId,
    personId,
    staffAssignmentId: staff.rows[0]!.id,
  };
}

async function seedExactApprovalCandidate() {
  const tag = crypto.randomUUID();
  const account = await admin.query<{ id: string }>(
    'INSERT INTO accounts (wechat_openid) VALUES ($1) RETURNING id',
    [`slice17-proof-race-${tag}`]
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
       (account_id, person_id, capability, scope_type, granted_by_account_id)
     VALUES ($1,$2,'PROFESSIONAL_REVIEW','GLOBAL',$1)
     RETURNING id`,
    [accountId, personId]
  );
  const knowledgeKey = `proof-race-${tag}`;
  const knowledge = await admin.query<{ id: string }>(
    `INSERT INTO professional_knowledge_items
       (knowledge_key, created_by_account_id, created_by_person_id)
     VALUES ($1,$2,$3) RETURNING id`,
    [knowledgeKey, accountId, personId]
  );
  const content = { body: 'exact approval race candidate' };
  const sources = [{
    sourceRef: `source:proof-race:${tag}`,
    sourceVersion: '1',
    sourceHash: '9'.repeat(64),
    locator: null,
    metadata: {},
  }];
  const contentHash = hashProfessionalKnowledgeContent(content);
  const sourceSetHash = hashProfessionalKnowledgeSourceSet(sources);
  const scope = {
    product: 'V1' as const,
    sceneCode: 'DIGITAL_USE',
    scenePackageVersion: 'v-proof-race',
    stages: ['ASSESSMENT'],
    ageBands: ['MINOR_14_17'] as const,
    applicability: ['sleep-impact'],
    exclusions: [],
    riskLevels: ['LOW'] as const,
    locale: 'zh-CN',
  };
  const version = await admin.query<{ id: string }>(
    `INSERT INTO professional_knowledge_versions
       (knowledge_id, semantic_version, review_state, validity_state,
        content, content_hash, source_set_hash, scope_metadata, locale,
        created_by_account_id, created_by_person_id)
     VALUES ($1,'1.0.0','CURRENT','VALID',$2::jsonb,$3,$4,$5::jsonb,'zh-CN',$6,$7)
     RETURNING id`,
    [
      knowledge.rows[0]!.id,
      JSON.stringify(content),
      contentHash,
      sourceSetHash,
      JSON.stringify(scope),
      accountId,
      personId,
    ]
  );
  const versionId = version.rows[0]!.id;
  await admin.query(
    `INSERT INTO professional_knowledge_sources
       (knowledge_version_id, knowledge_revision, ordinal, source_ref,
        source_version, source_hash, locator, snapshot_metadata)
     VALUES ($1,1,1,$2,$3,$4,$5,$6::jsonb)`,
    [
      versionId,
      sources[0]!.sourceRef,
      sources[0]!.sourceVersion,
      sources[0]!.sourceHash,
      sources[0]!.locator,
      JSON.stringify(sources[0]!.metadata),
    ]
  );
  const approvalScope = {
    product: 'V1' as const,
    sceneCode: scope.sceneCode,
    scenePackageVersion: scope.scenePackageVersion,
    stages: scope.stages,
    ageBands: scope.ageBands,
    locale: scope.locale,
  };
  const proof: ProfessionalApprovalProof = {
    proofId: `proof:${tag}`,
    knowledgeId: knowledge.rows[0]!.id,
    semanticVersion: '1.0.0',
    contentHash,
    sourceSetHash,
    semanticBindingHash: hashProfessionalKnowledgeApprovalBinding({
      knowledgeId: knowledge.rows[0]!.id,
      knowledgeKey,
      semanticVersion: '1.0.0',
      contentHash,
      sourceSetHash,
      scope,
    }),
    sourceRefs: [sources[0]!.sourceRef],
    scope: approvalScope,
    reviewerIdentity: `reviewer:${tag}`,
    reviewerAccountId: accountId,
    reviewerPersonId: personId,
    staffAssignmentRef: assignment.rows[0]!.id,
    staffCapability: 'PROFESSIONAL_REVIEW',
    qualificationRef: `qualification:${tag}`,
    qualificationScope: approvalScope,
    approvalStatus: 'APPROVED',
    publicationStatus: 'EFFECTIVE',
    reviewedAt: '2026-11-01T00:00:00Z',
    effectiveFrom: '2026-11-01T00:00:00Z',
    effectiveTo: '2027-11-01T00:00:00Z',
  };
  return {
    accountId,
    personId,
    assignmentId: assignment.rows[0]!.id,
    knowledgeId: knowledge.rows[0]!.id,
    versionId,
    contentHash,
    sourceSetHash,
    scope,
    sources,
    proof,
  };
}

async function beginClient() {
  const client = await admin.connect();
  await client.query('BEGIN');
  return client;
}

async function rollbackRelease(client: Awaited<ReturnType<typeof beginClient>>) {
  try {
    await client.query('ROLLBACK');
  } catch {
    // Already committed/released or transaction already aborted.
  }
  try {
    client.release();
  } catch {
    // Already released.
  }
}

const editPayload = {
  content: { body: 'v2' },
  contentHash: 'd'.repeat(64),
  sourceSetHash: 'e'.repeat(64),
  sources: [{
    sourceRef: 'source:reliability:edited',
    sourceVersion: '2',
    sourceHash: 'f'.repeat(64),
    locator: null,
    metadata: {},
  }],
  scope: {
    product: 'V1' as const,
    sceneCode: 'DIGITAL_USE',
    scenePackageVersion: 'v-test',
    stages: ['ASSESSMENT'],
    ageBands: ['MINOR_14_17'] as const,
    applicability: ['sleep-impact'],
    exclusions: [],
    riskLevels: ['LOW'] as const,
    locale: 'zh-CN',
  },
};

describe('Professional Knowledge adversarial reliability matrix', () => {
  it('two candidate editors serialize; one exact revision wins and one stale editor fails', async () => {
    const seeded = await seedCandidate();
    const first = await beginClient();
    const second = await beginClient();
    try {
      await expect(
        editProfessionalKnowledgeCandidate(first, {
          versionId: seeded.versionId,
          expectedRevision: 1,
          ...editPayload,
        })
      ).resolves.toBe(2);

      const loser = editProfessionalKnowledgeCandidate(second, {
        versionId: seeded.versionId,
        expectedRevision: 1,
        ...editPayload,
        content: { body: 'loser' },
        contentHash: '1'.repeat(64),
      });
      const loserExpectation = expect(loser).rejects.toMatchObject({
        code: 'PROFESSIONAL_KNOWLEDGE_CONFLICT',
      });
      await sleep(30);
      await first.query('COMMIT');
      first.release();

      await loserExpectation;
      await second.query('ROLLBACK');
      second.release();

      const row = await admin.query<{ revision: number; content_hash: string; review_state: string; validity_state: string }>(
        `SELECT revision, content_hash, review_state, validity_state
           FROM professional_knowledge_versions WHERE id=$1`,
        [seeded.versionId]
      );
      expect(row.rows[0]).toEqual({
        revision: 2,
        content_hash: 'd'.repeat(64),
        review_state: 'PENDING',
        validity_state: 'UNKNOWN',
      });
      const snapshots = await admin.query<{ n: string }>(
        `SELECT count(*)::text AS n FROM professional_knowledge_sources
          WHERE knowledge_version_id=$1`,
        [seeded.versionId]
      );
      expect(Number(snapshots.rows[0]!.n)).toBe(2);
    } catch (error) {
      await rollbackRelease(first);
      await rollbackRelease(second);
      throw error;
    }
  });

  it('review vs edit cannot leave stale review evidence committed', async () => {
    const seeded = await seedCandidate();
    const independentReviewer = await seedIndependentReviewer();
    const snapshot = await lockProfessionalKnowledgeVersion(admin as any, seeded.versionId);
    expect(snapshot).not.toBeNull();

    const editor = await beginClient();
    const reviewer = await beginClient();
    try {
      await editProfessionalKnowledgeCandidate(editor, {
        versionId: seeded.versionId,
        expectedRevision: 1,
        ...editPayload,
      });

      const reviewAttempt = appendProfessionalKnowledgeReviewEvidence(reviewer, {
        version: snapshot!,
        reviewerIdentity: 'reviewer:test',
        reviewerAccountId: independentReviewer.accountId,
        reviewerPersonId: independentReviewer.personId,
        staffAssignmentRef: independentReviewer.staffAssignmentId,
        qualificationRef: 'qualification:test',
        reviewOutcome: 'REVIEWED',
        reviewedAt: new Date('2026-11-17T00:00:00Z'),
        nextReviewState: 'CURRENT',
        nextValidityState: 'VALID',
      });
      const reviewExpectation = expect(reviewAttempt).rejects.toMatchObject({
        code: 'PROFESSIONAL_KNOWLEDGE_CONFLICT',
      });

      await sleep(30);
      await editor.query('COMMIT');
      editor.release();

      await reviewExpectation;
      await reviewer.query('ROLLBACK');
      reviewer.release();

      const evidence = await admin.query<{ n: string }>(
        `SELECT count(*)::text AS n
           FROM professional_knowledge_review_evidence
          WHERE knowledge_version_id=$1`,
        [seeded.versionId]
      );
      expect(Number(evidence.rows[0]!.n)).toBe(0);
    } catch (error) {
      await rollbackRelease(editor);
      await rollbackRelease(reviewer);
      throw error;
    }
  });

  it('proof arrival vs edit is serialized behind the locked exact release revision', async () => {
    const seeded = await seedExactApprovalCandidate();
    let providerEntered!: () => void;
    const entered = new Promise<void>((resolve) => { providerEntered = resolve; });
    let providerContinue!: () => void;
    const continueProvider = new Promise<void>((resolve) => { providerContinue = resolve; });

    const approvalProvider = {
      async resolve() {
        return { status: 'RESOLVED' as const, proof: seeded.proof };
      },
      async revalidate() {
        providerEntered();
        await continueProvider;
        return { status: 'RESOLVED' as const, proof: seeded.proof };
      },
    };
    const qualificationProvider = {
      async resolve() {
        return {
          status: 'RESOLVED' as const,
          qualificationRef: seeded.proof.qualificationRef,
          reviewerIdentity: seeded.proof.reviewerIdentity,
          reviewerAccountId: seeded.accountId,
          reviewerPersonId: seeded.personId,
          scope: seeded.proof.qualificationScope,
          validFrom: '2026-01-01T00:00:00Z',
          validTo: '2027-01-01T00:00:00Z',
        };
      },
    };

    const release = releaseKnowledgeVersion({
      pool: admin,
      authorityPool: authority,
      accountId: seeded.accountId,
      personId: seeded.personId,
      assignmentId: seeded.assignmentId,
      idempotencyKey: `proof-race-release-${crypto.randomUUID()}`,
      versionId: seeded.versionId,
      expectedRevision: 1,
      approvalProofId: seeded.proof.proofId,
      approvalProvider,
      qualificationProvider,
      sceneBindingResolver(scenePackageVersion) {
        return {
          status: 'RESOLVED',
          sceneCode: seeded.scope.sceneCode,
          scenePackageVersion,
          refs: [{
            knowledgeId: seeded.knowledgeId,
            semanticVersion: '1.0.0',
            contentHash: seeded.contentHash,
            sourceSetHash: seeded.sourceSetHash,
          }],
        };
      },
      now: new Date('2026-11-17T00:00:00Z'),
    });

    await entered;

    const editor = await beginClient();
    const editedContent = { body: 'late editor must lose' };
    const editedSources = [{
      sourceRef: 'source:late-editor',
      sourceVersion: '2',
      sourceHash: '8'.repeat(64),
      locator: null,
      metadata: {},
    }];
    const editAttempt = editProfessionalKnowledgeCandidate(editor, {
      versionId: seeded.versionId,
      expectedRevision: 1,
      content: editedContent,
      contentHash: hashProfessionalKnowledgeContent(editedContent),
      sourceSetHash: hashProfessionalKnowledgeSourceSet(editedSources),
      sources: editedSources,
      scope: seeded.scope,
    });

    await sleep(30);
    let editSettled = false;
    void editAttempt.then(
      () => { editSettled = true; },
      () => { editSettled = true; }
    );
    await sleep(30);
    expect(editSettled).toBe(false);

    providerContinue();
    await expect(release).resolves.toMatchObject({
      versionId: seeded.versionId,
      revision: 2,
      lifecycleStatus: 'PUBLISHED',
    });
    await expect(editAttempt).rejects.toMatchObject({
      code: 'PROFESSIONAL_KNOWLEDGE_CONFLICT',
    });
    await editor.query('ROLLBACK');
    editor.release();

    const final = await admin.query<{ lifecycle_status: string; content_hash: string; revision: number }>(
      `SELECT lifecycle_status, content_hash, revision
         FROM professional_knowledge_versions WHERE id=$1`,
      [seeded.versionId]
    );
    expect(final.rows[0]).toEqual({
      lifecycle_status: 'PUBLISHED',
      content_hash: seeded.contentHash,
      revision: 2,
    });
  });

  it('release vs edit serializes on the same revision; release wins without last-write-wins', async () => {
    const seeded = await seedCandidate({ reviewState: 'CURRENT', validityState: 'VALID' });
    const releaser = await beginClient();
    const editor = await beginClient();
    try {
      await releaseProfessionalKnowledgeVersion(releaser, {
        versionId: seeded.versionId,
        expectedRevision: 1,
        effectiveFrom: new Date('2026-11-17T00:00:00Z'),
      });
      const editAttempt = editProfessionalKnowledgeCandidate(editor, {
        versionId: seeded.versionId,
        expectedRevision: 1,
        ...editPayload,
      });
      const editExpectation = expect(editAttempt).rejects.toMatchObject({
        code: 'PROFESSIONAL_KNOWLEDGE_CONFLICT',
      });
      await sleep(30);
      await releaser.query('COMMIT');
      releaser.release();
      await editExpectation;
      await editor.query('ROLLBACK');
      editor.release();

      const row = await admin.query<{ lifecycle_status: string; revision: number }>(
        'SELECT lifecycle_status, revision FROM professional_knowledge_versions WHERE id=$1',
        [seeded.versionId]
      );
      expect(row.rows[0]).toEqual({ lifecycle_status: 'PUBLISHED', revision: 2 });
    } catch (error) {
      await rollbackRelease(releaser);
      await rollbackRelease(editor);
      throw error;
    }
  });

  it('release vs retire and two releases converge through the same CAS', async () => {
    const seeded = await seedCandidate({ reviewState: 'CURRENT', validityState: 'VALID' });
    const retireRevision = await retireProfessionalKnowledgeVersion(admin as any, {
      versionId: seeded.versionId,
      expectedRevision: 1,
    });
    expect(retireRevision).toBe(2);

    await expect(
      releaseProfessionalKnowledgeVersion(admin as any, {
        versionId: seeded.versionId,
        expectedRevision: 1,
        effectiveFrom: new Date('2026-11-17T00:00:00Z'),
      })
    ).rejects.toMatchObject({ code: 'PROFESSIONAL_KNOWLEDGE_CONFLICT' });

    const second = await seedCandidate({ reviewState: 'CURRENT', validityState: 'VALID' });
    await expect(
      releaseProfessionalKnowledgeVersion(admin as any, {
        versionId: second.versionId,
        expectedRevision: 1,
        effectiveFrom: new Date('2026-11-17T00:00:00Z'),
      })
    ).resolves.toBe(2);
    await expect(
      releaseProfessionalKnowledgeVersion(admin as any, {
        versionId: second.versionId,
        expectedRevision: 1,
        effectiveFrom: new Date('2026-11-17T00:00:00Z'),
      })
    ).rejects.toMatchObject({ code: 'PROFESSIONAL_KNOWLEDGE_CONFLICT' });
  });

  it('retire vs successor preserves terminal history and prevents successor creation from a retired predecessor', async () => {
    const seeded = await seedCandidate({
      lifecycle: 'PUBLISHED',
      reviewState: 'CURRENT',
      validityState: 'VALID',
    });
    const retirer = await beginClient();
    const successor = await beginClient();
    try {
      await retireProfessionalKnowledgeVersion(retirer, {
        versionId: seeded.versionId,
        expectedRevision: 1,
      });
      const successorAttempt = createProfessionalKnowledgeSuccessor(successor, {
        knowledgeId: seeded.knowledgeId,
        predecessorVersionId: seeded.versionId,
        expectedPredecessorRevision: 1,
        semanticVersion: '1.1.0',
        ...editPayload,
        accountId: seeded.accountId,
        personId: seeded.personId,
      });
      const successorExpectation = expect(successorAttempt).rejects.toMatchObject({
        code: 'PROFESSIONAL_KNOWLEDGE_STATE_CONFLICT',
      });
      await sleep(30);
      await retirer.query('COMMIT');
      retirer.release();
      await successorExpectation;
      await successor.query('ROLLBACK');
      successor.release();

      const versions = await admin.query<{ semantic_version: string; lifecycle_status: string }>(
        `SELECT semantic_version, lifecycle_status
           FROM professional_knowledge_versions
          WHERE knowledge_id=$1 ORDER BY semantic_version`,
        [seeded.knowledgeId]
      );
      expect(versions.rows).toEqual([
        { semantic_version: '1.0.0', lifecycle_status: 'RETIRED' },
      ]);
    } catch (error) {
      await rollbackRelease(retirer);
      await rollbackRelease(successor);
      throw error;
    }
  });

  it('successor creation reserves the predecessor chain so later retirement cannot also win', async () => {
    const seeded = await seedCandidate({
      lifecycle: 'PUBLISHED',
      reviewState: 'CURRENT',
      validityState: 'VALID',
    });

    const successor = await createProfessionalKnowledgeSuccessor(admin as any, {
      knowledgeId: seeded.knowledgeId,
      predecessorVersionId: seeded.versionId,
      expectedPredecessorRevision: 1,
      semanticVersion: '1.1.0',
      ...editPayload,
      accountId: seeded.accountId,
      personId: seeded.personId,
    });
    expect(successor.revision).toBe(1);

    const predecessor = await admin.query<{ revision: number; lifecycle_status: string }>(
      'SELECT revision, lifecycle_status FROM professional_knowledge_versions WHERE id=$1',
      [seeded.versionId]
    );
    expect(predecessor.rows[0]).toEqual({
      revision: 2,
      lifecycle_status: 'PUBLISHED',
    });

    await expect(
      retireProfessionalKnowledgeVersion(admin as any, {
        versionId: seeded.versionId,
        expectedRevision: 1,
      })
    ).rejects.toMatchObject({ code: 'PROFESSIONAL_KNOWLEDGE_CONFLICT' });

    await expect(
      retireProfessionalKnowledgeVersion(admin as any, {
        versionId: seeded.versionId,
        expectedRevision: 2,
      })
    ).rejects.toMatchObject({ code: 'PROFESSIONAL_KNOWLEDGE_CONFLICT' });
  });

  it('validity propagation vs release cannot publish a stale CURRENT/VALID snapshot', async () => {
    const seeded = await seedCandidate({ reviewState: 'CURRENT', validityState: 'VALID' });
    const invalidator = await beginClient();
    const releaser = await beginClient();
    try {
      await applyProfessionalKnowledgeDependencyState(invalidator, {
        versionId: seeded.versionId,
        expectedRevision: 1,
        reviewState: 'NEEDS_REVIEW',
        validityState: 'INVALID',
      });
      const releaseAttempt = releaseProfessionalKnowledgeVersion(releaser, {
        versionId: seeded.versionId,
        expectedRevision: 1,
        effectiveFrom: new Date('2026-11-17T00:00:00Z'),
      });
      const releaseExpectation = expect(releaseAttempt).rejects.toMatchObject({
        code: 'PROFESSIONAL_KNOWLEDGE_CONFLICT',
      });
      await sleep(30);
      await invalidator.query('COMMIT');
      invalidator.release();
      await releaseExpectation;
      await releaser.query('ROLLBACK');
      releaser.release();

      const row = await admin.query<{ lifecycle_status: string; review_state: string; validity_state: string }>(
        `SELECT lifecycle_status, review_state, validity_state
           FROM professional_knowledge_versions WHERE id=$1`,
        [seeded.versionId]
      );
      expect(row.rows[0]).toEqual({
        lifecycle_status: 'CANDIDATE',
        review_state: 'NEEDS_REVIEW',
        validity_state: 'INVALID',
      });
    } catch (error) {
      await rollbackRelease(invalidator);
      await rollbackRelease(releaser);
      throw error;
    }
  });

  it('stale approval proof is invalid after an exact content/source mutation', () => {
    const version = {
      knowledgeId: 'k1',
      knowledgeKey: 'reliability-k1',
      semanticVersion: '1.0.0',
      contentHash: 'a'.repeat(64),
      sourceSetHash: 'b'.repeat(64),
      sources: [{ sourceRef: 'source:1' }],
      scope: {
        product: 'V1',
        sceneCode: 'DIGITAL_USE',
        scenePackageVersion: 'v-test',
        stages: ['ASSESSMENT'],
        ageBands: ['MINOR_14_17'],
        applicability: ['sleep-impact'],
        exclusions: [],
        riskLevels: ['LOW'],
        locale: 'zh-CN',
        professionalContentPackageRef: null,
        interventionDefinitionRef: null,
      },
    } as unknown as ProfessionalKnowledgeVersionSnapshot;
    const proof: ProfessionalApprovalProof = {
      proofId: 'proof-1',
      knowledgeId: 'k1',
      semanticVersion: '1.0.0',
      contentHash: '0'.repeat(64),
      sourceSetHash: 'b'.repeat(64),
      semanticBindingHash: 'f'.repeat(64),
      sourceRefs: ['source:1'],
      scope: {
        product: 'V1',
        sceneCode: 'DIGITAL_USE',
        scenePackageVersion: 'v-test',
        stages: ['ASSESSMENT'],
        ageBands: ['MINOR_14_17'],
        locale: 'zh-CN',
      },
      reviewerIdentity: 'reviewer',
      reviewerAccountId: 'a',
      reviewerPersonId: 'p',
      staffAssignmentRef: 's',
      staffCapability: 'PROFESSIONAL_REVIEW',
      qualificationRef: 'q',
      qualificationScope: {
        product: 'V1',
        sceneCode: 'DIGITAL_USE',
        scenePackageVersion: 'v-test',
        stages: ['ASSESSMENT'],
        ageBands: ['MINOR_14_17'],
        locale: 'zh-CN',
      },
      approvalStatus: 'APPROVED',
      publicationStatus: 'EFFECTIVE',
      reviewedAt: '2026-01-01T00:00:00Z',
      effectiveFrom: '2026-01-01T00:00:00Z',
      effectiveTo: '2027-01-01T00:00:00Z',
    };
    expect(
      validateProfessionalApproval({
        version,
        provider: { status: 'RESOLVED', proof },
        staffAuthority: {
          status: 'RESOLVED',
          assignmentRef: 's',
          accountId: 'a',
          personId: 'p',
          capability: 'PROFESSIONAL_REVIEW',
          scope: 'GLOBAL',
        },
        qualification: {
          status: 'RESOLVED',
          qualificationRef: 'q',
          reviewerIdentity: 'reviewer',
          reviewerAccountId: 'a',
          reviewerPersonId: 'p',
          scope: proof.qualificationScope,
          validFrom: '2026-01-01T00:00:00Z',
          validTo: '2027-01-01T00:00:00Z',
        },
        now: new Date('2026-11-17T00:00:00Z'),
      }).status
    ).toBe('INVALID');
  });

  it('provider timeout remains UNAVAILABLE rather than an invalid business proof', () => {
    expect(
      validateProfessionalApproval({
        version: {} as any,
        provider: { status: 'UNAVAILABLE', reason: 'TIMEOUT' },
        staffAuthority: { status: 'UNAVAILABLE', reason: 'not-read' },
        qualification: { status: 'UNAVAILABLE', reason: 'not-read' },
      })
    ).toEqual({ status: 'UNAVAILABLE', dependency: 'APPROVAL:TIMEOUT' });
  });

  it('DB statement timeout under an aggregate lock rolls back without half mutation', async () => {
    const seeded = await seedCandidate();
    const locker = await beginClient();
    const waiter = await beginClient();
    try {
      await lockProfessionalKnowledgeVersion(locker, seeded.versionId);
      await waiter.query("SET LOCAL statement_timeout = '75ms'");
      await expect(
        editProfessionalKnowledgeCandidate(waiter, {
          versionId: seeded.versionId,
          expectedRevision: 1,
          ...editPayload,
        })
      ).rejects.toMatchObject({ code: '57014' });
      await waiter.query('ROLLBACK');
      waiter.release();
      await locker.query('ROLLBACK');
      locker.release();

      const row = await admin.query<{ revision: number; content_hash: string }>(
        'SELECT revision, content_hash FROM professional_knowledge_versions WHERE id=$1',
        [seeded.versionId]
      );
      expect(row.rows[0]).toEqual({ revision: 1, content_hash: 'a'.repeat(64) });
    } catch (error) {
      await rollbackRelease(waiter);
      await rollbackRelease(locker);
      throw error;
    }
  });

  it('lost response converges through shared idempotency replay and mismatched payload is rejected', async () => {
    const seeded = await seedCandidate();
    const cfg = {
      accountId: seeded.accountId,
      personId: seeded.personId,
      purpose: 'PROFESSIONAL_KNOWLEDGE_ADMIN',
      commandType: 'PROFESSIONAL_KNOWLEDGE_RETIRE' as const,
      idempotencyKey: `lost-response-${crypto.randomUUID()}`,
      requestHash: hashPayload({ versionId: seeded.versionId, expectedRevision: 1 }),
    };

    const first = await withTransactionClient(admin, (tx) =>
      runIdempotentCommandInTransaction(tx, cfg, async () => ({
        status: 200,
        body: { versionId: seeded.versionId, revision: 2 },
      }))
    );
    expect(first.action).toBe('EXECUTED');

    const replay = await withTransactionClient(admin, (tx) =>
      runIdempotentCommandInTransaction(tx, cfg, async () => {
        throw new Error('must not execute on replay');
      })
    );
    expect(replay).toEqual({
      action: 'REPLAY',
      status: 200,
      body: { versionId: seeded.versionId, revision: 2 },
    });

    const mismatch = await withTransactionClient(admin, (tx) =>
      runIdempotentCommandInTransaction(
        tx,
        { ...cfg, requestHash: hashPayload({ versionId: seeded.versionId, expectedRevision: 999 }) },
        async () => ({ status: 500, body: {} })
      )
    );
    expect(mismatch).toEqual({ action: 'MISMATCH' });
  });

  it('Scene package binding is immutable exact-version truth, so no floating currentness race exists', () => {
    const ref = {
      knowledgeId: 'k1',
      semanticVersion: '1.0.0',
      contentHash: 'a'.repeat(64),
      sourceSetHash: 'b'.repeat(64),
    };
    const registry = [
      {
        sceneCode: 'DIGITAL_USE' as const,
        scenePackageVersion: 'v1',
        professionalKnowledgeRefs: [] as const,
      },
      {
        sceneCode: 'DIGITAL_USE' as const,
        scenePackageVersion: 'v2',
        professionalKnowledgeRefs: [ref] as const,
      },
    ];
    expect(resolveProfessionalKnowledgeBindingFromRegistry(registry, 'v1')).toMatchObject({ refs: [] });
    expect(resolveProfessionalKnowledgeBindingFromRegistry(registry, 'v2')).toMatchObject({ refs: [ref] });
    expect(resolveProfessionalKnowledgeBindingFromRegistry(registry, 'latest')).toEqual({
      status: 'INVALID',
      reason: 'SCENE_PACKAGE_VERSION_NOT_FOUND',
    });
  });
});
