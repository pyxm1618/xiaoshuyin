import { afterAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import {
  hashPayload,
  IDEMPOTENCY_COMMAND_TYPES,
  hashProfessionalKnowledgeContent,
  hashProfessionalKnowledgeSourceSet,
  releasedSemanticMutationAllowed,
} from '../packages/domain/src/index.js';
import {
  createKnowledgeSuccessor,
  editKnowledgeCandidate,
} from '../apps/server/api/src/services/professional-knowledge.js';
import { createAdminPool } from './setup/db.js';

const admin = createAdminPool();
const appPool = new pg.Pool({ connectionString: process.env['DATABASE_URL'] });

afterAll(async () => {
  await appPool.end();
  await admin.end();
});

const scope = {
  product: 'V1' as const,
  sceneCode: 'DIGITAL_USE',
  scenePackageVersion: 'v-test',
  stages: ['ASSESSMENT'],
  ageBands: ['MINOR_14_17'] as const,
  applicability: ['sleep-impact'],
  exclusions: [],
  riskLevels: ['LOW'] as const,
  locale: 'zh-CN',
};

function source(label: string) {
  return {
    sourceRef: `source:${label}`,
    sourceVersion: '1',
    sourceHash: '1'.repeat(64),
    locator: null,
    metadata: {},
  };
}

async function seedPublishedPredecessor() {
  const tag = crypto.randomUUID();
  const account = await admin.query<{ id: string }>(
    'INSERT INTO accounts (wechat_openid) VALUES ($1) RETURNING id',
    [`slice17-mut-${tag}`]
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
  const item = await admin.query<{ id: string }>(
    `INSERT INTO professional_knowledge_items
       (knowledge_key, created_by_account_id, created_by_person_id)
     VALUES ($1,$2,$3) RETURNING id`,
    [`mut-${tag}`, accountId, personId]
  );
  const knowledgeId = item.rows[0]!.id;
  const predecessorContent = { body: 'published predecessor' };
  const predecessorSources = [source(`predecessor-${tag}`)];
  const contentHash = hashProfessionalKnowledgeContent(predecessorContent);
  const sourceSetHash = hashProfessionalKnowledgeSourceSet(predecessorSources);
  const version = await admin.query<{ id: string }>(
    `INSERT INTO professional_knowledge_versions
       (knowledge_id, semantic_version, lifecycle_status, review_state, validity_state,
        content, content_hash, source_set_hash, scope_metadata, locale,
        released_at, effective_from, created_by_account_id, created_by_person_id)
     VALUES ($1,'1.0.0','PUBLISHED','CURRENT','VALID',$2::jsonb,$3,$4,$5::jsonb,
             'zh-CN',now(),now(),$6,$7)
     RETURNING id`,
    [
      knowledgeId,
      JSON.stringify(predecessorContent),
      contentHash,
      sourceSetHash,
      JSON.stringify(scope),
      accountId,
      personId,
    ]
  );
  const predecessorVersionId = version.rows[0]!.id;
  await admin.query(
    `INSERT INTO professional_knowledge_sources
       (knowledge_version_id, knowledge_revision, ordinal, source_ref,
        source_version, source_hash, locator, snapshot_metadata)
     VALUES ($1,1,1,$2,$3,$4,$5,$6::jsonb)`,
    [
      predecessorVersionId,
      predecessorSources[0]!.sourceRef,
      predecessorSources[0]!.sourceVersion,
      predecessorSources[0]!.sourceHash,
      predecessorSources[0]!.locator,
      JSON.stringify(predecessorSources[0]!.metadata),
    ]
  );
  return {
    accountId,
    personId,
    assignmentId: staff.rows[0]!.id,
    knowledgeId,
    predecessorVersionId,
  };
}

describe('professional knowledge mutation commands', () => {
  it('registers every Knowledge mutation in the shared idempotency owner', () => {
    expect(IDEMPOTENCY_COMMAND_TYPES).toEqual(
      expect.arrayContaining([
        'PROFESSIONAL_KNOWLEDGE_CANDIDATE_CREATE',
        'PROFESSIONAL_KNOWLEDGE_SUCCESSOR_CREATE',
        'PROFESSIONAL_KNOWLEDGE_CANDIDATE_EDIT',
        'PROFESSIONAL_KNOWLEDGE_REVIEW_RECORD',
        'PROFESSIONAL_KNOWLEDGE_RELEASE',
        'PROFESSIONAL_KNOWLEDGE_RETIRE',
        'PROFESSIONAL_KNOWLEDGE_DEPENDENCY_PROPAGATE',
      ])
    );
    expect(hashPayload({ b: 2, a: 1 })).toBe(hashPayload({ a: 1, b: 2 }));
  });

  it('creates a successor exactly once, replays exactly, rejects mismatch, and reserves predecessor revision', async () => {
    const seeded = await seedPublishedPredecessor();
    const successorContent = { body: 'successor candidate' };
    const successorSources = [source(`successor-${crypto.randomUUID()}`)];
    const candidate = {
      semanticVersion: '1.1.0',
      content: successorContent,
      contentHash: hashProfessionalKnowledgeContent(successorContent),
      sourceSetHash: hashProfessionalKnowledgeSourceSet(successorSources),
      sources: successorSources,
      scope,
    };
    const idempotencyKey = `successor-${crypto.randomUUID()}`;

    const first = await createKnowledgeSuccessor({
      pool: appPool,
      accountId: seeded.accountId,
      personId: seeded.personId,
      assignmentId: seeded.assignmentId,
      idempotencyKey,
      knowledgeId: seeded.knowledgeId,
      predecessorVersionId: seeded.predecessorVersionId,
      expectedPredecessorRevision: 1,
      candidate,
    });
    expect(first.revision).toBe(1);

    const replay = await createKnowledgeSuccessor({
      pool: appPool,
      accountId: seeded.accountId,
      personId: seeded.personId,
      assignmentId: seeded.assignmentId,
      idempotencyKey,
      knowledgeId: seeded.knowledgeId,
      predecessorVersionId: seeded.predecessorVersionId,
      expectedPredecessorRevision: 1,
      candidate,
    });
    expect(replay).toEqual(first);

    await expect(
      createKnowledgeSuccessor({
        pool: appPool,
        accountId: seeded.accountId,
        personId: seeded.personId,
        assignmentId: seeded.assignmentId,
        idempotencyKey,
        knowledgeId: seeded.knowledgeId,
        predecessorVersionId: seeded.predecessorVersionId,
        expectedPredecessorRevision: 1,
        candidate: { ...candidate, semanticVersion: '1.2.0' },
      })
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'IDEMPOTENCY_PAYLOAD_MISMATCH',
    });

    const rows = await admin.query<{ n: string }>(
      `SELECT count(*)::text AS n
         FROM professional_knowledge_versions
        WHERE supersedes_version_id=$1`,
      [seeded.predecessorVersionId]
    );
    expect(Number(rows.rows[0]!.n)).toBe(1);

    const predecessor = await admin.query<{ revision: number; lifecycle_status: string }>(
      `SELECT revision, lifecycle_status
         FROM professional_knowledge_versions WHERE id=$1`,
      [seeded.predecessorVersionId]
    );
    expect(predecessor.rows[0]).toEqual({
      revision: 2,
      lifecycle_status: 'PUBLISHED',
    });

    await expect(
      createKnowledgeSuccessor({
        pool: appPool,
        accountId: seeded.accountId,
        personId: seeded.personId,
        assignmentId: seeded.assignmentId,
        idempotencyKey: `stale-successor-${crypto.randomUUID()}`,
        knowledgeId: seeded.knowledgeId,
        predecessorVersionId: seeded.predecessorVersionId,
        expectedPredecessorRevision: 1,
        candidate: { ...candidate, semanticVersion: '1.2.0' },
      })
    ).rejects.toMatchObject({ code: 'PROFESSIONAL_KNOWLEDGE_CONFLICT' });
  });

  it('candidate edit increments revision, exact-replays, rejects stale revision, and resets review/validity', async () => {
    const seeded = await seedPublishedPredecessor();
    const successorContent = { body: 'candidate-v1' };
    const successorSources = [source(`candidate-${crypto.randomUUID()}`)];
    const created = await createKnowledgeSuccessor({
      pool: appPool,
      accountId: seeded.accountId,
      personId: seeded.personId,
      assignmentId: seeded.assignmentId,
      idempotencyKey: `create-${crypto.randomUUID()}`,
      knowledgeId: seeded.knowledgeId,
      predecessorVersionId: seeded.predecessorVersionId,
      expectedPredecessorRevision: 1,
      candidate: {
        semanticVersion: '1.1.0',
        content: successorContent,
        contentHash: hashProfessionalKnowledgeContent(successorContent),
        sourceSetHash: hashProfessionalKnowledgeSourceSet(successorSources),
        sources: successorSources,
        scope,
      },
    });

    const editedContent = { body: 'candidate-v2' };
    const editedSources = [source(`edited-${crypto.randomUUID()}`)];
    const editKey = `edit-${crypto.randomUUID()}`;
    const editInput = {
      pool: appPool,
      accountId: seeded.accountId,
      personId: seeded.personId,
      assignmentId: seeded.assignmentId,
      idempotencyKey: editKey,
      versionId: created.versionId,
      expectedRevision: 1,
      content: editedContent,
      contentHash: hashProfessionalKnowledgeContent(editedContent),
      sourceSetHash: hashProfessionalKnowledgeSourceSet(editedSources),
      sources: editedSources,
      scope,
    };

    await expect(editKnowledgeCandidate(editInput)).resolves.toEqual({
      versionId: created.versionId,
      revision: 2,
    });
    await expect(editKnowledgeCandidate(editInput)).resolves.toEqual({
      versionId: created.versionId,
      revision: 2,
    });

    await expect(
      editKnowledgeCandidate({
        ...editInput,
        idempotencyKey: `stale-edit-${crypto.randomUUID()}`,
      })
    ).rejects.toMatchObject({ code: 'PROFESSIONAL_KNOWLEDGE_CONFLICT' });

    const state = await admin.query<{
      revision: number;
      lifecycle_status: string;
      review_state: string;
      validity_state: string;
    }>(
      `SELECT revision, lifecycle_status, review_state, validity_state
         FROM professional_knowledge_versions WHERE id=$1`,
      [created.versionId]
    );
    expect(state.rows[0]).toEqual({
      revision: 2,
      lifecycle_status: 'CANDIDATE',
      review_state: 'PENDING',
      validity_state: 'UNKNOWN',
    });
  });

  it('released semantic columns are immutable and must use a successor version', async () => {
    const content = { body: 'v1' };
    const sources = [source('immutable')];
    const before = {
      id: 'v1',
      knowledgeId: 'k1',
      knowledgeKey: 'k',
      semanticVersion: '1.0.0',
      revision: 2,
      lifecycleStatus: 'PUBLISHED' as const,
      reviewState: 'CURRENT' as const,
      validityState: 'VALID' as const,
      content,
      contentHash: hashProfessionalKnowledgeContent(content),
      sourceSetHash: hashProfessionalKnowledgeSourceSet(sources),
      sources,
      scope,
      releasedAt: '2026-11-01T00:00:00Z',
      effectiveFrom: null,
      effectiveTo: null,
    };
    expect(releasedSemanticMutationAllowed(before, { ...before, revision: 3 })).toBe(true);
    expect(
      releasedSemanticMutationAllowed(before, {
        ...before,
        content: { body: 'changed' },
        contentHash: '2'.repeat(64),
      })
    ).toBe(false);

    const seeded = await seedPublishedPredecessor();
    await expect(
      admin.query(
        `UPDATE professional_knowledge_versions
            SET content='{"body":"illegal overwrite"}'::jsonb,
                content_hash=$2,
                revision=revision+1
          WHERE id=$1`,
        [seeded.predecessorVersionId, '2'.repeat(64)]
      )
    ).rejects.toThrow(/PROFESSIONAL_KNOWLEDGE_RELEASED_SEMANTICS_IMMUTABLE/);
  });
});
