import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import type { FastifyInstance } from 'fastify';
import pg from 'pg';
import { buildApp } from '../../apps/server/api/src/app.js';
import type { RoleplayAdapter } from '../../apps/server/api/src/services/digital-use-roleplay-adapter.js';
import { withRlsTransaction } from '../../apps/server/api/src/db/tx.js';
import { recordStatement } from '@xiaoshuyin/domain';
import { resolveFamilyAllianceContent } from '@xiaoshuyin/scenes/digital-use';
import { createAdminPool } from '../setup/db.js';
import {
  auth,
  commandHeaders,
  createFamily,
  createMember,
  loginWithLabel,
  type LoginResult,
} from '../setup/api.js';
import {
  acceptInvite,
  createCase,
  invite,
} from '../setup/participation.js';
import {
  candidateSession,
  confirmerDecision,
  startBinding,
} from '../setup/identity-binding.js';
import {
  TEST_A5001_PACKAGE,
  TEST_A5002_PACKAGE,
  TestProfessionalReviewContentProvider,
  normalizedReviewResponse,
} from '../support/digital-use-review-professional-content.js';

interface Fixture {
  manager: LoginResult;
  familyId: string;
  caseId: string;
  scene: any;
}

function a1001(impact = true) {
  return {
    devices: ['PHONE'],
    purposeDurations: {
      learningResearchHomework: {
        state: 'KNOWN',
        minutesPerDay: 30,
        certainty: 'ESTIMATE',
      },
      necessaryContact: {
        state: 'KNOWN',
        minutesPerDay: 15,
        certainty: 'EXACT',
      },
      entertainmentGamingVideoSocialNonLearning: {
        state: 'KNOWN',
        minutesPerDay: 90,
        certainty: 'ESTIMATE',
      },
    },
    functionalImpact: {
      sleep: { state: 'KNOWN', impacted: impact },
      studyOrNecessaryAffairs: { state: 'KNOWN', impacted: false },
      realWorldActivityDisplacement: { state: 'KNOWN', impacted: false },
    },
  };
}

function a2003Response() {
  return {
    expectedDuration: {
      state: 'KNOWN',
      minutesPerDay: 90,
      certainty: 'ESTIMATE',
    },
    reason: {
      state: 'KNOWN',
      text: 'Reduce disruption around daily routines.',
    },
    priorMethods: { state: 'UNKNOWN' },
    observedEffect: { state: 'UNKNOWN' },
    difficulties: {
      state: 'KNOWN',
      text: 'Transitions are difficult.',
    },
  };
}

function familySelfAssessment() {
  return {
    kind: 'SELF_ASSESSMENT',
    answers: {
      emotionAttention: 'YES',
      negotiatedAgreement: 'YES',
      trustsAgreement: 'YES',
      familyCoordination: 'YES',
      parentEmotionFluctuation: 'YES',
      keepsPromises: 'YES',
    },
  };
}

const COMPLIANCE_POLICY_TEST_LOCK_PREFIX =
  'test:compliance-policy:';

function compliancePolicyTestLockKey(featureCode: string): string {
  return `${COMPLIANCE_POLICY_TEST_LOCK_PREFIX}${featureCode}:v1`;
}

