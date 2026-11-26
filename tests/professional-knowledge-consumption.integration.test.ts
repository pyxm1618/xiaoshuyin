import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { buildApp } from '../apps/server/api/src/app.js';
import { consumeProfessionalKnowledge, type ProfessionalKnowledgeConsumptionDependencies } from '../apps/server/api/src/services/professional-knowledge-consumption.js';
import { createAdminPool } from './setup/db.js';
import { createSafetyFixture, type SafetyFixture } from './setup/safety.js';
import { createConsentRequest, createMember, grantConsent, revokeConsent } from './setup/api.js';
import { authorize } from '../packages/authorization/src/authorize.js';

function decision(overrides: Record<string, unknown> = {}) {
  return authorize({
    actor: { accountId: 'a1', personId: 'p1' },
    product: 'V1',
    family: { familyId: 'f1' },
    case: { caseId: 'c1' },
    resource: { type: 'CASE', familyId: 'f1', caseId: 'c1' },
    action: 'CASE_READ_PROFESSIONAL_KNOWLEDGE',
    purpose: 'PROFESSIONAL_KNOWLEDGE_CONSUMPTION',
    facts: {
      membership: true,
      familyCreatedByPersonId: 'p1',
      actorAgeBand: 'ADULT',
      guardianPersonId: null,
      targetIsFamilyMember: false,
      familyId: 'f1',
    },
    ...overrides,
  } as any);
}

describe('family Professional Knowledge consumption authorization', () => {
  it('allows only exact Family/Case manager consumption context', () => {
    expect(decision().decision).toBe('ALLOW');
  });

  it.each([
    ['wrong purpose', { purpose: 'FAMILY_MANAGEMENT' }],
    ['wrong family', { resource: { type: 'CASE', familyId: 'f2', caseId: 'c1' } }],
    ['wrong case', { resource: { type: 'CASE', familyId: 'f1', caseId: 'c2' } }],
    ['missing case', { case: null }],
  ])('fails closed for %s', (_label, patch) => {
    expect(decision(patch).decision).toBe('DENY');
  });

  it('does not grant any Professional Knowledge administration action', () => {
    expect(
      authorize({
        actor: { accountId: 'a1', personId: 'p1' },
        product: 'V1',
        family: { familyId: 'f1' },
        case: null,
        resource: { type: 'FAMILY', familyId: 'f1' },
        action: 'MEMBER_UPDATE',
        purpose: 'PROFESSIONAL_KNOWLEDGE_CONSUMPTION',
        facts: {
          membership: true,
          familyCreatedByPersonId: 'p1',
          actorAgeBand: 'ADULT',
          guardianPersonId: null,
          targetIsFamilyMember: true,
          familyId: 'f1',
        },
      }).decision
    ).toBe('DENY');
  });
});


