import * as complianceRepository from '@xiaoshuyin/compliance';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import pg from 'pg';
import { buildApp } from '../../apps/server/api/src/app.js';
import { withRlsTransaction } from '../../apps/server/api/src/db/tx.js';
import { insertDigitalUseAssessmentTarget } from '@xiaoshuyin/domain';
import { recordStatement } from '@xiaoshuyin/domain';
import { resolveDigitalUseRuntimeNode } from '@xiaoshuyin/scenes/digital-use';
import {
  buildConsentEvidence,
  getAcceptanceTextHash,
  getCurrentNoticeHash,
  runtimeConsentChannel,
} from '@xiaoshuyin/compliance';
import { createAdminPool } from '../setup/db.js';
import {
  auth,
  commandHeaders,
  createFamily,
  createMember,
  revokeConsent,
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

const TARGET_PATHS = [
  { code: 'SLEEP', nodes: ['A3010','A3011','A3012','A3013'] },
  { code: 'EXERCISE', nodes: ['A3020','A3021','A3022','A3033'] },
  { code: 'HOBBIES', nodes: ['A3040','A3041','A3042','A3043'] },
  { code: 'CHORES', nodes: ['A3050','A3051','A3052','A3053'] },
  { code: 'FAMILY_GATHERING', nodes: ['A3060','A3061','A3062','A3063'] },
  { code: 'OUTDOOR_ACTIVITY', nodes: ['A3070','A3071','A3072','A3073'] },
  { code: 'EMOTION_REGULATION_1', nodes: ['A3080','A3081','A3082','A3083'] },
  { code: 'TIME_MANAGEMENT', nodes: ['A3090','A3091','A3092','A3093'] },
  { code: 'FAMILY_RELATIONSHIP', nodes: ['A3100','A3101','A3102','A3103'] },
  { code: 'EMOTION_REGULATION_2', nodes: ['A3110','A3111','A3112','A3113'] },
] as const;

describe('Slice 13 FAMILY_ALLIANCE canonical runtime', () => {
  let app: FastifyInstance;
  let admin: pg.Pool;
  let appDb: pg.Pool;
  let migrator: pg.Client;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
    admin = createAdminPool();
    appDb = new pg.Pool({ connectionString: process.env['DATABASE_URL']! });
    migrator = new pg.Client({
      connectionString: process.env['MIGRATION_DATABASE_URL'],
    });
    await migrator.connect();
    await migrator.query(
      `SELECT app.publish_compliance_feature_policy(
         'DIGITAL_USE_ASSESSMENT_RUNTIME','v1',NULL,1,
         'NOT_APPLICABLE','BASELINE','BASELINE','BASELINE','BASELINE',
         'Slice 13 assessment target basis','evidence://slice13/assessment-target',
         now() - interval '1 minute','migration:slice13-assessment-target'
       )`
    );
    await migrator.query(
      `SELECT app.publish_compliance_feature_policy(
         'DIGITAL_USE_FAMILY_ALLIANCE_RUNTIME','v1',NULL,1,
         'NOT_APPLICABLE','BASELINE','BASELINE','BASELINE','BASELINE',
         'Slice 13 integration reviewed basis','evidence://slice13/integration',
         now() - interval '1 minute','migration:slice13-integration'
       )`
    );
  });

  afterAll(async () => {
    await admin.query(
      `UPDATE compliance_feature_policies
          SET superseded_by_policy_id = NULL
        WHERE feature_code IN ('DIGITAL_USE_FAMILY_ALLIANCE_RUNTIME','DIGITAL_USE_ASSESSMENT_RUNTIME')
          AND feature_contract_revision='v1'`
    ).catch(() => undefined);
    await admin.query(
      `DELETE FROM compliance_feature_policies
        WHERE feature_code IN ('DIGITAL_USE_FAMILY_ALLIANCE_RUNTIME','DIGITAL_USE_ASSESSMENT_RUNTIME')
          AND feature_contract_revision='v1'`
    ).catch(() => undefined);
    await appDb.end().catch(() => undefined);
    await migrator.end().catch(() => undefined);
    await admin.end().catch(() => undefined);
    await app.close();
  });

  async function seedAssessmentEvidence(
    f: Fixture,
    emotion: readonly string[] = ['A'],
    family = 'A'
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

  async function fixture(label: string): Promise<Fixture> {
    const manager = await loginWithLabel(app, `fa-${label}`);
    const family = await createFamily(app, manager.token, `fa-${label}`);
    expect(family.statusCode, family.body).toBe(201);
    const familyId = family.json().id as string;
    const child = await createMember(app, manager.token, familyId, `r3-target-${label}`, {
      ageBand: 'MINOR_14_17', ageBandSource: 'OTHER_MEMBER_RELAY',
    });
    expect(child.statusCode, child.body).toBe(201);
    const targetPersonId = child.json().personId as string;

    const kase = await createCase(app, manager.token, `fa-${label}`);
    expect(kase.statusCode, kase.body).toBe(201);
    const caseId = kase.json().id as string;
    const caseVersion = kase.json().version as number;
    await withRlsTransaction(appDb, {
      familyId, accountId: manager.accountId, personId: manager.personId, purpose: 'FAMILY_MANAGEMENT',
    }, tx => insertDigitalUseAssessmentTarget(tx, caseId, familyId, targetPersonId, manager.personId));

    const message = await app.inject({
      method: 'POST',
      url: `/api/v1/cases/${caseId}/messages`,
      headers: commandHeaders(manager.token, `fa-msg-${label}`),
      payload: { content: 'Digital use is causing a current family problem.' },
    });
    expect(message.statusCode, message.body).toBe(201);
    const messageId = message.json().id as string;

    const a1001 = resolveDigitalUseRuntimeNode('A1001');
    const a2010 = resolveDigitalUseRuntimeNode('A2010');
    await admin.query('BEGIN');
    try {
      await admin.query(
        `UPDATE cases SET phase='GOALS' WHERE id=$1`,
        [caseId]
      );
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
      for (const node of [a1001, a2010]) {
        await admin.query(
          `INSERT INTO scene_node_states
             (family_id,case_id,scene_package_version,node_code,source_node_code,
              status,branch_reason_codes,input_refs,output_refs,revision,completed_at)
           VALUES ($1,$2,'v1',$3,$4,'COMPLETED',ARRAY['SLICE13_FIXTURE'],
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
    await seedAssessmentEvidence(f);
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
    key = `fa-${nodeCode.toLowerCase()}-${crypto.randomUUID()}`
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

  function sleepFeasibility(concreteTargetText: string) {
    return {
      kind: 'FEASIBILITY',
      feasibility: {
        problemBehavior: {
          concreteBehavior: { state: 'KNOWN', text: 'Current sleep-related phone behaviour' },
          need: { state: 'KNOWN', text: 'Immediate entertainment need' },
          motivationBenefit: { state: 'KNOWN', text: 'Immediate enjoyment' },
          abilityConditions: { state: 'KNOWN', text: 'Phone remains available' },
          challengeResistance: { state: 'UNKNOWN' },
        },
        replacementBehavior: {
          concreteQuantified: { state: 'KNOWN', concreteTargetText },
          need: { state: 'KNOWN', rating: 8 },
          motivationBenefit: { state: 'KNOWN', rating: 7 },
          abilityPossibility: { state: 'KNOWN', rating: 6 },
          challengeResistance: { state: 'UNKNOWN' },
        },
      },
    };
  }

  function sleepProgress(note: string) {
    return {
      kind: 'PROGRESS',
      progress: {
        kind: 'GENERAL_MATRIX',
        taskPlan: { state: 'KNOWN', text: 'SLEEP execution plan.' },
        communication: {
          needMatch: { state: 'KNOWN', text: 'Need discussed.' },
          motivationMatch: { state: 'KNOWN', text: 'Motivation discussed.' },
          abilityMatch: { state: 'KNOWN', text: 'Ability discussed.' },
          challengeResistance: { state: 'KNOWN', text: 'Barrier discussed.' },
        },
        childFeedback: {
          needMatch: { state: 'KNOWN', text: 'Need feedback.' },
          motivationMatch: { state: 'KNOWN', text: 'Motivation feedback.' },
          abilityMatch: { state: 'KNOWN', text: 'Ability feedback.' },
          challengeResistance: { state: 'KNOWN', text: 'Barrier feedback.' },
        },
        userObservation: {
          needMatch: { state: 'KNOWN', text: 'Observed need.' },
          motivationMatch: { state: 'KNOWN', text: 'Observed motivation.' },
          abilityMatch: { state: 'KNOWN', text: 'Observed ability.' },
          challengeResistance: { state: 'KNOWN', text: 'Observed barrier.' },
        },
        otherFamilyFeedback: {
          needMatch: { state: 'NOT_COLLECTED' },
          motivationMatch: { state: 'NOT_COLLECTED' },
          abilityMatch: { state: 'NOT_COLLECTED' },
          challengeResistance: { state: 'NOT_COLLECTED' },
        },
        modifyTarget: 'NO',
      },
      note,
    };
  }

  it('AUTH-006: confirmed NEEDS_REVIEW formulation blocks FAMILY_ALLIANCE without global Case pause', async () => {
    const f = await fixture('auth006-review');

    await admin.query(
      `UPDATE problem_formulations
          SET review_state='NEEDS_REVIEW'
        WHERE case_id=$1 AND status='CONFIRMED'`,
      [f.caseId]
    );

    const blocked = await respond(f, 'A3000', selfAssessment('YES'));
    expect(blocked.statusCode, blocked.body).toBe(409);
    expect(blocked.json()).toMatchObject({ code: 'PROBLEM_FORMULATION_REQUIRED' });

    const formulation = await admin.query(
      'SELECT status::text AS status, review_state::text AS review_state FROM problem_formulations WHERE case_id=$1',
      [f.caseId]
    );
    expect(formulation.rows[0]).toEqual({
      status: 'CONFIRMED',
      review_state: 'NEEDS_REVIEW',
    });

    const kase = await admin.query(
      'SELECT status::text AS status, phase::text AS phase FROM cases WHERE id=$1',
      [f.caseId]
    );
    expect(kase.rows[0]).toEqual({ status: 'OPEN', phase: 'GOALS' });
  });

  it('authorizes the manager and independently gates the bound target before writing', async () => {
    const allowed = await fixture('authorized-distinct-target');
    expect(allowed.manager.personId).not.toBe(allowed.targetPersonId);
    const actor = await admin.query(
      `SELECT guardian_consent_record_id FROM person_compliance_profiles WHERE person_id=$1`,
      [allowed.manager.personId]
    );
    expect(actor.rows[0]?.guardian_consent_record_id ?? null).toBeNull();
    const success = await respond(allowed, 'A3000', selfAssessment());
    expect(success.statusCode, success.body).toBe(200);
    expect(success.json().nodes.find((node: any) => node.nodeCode === 'A3000')?.status)
      .toBe('COMPLETED');

    const blocked = await fixture('authorized-invalid-target');
    await admin.query(
      `UPDATE person_compliance_profiles SET age_band='UNKNOWN', minor_mode=false WHERE person_id=$1`,
      [blocked.targetPersonId]
    );
    const snapshot = () => admin.query(
      `SELECT
         (SELECT to_jsonb(c) FROM cases c WHERE c.id=$1) AS case_row,
         (SELECT jsonb_agg(to_jsonb(n) ORDER BY n.node_code) FROM scene_node_states n WHERE n.case_id=$1) AS nodes,
         (SELECT count(*) FROM assertions WHERE case_id=$1) AS assertion_count,
         (SELECT count(*) FROM consent_records WHERE case_id=$1) AS consent_count`,
      [blocked.caseId]
    );
    const before = await snapshot();
    const failure = await respond(blocked, 'A3000', selfAssessment());
    expect(failure.statusCode, failure.body).toBe(409);
    expect(failure.json().code).toBe('COMPLIANCE_BLOCKED');
    expect((await snapshot()).rows).toEqual(before.rows);
  });

  it('AS-01..AS-13 executes legal entry, parallel target management and all ten exact target families', async () => {
    const f = await fixture('canonical');

    const a3000 = await respond(f, 'A3000', selfAssessment('NO'));
    expect(a3000.statusCode, a3000.body).toBe(200);
    let body = a3000.json();
    expect(body.activeNodes.map((node: any) => node.nodeCode))
      .toEqual(expect.arrayContaining(['A3001','A3002']));
    expect(body.nodes.find((node: any) => node.nodeCode === 'A3000')?.status)
      .toBe('COMPLETED');

    // A3002 is legal while A3001 remains incomplete.
    const a3002 = await respond(
      f,
      'A3002',
      {
        kind: 'TARGET_SELECTION',
        confirmed: true,
        selectedTargets: TARGET_PATHS.map((target) => target.code),
      },
      { expectedSelectionRevision: 0 }
    );
    expect(a3002.statusCode, a3002.body).toBe(200);
    body = a3002.json();
    expect(body.nodes.find((node: any) => node.nodeCode === 'A3001')?.status)
      .toBe('AVAILABLE');
    expect(body.targetSelectionRevision).toBeGreaterThan(0);
    expect(body.targets.filter((target: any) => target.selected)).toHaveLength(10);

    for (const family of TARGET_PATHS) {
      let target = body.targets.find((item: any) => item.targetCode === family.code);
      expect(target?.selected, family.code).toBe(true);

      const targetResponse = await respond(
        f,
        family.nodes[0],
        {
          kind: 'TARGET_DEFINITION',
          concreteTargetText: `${family.code} concrete family target`,
        },
        {
          expectedSelectionRevision: target.selectionRevision,
          expectedTargetRevision: target.revision,
        }
      );
      expect(targetResponse.statusCode, `${family.nodes[0]} ${targetResponse.body}`).toBe(200);
      body = targetResponse.json();
      target = body.targets.find((item: any) => item.targetCode === family.code);

      const feasibilityResponse = await respond(
        f,
        family.nodes[1],
        {
          kind: 'FEASIBILITY',
          feasibility: {
            problemBehavior: {
              concreteBehavior: { state: 'KNOWN', text: `${family.code} current problem behaviour` },
              need: { state: 'KNOWN', text: 'Current behaviour serves an immediate need.' },
              motivationBenefit: { state: 'KNOWN', text: 'Current behaviour has short-term benefit.' },
              abilityConditions: { state: 'KNOWN', text: 'Current conditions make it easy to repeat.' },
              challengeResistance: { state: 'UNKNOWN' },
            },
            replacementBehavior: {
              concreteQuantified: {
                state: 'KNOWN',
                concreteTargetText: `${family.code} measurable target`,
              },
              need: { state: 'KNOWN', rating: 8 },
              motivationBenefit: { state: 'KNOWN', rating: 7 },
              abilityPossibility: { state: 'KNOWN', rating: 6 },
              challengeResistance: { state: 'UNKNOWN' },
            },
          },
        },
        {
          expectedSelectionRevision: target.selectionRevision,
          expectedTargetRevision: target.revision,
        }
      );
      expect(feasibilityResponse.statusCode, `${family.nodes[1]} ${feasibilityResponse.body}`).toBe(200);
      body = feasibilityResponse.json();
      target = body.targets.find((item: any) => item.targetCode === family.code);
      expect(target.feasibility.problemBehavior.concreteBehavior).toMatchObject({
        state: 'KNOWN',
      });
      expect(target.feasibility.replacementBehavior.need).toMatchObject({
        state: 'KNOWN',
        rating: 8,
      });
      expect(target.feasibility).not.toHaveProperty('score');
      expect(target.feasibility).not.toHaveProperty('cutoff');
      expect(target.sourceRefs).toEqual(
        expect.arrayContaining([expect.objectContaining({ type: 'ASSERTION' })])
      );

      if (family.code === 'EXERCISE') {
        // AS-19 (positive half): now that EXERCISE has completed its own TARGET
        // and FEASIBILITY, its PROGRESS node A3022 becomes materially reachable.
        expect(
          body.nodes.find((node: any) => node.nodeCode === 'A3022')?.status
        ).toBe('AVAILABLE');
      }

      const progressResponse = await respond(
        f,
        family.nodes[2],
        {
          kind: 'PROGRESS',
          progress: family.code === 'EMOTION_REGULATION_1'
            ? {
                kind: 'EMOTION_REGULATION_1',
                listening: { state: 'KNOWN', count: 3 },
                affirmation: {
                  state: 'KNOWN',
                  observations: ['affirmed effort', 'affirmed feeling', 'affirmed choice'],
                },
                reducedEvaluation: { state: 'KNOWN', count: 2 },
                selfRegulationJournal: { state: 'KNOWN', text: 'Stayed calm before responding.' },
                selfCare: {
                  state: 'KNOWN',
                  durationMinutes: 30,
                  activities: ['walk'],
                },
                effectEvaluation: {
                  intrinsicMotivation: { state: 'KNOWN', text: 'More self-started behaviour.' },
                  selfEsteemConfidence: { state: 'KNOWN', text: 'More confidence reported.' },
                  abilityPotential: { state: 'KNOWN', text: 'Can complete the replacement behaviour.' },
                },
                modifyTarget: 'NO',
              }
            : family.code === 'EMOTION_REGULATION_2'
              ? {
                  kind: 'EMOTION_REGULATION_2_LOG',
                  entries: [{
                    time: '2026-11-16 evening',
                    childEmotion: { state: 'KNOWN', text: 'Frustrated' },
                    emotionFeedback: { state: 'KNOWN', text: 'Parent reflected the emotion.' },
                    childStress: { state: 'KNOWN', text: 'Stress reduced after discussion.' },
                    selfGrowth: { state: 'KNOWN', text: 'Parent paused before reacting.' },
                  }],
                  modifyTarget: 'NO',
                }
              : {
                  kind: 'GENERAL_MATRIX',
                  taskPlan: { state: 'KNOWN', text: `${family.code} weekly task plan` },
                  communication: {
                    needMatch: { state: 'KNOWN', text: 'Need discussed.' },
                    motivationMatch: { state: 'KNOWN', text: 'Motivation discussed.' },
                    abilityMatch: { state: 'KNOWN', text: 'Ability discussed.' },
                    challengeResistance: { state: 'KNOWN', text: 'Resistance discussed.' },
                  },
                  childFeedback: {
                    needMatch: { state: 'KNOWN', text: 'Child says need is addressed.' },
                    motivationMatch: { state: 'KNOWN', text: 'Child sees benefit.' },
                    abilityMatch: { state: 'KNOWN', text: 'Child can attempt it.' },
                    challengeResistance: { state: 'KNOWN', text: 'Child named one barrier.' },
                  },
                  userObservation: {
                    needMatch: { state: 'KNOWN', text: 'Observed need fit.' },
                    motivationMatch: { state: 'KNOWN', text: 'Observed motivation fit.' },
                    abilityMatch: { state: 'KNOWN', text: 'Observed ability fit.' },
                    challengeResistance: { state: 'KNOWN', text: 'Observed barrier.' },
                  },
                  otherFamilyFeedback: {
                    needMatch: { state: 'NOT_COLLECTED' },
                    motivationMatch: { state: 'NOT_COLLECTED' },
                    abilityMatch: { state: 'NOT_COLLECTED' },
                    challengeResistance: { state: 'NOT_COLLECTED' },
                  },
                  modifyTarget: 'NO',
                },
          note: `${family.code} current execution observation`,
        },
        {
          expectedSelectionRevision: target.selectionRevision,
          expectedTargetRevision: target.revision,
        }
      );
      expect(progressResponse.statusCode, `${family.nodes[2]} ${progressResponse.body}`).toBe(200);
      body = progressResponse.json();
      target = body.targets.find((item: any) => item.targetCode === family.code);
      expect(target.progressEvidenceRefs.length).toBeGreaterThanOrEqual(1);
      if (family.code === 'EMOTION_REGULATION_1') {
        expect(target.progress).toMatchObject({
          kind: 'EMOTION_REGULATION_1',
          affirmation: {
            state: 'KNOWN',
            observations: ['affirmed effort', 'affirmed feeling', 'affirmed choice'],
          },
        });
      } else if (family.code === 'EMOTION_REGULATION_2') {
        expect(target.progress).toMatchObject({
          kind: 'EMOTION_REGULATION_2_LOG',
          entries: [
            expect.objectContaining({
              childEmotion: { state: 'KNOWN', text: 'Frustrated' },
              selfGrowth: { state: 'KNOWN', text: 'Parent paused before reacting.' },
            }),
          ],
        });
      } else {
        expect(target.progress).toMatchObject({
          kind: 'GENERAL_MATRIX',
          communication: {
            needMatch: { state: 'KNOWN', text: 'Need discussed.' },
          },
          otherFamilyFeedback: {
            needMatch: { state: 'NOT_COLLECTED' },
          },
        });
      }
      if (family.code === 'SLEEP') {
        // AS-19: one target may have progress while the others remain
        // independently reachable; no false stream-global completion exists.
        // SLEEP is the first family in TARGET_PATHS, so EXERCISE has not
        // completed its own TARGET + FEASIBILITY yet: a target's readiness is
        // never shared across targets, so A3022 must not be materialized here.
        expect(body.nodes.map((node: any) => node.nodeCode)).not.toContain('A3022');
      }

      const helpResponse = await respond(
        f,
        family.nodes[3],
        {
          kind: 'HELP',
          action: 'VIEWED',
          note: `${family.code} help context`,
        },
        {
          expectedSelectionRevision: target.selectionRevision,
          expectedTargetRevision: target.revision,
        }
      );
      expect(helpResponse.statusCode, `${family.nodes[3]} ${helpResponse.body}`).toBe(200);
      body = helpResponse.json();
      target = body.targets.find((item: any) => item.targetCode === family.code);
      expect(target.helpHistoryRefs).toHaveLength(1);
      expect(target.helpHistoryRefs[0]).toMatchObject({
        nodeCode: family.nodes[3],
        scenePackageVersion: 'v1',
      });
      expect(target.helpHistoryRefs[0].interactionRefs.length).toBeGreaterThan(0);
      expect(target.helpHistoryRefs[0].authorityRefs.length).toBeGreaterThan(0);
    }

    const semanticReadback = await admin.query<{
      target_code: string;
      feasibility_payload: any;
      progress_payload: any;
      help_history_refs: any[];
    }>(
      `SELECT target_code, feasibility_payload, progress_payload, help_history_refs
         FROM digital_use_target_items
        WHERE case_id=$1
          AND superseded_at IS NULL
          AND selected=true
        ORDER BY target_code`,
      [f.caseId]
    );
    expect(semanticReadback.rows).toHaveLength(10);
    const sleepReadback = semanticReadback.rows.find((row) => row.target_code === 'SLEEP')!;
    expect(sleepReadback.feasibility_payload.problemBehavior.concreteBehavior.state)
      .toBe('KNOWN');
    expect(sleepReadback.feasibility_payload.replacementBehavior.need.rating).toBe(8);
    expect(sleepReadback.progress_payload.kind).toBe('GENERAL_MATRIX');
    expect(sleepReadback.help_history_refs[0].authorityRefs.length).toBeGreaterThan(0);
    expect(sleepReadback.help_history_refs[0].contentRef).toMatchObject({
      nodeCode: 'A3013',
      contentVersion: 'family-alliance-product-v1',
      sourceBlob: '8eb660cd905d8fba4b52fe0f74bbc214b3113117',
    });

    const er1Readback = semanticReadback.rows.find(
      (row) => row.target_code === 'EMOTION_REGULATION_1'
    )!;
    expect(er1Readback.progress_payload.kind).toBe('EMOTION_REGULATION_1');
    expect(er1Readback.progress_payload.affirmation.observations).toHaveLength(3);

    const er2Readback = semanticReadback.rows.find(
      (row) => row.target_code === 'EMOTION_REGULATION_2'
    )!;
    expect(er2Readback.progress_payload.kind).toBe('EMOTION_REGULATION_2_LOG');
    expect(er2Readback.progress_payload.entries[0].childStress.state).toBe('KNOWN');

    // A3001 can still complete after A3002 and all target-family activity.
    const a3001 = await respond(f, 'A3001', {
      kind: 'COMMUNICATION_PREP',
      action: 'ACKNOWLEDGED',
    });
    expect(a3001.statusCode, a3001.body).toBe(200);

    const history = await admin.query<{ target_code: string; n: number }>(
      `SELECT target_code, count(*)::int AS n
         FROM digital_use_target_items
        WHERE case_id=$1
        GROUP BY target_code
        ORDER BY target_code`,
      [f.caseId]
    );
    expect(history.rows).toHaveLength(10);
    expect(history.rows.every((row) => row.n === 5)).toBe(true);

    const forbidden = await admin.query<{ n: number }>(
      `SELECT
         (SELECT count(*)::int FROM scene_node_states
           WHERE case_id=$1 AND node_code IN ('A3023','A3030','A3031','A3032')) +
         (SELECT count(*)::int FROM scene_node_states
           WHERE case_id=$1 AND node_code LIKE 'A40%') AS n`,
      [f.caseId]
    );
    expect(forbidden.rows[0]!.n).toBe(0);
  });

  it('AS-03/06/09/38 preserves A3000, A3002 and help/reselection history on re-entry', async () => {
    const f = await fixture('reentry');
    const first = await respond(f, 'A3000', selfAssessment('YES'));
    expect(first.statusCode, first.body).toBe(200);

    let selection = await respond(
      f,
      'A3002',
      { kind: 'TARGET_SELECTION', confirmed: true, selectedTargets: ['SLEEP','EXERCISE'] },
      { expectedSelectionRevision: 0 }
    );
    expect(selection.statusCode, selection.body).toBe(200);
    let body = selection.json();
    let sleep = body.targets.find((item: any) => item.targetCode === 'SLEEP');

    // #13 Layer 1 fix: TARGET_DEFINITION (A3010) must precede FEASIBILITY (A3011),
    // and FEASIBILITY must precede PROGRESS (A3012).
    const targetDef = await respond(
      f,
      'A3010',
      { kind: 'TARGET_DEFINITION', concreteTargetText: 'SLEEP concrete target for re-entry test' },
      { expectedSelectionRevision: sleep.selectionRevision, expectedTargetRevision: sleep.revision }
    );
    expect(targetDef.statusCode, targetDef.body).toBe(200);
    body = targetDef.json();
    sleep = body.targets.find((item: any) => item.targetCode === 'SLEEP');

    const feasibility = await respond(
      f,
      'A3011',
      {
        kind: 'FEASIBILITY',
        feasibility: {
          problemBehavior: {
            concreteBehavior: { state: 'KNOWN', text: 'Current sleep-related phone behaviour' },
            need: { state: 'KNOWN', text: 'Immediate entertainment need' },
            motivationBenefit: { state: 'KNOWN', text: 'Immediate enjoyment' },
            abilityConditions: { state: 'KNOWN', text: 'Phone remains available' },
            challengeResistance: { state: 'UNKNOWN' },
          },
          replacementBehavior: {
            concreteQuantified: { state: 'KNOWN', concreteTargetText: 'Sleep by 22:00 on school nights' },
            need: { state: 'KNOWN', rating: 8 },
            motivationBenefit: { state: 'KNOWN', rating: 7 },
            abilityPossibility: { state: 'KNOWN', rating: 6 },
            challengeResistance: { state: 'UNKNOWN' },
          },
        },
      },
      { expectedSelectionRevision: sleep.selectionRevision, expectedTargetRevision: sleep.revision }
    );
    expect(feasibility.statusCode, feasibility.body).toBe(200);
    body = feasibility.json();
    sleep = body.targets.find((item: any) => item.targetCode === 'SLEEP');

    const progress = await respond(
      f,
      'A3012',
      {
        kind: 'PROGRESS',
        progress: {
          kind: 'GENERAL_MATRIX',
          taskPlan: { state: 'KNOWN', text: 'Sleep execution plan' },
          communication: {
            needMatch: { state: 'KNOWN', text: 'Need discussed.' },
            motivationMatch: { state: 'KNOWN', text: 'Motivation discussed.' },
            abilityMatch: { state: 'KNOWN', text: 'Ability discussed.' },
            challengeResistance: { state: 'KNOWN', text: 'Barrier discussed.' },
          },
          childFeedback: {
            needMatch: { state: 'KNOWN', text: 'Need feedback.' },
            motivationMatch: { state: 'KNOWN', text: 'Motivation feedback.' },
            abilityMatch: { state: 'KNOWN', text: 'Ability feedback.' },
            challengeResistance: { state: 'KNOWN', text: 'Barrier feedback.' },
          },
          userObservation: {
            needMatch: { state: 'KNOWN', text: 'Observed need.' },
            motivationMatch: { state: 'KNOWN', text: 'Observed motivation.' },
            abilityMatch: { state: 'KNOWN', text: 'Observed ability.' },
            challengeResistance: { state: 'KNOWN', text: 'Observed barrier.' },
          },
          otherFamilyFeedback: {
            needMatch: { state: 'NOT_COLLECTED' },
            motivationMatch: { state: 'NOT_COLLECTED' },
            abilityMatch: { state: 'NOT_COLLECTED' },
            challengeResistance: { state: 'NOT_COLLECTED' },
          },
          modifyTarget: 'NO',
        },
        note: 'first sleep progress',
      },
      {
        expectedSelectionRevision: sleep.selectionRevision,
        expectedTargetRevision: sleep.revision,
      }
    );
    expect(progress.statusCode, progress.body).toBe(200);
    body = progress.json();
    sleep = body.targets.find((item: any) => item.targetCode === 'SLEEP');

    const help = await respond(
      f,
      'A3013',
      { kind: 'HELP', action: 'VIEWED' },
      {
        expectedSelectionRevision: sleep.selectionRevision,
        expectedTargetRevision: sleep.revision,
      }
    );
    expect(help.statusCode, help.body).toBe(200);

    const reassess = await respond(f, 'A3000', selfAssessment('NO'));
    expect(reassess.statusCode, reassess.body).toBe(200);

    body = reassess.json();
    const currentSelection = body.targetSelectionRevision;
    selection = await respond(
      f,
      'A3002',
      { kind: 'TARGET_SELECTION', confirmed: true, selectedTargets: ['EXERCISE'] },
      { expectedSelectionRevision: currentSelection }
    );
    expect(selection.statusCode, selection.body).toBe(200);

    const artifacts = await admin.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM scene_artifacts
        WHERE case_id=$1
          AND artifact_type='FAMILY_ALLIANCE_SELF_ASSESSMENT'`,
      [f.caseId]
    );
    expect(artifacts.rows[0]!.n).toBe(2);

    const sleepHistory = await admin.query<{
      selected: boolean;
      progress_payload: unknown;
      help_history_refs: unknown[];
    }>(
      `SELECT selected,progress_payload,help_history_refs
         FROM digital_use_target_items
        WHERE case_id=$1 AND target_code='SLEEP'
        ORDER BY revision`,
      [f.caseId]
    );
    expect(sleepHistory.rows.length).toBeGreaterThanOrEqual(4);
    expect(sleepHistory.rows.some((row) => row.progress_payload !== null)).toBe(true);
    expect(sleepHistory.rows.some((row) => row.help_history_refs.length > 0)).toBe(true);
    expect(sleepHistory.rows.at(-1)!.selected).toBe(false);
  });

  it('AS-14/15 rejects fabricated target codes and client-owned next-node control', async () => {
    const f = await fixture('attacks');
    expect((await respond(f, 'A3000', selfAssessment())).statusCode).toBe(200);

    const badTarget = await respond(
      f,
      'A3002',
      {
        kind: 'TARGET_SELECTION',
        confirmed: true,
        selectedTargets: ['A3023'],
      },
      { expectedSelectionRevision: 0 }
    );
    expect(badTarget.statusCode, badTarget.body).toBe(422);
    expect(badTarget.json().code).toBe('SCENE_RESPONSE_INVALID');

    const forcedNext = await respond(
      f,
      'A3002',
      {
        kind: 'TARGET_SELECTION',
        confirmed: true,
        selectedTargets: ['SLEEP'],
        nextNode: 'A3011',
      },
      { expectedSelectionRevision: 0 }
    );
    expect(forcedNext.statusCode, forcedNext.body).toBe(422);
    expect(forcedNext.json().code).toBe('SCENE_RESPONSE_INVALID');

    const fabricatedNode = await app.inject({
      method: 'POST',
      url: `/api/v1/cases/${f.caseId}/scene/nodes/A3023/responses`,
      headers: {
        ...auth(f.manager.token),
        'idempotency-key': `fa-fabricated-${crypto.randomUUID()}`,
      },
      payload: {
        targetPersonId: f.targetPersonId,
        expectedCaseVersion: f.caseVersion,
        expectedNodeRevision: 1,
        expectedScenePackageVersion: 'v1',
        response: { kind: 'HELP', action: 'VIEWED' },
      },
    });
    expect(fabricatedNode.statusCode).toBeGreaterThanOrEqual(400);
  });

  it('AS-05/31/32/33 gives stable idempotent A3002 semantics and one current selection truth', async () => {
    const f = await fixture('idempotency');
    expect((await respond(f, 'A3000', selfAssessment())).statusCode).toBe(200);
    const scene = await getScene(f);
    const a3002 = scene.nodes.find((node: any) => node.nodeCode === 'A3002');
    const key = `fa-idem-${crypto.randomUUID()}`;
    const payload = {
      targetPersonId: f.targetPersonId,
      expectedCaseVersion: f.caseVersion,
      expectedNodeRevision: a3002.revision,
      expectedScenePackageVersion: 'v1',
      expectedSelectionRevision: 0,
      response: {
        kind: 'TARGET_SELECTION',
        confirmed: true,
        selectedTargets: ['SLEEP'],
      },
    };
    const request = (commandKey = key) => app.inject({
      method: 'POST',
      url: `/api/v1/cases/${f.caseId}/scene/nodes/A3002/responses`,
      headers: { ...auth(f.manager.token), 'idempotency-key': commandKey },
      payload,
    });
    const first = await request();
    const replay = await request();
    expect(first.statusCode, first.body).toBe(200);
    expect(replay.statusCode, replay.body).toBe(200);
    expect(replay.json()).toEqual(first.json());

    const mismatch = await app.inject({
      method: 'POST',
      url: `/api/v1/cases/${f.caseId}/scene/nodes/A3002/responses`,
      headers: { ...auth(f.manager.token), 'idempotency-key': key },
      payload: {
        ...payload,
        response: {
          kind: 'TARGET_SELECTION',
          confirmed: true,
          selectedTargets: ['EXERCISE'],
        },
      },
    });
    expect(mismatch.statusCode, mismatch.body).toBe(409);
    expect(mismatch.json().code).toBe('IDEMPOTENCY_PAYLOAD_MISMATCH');

    const effects = async () => (await admin.query(
      `SELECT
        (SELECT count(*) FROM assertions WHERE case_id=$1) AS evidence,
        (SELECT count(*) FROM scene_artifacts WHERE case_id=$1) AS artifacts,
        (SELECT count(*) FROM case_events WHERE case_id=$1) AS events,
        (SELECT count(*) FROM business_audit_events WHERE resource_id::text=$1::text) AS audits`,
      [f.caseId]
    )).rows;
    const beforeComplianceChange = await effects();
    await admin.query(
      "UPDATE person_compliance_profiles SET age_band='ADULT', minor_mode=false, verified_source='SELF_STATEMENT' WHERE person_id=$1",
      [f.targetPersonId]
    );
    const historical = await request();
    expect(historical.statusCode, historical.body).toBe(200);
    expect(historical.json()).toEqual(first.json());
    const blocked = await request(`${key}-new`);
    expect(blocked.json().code, blocked.body).toBe('COMPLIANCE_BLOCKED');
    expect(await effects()).toEqual(beforeComplianceChange);
    const wrongTarget = await app.inject({
      method: 'POST',
      url: `/api/v1/cases/${f.caseId}/scene/nodes/A3002/responses`,
      headers: { ...auth(f.manager.token), 'idempotency-key': `${key}-wrong-target` },
      payload: { ...payload, targetPersonId: crypto.randomUUID() },
    });
    expect(wrongTarget.json().code, wrongTarget.body).toBe('TARGET_SCOPE_INVALID');
    const outsider = await fixture('b2-outsider');
    const crossFamily = await app.inject({
      method: 'POST',
      url: `/api/v1/cases/${f.caseId}/scene/nodes/A3002/responses`,
      headers: { ...auth(outsider.manager.token), 'idempotency-key': `${key}-cross-family` },
      payload,
    });
    expect(crossFamily.json().code, crossFamily.body).toBe('CASE_NOT_FOUND');


    const currents = await admin.query<{ n: number; revisions: number }>(
      `SELECT count(*)::int AS n,
              count(DISTINCT selection_revision)::int AS revisions
         FROM digital_use_target_items
        WHERE case_id=$1 AND superseded_at IS NULL`,
      [f.caseId]
    );
    expect(currents.rows[0]).toEqual({ n: 10, revisions: 1 });
  });

  it('AS-33 concurrent A3002 writes cannot both become current but independent A3001 can coexist', async () => {
    const f = await fixture('selection-race');
    expect((await respond(f, 'A3000', selfAssessment())).statusCode).toBe(200);
    const scene = await getScene(f);
    const a3002 = scene.nodes.find((node: any) => node.nodeCode === 'A3002');
    const make = (targets: string[]) => app.inject({
      method: 'POST',
      url: `/api/v1/cases/${f.caseId}/scene/nodes/A3002/responses`,
      headers: {
        ...auth(f.manager.token),
        'idempotency-key': `fa-race-${crypto.randomUUID()}`,
      },
      payload: {
        targetPersonId: f.targetPersonId,
        expectedCaseVersion: f.caseVersion,
        expectedNodeRevision: a3002.revision,
        expectedScenePackageVersion: 'v1',
        expectedSelectionRevision: 0,
        response: { kind: 'TARGET_SELECTION', confirmed: true, selectedTargets: targets },
      },
    });
    const [one,two] = await Promise.all([make(['SLEEP']), make(['EXERCISE'])]);
    expect([one.statusCode,two.statusCode].sort()).toEqual([200,409]);

    const a3001 = await respond(f, 'A3001', {
      kind: 'COMMUNICATION_PREP',
      action: 'ACKNOWLEDGED',
    });
    expect(a3001.statusCode, a3001.body).toBe(200);

    const current = await admin.query<{ n: number; revisions: number }>(
      `SELECT count(*)::int AS n,
              count(DISTINCT selection_revision)::int AS revisions
         FROM digital_use_target_items
        WHERE case_id=$1 AND superseded_at IS NULL`,
      [f.caseId]
    );
    expect(current.rows[0]).toEqual({ n: 10, revisions: 1 });
  });

  it('AS-25 Safety Hold blocks entry without Evidence/artifact/idempotency residue', async () => {
    const f = await fixture('safety');
    await admin.query(`UPDATE cases SET status='SAFETY_HOLD' WHERE id=$1`, [f.caseId]);
    const key = `fa-safety-${crypto.randomUUID()}`;
    const blocked = await respond(f, 'A3000', selfAssessment(), {}, key);
    expect(blocked.statusCode, blocked.body).toBe(409);
    expect(blocked.json().code).toBe('SAFETY_HOLD_BLOCKED');

    const residue = await admin.query<{
      evidence: number; artifacts: number; idempotency: number;
    }>(
      `SELECT
        (SELECT count(*)::int FROM assertions
          WHERE case_id=$1 AND content LIKE 'DUFA:v1:%') AS evidence,
        (SELECT count(*)::int FROM scene_artifacts
          WHERE case_id=$1 AND artifact_type='FAMILY_ALLIANCE_SELF_ASSESSMENT') AS artifacts,
        (SELECT count(*)::int FROM idempotency_keys
          WHERE actor_account_id=$2 AND command_type='DIGITAL_USE_NODE_RESPONSE') AS idempotency`,
      [f.caseId, f.manager.accountId]
    );
    expect(residue.rows[0]).toEqual({ evidence: 0, artifacts: 0, idempotency: 0 });
  });

  it('AS-36 stale package token fails closed before business effects', async () => {
    const f = await fixture('package');
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/cases/${f.caseId}/scene/nodes/A3000/responses`,
      headers: {
        ...auth(f.manager.token),
        'idempotency-key': `fa-package-${crypto.randomUUID()}`,
      },
      payload: {
        targetPersonId: f.targetPersonId,
        expectedCaseVersion: f.caseVersion,
        expectedNodeRevision: 0,
        expectedScenePackageVersion: 'v0',
        response: selfAssessment(),
      },
    });
    expect(response.statusCode).toBeGreaterThanOrEqual(400);
    const evidence = await admin.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM assertions
        WHERE case_id=$1 AND content LIKE 'DUFA:v1:%'`,
      [f.caseId]
    );
    expect(evidence.rows[0]!.n).toBe(0);
  });

  it('AS-34 concurrent target revisions cannot last-write-win', async () => {
    const f = await fixture('target-race');
    expect((await respond(f, 'A3000', selfAssessment())).statusCode).toBe(200);
    const selection = await respond(
      f,
      'A3002',
      { kind: 'TARGET_SELECTION', confirmed: true, selectedTargets: ['SLEEP'] },
      { expectedSelectionRevision: 0 }
    );
    expect(selection.statusCode, selection.body).toBe(200);
    let body = selection.json();
    let target = body.targets.find((item: any) => item.targetCode === 'SLEEP');

    // #13 Layer 1 fix: TARGET_DEFINITION (A3010) must precede FEASIBILITY (A3011).
    // Complete TARGET_DEFINITION so that A3011 (FEASIBILITY) is materialized.
    const targetDef = await respond(
      f,
      'A3010',
      { kind: 'TARGET_DEFINITION', concreteTargetText: 'SLEEP concrete target for race test' },
      { expectedSelectionRevision: target.selectionRevision, expectedTargetRevision: target.revision }
    );
    expect(targetDef.statusCode, targetDef.body).toBe(200);
    body = targetDef.json();
    target = body.targets.find((item: any) => item.targetCode === 'SLEEP');
    const node = body.nodes.find((item: any) => item.nodeCode === 'A3011');
    expect(node, 'A3011 must be materialized after A3010').toBeDefined();

    const make = (text: string) => app.inject({
      method: 'POST',
      url: `/api/v1/cases/${f.caseId}/scene/nodes/A3011/responses`,
      headers: {
        ...auth(f.manager.token),
        'idempotency-key': `fa-target-race-${crypto.randomUUID()}`,
      },
      payload: {
        targetPersonId: f.targetPersonId,
        expectedCaseVersion: f.caseVersion,
        expectedNodeRevision: node.revision,
        expectedScenePackageVersion: 'v1',
        expectedSelectionRevision: target.selectionRevision,
        expectedTargetRevision: target.revision,
        response: {
          kind: 'FEASIBILITY',
          feasibility: {
            problemBehavior: {
              concreteBehavior: { state: 'KNOWN', text: 'Current sleep-related phone behaviour' },
              need: { state: 'KNOWN', text: 'Immediate entertainment need' },
              motivationBenefit: { state: 'KNOWN', text: 'Immediate enjoyment' },
              abilityConditions: { state: 'KNOWN', text: 'Phone remains available' },
              challengeResistance: { state: 'UNKNOWN' },
            },
            replacementBehavior: {
              concreteQuantified: { state: 'KNOWN', concreteTargetText: text },
              need: { state: 'KNOWN', rating: 8 },
              motivationBenefit: { state: 'KNOWN', rating: 7 },
              abilityPossibility: { state: 'KNOWN', rating: 6 },
              challengeResistance: { state: 'UNKNOWN' },
            },
          },
        },
      },
    });
    const [left, right] = await Promise.all([
      make('first concurrent target'),
      make('second concurrent target'),
    ]);
    expect([left.statusCode, right.statusCode].sort()).toEqual([200, 409]);

    const current = await admin.query<{
      total_revisions: number;
      current_revisions: number;
      feasibility_revisions: number;
      latest_revision: number;
      texts: string[] | null;
    }>(
      `SELECT count(*)::int AS total_revisions,
              count(*) FILTER (WHERE superseded_at IS NULL)::int AS current_revisions,
              count(*) FILTER (WHERE feasibility_payload IS NOT NULL)::int
                AS feasibility_revisions,
              max(revision)::int AS latest_revision,
              array_agg(concrete_target_text ORDER BY revision) FILTER
                (WHERE superseded_at IS NULL) AS texts
         FROM digital_use_target_items
        WHERE case_id=$1 AND target_code='SLEEP'`,
      [f.caseId]
    );
    // Immutable revision history for SLEEP is exactly:
    //   revision 1 = A3002 selection base row (all ten canonical target codes)
    //   revision 2 = A3010 TARGET_DEFINITION (proved by `node` above)
    //   revision 3 = the single winning A3011 FEASIBILITY write
    // The concurrent loser must not append a revision, so the total is 3 and
    // only one of them is current. A last-write-win implementation would leave
    // both concurrent payloads committed and superseded_at NULL for two rows.
    expect(current.rows[0]).toMatchObject({
      total_revisions: 3,
      current_revisions: 1,
      feasibility_revisions: 1,
      latest_revision: 3,
    });
    expect(current.rows[0]!.texts).toHaveLength(1);
    expect([
      'first concurrent target',
      'second concurrent target',
    ]).toContain(current.rows[0]!.texts![0]);
  });

  it('F13-L2: FEASIBILITY requires TARGET and PROGRESS requires FEASIBILITY, never across targets', async () => {
    const f = await fixture('finding13-gates');
    expect((await respond(f, 'A3000', selfAssessment('NO'))).statusCode).toBe(200);

    const selection = await respond(
      f,
      'A3002',
      { kind: 'TARGET_SELECTION', confirmed: true, selectedTargets: ['SLEEP'] },
      { expectedSelectionRevision: 0 }
    );
    expect(selection.statusCode, selection.body).toBe(200);
    let body = selection.json();
    let sleep = body.targets.find((item: any) => item.targetCode === 'SLEEP');

    // Layer 1: a bare A3002 selection may only materialize TARGET nodes.
    expect(body.nodes.map((node: any) => node.nodeCode)).not.toContain('A3011');
    expect(body.nodes.map((node: any) => node.nodeCode)).not.toContain('A3012');

    const target = await respond(
      f,
      'A3010',
      { kind: 'TARGET_DEFINITION', concreteTargetText: 'SLEEP gate target' },
      {
        expectedSelectionRevision: sleep.selectionRevision,
        expectedTargetRevision: sleep.revision,
      }
    );
    expect(target.statusCode, target.body).toBe(200);
    body = target.json();
    sleep = body.targets.find((item: any) => item.targetCode === 'SLEEP');
    // Layer 1: TARGET completion unlocks FEASIBILITY only.
    expect(body.nodes.find((node: any) => node.nodeCode === 'A3011')?.status)
      .toBe('AVAILABLE');
    expect(body.nodes.map((node: any) => node.nodeCode)).not.toContain('A3012');

    // A reselection resets every target payload revision while the already
    // materialized A3011 node state survives. The command invariant, not the
    // materialization gate, must reject the stale client order.
    const reselect = await respond(
      f,
      'A3002',
      { kind: 'TARGET_SELECTION', confirmed: true, selectedTargets: ['SLEEP'] },
      { expectedSelectionRevision: sleep.selectionRevision }
    );
    expect(reselect.statusCode, reselect.body).toBe(200);
    body = reselect.json();
    sleep = body.targets.find((item: any) => item.targetCode === 'SLEEP');
    expect(sleep.concreteTargetText).toBeNull();
    expect(sleep.feasibility).toBeNull();

    const feasibilityBeforeTarget = await respond(
      f,
      'A3011',
      sleepFeasibility('SLEEP feasibility without target'),
      {
        expectedSelectionRevision: sleep.selectionRevision,
        expectedTargetRevision: sleep.revision,
      }
    );
    expect(feasibilityBeforeTarget.statusCode, feasibilityBeforeTarget.body).toBe(409);
    expect(feasibilityBeforeTarget.json()).toMatchObject({
      code: 'TARGET_SELECTION_STATE_INVALID',
    });

    // Layer 1 still keeps PROGRESS unreachable until FEASIBILITY completes.
    const progressBeforeFeasibility = await respond(
      f,
      'A3012',
      sleepProgress('SLEEP progress before feasibility'),
      {
        expectedSelectionRevision: sleep.selectionRevision,
        expectedTargetRevision: sleep.revision,
      }
    );
    expect(progressBeforeFeasibility.statusCode, progressBeforeFeasibility.body).toBe(409);
    expect(progressBeforeFeasibility.json()).toMatchObject({
      code: 'SCENE_NODE_UNREACHABLE',
    });

    // The legal chain still works end to end after the reselection.
    const retarget = await respond(
      f,
      'A3010',
      { kind: 'TARGET_DEFINITION', concreteTargetText: 'SLEEP gate target restated' },
      {
        expectedSelectionRevision: sleep.selectionRevision,
        expectedTargetRevision: sleep.revision,
      }
    );
    expect(retarget.statusCode, retarget.body).toBe(200);
    body = retarget.json();
    sleep = body.targets.find((item: any) => item.targetCode === 'SLEEP');

    const feasible = await respond(
      f,
      'A3011',
      sleepFeasibility('SLEEP feasible target'),
      {
        expectedSelectionRevision: sleep.selectionRevision,
        expectedTargetRevision: sleep.revision,
      }
    );
    expect(feasible.statusCode, feasible.body).toBe(200);
    body = feasible.json();
    sleep = body.targets.find((item: any) => item.targetCode === 'SLEEP');
    expect(body.nodes.find((node: any) => node.nodeCode === 'A3012')?.status)
      .toBe('AVAILABLE');

    const progressed = await respond(
      f,
      'A3012',
      sleepProgress('SLEEP legal progress'),
      {
        expectedSelectionRevision: sleep.selectionRevision,
        expectedTargetRevision: sleep.revision,
      }
    );
    expect(progressed.statusCode, progressed.body).toBe(200);
    body = progressed.json();
    sleep = body.targets.find((item: any) => item.targetCode === 'SLEEP');
    expect(sleep.progress).toMatchObject({ kind: 'GENERAL_MATRIX' });

    // Second reselection: A3012 now exists and is reenterable, so only the
    // command invariant can stop PROGRESS without a fresh FEASIBILITY.
    const reselectAgain = await respond(
      f,
      'A3002',
      { kind: 'TARGET_SELECTION', confirmed: true, selectedTargets: ['SLEEP'] },
      { expectedSelectionRevision: sleep.selectionRevision }
    );
    expect(reselectAgain.statusCode, reselectAgain.body).toBe(200);
    body = reselectAgain.json();
    sleep = body.targets.find((item: any) => item.targetCode === 'SLEEP');
    expect(sleep.feasibility).toBeNull();

    const progressBeforeFeasibilityAgain = await respond(
      f,
      'A3012',
      sleepProgress('SLEEP progress without feasibility'),
      {
        expectedSelectionRevision: sleep.selectionRevision,
        expectedTargetRevision: sleep.revision,
      }
    );
    expect(progressBeforeFeasibilityAgain.statusCode, progressBeforeFeasibilityAgain.body)
      .toBe(409);
    expect(progressBeforeFeasibilityAgain.json()).toMatchObject({
      code: 'TARGET_SELECTION_STATE_INVALID',
    });

    // Cross-target protection: EXERCISE never ran its own TARGET/FEASIBILITY,
    // so its lifecycle nodes stay materially absent.
    const nodeCodes = body.nodes.map((node: any) => node.nodeCode);
    expect(nodeCodes).not.toContain('A3021');
    expect(nodeCodes).not.toContain('A3022');
    expect(body.targets.find((item: any) => item.targetCode === 'EXERCISE')?.selected)
      .toBe(false);
  });

  it('R05: Emotion Regulation 1 records progress without feasibility while other targets keep the gate', async () => {
    const f = await fixture('er1-progress-only');
    expect((await respond(f, 'A3000', selfAssessment('NO'))).statusCode).toBe(200);

    const selection = await respond(
      f,
      'A3002',
      {
        kind: 'TARGET_SELECTION',
        confirmed: true,
        selectedTargets: ['EMOTION_REGULATION_1', 'SLEEP'],
      },
      { expectedSelectionRevision: 0 }
    );
    expect(selection.statusCode, selection.body).toBe(200);
    let body = selection.json();
    let er1 = body.targets.find((item: any) => item.targetCode === 'EMOTION_REGULATION_1');
    let sleep = body.targets.find((item: any) => item.targetCode === 'SLEEP');
    expect(er1?.selected).toBe(true);
    expect(sleep?.selected).toBe(true);

    const er1Target = await respond(
      f,
      'A3080',
      { kind: 'TARGET_DEFINITION', concreteTargetText: 'Parent listens before responding' },
      {
        expectedSelectionRevision: er1.selectionRevision,
        expectedTargetRevision: er1.revision,
      }
    );
    expect(er1Target.statusCode, er1Target.body).toBe(200);
    body = er1Target.json();
    er1 = body.targets.find((item: any) => item.targetCode === 'EMOTION_REGULATION_1');

    // Owner-approved D1: ER1 has no feasibility step, so its PROGRESS node is
    // reachable directly from the completed target definition.
    expect(er1.feasibility).toBeNull();
    expect(body.nodes.find((node: any) => node.nodeCode === 'A3082')?.status)
      .toBe('AVAILABLE');

    const er1Progress = await respond(
      f,
      'A3082',
      {
        kind: 'PROGRESS',
        progress: {
          kind: 'EMOTION_REGULATION_1',
          listening: { state: 'KNOWN', count: 3 },
          affirmation: {
            state: 'KNOWN',
            observations: ['affirmed effort', 'affirmed feeling', 'affirmed choice'],
          },
          reducedEvaluation: { state: 'KNOWN', count: 2 },
          selfRegulationJournal: { state: 'KNOWN', text: 'Stayed calm before responding.' },
          selfCare: { state: 'KNOWN', durationMinutes: 30, activities: ['walk'] },
          effectEvaluation: {
            intrinsicMotivation: { state: 'KNOWN', text: 'More self-started behaviour.' },
            selfEsteemConfidence: { state: 'KNOWN', text: 'More confidence reported.' },
            abilityPotential: { state: 'KNOWN', text: 'Can complete the replacement behaviour.' },
          },
          modifyTarget: 'NO',
        },
      },
      {
        expectedSelectionRevision: er1.selectionRevision,
        expectedTargetRevision: er1.revision,
      }
    );
    expect(er1Progress.statusCode, er1Progress.body).toBe(200);
    body = er1Progress.json();
    er1 = body.targets.find((item: any) => item.targetCode === 'EMOTION_REGULATION_1');
    expect(er1.feasibility).toBeNull();
    expect(er1.progress).toMatchObject({ kind: 'EMOTION_REGULATION_1' });

    // Every other target keeps TARGET -> FEASIBILITY -> PROGRESS unchanged.
    const sleepTarget = await respond(
      f,
      'A3010',
      { kind: 'TARGET_DEFINITION', concreteTargetText: 'SLEEP baseline target' },
      {
        expectedSelectionRevision: sleep.selectionRevision,
        expectedTargetRevision: sleep.revision,
      }
    );
    expect(sleepTarget.statusCode, sleepTarget.body).toBe(200);
    body = sleepTarget.json();
    sleep = body.targets.find((item: any) => item.targetCode === 'SLEEP');
    expect(body.nodes.map((node: any) => node.nodeCode)).not.toContain('A3012');

    const sleepProgressBeforeFeasibility = await respond(
      f,
      'A3012',
      sleepProgress('SLEEP progress before feasibility'),
      {
        expectedSelectionRevision: sleep.selectionRevision,
        expectedTargetRevision: sleep.revision,
      }
    );
    expect(sleepProgressBeforeFeasibility.statusCode, sleepProgressBeforeFeasibility.body)
      .toBe(409);
    expect(sleepProgressBeforeFeasibility.json()).toMatchObject({
      code: 'SCENE_NODE_UNREACHABLE',
    });
  });

  it('F13-HELP: HELP keeps its frozen reach and needs no FEASIBILITY prerequisite', async () => {
    const f = await fixture('finding13-help');
    expect((await respond(f, 'A3000', selfAssessment('NO'))).statusCode).toBe(200);

    const selection = await respond(
      f,
      'A3002',
      { kind: 'TARGET_SELECTION', confirmed: true, selectedTargets: ['SLEEP'] },
      { expectedSelectionRevision: 0 }
    );
    expect(selection.statusCode, selection.body).toBe(200);
    let body = selection.json();
    let sleep = body.targets.find((item: any) => item.targetCode === 'SLEEP');

    // Finding #13 freezes TARGET -> FEASIBILITY -> PROGRESS only. A HELP node's
    // manifest prerequisite is A3002_SELECTED_TARGET_<code>, so it must be
    // reachable on a bare selection, before any TARGET or FEASIBILITY work.
    expect(body.nodes.find((node: any) => node.nodeCode === 'A3013')?.status)
      .toBe('AVAILABLE');
    expect(sleep.concreteTargetText).toBeNull();
    expect(sleep.feasibility).toBeNull();

    const help = await respond(
      f,
      'A3013',
      { kind: 'HELP', action: 'VIEWED', note: 'SLEEP help before feasibility' },
      {
        expectedSelectionRevision: sleep.selectionRevision,
        expectedTargetRevision: sleep.revision,
      }
    );
    expect(help.statusCode, help.body).toBe(200);
    body = help.json();
    sleep = body.targets.find((item: any) => item.targetCode === 'SLEEP');
    expect(sleep.helpHistoryRefs).toHaveLength(1);
    expect(sleep.helpHistoryRefs[0]).toMatchObject({
      nodeCode: 'A3013',
      scenePackageVersion: 'v1',
    });
    // HELP records content/history refs and must not fabricate a feasibility
    // evaluation for the target.
    expect(sleep.feasibility).toBeNull();
  });

  it('AS-26 Safety race wins before Family Alliance commit', async () => {
    const f = await fixture('safety-race');
    const blocker = new pg.Client({ connectionString: process.env['TEST_ADMIN_DATABASE_URL']! });
    await blocker.connect();
    try {
      await blocker.query('BEGIN');
      await blocker.query(
        `UPDATE cases SET status='SAFETY_HOLD' WHERE id=$1`,
        [f.caseId]
      );
      const request = app.inject({
        method: 'POST',
        url: `/api/v1/cases/${f.caseId}/scene/nodes/A3000/responses`,
        headers: {
          ...auth(f.manager.token),
          'idempotency-key': `fa-safety-race-${crypto.randomUUID()}`,
        },
        payload: {
          targetPersonId: f.targetPersonId,
          expectedCaseVersion: f.caseVersion,
          expectedNodeRevision: 0,
          expectedScenePackageVersion: 'v1',
          response: selfAssessment(),
        },
      });
      await new Promise((resolve) => setTimeout(resolve, 40));
      await blocker.query('COMMIT');
      const blocked = await request;
      expect(blocked.statusCode, blocked.body).toBe(409);
      expect(blocked.json().code).toBe('SAFETY_HOLD_BLOCKED');
    } finally {
      await blocker.query('ROLLBACK').catch(() => undefined);
      await blocker.end();
    }

    const residue = await admin.query<{ evidence: number; artifacts: number }>(
      `SELECT
        (SELECT count(*)::int FROM assertions
          WHERE case_id=$1 AND content LIKE 'DUFA:v1:%') AS evidence,
        (SELECT count(*)::int FROM scene_artifacts
          WHERE case_id=$1 AND artifact_type='FAMILY_ALLIANCE_SELF_ASSESSMENT') AS artifacts`,
      [f.caseId]
    );
    expect(residue.rows[0]).toEqual({ evidence: 0, artifacts: 0 });
  });

  it('AS-35 primary-case race fails stale Family Alliance progression', async () => {
    const f = await fixture('primary-race');
    const blocker = new pg.Client({ connectionString: process.env['TEST_ADMIN_DATABASE_URL']! });
    await blocker.connect();
    try {
      await blocker.query('BEGIN');
      await blocker.query(
        `UPDATE cases SET is_primary=false, version=version+1 WHERE id=$1`,
        [f.caseId]
      );
      const request = app.inject({
        method: 'POST',
        url: `/api/v1/cases/${f.caseId}/scene/nodes/A3000/responses`,
        headers: {
          ...auth(f.manager.token),
          'idempotency-key': `fa-primary-race-${crypto.randomUUID()}`,
        },
        payload: {
          targetPersonId: f.targetPersonId,
          expectedCaseVersion: f.caseVersion,
          expectedNodeRevision: 0,
          expectedScenePackageVersion: 'v1',
          response: selfAssessment(),
        },
      });
      await new Promise((resolve) => setTimeout(resolve, 40));
      await blocker.query('COMMIT');
      const blocked = await request;
      expect(blocked.statusCode, blocked.body).toBe(409);
      expect(['CASE_NOT_PRIMARY','STALE_CASE_VERSION']).toContain(blocked.json().code);
    } finally {
      await blocker.query('ROLLBACK').catch(() => undefined);
      await blocker.end();
    }

    const residue = await admin.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM assertions
        WHERE case_id=$1 AND content LIKE 'DUFA:v1:%'`,
      [f.caseId]
    );
    expect(residue.rows[0]!.n).toBe(0);
  });

  it('AS-27/28 Compliance publication race and UNKNOWN policy fail closed', async () => {
    const f = await fixture('compliance-race');
    const completedKey = `b2-policy-${crypto.randomUUID()}`;
    const completed = await respond(f, 'A3000', selfAssessment(), {}, completedKey);
    expect(completed.statusCode,completed.body).toBe(200);
    const beforePolicy = (await admin.query('SELECT count(*)::int AS n FROM assertions WHERE case_id=$1',[f.caseId])).rows;
    const publisher = new pg.Client({
      connectionString: process.env['MIGRATION_DATABASE_URL']!,
    });
    await publisher.connect();
    try {
      await publisher.query('BEGIN');
      await publisher.query(
        `SELECT app.publish_compliance_feature_policy(
           'DIGITAL_USE_FAMILY_ALLIANCE_RUNTIME','v1',1,2,
           'UNKNOWN','BASELINE','BASELINE','BASELINE','BASELINE',
           NULL,NULL,clock_timestamp() - interval '1 second',
           'migration:slice13-compliance-race'
         )`
      );

      const request = app.inject({
        method: 'POST',
        url: `/api/v1/cases/${f.caseId}/scene/nodes/A3000/responses`,
        headers: {
          ...auth(f.manager.token),
          'idempotency-key': `fa-compliance-race-${crypto.randomUUID()}`,
        },
        payload: {
          targetPersonId: f.targetPersonId,
          expectedCaseVersion: f.caseVersion,
          expectedNodeRevision: 0,
          expectedScenePackageVersion: 'v1',
          response: selfAssessment(),
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 40));
      await publisher.query('COMMIT');
      const replay = await app.inject({method:'POST',url:`/api/v1/cases/${f.caseId}/scene/nodes/A3000/responses`,headers:{...auth(f.manager.token),'idempotency-key':completedKey},payload:{targetPersonId:f.targetPersonId,expectedCaseVersion:f.caseVersion,expectedNodeRevision:0,expectedScenePackageVersion:'v1',response:selfAssessment()}});
      expect(replay.statusCode,replay.body).toBe(200);
      expect(replay.json()).toEqual(completed.json());
      expect((await admin.query('SELECT count(*)::int AS n FROM assertions WHERE case_id=$1',[f.caseId])).rows).toEqual(beforePolicy);
      const blocked = await request;
      expect(blocked.statusCode, blocked.body).toBe(409);
      expect(blocked.json().code).toBe('COMPLIANCE_BLOCKED');

      await publisher.query(
        `SELECT app.publish_compliance_feature_policy(
           'DIGITAL_USE_FAMILY_ALLIANCE_RUNTIME','v1',2,3,
           'NOT_APPLICABLE','BASELINE','BASELINE','BASELINE','BASELINE',
           'Slice 13 restored reviewed basis','evidence://slice13/restored',
           clock_timestamp(),'migration:slice13-compliance-restore'
         )`
      );
    } finally {
      await publisher.query('ROLLBACK').catch(() => undefined);
      await publisher.end();
    }

    const residue = await admin.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM assertions
        WHERE case_id=$1 AND content LIKE 'DUFA:v1:%'`,
      [f.caseId]
    );
    expect(residue.rows[0]!.n).toBeGreaterThan(0);
  });

  async function installFaultTrigger(
    table: string,
    operation: 'INSERT' | 'UPDATE',
    predicate: string,
    token: string,
    deferred = false
  ): Promise<() => Promise<void>> {
    const safe = token.replace(/[^a-zA-Z0-9_]/g, '_');
    const functionName = `slice13_fault_fn_${safe}`;
    const triggerName = `slice13_fault_tr_${safe}`;
    await admin.query(
      `CREATE FUNCTION ${functionName}() RETURNS trigger
         LANGUAGE plpgsql AS $$
       BEGIN
         RAISE EXCEPTION 'SLICE13_FAULT_${safe}';
       END $$`
    );
    const prefix = deferred
      ? 'CREATE CONSTRAINT TRIGGER'
      : 'CREATE TRIGGER';
    const timing = deferred
      ? `AFTER ${operation} ON ${table}
         DEFERRABLE INITIALLY DEFERRED`
      : `BEFORE ${operation} ON ${table}`;
    await admin.query(
      `${prefix} ${triggerName}
         ${timing}
         FOR EACH ROW
         WHEN (${predicate})
         EXECUTE FUNCTION ${functionName}()`
    );
    return async () => {
      await admin.query(`DROP TRIGGER IF EXISTS ${triggerName} ON ${table}`);
      await admin.query(`DROP FUNCTION IF EXISTS ${functionName}()`);
    };
  }

  async function assertA3000NoResidue(f: Fixture, key: string): Promise<void> {
    const { rows } = await admin.query<{
      evidence: number;
      artifacts: number;
      scene: number;
      events: number;
      audits: number;
      idempotency: number;
    }>(
      `SELECT
        (SELECT count(*)::int FROM assertions
          WHERE case_id=$1 AND content LIKE 'DUFA:v1:%') AS evidence,
        (SELECT count(*)::int FROM scene_artifacts
          WHERE case_id=$1 AND artifact_type='FAMILY_ALLIANCE_SELF_ASSESSMENT') AS artifacts,
        (SELECT count(*)::int FROM scene_node_states
          WHERE case_id=$1 AND node_code='A3000') AS scene,
        (SELECT count(*)::int FROM case_events
          WHERE case_id=$1 AND event_type='CASE_DIGITAL_USE_NODE_COMPLETED') AS events,
        (SELECT count(*)::int FROM business_audit_events
          WHERE family_id=$2 AND event_type='DIGITAL_USE_NODE_COMPLETED'
            AND resource_id=$1) AS audits,
        (SELECT count(*)::int FROM idempotency_keys
          WHERE actor_account_id=$3
            AND command_type='DIGITAL_USE_NODE_RESPONSE'
            AND idempotency_key=$4) AS idempotency`,
      [f.caseId, f.familyId, f.manager.accountId, key]
    );
    expect(rows[0]).toEqual({
      evidence: 0,
      artifacts: 0,
      scene: 0,
      events: 0,
      audits: 0,
      idempotency: 0,
    });
  }

  it('AS-37 fault injection proves atomic rollback at seven business boundaries', async () => {
    const stages = [
      {
        name: 'after-evidence',
        table: 'scene_artifacts',
        operation: 'INSERT' as const,
        predicate: `NEW.artifact_type = 'FAMILY_ALLIANCE_SELF_ASSESSMENT'`,
        deferred: false,
      },
      {
        name: 'after-artifact',
        table: 'scene_node_states',
        operation: 'UPDATE' as const,
        predicate: `NEW.node_code = 'A3000' AND NEW.status = 'COMPLETED'`,
        deferred: false,
      },
      {
        name: 'after-scene-before-event',
        table: 'case_events',
        operation: 'INSERT' as const,
        predicate: `NEW.event_type = 'CASE_DIGITAL_USE_NODE_COMPLETED'`,
        deferred: false,
      },
      {
        name: 'before-audit',
        table: 'business_audit_events',
        operation: 'INSERT' as const,
        predicate: `NEW.event_type = 'DIGITAL_USE_NODE_COMPLETED'`,
        deferred: false,
      },
      {
        name: 'before-idempotency-success',
        table: 'idempotency_keys',
        operation: 'INSERT' as const,
        predicate: `NEW.command_type = 'DIGITAL_USE_NODE_RESPONSE'`,
        deferred: false,
      },
      {
        name: 'before-commit-deferred',
        table: 'idempotency_keys',
        operation: 'INSERT' as const,
        predicate: `NEW.command_type = 'DIGITAL_USE_NODE_RESPONSE'`,
        deferred: true,
      },
    ];

    for (const stage of stages) {
      const f = await fixture(`fault-${stage.name}`);
      const key = `fa-fault-${stage.name}-${crypto.randomUUID()}`;
      const scopePredicate =
        stage.table === 'scene_artifacts' ||
        stage.table === 'scene_node_states' ||
        stage.table === 'case_events'
          ? `(${stage.predicate}) AND NEW.case_id = '${f.caseId}'::uuid`
          : stage.table === 'business_audit_events'
            ? `(${stage.predicate}) AND NEW.family_id = '${f.familyId}'::uuid
               AND NEW.resource_id = '${f.caseId}'::uuid`
            : `(${stage.predicate}) AND NEW.actor_account_id = '${f.manager.accountId}'::uuid
               AND NEW.idempotency_key = '${key}'`;
      const drop = await installFaultTrigger(
        stage.table,
        stage.operation,
        scopePredicate,
        `${stage.name}_${f.caseId.replaceAll('-', '_')}`,
        stage.deferred
      );
      try {
        const failed = await app.inject({
          method: 'POST',
          url: `/api/v1/cases/${f.caseId}/scene/nodes/A3000/responses`,
          headers: { ...auth(f.manager.token), 'idempotency-key': key },
          payload: {
            targetPersonId: f.targetPersonId,
            expectedCaseVersion: f.caseVersion,
            expectedNodeRevision: 0,
            expectedScenePackageVersion: 'v1',
            response: selfAssessment(),
          },
        });
        expect(failed.statusCode).toBe(500);
      } finally {
        await drop();
      }
      await assertA3000NoResidue(f, key);
    }

    // Dedicated "after target write" point: A3002 creates the selection rows
    // before Scene CAS, so a scoped Scene-state trigger must roll the target set
    // and idempotency row back together.
    const f = await fixture('fault-after-target');
    expect((await respond(f, 'A3000', selfAssessment())).statusCode).toBe(200);
    const scene = await getScene(f);
    const a3002 = scene.nodes.find((node: any) => node.nodeCode === 'A3002');
    const key = `fa-fault-after-target-${crypto.randomUUID()}`;
    const safeCase = f.caseId.replaceAll('-', '_');
    const drop = await installFaultTrigger(
      'scene_node_states',
      'UPDATE',
      `NEW.case_id = '${f.caseId}'::uuid AND NEW.node_code = 'A3002'
        AND NEW.status = 'COMPLETED'`,
      `after_target_${safeCase}`,
      false
    );
    try {
      const failed = await app.inject({
        method: 'POST',
        url: `/api/v1/cases/${f.caseId}/scene/nodes/A3002/responses`,
        headers: { ...auth(f.manager.token), 'idempotency-key': key },
        payload: {
          targetPersonId: f.targetPersonId,
          expectedCaseVersion: f.caseVersion,
          expectedNodeRevision: a3002.revision,
          expectedScenePackageVersion: 'v1',
          expectedSelectionRevision: 0,
          response: {
            kind: 'TARGET_SELECTION',
            confirmed: true,
            selectedTargets: ['SLEEP'],
          },
        },
      });
      expect(failed.statusCode).toBe(500);
    } finally {
      await drop();
    }
    const targetResidue = await admin.query<{ targets: number; idempotency: number }>(
      `SELECT
        (SELECT count(*)::int FROM digital_use_target_items WHERE case_id=$1) AS targets,
        (SELECT count(*)::int FROM idempotency_keys
          WHERE actor_account_id=$2 AND command_type='DIGITAL_USE_NODE_RESPONSE'
            AND idempotency_key=$3) AS idempotency`,
      [f.caseId, f.manager.accountId, key]
    );
    expect(targetResidue.rows[0]).toEqual({ targets: 0, idempotency: 0 });
  });


  it('AS-20..AS-24 authorization, isolation and source fidelity fail closed', async () => {
    const f = await fixture('auth-isolation');

    const unauthenticated = await app.inject({
      method: 'POST',
      url: `/api/v1/cases/${f.caseId}/scene/nodes/A3000/responses`,
      headers: { 'idempotency-key': `fa-unauth-${crypto.randomUUID()}` },
      payload: {
        targetPersonId: f.targetPersonId,
        expectedCaseVersion: f.caseVersion,
        expectedNodeRevision: 0,
        expectedScenePackageVersion: 'v1',
        response: selfAssessment(),
      },
    });
    expect(unauthenticated.statusCode).toBe(401);

    const outsider = await loginWithLabel(app, 'fa-outsider-auth-isolation');
    const outsiderFamily = await createFamily(
      app,
      outsider.token,
      'fa-outsider-auth-isolation'
    );
    expect(outsiderFamily.statusCode, outsiderFamily.body).toBe(201);
    const crossFamily = await app.inject({
      method: 'POST',
      url: `/api/v1/cases/${f.caseId}/scene/nodes/A3000/responses`,
      headers: {
        ...auth(outsider.token),
        'idempotency-key': `fa-cross-${crypto.randomUUID()}`,
      },
      payload: {
        targetPersonId: f.targetPersonId,
        expectedCaseVersion: f.caseVersion,
        expectedNodeRevision: 0,
        expectedScenePackageVersion: 'v1',
        response: selfAssessment(),
      },
    });
    expect([403, 404]).toContain(crossFamily.statusCode);

    const participant = await loginWithLabel(app, 'fa-participant-auth-isolation');
    const participantOwnFamily = await createFamily(
      app,
      participant.token,
      'fa-participant-own-auth-isolation'
    );
    expect(participantOwnFamily.statusCode, participantOwnFamily.body).toBe(201);
    await admin.query(
      `INSERT INTO family_members (family_id,person_id)
       VALUES ($1,$2) ON CONFLICT DO NOTHING`,
      [f.familyId, participant.personId]
    );
    const tokenHash =
      crypto.randomUUID().replaceAll('-', '').padEnd(64, '0');
    await admin.query(
      `INSERT INTO case_participants
         (family_id,case_id,person_id,state,invite_token_hash,invite_expires_at,
          created_by_person_id,accepted_at)
       VALUES ($1,$2,$3,'ACTIVE',$4,now()+interval '1 day',$5,now())`,
      [f.familyId, f.caseId, participant.personId, tokenHash, f.manager.personId]
    );
    const participantAttempt = await app.inject({
      method: 'POST',
      url: `/api/v1/cases/${f.caseId}/scene/nodes/A3000/responses`,
      headers: {
        ...auth(participant.token),
        'idempotency-key': `fa-participant-${crypto.randomUUID()}`,
      },
      payload: {
        targetPersonId: f.targetPersonId,
        expectedCaseVersion: f.caseVersion,
        expectedNodeRevision: 0,
        expectedScenePackageVersion: 'v1',
        response: selfAssessment(),
      },
    });
    // Preserve the repository anti-enumeration contract: an authorized
    // participant without Family Alliance mutation authority cannot learn
    // whether the protected Case exists through this mutation surface.
    expect(participantAttempt.statusCode).toBe(404);
    expect(participantAttempt.json().code).toBe('CASE_NOT_FOUND');

    // Wrong-Case/Evidence/target references and child-source attribution are
    // not request capabilities at all: the strict node payload rejects them.
    const forgedRefs = await app.inject({
      method: 'POST',
      url: `/api/v1/cases/${f.caseId}/scene/nodes/A3000/responses`,
      headers: {
        ...auth(f.manager.token),
        'idempotency-key': `fa-forged-ref-${crypto.randomUUID()}`,
      },
      payload: {
        targetPersonId: f.targetPersonId,
        expectedCaseVersion: f.caseVersion,
        expectedNodeRevision: 0,
        expectedScenePackageVersion: 'v1',
        sourceRefs: [{ type: 'ASSERTION', id: crypto.randomUUID() }],
        response: selfAssessment(),
      },
    });
    expect(forgedRefs.statusCode).toBe(422);

    const forgedSubject = await app.inject({
      method: 'POST',
      url: `/api/v1/cases/${f.caseId}/scene/nodes/A3000/responses`,
      headers: {
        ...auth(f.manager.token),
        'idempotency-key': `fa-forged-subject-${crypto.randomUUID()}`,
      },
      payload: {
        targetPersonId: f.targetPersonId,
        expectedCaseVersion: f.caseVersion,
        expectedNodeRevision: 0,
        expectedScenePackageVersion: 'v1',
        response: {
          ...selfAssessment(),
          subjectPersonId: participant.personId,
        },
      },
    });
    expect(forgedSubject.statusCode).toBe(422);

    const residue = await admin.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM assertions
        WHERE case_id=$1 AND content LIKE 'DUFA:v1:%'`,
      [f.caseId]
    );
    expect(residue.rows[0]!.n).toBe(0);
  });


  it('HX parallel A3001/A3002 writes are both legal and neither becomes a prerequisite', async () => {
    const f = await fixture('parallel-race');
    expect((await respond(f, 'A3000', selfAssessment())).statusCode).toBe(200);
    const scene = await getScene(f);
    const a3001 = scene.nodes.find((node: any) => node.nodeCode === 'A3001');
    const a3002 = scene.nodes.find((node: any) => node.nodeCode === 'A3002');

    const communication = app.inject({
      method: 'POST',
      url: `/api/v1/cases/${f.caseId}/scene/nodes/A3001/responses`,
      headers: {
        ...auth(f.manager.token),
        'idempotency-key': `fa-parallel-a3001-${crypto.randomUUID()}`,
      },
      payload: {
        targetPersonId: f.targetPersonId,
        expectedCaseVersion: f.caseVersion,
        expectedNodeRevision: a3001.revision,
        expectedScenePackageVersion: 'v1',
        response: { kind: 'COMMUNICATION_PREP', action: 'ACKNOWLEDGED' },
      },
    });
    const selection = app.inject({
      method: 'POST',
      url: `/api/v1/cases/${f.caseId}/scene/nodes/A3002/responses`,
      headers: {
        ...auth(f.manager.token),
        'idempotency-key': `fa-parallel-a3002-${crypto.randomUUID()}`,
      },
      payload: {
        targetPersonId: f.targetPersonId,
        expectedCaseVersion: f.caseVersion,
        expectedNodeRevision: a3002.revision,
        expectedScenePackageVersion: 'v1',
        expectedSelectionRevision: 0,
        response: {
          kind: 'TARGET_SELECTION',
          confirmed: true,
          selectedTargets: ['SLEEP'],
        },
      },
    });
    const [left, right] = await Promise.all([communication, selection]);
    expect([left.statusCode, right.statusCode]).toEqual([200, 200]);
    const final = await getScene(f);
    expect(final.nodes.find((node: any) => node.nodeCode === 'A3001')?.status)
      .toBe('COMPLETED');
    expect(final.nodes.find((node: any) => node.nodeCode === 'A3002')?.status)
      .toBe('COMPLETED');
  });

  it('HX target reselection versus progress preserves one selection truth and immutable history', async () => {
    const f = await fixture('reselect-progress-race');
    expect((await respond(f, 'A3000', selfAssessment())).statusCode).toBe(200);
    const selected = await respond(
      f,
      'A3002',
      { kind: 'TARGET_SELECTION', confirmed: true, selectedTargets: ['SLEEP'] },
      { expectedSelectionRevision: 0 }
    );
    expect(selected.statusCode, selected.body).toBe(200);
    let body = selected.json();
    let sleep = body.targets.find((item: any) => item.targetCode === 'SLEEP');

    // Finding #13 lifecycle: A3002 selection alone no longer materializes
    // FEASIBILITY or PROGRESS. Complete SLEEP's own TARGET -> FEASIBILITY so
    // that A3012 is a legally reachable node before the race begins.
    const targetDefinition = await respond(
      f,
      'A3010',
      {
        kind: 'TARGET_DEFINITION',
        concreteTargetText: 'SLEEP reselection race target',
      },
      {
        expectedSelectionRevision: sleep.selectionRevision,
        expectedTargetRevision: sleep.revision,
      }
    );
    expect(targetDefinition.statusCode, targetDefinition.body).toBe(200);
    body = targetDefinition.json();
    sleep = body.targets.find((item: any) => item.targetCode === 'SLEEP');

    const feasibility = await respond(
      f,
      'A3011',
      {
        kind: 'FEASIBILITY',
        feasibility: {
          problemBehavior: {
            concreteBehavior: { state: 'KNOWN', text: 'Current sleep-related phone behaviour' },
            need: { state: 'KNOWN', text: 'Immediate entertainment need' },
            motivationBenefit: { state: 'KNOWN', text: 'Immediate enjoyment' },
            abilityConditions: { state: 'KNOWN', text: 'Phone remains available' },
            challengeResistance: { state: 'UNKNOWN' },
          },
          replacementBehavior: {
            concreteQuantified: {
              state: 'KNOWN',
              concreteTargetText: 'SLEEP reselection race feasibility target',
            },
            need: { state: 'KNOWN', rating: 8 },
            motivationBenefit: { state: 'KNOWN', rating: 7 },
            abilityPossibility: { state: 'KNOWN', rating: 6 },
            challengeResistance: { state: 'UNKNOWN' },
          },
        },
      },
      {
        expectedSelectionRevision: sleep.selectionRevision,
        expectedTargetRevision: sleep.revision,
      }
    );
    expect(feasibility.statusCode, feasibility.body).toBe(200);
    body = feasibility.json();
    sleep = body.targets.find((item: any) => item.targetCode === 'SLEEP');

    const scene = await getScene(f);
    const a3002 = scene.nodes.find((node: any) => node.nodeCode === 'A3002');
    const a3012 = scene.nodes.find((node: any) => node.nodeCode === 'A3012');
    expect(a3012, 'A3012 must be materialized after A3011').toBeDefined();
    expect(a3012.status).toBe('AVAILABLE');

    const reselection = app.inject({
      method: 'POST',
      url: `/api/v1/cases/${f.caseId}/scene/nodes/A3002/responses`,
      headers: {
        ...auth(f.manager.token),
        'idempotency-key': `fa-reselect-race-${crypto.randomUUID()}`,
      },
      payload: {
        targetPersonId: f.targetPersonId,
        expectedCaseVersion: f.caseVersion,
        expectedNodeRevision: a3002.revision,
        expectedScenePackageVersion: 'v1',
        expectedSelectionRevision: sleep.selectionRevision,
        response: {
          kind: 'TARGET_SELECTION',
          confirmed: true,
          selectedTargets: ['EXERCISE'],
        },
      },
    });
    const progress = app.inject({
      method: 'POST',
      url: `/api/v1/cases/${f.caseId}/scene/nodes/A3012/responses`,
      headers: {
        ...auth(f.manager.token),
        'idempotency-key': `fa-progress-race-${crypto.randomUUID()}`,
      },
      payload: {
        targetPersonId: f.targetPersonId,
        expectedCaseVersion: f.caseVersion,
        expectedNodeRevision: a3012.revision,
        expectedScenePackageVersion: 'v1',
        expectedSelectionRevision: sleep.selectionRevision,
        expectedTargetRevision: sleep.revision,
        response: {
          kind: 'PROGRESS',
          progress: {
            kind: 'GENERAL_MATRIX',
            taskPlan: { state: 'KNOWN', text: 'Concurrent sleep execution plan.' },
            communication: {
              needMatch: { state: 'KNOWN', text: 'Need discussed.' },
              motivationMatch: { state: 'KNOWN', text: 'Motivation discussed.' },
              abilityMatch: { state: 'KNOWN', text: 'Ability discussed.' },
              challengeResistance: { state: 'KNOWN', text: 'Barrier discussed.' },
            },
            childFeedback: {
              needMatch: { state: 'KNOWN', text: 'Need feedback.' },
              motivationMatch: { state: 'KNOWN', text: 'Motivation feedback.' },
              abilityMatch: { state: 'KNOWN', text: 'Ability feedback.' },
              challengeResistance: { state: 'KNOWN', text: 'Barrier feedback.' },
            },
            userObservation: {
              needMatch: { state: 'KNOWN', text: 'Observed need.' },
              motivationMatch: { state: 'KNOWN', text: 'Observed motivation.' },
              abilityMatch: { state: 'KNOWN', text: 'Observed ability.' },
              challengeResistance: { state: 'KNOWN', text: 'Observed barrier.' },
            },
            otherFamilyFeedback: {
              needMatch: { state: 'NOT_COLLECTED' },
              motivationMatch: { state: 'NOT_COLLECTED' },
              abilityMatch: { state: 'NOT_COLLECTED' },
              challengeResistance: { state: 'NOT_COLLECTED' },
            },
            modifyTarget: 'NO',
          },
          note: 'concurrent progress observation',
        },
      },
    });
    const [reselected, progressed] = await Promise.all([reselection, progress]);
    expect(reselected.statusCode, reselected.body).toBe(200);
    expect([200, 409]).toContain(progressed.statusCode);

    const current = await admin.query<{
      n: number;
      selection_revisions: number;
      selected_sleep: number;
    }>(
      `SELECT
        count(*)::int AS n,
        count(DISTINCT selection_revision)::int AS selection_revisions,
        count(*) FILTER (WHERE target_code='SLEEP' AND selected)::int AS selected_sleep
       FROM digital_use_target_items
       WHERE case_id=$1 AND superseded_at IS NULL`,
      [f.caseId]
    );
    expect(current.rows[0]).toEqual({
      n: 10,
      selection_revisions: 1,
      selected_sleep: 0,
    });
    if (progressed.statusCode === 200) {
      const historical = await admin.query<{ n: number }>(
        `SELECT count(*)::int AS n
           FROM digital_use_target_items
          WHERE case_id=$1 AND target_code='SLEEP'
            AND progress_payload IS NOT NULL`,
        [f.caseId]
      );
      expect(historical.rows[0]!.n).toBeGreaterThan(0);
    }
  });

  it('HX A3000 reassessment and independent A3001 write may coexist without stale cross-branch failure', async () => {
    const f = await fixture('reassess-downstream-race');
    const first = await respond(f, 'A3000', selfAssessment('YES'));
    expect(first.statusCode, first.body).toBe(200);
    const body = first.json();
    const a3000 = body.nodes.find((node: any) => node.nodeCode === 'A3000');
    const a3001 = body.nodes.find((node: any) => node.nodeCode === 'A3001');

    const reassess = app.inject({
      method: 'POST',
      url: `/api/v1/cases/${f.caseId}/scene/nodes/A3000/responses`,
      headers: {
        ...auth(f.manager.token),
        'idempotency-key': `fa-reassess-race-${crypto.randomUUID()}`,
      },
      payload: {
        targetPersonId: f.targetPersonId,
        expectedCaseVersion: f.caseVersion,
        expectedNodeRevision: a3000.revision,
        expectedScenePackageVersion: 'v1',
        response: selfAssessment('NO'),
      },
    });
    const downstream = app.inject({
      method: 'POST',
      url: `/api/v1/cases/${f.caseId}/scene/nodes/A3001/responses`,
      headers: {
        ...auth(f.manager.token),
        'idempotency-key': `fa-downstream-race-${crypto.randomUUID()}`,
      },
      payload: {
        targetPersonId: f.targetPersonId,
        expectedCaseVersion: f.caseVersion,
        expectedNodeRevision: a3001.revision,
        expectedScenePackageVersion: 'v1',
        response: { kind: 'COMMUNICATION_PREP', action: 'ACKNOWLEDGED' },
      },
    });
    const [left, right] = await Promise.all([reassess, downstream]);
    expect([left.statusCode, right.statusCode]).toEqual([200, 200]);

    const artifacts = await admin.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM scene_artifacts
        WHERE case_id=$1
          AND artifact_type='FAMILY_ALLIANCE_SELF_ASSESSMENT'`,
      [f.caseId]
    );
    expect(artifacts.rows[0]!.n).toBe(2);
  });

  it('HX Scene package replacement race is pinned by the A1001 owner row lock', async () => {
    const f = await fixture('package-race');
    const blocker = new pg.Client({
      connectionString: process.env['TEST_ADMIN_DATABASE_URL']!,
    });
    await blocker.connect();
    try {
      await blocker.query('BEGIN');
      await blocker.query(
        `DELETE FROM scene_node_states
          WHERE case_id=$1 AND node_code='A1001'`,
        [f.caseId]
      );
      const a1001 = resolveDigitalUseRuntimeNode('A1001');
      await blocker.query(
        `INSERT INTO scene_node_states
           (family_id,case_id,scene_package_version,node_code,source_node_code,
            status,branch_reason_codes,input_refs,output_refs,revision,completed_at)
         VALUES ($1,$2,'v2',$3,$4,'COMPLETED',ARRAY['PACKAGE_DRIFT_FIXTURE'],
                 '[]'::jsonb,'[]'::jsonb,1,now())`,
        [f.familyId, f.caseId, a1001.nodeCode, a1001.sourceNodeCode]
      );

      const request = app.inject({
        method: 'POST',
        url: `/api/v1/cases/${f.caseId}/scene/nodes/A3000/responses`,
        headers: {
          ...auth(f.manager.token),
          'idempotency-key': `fa-package-race-${crypto.randomUUID()}`,
        },
        payload: {
          targetPersonId: f.targetPersonId,
          expectedCaseVersion: f.caseVersion,
          expectedNodeRevision: 0,
          expectedScenePackageVersion: 'v1',
          response: selfAssessment(),
        },
      });
      await new Promise((resolve) => setTimeout(resolve, 40));
      await blocker.query('COMMIT');
      const blocked = await request;
      expect(blocked.statusCode).toBe(409);
      expect(['SCENE_PACKAGE_MISMATCH','STALE_SCENE_PACKAGE'])
        .toContain(blocked.json().code);
    } finally {
      await blocker.query('ROLLBACK').catch(() => undefined);
      await blocker.end();
    }

    const residue = await admin.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM assertions
        WHERE case_id=$1 AND content LIKE 'DUFA:v1:%'`,
      [f.caseId]
    );
    expect(residue.rows[0]!.n).toBe(0);
  });


  it.each(['business-first', 'revoke-first'] as const)('HX-07 Consent revoke race serializes against Family Alliance processing: %s', async (order) => {
    const f = await fixture('consent-race');
    const child = { personId: f.targetPersonId, token: f.manager.token };

    const noticeHash = getCurrentNoticeHash();
    const acceptedTextHash = getAcceptanceTextHash('v1');
    if (!acceptedTextHash) throw new Error('missing v1 acceptance text');

    const requestSeed = await admin.query<{ id: string }>(
      `INSERT INTO guardian_consent_requests
         (family_id,guardian_person_id,subject_person_id,declared_age_band,
          notice_version,notice_hash,status,expires_at,completed_at)
       VALUES ($1,$2,$3,'UNDER_14','v1',$4,'GRANTED',
               now() + interval '24 hours',now())
       RETURNING id`,
      [f.familyId, f.manager.personId, child.personId, noticeHash]
    );
    const evidence = buildConsentEvidence({
      channel: runtimeConsentChannel(process.env),
      acceptedTextHash,
      clientIp: null,
      userAgent: null,
      pepper: 'slice13-consent-race-fixture',
    });
    const consentSeed = await admin.query<{ id: string }>(
      `INSERT INTO consent_records
         (family_id,guardian_person_id,guardian_account_id,purpose,decision,
          version,onboarding_request_id,bound_person_id,bound_at,
          notice_version,notice_hash,policy_version,evidence)
       VALUES ($1,$2,$3,'UNDER_14_GUARDIAN_CONSENT','GRANTED',
               1,$4,$5,now(),'v1',$6,'v1',$7::jsonb)
       RETURNING id`,
      [
        f.familyId,
        f.manager.personId,
        f.manager.accountId,
        requestSeed.rows[0]!.id,
        child.personId,
        noticeHash,
        JSON.stringify(evidence),
      ]
    );
    const granted = { id: consentSeed.rows[0]!.id };

    const bound = await admin.query<{
      bound_person_id: string | null;
      version: number;
    }>(
      `SELECT bound_person_id,version FROM consent_records WHERE id=$1`,
      [granted.id]
    );
    expect(bound.rows[0]).toMatchObject({
      bound_person_id: child.personId,
      version: 1,
    });

    await admin.query(
      `INSERT INTO person_compliance_profiles
         (person_id,age_band,minor_mode,verified_source,guardian_person_id,
          guardian_consent_record_id,guardian_consent_version)
       VALUES ($1,'UNDER_14',true,'GUARDIAN_RELAY',$2,$3,1)
       ON CONFLICT (person_id) DO UPDATE SET
         age_band='UNDER_14',
         minor_mode=true,
         verified_source='GUARDIAN_RELAY',
         guardian_person_id=EXCLUDED.guardian_person_id,
         guardian_consent_record_id=EXCLUDED.guardian_consent_record_id,
         guardian_consent_version=1,
         effective_at=now(),
         updated_at=now()`,
      [child.personId, f.manager.personId, granted.id]
    );
    let observedGranted!: () => void;
    const grantedObserved = new Promise<void>((resolve) => { observedGranted = resolve; });
    let releaseBusiness!: () => void;
    const businessReleased = new Promise<void>((resolve) => { releaseBusiness = resolve; });
    const originalRead = complianceRepository.getConsentRecordForGate;
    let paused = false;
    const consentRead = vi.spyOn(complianceRepository, 'getConsentRecordForGate')
      .mockImplementation(async (...args) => {
        const record = await originalRead(...args);
        if (order === 'business-first' && args[1] === granted.id && !paused) {
          paused = true;
          expect(record?.decision).toBe('GRANTED');
          observedGranted();
          await businessReleased;
        }
        return record;
      });
    const revoke = () => revokeConsent(app, f.manager.token,
      `fa-consent-race-${crypto.randomUUID()}`, granted.id,
      { reason: 'deterministic serialization test' });
    if (order === 'revoke-first') {
      const revoked = await revoke();
      expect(revoked.statusCode, revoked.body).toBe(200);
    }

    const familyRequest = app.inject({
      method: 'POST',
      url: `/api/v1/cases/${f.caseId}/scene/nodes/A3000/responses`,
      headers: {
        ...auth(child.token),
        'idempotency-key': `fa-consent-family-${crypto.randomUUID()}`,
      },
      payload: {
        targetPersonId: f.targetPersonId,
        expectedCaseVersion: f.caseVersion,
        expectedNodeRevision: 0,
        expectedScenePackageVersion: 'v1',
        response: selfAssessment(),
      },
    });
    let familyResult;
    try {
      if (order === 'business-first') {
        const pendingBusiness = familyRequest.then((response) => response);
        await grantedObserved;
        releaseBusiness();
        familyResult = await pendingBusiness;
        const revoked = await revoke();
        expect(revoked.statusCode, revoked.body).toBe(200);
        // Frozen D5 permits UNDER_14 consent administration only; observing
        // GRANTED is therefore legitimately blocked for FAMILY_ALLIANCE.
        expect(familyResult.statusCode, familyResult.body).toBe(409);
        expect(familyResult.json().code).toBe('CONSENT_BLOCKED');
      } else {
        familyResult = await familyRequest;
        expect([403, 409]).toContain(familyResult.statusCode);
        expect(['GUARDIAN_CONSENT_REVOKED', 'CONSENT_BLOCKED']).toContain(familyResult.json().code);
      }
    } finally {
      releaseBusiness();
      consentRead.mockRestore();
    }

    const final = await admin.query<{
      guardian_consent_version: number;
      decision: string;
    }>(
      `SELECT p.guardian_consent_version,c.decision
         FROM person_compliance_profiles p
         JOIN consent_records c ON c.id=p.guardian_consent_record_id
        WHERE p.person_id=$1`,
      [child.personId]
    );
    expect(final.rows[0]).toEqual({
      guardian_consent_version: 2,
      decision: 'REVOKED',
    });

    const currentArtifacts = await admin.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM scene_artifacts
        WHERE case_id=$1
          AND artifact_type='FAMILY_ALLIANCE_SELF_ASSESSMENT'`,
      [f.caseId]
    );
    expect(currentArtifacts.rows[0]!.n).toBe(0);
  });


  it('HX-11 dependency unavailable is distinct from denial and infrastructure failure', async () => {
    const f = await fixture('dependency-unavailable');
    await admin.query(
      `DELETE FROM assertions
        WHERE case_id=$1
          AND (
            content LIKE 'DUA:v1:01002.emotion:%'
            OR content LIKE 'DUA:v1:01003.family_relationship:%'
          )`,
      [f.caseId]
    );
    const entry = await respond(f, 'A3000', selfAssessment());
    expect(entry.statusCode, entry.body).toBe(200);

    const unavailable = await respond(
      f,
      'A3002',
      { kind: 'TARGET_SELECTION', confirmed: true, selectedTargets: [] },
      { expectedSelectionRevision: 0 }
    );
    expect(unavailable.statusCode, unavailable.body).toBe(503);
    expect(unavailable.json().code).toBe('DEPENDENCY_UNAVAILABLE');
  });

});
