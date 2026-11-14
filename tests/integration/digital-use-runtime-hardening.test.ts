import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import pg from 'pg';
import { buildApp } from '../../apps/server/api/src/app.js';
import type { RoleplayAdapter } from '../../apps/server/api/src/services/digital-use-roleplay-adapter.js';
import { createAdminPool } from '../setup/db.js';
import {
  auth,
  commandHeaders,
  createFamily,
  loginWithLabel,
  type LoginResult,
} from '../setup/api.js';
import { createCase } from '../setup/participation.js';
import { insertSceneArtifact, validateSceneRefs } from '@xiaoshuyin/domain';
import { withRlsTransaction } from '../../apps/server/api/src/db/tx.js';
import { resolveDigitalUseRuntimeNode } from '@xiaoshuyin/scenes/digital-use';
import {
  APPROVED_SUPPLEMENTAL_ASSESSMENT_DISCLOSURE_AUTHORITY,
  CURRENT_SUPPLEMENTAL_ASSESSMENT_DISCLOSURE,
  DIGITAL_USE_SUPPLEMENTAL_ASSESSMENT,
  getCurrentNoticeHash,
  recordPurposeScopedConsentDecision,
} from '@xiaoshuyin/compliance';

interface Fixture {
  manager: LoginResult;
  familyId: string;
  caseId: string;
  caseVersion: number;
  nodeRevision: number;
  messageId: string;
}

