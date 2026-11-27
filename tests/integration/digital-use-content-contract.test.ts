import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import pg from 'pg';
import { buildApp } from '../../apps/server/api/src/app.js';
import { withRlsTransaction } from '../../apps/server/api/src/db/tx.js';
import {
  insertDigitalUseAssessmentTarget,
  recordStatement,
} from '@xiaoshuyin/domain';
import { resolveDigitalUseRuntimeNode } from '@xiaoshuyin/scenes/digital-use';
import { createAdminPool } from '../setup/db.js';
import {
  auth,
  commandHeaders,
  createFamily,
  createMember,
  loginWithLabel,
  type LoginResult,
} from '../setup/api.js';
import { createCase } from '../setup/participation.js';

interface Fixture {
  manager: LoginResult;
  familyId: string;
  caseId: string;
  caseVersion: number;
  targetPersonId: string;
}

describe('R07 Digital Use node content & mandatory target delivery', () => {
  let app: FastifyInstance;
  let admin: pg.Pool;
  let appDb: pg.Pool;
  let migrator: pg.Client;

  async function ensurePolicy(featureCode: string, reviewEvidenceRef: string): Promise<void> {
    // Suites share one test database and several publish the same feature codes.
    // Only publish when no current v1 policy exists, under an advisory lock.
    await migrator.query(
      `SELECT pg_advisory_lock(hashtextextended($1,0))`,
      ['r07-content-contract-policy']
    );
    try {
      const current = await migrator.query<{ n: number }>(
        `SELECT count(*)::int AS n
           FROM compliance_feature_policies
          WHERE feature_code=$1
            AND feature_contract_revision='v1'
            AND superseded_by_policy_id IS NULL`,
        [featureCode]
      );
      if ((current.rows[0]?.n ?? 0) === 0) {
        await migrator.query(
          `SELECT app.publish_compliance_feature_policy(
             $1,'v1',NULL,1,
             'NOT_APPLICABLE','BASELINE','BASELINE','BASELINE','BASELINE',
             'R07 content contract integration basis',$2,
             now() - interval '1 minute','migration:r07-content-contract'
           )`,
          [featureCode, reviewEvidenceRef]
        );
      }
    } finally {
      await migrator.query(
        `SELECT pg_advisory_unlock(hashtextextended($1,0))`,
        ['r07-content-contract-policy']
      );
    }
  }

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
    admin = createAdminPool();
    appDb = new pg.Pool({ connectionString: process.env['DATABASE_URL']! });
    migrator = new pg.Client({
      connectionString: process.env['MIGRATION_DATABASE_URL'],
    });
    await migrator.connect();
    await ensurePolicy(
      'DIGITAL_USE_ASSESSMENT_RUNTIME',
      'evidence://r07/assessment-target'
    );
    await ensurePolicy(
      'DIGITAL_USE_FAMILY_ALLIANCE_RUNTIME',
      'evidence://r07/integration'
    );
  });

  afterAll(async () => {
    // Remove only rows this suite published; other suites own their policies.
    await admin.query(
      `DELETE FROM compliance_feature_policies
        WHERE review_evidence_ref IN
              ('evidence://r07/assessment-target','evidence://r07/integration')`
    ).catch(() => undefined);
    await appDb.end().catch(() => undefined);
    await migrator.end().catch(() => undefined);
    await admin.end().catch(() => undefined);
    await app.close();
  });

  async function seedAssessmentEvidence(
    f: Fixture,
    emotion: readonly string[],
    family: string
  ): Promise<void> {
    await withRlsTransaction(
      appDb,
      {
        familyId: f.familyId,
        accountId: f.manager.accountId,
        personId: f.manager.personId,
        purpose: 'FAMILY_MANAGEMENT',
      },
      async (tx) => {
        const context = {
          familyId: f.familyId,
          caseId: f.caseId,
          actorAccountId: f.manager.accountId,
          actorPersonId: f.manager.personId,
          purpose: 'FAMILY_MANAGEMENT' as const,
        };
        await recordStatement(tx, context, {
          subjectPersonId: f.targetPersonId,
          sourceKind: 'OTHER_MEMBER_RELAY',
          sourcePersonId: f.manager.personId,
          occurredTimeState: 'UNKNOWN',
          confirmationStatus: 'UNCONFIRMED',
          content: `DUA:v1:01002.emotion:${JSON.stringify({
            state: 'KNOWN',
            selections: emotion,
          })}`,
        });
        await recordStatement(tx, context, {
          subjectPersonId: f.targetPersonId,
          sourceKind: 'OTHER_MEMBER_RELAY',
          sourcePersonId: f.manager.personId,
          occurredTimeState: 'UNKNOWN',
          confirmationStatus: 'UNCONFIRMED',
          content: `DUA:v1:01003.family_relationship:${JSON.stringify({
            state: 'KNOWN',
            selection: family,
          })}`,
        });
      }
    );
  }

  async function fixture(
    label: string,
    options: {
      emotion?: readonly string[];
      family?: string;
      withEvidence?: boolean;
      seedNodes?: readonly string[];
    } = {}
  ): Promise<Fixture> {
    const manager = await loginWithLabel(app, `r07-${label}`);
    const family = await createFamily(app, manager.token, `r07-${label}`);
    expect(family.statusCode, family.body).toBe(201);
    const familyId = family.json().id as string;
    const child = await createMember(app, manager.token, familyId, `r7-target-${label}`, {
      ageBand: 'MINOR_14_17',
      ageBandSource: 'OTHER_MEMBER_RELAY',
    });
    expect(child.statusCode, child.body).toBe(201);
    const targetPersonId = child.json().personId as string;

    const kase = await createCase(app, manager.token, `r07-${label}`);
    expect(kase.statusCode, kase.body).toBe(201);
    const caseId = kase.json().id as string;
    const caseVersion = kase.json().version as number;
    await withRlsTransaction(
      appDb,
      {
        familyId,
        accountId: manager.accountId,
        personId: manager.personId,
        purpose: 'FAMILY_MANAGEMENT',
      },
      (tx) => insertDigitalUseAssessmentTarget(tx, caseId, familyId, targetPersonId, manager.personId)
    );

    const message = await app.inject({
      method: 'POST',
      url: `/api/v1/cases/${caseId}/messages`,
      headers: commandHeaders(manager.token, `r07-msg-${label}`),
      payload: { content: 'Digital use is causing a current family problem.' },
    });
    expect(message.statusCode, message.body).toBe(201);
    const messageId = message.json().id as string;

    const a1001 = resolveDigitalUseRuntimeNode('A1001');
    const a2010 = resolveDigitalUseRuntimeNode('A2010');
    await admin.query('BEGIN');
    try {
      await admin.query(`UPDATE cases SET phase='GOALS' WHERE id=$1`, [caseId]);
      await admin.query(
        `INSERT INTO problem_formulations
           (family_id,case_id,version,status,primary_problem,key_factors,
            evidence_refs,unknowns,conflicts,scene_fit,alternative_explanations,
            reassessment_conditions,exit_conditions,user_response,
            confirmed_by_person_id,confirmed_at,dependency_refs,supersedes_version)
         VALUES
           ($1,$2,1,'CONFIRMED',$3::jsonb,'[]'::jsonb,$4::jsonb,
            '[]'::jsonb,'[]'::jsonb,'DIGITAL_USE','[]'::jsonb,'[]'::jsonb,
            '[]'::jsonb,$5::jsonb,$6,now(),'[]'::jsonb,NULL)`,
        [
          familyId,
          caseId,
          JSON.stringify({ text: 'Current digital-use family problem' }),
          JSON.stringify([{ type: 'DIALOGUE_MESSAGE', id: messageId }]),
          JSON.stringify({
            kind: 'CONFIRM',
            actorPersonId: manager.personId,
            respondedAt: new Date().toISOString(),
          }),
          manager.personId,
        ]
      );
      const seededCodes = [
        a1001.nodeCode,
        a2010.nodeCode,
        ...(options.seedNodes ?? []),
      ];
      for (const nodeCode of seededCodes) {
        const node = resolveDigitalUseRuntimeNode(nodeCode);
        await admin.query(
          `INSERT INTO scene_node_states
             (family_id,case_id,scene_package_version,node_code,source_node_code,
              status,branch_reason_codes,input_refs,output_refs,revision,completed_at)
           VALUES ($1,$2,'v1',$3,$4,'COMPLETED',ARRAY['R07_FIXTURE'],
                   '[]'::jsonb,'[]'::jsonb,1,now())`,
          [familyId, caseId, node.nodeCode, node.sourceNodeCode]
        );
      }
      await admin.query('COMMIT');
    } catch (error) {
      await admin.query('ROLLBACK');
      throw error;
    }

    const f = { manager, familyId, caseId, caseVersion, targetPersonId };
    if (options.withEvidence !== false) {
      await seedAssessmentEvidence(f, options.emotion ?? ['A'], options.family ?? 'A');
    }
    return f;
  }

  async function getScene(f: Fixture) {
    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/cases/${f.caseId}/scene`,
      headers: auth(f.manager.token),
    });
    expect(response.statusCode, response.body).toBe(200);
    return response.json();
  }

  async function respond(
    f: Fixture,
    nodeCode: string,
    response: Record<string, unknown>,
    extra: Record<string, unknown> = {},
    key = `r07-${nodeCode.toLowerCase()}-${crypto.randomUUID()}`
  ) {
    const scene = await getScene(f);
    const node = scene.nodes.find((item: any) => item.nodeCode === nodeCode);
    const expectedNodeRevision = node?.revision ?? 0;
    return app.inject({
      method: 'POST',
      url: `/api/v1/cases/${f.caseId}/scene/nodes/${nodeCode}/responses`,
      headers: {
        ...auth(f.manager.token),
        'idempotency-key': key,
      },
      payload: {
        targetPersonId: f.targetPersonId,
        expectedCaseVersion: f.caseVersion,
        expectedNodeRevision,
        expectedScenePackageVersion: 'v1',
        response,
        ...extra,
      },
    });
  }

  async function getNode(f: Fixture, nodeCode: string, token = f.manager.token) {
    return app.inject({
      method: 'GET',
      url: `/api/v1/cases/${f.caseId}/scene/nodes/${nodeCode}`,
      headers: auth(token),
    });
  }

  async function catalogOf(f: Fixture, token = f.manager.token) {
    const response = await getNode(f, 'A3002', token);
    expect(response.statusCode, response.body).toBe(200);
    return response.json().targetCatalog;
  }

  async function contentOf(f: Fixture, nodeCode: string, token = f.manager.token) {
    const response = await getNode(f, nodeCode, token);
    expect(response.statusCode, `${nodeCode}: ${response.body}`).toBe(200);
    return response.json().content;
  }

  function selfAssessment(answer: 'YES' | 'NO' = 'YES') {
    return {
      kind: 'SELF_ASSESSMENT',
      answers: {
        emotionAttention: answer,
        negotiatedAgreement: answer,
        trustsAgreement: answer,
        familyCoordination: answer,
        parentEmotionFluctuation: answer,
        keepsPromises: answer,
      },
    };
  }

  async function completeA3000(f: Fixture) {
    const a3000 = await respond(f, 'A3000', selfAssessment('YES'));
    expect(a3000.statusCode, a3000.body).toBe(200);
  }

  it('R07-CAT-01 delivers the ten canonical targets with a Case-specific mandatory judgment', async () => {
    const f = await fixture('cat-resolved', { emotion: ['B'], family: 'D' });
    await completeA3000(f);
    const catalog = await catalogOf(f);

    expect(catalog.mandatoryStatus).toBe('RESOLVED');
    expect(catalog.guidance).toMatchObject({
      code: 'MANDATORY_TARGETS_UNSELECTED',
      missingMandatoryTargets: [
        'EMOTION_REGULATION_1',
        'TIME_MANAGEMENT',
        'FAMILY_RELATIONSHIP',
      ],
      requiredSelection: 'MULTI',
    });
    expect(catalog.missing).toEqual([]);
    expect(catalog.targets.map((target: any) => target.code)).toEqual([
      'SLEEP',
      'EXERCISE',
      'HOBBIES',
      'CHORES',
      'FAMILY_GATHERING',
      'OUTDOOR_ACTIVITY',
      'EMOTION_REGULATION_1',
      'TIME_MANAGEMENT',
      'FAMILY_RELATIONSHIP',
      'EMOTION_REGULATION_2',
    ]);

    const mandatory = catalog.targets
      .filter((target: any) => target.mandatory)
      .map((target: any) => target.code)
      .sort();
    expect(mandatory).toEqual([
      'EMOTION_REGULATION_1',
      'FAMILY_RELATIONSHIP',
      'TIME_MANAGEMENT',
    ]);
    for (const target of catalog.targets) {
      expect(target.selected, target.code).toBe(false);
      expect(target.targetRevision, target.code).toBeNull();
    }

    expect(catalog.authority.authorityDocument).toBe('Docs/V1产品需求.md');
    expect(catalog.authority.sourceBlob).toBe(
      '379cb8cfb377924cd21ccfe55baa5aecdf207f5e'
    );
    expect(catalog.catalogVersion).toBe('family-alliance-target-catalog-v1');
  });

  it('R07-CAT-02 guides unselected mandatory targets and clears guidance after a legal selection', async () => {
    const f = await fixture('cat-guidance', { emotion: ['B'], family: 'A' });
    await completeA3000(f);

    const initial = await catalogOf(f);
    expect(initial.guidance).toMatchObject({
      code: 'MANDATORY_TARGETS_UNSELECTED',
      missingMandatoryTargets: ['EMOTION_REGULATION_1'],
      requiredSelection: 'MULTI',
    });

    const blocked = await respond(
      f,
      'A3002',
      { kind: 'TARGET_SELECTION', confirmed: true, selectedTargets: ['SLEEP'] },
      { expectedSelectionRevision: 0 }
    );
    expect(blocked.statusCode, blocked.body).toBe(422);
    expect(blocked.json().code).toBe('TARGET_SELECTION_INVALID');

    const accepted = await respond(
      f,
      'A3002',
      {
        kind: 'TARGET_SELECTION',
        confirmed: true,
        selectedTargets: ['SLEEP', 'EMOTION_REGULATION_1'],
      },
      { expectedSelectionRevision: 0 }
    );
    expect(accepted.statusCode, accepted.body).toBe(200);

    const catalog = await catalogOf(f);
    expect(catalog.guidance).toBeNull();
    expect(catalog.selectionRevision).toBeGreaterThan(0);
    const er1 = catalog.targets.find((target: any) => target.code === 'EMOTION_REGULATION_1');
    const sleep = catalog.targets.find((target: any) => target.code === 'SLEEP');
    expect(er1).toMatchObject({ mandatory: true, selected: true });
    expect(er1.targetRevision).toEqual(expect.any(Number));
    expect(sleep).toMatchObject({ mandatory: false, selected: true });
  });

  it('R07-CAT-03 reports UNAVAILABLE rather than failing when triage evidence is absent', async () => {
    const f = await fixture('cat-unavailable', { withEvidence: false });
    await completeA3000(f);
    const catalog = await catalogOf(f);

    expect(catalog.mandatoryStatus).toBe('UNAVAILABLE');
    expect(catalog.guidance).toBeNull();
    expect(catalog.targets).toHaveLength(10);
    for (const target of catalog.targets) {
      expect(target.mandatory, target.code).toBeNull();
      expect(target.selected, target.code).toBe(false);
    }
    expect(catalog.missing).toHaveLength(1);
    expect(catalog.missing[0].contentKind).toBe('INTEGRATED_TRIAGE_EVIDENCE');
  });

  it('R07-CAT-04 keeps targetCatalog off non-A3002 node reads', async () => {
    const f = await fixture('cat-scope');
    const a1001 = await getNode(f, 'A1001');
    expect(a1001.statusCode, a1001.body).toBe(200);
    expect(a1001.json().targetCatalog).toBeNull();
    expect(a1001.json().content.nodeCode).toBe('A1001');
  });

  it('R07-CONTENT-01 delivers the frozen A3002 target-selection question with legal values', async () => {
    const f = await fixture('content-a3002');
    await completeA3000(f);
    const content = await contentOf(f, 'A3002');

    expect(content).toMatchObject({
      nodeCode: 'A3002',
      availability: 'AVAILABLE',
      authorityKind: 'PRODUCT_FROZEN',
      body: null,
    });
    expect(content.provenance.sourceBlob).toBe(
      '379cb8cfb377924cd21ccfe55baa5aecdf207f5e'
    );
    expect(content.question).toMatchObject({
      selection: 'MULTI',
      submissionKind: 'TARGET_SELECTION',
      minSelections: 0,
      maxSelections: 10,
    });
    expect(content.question.text).toContain('目标清单');
    expect(content.question.options.map((option: any) => option.value)).toEqual([
      'SLEEP',
      'EXERCISE',
      'HOBBIES',
      'CHORES',
      'FAMILY_GATHERING',
      'OUTDOOR_ACTIVITY',
      'EMOTION_REGULATION_1',
      'TIME_MANAGEMENT',
      'FAMILY_RELATIONSHIP',
      'EMOTION_REGULATION_2',
    ]);
    expect(content.missing).toEqual([]);
  });

  it('R07-CONTENT-02 delivers the ten target pages from frozen product text', async () => {
    const targetPages = [
      'A3010',
      'A3020',
      'A3040',
      'A3050',
      'A3060',
      'A3070',
      'A3080',
      'A3090',
      'A3100',
      'A3110',
    ];
    const f = await fixture('content-pages', { seedNodes: targetPages });

    const sleep = await contentOf(f, 'A3010');
    expect(sleep.availability).toBe('AVAILABLE');
    expect(sleep.body).toContain('改善睡眠包括睡眠卫生教育和睡眠习惯养成两个部分');
    expect(sleep.provenance.sectionHeading).toBe('### 改善睡眠。');

    const er1 = await contentOf(f, 'A3080');
    expect(er1.body).toContain('适合家长和孩子之间偶尔有冲突');

    const timeManagement = await contentOf(f, 'A3090');
    expect(timeManagement).toMatchObject({
      availability: 'AVAILABLE',
      body: null,
      question: null,
    });
    expect(timeManagement.provenance.sectionHeading).toBe('**时间管理。**');

    for (const nodeCode of targetPages) {
      const content = await contentOf(f, nodeCode);
      expect(content.availability, nodeCode).toBe('AVAILABLE');
      expect(content.authorityKind, nodeCode).toBe('PRODUCT_FROZEN');
    }
  });

  it('R07-CONTENT-03 fails closed for professional questionnaire nodes with an exact missing list', async () => {
    const f = await fixture('content-professional');
    const content = await contentOf(f, 'A1001');
    expect(content.availability).toBe('UNAVAILABLE');
    expect(content.authorityKind).toBeNull();
    expect(content.provenance).toBeNull();
    expect(content.body).toBeNull();
    expect(content.question).toBeNull();
    expect(content.missing.map((item: any) => item.contentKind)).toEqual([
      'PROFESSIONAL_APPROVED_CONTENT',
      'APPROVED_CONTENT_VERSION',
    ]);
  });

  it('R07-CONTENT-04 fails closed for unregistered structured nodes and rejects unknown nodes', async () => {
    const f = await fixture('content-unregistered', { seedNodes: ['A3011', 'A3012'] });
    for (const nodeCode of ['A2010', 'A3011', 'A3012']) {
      const content = await contentOf(f, nodeCode);
      expect(content.availability, nodeCode).toBe('UNAVAILABLE');
      expect(content.missing.map((item: any) => item.contentKind), nodeCode).toEqual([
        'NODE_CONTENT_NOT_REGISTERED',
      ]);
    }

    const unknown = await getNode(f, 'A200401');
    expect(unknown.statusCode, unknown.body).toBe(404);
    expect(unknown.json().code).toBe('SCENE_NODE_NOT_FOUND');
  });

  it('R07-AUTH-01 denies the enriched node read to a non-member', async () => {
    const f = await fixture('content-auth');
    const outsider = await loginWithLabel(app, 'r07-outsider');
    const otherFamily = await createFamily(app, outsider.token, 'r07-outsider');
    expect(otherFamily.statusCode, otherFamily.body).toBe(201);

    const response = await getNode(f, 'A3002', outsider.token);
    expect(response.statusCode, response.body).toBe(404);
    expect(response.json().code).toBe('CASE_NOT_FOUND');
  });
});
