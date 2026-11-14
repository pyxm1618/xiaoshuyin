import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import pg from 'pg';
import { buildApp } from '../../apps/server/api/src/app.js';
import { withRlsTransaction } from '../../apps/server/api/src/db/tx.js';
import { recordStatement } from '@xiaoshuyin/domain';
import { resolveDigitalUseRuntimeNode } from '@xiaoshuyin/scenes/digital-use';
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
  caseVersion: number;
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
        WHERE feature_code='DIGITAL_USE_FAMILY_ALLIANCE_RUNTIME'
          AND feature_contract_revision='v1'`
    ).catch(() => undefined);
    await admin.query(
      `DELETE FROM compliance_feature_policies
        WHERE feature_code='DIGITAL_USE_FAMILY_ALLIANCE_RUNTIME'
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
          subjectPersonId: f.manager.personId,
          sourceKind: 'SELF_STATEMENT',
          sourcePersonId: f.manager.personId,
          occurredTimeState: 'UNKNOWN',
          confirmationStatus: 'UNCONFIRMED',
          content: `DUA:v1:01002.emotion:${JSON.stringify({
            state: 'KNOWN',
            selections: emotion,
          })}`,
        });
        await recordStatement(tx, context, {
          subjectPersonId: f.manager.personId,
          sourceKind: 'SELF_STATEMENT',
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

    const kase = await createCase(app, manager.token, `fa-${label}`);
    expect(kase.statusCode, kase.body).toBe(201);
    const caseId = kase.json().id as string;
    const caseVersion = kase.json().version as number;

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

    const f = { manager, familyId, caseId, caseVersion };
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
        {
          expectedSelectionRevision: target.selectionRevision,
          expectedTargetRevision: target.revision,
        }
      );
      expect(feasibilityResponse.statusCode, `${family.nodes[1]} ${feasibilityResponse.body}`).toBe(200);
      body = feasibilityResponse.json();
      target = body.targets.find((item: any) => item.targetCode === family.code);
      expect(target.feasibility).not.toHaveProperty('score');
      expect(target.feasibility).not.toHaveProperty('cutoff');

      const progressResponse = await respond(
        f,
        family.nodes[2],
        {
          kind: 'PROGRESS',
          progress: {
            stage: 'EXECUTION',
            state: 'KNOWN',
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
      expect(target.progressEvidenceRefs).toHaveLength(1);
      if (family.code === 'SLEEP') {
        // AS-19: one target may have progress while the others remain
        // independently reachable; no false stream-global completion exists.
        expect(body.nodes.find((item: any) => item.nodeCode === 'A3022')?.status)
          .toBe('AVAILABLE');
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
    }

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

    const progress = await respond(
      f,
      'A3012',
      {
        kind: 'PROGRESS',
        progress: { stage: 'EXECUTION', state: 'KNOWN', modifyTarget: 'NO' },
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
    const request = () => app.inject({
      method: 'POST',
      url: `/api/v1/cases/${f.caseId}/scene/nodes/A3002/responses`,
      headers: { ...auth(f.manager.token), 'idempotency-key': key },
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
    const body = selection.json();
    const target = body.targets.find((item: any) => item.targetCode === 'SLEEP');
    const node = body.nodes.find((item: any) => item.nodeCode === 'A3011');

    const make = (text: string) => app.inject({
      method: 'POST',
      url: \`/api/v1/cases/\${f.caseId}/scene/nodes/A3011/responses\`,
      headers: {
        ...auth(f.manager.token),
        'idempotency-key': \`fa-target-race-\${crypto.randomUUID()}\`,
      },
      payload: {
        expectedCaseVersion: f.caseVersion,
        expectedNodeRevision: node.revision,
        expectedScenePackageVersion: 'v1',
        expectedSelectionRevision: target.selectionRevision,
        expectedTargetRevision: target.revision,
        response: {
          kind: 'FEASIBILITY',
          feasibility: {
            concreteQuantified: { state: 'KNOWN', concreteTargetText: text },
            need: { state: 'KNOWN', rating: 8 },
            motivationBenefit: { state: 'KNOWN', rating: 7 },
            abilityPossibility: { state: 'KNOWN', rating: 6 },
            challengeResistance: { state: 'UNKNOWN' },
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
      n: number;
      texts: string[];
    }>(
      \`SELECT count(*)::int AS n,
              array_agg(concrete_target_text ORDER BY revision) FILTER
                (WHERE superseded_at IS NULL) AS texts
         FROM digital_use_target_items
        WHERE case_id=$1 AND target_code='SLEEP'\`,
      [f.caseId]
    );
    expect(current.rows[0]!.n).toBe(2);
    expect(current.rows[0]!.texts).toHaveLength(1);
  });

  it('AS-26 Safety race wins before Family Alliance commit', async () => {
    const f = await fixture('safety-race');
    const blocker = new pg.Client({ connectionString: process.env['TEST_ADMIN_DATABASE_URL']! });
    await blocker.connect();
    try {
      await blocker.query('BEGIN');
      await blocker.query(
        \`UPDATE cases SET status='SAFETY_HOLD' WHERE id=$1\`,
        [f.caseId]
      );
      const request = app.inject({
        method: 'POST',
        url: \`/api/v1/cases/\${f.caseId}/scene/nodes/A3000/responses\`,
        headers: {
          ...auth(f.manager.token),
          'idempotency-key': \`fa-safety-race-\${crypto.randomUUID()}\`,
        },
        payload: {
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
      \`SELECT
        (SELECT count(*)::int FROM assertions
          WHERE case_id=$1 AND content LIKE 'DUFA:v1:%') AS evidence,
        (SELECT count(*)::int FROM scene_artifacts
          WHERE case_id=$1 AND artifact_type='FAMILY_ALLIANCE_SELF_ASSESSMENT') AS artifacts\`,
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
        \`UPDATE cases SET is_primary=false, version=version+1 WHERE id=$1\`,
        [f.caseId]
      );
      const request = app.inject({
        method: 'POST',
        url: \`/api/v1/cases/\${f.caseId}/scene/nodes/A3000/responses\`,
        headers: {
          ...auth(f.manager.token),
          'idempotency-key': \`fa-primary-race-\${crypto.randomUUID()}\`,
        },
        payload: {
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
      \`SELECT count(*)::int AS n FROM assertions
        WHERE case_id=$1 AND content LIKE 'DUFA:v1:%'\`,
      [f.caseId]
    );
    expect(residue.rows[0]!.n).toBe(0);
  });

  it('AS-27/28 Compliance publication race and UNKNOWN policy fail closed', async () => {
    const f = await fixture('compliance-race');
    const publisher = new pg.Client({
      connectionString: process.env['MIGRATION_DATABASE_URL']!,
    });
    await publisher.connect();
    try {
      await publisher.query('BEGIN');
      await publisher.query(
        \`SELECT app.publish_compliance_feature_policy(
           'DIGITAL_USE_FAMILY_ALLIANCE_RUNTIME','v1',1,2,
           'UNKNOWN','BASELINE','BASELINE','BASELINE','BASELINE',
           NULL,NULL,clock_timestamp() - interval '1 second',
           'migration:slice13-compliance-race'
         )\`
      );

      const request = app.inject({
        method: 'POST',
        url: \`/api/v1/cases/\${f.caseId}/scene/nodes/A3000/responses\`,
        headers: {
          ...auth(f.manager.token),
          'idempotency-key': \`fa-compliance-race-\${crypto.randomUUID()}\`,
        },
        payload: {
          expectedCaseVersion: f.caseVersion,
          expectedNodeRevision: 0,
          expectedScenePackageVersion: 'v1',
          response: selfAssessment(),
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 40));
      await publisher.query('COMMIT');
      const blocked = await request;
      expect(blocked.statusCode, blocked.body).toBe(409);
      expect(blocked.json().code).toBe('COMPLIANCE_BLOCKED');

      await publisher.query(
        \`SELECT app.publish_compliance_feature_policy(
           'DIGITAL_USE_FAMILY_ALLIANCE_RUNTIME','v1',2,3,
           'NOT_APPLICABLE','BASELINE','BASELINE','BASELINE','BASELINE',
           'Slice 13 restored reviewed basis','evidence://slice13/restored',
           clock_timestamp(),'migration:slice13-compliance-restore'
         )\`
      );
    } finally {
      await publisher.query('ROLLBACK').catch(() => undefined);
      await publisher.end();
    }

    const residue = await admin.query<{ n: number }>(
      \`SELECT count(*)::int AS n FROM assertions
        WHERE case_id=$1 AND content LIKE 'DUFA:v1:%'\`,
      [f.caseId]
    );
    expect(residue.rows[0]!.n).toBe(0);
  });

  async function installFaultTrigger(
    table: string,
    operation: 'INSERT' | 'UPDATE',
    predicate: string,
    token: string,
    deferred = false
  ): Promise<() => Promise<void>> {
    const safe = token.replace(/[^a-zA-Z0-9_]/g, '_');
    const functionName = \`slice13_fault_fn_\${safe}\`;
    const triggerName = \`slice13_fault_tr_\${safe}\`;
    await admin.query(
      \`CREATE FUNCTION \${functionName}() RETURNS trigger
         LANGUAGE plpgsql AS $$
       BEGIN
         RAISE EXCEPTION 'SLICE13_FAULT_\${safe}';
       END $$\`
    );
    const prefix = deferred
      ? 'CREATE CONSTRAINT TRIGGER'
      : 'CREATE TRIGGER';
    const timing = deferred
      ? \`AFTER \${operation} ON \${table}
         DEFERRABLE INITIALLY DEFERRED\`
      : \`BEFORE \${operation} ON \${table}\`;
    await admin.query(
      \`\${prefix} \${triggerName}
         \${timing}
         FOR EACH ROW
         WHEN (\${predicate})
         EXECUTE FUNCTION \${functionName}()\`
    );
    return async () => {
      await admin.query(\`DROP TRIGGER IF EXISTS \${triggerName} ON \${table}\`);
      await admin.query(\`DROP FUNCTION IF EXISTS \${functionName}()\`);
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
      \`SELECT
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
            AND idempotency_key=$4) AS idempotency\`,
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
        predicate: \`NEW.artifact_type = 'FAMILY_ALLIANCE_SELF_ASSESSMENT'\`,
        deferred: false,
      },
      {
        name: 'after-artifact',
        table: 'scene_node_states',
        operation: 'UPDATE' as const,
        predicate: \`NEW.node_code = 'A3000' AND NEW.status = 'COMPLETED'\`,
        deferred: false,
      },
      {
        name: 'after-scene-before-event',
        table: 'case_events',
        operation: 'INSERT' as const,
        predicate: \`NEW.event_type = 'CASE_DIGITAL_USE_NODE_COMPLETED'\`,
        deferred: false,
      },
      {
        name: 'before-audit',
        table: 'business_audit_events',
        operation: 'INSERT' as const,
        predicate: \`NEW.event_type = 'DIGITAL_USE_NODE_COMPLETED'\`,
        deferred: false,
      },
      {
        name: 'before-idempotency-success',
        table: 'idempotency_keys',
        operation: 'INSERT' as const,
        predicate: \`NEW.command_type = 'DIGITAL_USE_NODE_RESPONSE'\`,
        deferred: false,
      },
      {
        name: 'before-commit-deferred',
        table: 'idempotency_keys',
        operation: 'INSERT' as const,
        predicate: \`NEW.command_type = 'DIGITAL_USE_NODE_RESPONSE'\`,
        deferred: true,
      },
    ];

    for (const stage of stages) {
      const f = await fixture(\`fault-\${stage.name}\`);
      const key = \`fa-fault-\${stage.name}-\${crypto.randomUUID()}\`;
      const scopePredicate =
        stage.table === 'scene_artifacts' ||
        stage.table === 'scene_node_states' ||
        stage.table === 'case_events'
          ? \`(\${stage.predicate}) AND NEW.case_id = '\${f.caseId}'::uuid\`
          : stage.table === 'business_audit_events'
            ? \`(\${stage.predicate}) AND NEW.family_id = '\${f.familyId}'::uuid
               AND NEW.resource_id = '\${f.caseId}'::uuid\`
            : \`(\${stage.predicate}) AND NEW.actor_account_id = '\${f.manager.accountId}'::uuid
               AND NEW.idempotency_key = '\${key}'\`;
      const drop = await installFaultTrigger(
        stage.table,
        stage.operation,
        scopePredicate,
        \`\${stage.name}_\${f.caseId.replaceAll('-', '_')}\`,
        stage.deferred
      );
      try {
        const failed = await app.inject({
          method: 'POST',
          url: \`/api/v1/cases/\${f.caseId}/scene/nodes/A3000/responses\`,
          headers: { ...auth(f.manager.token), 'idempotency-key': key },
          payload: {
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
    const key = \`fa-fault-after-target-\${crypto.randomUUID()}\`;
    const safeCase = f.caseId.replaceAll('-', '_');
    const drop = await installFaultTrigger(
      'scene_node_states',
      'UPDATE',
      \`NEW.case_id = '\${f.caseId}'::uuid AND NEW.node_code = 'A3002'
        AND NEW.status = 'COMPLETED'\`,
      \`after_target_\${safeCase}\`,
      false
    );
    try {
      const failed = await app.inject({
        method: 'POST',
        url: \`/api/v1/cases/\${f.caseId}/scene/nodes/A3002/responses\`,
        headers: { ...auth(f.manager.token), 'idempotency-key': key },
        payload: {
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
      \`SELECT
        (SELECT count(*)::int FROM digital_use_target_items WHERE case_id=$1) AS targets,
        (SELECT count(*)::int FROM idempotency_keys
          WHERE actor_account_id=$2 AND command_type='DIGITAL_USE_NODE_RESPONSE'
            AND idempotency_key=$3) AS idempotency\`,
      [f.caseId, f.manager.accountId, key]
    );
    expect(targetResidue.rows[0]).toEqual({ targets: 0, idempotency: 0 });
  });


  it('AS-20..AS-24 authorization, isolation and source fidelity fail closed', async () => {
    const f = await fixture('auth-isolation');

    const unauthenticated = await app.inject({
      method: 'POST',
      url: \`/api/v1/cases/\${f.caseId}/scene/nodes/A3000/responses\`,
      headers: { 'idempotency-key': \`fa-unauth-\${crypto.randomUUID()}\` },
      payload: {
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
      url: \`/api/v1/cases/\${f.caseId}/scene/nodes/A3000/responses\`,
      headers: {
        ...auth(outsider.token),
        'idempotency-key': \`fa-cross-\${crypto.randomUUID()}\`,
      },
      payload: {
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
      \`INSERT INTO family_members (family_id,person_id)
       VALUES ($1,$2) ON CONFLICT DO NOTHING\`,
      [f.familyId, participant.personId]
    );
    const tokenHash =
      crypto.randomUUID().replaceAll('-', '').padEnd(64, '0');
    await admin.query(
      \`INSERT INTO case_participants
         (family_id,case_id,person_id,state,invite_token_hash,invite_expires_at,
          created_by_person_id,accepted_at)
       VALUES ($1,$2,$3,'ACTIVE',$4,now()+interval '1 day',$5,now())\`,
      [f.familyId, f.caseId, participant.personId, tokenHash, f.manager.personId]
    );
    const participantAttempt = await app.inject({
      method: 'POST',
      url: \`/api/v1/cases/\${f.caseId}/scene/nodes/A3000/responses\`,
      headers: {
        ...auth(participant.token),
        'idempotency-key': \`fa-participant-\${crypto.randomUUID()}\`,
      },
      payload: {
        expectedCaseVersion: f.caseVersion,
        expectedNodeRevision: 0,
        expectedScenePackageVersion: 'v1',
        response: selfAssessment(),
      },
    });
    expect(participantAttempt.statusCode).toBe(403);

    // Wrong-Case/Evidence/target references and child-source attribution are
    // not request capabilities at all: the strict node payload rejects them.
    const forgedRefs = await app.inject({
      method: 'POST',
      url: \`/api/v1/cases/\${f.caseId}/scene/nodes/A3000/responses\`,
      headers: {
        ...auth(f.manager.token),
        'idempotency-key': \`fa-forged-ref-\${crypto.randomUUID()}\`,
      },
      payload: {
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
      url: \`/api/v1/cases/\${f.caseId}/scene/nodes/A3000/responses\`,
      headers: {
        ...auth(f.manager.token),
        'idempotency-key': \`fa-forged-subject-\${crypto.randomUUID()}\`,
      },
      payload: {
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
      \`SELECT count(*)::int AS n FROM assertions
        WHERE case_id=$1 AND content LIKE 'DUFA:v1:%'\`,
      [f.caseId]
    );
    expect(residue.rows[0]!.n).toBe(0);
  });

});
