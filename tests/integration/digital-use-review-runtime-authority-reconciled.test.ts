import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import pg from 'pg';
import { buildApp } from '../../apps/server/api/src/app.js';
import { withRlsTransaction } from '../../apps/server/api/src/db/tx.js';
import { insertDigitalUseAssessmentTarget } from '@xiaoshuyin/domain';
import { recordStatement } from '@xiaoshuyin/domain';
import {
  buildConsentEvidence,
  getAcceptanceTextHash,
  getCurrentNoticeHash,
  runtimeConsentChannel,
} from '@xiaoshuyin/compliance';
import {
  PHONE_USE_CONTRACT_CONTENT_VERSION,
  resolveDigitalUseRuntimeNode,
} from '@xiaoshuyin/scenes/digital-use';
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
import {
  TestProfessionalReviewContentProvider,
  TEST_A5001_PACKAGE,
  TEST_A5001_PACKAGE_V2,
  TEST_A5002_PACKAGE,
  normalizedReviewResponse,
  type TestProfessionalReviewRevalidationDrift,
} from '../support/digital-use-review-professional-content.js';

interface BaseFixture {
  manager: LoginResult;
  familyId: string;
  caseId: string;
  caseVersion: number;
  targetPersonId: string;
}

interface A5002Fixture extends BaseFixture {
  child: LoginResult;
  participationId: string;
  contractId: string;
  contractVersion: number;
  contractRevision: number;
}

const term = (value: string) => ({ state: 'VALUE', value });