describe('family Professional Knowledge consumption full gate composition', () => {
  const featureCode = 'PROFESSIONAL_KNOWLEDGE_CONSUMPTION';
  let app: Awaited<ReturnType<typeof buildApp>>;
  let admin: pg.Pool;
  let fixture: SafetyFixture;
  let migrator: pg.Client;
  let owner: Awaited<ReturnType<SafetyFixture['login']>>;
  let outsider: Awaited<ReturnType<SafetyFixture['login']>>;
  let familyId = '';
  let caseId = '';
  let targetPersonId = '';
  let consentId = '';
  let under14PersonId = '';
  let knowledgeId = '';
  let versionId = '';
  let contentHash = '';
  let sourceSetHash = '';
  let policyVersion = 0;

  async function publishPolicy(applicability: 'NOT_APPLICABLE' | 'UNKNOWN') {
    const expected = policyVersion === 0 ? null : policyVersion;
    policyVersion += 1;
    await migrator.query(
      'SELECT app.publish_compliance_feature_policy($1,\'v1\',$2,$3,$4,\'BASELINE\',\'BASELINE\',\'BASELINE\',\'BASELINE\',$5,$6,now() - interval \'1 second\',\'migration:slice17-consumption-test\')',
      [
        featureCode,
        expected,
        policyVersion,
        applicability,
        applicability === 'UNKNOWN' ? null : 'Slice 17 reviewed test basis',
        applicability === 'UNKNOWN' ? null : 'evidence://slice17/consumption',
      ]
    );
  }

  function deps(
    overrides: Partial<ProfessionalKnowledgeConsumptionDependencies> = {}
  ): ProfessionalKnowledgeConsumptionDependencies {
    return {
      async resolveApproval() {
        return { status: 'VALID', proof: {} as never };
      },
      async resolveEligibilityFacts() {
        return {
          stage: 'ASSESSMENT',
          ageBand: 'MINOR_14_17',
          locale: 'zh-CN',
          applicabilityFacts: ['sleep-impact'],
          exclusionFacts: [],
          riskLevel: 'LOW',
        };
      },
      resolveSceneBinding(scenePackageVersion) {
        return {
          status: 'RESOLVED',
          sceneCode: 'DIGITAL_USE',
          scenePackageVersion,
          refs: [{
            knowledgeId,
            semanticVersion: '1.0.0',
            contentHash,
            sourceSetHash,
          }],
        };
      },
      ...overrides,
    };
  }

  async function createKnowledge(input: {
    lifecycle?: 'CANDIDATE' | 'PUBLISHED' | 'RETIRED';
    reviewState?: 'PENDING' | 'CURRENT' | 'NEEDS_REVIEW';
    validityState?: 'UNKNOWN' | 'VALID' | 'INVALID';
    scenePackageVersion?: string;
  } = {}) {
    const key = 'consume-' + crypto.randomUUID();
    const item = await admin.query<{ id: string }>(
      'INSERT INTO professional_knowledge_items (knowledge_key, created_by_account_id, created_by_person_id) VALUES ($1,$2,$3) RETURNING id',
      [key, owner.accountId, owner.personId]
    );
    const lifecycle = input.lifecycle ?? 'PUBLISHED';
    const releasedAt = lifecycle === 'CANDIDATE' ? null : new Date('2026-11-01T00:00:00Z');
    const ch = 'a'.repeat(64);
    const sh = 'b'.repeat(64);
    const scope = {
      product: 'V1',
      sceneCode: 'DIGITAL_USE',
      scenePackageVersion: input.scenePackageVersion ?? 'v-test',
      stages: ['ASSESSMENT'],
      ageBands: ['MINOR_14_17'],
      applicability: ['sleep-impact'],
      exclusions: ['acute-risk'],
      riskLevels: ['LOW'],
      locale: 'zh-CN',
    };
    const version = await admin.query<{ id: string }>(
      'INSERT INTO professional_knowledge_versions (knowledge_id, semantic_version, lifecycle_status, review_state, validity_state, content, content_hash, source_set_hash, scope_metadata, locale, released_at, effective_from, created_by_account_id, created_by_person_id) VALUES ($1,\'1.0.0\',$2,$3,$4,$5::jsonb,$6,$7,$8::jsonb,\'zh-CN\',$9,$9,$10,$11) RETURNING id',
      [
        item.rows[0]!.id,
        lifecycle,
        input.reviewState ?? 'CURRENT',
        input.validityState ?? 'VALID',
        JSON.stringify({ body: 'bounded professional knowledge' }),
        ch,
        sh,
        JSON.stringify(scope),
        releasedAt,
        owner.accountId,
        owner.personId,
      ]
    );
    await admin.query(
      'INSERT INTO professional_knowledge_sources (knowledge_version_id, knowledge_revision, ordinal, source_ref, source_version, source_hash, snapshot_metadata) VALUES ($1,1,1,$2,\'1\',$3,\'{}\'::jsonb)',
      [version.rows[0]!.id, 'source:' + key, 'c'.repeat(64)]
    );
    return {
      knowledgeId: item.rows[0]!.id,
      versionId: version.rows[0]!.id,
      contentHash: ch,
      sourceSetHash: sh,
    };
  }

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
    admin = createAdminPool();
    fixture = createSafetyFixture({
      app,
      admin,
      prefix: 'S17CON_' + Date.now() + '_',
      displayLabel: 'S17CON',
    });
    migrator = new pg.Client({ connectionString: process.env['MIGRATION_DATABASE_URL'] });
    await migrator.connect();

    owner = await fixture.login('owner');
    outsider = await fixture.login('outsider');
    familyId = await fixture.createFamily(owner, 'main');
    await fixture.createFamily(outsider, 'other');
    caseId = (await fixture.createCase(owner, 'case')).id;

    const request = await createConsentRequest(app, owner.token, 's17-consume');
    expect(request.statusCode).toBe(201);
    const grant = await grantConsent(app, owner.token, 's17-consume', request.json().requestId);
    expect(grant.statusCode).toBe(201);
    consentId = grant.json().id as string;

    const member = await createMember(app, owner.token, familyId, 's17-child', {
      ageBand: 'UNDER_14',
      ageBandSource: 'GUARDIAN_RELAY',
      guardianConsentId: consentId,
    });
    expect(member.statusCode).toBe(201);
    under14PersonId = member.json().personId as string;

    const teen = await createMember(app, owner.token, familyId, 's17-teen', {
      ageBand: 'MINOR_14_17',
      ageBandSource: 'OTHER_MEMBER_RELAY',
    });
    expect(teen.statusCode, teen.body).toBe(201);
    targetPersonId = teen.json().personId as string;

    await publishPolicy('NOT_APPLICABLE');

    const knowledge = await createKnowledge();
    knowledgeId = knowledge.knowledgeId;
    versionId = knowledge.versionId;
    contentHash = knowledge.contentHash;
    sourceSetHash = knowledge.sourceSetHash;
  }, 120_000);

  afterAll(async () => {
    await admin?.query('DELETE FROM professional_knowledge_approval_evidence WHERE knowledge_version_id IN (SELECT id FROM professional_knowledge_versions WHERE created_by_account_id=$1)', [owner?.accountId]).catch(() => undefined);
    await admin?.query('DELETE FROM professional_knowledge_review_evidence WHERE knowledge_version_id IN (SELECT id FROM professional_knowledge_versions WHERE created_by_account_id=$1)', [owner?.accountId]).catch(() => undefined);
    await admin?.query('DELETE FROM professional_knowledge_sources WHERE knowledge_version_id IN (SELECT id FROM professional_knowledge_versions WHERE created_by_account_id=$1)', [owner?.accountId]).catch(() => undefined);
    await admin?.query('DELETE FROM professional_knowledge_versions WHERE created_by_account_id=$1', [owner?.accountId]).catch(() => undefined);
    await admin?.query('DELETE FROM professional_knowledge_items WHERE created_by_account_id=$1', [owner?.accountId]).catch(() => undefined);
    await admin?.query('UPDATE compliance_feature_policies SET superseded_by_policy_id=NULL WHERE feature_code=$1', [featureCode]).catch(() => undefined);
    await admin?.query('DELETE FROM compliance_feature_policies WHERE feature_code=$1', [featureCode]).catch(() => undefined);
    await migrator?.end().catch(() => undefined);
    await fixture?.cleanup();
    await fixture?.close();
    await admin?.end().catch(() => undefined);
    await app?.close();
  }, 120_000);

  it('delivers only an authorized exact eligible version with Consent Compliance and Safety passing', async () => {
    const result = await consumeProfessionalKnowledge({
      pool: fixture.pool,
      actor: { accountId: owner.accountId, personId: owner.personId },
      familyId,
      caseId,
      targetPersonId,
      versionId,
      dependencies: deps(),
    });
    expect(result).toEqual({
      versionId,
      semanticVersion: '1.0.0',
      content: { body: 'bounded professional knowledge' },
    });
  });

  it('collapses wrong Family Case and protected asset state into one non-enumerating denial', async () => {
    const candidate = await createKnowledge({
      lifecycle: 'CANDIDATE',
      reviewState: 'PENDING',
      validityState: 'UNKNOWN',
    });
    const needsReview = await createKnowledge({
      lifecycle: 'PUBLISHED',
      reviewState: 'NEEDS_REVIEW',
      validityState: 'VALID',
    });
    const retired = await createKnowledge({ lifecycle: 'RETIRED' });

    for (const protectedVersionId of [
      crypto.randomUUID(),
      candidate.versionId,
      needsReview.versionId,
      retired.versionId,
    ]) {
      await expect(
        consumeProfessionalKnowledge({
          pool: fixture.pool,
          actor: { accountId: outsider.accountId, personId: outsider.personId },
          familyId,
          caseId,
          targetPersonId,
          versionId: protectedVersionId,
          dependencies: deps(),
        })
      ).rejects.toMatchObject({ statusCode: 404, code: 'RESOURCE_NOT_FOUND' });
    }

    await expect(
      consumeProfessionalKnowledge({
        pool: fixture.pool,
        actor: { accountId: owner.accountId, personId: owner.personId },
        familyId,
        caseId: crypto.randomUUID(),
        targetPersonId,
        versionId,
        dependencies: deps(),
      })
    ).rejects.toMatchObject({ statusCode: 404, code: 'RESOURCE_NOT_FOUND' });
  });

  it('Compliance restriction blocks delivery even when Knowledge metadata claims an age match', async () => {
    await publishPolicy('UNKNOWN');
    await expect(
      consumeProfessionalKnowledge({
        pool: fixture.pool,
        actor: { accountId: owner.accountId, personId: owner.personId },
        familyId,
        caseId,
        targetPersonId,
        versionId,
        dependencies: deps(),
      })
    ).rejects.toMatchObject({ statusCode: 403, code: 'COMPLIANCE_BLOCKED' });
    await publishPolicy('NOT_APPLICABLE');
  });

  it('Safety Hold blocks delivery without Knowledge changing Safety truth', async () => {
    await fixture.setCaseStatus(caseId, 'SAFETY_HOLD');
    await expect(
      consumeProfessionalKnowledge({
        pool: fixture.pool,
        actor: { accountId: owner.accountId, personId: owner.personId },
        familyId,
        caseId,
        targetPersonId,
        versionId,
        dependencies: deps(),
      })
    ).rejects.toMatchObject({ statusCode: 403, code: 'SAFETY_HOLD_BLOCKED' });
    expect((await fixture.getCase(caseId)).status).toBe('SAFETY_HOLD');
    await fixture.setCaseStatus(caseId, 'OPEN');
  });

  it('Consent withdrawal blocks downstream processing without mutating generic Knowledge history', async () => {
    const before = await admin.query(
      'SELECT lifecycle_status, content_hash, source_set_hash FROM professional_knowledge_versions WHERE id=$1',
      [versionId]
    );
    const revoke = await revokeConsent(app, owner.token, 's17-consume', consentId);
    expect(revoke.statusCode).toBe(200);

    await expect(
      consumeProfessionalKnowledge({
        pool: fixture.pool,
        actor: { accountId: owner.accountId, personId: owner.personId },
        familyId,
        caseId,
        targetPersonId: under14PersonId,
        versionId,
        dependencies: deps(),
      })
    ).rejects.toMatchObject({ statusCode: 403, code: 'COMPLIANCE_BLOCKED' });

    const after = await admin.query(
      'SELECT lifecycle_status, content_hash, source_set_hash FROM professional_knowledge_versions WHERE id=$1',
      [versionId]
    );
    expect(after.rows).toEqual(before.rows);
  });

  it('keeps dependency failure truthful rather than collapsing infrastructure into 404', async () => {
    await expect(
      consumeProfessionalKnowledge({
        pool: fixture.pool,
        actor: { accountId: owner.accountId, personId: owner.personId },
        familyId,
        caseId,
        targetPersonId: owner.personId,
        versionId,
        dependencies: deps({
          async resolveApproval() {
            return { status: 'UNAVAILABLE', dependency: 'PROVIDER_TIMEOUT' };
          },
        }),
      })
    ).rejects.toMatchObject({
      statusCode: 503,
      code: 'DEPENDENCY_UNAVAILABLE',
      dependency: 'PROVIDER_TIMEOUT',
    });
  });

  it('propagates a wrapped connection failure that merely mentions FAMILY_MEMBERSHIP_REQUIRED (Finding #22)', async () => {
    const connectionFailure = Object.assign(
      new Error('FAMILY_MEMBERSHIP_REQUIRED in a wrapped transport error'),
      { code: '08006' }
    );
    let observed: unknown;
    try {
      await consumeProfessionalKnowledge({
        pool: fixture.pool,
        actor: { accountId: owner.accountId, personId: owner.personId },
        familyId,
        caseId,
        // Actor == target keeps this case independent of the consent state
        // mutated by earlier cases in this file.
        targetPersonId: owner.personId,
        versionId,
        dependencies: deps({
          async resolveApproval() {
            throw new Error('query failed', { cause: connectionFailure });
          },
        }),
      });
    } catch (error) {
      observed = error;
    }

    // Not translated into the non-enumerating 404 business denial.
    expect(observed).toBeInstanceOf(Error);
    expect((observed as { statusCode?: unknown }).statusCode).toBeUndefined();
    expect((observed as { code?: unknown }).code).toBeUndefined();
  });

  it('still maps a genuine SQLSTATE 42501 RLS denial to the business denial (Finding #22)', async () => {
    await expect(
      consumeProfessionalKnowledge({
        pool: fixture.pool,
        actor: { accountId: owner.accountId, personId: owner.personId },
        familyId,
        caseId,
        targetPersonId: owner.personId,
        versionId,
        dependencies: deps({
          async resolveApproval() {
            throw Object.assign(new Error('FAMILY_MEMBERSHIP_REQUIRED'), {
              code: '42501',
            });
          },
        }),
      })
    ).rejects.toMatchObject({ statusCode: 404, code: 'RESOURCE_NOT_FOUND' });
  });
});
