import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import pg from 'pg';
import { buildApp } from '../../apps/server/api/src/app.js';
import { createAdminPool } from '../setup/db.js';
import {
  auth,
  commandHeaders,
  createFamily,
  loginWithLabel,
  type LoginResult,
} from '../setup/api.js';
import { createCase } from '../setup/participation.js';

interface Fixture {
  manager: LoginResult;
  familyId: string;
  caseId: string;
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
    await admin.end();
    await app.close();
    fetchSpy.mockRestore();
  });

  async function fixture(label: string): Promise<Fixture> {
    const manager = await loginWithLabel(app, `du-canonical-${label}`);
    const family = await createFamily(app, manager.token, `du-canonical-${label}`);
    expect(family.statusCode, family.body).toBe(201);
    const familyId = family.json().id as string;

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
      payload: { expectedCaseVersion: initialVersion },
    });
    expect(start.statusCode, start.body).toBe(200);
    const scene = track(start.json());
    expectCurrent(scene, 'A1001');
    return { manager, familyId, caseId, scene };
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
    let scene = await enterA2004(f);
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
    key: string
  ) {
    return app.inject({
      method: 'POST',
      url: '/api/v1/cases/' + f.caseId + '/goals',
      headers: {
        ...auth(f.manager.token),
        'idempotency-key': key,
        'if-match': '"case-v' + caseVersion + '"',
      },
      payload: goalSavePayload(formulation),
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

  it('continues the canonical flow through SAVE and atomic ConfirmGoal to PLANNING', async () => {
    const f = await fixture('goal-happy');
    const scene = await finishA2010ForGoal(f);
    const formulation = await currentGoalFormulation(f);

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

    const afterSave = await app.inject({
      method: 'GET',
      url: '/api/v1/cases/' + f.caseId,
      headers: auth(f.manager.token),
    });
    expect(afterSave.json().phase).toBe('GOALS');

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
    scene = await confirmCurrentFormulation(f, scene);
    expect(scene.currentNode?.nodeCode).toBe('A2003');
    const formulation = await currentGoalFormulation(f);

    const saved = await saveGoalFor(
      f,
      scene.caseVersion,
      formulation,
      'goal-save-incomplete-' + crypto.randomUUID()
    );
    expect(saved.statusCode, saved.body).toBe(201);

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
      saved.json().caseVersion,
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
    await admin.query(
      "UPDATE cases SET status='SAFETY_HOLD' WHERE id=$1",
      [safety.caseId]
    );
    let result = await confirmGoalFor(
      safety,
      saved.json().caseVersion,
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

});