describe('Slice 15 authority-reconciled A5001/A5002 runtime', () => {
  const provider = new TestProfessionalReviewContentProvider();
  let app: FastifyInstance;
  let productionApp: FastifyInstance;
  let admin: pg.Pool;
  let appDb: pg.Pool;
  let migrator: pg.Client;

  const compliancePolicyTestLockKey = (featureCode: string) =>
    `test:compliance-policy:${featureCode}:v1`;

  async function ensureBaselinePolicy(featureCode: string): Promise<void> {
    const current = await migrator.query<{
      policy_version: number;
      anthropomorphic_applicability: string;
      minor_access_rule: string;
      ai_disclosure_rule: string;
      generated_content_label_rule: string;
      usage_reminder_rule: string;
    }>(
      `SELECT policy_version,anthropomorphic_applicability,minor_access_rule,
              ai_disclosure_rule,generated_content_label_rule,usage_reminder_rule
         FROM compliance_feature_policies
        WHERE feature_code=$1
          AND feature_contract_revision='v1'
          AND superseded_by_policy_id IS NULL
        ORDER BY policy_version DESC
        LIMIT 1`,
      [featureCode]
    );
    const row = current.rows[0] ?? null;
    if (
      row !== null &&
      row.anthropomorphic_applicability === 'NOT_APPLICABLE' &&
      row.minor_access_rule === 'BASELINE' &&
      row.ai_disclosure_rule === 'BASELINE' &&
      row.generated_content_label_rule === 'BASELINE' &&
      row.usage_reminder_rule === 'BASELINE'
    ) {
      return;
    }

    const max = await migrator.query<{ max_version: number | null }>(
      `SELECT max(policy_version)::int AS max_version
         FROM compliance_feature_policies
        WHERE feature_code=$1
          AND feature_contract_revision='v1'`,
      [featureCode]
    );
    const nextVersion = (max.rows[0]?.max_version ?? 0) + 1;
    await migrator.query(
      `SELECT app.publish_compliance_feature_policy(
         $1,'v1',$2,$3,
         'NOT_APPLICABLE','BASELINE','BASELINE','BASELINE','BASELINE',
         $4,$5,now() - interval '1 minute',$6
       )`,
      [
        featureCode,
        row?.policy_version ?? null,
        nextVersion,
        `Slice 15 authority-reconciled test basis for ${featureCode}`,
        `evidence://slice15/authority-reconciled/${featureCode}`,
        `test:slice15-authority-reconciled:${featureCode}:${nextVersion}`,
      ]
    );
  }

  async function clearCompliancePolicyFixture(featureCode: string): Promise<void> {
    const { rows } = await admin.query<{ id: string }>(
      `SELECT id
         FROM compliance_feature_policies
        WHERE feature_code=$1
          AND feature_contract_revision='v1'
        ORDER BY policy_version ASC`,
      [featureCode]
    );
    for (const row of rows) {
      await admin.query(
        'DELETE FROM compliance_feature_policies WHERE id=$1',
        [row.id]
      );
    }
  }

  beforeAll(async () => {
    app = await buildApp({
      digitalUseReview: { professionalContent: provider },
    });
    productionApp = await buildApp();
    await app.ready();
    await productionApp.ready();
    admin = createAdminPool();
    appDb = new pg.Pool({ connectionString: process.env['DATABASE_URL']! });
    migrator = new pg.Client({
      connectionString: process.env['MIGRATION_DATABASE_URL'],
    });
    await migrator.connect();
    for (const featureCode of [
      'DIGITAL_USE_ASSESSMENT_RUNTIME',
      'DIGITAL_USE_FAMILY_ALLIANCE_RUNTIME',
    ] as const) {
      await migrator.query(
        'SELECT pg_advisory_lock(hashtextextended($1,0))',
        [compliancePolicyTestLockKey(featureCode)]
      );
      await ensureBaselinePolicy(featureCode);
    }
  });

  afterAll(async () => {
    for (const featureCode of [
      'DIGITAL_USE_ASSESSMENT_RUNTIME',
      'DIGITAL_USE_FAMILY_ALLIANCE_RUNTIME',
    ] as const) {
      await clearCompliancePolicyFixture(featureCode).catch(() => undefined);
      await migrator.query(
        'SELECT pg_advisory_unlock(hashtextextended($1,0))',
        [compliancePolicyTestLockKey(featureCode)]
      ).catch(() => undefined);
    }
    await appDb.end().catch(() => undefined);
    await migrator.end().catch(() => undefined);
    await admin.end().catch(() => undefined);
    await productionApp.close().catch(() => undefined);
    await app.close().catch(() => undefined);
  });

  async function seedConfirmedFormulation(
    f: BaseFixture,
    messageId: string,
    phase: 'GOALS' | 'REVIEW'
  ): Promise<void> {
    await admin.query('BEGIN');
    try {
      await admin.query('UPDATE cases SET phase=$2 WHERE id=$1', [f.caseId, phase]);
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
          f.familyId,
          f.caseId,
          JSON.stringify({ text: 'Current Digital Use review subject.' }),
          JSON.stringify([{ type: 'DIALOGUE_MESSAGE', id: messageId }]),
          JSON.stringify({
            kind: 'CONFIRM',
            actorPersonId: f.manager.personId,
            respondedAt: new Date().toISOString(),
          }),
          f.manager.personId,
        ]
      );
      await admin.query('COMMIT');
    } catch (error) {
      await admin.query('ROLLBACK');
      throw error;
    }
  }

  async function createBase(
    targetApp: FastifyInstance,
    label: string,
    phase: 'GOALS' | 'REVIEW',
    boundChild?: LoginResult
  ): Promise<BaseFixture> {
    const manager = await loginWithLabel(targetApp, `slice15-${label}`);
    const family = await createFamily(targetApp, manager.token, `slice15-${label}`);
    expect(family.statusCode, family.body).toBe(201);
    const familyId = family.json().id as string;
    let targetPersonId: string;
    if (boundChild) {
      targetPersonId = boundChild.personId;
      await admin.query('INSERT INTO family_members (family_id, person_id) VALUES ($1,$2)', [familyId, targetPersonId]);
      await admin.query(
        "UPDATE person_compliance_profiles SET age_band='MINOR_14_17', minor_mode=true, verified_source='OTHER_MEMBER_RELAY' WHERE person_id=$1",
        [targetPersonId]
      );
    } else {
      const child = await createMember(targetApp, manager.token, familyId, `r3-target-${label}`, {
        ageBand: 'MINOR_14_17', ageBandSource: 'OTHER_MEMBER_RELAY',
      });
      expect(child.statusCode, child.body).toBe(201);
      targetPersonId = child.json().personId as string;
    }
    const kase = await createCase(targetApp, manager.token, `slice15-${label}`);
    expect(kase.statusCode, kase.body).toBe(201);
    const caseId = kase.json().id as string;
    const caseVersion = kase.json().version as number;
    await withRlsTransaction(appDb, {
      familyId, accountId: manager.accountId, personId: manager.personId, purpose: 'FAMILY_MANAGEMENT',
    }, tx => insertDigitalUseAssessmentTarget(tx, caseId, familyId, targetPersonId, manager.personId));
    const message = await targetApp.inject({
      method: 'POST',
      url: `/api/v1/cases/${caseId}/messages`,
      headers: commandHeaders(manager.token, `slice15-msg-${label}`),
      payload: { content: 'Current Digital Use review subject.' },
    });
    expect(message.statusCode, message.body).toBe(201);
    const f = { manager, familyId, caseId, caseVersion, targetPersonId };
    await seedConfirmedFormulation(f, message.json().id as string, phase);
    return f;
  }

  /**
   * Finding #4 ownership split: Compliance / Consent belongs to the TARGET
   * CHILD. The ACTOR owns authorization only, so a revoked consent must be
   * seeded on the target for this negative to remain meaningful.
   */
  async function seedRevokedConsentForTarget(f: BaseFixture): Promise<void> {
    const guardian = await loginWithLabel(app, `slice15-guardian-${crypto.randomUUID()}`);
    const guardianOwnFamily = await createFamily(
      app,
      guardian.token,
      `slice15-guardian-own-${crypto.randomUUID()}`
    );
    expect(guardianOwnFamily.statusCode, guardianOwnFamily.body).toBe(201);
    await admin.query(
      `INSERT INTO family_members (family_id,person_id)
       VALUES ($1,$2) ON CONFLICT DO NOTHING`,
      [f.familyId, guardian.personId]
    );

    const noticeHash = getCurrentNoticeHash();
    const acceptedTextHash = getAcceptanceTextHash('v1');
    if (!acceptedTextHash) throw new Error('missing v1 acceptance text');
    const evidence = buildConsentEvidence({
      channel: runtimeConsentChannel(process.env),
      acceptedTextHash,
      clientIp: null,
      userAgent: null,
      pepper: 'slice15-review-consent-fixture',
    });

    const request = await admin.query<{ id: string }>(
      `INSERT INTO guardian_consent_requests
         (family_id,guardian_person_id,subject_person_id,declared_age_band,
          notice_version,notice_hash,status,expires_at,completed_at)
       VALUES ($1,$2,$3,'UNDER_14','v1',$4,'GRANTED',
               now()+interval '24 hours',now())
       RETURNING id`,
      [f.familyId, guardian.personId, f.targetPersonId, noticeHash]
    );
    const granted = await admin.query<{ id: string }>(
      `INSERT INTO consent_records
         (family_id,guardian_person_id,guardian_account_id,purpose,decision,version,
          onboarding_request_id,bound_person_id,bound_at,notice_version,notice_hash,
          policy_version,evidence)
       VALUES ($1,$2,$3,'UNDER_14_GUARDIAN_CONSENT','GRANTED',1,
               $4,$5,now(),'v1',$6,'v1',$7::jsonb)
       RETURNING id`,
      [
        f.familyId,
        guardian.personId,
        guardian.accountId,
        request.rows[0]!.id,
        f.targetPersonId,
        noticeHash,
        JSON.stringify(evidence),
      ]
    );
    const revoked = await admin.query<{ id: string }>(
      `INSERT INTO consent_records
         (family_id,guardian_person_id,guardian_account_id,purpose,decision,version,
          onboarding_request_id,bound_person_id,bound_at,notice_version,notice_hash,
          policy_version,evidence,supersedes_id)
       VALUES ($1,$2,$3,'UNDER_14_GUARDIAN_CONSENT','REVOKED',2,
               NULL,$4,now(),'v1',$5,'v1',$6::jsonb,$7)
       RETURNING id`,
      [
        f.familyId,
        guardian.personId,
        guardian.accountId,
        f.targetPersonId,
        noticeHash,
        JSON.stringify(evidence),
        granted.rows[0]!.id,
      ]
    );

    await admin.query(
      `INSERT INTO person_compliance_profiles
         (person_id,age_band,minor_mode,verified_source,guardian_person_id,
          guardian_consent_record_id,guardian_consent_version)
       VALUES ($1,'UNDER_14',true,'GUARDIAN_RELAY',$2,$3,2)
       ON CONFLICT (person_id) DO UPDATE SET
         age_band='UNDER_14',
         minor_mode=true,
         verified_source='GUARDIAN_RELAY',
         guardian_person_id=EXCLUDED.guardian_person_id,
         guardian_consent_record_id=EXCLUDED.guardian_consent_record_id,
         guardian_consent_version=2,
         effective_at=now(),
         updated_at=now()`,
      [f.targetPersonId, guardian.personId, revoked.rows[0]!.id]
    );
  }

  async function seedAssessmentEvidence(f: BaseFixture): Promise<void> {
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
            selections: ['A'],
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
            selection: 'A',
          })}`,
        });
      }
    );
  }

  async function getScene(targetApp: FastifyInstance, f: BaseFixture) {
    const response = await targetApp.inject({
      method: 'GET',
      url: `/api/v1/cases/${f.caseId}/scene`,
      headers: auth(f.manager.token),
    });
    expect(response.statusCode, response.body).toBe(200);
    return response.json();
  }

  async function respond(
    targetApp: FastifyInstance,
    f: BaseFixture,
    nodeCode: string,
    response: Record<string, unknown>,
    extra: Record<string, unknown> = {}
  ) {
    const scene = await getScene(targetApp, f);
    const node = scene.nodes.find((item: any) => item.nodeCode === nodeCode);
    return targetApp.inject({
      method: 'POST',
      url: `/api/v1/cases/${f.caseId}/scene/nodes/${nodeCode}/responses`,
      headers: commandHeaders(
        f.manager.token,
        `slice15-${nodeCode.toLowerCase()}-${crypto.randomUUID()}`
      ),
      payload: {
        targetPersonId: f.targetPersonId,
        expectedCaseVersion: f.caseVersion,
        expectedNodeRevision: node?.revision ?? 0,
        expectedScenePackageVersion: 'v1',
        response,
        ...extra,
      },
    });
  }

  function selfAssessment() {
    return {
      kind: 'SELF_ASSESSMENT',
      answers: {
        emotionAttention: 'YES',
        negotiatedAgreement: 'YES',
        trustsAgreement: 'YES',
        familyCoordination: 'YES',
        parentEmotionFluctuation: 'NO',
        keepsPromises: 'YES',
      },
    };
  }

  async function prepareA5001(
    targetApp: FastifyInstance,
    label: string
  ): Promise<{ f: BaseFixture; scene: any; payload: Record<string, unknown> }> {
    const f = await createBase(targetApp, label, 'GOALS');
    const a1001 = resolveDigitalUseRuntimeNode('A1001');
    const a2010 = resolveDigitalUseRuntimeNode('A2010');
    for (const node of [a1001, a2010]) {
      await admin.query(
        `INSERT INTO scene_node_states
           (family_id,case_id,scene_package_version,node_code,source_node_code,
            status,branch_reason_codes,input_refs,output_refs,revision,completed_at)
         VALUES ($1,$2,'v1',$3,$4,'COMPLETED',ARRAY['SLICE15_FIXTURE'],
                 '[]'::jsonb,'[]'::jsonb,1,now())`,
        [f.familyId, f.caseId, node.nodeCode, node.sourceNodeCode]
      );
    }
    await seedAssessmentEvidence(f);

    const a3000 = await respond(targetApp, f, 'A3000', selfAssessment());
    expect(a3000.statusCode, a3000.body).toBe(200);
    const selection = await respond(
      targetApp,
      f,
      'A3002',
      {
        kind: 'TARGET_SELECTION',
        confirmed: true,
        selectedTargets: ['SLEEP'],
      },
      { expectedSelectionRevision: 0 }
    );
    expect(selection.statusCode, selection.body).toBe(200);
    const scene = selection.json();
    const selected = scene.targets.filter((target: any) => target.selected);
    expect(selected).toHaveLength(1);

    const payload = {
      kind: 'FAMILY_ALLIANCE_REVIEW',
      subject: {
        selectionRevision: scene.targetSelectionRevision,
        selectedTargets: selected.map((target: any) => ({
          targetId: target.id,
          targetCode: target.targetCode,
          targetRevision: target.revision,
        })),
      },
      professionalPackage: TEST_A5001_PACKAGE,
      packageResponse: normalizedReviewResponse,
      evidenceRefs: [],
      provenance: [{
        kind: 'PARENT_AUTHORED_OBSERVATION',
        sourcePersonId: f.manager.personId,
      }],
    };
    return { f, scene, payload };
  }

  function submitA5001(
    targetApp: FastifyInstance,
    f: BaseFixture,
    scene: any,
    payload: Record<string, unknown>,
    key: string
  ) {
    const node = scene.nodes.find((item: any) => item.nodeCode === 'A5001');
    return targetApp.inject({
      method: 'POST',
      url: `/api/v1/cases/${f.caseId}/scene/nodes/A5001/responses`,
      headers: { ...auth(f.manager.token), 'idempotency-key': key },
      payload: {
        targetPersonId: f.targetPersonId,
        expectedCaseVersion: f.caseVersion,
        expectedNodeRevision: node?.revision ?? 0,
        expectedScenePackageVersion: 'v1',
        expectedSelectionRevision: scene.targetSelectionRevision,
        response: payload,
      },
    });
  }

  async function prepareA5002(
    targetApp: FastifyInstance,
    label: string,
    legacyMismatch = false
  ): Promise<{ f: A5002Fixture; scene: any; payload: Record<string, unknown> }> {
    const child = await loginWithLabel(targetApp, `slice15-child-${label}`);
    const childOwn = await createFamily(
      targetApp,
      child.token,
      `slice15-child-own-${label}`
    );
    expect(childOwn.statusCode, childOwn.body).toBe(201);
    const base = await createBase(targetApp, label, 'REVIEW', legacyMismatch ? undefined : child);
    await admin.query(
      'INSERT INTO family_members (family_id,person_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
      [base.familyId, child.personId]
    );
    if (legacyMismatch) {
      await admin.query(
        "UPDATE person_compliance_profiles SET age_band='MINOR_14_17', minor_mode=true, verified_source='OTHER_MEMBER_RELAY' WHERE person_id=$1",
        [child.personId]
      );
    }

    await admin.query(
      `INSERT INTO scene_node_states
         (family_id,case_id,scene_package_version,node_code,source_node_code,
          status,branch_reason_codes,input_refs,output_refs,completed_at,revision)
       VALUES ($1,$2,'v1','A1001','A1001','COMPLETED',
               ARRAY['SLICE15_A5002_FIXTURE'],'[]'::jsonb,'[]'::jsonb,now(),1)`,
      [base.familyId, base.caseId]
    );

    const client = await admin.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT app.set_identity_context($1,$2)', [
        base.manager.accountId,
        'FAMILY_MANAGEMENT',
      ]);
      await client.query('SELECT app.set_family_context($1,$2,$3)', [
        base.familyId,
        base.manager.personId,
        'FAMILY_MANAGEMENT',
      ]);
      const tokenHash = crypto.randomUUID().replaceAll('-', '').repeat(2);
      const participation = await client.query<{ id: string }>(
        `INSERT INTO case_participants
           (family_id,case_id,person_id,state,invite_token_hash,invite_expires_at,
            created_by_person_id,accepted_at)
         VALUES ($1,$2,$3,'ACTIVE',$4,now()+interval '1 day',$5,now())
         RETURNING id`,
        [
          base.familyId,
          base.caseId,
          child.personId,
          tokenHash,
          base.manager.personId,
        ]
      );
      const participationId = participation.rows[0]!.id;
      const confirmedAt = new Date().toISOString();
      const parentConfirmation = {
        kind: 'ADULT',
        accountId: base.manager.accountId,
        personId: base.manager.personId,
        draftRevision: 1,
        confirmedAt,
        authorizationAction: 'CASE_RESPOND_ASSESSMENT_SCENE',
      };
      const childConfirmation = {
        kind: 'CHILD',
        accountId: child.accountId,
        personId: child.personId,
        participationId,
        draftRevision: 1,
        confirmedAt,
        authorizationAction: 'PHONE_USE_CONTRACT_CONFIRM_SELF',
      };
      const terms = [
        term('Reduce conflict while preserving agreed access.'),
        term('No phone after the agreed bedtime.'),
        term('Two weeks.'),
        term('Parent gives one calm reminder.'),
        term('Check the shared charging location.'),
        term('Extra family activity after consistent execution.'),
        term('Discuss breach and reset the next day.'),
      ];
      const contract = await client.query<{ id: string }>(
        `INSERT INTO digital_use_contract_versions
           (family_id,case_id,version,draft_revision,status,
            adult_party_person_id,child_party_person_id,child_participation_id,
            contract_purpose,phone_use_rules,execution_period,parent_support_measures,
            supervision_measures,incentives,breach_responsibilities,
            source_template_version,dependency_refs,parent_confirmation,
            child_confirmation,created_by_person_id,activated_at)
         VALUES
           ($1,$2,1,1,'ACTIVE',$3,$4,$5,
            $6::jsonb,$7::jsonb,$8::jsonb,$9::jsonb,$10::jsonb,$11::jsonb,$12::jsonb,
            $13,'[]'::jsonb,$14::jsonb,$15::jsonb,$3,now())
         RETURNING id`,
        [
          base.familyId,
          base.caseId,
          base.manager.personId,
          child.personId,
          participationId,
          ...terms.map((value) => JSON.stringify(value)),
          PHONE_USE_CONTRACT_CONTENT_VERSION,
          JSON.stringify(parentConfirmation),
          JSON.stringify(childConfirmation),
        ]
      );
      const contractId = contract.rows[0]!.id;
      await client.query(
        `INSERT INTO scene_artifacts
           (family_id,case_id,scene_package_version,artifact_type,schema_version,
            source_node_code,data,owner_person_id,visibility,source_refs,revision)
         VALUES ($1,$2,'v1','PHONE_USE_CONTRACT_DOCUMENT','v1','A4010',
                 $3::jsonb,$4,'FAMILY_AUTHORIZED','[]'::jsonb,1)`,
        [
          base.familyId,
          base.caseId,
          JSON.stringify({
            contractVersionId: contractId,
            version: 1,
            draftRevision: 1,
            status: 'ACTIVE',
          }),
          base.manager.personId,
        ]
      );
      await client.query('COMMIT');
      const f: A5002Fixture = {
        ...base,
        child,
        participationId,
        contractId,
        contractVersion: 1,
        contractRevision: 1,
      };
      const scene = await getScene(targetApp, f);
      const payload = {
        kind: 'PHONE_USE_CONTRACT_REVIEW',
        subject: {
          contractId,
          contractVersion: 1,
          contractRevision: 1,
          contractStatus: 'ACTIVE',
        },
        professionalPackage: TEST_A5002_PACKAGE,
        packageResponse: normalizedReviewResponse,
        evidenceRefs: [],
        provenance: [{
          kind: 'PARENT_AUTHORED_OBSERVATION',
          sourcePersonId: f.manager.personId,
        }],
      };
      return { f, scene, payload };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  function submitA5002(
    targetApp: FastifyInstance,
    f: A5002Fixture,
    scene: any,
    payload: Record<string, unknown>,
    key: string
  ) {
    const node = scene.nodes.find((item: any) => item.nodeCode === 'A5002');
    return targetApp.inject({
      method: 'POST',
      url: `/api/v1/cases/${f.caseId}/scene/nodes/A5002/responses`,
      headers: { ...auth(f.manager.token), 'idempotency-key': key },
      payload: {
        targetPersonId: f.targetPersonId,
        expectedCaseVersion: f.caseVersion,
        expectedNodeRevision: node?.revision ?? 0,
        expectedScenePackageVersion: 'v1',
        response: payload,
      },
    });
  }

  async function reviewCounts(f: BaseFixture, nodeCode: 'A5001' | 'A5002') {
    const artifactType =
      nodeCode === 'A5001'
        ? 'DIGITAL_USE_A5001_EFFECT_EVALUATION'
        : 'DIGITAL_USE_A5002_EFFECT_EVALUATION';
    const { rows } = await admin.query(
      `SELECT
        (SELECT count(*)::int FROM scene_artifacts
          WHERE case_id=$1 AND artifact_type=$2) AS artifacts,
        (SELECT count(*)::int FROM scene_node_states
          WHERE case_id=$1 AND node_code=$3 AND status='COMPLETED') AS completed,
        (SELECT count(*)::int FROM case_events
          WHERE case_id=$1 AND event_type='CASE_DIGITAL_USE_NODE_COMPLETED'
            AND metadata->>'nodeCode'=$3) AS events,
        (SELECT count(*)::int FROM idempotency_keys
          WHERE actor_account_id=$4
            AND command_type='DIGITAL_USE_NODE_RESPONSE'
            AND idempotency_key LIKE $5) AS idempotency`,
      [
        f.caseId,
        artifactType,
        nodeCode,
        f.manager.accountId,
        nodeCode === 'A5001' ? 'a5001-%' : 'a5002-%',
      ]
    );
    return rows[0] as {
      artifacts: number;
      completed: number;
      events: number;
      idempotency: number;
    };
  }

  async function contractSnapshot(f: A5002Fixture) {
    const { rows } = await admin.query(
      `SELECT id,version,draft_revision,status,supersedes_id,update_trigger,
              contract_purpose,phone_use_rules,execution_period,
              parent_support_measures,supervision_measures,incentives,
              breach_responsibilities
         FROM digital_use_contract_versions
        WHERE case_id=$1 ORDER BY version`,
      [f.caseId]
    );
    return rows;
  }

  async function supersedeA5002WithVersion2(
    f: A5002Fixture
  ): Promise<A5002Fixture> {
    const client = await admin.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT app.set_identity_context($1,$2)', [
        f.manager.accountId,
        'FAMILY_MANAGEMENT',
      ]);
      await client.query('SELECT app.set_family_context($1,$2,$3)', [
        f.familyId,
        f.manager.personId,
        'FAMILY_MANAGEMENT',
      ]);
      const currentDoc = await client.query<{ id: string }>(
        `SELECT id
           FROM scene_artifacts
          WHERE case_id=$1
            AND artifact_type='PHONE_USE_CONTRACT_DOCUMENT'
          ORDER BY revision DESC LIMIT 1`,
        [f.caseId]
      );
      await client.query(
        `UPDATE digital_use_contract_versions
            SET status='SUPERSEDED',superseded_at=now()
          WHERE id=$1 AND status='ACTIVE'`,
        [f.contractId]
      );
      const next = await client.query<{ id: string }>(
        `INSERT INTO digital_use_contract_versions
           (family_id,case_id,version,draft_revision,status,
            adult_party_person_id,child_party_person_id,child_participation_id,
            contract_purpose,phone_use_rules,execution_period,parent_support_measures,
            supervision_measures,incentives,breach_responsibilities,
            source_template_version,dependency_refs,parent_confirmation,
            child_confirmation,supersedes_id,update_reason,update_trigger,
            created_by_person_id,activated_at)
         SELECT
            family_id,case_id,2,1,'ACTIVE',
            adult_party_person_id,child_party_person_id,child_participation_id,
            contract_purpose,phone_use_rules,execution_period,parent_support_measures,
            supervision_measures,incentives,breach_responsibilities,
            source_template_version,dependency_refs,parent_confirmation,
            child_confirmation,id,'period completed','PERIOD_COMPLETE',
            created_by_person_id,now()
           FROM digital_use_contract_versions
          WHERE id=$1
         RETURNING id`,
        [f.contractId]
      );
      const contractId = next.rows[0]!.id;
      await client.query(
        `INSERT INTO scene_artifacts
           (family_id,case_id,scene_package_version,artifact_type,schema_version,
            source_node_code,data,owner_person_id,visibility,source_refs,revision,
            supersedes_id)
         VALUES ($1,$2,'v1','PHONE_USE_CONTRACT_DOCUMENT','v1','A4010',
                 $3::jsonb,$4,'FAMILY_AUTHORIZED','[]'::jsonb,2,$5)`,
        [
          f.familyId,
          f.caseId,
          JSON.stringify({
            contractVersionId: contractId,
            version: 2,
            draftRevision: 1,
            status: 'ACTIVE',
            projectionNodeCode: 'A4012',
          }),
          f.manager.personId,
          currentDoc.rows[0]!.id,
        ]
      );
      await client.query('COMMIT');
      return {
        ...f,
        contractId,
        contractVersion: 2,
        contractRevision: 1,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  it.each([false, true])('R3 manager current Contract GET enforces target identity (legacy mismatch: %s)', async (legacyMismatch) => {
    const { f } = await prepareA5002(app, `r3-manager-current-${legacyMismatch}`, legacyMismatch);
    const snapshot = async () => (await admin.query(
      `SELECT
        (SELECT jsonb_agg(to_jsonb(contract) ORDER BY contract.version)
          FROM digital_use_contract_versions contract WHERE case_id=$1) AS contracts,
        (SELECT jsonb_agg(to_jsonb(node) ORDER BY node.node_code)
          FROM scene_node_states node WHERE case_id=$1) AS scene,
        (SELECT jsonb_agg(to_jsonb(artifact) ORDER BY artifact.id)
          FROM scene_artifacts artifact WHERE case_id=$1) AS artifacts,
        (SELECT jsonb_build_array(phase, version) FROM cases WHERE id=$1) AS case_state,
        (SELECT count(*) FROM case_events WHERE case_id=$1) AS events,
        (SELECT count(*) FROM business_audit_events WHERE resource_id::text=$1::text) AS audits`,
      [f.caseId]
    )).rows;
    const before = await snapshot();
    const response = await app.inject({
      method: 'GET', url: `/api/v1/cases/${f.caseId}/digital-use/contract/current`,
      headers: auth(f.manager.token),
    });
    if (legacyMismatch) {
      expect(f.child.personId).not.toBe(f.targetPersonId);
      expect(response.statusCode, response.body).toBe(404);
      expect(response.json().code).toBe('PHONE_USE_CONTRACT_NOT_FOUND');
      expect(response.body).not.toContain(f.child.personId);
      expect(response.body).not.toContain(f.targetPersonId);
    } else {
      expect(response.statusCode, response.body).toBe(200);
      expect(response.json()).toMatchObject({ childPartyPersonId: f.targetPersonId, status: 'ACTIVE' });
    }
    expect(await snapshot()).toEqual(before);
  });

  it('R3 rejects A5002 review of a legacy ACTIVE Contract for a different child', async () => {
    const { f, scene, payload } = await prepareA5002(app, 'r3-legacy-mismatch', true);
    expect(f.child.personId).not.toBe(f.targetPersonId);
    const snapshot = async () => ({
      ...(await reviewCounts(f, 'A5002')),
      caseState: (await admin.query('SELECT phase, version FROM cases WHERE id=$1', [f.caseId])).rows,
      audits: (await admin.query('SELECT count(*) FROM business_audit_events WHERE resource_id::text=$1::text', [f.caseId])).rows,
    });
    const before = await snapshot();
    const rejected = await submitA5002(app, f, scene, payload, 'a5002-r3-legacy-mismatch');
    expect(rejected.json().code, rejected.body).toBe('TARGET_SCOPE_INVALID');
    expect(await snapshot()).toEqual(before);
  });

  it('R3 blocks new A5001 execution when the bound child is no longer eligible', async () => {
    const { f, scene, payload } = await prepareA5001(app, 'r3-a5001-target-compliance');
    await admin.query(
      "UPDATE person_compliance_profiles SET age_band='ADULT', minor_mode=false, verified_source='SELF_STATEMENT' WHERE person_id=$1",
      [f.targetPersonId]
    );
    const before = await reviewCounts(f, 'A5001');
    const rejected = await submitA5001(app, f, scene, payload, 'a5001-r3-child-blocked');
    expect(rejected.json().code, rejected.body).toBe('COMPLIANCE_BLOCKED');
    expect(await reviewCounts(f, 'A5001')).toEqual(before);
    expect((await getScene(app, f)).caseVersion).toBe(scene.caseVersion);
  });

  it('T1503/T1506 production A5001 fails closed while the test-only exact package completes only A5001', async () => {
    provider.restore('FAMILY_ALLIANCE_REVIEW');
    const production = await prepareA5001(productionApp, 'a5001-prod-closed');
    const blocked = await submitA5001(
      productionApp,
      production.f,
      production.scene,
      production.payload,
      `a5001-prod-${crypto.randomUUID()}`
    );
    expect(blocked.statusCode, blocked.body).toBe(503);
    expect(blocked.json()).toMatchObject({ code: 'DEPENDENCY_UNAVAILABLE' });
    expect(await reviewCounts(production.f, 'A5001')).toMatchObject({
      artifacts: 0,
      completed: 0,
      events: 0,
      idempotency: 0,
    });

    const positive = await prepareA5001(app, 'a5001-positive');
    const result = await submitA5001(
      app,
      positive.f,
      positive.scene,
      positive.payload,
      `a5001-positive-${crypto.randomUUID()}`
    );
    expect(result.statusCode, result.body).toBe(200);
    const body = result.json();
    expect(body.nodes.find((node: any) => node.nodeCode === 'A5001')).toMatchObject({
      status: 'COMPLETED',
    });
    expect(body.nodes.some((node: any) => node.nodeCode === 'A5002')).toBe(false);
    const artifact = body.artifacts.find(
      (item: any) => item.type === 'DIGITAL_USE_A5001_EFFECT_EVALUATION'
    );
    expect(artifact.data.professionalPackage).toMatchObject(TEST_A5001_PACKAGE);
    expect(artifact.data.subject.familyAllianceSubject.selectionRevision)
      .toBe(positive.scene.targetSelectionRevision);
    expect(artifact.data.subject.selectedTargets).toHaveLength(1);
    expect(artifact.data).not.toHaveProperty('questionnaire');
    expect(artifact.data).not.toHaveProperty('score');
  });

  it('T1508/A4012 production A5002 fails closed; test package completes exact Contract review without mutating Contract or A5001', async () => {
    provider.restore('PHONE_USE_CONTRACT_REVIEW');
    const production = await prepareA5002(productionApp, 'a5002-prod-closed');
    const blocked = await submitA5002(
      productionApp,
      production.f,
      production.scene,
      production.payload,
      `a5002-prod-${crypto.randomUUID()}`
    );
    expect(blocked.statusCode, blocked.body).toBe(503);
    expect(blocked.json()).toMatchObject({ code: 'DEPENDENCY_UNAVAILABLE' });
    expect(await reviewCounts(production.f, 'A5002')).toMatchObject({
      artifacts: 0,
      completed: 0,
      events: 0,
      idempotency: 0,
    });

    const positive = await prepareA5002(app, 'a5002-positive');
    const before = await contractSnapshot(positive.f);
    const result = await submitA5002(
      app,
      positive.f,
      positive.scene,
      positive.payload,
      `a5002-positive-${crypto.randomUUID()}`
    );
    expect(result.statusCode, result.body).toBe(200);
    const after = await contractSnapshot(positive.f);
    expect(after).toEqual(before);
    const body = result.json();
    expect(body.nodes.find((node: any) => node.nodeCode === 'A5002')).toMatchObject({
      status: 'COMPLETED',
    });
    expect(body.nodes.some((node: any) => node.nodeCode === 'A5001')).toBe(false);
    expect(body.nodes.some((node: any) => node.nodeCode === 'A4012')).toBe(false);
    const artifact = body.artifacts.find(
      (item: any) => item.type === 'DIGITAL_USE_A5002_EFFECT_EVALUATION'
    );
    expect(artifact.data.subject).toMatchObject({
      contractId: positive.f.contractId,
      contractVersion: 1,
      contractRevision: 1,
      contractStatus: 'ACTIVE',
    });
    expect(artifact.data.professionalPackage).toMatchObject(TEST_A5002_PACKAGE);
    expect(artifact.data.a4012Boundary).toBe('OBSERVE_ONLY');
  });

  it('T1507/T1513 keeps historical A5002 bound to v1 and rejects silent substitution after independent A4012 creates v2', async () => {
    provider.restore('PHONE_USE_CONTRACT_REVIEW');
    const first = await prepareA5002(app, 'a5002-version-binding');
    const v1 = await submitA5002(
      app,
      first.f,
      first.scene,
      first.payload,
      `a5002-v1-${crypto.randomUUID()}`
    );
    expect(v1.statusCode, v1.body).toBe(200);

    const v2Fixture = await supersedeA5002WithVersion2(first.f);
    const afterA4012 = await getScene(app, v2Fixture);

    const silentSwitch = await submitA5002(
      app,
      first.f,
      afterA4012,
      first.payload,
      `a5002-old-subject-${crypto.randomUUID()}`
    );
    expect(silentSwitch.statusCode).toBe(409);
    expect(silentSwitch.json()).toMatchObject({
      code: 'PHONE_USE_CONTRACT_STALE_REVISION',
    });

    const v2Payload = {
      ...first.payload,
      subject: {
        contractId: v2Fixture.contractId,
        contractVersion: 2,
        contractRevision: 1,
        contractStatus: 'ACTIVE',
      },
      packageResponse: {
        outcome: 'SAME',
        note: 'Explicit review of the independently-created Contract v2.',
      },
    };
    const v2 = await submitA5002(
      app,
      v2Fixture,
      afterA4012,
      v2Payload,
      `a5002-v2-${crypto.randomUUID()}`
    );
    expect(v2.statusCode, v2.body).toBe(200);

    const { rows } = await admin.query(
      `SELECT id,revision,supersedes_id,data
         FROM scene_artifacts
        WHERE case_id=$1
          AND artifact_type='DIGITAL_USE_A5002_EFFECT_EVALUATION'
        ORDER BY revision`,
      [first.f.caseId]
    );
    expect(rows).toHaveLength(2);
    expect(rows[0].data.subject).toMatchObject({
      contractId: first.f.contractId,
      contractVersion: 1,
      contractRevision: 1,
    });
    expect(rows[1].data.subject).toMatchObject({
      contractId: v2Fixture.contractId,
      contractVersion: 2,
      contractRevision: 1,
      supersedesId: first.f.contractId,
    });
    expect(rows[1].supersedes_id).toBe(rows[0].id);
  });

  it('T1510 same idempotency key replays the original A5001 result and rejects changed package-owned payload', async () => {
    provider.restore('FAMILY_ALLIANCE_REVIEW');
    const { f, scene, payload } = await prepareA5001(app, 'a5001-idem');
    const key = `a5001-idem-${crypto.randomUUID()}`;
    const first = await submitA5001(app, f, scene, payload, key);
    expect(first.statusCode, first.body).toBe(200);
    const replay = await submitA5001(app, f, scene, payload, key);
    expect(replay.statusCode, replay.body).toBe(200);
    expect(replay.json()).toEqual(first.json());

    const changed = {
      ...payload,
      packageResponse: {
        ...normalizedReviewResponse,
        note: 'Changed package-owned normalized response.',
      },
    };
    const mismatch = await submitA5001(app, f, scene, changed, key);
    expect(mismatch.statusCode, mismatch.body).toBe(409);
    expect(mismatch.json()).toMatchObject({
      code: 'IDEMPOTENCY_PAYLOAD_MISMATCH',
    });
    expect(await reviewCounts(f, 'A5001')).toMatchObject({
      artifacts: 1,
      completed: 1,
      events: 1,
      idempotency: 1,
    });
  });

  it('T1510 raw-different but package-normalized-equivalent A5001 request replays the original result', async () => {
    provider.restore('FAMILY_ALLIANCE_REVIEW');
    const { f, scene, payload } = await prepareA5001(app, 'a5001-normalized-idem');
    const key = `a5001-normalized-idem-${crypto.randomUUID()}`;
    const first = await submitA5001(app, f, scene, payload, key);
    expect(first.statusCode, first.body).toBe(200);

    const equivalent = {
      ...payload,
      packageResponse: {
        ...normalizedReviewResponse,
        note: `   ${normalizedReviewResponse.note}   `,
      },
    };
    const replay = await submitA5001(app, f, scene, equivalent, key);
    expect(replay.statusCode, replay.body).toBe(200);
    expect(replay.json()).toEqual(first.json());
    expect(await reviewCounts(f, 'A5001')).toMatchObject({
      artifacts: 1,
      completed: 1,
      events: 1,
      idempotency: 1,
    });
  });

  it('T1510 A5002 same-key exact replay returns original result and changed normalized payload conflicts', async () => {
    provider.restore('PHONE_USE_CONTRACT_REVIEW');
    const { f, scene, payload } = await prepareA5002(app, 'a5002-idem');
    const key = `a5002-idem-${crypto.randomUUID()}`;
    const first = await submitA5002(app, f, scene, payload, key);
    expect(first.statusCode, first.body).toBe(200);

    const replay = await submitA5002(app, f, scene, payload, key);
    expect(replay.statusCode, replay.body).toBe(200);
    expect(replay.json()).toEqual(first.json());

    const changed = {
      ...payload,
      packageResponse: {
        ...normalizedReviewResponse,
        note: 'Changed exact Contract review response.',
      },
    };
    const mismatch = await submitA5002(app, f, scene, changed, key);
    expect(mismatch.statusCode, mismatch.body).toBe(409);
    expect(mismatch.json()).toMatchObject({
      code: 'IDEMPOTENCY_PAYLOAD_MISMATCH',
    });
    expect(await reviewCounts(f, 'A5002')).toMatchObject({
      artifacts: 1,
      completed: 1,
      events: 1,
      idempotency: 1,
    });
  });

  it('T1511 concurrent same-revision A5002 writers produce one winner and one stale loser without Contract mutation', async () => {
    provider.restore('PHONE_USE_CONTRACT_REVIEW');
    const { f, scene, payload } = await prepareA5002(app, 'a5002-race');
    const before = await contractSnapshot(f);
    const [one, two] = await Promise.all([
      submitA5002(app, f, scene, payload, `a5002-race-a-${crypto.randomUUID()}`),
      submitA5002(app, f, scene, payload, `a5002-race-b-${crypto.randomUUID()}`),
    ]);
    expect([one.statusCode, two.statusCode].sort()).toEqual([200, 409]);
    expect(await reviewCounts(f, 'A5002')).toMatchObject({
      artifacts: 1,
      completed: 1,
      events: 1,
      idempotency: 1,
    });
    expect(await contractSnapshot(f)).toEqual(before);
  });

  it('T1511 concurrent same-revision A5001 writers produce one winner and one stale loser', async () => {
    provider.restore('FAMILY_ALLIANCE_REVIEW');
    const { f, scene, payload } = await prepareA5001(app, 'a5001-race');
    const [one, two] = await Promise.all([
      submitA5001(app, f, scene, payload, `a5001-race-a-${crypto.randomUUID()}`),
      submitA5001(app, f, scene, payload, `a5001-race-b-${crypto.randomUUID()}`),
    ]);
    expect([one.statusCode, two.statusCode].sort()).toEqual([200, 409]);
    expect(await reviewCounts(f, 'A5001')).toMatchObject({
      artifacts: 1,
      completed: 1,
      events: 1,
      idempotency: 1,
    });
  });

  it('T1511 package retirement at commit-time rolls all A5001 truth back', async () => {
    provider.restore('FAMILY_ALLIANCE_REVIEW');
    const { f, scene, payload } = await prepareA5001(app, 'a5001-package-drift');
    provider.failNextRevalidation('FAMILY_ALLIANCE_REVIEW');
    const result = await submitA5001(
      app,
      f,
      scene,
      payload,
      `a5001-package-drift-${crypto.randomUUID()}`
    );
    expect(result.statusCode, result.body).toBe(503);
    expect(result.json()).toMatchObject({ code: 'DEPENDENCY_UNAVAILABLE' });
    expect(await reviewCounts(f, 'A5001')).toMatchObject({
      artifacts: 0,
      completed: 0,
      events: 0,
      idempotency: 0,
    });
  });

  it('T1513 package v2 reassessment appends a new A5001 artifact and never rewrites package v1 history', async () => {
    provider.restore('FAMILY_ALLIANCE_REVIEW');
    const { f, scene, payload } = await prepareA5001(app, 'a5001-package-history');
    const first = await submitA5001(
      app,
      f,
      scene,
      payload,
      `a5001-package-history-v1-${crypto.randomUUID()}`
    );
    expect(first.statusCode, first.body).toBe(200);

    const secondPayload = {
      ...payload,
      professionalPackage: TEST_A5001_PACKAGE_V2,
      packageResponse: {
        outcome: 'SAME',
        note: 'Synthetic package v2 reassessment.',
      },
    };
    const second = await submitA5001(
      app,
      f,
      first.json(),
      secondPayload,
      `a5001-package-history-v2-${crypto.randomUUID()}`
    );
    expect(second.statusCode, second.body).toBe(200);

    const { rows } = await admin.query<any>(
      `SELECT id,revision,supersedes_id,data
         FROM scene_artifacts
        WHERE case_id=$1
          AND artifact_type='DIGITAL_USE_A5001_EFFECT_EVALUATION'
        ORDER BY revision ASC`,
      [f.caseId]
    );
    expect(rows).toHaveLength(2);
    expect(rows[0].revision).toBe(1);
    expect(rows[0].data.professionalPackage).toMatchObject(TEST_A5001_PACKAGE);
    expect(rows[1].revision).toBe(2);
    expect(rows[1].supersedes_id).toBe(rows[0].id);
    expect(rows[1].data.professionalPackage).toMatchObject(TEST_A5001_PACKAGE_V2);
    expect(rows[0].data.normalizedResponse).toEqual(normalizedReviewResponse);
    expect(rows[1].data.normalizedResponse).toMatchObject({
      outcome: 'SAME',
      note: 'Synthetic package v2 reassessment.',
    });
  });

  it('T1511 A5002 exact Contract writer race rejects the stale v1 subject without silent latest substitution', async () => {
    provider.restore('PHONE_USE_CONTRACT_REVIEW');
    const { f, scene, payload } = await prepareA5002(
      app,
      'a5002-contract-writer-race'
    );

    const blocker = await admin.connect();
    try {
      await blocker.query('BEGIN');
      await blocker.query('SELECT app.set_identity_context($1,$2)', [
        f.manager.accountId,
        'FAMILY_MANAGEMENT',
      ]);
      await blocker.query('SELECT app.set_family_context($1,$2,$3)', [
        f.familyId,
        f.manager.personId,
        'FAMILY_MANAGEMENT',
      ]);
      const currentDoc = await blocker.query<{ id: string }>(
        `SELECT id
           FROM scene_artifacts
          WHERE case_id=$1
            AND artifact_type='PHONE_USE_CONTRACT_DOCUMENT'
          ORDER BY revision DESC LIMIT 1`,
        [f.caseId]
      );
      const superseded = await blocker.query(
        `UPDATE digital_use_contract_versions
            SET status='SUPERSEDED',superseded_at=now()
          WHERE id=$1 AND status='ACTIVE'
          RETURNING id`,
        [f.contractId]
      );
      expect(superseded.rowCount).toBe(1);
      const next = await blocker.query<{ id: string }>(
        `INSERT INTO digital_use_contract_versions
           (family_id,case_id,version,draft_revision,status,
            adult_party_person_id,child_party_person_id,child_participation_id,
            contract_purpose,phone_use_rules,execution_period,parent_support_measures,
            supervision_measures,incentives,breach_responsibilities,
            source_template_version,dependency_refs,parent_confirmation,
            child_confirmation,supersedes_id,update_reason,update_trigger,
            created_by_person_id,activated_at)
         SELECT
            family_id,case_id,2,1,'ACTIVE',
            adult_party_person_id,child_party_person_id,child_participation_id,
            contract_purpose,phone_use_rules,execution_period,parent_support_measures,
            supervision_measures,incentives,breach_responsibilities,
            source_template_version,dependency_refs,parent_confirmation,
            child_confirmation,id,'period completed','PERIOD_COMPLETE',
            created_by_person_id,now()
           FROM digital_use_contract_versions
          WHERE id=$1
         RETURNING id`,
        [f.contractId]
      );
      const v2ContractId = next.rows[0]!.id;
      await blocker.query(
        `INSERT INTO scene_artifacts
           (family_id,case_id,scene_package_version,artifact_type,schema_version,
            source_node_code,data,owner_person_id,visibility,source_refs,revision,
            supersedes_id)
         VALUES ($1,$2,'v1','PHONE_USE_CONTRACT_DOCUMENT','v1','A4010',
                 $3::jsonb,$4,'FAMILY_AUTHORIZED','[]'::jsonb,2,$5)`,
        [
          f.familyId,
          f.caseId,
          JSON.stringify({
            contractVersionId: v2ContractId,
            version: 2,
            draftRevision: 1,
            status: 'ACTIVE',
            projectionNodeCode: 'A4012',
          }),
          f.manager.personId,
          currentDoc.rows[0]!.id,
        ]
      );

      const pending = submitA5002(
        app,
        f,
        scene,
        payload,
        `a5002-contract-writer-race-${crypto.randomUUID()}`
      );
      // The review reaches the authoritative Contract lineage FOR UPDATE and
      // waits behind this writer. Commit v1 supersession + v2 creation, then
      // the old exact subject must be rejected rather than substituted.
      await new Promise((resolve) => setTimeout(resolve, 40));
      await blocker.query('COMMIT');

      const result = await pending;
      expect(result.statusCode, result.body).toBe(409);
      expect(result.json()).toMatchObject({
        code: 'PHONE_USE_CONTRACT_STALE_REVISION',
      });
      expect(await reviewCounts(f, 'A5002')).toMatchObject({
        artifacts: 0,
        completed: 0,
        events: 0,
        idempotency: 0,
      });

      const contracts = await contractSnapshot(f);
      expect(contracts).toHaveLength(2);
      expect(contracts[0]).toMatchObject({
        id: f.contractId,
        version: 1,
        status: 'SUPERSEDED',
      });
      expect(contracts[1]).toMatchObject({
        id: v2ContractId,
        version: 2,
        status: 'ACTIVE',
      });
    } catch (error) {
      await blocker.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      blocker.release();
    }
  });

  it.each([
    'VERSION',
    'HASH',
    'RETIRED',
    'SUPERSEDED',
    'SCOPE',
    'APPROVAL',
  ] satisfies readonly TestProfessionalReviewRevalidationDrift[])(
    'T1511 preview-valid A5001 package %s drift before commit fails closed with zero professional truth',
    async (drift) => {
      provider.restore('FAMILY_ALLIANCE_REVIEW');
      const { f, scene, payload } = await prepareA5001(
        app,
        `a5001-barrier-${drift.toLowerCase()}`
      );
      const barrier = provider.pauseNextRevalidation('FAMILY_ALLIANCE_REVIEW');
      const pending = submitA5001(
        app,
        f,
        scene,
        payload,
        `a5001-barrier-${drift.toLowerCase()}-${crypto.randomUUID()}`
      );

      await barrier.reached;
      provider.setNextRevalidationDrift('FAMILY_ALLIANCE_REVIEW', drift);
      barrier.release();

      const result = await pending;
      expect(result.statusCode, result.body).toBe(503);
      expect(result.json()).toMatchObject({ code: 'DEPENDENCY_UNAVAILABLE' });
      expect(await reviewCounts(f, 'A5001')).toMatchObject({
        artifacts: 0,
        completed: 0,
        events: 0,
        idempotency: 0,
      });
    }
  );

  it('T1511 preview-valid A5002 approval drift before commit fails closed and leaves exact Contract untouched', async () => {
    provider.restore('PHONE_USE_CONTRACT_REVIEW');
    const { f, scene, payload } = await prepareA5002(
      app,
      'a5002-barrier-approval'
    );
    const contractBefore = await contractSnapshot(f);
    const barrier = provider.pauseNextRevalidation('PHONE_USE_CONTRACT_REVIEW');
    const pending = submitA5002(
      app,
      f,
      scene,
      payload,
      `a5002-barrier-approval-${crypto.randomUUID()}`
    );

    await barrier.reached;
    provider.setNextRevalidationDrift('PHONE_USE_CONTRACT_REVIEW', 'APPROVAL');
    barrier.release();

    const result = await pending;
    expect(result.statusCode, result.body).toBe(503);
    expect(result.json()).toMatchObject({ code: 'DEPENDENCY_UNAVAILABLE' });
    expect(await reviewCounts(f, 'A5002')).toMatchObject({
      artifacts: 0,
      completed: 0,
      events: 0,
      idempotency: 0,
    });
    expect(await contractSnapshot(f)).toEqual(contractBefore);
  });

  it('T1512 injected A5002 artifact failure leaves no partial professional truth or idempotency settlement', async () => {
    provider.restore('PHONE_USE_CONTRACT_REVIEW');
    const { f, scene, payload } = await prepareA5002(app, 'a5002-atomicity');
    const suffix = crypto.randomUUID().replaceAll('-', '');
    const fn = `slice15_a5002_fault_${suffix}`;
    const trigger = `slice15_a5002_trigger_${suffix}`;
    await admin.query(
      `CREATE FUNCTION ${fn}() RETURNS trigger LANGUAGE plpgsql AS $$
       BEGIN
         IF NEW.artifact_type='DIGITAL_USE_A5002_EFFECT_EVALUATION' THEN
           RAISE EXCEPTION 'SLICE15_A5002_INJECTED_FAILURE';
         END IF;
         RETURN NEW;
       END $$`
    );
    await admin.query(
      `CREATE TRIGGER ${trigger}
         BEFORE INSERT ON scene_artifacts
         FOR EACH ROW EXECUTE FUNCTION ${fn}()`
    );
    const key = `a5002-atomicity-${crypto.randomUUID()}`;
    try {
      const result = await submitA5002(app, f, scene, payload, key);
      expect(result.statusCode).toBe(500);
      expect(await reviewCounts(f, 'A5002')).toMatchObject({
        artifacts: 0,
        completed: 0,
        events: 0,
        idempotency: 0,
      });
    } finally {
      await admin.query(`DROP TRIGGER IF EXISTS ${trigger} ON scene_artifacts`);
      await admin.query(`DROP FUNCTION IF EXISTS ${fn}()`);
    }

    const retry = await submitA5002(app, f, scene, payload, key);
    expect(retry.statusCode, retry.body).toBe(200);
    expect(await reviewCounts(f, 'A5002')).toMatchObject({
      artifacts: 1,
      completed: 1,
      events: 1,
      idempotency: 1,
    });
  });

  it('T1513 re-entry appends/supersedes A5001 history without destructive overwrite', async () => {
    provider.restore('FAMILY_ALLIANCE_REVIEW');
    const { f, scene, payload } = await prepareA5001(app, 'a5001-history');
    const first = await submitA5001(
      app,
      f,
      scene,
      payload,
      `a5001-history-1-${crypto.randomUUID()}`
    );
    expect(first.statusCode, first.body).toBe(200);
    const refreshed = first.json();
    const secondPayload = {
      ...payload,
      packageResponse: {
        outcome: 'SAME',
        note: 'Second package-owned normalized observation.',
      },
    };
    const second = await submitA5001(
      app,
      f,
      refreshed,
      secondPayload,
      `a5001-history-2-${crypto.randomUUID()}`
    );
    expect(second.statusCode, second.body).toBe(200);

    const { rows } = await admin.query(
      `SELECT id,revision,supersedes_id,data
         FROM scene_artifacts
        WHERE case_id=$1
          AND artifact_type='DIGITAL_USE_A5001_EFFECT_EVALUATION'
        ORDER BY revision`,
      [f.caseId]
    );
    expect(rows).toHaveLength(2);
    expect(rows[0].revision).toBe(1);
    expect(rows[0].supersedes_id).toBeNull();
    expect(rows[1].revision).toBe(2);
    expect(rows[1].supersedes_id).toBe(rows[0].id);
    expect(rows[0].data.normalizedResponse).toEqual(normalizedReviewResponse);
    expect(rows[1].data.normalizedResponse).toMatchObject({ outcome: 'SAME' });
    expect(rows[0].data.professionalPackage).toMatchObject(TEST_A5001_PACKAGE);
    expect(rows[1].data.professionalPackage).toMatchObject(TEST_A5001_PACKAGE);
  });

  it('T1509 valid Professional package cannot override wrong-Family authorization', async () => {
    provider.restore('FAMILY_ALLIANCE_REVIEW');
    const target = await prepareA5001(app, 'a5001-wrong-family');
    const outsider = await loginWithLabel(app, 'slice15-outsider');
    const outsiderFamily = await createFamily(app, outsider.token, 'slice15-outsider');
    expect(outsiderFamily.statusCode, outsiderFamily.body).toBe(201);

    for (const candidate of [target.f.targetPersonId, outsider.personId, crypto.randomUUID()]) {
      const result = await app.inject({
        method: 'POST',
        url: `/api/v1/cases/${target.f.caseId}/scene/nodes/A5001/responses`,
        headers: {
          ...auth(outsider.token),
          'idempotency-key': `a5001-wrong-family-${crypto.randomUUID()}`,
        },
        payload: {
          targetPersonId: candidate,
          expectedCaseVersion: target.f.caseVersion,
          expectedNodeRevision: 0,
          expectedScenePackageVersion: 'v1',
          expectedSelectionRevision: target.scene.targetSelectionRevision,
          response: target.payload,
        },
      });
      expect(result.statusCode).toBe(404);
      expect(result.json()).toMatchObject({ code: 'CASE_NOT_FOUND' });
    }
    const deniedCommands = await admin.query(
      `SELECT 1 FROM idempotency_keys
        WHERE actor_account_id = $1 AND command_type = 'DIGITAL_USE_NODE_RESPONSE'
          AND idempotency_key LIKE 'a5001-wrong-family-%'`,
      [outsider.accountId]
    );
    expect(deniedCommands.rows).toEqual([]);
    expect(await reviewCounts(target.f, 'A5001')).toMatchObject({
      artifacts: 0,
      completed: 0,
      events: 0,
    });
  });

  it('T1509 Family membership without review action privilege cannot submit', async () => {
    provider.restore('FAMILY_ALLIANCE_REVIEW');
    const target = await prepareA5001(app, 'a5001-member-no-privilege');
    const participant = await loginWithLabel(app, 'slice15-participant-no-privilege');
    await admin.query(
      'INSERT INTO family_members (family_id,person_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
      [target.f.familyId, participant.personId]
    );

    const result = await app.inject({
      method: 'POST',
      url: `/api/v1/cases/${target.f.caseId}/scene/nodes/A5001/responses`,
      headers: {
        ...auth(participant.token),
        'idempotency-key': `a5001-no-privilege-${crypto.randomUUID()}`,
      },
      payload: {
        targetPersonId: target.f.targetPersonId,
        expectedCaseVersion: target.f.caseVersion,
        expectedNodeRevision: 0,
        expectedScenePackageVersion: 'v1',
        expectedSelectionRevision: target.scene.targetSelectionRevision,
        response: target.payload,
      },
    });
    expect([403, 404]).toContain(result.statusCode);
    expect(await reviewCounts(target.f, 'A5001')).toMatchObject({
      artifacts: 0,
      completed: 0,
      events: 0,
    });
  });

  it('T1509 valid Professional package cannot override same-Family participant privilege', async () => {
    provider.restore('FAMILY_ALLIANCE_REVIEW');
    const target = await prepareA5001(app, 'a5001-participant-auth');
    const participant = await loginWithLabel(app, 'slice15-participant-auth');
    const participantOwnFamily = await createFamily(
      app,
      participant.token,
      'slice15-participant-own'
    );
    expect(participantOwnFamily.statusCode, participantOwnFamily.body).toBe(201);
    await admin.query(
      `INSERT INTO family_members (family_id,person_id)
       VALUES ($1,$2) ON CONFLICT DO NOTHING`,
      [target.f.familyId, participant.personId]
    );
    const tokenHash = crypto.randomUUID().replaceAll('-', '').padEnd(64, '0');
    await admin.query(
      `INSERT INTO case_participants
         (family_id,case_id,person_id,state,invite_token_hash,invite_expires_at,
          created_by_person_id,accepted_at)
       VALUES ($1,$2,$3,'ACTIVE',$4,now()+interval '1 day',$5,now())`,
      [
        target.f.familyId,
        target.f.caseId,
        participant.personId,
        tokenHash,
        target.f.manager.personId,
      ]
    );

    const result = await app.inject({
      method: 'POST',
      url: `/api/v1/cases/${target.f.caseId}/scene/nodes/A5001/responses`,
      headers: {
        ...auth(participant.token),
        'idempotency-key': `a5001-participant-${crypto.randomUUID()}`,
      },
      payload: {
        targetPersonId: target.f.targetPersonId,
        expectedCaseVersion: target.f.caseVersion,
        expectedNodeRevision: 0,
        expectedScenePackageVersion: 'v1',
        expectedSelectionRevision: target.scene.targetSelectionRevision,
        response: target.payload,
      },
    });
    expect(result.statusCode).toBe(404);
    expect(result.json()).toMatchObject({ code: 'CASE_NOT_FOUND' });
    expect(await reviewCounts(target.f, 'A5001')).toMatchObject({
      artifacts: 0,
      completed: 0,
      events: 0,
    });
  });

  it('T1509 provenance labels cannot fabricate child-authored input without Evidence-owner proof', async () => {
    provider.restore('FAMILY_ALLIANCE_REVIEW');
    const target = await prepareA5001(app, 'a5001-provenance-forgery');
    const forged = {
      ...target.payload,
      evidenceRefs: [],
      provenance: [{
        kind: 'CHILD_AUTHORED_INPUT',
        sourcePersonId: crypto.randomUUID(),
        sourceMessageId: crypto.randomUUID(),
      }],
    };
    const result = await submitA5001(
      app,
      target.f,
      target.scene,
      forged,
      `a5001-forged-child-${crypto.randomUUID()}`
    );
    expect(result.statusCode).toBe(422);
    expect(result.json()).toMatchObject({ code: 'SCENE_RESPONSE_INVALID' });
    expect(await reviewCounts(target.f, 'A5001')).toMatchObject({
      artifacts: 0,
      completed: 0,
      events: 0,
    });
  });

  it('T1509 valid Professional package cannot override revoked Consent', async () => {
    provider.restore('FAMILY_ALLIANCE_REVIEW');
    const target = await prepareA5001(app, 'a5001-revoked-consent');
    await seedRevokedConsentForTarget(target.f);

    const result = await submitA5001(
      app,
      target.f,
      target.scene,
      target.payload,
      `a5001-revoked-consent-${crypto.randomUUID()}`
    );
    expect(result.statusCode).toBe(409);
    expect(result.json()).toMatchObject({ code: 'CONSENT_BLOCKED' });
    expect(await reviewCounts(target.f, 'A5001')).toMatchObject({
      artifacts: 0,
      completed: 0,
      events: 0,
    });
  });

  it('T1509 valid Professional package cannot override Compliance unavailable/deny', async () => {
    provider.restore('FAMILY_ALLIANCE_REVIEW');
    const target = await prepareA5001(app, 'a5001-compliance-blocked');
    const publisher = new pg.Client({
      connectionString: process.env['MIGRATION_DATABASE_URL'],
    });
    await publisher.connect();

    let blockedVersion: number | null = null;
    try {
      const current = await publisher.query<{ policy_version: number }>(
        `SELECT policy_version
           FROM compliance_feature_policies
          WHERE feature_code='DIGITAL_USE_FAMILY_ALLIANCE_RUNTIME'
            AND feature_contract_revision='v1'
            AND superseded_by_policy_id IS NULL
          ORDER BY policy_version DESC
          LIMIT 1`
      );
      const currentVersion = current.rows[0]?.policy_version;
      if (!currentVersion) throw new Error('missing current Family Alliance compliance policy');
      blockedVersion = currentVersion + 1;

      await publisher.query(
        `SELECT app.publish_compliance_feature_policy(
           'DIGITAL_USE_FAMILY_ALLIANCE_RUNTIME','v1',$1,$2,
           'UNKNOWN','BASELINE','BASELINE','BASELINE','BASELINE',
           NULL,NULL,clock_timestamp() - interval '1 second',
           $3
         )`,
        [
          currentVersion,
          blockedVersion,
          `test:slice15-compliance-blocked:${crypto.randomUUID()}`,
        ]
      );

      const result = await submitA5001(
        app,
        target.f,
        target.scene,
        target.payload,
        `a5001-compliance-blocked-${crypto.randomUUID()}`
      );
      expect(result.statusCode).toBe(409);
      expect(result.json()).toMatchObject({ code: 'COMPLIANCE_BLOCKED' });
      expect(await reviewCounts(target.f, 'A5001')).toMatchObject({
        artifacts: 0,
        completed: 0,
        events: 0,
      });
    } finally {
      if (blockedVersion !== null) {
        const current = await publisher.query<{ policy_version: number }>(
          `SELECT policy_version
             FROM compliance_feature_policies
            WHERE feature_code='DIGITAL_USE_FAMILY_ALLIANCE_RUNTIME'
              AND feature_contract_revision='v1'
              AND superseded_by_policy_id IS NULL
            ORDER BY policy_version DESC
            LIMIT 1`
        );
        const currentVersion = current.rows[0]?.policy_version;
        if (currentVersion === blockedVersion) {
          await publisher.query(
            `SELECT app.publish_compliance_feature_policy(
               'DIGITAL_USE_FAMILY_ALLIANCE_RUNTIME','v1',$1,$2,
               'NOT_APPLICABLE','BASELINE','BASELINE','BASELINE','BASELINE',
               'Slice 15 restored reviewed basis',
               'evidence://slice15/compliance-restored',
               clock_timestamp(),$3
             )`,
            [
              currentVersion,
              currentVersion + 1,
              `test:slice15-compliance-restore:${crypto.randomUUID()}`,
            ]
          );
        }
      }
      await publisher.end().catch(() => undefined);
    }
  });

  it('T1509 valid Professional package cannot override DISABLED account authority', async () => {
    provider.restore('FAMILY_ALLIANCE_REVIEW');
    const target = await prepareA5001(app, 'a5001-disabled-account');
    await admin.query(
      `UPDATE accounts
          SET status='DISABLED',session_epoch=session_epoch+1
        WHERE id=$1`,
      [target.f.manager.accountId]
    );

    const result = await submitA5001(
      app,
      target.f,
      target.scene,
      target.payload,
      `a5001-disabled-${crypto.randomUUID()}`
    );
    expect(result.statusCode).toBe(401);
    expect(await reviewCounts(target.f, 'A5001')).toMatchObject({
      artifacts: 0,
      completed: 0,
      events: 0,
    });
  });

  it('T1509 stale Problem Formulation and Safety Hold fail closed with zero A5001 professional truth', async () => {
    provider.restore('FAMILY_ALLIANCE_REVIEW');

    const stale = await prepareA5001(app, 'a5001-stale-formulation');
    await admin.query(
      `UPDATE problem_formulations
          SET review_state='NEEDS_REVIEW'
        WHERE case_id=$1 AND status='CONFIRMED'`,
      [stale.f.caseId]
    );
    const staleResult = await submitA5001(
      app,
      stale.f,
      stale.scene,
      stale.payload,
      `a5001-stale-${crypto.randomUUID()}`
    );
    expect(staleResult.statusCode).toBe(409);
    expect(await reviewCounts(stale.f, 'A5001')).toMatchObject({
      artifacts: 0,
      completed: 0,
      events: 0,
    });

    const safety = await prepareA5001(app, 'a5001-safety-hold');
    await admin.query("UPDATE cases SET status='SAFETY_HOLD' WHERE id=$1", [
      safety.f.caseId,
    ]);
    const safetyResult = await submitA5001(
      app,
      safety.f,
      safety.scene,
      safety.payload,
      `a5001-safety-${crypto.randomUUID()}`
    );
    expect(safetyResult.statusCode).toBe(409);
    expect(safetyResult.json()).toMatchObject({ code: 'SAFETY_HOLD_BLOCKED' });
    expect(await reviewCounts(safety.f, 'A5001')).toMatchObject({
      artifacts: 0,
      completed: 0,
      events: 0,
    });
  });
});
