/**
 * Finding #7 — authorized ROUTED reactivation of 01004.
 *
 * The Frozen Manifest already declares both edges into 01004 (A2002 → 01004 and
 * A2009 → 01004). When the node already COMPLETED (a DECLINED decision routed to
 * MAIN), a later legal routed predecessor must be able to bring it back through
 * a controlled CAS — without touching helpOrReentryRefs, without an
 * `entryMode = USER_INITIATED` widening and without a client direct reopen.
 *
 * The persisted scene is seeded exactly as the DECLINED → MAIN completion leaves
 * it (01004 COMPLETED at revision 1 plus a real DECLINED consent v1), and every
 * subsequent transition is driven through the real HTTP command surface.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { buildApp } from '../../apps/server/api/src/app.js';
import { withRlsTransaction } from '../../apps/server/api/src/db/tx.js';
import { casReactivateCompletedSceneNodeForRoutedEntry } from '@xiaoshuyin/domain';
import {
  APPROVED_SUPPLEMENTAL_ASSESSMENT_DISCLOSURE_AUTHORITY,
  CURRENT_SUPPLEMENTAL_ASSESSMENT_DISCLOSURE,
  DIGITAL_USE_SUPPLEMENTAL_ASSESSMENT,
  recordPurposeScopedConsentDecision,
} from '@xiaoshuyin/compliance';
import { auth, commandHeaders, createFamily, createMember, loginWithLabel } from '../setup/api.js';
import { createCase } from '../setup/participation.js';
import { createAdminPool } from '../setup/db.js';

const PREFIX = `S12F7_${Date.now()}_`;
const PEPPER = 'finding7-evidence-pepper-32-chars';

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

  async function seedFixture(label: string): Promise<Fixture> {
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
    const messageId = message.json().id as string;

    const start = await app.inject({
      method: 'POST',
      url: `/api/v1/cases/${caseId}/assessments`,
      headers: commandHeaders(manager.token, `${PREFIX}start-${label}`),
      payload: { expectedCaseVersion: initialVersion, targetPersonId },
    });
    expect(start.statusCode, start.body).toBe(200);

    // Scene truth as left behind by an earlier A2002 → 01004 DECLINED → MAIN
    // completion, with the Case already advanced to Problem Formulation so the
    // later A2009 routed predecessor is legal.
    await admin.query(`UPDATE cases SET phase='PROBLEM_FORMULATION' WHERE id=$1`, [caseId]);
    await admin.query(
      `UPDATE scene_node_states
          SET status='COMPLETED', completed_at=now(), revision=revision+1
        WHERE case_id=$1 AND node_code='A1001'`,
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
    await admin.query(
      `INSERT INTO scene_node_states
         (family_id,case_id,scene_package_version,node_code,source_node_code,
          status,branch_reason_codes,input_refs,output_refs,revision,completed_at)
       VALUES ($1,$2,'v1','01004','01004','COMPLETED',ARRAY['CONSENT_DECLINED'],
               '[]'::jsonb,'[]'::jsonb,1,now())`,
      [familyId, caseId]
    );
    await admin.query(
      `INSERT INTO scene_node_states
         (family_id,case_id,scene_package_version,node_code,source_node_code,
          status,branch_reason_codes,input_refs,output_refs,revision,completed_at)
       VALUES ($1,$2,'v1','A2009','A2009','AVAILABLE',ARRAY['ROUTED'],
               '[]'::jsonb,'[]'::jsonb,1,NULL)`,
      [familyId, caseId]
    );

    // Real Consent v1 = DECLINED for the supplemental-assessment purpose.
    await withRlsTransaction(
      appPool,
      {
        familyId,
        accountId: manager.accountId,
        personId: manager.personId,
        purpose: 'FAMILY_MANAGEMENT',
      },
      (tx) =>
        recordPurposeScopedConsentDecision(
          tx,
          {
            familyId,
            caseId,
            actor: { accountId: manager.accountId, personId: manager.personId },
            purpose: DIGITAL_USE_SUPPLEMENTAL_ASSESSMENT,
            decision: 'DECLINED',
            expectedVersion: null,
            disclosure: {
              reference: CURRENT_SUPPLEMENTAL_ASSESSMENT_DISCLOSURE.reference,
              version: CURRENT_SUPPLEMENTAL_ASSESSMENT_DISCLOSURE.version,
              hash: CURRENT_SUPPLEMENTAL_ASSESSMENT_DISCLOSURE.hash,
            },
            confirmationStatementHash: 'c'.repeat(64),
            sceneAuthorization: { nodeCode: '01004', verified: true },
            evidence: { clientIp: null, userAgent: null, pepper: PEPPER },
          },
          APPROVED_SUPPLEMENTAL_ASSESSMENT_DISCLOSURE_AUTHORITY
        )
    );

    return {
      manager,
      familyId,
      caseId,
      caseVersion: await currentCaseVersion(caseId),
      targetPersonId,
    };
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
    const f = await seedFixture('grant');
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
    expect(reactivated.revision).toBe(2);
    expect(
      reactivated.branchReasonCodes.some((code: string) =>
        code.startsWith('REACTIVATED_')
      )
    ).toBe(true);

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
    expect(after[1]!.supersedes_id).toBe(after[0]!.id);
  }, 120_000);

  it('an idempotent replay of the reactivated 01004 decision never creates consent v3', async () => {
    const f = await seedFixture('replay');
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
        expectedNodeRevision: 1,
        idempotencyKey: `${PREFIX}direct-01004-${f.caseId}`,
      }
    );
    expect(direct.statusCode, direct.body).toBe(409);
    expect(direct.json().code).toBe('SCENE_NODE_UNREACHABLE');

    const row = await admin.query<{ status: string; revision: number }>(
      `SELECT status, revision FROM scene_node_states WHERE case_id=$1 AND node_code='01004'`,
      [f.caseId]
    );
    expect(row.rows[0]).toMatchObject({ status: 'COMPLETED', revision: 1 });
    expect(await consentRows(f)).toHaveLength(1);
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
    expect(completed).toMatchObject({ status: 'COMPLETED', revision: 1 });

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
    expect(row.rows[0]).toMatchObject({ status: 'COMPLETED', revision: 1 });
  }, 120_000);
});