function a1001(impact = false) {
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

describe('T1218 Digital Use runtime hardening', () => {
  let app: FastifyInstance;
  let admin: pg.Pool;
  let migrator: pg.Client;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
    admin = createAdminPool();
    migrator = new pg.Client({ connectionString: process.env['MIGRATION_DATABASE_URL'] });
    await migrator.connect();

    // Exact server-owned Slice 12 feature policy. Production runtime correctly
    // fails closed without reviewed policy truth; this integration fixture
    // publishes one legal NOT_APPLICABLE policy through the Slice 10 owner.
    await migrator.query(
      `SELECT app.publish_compliance_feature_policy(
         'DIGITAL_USE_ASSESSMENT_RUNTIME','v1',NULL,1,
         'NOT_APPLICABLE','BASELINE','BASELINE','BASELINE','BASELINE',
         'Slice 12 integration reviewed basis','evidence://slice12/integration',
         now() - interval '1 minute','migration:slice12-integration'
       )`
    );
    await migrator.query(
      `SELECT app.publish_compliance_feature_policy(
         'DIGITAL_USE_ROLEPLAY_A4003','v1',NULL,1,
         'NOT_APPLICABLE','BASELINE','BASELINE','BASELINE','BASELINE',
         'Slice 14 roleplay integration reviewed basis','evidence://slice14/roleplay-integration',
         now() - interval '1 minute','migration:slice14-roleplay-integration'
       )`
    );
  });

  afterAll(async () => {
    await admin.query(
      `UPDATE compliance_feature_policies
          SET superseded_by_policy_id = NULL
        WHERE feature_code IN ('DIGITAL_USE_ASSESSMENT_RUNTIME','DIGITAL_USE_ROLEPLAY_A4003')
          AND feature_contract_revision='v1'`
    ).catch(() => undefined);
    await admin.query(
      `DELETE FROM compliance_feature_policies
        WHERE feature_code IN ('DIGITAL_USE_ASSESSMENT_RUNTIME','DIGITAL_USE_ROLEPLAY_A4003')
          AND feature_contract_revision='v1'`
    ).catch(() => undefined);
    await migrator.end().catch(() => undefined);
    await admin.end();
    await app.close();
  });

  async function fixture(label: string, targetApp: FastifyInstance = app): Promise<Fixture> {
    const manager = await loginWithLabel(targetApp, `du-hard-${label}`);
    const family = await createFamily(targetApp, manager.token, `du-hard-${label}`);
    expect(family.statusCode).toBe(201);
    const familyId = family.json().id as string;

    const kase = await createCase(targetApp, manager.token, `du-hard-${label}`);
    expect(kase.statusCode).toBe(201);
    const caseId = kase.json().id as string;
    const initialVersion = kase.json().version as number;

    const message = await targetApp.inject({
      method: 'POST',
      url: `/api/v1/cases/${caseId}/messages`,
      headers: commandHeaders(manager.token, `du-msg-${label}`),
      payload: { content: 'I am concerned about the current digital-use problem.' },
    });
    expect(message.statusCode).toBe(201);

    const start = await targetApp.inject({
      method: 'POST',
      url: `/api/v1/cases/${caseId}/assessments`,
      headers: commandHeaders(manager.token, `du-start-${label}`),
      payload: { expectedCaseVersion: initialVersion },
    });
    expect(start.statusCode, start.body).toBe(200);
    const body = start.json();
    expect(body.currentNode?.nodeCode).toBe('A1001');
    return {
      manager,
      familyId,
      caseId,
      caseVersion: body.caseVersion,
      nodeRevision: body.currentNode.revision,
      messageId: message.json().id as string,
    };
  }

  function respondA1001(
    f: Fixture,
    key: string,
    response = a1001(false),
    extraBody: Record<string, unknown> = {}
  ) {
    return app.inject({
      method: 'POST',
      url: `/api/v1/cases/${f.caseId}/scene/nodes/A1001/responses`,
      headers: {
        ...auth(f.manager.token),
        'idempotency-key': key,
      },
      payload: {
        expectedCaseVersion: f.caseVersion,
        expectedNodeRevision: f.nodeRevision,
        response,
        ...extraBody,
      },
    });
  }


  async function forceSceneNode(
    f: Fixture,
    nodeCode: string,
    inputRefs: readonly unknown[] = []
  ): Promise<void> {
    const node = resolveDigitalUseRuntimeNode(nodeCode);
    await admin.query(
      `UPDATE cases SET phase='PROBLEM_FORMULATION' WHERE id=$1`,
      [f.caseId]
    );
    await admin.query(
      `UPDATE scene_node_states
          SET status='COMPLETED',
              completed_at=COALESCE(completed_at, now()),
              revision=revision+1
        WHERE case_id=$1
          AND status IN ('AVAILABLE','IN_PROGRESS')`,
      [f.caseId]
    );
    await admin.query(
      `INSERT INTO scene_node_states
         (family_id, case_id, scene_package_version, node_code, source_node_code,
          status, branch_reason_codes, input_refs, output_refs, revision)
       VALUES ($1,$2,'v1',$3,$4,'AVAILABLE',ARRAY['T1218_FAULT_SETUP'],
               $5::jsonb,'[]'::jsonb,1)`,
      [
        f.familyId,
        f.caseId,
        node.nodeCode,
        node.sourceNodeCode,
        JSON.stringify(inputRefs),
      ]
    );
  }

  function respondSceneNode(
    f: Fixture,
    nodeCode: string,
    nodeRevision: number,
    response: Record<string, unknown>,
    key: string,
    expectedCaseVersion = f.caseVersion
  ) {
    return app.inject({
      method: 'POST',
      url: `/api/v1/cases/${f.caseId}/scene/nodes/${nodeCode}/responses`,
      headers: {
        ...auth(f.manager.token),
        'idempotency-key': key,
      },
      payload: {
        expectedCaseVersion,
        expectedNodeRevision: nodeRevision,
        response,
      },
    });
  }

  async function installFaultTrigger(input: {
    table: string;
    timing: 'BEFORE' | 'AFTER';
    event: 'INSERT' | 'UPDATE';
    condition: string;
    label: string;
  }): Promise<() => Promise<void>> {
    const suffix = crypto.randomUUID().replaceAll('-', '');
    const fn = `du_fault_${input.label}_${suffix}`;
    const trigger = `du_fault_trigger_${input.label}_${suffix}`;
    await admin.query(
      `CREATE FUNCTION ${fn}() RETURNS trigger LANGUAGE plpgsql AS $$
       BEGIN
         IF ${input.condition} THEN
           RAISE EXCEPTION 'SLICE12_INJECTED_${input.label.toUpperCase()}_FAILURE';
         END IF;
         RETURN NEW;
       END $$`
    );
    await admin.query(
      `CREATE TRIGGER ${trigger}
         ${input.timing} ${input.event} ON ${input.table}
         FOR EACH ROW EXECUTE FUNCTION ${fn}()`
    );
    return async () => {
      await admin.query(`DROP TRIGGER IF EXISTS ${trigger} ON ${input.table}`);
      await admin.query(`DROP FUNCTION IF EXISTS ${fn}()`);
    };
  }

  async function makeUnder14Consent(
    f: Fixture,
    child: LoginResult
  ): Promise<{ consentId: string; noticeHash: string }> {
    const noticeHash=getCurrentNoticeHash();
    const request=await admin.query<{id:string}>(
      `INSERT INTO guardian_consent_requests
        (family_id,guardian_person_id,subject_person_id,declared_age_band,
         notice_version,notice_hash,status,expires_at,completed_at)
       VALUES ($1,$2,$3,'UNDER_14','v1',$4,'GRANTED',
               now()+interval '24 hours',now())
       RETURNING id`,
      [f.familyId,f.manager.personId,child.personId,noticeHash]
    );
    const evidence={
      channel:'TEST',
      accepted_text_hash:'a'.repeat(64),
      declared_age_band:'UNDER_14',
      client_ip_hash:'b'.repeat(64),
      user_agent_hash:'c'.repeat(64),
    };
    const consent=await admin.query<{id:string}>(
      `INSERT INTO consent_records
        (family_id,guardian_person_id,guardian_account_id,purpose,decision,version,
         onboarding_request_id,bound_person_id,bound_at,notice_version,notice_hash,
         policy_version,evidence)
       VALUES ($1,$2,$3,'UNDER_14_GUARDIAN_CONSENT','GRANTED',1,
               $4,$5,now(),'v1',$6,'v1',$7::jsonb)
       RETURNING id`,
      [
        f.familyId,f.manager.personId,f.manager.accountId,request.rows[0]!.id,
        child.personId,noticeHash,JSON.stringify(evidence),
      ]
    );
    await admin.query(
      `INSERT INTO person_compliance_profiles
         (person_id,age_band,minor_mode,guardian_person_id,
          guardian_consent_record_id,guardian_consent_version,verified_source)
       VALUES ($1,'UNDER_14',true,$2,$3,1,'GUARDIAN_RELAY')
       ON CONFLICT (person_id) DO UPDATE
         SET age_band='UNDER_14',
             minor_mode=true,
             guardian_person_id=EXCLUDED.guardian_person_id,
             guardian_consent_record_id=EXCLUDED.guardian_consent_record_id,
             guardian_consent_version=EXCLUDED.guardian_consent_version,
             verified_source='GUARDIAN_RELAY',
             updated_at=now()`,
      [child.personId,f.manager.personId,consent.rows[0]!.id]
    );
    return {consentId:consent.rows[0]!.id,noticeHash};
  }

  async function revokeUnder14Consent(
    f: Fixture,
    child: LoginResult,
    priorConsentId: string,
    noticeHash: string
  ): Promise<string> {
    const evidence={
      channel:'TEST',
      accepted_text_hash:'d'.repeat(64),
      declared_age_band:'UNDER_14',
      client_ip_hash:'e'.repeat(64),
      user_agent_hash:'f'.repeat(64),
    };
    const revoked=await admin.query<{id:string}>(
      `INSERT INTO consent_records
        (family_id,guardian_person_id,guardian_account_id,purpose,decision,version,
         onboarding_request_id,bound_person_id,bound_at,notice_version,notice_hash,
         policy_version,evidence,supersedes_id)
       VALUES ($1,$2,$3,'UNDER_14_GUARDIAN_CONSENT','REVOKED',2,
               NULL,$4,now(),'v1',$5,'v1',$6::jsonb,$7)
       RETURNING id`,
      [
        f.familyId,f.manager.personId,f.manager.accountId,child.personId,
        noticeHash,JSON.stringify(evidence),priorConsentId,
      ]
    );
    await admin.query(
      `UPDATE person_compliance_profiles
          SET guardian_consent_record_id=$2,
              guardian_consent_version=2,
              updated_at=now()
        WHERE person_id=$1`,
      [child.personId,revoked.rows[0]!.id]
    );
    return revoked.rows[0]!.id;
  }

  async function expectNodeUnchanged(
    f: Fixture,
    nodeCode: string,
    revision = 1
  ): Promise<void> {
    const node = await admin.query(
      `SELECT status, revision, output_refs
         FROM scene_node_states
        WHERE case_id=$1 AND node_code=$2`,
      [f.caseId, nodeCode]
    );
    expect(node.rows[0]).toMatchObject({
      status: 'AVAILABLE',
      revision,
      output_refs: [],
    });
  }

  async function expectNoNodeResponseIdempotency(f: Fixture): Promise<void> {
    const idem = await admin.query(
      `SELECT count(*)::int AS n
         FROM idempotency_keys
        WHERE command_type='DIGITAL_USE_NODE_RESPONSE'
          AND actor_account_id=$1`,
      [f.manager.accountId]
    );
    expect(idem.rows[0].n).toBe(0);
  }

  it('replays same key/result and rejects same key with a different canonical payload', async () => {
    const f = await fixture('idem');
    const key = `du-idem-${crypto.randomUUID()}`;
    const first = await respondA1001(f, key);
    expect(first.statusCode, first.body).toBe(200);
    expect(first.json().currentNode?.nodeCode).toBe('01002');

    const replay = await respondA1001(f, key);
    expect(replay.statusCode, replay.body).toBe(200);
    expect(replay.json()).toEqual(first.json());

    const mismatch = await respondA1001(f, key, a1001(true));
    expect(mismatch.statusCode, mismatch.body).toBe(409);
    expect(mismatch.json().code).toBe('IDEMPOTENCY_PAYLOAD_MISMATCH');

    const { rows } = await admin.query(
      `SELECT count(*)::int AS n
         FROM assertions
        WHERE case_id = $1
          AND content LIKE 'DUA:v1:a1001.%'`,
      [f.caseId]
    );
    expect(rows[0].n).toBe(7);
  });

  it('concurrent same-key responses serialize to one execution and replay the same result', async () => {
    const f = await fixture('same-key');
    const idem = `du-same-key-${crypto.randomUUID()}`;
    const [a, b] = await Promise.all([
      respondA1001(f, idem),
      respondA1001(f, idem),
    ]);
    expect([a.statusCode, b.statusCode].sort()).toEqual([200, 200]);
    expect(a.json()).toEqual(b.json());

    const { rows } = await admin.query(
      `SELECT
         (SELECT count(*)::int FROM assertions
           WHERE case_id=$1 AND content LIKE 'DUA:v1:a1001.%') AS evidence,
         (SELECT count(*)::int FROM case_events
           WHERE case_id=$1 AND event_type='CASE_DIGITAL_USE_NODE_COMPLETED'
             AND metadata->>'nodeCode'='A1001') AS events,
         (SELECT count(*)::int FROM idempotency_keys
           WHERE actor_account_id=$2 AND command_type='DIGITAL_USE_NODE_RESPONSE') AS idempotency`,
      [f.caseId, f.manager.accountId]
    );
    expect(rows[0]).toEqual({ evidence: 7, events: 1, idempotency: 1 });
  });

  it('allows only one winner for two concurrent responses at the same revision', async () => {
    const f = await fixture('race');
    const [a, b] = await Promise.all([
      respondA1001(f, `du-race-a-${crypto.randomUUID()}`),
      respondA1001(f, `du-race-b-${crypto.randomUUID()}`),
    ]);
    expect([a.statusCode, b.statusCode].sort()).toEqual([200, 409]);

    const scene = await app.inject({
      method: 'GET',
      url: `/api/v1/cases/${f.caseId}/scene`,
      headers: auth(f.manager.token),
    });
    expect(scene.statusCode).toBe(200);
    const body = scene.json();
    expect(body.currentNode?.nodeCode).toBe('01002');
    expect(body.nodes.filter((node: any) => node.nodeCode === '01002')).toHaveLength(1);

    const { rows } = await admin.query(
      `SELECT count(*)::int AS n
         FROM case_events
        WHERE case_id = $1
          AND event_type = 'CASE_DIGITAL_USE_NODE_COMPLETED'
          AND metadata->>'nodeCode' = 'A1001'`,
      [f.caseId]
    );
    expect(rows[0].n).toBe(1);
  });

  it('serializes mutually-exclusive A2004 branch responses to exactly one legal next node', async () => {
    const f = await fixture('branch-race');
    await forceSceneNode(f, 'A2004');

    const [yes, no] = await Promise.all([
      respondSceneNode(
        f,
        'A2004',
        1,
        { decision: 'YES' },
        `du-branch-yes-${crypto.randomUUID()}`
      ),
      respondSceneNode(
        f,
        'A2004',
        1,
        { decision: 'NO' },
        `du-branch-no-${crypto.randomUUID()}`
      ),
    ]);

    expect([yes.statusCode, no.statusCode].sort()).toEqual([200, 409]);
    const projected = await admin.query<{ node_code: string }>(
      `SELECT node_code
         FROM scene_node_states
        WHERE case_id=$1 AND node_code IN ('A2005','A2006')
        ORDER BY node_code`,
      [f.caseId]
    );
    expect(projected.rows).toHaveLength(1);
    expect(['A2005', 'A2006']).toContain(projected.rows[0]!.node_code);

    const currentFacts = await admin.query<{ n: number }>(
      `SELECT count(*)::int AS n
         FROM assertions a
        WHERE a.case_id=$1
          AND a.content LIKE 'DUA:v1:a2004.collaborative_duration:%'
          AND NOT EXISTS (
            SELECT 1 FROM assertions newer WHERE newer.supersedes_id=a.id
          )`,
      [f.caseId]
    );
    expect(currentFacts.rows[0]!.n).toBe(1);
  });

  it('revalidates a Safety transition that commits while the node writer waits on the Case lock', async () => {
    const f = await fixture('safety-race');
    const blocker = await admin.connect();
    try {
      await blocker.query('BEGIN');
      await blocker.query(
        `UPDATE cases SET status='SAFETY_HOLD' WHERE id=$1`,
        [f.caseId]
      );

      const pending = respondA1001(
        f,
        `du-safety-race-${crypto.randomUUID()}`
      );
      await new Promise((resolve) => setTimeout(resolve, 30));
      await blocker.query('COMMIT');

      const response = await pending;
      expect(response.statusCode, response.body).toBe(409);
      expect(response.json().code).toBe('SAFETY_HOLD_BLOCKED');

      const evidence = await admin.query<{ n: number }>(
        `SELECT count(*)::int AS n
           FROM assertions
          WHERE case_id=$1 AND content LIKE 'DUA:v1:a1001.%'`,
        [f.caseId]
      );
      expect(evidence.rows[0]!.n).toBe(0);
      await expectNodeUnchanged(f, 'A1001', f.nodeRevision);
      await expectNoNodeResponseIdempotency(f);
    } finally {
      await blocker.query('ROLLBACK').catch(() => undefined);
      blocker.release();
    }
  });

  it('revalidates a concurrent Common Core phase/version transition before writing Scene truth', async () => {
    const f = await fixture('phase-race');
    const blocker = await admin.connect();
    try {
      await blocker.query('BEGIN');
      await blocker.query(
        `UPDATE cases
            SET phase='PROBLEM_FORMULATION', version=version+1
          WHERE id=$1`,
        [f.caseId]
      );

      const pending = respondA1001(
        f,
        `du-phase-race-${crypto.randomUUID()}`
      );
      await new Promise((resolve) => setTimeout(resolve, 30));
      await blocker.query('COMMIT');

      const response = await pending;
      expect(response.statusCode, response.body).toBe(409);
      expect(['STALE_CASE_VERSION', 'CASE_PHASE_CONFLICT']).toContain(
        response.json().code
      );

      const evidence = await admin.query<{ n: number }>(
        `SELECT count(*)::int AS n
           FROM assertions
          WHERE case_id=$1 AND content LIKE 'DUA:v1:a1001.%'`,
        [f.caseId]
      );
      expect(evidence.rows[0]!.n).toBe(0);
      await expectNodeUnchanged(f, 'A1001', f.nodeRevision);
      await expectNoNodeResponseIdempotency(f);
    } finally {
      await blocker.query('ROLLBACK').catch(() => undefined);
      blocker.release();
    }
  });

  it('fault point 1/8: rolls back after Evidence write before Scene CAS', async () => {
    const f = await fixture('fault-evidence');
    const cleanup = await installFaultTrigger({
      table: 'scene_node_states',
      timing: 'BEFORE',
      event: 'UPDATE',
      condition: `NEW.case_id='${f.caseId}'::uuid AND NEW.node_code='A1001'`,
      label: 'evidence',
    });
    try {
      const failed = await respondA1001(f, `du-fault-evidence-${crypto.randomUUID()}`);
      expect(failed.statusCode).toBe(500);
      const evidence = await admin.query(
        `SELECT count(*)::int AS n FROM assertions
          WHERE case_id=$1 AND content LIKE 'DUA:v1:a1001.%'`,
        [f.caseId]
      );
      expect(evidence.rows[0].n).toBe(0);
      await expectNodeUnchanged(f, 'A1001', f.nodeRevision);
      await expectNoNodeResponseIdempotency(f);
    } finally {
      await cleanup();
    }
  });

  it('fault point 2/8: rolls back after A200401 marker is written into the completed node projection', async () => {
    const f = await fixture('fault-marker');
    await forceSceneNode(f, 'A2003');
    const cleanup = await installFaultTrigger({
      table: 'scene_node_states',
      timing: 'BEFORE',
      event: 'INSERT',
      condition: `NEW.case_id='${f.caseId}'::uuid AND NEW.node_code='A2004'`,
      label: 'marker',
    });
    try {
      const failed = await respondSceneNode(
        f,
        'A2003',
        1,
        {
          expectedDuration: { state: 'KNOWN', minutesPerDay: 90, certainty: 'ESTIMATE' },
          reason: { state: 'KNOWN', text: 'Reduce disruption around daily routines.' },
          priorMethods: { state: 'UNKNOWN' },
          observedEffect: { state: 'UNKNOWN' },
          difficulties: { state: 'KNOWN', text: 'Transitions are difficult.' },
        },
        `du-fault-marker-${crypto.randomUUID()}`
      );
      expect(failed.statusCode).toBe(500);
      const evidence = await admin.query(
        `SELECT count(*)::int AS n FROM assertions
          WHERE case_id=$1 AND content LIKE 'DUA:v1:a2003.%'`,
        [f.caseId]
      );
      expect(evidence.rows[0].n).toBe(0);
      await expectNodeUnchanged(f, 'A2003');
      const next = await admin.query(
        `SELECT count(*)::int AS n FROM scene_node_states
          WHERE case_id=$1 AND node_code='A2004'`,
        [f.caseId]
      );
      expect(next.rows[0].n).toBe(0);
      await expectNoNodeResponseIdempotency(f);
    } finally {
      await cleanup();
    }
  });

  it('fault point 3/8: rolls back a failing Scene artifact insertion', async () => {
    const f = await fixture('fault-artifact');
    await forceSceneNode(f, 'A2007');
    const cleanup = await installFaultTrigger({
      table: 'scene_artifacts',
      timing: 'BEFORE',
      event: 'INSERT',
      condition: `NEW.case_id='${f.caseId}'::uuid AND NEW.artifact_type='TIMELINE'`,
      label: 'artifact',
    });
    try {
      const failed = await respondSceneNode(
        f,
        'A2007',
        1,
        { timeline: { reviewDate: '2026-12-01', cadence: 'weekly' } },
        `du-fault-artifact-${crypto.randomUUID()}`
      );
      expect(failed.statusCode).toBe(500);
      const artifacts = await admin.query(
        `SELECT count(*)::int AS n FROM scene_artifacts
          WHERE case_id=$1 AND artifact_type='TIMELINE'`,
        [f.caseId]
      );
      expect(artifacts.rows[0].n).toBe(0);
      await expectNodeUnchanged(f, 'A2007');
      await expectNoNodeResponseIdempotency(f);
    } finally {
      await cleanup();
    }
  });

  it('fault point 4/8: rolls back after Scene CAS when next-node projection fails', async () => {
    const f = await fixture('fault-next');
    const cleanup = await installFaultTrigger({
      table: 'scene_node_states',
      timing: 'BEFORE',
      event: 'INSERT',
      condition: `NEW.case_id='${f.caseId}'::uuid AND NEW.node_code='01002'`,
      label: 'next_projection',
    });
    try {
      const failed = await respondA1001(f, `du-fault-next-${crypto.randomUUID()}`);
      expect(failed.statusCode).toBe(500);
      const evidence = await admin.query(
        `SELECT count(*)::int AS n FROM assertions
          WHERE case_id=$1 AND content LIKE 'DUA:v1:a1001.%'`,
        [f.caseId]
      );
      expect(evidence.rows[0].n).toBe(0);
      await expectNodeUnchanged(f, 'A1001', f.nodeRevision);
      const next = await admin.query(
        `SELECT count(*)::int AS n FROM scene_node_states
          WHERE case_id=$1 AND node_code='01002'`,
        [f.caseId]
      );
      expect(next.rows[0].n).toBe(0);
      await expectNoNodeResponseIdempotency(f);
    } finally {
      await cleanup();
    }
  });

  it('fault point 5/8: rolls back after router decision before audit/event', async () => {
    const f = await fixture('fault');
    const suffix = crypto.randomUUID().replaceAll('-', '');
    const fn = `du_fault_${suffix}`;
    const trigger = `du_fault_trigger_${suffix}`;
    await admin.query(
      `CREATE FUNCTION ${fn}() RETURNS trigger LANGUAGE plpgsql AS $$
       BEGIN
         IF NEW.case_id = '${f.caseId}'::uuid
            AND NEW.event_type = 'CASE_DIGITAL_USE_NODE_COMPLETED' THEN
           RAISE EXCEPTION 'SLICE12_INJECTED_EVENT_FAILURE';
         END IF;
         RETURN NEW;
       END $$`
    );
    await admin.query(
      `CREATE TRIGGER ${trigger}
         BEFORE INSERT ON case_events
         FOR EACH ROW EXECUTE FUNCTION ${fn}()`
    );

    try {
      const failed = await respondA1001(
        f,
        `du-fault-${crypto.randomUUID()}`
      );
      expect(failed.statusCode).toBe(500);

      const evidence = await admin.query(
        `SELECT count(*)::int AS n
           FROM assertions
          WHERE case_id = $1 AND content LIKE 'DUA:v1:a1001.%'`,
        [f.caseId]
      );
      expect(evidence.rows[0].n).toBe(0);

      const node = await admin.query(
        `SELECT status, revision, output_refs
           FROM scene_node_states
          WHERE case_id = $1 AND node_code = 'A1001'`,
        [f.caseId]
      );
      expect(node.rows[0]).toMatchObject({
        status: 'AVAILABLE',
        revision: f.nodeRevision,
        output_refs: [],
      });

      const idem = await admin.query(
        `SELECT count(*)::int AS n
           FROM idempotency_keys
          WHERE command_type = 'DIGITAL_USE_NODE_RESPONSE'
            AND actor_account_id = $1`,
        [f.manager.accountId]
      );
      expect(idem.rows[0].n).toBe(0);
    } finally {
      await admin.query(`DROP TRIGGER IF EXISTS ${trigger} ON case_events`);
      await admin.query(`DROP FUNCTION IF EXISTS ${fn}()`);
    }
  });

  it('fails after Evidence writes when the Scene CAS is fault-injected and rolls everything back', async () => {
    const f = await fixture('fault-cas');
    const suffix = crypto.randomUUID().replaceAll('-', '');
    const fn = `du_fault_cas_${suffix}`;
    const trigger = `du_fault_cas_trigger_${suffix}`;
    await admin.query(
      `CREATE FUNCTION ${fn}() RETURNS trigger LANGUAGE plpgsql AS $$
       BEGIN
         IF NEW.case_id = '${f.caseId}'::uuid AND NEW.node_code='A1001' THEN
           RAISE EXCEPTION 'SLICE12_AFTER_EVIDENCE_FAULT';
         END IF;
         RETURN NEW;
       END $$`
    );
    await admin.query(
      `CREATE TRIGGER ${trigger}
         BEFORE UPDATE ON scene_node_states
         FOR EACH ROW EXECUTE FUNCTION ${fn}()`
    );
    try {
      const failed = await respondA1001(f, `du-fault-cas-${crypto.randomUUID()}`);
      expect(failed.statusCode).toBe(500);
    } finally {
      await admin.query(`DROP TRIGGER IF EXISTS ${trigger} ON scene_node_states`);
      await admin.query(`DROP FUNCTION IF EXISTS ${fn}()`);
    }

    const facts = await admin.query(
      `SELECT
         (SELECT count(*)::int FROM assertions
           WHERE case_id=$1 AND content LIKE 'DUA:v1:a1001.%') AS evidence,
         (SELECT revision FROM scene_node_states
           WHERE case_id=$1 AND node_code='A1001') AS revision,
         (SELECT status::text FROM scene_node_states
           WHERE case_id=$1 AND node_code='A1001') AS status,
         (SELECT count(*)::int FROM idempotency_keys
           WHERE actor_account_id=$2 AND command_type='DIGITAL_USE_NODE_RESPONSE') AS idempotency`,
      [f.caseId, f.manager.accountId]
    );
    expect(facts.rows[0]).toEqual({
      evidence: 0,
      revision: f.nodeRevision,
      status: 'AVAILABLE',
      idempotency: 0,
    });
  });

  it('rolls back a completed CAS when the routed next-node projection insert fails', async () => {
    const f = await fixture('fault-next');
    const suffix = crypto.randomUUID().replaceAll('-', '');
    const fn = `du_fault_next_${suffix}`;
    const trigger = `du_fault_next_trigger_${suffix}`;
    await admin.query(
      `CREATE FUNCTION ${fn}() RETURNS trigger LANGUAGE plpgsql AS $$
       BEGIN
         IF NEW.case_id = '${f.caseId}'::uuid AND NEW.node_code='01002' THEN
           RAISE EXCEPTION 'SLICE12_AFTER_CAS_FAULT';
         END IF;
         RETURN NEW;
       END $$`
    );
    await admin.query(
      `CREATE TRIGGER ${trigger}
         BEFORE INSERT ON scene_node_states
         FOR EACH ROW EXECUTE FUNCTION ${fn}()`
    );
    try {
      const failed = await respondA1001(f, `du-fault-next-${crypto.randomUUID()}`);
      expect(failed.statusCode).toBe(500);
    } finally {
      await admin.query(`DROP TRIGGER IF EXISTS ${trigger} ON scene_node_states`);
      await admin.query(`DROP FUNCTION IF EXISTS ${fn}()`);
    }

    const facts = await admin.query(
      `SELECT
         (SELECT count(*)::int FROM assertions
           WHERE case_id=$1 AND content LIKE 'DUA:v1:a1001.%') AS evidence,
         (SELECT revision FROM scene_node_states
           WHERE case_id=$1 AND node_code='A1001') AS revision,
         (SELECT status::text FROM scene_node_states
           WHERE case_id=$1 AND node_code='A1001') AS status,
         (SELECT count(*)::int FROM scene_node_states
           WHERE case_id=$1 AND node_code='01002') AS next_nodes`,
      [f.caseId]
    );
    expect(facts.rows[0]).toEqual({
      evidence: 0,
      revision: f.nodeRevision,
      status: 'AVAILABLE',
      next_nodes: 0,
    });
  });

  it('rolls back after audit/event work but before idempotency completion', async () => {
    const f = await fixture('fault-after-audit');
    const suffix = crypto.randomUUID().replaceAll('-', '');
    const fn = `du_fault_audit_${suffix}`;
    const trigger = `du_fault_audit_trigger_${suffix}`;
    await admin.query(
      `CREATE FUNCTION ${fn}() RETURNS trigger LANGUAGE plpgsql AS $$
       BEGIN
         IF NEW.resource_id = '${f.caseId}'::uuid
            AND NEW.event_type='DIGITAL_USE_NODE_COMPLETED' THEN
           RAISE EXCEPTION 'SLICE12_AFTER_AUDIT_FAULT';
         END IF;
         RETURN NEW;
       END $$`
    );
    await admin.query(
      `CREATE TRIGGER ${trigger}
         AFTER INSERT ON business_audit_events
         FOR EACH ROW EXECUTE FUNCTION ${fn}()`
    );
    try {
      const failed = await respondA1001(f, `du-fault-audit-${crypto.randomUUID()}`);
      expect(failed.statusCode).toBe(500);
    } finally {
      await admin.query(`DROP TRIGGER IF EXISTS ${trigger} ON business_audit_events`);
      await admin.query(`DROP FUNCTION IF EXISTS ${fn}()`);
    }

    const facts = await admin.query(
      `SELECT
         (SELECT count(*)::int FROM assertions
           WHERE case_id=$1 AND content LIKE 'DUA:v1:a1001.%') AS evidence,
         (SELECT count(*)::int FROM case_events
           WHERE case_id=$1 AND event_type='CASE_DIGITAL_USE_NODE_COMPLETED') AS events,
         (SELECT count(*)::int FROM business_audit_events
           WHERE resource_id=$1 AND event_type='DIGITAL_USE_NODE_COMPLETED') AS audits,
         (SELECT count(*)::int FROM idempotency_keys
           WHERE actor_account_id=$2 AND command_type='DIGITAL_USE_NODE_RESPONSE') AS idempotency`,
      [f.caseId, f.manager.accountId]
    );
    expect(facts.rows[0]).toEqual({
      evidence: 0,
      events: 0,
      audits: 0,
      idempotency: 0,
    });
  });

  it('rolls back all business effects when idempotency completion itself fails', async () => {
    const f = await fixture('fault-idempotency');
    const suffix = crypto.randomUUID().replaceAll('-', '');
    const fn = `du_fault_idem_${suffix}`;
    const trigger = `du_fault_idem_trigger_${suffix}`;
    await admin.query(
      `CREATE FUNCTION ${fn}() RETURNS trigger LANGUAGE plpgsql AS $$
       BEGIN
         IF NEW.actor_account_id = '${f.manager.accountId}'::uuid
            AND NEW.command_type='DIGITAL_USE_NODE_RESPONSE' THEN
           RAISE EXCEPTION 'SLICE12_IDEMPOTENCY_COMPLETION_FAULT';
         END IF;
         RETURN NEW;
       END $$`
    );
    await admin.query(
      `CREATE TRIGGER ${trigger}
         BEFORE INSERT ON idempotency_keys
         FOR EACH ROW EXECUTE FUNCTION ${fn}()`
    );
    try {
      const failed = await respondA1001(f, `du-fault-idem-${crypto.randomUUID()}`);
      expect(failed.statusCode).toBe(500);
    } finally {
      await admin.query(`DROP TRIGGER IF EXISTS ${trigger} ON idempotency_keys`);
      await admin.query(`DROP FUNCTION IF EXISTS ${fn}()`);
    }

    const facts = await admin.query(
      `SELECT
         (SELECT count(*)::int FROM assertions
           WHERE case_id=$1 AND content LIKE 'DUA:v1:a1001.%') AS evidence,
         (SELECT revision FROM scene_node_states
           WHERE case_id=$1 AND node_code='A1001') AS revision,
         (SELECT count(*)::int FROM case_events
           WHERE case_id=$1 AND event_type='CASE_DIGITAL_USE_NODE_COMPLETED') AS events,
         (SELECT count(*)::int FROM business_audit_events
           WHERE resource_id=$1 AND event_type='DIGITAL_USE_NODE_COMPLETED') AS audits,
         (SELECT count(*)::int FROM idempotency_keys
           WHERE actor_account_id=$2 AND command_type='DIGITAL_USE_NODE_RESPONSE') AS idempotency`,
      [f.caseId, f.manager.accountId]
    );
    expect(facts.rows[0]).toEqual({
      evidence: 0,
      revision: f.nodeRevision,
      events: 0,
      audits: 0,
      idempotency: 0,
    });
  });

  it('rolls back 01003 Evidence and Scene state when the Problem Formulation owner insert fails', async () => {
    const f = await fixture('fault-pf');
    const a1001Result = await respondA1001(
      f,
      `du-pf-a1001-${crypto.randomUUID()}`,
      a1001(true)
    );
    expect(a1001Result.statusCode, a1001Result.body).toBe(200);
    let scene = a1001Result.json();
    expect(scene.currentNode?.nodeCode).toBe('01002');

    const r01002 = await app.inject({
      method: 'POST',
      url: `/api/v1/cases/${f.caseId}/scene/nodes/01002/responses`,
      headers: {
        ...auth(f.manager.token),
        'idempotency-key': `du-pf-01002-${crypto.randomUUID()}`,
      },
      payload: {
        expectedCaseVersion: scene.caseVersion,
        expectedNodeRevision: scene.currentNode.revision,
        response: { state: 'KNOWN', selections: ['A'] },
      },
    });
    expect(r01002.statusCode, r01002.body).toBe(200);
    scene = r01002.json();
    expect(scene.currentNode?.nodeCode).toBe('01003');

    const beforeCase = await admin.query<{ phase: string; version: number }>(
      `SELECT phase::text AS phase, version FROM cases WHERE id=$1`,
      [f.caseId]
    );
    const beforeNode = await admin.query<{ revision: number; status: string }>(
      `SELECT revision, status::text AS status
         FROM scene_node_states WHERE case_id=$1 AND node_code='01003'`,
      [f.caseId]
    );

    const suffix = crypto.randomUUID().replaceAll('-', '');
    const fn = `du_fault_pf_${suffix}`;
    const trigger = `du_fault_pf_trigger_${suffix}`;
    await admin.query(
      `CREATE FUNCTION ${fn}() RETURNS trigger LANGUAGE plpgsql AS $$
       BEGIN
         IF NEW.case_id = '${f.caseId}'::uuid THEN
           RAISE EXCEPTION 'SLICE12_PROBLEM_FORMULATION_OWNER_FAULT';
         END IF;
         RETURN NEW;
       END $$`
    );
    await admin.query(
      `CREATE TRIGGER ${trigger}
         BEFORE INSERT ON problem_formulations
         FOR EACH ROW EXECUTE FUNCTION ${fn}()`
    );

    try {
      const failed = await app.inject({
        method: 'POST',
        url: `/api/v1/cases/${f.caseId}/scene/nodes/01003/responses`,
        headers: {
          ...auth(f.manager.token),
          'idempotency-key': `du-pf-01003-${crypto.randomUUID()}`,
        },
        payload: {
          expectedCaseVersion: scene.caseVersion,
          expectedNodeRevision: scene.currentNode.revision,
          response: { state: 'KNOWN', selection: 'A' },
        },
      });
      expect(failed.statusCode, failed.body).toBe(500);
    } finally {
      await admin.query(`DROP TRIGGER IF EXISTS ${trigger} ON problem_formulations`);
      await admin.query(`DROP FUNCTION IF EXISTS ${fn}()`);
    }

    const afterCase = await admin.query<{ phase: string; version: number }>(
      `SELECT phase::text AS phase, version FROM cases WHERE id=$1`,
      [f.caseId]
    );
    expect(afterCase.rows[0]).toEqual(beforeCase.rows[0]);

    const afterNode = await admin.query<{ revision: number; status: string }>(
      `SELECT revision, status::text AS status
         FROM scene_node_states WHERE case_id=$1 AND node_code='01003'`,
      [f.caseId]
    );
    expect(afterNode.rows[0]).toEqual(beforeNode.rows[0]);

    const evidence = await admin.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM assertions
        WHERE case_id=$1 AND content LIKE 'DUA:v1:01003.family_relationship:%'`,
      [f.caseId]
    );
    expect(evidence.rows[0]!.n).toBe(0);

    const formulations = await admin.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM problem_formulations WHERE case_id=$1`,
      [f.caseId]
    );
    expect(formulations.rows[0]!.n).toBe(0);
  });

  it('rejects a manifest-valid but not-yet-reachable node read', async () => {
    const f = await fixture('unreachable');
    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/cases/${f.caseId}/scene/nodes/01002`,
      headers: auth(f.manager.token),
    });
    expect(response.statusCode, response.body).toBe(409);
    expect(response.json().code).toBe('SCENE_NODE_UNREACHABLE');
  });

  it('Slice 14 rejects illegal direct A4002/A4010 entry without creating stream truth', async () => {
    const f = await fixture('s14-illegal-direct-entry');
    for (const [nodeCode,response] of [
      ['A4002',{contentVersion:'phone-use-contract-v1',action:'ACKNOWLEDGE_TEMPLATE'}],
      ['A4010',{}],
    ] as const) {
      const attempted=await app.inject({
        method:'POST',
        url:`/api/v1/cases/${f.caseId}/scene/nodes/${nodeCode}/responses`,
        headers:commandHeaders(f.manager.token,`s14-illegal-${nodeCode.toLowerCase()}`),
        payload:{expectedCaseVersion:f.caseVersion,expectedNodeRevision:1,response},
      });
      expect(attempted.statusCode,attempted.body).toBe(409);
      expect(attempted.json().code).toBe('CASE_PHASE_CONFLICT');
    }
    const residue=await admin.query(
      `SELECT
         (SELECT count(*)::int FROM scene_node_states WHERE case_id=$1 AND node_code IN ('A4002','A4010')) AS nodes,
         (SELECT count(*)::int FROM digital_use_contract_versions WHERE case_id=$1) AS contracts,
         (SELECT count(*)::int FROM scene_artifacts WHERE case_id=$1 AND artifact_type LIKE 'PHONE_USE_%') AS artifacts`,
      [f.caseId]
    );
    expect(residue.rows[0]).toEqual({nodes:0,contracts:0,artifacts:0});
  });

  it('rejects a fabricated node without creating any Scene state', async () => {
    const f = await fixture('fabricated');
    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/cases/${f.caseId}/scene/nodes/FAKE_NODE`,
      headers: auth(f.manager.token),
    });
    expect(response.statusCode, response.body).toBe(404);
    expect(response.json().code).toBe('SCENE_NODE_NOT_FOUND');

    const { rows } = await admin.query(
      `SELECT count(*)::int AS n
         FROM scene_node_states
        WHERE case_id=$1 AND node_code='FAKE_NODE'`,
      [f.caseId]
    );
    expect(rows[0].n).toBe(0);
  });

  it('anti-enumerates cross-Family access and keeps A200401 non-addressable', async () => {
    const owner = await fixture('owner');
    const attacker = await loginWithLabel(app, 'du-hard-attacker');
    const family = await createFamily(app, attacker.token, 'du-hard-attacker');
    expect(family.statusCode).toBe(201);

    const cross = await app.inject({
      method: 'GET',
      url: `/api/v1/cases/${owner.caseId}/scene`,
      headers: auth(attacker.token),
    });
    expect(cross.statusCode).toBe(404);
    expect(cross.json().code).toBe('CASE_NOT_FOUND');
    expect(cross.body).not.toContain(owner.familyId);

    const marker = await app.inject({
      method: 'GET',
      url: `/api/v1/cases/${owner.caseId}/scene/nodes/A200401`,
      headers: auth(owner.manager.token),
    });
    expect(marker.statusCode).toBe(404);
    expect(marker.json().code).toBe('SCENE_NODE_NOT_FOUND');
  });

  it('does not grant Assessment visibility to an ACTIVE Case Participant', async () => {
    const owner = await fixture('participant-owner');
    const participant = await loginWithLabel(app, 'du-hard-participant');
    await admin.query(
      `INSERT INTO person_compliance_profiles
         (person_id, age_band, minor_mode, verified_source)
       VALUES ($1, 'ADULT', false, 'SELF_STATEMENT')
       ON CONFLICT (person_id) DO UPDATE
         SET age_band='ADULT', minor_mode=false, verified_source='SELF_STATEMENT'`,
      [participant.personId]
    );
    await admin.query(
      `INSERT INTO family_members (family_id, person_id)
       VALUES ($1,$2) ON CONFLICT DO NOTHING`,
      [owner.familyId, participant.personId]
    );
    const inviteHash = crypto.randomUUID().replaceAll('-', '').repeat(2);
    await admin.query(
      `INSERT INTO case_participants
         (family_id, case_id, person_id, state, invite_token_hash,
          invite_expires_at, created_by_person_id, accepted_at)
       VALUES ($1,$2,$3,'ACTIVE',$4,now() + interval '1 day',$5,now())`,
      [
        owner.familyId,
        owner.caseId,
        participant.personId,
        inviteHash,
        owner.manager.personId,
      ]
    );

    const read = await app.inject({
      method: 'GET',
      url: `/api/v1/cases/${owner.caseId}/scene`,
      headers: auth(participant.token),
    });
    expect(read.statusCode).toBe(404);
    expect(read.json().code).toBe('CASE_NOT_FOUND');
  });

  it('Safety Hold preempts an ordinary node response without leaving Evidence', async () => {
    const f = await fixture('safety');
    await admin.query(
      `UPDATE cases SET status='SAFETY_HOLD' WHERE id=$1`,
      [f.caseId]
    );
    const response = await respondA1001(
      f,
      `du-safety-${crypto.randomUUID()}`
    );
    expect(response.statusCode, response.body).toBe(409);
    expect(response.json().code).toBe('SAFETY_HOLD_BLOCKED');

    const evidence = await admin.query(
      `SELECT count(*)::int AS n FROM assertions
        WHERE case_id=$1 AND content LIKE 'DUA:v1:a1001.%'`,
      [f.caseId]
    );
    expect(evidence.rows[0].n).toBe(0);
  });

  it('a primary switch makes the old Assessment Case lose write authority', async () => {
    const f = await fixture('primary');
    const second = await createCase(app, f.manager.token, 'du-hard-primary-second');
    expect(second.statusCode).toBe(201);
    const secondId = second.json().id as string;

    const switched = await app.inject({
      method: 'POST',
      url: `/api/v1/cases/${secondId}/switch-primary`,
      headers: commandHeaders(f.manager.token, 'du-hard-switch'),
      payload: {
        reason: 'Switch primary for Slice 12 race proof',
        expectedPrimaryCaseId: f.caseId,
        expectedPrimaryVersion: f.caseVersion,
      },
    });
    expect(switched.statusCode, switched.body).toBe(200);

    const stale = await respondA1001(
      f,
      `du-old-primary-${crypto.randomUUID()}`
    );
    expect(stale.statusCode, stale.body).toBe(409);
    expect(['CASE_NOT_PRIMARY', 'STALE_CASE_VERSION']).toContain(stale.json().code);
  });

  it('fails closed on package drift and never silently rebinds Scene package truth', async () => {
    const f = await fixture('package');
    const drift = await admin.connect();
    try {
      await drift.query('BEGIN');
      await drift.query("SET LOCAL session_replication_role = 'replica'");
      await drift.query(
        `UPDATE scene_node_states
            SET scene_package_version='v999'
          WHERE case_id=$1`,
        [f.caseId]
      );
      await drift.query('COMMIT');
    } catch (error) {
      await drift.query('ROLLBACK');
      throw error;
    } finally {
      drift.release();
    }
    const response = await respondA1001(
      f,
      `du-package-${crypto.randomUUID()}`
    );
    expect(response.statusCode, response.body).toBe(409);
    expect(['STALE_SCENE_PACKAGE', 'SCENE_PACKAGE_MISMATCH']).toContain(
      response.json().code
    );

    const { rows } = await admin.query(
      `SELECT DISTINCT scene_package_version FROM scene_node_states WHERE case_id=$1`,
      [f.caseId]
    );
    expect(rows.map((row) => row.scene_package_version)).toEqual(['v999']);
  });

  it('fails closed when the current Slice 10 Compliance policy becomes unresolved', async () => {
    const f = await fixture('compliance');

    // Test-only policy fault injection. Production judgment immutability remains
    // intact; triggers are bypassed on this admin connection only, then the
    // reviewed value is restored in finally.
    const fault = await admin.connect();
    try {
      await fault.query('BEGIN');
      await fault.query("SET LOCAL session_replication_role = 'replica'");
      await fault.query(
        `UPDATE compliance_feature_policies
            SET anthropomorphic_applicability='UNKNOWN'
          WHERE feature_code='DIGITAL_USE_ASSESSMENT_RUNTIME'
            AND feature_contract_revision='v1'
            AND policy_version=1`
      );
      await fault.query('COMMIT');

      const response = await respondA1001(
        f,
        `du-compliance-${crypto.randomUUID()}`
      );
      expect(response.statusCode, response.body).toBe(409);
      expect(response.json().code).toBe('COMPLIANCE_BLOCKED');

      const evidence = await admin.query(
        `SELECT count(*)::int AS n FROM assertions
          WHERE case_id=$1 AND content LIKE 'DUA:v1:a1001.%'`,
        [f.caseId]
      );
      expect(evidence.rows[0].n).toBe(0);
    } finally {
      await fault.query('BEGIN');
      await fault.query("SET LOCAL session_replication_role = 'replica'");
      await fault.query(
        `UPDATE compliance_feature_policies
            SET anthropomorphic_applicability='NOT_APPLICABLE'
          WHERE feature_code='DIGITAL_USE_ASSESSMENT_RUNTIME'
            AND feature_contract_revision='v1'
            AND policy_version=1`
      );
      await fault.query('COMMIT');
      fault.release();
    }
  });

  it.each([
    ['TIMELINE', 'A2007'],
    ['SOLUTION_SUMMARY', 'A2010'],
  ] as const)(
    'serializes duplicate %s artifact revisions under concurrent inserts',
    async (artifactType, sourceNodeCode) => {
      const f = await fixture(`artifact-${artifactType.toLowerCase()}`);
      const runtimePool = new pg.Pool({
        connectionString: process.env['DATABASE_URL'],
        max: 2,
      });
      const first = await runtimePool.connect();
      const second = await runtimePool.connect();

      const enter = async (client: pg.PoolClient) => {
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
      };

      try {
        await enter(first);
        await enter(second);
        const input = {
          familyId: f.familyId,
          caseId: f.caseId,
          scenePackageVersion: 'v1',
          artifactType,
          schemaVersion: 'v1',
          sourceNodeCode,
          data: { concurrencyProof: true },
          ownerPersonId: f.manager.personId,
          sourceRefs: [] as const,
          revision: 1,
        };

        const inserted = await insertSceneArtifact(first, input);
        expect(inserted.revision).toBe(1);

        const secondAttempt = insertSceneArtifact(second, input);
        await new Promise((resolve) => setTimeout(resolve, 30));
        await first.query('COMMIT');
        await expect(secondAttempt).rejects.toMatchObject({ code: '23505' });
        await second.query('ROLLBACK');

        const rows = await admin.query<{ n: number }>(
          `SELECT count(*)::int AS n
             FROM scene_artifacts
            WHERE case_id=$1 AND artifact_type=$2 AND source_node_code=$3
              AND revision=1`,
          [f.caseId, artifactType, sourceNodeCode]
        );
        expect(rows.rows[0]!.n).toBe(1);
      } finally {
        await first.query('ROLLBACK').catch(() => undefined);
        await second.query('ROLLBACK').catch(() => undefined);
        first.release();
        second.release();
        await runtimePool.end();
      }
    }
  );

  it('rejects same-Family cross-Case Evidence refs at the authoritative repository boundary', async () => {
    const f = await fixture('cross-case');
    const second = await createCase(app, f.manager.token, 'du-hard-cross-case-second');
    expect(second.statusCode).toBe(201);
    const secondCaseId = second.json().id as string;

    const inserted = await admin.query<{ id: string }>(
      `INSERT INTO dialogue_messages
         (family_id, case_id, actor_account_id, source_person_id, content)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING id`,
      [
        f.familyId,
        secondCaseId,
        f.manager.accountId,
        f.manager.personId,
        'cross-case Evidence must never satisfy the first Case',
      ]
    );
    const foreignEvidenceId = inserted.rows[0]!.id;

    const runtimePool = new pg.Pool({
      connectionString: process.env['DATABASE_URL'],
      max: 1,
    });
    const client = await runtimePool.connect();
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
      await expect(
        validateSceneRefs(client, {
          familyId: f.familyId,
          caseId: f.caseId,
          refs: [{ type: 'DIALOGUE_MESSAGE', id: foreignEvidenceId }],
        })
      ).resolves.toBe(false);
      await client.query('ROLLBACK');
    } finally {
      client.release();
      await runtimePool.end();
    }
  });

  it('rechecks current Consent owner truth after 01004 grant and blocks 01000 after revocation', async () => {
    const f = await fixture('consent-revoke');

    const a1 = await respondA1001(f, `du-consent-a1001-${crypto.randomUUID()}`);
    expect(a1.statusCode, a1.body).toBe(200);
    let scene = a1.json();
    expect(scene.currentNode?.nodeCode).toBe('01002');

    const r01002 = await app.inject({
      method: 'POST',
      url: `/api/v1/cases/${f.caseId}/scene/nodes/01002/responses`,
      headers: { ...auth(f.manager.token), 'idempotency-key': `du-consent-01002-${crypto.randomUUID()}` },
      payload: {
        expectedCaseVersion: scene.caseVersion,
        expectedNodeRevision: scene.currentNode.revision,
        response: { state: 'KNOWN', selections: ['A'] },
      },
    });
    expect(r01002.statusCode, r01002.body).toBe(200);
    scene = r01002.json();
    expect(scene.currentNode?.nodeCode).toBe('01003');

    const r01003 = await app.inject({
      method: 'POST',
      url: `/api/v1/cases/${f.caseId}/scene/nodes/01003/responses`,
      headers: { ...auth(f.manager.token), 'idempotency-key': `du-consent-01003-${crypto.randomUUID()}` },
      payload: {
        expectedCaseVersion: scene.caseVersion,
        expectedNodeRevision: scene.currentNode.revision,
        response: { state: 'KNOWN', selection: 'B' },
      },
    });
    expect(r01003.statusCode, r01003.body).toBe(200);
    scene = r01003.json();
    expect(scene.currentNode?.nodeCode).toBe('A2002');

    const a2002 = await app.inject({
      method: 'POST',
      url: `/api/v1/cases/${f.caseId}/scene/nodes/A2002/responses`,
      headers: { ...auth(f.manager.token), 'idempotency-key': `du-consent-a2002-${crypto.randomUUID()}` },
      payload: {
        expectedCaseVersion: scene.caseVersion,
        expectedNodeRevision: scene.currentNode.revision,
        response: { choice: 'FURTHER_ASSESSMENT' },
      },
    });
    expect(a2002.statusCode, a2002.body).toBe(200);
    scene = a2002.json();
    expect(scene.currentNode?.nodeCode).toBe('01004');

    const granted = await app.inject({
      method: 'POST',
      url: `/api/v1/cases/${f.caseId}/scene/nodes/01004/responses`,
      headers: { ...auth(f.manager.token), 'idempotency-key': `du-consent-01004-${crypto.randomUUID()}` },
      payload: {
        expectedCaseVersion: scene.caseVersion,
        expectedNodeRevision: scene.currentNode.revision,
        response: {
          decision: 'GRANTED',
          confirmationStatementHash: 'a'.repeat(64),
        },
      },
    });
    expect(granted.statusCode, granted.body).toBe(200);
    scene = granted.json();
    expect(scene.currentNode?.nodeCode).toBe('01000');

    const current = await admin.query(
      `SELECT id, version
         FROM consent_records
        WHERE family_id=$1 AND case_id=$2
          AND purpose='DIGITAL_USE_SUPPLEMENTAL_ASSESSMENT'
          AND decision='GRANTED'
        ORDER BY version DESC LIMIT 1`,
      [f.familyId, f.caseId]
    );
    expect(current.rows).toHaveLength(1);

    const runtimePool = new pg.Pool({
      connectionString: process.env['DATABASE_URL'],
      max: 1,
    });
    try {
      await withRlsTransaction(
        runtimePool,
        {
          familyId: f.familyId,
          accountId: f.manager.accountId,
          personId: f.manager.personId,
          purpose: 'DIGITAL_USE_ASSESSMENT',
        },
        (tx) =>
          recordPurposeScopedConsentDecision(
            tx,
            {
              familyId: f.familyId,
              caseId: f.caseId,
              actor: {
                accountId: f.manager.accountId,
                personId: f.manager.personId,
              },
              purpose: DIGITAL_USE_SUPPLEMENTAL_ASSESSMENT,
              decision: 'REVOKED',
              expectedVersion: current.rows[0].version,
              disclosure: {
                reference: CURRENT_SUPPLEMENTAL_ASSESSMENT_DISCLOSURE.reference,
                version: CURRENT_SUPPLEMENTAL_ASSESSMENT_DISCLOSURE.version,
                hash: CURRENT_SUPPLEMENTAL_ASSESSMENT_DISCLOSURE.hash,
              },
              confirmationStatementHash: 'b'.repeat(64),
              sceneAuthorization: { nodeCode: '01004', verified: true },
              evidence: {
                clientIp: '203.0.113.42',
                userAgent: 'slice12-hardening/1.0',
                pepper: process.env['EVIDENCE_HASH_PEPPER'] ?? 'test-evidence-hash-pepper-fixture',
              },
            },
            APPROVED_SUPPLEMENTAL_ASSESSMENT_DISCLOSURE_AUTHORITY
          )
      );
    } finally {
      await runtimePool.end();
    }

    const blocked = await app.inject({
      method: 'POST',
      url: `/api/v1/cases/${f.caseId}/scene/nodes/01000/responses`,
      headers: { ...auth(f.manager.token), 'idempotency-key': `du-consent-01000-${crypto.randomUUID()}` },
      payload: {
        expectedCaseVersion: scene.caseVersion,
        expectedNodeRevision: scene.currentNode.revision,
        response: { category: 'EMOTION' },
      },
    });
    expect(blocked.statusCode, blocked.body).toBe(409);
    expect(blocked.json().code).toBe('SUPPLEMENTAL_ASSESSMENT_CONSENT_REQUIRED');

    const artifacts = await admin.query(
      `SELECT count(*)::int AS n
         FROM scene_artifacts
        WHERE case_id=$1 AND artifact_type='SUPPLEMENTAL_ASSESSMENT_BOUNDARY'`,
      [f.caseId]
    );
    expect(artifacts.rows[0].n).toBe(0);
  });

  it('fault point 6/8: rolls back during authoritative Problem Formulation handoff', async () => {
    const f = await fixture('fault-formulation');

    const first = await respondA1001(
      f,
      `du-fault-pf-a1001-${crypto.randomUUID()}`,
      a1001(true)
    );
    expect(first.statusCode, first.body).toBe(200);
    let scene = first.json();
    expect(scene.currentNode?.nodeCode).toBe('01002');

    const second = await respondSceneNode(
      f,
      '01002',
      scene.currentNode.revision,
      { state: 'KNOWN', selections: ['A'] },
      `du-fault-pf-01002-${crypto.randomUUID()}`,
      scene.caseVersion
    );
    expect(second.statusCode, second.body).toBe(200);
    scene = second.json();
    expect(scene.currentNode?.nodeCode).toBe('01003');

    const cleanup = await installFaultTrigger({
      table: 'problem_formulations',
      timing: 'BEFORE',
      event: 'INSERT',
      condition: `NEW.case_id='${f.caseId}'::uuid`,
      label: 'formulation',
    });
    try {
      const failed = await respondSceneNode(
        f,
        '01003',
        scene.currentNode.revision,
        { state: 'KNOWN', selection: 'A' },
        `du-fault-pf-01003-${crypto.randomUUID()}`,
        scene.caseVersion
      );
      expect(failed.statusCode).toBe(500);

      const kase = await admin.query(
        `SELECT phase FROM cases WHERE id=$1`,
        [f.caseId]
      );
      expect(kase.rows[0].phase).toBe('ASSESSMENT');

      const pf = await admin.query(
        `SELECT count(*)::int AS n FROM problem_formulations WHERE case_id=$1`,
        [f.caseId]
      );
      expect(pf.rows[0].n).toBe(0);

      const evidence = await admin.query(
        `SELECT count(*)::int AS n FROM assertions
          WHERE case_id=$1 AND content LIKE 'DUA:v1:01003.%'`,
        [f.caseId]
      );
      expect(evidence.rows[0].n).toBe(0);
      await expectNodeUnchanged(f, '01003');
    } finally {
      await cleanup();
    }
  });

  it('fault point 7/8: rolls back after audit/event and before idempotency completion', async () => {
    const f = await fixture('fault-idem-before');
    const cleanup = await installFaultTrigger({
      table: 'idempotency_keys',
      timing: 'BEFORE',
      event: 'INSERT',
      condition: `NEW.actor_account_id='${f.manager.accountId}'::uuid AND NEW.command_type='DIGITAL_USE_NODE_RESPONSE' AND NEW.response_status IS NOT NULL`,
      label: 'idem_before',
    });
    try {
      const failed = await respondA1001(
        f,
        `du-fault-idem-before-${crypto.randomUUID()}`
      );
      expect(failed.statusCode).toBe(500);

      const audit = await admin.query(
        `SELECT
           (SELECT count(*)::int FROM case_events
             WHERE case_id=$1 AND event_type='CASE_DIGITAL_USE_NODE_COMPLETED') AS events,
           (SELECT count(*)::int FROM business_audit_events
             WHERE resource_type='CASE' AND resource_id::text=$1::text
               AND event_type='DIGITAL_USE_NODE_COMPLETED') AS audits`,
        [f.caseId]
      );
      expect(audit.rows[0]).toEqual({ events: 0, audits: 0 });
      const evidence = await admin.query(
        `SELECT count(*)::int AS n FROM assertions
          WHERE case_id=$1 AND content LIKE 'DUA:v1:a1001.%'`,
        [f.caseId]
      );
      expect(evidence.rows[0].n).toBe(0);
      await expectNodeUnchanged(f, 'A1001', f.nodeRevision);
      await expectNoNodeResponseIdempotency(f);
    } finally {
      await cleanup();
    }
  });

  it('fault point 8/8: rolls back when idempotency completion fails after row insertion', async () => {
    const f = await fixture('fault-idem-after');
    const cleanup = await installFaultTrigger({
      table: 'idempotency_keys',
      timing: 'AFTER',
      event: 'INSERT',
      condition: `NEW.actor_account_id='${f.manager.accountId}'::uuid AND NEW.command_type='DIGITAL_USE_NODE_RESPONSE' AND NEW.response_status IS NOT NULL`,
      label: 'idem_after',
    });
    try {
      const failed = await respondA1001(
        f,
        `du-fault-idem-after-${crypto.randomUUID()}`
      );
      expect(failed.statusCode).toBe(500);

      const audit = await admin.query(
        `SELECT
           (SELECT count(*)::int FROM case_events
             WHERE case_id=$1 AND event_type='CASE_DIGITAL_USE_NODE_COMPLETED') AS events,
           (SELECT count(*)::int FROM business_audit_events
             WHERE resource_type='CASE' AND resource_id::text=$1::text
               AND event_type='DIGITAL_USE_NODE_COMPLETED') AS audits`,
        [f.caseId]
      );
      expect(audit.rows[0]).toEqual({ events: 0, audits: 0 });
      await expectNodeUnchanged(f, 'A1001', f.nodeRevision);
      await expectNoNodeResponseIdempotency(f);
    } finally {
      await cleanup();
    }
  });

  it('rejects client route/package authority fields before business execution', async () => {
    const f = await fixture('authority');
    const attacked = await respondA1001(
      f,
      `du-authority-${crypto.randomUUID()}`,
      a1001(false),
      {
        nextNode: 'A3000',
        familyId: '00000000-0000-7000-8000-000000000999',
        scenePackageVersion: 'client-v99',
        subjectPersonId: '00000000-0000-7000-8000-000000000998',
        visibility: 'PUBLIC',
        purpose: 'GUARDIAN_CONSENT',
      }
    );
    expect(attacked.statusCode).toBe(422);

    const node = await app.inject({
      method: 'GET',
      url: `/api/v1/cases/${f.caseId}/scene/nodes/A1001`,
      headers: auth(f.manager.token),
    });
    expect(node.statusCode).toBe(200);
    expect(node.json().node.status).toBe('AVAILABLE');
    expect(node.json().node.revision).toBe(f.nodeRevision);
  });

  it('Slice 14 A4001 records wrong-answer attempts, explains them, and only routes on all-correct retry', async () => {
    const f = await fixture('s14-quiz');
    await forceSceneNode(f, 'A4001');

    const wrong = await respondSceneNode(
      f,
      'A4001',
      1,
      {
        contentVersion: 'phone-use-contract-v1',
        answers: [true, true, true, true, true],
      },
      `s14-quiz-wrong-${crypto.randomUUID()}`
    );
    expect(wrong.statusCode, wrong.body).toBe(200);
    expect(wrong.json().currentNode?.nodeCode).toBe('A4001');

    const wrongArtifacts = await admin.query<{
      revision: number;
      all_correct: string;
      results: unknown;
    }>(
      `SELECT revision, data->>'allCorrect' AS all_correct, data->'results' AS results
         FROM scene_artifacts
        WHERE case_id=$1 AND artifact_type='PHONE_USE_CONTRACT_QUIZ_ATTEMPT'
        ORDER BY revision`,
      [f.caseId]
    );
    expect(wrongArtifacts.rows).toHaveLength(1);
    expect(wrongArtifacts.rows[0]!.all_correct).toBe('false');
    expect(wrongArtifacts.rows[0]!.results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ correct: false, explanation: expect.any(String) }),
      ])
    );

    const correct = await respondSceneNode(
      f,
      'A4001',
      wrong.json().currentNode.revision,
      {
        contentVersion: 'phone-use-contract-v1',
        answers: [true, false, false, false, false],
      },
      `s14-quiz-correct-${crypto.randomUUID()}`
    );
    expect(correct.statusCode, correct.body).toBe(200);
    expect(correct.json().currentNode?.nodeCode).toBe('A4002');

    const attempts = await admin.query(
      `SELECT revision, data->>'allCorrect' AS all_correct,
              data->>'actorPersonId' AS actor_person_id,
              data->>'actorAccountId' AS actor_account_id
         FROM scene_artifacts
        WHERE case_id=$1 AND artifact_type='PHONE_USE_CONTRACT_QUIZ_ATTEMPT'
        ORDER BY revision`,
      [f.caseId]
    );
    expect(attempts.rows.map((row) => row.all_correct)).toEqual(['false','true']);
    expect(attempts.rows[1]).toMatchObject({
      actor_person_id: f.manager.personId,
      actor_account_id: f.manager.accountId,
    });

    const acknowledged = await respondSceneNode(
      f,
      'A4002',
      correct.json().currentNode.revision,
      { contentVersion: 'phone-use-contract-v1', action: 'ACKNOWLEDGE_TEMPLATE' },
      `s14-template-${crypto.randomUUID()}`,
      correct.json().caseVersion
    );
    expect(acknowledged.statusCode, acknowledged.body).toBe(200);
    expect(acknowledged.json().currentNode?.nodeCode).toBe('A4003');

    for (const suffix of ['template','examples'] as const) {
      const asset = await app.inject({
        method: 'GET',
        url: `/api/v1/cases/${f.caseId}/digital-use/contract/${suffix}`,
        headers: auth(f.manager.token),
      });
      expect(asset.statusCode, asset.body).toBe(200);
      expect(asset.json().meta).toMatchObject({
        contentVersion: 'phone-use-contract-v1',
        sourceBlob: '97a8db200013746faff64230ab7cbf5f15b41615',
        approved: true,
      });
    }
  });

  it('Slice 14 production A4003 is truthfully unavailable and writes no fake session', async () => {
    const f = await fixture('s14-roleplay-unavailable');
    await forceSceneNode(f, 'A4003');

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/cases/${f.caseId}/digital-use/roleplays`,
      headers: commandHeaders(f.manager.token, 's14-roleplay-unavailable'),
      payload: {
        expectedCaseVersion: f.caseVersion,
        professionalContentVersion: 'phone-use-contract-v1',
      },
    });
    expect(response.statusCode, response.body).toBe(409);
    expect(response.json().code).toBe('DOWNSTREAM_AI_UNAVAILABLE');

    const rows = await admin.query(
      `SELECT count(*)::int AS n FROM roleplay_sessions WHERE case_id=$1`,
      [f.caseId]
    );
    expect(rows.rows[0].n).toBe(0);
  });

  it('Slice 14 A4003 denies MINOR and UNKNOWN actors before adapter/session creation', async () => {
    for (const [label,ageBand,expectedCode] of [
      ['minor','MINOR_14_17','FORBIDDEN'],
      ['unknown','UNKNOWN','AGE_BAND_UNKNOWN'],
    ] as const) {
      const f = await fixture(`s14-roleplay-${label}`);
      await forceSceneNode(f,'A4003');
      await admin.query(
        `UPDATE person_compliance_profiles
            SET age_band=$2::age_band,
                minor_mode=CASE WHEN $2::text='MINOR_14_17' THEN true ELSE false END,
                guardian_person_id=NULL,
                guardian_consent_record_id=NULL,
                guardian_consent_version=NULL,
                verified_source='SELF_STATEMENT',
                updated_at=now()
          WHERE person_id=$1`,
        [f.manager.personId,ageBand]
      );

      const response = await app.inject({
        method:'POST',
        url:`/api/v1/cases/${f.caseId}/digital-use/roleplays`,
        headers:commandHeaders(f.manager.token,`s14-roleplay-${label}-deny`),
        payload:{
          expectedCaseVersion:f.caseVersion,
          professionalContentVersion:'phone-use-contract-v1',
        },
      });
      expect(response.statusCode,response.body).toBe(403);
      expect(response.json().code).toBe(expectedCode);

      const sessions=await admin.query(
        `SELECT count(*)::int AS n FROM roleplay_sessions WHERE case_id=$1`,
        [f.caseId]
      );
      expect(sessions.rows[0].n).toBe(0);
    }
  });

  it('Slice 14 test-only deterministic A4003 remains SIMULATION and routes through the official Manifest', async () => {
    const adapter: RoleplayAdapter = {
      adapterRef: 'test:deterministic-roleplay-v1',
      async isAvailable() { return true; },
      async createTurn(input) {
        return {
          simulatedParentOutput: `simulated-parent:${input.simulatedChildInput}`,
          adapterRef: 'test:deterministic-roleplay-v1',
          modelRef: 'test-model',
          promptVersionRef: 'test-prompt-v1',
        };
      },
    };
    const roleplayApp = await buildApp({ phoneUseContract: { roleplayAdapter: adapter } });
    await roleplayApp.ready();
    try {
      const f = await fixture('s14-roleplay-positive', roleplayApp);
      await forceSceneNode(f, 'A4003');

      const created = await roleplayApp.inject({
        method: 'POST',
        url: `/api/v1/cases/${f.caseId}/digital-use/roleplays`,
        headers: commandHeaders(f.manager.token, 's14-roleplay-create'),
        payload: {
          expectedCaseVersion: f.caseVersion,
          professionalContentVersion: 'phone-use-contract-v1',
        },
      });
      expect(created.statusCode, created.body).toBe(201);
      expect(created.json()).toMatchObject({
        simulationRole: 'ADULT_PLAYS_CHILD_AI_SIMULATES_PARENT',
        status: 'OPEN',
        adapterRef: 'test:deterministic-roleplay-v1',
      });

      const turn = await roleplayApp.inject({
        method: 'POST',
        url: `/api/v1/cases/${f.caseId}/digital-use/roleplays/${created.json().id}/turns`,
        headers: commandHeaders(f.manager.token, 's14-roleplay-turn'),
        payload: {
          expectedCaseVersion: f.caseVersion,
          expectedSessionRevision: created.json().revision,
          simulatedChildInput: 'I want to keep using the phone.',
        },
      });
      expect(turn.statusCode, turn.body).toBe(201);
      expect(turn.json()).toMatchObject({
        provenance: 'SIMULATION',
        modelRef: 'test-model',
        promptVersionRef: 'test-prompt-v1',
      });

      const turn2 = await roleplayApp.inject({
        method:'POST',
        url:`/api/v1/cases/${f.caseId}/digital-use/roleplays/${created.json().id}/turns`,
        headers:commandHeaders(f.manager.token,'s14-roleplay-turn-2'),
        payload:{
          expectedCaseVersion:f.caseVersion,
          expectedSessionRevision:created.json().revision,
          simulatedChildInput:'What if I disagree with the first option?',
        },
      });
      expect(turn2.statusCode,turn2.body).toBe(201);
      expect(turn2.json().roundNumber).toBe(2);

      const rated = await roleplayApp.inject({
        method: 'POST',
        url: `/api/v1/cases/${f.caseId}/digital-use/roleplays/${created.json().id}/rate`,
        headers: commandHeaders(f.manager.token, 's14-roleplay-rate'),
        payload: {
          expectedCaseVersion: f.caseVersion,
          turnId: turn.json().id,
          rating: 5,
        },
      });
      expect(rated.statusCode, rated.body).toBe(200);
      expect(rated.json().userRating).toBe(5);

      const beforeAssertions = await admin.query(
        `SELECT count(*)::int AS n FROM assertions WHERE case_id=$1`,
        [f.caseId]
      );
      const selected = await roleplayApp.inject({
        method: 'POST',
        url: `/api/v1/cases/${f.caseId}/digital-use/roleplays/${created.json().id}/select`,
        headers: commandHeaders(f.manager.token, 's14-roleplay-select'),
        payload: {
          expectedCaseVersion: f.caseVersion,
          expectedSessionRevision: created.json().revision,
          turnId: turn.json().id,
          expectedNodeRevision: 1,
        },
      });
      expect(selected.statusCode, selected.body).toBe(200);
      expect(selected.json().selectedTurn.provenance).toBe('SIMULATION');

      const scene = await admin.query(
        `SELECT node_code,status FROM scene_node_states
          WHERE case_id=$1 AND node_code IN ('A4003','A4004')
          ORDER BY node_code`,
        [f.caseId]
      );
      expect(scene.rows).toEqual([
        { node_code: 'A4003', status: 'COMPLETED' },
        { node_code: 'A4004', status: 'AVAILABLE' },
      ]);
      const projection = await admin.query(
        `SELECT data FROM scene_artifacts
          WHERE case_id=$1 AND artifact_type='PHONE_USE_ROLEPLAY_SELECTION'`,
        [f.caseId]
      );
      expect(projection.rows).toHaveLength(1);
      expect(projection.rows[0].data).toMatchObject({
        roleplaySessionId: created.json().id,
        selectedTurnId: turn.json().id,
        provenance: 'SIMULATION',
      });
      const afterAssertions = await admin.query(
        `SELECT count(*)::int AS n FROM assertions WHERE case_id=$1`,
        [f.caseId]
      );
      expect(afterAssertions.rows[0].n).toBe(beforeAssertions.rows[0].n);
      const childTruth = await admin.query(
        `SELECT count(*)::int AS contracts
           FROM digital_use_contract_versions
          WHERE case_id=$1`,
        [f.caseId]
      );
      expect(childTruth.rows[0].contracts).toBe(0);

      const completedScene=await admin.query(
        `SELECT revision FROM scene_node_states WHERE case_id=$1 AND node_code='A4003'`,
        [f.caseId]
      );
      const correctionRequest=(key:string)=>roleplayApp.inject({
        method:'POST',
        url:`/api/v1/cases/${f.caseId}/digital-use/roleplays/${created.json().id}/select`,
        headers:commandHeaders(f.manager.token,key),
        payload:{
          expectedCaseVersion:f.caseVersion,
          expectedSessionRevision:selected.json().session.revision,
          turnId:turn2.json().id,
          expectedNodeRevision:completedScene.rows[0].revision,
        },
      });
      const [correctionA,correctionB]=await Promise.all([
        correctionRequest('s14-roleplay-select-correction-a'),
        correctionRequest('s14-roleplay-select-correction-b'),
      ]);
      expect([correctionA.statusCode,correctionB.statusCode].sort()).toEqual([200,409]);
      const correctedSelection=correctionA.statusCode===200?correctionA:correctionB;
      const correctionLoser=correctionA.statusCode===409?correctionA:correctionB;
      expect(correctedSelection.json().selectedTurn.id).toBe(turn2.json().id);
      expect(correctionLoser.json().code).toBe('STALE_NODE_REVISION');

      const selectionHistory=await admin.query(
        `SELECT id,revision,supersedes_id,data FROM scene_artifacts
          WHERE case_id=$1 AND artifact_type='PHONE_USE_ROLEPLAY_SELECTION'
          ORDER BY revision`,
        [f.caseId]
      );
      expect(selectionHistory.rows).toHaveLength(2);
      expect(selectionHistory.rows[1]).toMatchObject({
        revision:2,
        supersedes_id:selectionHistory.rows[0].id,
      });
      expect(selectionHistory.rows[1].data.selectedTurnId).toBe(turn2.json().id);
      const downstream=await admin.query(
        `SELECT count(*)::int AS n FROM scene_node_states
          WHERE case_id=$1 AND node_code='A4004'`,
        [f.caseId]
      );
      expect(downstream.rows[0].n).toBe(1);
    } finally {
      await roleplayApp.close();
    }
  });

  it('Slice 14 A4004–A4009 stay independently re-enterable, typed, sourced and correction-safe', async () => {
    const f = await fixture('s14-tools');
    await forceSceneNode(f, 'A4004');

    const catalog = await respondSceneNode(
      f, 'A4004', 1, { tool: 'DURATION' },
      `s14-tools-catalog-${crypto.randomUUID()}`
    );
    expect(catalog.statusCode, catalog.body).toBe(200);

    const duration = await respondSceneNode(
      f, 'A4005', 1,
      {
        duration: { state: 'VALUE', value: 'Weekdays 30 minutes after homework' },
        sourceRefs: [{ type: 'DIALOGUE_MESSAGE', id: f.messageId }],
        reportedPerspective: 'PARENT_REPORT_OF_CHILD_VIEW',
      },
      `s14-tools-duration-${crypto.randomUUID()}`
    );
    expect(duration.statusCode, duration.body).toBe(200);

    const noForcedA4006 = await admin.query(
      `SELECT count(*)::int AS n FROM scene_node_states
        WHERE case_id=$1 AND node_code='A4006'`,
      [f.caseId]
    );
    expect(noForcedA4006.rows[0].n).toBe(0);

    const firstDuration = await admin.query(
      `SELECT id,revision,supersedes_id,source_refs,data
         FROM scene_artifacts
        WHERE case_id=$1 AND artifact_type='PHONE_USE_DURATION_COMPONENT'
        ORDER BY revision`,
      [f.caseId]
    );
    expect(firstDuration.rows).toHaveLength(1);
    expect(firstDuration.rows[0]).toMatchObject({revision:1,supersedes_id:null});
    expect(firstDuration.rows[0].source_refs).toEqual(
      expect.arrayContaining([{ type:'DIALOGUE_MESSAGE', id:f.messageId }])
    );
    expect(firstDuration.rows[0].data).toMatchObject({
      reportedPerspective:'PARENT_REPORT_OF_CHILD_VIEW',
      sourceAttribution:'AUTHENTICATED_PARENT_ACTOR',
      actorPersonId:f.manager.personId,
      provenance:'AUTHENTICATED_ACTOR_INPUT',
      contentVersion:'phone-use-contract-v1',
    });

    const durationState = await admin.query(
      `SELECT revision FROM scene_node_states WHERE case_id=$1 AND node_code='A4005'`,
      [f.caseId]
    );
    const correctionPayload = {
      duration: { state: 'VALUE', value: 'Weekdays 20 minutes after homework' },
      sourceRefs: [{ type: 'DIALOGUE_MESSAGE', id: f.messageId }],
      reportedPerspective: 'JOINT_DISCUSSION_REPORTED_BY_PARENT',
    };
    const [correctedA, correctedB] = await Promise.all([
      respondSceneNode(
        f, 'A4005', durationState.rows[0].revision, correctionPayload,
        `s14-tools-duration-correct-a-${crypto.randomUUID()}`
      ),
      respondSceneNode(
        f, 'A4005', durationState.rows[0].revision, correctionPayload,
        `s14-tools-duration-correct-b-${crypto.randomUUID()}`
      ),
    ]);
    expect([correctedA.statusCode, correctedB.statusCode].sort()).toEqual([200,409]);
    const correctionLoser = correctedA.statusCode === 409 ? correctedA : correctedB;
    expect(correctionLoser.json().code).toBe('STALE_NODE_REVISION');

    const durationHistory = await admin.query(
      `SELECT id,revision,supersedes_id,data
         FROM scene_artifacts
        WHERE case_id=$1 AND artifact_type='PHONE_USE_DURATION_COMPONENT'
        ORDER BY revision`,
      [f.caseId]
    );
    expect(durationHistory.rows).toHaveLength(2);
    expect(durationHistory.rows[1]).toMatchObject({
      revision:2,
      supersedes_id:durationHistory.rows[0].id,
    });
    expect(durationHistory.rows[1].data.duration.value)
      .toBe('Weekdays 20 minutes after homework');

    // Scene reads must consume the same Manifest re-entry truth as the write
    // path: A4005 is completed but USER_INITIATED/help re-entry remains legal.
    const reentryProjection=await app.inject({
      method:'GET',
      url:`/api/v1/cases/${f.caseId}/scene`,
      headers:auth(f.manager.token),
    });
    expect(reentryProjection.statusCode,reentryProjection.body).toBe(200);
    expect(
      reentryProjection.json().reachableNodes.map((node:{nodeCode:string})=>node.nodeCode)
    ).toContain('A4005');

    const stale = await respondSceneNode(
      f, 'A4005', durationState.rows[0].revision,
      {
        duration: { state: 'VALUE', value: 'stale overwrite' },
        sourceRefs: [{ type: 'DIALOGUE_MESSAGE', id: f.messageId }],
        reportedPerspective: 'PARENT_INPUT',
      },
      `s14-tools-duration-stale-${crypto.randomUUID()}`
    );
    expect(stale.statusCode, stale.body).toBe(409);
    expect(stale.json().code).toBe('STALE_NODE_REVISION');

    const independent = [
      ['A4006', {
        action:'CONFIGURE',
        measures:['Review screen-time together once per evening'],
        sourceRefs:[{type:'DIALOGUE_MESSAGE',id:f.messageId}],
      }, 'PHONE_USE_SUPERVISION_COMPONENT'],
      ['A4007', {
        incentive:{state:'VALUE',value:'Choose a weekend family activity'},
        sourceRefs:[{type:'DIALOGUE_MESSAGE',id:f.messageId}],
      }, 'PHONE_USE_INCENTIVE_COMPONENT'],
      ['A4008', {
        responsibility:{state:'VALUE',value:'Discuss the reason and adjust the plan'},
        sourceRefs:[{type:'DIALOGUE_MESSAGE',id:f.messageId}],
      }, 'PHONE_USE_BREACH_COMPONENT'],
      ['A4009', {
        commitments:['Parent puts own phone away during dinner'],
        methods:['Use a visible charging place outside the dining area'],
        sourceRefs:[{type:'DIALOGUE_MESSAGE',id:f.messageId}],
      }, 'PARENT_SELF_REGULATION_CHECKLIST'],
    ] as const;

    for (const [nodeCode,response,artifactType] of independent) {
      const saved = await respondSceneNode(
        f,nodeCode,1,response as unknown as Record<string,unknown>,
        `s14-tools-${nodeCode.toLowerCase()}-${crypto.randomUUID()}`
      );
      expect(saved.statusCode, `${nodeCode}: ${saved.body}`).toBe(200);
      const artifact = await admin.query(
        `SELECT data,source_refs FROM scene_artifacts
          WHERE case_id=$1 AND artifact_type=$2 ORDER BY revision DESC LIMIT 1`,
        [f.caseId,artifactType]
      );
      expect(artifact.rows).toHaveLength(1);
      expect(artifact.rows[0].data).toMatchObject({
        actorPersonId:f.manager.personId,
        provenance:'AUTHENTICATED_ACTOR_INPUT',
        contentVersion:'phone-use-contract-v1',
      });
      expect(artifact.rows[0].source_refs).toEqual(
        expect.arrayContaining([{type:'DIALOGUE_MESSAGE',id:f.messageId}])
      );
    }

    const supervisionLogState = await admin.query(
      `SELECT revision FROM scene_node_states WHERE case_id=$1 AND node_code='A4006'`,
      [f.caseId]
    );
    const logged = await respondSceneNode(
      f,'A4006',supervisionLogState.rows[0].revision,
      {
        action:'LOG',
        note:'Reviewed together; no Common Core Checkin was created.',
        sourceRefs:[{type:'DIALOGUE_MESSAGE',id:f.messageId}],
      },
      `s14-tools-supervision-log-${crypto.randomUUID()}`
    );
    expect(logged.statusCode, logged.body).toBe(200);
    const logArtifact = await admin.query(
      `SELECT data FROM scene_artifacts
        WHERE case_id=$1 AND artifact_type='PHONE_USE_SUPERVISION_LOG'`
      ,[f.caseId]
    );
    expect(logArtifact.rows).toHaveLength(1);

    const contractRows = await admin.query(
      `SELECT count(*)::int AS n FROM digital_use_contract_versions WHERE case_id=$1`,
      [f.caseId]
    );
    expect(contractRows.rows[0].n).toBe(0);
  });

  it('Slice 14 formal Contract requires independent party confirmations and activates atomically', async () => {
    const f = await fixture('s14-contract');
    const child = await loginWithLabel(app, `s14-contract-child-${crypto.randomUUID()}`);
    await admin.query(
      `INSERT INTO person_compliance_profiles
         (person_id,age_band,minor_mode,verified_source)
       VALUES ($1,'ADULT',false,'SELF_STATEMENT')
       ON CONFLICT (person_id) DO UPDATE
         SET age_band='ADULT',minor_mode=false,verified_source='SELF_STATEMENT',updated_at=now()`,
      [child.personId]
    );
    await admin.query(
      `INSERT INTO family_members(family_id,person_id) VALUES($1,$2) ON CONFLICT DO NOTHING`,
      [f.familyId,child.personId]
    );
    const participation = await admin.query<{ id: string }>(
      `INSERT INTO case_participants
         (family_id,case_id,person_id,state,invite_token_hash,invite_expires_at,created_by_person_id,accepted_at)
       VALUES($1,$2,$3,'ACTIVE',$4,now()+interval '1 day',$5,now())
       RETURNING id`,
      [f.familyId,f.caseId,child.personId,crypto.randomUUID().replaceAll('-','').repeat(2),f.manager.personId]
    );

    await forceSceneNode(f, 'A4004');
    await admin.query(
      `UPDATE scene_node_states SET status='COMPLETED',completed_at=now(),revision=revision+1
        WHERE case_id=$1 AND node_code='A4004'`,
      [f.caseId]
    );

    const term = (value: string) => ({ state: 'VALUE', value });
    const terms = {
      purpose: term('共同减少无目的刷手机'),
      phoneUseRules: term('晚饭后使用 30 分钟'),
      executionPeriod: term('两周'),
      parentSupportMeasures: term('家长同步减少无目的使用'),
      supervisionMeasures: term('共同查看屏幕时间'),
      incentives: term('周末共同活动'),
      breachResponsibilities: term('复盘原因并调整'),
    };
    const draft = await app.inject({
      method:'POST',
      url:`/api/v1/cases/${f.caseId}/digital-use/contract/drafts`,
      headers:commandHeaders(f.manager.token,'s14-contract-draft'),
      payload:{
        expectedCaseVersion:f.caseVersion,
        adultPartyPersonId:f.manager.personId,
        childPartyPersonId:child.personId,
        childParticipationId:participation.rows[0]!.id,
        sourceTemplateVersion:'phone-use-contract-v1',
        dependencyRefs:[],
        terms,
      },
    });
    expect(draft.statusCode,draft.body).toBe(201);
    expect(draft.json()).toMatchObject({version:1,draftRevision:1,status:'DRAFT'});

    const adultKey=`s14-adult-confirm-${crypto.randomUUID()}`;
    const adult = await app.inject({
      method:'POST',
      url:`/api/v1/cases/${f.caseId}/digital-use/contract/1/confirm`,
      headers:{...auth(f.manager.token),'idempotency-key':adultKey},
      payload:{expectedCaseVersion:f.caseVersion,expectedDraftRevision:1},
    });
    expect(adult.statusCode,adult.body).toBe(200);
    expect(adult.json().status).toBe('PENDING_CONFIRMATION');
    expect(adult.json().parentConfirmation).toMatchObject({
      kind:'ADULT',
      personId:f.manager.personId,
      authorizationAction:'CASE_RESPOND_ASSESSMENT_SCENE',
    });
    expect(adult.json().childConfirmation).toBeNull();

    const adultDuplicate = await app.inject({
      method:'POST',
      url:`/api/v1/cases/${f.caseId}/digital-use/contract/1/confirm`,
      headers:commandHeaders(f.manager.token,'s14-adult-confirm-duplicate'),
      payload:{expectedCaseVersion:f.caseVersion,expectedDraftRevision:1},
    });
    expect(adultDuplicate.statusCode,adultDuplicate.body).toBe(200);
    expect(adultDuplicate.json().parentConfirmation.confirmedAt)
      .toBe(adult.json().parentConfirmation.confirmedAt);

    const beforeChild = await admin.query(
      `SELECT count(*)::int AS n FROM business_audit_events
        WHERE resource_id=$1 AND event_type='PHONE_USE_CONTRACT_CONFIRMED'
          AND metadata->>'party'='ADULT'`,
      [f.caseId]
    );
    expect(beforeChild.rows[0].n).toBe(1);

    const childConfirm = await app.inject({
      method:'POST',
      url:`/api/v1/cases/${f.caseId}/digital-use/contract/1/confirm`,
      headers:commandHeaders(child.token,'s14-child-confirm'),
      payload:{expectedCaseVersion:f.caseVersion,expectedDraftRevision:1},
    });
    expect(childConfirm.statusCode,childConfirm.body).toBe(200);
    expect(childConfirm.json().status).toBe('ACTIVE');
    expect(childConfirm.json().childConfirmation).toMatchObject({
      kind:'CHILD',
      personId:child.personId,
      participationId:participation.rows[0]!.id,
      authorizationAction:'PHONE_USE_CONTRACT_CONFIRM_SELF',
    });

    const facts = await admin.query(
      `SELECT
        (SELECT count(*)::int FROM digital_use_contract_versions WHERE case_id=$1 AND status='ACTIVE') AS active,
        (SELECT count(*)::int FROM scene_artifacts WHERE case_id=$1 AND artifact_type='PHONE_USE_CONTRACT_DOCUMENT') AS documents,
        (SELECT status FROM scene_node_states WHERE case_id=$1 AND node_code='A4010') AS a4010,
        (SELECT status FROM scene_node_states WHERE case_id=$1 AND node_code='A4011') AS a4011`,
      [f.caseId]
    );
    expect(facts.rows[0]).toEqual({
      active:1,
      documents:1,
      a4010:'COMPLETED',
      a4011:'AVAILABLE',
    });

    const childRead = await app.inject({
      method:'GET',
      url:`/api/v1/cases/${f.caseId}/digital-use/contract/current`,
      headers:auth(child.token),
    });
    expect(childRead.statusCode,childRead.body).toBe(200);
    expect(childRead.json().id).toBe(childConfirm.json().id);

    const faq=await app.inject({
      method:'GET',
      url:`/api/v1/cases/${f.caseId}/digital-use/contract/faq`,
      headers:auth(f.manager.token),
    });
    expect(faq.statusCode,faq.body).toBe(200);
    expect(faq.json().contract).toEqual({
      id:childConfirm.json().id,
      version:1,
      status:'ACTIVE',
    });
    expect(faq.json().topics.length).toBeGreaterThanOrEqual(15);

    const supportFaq=await respondSceneNode(
      f,'A4011',1,
      {
        action:'FAQ_VIEWED',
        topic:'CONTRACT_DURATION',
        contractVersionId:childConfirm.json().id,
        contractVersion:1,
      },
      `s14-support-faq-${crypto.randomUUID()}`
    );
    expect(supportFaq.statusCode,supportFaq.body).toBe(200);
    const supportState=await admin.query(
      `SELECT revision,status FROM scene_node_states
        WHERE case_id=$1 AND node_code='A4011'`,
      [f.caseId]
    );
    expect(supportState.rows[0]).toMatchObject({revision:2,status:'IN_PROGRESS'});

    const aiUnavailable=await respondSceneNode(
      f,'A4011',2,
      {
        action:'PERSONALIZED_AI_SUPPORT',
        prompt:'How should I discuss tonight?',
        contractVersionId:childConfirm.json().id,
        contractVersion:1,
      },
      `s14-support-ai-${crypto.randomUUID()}`
    );
    expect(aiUnavailable.statusCode,aiUnavailable.body).toBe(409);
    expect(aiUnavailable.json().code).toBe('DOWNSTREAM_AI_UNAVAILABLE');

    const reminderUnavailable=await respondSceneNode(
      f,'A4011',2,
      {
        action:'FOLLOWUP_REMINDER',
        contractVersionId:childConfirm.json().id,
        contractVersion:1,
      },
      `s14-support-reminder-${crypto.randomUUID()}`
    );
    expect(reminderUnavailable.statusCode,reminderUnavailable.body).toBe(409);
    expect(reminderUnavailable.json().code).toBe('PHONE_USE_FOLLOWUP_DOWNSTREAM_UNAVAILABLE');

    const beforeToolReentry=await admin.query(
      `SELECT status,draft_revision,phone_use_rules,parent_confirmation,child_confirmation
         FROM digital_use_contract_versions
        WHERE id=$1`,
      [childConfirm.json().id]
    );
    const catalogState=await admin.query(
      `SELECT revision,status FROM scene_node_states WHERE case_id=$1 AND node_code='A4004'`,
      [f.caseId]
    );
    expect(catalogState.rows[0].status).toBe('COMPLETED');

    const reenteredCatalog=await respondSceneNode(
      f,'A4004',catalogState.rows[0].revision,
      {tool:'INCENTIVE'},
      `s14-support-tool-reentry-${crypto.randomUUID()}`
    );
    expect(reenteredCatalog.statusCode,reenteredCatalog.body).toBe(200);
    const incentiveNode=await admin.query(
      `SELECT status FROM scene_node_states WHERE case_id=$1 AND node_code='A4007'`,
      [f.caseId]
    );
    expect(incentiveNode.rows[0].status).toBe('AVAILABLE');

    const afterToolReentry=await admin.query(
      `SELECT status,draft_revision,phone_use_rules,parent_confirmation,child_confirmation
         FROM digital_use_contract_versions
        WHERE id=$1`,
      [childConfirm.json().id]
    );
    expect(afterToolReentry.rows[0]).toEqual(beforeToolReentry.rows[0]);

    await admin.query(`UPDATE cases SET status='SAFETY_HOLD' WHERE id=$1`,[f.caseId]);
    const safetyBlocked=await respondSceneNode(
      f,'A4011',2,
      {
        action:'FAQ_VIEWED',
        topic:'CONTRACT_DURATION',
        contractVersionId:childConfirm.json().id,
        contractVersion:1,
      },
      `s14-support-safety-${crypto.randomUUID()}`
    );
    expect(safetyBlocked.statusCode,safetyBlocked.body).toBe(409);
    expect(safetyBlocked.json().code).toBe('SAFETY_HOLD_BLOCKED');

    const historical=await admin.query(
      `SELECT status,draft_revision,phone_use_rules,parent_confirmation,child_confirmation
         FROM digital_use_contract_versions WHERE id=$1`,
      [childConfirm.json().id]
    );
    expect(historical.rows[0]).toEqual(beforeToolReentry.rows[0]);
  });

  it('Slice 14 Contract idempotency, draft CAS and activation races converge without duplicate truth', async () => {
    const f=await fixture('s14-contract-races');
    const child=await loginWithLabel(app,`s14-races-child-${crypto.randomUUID()}`);
    await admin.query(
      `INSERT INTO person_compliance_profiles(person_id,age_band,minor_mode,verified_source)
       VALUES($1,'ADULT',false,'SELF_STATEMENT')
       ON CONFLICT(person_id) DO UPDATE
         SET age_band='ADULT',minor_mode=false,verified_source='SELF_STATEMENT',updated_at=now()`,
      [child.personId]
    );
    await admin.query(
      `INSERT INTO family_members(family_id,person_id) VALUES($1,$2) ON CONFLICT DO NOTHING`,
      [f.familyId,child.personId]
    );
    const participation=await admin.query<{id:string}>(
      `INSERT INTO case_participants
         (family_id,case_id,person_id,state,invite_token_hash,invite_expires_at,created_by_person_id,accepted_at)
       VALUES($1,$2,$3,'ACTIVE',$4,now()+interval '1 day',$5,now())
       RETURNING id`,
      [f.familyId,f.caseId,child.personId,crypto.randomUUID().replaceAll('-','').repeat(2),f.manager.personId]
    );
    await forceSceneNode(f,'A4004');
    await admin.query(
      `UPDATE scene_node_states
          SET status='COMPLETED',completed_at=now(),revision=revision+1
        WHERE case_id=$1 AND node_code='A4004'`,
      [f.caseId]
    );
    const v=(value:string)=>({state:'VALUE' as const,value});
    const terms={
      purpose:v('p'),phoneUseRules:v('r'),executionPeriod:v('e'),
      parentSupportMeasures:v('s'),supervisionMeasures:v('m'),
      incentives:v('i'),breachResponsibilities:v('b'),
    };
    const draftPayload={
      expectedCaseVersion:f.caseVersion,
      adultPartyPersonId:f.manager.personId,
      childPartyPersonId:child.personId,
      childParticipationId:participation.rows[0]!.id,
      sourceTemplateVersion:'phone-use-contract-v1',
      dependencyRefs:[],
      terms,
    };
    const draftKey=`s14-races-draft-${crypto.randomUUID()}`;
    const first=await app.inject({
      method:'POST',url:`/api/v1/cases/${f.caseId}/digital-use/contract/drafts`,
      headers:commandHeaders(f.manager.token,draftKey),payload:draftPayload,
    });
    expect(first.statusCode,first.body).toBe(201);
    const replay=await app.inject({
      method:'POST',url:`/api/v1/cases/${f.caseId}/digital-use/contract/drafts`,
      headers:commandHeaders(f.manager.token,draftKey),payload:draftPayload,
    });
    expect(replay.statusCode,replay.body).toBe(201);
    expect(replay.json().id).toBe(first.json().id);

    const mismatch=await app.inject({
      method:'POST',url:`/api/v1/cases/${f.caseId}/digital-use/contract/drafts`,
      headers:commandHeaders(f.manager.token,draftKey),
      payload:{...draftPayload,terms:{...terms,phoneUseRules:v('different')}},
    });
    expect(mismatch.statusCode,mismatch.body).toBe(409);
    expect(mismatch.json().code).toBe('IDEMPOTENCY_PAYLOAD_MISMATCH');

    const patchPayload={
      expectedCaseVersion:f.caseVersion,
      expectedDraftRevision:1,
      dependencyRefs:[],
      terms:{...terms,phoneUseRules:v('race winner')},
    };
    const [patchA,patchB]=await Promise.all([
      app.inject({
        method:'PATCH',url:`/api/v1/cases/${f.caseId}/digital-use/contract/drafts/1`,
        headers:commandHeaders(f.manager.token,'s14-races-patch-a'),payload:patchPayload,
      }),
      app.inject({
        method:'PATCH',url:`/api/v1/cases/${f.caseId}/digital-use/contract/drafts/1`,
        headers:commandHeaders(f.manager.token,'s14-races-patch-b'),payload:patchPayload,
      }),
    ]);
    expect([patchA.statusCode,patchB.statusCode].sort()).toEqual([200,409]);
    const patchLoser=patchA.statusCode===409?patchA:patchB;
    expect(patchLoser.json().code).toBe('PHONE_USE_CONTRACT_STALE_REVISION');

    const childKey=`s14-races-child-confirm-${crypto.randomUUID()}`;
    const childPending=await app.inject({
      method:'POST',url:`/api/v1/cases/${f.caseId}/digital-use/contract/1/confirm`,
      headers:commandHeaders(child.token,childKey),
      payload:{expectedCaseVersion:f.caseVersion,expectedDraftRevision:2},
    });
    expect(childPending.statusCode,childPending.body).toBe(200);
    expect(childPending.json().status).toBe('PENDING_CONFIRMATION');
    expect(childPending.json().parentConfirmation).toBeNull();

    const adultRequest=(key:string)=>app.inject({
      method:'POST',url:`/api/v1/cases/${f.caseId}/digital-use/contract/1/confirm`,
      headers:commandHeaders(f.manager.token,key),
      payload:{expectedCaseVersion:f.caseVersion,expectedDraftRevision:2},
    });
    const [adultA,adultB]=await Promise.all([
      adultRequest('s14-races-adult-a'),
      adultRequest('s14-races-adult-b'),
    ]);
    expect([adultA.statusCode,adultB.statusCode]).toEqual([200,200]);
    expect(adultA.json().status).toBe('ACTIVE');
    expect(adultB.json().status).toBe('ACTIVE');
    expect(adultA.json().id).toBe(adultB.json().id);

    const childReplay=await app.inject({
      method:'POST',url:`/api/v1/cases/${f.caseId}/digital-use/contract/1/confirm`,
      headers:commandHeaders(child.token,childKey),
      payload:{expectedCaseVersion:f.caseVersion,expectedDraftRevision:2},
    });
    expect(childReplay.statusCode,childReplay.body).toBe(200);
    expect(childReplay.json()).toEqual(childPending.json());

    const childMismatch=await app.inject({
      method:'POST',url:`/api/v1/cases/${f.caseId}/digital-use/contract/1/confirm`,
      headers:commandHeaders(child.token,childKey),
      payload:{expectedCaseVersion:f.caseVersion,expectedDraftRevision:3},
    });
    expect(childMismatch.statusCode,childMismatch.body).toBe(409);
    expect(childMismatch.json().code).toBe('IDEMPOTENCY_PAYLOAD_MISMATCH');

    const truth=await admin.query(
      `SELECT
        (SELECT count(*)::int FROM digital_use_contract_versions WHERE case_id=$1 AND status='ACTIVE') AS active,
        (SELECT count(*)::int FROM scene_artifacts WHERE case_id=$1 AND artifact_type='PHONE_USE_CONTRACT_DOCUMENT') AS documents,
        (SELECT count(*)::int FROM business_audit_events WHERE resource_id=$1 AND event_type='PHONE_USE_CONTRACT_CONFIRMED' AND metadata->>'party'='ADULT') AS adult_confirms,
        (SELECT count(*)::int FROM business_audit_events WHERE resource_id=$1 AND event_type='PHONE_USE_CONTRACT_CONFIRMED' AND metadata->>'party'='CHILD') AS child_confirms`,
      [f.caseId]
    );
    expect(truth.rows[0]).toEqual({active:1,documents:1,adult_confirms:1,child_confirms:1});
  });

  it('Slice 14 blocks UNDER_14 Contract processing when guardian Consent is missing', async () => {
    const f=await fixture('s14-consent-missing');
    const child=await loginWithLabel(app,`s14-consent-missing-child-${crypto.randomUUID()}`);
    await admin.query(
      `INSERT INTO family_members(family_id,person_id) VALUES($1,$2) ON CONFLICT DO NOTHING`,
      [f.familyId,child.personId]
    );
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
      [child.personId,f.manager.personId]
    );
    const p=await admin.query<{id:string}>(
      `INSERT INTO case_participants
        (family_id,case_id,person_id,state,invite_token_hash,invite_expires_at,created_by_person_id,accepted_at)
       VALUES($1,$2,$3,'ACTIVE',$4,now()+interval '1 day',$5,now()) RETURNING id`,
      [f.familyId,f.caseId,child.personId,crypto.randomUUID().replaceAll('-','').repeat(2),f.manager.personId]
    );
    await forceSceneNode(f,'A4004');
    await admin.query(
      `UPDATE scene_node_states
          SET status='COMPLETED',completed_at=now(),revision=revision+1
        WHERE case_id=$1 AND node_code='A4004'`,
      [f.caseId]
    );
    const v=(value:string)=>({state:'VALUE',value});
    const terms={
      purpose:v('p'),phoneUseRules:v('r'),executionPeriod:v('e'),
      parentSupportMeasures:v('s'),supervisionMeasures:v('m'),
      incentives:v('i'),breachResponsibilities:v('b'),
    };
    const blocked=await app.inject({
      method:'POST',
      url:`/api/v1/cases/${f.caseId}/digital-use/contract/drafts`,
      headers:commandHeaders(f.manager.token,'s14-consent-missing-draft'),
      payload:{
        expectedCaseVersion:f.caseVersion,
        adultPartyPersonId:f.manager.personId,
        childPartyPersonId:child.personId,
        childParticipationId:p.rows[0]!.id,
        sourceTemplateVersion:'phone-use-contract-v1',
        dependencyRefs:[],
        terms,
      },
    });
    expect(blocked.statusCode,blocked.body).toBe(409);
    expect(blocked.json().code).toBe('PHONE_USE_CONTRACT_CONSENT_BLOCKED');
    const rows=await admin.query(
      `SELECT count(*)::int AS n FROM digital_use_contract_versions WHERE case_id=$1`,
      [f.caseId]
    );
    expect(rows.rows[0].n).toBe(0);
  });

  it('Slice 14 Consent revoked before Contract commit blocks confirmation with zero success write', async () => {
    const f=await fixture('s14-consent-revoked-before-commit');
    const child=await loginWithLabel(app,`s14-consent-revoked-before-commit-child-${crypto.randomUUID()}`);
    await admin.query(
      `INSERT INTO family_members(family_id,person_id) VALUES($1,$2) ON CONFLICT DO NOTHING`,
      [f.familyId,child.personId]
    );
    const consent=await makeUnder14Consent(f,child);
    const p=await admin.query<{id:string}>(
      `INSERT INTO case_participants
        (family_id,case_id,person_id,state,invite_token_hash,invite_expires_at,created_by_person_id,accepted_at)
       VALUES($1,$2,$3,'ACTIVE',$4,now()+interval '1 day',$5,now()) RETURNING id`,
      [f.familyId,f.caseId,child.personId,crypto.randomUUID().replaceAll('-','').repeat(2),f.manager.personId]
    );
    await forceSceneNode(f,'A4004');
    await admin.query(
      `UPDATE scene_node_states
          SET status='COMPLETED',completed_at=now(),revision=revision+1
        WHERE case_id=$1 AND node_code='A4004'`,
      [f.caseId]
    );
    const v=(value:string)=>({state:'VALUE',value});
    const terms={
      purpose:v('p'),phoneUseRules:v('r'),executionPeriod:v('e'),
      parentSupportMeasures:v('s'),supervisionMeasures:v('m'),
      incentives:v('i'),breachResponsibilities:v('b'),
    };
    const draft=await app.inject({
      method:'POST',url:`/api/v1/cases/${f.caseId}/digital-use/contract/drafts`,
      headers:commandHeaders(f.manager.token,'s14-consent-revoked-before-commit-draft'),
      payload:{
        expectedCaseVersion:f.caseVersion,adultPartyPersonId:f.manager.personId,
        childPartyPersonId:child.personId,childParticipationId:p.rows[0]!.id,
        sourceTemplateVersion:'phone-use-contract-v1',dependencyRefs:[],terms,
      },
    });
    expect(draft.statusCode,draft.body).toBe(201);

    await revokeUnder14Consent(f,child,consent.consentId,consent.noticeHash);

    const blocked=await app.inject({
      method:'POST',url:`/api/v1/cases/${f.caseId}/digital-use/contract/1/confirm`,
      headers:commandHeaders(f.manager.token,'s14-consent-revoked-before-commit-confirm'),
      payload:{expectedCaseVersion:f.caseVersion,expectedDraftRevision:1},
    });
    expect(blocked.statusCode,blocked.body).toBe(409);
    expect(blocked.json().code).toBe('PHONE_USE_CONTRACT_CONSENT_BLOCKED');

    const truth=await admin.query(
      `SELECT status,parent_confirmation,child_confirmation
         FROM digital_use_contract_versions WHERE case_id=$1 AND version=1`,
      [f.caseId]
    );
    expect(truth.rows).toEqual([{status:'DRAFT',parent_confirmation:null,child_confirmation:null}]);
    const residue=await admin.query(
      `SELECT
         (SELECT count(*)::int FROM scene_artifacts WHERE case_id=$1 AND artifact_type='PHONE_USE_CONTRACT_DOCUMENT') AS documents,
         (SELECT count(*)::int FROM business_audit_events
           WHERE resource_id=$1 AND event_type IN ('PHONE_USE_CONTRACT_CONFIRMED','PHONE_USE_CONTRACT_ACTIVATED')) AS success_audits`,
      [f.caseId]
    );
    expect(residue.rows[0]).toEqual({documents:0,success_audits:0});
  });

  it('Slice 14 Consent revocation blocks future support but preserves historical ACTIVE Contract truth', async () => {
    const f=await fixture('s14-consent-revoked');
    const child=await loginWithLabel(app,`s14-consent-revoked-child-${crypto.randomUUID()}`);
    await admin.query(
      `INSERT INTO family_members(family_id,person_id) VALUES($1,$2) ON CONFLICT DO NOTHING`,
      [f.familyId,child.personId]
    );
    const consent=await makeUnder14Consent(f,child);
    const p=await admin.query<{id:string}>(
      `INSERT INTO case_participants
        (family_id,case_id,person_id,state,invite_token_hash,invite_expires_at,created_by_person_id,accepted_at)
       VALUES($1,$2,$3,'ACTIVE',$4,now()+interval '1 day',$5,now()) RETURNING id`,
      [f.familyId,f.caseId,child.personId,crypto.randomUUID().replaceAll('-','').repeat(2),f.manager.personId]
    );
    await forceSceneNode(f,'A4004');
    await admin.query(
      `UPDATE scene_node_states
          SET status='COMPLETED',completed_at=now(),revision=revision+1
        WHERE case_id=$1 AND node_code='A4004'`,
      [f.caseId]
    );
    const v=(value:string)=>({state:'VALUE',value});
    const terms={
      purpose:v('p'),phoneUseRules:v('r'),executionPeriod:v('e'),
      parentSupportMeasures:v('s'),supervisionMeasures:v('m'),
      incentives:v('i'),breachResponsibilities:v('b'),
    };
    const draft=await app.inject({
      method:'POST',url:`/api/v1/cases/${f.caseId}/digital-use/contract/drafts`,
      headers:commandHeaders(f.manager.token,'s14-consent-revoked-draft'),
      payload:{
        expectedCaseVersion:f.caseVersion,adultPartyPersonId:f.manager.personId,
        childPartyPersonId:child.personId,childParticipationId:p.rows[0]!.id,
        sourceTemplateVersion:'phone-use-contract-v1',dependencyRefs:[],terms,
      },
    });
    expect(draft.statusCode,draft.body).toBe(201);
    const adult=await app.inject({
      method:'POST',url:`/api/v1/cases/${f.caseId}/digital-use/contract/1/confirm`,
      headers:commandHeaders(f.manager.token,'s14-consent-revoked-adult'),
      payload:{expectedCaseVersion:f.caseVersion,expectedDraftRevision:1},
    });
    expect(adult.statusCode,adult.body).toBe(200);
    const childConfirm=await app.inject({
      method:'POST',url:`/api/v1/cases/${f.caseId}/digital-use/contract/1/confirm`,
      headers:commandHeaders(child.token,'s14-consent-revoked-child-confirm'),
      payload:{expectedCaseVersion:f.caseVersion,expectedDraftRevision:1},
    });
    expect(childConfirm.statusCode,childConfirm.body).toBe(200);
    expect(childConfirm.json().status).toBe('ACTIVE');

    await revokeUnder14Consent(f,child,consent.consentId,consent.noticeHash);

    const blocked=await app.inject({
      method:'GET',
      url:`/api/v1/cases/${f.caseId}/digital-use/contract/faq`,
      headers:auth(f.manager.token),
    });
    expect(blocked.statusCode,blocked.body).toBe(409);
    expect(blocked.json().code).toBe('PHONE_USE_CONTRACT_CONSENT_BLOCKED');

    const history=await admin.query(
      `SELECT status,activated_at,superseded_at
         FROM digital_use_contract_versions
        WHERE case_id=$1 AND version=1`,
      [f.caseId]
    );
    expect(history.rows[0].status).toBe('ACTIVE');
    expect(history.rows[0].activated_at).not.toBeNull();
    expect(history.rows[0].superseded_at).toBeNull();
    const docs=await admin.query(
      `SELECT count(*)::int AS n FROM scene_artifacts
        WHERE case_id=$1 AND artifact_type='PHONE_USE_CONTRACT_DOCUMENT'`,
      [f.caseId]
    );
    expect(docs.rows[0].n).toBe(1);
  });

  it('Slice 14 activation fault rolls child confirmation back with Scene/Contract truth', async () => {
    const f = await fixture('s14-contract-fault');
    const child = await loginWithLabel(app, `s14-fault-child-${crypto.randomUUID()}`);
    await admin.query(
      `INSERT INTO person_compliance_profiles(person_id,age_band,minor_mode,verified_source)
       VALUES($1,'ADULT',false,'SELF_STATEMENT')
       ON CONFLICT(person_id) DO UPDATE SET age_band='ADULT',minor_mode=false,verified_source='SELF_STATEMENT'`,
      [child.personId]
    );
    await admin.query(`INSERT INTO family_members(family_id,person_id) VALUES($1,$2) ON CONFLICT DO NOTHING`,[f.familyId,child.personId]);
    const p=await admin.query<{id:string}>(
      `INSERT INTO case_participants(family_id,case_id,person_id,state,invite_token_hash,invite_expires_at,created_by_person_id,accepted_at)
       VALUES($1,$2,$3,'ACTIVE',$4,now()+interval '1 day',$5,now()) RETURNING id`,
      [f.familyId,f.caseId,child.personId,crypto.randomUUID().replaceAll('-','').repeat(2),f.manager.personId]
    );
    await forceSceneNode(f,'A4004');
    await admin.query(`UPDATE scene_node_states SET status='COMPLETED',completed_at=now(),revision=revision+1 WHERE case_id=$1 AND node_code='A4004'`,[f.caseId]);
    const v=(value:string)=>({state:'VALUE',value});
    const terms={purpose:v('p'),phoneUseRules:v('r'),executionPeriod:v('e'),parentSupportMeasures:v('s'),supervisionMeasures:v('m'),incentives:v('i'),breachResponsibilities:v('b')};
    const draft=await app.inject({method:'POST',url:`/api/v1/cases/${f.caseId}/digital-use/contract/drafts`,headers:commandHeaders(f.manager.token,'s14-fault-draft'),payload:{expectedCaseVersion:f.caseVersion,adultPartyPersonId:f.manager.personId,childPartyPersonId:child.personId,childParticipationId:p.rows[0]!.id,sourceTemplateVersion:'phone-use-contract-v1',dependencyRefs:[],terms}});
    expect(draft.statusCode,draft.body).toBe(201);
    const adult=await app.inject({method:'POST',url:`/api/v1/cases/${f.caseId}/digital-use/contract/1/confirm`,headers:commandHeaders(f.manager.token,'s14-fault-adult'),payload:{expectedCaseVersion:f.caseVersion,expectedDraftRevision:1}});
    expect(adult.statusCode,adult.body).toBe(200);

    const cleanup=await installFaultTrigger({
      table:'scene_artifacts',timing:'BEFORE',event:'INSERT',
      condition:`NEW.case_id='${f.caseId}'::uuid AND NEW.artifact_type='PHONE_USE_CONTRACT_DOCUMENT'`,
      label:'s14_contract_document',
    });
    try{
      const failed=await app.inject({method:'POST',url:`/api/v1/cases/${f.caseId}/digital-use/contract/1/confirm`,headers:commandHeaders(child.token,'s14-fault-child'),payload:{expectedCaseVersion:f.caseVersion,expectedDraftRevision:1}});
      expect(failed.statusCode).toBe(500);
    }finally{await cleanup();}

    const rolled=await admin.query(
      `SELECT status,parent_confirmation IS NOT NULL AS parent_ok,child_confirmation IS NOT NULL AS child_ok,activated_at
         FROM digital_use_contract_versions WHERE case_id=$1 AND version=1`,
      [f.caseId]
    );
    expect(rolled.rows[0]).toMatchObject({
      status:'PENDING_CONFIRMATION',parent_ok:true,child_ok:false,activated_at:null,
    });
    const scene=await admin.query(
      `SELECT status FROM scene_node_states WHERE case_id=$1 AND node_code='A4010'`,
      [f.caseId]
    );
    expect(scene.rows[0].status).toBe('AVAILABLE');
    const docs=await admin.query(`SELECT count(*)::int AS n FROM scene_artifacts WHERE case_id=$1 AND artifact_type='PHONE_USE_CONTRACT_DOCUMENT'`,[f.caseId]);
    expect(docs.rows[0].n).toBe(0);

    const retry=await app.inject({method:'POST',url:`/api/v1/cases/${f.caseId}/digital-use/contract/1/confirm`,headers:commandHeaders(child.token,'s14-fault-child-retry'),payload:{expectedCaseVersion:f.caseVersion,expectedDraftRevision:1}});
    expect(retry.statusCode,retry.body).toBe(200);
    expect(retry.json().status).toBe('ACTIVE');
  });

  it('Slice 14 A4012 keeps old ACTIVE truth until the replacement is independently reconfirmed', async () => {
    const f = await fixture('s14-revision');
    const child = await loginWithLabel(app, `s14-revision-child-${crypto.randomUUID()}`);
    await admin.query(
      `INSERT INTO person_compliance_profiles(person_id,age_band,minor_mode,verified_source)
       VALUES($1,'ADULT',false,'SELF_STATEMENT')
       ON CONFLICT(person_id) DO UPDATE SET age_band='ADULT',minor_mode=false,verified_source='SELF_STATEMENT'`,
      [child.personId]
    );
    await admin.query(`INSERT INTO family_members(family_id,person_id) VALUES($1,$2) ON CONFLICT DO NOTHING`,[f.familyId,child.personId]);
    const p=await admin.query<{id:string}>(
      `INSERT INTO case_participants(family_id,case_id,person_id,state,invite_token_hash,invite_expires_at,created_by_person_id,accepted_at)
       VALUES($1,$2,$3,'ACTIVE',$4,now()+interval '1 day',$5,now()) RETURNING id`,
      [f.familyId,f.caseId,child.personId,crypto.randomUUID().replaceAll('-','').repeat(2),f.manager.personId]
    );
    await forceSceneNode(f,'A4004');
    await admin.query(`UPDATE scene_node_states SET status='COMPLETED',completed_at=now(),revision=revision+1 WHERE case_id=$1 AND node_code='A4004'`,[f.caseId]);
    const v=(value:string)=>({state:'VALUE',value});
    const terms={purpose:v('p'),phoneUseRules:v('r'),executionPeriod:v('e'),parentSupportMeasures:v('s'),supervisionMeasures:v('m'),incentives:v('i'),breachResponsibilities:v('b')};
    const draft=await app.inject({method:'POST',url:`/api/v1/cases/${f.caseId}/digital-use/contract/drafts`,headers:commandHeaders(f.manager.token,'s14-rev-draft'),payload:{expectedCaseVersion:f.caseVersion,adultPartyPersonId:f.manager.personId,childPartyPersonId:child.personId,childParticipationId:p.rows[0]!.id,sourceTemplateVersion:'phone-use-contract-v1',dependencyRefs:[],terms}});
    expect(draft.statusCode,draft.body).toBe(201);
    const [adult,childResponse]=await Promise.all([
      app.inject({method:'POST',url:`/api/v1/cases/${f.caseId}/digital-use/contract/1/confirm`,headers:commandHeaders(f.manager.token,'s14-rev-adult'),payload:{expectedCaseVersion:f.caseVersion,expectedDraftRevision:1}}),
      app.inject({method:'POST',url:`/api/v1/cases/${f.caseId}/digital-use/contract/1/confirm`,headers:commandHeaders(child.token,'s14-rev-child'),payload:{expectedCaseVersion:f.caseVersion,expectedDraftRevision:1}}),
    ]);
    expect([adult.statusCode,childResponse.statusCode]).toEqual([200,200]);
    const active1=await admin.query(`SELECT id,status FROM digital_use_contract_versions WHERE case_id=$1 AND version=1`,[f.caseId]);
    expect(active1.rows[0].status).toBe('ACTIVE');

    const [r1,r2]=await Promise.all([
      app.inject({method:'POST',url:`/api/v1/cases/${f.caseId}/digital-use/contract/1/revise`,headers:commandHeaders(f.manager.token,'s14-rev-a'),payload:{expectedCaseVersion:f.caseVersion,expectedActiveDraftRevision:1,updateTrigger:'PERIOD_COMPLETE',updateReason:'Execution period completed'}}),
      app.inject({method:'POST',url:`/api/v1/cases/${f.caseId}/digital-use/contract/1/revise`,headers:commandHeaders(f.manager.token,'s14-rev-b'),payload:{expectedCaseVersion:f.caseVersion,expectedActiveDraftRevision:1,updateTrigger:'PERIOD_COMPLETE',updateReason:'Execution period completed'}}),
    ]);
    expect([r1.statusCode,r2.statusCode].sort()).toEqual([201,409]);

    const pending=await admin.query(
      `SELECT version,status,supersedes_id,parent_confirmation,child_confirmation
         FROM digital_use_contract_versions WHERE case_id=$1 ORDER BY version`,
      [f.caseId]
    );
    expect(pending.rows).toHaveLength(2);
    expect(pending.rows[0]).toMatchObject({version:1,status:'ACTIVE'});
    expect(pending.rows[1]).toMatchObject({
      version:2,status:'DRAFT',supersedes_id:active1.rows[0].id,parent_confirmation:null,child_confirmation:null,
    });

    const patch=await app.inject({
      method:'PATCH',url:`/api/v1/cases/${f.caseId}/digital-use/contract/drafts/2`,
      headers:commandHeaders(f.manager.token,'s14-rev-patch'),
      payload:{expectedCaseVersion:f.caseVersion,expectedDraftRevision:1,dependencyRefs:[],terms:{...terms,phoneUseRules:v('updated rule')}},
    });
    expect(patch.statusCode,patch.body).toBe(200);
    expect(patch.json()).toMatchObject({version:2,draftRevision:2,status:'DRAFT'});
    const stale=await app.inject({
      method:'PATCH',url:`/api/v1/cases/${f.caseId}/digital-use/contract/drafts/2`,
      headers:commandHeaders(f.manager.token,'s14-rev-stale'),
      payload:{expectedCaseVersion:f.caseVersion,expectedDraftRevision:1,dependencyRefs:[],terms},
    });
    expect(stale.statusCode,stale.body).toBe(409);
    expect(stale.json().code).toBe('PHONE_USE_CONTRACT_STALE_REVISION');

    const confirmAdult=await app.inject({method:'POST',url:`/api/v1/cases/${f.caseId}/digital-use/contract/2/confirm`,headers:commandHeaders(f.manager.token,'s14-rev-confirm-adult'),payload:{expectedCaseVersion:f.caseVersion,expectedDraftRevision:2}});
    expect(confirmAdult.statusCode,confirmAdult.body).toBe(200);
    expect(confirmAdult.json().status).toBe('PENDING_CONFIRMATION');
    const stillOld=await admin.query(`SELECT version,status FROM digital_use_contract_versions WHERE case_id=$1 AND status='ACTIVE'`,[f.caseId]);
    expect(stillOld.rows).toEqual([{version:1,status:'ACTIVE'}]);

    const childV2Key='s14-rev-confirm-child';
    const cleanupSupersedeFault=await installFaultTrigger({
      table:'scene_artifacts',timing:'BEFORE',event:'INSERT',
      condition:`NEW.case_id='${f.caseId}'::uuid AND NEW.artifact_type='PHONE_USE_CONTRACT_DOCUMENT' AND NEW.revision=2`,
      label:'s14_contract_supersede_document',
    });
    try{
      const failedChild=await app.inject({
        method:'POST',url:`/api/v1/cases/${f.caseId}/digital-use/contract/2/confirm`,
        headers:commandHeaders(child.token,childV2Key),
        payload:{expectedCaseVersion:f.caseVersion,expectedDraftRevision:2},
      });
      expect(failedChild.statusCode).toBe(500);
    }finally{await cleanupSupersedeFault();}
    const rolledSupersede=await admin.query(
      `SELECT version,status,child_confirmation IS NOT NULL AS child_ok
         FROM digital_use_contract_versions WHERE case_id=$1 ORDER BY version`,
      [f.caseId]
    );
    expect(rolledSupersede.rows).toEqual([
      {version:1,status:'ACTIVE',child_ok:true},
      {version:2,status:'PENDING_CONFIRMATION',child_ok:false},
    ]);
    const confirmChild=await app.inject({
      method:'POST',url:`/api/v1/cases/${f.caseId}/digital-use/contract/2/confirm`,
      headers:commandHeaders(child.token,childV2Key),
      payload:{expectedCaseVersion:f.caseVersion,expectedDraftRevision:2},
    });
    expect(confirmChild.statusCode,confirmChild.body).toBe(200);
    expect(confirmChild.json().status).toBe('ACTIVE');

    const final=await admin.query(`SELECT version,status,supersedes_id FROM digital_use_contract_versions WHERE case_id=$1 ORDER BY version`,[f.caseId]);
    expect(final.rows).toEqual([
      {version:1,status:'SUPERSEDED',supersedes_id:null},
      {version:2,status:'ACTIVE',supersedes_id:active1.rows[0].id},
    ]);

    const documentHistory=await admin.query(
      `SELECT id,revision,supersedes_id,source_node_code,owner_person_id,
              data->>'projectionNodeCode' AS projection_node_code,
              data->>'contractVersionId' AS contract_version_id
         FROM scene_artifacts
        WHERE case_id=$1 AND artifact_type='PHONE_USE_CONTRACT_DOCUMENT'
        ORDER BY revision`,
      [f.caseId]
    );
    expect(documentHistory.rows).toHaveLength(2);
    expect(documentHistory.rows[0]).toMatchObject({
      revision:1,supersedes_id:null,source_node_code:'A4010',
      owner_person_id:f.manager.personId,
      projection_node_code:'A4010',contract_version_id:active1.rows[0].id,
    });
    expect(documentHistory.rows[1]).toMatchObject({
      revision:2,supersedes_id:documentHistory.rows[0].id,source_node_code:'A4010',
      owner_person_id:f.manager.personId,
      projection_node_code:'A4012',contract_version_id:confirmChild.json().id,
    });

    const staleSupersede=await app.inject({
      method:'POST',
      url:`/api/v1/cases/${f.caseId}/digital-use/contract/1/revise`,
      headers:commandHeaders(f.manager.token,'s14-rev-stale-active-basis'),
      payload:{
        expectedCaseVersion:f.caseVersion,
        expectedActiveDraftRevision:1,
        updateTrigger:'PERIOD_COMPLETE',
        updateReason:'Stale active basis must not create another successor',
      },
    });
    expect(staleSupersede.statusCode,staleSupersede.body).toBe(409);
    expect(staleSupersede.json().code).toBe('PHONE_USE_CONTRACT_STALE_REVISION');

    const newProblem=await app.inject({
      method:'POST',
      url:`/api/v1/cases/${f.caseId}/digital-use/contract/2/revise`,
      headers:commandHeaders(f.manager.token,'s14-rev-new-problem-v3'),
      payload:{
        expectedCaseVersion:f.caseVersion,
        expectedActiveDraftRevision:2,
        updateTrigger:'NEW_PROBLEM',
        updateReason:'A new family phone-use issue emerged',
      },
    });
    expect(newProblem.statusCode,newProblem.body).toBe(201);
    expect(newProblem.json()).toMatchObject({
      version:3,status:'DRAFT',supersedesId:confirmChild.json().id,updateTrigger:'NEW_PROBLEM',
    });
    const activeAfterNewProblem=await admin.query(
      `SELECT version,status FROM digital_use_contract_versions WHERE case_id=$1 AND status='ACTIVE'`,
      [f.caseId]
    );
    expect(activeAfterNewProblem.rows).toEqual([{version:2,status:'ACTIVE'}]);
  });

});
