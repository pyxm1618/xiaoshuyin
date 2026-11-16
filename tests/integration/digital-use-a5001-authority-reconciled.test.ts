import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import pg from 'pg';
import { buildApp } from '../../apps/server/api/src/app.js';
import { withRlsTransaction } from '../../apps/server/api/src/db/tx.js';
import { recordObservation, recordStatement, reviseDigitalUseTargetItem } from '@xiaoshuyin/domain';
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
import {
  TEST_A5001_PACKAGE,
  TestProfessionalReviewContentProvider,
  normalizedReviewResponse,
} from '../support/digital-use-review-professional-content.js';

interface Fixture {
  manager: LoginResult;
  familyId: string;
  caseId: string;
  caseVersion: number;
  scene: any;
}

const FAMILY_FEATURE = 'DIGITAL_USE_FAMILY_ALLIANCE_RUNTIME';

describe('Slice 15 authority-reconciled A5001 runtime', () => {
  let app: FastifyInstance;
  let productionApp: FastifyInstance;
  let admin: pg.Pool;
  let appDb: pg.Pool;
  let migrator: pg.Client;
  const professional = new TestProfessionalReviewContentProvider();

  async function ensurePolicy(): Promise<void> {
    await migrator.query(
      `SELECT pg_advisory_lock(hashtextextended($1,0))`,
      ['slice15-authority-reconciled-a5001-policy']
    );
    try {
      const current = await migrator.query<{ n: number }>(
        `SELECT count(*)::int AS n
           FROM compliance_feature_policies
          WHERE feature_code=$1
            AND feature_contract_revision='v1'
            AND superseded_by_policy_id IS NULL`,
        [FAMILY_FEATURE]
      );
      if ((current.rows[0]?.n ?? 0) === 0) {
        await migrator.query(
          `SELECT app.publish_compliance_feature_policy(
             $1,'v1',NULL,1,
             'NOT_APPLICABLE','BASELINE','BASELINE','BASELINE','BASELINE',
             'Slice 15 authority-reconciled A5001 integration basis',
             'evidence://slice15/authority-reconciled/a5001',
             now() - interval '1 minute',
             'migration:slice15-authority-reconciled-a5001'
           )`,
          [FAMILY_FEATURE]
        );
      }
    } finally {
      await migrator.query(
        `SELECT pg_advisory_unlock(hashtextextended($1,0))`,
        ['slice15-authority-reconciled-a5001-policy']
      );
    }
  }

  beforeAll(async () => {
    app = await buildApp({
      digitalUseReview: { professionalContent: professional },
    });
    await app.ready();
    productionApp = await buildApp();
    await productionApp.ready();
    admin = createAdminPool();
    appDb = new pg.Pool({ connectionString: process.env['DATABASE_URL']! });
    migrator = new pg.Client({
      connectionString: process.env['MIGRATION_DATABASE_URL'],
    });
    await migrator.connect();
    await ensurePolicy();
  });

  afterAll(async () => {
    await appDb.end().catch(() => undefined);
    await migrator.end().catch(() => undefined);
    await admin.end().catch(() => undefined);
    await productionApp.close().catch(() => undefined);
    await app.close().catch(() => undefined);
  });

  async function seedAssessmentEvidence(f: Omit<Fixture, 'scene'>): Promise<void> {
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

  async function sceneFor(
    f: Pick<Fixture, 'manager' | 'caseId'>,
    targetApp = app
  ): Promise<any> {
    const result = await targetApp.inject({
      method: 'GET',
      url: `/api/v1/cases/${f.caseId}/scene`,
      headers: auth(f.manager.token),
    });
    expect(result.statusCode, result.body).toBe(200);
    return result.json();
  }

  async function respond(
    f: Omit<Fixture, 'scene'>,
    nodeCode: string,
    response: Record<string, unknown>,
    extra: Record<string, unknown> = {}
  ) {
    const scene = await sceneFor(f);
    const node = scene.nodes.find((item: any) => item.nodeCode === nodeCode);
    return app.inject({
      method: 'POST',
      url: `/api/v1/cases/${f.caseId}/scene/nodes/${nodeCode}/responses`,
      headers: {
        ...auth(f.manager.token),
        'idempotency-key': `slice15-a5001-${nodeCode}-${crypto.randomUUID()}`,
      },
      payload: {
        expectedCaseVersion: f.caseVersion,
        expectedNodeRevision: node?.revision ?? 0,
        expectedScenePackageVersion: 'v1',
        response,
        ...extra,
      },
    });
  }

  async function fixture(label: string): Promise<Fixture> {
    professional.restore('FAMILY_ALLIANCE_REVIEW');
    const manager = await loginWithLabel(app, `slice15-a5001-${label}`);
    const family = await createFamily(app, manager.token, `slice15-a5001-${label}`);
    expect(family.statusCode, family.body).toBe(201);
    const familyId = family.json().id as string;

    const kase = await createCase(app, manager.token, `slice15-a5001-${label}`);
    expect(kase.statusCode, kase.body).toBe(201);
    const caseId = kase.json().id as string;
    const caseVersion = kase.json().version as number;

    const message = await app.inject({
      method: 'POST',
      url: `/api/v1/cases/${caseId}/messages`,
      headers: commandHeaders(manager.token, `slice15-a5001-msg-${label}`),
      payload: { content: 'Current digital use is causing a family problem.' },
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
           VALUES ($1,$2,'v1',$3,$4,'COMPLETED',ARRAY['SLICE15_AUTHORITY_RECONCILED_FIXTURE'],
                   '[]'::jsonb,'[]'::jsonb,1,now())`,
          [familyId, caseId, node.nodeCode, node.sourceNodeCode]
        );
      }
      await admin.query('COMMIT');
    } catch (error) {
      await admin.query('ROLLBACK');
      throw error;
    }

    const base = { manager, familyId, caseId, caseVersion };
    await seedAssessmentEvidence(base);

    const a3000 = await respond(base, 'A3000', {
      kind: 'SELF_ASSESSMENT',
      answers: {
        emotionAttention: 'YES',
        negotiatedAgreement: 'YES',
        trustsAgreement: 'YES',
        familyCoordination: 'YES',
        parentEmotionFluctuation: 'NO',
        keepsPromises: 'YES',
      },
    });
    expect(a3000.statusCode, a3000.body).toBe(200);

    const a3002 = await respond(
      base,
      'A3002',
      {
        kind: 'TARGET_SELECTION',
        confirmed: true,
        selectedTargets: ['SLEEP', 'EXERCISE'],
      },
      { expectedSelectionRevision: 0 }
    );
    expect(a3002.statusCode, a3002.body).toBe(200);

    return { ...base, scene: await sceneFor(base) };
  }

  function payload(f: Fixture, note = 'Synthetic exact-package review') {
    const selected = f.scene.targets
      .filter((target: any) => target.selected)
      .map((target: any) => ({
        targetId: target.id,
        targetCode: target.targetCode,
        targetRevision: target.revision,
      }));
    return {
      kind: 'FAMILY_ALLIANCE_REVIEW',
      subject: {
        selectionRevision: f.scene.targetSelectionRevision,
        selectedTargets: selected,
      },
      professionalPackage: TEST_A5001_PACKAGE,
      packageResponse: {
        ...normalizedReviewResponse,
        note,
      },
      evidenceRefs: [],
      provenance: [{
        kind: 'PARENT_AUTHORED_OBSERVATION',
        sourcePersonId: f.manager.personId,
      }],
    };
  }

  async function submit(
    f: Fixture,
    key: string,
    body = payload(f),
    targetApp = app,
    token = f.manager.token,
    overrides: Record<string, unknown> = {}
  ) {
    const live = await sceneFor(f, targetApp);
    const node = live.nodes.find((item: any) => item.nodeCode === 'A5001');
    return targetApp.inject({
      method: 'POST',
      url: `/api/v1/cases/${f.caseId}/scene/nodes/A5001/responses`,
      headers: { ...auth(token), 'idempotency-key': key },
      payload: {
        expectedCaseVersion: f.caseVersion,
        expectedNodeRevision: node?.revision ?? 0,
        expectedScenePackageVersion: 'v1',
        expectedSelectionRevision: f.scene.targetSelectionRevision,
        response: body,
        ...overrides,
      },
    });
  }

  async function counts(f: Fixture) {
    const { rows } = await admin.query(
      `SELECT
        (SELECT count(*)::int FROM scene_artifacts
          WHERE case_id=$1
            AND artifact_type='DIGITAL_USE_A5001_EFFECT_EVALUATION') AS artifacts,
        (SELECT count(*)::int FROM scene_node_states
          WHERE case_id=$1 AND node_code='A5001') AS nodes,
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
    return rows[0] as {
      artifacts: number;
      nodes: number;
      events: number;
      audits: number;
      idempotency: number;
    };
  }

  it('production default is fail-closed with zero professional truth', async () => {
    const f = await fixture('production-fail-closed');
    const before = await counts(f);
    const result = await submit(
      f,
      `slice15-a5001-prod-${crypto.randomUUID()}`,
      payload(f),
      productionApp
    );
    expect(result.statusCode, result.body).toBe(503);
    expect(result.json().code).toBe('DEPENDENCY_UNAVAILABLE');
    const after = await counts(f);
    expect(after).toEqual(before);
  });

  it('test-only exact package completes A5001 atomically and leaves A5002 untouched', async () => {
    const f = await fixture('positive');
    const result = await submit(
      f,
      `slice15-a5001-positive-${crypto.randomUUID()}`
    );
    expect(result.statusCode, result.body).toBe(200);
    const body = result.json();
    expect(body.nodes.find((node: any) => node.nodeCode === 'A5001')).toMatchObject({
      status: 'COMPLETED',
    });
    expect(body.nodes.find((node: any) => node.nodeCode === 'A5002')).toBeUndefined();

    const artifact = body.artifacts.find(
      (item: any) => item.type === 'DIGITAL_USE_A5001_EFFECT_EVALUATION'
    );
    expect(artifact).toMatchObject({
      sourceNodeCode: 'A5001',
      revision: 1,
      data: {
        stream: 'FAMILY_ALLIANCE_REVIEW',
        professionalPackage: TEST_A5001_PACKAGE,
        completion: 'REVIEW_COMPLETE',
      },
    });
    expect(artifact.data.subject.familyAllianceSubject.selectionRevision)
      .toBe(f.scene.targetSelectionRevision);
    expect(artifact.data.subject.selectedTargets.map((target: any) => target.id).sort())
      .toEqual(
        f.scene.targets
          .filter((target: any) => target.selected)
          .map((target: any) => target.id)
          .sort()
      );
    expect(artifact.data).not.toHaveProperty('familyDimensions');
    expect(artifact.data).not.toHaveProperty('score');

    const after = await counts(f);
    expect(after.artifacts).toBe(1);
    expect(after.nodes).toBe(1);
    expect(after.events).toBe(1);
    expect(after.audits).toBe(1);
  });

  it('same key replays committed history after retirement while changed package/payload remains a conflict', async () => {
    const f = await fixture('idempotency');
    const key = `slice15-a5001-idem-${crypto.randomUUID()}`;
    const request = payload(f);
    const first = await submit(f, key, request);
    expect(first.statusCode, first.body).toBe(200);

    professional.retire('FAMILY_ALLIANCE_REVIEW');
    try {
      const replay = await submit(f, key, request);
      expect(replay.statusCode, replay.body).toBe(200);
      expect(replay.json()).toEqual(first.json());

      const changedPayload = await submit(f, key, {
        ...request,
        packageResponse: {
          outcome: 'SAME',
          note: 'Different package-owned response.',
        },
      });
      expect(changedPayload.statusCode, changedPayload.body).toBe(409);
      expect(changedPayload.json().code).toBe('IDEMPOTENCY_PAYLOAD_MISMATCH');

      const changedPackage = await submit(f, key, {
        ...request,
        professionalPackage: {
          ...request.professionalPackage,
          packageVersion: 'different-v2',
        },
      });
      expect(changedPackage.statusCode, changedPackage.body).toBe(409);
      expect(changedPackage.json().code).toBe('IDEMPOTENCY_PAYLOAD_MISMATCH');
    } finally {
      professional.restore('FAMILY_ALLIANCE_REVIEW');
    }
  });

  it('same key canonical-equivalent wire response replays the original Scene body', async () => {
    const f = await fixture('idempotency-normalized-equivalent');
    const key = `slice15-a5001-idem-normalized-${crypto.randomUUID()}`;
    const request = payload(f);
    const first = await submit(f, key, request);
    expect(first.statusCode, first.body).toBe(200);

    const equivalent = await submit(f, key, {
      ...request,
      packageResponse: {
        ...request.packageResponse,
        note: `  ${String(request.packageResponse.note)}  `,
      },
    });
    expect(equivalent.statusCode, equivalent.body).toBe(200);
    expect(equivalent.json()).toEqual(first.json());
    expect(equivalent.json()).not.toHaveProperty('__preparedIdempotencyV1');
  });

  it('same Scene revision permits exactly one writer', async () => {
    const f = await fixture('concurrency');
    const exact = f.scene;
    const body = payload(f);
    const request = (key: string) =>
      app.inject({
        method: 'POST',
        url: `/api/v1/cases/${f.caseId}/scene/nodes/A5001/responses`,
        headers: { ...auth(f.manager.token), 'idempotency-key': key },
        payload: {
          expectedCaseVersion: f.caseVersion,
          expectedNodeRevision: 0,
          expectedScenePackageVersion: 'v1',
          expectedSelectionRevision: exact.targetSelectionRevision,
          response: body,
        },
      });
    const [a, b] = await Promise.all([
      request(`slice15-a5001-race-a-${crypto.randomUUID()}`),
      request(`slice15-a5001-race-b-${crypto.randomUUID()}`),
    ]);
    expect([a.statusCode, b.statusCode].sort()).toEqual([200, 409]);
    expect((await counts(f)).artifacts).toBe(1);
  });

  it('T1511 target revision race cannot last-write-win against an exact A5001 subject', async () => {
    const f = await fixture('target-drift-barrier');
    const selected = f.scene.targets.find((target: any) => target.selected);
    expect(selected).toBeTruthy();

    const blocker = await appDb.connect();
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
      await reviseDigitalUseTargetItem(blocker, {
        familyId: f.familyId,
        caseId: f.caseId,
        scenePackageVersion: 'v1',
        targetCode: selected.targetCode,
        expectedSelectionRevision: f.scene.targetSelectionRevision,
        expectedTargetRevision: selected.revision,
        createdByPersonId: f.manager.personId,
        patch: {
          concreteTargetText: 'Concurrent target revision committed before review subject lock.',
        },
      });

      const review = submit(
        f,
        `slice15-a5001-target-drift-barrier-${crypto.randomUUID()}`
      );
      // The review acquires Family/Case locks, then waits behind the target row
      // revision writer. Commit the authoritative target revision and release it.
      await new Promise((resolve) => setTimeout(resolve, 40));
      await blocker.query('COMMIT');

      const result = await review;
      expect(result.statusCode, result.body).toBe(409);
      expect(result.json().code).toBe('STALE_TARGET_REVISION');
      expect((await counts(f)).artifacts).toBe(0);
    } catch (error) {
      await blocker.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      blocker.release();
    }
  });

  it('T1511 package authority drift at commit-time barrier rolls back all A5001 truth', async () => {
    const f = await fixture('package-drift-barrier');
    const before = await counts(f);
    professional.restore('FAMILY_ALLIANCE_REVIEW');
    const barrier = professional.pauseNextRevalidation('FAMILY_ALLIANCE_REVIEW');

    const request = submit(
      f,
      `slice15-a5001-package-drift-barrier-${crypto.randomUUID()}`
    );
    await barrier.reached;
    professional.setNextRevalidationDrift(
      'FAMILY_ALLIANCE_REVIEW',
      'RETIRED'
    );
    barrier.release();

    const result = await request;
    expect(result.statusCode, result.body).toBe(503);
    expect(result.json().code).toBe('DEPENDENCY_UNAVAILABLE');
    expect(await counts(f)).toEqual(before);
    professional.restore('FAMILY_ALLIANCE_REVIEW');
  });

  it('package retirement at commit-time rolls back artifact, Scene state, audit/event and idempotency', async () => {
    const f = await fixture('package-drift');
    const before = await counts(f);
    professional.failNextRevalidation('FAMILY_ALLIANCE_REVIEW');
    const result = await submit(
      f,
      `slice15-a5001-package-drift-${crypto.randomUUID()}`
    );
    expect(result.statusCode, result.body).toBe(503);
    expect(result.json().code).toBe('DEPENDENCY_UNAVAILABLE');
    expect(await counts(f)).toEqual(before);
  });

  it('subject drift and control-plane drift fail closed with zero A5001 truth', async () => {
    const stale = await fixture('stale-subject');
    const stalePayload = payload(stale);
    stalePayload.subject.selectedTargets[0]!.targetRevision += 1;
    const staleResult = await submit(
      stale,
      `slice15-a5001-stale-${crypto.randomUUID()}`,
      stalePayload
    );
    expect(staleResult.statusCode, staleResult.body).toBe(409);
    expect(staleResult.json().code).toBe('STALE_TARGET_REVISION');
    expect((await counts(stale)).artifacts).toBe(0);

    const formulation = await fixture('formulation');
    await admin.query(
      `UPDATE problem_formulations
          SET review_state='NEEDS_REVIEW'
        WHERE case_id=$1 AND status='CONFIRMED'`,
      [formulation.caseId]
    );
    const formulationResult = await submit(
      formulation,
      `slice15-a5001-formulation-${crypto.randomUUID()}`
    );
    expect(formulationResult.statusCode).toBe(409);
    expect((await counts(formulation)).artifacts).toBe(0);

    const safety = await fixture('safety');
    await admin.query(`UPDATE cases SET status='SAFETY_HOLD' WHERE id=$1`, [
      safety.caseId,
    ]);
    const safetyResult = await submit(
      safety,
      `slice15-a5001-safety-${crypto.randomUUID()}`
    );
    expect(safetyResult.statusCode).toBe(409);
    expect((await counts(safety)).artifacts).toBe(0);

    const wrongActor = await fixture('wrong-actor');
    const outsider = await loginWithLabel(app, 'slice15-a5001-outsider');
    const outsiderFamily = await createFamily(
      app,
      outsider.token,
      'slice15-a5001-outsider'
    );
    expect(outsiderFamily.statusCode).toBe(201);
    const wrongActorResult = await submit(
      wrongActor,
      `slice15-a5001-wrong-actor-${crypto.randomUUID()}`,
      payload(wrongActor),
      app,
      outsider.token
    );
    expect([403, 404]).toContain(wrongActorResult.statusCode);
    expect((await counts(wrongActor)).artifacts).toBe(0);
  });

  it('fault after Scene mutation rolls the complete command back atomically', async () => {
    const f = await fixture('atomic');
    const suffix = crypto.randomUUID().replaceAll('-', '');
    const fn = `slice15_a5001_fault_fn_${suffix}`;
    const trigger = `slice15_a5001_fault_trigger_${suffix}`;
    await admin.query(
      `CREATE FUNCTION ${fn}() RETURNS trigger LANGUAGE plpgsql AS $$
       BEGIN
         IF NEW.event_type='CASE_DIGITAL_USE_NODE_COMPLETED'
            AND NEW.metadata->>'nodeCode'='A5001' THEN
           RAISE EXCEPTION 'SLICE15_A5001_ATOMICITY_FAULT';
         END IF;
         RETURN NEW;
       END $$`
    );
    await admin.query(
      `CREATE TRIGGER ${trigger}
         BEFORE INSERT ON case_events
         FOR EACH ROW EXECUTE FUNCTION ${fn}()`
    );
    const before = await counts(f);
    const key = `slice15-a5001-atomic-${crypto.randomUUID()}`;
    try {
      const result = await submit(f, key);
      expect(result.statusCode).toBe(500);
    } finally {
      await admin.query(`DROP TRIGGER IF EXISTS ${trigger} ON case_events`);
      await admin.query(`DROP FUNCTION IF EXISTS ${fn}()`);
    }
    expect(await counts(f)).toEqual(before);

    const retry = await submit(f, key);
    expect(retry.statusCode, retry.body).toBe(200);
    expect((await counts(f)).artifacts).toBe(1);
  });

  it('T1509 accepts child-authored input only when exact Case participation and Evidence-owner proof agree', async () => {
    const f = await fixture('child-authored-provenance');
    const child = await loginWithLabel(app, 'slice15-a5001-child-authored');
    await admin.query(
      'INSERT INTO family_members (family_id,person_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
      [f.familyId, child.personId]
    );
    const participation = await admin.query<{ id: string }>(
      `INSERT INTO case_participants
         (family_id,case_id,person_id,state,invite_token_hash,invite_expires_at,
          created_by_person_id,accepted_at)
       VALUES ($1,$2,$3,'ACTIVE',$4,now()+interval '1 day',$5,now())
       RETURNING id`,
      [
        f.familyId,
        f.caseId,
        child.personId,
        crypto.randomUUID().replaceAll('-', '').padEnd(64, '0'),
        f.manager.personId,
      ]
    );
    await admin.query(
      `INSERT INTO person_compliance_profiles
         (person_id,age_band,minor_mode,verified_source,guardian_person_id)
       VALUES ($1,'MINOR_14_17',true,'GUARDIAN_RELAY',$2)
       ON CONFLICT (person_id) DO UPDATE SET
         age_band='MINOR_14_17',
         minor_mode=true,
         verified_source='GUARDIAN_RELAY',
         guardian_person_id=EXCLUDED.guardian_person_id,
         guardian_consent_record_id=NULL,
         guardian_consent_version=NULL,
         effective_at=now(),
         updated_at=now()`,
      [child.personId, f.manager.personId]
    );

    const message = await app.inject({
      method: 'POST',
      url: `/api/v1/cases/${f.caseId}/messages`,
      headers: commandHeaders(
        child.token,
        `slice15-a5001-child-message-${crypto.randomUUID()}`
      ),
      payload: { content: 'I followed the agreed sleep target this week.' },
    });
    expect(message.statusCode, message.body).toBe(201);
    const messageId = message.json().id as string;

    const body = {
      ...payload(f),
      evidenceRefs: [{ type: 'DIALOGUE_MESSAGE', id: messageId }],
      provenance: [{
        kind: 'CHILD_AUTHORED_INPUT',
        sourcePersonId: child.personId,
        participationId: participation.rows[0]!.id,
        sourceMessageId: messageId,
      }],
    };
    const result = await submit(
      f,
      `slice15-a5001-child-provenance-${crypto.randomUUID()}`,
      body
    );
    expect(result.statusCode, result.body).toBe(200);
    const artifact = result.json().artifacts.find(
      (item: any) => item.type === 'DIGITAL_USE_A5001_EFFECT_EVALUATION'
    );
    expect(artifact.data.provenance).toEqual(body.provenance);
  });

  it('T1509 accepts parent-transcribed child claim only through exact active participation + Evidence, preserving explicit UNKNOWN', async () => {
    const f = await fixture('transcribed-child-provenance');
    const child = await loginWithLabel(app, 'slice15-a5001-transcribed-child');
    await admin.query(
      'INSERT INTO family_members (family_id,person_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
      [f.familyId, child.personId]
    );
    const participation = await admin.query<{ id: string }>(
      `INSERT INTO case_participants
         (family_id,case_id,person_id,state,invite_token_hash,invite_expires_at,
          created_by_person_id,accepted_at)
       VALUES ($1,$2,$3,'ACTIVE',$4,now()+interval '1 day',$5,now())
       RETURNING id`,
      [
        f.familyId,
        f.caseId,
        child.personId,
        crypto.randomUUID().replaceAll('-', '').padEnd(64, '0'),
        f.manager.personId,
      ]
    );
    await admin.query(
      `INSERT INTO person_compliance_profiles
         (person_id,age_band,minor_mode,verified_source,guardian_person_id)
       VALUES ($1,'MINOR_14_17',true,'GUARDIAN_RELAY',$2)
       ON CONFLICT (person_id) DO UPDATE SET
         age_band='MINOR_14_17',
         minor_mode=true,
         verified_source='GUARDIAN_RELAY',
         guardian_person_id=EXCLUDED.guardian_person_id,
         guardian_consent_record_id=NULL,
         guardian_consent_version=NULL,
         effective_at=now(),
         updated_at=now()`,
      [child.personId, f.manager.personId]
    );

    const observation = await withRlsTransaction(
      appDb,
      {
        familyId: f.familyId,
        accountId: f.manager.accountId,
        personId: f.manager.personId,
        purpose: 'FAMILY_MANAGEMENT',
      },
      async (tx) =>
        recordObservation(
          tx,
          {
            familyId: f.familyId,
            caseId: f.caseId,
            actorAccountId: f.manager.accountId,
            actorPersonId: f.manager.personId,
            purpose: 'FAMILY_MANAGEMENT',
          },
          {
            subjectPersonId: child.personId,
            sourceKind: 'GUARDIAN_OBSERVATION',
            sourcePersonId: f.manager.personId,
            occurredTimeState: 'UNKNOWN',
            confirmationStatus: 'UNCONFIRMED',
            content: 'Parent transcribed that the child was unsure whether the target helped.',
            observationCode: 'SLICE15_CHILD_TRANSCRIBED_EFFECT',
            value: { state: 'UNKNOWN' },
          }
        )
    );

    const evidenceRef = { type: 'OBSERVATION' as const, id: observation.id };
    const body = {
      ...payload(f),
      evidenceRefs: [evidenceRef],
      provenance: [{
        kind: 'PARENT_TRANSCRIBED_CHILD_CLAIM',
        transcriberPersonId: f.manager.personId,
        childPersonId: child.personId,
        participationId: participation.rows[0]!.id,
        evidenceRef,
      }],
    };
    const result = await submit(
      f,
      `slice15-a5001-transcribed-provenance-${crypto.randomUUID()}`,
      body
    );
    expect(result.statusCode, result.body).toBe(200);
    const artifact = result.json().artifacts.find(
      (item: any) => item.type === 'DIGITAL_USE_A5001_EFFECT_EVALUATION'
    );
    expect(artifact.data.provenance).toEqual(body.provenance);

    const { rows } = await admin.query<{ value_state: string }>(
      'SELECT value_state FROM observations WHERE id=$1',
      [observation.id]
    );
    expect(rows[0]?.value_state).toBe('UNKNOWN');
  });

  it('T1509 FORCE RLS keeps completed A5001 artifact invisible outside its Family context', async () => {
    const f = await fixture('rls-isolation');
    const result = await submit(
      f,
      `slice15-a5001-rls-${crypto.randomUUID()}`,
      payload(f)
    );
    expect(result.statusCode, result.body).toBe(200);
    const artifact = result.json().artifacts.find(
      (item: any) => item.type === 'DIGITAL_USE_A5001_EFFECT_EVALUATION'
    );
    expect(artifact?.id).toBeTruthy();

    const outsider = await loginWithLabel(app, 'slice15-a5001-rls-outsider');
    const outsiderFamily = await createFamily(
      app,
      outsider.token,
      'slice15-a5001-rls-outsider'
    );
    expect(outsiderFamily.statusCode, outsiderFamily.body).toBe(201);

    const visible = await withRlsTransaction(
      appDb,
      {
        familyId: outsiderFamily.json().id as string,
        accountId: outsider.accountId,
        personId: outsider.personId,
        purpose: 'FAMILY_MANAGEMENT',
      },
      (tx) => tx.query(
        'SELECT id FROM scene_artifacts WHERE id=$1',
        [artifact.id]
      )
    );
    expect(visible.rows).toHaveLength(0);
  });

  it('T1509 rejects cross-Family Evidence refs even with an otherwise valid package and subject', async () => {
    const f = await fixture('cross-family-evidence');
    const outsider = await loginWithLabel(app, 'slice15-a5001-cross-family-outsider');
    const outsiderFamily = await createFamily(
      app,
      outsider.token,
      'slice15-a5001-cross-family-outsider'
    );
    expect(outsiderFamily.statusCode, outsiderFamily.body).toBe(201);
    const outsiderCase = await createCase(
      app,
      outsider.token,
      'slice15-a5001-cross-family-outsider'
    );
    expect(outsiderCase.statusCode, outsiderCase.body).toBe(201);
    const outsiderMessage = await app.inject({
      method: 'POST',
      url: `/api/v1/cases/${outsiderCase.json().id as string}/messages`,
      headers: commandHeaders(
        outsider.token,
        `slice15-a5001-cross-family-message-${crypto.randomUUID()}`
      ),
      payload: { content: 'Evidence from a different Family and Case.' },
    });
    expect(outsiderMessage.statusCode, outsiderMessage.body).toBe(201);

    const body = {
      ...payload(f),
      evidenceRefs: [{
        type: 'DIALOGUE_MESSAGE',
        id: outsiderMessage.json().id as string,
      }],
    };
    const result = await submit(
      f,
      `slice15-a5001-cross-family-${crypto.randomUUID()}`,
      body
    );
    expect(result.statusCode, result.body).toBe(422);
    expect(result.json().code).toBe('SCENE_RESPONSE_INVALID');
    expect((await counts(f)).artifacts).toBe(0);
  });

  it('USER_TIMELINE_REVIEW appends + supersedes history without destructive overwrite', async () => {
    const f = await fixture('history');
    const first = await submit(
      f,
      `slice15-a5001-history-1-${crypto.randomUUID()}`,
      payload(f, 'First exact review')
    );
    expect(first.statusCode, first.body).toBe(200);
    f.scene = await sceneFor(f);

    const second = await submit(
      f,
      `slice15-a5001-history-2-${crypto.randomUUID()}`,
      payload(f, 'Second exact review')
    );
    expect(second.statusCode, second.body).toBe(200);

    const history = await admin.query(
      `SELECT id, revision, supersedes_id, data
         FROM scene_artifacts
        WHERE case_id=$1
          AND artifact_type='DIGITAL_USE_A5001_EFFECT_EVALUATION'
        ORDER BY revision ASC`,
      [f.caseId]
    );
    expect(history.rows).toHaveLength(2);
    expect(history.rows[0].revision).toBe(1);
    expect(history.rows[0].supersedes_id).toBeNull();
    expect(history.rows[1].revision).toBe(2);
    expect(history.rows[1].supersedes_id).toBe(history.rows[0].id);
    expect(history.rows[0].data.normalizedResponse.note).toBe('First exact review');
    expect(history.rows[1].data.normalizedResponse.note).toBe('Second exact review');
    expect(history.rows[0].data.professionalPackage).toMatchObject(TEST_A5001_PACKAGE);
    expect(history.rows[1].data.professionalPackage).toMatchObject(TEST_A5001_PACKAGE);
  });
});
