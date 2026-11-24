/**
 * Finding #7 — authorized ROUTED reactivation of 01004.
 *
 * The Frozen Manifest already declares both edges into 01004 (A2002 → 01004 and
 * A2009 → 01004). When the node already COMPLETED (a DECLINED decision routed to
 * MAIN), a later legal routed predecessor must be able to bring it back through
 * a controlled CAS — without touching helpOrReentryRefs, without an
 * `entryMode = USER_INITIATED` widening and without a client direct reopen.
 *
 * The first round runs through HTTP. Later-route tests establish an independent
 * Problem Formulation prerequisite fixture and drive A2004/A2006/A2009 via HTTP.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { buildApp } from '../../apps/server/api/src/app.js';
import { withRlsTransaction } from '../../apps/server/api/src/db/tx.js';
import { casReactivateCompletedSceneNodeForRoutedEntry } from '@xiaoshuyin/domain';
import {
  DIGITAL_USE_SUPPLEMENTAL_ASSESSMENT,
} from '@xiaoshuyin/compliance';
import { auth, commandHeaders, createFamily, createMember, loginWithLabel } from '../setup/api.js';
import { createCase } from '../setup/participation.js';
import { createAdminPool } from '../setup/db.js';

const PREFIX = `S12F7_${Date.now()}_`;

interface Fixture {
  manager: { token: string; accountId: string; personId: string };
  familyId: string;
  caseId: string;
  caseVersion: number;
  targetPersonId: string;
}

describe('Finding #7: authorized routed reactivation of 01004', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let admin: pg.Pool;
  let appPool: pg.Pool;
  let migrator: pg.Client;
  const publishedFeatureCodes: string[] = [];

  function nodeOf(scene: any, nodeCode: string) {
    return (scene.nodes ?? []).find((node: any) => node.nodeCode === nodeCode);
  }

  async function currentCaseVersion(caseId: string): Promise<number> {
    const row = await admin.query<{ version: number }>(
      `SELECT version FROM cases WHERE id = $1`,
      [caseId]
    );
    return row.rows[0]!.version;
  }

  async function seedFixture(label: string, seedLaterRoute = false): Promise<Fixture> {
    const manager = await loginWithLabel(app, `${PREFIX}${label}`);
    const family = await createFamily(app, manager.token, `${PREFIX}${label}`);
    expect(family.statusCode, family.body).toBe(201);
    const familyId = family.json().id as string;

    const child = await createMember(app, manager.token, familyId, `${PREFIX}target-${label}`, {
      ageBand: 'MINOR_14_17',
      ageBandSource: 'OTHER_MEMBER_RELAY',
    });
    expect(child.statusCode, child.body).toBe(201);
    const targetPersonId = child.json().personId as string;

    const kase = await createCase(app, manager.token, `${PREFIX}${label}`);
    expect(kase.statusCode, kase.body).toBe(201);
    const caseId = kase.json().id as string;
    const initialVersion = kase.json().version as number;

    const message = await app.inject({
      method: 'POST',
      url: `/api/v1/cases/${caseId}/messages`,
      headers: commandHeaders(manager.token, `${PREFIX}msg-${label}`),
      payload: { content: 'Digital use is causing a current family problem.' },
    });
    expect(message.statusCode, message.body).toBe(201);

    const start = await app.inject({
      method: 'POST',
      url: `/api/v1/cases/${caseId}/assessments`,
      headers: commandHeaders(manager.token, `${PREFIX}start-${label}`),
      payload: { expectedCaseVersion: initialVersion, targetPersonId },
    });
    expect(start.statusCode, start.body).toBe(200);

    const f = { manager, familyId, caseId, caseVersion: start.json().caseVersion, targetPersonId };
    let scene = start.json();
    async function advance(nodeCode: string, payload: Record<string, unknown>) {
      expect(scene.currentNode.nodeCode).toBe(nodeCode);
      f.caseVersion = scene.caseVersion;
      const result = await respond(f, nodeCode, payload, {
        expectedNodeRevision: scene.currentNode.revision,
        idempotencyKey: `${PREFIX}${label}-${nodeCode}`,
      });
      expect(result.statusCode, result.body).toBe(200);
      scene = result.json();
    }

    await advance('A1001', {
      devices: ['PHONE'],
      purposeDurations: {
        learningResearchHomework: { state: 'KNOWN', minutesPerDay: 30, certainty: 'ESTIMATE' },
        necessaryContact: { state: 'KNOWN', minutesPerDay: 15, certainty: 'EXACT' },
        entertainmentGamingVideoSocialNonLearning: { state: 'KNOWN', minutesPerDay: 90, certainty: 'ESTIMATE' },
      },
      functionalImpact: {
        sleep: { state: 'KNOWN', impacted: false },
        studyOrNecessaryAffairs: { state: 'KNOWN', impacted: false },
        realWorldActivityDisplacement: { state: 'KNOWN', impacted: false },
      },
    });
    await advance('01002', { state: 'KNOWN', selections: ['B'] });
    await advance('01003', { state: 'KNOWN', selection: 'A' });
    await advance('A2002', { choice: 'FURTHER_ASSESSMENT' });
    expect(nodeOf(scene, '01004').branchReasonCodes).toContain('USER_ACCEPTS_FURTHER_ASSESSMENT');
    await advance('01004', { decision: 'DECLINED', confirmationStatementHash: 'c'.repeat(64) });
    expect(scene.routeReasonCode).toBe('CONSENT_DECLINED');
    const route = await admin.query(
      `SELECT metadata->>'terminalCode' AS terminal
         FROM case_events
        WHERE case_id=$1 AND event_type='CASE_DIGITAL_USE_NODE_COMPLETED'
          AND metadata->>'nodeCode'='01004'`,
      [caseId]
    );
    expect(route.rows).toEqual([{ terminal: 'MAIN' }]);
    expect(nodeOf(scene, '01004')).toMatchObject({ status: 'COMPLETED', revision: 2 });

    if (!seedLaterRoute) return { ...f, caseVersion: scene.caseVersion };

    // This history fixture establishes the A2004 prerequisite independently
    // of the terminal MAIN route. Both later predecessors materialize via HTTP.
    const evidenceRefs = nodeOf(scene, 'A1001').outputRefs.filter(
      (ref: { type: string }) => ref.type === 'ASSERTION'
    );
    expect(evidenceRefs.length).toBeGreaterThan(0);
    const marker = { type: 'RECORD_MARKER', markerCode: 'A200401', evidenceRefs };
    await admin.query(`UPDATE cases SET phase='PROBLEM_FORMULATION' WHERE id=$1`, [caseId]);
    await admin.query(
      `INSERT INTO scene_node_states
         (family_id,case_id,scene_package_version,node_code,source_node_code,
          status,branch_reason_codes,input_refs,output_refs,revision,completed_at)
       VALUES ($1,$2,'v1','A2004','A2003','AVAILABLE',ARRAY['ROUTED'],
               $3::jsonb,'[]'::jsonb,1,NULL)`,
      [familyId, caseId, JSON.stringify([marker])]
    );

    f.caseVersion = await currentCaseVersion(caseId);
    const a2004 = await respond(f, 'A2004', { decision: 'NO' }, {
      expectedNodeRevision: 1,
      idempotencyKey: `${PREFIX}${label}-a2004`,
    });
    expect(a2004.statusCode, a2004.body).toBe(200);
    const a2006 = nodeOf(a2004.json(), 'A2006');
    expect(a2006).toMatchObject({
      status: 'AVAILABLE',
      sourceNodeCode: 'A2004',
      branchReasonCodes: ['COLLABORATIVE_DURATION_NO'],
    });
    expect(nodeOf(a2004.json(), 'A2009')).toBeUndefined();
    f.caseVersion = a2004.json().caseVersion;
    const reconsidered = await respond(f, 'A2006', { decision: 'UNWILLING' }, {
      expectedNodeRevision: a2006.revision,
      idempotencyKey: `${PREFIX}${label}-a2006`,
    });
    expect(reconsidered.statusCode, reconsidered.body).toBe(200);
    expect(nodeOf(reconsidered.json(), 'A2009')).toMatchObject({
      status: 'AVAILABLE',
      sourceNodeCode: 'A2006',
      branchReasonCodes: ['MOTIVATION_RECONSIDER_UNWILLING'],
    });
    return { ...f, caseVersion: reconsidered.json().caseVersion };
  }

  async function respond(
    f: Fixture,
    nodeCode: string,
    response: Record<string, unknown>,
    options: { expectedNodeRevision: number; idempotencyKey: string }
  ) {
    return app.inject({
      method: 'POST',
      url: `/api/v1/cases/${f.caseId}/scene/nodes/${nodeCode}/responses`,
      headers: {
        ...auth(f.manager.token),
        'idempotency-key': options.idempotencyKey,
      },
      payload: {
        targetPersonId: f.targetPersonId,
        expectedCaseVersion: f.caseVersion,
        expectedNodeRevision: options.expectedNodeRevision,
        response,
      },
    });
  }

  async function consentRows(f: Fixture) {
    const result = await admin.query<{
      id: string;
      decision: string;
      version: number;
      supersedes_id: string | null;
    }>(
      `SELECT id, decision, version, supersedes_id
         FROM consent_records
        WHERE family_id = $1 AND purpose = 'DIGITAL_USE_SUPPLEMENTAL_ASSESSMENT'
        ORDER BY version ASC`,
      [f.familyId]
    );
    return result.rows;
  }

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
    admin = createAdminPool();
    appPool = new pg.Pool({ connectionString: process.env['DATABASE_URL'] });
    migrator = new pg.Client({ connectionString: process.env['MIGRATION_DATABASE_URL'] });
    await migrator.connect();

    for (const [featureCode, basis] of [
      ['DIGITAL_USE_ASSESSMENT_RUNTIME', 'finding7 assessment basis'],
      ['DIGITAL_USE_FAMILY_ALLIANCE_RUNTIME', 'finding7 family basis'],
    ] as const) {
      const existing = await migrator.query<{ count: string }>(
        `SELECT count(*)::text AS count FROM compliance_feature_policies
          WHERE feature_code = $1 AND feature_contract_revision = 'v1'
            AND effective_from <= now()
            AND (effective_until IS NULL OR now() < effective_until)`,
        [featureCode]
      );
      if (Number(existing.rows[0]!.count) === 0) {
        await migrator.query(
          `SELECT app.publish_compliance_feature_policy(
             $1,'v1',NULL,1,'NOT_APPLICABLE','BASELINE','BASELINE','BASELINE','BASELINE',
             $2,'evidence://finding7/routed-reactivation',
             now() - interval '1 minute','migration:finding7-routed-reactivation'
           )`,
          [featureCode, basis]
        );
        publishedFeatureCodes.push(featureCode);
      }
    }
  }, 120_000);

  afterAll(async () => {
    // Only remove policies this suite published; several other suites publish
    // the same feature codes unconditionally and must not see a stale v1.
    for (const featureCode of publishedFeatureCodes) {
      await migrator
        .query(
          `UPDATE compliance_feature_policies SET superseded_by_policy_id = NULL
            WHERE feature_code = $1 AND feature_contract_revision = 'v1'`,
          [featureCode]
        )
        .catch(() => undefined);
      await migrator
        .query(
          `DELETE FROM compliance_feature_policies
            WHERE feature_code = $1 AND feature_contract_revision = 'v1'`,
          [featureCode]
        )
        .catch(() => undefined);
    }
    await appPool?.end().catch(() => undefined);
    await migrator?.end().catch(() => undefined);
    await admin?.end().catch(() => undefined);
    await app?.close();
  }, 120_000);

  it('reactivates a COMPLETED 01004 for a legal routed predecessor and supersedes consent v1 with v2', async () => {
    const f = await seedFixture('grant', true);
    const before = await consentRows(f);
    expect(before).toHaveLength(1);
    expect(before[0]).toMatchObject({ decision: 'DECLINED', version: 1 });

    // A2009 is the legal routed predecessor of the already COMPLETED 01004.
    const a2009 = await respond(f, 'A2009', { decision: 'AGREE' }, {
      expectedNodeRevision: 1,
      idempotencyKey: `${PREFIX}a2009-agree-${f.caseId}`,
    });
    expect(a2009.statusCode, a2009.body).toBe(200);
    const afterA2009 = a2009.json();
    const reactivated = nodeOf(afterA2009, '01004');
    expect(reactivated.status).toBe('AVAILABLE');
    expect(reactivated.revision).toBe(3);
    expect(reactivated.branchReasonCodes).toEqual(['REACTIVATED_RELATIONSHIP_ASSESSMENT_AGREED']);
    const predecessor = nodeOf(afterA2009, 'A2009');
    expect(predecessor.status).toBe('COMPLETED');
    expect(predecessor.outputRefs.length).toBeGreaterThan(0);
    expect(reactivated.inputRefs).toEqual(
      expect.arrayContaining([...predecessor.inputRefs, ...predecessor.outputRefs])
    );
    const routed = await admin.query(
      `SELECT metadata->>'nextNodeCode' AS target, metadata->>'routeReasonCode' AS reason
         FROM case_events
        WHERE case_id=$1 AND event_type='CASE_DIGITAL_USE_NODE_COMPLETED'
          AND metadata->>'nodeCode'='A2009'`,
      [f.caseId]
    );
    expect(routed.rows).toEqual([{ target: '01004', reason: 'RELATIONSHIP_ASSESSMENT_AGREED' }]);

    // The reactivated node records the ACTUAL routed consent decision as v2.
    const granted = await respond(
      f,
      '01004',
      { decision: 'GRANTED', confirmationStatementHash: 'a'.repeat(64) },
      {
        expectedNodeRevision: reactivated.revision,
        idempotencyKey: `${PREFIX}01004-grant-${f.caseId}`,
      }
    );
    expect(granted.statusCode, granted.body).toBe(200);

    const after = await consentRows(f);
    expect(after).toHaveLength(2);
    expect(after[1]).toMatchObject({ decision: 'GRANTED', version: 2 });
    expect(after[0]).toEqual(before[0]);
    expect(after[1]!.supersedes_id).toBe(after[0]!.id);
    const current = await admin.query(
      `SELECT c.id FROM consent_records c
        WHERE c.case_id=$1 AND c.purpose='DIGITAL_USE_SUPPLEMENTAL_ASSESSMENT'
          AND NOT EXISTS (SELECT 1 FROM consent_records s WHERE s.supersedes_id=c.id)`,
      [f.caseId]
    );
    expect(current.rows).toEqual([{ id: after[1]!.id }]);
  }, 120_000);

  it('an idempotent replay of the reactivated 01004 decision never creates consent v3', async () => {
    const f = await seedFixture('replay', true);
    const key = `${PREFIX}replay-01004-${f.caseId}`;

    const a2009 = await respond(f, 'A2009', { decision: 'AGREE' }, {
      expectedNodeRevision: 1,
      idempotencyKey: `${PREFIX}replay-a2009-${f.caseId}`,
    });
    expect(a2009.statusCode, a2009.body).toBe(200);
    const revision = nodeOf(a2009.json(), '01004').revision;

    const payload = { decision: 'GRANTED', confirmationStatementHash: 'b'.repeat(64) };
    const first = await respond(f, '01004', payload, {
      expectedNodeRevision: revision,
      idempotencyKey: key,
    });
    expect(first.statusCode, first.body).toBe(200);

    const replay = await respond(f, '01004', payload, {
      expectedNodeRevision: revision,
      idempotencyKey: key,
    });
    expect(replay.statusCode, replay.body).toBe(200);

    const rows = await consentRows(f);
    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.version)).toEqual([1, 2]);
  }, 120_000);

  it('a direct client reopen of the COMPLETED 01004 still fails closed', async () => {
    const f = await seedFixture('direct');
    // No A2009 predecessor: the node is COMPLETED and must stay unreachable.
    const direct = await respond(
      f,
      '01004',
      { decision: 'GRANTED', confirmationStatementHash: 'd'.repeat(64) },
      {
        expectedNodeRevision: 2,
        idempotencyKey: `${PREFIX}direct-01004-${f.caseId}`,
      }
    );
    expect(direct.statusCode, direct.body).toBe(409);
    expect(direct.json().code).toBe('SCENE_NODE_UNREACHABLE');

    const row = await admin.query<{ status: string; revision: number }>(
      `SELECT status, revision FROM scene_node_states WHERE case_id=$1 AND node_code='01004'`,
      [f.caseId]
    );
    expect(row.rows[0]).toMatchObject({ status: 'COMPLETED', revision: 2 });
    expect(await consentRows(f)).toHaveLength(1);
  }, 120_000);

  it('assessment resume after declining leaves A2009 unreachable', async () => {
    const f = await seedFixture('resume-after-decline');
    const resumed = await app.inject({
      method: 'POST',
      url: `/api/v1/cases/${f.caseId}/assessments`,
      headers: commandHeaders(f.manager.token, `${PREFIX}resume-${f.caseId}`),
      payload: { expectedCaseVersion: f.caseVersion, targetPersonId: f.targetPersonId },
    });
    expect(resumed.statusCode, resumed.body).toBe(200);
    expect(nodeOf(resumed.json(), 'A2009')).toBeUndefined();
    const a2009 = await respond(f, 'A2009', { decision: 'AGREE' }, {
      expectedNodeRevision: 0,
      idempotencyKey: `${PREFIX}unrouted-a2009-${f.caseId}`,
    });
    expect(a2009.statusCode, a2009.body).toBe(409);
    expect(a2009.json().code).toBe('CASE_PHASE_CONFLICT');
  }, 120_000);

  it('stale and non-authorized reactivation CAS attempts fail closed', async () => {
    const f = await seedFixture('cas');
    const scene = await app.inject({
      method: 'GET',
      url: `/api/v1/cases/${f.caseId}/scene`,
      headers: auth(f.manager.token),
    });
    expect(scene.statusCode, scene.body).toBe(200);
    const completed = nodeOf(scene.json(), '01004');
    expect(completed).toMatchObject({ status: 'COMPLETED', revision: 2 });

    const stale = await withRlsTransaction(
      appPool,
      {
        familyId: f.familyId,
        accountId: f.manager.accountId,
        personId: f.manager.personId,
        purpose: 'FAMILY_MANAGEMENT',
      },
      (tx) =>
        casReactivateCompletedSceneNodeForRoutedEntry(tx, {
          caseId: f.caseId,
          nodeCode: '01004',
          scenePackageVersion: 'v1',
          expectedRevision: 99,
          branchReasonCodes: ['REACTIVATED_STALE'],
          inputRefs: [],
        })
    );
    expect(stale).toBeNull();

    const row = await admin.query<{ status: string; revision: number }>(
      `SELECT status, revision FROM scene_node_states WHERE case_id=$1 AND node_code='01004'`,
      [f.caseId]
    );
    expect(row.rows[0]).toMatchObject({ status: 'COMPLETED', revision: 2 });
  }, 120_000);
  it('allows exactly one of two concurrent CAS attempts at the same revision', async () => {
    const f = await seedFixture('concurrent-cas');
    const initial = await admin.query<{ status: string; revision: number }>(
      `SELECT status, revision FROM scene_node_states WHERE case_id=$1 AND node_code='01004'`,
      [f.caseId]
    );
    const completed = initial.rows[0]!;
    expect(completed.status).toBe('COMPLETED');

    let arrivals = 0;
    let start!: () => void;
    const barrier = new Promise<void>((resolve) => { start = resolve; });
    const attempt = () => withRlsTransaction(
      appPool,
      {
        familyId: f.familyId,
        accountId: f.manager.accountId,
        personId: f.manager.personId,
        purpose: 'FAMILY_MANAGEMENT',
      },
      async (tx) => {
        arrivals += 1;
        if (arrivals === 2) start();
        await barrier;
        return casReactivateCompletedSceneNodeForRoutedEntry(tx, {
          caseId: f.caseId,
          nodeCode: '01004',
          scenePackageVersion: 'v1',
          expectedRevision: completed.revision,
          branchReasonCodes: ['ROUTED'],
          inputRefs: [],
        });
      }
    );

    const results = await Promise.all([attempt(), attempt()]);
    expect(results.filter((result) => result !== null)).toHaveLength(1);
    expect(results.filter((result) => result === null)).toHaveLength(1);
    const final = await admin.query(
      `SELECT status, revision FROM scene_node_states WHERE case_id=$1 AND node_code='01004'`,
      [f.caseId]
    );
    expect(final.rows).toEqual([{ status: 'AVAILABLE', revision: completed.revision + 1 }]);
  }, 120_000);

});