async function ensureVerticalCompliancePolicy(
  client: pg.Client,
  featureCode: string,
  minorAccessRule: 'BASELINE' | 'MINORS_BLOCKED'
): Promise<void> {
  const { rows } = await client.query<{
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
  const current = rows[0] ?? null;
  if (
    current !== null &&
    current.anthropomorphic_applicability === 'NOT_APPLICABLE' &&
    current.minor_access_rule === minorAccessRule &&
    current.ai_disclosure_rule === 'BASELINE' &&
    current.generated_content_label_rule === 'BASELINE' &&
    current.usage_reminder_rule === 'BASELINE'
  ) {
    return;
  }

  const { rows: maxRows } = await client.query<{ max_version: number | null }>(
    `SELECT max(policy_version)::int AS max_version
       FROM compliance_feature_policies
      WHERE feature_code=$1
        AND feature_contract_revision='v1'`,
    [featureCode]
  );
  const nextVersion = (maxRows[0]?.max_version ?? 0) + 1;
  await client.query(
    `SELECT app.publish_compliance_feature_policy(
       $1,'v1',$2,$3,
       'NOT_APPLICABLE',$4,'BASELINE','BASELINE','BASELINE',
       'Digital Use vertical convergence test basis',
       'evidence://vertical-convergence/test',
       now() - interval '1 minute',
       $5
     )`,
    [
      featureCode,
      current?.policy_version ?? null,
      nextVersion,
      minorAccessRule,
      `test:vertical-convergence:${featureCode}:${nextVersion}`,
    ]
  );
}

describe('Digital Use vertical convergence', () => {
  let app: FastifyInstance;
  let productionBoundaryApp: FastifyInstance;
  let admin: pg.Pool;
  let appPool: pg.Pool;
  let migrator: pg.Client;
  let adapterAvailable = false;
  const professionalReviewProvider = new TestProfessionalReviewContentProvider();

  const roleplayAdapter: RoleplayAdapter = {
    adapterRef: 'test:vertical-roleplay-v1',
    async isAvailable() {
      return adapterAvailable;
    },
    async createTurn(input) {
      return {
        simulatedParentOutput: `vertical-parent:${input.simulatedChildInput}`,
        adapterRef: 'test:vertical-roleplay-v1',
        modelRef: 'test-model:vertical-v1',
        promptVersionRef: 'test-prompt:vertical-v1',
      };
    },
  };

  beforeAll(async () => {
    app = await buildApp({
      phoneUseContract: {
        roleplayAdapter,
        roleplayProfessionalContent: {
          status: 'APPROVED_PUBLISHED',
          version: 'test-professional-roleplay-v1',
          authorityRef: 'test-authority:vertical-roleplay-v1',
        },
        roleplayModelPromptAuthority: async () => ({
          model: {
            status: 'CURRENT_APPROVED',
            modelRef: 'test-model:vertical-v1',
            authorityRef: 'test-authority:model:vertical-v1',
          },
          prompt: {
            status: 'CURRENT_APPROVED',
            promptVersionRef: 'test-prompt:vertical-v1',
            authorityRef: 'test-authority:prompt:vertical-v1',
          },
        }),
      },
      digitalUseReview: {
        professionalContent: professionalReviewProvider,
      },
    });
    await app.ready();
    productionBoundaryApp = await buildApp();
    await productionBoundaryApp.ready();
    admin = createAdminPool();
    appPool = new pg.Pool({ connectionString: process.env['DATABASE_URL'] });
    migrator = new pg.Client({
      connectionString: process.env['MIGRATION_DATABASE_URL'],
    });
    await migrator.connect();

    for (const [featureCode, ageRule] of [
      ['DIGITAL_USE_ASSESSMENT_RUNTIME', 'BASELINE'],
      ['DIGITAL_USE_FAMILY_ALLIANCE_RUNTIME', 'BASELINE'],
      ['DIGITAL_USE_ROLEPLAY_A4003', 'MINORS_BLOCKED'],
    ] as const) {
      // These policies are global test fixtures. Hold a session advisory lock
      // for the full suite so another integration file cannot temporarily
      // supersede the policy while Golden E2E is executing.
      await migrator.query(
        'SELECT pg_advisory_lock(hashtextextended($1,0))',
        [compliancePolicyTestLockKey(featureCode)]
      );
      await ensureVerticalCompliancePolicy(migrator, featureCode, ageRule);
    }
  });

  afterAll(async () => {
    await admin.query(
      `UPDATE compliance_feature_policies
          SET superseded_by_policy_id = NULL
        WHERE feature_code IN (
          'DIGITAL_USE_ASSESSMENT_RUNTIME',
          'DIGITAL_USE_FAMILY_ALLIANCE_RUNTIME',
          'DIGITAL_USE_ROLEPLAY_A4003'
        )
          AND feature_contract_revision='v1'`
    ).catch(() => undefined);
    await admin.query(
      `DELETE FROM compliance_feature_policies
        WHERE feature_code IN (
          'DIGITAL_USE_ASSESSMENT_RUNTIME',
          'DIGITAL_USE_FAMILY_ALLIANCE_RUNTIME',
          'DIGITAL_USE_ROLEPLAY_A4003'
        )
          AND feature_contract_revision='v1'`
    ).catch(() => undefined);
    for (const featureCode of [
      'DIGITAL_USE_ASSESSMENT_RUNTIME',
      'DIGITAL_USE_FAMILY_ALLIANCE_RUNTIME',
      'DIGITAL_USE_ROLEPLAY_A4003',
    ] as const) {
      await migrator.query(
        'SELECT pg_advisory_unlock(hashtextextended($1,0))',
        [compliancePolicyTestLockKey(featureCode)]
      ).catch(() => undefined);
    }
    await migrator.end().catch(() => undefined);
    await appPool.end().catch(() => undefined);
    await admin.end().catch(() => undefined);
    await productionBoundaryApp.close();
    await app.close();
  });

  async function fixture(
    label: string,
    targetApp: FastifyInstance = app
  ): Promise<Fixture> {
    const manager = await loginWithLabel(targetApp, `du-vertical-${label}`);
    const family = await createFamily(targetApp, manager.token, `du-vertical-${label}`);
    expect(family.statusCode, family.body).toBe(201);
    const familyId = family.json().id as string;

    const kase = await createCase(targetApp, manager.token, `du-vertical-${label}`);
    expect(kase.statusCode, kase.body).toBe(201);
    const caseId = kase.json().id as string;

    const message = await targetApp.inject({
      method: 'POST',
      url: `/api/v1/cases/${caseId}/messages`,
      headers: commandHeaders(manager.token, `du-vertical-msg-${label}`),
      payload: {
        content: 'Digital use is disrupting current family routines.',
      },
    });
    expect(message.statusCode, message.body).toBe(201);

    const start = await targetApp.inject({
      method: 'POST',
      url: `/api/v1/cases/${caseId}/assessments`,
      headers: commandHeaders(manager.token, `du-vertical-start-${label}`),
      payload: { expectedCaseVersion: kase.json().version },
    });
    expect(start.statusCode, start.body).toBe(200);
    expect(start.json().currentNode?.nodeCode).toBe('A1001');

    return {
      manager,
      familyId,
      caseId,
      scene: start.json(),
    };
  }

  async function getScene(
    f: Fixture,
    targetApp: FastifyInstance = app
  ): Promise<any> {
    const response = await targetApp.inject({
      method: 'GET',
      url: `/api/v1/cases/${f.caseId}/scene`,
      headers: auth(f.manager.token),
    });
    expect(response.statusCode, response.body).toBe(200);
    return response.json();
  }

  async function respondNode(
    f: Fixture,
    nodeCode: string,
    response: Record<string, unknown>,
    extra: Record<string, unknown> = {},
    targetApp: FastifyInstance = app
  ): Promise<any> {
    const scene = await getScene(f, targetApp);
    const node = scene.nodes.find((item: any) => item.nodeCode === nodeCode);
    expect(node, `${nodeCode} must be materialized before response`).toBeTruthy();

    const result = await targetApp.inject({
      method: 'POST',
      url: `/api/v1/cases/${f.caseId}/scene/nodes/${nodeCode}/responses`,
      headers: commandHeaders(
        f.manager.token,
        `du-vertical-${nodeCode.toLowerCase()}-${crypto.randomUUID()}`
      ),
      payload: {
        expectedCaseVersion: scene.caseVersion,
        expectedNodeRevision: node.revision,
        expectedScenePackageVersion: scene.scenePackageVersion,
        response,
        ...extra,
      },
    });
    expect(result.statusCode, result.body).toBe(200);
    return result.json();
  }

  async function confirmCurrentFormulation(
    f: Fixture,
    targetApp: FastifyInstance = app
  ): Promise<any> {
    const current = await targetApp.inject({
      method: 'GET',
      url: `/api/v1/cases/${f.caseId}/problem-formulations/current`,
      headers: auth(f.manager.token),
    });
    expect(current.statusCode, current.body).toBe(200);
    expect(current.json().current?.status).toBe('PRESENTED');

    const scene = await getScene(f, targetApp);
    const formulation = current.json().current;
    const confirmed = await targetApp.inject({
      method: 'POST',
      url:
        `/api/v1/cases/${f.caseId}/problem-formulations/` +
        `${formulation.version}/confirm`,
      headers: {
        ...commandHeaders(f.manager.token, 'du-vertical-pf-confirm'),
        'if-match': `"case-v${scene.caseVersion}"`,
      },
      payload: {},
    });
    expect(confirmed.statusCode, confirmed.body).toBe(200);
    expect(confirmed.json().current?.status).toBe('CONFIRMED');

    const refreshed = await getScene(f, targetApp);
    const caseRow = await admin.query(
      `SELECT phase::text AS phase FROM cases WHERE id=$1`,
      [f.caseId]
    );
    expect(caseRow.rows[0].phase).toBe('GOALS');
    return refreshed;
  }

  function supportedGoalDependencies(formulation: any) {
    const supported = (formulation.dependencyRefs ?? []).filter(
      (dependency: any) =>
        dependency.type === 'EVIDENCE' || dependency.type === 'CONSENT'
    );
    expect(supported.length).toBeGreaterThan(0);
    return supported;
  }

  async function confirmGoalCompatibleFormulation(
    f: Fixture,
    scene: any
  ): Promise<any> {
    const current = await app.inject({
      method: 'GET',
      url: `/api/v1/cases/${f.caseId}/problem-formulations/current`,
      headers: auth(f.manager.token),
    });
    expect(current.statusCode, current.body).toBe(200);
    const formulation = current.json().current;
    expect(formulation?.status).toBe('PRESENTED');

    const supportedDependencies = supportedGoalDependencies(formulation);
    let confirmVersion = formulation.version as number;
    let confirmCaseVersion = scene.caseVersion as number;

    if (supportedDependencies.length !== formulation.dependencyRefs.length) {
      const corrected = await app.inject({
        method: 'POST',
        url:
          `/api/v1/cases/${f.caseId}/problem-formulations/` +
          formulation.version +
          '/corrections',
        headers: {
          ...commandHeaders(
            f.manager.token,
            `phase2-t1-pf-correction-${crypto.randomUUID()}`
          ),
          'if-match': `"case-v${scene.caseVersion}"`,
        },
        payload: {
          changes: {
            dependencyRefs: supportedDependencies,
          },
          note: 'Use only dependencies that Goal V1 can authoritatively revalidate.',
        },
      });
      expect(corrected.statusCode, corrected.body).toBe(201);
      expect(corrected.json().current?.status).toBe('PRESENTED');
      expect(
        corrected.json().current?.dependencyRefs.every(
          (dependency: any) =>
            dependency.type === 'EVIDENCE' || dependency.type === 'CONSENT'
        )
      ).toBe(true);
      confirmVersion = corrected.json().current.version;
      confirmCaseVersion = corrected.json().caseVersion;
    }

    const confirmed = await app.inject({
      method: 'POST',
      url:
        `/api/v1/cases/${f.caseId}/problem-formulations/` +
        confirmVersion +
        '/confirm',
      headers: {
        ...commandHeaders(
          f.manager.token,
          `phase2-t1-pf-confirm-${crypto.randomUUID()}`
        ),
        'if-match': `"case-v${confirmCaseVersion}"`,
      },
      payload: {},
    });
    expect(confirmed.statusCode, confirmed.body).toBe(200);
    expect(confirmed.json().current?.status).toBe('CONFIRMED');

    const refreshed = await getScene(f);
    const caseRow = await admin.query(
      'SELECT phase::text AS phase FROM cases WHERE id=$1',
      [f.caseId]
    );
    expect(caseRow.rows[0].phase).toBe('GOALS');
    return refreshed;
  }

  async function advanceToGoalReady(f: Fixture): Promise<any> {
    await respondNode(f, 'A1001', a1001(true));
    await respondNode(f, '01002', {
      state: 'KNOWN',
      selections: ['A'],
    });
    let scene = await respondNode(f, '01003', {
      state: 'KNOWN',
      selection: 'A',
    });
    expect(scene.nodes.find((node: any) => node.nodeCode === 'A2003')?.status)
      .toBe('AVAILABLE');

    scene = await confirmGoalCompatibleFormulation(f, scene);
    await respondNode(f, 'A2003', a2003Response());
    await respondNode(f, 'A2004', { decision: 'YES' });
    await respondNode(f, 'A2005', { decision: 'WILLING' });
    await respondNode(f, 'A2007', {
      timeline: {
        reviewDate: '2026-12-01',
        cadence: 'weekly',
      },
    });
    scene = await respondNode(f, 'A2010', {
      action: 'GENERATE_SUMMARY',
    });
    expect(scene.nodes.find((node: any) => node.nodeCode === 'A2010')?.status)
      .toBe('COMPLETED');
    return scene;
  }

  async function currentConfirmedGoalFormulation(f: Fixture): Promise<any> {
    const current = await app.inject({
      method: 'GET',
      url: `/api/v1/cases/${f.caseId}/problem-formulations/current`,
      headers: auth(f.manager.token),
    });
    expect(current.statusCode, current.body).toBe(200);
    const formulation = current.json().current;
    expect(formulation?.status).toBe('CONFIRMED');

    const persisted = await admin.query<{
      case_id: string;
      version: number;
      status: string;
      review_state: string;
    }>(
      `SELECT case_id,version,status::text AS status,review_state::text AS review_state
         FROM problem_formulations
        WHERE case_id=$1 AND version=$2`,
      [f.caseId, formulation.version]
    );
    expect(persisted.rows).toHaveLength(1);
    expect(persisted.rows[0]).toEqual({
      case_id: f.caseId,
      version: formulation.version,
      status: 'CONFIRMED',
      review_state: 'CURRENT',
    });
    return formulation;
  }

  function phase2T1GoalSavePayload(formulation: any) {
    const baseline =
      formulation.evidenceRefs?.[0] ??
      formulation.primaryProblem?.evidenceRefs?.[0];
    expect(baseline).toBeTruthy();
    expect(formulation.dependencyRefs?.length).toBeGreaterThan(0);
    return {
      operation: 'SAVE',
      problemFormulationId: formulation.id,
      problemFormulationVersion: formulation.version,
      baselineRefs: [baseline],
      targetDescription:
        'Reduce disruptive evening device use while preserving required study contact.',
      observationMethod:
        'Track bedtime, conflict intensity, and required-study access.',
      observationWindow: '14 days',
      protectiveConditions: [
        'Preserve schoolwork and necessary family contact.',
      ],
      parentActions: [
        'Use one agreed transition prompt and avoid escalating conflict.',
      ],
      reviewPoint: 'Review after 14 days.',
      dependencyRefs: formulation.dependencyRefs,
      participantResponsibilities: [],
    };
  }

  async function savePhase2T1Goal(
    f: Fixture,
    caseVersion: number,
    formulation: any
  ) {
    return app.inject({
      method: 'POST',
      url: `/api/v1/cases/${f.caseId}/goals`,
      headers: {
        ...auth(f.manager.token),
        'idempotency-key': `phase2-t1-goal-save-${crypto.randomUUID()}`,
        'if-match': `"case-v${caseVersion}"`,
      },
      payload: phase2T1GoalSavePayload(formulation),
    });
  }

  async function confirmPhase2T1Goal(
    f: Fixture,
    caseVersion: number,
    goalId: string,
    goalVersion: number
  ) {
    return app.inject({
      method: 'POST',
      url: `/api/v1/cases/${f.caseId}/goals`,
      headers: {
        ...auth(f.manager.token),
        'idempotency-key': `phase2-t1-goal-confirm-${crypto.randomUUID()}`,
        'if-match': `"case-v${caseVersion}"`,
      },
      payload: {
        operation: 'CONFIRM',
        goalId,
        goalVersion,
      },
    });
  }

  async function advanceToParallelLanes(
    f: Fixture,
    targetApp: FastifyInstance = app
  ): Promise<any> {
    await respondNode(f, 'A1001', a1001(true), {}, targetApp);
    await respondNode(f, '01002', {
      state: 'KNOWN',
      selections: ['A'],
    }, {}, targetApp);
    let scene = await respondNode(f, '01003', {
      state: 'KNOWN',
      selection: 'A',
    }, {}, targetApp);
    expect(scene.nodes.find((node: any) => node.nodeCode === 'A2003')?.status)
      .toBe('AVAILABLE');

    scene = await confirmCurrentFormulation(f, targetApp);
    expect(scene.nodes.find((node: any) => node.nodeCode === 'A2003')?.status)
      .toBe('AVAILABLE');

    await respondNode(f, 'A2003', a2003Response(), {}, targetApp);
    await respondNode(f, 'A2004', { decision: 'YES' }, {}, targetApp);
    await respondNode(f, 'A2005', { decision: 'WILLING' }, {}, targetApp);
    await respondNode(f, 'A2007', {
      timeline: {
        reviewDate: '2026-12-01',
        cadence: 'weekly',
      },
    }, {}, targetApp);
    scene = await respondNode(f, 'A2010', {
      action: 'GENERATE_SUMMARY',
    }, {}, targetApp);

    expect(scene.activeNodes).toEqual(expect.arrayContaining([
      expect.objectContaining({ nodeCode: 'A3000', status: 'AVAILABLE' }),
      expect.objectContaining({ nodeCode: 'A4001', status: 'AVAILABLE' }),
    ]));
    return scene;
  }


  async function bindAndAcceptCanonicalParticipant(
    f: Fixture,
    label: string
  ): Promise<{ personId: string; participationId: string; token: string }> {
    const member = await createMember(
      app,
      f.manager.token,
      f.familyId,
      `phase3-${label}-member`,
      {
        ageBand: 'MINOR_14_17',
        ageBandSource: 'GUARDIAN_RELAY',
      }
    );
    expect(member.statusCode, member.body).toBe(201);
    const personId = member.json().personId as string;

    const created = await invite(
      app,
      f.manager.token,
      f.caseId,
      personId,
      `phase3-${label}-invite-${crypto.randomUUID()}`
    );
    expect(created.statusCode, created.body).toBe(201);
    expect(created.json().state).toBe('PENDING');

    const target = {
      guardian: f.manager,
      familyId: f.familyId,
      targetPersonId: personId,
      invitationToken: created.json().inviteToken as string,
      participationId: created.json().participationId as string,
    };
    const runtime = { app, admin };
    const { contextToken, attemptId } = await startBinding(
      runtime,
      target,
      `phase3_${label}_binding_${crypto.randomUUID()}`
    );
    const confirmed = await confirmerDecision(
      runtime,
      f.manager.token,
      attemptId,
      { personId, decision: 'AFFIRM' }
    );
    expect(confirmed.statusCode, confirmed.body).toBe(200);
    expect(confirmed.json().state).toBe('COMMITTED');

    const session = await candidateSession(runtime, contextToken);
    expect(session.statusCode, session.body).toBe(200);
    expect(session.json().binding).toBe('COMMITTED');
    const token = session.json().sessionToken as string;

    const accepted = await acceptInvite(
      app,
      token,
      target.invitationToken,
      `phase3-${label}-accept-${crypto.randomUUID()}`
    );
    expect(accepted.statusCode, accepted.body).toBe(200);
    expect(accepted.json()).toMatchObject({
      id: target.participationId,
      personId,
      state: 'ACTIVE',
    });
    return { personId, participationId: target.participationId, token };
  }

  async function completeCanonicalSleepRuntime(f: Fixture): Promise<any> {
    let scene = await respondNode(f, 'A3000', familySelfAssessment());
    expect(scene.nodes.find((node: any) => node.nodeCode === 'A3002')?.status)
      .toBe('AVAILABLE');

    scene = await respondNode(
      f,
      'A3002',
      {
        kind: 'TARGET_SELECTION',
        confirmed: true,
        selectedTargets: ['SLEEP'],
      },
      { expectedSelectionRevision: scene.targetSelectionRevision ?? 0 }
    );
    let sleep = scene.targets.find((target: any) => target.targetCode === 'SLEEP');
    expect(sleep?.selected).toBe(true);

    scene = await respondNode(
      f,
      'A3010',
      {
        kind: 'TARGET_DEFINITION',
        concreteTargetText: 'Keep a consistent sleep schedule this week.',
      },
      {
        expectedSelectionRevision: sleep.selectionRevision,
        expectedTargetRevision: sleep.revision,
      }
    );
    sleep = scene.targets.find((target: any) => target.targetCode === 'SLEEP');

    scene = await respondNode(
      f,
      'A3011',
      {
        kind: 'FEASIBILITY',
        feasibility: {
          problemBehavior: {
            concreteBehavior: { state: 'KNOWN', text: 'Bedtime is currently inconsistent.' },
            need: { state: 'KNOWN', text: 'Evening decompression.' },
            motivationBenefit: { state: 'KNOWN', text: 'More rest the next day.' },
            abilityConditions: { state: 'KNOWN', text: 'Family can prepare earlier.' },
            challengeResistance: { state: 'UNKNOWN' },
          },
          replacementBehavior: {
            concreteQuantified: {
              state: 'KNOWN',
              concreteTargetText: 'Keep a consistent sleep schedule this week.',
            },
            need: { state: 'KNOWN', rating: 8 },
            motivationBenefit: { state: 'KNOWN', rating: 8 },
            abilityPossibility: { state: 'KNOWN', rating: 7 },
            challengeResistance: { state: 'UNKNOWN' },
          },
        },
      },
      {
        expectedSelectionRevision: sleep.selectionRevision,
        expectedTargetRevision: sleep.revision,
      }
    );
    sleep = scene.targets.find((target: any) => target.targetCode === 'SLEEP');

    scene = await respondNode(
      f,
      'A3012',
      {
        kind: 'PROGRESS',
        progress: {
          kind: 'GENERAL_MATRIX',
          taskPlan: { state: 'KNOWN', text: 'Start the bedtime routine earlier.' },
          communication: {
            needMatch: { state: 'KNOWN', text: 'Need discussed.' },
            motivationMatch: { state: 'KNOWN', text: 'Benefit discussed.' },
            abilityMatch: { state: 'KNOWN', text: 'Ability discussed.' },
            challengeResistance: { state: 'KNOWN', text: 'One barrier discussed.' },
          },
          childFeedback: {
            needMatch: { state: 'NOT_COLLECTED' },
            motivationMatch: { state: 'NOT_COLLECTED' },
            abilityMatch: { state: 'NOT_COLLECTED' },
            challengeResistance: { state: 'NOT_COLLECTED' },
          },
          userObservation: {
            needMatch: { state: 'KNOWN', text: 'Routine started earlier.' },
            motivationMatch: { state: 'KNOWN', text: 'Less bedtime resistance.' },
            abilityMatch: { state: 'KNOWN', text: 'Schedule was feasible.' },
            challengeResistance: { state: 'KNOWN', text: 'Late homework remains a barrier.' },
          },
          otherFamilyFeedback: {
            needMatch: { state: 'NOT_COLLECTED' },
            motivationMatch: { state: 'NOT_COLLECTED' },
            abilityMatch: { state: 'NOT_COLLECTED' },
            challengeResistance: { state: 'NOT_COLLECTED' },
          },
          modifyTarget: 'NO',
        },
        note: 'Phase 3 canonical A5001 E2E observation.',
      },
      {
        expectedSelectionRevision: sleep.selectionRevision,
        expectedTargetRevision: sleep.revision,
      }
    );
    return scene;
  }

  async function submitCanonicalA5001(f: Fixture, scene: any) {
    const selectedTargets = scene.targets
      .filter((target: any) => target.selected)
      .map((target: any) => ({
        targetId: target.id,
        targetCode: target.targetCode,
        targetRevision: target.revision,
      }));
    const node = scene.nodes.find((item: any) => item.nodeCode === 'A5001');
    return app.inject({
      method: 'POST',
      url: `/api/v1/cases/${f.caseId}/scene/nodes/A5001/responses`,
      headers: commandHeaders(
        f.manager.token,
        `phase3-a5001-${crypto.randomUUID()}`
      ),
      payload: {
        expectedCaseVersion: scene.caseVersion,
        expectedNodeRevision: node?.revision ?? 0,
        expectedScenePackageVersion: 'v1',
        expectedSelectionRevision: scene.targetSelectionRevision,
        response: {
          kind: 'FAMILY_ALLIANCE_REVIEW',
          subject: {
            selectionRevision: scene.targetSelectionRevision,
            selectedTargets,
          },
          professionalPackage: TEST_A5001_PACKAGE,
          packageResponse: normalizedReviewResponse,
          evidenceRefs: [],
          provenance: [{
            kind: 'PARENT_AUTHORED_OBSERVATION',
            sourcePersonId: f.manager.personId,
          }],
        },
      },
    });
  }

  it('Golden E2E reaches real authority boundary without business-state fabrication', async () => {
    const f = await fixture('golden-e2e', productionBoundaryApp);
    let scene = await advanceToParallelLanes(f, productionBoundaryApp);

    // Wrong quiz answers are a real retry, not a forced node transition.
    scene = await respondNode(
      f,
      'A4001',
      {
        contentVersion: 'phone-use-contract-v1',
        answers: [true, true, true, true, true],
      },
      {},
      productionBoundaryApp
    );
    expect(scene.nodes.find((node: any) => node.nodeCode === 'A4001')?.status)
      .toBe('IN_PROGRESS');
    expect(scene.nodes.some((node: any) => node.nodeCode === 'A4002')).toBe(false);

    const wrongAttempt = await admin.query<{ data: any }>(
      `SELECT data
         FROM scene_artifacts
        WHERE case_id=$1
          AND artifact_type='PHONE_USE_CONTRACT_QUIZ_ATTEMPT'
        ORDER BY revision DESC
        LIMIT 1`,
      [f.caseId]
    );
    expect(wrongAttempt.rows[0]?.data.allCorrect).toBe(false);
    expect(wrongAttempt.rows[0]?.data.results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          correct: false,
          explanation: expect.any(String),
        }),
      ])
    );

    scene = await respondNode(
      f,
      'A4001',
      {
        contentVersion: 'phone-use-contract-v1',
        answers: [true, false, false, false, false],
      },
      {},
      productionBoundaryApp
    );
    expect(scene.nodes.find((node: any) => node.nodeCode === 'A4002')?.status)
      .toBe('AVAILABLE');

    // Product-frozen template is readable. Professional examples are not
    // silently promoted when no Professional Reviewer authority is assigned.
    const template = await productionBoundaryApp.inject({
      method: 'GET',
      url: `/api/v1/cases/${f.caseId}/digital-use/contract/template`,
      headers: auth(f.manager.token),
    });
    expect(template.statusCode, template.body).toBe(200);
    expect(template.json().meta).toMatchObject({
      contentVersion: 'phone-use-contract-v1',
      approved: true,
    });
    expect(template.json().meta).not.toHaveProperty('professionalApproval');

    const examples = await productionBoundaryApp.inject({
      method: 'GET',
      url: `/api/v1/cases/${f.caseId}/digital-use/contract/examples`,
      headers: auth(f.manager.token),
    });
    expect(examples.statusCode, examples.body).toBe(409);
    expect(examples.json()).toMatchObject({
      code: 'PHONE_USE_CONTRACT_CONTENT_STALE',
    });

    scene = await respondNode(
      f,
      'A4002',
      {
        contentVersion: 'phone-use-contract-v1',
        action: 'ACKNOWLEDGE_TEMPLATE',
      },
      {},
      productionBoundaryApp
    );
    expect(scene.nodes.find((node: any) => node.nodeCode === 'A4003')?.status)
      .toBe('AVAILABLE');

    // Production has no assigned Professional Content authority. A4003 must
    // HOLD without creating fake sessions/selections or unlocking A4004.
    const beforeHold = await getScene(f, productionBoundaryApp);
    const hold = await productionBoundaryApp.inject({
      method: 'POST',
      url: `/api/v1/cases/${f.caseId}/digital-use/roleplays`,
      headers: commandHeaders(f.manager.token, 'du-golden-a4003-hold'),
      payload: {
        expectedCaseVersion: beforeHold.caseVersion,
        professionalContentVersion: 'unassigned-production-roleplay',
      },
    });
    expect(hold.statusCode, hold.body).toBe(200);
    expect(hold.json()).toMatchObject({
      kind: 'HOLD',
      nodeCode: 'A4003',
      status: 'IN_PROGRESS',
      reasonCode: 'PROFESSIONAL_CONTENT_UNAVAILABLE',
    });

    const roleplayReadback = await admin.query(
      `SELECT
         (SELECT count(*)::int FROM roleplay_sessions WHERE case_id=$1) AS sessions,
         (SELECT count(*)::int FROM scene_artifacts
           WHERE case_id=$1
             AND artifact_type='PHONE_USE_ROLEPLAY_SELECTION') AS selections,
         (SELECT count(*)::int FROM scene_node_states
           WHERE case_id=$1 AND node_code='A4004') AS a4004`,
      [f.caseId]
    );
    expect(roleplayReadback.rows[0]).toEqual({
      sessions: 0,
      selections: 0,
      a4004: 0,
    });

    // Family Alliance continues independently on the same Case while A4003 is held.
    scene = await respondNode(
      f,
      'A3000',
      familySelfAssessment(),
      {},
      productionBoundaryApp
    );
    expect(scene.nodes.find((node: any) => node.nodeCode === 'A4003')?.status)
      .toBe('IN_PROGRESS');
    expect(scene.nodes.find((node: any) => node.nodeCode === 'A3002')?.status)
      .toBe('AVAILABLE');

    const a3000Artifact = await admin.query<{ data: any }>(
      `SELECT data
         FROM scene_artifacts
        WHERE case_id=$1
          AND artifact_type='FAMILY_ALLIANCE_SELF_ASSESSMENT'
        ORDER BY revision DESC
        LIMIT 1`,
      [f.caseId]
    );
    const a3000ContentRef = a3000Artifact.rows[0]?.data.contentRef;
    expect(a3000ContentRef).toMatchObject({
      nodeCode: 'A3000',
      contentVersion: 'family-alliance-product-v1',
      authorityDocument: 'Docs/V1产品需求.md',
      authorityDocumentVersion: 'v3.9',
      sourceBlob: '8eb660cd905d8fba4b52fe0f74bbc214b3113117',
    });
    expect(
      resolveFamilyAllianceContent(
        a3000ContentRef.nodeCode,
        a3000ContentRef.contentVersion
      ).body.length
    ).toBeGreaterThan(0);

    scene = await respondNode(
      f,
      'A3002',
      {
        kind: 'TARGET_SELECTION',
        confirmed: true,
        selectedTargets: ['SLEEP'],
      },
      { expectedSelectionRevision: scene.targetSelectionRevision ?? 0 },
      productionBoundaryApp
    );
    let sleep = scene.targets.find((target: any) => target.targetCode === 'SLEEP');
    expect(sleep?.selected).toBe(true);

    scene = await respondNode(
      f,
      'A3010',
      {
        kind: 'TARGET_DEFINITION',
        concreteTargetText: 'Keep a consistent sleep schedule this week.',
      },
      {
        expectedSelectionRevision: sleep.selectionRevision,
        expectedTargetRevision: sleep.revision,
      },
      productionBoundaryApp
    );
    sleep = scene.targets.find((target: any) => target.targetCode === 'SLEEP');

    scene = await respondNode(
      f,
      'A3011',
      {
        kind: 'FEASIBILITY',
        feasibility: {
          problemBehavior: {
            concreteBehavior: { state: 'KNOWN', text: 'Bedtime is currently inconsistent.' },
            need: { state: 'KNOWN', text: 'Evening decompression.' },
            motivationBenefit: { state: 'KNOWN', text: 'More rest the next day.' },
            abilityConditions: { state: 'KNOWN', text: 'Family can prepare earlier.' },
            challengeResistance: { state: 'UNKNOWN' },
          },
          replacementBehavior: {
            concreteQuantified: {
              state: 'KNOWN',
              concreteTargetText: 'Keep a consistent sleep schedule this week.',
            },
            need: { state: 'KNOWN', rating: 8 },
            motivationBenefit: { state: 'KNOWN', rating: 8 },
            abilityPossibility: { state: 'KNOWN', rating: 7 },
            challengeResistance: { state: 'UNKNOWN' },
          },
        },
      },
      {
        expectedSelectionRevision: sleep.selectionRevision,
        expectedTargetRevision: sleep.revision,
      },
      productionBoundaryApp
    );
    sleep = scene.targets.find((target: any) => target.targetCode === 'SLEEP');
    expect(sleep.feasibility).not.toHaveProperty('score');
    expect(sleep.feasibility).not.toHaveProperty('cutoff');

    scene = await respondNode(
      f,
      'A3012',
      {
        kind: 'PROGRESS',
        progress: {
          kind: 'GENERAL_MATRIX',
          taskPlan: { state: 'KNOWN', text: 'Start the bedtime routine earlier.' },
          communication: {
            needMatch: { state: 'KNOWN', text: 'Need discussed.' },
            motivationMatch: { state: 'KNOWN', text: 'Benefit discussed.' },
            abilityMatch: { state: 'KNOWN', text: 'Ability discussed.' },
            challengeResistance: { state: 'KNOWN', text: 'One barrier discussed.' },
          },
          childFeedback: {
            needMatch: { state: 'NOT_COLLECTED' },
            motivationMatch: { state: 'NOT_COLLECTED' },
            abilityMatch: { state: 'NOT_COLLECTED' },
            challengeResistance: { state: 'NOT_COLLECTED' },
          },
          userObservation: {
            needMatch: { state: 'KNOWN', text: 'Routine started earlier.' },
            motivationMatch: { state: 'KNOWN', text: 'Less bedtime resistance.' },
            abilityMatch: { state: 'KNOWN', text: 'Schedule was feasible.' },
            challengeResistance: { state: 'KNOWN', text: 'Late homework remains a barrier.' },
          },
          otherFamilyFeedback: {
            needMatch: { state: 'NOT_COLLECTED' },
            motivationMatch: { state: 'NOT_COLLECTED' },
            abilityMatch: { state: 'NOT_COLLECTED' },
            challengeResistance: { state: 'NOT_COLLECTED' },
          },
          modifyTarget: 'NO',
        },
        note: 'Golden E2E sleep progress observation.',
      },
      {
        expectedSelectionRevision: sleep.selectionRevision,
        expectedTargetRevision: sleep.revision,
      },
      productionBoundaryApp
    );
    sleep = scene.targets.find((target: any) => target.targetCode === 'SLEEP');

    scene = await respondNode(
      f,
      'A3013',
      { kind: 'HELP', action: 'VIEWED' },
      {
        expectedSelectionRevision: sleep.selectionRevision,
        expectedTargetRevision: sleep.revision,
      },
      productionBoundaryApp
    );
    sleep = scene.targets.find((target: any) => target.targetCode === 'SLEEP');
    expect(sleep.helpHistoryRefs).toHaveLength(1);

    const sleepHelpReadback = await admin.query<{ help_history_refs: any[] }>(
      `SELECT help_history_refs
         FROM digital_use_target_items
        WHERE case_id=$1
          AND target_code='SLEEP'
          AND superseded_at IS NULL`,
      [f.caseId]
    );
    const sleepHelpContentRef = sleepHelpReadback.rows[0]?.help_history_refs[0]?.contentRef;
    expect(sleepHelpContentRef).toMatchObject({
      nodeCode: 'A3013',
      contentVersion: 'family-alliance-product-v1',
      sourceBlob: '8eb660cd905d8fba4b52fe0f74bbc214b3113117',
    });
    expect(
      resolveFamilyAllianceContent(
        sleepHelpContentRef.nodeCode,
        sleepHelpContentRef.contentVersion
      ).body.length
    ).toBeGreaterThan(0);

    expect(scene.nodes.find((node: any) => node.nodeCode === 'A4003')?.status)
      .toBe('IN_PROGRESS');
    expect(scene.nodes.some((node: any) => node.nodeCode === 'A4004')).toBe(false);

    const caseReadback = await admin.query(
      `SELECT phase::text AS phase,status::text AS status
         FROM cases WHERE id=$1`,
      [f.caseId]
    );
    expect(caseReadback.rows[0]).toEqual({ phase: 'GOALS', status: 'OPEN' });
  });

  it('recovers INSUFFICIENT Evidence in place without false completion', async () => {
    const f = await fixture('insufficient');
    await respondNode(f, 'A1001', a1001(false));

    let scene = await respondNode(f, '01002', { state: 'UNKNOWN' });
    const held = scene.nodes.find((node: any) => node.nodeCode === '01002');
    expect(held).toMatchObject({ status: 'IN_PROGRESS' });
    expect(held.branchReasonCodes).toContain('INTEGRATED_TRIAGE_INSUFFICIENT');
    expect(scene.nodes.some((node: any) => node.nodeCode === '01003')).toBe(false);

    scene = await respondNode(f, '01002', {
      state: 'KNOWN',
      selections: ['A'],
    });
    expect(scene.nodes.find((node: any) => node.nodeCode === '01002')?.status)
      .toBe('COMPLETED');
    expect(scene.nodes.find((node: any) => node.nodeCode === '01003')?.status)
      .toBe('AVAILABLE');

    const history = await admin.query(
      `SELECT id,supersedes_id
         FROM assertions
        WHERE case_id=$1
          AND content LIKE 'DUA:v1:01002.emotion:%'
        ORDER BY recorded_at,id`,
      [f.caseId]
    );
    expect(history.rows.length).toBeGreaterThanOrEqual(2);
    expect(history.rows.some((row) => row.supersedes_id !== null)).toBe(true);
  });

  it('recovers an A1001 direct-impact INSUFFICIENT through the authorized correction path', async () => {
    const f = await fixture('a1001-insufficient-recovery');
    const unknownSleepA1001 = {
      ...a1001(false),
      functionalImpact: {
        sleep: { state: 'UNKNOWN' },
        studyOrNecessaryAffairs: { state: 'KNOWN', impacted: false },
        realWorldActivityDisplacement: { state: 'KNOWN', impacted: false },
      },
    };

    await respondNode(f, 'A1001', unknownSleepA1001);
    await respondNode(f, '01002', { state: 'KNOWN', selections: ['A'] });
    let scene = await respondNode(f, '01003', { state: 'KNOWN', selection: 'A' });

    const held = scene.nodes.find((node: any) => node.nodeCode === '01003');
    expect(held).toMatchObject({ status: 'IN_PROGRESS' });
    expect(held.branchReasonCodes).toContain('INTEGRATED_TRIAGE_INSUFFICIENT');
    expect(scene.recovery).toEqual({
      reasonCode: 'DIRECT_IMPACT_MISSING_FAMILY',
      correctionTargetNodeCode: 'A1001',
      missingRequirements: [
        {
          nodeCode: 'A1001',
          evidenceCode: 'a1001.impact.sleep',
          evidenceFamily: 'SLEEP',
          missingState: 'UNKNOWN',
          reasonCode: 'DIRECT_IMPACT_MISSING_FAMILY',
        },
      ],
    });

    const beforeCorrection = await getScene(f);
    const a1001Node = beforeCorrection.nodes.find(
      (node: any) => node.nodeCode === 'A1001'
    );
    const stale = await app.inject({
      method: 'POST',
      url: `/api/v1/cases/${f.caseId}/scene/nodes/A1001/responses`,
      headers: commandHeaders(
        f.manager.token,
        `du-vertical-a1001-stale-${crypto.randomUUID()}`
      ),
      payload: {
        expectedCaseVersion: beforeCorrection.caseVersion,
        expectedNodeRevision: a1001Node.revision + 1,
        expectedScenePackageVersion: beforeCorrection.scenePackageVersion,
        response: a1001(false),
      },
    });
    expect(stale.statusCode, stale.body).toBe(409);
    expect(stale.json().code).toBe('STALE_NODE_REVISION');

    const corrected = await respondNode(f, 'A1001', a1001(false));
    expect(corrected.recovery).toBeNull();
    expect(
      corrected.nodes.find((node: any) => node.nodeCode === 'A1001')?.status
    ).toBe('COMPLETED');
    expect(
      corrected.nodes.find((node: any) => node.nodeCode === '01003')?.status
    ).toBe('COMPLETED');
    expect(
      corrected.nodes.find((node: any) => node.nodeCode === 'A2001')?.status
    ).toBe('AVAILABLE');

    const history = await admin.query(
      `SELECT id,supersedes_id
         FROM assertions
        WHERE case_id=$1
          AND content LIKE 'DUA:v1:a1001.impact.sleep:%'
        ORDER BY recorded_at,id`,
      [f.caseId]
    );
    expect(history.rows.length).toBeGreaterThanOrEqual(2);
    expect(history.rows.some((row) => row.supersedes_id !== null)).toBe(true);

    const events = await admin.query(
      `SELECT metadata
         FROM case_events
        WHERE case_id=$1
          AND event_type='CASE_DIGITAL_USE_NODE_COMPLETED'
          AND metadata->>'nodeCode'='A1001'`,
      [f.caseId]
    );
    expect(events.rows.length).toBeGreaterThanOrEqual(2);

    const afterNormal = await getScene(f);
    const afterNode = afterNormal.nodes.find(
      (node: any) => node.nodeCode === 'A1001'
    );
    const rejected = await app.inject({
      method: 'POST',
      url: `/api/v1/cases/${f.caseId}/scene/nodes/A1001/responses`,
      headers: commandHeaders(
        f.manager.token,
        `du-vertical-a1001-unauthorized-${crypto.randomUUID()}`
      ),
      payload: {
        expectedCaseVersion: afterNormal.caseVersion,
        expectedNodeRevision: afterNode.revision,
        expectedScenePackageVersion: afterNormal.scenePackageVersion,
        response: a1001(false),
      },
    });
    expect(rejected.statusCode, rejected.body).toBe(409);
    expect(rejected.json().code).toBe('SCENE_NODE_UNREACHABLE');
  });

  it('routes an A1001 correction that re-evaluates to A2003 through the canonical Problem Formulation handoff', async () => {
    const f = await fixture('a1001-a2003-handoff');
    const unknownSleepA1001 = {
      ...a1001(false),
      functionalImpact: {
        sleep: { state: 'UNKNOWN' },
        studyOrNecessaryAffairs: { state: 'KNOWN', impacted: false },
        realWorldActivityDisplacement: { state: 'KNOWN', impacted: false },
      },
    };

    await respondNode(f, 'A1001', unknownSleepA1001);
    await respondNode(f, '01002', { state: 'KNOWN', selections: ['A'] });
    let scene = await respondNode(f, '01003', { state: 'KNOWN', selection: 'A' });
    expect(scene.recovery).toMatchObject({
      reasonCode: 'DIRECT_IMPACT_MISSING_FAMILY',
      correctionTargetNodeCode: 'A1001',
    });

    const corrected = await respondNode(f, 'A1001', a1001(true));
    expect(corrected.recovery).toBeNull();
    expect(
      corrected.nodes.find((node: any) => node.nodeCode === 'A1001')?.status
    ).toBe('COMPLETED');
    expect(
      corrected.nodes.find((node: any) => node.nodeCode === '01003')?.status
    ).toBe('COMPLETED');
    expect(
      corrected.nodes.find((node: any) => node.nodeCode === 'A2003')?.status
    ).toBe('AVAILABLE');

    const casePhase = await admin.query<{ phase: string }>(
      'SELECT phase::text AS phase FROM cases WHERE id=$1',
      [f.caseId]
    );
    expect(casePhase.rows[0]?.phase).toBe('PROBLEM_FORMULATION');

    const currentFormulation = await app.inject({
      method: 'GET',
      url: `/api/v1/cases/${f.caseId}/problem-formulations/current`,
      headers: auth(f.manager.token),
    });
    expect(currentFormulation.statusCode, currentFormulation.body).toBe(200);
    expect(currentFormulation.json().current?.status).toBe('PRESENTED');

    const a2003 = await respondNode(f, 'A2003', a2003Response());
    expect(
      a2003.nodes.find((node: any) => node.nodeCode === 'A2003')?.status
    ).toBe('COMPLETED');
  });

  it('recovers a real Evidence conflict and rewinds only route-dependent Scene projections', async () => {
    const f = await fixture('conflict-recovery');
    const member = await createMember(
      app,
      f.manager.token,
      f.familyId,
      'du-vertical-conflict-member',
      {
        ageBand: 'MINOR_14_17',
        ageBandSource: 'GUARDIAN_RELAY',
      }
    );
    expect(member.statusCode, member.body).toBe(201);
    const childPersonId = member.json().personId as string;

    await respondNode(f, 'A1001', a1001(true));
    await respondNode(f, '01002', {
      state: 'KNOWN',
      selections: ['A'],
    });

    const relayF = await withRlsTransaction(
      appPool,
      {
        familyId: f.familyId,
        accountId: f.manager.accountId,
        personId: f.manager.personId,
        purpose: 'FAMILY_MANAGEMENT',
      },
      (tx) => recordStatement(
        tx,
        {
          familyId: f.familyId,
          caseId: f.caseId,
          actorAccountId: f.manager.accountId,
          actorPersonId: f.manager.personId,
          purpose: 'FAMILY_MANAGEMENT',
        },
        {
          subjectPersonId: childPersonId,
          sourceKind: 'OTHER_MEMBER_RELAY',
          sourcePersonId: f.manager.personId,
          occurredTimeState: 'UNKNOWN',
          confirmationStatus: 'UNCONFIRMED',
          content:
            'DUA:v1:01002.emotion:' +
            JSON.stringify({ state: 'KNOWN', selections: ['F'] }),
        }
      )
    );

    let scene = await respondNode(f, '01002', {
      state: 'KNOWN',
      selections: ['A'],
    });
    expect(scene.nodes.find((node: any) => node.nodeCode === '01002')?.status)
      .toBe('BLOCKED');
    expect(scene.nodes.find((node: any) => node.nodeCode === '01003')?.status)
      .toBe('SKIPPED');

    const relayA = await withRlsTransaction(
      appPool,
      {
        familyId: f.familyId,
        accountId: f.manager.accountId,
        personId: f.manager.personId,
        purpose: 'FAMILY_MANAGEMENT',
      },
      (tx) => recordStatement(
        tx,
        {
          familyId: f.familyId,
          caseId: f.caseId,
          actorAccountId: f.manager.accountId,
          actorPersonId: f.manager.personId,
          purpose: 'FAMILY_MANAGEMENT',
        },
        {
          subjectPersonId: childPersonId,
          sourceKind: 'OTHER_MEMBER_RELAY',
          sourcePersonId: f.manager.personId,
          occurredTimeState: 'UNKNOWN',
          confirmationStatus: 'UNCONFIRMED',
          supersedesId: relayF.id,
          content:
            'DUA:v1:01002.emotion:' +
            JSON.stringify({ state: 'KNOWN', selections: ['A'] }),
        }
      )
    );

    scene = await respondNode(f, '01002', {
      state: 'KNOWN',
      selections: ['A'],
    });
    expect(scene.nodes.find((node: any) => node.nodeCode === '01002')?.status)
      .toBe('COMPLETED');
    expect(scene.nodes.find((node: any) => node.nodeCode === '01003')?.status)
      .toBe('AVAILABLE');

    scene = await respondNode(f, '01003', {
      state: 'KNOWN',
      selection: 'A',
    });
    expect(scene.nodes.find((node: any) => node.nodeCode === 'A2003')?.status)
      .toBe('AVAILABLE');

    // Confirm through the real Common Core lifecycle. Subsequent Evidence
    // supersession must still be able to re-enter triage from GOALS and mark
    // this confirmed formulation for review rather than freezing the old route.
    scene = await confirmCurrentFormulation(f);
    expect(scene.nodes.find((node: any) => node.nodeCode === 'A2003')?.status)
      .toBe('AVAILABLE');

    await withRlsTransaction(
      appPool,
      {
        familyId: f.familyId,
        accountId: f.manager.accountId,
        personId: f.manager.personId,
        purpose: 'FAMILY_MANAGEMENT',
      },
      (tx) => recordStatement(
        tx,
        {
          familyId: f.familyId,
          caseId: f.caseId,
          actorAccountId: f.manager.accountId,
          actorPersonId: f.manager.personId,
          purpose: 'FAMILY_MANAGEMENT',
        },
        {
          subjectPersonId: childPersonId,
          sourceKind: 'OTHER_MEMBER_RELAY',
          sourcePersonId: f.manager.personId,
          occurredTimeState: 'UNKNOWN',
          confirmationStatus: 'UNCONFIRMED',
          supersedesId: relayA.id,
          content:
            'DUA:v1:01002.emotion:' +
            JSON.stringify({ state: 'KNOWN', selections: ['F'] }),
        }
      )
    );

    scene = await respondNode(f, '01002', {
      state: 'KNOWN',
      selections: ['F'],
    });
    expect(scene.nodes.find((node: any) => node.nodeCode === '01005')?.status)
      .toBe('AVAILABLE');
    expect(scene.nodes.find((node: any) => node.nodeCode === '01003')?.status)
      .toBe('SKIPPED');
    expect(scene.nodes.find((node: any) => node.nodeCode === 'A2003')?.status)
      .toBe('SKIPPED');

    const evidenceHistory = await admin.query(
      `SELECT id,supersedes_id
         FROM assertions
        WHERE case_id=$1
          AND content LIKE 'DUA:v1:01002.emotion:%'
        ORDER BY recorded_at,id`,
      [f.caseId]
    );
    expect(evidenceHistory.rows.length).toBeGreaterThanOrEqual(6);
    expect(evidenceHistory.rows.filter((row) => row.supersedes_id !== null).length)
      .toBeGreaterThanOrEqual(3);

    const lineage = await admin.query(
      `SELECT
         (SELECT count(*)::int
            FROM case_events
           WHERE case_id=$1
             AND event_type='CASE_DIGITAL_USE_NODE_COMPLETED'
             AND metadata->>'nodeCode'='01002') AS events,
         (SELECT count(*)::int
            FROM business_audit_events
           WHERE resource_id::text=$1::text
             AND event_type='DIGITAL_USE_NODE_COMPLETED'
             AND metadata->>'nodeCode'='01002') AS audits`,
      [f.caseId]
    );
    expect(lineage.rows[0].events).toBeGreaterThanOrEqual(4);
    expect(lineage.rows[0].audits).toBeGreaterThanOrEqual(4);

    const formulation = await admin.query(
      `SELECT status::text AS status,review_state::text AS review_state
         FROM problem_formulations
        WHERE case_id=$1
        ORDER BY version DESC
        LIMIT 1`,
      [f.caseId]
    );
    expect(formulation.rows[0]).toMatchObject({
      status: 'CONFIRMED',
      review_state: 'NEEDS_REVIEW',
    });
  });

  it('runs GOALS continuity, parallel lanes, A4003 HOLD independence and retry recovery end to end', async () => {
    adapterAvailable = false;
    const f = await fixture('parallel-roleplay-recovery');
    let scene = await advanceToParallelLanes(f);

    // Phone Contract progresses while Family Alliance entry is still untouched.
    scene = await respondNode(f, 'A4001', {
      contentVersion: 'phone-use-contract-v1',
      answers: [true, false, false, false, false],
    });
    expect(scene.nodes.find((node: any) => node.nodeCode === 'A3000')?.status)
      .toBe('AVAILABLE');
    expect(scene.nodes.find((node: any) => node.nodeCode === 'A4002')?.status)
      .toBe('AVAILABLE');

    scene = await respondNode(f, 'A4002', {
      contentVersion: 'phone-use-contract-v1',
      action: 'ACKNOWLEDGE_TEMPLATE',
    });
    expect(scene.nodes.find((node: any) => node.nodeCode === 'A4003')?.status)
      .toBe('AVAILABLE');

    const beforeHold = await getScene(f);
    const holdKey = `du-vertical-roleplay-hold-${crypto.randomUUID()}`;
    const holdRequest = () => app.inject({
      method: 'POST',
      url: `/api/v1/cases/${f.caseId}/digital-use/roleplays`,
      headers: {
        ...auth(f.manager.token),
        'idempotency-key': holdKey,
      },
      payload: {
        expectedCaseVersion: beforeHold.caseVersion,
        professionalContentVersion: 'test-professional-roleplay-v1',
      },
    });
    const hold = await holdRequest();
    expect(hold.statusCode, hold.body).toBe(200);
    expect(hold.json()).toMatchObject({
      kind: 'HOLD',
      nodeCode: 'A4003',
      status: 'IN_PROGRESS',
      reasonCode: 'DOWNSTREAM_AI_UNAVAILABLE',
    });
    const holdReplay = await holdRequest();
    expect(holdReplay.statusCode, holdReplay.body).toBe(200);
    expect(holdReplay.json()).toEqual(hold.json());

    scene = await getScene(f);
    expect(scene.nodes.find((node: any) => node.nodeCode === 'A4003')?.status)
      .toBe('IN_PROGRESS');
    expect(scene.nodes.some((node: any) => node.nodeCode === 'A4004')).toBe(false);
    expect(scene.nodes.find((node: any) => node.nodeCode === 'A3000')?.status)
      .toBe('AVAILABLE');

    const fakeBefore = await admin.query(
      `SELECT
         (SELECT count(*)::int FROM roleplay_sessions WHERE case_id=$1) AS sessions,
         (SELECT count(*)::int FROM scene_artifacts
           WHERE case_id=$1
             AND artifact_type='PHONE_USE_ROLEPLAY_SELECTION') AS selections`,
      [f.caseId]
    );
    expect(fakeBefore.rows[0]).toEqual({ sessions: 0, selections: 0 });

    // The Family Alliance lane stays legal while A4003 is held.
    scene = await respondNode(f, 'A3000', familySelfAssessment());
    expect(scene.nodes.find((node: any) => node.nodeCode === 'A4003')?.status)
      .toBe('IN_PROGRESS');
    expect(scene.nodes.find((node: any) => node.nodeCode === 'A3001')?.status)
      .toBe('AVAILABLE');
    expect(scene.nodes.find((node: any) => node.nodeCode === 'A3002')?.status)
      .toBe('AVAILABLE');

    adapterAvailable = true;
    const beforeRetry = await getScene(f);
    const retry = await app.inject({
      method: 'POST',
      url: `/api/v1/cases/${f.caseId}/digital-use/roleplays`,
      headers: commandHeaders(f.manager.token, 'du-vertical-roleplay-retry'),
      payload: {
        expectedCaseVersion: beforeRetry.caseVersion,
        professionalContentVersion: 'test-professional-roleplay-v1',
      },
    });
    expect(retry.statusCode, retry.body).toBe(201);
    const session = retry.json();

    const turn = await app.inject({
      method: 'POST',
      url:
        `/api/v1/cases/${f.caseId}/digital-use/roleplays/` +
        `${session.id}/turns`,
      headers: commandHeaders(f.manager.token, 'du-vertical-roleplay-turn'),
      payload: {
        expectedCaseVersion: beforeRetry.caseVersion,
        expectedSessionRevision: session.revision,
        simulatedChildInput: 'I want more phone time tonight.',
      },
    });
    expect(turn.statusCode, turn.body).toBe(201);
    expect(turn.json()).toMatchObject({
      provenance: 'SIMULATION',
      modelRef: 'test-model:vertical-v1',
      promptVersionRef: 'test-prompt:vertical-v1',
    });

    const beforeSelect = await getScene(f);
    const a4003 = beforeSelect.nodes.find(
      (node: any) => node.nodeCode === 'A4003'
    );
    const selected = await app.inject({
      method: 'POST',
      url:
        `/api/v1/cases/${f.caseId}/digital-use/roleplays/` +
        `${session.id}/select`,
      headers: commandHeaders(f.manager.token, 'du-vertical-roleplay-select'),
      payload: {
        expectedCaseVersion: beforeSelect.caseVersion,
        expectedSessionRevision: session.revision,
        turnId: turn.json().id,
        expectedNodeRevision: a4003.revision,
      },
    });
    expect(selected.statusCode, selected.body).toBe(200);
    expect(selected.json().selectedTurn.provenance).toBe('SIMULATION');

    scene = await getScene(f);
    expect(scene.nodes.find((node: any) => node.nodeCode === 'A4003')?.status)
      .toBe('COMPLETED');
    expect(scene.nodes.find((node: any) => node.nodeCode === 'A4004')?.status)
      .toBe('AVAILABLE');
    expect(scene.nodes.find((node: any) => node.nodeCode === 'A3001')?.status)
      .toBe('AVAILABLE');
  });

  it('T1 canonical deterministic E2E reaches PLANNING only through formal ConfirmGoal', async () => {
    const f = await fixture('phase2-t1-final-closeout');
    const scene = await advanceToGoalReady(f);
    const formulation = await currentConfirmedGoalFormulation(f);

    const afterA2010 = await app.inject({
      method: 'GET',
      url: `/api/v1/cases/${f.caseId}`,
      headers: auth(f.manager.token),
    });
    expect(afterA2010.statusCode, afterA2010.body).toBe(200);
    expect(afterA2010.json().phase).toBe('GOALS');

    const saved = await savePhase2T1Goal(
      f,
      scene.caseVersion,
      formulation
    );
    expect(saved.statusCode, saved.body).toBe(201);
    expect(saved.json()).toMatchObject({
      operation: 'SAVE',
      phase: 'GOALS',
      confirmationState: 'UNCONFIRMED',
    });
    const saveBody = saved.json();
    expect(saveBody.goalId).toEqual(expect.any(String));
    expect(saveBody.goalVersion).toEqual(expect.any(Number));

    const savedGoal = await admin.query<{
      goal_id: string;
      version: number;
      confirmation_state: string;
      saved_by_person_id: string;
      confirmed_by_person_id: string | null;
      confirmed_at: Date | null;
    }>(
      `SELECT goal_id,version,confirmation_state::text AS confirmation_state,
              saved_by_person_id,confirmed_by_person_id,confirmed_at
         FROM goals
        WHERE case_id=$1 AND goal_id=$2 AND version=$3`,
      [f.caseId, saveBody.goalId, saveBody.goalVersion]
    );
    expect(savedGoal.rows).toHaveLength(1);
    expect(savedGoal.rows[0]).toMatchObject({
      goal_id: saveBody.goalId,
      version: saveBody.goalVersion,
      confirmation_state: 'UNCONFIRMED',
      saved_by_person_id: f.manager.personId,
      confirmed_by_person_id: null,
      confirmed_at: null,
    });

    const afterSave = await app.inject({
      method: 'GET',
      url: `/api/v1/cases/${f.caseId}`,
      headers: auth(f.manager.token),
    });
    expect(afterSave.statusCode, afterSave.body).toBe(200);
    expect(afterSave.json().phase).toBe('GOALS');

    const confirmed = await confirmPhase2T1Goal(
      f,
      saveBody.caseVersion,
      saveBody.goalId,
      saveBody.goalVersion
    );
    expect(confirmed.statusCode, confirmed.body).toBe(200);
    expect(confirmed.json()).toMatchObject({
      operation: 'CONFIRM',
      goalId: saveBody.goalId,
      goalVersion: saveBody.goalVersion,
      phase: 'PLANNING',
      confirmationState: 'CONFIRMED',
      confirmedBy: f.manager.personId,
    });

    const confirmedGoal = await admin.query<{
      confirmation_state: string;
      confirmed_by_person_id: string | null;
      confirmed_at: Date | null;
    }>(
      `SELECT confirmation_state::text AS confirmation_state,
              confirmed_by_person_id,confirmed_at
         FROM goals
        WHERE case_id=$1 AND goal_id=$2 AND version=$3`,
      [f.caseId, saveBody.goalId, saveBody.goalVersion]
    );
    expect(confirmedGoal.rows).toHaveLength(1);
    expect(confirmedGoal.rows[0]?.confirmation_state).toBe('CONFIRMED');
    expect(confirmedGoal.rows[0]?.confirmed_by_person_id).toBe(
      f.manager.personId
    );
    expect(confirmedGoal.rows[0]?.confirmed_at).toBeTruthy();

    const traces = await admin.query<{
      events: number;
      audits: number;
    }>(
      `SELECT
         (SELECT count(*)::int FROM case_events
           WHERE case_id=$1 AND event_type='CASE_GOAL_CONFIRMED') AS events,
         (SELECT count(*)::int FROM business_audit_events
           WHERE family_id=$2
             AND resource_type='GOAL'
             AND resource_id=$3
             AND event_type='GOAL_CONFIRMED') AS audits`,
      [f.caseId, f.familyId, saveBody.goalId]
    );
    expect(traces.rows[0]).toEqual({ events: 1, audits: 1 });

    const afterConfirm = await app.inject({
      method: 'GET',
      url: `/api/v1/cases/${f.caseId}`,
      headers: auth(f.manager.token),
    });
    expect(afterConfirm.statusCode, afterConfirm.body).toBe(200);
    expect(afterConfirm.json().phase).toBe('PLANNING');
  });

  it('preserves the canonical Family Alliance path through A5001 without admin SQL business-state fabrication', async () => {
    professionalReviewProvider.restore('FAMILY_ALLIANCE_REVIEW');
    const f = await fixture('phase3-a5001-canonical');
    await advanceToParallelLanes(f);
    const scene = await completeCanonicalSleepRuntime(f);
    const review = await submitCanonicalA5001(f, scene);
    expect(review.statusCode, review.body).toBe(200);
    expect(review.json().nodes.find((node: any) => node.nodeCode === 'A5001'))
      .toMatchObject({ status: 'COMPLETED' });
    const artifact = review.json().artifacts.find(
      (item: any) => item.type === 'DIGITAL_USE_A5001_EFFECT_EVALUATION'
    );
    expect(artifact?.data).toMatchObject({
      stream: 'FAMILY_ALLIANCE_REVIEW',
      completion: 'REVIEW_COMPLETE',
      professionalPackage: TEST_A5001_PACKAGE,
    });
    const casePhase = await admin.query<{ phase: string }>(
      'SELECT phase FROM cases WHERE id=$1',
      [f.caseId]
    );
    expect(casePhase.rows[0]?.phase).toBe('GOALS');
  });

  it('preserves the canonical roleplay and formal Contract path through A5002 without admin SQL business-state fabrication', async () => {
    professionalReviewProvider.restore('PHONE_USE_CONTRACT_REVIEW');
    adapterAvailable = true;
    const f = await fixture('phase3-a5002-canonical');
    let scene = await advanceToParallelLanes(f);

    scene = await respondNode(f, 'A4001', {
      contentVersion: 'phone-use-contract-v1',
      answers: [true, false, false, false, false],
    });
    scene = await respondNode(f, 'A4002', {
      contentVersion: 'phone-use-contract-v1',
      action: 'ACKNOWLEDGE_TEMPLATE',
    });

    const beforeRoleplay = await getScene(f);
    const created = await app.inject({
      method: 'POST',
      url: `/api/v1/cases/${f.caseId}/digital-use/roleplays`,
      headers: commandHeaders(
        f.manager.token,
        `phase3-roleplay-create-${crypto.randomUUID()}`
      ),
      payload: {
        expectedCaseVersion: beforeRoleplay.caseVersion,
        professionalContentVersion: 'test-professional-roleplay-v1',
      },
    });
    expect(created.statusCode, created.body).toBe(201);

    const turn = await app.inject({
      method: 'POST',
      url: `/api/v1/cases/${f.caseId}/digital-use/roleplays/${created.json().id}/turns`,
      headers: commandHeaders(
        f.manager.token,
        `phase3-roleplay-turn-${crypto.randomUUID()}`
      ),
      payload: {
        expectedCaseVersion: beforeRoleplay.caseVersion,
        expectedSessionRevision: created.json().revision,
        simulatedChildInput: 'I want to keep using my phone later tonight.',
      },
    });
    expect(turn.statusCode, turn.body).toBe(201);
    expect(turn.json().provenance).toBe('SIMULATION');

    const beforeSelect = await getScene(f);
    const a4003 = beforeSelect.nodes.find(
      (node: any) => node.nodeCode === 'A4003'
    );
    const selected = await app.inject({
      method: 'POST',
      url: `/api/v1/cases/${f.caseId}/digital-use/roleplays/${created.json().id}/select`,
      headers: commandHeaders(
        f.manager.token,
        `phase3-roleplay-select-${crypto.randomUUID()}`
      ),
      payload: {
        expectedCaseVersion: beforeSelect.caseVersion,
        expectedSessionRevision: created.json().revision,
        turnId: turn.json().id,
        expectedNodeRevision: a4003.revision,
      },
    });
    expect(selected.statusCode, selected.body).toBe(200);
    expect(selected.json().selectedTurn.provenance).toBe('SIMULATION');

    scene = await respondNode(f, 'A4004', { tool: 'DURATION' });
    expect(scene.nodes.find((node: any) => node.nodeCode === 'A4005')?.status)
      .toBe('AVAILABLE');

    const participant = await bindAndAcceptCanonicalParticipant(
      f,
      'a5002-contract-party'
    );
    const beforeDraft = await getScene(f);
    const term = (value: string) => ({ state: 'VALUE' as const, value });
    const terms = {
      purpose: term('Reduce conflict while preserving agreed access.'),
      phoneUseRules: term('No phone after the agreed bedtime.'),
      executionPeriod: term('Two weeks.'),
      parentSupportMeasures: term('Parent gives one calm reminder.'),
      supervisionMeasures: term('Check the shared charging location.'),
      incentives: term('Extra family activity after consistent execution.'),
      breachResponsibilities: term('Discuss breach and reset the next day.'),
    };
    const draft = await app.inject({
      method: 'POST',
      url: `/api/v1/cases/${f.caseId}/digital-use/contract/drafts`,
      headers: commandHeaders(
        f.manager.token,
        `phase3-contract-draft-${crypto.randomUUID()}`
      ),
      payload: {
        expectedCaseVersion: beforeDraft.caseVersion,
        adultPartyPersonId: f.manager.personId,
        childPartyPersonId: participant.personId,
        childParticipationId: participant.participationId,
        sourceTemplateVersion: 'phone-use-contract-v1',
        dependencyRefs: [],
        terms,
      },
    });
    expect(draft.statusCode, draft.body).toBe(201);
    expect(draft.json()).toMatchObject({
      version: 1,
      draftRevision: 1,
      status: 'DRAFT',
    });

    const beforeAdultConfirm = await getScene(f);
    const adultConfirm = await app.inject({
      method: 'POST',
      url: `/api/v1/cases/${f.caseId}/digital-use/contract/1/confirm`,
      headers: commandHeaders(
        f.manager.token,
        `phase3-contract-adult-confirm-${crypto.randomUUID()}`
      ),
      payload: {
        expectedCaseVersion: beforeAdultConfirm.caseVersion,
        expectedDraftRevision: 1,
      },
    });
    expect(adultConfirm.statusCode, adultConfirm.body).toBe(200);
    expect(adultConfirm.json().status).toBe('PENDING_CONFIRMATION');

    const beforeChildConfirm = await getScene(f);
    const childConfirm = await app.inject({
      method: 'POST',
      url: `/api/v1/cases/${f.caseId}/digital-use/contract/1/confirm`,
      headers: commandHeaders(
        participant.token,
        `phase3-contract-child-confirm-${crypto.randomUUID()}`
      ),
      payload: {
        expectedCaseVersion: beforeChildConfirm.caseVersion,
        expectedDraftRevision: 1,
      },
    });
    expect(childConfirm.statusCode, childConfirm.body).toBe(200);
    expect(childConfirm.json()).toMatchObject({
      version: 1,
      draftRevision: 1,
      status: 'ACTIVE',
      childParticipationId: participant.participationId,
    });

    scene = await getScene(f);
    expect(scene.nodes.find((node: any) => node.nodeCode === 'A4011')?.status)
      .toBe('AVAILABLE');
    const a5002 = scene.nodes.find((node: any) => node.nodeCode === 'A5002');
    const review = await app.inject({
      method: 'POST',
      url: `/api/v1/cases/${f.caseId}/scene/nodes/A5002/responses`,
      headers: commandHeaders(
        f.manager.token,
        `phase3-a5002-${crypto.randomUUID()}`
      ),
      payload: {
        expectedCaseVersion: scene.caseVersion,
        expectedNodeRevision: a5002?.revision ?? 0,
        expectedScenePackageVersion: 'v1',
        response: {
          kind: 'PHONE_USE_CONTRACT_REVIEW',
          subject: {
            contractId: childConfirm.json().id,
            contractVersion: childConfirm.json().version,
            contractRevision: childConfirm.json().draftRevision,
            contractStatus: childConfirm.json().status,
          },
          professionalPackage: TEST_A5002_PACKAGE,
          packageResponse: normalizedReviewResponse,
          evidenceRefs: [],
          provenance: [{
            kind: 'PARENT_AUTHORED_OBSERVATION',
            sourcePersonId: f.manager.personId,
          }],
        },
      },
    });
    expect(review.statusCode, review.body).toBe(200);
    expect(review.json().nodes.find((node: any) => node.nodeCode === 'A5002'))
      .toMatchObject({ status: 'COMPLETED' });
    const artifact = review.json().artifacts.find(
      (item: any) => item.type === 'DIGITAL_USE_A5002_EFFECT_EVALUATION'
    );
    expect(artifact?.data).toMatchObject({
      stream: 'PHONE_USE_CONTRACT_REVIEW',
      completion: 'REVIEW_COMPLETE',
      professionalPackage: TEST_A5002_PACKAGE,
      subject: {
        contractId: childConfirm.json().id,
        contractVersion: 1,
        contractRevision: 1,
        contractStatus: 'ACTIVE',
      },
    });
    const casePhase = await admin.query<{ phase: string }>(
      'SELECT phase FROM cases WHERE id=$1',
      [f.caseId]
    );
    expect(casePhase.rows[0]?.phase).toBe('GOALS');
  });

  it('exposes every formal Phone Contract / Roleplay runtime route in canonical OpenAPI and keeps malformed requests at 422', async () => {
    const generated = JSON.parse(
      readFileSync('packages/generated/openapi.json', 'utf-8')
    ) as {
      paths: Record<string, Record<string, any>>;
      components: { schemas: Record<string, any> };
    };

    const phoneOperations = Object.entries(generated.paths).filter(
      ([path]) =>
        path.includes('/digital-use/contract/') ||
        path.includes('/digital-use/roleplays')
    );
    expect(phoneOperations).toHaveLength(12);

    for (const [path, methods] of phoneOperations) {
      const runtimeUrl = path
        .replace('{id}', ':id')
        .replace('{version}', ':version')
        .replace('{sessionId}', ':sessionId');
      for (const method of Object.keys(methods)) {
        expect(
          app.hasRoute({
            method: method.toUpperCase() as any,
            url: runtimeUrl,
          }),
          `${method} ${runtimeUrl}`
        ).toBe(true);
      }
      for (const method of Object.keys(methods)) {
        const operation = methods[method];
        expect(operation.security).toEqual([{ bearerAuth: [] }]);
        const bodyRef =
          operation.requestBody?.content?.['application/json']?.schema?.$ref;
        if (bodyRef !== undefined) {
          const schemaName = bodyRef.replace('#/components/schemas/', '');
          expect(
            generated.components.schemas[schemaName],
            `${operation.operationId} request schema`
          ).toBeTruthy();
        }
        expect(Object.keys(operation.responses).sort()).toEqual(
          expect.arrayContaining(['401', '403', '404', '409', '422', '500'])
        );
      }
    }

    const f = await fixture('phone-contract-openapi');
    const malformedDraft = await app.inject({
      method: 'POST',
      url: `/api/v1/cases/${f.caseId}/digital-use/contract/drafts`,
      headers: commandHeaders(
        f.manager.token,
        `phone-openapi-draft-${crypto.randomUUID()}`
      ),
      payload: {},
    });
    expect(malformedDraft.statusCode, malformedDraft.body).toBe(422);
    expect(malformedDraft.json().code).toBe('VALIDATION_ERROR');

    const malformedVersion = await app.inject({
      method: 'PATCH',
      url: `/api/v1/cases/${f.caseId}/digital-use/contract/drafts/not-a-number`,
      headers: commandHeaders(
        f.manager.token,
        `phone-openapi-version-${crypto.randomUUID()}`
      ),
      payload: {},
    });
    expect(malformedVersion.statusCode, malformedVersion.body).toBe(422);
    expect(malformedVersion.json().code).toBe('VALIDATION_ERROR');

    const malformedTurn = await app.inject({
      method: 'POST',
      url:
        `/api/v1/cases/${f.caseId}/digital-use/roleplays/` +
        '00000000-0000-7000-8000-000000000001/turns',
      headers: commandHeaders(
        f.manager.token,
        `phone-openapi-turn-${crypto.randomUUID()}`
      ),
      payload: {},
    });
    expect(malformedTurn.statusCode, malformedTurn.body).toBe(422);
    expect(malformedTurn.json().code).toBe('VALIDATION_ERROR');

    const unknownCase = await app.inject({
      method: 'GET',
      url:
        '/api/v1/cases/00000000-0000-7000-8000-000000000099/' +
        'digital-use/contract/template',
      headers: auth(f.manager.token),
    });
    expect(unknownCase.statusCode, unknownCase.body).toBe(404);
    expect(unknownCase.json().code).toBe('CASE_NOT_FOUND');
  });

});
