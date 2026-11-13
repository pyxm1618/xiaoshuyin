import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
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

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
    admin = createAdminPool();
  });

  afterAll(async () => {
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

  it('rolls back Evidence + Scene CAS when a later event write is fault-injected', async () => {
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
