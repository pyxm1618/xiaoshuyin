import { afterAll, beforeAll, describe, expect, it } from 'vitest';
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
import { insertSceneArtifact, validateSceneRefs } from '@xiaoshuyin/domain';
import { withRlsTransaction } from '../../apps/server/api/src/db/tx.js';
import { resolveDigitalUseRuntimeNode } from '@xiaoshuyin/scenes/digital-use';
import {
  APPROVED_SUPPLEMENTAL_ASSESSMENT_DISCLOSURE_AUTHORITY,
  CURRENT_SUPPLEMENTAL_ASSESSMENT_DISCLOSURE,
  DIGITAL_USE_SUPPLEMENTAL_ASSESSMENT,
  recordPurposeScopedConsentDecision,
} from '@xiaoshuyin/compliance';

interface Fixture {
  manager: LoginResult;
  familyId: string;
  caseId: string;
  caseVersion: number;
  nodeRevision: number;
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
  });

  async function fixture(label: string): Promise<Fixture> {
    const manager = await loginWithLabel(app, `du-hard-${label}`);
    const family = await createFamily(app, manager.token, `du-hard-${label}`);
    expect(family.statusCode).toBe(201);
    const familyId = family.json().id as string;

    const kase = await createCase(app, manager.token, `du-hard-${label}`);
    expect(kase.statusCode).toBe(201);
    const caseId = kase.json().id as string;
    const initialVersion = kase.json().version as number;

    const message = await app.inject({
      method: 'POST',
      url: `/api/v1/cases/${caseId}/messages`,
      headers: commandHeaders(manager.token, `du-msg-${label}`),
      payload: { content: 'I am concerned about the current digital-use problem.' },
    });
    expect(message.statusCode).toBe(201);

    const start = await app.inject({
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
      condition: `NEW.actor_account_id='${f.manager.accountId}'::uuid AND NEW.command_type='DIGITAL_USE_NODE_RESPONSE'`,
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
             WHERE resource_type='CASE' AND resource_id::text=$1
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
      condition: `NEW.actor_account_id='${f.manager.accountId}'::uuid AND NEW.command_type='DIGITAL_USE_NODE_RESPONSE'`,
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
             WHERE resource_type='CASE' AND resource_id::text=$1
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
});
