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

  async function enterA2004(f: Fixture) {
    let scene = await triage(f, true, 'A', 'A');
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

    // Positive direct impact -> A2003 -> marker -> A2004 yes -> A2005 willing
    // -> A2007 timeline -> A2010 summary. A3000 remains a gated route intent here.
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
      routeIntent: 'A3000',
      available: false,
      reasonCode: 'ENTRY_GATES_REVALIDATION_REQUIRED',
    });
    expect(scene.nodes.some((node: any) => node.nodeCode === 'A3000')).toBe(false);
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
    expect(visitedNodes).not.toContain('A3000');
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
});
