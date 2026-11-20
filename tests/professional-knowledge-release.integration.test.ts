import { afterAll, describe, expect, it } from 'vitest';
import { createAdminPool } from './setup/db.js';
import { withTransactionClient } from '../apps/server/api/src/db/tx.js';
import {
  releaseProfessionalKnowledgeVersion,
  retireProfessionalKnowledgeVersion,
} from '../packages/domain/src/professional-knowledge-repository.js';
import {
  unavailableProductionProfessionalApprovalProvider,
} from '../apps/server/api/src/services/professional-knowledge.js';

const admin = createAdminPool();

async function seedCandidate(reviewState = 'CURRENT', validityState = 'VALID') {
  const tag = crypto.randomUUID();
  const account = await admin.query<{ id: string }>(
    `INSERT INTO accounts (wechat_openid) VALUES ($1) RETURNING id`,
    [`slice17-release-${tag}`]
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
    [`release-${tag}`, accountId, personId]
  );
  const version = await admin.query<{ id: string; revision: number }>(
    `INSERT INTO professional_knowledge_versions
       (knowledge_id, semantic_version, review_state, validity_state,
        content, content_hash, source_set_hash, scope_metadata, locale,
        created_by_account_id, created_by_person_id)
     VALUES ($1,'1.0.0',$2,$3,'{}'::jsonb,$4,$5,'{}'::jsonb,'zh-CN',$6,$7)
     RETURNING id, revision`,
    [item.rows[0]!.id, reviewState, validityState, 'a'.repeat(64), 'b'.repeat(64), accountId, personId]
  );
  return { accountId, personId, versionId: version.rows[0]!.id, revision: version.rows[0]!.revision };
}

afterAll(async () => {
  await admin.end();
});

describe('Professional Knowledge atomic release', () => {
  it('production-default approval remains unavailable', async () => {
    await expect(unavailableProductionProfessionalApprovalProvider.revalidate({
      proofId: 'p', knowledgeId: 'k', semanticVersion: '1.0.0',
      contentHash: 'a'.repeat(64), sourceSetHash: 'b'.repeat(64),
    })).resolves.toEqual({ status: 'UNAVAILABLE', reason: 'PROVIDER_UNAVAILABLE' });
  });

  it('rolls back lifecycle and audit together on transaction failure', async () => {
    const seeded = await seedCandidate();
    await expect(
      withTransactionClient(admin, async (tx) => {
        await releaseProfessionalKnowledgeVersion(tx, {
          versionId: seeded.versionId,
          expectedRevision: seeded.revision,
          effectiveFrom: new Date('2026-11-17T00:00:00Z'),
        });
        await tx.query(
          `INSERT INTO business_audit_events
             (family_id, actor_account_id, event_type, resource_type, resource_id, metadata)
           VALUES (NULL,$1,'PROFESSIONAL_KNOWLEDGE_RELEASED',
                   'PROFESSIONAL_KNOWLEDGE',$2,'{}'::jsonb)`,
          [seeded.accountId, seeded.versionId]
        );
        throw new Error('synthetic transaction abort');
      })
    ).rejects.toThrow('synthetic transaction abort');

    const state = await admin.query<{ lifecycle_status: string; revision: number }>(
      'SELECT lifecycle_status, revision FROM professional_knowledge_versions WHERE id = $1',
      [seeded.versionId]
    );
    expect(state.rows[0]).toEqual({ lifecycle_status: 'CANDIDATE', revision: 1 });
    const audit = await admin.query(
      `SELECT 1 FROM business_audit_events
        WHERE resource_type='PROFESSIONAL_KNOWLEDGE' AND resource_id=$1`,
      [seeded.versionId]
    );
    expect(audit.rowCount).toBe(0);
  });

  it('serializes two releases with revision CAS; there is no last-write-wins', async () => {
    const seeded = await seedCandidate();
    await expect(
      releaseProfessionalKnowledgeVersion(admin as any, {
        versionId: seeded.versionId,
        expectedRevision: 1,
        effectiveFrom: new Date('2026-11-17T00:00:00Z'),
      })
    ).resolves.toBe(2);
    await expect(
      releaseProfessionalKnowledgeVersion(admin as any, {
        versionId: seeded.versionId,
        expectedRevision: 1,
        effectiveFrom: new Date('2026-11-17T00:00:00Z'),
      })
    ).rejects.toMatchObject({ code: 'PROFESSIONAL_KNOWLEDGE_CONFLICT' });
  });

  it('serializes release vs retire on the same revision', async () => {
    const seeded = await seedCandidate();
    await expect(
      retireProfessionalKnowledgeVersion(admin as any, {
        versionId: seeded.versionId, expectedRevision: 1,
      })
    ).resolves.toBe(2);
    await expect(
      releaseProfessionalKnowledgeVersion(admin as any, {
        versionId: seeded.versionId, expectedRevision: 1,
        effectiveFrom: new Date('2026-11-17T00:00:00Z'),
      })
    ).rejects.toMatchObject({ code: 'PROFESSIONAL_KNOWLEDGE_CONFLICT' });
  });
});
