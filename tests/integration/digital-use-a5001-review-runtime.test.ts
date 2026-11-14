import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import pg from 'pg';
import { buildApp } from '../../apps/server/api/src/app.js';
import { withRlsTransaction } from '../../apps/server/api/src/db/tx.js';
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
  loginWithLabel,
  revokeConsent,
  type LoginResult,
} from '../setup/api.js';
import { createCase } from '../setup/participation.js';

interface Fixture {
  manager: LoginResult;
  familyId: string;
  caseId: string;
  caseVersion: number;
}

const FAMILY_FEATURE = 'DIGITAL_USE_FAMILY_ALLIANCE_RUNTIME';

describe('Slice 15 A5001 FAMILY_ALLIANCE_REVIEW runtime', () => {
  let app: FastifyInstance;
  let admin: pg.Pool;
  let appDb: pg.Pool;
  let migrator: pg.Client;

  async function ensureBaselinePolicy(featureCode: string): Promise<void> {
    const current = await migrator.query<{ n: number }>(
      `SELECT count(*)::int AS n
         FROM compliance_feature_policies
        WHERE feature_code=$1
          AND feature_contract_revision='v1'
          AND superseded_by_policy_id IS NULL`,
      [featureCode]
    );
    if ((current.rows[0]?.n ?? 0) > 0) return;

    await migrator.query(
      `SELECT app.publish_compliance_feature_policy(
         $1,'v1',NULL,1,
         'NOT_APPLICABLE','BASELINE','BASELINE','BASELINE','BASELINE',
         $2,$3,now() - interval '1 minute',$4
       )`,
      [
        featureCode,
        `Slice 15 A5001 integration baseline for ${featureCode}`,
        `evidence://slice15/a5001/${featureCode}`,
        `migration:slice15-a5001-${featureCode}`,
      ]
    );
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
    await ensureBaselinePolicy(FAMILY_FEATURE);
  });

  afterAll(async () => {
    await appDb.end().catch(() => undefined);
    await migrator.end().catch(() => undefined);
    await admin.end().catch(() => undefined);
    await app.close();
  });

  async function seedAssessmentEvidence(f: Fixture): Promise<void> {
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
            selections: ['A'],
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
            selection: 'A',
          })}`,
        });
      }
    );
  }

  async function fixture(label: string): Promise<Fixture> {
    const manager = await loginWithLabel(app, `a5001-${label}`);
    const family = await createFamily(app, manager.token, `a5001-${label}`);
    expect(family.statusCode, family.body).toBe(201);
    const familyId = family.json().id as string;

    const kase = await createCase(app, manager.token, `a5001-${label}`);
    expect(kase.statusCode, kase.body).toBe(201);
    const caseId = kase.json().id as string;
    const caseVersion = kase.json().version as number;

    const message = await app.inject({
      method: 'POST',
      url: `/api/v1/cases/${caseId}/messages`,
      headers: commandHeaders(manager.token, `a5001-msg-${label}`),
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
      for (const node of [a1001, a2010]) {
        await admin.query(
          `INSERT INTO scene_node_states
             (family_id,case_id,scene_package_version,node_code,source_node_code,
              status,branch_reason_codes,input_refs,output_refs,revision,completed_at)
           VALUES ($1,$2,'v1',$3,$4,'COMPLETED',ARRAY['SLICE15_FIXTURE'],
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

  async function getScene(f: Fixture, token = f.manager.token) {
    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/cases/${f.caseId}/scene`,
      headers: auth(token),
    });
    expect(response.statusCode, response.body).toBe(200);
    return response.json();
  }

  async function respond(
    f: Fixture,
    nodeCode: string,
    response: Record<string, unknown>,
    extra: Record<string, unknown> = {},
    key = `a5001-${nodeCode.toLowerCase()}-${crypto.randomUUID()}`
  ) {
    const scene = await getScene(f);
    const node = scene.nodes.find((item: any) => item.nodeCode === nodeCode);
    return app.inject({
      method: 'POST',
      url: `/api/v1/cases/${f.caseId}/scene/nodes/${nodeCode}/responses`,
      headers: { ...auth(f.manager.token), 'idempotency-key': key },
      payload: {
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
    label: string,
    options: { partialTarget?: boolean } = {}
  ): Promise<{ f: Fixture; scene: any }> {
    const f = await fixture(label);
    const a3000 = await respond(f, 'A3000', selfAssessment());
    expect(a3000.statusCode, a3000.body).toBe(200);

    const selection = await respond(
      f,
      'A3002',
      {
        kind: 'TARGET_SELECTION',
        confirmed: true,
        selectedTargets: ['SLEEP', 'EXERCISE'],
      },
      { expectedSelectionRevision: 0 }
    );
    expect(selection.statusCode, selection.body).toBe(200);

    if (options.partialTarget) {
      let scene = selection.json();
      const sleep = scene.targets.find((item: any) => item.targetCode === 'SLEEP');
      const definition = await respond(
        f,
        'A3010',
        {
          kind: 'TARGET_DEFINITION',
          concreteTargetText: 'Try a consistent sleep target on selected evenings.',
        },
        {
          expectedSelectionRevision: sleep.selectionRevision,
          expectedTargetRevision: sleep.revision,
        }
      );
      expect(definition.statusCode, definition.body).toBe(200);
    }

    // Intentionally do not complete A3001. Frozen authority says A3001 is
    // source material "where present", not an A5001 entry prerequisite.
    return { f, scene: await getScene(f) };
  }

  function unresolved(state: 'UNKNOWN' | 'DECLINED' | 'NOT_COLLECTED') {
    return { state };
  }

  function reviewPayload(scene: any, suffix = 'v1') {
    const selected = scene.targets.filter((target: any) => target.selected);
    return {
      kind: 'FAMILY_ALLIANCE_REVIEW',
      familyDimensions: {
        emotionalSupport: { state: 'KNOWN', note: `Support improved ${suffix}` },
        childVoiceNegotiation: unresolved('UNKNOWN'),
        trust: unresolved('DECLINED'),
        coordination: unresolved('NOT_COLLECTED'),
        parentStability: { state: 'KNOWN', note: `Parent steadiness ${suffix}` },
        parentPromiseConsistency: unresolved('UNKNOWN'),
      },
      targetEvaluations: selected.map((target: any) => ({
        targetCode: target.targetCode,
        expectedTargetRevision: target.revision,
        dimensions: {
          attempted: {
            state: 'KNOWN',
            note: `${target.targetCode} had a bounded attempt ${suffix}`,
          },
          partialOrNotAttempted: unresolved('UNKNOWN'),
          barriers: unresolved('DECLINED'),
          help: unresolved('NOT_COLLECTED'),
          change: {
            state: 'KNOWN',
            note: `${target.targetCode} observed change ${suffix}`,
          },
          adverseChange: unresolved('UNKNOWN'),
          uncertainty: unresolved('NOT_COLLECTED'),
        },
      })),
      evidenceRefs: [],
    };
  }

  function a5001Request(
    f: Fixture,
    scene: any,
    key: string,
    response = reviewPayload(scene),
    overrides: Record<string, unknown> = {},
    token = f.manager.token
  ) {
    const node = scene.nodes.find((item: any) => item.nodeCode === 'A5001');
    return app.inject({
      method: 'POST',
      url: `/api/v1/cases/${f.caseId}/scene/nodes/A5001/responses`,
      headers: { ...auth(token), 'idempotency-key': key },
      payload: {
        expectedCaseVersion: f.caseVersion,
        expectedNodeRevision: node?.revision ?? 0,
        expectedScenePackageVersion: 'v1',
        expectedSelectionRevision: scene.targetSelectionRevision,
        response,
        ...overrides,
      },
    });
  }

  async function a5001Counts(f: Fixture) {
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
          WHERE case_id=$1 AND content LIKE 'DUA5001:v1:%') AS evidence,
        (SELECT count(*)::int FROM scene_artifacts
          WHERE case_id=$1
            AND artifact_type='DIGITAL_USE_A5001_EFFECT_EVALUATION') AS artifacts,
        (SELECT count(*)::int FROM scene_node_states
          WHERE case_id=$1 AND node_code='A5001') AS scene,
        (SELECT count(*)::int FROM case_events
          WHERE case_id=$1
            AND event_type='CASE_DIGITAL_USE_NODE_COMPLETED'
            AND metadata->>'nodeCode'='A5001') AS events,
        (SELECT count(*)::int FROM business_audit_events
          WHERE family_id=$2
            AND event_type='DIGITAL_USE_NODE_COMPLETED'
            AND resource_id=$1
            AND metadata->>'nodeCode'='A5001') AS audits,
        (SELECT count(*)::int FROM idempotency_keys
          WHERE actor_account_id=$3
            AND command_type='DIGITAL_USE_NODE_RESPONSE') AS idempotency`,
      [f.caseId, f.familyId, f.manager.accountId]
    );
    return rows[0]!;
  }

  it('AS-01/03/05/09/16-23/51 completes legal USER_INITIATED A5001 on a partially executed target list', async () => {
    const { f, scene } = await prepareA5001('legal-partial', {
      partialTarget: true,
    });
    const before = await a5001Counts(f);
    expect(before.scene).toBe(0);
    expect(scene.nodes.find((item: any) => item.nodeCode === 'A5001')).toBeUndefined();
    expect(
      scene.reachableNodes.find((item: any) => item.nodeCode === 'A5001')
    ).toMatchObject({
      nodeCode: 'A5001',
      entryModes: expect.arrayContaining(['USER_INITIATED', 'SCHEDULED']),
      reasonCode: 'USER_INITIATED_AVAILABLE',
    });

    const result = await a5001Request(
      f,
      scene,
      `a5001-legal-${crypto.randomUUID()}`
    );
    expect(result.statusCode, result.body).toBe(200);
    const body = result.json();

    const node = body.nodes.find((item: any) => item.nodeCode === 'A5001');
    expect(node).toMatchObject({ status: 'COMPLETED' });
    expect(node.branchReasonCodes.at(-1)).toBe('FAMILY_ALLIANCE_REVIEW_COMPLETE');

    const artifact = body.artifacts.find(
      (item: any) => item.type === 'DIGITAL_USE_A5001_EFFECT_EVALUATION'
    );
    expect(artifact).toMatchObject({
      type: 'DIGITAL_USE_A5001_EFFECT_EVALUATION',
      schemaVersion: 'v1',
      sourceNodeCode: 'A5001',
      revision: 1,
    });
    expect(artifact.data).toMatchObject({
      nodeCode: 'A5001',
      stream: 'FAMILY_ALLIANCE_REVIEW',
      entryMode: 'USER_INITIATED',
      completion: 'REVIEW_COMPLETE',
      submittedBy: {
        accountId: f.manager.accountId,
        personId: f.manager.personId,
        provenance: 'AUTHENTICATED_ACTOR',
      },
      subject: {
        kind: 'FAMILY_ALLIANCE_TARGET_LIST',
        selectionRevision: scene.targetSelectionRevision,
      },
    });
    expect(artifact.data.subject.communicationPreparation).toMatchObject({
      status: 'AVAILABLE',
    });
    const sleepSubject = artifact.data.subject.targets.find(
      (target: any) => target.targetCode === 'SLEEP'
    );
    expect(sleepSubject).toMatchObject({
      concreteTargetText: 'Try a consistent sleep target on selected evenings.',
      targetRevision: expect.any(Number),
      selectionRevision: scene.targetSelectionRevision,
    });
    expect(sleepSubject).toHaveProperty('feasibility');
    expect(sleepSubject).toHaveProperty('progress');
    expect(sleepSubject).toHaveProperty('progressEvidenceRefs');
    expect(sleepSubject).toHaveProperty('helpHistoryRefs');
    expect(sleepSubject).toHaveProperty('sourceRefs');
    expect(artifact.data.subject.priorReviewArtifact).toBeNull();
    expect(artifact.data.evaluation.familyDimensions.childVoiceNegotiation)
      .toEqual({ state: 'UNKNOWN' });
    expect(artifact.data.evaluation.familyDimensions.trust)
      .toEqual({ state: 'DECLINED' });
    expect(artifact.data.evaluation.familyDimensions.coordination)
      .toEqual({ state: 'NOT_COLLECTED' });
    expect(artifact.data).not.toHaveProperty('score');

    // A5001 review is legal even though A3001 and most target-family nodes are
    // incomplete; it must not manufacture A5002 or Phase-4 business truth.
    expect(body.nodes.find((item: any) => item.nodeCode === 'A3001')?.status)
      .toBe('AVAILABLE');
    expect(body.nodes.find((item: any) => item.nodeCode === 'A5002')).toBeUndefined();
    expect(
      body.artifacts.some(
        (item: any) => item.type === 'DIGITAL_USE_A5002_EFFECT_EVALUATION'
      )
    ).toBe(false);

    const after = await a5001Counts(f);
    expect(after.artifacts).toBe(1);
    expect(after.scene).toBe(1);
    expect(after.events).toBe(1);
    expect(after.audits).toBe(1);
    expect(after.evidence).toBeGreaterThan(0);
    expect(after.idempotency).toBe(before.idempotency + 1);

    const forbidden = await admin.query<{
      reviews: string | null;
      outcomes: string | null;
      goals: string | null;
      tasks: string | null;
      checkins: string | null;
      notifications: string | null;
    }>(
      `SELECT
        to_regclass('public.reviews')::text AS reviews,
        to_regclass('public.outcomes')::text AS outcomes,
        to_regclass('public.goals')::text AS goals,
        to_regclass('public.tasks')::text AS tasks,
        to_regclass('public.checkins')::text AS checkins,
        to_regclass('public.notifications')::text AS notifications`
    );
    expect(forbidden.rows[0]).toEqual({
      reviews: null,
      outcomes: null,
      goals: null,
      tasks: null,
      checkins: null,
      notifications: null,
    });
  });

  it('RLS keeps the A5001 artifact invisible outside its Family context', async () => {
    const { f, scene } = await prepareA5001('rls-artifact');
    const result = await a5001Request(
      f,
      scene,
      `a5001-rls-${crypto.randomUUID()}`
    );
    expect(result.statusCode, result.body).toBe(200);
    const artifact = result.json().artifacts.find(
      (item: any) => item.type === 'DIGITAL_USE_A5001_EFFECT_EVALUATION'
    );
    expect(artifact?.id).toEqual(expect.any(String));

    const visible = await withRlsTransaction(
      appDb,
      {
        familyId: f.familyId,
        accountId: f.manager.accountId,
        personId: f.manager.personId,
        purpose: 'FAMILY_MANAGEMENT',
      },
      async (tx) => tx.query(
        'SELECT count(*)::int AS n FROM scene_artifacts WHERE id=$1',
        [artifact.id]
      )
    );
    expect(visible.rows[0]!.n).toBe(1);

    const outsider = await loginWithLabel(app, 'a5001-rls-outsider');
    const outsiderFamily = await createFamily(
      app,
      outsider.token,
      'a5001-rls-outsider'
    );
    expect(outsiderFamily.statusCode, outsiderFamily.body).toBe(201);
    const hidden = await withRlsTransaction(
      appDb,
      {
        familyId: outsiderFamily.json().id as string,
        accountId: outsider.accountId,
        personId: outsider.personId,
        purpose: 'FAMILY_MANAGEMENT',
      },
      async (tx) => tx.query(
        'SELECT count(*)::int AS n FROM scene_artifacts WHERE id=$1',
        [artifact.id]
      )
    );
    expect(hidden.rows[0]!.n).toBe(0);
  });

  it('AS-07/53-56 rejects Contract-review and fake scheduled authority with no review artifact', async () => {
    const { f, scene } = await prepareA5001('strict-boundary');

    const contractPayload = await a5001Request(
      f,
      scene,
      `a5001-contract-${crypto.randomUUID()}`,
      { kind: 'PHONE_USE_CONTRACT_REVIEW', contractVersionId: crypto.randomUUID() }
    );
    expect(contractPayload.statusCode).toBe(422);
    expect(contractPayload.json().code).toBe('SCENE_RESPONSE_INVALID');

    const scheduled = await a5001Request(
      f,
      scene,
      `a5001-scheduled-${crypto.randomUUID()}`,
      reviewPayload(scene),
      { entryMode: 'SCHEDULED' }
    );
    expect(scheduled.statusCode).toBe(503);
    expect(scheduled.json().code).toBe('DEPENDENCY_UNAVAILABLE');

    const counts = await a5001Counts(f);
    expect(counts.artifacts).toBe(0);
    expect(counts.scene).toBe(0);
    expect(counts.evidence).toBe(0);

    const scheduleTruth = await admin.query<{ schedules: string | null; notifications: string | null }>(
      `SELECT
        to_regclass('public.follow_up_schedules')::text AS schedules,
        to_regclass('public.notifications')::text AS notifications`
    );
    expect(scheduleTruth.rows[0]).toEqual({ schedules: null, notifications: null });
  });

  it('AS-11/13-15 denies wrong actor/participant and cross-Family Evidence without enumeration', async () => {
    const { f, scene } = await prepareA5001('authz');
    const outsider = await loginWithLabel(app, 'a5001-outsider');
    const outsiderFamily = await createFamily(app, outsider.token, 'a5001-outsider');
    expect(outsiderFamily.statusCode, outsiderFamily.body).toBe(201);

    const outsiderAttempt = await a5001Request(
      f,
      scene,
      `a5001-outsider-${crypto.randomUUID()}`,
      reviewPayload(scene),
      {},
      outsider.token
    );
    expect(outsiderAttempt.statusCode).toBe(404);
    expect(outsiderAttempt.json().code).toBe('CASE_NOT_FOUND');

    const participant = await loginWithLabel(app, 'a5001-participant');
    const participantOwnFamily = await createFamily(
      app,
      participant.token,
      'a5001-participant-own'
    );
    expect(participantOwnFamily.statusCode, participantOwnFamily.body).toBe(201);
    await admin.query(
      `INSERT INTO family_members (family_id,person_id)
       VALUES ($1,$2) ON CONFLICT DO NOTHING`,
      [f.familyId, participant.personId]
    );
    const tokenHash = crypto.randomUUID().replaceAll('-', '').padEnd(64, '0');
    await admin.query(
      `INSERT INTO case_participants
         (family_id,case_id,person_id,state,invite_token_hash,invite_expires_at,
          created_by_person_id,accepted_at)
       VALUES ($1,$2,$3,'ACTIVE',$4,now()+interval '1 day',$5,now())`,
      [f.familyId, f.caseId, participant.personId, tokenHash, f.manager.personId]
    );
    const participantAttempt = await a5001Request(
      f,
      scene,
      `a5001-participant-${crypto.randomUUID()}`,
      reviewPayload(scene),
      {},
      participant.token
    );
    expect(participantAttempt.statusCode).toBe(404);
    expect(participantAttempt.json().code).toBe('CASE_NOT_FOUND');

    const other = await fixture('cross-family-evidence');
    let crossFamilyAssertionId = '';
    await withRlsTransaction(
      appDb,
      {
        familyId: other.familyId,
        accountId: other.manager.accountId,
        personId: other.manager.personId,
        purpose: 'FAMILY_MANAGEMENT',
      },
      async (tx) => {
        const recorded = await recordStatement(
          tx,
          {
            familyId: other.familyId,
            caseId: other.caseId,
            actorAccountId: other.manager.accountId,
            actorPersonId: other.manager.personId,
            purpose: 'FAMILY_MANAGEMENT',
          },
          {
            subjectPersonId: other.manager.personId,
            sourceKind: 'SELF_STATEMENT',
            sourcePersonId: other.manager.personId,
            occurredTimeState: 'UNKNOWN',
            confirmationStatus: 'UNCONFIRMED',
            content: 'cross-family A5001 source must not bind',
          }
        );
        crossFamilyAssertionId = recorded.id;
      }
    );

    const forged = reviewPayload(scene);
    forged.evidenceRefs = [
      { type: 'ASSERTION', id: crossFamilyAssertionId },
    ] as any;
    const crossFamily = await a5001Request(
      f,
      scene,
      `a5001-cross-family-${crypto.randomUUID()}`,
      forged
    );
    expect(crossFamily.statusCode).toBe(422);
    expect(crossFamily.json().code).toBe('SCENE_RESPONSE_INVALID');

    const otherCase = await createCase(
      app,
      f.manager.token,
      `a5001-cross-case-${crypto.randomUUID()}`
    );
    expect(otherCase.statusCode, otherCase.body).toBe(201);
    const otherCaseId = otherCase.json().id as string;
    let crossCaseAssertionId = '';
    await withRlsTransaction(
      appDb,
      {
        familyId: f.familyId,
        accountId: f.manager.accountId,
        personId: f.manager.personId,
        purpose: 'FAMILY_MANAGEMENT',
      },
      async (tx) => {
        const recorded = await recordStatement(
          tx,
          {
            familyId: f.familyId,
            caseId: otherCaseId,
            actorAccountId: f.manager.accountId,
            actorPersonId: f.manager.personId,
            purpose: 'FAMILY_MANAGEMENT',
          },
          {
            subjectPersonId: f.manager.personId,
            sourceKind: 'SELF_STATEMENT',
            sourcePersonId: f.manager.personId,
            occurredTimeState: 'UNKNOWN',
            confirmationStatus: 'UNCONFIRMED',
            content: 'cross-case A5001 source must not bind',
          }
        );
        crossCaseAssertionId = recorded.id;
      }
    );
    const forgedCrossCase = reviewPayload(scene);
    forgedCrossCase.evidenceRefs = [
      { type: 'ASSERTION', id: crossCaseAssertionId },
    ] as any;
    const crossCase = await a5001Request(
      f,
      scene,
      `a5001-cross-case-${crypto.randomUUID()}`,
      forgedCrossCase
    );
    expect(crossCase.statusCode).toBe(422);
    expect(crossCase.json().code).toBe('SCENE_RESPONSE_INVALID');

    const counts = await a5001Counts(f);
    expect(counts.artifacts).toBe(0);
    expect(counts.evidence).toBe(0);
  });

  it('AS-37/38/42 uses server-bound subject fingerprint and existing idempotency owner', async () => {
    const { f, scene } = await prepareA5001('idempotency');
    const key = `a5001-idem-${crypto.randomUUID()}`;
    const payload = reviewPayload(scene, 'idem');
    const before = await a5001Counts(f);

    const first = await a5001Request(f, scene, key, payload);
    expect(first.statusCode, first.body).toBe(200);
    const replay = await a5001Request(f, scene, key, payload);
    expect(replay.statusCode, replay.body).toBe(200);
    expect(replay.json()).toEqual(first.json());

    const mismatch = await a5001Request(
      f,
      scene,
      key,
      reviewPayload(scene, 'different-payload')
    );
    expect(mismatch.statusCode).toBe(409);
    expect(mismatch.json().code).toBe('IDEMPOTENCY_PAYLOAD_MISMATCH');

    const after = await a5001Counts(f);
    expect(after.artifacts).toBe(1);
    expect(after.idempotency).toBe(before.idempotency + 1);

    const staleFixture = await prepareA5001('stale-subject');
    const staleSelection = await a5001Request(
      staleFixture.f,
      staleFixture.scene,
      `a5001-stale-selection-${crypto.randomUUID()}`,
      reviewPayload(staleFixture.scene),
      { expectedSelectionRevision: staleFixture.scene.targetSelectionRevision - 1 }
    );
    expect(staleSelection.statusCode).toBe(409);
    expect(staleSelection.json().code).toBe('STALE_SELECTION_REVISION');

    const staleTargetPayload = reviewPayload(staleFixture.scene);
    staleTargetPayload.targetEvaluations[0]!.expectedTargetRevision += 1;
    const staleTarget = await a5001Request(
      staleFixture.f,
      staleFixture.scene,
      `a5001-stale-target-${crypto.randomUUID()}`,
      staleTargetPayload
    );
    expect(staleTarget.statusCode).toBe(409);
    expect(staleTarget.json().code).toBe('STALE_TARGET_REVISION');
    expect((await a5001Counts(staleFixture.f)).artifacts).toBe(0);
  });

  it('AS-40 concurrent same-revision submissions produce one winner and one stale conflict', async () => {
    const { f, scene } = await prepareA5001('concurrency');
    const make = (suffix: string) =>
      a5001Request(
        f,
        scene,
        `a5001-race-${suffix}-${crypto.randomUUID()}`,
        reviewPayload(scene, suffix)
      );

    const results = await Promise.all([make('one'), make('two')]);
    expect(results.map((result) => result.statusCode).sort()).toEqual([200, 409]);
    const failed = results.find((result) => result.statusCode === 409)!;
    expect(failed.json().code).toBe('STALE_NODE_REVISION');

    const counts = await a5001Counts(f);
    expect(counts.artifacts).toBe(1);
    expect(counts.scene).toBe(1);
    expect(counts.events).toBe(1);
    expect(counts.audits).toBe(1);
  });

  it('A5001 primary-Case race fails stale progression with no business residue', async () => {
    const { f, scene } = await prepareA5001('primary-race');
    const before = await a5001Counts(f);
    const blocker = new pg.Client({
      connectionString: process.env['TEST_ADMIN_DATABASE_URL']!,
    });
    await blocker.connect();
    try {
      await blocker.query('BEGIN');
      await blocker.query(
        `UPDATE cases SET is_primary=false, version=version+1 WHERE id=$1`,
        [f.caseId]
      );
      const request = a5001Request(
        f,
        scene,
        `a5001-primary-race-${crypto.randomUUID()}`
      );
      await new Promise((resolve) => setTimeout(resolve, 40));
      await blocker.query('COMMIT');
      const blocked = await request;
      expect(blocked.statusCode, blocked.body).toBe(409);
      expect(['CASE_NOT_PRIMARY', 'STALE_CASE_VERSION']).toContain(
        blocked.json().code
      );
    } finally {
      await blocker.query('ROLLBACK').catch(() => undefined);
      await blocker.end();
    }
    const after = await a5001Counts(f);
    expect(after.evidence).toBe(0);
    expect(after.artifacts).toBe(0);
    expect(after.scene).toBe(0);
    expect(after.events).toBe(0);
    expect(after.audits).toBe(0);
    expect(after.idempotency).toBe(before.idempotency);
  });

  it('A5001 Scene-package replacement race fails closed with no business residue', async () => {
    const { f, scene } = await prepareA5001('package-race');
    const before = await a5001Counts(f);
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
         VALUES ($1,$2,'v2',$3,$4,'COMPLETED',ARRAY['A5001_PACKAGE_DRIFT'],
                 '[]'::jsonb,'[]'::jsonb,1,now())`,
        [f.familyId, f.caseId, a1001.nodeCode, a1001.sourceNodeCode]
      );

      const request = a5001Request(
        f,
        scene,
        `a5001-package-race-${crypto.randomUUID()}`
      );
      await new Promise((resolve) => setTimeout(resolve, 40));
      await blocker.query('COMMIT');
      const blocked = await request;
      expect(blocked.statusCode, blocked.body).toBe(409);
      expect(['SCENE_PACKAGE_MISMATCH', 'STALE_SCENE_PACKAGE']).toContain(
        blocked.json().code
      );
    } finally {
      await blocker.query('ROLLBACK').catch(() => undefined);
      await blocker.end();
    }
    const after = await a5001Counts(f);
    expect(after.evidence).toBe(0);
    expect(after.artifacts).toBe(0);
    expect(after.scene).toBe(0);
    expect(after.events).toBe(0);
    expect(after.audits).toBe(0);
    expect(after.idempotency).toBe(before.idempotency);
  });

  it('AS-32-36 rechecks Safety, Family Alliance Compliance and Consent independently', async () => {
    const safety = await prepareA5001('safety');
    await admin.query(`UPDATE cases SET status='SAFETY_HOLD' WHERE id=$1`, [
      safety.f.caseId,
    ]);
    const safetyBlocked = await a5001Request(
      safety.f,
      safety.scene,
      `a5001-safety-${crypto.randomUUID()}`
    );
    expect(safetyBlocked.statusCode).toBe(409);
    expect(safetyBlocked.json().code).toBe('SAFETY_HOLD_BLOCKED');
    expect((await a5001Counts(safety.f)).artifacts).toBe(0);

    const compliance = await prepareA5001('compliance');
    await admin.query(
      `DELETE FROM compliance_feature_policies
        WHERE feature_code=$1 AND feature_contract_revision='v1'`,
      [FAMILY_FEATURE]
    );
    try {
      const complianceBlocked = await a5001Request(
        compliance.f,
        compliance.scene,
        `a5001-compliance-${crypto.randomUUID()}`
      );
      expect(complianceBlocked.statusCode).toBe(409);
      expect(complianceBlocked.json().code).toBe('COMPLIANCE_BLOCKED');
      expect((await a5001Counts(compliance.f)).artifacts).toBe(0);
    } finally {
      await ensureBaselinePolicy(FAMILY_FEATURE);
    }

    const consent = await prepareA5001('consent');
    const child = await loginWithLabel(app, 'a5001-consent-child');
    await admin.query(
      `INSERT INTO family_members (family_id,person_id)
       VALUES ($1,$2) ON CONFLICT DO NOTHING`,
      [consent.f.familyId, child.personId]
    );

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
      [
        consent.f.familyId,
        consent.f.manager.personId,
        child.personId,
        noticeHash,
      ]
    );
    const evidence = buildConsentEvidence({
      channel: runtimeConsentChannel(),
      acceptedTextHash,
      clientIp: null,
      userAgent: null,
      pepper: 'slice15-a5001-consent-fixture',
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
        consent.f.familyId,
        consent.f.manager.personId,
        consent.f.manager.accountId,
        requestSeed.rows[0]!.id,
        child.personId,
        noticeHash,
        JSON.stringify(evidence),
      ]
    );
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
      [
        child.personId,
        consent.f.manager.personId,
        consentSeed.rows[0]!.id,
      ]
    );
    await admin.query(
      `UPDATE families SET created_by_person_id=$2 WHERE id=$1`,
      [consent.f.familyId, child.personId]
    );

    const revoked = await revokeConsent(
      app,
      consent.f.manager.token,
      `a5001-consent-revoke-${crypto.randomUUID()}`,
      consentSeed.rows[0]!.id,
      { reason: 'A5001 independent Consent gate test' }
    );
    expect(revoked.statusCode, revoked.body).toBe(200);

    const consentBlocked = await a5001Request(
      consent.f,
      consent.scene,
      `a5001-consent-${crypto.randomUUID()}`,
      reviewPayload(consent.scene),
      {},
      child.token
    );
    expect(consentBlocked.statusCode).toBe(409);
    expect(consentBlocked.json().code).toBe('CONSENT_BLOCKED');

    const consentArtifacts = await admin.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM scene_artifacts
        WHERE case_id=$1
          AND artifact_type='DIGITAL_USE_A5001_EFFECT_EVALUATION'`,
      [consent.f.caseId]
    );
    expect(consentArtifacts.rows[0]!.n).toBe(0);
  });

  async function installFaultTrigger(
    table: string,
    operation: 'INSERT' | 'UPDATE',
    predicate: string,
    token: string
  ): Promise<() => Promise<void>> {
    const safe = token.replace(/[^a-zA-Z0-9_]/g, '_');
    const functionName = `slice15_fault_fn_${safe}`;
    const triggerName = `slice15_fault_tr_${safe}`;
    await admin.query(
      `CREATE FUNCTION ${functionName}() RETURNS trigger
         LANGUAGE plpgsql AS $$
       BEGIN
         RAISE EXCEPTION 'SLICE15_FAULT_${safe}';
       END $$`
    );
    await admin.query(
      `CREATE TRIGGER ${triggerName}
         BEFORE ${operation} ON ${table}
         FOR EACH ROW
         WHEN (${predicate})
         EXECUTE FUNCTION ${functionName}()`
    );
    return async () => {
      await admin.query(`DROP TRIGGER IF EXISTS ${triggerName} ON ${table}`);
      await admin.query(`DROP FUNCTION IF EXISTS ${functionName}()`);
    };
  }

  it('AS-44/45 fault injection rolls Evidence/artifact/state/audit/idempotency back atomically', async () => {
    for (const stage of [
      'artifact',
      'state',
      'event',
      'audit',
      'idempotency',
    ] as const) {
      const { f, scene } = await prepareA5001(`fault-${stage}`);
      const key = `a5001-fault-${stage}-${crypto.randomUUID()}`;
      const before = await a5001Counts(f);

      const fault =
        stage === 'artifact'
          ? {
              table: 'scene_artifacts',
              operation: 'INSERT' as const,
              predicate: `NEW.case_id = '${f.caseId}'::uuid
                AND NEW.artifact_type = 'DIGITAL_USE_A5001_EFFECT_EVALUATION'`,
            }
          : stage === 'state'
            ? {
                table: 'scene_node_states',
                operation: 'UPDATE' as const,
                predicate: `NEW.case_id = '${f.caseId}'::uuid
                  AND NEW.node_code = 'A5001'`,
              }
            : stage === 'event'
              ? {
                  table: 'case_events',
                  operation: 'INSERT' as const,
                  predicate: `NEW.case_id = '${f.caseId}'::uuid
                    AND NEW.event_type = 'CASE_DIGITAL_USE_NODE_COMPLETED'`,
                }
              : stage === 'audit'
                ? {
                    table: 'business_audit_events',
                    operation: 'INSERT' as const,
                    predicate: `NEW.family_id = '${f.familyId}'::uuid
                      AND NEW.resource_id = '${f.caseId}'::uuid
                      AND NEW.event_type = 'DIGITAL_USE_NODE_COMPLETED'`,
                  }
                : {
                    table: 'idempotency_keys',
                    operation: 'INSERT' as const,
                    predicate: `NEW.actor_account_id = '${f.manager.accountId}'::uuid
                      AND NEW.command_type = 'DIGITAL_USE_NODE_RESPONSE'`,
                  };
      const drop = await installFaultTrigger(
        fault.table,
        fault.operation,
        fault.predicate,
        `${stage}_${f.caseId.replaceAll('-', '_')}`
      );
      try {
        const failed = await a5001Request(f, scene, key);
        expect(failed.statusCode).toBe(500);
      } finally {
        await drop();
      }
      const after = await a5001Counts(f);
      expect(after.evidence).toBe(0);
      expect(after.artifacts).toBe(0);
      expect(after.scene).toBe(0);
      expect(after.events).toBe(0);
      expect(after.audits).toBe(0);
      expect(after.idempotency).toBe(before.idempotency);
    }
  });

  it('AS-21/47/49/50 USER_TIMELINE_REVIEW appends/supersedes history and reruns gates', async () => {
    const { f, scene } = await prepareA5001('reentry-history');
    const first = await a5001Request(
      f,
      scene,
      `a5001-reentry-1-${crypto.randomUUID()}`,
      reviewPayload(scene, 'first')
    );
    expect(first.statusCode, first.body).toBe(200);

    const afterFirst = await getScene(f);
    const a5001 = afterFirst.nodes.find((item: any) => item.nodeCode === 'A5001');
    expect(a5001?.status).toBe('COMPLETED');
    expect(
      afterFirst.reachableNodes.some((item: any) => item.nodeCode === 'A5001')
    ).toBe(true);

    const second = await a5001Request(
      f,
      afterFirst,
      `a5001-reentry-2-${crypto.randomUUID()}`,
      reviewPayload(afterFirst, 'second')
    );
    expect(second.statusCode, second.body).toBe(200);

    const history = await admin.query<{
      id: string;
      revision: number;
      supersedes_id: string | null;
      data: any;
    }>(
      `SELECT id,revision,supersedes_id,data
         FROM scene_artifacts
        WHERE case_id=$1
          AND artifact_type='DIGITAL_USE_A5001_EFFECT_EVALUATION'
        ORDER BY revision`,
      [f.caseId]
    );
    expect(history.rows).toHaveLength(2);
    expect(history.rows[0]!.revision).toBe(1);
    expect(history.rows[0]!.supersedes_id).toBeNull();
    expect(history.rows[1]!.revision).toBe(2);
    expect(history.rows[1]!.supersedes_id).toBe(history.rows[0]!.id);
    expect(history.rows[1]!.data.subject.priorReviewArtifact).toEqual({
      artifactId: history.rows[0]!.id,
      revision: 1,
    });
    expect(history.rows[0]!.data.evaluation.familyDimensions.emotionalSupport.note)
      .toContain('first');
    expect(history.rows[1]!.data.evaluation.familyDimensions.emotionalSupport.note)
      .toContain('second');

    await admin.query(`UPDATE cases SET status='SAFETY_HOLD' WHERE id=$1`, [f.caseId]);
    const afterSecond = await getScene(f).catch(() => second.json());
    const blocked = await app.inject({
      method: 'POST',
      url: `/api/v1/cases/${f.caseId}/scene/nodes/A5001/responses`,
      headers: {
        ...auth(f.manager.token),
        'idempotency-key': `a5001-reentry-blocked-${crypto.randomUUID()}`,
      },
      payload: {
        expectedCaseVersion: f.caseVersion,
        expectedNodeRevision:
          afterSecond.nodes?.find((item: any) => item.nodeCode === 'A5001')?.revision ??
          second.json().nodes.find((item: any) => item.nodeCode === 'A5001').revision,
        expectedScenePackageVersion: 'v1',
        expectedSelectionRevision: afterFirst.targetSelectionRevision,
        response: reviewPayload(afterFirst, 'blocked'),
      },
    });
    expect(blocked.statusCode).toBe(409);
    expect(blocked.json().code).toBe('SAFETY_HOLD_BLOCKED');

    const finalHistory = await admin.query<{ n: number }>(
      `SELECT count(*)::int AS n
         FROM scene_artifacts
        WHERE case_id=$1
          AND artifact_type='DIGITAL_USE_A5001_EFFECT_EVALUATION'`,
      [f.caseId]
    );
    expect(finalHistory.rows[0]!.n).toBe(2);
  });
});
