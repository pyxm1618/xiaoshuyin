import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import pg from 'pg';
import { buildApp } from '../../apps/server/api/src/app.js';
import { createAdminPool } from '../setup/db.js';
import {
  auth,
  commandHeaders,
  createFamily,
  createMember,
  loginWithLabel,
  revokeConsent,
  type LoginResult,
} from '../setup/api.js';
import { createCase } from '../setup/participation.js';
import { getCurrentNoticeHash } from '@xiaoshuyin/compliance';
import {
  runSafetyPrecheck,
  type ApprovedPolicyIdentity,
} from '@xiaoshuyin/domain';
import { enterSafetyHold } from '../../apps/server/api/src/safety/enter-safety-hold.js';

interface Fixture {
  manager: LoginResult;
  familyId: string;
  caseId: string;
  targetPersonId: string;
  scene: any;
}

const MODEL_ENV_PATTERN = /(OPENAI|ANTHROPIC|LLM|RAG|EMBEDDING|MODEL_PROVIDER)/i;

function a1001(impact: boolean) {
  return {
    devices: ['PHONE'],
    purposeDurations: {
      learningResearchHomework: { state: 'KNOWN', minutesPerDay: 30, certainty: 'ESTIMATE' },
      necessaryContact: { state: 'KNOWN', minutesPerDay: 15, certainty: 'EXACT' },
      entertainmentGamingVideoSocialNonLearning: { state: 'KNOWN', minutesPerDay: 90, certainty: 'ESTIMATE' },
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
    expectedDuration: { state: 'KNOWN', minutesPerDay: 90, certainty: 'ESTIMATE' },
    reason: { state: 'KNOWN', text: 'Reduce disruption around daily routines.' },
    priorMethods: { state: 'UNKNOWN' },
    observedEffect: { state: 'UNKNOWN' },
    difficulties: { state: 'KNOWN', text: 'Transitions are difficult.' },
  };
}

describe('Slice 12 canonical no-model production orchestration', () => {
  let app: FastifyInstance;
  let admin: pg.Pool;
  let appPool: pg.Pool;
  let migrator: pg.Client;
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  let networkRouteTruthCalls = 0;
  const visitedNodes = new Set<string>();

  function track(scene: any) {
    for (const node of scene.nodes ?? []) visitedNodes.add(node.nodeCode);
    return scene;
  }

  function expectCurrent(scene: any, nodeCode: string) {
    expect(scene.currentNode?.nodeCode).toBe(nodeCode);
  }

  beforeAll(async () => {
    const noModelEnv = { ...process.env };
    for (const key of Object.keys(noModelEnv)) {
      if (MODEL_ENV_PATTERN.test(key)) delete noModelEnv[key];
    }
    expect(Object.keys(noModelEnv).some((key) => MODEL_ENV_PATTERN.test(key))).toBe(false);

    fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      networkRouteTruthCalls += 1;
      throw new Error('SLICE12_CANONICAL_FIXTURE_NETWORK_ROUTE_TRUTH_FORBIDDEN');
    });

    app = await buildApp({ env: noModelEnv });
    await app.ready();
    admin = createAdminPool();
    appPool = new pg.Pool({ connectionString: process.env['DATABASE_URL'] });
    migrator = new pg.Client({ connectionString: process.env['MIGRATION_DATABASE_URL'] });
    await migrator.connect();

    await migrator.query(
      `SELECT app.publish_compliance_feature_policy(
         'DIGITAL_USE_ASSESSMENT_RUNTIME','v1',NULL,1,
         'NOT_APPLICABLE','BASELINE','BASELINE','BASELINE','BASELINE',
         'Slice 12 canonical no-model reviewed basis','evidence://slice12/canonical-no-model',
         now() - interval '1 minute','migration:slice12-canonical-no-model'
       )`
    );
  });

  afterAll(async () => {
    await admin.query(
      `UPDATE compliance_feature_policies
          SET superseded_by_policy_id = NULL
        WHERE feature_code='DIGITAL_USE_ASSESSMENT_RUNTIME'
          AND feature_contract_revision='v1'`
    ).catch(() => undefined);
    await admin.query(
      `DELETE FROM compliance_feature_policies
        WHERE feature_code='DIGITAL_USE_ASSESSMENT_RUNTIME'
          AND feature_contract_revision='v1'`
    ).catch(() => undefined);
    await migrator.end().catch(() => undefined);
    await appPool.end().catch(() => undefined);
    await admin.end();
    await app.close();
    fetchSpy.mockRestore();
  });

  async function fixture(label: string): Promise<Fixture> {
    const manager = await loginWithLabel(app, `du-canonical-${label}`);
    const family = await createFamily(app, manager.token, `du-canonical-${label}`);
    expect(family.statusCode, family.body).toBe(201);
    const familyId = family.json().id as string;

    const child = await createMember(app, manager.token, familyId, `du-canonical-target-${label}`, {
      ageBand: 'MINOR_14_17',
      ageBandSource: 'OTHER_MEMBER_RELAY',
    });
    expect(child.statusCode, child.body).toBe(201);
    const targetPersonId = child.json().personId as string;
    const kase = await createCase(app, manager.token, `du-canonical-${label}`);
    expect(kase.statusCode, kase.body).toBe(201);
    const caseId = kase.json().id as string;
    const initialVersion = kase.json().version as number;

    const message = await app.inject({
      method: 'POST',
      url: `/api/v1/cases/${caseId}/messages`,
      headers: commandHeaders(manager.token, `du-canonical-message-${label}`),
      payload: { content: 'I am concerned about the current digital-use problem.' },
    });
    expect(message.statusCode, message.body).toBe(201);

    const start = await app.inject({
      method: 'POST',
      url: `/api/v1/cases/${caseId}/assessments`,
      headers: commandHeaders(manager.token, `du-canonical-start-${label}`),
      payload: { expectedCaseVersion: initialVersion, targetPersonId },
    });
    expect(start.statusCode, start.body).toBe(200);
    const scene = track(start.json());
    expectCurrent(scene, 'A1001');
    return { manager, familyId, caseId, targetPersonId, scene };
  }

  async function respond(
    f: Fixture,
    scene: any,
    nodeCode: string,
    response: Record<string, unknown>,
    label: string
  ) {
    expectCurrent(scene, nodeCode);
    const result = await app.inject({
      method: 'POST',
      url: `/api/v1/cases/${f.caseId}/scene/nodes/${nodeCode}/responses`,
      headers: {
        ...auth(f.manager.token),
        'idempotency-key': `du-canonical-${label}-${crypto.randomUUID()}`,
      },
      payload: {
        targetPersonId: f.targetPersonId,
        expectedCaseVersion: scene.caseVersion,
        expectedNodeRevision: scene.currentNode.revision,
        response,
      },
    });
    expect(result.statusCode, result.body).toBe(200);
    return track(result.json());
  }

  async function triage(
    f: Fixture,
    impact: boolean,
    emotion: 'A' | 'B' | 'F',
    family?: 'A' | 'F'
  ) {
    let scene = await respond(f, f.scene, 'A1001', a1001(impact), 'a1001');
    expectCurrent(scene, '01002');
    scene = await respond(
      f,
      scene,
      '01002',
      { state: 'KNOWN', selections: [emotion] },
      '01002'
    );
    if (emotion === 'F') return scene;
    expectCurrent(scene, '01003');
    if (family === undefined) return scene;
    return respond(
      f,
      scene,
      '01003',
      { state: 'KNOWN', selection: family },
      '01003'
    );
  }

  async function confirmCurrentFormulation(f: Fixture, scene: any) {
    const current = await app.inject({
      method: 'GET',
      url: `/api/v1/cases/${f.caseId}/problem-formulations/current`,
      headers: auth(f.manager.token),
    });
    expect(current.statusCode, current.body).toBe(200);
    const formulation = current.json().current;
    expect(formulation?.status).toBe('PRESENTED');

    const confirmed = await app.inject({
      method: 'POST',
      url: `/api/v1/cases/${f.caseId}/problem-formulations/${formulation.version}/confirm`,
      headers: {
        ...commandHeaders(
          f.manager.token,
          `du-canonical-confirm-${crypto.randomUUID()}`
        ),
        'if-match': `"case-v${scene.caseVersion}"`,
      },
      payload: {},
    });
    expect(confirmed.statusCode, confirmed.body).toBe(200);
    expect(confirmed.json().current?.status).toBe('CONFIRMED');

    const refreshed = await app.inject({
      method: 'GET',
      url: `/api/v1/cases/${f.caseId}/scene`,
      headers: auth(f.manager.token),
    });
    expect(refreshed.statusCode, refreshed.body).toBe(200);
    return track(refreshed.json());
  }

  function supportedGoalDependencies(formulation: any) {
    const supported = (formulation.dependencyRefs ?? []).filter(
      (dependency: any) =>
        dependency.type === 'EVIDENCE' || dependency.type === 'CONSENT'
    );
    expect(supported.length).toBeGreaterThan(0);
    return supported;
  }

  async function confirmGoalCompatibleFormulation(f: Fixture, scene: any) {
    const current = await app.inject({
      method: 'GET',
      url: `/api/v1/cases/${f.caseId}/problem-formulations/current`,
      headers: auth(f.manager.token),
    });
    expect(current.statusCode, current.body).toBe(200);
    const formulation = current.json().current;
    expect(formulation?.status).toBe('PRESENTED');
    expect(
      formulation.dependencyRefs.some(
        (dependency: any) => dependency.type === 'PACKAGE'
      )
    ).toBe(true);

    const corrected = await app.inject({
      method: 'POST',
      url:
        `/api/v1/cases/${f.caseId}/problem-formulations/` +
        formulation.version +
        '/corrections',
      headers: {
        ...commandHeaders(
          f.manager.token,
          `goal-v1-pf-correction-${crypto.randomUUID()}`
        ),
        'if-match': `"case-v${scene.caseVersion}"`,
      },
      payload: {
        changes: {
          dependencyRefs: supportedGoalDependencies(formulation),
        },
        note: 'Use only dependencies that Goal V1 can authoritatively revalidate.',
      },
    });
    expect(corrected.statusCode, corrected.body).toBe(201);
    const correctedBody = corrected.json();
    expect(correctedBody.current?.status).toBe('PRESENTED');
    expect(
      correctedBody.current?.dependencyRefs.every(
        (dependency: any) =>
          dependency.type === 'EVIDENCE' || dependency.type === 'CONSENT'
      )
    ).toBe(true);

    const confirmed = await app.inject({
      method: 'POST',
      url:
        `/api/v1/cases/${f.caseId}/problem-formulations/` +
        correctedBody.current.version +
        '/confirm',
      headers: {
        ...commandHeaders(
          f.manager.token,
          `goal-v1-pf-confirm-${crypto.randomUUID()}`
        ),
        'if-match': `"case-v${correctedBody.caseVersion}"`,
      },
      payload: {},
    });
    expect(confirmed.statusCode, confirmed.body).toBe(200);
    expect(confirmed.json().current?.status).toBe('CONFIRMED');

    const refreshed = await app.inject({
      method: 'GET',
      url: `/api/v1/cases/${f.caseId}/scene`,
      headers: auth(f.manager.token),
    });
    expect(refreshed.statusCode, refreshed.body).toBe(200);
    return track(refreshed.json());
  }

  async function enterA2004ForGoal(f: Fixture) {
    let scene = await triage(f, true, 'A', 'A');
    expectCurrent(scene, 'A2003');
    scene = await confirmGoalCompatibleFormulation(f, scene);
    expectCurrent(scene, 'A2003');
    scene = await respond(f, scene, 'A2003', a2003Response(), 'goal-a2003');
    expectCurrent(scene, 'A2004');
    return scene;
  }

  async function enterA2004(f: Fixture) {
    let scene = await triage(f, true, 'A', 'A');
    expectCurrent(scene, 'A2003');
    scene = await confirmCurrentFormulation(f, scene);
    expectCurrent(scene, 'A2003');
    scene = await respond(f, scene, 'A2003', a2003Response(), 'a2003');
    expectCurrent(scene, 'A2004');
    return scene;
  }

  it('runs the full canonical Slice 12 production orchestration without LLM, RAG, or network route truth', async () => {
    visitedNodes.clear();
    networkRouteTruthCalls = 0;

    // Clean low-impact triage -> A2001 -> A1000 -> MAIN.
    let f = await fixture('a2001');
    let scene = await triage(f, false, 'A', 'A');
    expectCurrent(scene, 'A2001');
    scene = await respond(f, scene, 'A2001', { choice: 'GENERAL_ADVICE' }, 'a2001-general');
    expectCurrent(scene, 'A1000');
    scene = await respond(f, scene, 'A1000', { action: 'RETURN_MAIN' }, 'a1000-return');
    expect(scene.routeReasonCode).toBe('RETURN_MAIN');

    // Other-needs positive triage -> A2002 -> consent -> truthful unavailable 01000.
    f = await fixture('a2002');
    scene = await triage(f, false, 'B', 'A');
    expectCurrent(scene, 'A2002');
    scene = await respond(
      f,
      scene,
      'A2002',
      { choice: 'FURTHER_ASSESSMENT' },
      'a2002-further'
    );
    expectCurrent(scene, '01004');
    scene = await respond(
      f,
      scene,
      '01004',
      { decision: 'GRANTED', confirmationStatementHash: 'a'.repeat(64) },
      '01004-grant'
    );
    expectCurrent(scene, '01000');
    scene = await respond(
      f,
      scene,
      '01000',
      { category: 'EMOTION' },
      '01000-unavailable'
    );
    expectCurrent(scene, '01000');
    expect(scene.currentNode.branchReasonCodes).toContain('APPROVED_INSTRUMENT_UNAVAILABLE');
    const boundary = scene.artifacts.find(
      (artifact: any) => artifact.type === 'SUPPLEMENTAL_ASSESSMENT_BOUNDARY'
    );
    expect(boundary?.data).toMatchObject({
      status: 'APPROVED_INSTRUMENT_UNAVAILABLE',
      approvedInstrument: null,
      questionnaire: null,
      scoring: null,
      cutoff: null,
      diagnosis: null,
      generated: false,
    });

    // 01002F priority exit.
    f = await fixture('01002f');
    scene = await triage(f, false, 'F');
    expectCurrent(scene, '01005');
    scene = await respond(f, scene, '01005', { action: 'EXIT' }, '01005-exit');
    expect(scene.routeReasonCode).toBe('PRIORITY_EMOTION_EXIT');

    // 01003F priority exit.
    f = await fixture('01003f');
    scene = await triage(f, false, 'A', 'F');
    expectCurrent(scene, '01006');
    scene = await respond(f, scene, '01006', { action: 'EXIT' }, '01006-exit');
    expect(scene.routeReasonCode).toBe('PRIORITY_CONFLICT_EXIT');

    // Positive direct impact -> Problem Formulation PRESENT -> CONFIRM -> GOALS,
    // while the still-incomplete A2003-A2010 flow remains valid. A2010 then
    // materializes the two authoritative parallel main-lane entries.
    f = await fixture('happy');
    scene = await enterA2004(f);
    const a2003 = scene.nodes.find((node: any) => node.nodeCode === 'A2003');
    expect(a2003.outputRefs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'RECORD_MARKER', markerCode: 'A200401' }),
      ])
    );
    scene = await respond(f, scene, 'A2004', { decision: 'YES' }, 'a2004-yes');
    expectCurrent(scene, 'A2005');
    scene = await respond(f, scene, 'A2005', { decision: 'WILLING' }, 'a2005-willing');
    expectCurrent(scene, 'A2007');
    scene = await respond(
      f,
      scene,
      'A2007',
      { timeline: { reviewDate: '2026-12-01', cadence: 'weekly' } },
      'a2007'
    );
    expectCurrent(scene, 'A2010');
    scene = await respond(f, scene, 'A2010', { action: 'GENERATE_SUMMARY' }, 'a2010');
    expect(scene.downstream).toEqual({
      routeIntent: null,
      available: true,
      reasonCode: null,
    });
    expect(scene.activeNodes).toEqual(expect.arrayContaining([
      expect.objectContaining({ nodeCode: 'A3000', status: 'AVAILABLE' }),
      expect.objectContaining({ nodeCode: 'A4001', status: 'AVAILABLE' }),
    ]));
    expect(scene.nodes.find((node: any) => node.nodeCode === 'A3000')?.status)
      .toBe('AVAILABLE');
    expect(scene.nodes.find((node: any) => node.nodeCode === 'A4001')?.status)
      .toBe('AVAILABLE');
    expect(scene.artifacts.some((artifact: any) => artifact.type === 'SOLUTION_SUMMARY')).toBe(true);

    // Alternative branch: A2004 no -> A2006 willing -> A2005 unwilling
    // -> A2008 agree -> A2007. This mechanically exercises A2006 and A2008
    // with the A200401 marker propagated through real Scene refs.
    f = await fixture('a2006-a2008');
    scene = await enterA2004(f);
    scene = await respond(f, scene, 'A2004', { decision: 'NO' }, 'a2004-no');
    expectCurrent(scene, 'A2006');
    scene = await respond(f, scene, 'A2006', { decision: 'WILLING' }, 'a2006-willing');
    expectCurrent(scene, 'A2005');
    scene = await respond(f, scene, 'A2005', { decision: 'UNWILLING' }, 'a2005-unwilling');
    expectCurrent(scene, 'A2008');
    scene = await respond(f, scene, 'A2008', { decision: 'AGREE' }, 'a2008-agree');
    expectCurrent(scene, 'A2007');

    // Alternative branch: A2004 no -> A2006 unwilling -> A2009 -> 01004.
    f = await fixture('a2009');
    scene = await enterA2004(f);
    scene = await respond(f, scene, 'A2004', { decision: 'NO' }, 'a2004-no-a2009');
    expectCurrent(scene, 'A2006');
    scene = await respond(
      f,
      scene,
      'A2006',
      { decision: 'UNWILLING' },
      'a2006-unwilling'
    );
    expectCurrent(scene, 'A2009');
    scene = await respond(f, scene, 'A2009', { decision: 'AGREE' }, 'a2009-agree');
    expectCurrent(scene, '01004');

    const intendedSlice12Subgraph = [
      'A1001',
      '01002',
      '01003',
      'A2001',
      'A1000',
      'A2002',
      '01004',
      '01000',
      '01005',
      '01006',
      'A2003',
      'A2004',
      'A2005',
      'A2006',
      'A2007',
      'A2008',
      'A2009',
      'A2010',
    ];
    for (const nodeCode of intendedSlice12Subgraph) {
      expect(visitedNodes, `canonical fixture did not visit ${nodeCode}`).toContain(nodeCode);
    }
    expect(visitedNodes).toContain('A3000');
    expect(networkRouteTruthCalls).toBe(0);
  });

  it('proves A200401 is marker-only across GET, POST, and A2003 recording', async () => {
    const f = await fixture('a200401');
    let scene = await triage(f, true, 'A', 'A');
    expectCurrent(scene, 'A2003');

    const getMarker = await app.inject({
      method: 'GET',
      url: `/api/v1/cases/${f.caseId}/scene/nodes/A200401`,
      headers: auth(f.manager.token),
    });
    expect(getMarker.statusCode, getMarker.body).toBe(404);
    expect(getMarker.json().code).toBe('SCENE_NODE_NOT_FOUND');

    const postMarker = await app.inject({
      method: 'POST',
      url: `/api/v1/cases/${f.caseId}/scene/nodes/A200401/responses`,
      headers: {
        ...auth(f.manager.token),
        'idempotency-key': `du-canonical-a200401-post-${crypto.randomUUID()}`,
      },
      payload: {
        targetPersonId: f.targetPersonId,
        expectedCaseVersion: scene.caseVersion,
        expectedNodeRevision: scene.currentNode.revision,
        response: { decision: 'WILLING' },
      },
    });
    expect(postMarker.statusCode, postMarker.body).toBe(404);
    expect(postMarker.json().code).toBe('SCENE_NODE_NOT_FOUND');

    scene = await respond(f, scene, 'A2003', a2003Response(), 'a200401-record');
    expectCurrent(scene, 'A2004');
    const completedA2003 = scene.nodes.find((node: any) => node.nodeCode === 'A2003');
    const marker = completedA2003.outputRefs.find(
      (ref: any) => ref.type === 'RECORD_MARKER' && ref.markerCode === 'A200401'
    );
    expect(marker).toMatchObject({
      type: 'RECORD_MARKER',
      markerCode: 'A200401',
    });
    expect(marker.evidenceRefs).toHaveLength(5);

    const persistedNode = await admin.query(
      `SELECT count(*)::int AS n
         FROM scene_node_states
        WHERE case_id=$1 AND node_code='A200401'`,
      [f.caseId]
    );
    expect(persistedNode.rows[0].n).toBe(0);
    expect(networkRouteTruthCalls).toBe(0);
  });

  async function finishA2010ForGoal(f: Fixture) {
    let scene = await enterA2004ForGoal(f);
    scene = await respond(f, scene, 'A2004', { decision: 'YES' }, 'goal-a2004');
    scene = await respond(f, scene, 'A2005', { decision: 'WILLING' }, 'goal-a2005');
    scene = await respond(
      f,
      scene,
      'A2007',
      { timeline: { reviewDate: '2026-12-01', cadence: 'weekly' } },
      'goal-a2007'
    );
    scene = await respond(
      f,
      scene,
      'A2010',
      { action: 'GENERATE_SUMMARY' },
      'goal-a2010'
    );
    expect(scene.nodes.find((n: any) => n.nodeCode === 'A2010')?.status).toBe('COMPLETED');
    return scene;
  }

  async function currentGoalFormulation(f: Fixture) {
    const current = await app.inject({
      method: 'GET',
      url: '/api/v1/cases/' + f.caseId + '/problem-formulations/current',
      headers: auth(f.manager.token),
    });
    expect(current.statusCode, current.body).toBe(200);
    expect(current.json().current?.status).toBe('CONFIRMED');
    return current.json().current;
  }

  function goalSavePayload(formulation: any) {
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

  async function saveGoalFor(
    f: Fixture,
    caseVersion: number,
    formulation: any,
    key: string,
    extra: Record<string, unknown> = {}
  ) {
    return app.inject({
      method: 'POST',
      url: '/api/v1/cases/' + f.caseId + '/goals',
      headers: {
        ...auth(f.manager.token),
        'idempotency-key': key,
        'if-match': '"case-v' + caseVersion + '"',
      },
      payload: {
        ...goalSavePayload(formulation),
        ...extra,
      },
    });
  }

  async function confirmGoalFor(
    f: Fixture,
    caseVersion: number,
    goalId: string,
    goalVersion: number,
    key: string,
    extra: Record<string, unknown> = {}
  ) {
    return app.inject({
      method: 'POST',
      url: '/api/v1/cases/' + f.caseId + '/goals',
      headers: {
        ...auth(f.manager.token),
        'idempotency-key': key,
        'if-match': '"case-v' + caseVersion + '"',
      },
      payload: {
        operation: 'CONFIRM',
        goalId,
        goalVersion,
        ...extra,
      },
    });
  }

  it.each([
    ['POLICY', { type: 'POLICY', key: 'policy', version: 'v1' }],
    ['PACKAGE', { type: 'PACKAGE', key: 'package', version: 'v1' }],
    ['CONTENT_VERSION', { type: 'CONTENT_VERSION', key: 'content', version: 'v1' }],
  ] as const)(
    'rejects Goal SAVE with unsupported %s dependency at the transport boundary',
    async (type, dependency) => {
      const f = await fixture('goal-unsupported-' + type.toLowerCase());
      let scene = await triage(f, true, 'A', 'A');
      scene = await confirmCurrentFormulation(f, scene);
      const formulation = await currentGoalFormulation(f);
      const rejected = await saveGoalFor(
        f,
        scene.caseVersion,
        formulation,
        'goal-save-unsupported-' + type.toLowerCase() + '-' + crypto.randomUUID(),
        { dependencyRefs: [...formulation.dependencyRefs, dependency] }
      );
      expect(rejected.statusCode, rejected.body).toBe(422);
    }
  );

  it('fails closed when the current Problem Formulation contains an unsupported dependency', async () => {
    const f = await fixture('goal-pf-unsupported');
    let scene = await triage(f, true, 'A', 'A');
    scene = await confirmCurrentFormulation(f, scene);
    const formulation = await currentGoalFormulation(f);
    expect(
      formulation.dependencyRefs.some(
        (dependency: any) => dependency.type === 'PACKAGE'
      )
    ).toBe(true);

    const rejected = await saveGoalFor(
      f,
      scene.caseVersion,
      formulation,
      'goal-save-pf-unsupported-' + crypto.randomUUID(),
      { dependencyRefs: supportedGoalDependencies(formulation) }
    );
    expect(rejected.statusCode, rejected.body).toBe(422);
    expect(rejected.json().code).toBe('VALIDATION_ERROR');

    const persisted = await admin.query(
      'SELECT count(*)::int AS n FROM goals WHERE case_id=$1',
      [f.caseId]
    );
    expect(persisted.rows[0].n).toBe(0);

    const kase = await app.inject({
      method: 'GET',
      url: '/api/v1/cases/' + f.caseId,
      headers: auth(f.manager.token),
    });
    expect(kase.json().phase).toBe('GOALS');
  });

  it('continues the canonical flow through SAVE and atomic ConfirmGoal to PLANNING', async () => {
    const f = await fixture('goal-happy');
    const scene = await finishA2010ForGoal(f);
    const formulation = await currentGoalFormulation(f);

    const strictSave = goalSavePayload(formulation);
    const { participantResponsibilities: _omitted, ...missingParticipantField } =
      strictSave;
    const strictRejected = await app.inject({
      method: 'POST',
      url: '/api/v1/cases/' + f.caseId + '/goals',
      headers: {
        ...auth(f.manager.token),
        'idempotency-key': 'goal-save-missing-participant-field-' + crypto.randomUUID(),
        'if-match': '"case-v' + scene.caseVersion + '"',
      },
      payload: missingParticipantField,
    });
    expect(strictRejected.statusCode, strictRejected.body).toBe(422);

    const saved = await saveGoalFor(
      f,
      scene.caseVersion,
      formulation,
      'goal-save-happy-' + crypto.randomUUID()
    );
    expect(saved.statusCode, saved.body).toBe(201);
    expect(saved.json()).toMatchObject({
      operation: 'SAVE',
      phase: 'GOALS',
      confirmationState: 'UNCONFIRMED',
    });
    const saveBody = saved.json();

    const savedRow = await admin.query(
      `SELECT saved_by_person_id,confirmation_state,
              confirmed_by_person_id,confirmed_at
         FROM goals
        WHERE case_id=$1 AND goal_id=$2 AND version=$3`,
      [f.caseId, saveBody.goalId, saveBody.goalVersion]
    );
    expect(savedRow.rows[0]).toMatchObject({
      saved_by_person_id: f.manager.personId,
      confirmation_state: 'UNCONFIRMED',
      confirmed_by_person_id: null,
      confirmed_at: null,
    });

    const afterSave = await app.inject({
      method: 'GET',
      url: '/api/v1/cases/' + f.caseId,
      headers: auth(f.manager.token),
    });
    expect(afterSave.json().phase).toBe('GOALS');

    const missingOperation = await app.inject({
      method: 'POST',
      url: '/api/v1/cases/' + f.caseId + '/goals',
      headers: {
        ...auth(f.manager.token),
        'idempotency-key': 'goal-missing-operation-' + crypto.randomUUID(),
        'if-match': '"case-v' + saveBody.caseVersion + '"',
      },
      payload: {
        goalId: saveBody.goalId,
        goalVersion: saveBody.goalVersion,
      },
    });
    expect(missingOperation.statusCode).toBe(422);

    const missingGoal = await confirmGoalFor(
      f,
      saveBody.caseVersion,
      crypto.randomUUID(),
      1,
      'goal-confirm-missing-' + crypto.randomUUID()
    );
    expect(missingGoal.statusCode).toBe(409);
    expect(missingGoal.json().code).toBe('CASE_PHASE_CONFLICT');

    const wrongGoalVersion = await confirmGoalFor(
      f,
      saveBody.caseVersion,
      saveBody.goalId,
      saveBody.goalVersion + 1,
      'goal-confirm-wrong-version-' + crypto.randomUUID()
    );
    expect(wrongGoalVersion.statusCode).toBe(409);
    expect(wrongGoalVersion.json().code).toBe('CASE_PHASE_CONFLICT');

    const mutation = await confirmGoalFor(
      f,
      saveBody.caseVersion,
      saveBody.goalId,
      saveBody.goalVersion,
      'goal-confirm-mutation-' + crypto.randomUUID(),
      { targetDescription: 'client mutation forbidden' }
    );
    expect(mutation.statusCode).toBe(422);

    const stale = await confirmGoalFor(
      f,
      scene.caseVersion,
      saveBody.goalId,
      saveBody.goalVersion,
      'goal-confirm-stale-' + crypto.randomUUID()
    );
    expect(stale.statusCode, stale.body).toBe(409);
    expect(stale.json().code).toBe('STALE_CASE_VERSION');

    const confirmKey = 'goal-confirm-happy-' + crypto.randomUUID();
    const confirmed = await confirmGoalFor(
      f,
      saveBody.caseVersion,
      saveBody.goalId,
      saveBody.goalVersion,
      confirmKey
    );
    expect(confirmed.statusCode, confirmed.body).toBe(200);
    expect(confirmed.json()).toMatchObject({
      operation: 'CONFIRM',
      phase: 'PLANNING',
      confirmationState: 'CONFIRMED',
      confirmedBy: f.manager.personId,
    });

    const replay = await confirmGoalFor(
      f,
      saveBody.caseVersion,
      saveBody.goalId,
      saveBody.goalVersion,
      confirmKey
    );
    expect(replay.statusCode).toBe(200);
    expect(replay.json()).toEqual(confirmed.json());

    const mismatch = await confirmGoalFor(
      f,
      saveBody.caseVersion,
      saveBody.goalId,
      saveBody.goalVersion + 1,
      confirmKey
    );
    expect(mismatch.statusCode).toBe(409);
    expect(mismatch.json().code).toBe('IDEMPOTENCY_PAYLOAD_MISMATCH');

    const duplicateNewKey = await confirmGoalFor(
      f,
      confirmed.json().caseVersion,
      saveBody.goalId,
      saveBody.goalVersion,
      'goal-confirm-duplicate-new-key-' + crypto.randomUUID()
    );
    expect(duplicateNewKey.statusCode).toBe(409);
    expect(duplicateNewKey.json().code).toBe('CASE_PHASE_CONFLICT');

    const duplicateTraces = await admin.query(
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
    expect(duplicateTraces.rows[0]).toEqual({ events: 1, audits: 1 });

    const afterConfirm = await app.inject({
      method: 'GET',
      url: '/api/v1/cases/' + f.caseId,
      headers: auth(f.manager.token),
    });
    expect(afterConfirm.json().phase).toBe('PLANNING');

    const secondEndpoint = await app.inject({
      method: 'POST',
      url:
        '/api/v1/cases/' +
        f.caseId +
        '/goals/' +
        saveBody.goalId +
        '/confirm',
      headers: commandHeaders(
        f.manager.token,
        'goal-forbidden-second-endpoint'
      ),
      payload: {},
    });
    expect(secondEndpoint.statusCode).toBe(404);
  });

  it('rejects ConfirmGoal while A2010 is incomplete and leaves the Case in GOALS', async () => {
    const f = await fixture('goal-a2010-incomplete');
    let scene = await triage(f, true, 'A', 'A');
    scene = await confirmGoalCompatibleFormulation(f, scene);
    expect(scene.currentNode?.nodeCode).toBe('A2003');
    const formulation = await currentGoalFormulation(f);

    const saveKey = 'goal-save-incomplete-' + crypto.randomUUID();
    const saved = await saveGoalFor(
      f,
      scene.caseVersion,
      formulation,
      saveKey
    );
    expect(saved.statusCode, saved.body).toBe(201);

    const replay = await saveGoalFor(
      f,
      scene.caseVersion,
      formulation,
      saveKey
    );
    expect(replay.statusCode, replay.body).toBe(201);
    expect(replay.json()).toEqual(saved.json());

    const mismatch = await saveGoalFor(
      f,
      scene.caseVersion,
      formulation,
      saveKey,
      { reviewPoint: 'Different replay payload.' }
    );
    expect(mismatch.statusCode, mismatch.body).toBe(409);
    expect(mismatch.json().code).toBe('IDEMPOTENCY_PAYLOAD_MISMATCH');

    const result = await confirmGoalFor(
      f,
      saved.json().caseVersion,
      saved.json().goalId,
      saved.json().goalVersion,
      'goal-confirm-incomplete-' + crypto.randomUUID()
    );
    expect(result.statusCode, result.body).toBe(409);
    expect(result.json().code).toBe('CASE_PHASE_CONFLICT');

    const kase = await app.inject({
      method: 'GET',
      url: '/api/v1/cases/' + f.caseId,
      headers: auth(f.manager.token),
    });
    expect(kase.json().phase).toBe('GOALS');
  });

  it('re-checks primary authority after SAVE', async () => {
    const f = await fixture('goal-primary-change');
    const scene = await finishA2010ForGoal(f);
    const formulation = await currentGoalFormulation(f);
    const saved = await saveGoalFor(
      f,
      scene.caseVersion,
      formulation,
      'goal-save-primary-' + crypto.randomUUID()
    );
    expect(saved.statusCode).toBe(201);

    const other = await createCase(
      app,
      f.manager.token,
      'goal-primary-other'
    );
    expect(other.statusCode, other.body).toBe(201);

    const switched = await app.inject({
      method: 'POST',
      url:
        '/api/v1/cases/' +
        other.json().id +
        '/switch-primary',
      headers: commandHeaders(f.manager.token, 'goal-switch-primary'),
      payload: {
        reason: 'verify current advancement authority',
        expectedPrimaryCaseId: f.caseId,
        expectedPrimaryVersion: saved.json().caseVersion,
      },
    });
    expect(switched.statusCode, switched.body).toBe(200);

    const rejected = await confirmGoalFor(
      f,
      switched.json().previousPrimary.version,
      saved.json().goalId,
      saved.json().goalVersion,
      'goal-confirm-old-primary-' + crypto.randomUUID()
    );
    expect(rejected.statusCode, rejected.body).toBe(409);
    expect(rejected.json().code).toBe('CASE_NOT_PRIMARY');

    const kase = await app.inject({
      method: 'GET',
      url: '/api/v1/cases/' + f.caseId,
      headers: auth(f.manager.token),
    });
    expect(kase.json().phase).toBe('GOALS');
  });

  it('converges concurrent ConfirmGoal attempts to one authoritative confirmation', async () => {
    const f = await fixture('goal-concurrent');
    const scene = await finishA2010ForGoal(f);
    const formulation = await currentGoalFormulation(f);
    const saved = await saveGoalFor(
      f,
      scene.caseVersion,
      formulation,
      'goal-save-concurrent-' + crypto.randomUUID()
    );
    expect(saved.statusCode).toBe(201);

    const [a, b] = await Promise.all([
      confirmGoalFor(
        f,
        saved.json().caseVersion,
        saved.json().goalId,
        saved.json().goalVersion,
        'goal-confirm-concurrent-a-' + crypto.randomUUID()
      ),
      confirmGoalFor(
        f,
        saved.json().caseVersion,
        saved.json().goalId,
        saved.json().goalVersion,
        'goal-confirm-concurrent-b-' + crypto.randomUUID()
      ),
    ]);
    expect([a.statusCode, b.statusCode].sort()).toEqual([200, 409]);

    const rows = await admin.query(
      'SELECT confirmation_state, count(*)::int AS n ' +
        'FROM goals WHERE case_id=$1 GROUP BY confirmation_state',
      [f.caseId]
    );
    expect(rows.rows).toEqual([
      expect.objectContaining({
        confirmation_state: 'CONFIRMED',
        n: 1,
      }),
    ]);

    const state = await admin.query(
      `SELECT phase,version FROM cases WHERE id=$1`,
      [f.caseId]
    );
    expect(state.rows[0]).toEqual({
      phase: 'PLANNING',
      version: saved.json().caseVersion + 1,
    });

    const traces = await admin.query(
      `SELECT
         (SELECT count(*)::int FROM case_events
           WHERE case_id=$1 AND event_type='CASE_GOAL_CONFIRMED') AS events,
         (SELECT count(*)::int FROM business_audit_events
           WHERE family_id=$2
             AND resource_type='GOAL'
             AND resource_id=$3
             AND event_type='GOAL_CONFIRMED') AS audits`,
      [f.caseId, f.familyId, saved.json().goalId]
    );
    expect(traces.rows[0]).toEqual({ events: 1, audits: 1 });
  });

  it('fails closed on Safety and Compliance at confirmation time', async () => {
    const safety = await fixture('goal-safety');
    let scene = await finishA2010ForGoal(safety);
    let formulation = await currentGoalFormulation(safety);
    let saved = await saveGoalFor(
      safety,
      scene.caseVersion,
      formulation,
      'goal-save-safety-' + crypto.randomUUID()
    );
    expect(saved.statusCode).toBe(201);
    const safetyIdentity: ApprovedPolicyIdentity = {
      policyRef: 'policy.goal-confirm-test',
      policyVersion: '1',
      ruleRef: 'rule.goal-confirm-test',
      ruleVersion: '1',
    };
    const safetyDecision = runSafetyPrecheck({
      case: {
        caseId: safety.caseId,
        status: 'OPEN',
        version: saved.json().caseVersion,
      },
      trustedPolicyIdentity: safetyIdentity,
      approvedEvaluation: {
        outcome: 'HOLD_REQUIRED',
        ...safetyIdentity,
        riskCategoryRef: 'GOAL_CONFIRM_TEST',
        evidenceRefs: [{ kind: 'EVIDENCE', ref: 'goal-confirm-test' }],
      },
    });
    const held = await enterSafetyHold(appPool, {
      accountId: safety.manager.accountId,
      personId: safety.manager.personId,
      caseId: safety.caseId,
      idempotencyKey: 'goal-safety-hold-' + crypto.randomUUID(),
      expectedCaseVersion: saved.json().caseVersion,
      decision: safetyDecision,
      trustedPolicyIdentity: safetyIdentity,
    });
    expect(held.status).toBe(200);
    let result = await confirmGoalFor(
      safety,
      (held.body as { version: number }).version,
      saved.json().goalId,
      saved.json().goalVersion,
      'goal-confirm-safety-' + crypto.randomUUID()
    );
    expect(result.statusCode).toBe(409);
    expect(result.json().code).toBe('SAFETY_HOLD_BLOCKED');

    const compliance = await fixture('goal-compliance');
    scene = await finishA2010ForGoal(compliance);
    formulation = await currentGoalFormulation(compliance);
    saved = await saveGoalFor(
      compliance,
      scene.caseVersion,
      formulation,
      'goal-save-compliance-' + crypto.randomUUID()
    );
    expect(saved.statusCode).toBe(201);
    await admin.query(
      "UPDATE person_compliance_profiles " +
        "SET age_band='UNKNOWN',minor_mode=false," +
        "guardian_person_id=NULL,guardian_consent_record_id=NULL," +
        "guardian_consent_version=NULL,verified_source='SELF_STATEMENT' " +
        'WHERE person_id=$1',
      [compliance.manager.personId]
    );
    result = await confirmGoalFor(
      compliance,
      saved.json().caseVersion,
      saved.json().goalId,
      saved.json().goalVersion,
      'goal-confirm-compliance-' + crypto.randomUUID()
    );
    expect(result.statusCode).toBe(409);
    expect(result.json().code).toBe('COMPLIANCE_BLOCKED');
  });


  it.each([
    ['NEEDS_REVIEW', 'CONFIRMED'],
    ['CURRENT', 'PRESENTED'],
  ] as const)(
    'rejects ConfirmGoal when the persisted formulation gate is %s / %s',
    async (reviewState, status) => {
      const f = await fixture(
        'goal-pf-gate-' + reviewState.toLowerCase() + '-' + status.toLowerCase()
      );
      const scene = await finishA2010ForGoal(f);
      const formulation = await currentGoalFormulation(f);
      const saved = await saveGoalFor(
        f,
        scene.caseVersion,
        formulation,
        'goal-save-pf-gate-' + crypto.randomUUID()
      );
      expect(saved.statusCode, saved.body).toBe(201);

      if (status === 'PRESENTED') {
        await admin.query(
          "UPDATE problem_formulations " +
            "SET status='PRESENTED',review_state=$2," +
            "confirmed_by_person_id=NULL,confirmed_at=NULL,updated_at=now() " +
            "WHERE id=$1",
          [formulation.id, reviewState]
        );
      } else {
        await admin.query(
          'UPDATE problem_formulations SET review_state=$2,updated_at=now() WHERE id=$1',
          [formulation.id, reviewState]
        );
      }

      const blocked = await confirmGoalFor(
        f,
        saved.json().caseVersion,
        saved.json().goalId,
        saved.json().goalVersion,
        'goal-confirm-pf-gate-' + crypto.randomUUID()
      );
      expect(blocked.statusCode, blocked.body).toBe(409);
      expect(blocked.json().code).toBe('CASE_PHASE_CONFLICT');

      const goal = await admin.query(
        "SELECT confirmation_state FROM goals " +
          "WHERE case_id=$1 AND lifecycle_status='ACTIVE'",
        [f.caseId]
      );
      expect(goal.rows[0].confirmation_state).toBe('UNCONFIRMED');
    }
  );

  it('rejects a saved Goal after a newer current formulation supersedes its exact binding', async () => {
    const f = await fixture('goal-stale-formulation');
    const scene = await finishA2010ForGoal(f);
    const formulation = await currentGoalFormulation(f);
    const saved = await saveGoalFor(
      f,
      scene.caseVersion,
      formulation,
      'goal-save-stale-formulation-' + crypto.randomUUID()
    );
    expect(saved.statusCode, saved.body).toBe(201);

    await admin.query('BEGIN');
    try {
      await admin.query(
        "UPDATE problem_formulations SET status='SUPERSEDED',updated_at=now() WHERE id=$1",
        [formulation.id]
      );
      await admin.query(
        `INSERT INTO problem_formulations (
           family_id,case_id,version,status,review_state,
           primary_problem,key_factors,evidence_refs,unknowns,conflicts,
           scene_fit,alternative_explanations,reassessment_conditions,
           exit_conditions,user_response,confirmed_by_person_id,confirmed_at,
           dependency_refs,supersedes_version
         )
         SELECT family_id,case_id,version+1,'CONFIRMED','CURRENT',
                primary_problem,key_factors,evidence_refs,unknowns,conflicts,
                scene_fit,alternative_explanations,reassessment_conditions,
                exit_conditions,
                jsonb_build_object(
                  'kind','CONFIRM',
                  'actorPersonId',$2::text,
                  'respondedAt',now()::text
                ),
                $2::uuid,now(),dependency_refs,version
           FROM problem_formulations
          WHERE id=$1`,
        [formulation.id, f.manager.personId]
      );
      await admin.query('COMMIT');
    } catch (error) {
      await admin.query('ROLLBACK');
      throw error;
    }

    const blocked = await confirmGoalFor(
      f,
      saved.json().caseVersion,
      saved.json().goalId,
      saved.json().goalVersion,
      'goal-confirm-stale-formulation-' + crypto.randomUUID()
    );
    expect(blocked.statusCode, blocked.body).toBe(409);
    expect(blocked.json().code).toBe('CASE_PHASE_CONFLICT');
  });

  it('supersedes an unconfirmed Goal version and rejects confirmation of the stale predecessor', async () => {
    const f = await fixture('goal-successor');
    const scene = await finishA2010ForGoal(f);
    const formulation = await currentGoalFormulation(f);

    const first = await saveGoalFor(
      f,
      scene.caseVersion,
      formulation,
      'goal-save-successor-v1-' + crypto.randomUUID()
    );
    expect(first.statusCode, first.body).toBe(201);

    const second = await saveGoalFor(
      f,
      first.json().caseVersion,
      formulation,
      'goal-save-successor-v2-' + crypto.randomUUID(),
      { reviewPoint: 'Review after 10 days.' }
    );
    expect(second.statusCode, second.body).toBe(201);
    expect(second.json().goalId).toBe(first.json().goalId);
    expect(second.json().goalVersion).toBe(first.json().goalVersion + 1);

    const stale = await confirmGoalFor(
      f,
      second.json().caseVersion,
      first.json().goalId,
      first.json().goalVersion,
      'goal-confirm-stale-version-' + crypto.randomUUID()
    );
    expect(stale.statusCode, stale.body).toBe(409);
    expect(stale.json().code).toBe('CASE_PHASE_CONFLICT');

    const versions = await admin.query(
      'SELECT version,lifecycle_status,confirmation_state ' +
        'FROM goals WHERE case_id=$1 AND goal_id=$2 ORDER BY version',
      [f.caseId, first.json().goalId]
    );
    expect(versions.rows).toEqual([
      {
        version: first.json().goalVersion,
        lifecycle_status: 'SUPERSEDED',
        confirmation_state: 'UNCONFIRMED',
      },
      {
        version: second.json().goalVersion,
        lifecycle_status: 'ACTIVE',
        confirmation_state: 'UNCONFIRMED',
      },
    ]);
  });

  it('rolls back Goal confirmation and Case advancement when confirmation audit fails', async () => {
    const f = await fixture('goal-atomic-rollback');
    const scene = await finishA2010ForGoal(f);
    const formulation = await currentGoalFormulation(f);
    const saved = await saveGoalFor(
      f,
      scene.caseVersion,
      formulation,
      'goal-save-atomic-' + crypto.randomUUID()
    );
    expect(saved.statusCode, saved.body).toBe(201);

    await admin.query(`
      CREATE OR REPLACE FUNCTION goal_runtime_fail_confirm_audit()
      RETURNS trigger LANGUAGE plpgsql AS $goal$
      BEGIN
        IF NEW.event_type = 'GOAL_CONFIRMED'
           AND NEW.family_id = '${f.familyId}'::uuid THEN
          RAISE EXCEPTION 'GOAL_RUNTIME_CONFIRM_AUDIT_FAILURE';
        END IF;
        RETURN NEW;
      END $goal$;
      DROP TRIGGER IF EXISTS goal_runtime_fail_confirm_audit_trigger
        ON business_audit_events;
      CREATE TRIGGER goal_runtime_fail_confirm_audit_trigger
        BEFORE INSERT ON business_audit_events
        FOR EACH ROW EXECUTE FUNCTION goal_runtime_fail_confirm_audit();
    `);

    try {
      const failed = await confirmGoalFor(
        f,
        saved.json().caseVersion,
        saved.json().goalId,
        saved.json().goalVersion,
        'goal-confirm-atomic-failure-' + crypto.randomUUID()
      );
      expect(failed.statusCode, failed.body).toBe(500);
      expect(failed.json().code).toBe('INTERNAL_ERROR');

      const kase = await app.inject({
        method: 'GET',
        url: '/api/v1/cases/' + f.caseId,
        headers: auth(f.manager.token),
      });
      expect(kase.statusCode).toBe(200);
      expect(kase.json()).toMatchObject({
        phase: 'GOALS',
        version: saved.json().caseVersion,
      });

      const goal = await admin.query(
        'SELECT confirmation_state,confirmed_by_person_id,confirmed_at ' +
          'FROM goals WHERE case_id=$1 AND lifecycle_status=\'ACTIVE\'',
        [f.caseId]
      );
      expect(goal.rows[0]).toMatchObject({
        confirmation_state: 'UNCONFIRMED',
        confirmed_by_person_id: null,
        confirmed_at: null,
      });

      const traces = await admin.query(
        `SELECT
           (SELECT count(*)::int FROM case_events
             WHERE case_id=$1 AND event_type='CASE_GOAL_CONFIRMED') AS events,
           (SELECT count(*)::int FROM business_audit_events
             WHERE family_id=$2 AND event_type='GOAL_CONFIRMED') AS audits`,
        [f.caseId, f.familyId]
      );
      expect(traces.rows[0]).toEqual({ events: 0, audits: 0 });
    } finally {
      await admin.query(
        `DROP TRIGGER IF EXISTS goal_runtime_fail_confirm_audit_trigger
           ON business_audit_events;
         DROP FUNCTION IF EXISTS goal_runtime_fail_confirm_audit()`
      );
    }
  });

  it.each([false, true])('revalidates a pinned Goal Consent dependency after SAVE (revoked=%s)', async (revoked) => {
    const f = await fixture(revoked ? 'goal-consent-revoked-dependency' : 'goal-consent-current-dependency');
    const scene = await finishA2010ForGoal(f);
    const formulation = await currentGoalFormulation(f);
    const noticeHash = getCurrentNoticeHash();
    // An unbound grant affects neither the actor's Compliance profile nor the formulation.
    const { rows: [grant] } = await admin.query(
      `WITH request AS (
         INSERT INTO guardian_consent_requests
           (family_id,guardian_person_id,declared_age_band,notice_version,notice_hash,status,expires_at,completed_at)
         VALUES ($1,$2,'UNDER_14','v1',$4,'GRANTED',now()+interval '1 hour',now())
         RETURNING id
       )
       INSERT INTO consent_records
         (family_id,guardian_person_id,guardian_account_id,purpose,decision,
          version,onboarding_request_id,notice_version,notice_hash,policy_version,evidence)
       SELECT $1,$2,$3,'UNDER_14_GUARDIAN_CONSENT','GRANTED',1,id,'v1',$4,'v1',$5::jsonb
         FROM request RETURNING id`,
      [f.familyId, f.manager.personId, f.manager.accountId, noticeHash, JSON.stringify({
        channel: 'TEST',
        accepted_text_hash: 'b'.repeat(64),
        declared_age_band: 'UNDER_14',
        client_ip_hash: 'c'.repeat(64),
        user_agent_hash: 'd'.repeat(64),
      })]
    );
    const dependencyRefs = [
      ...formulation.dependencyRefs,
      { type: 'CONSENT', id: grant.id, version: 1 },
    ];
    const saved = await saveGoalFor(f, scene.caseVersion, formulation, crypto.randomUUID(), { dependencyRefs });
    expect(saved.statusCode, saved.body).toBe(201);

    if (revoked) {
      const revocation = await revokeConsent(app, f.manager.token, crypto.randomUUID(), grant.id);
      expect(revocation.statusCode, revocation.body).toBe(200);
      const { rows } = await admin.query(
        "SELECT decision,version FROM consent_records WHERE id=$1 OR supersedes_id=$1 ORDER BY version",
        [grant.id]
      );
      expect(rows).toEqual([
        { decision: 'GRANTED', version: 1 },
        { decision: 'REVOKED', version: 2 },
      ]);
    }

    const { caseVersion, goalId, goalVersion } = saved.json();
    const confirmation = await confirmGoalFor(f, caseVersion, goalId, goalVersion, crypto.randomUUID());
    expect(confirmation.statusCode, confirmation.body).toBe(revoked ? 409 : 200);
    if (revoked) {
      expect(confirmation.json().code).toBe('CONSENT_BLOCKED');
      const resave = await saveGoalFor(f, caseVersion, formulation, crypto.randomUUID(), { dependencyRefs });
      expect(resave.statusCode, resave.body).toBe(409);
      expect(resave.json().code).toBe('CONSENT_BLOCKED');

      const { rows } = await admin.query(
        `SELECT c.phase,c.version,g.confirmation_state
           FROM cases c JOIN goals g ON g.case_id=c.id
          WHERE c.id=$1 AND g.goal_id=$2`,
        [f.caseId, goalId]
      );
      expect(rows).toEqual([{ phase: 'GOALS', version: caseVersion, confirmation_state: 'UNCONFIRMED' }]);
    }
  });

  it('re-checks Authorization and Consent at confirmation time', async () => {
    const f = await fixture('goal-auth-consent');
    const scene = await finishA2010ForGoal(f);
    const formulation = await currentGoalFormulation(f);
    const saved = await saveGoalFor(
      f,
      scene.caseVersion,
      formulation,
      'goal-save-auth-consent-' + crypto.randomUUID()
    );
    expect(saved.statusCode, saved.body).toBe(201);

    const nonManager = await loginWithLabel(
      app,
      'goal-non-manager-' + crypto.randomUUID()
    );
    await admin.query(
      'INSERT INTO family_members (family_id,person_id) VALUES ($1,$2)',
      [f.familyId, nonManager.personId]
    );
    const denied = await app.inject({
      method: 'POST',
      url: '/api/v1/cases/' + f.caseId + '/goals',
      headers: {
        ...auth(nonManager.token),
        'idempotency-key': 'goal-auth-denied-' + crypto.randomUUID(),
        'if-match': '"case-v' + saved.json().caseVersion + '"',
      },
      payload: {
        operation: 'CONFIRM',
        goalId: saved.json().goalId,
        goalVersion: saved.json().goalVersion,
      },
    });
    expect(denied.statusCode).toBe(404);
    expect(denied.json().code).toBe('CASE_NOT_FOUND');

    const guardian = await loginWithLabel(
      app,
      'goal-guardian-' + crypto.randomUUID()
    );
    await admin.query(
      'INSERT INTO family_members (family_id,person_id) VALUES ($1,$2)',
      [f.familyId, guardian.personId]
    );

    const noticeHash = getCurrentNoticeHash();
    const request = await admin.query(
      `INSERT INTO guardian_consent_requests
         (family_id,guardian_person_id,subject_person_id,declared_age_band,
          notice_version,notice_hash,status,expires_at,completed_at)
       VALUES ($1,$2,$3,'UNDER_14','v1',$4,'GRANTED',
               now()+interval '1 hour',now())
       RETURNING id`,
      [f.familyId, guardian.personId, f.manager.personId, noticeHash]
    );
    const consent = await admin.query(
      `INSERT INTO consent_records
         (family_id,guardian_person_id,guardian_account_id,purpose,decision,
          version,onboarding_request_id,bound_person_id,bound_at,
          notice_version,notice_hash,policy_version,evidence)
       VALUES ($1,$2,$3,'UNDER_14_GUARDIAN_CONSENT','GRANTED',1,$4,$5,now(),
               'v1',$6,'v1',$7::jsonb)
       RETURNING id`,
      [
        f.familyId,
        guardian.personId,
        guardian.accountId,
        request.rows[0].id,
        f.manager.personId,
        noticeHash,
        JSON.stringify({
          channel: 'TEST',
          accepted_text_hash: 'b'.repeat(64),
          declared_age_band: 'UNDER_14',
          client_ip_hash: 'c'.repeat(64),
          user_agent_hash: 'd'.repeat(64),
        }),
      ]
    );
    await admin.query(
      `UPDATE person_compliance_profiles
          SET age_band='UNDER_14',
              minor_mode=true,
              guardian_person_id=$2,
              guardian_consent_record_id=$3,
              guardian_consent_version=1,
              verified_source='GUARDIAN_RELAY',
              updated_at=now()
        WHERE person_id=$1`,
      [f.manager.personId, guardian.personId, consent.rows[0].id]
    );

    const revoked = await revokeConsent(
      app,
      guardian.token,
      'goal-consent-revoke-' + crypto.randomUUID(),
      consent.rows[0].id
    );
    expect(revoked.statusCode, revoked.body).toBe(200);

    const blocked = await confirmGoalFor(
      f,
      saved.json().caseVersion,
      saved.json().goalId,
      saved.json().goalVersion,
      'goal-confirm-consent-blocked-' + crypto.randomUUID()
    );
    expect(blocked.statusCode, blocked.body).toBe(409);
    expect(blocked.json().code).toBe('CONSENT_BLOCKED');

    const kase = await app.inject({
      method: 'GET',
      url: '/api/v1/cases/' + f.caseId,
      headers: auth(f.manager.token),
    });
    expect(kase.json().phase).toBe('GOALS');
    const goal = await admin.query(
      'SELECT confirmation_state FROM goals WHERE case_id=$1 AND lifecycle_status=\'ACTIVE\'',
      [f.caseId]
    );
    expect(goal.rows[0].confirmation_state).toBe('UNCONFIRMED');
  });

});
