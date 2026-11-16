import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { buildApp } from '../../apps/server/api/src/app.js';
import {
  PHONE_USE_CONTRACT_CONTENT_VERSION,
  resolveDigitalUseRuntimeNode,
} from '@xiaoshuyin/scenes/digital-use';
import {
  auth,
  commandHeaders,
  createFamily,
  loginWithLabel,
  type LoginResult,
} from '../setup/api.js';
import { createCase } from '../setup/participation.js';
import { createAdminPool } from '../setup/db.js';

interface Fixture {
  manager: LoginResult;
  child: LoginResult;
  familyId: string;
  caseId: string;
  caseVersion: number;
  participationId: string;
  contractId: string;
  contractVersion: number;
  contractDraftRevision: number;
  contractDocumentId: string;
  supervisionArtifactId: string;
}

const term = (value: string) => ({ state: 'VALUE', value });

describe('Slice 15 A5002 exact Phone Use Contract effect review runtime', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let admin: pg.Pool;
  let migrator: pg.Client;

  async function ensureBaselinePolicy(featureCode: string): Promise<void> {
    await migrator.query(
      `SELECT pg_advisory_lock(hashtextextended($1,0))`,
      [`slice15-test-policy:${featureCode}`]
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
      if ((current.rows[0]?.n ?? 0) > 0) return;
      await migrator.query(
        `SELECT app.publish_compliance_feature_policy(
           $1,'v1',NULL,1,
           'NOT_APPLICABLE','BASELINE','BASELINE','BASELINE','BASELINE',
           $2,$3,now() - interval '1 minute',$4
         )`,
        [
          featureCode,
          `Slice 15 combined review integration baseline for ${featureCode}`,
          `evidence://slice15/review/${featureCode}`,
          `migration:slice15-review-${featureCode}`,
        ]
      );
    } finally {
      await migrator.query(
        `SELECT pg_advisory_unlock(hashtextextended($1,0))`,
        [`slice15-test-policy:${featureCode}`]
      );
    }
  }

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
    admin = createAdminPool();
    migrator = new pg.Client({
      connectionString: process.env['MIGRATION_DATABASE_URL'],
    });
    await migrator.connect();
    await ensureBaselinePolicy('DIGITAL_USE_FAMILY_ALLIANCE_RUNTIME');
  });

  afterAll(async () => {
    await migrator.end().catch(() => undefined);
    await admin.end();
    await app.close();
  });

  async function fixture(label: string): Promise<Fixture> {
    const manager = await loginWithLabel(app, `a5002-manager-${label}`);
    const family = await createFamily(app, manager.token, `a5002-${label}`);
    expect(family.statusCode, family.body).toBe(201);
    const familyId = family.json().id as string;

    const child = await loginWithLabel(app, `a5002-child-${label}`);
    const childOwnFamily = await createFamily(
      app,
      child.token,
      `a5002-child-own-${label}`
    );
    expect(childOwnFamily.statusCode, childOwnFamily.body).toBe(201);

    await admin.query(
      `INSERT INTO family_members (family_id,person_id)
       VALUES ($1,$2) ON CONFLICT DO NOTHING`,
      [familyId, child.personId]
    );

    const kase = await createCase(app, manager.token, `a5002-${label}`);
    expect(kase.statusCode, kase.body).toBe(201);
    const caseId = kase.json().id as string;
    const caseVersion = kase.json().version as number;

    const message = await app.inject({
      method: 'POST',
      url: `/api/v1/cases/${caseId}/messages`,
      headers: commandHeaders(manager.token, `a5002-msg-${label}`),
      payload: { content: 'We are reviewing the current phone-use Contract effect.' },
    });
    expect(message.statusCode, message.body).toBe(201);
    const messageId = message.json().id as string;

    const client = await admin.connect();
    try {
      await client.query('BEGIN');
      await client.query(`UPDATE cases SET phase='REVIEW' WHERE id=$1`, [caseId]);
      await client.query(
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
          JSON.stringify({ text: 'Current phone-use Contract problem' }),
          JSON.stringify([{ type: 'DIALOGUE_MESSAGE', id: messageId }]),
          JSON.stringify({
            kind: 'CONFIRM',
            actorPersonId: manager.personId,
            respondedAt: new Date().toISOString(),
          }),
          manager.personId,
        ]
      );

      await client.query(
        `INSERT INTO scene_node_states
           (family_id,case_id,scene_package_version,node_code,source_node_code,
            status,branch_reason_codes,input_refs,output_refs,completed_at,revision)
         VALUES ($1,$2,'v1','A1001','A1001','COMPLETED',
                 ARRAY['SLICE15_A5002_FIXTURE'],'[]'::jsonb,'[]'::jsonb,now(),1)`,
        [familyId, caseId]
      );

      const tokenHash = crypto.randomUUID().replaceAll('-', '').repeat(2);
      const participation = await client.query<{ id: string }>(
        `INSERT INTO case_participants
           (family_id,case_id,person_id,state,invite_token_hash,invite_expires_at,
            created_by_person_id,accepted_at)
         VALUES ($1,$2,$3,'ACTIVE',$4,now()+interval '1 day',$5,now())
         RETURNING id`,
        [familyId, caseId, child.personId, tokenHash, manager.personId]
      );
      const participationId = participation.rows[0]!.id;
      const confirmedAt = new Date().toISOString();
      const parentConfirmation = {
        kind: 'ADULT',
        accountId: manager.accountId,
        personId: manager.personId,
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
      const terms = {
        contractPurpose: term('Reduce conflict while preserving agreed access.'),
        phoneUseRules: term('No phone after the agreed bedtime.'),
        executionPeriod: term('Two weeks.'),
        parentSupportMeasures: term('Parent gives one calm reminder.'),
        supervisionMeasures: term('Check the shared charging location.'),
        incentives: term('Extra family activity after consistent execution.'),
        breachResponsibilities: term('Discuss breach and reset the next day.'),
      };
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
          familyId,
          caseId,
          manager.personId,
          child.personId,
          participationId,
          JSON.stringify(terms.contractPurpose),
          JSON.stringify(terms.phoneUseRules),
          JSON.stringify(terms.executionPeriod),
          JSON.stringify(terms.parentSupportMeasures),
          JSON.stringify(terms.supervisionMeasures),
          JSON.stringify(terms.incentives),
          JSON.stringify(terms.breachResponsibilities),
          PHONE_USE_CONTRACT_CONTENT_VERSION,
          JSON.stringify(parentConfirmation),
          JSON.stringify(childConfirmation),
        ]
      );
      const contractId = contract.rows[0]!.id;

      const document = await client.query<{ id: string }>(
        `INSERT INTO scene_artifacts
           (family_id,case_id,scene_package_version,artifact_type,schema_version,
            source_node_code,data,owner_person_id,visibility,source_refs,revision)
         VALUES ($1,$2,'v1','PHONE_USE_CONTRACT_DOCUMENT','v1','A4010',
                 $3::jsonb,$4,'FAMILY_AUTHORIZED','[]'::jsonb,1)
         RETURNING id`,
        [
          familyId,
          caseId,
          JSON.stringify({
            contractVersionId: contractId,
            version: 1,
            draftRevision: 1,
            status: 'ACTIVE',
          }),
          manager.personId,
        ]
      );
      const contractDocumentId = document.rows[0]!.id;

      await client.query(
        `INSERT INTO scene_artifacts
           (family_id,case_id,scene_package_version,artifact_type,schema_version,
            source_node_code,data,owner_person_id,visibility,source_refs,revision)
         VALUES ($1,$2,'v1','PHONE_USE_CONTRACT_SUPPORT_LOG','v1','A4011',
                 $3::jsonb,$4,'FAMILY_AUTHORIZED',$5::jsonb,1)`,
        [
          familyId,
          caseId,
          JSON.stringify({
            action: 'FAQ_VIEWED',
            topic: 'execution support',
            contractVersionId: contractId,
            contractVersion: 1,
            actorPersonId: manager.personId,
            provenance: 'AUTHENTICATED_ACTOR_INPUT',
          }),
          manager.personId,
          JSON.stringify([{ type: 'SCENE_ARTIFACT', id: contractDocumentId }]),
        ]
      );

      const supervision = await client.query<{ id: string }>(
        `INSERT INTO scene_artifacts
           (family_id,case_id,scene_package_version,artifact_type,schema_version,
            source_node_code,data,owner_person_id,visibility,source_refs,revision)
         VALUES ($1,$2,'v1','PHONE_USE_SUPERVISION_LOG','v1','A4006',
                 $3::jsonb,$4,'FAMILY_AUTHORIZED',$5::jsonb,1)
         RETURNING id`,
        [
          familyId,
          caseId,
          JSON.stringify({
            action: 'LOG',
            note: 'Observed supervision during the Contract execution period.',
            actorPersonId: manager.personId,
            provenance: 'AUTHENTICATED_ACTOR_INPUT',
          }),
          manager.personId,
          JSON.stringify([{ type: 'SCENE_ARTIFACT', id: contractDocumentId }]),
        ]
      );
      const supervisionArtifactId = supervision.rows[0]!.id;

      await client.query('COMMIT');
      return {
        manager,
        child,
        familyId,
        caseId,
        caseVersion,
        participationId,
        contractId,
        contractVersion: 1,
        contractDraftRevision: 1,
        contractDocumentId,
        supervisionArtifactId,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async function seedA5001Subject(f: Fixture): Promise<void> {
    const a3000 = resolveDigitalUseRuntimeNode('A3000');
    const a3002 = resolveDigitalUseRuntimeNode('A3002');
    const client = await admin.connect();
    try {
      await client.query('BEGIN');
      await client.query(`UPDATE cases SET phase='GOALS' WHERE id=$1`, [f.caseId]);
      for (const node of [a3000, a3002]) {
        await client.query(
          `INSERT INTO scene_node_states
             (family_id,case_id,scene_package_version,node_code,source_node_code,
              status,branch_reason_codes,input_refs,output_refs,completed_at,revision)
           VALUES ($1,$2,'v1',$3,$4,'COMPLETED',
                   ARRAY['SLICE15_DUAL_STREAM_FIXTURE'],'[]'::jsonb,'[]'::jsonb,now(),1)`,
          [f.familyId, f.caseId, node.nodeCode, node.sourceNodeCode]
        );
      }
      await client.query(
        `INSERT INTO scene_artifacts
           (family_id,case_id,scene_package_version,artifact_type,schema_version,
            source_node_code,data,owner_person_id,visibility,source_refs,revision)
         VALUES ($1,$2,'v1','FAMILY_ALLIANCE_SELF_ASSESSMENT','v1','A3000',
                 $3::jsonb,$4,'FAMILY_AUTHORIZED','[]'::jsonb,1)`,
        [
          f.familyId,
          f.caseId,
          JSON.stringify({ fixture: 'slice15-dual-stream' }),
          f.manager.personId,
        ]
      );
      await client.query(
        `INSERT INTO digital_use_target_items
           (family_id,case_id,scene_package_version,target_code,selection_revision,
            revision,selected,concrete_target_text,feasibility_payload,
            progress_payload,progress_evidence_refs,help_history_refs,source_refs,
            created_by_person_id)
         VALUES
           ($1,$2,'v1','SLEEP',1,1,true,'Keep the agreed bedtime',
            $3::jsonb,$4::jsonb,'[]'::jsonb,'[]'::jsonb,'[]'::jsonb,$5)`,
        [
          f.familyId,
          f.caseId,
          JSON.stringify({ state: 'KNOWN', note: 'Feasible with parent support.' }),
          JSON.stringify({ state: 'PARTIAL', note: 'Tried on several evenings.' }),
          f.manager.personId,
        ]
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  function a5001Payload() {
    return {
      kind: 'FAMILY_ALLIANCE_REVIEW',
      familyDimensions: {
        emotionalSupport: { state: 'KNOWN', note: 'Parent stayed calm.' },
        childVoiceNegotiation: { state: 'UNKNOWN' },
        trust: { state: 'KNOWN', note: 'Agreement was taken seriously.' },
        coordination: { state: 'NOT_COLLECTED' },
        parentStability: { state: 'KNOWN', note: 'Parent response was stable.' },
        parentPromiseConsistency: { state: 'UNKNOWN' },
      },
      targetEvaluations: [
        {
          targetCode: 'SLEEP',
          expectedTargetRevision: 1,
          dimensions: {
            attempted: { state: 'KNOWN', note: 'The bedtime target was attempted.' },
            partialOrNotAttempted: { state: 'KNOWN', note: 'Execution was partial.' },
            barriers: { state: 'UNKNOWN' },
            help: { state: 'NOT_COLLECTED' },
            change: { state: 'KNOWN', note: 'Conflict shortened.' },
            adverseChange: { state: 'UNKNOWN' },
            uncertainty: { state: 'UNKNOWN' },
          },
        },
      ],
      evidenceRefs: [],
    };
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

  function unresolved(state: 'UNKNOWN' | 'DECLINED' | 'NOT_COLLECTED') {
    return { state };
  }

  function payload(
    f: Fixture,
    suffix = 'base',
    overrides: Record<string, unknown> = {}
  ) {
    return {
      kind: 'PHONE_USE_CONTRACT_REVIEW',
      contractVersionId: f.contractId,
      contractVersion: f.contractVersion,
      expectedContractDraftRevision: f.contractDraftRevision,
      expectedContractStatus: 'ACTIVE',
      dimensions: {
        execution: { state: 'KNOWN', note: `Execution was attempted ${suffix}` },
        partialExecution: unresolved('UNKNOWN'),
        parentCooperation: {
          state: 'KNOWN',
          note: `Parent support remained calm ${suffix}`,
        },
        supervision: unresolved('NOT_COLLECTED'),
        incentives: unresolved('DECLINED'),
        breachResponsibilities: unresolved('UNKNOWN'),
        benefits: { state: 'KNOWN', note: `Some conflict reduced ${suffix}` },
        adverseChanges: unresolved('UNKNOWN'),
        newProblems: unresolved('NOT_COLLECTED'),
        uncertainty: unresolved('UNKNOWN'),
      },
      a4012TriggerObservation: {
        state: 'KNOWN',
        trigger: 'PERIOD_COMPLETE',
        note: `The agreed period ended ${suffix}`,
      },
      evidenceRefs: [],
      ...overrides,
    };
  }

  function submit(
    f: Fixture,
    scene: any,
    key: string,
    response = payload(f),
    topLevel: Record<string, unknown> = {}
  ) {
    const node = scene.nodes.find((item: any) => item.nodeCode === 'A5002');
    return app.inject({
      method: 'POST',
      url: `/api/v1/cases/${f.caseId}/scene/nodes/A5002/responses`,
      headers: { ...auth(f.manager.token), 'idempotency-key': key },
      payload: {
        expectedCaseVersion: f.caseVersion,
        expectedNodeRevision: node?.revision ?? 0,
        expectedScenePackageVersion: 'v1',
        response,
        ...topLevel,
      },
    });
  }

  async function counts(f: Fixture) {
    const { rows } = await admin.query<{
      artifacts: number;
      evidence: number;
      node: number;
      a4012: number;
      contracts: number;
    }>(
      `SELECT
        (SELECT count(*)::int FROM scene_artifacts
          WHERE case_id=$1
            AND artifact_type='DIGITAL_USE_A5002_EFFECT_EVALUATION') AS artifacts,
        (SELECT count(*)::int FROM assertions
          WHERE case_id=$1 AND content LIKE 'DUA5002:v1:%') AS evidence,
        (SELECT count(*)::int FROM scene_node_states
          WHERE case_id=$1 AND node_code='A5002') AS node,
        (SELECT count(*)::int FROM scene_node_states
          WHERE case_id=$1 AND node_code='A4012') AS a4012,
        (SELECT count(*)::int FROM digital_use_contract_versions
          WHERE case_id=$1) AS contracts`,
      [f.caseId]
    );
    return rows[0]!;
  }

  async function contractSnapshot(f: Fixture) {
    const { rows } = await admin.query<{
      id: string;
      version: number;
      draft_revision: number;
      status: string;
      supersedes_id: string | null;
      update_trigger: string | null;
      updated_at: Date;
    }>(
      `SELECT id,version,draft_revision,status,supersedes_id,update_trigger,updated_at
         FROM digital_use_contract_versions
        WHERE case_id=$1 ORDER BY version`,
      [f.caseId]
    );
    return rows.map((row) => ({
      ...row,
      updated_at: new Date(row.updated_at).toISOString(),
    }));
  }

  async function supersedeWithVersion2(f: Fixture): Promise<Fixture> {
    const client = await admin.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `SELECT set_config('app.purpose','FAMILY_MANAGEMENT',true)`
      );
      await client.query(
        `UPDATE digital_use_contract_versions
            SET status='SUPERSEDED',superseded_at=now()
          WHERE id=$1 AND status='ACTIVE'`,
        [f.contractId]
      );
      const prior = await client.query<{
        contract_purpose: unknown;
        phone_use_rules: unknown;
        execution_period: unknown;
        parent_support_measures: unknown;
        supervision_measures: unknown;
        incentives: unknown;
        breach_responsibilities: unknown;
        parent_confirmation: any;
        child_confirmation: any;
      }>(
        `SELECT contract_purpose,phone_use_rules,execution_period,
                parent_support_measures,supervision_measures,incentives,
                breach_responsibilities,parent_confirmation,child_confirmation
           FROM digital_use_contract_versions WHERE id=$1`,
        [f.contractId]
      );
      const source = prior.rows[0]!;
      const parentConfirmation = {
        ...source.parent_confirmation,
        draftRevision: 1,
        confirmedAt: new Date().toISOString(),
      };
      const childConfirmation = {
        ...source.child_confirmation,
        draftRevision: 1,
        confirmedAt: new Date().toISOString(),
      };
      const next = await client.query<{ id: string }>(
        `INSERT INTO digital_use_contract_versions
           (family_id,case_id,version,draft_revision,status,
            adult_party_person_id,child_party_person_id,child_participation_id,
            contract_purpose,phone_use_rules,execution_period,parent_support_measures,
            supervision_measures,incentives,breach_responsibilities,
            source_template_version,dependency_refs,parent_confirmation,
            child_confirmation,supersedes_id,update_reason,update_trigger,
            created_by_person_id,activated_at)
         VALUES
           ($1,$2,2,1,'ACTIVE',$3,$4,$5,
            $6::jsonb,$7::jsonb,$8::jsonb,$9::jsonb,$10::jsonb,$11::jsonb,$12::jsonb,
            $13,'[]'::jsonb,$14::jsonb,$15::jsonb,$16,
            'period completed','PERIOD_COMPLETE',$3,now())
         RETURNING id`,
        [
          f.familyId,
          f.caseId,
          f.manager.personId,
          f.child.personId,
          f.participationId,
          JSON.stringify(source.contract_purpose),
          JSON.stringify(source.phone_use_rules),
          JSON.stringify(source.execution_period),
          JSON.stringify(source.parent_support_measures),
          JSON.stringify(source.supervision_measures),
          JSON.stringify(source.incentives),
          JSON.stringify(source.breach_responsibilities),
          PHONE_USE_CONTRACT_CONTENT_VERSION,
          JSON.stringify(parentConfirmation),
          JSON.stringify(childConfirmation),
          f.contractId,
        ]
      );
      const contractId = next.rows[0]!.id;
      const document = await client.query<{ id: string }>(
        `INSERT INTO scene_artifacts
           (family_id,case_id,scene_package_version,artifact_type,schema_version,
            source_node_code,data,owner_person_id,visibility,source_refs,revision,
            supersedes_id)
         VALUES ($1,$2,'v1','PHONE_USE_CONTRACT_DOCUMENT','v1','A4010',
                 $3::jsonb,$4,'FAMILY_AUTHORIZED','[]'::jsonb,2,$5)
         RETURNING id`,
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
          f.contractDocumentId,
        ]
      );
      await client.query('COMMIT');
      return {
        ...f,
        contractId,
        contractVersion: 2,
        contractDraftRevision: 1,
        contractDocumentId: document.rows[0]!.id,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  it('AS-02/04/06/10/24/27-29/39/52 records one exact ACTIVE Contract review and never executes A4012', async () => {
    const f = await fixture('legal');
    const scene = await getScene(f);
    expect(
      scene.reachableNodes.find((item: any) => item.nodeCode === 'A5002')
    ).toMatchObject({
      nodeCode: 'A5002',
      reasonCode: 'USER_INITIATED_AVAILABLE',
    });

    const beforeContract = await contractSnapshot(f);
    const key = `a5002-legal-${crypto.randomUUID()}`;
    const result = await submit(f, scene, key, payload(f, 'legal'));
    expect(result.statusCode, result.body).toBe(200);
    const body = result.json();
    expect(body.nodes.find((item: any) => item.nodeCode === 'A5002')).toMatchObject({
      status: 'COMPLETED',
    });
    expect(body.nodes.find((item: any) => item.nodeCode === 'A5001')).toBeUndefined();

    const artifact = body.artifacts.find(
      (item: any) => item.type === 'DIGITAL_USE_A5002_EFFECT_EVALUATION'
    );
    expect(artifact).toMatchObject({
      type: 'DIGITAL_USE_A5002_EFFECT_EVALUATION',
      sourceNodeCode: 'A5002',
      revision: 1,
    });
    expect(artifact.data).toMatchObject({
      nodeCode: 'A5002',
      stream: 'PHONE_USE_CONTRACT_REVIEW',
      completion: 'REVIEW_COMPLETE',
      subject: {
        contractVersionId: f.contractId,
        contractVersion: 1,
        contractDraftRevision: 1,
        contractStatus: 'ACTIVE',
      },
      evaluation: {
        a4012TriggerObservation: {
          state: 'KNOWN',
          trigger: 'PERIOD_COMPLETE',
        },
      },
    });
    expect(artifact.data.subject.a4011SupportArtifacts).toHaveLength(1);
    expect(artifact.data.subject.a4006SupervisionArtifacts).toEqual([
      expect.objectContaining({
        artifactId: f.supervisionArtifactId,
        artifactType: 'PHONE_USE_SUPERVISION_LOG',
        revision: 1,
      }),
    ]);
    expect(artifact.sourceRefs).toEqual(
      expect.arrayContaining([
        { type: 'SCENE_ARTIFACT', id: f.supervisionArtifactId },
      ])
    );

    expect(await contractSnapshot(f)).toEqual(beforeContract);
    const after = await counts(f);
    expect(after.artifacts).toBe(1);
    expect(after.node).toBe(1);
    expect(after.contracts).toBe(1);
    expect(after.a4012).toBe(0);
    expect(after.evidence).toBeGreaterThan(0);

    const replay = await submit(f, scene, key, payload(f, 'legal'));
    expect(replay.statusCode, replay.body).toBe(200);
    expect(replay.json()).toEqual(result.json());

    const mismatch = await submit(
      f,
      scene,
      key,
      payload(f, 'different-idempotency-payload')
    );
    expect(mismatch.statusCode).toBe(409);
    expect(mismatch.json().code).toBe('IDEMPOTENCY_PAYLOAD_MISMATCH');
    expect((await counts(f)).artifacts).toBe(1);
  });

  it('AS-25/26/43/48 preserves old binding after A4012 supersession and rejects silent subject switching', async () => {
    const v1 = await fixture('history');
    const scene1 = await getScene(v1);
    const key = `a5002-history-v1-${crypto.randomUUID()}`;
    const originalPayload = payload(v1, 'v1');
    const first = await submit(v1, scene1, key, originalPayload);
    expect(first.statusCode, first.body).toBe(200);

    const v2 = await supersedeWithVersion2(v1);

    // The already-settled exact v1 command remains replayable after A4012
    // supersedes the Contract. This is idempotency, not a new historical write.
    const replayOld = await submit(v1, scene1, key, originalPayload);
    expect(replayOld.statusCode, replayOld.body).toBe(200);
    expect(replayOld.json()).toEqual(first.json());

    // A new command cannot use the old client subject and silently switch to v2.
    const staleOld = await submit(
      v1,
      await getScene(v2),
      `a5002-history-stale-${crypto.randomUUID()}`,
      originalPayload
    );
    expect(staleOld.statusCode).toBe(409);
    expect(staleOld.json().code).toBe('PHONE_USE_CONTRACT_STALE_REVISION');

    const scene2 = await getScene(v2);
    const second = await submit(
      v2,
      scene2,
      `a5002-history-v2-${crypto.randomUUID()}`,
      payload(v2, 'v2')
    );
    expect(second.statusCode, second.body).toBe(200);

    const { rows } = await admin.query<{
      id: string;
      revision: number;
      supersedes_id: string | null;
      data: any;
    }>(
      `SELECT id,revision,supersedes_id,data
         FROM scene_artifacts
        WHERE case_id=$1
          AND artifact_type='DIGITAL_USE_A5002_EFFECT_EVALUATION'
        ORDER BY revision`,
      [v1.caseId]
    );
    expect(rows).toHaveLength(2);
    expect(rows[0]!.data.subject.contractVersionId).toBe(v1.contractId);
    expect(rows[0]!.data.subject.contractVersion).toBe(1);
    expect(rows[1]!.data.subject.contractVersionId).toBe(v2.contractId);
    expect(rows[1]!.data.subject.contractVersion).toBe(2);
    expect(rows[1]!.supersedes_id).toBe(rows[0]!.id);
    expect(rows[0]!.data.evaluation.dimensions.execution.note).toContain('v1');
    expect(rows[1]!.data.evaluation.dimensions.execution.note).toContain('v2');
  });

  it('AS-41 concurrent same-node submissions have one winner and one stale conflict', async () => {
    const f = await fixture('concurrency');
    const scene = await getScene(f);
    const [a, b] = await Promise.all([
      submit(f, scene, `a5002-race-a-${crypto.randomUUID()}`, payload(f, 'a')),
      submit(f, scene, `a5002-race-b-${crypto.randomUUID()}`, payload(f, 'b')),
    ]);
    const statuses = [a.statusCode, b.statusCode].sort((x, y) => x - y);
    expect(statuses).toEqual([200, 409]);
    const loser = a.statusCode === 409 ? a : b;
    expect(loser.json().code).toBe('STALE_NODE_REVISION');
    expect((await counts(f)).artifacts).toBe(1);
  });

  it('AUTH-006 / Safety / Account authority fail closed with no A5002 truth', async () => {
    {
      const f = await fixture('pf-review');
      const scene = await getScene(f);
      await admin.query(
        `UPDATE problem_formulations SET review_state='NEEDS_REVIEW'
          WHERE case_id=$1 AND status='CONFIRMED'`,
        [f.caseId]
      );
      const result = await submit(
        f,
        scene,
        `a5002-pf-${crypto.randomUUID()}`
      );
      expect(result.statusCode).toBe(409);
      expect(result.json().code).toBe('PROBLEM_FORMULATION_DEPENDENCY_INVALID');
      expect((await counts(f)).artifacts).toBe(0);
    }

    {
      const f = await fixture('safety');
      const scene = await getScene(f);
      await admin.query(`UPDATE cases SET status='SAFETY_HOLD' WHERE id=$1`, [
        f.caseId,
      ]);
      const result = await submit(
        f,
        scene,
        `a5002-safety-${crypto.randomUUID()}`
      );
      expect(result.statusCode).toBe(409);
      expect(result.json().code).toBe('SAFETY_HOLD_BLOCKED');
      expect((await counts(f)).artifacts).toBe(0);
    }

    {
      const f = await fixture('disabled');
      const scene = await getScene(f);
      await admin.query(
        `UPDATE accounts SET status='DISABLED',session_epoch=session_epoch+1 WHERE id=$1`,
        [f.manager.accountId]
      );
      const result = await submit(
        f,
        scene,
        `a5002-disabled-${crypto.randomUUID()}`
      );
      expect(result.statusCode).toBe(401);
      expect(result.json().code).toBe('UNAUTHENTICATED');
      expect((await counts(f)).artifacts).toBe(0);
    }
  });

  it('T1511 A5002 rechecks primary Case, participation and package tokens at execution time', async () => {
    {
      const f = await fixture('not-primary');
      const scene = await getScene(f);
      await admin.query(`UPDATE cases SET is_primary=false WHERE id=$1`, [f.caseId]);
      const result = await submit(
        f,
        scene,
        `a5002-not-primary-${crypto.randomUUID()}`
      );
      expect(result.statusCode).toBe(409);
      expect(result.json().code).toBe('CASE_NOT_PRIMARY');
      expect((await counts(f)).artifacts).toBe(0);
    }

    {
      const f = await fixture('withdrawn-participation');
      const scene = await getScene(f);
      await admin.query(
        `UPDATE case_participants
            SET state='WITHDRAWN',withdrawn_at=now(),updated_at=now()
          WHERE id=$1`,
        [f.participationId]
      );
      const result = await submit(
        f,
        scene,
        `a5002-withdrawn-${crypto.randomUUID()}`
      );
      expect(result.statusCode).toBe(422);
      expect(result.json().code).toBe('PHONE_USE_CONTRACT_INVALID_PAYLOAD');
      expect((await counts(f)).artifacts).toBe(0);
    }

    {
      const f = await fixture('package-token');
      const scene = await getScene(f);
      const result = await app.inject({
        method: 'POST',
        url: `/api/v1/cases/${f.caseId}/scene/nodes/A5002/responses`,
        headers: {
          ...auth(f.manager.token),
          'idempotency-key': `a5002-package-${crypto.randomUUID()}`,
        },
        payload: {
          expectedCaseVersion: f.caseVersion,
          expectedNodeRevision: 0,
          response: payload(f, 'package-token'),
        },
      });
      expect(result.statusCode).toBe(409);
      expect(result.json().code).toBe('STALE_SCENE_PACKAGE');
      expect((await counts(f)).artifacts).toBe(0);
    }
  });

  it('T1511 A5002 rechecks Compliance and Consent independently with no review residue', async () => {
    {
      const f = await fixture('compliance-profile');
      const scene = await getScene(f);
      await admin.query(
        `DELETE FROM person_compliance_profiles WHERE person_id=$1`,
        [f.manager.personId]
      );
      const result = await submit(
        f,
        scene,
        `a5002-compliance-${crypto.randomUUID()}`
      );
      expect(result.statusCode).toBe(409);
      expect(result.json().code).toBe('COMPLIANCE_BLOCKED');
      expect((await counts(f)).artifacts).toBe(0);
    }

    {
      const f = await fixture('consent-missing');
      const scene = await getScene(f);
      await admin.query(
        `UPDATE person_compliance_profiles
            SET age_band='UNDER_14',
                minor_mode=true,
                guardian_person_id=$2,
                guardian_consent_record_id=NULL,
                guardian_consent_version=NULL,
                verified_source='GUARDIAN_RELAY',
                updated_at=now()
          WHERE person_id=$1`,
        [f.child.personId, f.manager.personId]
      );
      const result = await submit(
        f,
        scene,
        `a5002-consent-${crypto.randomUUID()}`
      );
      expect(result.statusCode).toBe(409);
      expect(result.json().code).toBe('PHONE_USE_CONTRACT_CONSENT_BLOCKED');
      expect((await counts(f)).artifacts).toBe(0);
    }
  });

  it('AS-49/50 A5002 USER_TIMELINE_REVIEW appends same-Contract history and reruns current gates', async () => {
    const f = await fixture('same-contract-reentry');
    const firstScene = await getScene(f);
    const first = await submit(
      f,
      firstScene,
      `a5002-reentry-1-${crypto.randomUUID()}`,
      payload(f, 'first')
    );
    expect(first.statusCode, first.body).toBe(200);

    const secondScene = await getScene(f);
    expect(
      secondScene.reachableNodes.some((item: any) => item.nodeCode === 'A5002')
    ).toBe(true);
    const second = await submit(
      f,
      secondScene,
      `a5002-reentry-2-${crypto.randomUUID()}`,
      payload(f, 'second')
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
          AND artifact_type='DIGITAL_USE_A5002_EFFECT_EVALUATION'
        ORDER BY revision`,
      [f.caseId]
    );
    expect(history.rows).toHaveLength(2);
    expect(history.rows[0]!.revision).toBe(1);
    expect(history.rows[0]!.supersedes_id).toBeNull();
    expect(history.rows[1]!.revision).toBe(2);
    expect(history.rows[1]!.supersedes_id).toBe(history.rows[0]!.id);
    expect(history.rows[0]!.data.subject.contractVersionId).toBe(f.contractId);
    expect(history.rows[1]!.data.subject.contractVersionId).toBe(f.contractId);
    expect(history.rows[1]!.data.subject.priorReviewArtifact).toEqual({
      artifactId: history.rows[0]!.id,
      revision: 1,
    });
    expect(history.rows[0]!.data.evaluation.dimensions.execution.note).toContain(
      'first'
    );
    expect(history.rows[1]!.data.evaluation.dimensions.execution.note).toContain(
      'second'
    );

    await admin.query(`UPDATE cases SET status='SAFETY_HOLD' WHERE id=$1`, [
      f.caseId,
    ]);
    const blocked = await submit(
      f,
      second.json(),
      `a5002-reentry-blocked-${crypto.randomUUID()}`,
      payload(f, 'blocked')
    );
    expect(blocked.statusCode).toBe(409);
    expect(blocked.json().code).toBe('SAFETY_HOLD_BLOCKED');

    const finalCount = await admin.query<{ n: number }>(
      `SELECT count(*)::int AS n
         FROM scene_artifacts
        WHERE case_id=$1
          AND artifact_type='DIGITAL_USE_A5002_EFFECT_EVALUATION'`,
      [f.caseId]
    );
    expect(finalCount.rows[0]!.n).toBe(2);
  });

  it('AS-31 rejects an exact Contract bound to another Case in the same Family', async () => {
    const f = await fixture('wrong-case');
    const otherCase = await createCase(
      app,
      f.manager.token,
      `a5002-other-case-${crypto.randomUUID()}`
    );
    expect(otherCase.statusCode, otherCase.body).toBe(201);
    const otherCaseId = otherCase.json().id as string;
    const result = await app.inject({
      method: 'POST',
      url: `/api/v1/cases/${otherCaseId}/scene/nodes/A5002/responses`,
      headers: {
        ...auth(f.manager.token),
        'idempotency-key': `a5002-wrong-case-${crypto.randomUUID()}`,
      },
      payload: {
        expectedCaseVersion: otherCase.json().version,
        expectedNodeRevision: 0,
        expectedScenePackageVersion: 'v1',
        response: payload(f, 'wrong-case'),
      },
    });
    expect(result.statusCode).toBe(404);
    expect(result.json().code).toBe('PHONE_USE_CONTRACT_NOT_FOUND');
    expect((await counts(f)).artifacts).toBe(0);
  });

  it('AS-12/30 rejects another Family Contract without cross-family enumeration', async () => {
    const own = await fixture('scope-own');
    const other = await fixture('scope-other');
    const scene = await getScene(own);
    const forged = payload(own, 'forged', {
      contractVersionId: other.contractId,
      contractVersion: other.contractVersion,
      expectedContractDraftRevision: other.contractDraftRevision,
    });
    const result = await submit(
      own,
      scene,
      `a5002-cross-family-${crypto.randomUUID()}`,
      forged
    );
    expect(result.statusCode).toBe(404);
    expect(result.json().code).toBe('PHONE_USE_CONTRACT_NOT_FOUND');
    expect((await counts(own)).artifacts).toBe(0);
  });

  it('AS-53/54 rejects untrusted production SCHEDULED without schedule/job/notification truth', async () => {
    const f = await fixture('scheduled');
    const scene = await getScene(f);
    const result = await submit(
      f,
      scene,
      `a5002-scheduled-${crypto.randomUUID()}`,
      payload(f),
      { entryMode: 'SCHEDULED' }
    );
    expect(result.statusCode).toBe(409);
    expect(result.json().code).toBe('DEPENDENCY_UNAVAILABLE');
    expect((await counts(f)).artifacts).toBe(0);
  });

  it('AS-46/70 deterministic same-Case fixture completes both streams without AI or Phase 4 truth', async () => {
    const f = await fixture('dual-closeout');
    await seedA5001Subject(f);

    const before = await getScene(f);
    expect(before.targetSelectionRevision).toBe(1);
    expect(
      before.reachableNodes.some((item: any) => item.nodeCode === 'A5001')
    ).toBe(true);
    expect(
      before.reachableNodes.some((item: any) => item.nodeCode === 'A5002')
    ).toBe(true);

    const [a5001, a5002] = await Promise.all([
      app.inject({
        method: 'POST',
        url: `/api/v1/cases/${f.caseId}/scene/nodes/A5001/responses`,
        headers: {
          ...auth(f.manager.token),
          'idempotency-key': `slice15-dual-a5001-${crypto.randomUUID()}`,
        },
        payload: {
          expectedCaseVersion: f.caseVersion,
          expectedNodeRevision: 0,
          expectedScenePackageVersion: 'v1',
          expectedSelectionRevision: 1,
          response: a5001Payload(),
        },
      }),
      submit(
        f,
        before,
        `slice15-dual-a5002-${crypto.randomUUID()}`,
        payload(f, 'dual')
      ),
    ]);
    expect(a5001.statusCode, a5001.body).toBe(200);
    expect(a5002.statusCode, a5002.body).toBe(200);

    const finalScene = await getScene(f);
    expect(finalScene.nodes.find((n: any) => n.nodeCode === 'A5001')).toMatchObject({
      status: 'COMPLETED',
    });
    expect(finalScene.nodes.find((n: any) => n.nodeCode === 'A5002')).toMatchObject({
      status: 'COMPLETED',
    });
    const types = finalScene.artifacts.map((item: any) => item.type);
    expect(types).toContain('DIGITAL_USE_A5001_EFFECT_EVALUATION');
    expect(types).toContain('DIGITAL_USE_A5002_EFFECT_EVALUATION');

    const phase4 = await admin.query<{
      reviews: string | null;
      outcomes: string | null;
      follow_up_schedules: string | null;
    }>(
      `SELECT
         to_regclass('public.reviews')::text AS reviews,
         to_regclass('public.outcomes')::text AS outcomes,
         to_regclass('public.follow_up_schedules')::text AS follow_up_schedules`
    );
    expect(phase4.rows[0]).toEqual({
      reviews: null,
      outcomes: null,
      follow_up_schedules: null,
    });
    expect((await counts(f)).a4012).toBe(0);
  });

  it('AS-44/45 rolls Evidence/node/artifact/idempotency back when artifact persistence fails', async () => {
    const f = await fixture('atomic');
    const scene = await getScene(f);
    const safe = crypto.randomUUID().replaceAll('-', '');
    const fn = `slice15_a5002_fault_fn_${safe}`;
    const tr = `slice15_a5002_fault_tr_${safe}`;
    await admin.query(
      `CREATE FUNCTION ${fn}() RETURNS trigger LANGUAGE plpgsql AS $$
       BEGIN
         IF NEW.artifact_type='DIGITAL_USE_A5002_EFFECT_EVALUATION' THEN
           RAISE EXCEPTION 'SLICE15_A5002_FAULT';
         END IF;
         RETURN NEW;
       END $$;
       CREATE TRIGGER ${tr}
       BEFORE INSERT ON scene_artifacts
       FOR EACH ROW EXECUTE FUNCTION ${fn}();`
    );
    try {
      const key = `a5002-fault-${crypto.randomUUID()}`;
      const result = await submit(f, scene, key, payload(f, 'fault'));
      expect(result.statusCode).toBe(500);
      const c = await counts(f);
      expect(c.artifacts).toBe(0);
      expect(c.evidence).toBe(0);
      expect(c.node).toBe(0);
      const idem = await admin.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM idempotency_keys
          WHERE actor_account_id=$1
            AND command_type='DIGITAL_USE_NODE_RESPONSE'
            AND idempotency_key=$2`,
        [f.manager.accountId, key]
      );
      expect(idem.rows[0]!.n).toBe(0);
    } finally {
      await admin.query(`DROP TRIGGER IF EXISTS ${tr} ON scene_artifacts`);
      await admin.query(`DROP FUNCTION IF EXISTS ${fn}()`);
    }
  });
});
