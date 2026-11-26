import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import pg from 'pg';
import crypto from 'node:crypto';
import { buildApp } from '../../apps/server/api/src/app.js';
import { withRlsTransaction } from '../../apps/server/api/src/db/tx.js';
import { createAdminPool } from '../setup/db.js';
import {
  auth,
  commandHeaders,
  createFamily,
  createMember,
  loginWithLabel,
  revokeConsent,
  type LoginResult,
} from '../setup/api.js';
import { buildConsentEvidence, getAcceptanceTextHash, getCurrentNoticeHash, runtimeConsentChannel } from '@xiaoshuyin/compliance';
import { createCase } from '../setup/participation.js';
import { markProblemFormulationsForConsentReview } from '@xiaoshuyin/domain';
import {
  DIGITAL_USE_PACKAGE_VERSION,
  PHONE_USE_CONTRACT_CONTENT_VERSION,
} from '@xiaoshuyin/scenes/digital-use';

interface Fixture {
  manager: LoginResult;
  targetPersonId: string;
  familyId: string;
  caseId: string;
  caseVersion: number;
}

const v = (value: string) => ({ state: 'VALUE' as const, value });
const defaultTerms = {
  purpose: v('Protect study and sleep'),
  phoneUseRules: v('Max 1 hour per day'),
  executionPeriod: v('30 days'),
  parentSupportMeasures: v('No phone during dinner'),
  supervisionMeasures: v('Daily evening check'),
  incentives: v('Weekend park trip'),
  breachResponsibilities: v('Reduce 15 mins next day'),
};

describe('Workline C Targeted Remediation (#8, #9, #10, #24; #12 gap)', () => {
  let app: FastifyInstance;
  let admin: pg.Pool;
  let migrator: pg.Client;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
    admin = createAdminPool();
    migrator = new pg.Client({ connectionString: process.env['MIGRATION_DATABASE_URL'] });
    await migrator.connect();

    const ensurePolicy = async (featureCode: string, mode: string, basis: string, evidenceUri: string, bundle: string) => {
      const existing = await migrator.query<{ id: string }>(
        `SELECT id FROM compliance_feature_policies WHERE feature_code = $1 AND feature_contract_revision = 'v1' AND policy_version = 1`,
        [featureCode]
      );
      if (existing.rows.length === 0) {
        await migrator.query(
          `SELECT app.publish_compliance_feature_policy(
             $1,'v1',NULL,1,
             'NOT_APPLICABLE',$2,'BASELINE','BASELINE','BASELINE',
             $3,$4,
             now() - interval '1 minute',$5
           )`,
          [featureCode, mode, basis, evidenceUri, bundle]
        );
      }
    };

    await ensurePolicy(
      'DIGITAL_USE_ASSESSMENT_RUNTIME',
      'BASELINE',
      'Slice 12 integration reviewed basis',
      'evidence://slice12/integration',
      'migration:slice12-integration'
    );
    await ensurePolicy(
      'DIGITAL_USE_ROLEPLAY_A4003',
      'MINORS_BLOCKED',
      'Slice 14 roleplay integration reviewed basis',
      'evidence://slice14/roleplay-integration',
      'migration:slice14-roleplay-integration'
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

  async function createTestFixture(label: string, boundChild?: LoginResult): Promise<Fixture> {
    const manager = await loginWithLabel(app, `du-c-${label}`);
    const family = await createFamily(app, manager.token, `du-c-${label}`);
    expect(family.statusCode).toBe(201);
    const familyId = family.json().id as string;
    let targetPersonId: string;
    if (boundChild) {
      targetPersonId = boundChild.personId;
      await admin.query(
        'INSERT INTO family_members (family_id,person_id) VALUES ($1,$2)',
        [familyId, targetPersonId]
      );
      await admin.query(
        `INSERT INTO person_compliance_profiles (person_id,age_band,minor_mode,verified_source)
           VALUES ($1,'MINOR_14_17',true,'OTHER_MEMBER_RELAY')
           ON CONFLICT (person_id) DO UPDATE SET age_band='MINOR_14_17',minor_mode=true,
             verified_source='OTHER_MEMBER_RELAY'`,
        [targetPersonId]
      );
    } else {
      const target = await createMember(app, manager.token, familyId, `du-c-${label}`, {
        ageBand: 'MINOR_14_17', ageBandSource: 'GUARDIAN_RELAY',
      });
      expect(target.statusCode, target.body).toBe(201);
      targetPersonId = target.json().personId as string;
    }
    const kase = await createCase(app, manager.token, `du-c-${label}`);
    expect(kase.statusCode).toBe(201);
    const caseId = kase.json().id as string;

    // Force assessment target
    await admin.query(
      `INSERT INTO digital_use_assessment_context (family_id, case_id, target_person_id, created_by_person_id)
       VALUES ($1, $2, $3, $4)`,
      [familyId, caseId, targetPersonId, manager.personId]
    );

    // Create an initial message for evidence ref
    const msg = await admin.query<{ id: string }>(
      `INSERT INTO dialogue_messages (family_id, case_id, actor_account_id, source_person_id, content)
       VALUES ($1, $2, $3, $4, 'Test statement for evidence')
       RETURNING id`,
      [familyId, caseId, manager.accountId, manager.personId]
    );
    const messageId = msg.rows[0]!.id;

    // Setup Problem Formulation CONFIRMED
    await admin.query(
      `INSERT INTO problem_formulations
         (family_id, case_id, version, status, review_state, primary_problem, key_factors,
          evidence_refs, unknowns, conflicts, scene_fit, alternative_explanations,
          reassessment_conditions, exit_conditions, user_response,
          confirmed_by_person_id, confirmed_at, dependency_refs, supersedes_version)
       VALUES
         ($1, $2, 1, 'CONFIRMED', 'CURRENT', $3::jsonb, '[]'::jsonb,
          $4::jsonb, '[]'::jsonb, '[]'::jsonb, 'DIGITAL_USE', '[]'::jsonb,
          '[]'::jsonb, '[]'::jsonb, $5::jsonb, $6, now(), '[]'::jsonb, NULL)`,
      [
        familyId,
        caseId,
        JSON.stringify({ text: 'Test confirmed Digital Use formulation' }),
        JSON.stringify([{ type: 'DIALOGUE_MESSAGE', id: messageId }]),
        JSON.stringify({ kind: 'CONFIRM' }),
        manager.personId,
      ]
    );

    // Setup A1001 package binding
    await admin.query(
      `INSERT INTO scene_node_states
         (family_id, case_id, scene_package_version, node_code, source_node_code,
          status, revision, branch_reason_codes, input_refs, output_refs, completed_at)
       VALUES ($1, $2, $3, 'A1001', 'ROOT', 'COMPLETED', 1, ARRAY[]::text[], '[]'::jsonb, '[]'::jsonb, now())`,
      [familyId, caseId, DIGITAL_USE_PACKAGE_VERSION]
    );

    // Advance Case phase to GOALS
    await admin.query(
      `UPDATE cases SET phase = 'GOALS' WHERE id = $1`,
      [caseId]
    );

    return {
      manager,
      targetPersonId,
      familyId,
      caseId,
      caseVersion: 1,
    };
  }

  it('Finding #8: Phone Contract revise idempotency exact replay succeeds on retry', async () => {
    const child = await loginWithLabel(app, `s14-f8-child-${crypto.randomUUID()}`);
    const f = await createTestFixture('finding8', child);

    const participation = await admin.query<{ id: string }>(
      `INSERT INTO case_participants
         (family_id, case_id, person_id, state, invite_token_hash, invite_expires_at, created_by_person_id, accepted_at)
       VALUES ($1, $2, $3, 'ACTIVE', $4, now() + interval '1 day', $5, now())
       RETURNING id`,
      [f.familyId, f.caseId, child.personId, crypto.randomUUID().replaceAll('-', '').repeat(2), f.manager.personId]
    );

    // Complete A4004
    await admin.query(
      `INSERT INTO scene_node_states
         (family_id, case_id, scene_package_version, node_code, source_node_code,
          status, revision, branch_reason_codes, input_refs, output_refs, completed_at)
       VALUES ($1, $2, $3, 'A4004', 'A4001', 'COMPLETED', 1, ARRAY[]::text[], '[]'::jsonb, '[]'::jsonb, now())`,
      [f.familyId, f.caseId, DIGITAL_USE_PACKAGE_VERSION]
    );

    // 1. Create Draft v1
    const draftRes = await app.inject({
      method: 'POST',
      url: `/api/v1/cases/${f.caseId}/digital-use/contract/drafts`,
      headers: commandHeaders(f.manager.token, 'f8-draft-1'),
      payload: {
        expectedCaseVersion: f.caseVersion,
        adultPartyPersonId: f.manager.personId,
        childPartyPersonId: child.personId,
        childParticipationId: participation.rows[0]!.id,
        sourceTemplateVersion: PHONE_USE_CONTRACT_CONTENT_VERSION,
        dependencyRefs: [],
        terms: defaultTerms,
      },
    });
    expect(draftRes.statusCode, draftRes.body).toBe(201);

    // 2. Both confirm to make v1 ACTIVE
    const [adultConf, childConf] = await Promise.all([
      app.inject({
        method: 'POST',
        url: `/api/v1/cases/${f.caseId}/digital-use/contract/1/confirm`,
        headers: commandHeaders(f.manager.token, 'f8-adult-conf'),
        payload: { expectedCaseVersion: f.caseVersion, expectedDraftRevision: 1 },
      }),
      app.inject({
        method: 'POST',
        url: `/api/v1/cases/${f.caseId}/digital-use/contract/1/confirm`,
        headers: commandHeaders(child.token, 'f8-child-conf'),
        payload: { expectedCaseVersion: f.caseVersion, expectedDraftRevision: 1 },
      }),
    ]);
    expect(adultConf.statusCode, adultConf.body).toBe(200);
    expect(childConf.statusCode, childConf.body).toBe(200);

    // Verify v1 is ACTIVE
    const activeRow = await admin.query(
      `SELECT version, status FROM digital_use_contract_versions WHERE case_id = $1 AND version = 1`,
      [f.caseId]
    );
    expect(activeRow.rows[0]).toMatchObject({ version: 1, status: 'ACTIVE' });

    // 3. First revise call with idempotency key
    const reviseKey = `f8-revise-${crypto.randomUUID()}`;
    const revisePayload = {
      expectedCaseVersion: f.caseVersion,
      expectedActiveDraftRevision: 1,
      updateTrigger: 'PERIOD_COMPLETE',
      updateReason: 'Execution period completed normally',
    };

    const firstRevise = await app.inject({
      method: 'POST',
      url: `/api/v1/cases/${f.caseId}/digital-use/contract/1/revise`,
      headers: { ...auth(f.manager.token), 'idempotency-key': reviseKey },
      payload: revisePayload,
    });
    expect(firstRevise.statusCode, firstRevise.body).toBe(201);
    const firstBody = firstRevise.json();
    expect(firstBody.version).toBe(2);
    expect(firstBody.status).toBe('DRAFT');

    // 4. Retry exact same revise call with same idempotency key and params
    const replayRevise = await app.inject({
      method: 'POST',
      url: `/api/v1/cases/${f.caseId}/digital-use/contract/1/revise`,
      headers: { ...auth(f.manager.token), 'idempotency-key': reviseKey },
      payload: revisePayload,
    });

    // THIS IS THE CORE OF FINDING #8:
    // It must replay 201 with the original draft, NOT fail with 409 PHONE_USE_CONTRACT_STALE_REVISION
    expect(replayRevise.statusCode, replayRevise.body).toBe(201);
    expect(replayRevise.json().id).toBe(firstBody.id);
    expect(replayRevise.json().version).toBe(2);

    // 5. Same key with different payload must reject with IDEMPOTENCY_PAYLOAD_MISMATCH
    const mismatchRevise = await app.inject({
      method: 'POST',
      url: `/api/v1/cases/${f.caseId}/digital-use/contract/1/revise`,
      headers: { ...auth(f.manager.token), 'idempotency-key': reviseKey },
      payload: { ...revisePayload, updateReason: 'Different reason' },
    });
    expect(mismatchRevise.statusCode).toBe(409);
    expect(mismatchRevise.json().code).toBe('IDEMPOTENCY_PAYLOAD_MISMATCH');

    // 6. Same key with different URL path :version must reject with IDEMPOTENCY_PAYLOAD_MISMATCH
    const mismatchVersionRevise = await app.inject({
      method: 'POST',
      url: `/api/v1/cases/${f.caseId}/digital-use/contract/99/revise`,
      headers: { ...auth(f.manager.token), 'idempotency-key': reviseKey },
      payload: revisePayload,
    });
    expect(mismatchVersionRevise.statusCode).toBe(409);
    expect(mismatchVersionRevise.json().code).toBe('IDEMPOTENCY_PAYLOAD_MISMATCH');

    // 7. Stale version protection for new execution: different key on non-matching active version
    const staleReviseKey = `f8-stale-${crypto.randomUUID()}`;
    const staleVersionRevise = await app.inject({
      method: 'POST',
      url: `/api/v1/cases/${f.caseId}/digital-use/contract/99/revise`,
      headers: { ...auth(f.manager.token), 'idempotency-key': staleReviseKey },
      payload: revisePayload,
    });
    expect(staleVersionRevise.statusCode).toBe(409);
    expect(staleVersionRevise.json().code).toBe('PHONE_USE_CONTRACT_STALE_REVISION');

    // 8. Authorization pre-check: an unauthorized actor replay must fail before idempotency
    const outsider = await loginWithLabel(app, `s14-f8-outsider-${crypto.randomUUID()}`);
    const unauthReplay = await app.inject({
      method: 'POST',
      url: `/api/v1/cases/${f.caseId}/digital-use/contract/1/revise`,
      headers: { ...auth(outsider.token), 'idempotency-key': reviseKey },
      payload: revisePayload,
    });
    expect(unauthReplay.statusCode).toBe(404);
  });

  it('Finding #9: Phone Contract initial-draft idempotency exact replay succeeds even after contract state evolves', async () => {
    const child = await loginWithLabel(app, `s14-f9-child-${crypto.randomUUID()}`);
    const f = await createTestFixture('finding9', child);

    const participation = await admin.query<{ id: string }>(
      `INSERT INTO case_participants
         (family_id, case_id, person_id, state, invite_token_hash, invite_expires_at, created_by_person_id, accepted_at)
       VALUES ($1, $2, $3, 'ACTIVE', $4, now() + interval '1 day', $5, now())
       RETURNING id`,
      [f.familyId, f.caseId, child.personId, crypto.randomUUID().replaceAll('-', '').repeat(2), f.manager.personId]
    );

    await admin.query(
      `INSERT INTO scene_node_states
         (family_id, case_id, scene_package_version, node_code, source_node_code,
          status, revision, branch_reason_codes, input_refs, output_refs, completed_at)
       VALUES ($1, $2, $3, 'A4004', 'A4001', 'COMPLETED', 1, ARRAY[]::text[], '[]'::jsonb, '[]'::jsonb, now())`,
      [f.familyId, f.caseId, DIGITAL_USE_PACKAGE_VERSION]
    );

    const draftKey = `f9-draft-${crypto.randomUUID()}`;
    const draftPayload = {
      expectedCaseVersion: f.caseVersion,
      adultPartyPersonId: f.manager.personId,
      childPartyPersonId: child.personId,
      childParticipationId: participation.rows[0]!.id,
      sourceTemplateVersion: PHONE_USE_CONTRACT_CONTENT_VERSION,
      dependencyRefs: [],
      terms: defaultTerms,
    };

    // 1. Initial draft creation
    const firstDraft = await app.inject({
      method: 'POST',
      url: `/api/v1/cases/${f.caseId}/digital-use/contract/drafts`,
      headers: { ...auth(f.manager.token), 'idempotency-key': draftKey },
      payload: draftPayload,
    });
    expect(firstDraft.statusCode, firstDraft.body).toBe(201);
    const firstDraftBody = firstDraft.json();

    // 2. Both confirm and activate the contract to change its state to ACTIVE
    const [adultConf, childConf] = await Promise.all([
      app.inject({
        method: 'POST',
        url: `/api/v1/cases/${f.caseId}/digital-use/contract/1/confirm`,
        headers: commandHeaders(f.manager.token, 'f9-adult-conf'),
        payload: { expectedCaseVersion: f.caseVersion, expectedDraftRevision: 1 },
      }),
      app.inject({
        method: 'POST',
        url: `/api/v1/cases/${f.caseId}/digital-use/contract/1/confirm`,
        headers: commandHeaders(child.token, 'f9-child-conf'),
        payload: { expectedCaseVersion: f.caseVersion, expectedDraftRevision: 1 },
      }),
    ]);
    expect(adultConf.statusCode, adultConf.body).toBe(200);
    expect(childConf.statusCode, childConf.body).toBe(200);

    // 3. Now retry the original draft creation!
    // In current code: getCurrentActivePhoneUseContract() check runs BEFORE idempotency!
    // So it throws 422 PHONE_USE_CONTRACT_INVALID_PAYLOAD ("Use A4012 revision for an active Contract")
    const replayDraft = await app.inject({
      method: 'POST',
      url: `/api/v1/cases/${f.caseId}/digital-use/contract/drafts`,
      headers: { ...auth(f.manager.token), 'idempotency-key': draftKey },
      payload: draftPayload,
    });

    // THIS IS THE CORE OF FINDING #9:
    // It must replay the 201 response, NOT fail because the contract became active!
    expect(replayDraft.statusCode, replayDraft.body).toBe(201);
    expect(replayDraft.json().id).toBe(firstDraftBody.id);

    // 4. Mismatch payload with same key must return 409
    const mismatchDraft = await app.inject({
      method: 'POST',
      url: `/api/v1/cases/${f.caseId}/digital-use/contract/drafts`,
      headers: { ...auth(f.manager.token), 'idempotency-key': draftKey },
      payload: { ...draftPayload, terms: { ...defaultTerms, phoneUseRules: v('diff') } },
    });
    expect(mismatchDraft.statusCode).toBe(409);
    expect(mismatchDraft.json().code).toBe('IDEMPOTENCY_PAYLOAD_MISMATCH');
  });

  it('B2 Roleplay create exact replay bypasses mutable execution and compliance gates',async()=>{
    const adapter = {
      adapterRef: 'test:deterministic-roleplay-v1',
      async isAvailable() { return true; },
      async createTurn() {
        return {
          simulatedParentOutput: 'simulated parent',
          adapterRef: 'test:deterministic-roleplay-v1',
          modelRef: 'test-model',
          promptVersionRef: 'test-prompt-v1',
        };
      },
    };
    const roleplayApp = await buildApp({
      phoneUseContract: {
        roleplayAdapter: adapter,
        roleplayProfessionalContent: {
          status: 'APPROVED_PUBLISHED',
          version: PHONE_USE_CONTRACT_CONTENT_VERSION,
          authorityRef: 'test-authority:roleplay-v1',
        },
        roleplayModelPromptAuthority: async () => ({
          model: {
            status: 'CURRENT_APPROVED',
            modelRef: 'test-model',
            authorityRef: 'test-authority:model-v1',
          },
          prompt: {
            status: 'CURRENT_APPROVED',
            promptVersionRef: 'test-prompt-v1',
            authorityRef: 'test-authority:prompt-v1',
          },
        }),
      },
    });
    await roleplayApp.ready();

    try {
      const f = await createTestFixture(`b2-create-${crypto.randomUUID()}`);

      // Enable A4003 node state
      await admin.query(
        `INSERT INTO scene_node_states
           (family_id, case_id, scene_package_version, node_code, source_node_code,
            status, revision, branch_reason_codes, input_refs, output_refs)
         VALUES ($1, $2, $3, 'A4003', 'A4002', 'AVAILABLE', 1, ARRAY[]::text[], '[]'::jsonb, '[]'::jsonb)`,
        [f.familyId, f.caseId, DIGITAL_USE_PACKAGE_VERSION]
      );

      const key=`b2-create-${crypto.randomUUID()}`;
      const payload={expectedCaseVersion:f.caseVersion,professionalContentVersion:PHONE_USE_CONTRACT_CONTENT_VERSION};
      const request=(idempotencyKey=key)=>roleplayApp.inject({method:'POST',url:`/api/v1/cases/${f.caseId}/digital-use/roleplays`,headers:{...auth(f.manager.token),'idempotency-key':idempotencyKey},payload});
      const first=await request();
      expect(first.statusCode,first.body).toBe(201);
      await admin.query(`UPDATE person_compliance_profiles SET age_band='UNKNOWN',minor_mode=false WHERE person_id=$1`,[f.manager.personId]);
      const replay=await request();
      expect(replay.statusCode,replay.body).toBe(201);
      expect(replay.json()).toEqual(first.json());
      const blocked=await request(`${key}-new`);
      expect(blocked.statusCode,blocked.body).toBe(403);
      expect(blocked.json().code).toBe('AGE_BAND_UNKNOWN');
      expect((await admin.query('SELECT count(*)::int AS n FROM roleplay_sessions WHERE case_id=$1',[f.caseId])).rows[0].n).toBe(1);
    }finally{await roleplayApp.close();}
  });

  it.each(['WAITING', 'CLOSED', 'SAFETY_HOLD'] as const)(
    'Finding #10: Roleplay select exact replay after completion and %s lifecycle drift',
    async (lifecycleStatus) => {
    const adapter = {
      adapterRef: 'test:deterministic-roleplay-v1',
      async isAvailable() { return true; },
      async createTurn() {
        return {
          simulatedParentOutput: 'simulated parent',
          adapterRef: 'test:deterministic-roleplay-v1',
          modelRef: 'test-model',
          promptVersionRef: 'test-prompt-v1',
        };
      },
    };
    const roleplayApp = await buildApp({
      phoneUseContract: {
        roleplayAdapter: adapter,
        roleplayProfessionalContent: {
          status: 'APPROVED_PUBLISHED',
          version: PHONE_USE_CONTRACT_CONTENT_VERSION,
          authorityRef: 'test-authority:roleplay-v1',
        },
        roleplayModelPromptAuthority: async () => ({
          model: {
            status: 'CURRENT_APPROVED',
            modelRef: 'test-model',
            authorityRef: 'test-authority:model-v1',
          },
          prompt: {
            status: 'CURRENT_APPROVED',
            promptVersionRef: 'test-prompt-v1',
            authorityRef: 'test-authority:prompt-v1',
          },
        }),
      },
    });
    await roleplayApp.ready();

    try {
      const f = await createTestFixture(`finding10-${lifecycleStatus.toLowerCase()}`);

      // Enable A4003 node state
      await admin.query(
        `INSERT INTO scene_node_states
           (family_id, case_id, scene_package_version, node_code, source_node_code,
            status, revision, branch_reason_codes, input_refs, output_refs)
         VALUES ($1, $2, $3, 'A4003', 'A4002', 'AVAILABLE', 1, ARRAY[]::text[], '[]'::jsonb, '[]'::jsonb)`,
        [f.familyId, f.caseId, DIGITAL_USE_PACKAGE_VERSION]
      );

      // Create roleplay session in DB
      const sessionRes = await admin.query<{ id: string }>(
        `INSERT INTO roleplay_sessions
           (family_id, case_id, actor_person_id, status, scene_package_version,
            professional_content_version, compliance_policy_ref, adapter_ref, revision)
         VALUES ($1, $2, $3, 'OPEN', $4, $5, 'test-compliance', 'test-adapter', 1)
         RETURNING id`,
        [f.familyId, f.caseId, f.manager.personId, DIGITAL_USE_PACKAGE_VERSION, PHONE_USE_CONTRACT_CONTENT_VERSION]
      );
      const sessionId = sessionRes.rows[0]!.id;

      // Create a turn
      const turnRes = await admin.query<{ id: string }>(
        `INSERT INTO roleplay_turns
           (family_id, case_id, session_id, round_number, simulated_child_input,
            simulated_parent_output, provenance, model_ref, prompt_version_ref)
         VALUES ($1, $2, $3, 1, 'Hello parent', 'Hello child', 'SIMULATION', 'test-model', 'test-prompt-v1')
         RETURNING id`,
        [f.familyId, f.caseId, sessionId]
      );
      const turnId = turnRes.rows[0]!.id;

      const selectKey = `f10-select-${crypto.randomUUID()}`;
      const selectPayload = {
        expectedCaseVersion: f.caseVersion,
        turnId,
        expectedSessionRevision: 1,
        expectedNodeRevision: 1,
      };

      // 1. First select
      const firstSelect = await roleplayApp.inject({
        method: 'POST',
        url: `/api/v1/cases/${f.caseId}/digital-use/roleplays/${sessionId}/select`,
        headers: { ...auth(f.manager.token), 'idempotency-key': selectKey },
        payload: selectPayload,
      });
      expect(firstSelect.statusCode, firstSelect.body).toBe(200);

      // Advance the Case through the actual Common Core primary-switch command,
      // then restore the original Case as primary. Do not fake the version.
      const other = await createCase(roleplayApp, f.manager.token, 'f10-version-advance');
      expect(other.statusCode, other.body).toBe(201);
      const switchTo = await roleplayApp.inject({
        method: 'POST', url: `/api/v1/cases/${other.json().id}/switch-primary`,
        headers: commandHeaders(f.manager.token, 'f10-switch-away'),
        payload: { reason: 'version advance', expectedPrimaryCaseId: f.caseId, expectedPrimaryVersion: f.caseVersion },
      });
      expect(switchTo.statusCode, switchTo.body).toBe(200);
      const switchBack = await roleplayApp.inject({
        method: 'POST', url: `/api/v1/cases/${f.caseId}/switch-primary`,
        headers: commandHeaders(f.manager.token, 'f10-switch-back'),
        payload: { reason: 'restore primary', expectedPrimaryCaseId: other.json().id, expectedPrimaryVersion: switchTo.json().primary.version },
      });
      expect(switchBack.statusCode, switchBack.body).toBe(200);
      const newVersion = switchBack.json().primary.version as number;
      expect(newVersion).toBeGreaterThan(f.caseVersion);
      const mutations = async () => (await admin.query(
        `SELECT (SELECT count(*)::int FROM scene_artifacts WHERE case_id=$1 AND artifact_type='PHONE_USE_ROLEPLAY_SELECTION') AS artifacts,
                (SELECT count(*)::int FROM case_events WHERE case_id=$1) AS events,
                (SELECT count(*)::int FROM business_audit_events WHERE family_id=$2) AS audits`,
        [f.caseId, f.familyId]
      )).rows[0];
      const beforeReplay = await mutations();

      // 2. Retry exact same select with its original Case revision
      const retrySelect = await roleplayApp.inject({
        method: 'POST',
        url: `/api/v1/cases/${f.caseId}/digital-use/roleplays/${sessionId}/select`,
        headers: { ...auth(f.manager.token), 'idempotency-key': selectKey },
        payload: selectPayload,
      });

      // THIS IS THE CORE OF FINDING #10:
      // It must replay 200, NOT fail with STALE_NODE_REVISION
      expect(retrySelect.statusCode, retrySelect.body).toBe(200);
      expect(retrySelect.json()).toEqual(firstSelect.json());

      // 3. Mismatch payload
      const mismatchSelect = await roleplayApp.inject({
        method: 'POST',
        url: `/api/v1/cases/${f.caseId}/digital-use/roleplays/${sessionId}/select`,
        headers: { ...auth(f.manager.token), 'idempotency-key': selectKey },
        payload: { ...selectPayload, expectedSessionRevision: 2 },
      });
      expect(mismatchSelect.statusCode).toBe(409);
      expect(mismatchSelect.json().code).toBe('IDEMPOTENCY_PAYLOAD_MISMATCH');

      const versionMismatch = await roleplayApp.inject({
        method: 'POST', url: `/api/v1/cases/${f.caseId}/digital-use/roleplays/${sessionId}/select`,
        headers: { ...auth(f.manager.token), 'idempotency-key': selectKey },
        payload: { ...selectPayload, expectedCaseVersion: newVersion },
      });
      expect(versionMismatch.statusCode, versionMismatch.body).toBe(409);
      expect(versionMismatch.json().code).toBe('IDEMPOTENCY_PAYLOAD_MISMATCH');
      const outsider = await loginWithLabel(roleplayApp, 'f10-outsider');
      const denied = await roleplayApp.inject({
        method: 'POST', url: `/api/v1/cases/${f.caseId}/digital-use/roleplays/${sessionId}/select`,
        headers: { ...auth(outsider.token), 'idempotency-key': selectKey },
        payload: selectPayload,
      });
      expect(denied.statusCode).toBe(404);
      expect(await mutations()).toEqual(beforeReplay);

      // No public WAITING/CLOSED transition command exists in the current
      // Case route surface. Seed a valid post-transition state via the same
      // admin fixture seam as case-primary-switch-waiting.test.ts; exercise
      // the REAL production Select route with the existing committed key.
      // Each parameter starts from its own successful OPEN Case.
      const transitioned = await admin.query<{ version: number }>(
        `UPDATE cases SET status=$2::case_status,
                phase=CASE WHEN $2::case_status='CLOSED' THEN 'CLOSED'::case_phase ELSE phase END,
                is_primary=CASE WHEN $2::case_status='CLOSED' THEN false ELSE is_primary END,
                version=version+1, updated_at=now()
          WHERE id=$1 AND status='OPEN' RETURNING version`,
        [f.caseId, lifecycleStatus]
      );
      expect(transitioned.rowCount).toBe(1);
      const transitionedVersion = transitioned.rows[0]!.version;
      expect(transitionedVersion).toBe(newVersion + 1);
      const visible = await roleplayApp.inject({
        method: 'GET', url: `/api/v1/cases/${f.caseId}`, headers: auth(f.manager.token),
      });
      expect(visible.statusCode, visible.body).toBe(200);
      expect(visible.json()).toMatchObject({ status: lifecycleStatus, version: transitionedVersion });

      const snapshot = async () => ({
        mutations: await mutations(),
        caseRow: (await admin.query('SELECT * FROM cases WHERE id=$1', [f.caseId])).rows[0],
        session: (await admin.query('SELECT * FROM roleplay_sessions WHERE id=$1', [sessionId])).rows[0],
        node: (await admin.query("SELECT * FROM scene_node_states WHERE case_id=$1 AND node_code='A4003'", [f.caseId])).rows[0],
        idempotency: (await admin.query(
          "SELECT count(*)::int AS n FROM idempotency_keys WHERE actor_account_id=$1 AND command_type='PHONE_USE_ROLEPLAY_SELECT'",
          [f.manager.accountId]
        )).rows[0],
      });
      const beforeLifecycleReplay = await snapshot();
      const lifecycleReplay = await roleplayApp.inject({
        method: 'POST',
        url: `/api/v1/cases/${f.caseId}/digital-use/roleplays/${sessionId}/select`,
        headers: { ...auth(f.manager.token), 'idempotency-key': selectKey },
        payload: selectPayload,
      });
      const lifecycleCode = lifecycleStatus === 'SAFETY_HOLD'
        ? 'SAFETY_HOLD_BLOCKED'
        : lifecycleStatus === 'CLOSED' ? 'CASE_CLOSED' : 'CASE_NOT_OPEN';
      if (lifecycleStatus === 'SAFETY_HOLD') {
        expect(lifecycleReplay.statusCode, lifecycleReplay.body).toBe(409);
        expect(lifecycleReplay.json().code).toBe(lifecycleCode);
      } else {
        expect(lifecycleReplay.statusCode, lifecycleReplay.body).toBe(200);
        expect(lifecycleReplay.json()).toEqual(firstSelect.json());
        const lifecycleMismatch = await roleplayApp.inject({
          method: 'POST',
          url: `/api/v1/cases/${f.caseId}/digital-use/roleplays/${sessionId}/select`,
          headers: { ...auth(f.manager.token), 'idempotency-key': selectKey },
          payload: { ...selectPayload, expectedCaseVersion: transitionedVersion },
        });
        expect(lifecycleMismatch.statusCode, lifecycleMismatch.body).toBe(409);
        expect(lifecycleMismatch.json().code).toBe('IDEMPOTENCY_PAYLOAD_MISMATCH');
      }
      // A fresh operation must still fail the ordinary execution gate, even
      // with the current Case/session/node revisions. No new reservation,
      // selection, event or audit can survive the rejected transaction.
      const fresh = await roleplayApp.inject({
        method: 'POST',
        url: `/api/v1/cases/${f.caseId}/digital-use/roleplays/${sessionId}/select`,
        headers: commandHeaders(f.manager.token, `f10-new-${lifecycleStatus.toLowerCase()}`),
        payload: {
          ...selectPayload,
          expectedCaseVersion: transitionedVersion,
          expectedSessionRevision: beforeLifecycleReplay.session.revision,
          expectedNodeRevision: beforeLifecycleReplay.node.revision,
        },
      });
      expect(fresh.statusCode, fresh.body).toBe(409);
      expect(fresh.json().code).toBe(lifecycleCode);
      expect(await snapshot()).toEqual(beforeLifecycleReplay);
    } finally {
      await roleplayApp.close();
    }
  });

  it('Finding #24: Downstream Goal and Phone Contract review_state propagation on dependency invalidation', async () => {
    const child = await loginWithLabel(app, `s14-f24-child-${crypto.randomUUID()}`);
    const f = await createTestFixture('finding24', child);

    const childParticipation = await admin.query<{ id: string }>(
      `INSERT INTO case_participants
         (family_id, case_id, person_id, state, invite_token_hash, invite_expires_at, created_by_person_id, accepted_at)
       VALUES ($1, $2, $3, 'ACTIVE', $4, now() + interval '1 day', $5, now())
       RETURNING id`,
      [f.familyId, f.caseId, child.personId, crypto.randomUUID().replaceAll('-', '').repeat(2), f.manager.personId]
    );

    // 1. Create upstream Assertion a1 and unrelated a2
    const a1Res = await admin.query<{ id: string }>(
      `INSERT INTO assertions
         (family_id, case_id, subject_person_id, source_kind, source_person_id,
          occurred_time_state, confirmation_status, kind, content)
       VALUES ($1, $2, $4, 'SELF_STATEMENT', $3, 'UNKNOWN', 'UNCONFIRMED', 'STATEMENT', 'Uses phone after 11pm daily')
       RETURNING id`,
      [f.familyId, f.caseId, f.manager.personId, child.personId]
    );
    const a1Id = a1Res.rows[0]!.id;

    const a2Res = await admin.query<{ id: string }>(
      `INSERT INTO assertions
         (family_id, case_id, subject_person_id, source_kind, source_person_id,
          occurred_time_state, confirmation_status, kind, content)
       VALUES ($1, $2, $4, 'SELF_STATEMENT', $3, 'UNKNOWN', 'UNCONFIRMED', 'STATEMENT', 'Plays football on Saturday')
       RETURNING id`,
      [f.familyId, f.caseId, f.manager.personId, child.personId]
    );
    const a2Id = a2Res.rows[0]!.id;

    const a1Dependency = {
      type: 'EVIDENCE',
      evidence: { type: 'ASSERTION', id: a1Id },
    };
    const a2Dependency = {
      type: 'EVIDENCE',
      evidence: { type: 'ASSERTION', id: a2Id },
    };
    const a1ContractDependency = { type: 'ASSERTION', id: a1Id };
    const a2ContractDependency = { type: 'ASSERTION', id: a2Id };

    // 2. Link upstream dependency a1 into the fixture's Problem Formulation
    const pfRes = await admin.query<{ id: string }>(
      `UPDATE problem_formulations
          SET dependency_refs = $1::jsonb
        WHERE case_id = $2 AND version = 1
        RETURNING id`,
      [JSON.stringify([a1Dependency]), f.caseId]
    );
    const pfId = pfRes.rows[0]!.id;

    // 3. Create Goal g1 dependent on a1 in fixture 1
    const g1Res = await admin.query<{ id: string; goal_id: string }>(
      `INSERT INTO goals
         (family_id, case_id, version, lifecycle_status, confirmation_state, review_state,
          problem_formulation_id, problem_formulation_version, baseline_refs, target_description,
          observation_method, observation_window, protective_conditions, parent_actions,
          review_point, dependency_refs, participant_responsibilities, saved_by_person_id)
       VALUES ($1, $2, 1, 'ACTIVE', 'UNCONFIRMED', 'CURRENT',
          $3, 1, $4::jsonb, 'Turn off phone before 10pm',
          'Evening check', '7 days', '["No arguing"]'::jsonb, '["Keep door unlocked"]'::jsonb,
          'Sunday review', $5::jsonb, '[]'::jsonb, $6)
       RETURNING id, goal_id`,
      [f.familyId, f.caseId, pfId, JSON.stringify([{ type: 'ASSERTION', id: a1Id }]), JSON.stringify([a1Dependency]), f.manager.personId]
    );
    const g1Id = g1Res.rows[0]!.id;

    // Create fixture 2 for unrelated objects
    const child2 = await loginWithLabel(app, `s14-f24-child2-${crypto.randomUUID()}`);
    const f2 = await createTestFixture('finding24-unrelated', child2);
    const child2Part = await admin.query<{ id: string }>(
      `INSERT INTO case_participants
         (family_id, case_id, person_id, state, invite_token_hash, invite_expires_at, created_by_person_id, accepted_at)
       VALUES ($1, $2, $3, 'ACTIVE', $4, now() + interval '1 day', $5, now())
       RETURNING id`,
      [f2.familyId, f2.caseId, child2.personId, crypto.randomUUID().replaceAll('-', '').repeat(2), f2.manager.personId]
    );

    const pf2Res = await admin.query<{ id: string }>(
      `UPDATE problem_formulations
          SET dependency_refs = $1::jsonb
        WHERE case_id = $2 AND version = 1
        RETURNING id`,
      [JSON.stringify([a2Dependency]), f2.caseId]
    );
    const pf2Id = pf2Res.rows[0]!.id;

    const gUnrelatedRes = await admin.query<{ id: string }>(
      `INSERT INTO goals
         (family_id, case_id, version, lifecycle_status, confirmation_state, review_state,
          problem_formulation_id, problem_formulation_version, baseline_refs, target_description,
          observation_method, observation_window, protective_conditions, parent_actions,
          review_point, dependency_refs, participant_responsibilities, saved_by_person_id)
       VALUES ($1, $2, 1, 'ACTIVE', 'UNCONFIRMED', 'CURRENT',
          $3, 1, $4::jsonb, 'Exercise on Saturday',
          'Direct check', '7 days', '["No injury"]'::jsonb, '["Accompany to park"]'::jsonb,
          'Saturday review', $5::jsonb, '[]'::jsonb, $6)
       RETURNING id`,
      [f2.familyId, f2.caseId, pf2Id, JSON.stringify([{ type: 'ASSERTION', id: a2Id }]), JSON.stringify([a2Dependency]), f2.manager.personId]
    );
    const gUnrelatedId = gUnrelatedRes.rows[0]!.id;

    // 4. Create Phone Contract c1 dependent on a1 (ACTIVE), and c_unrelated dependent on a2
    const c1ParentConf = JSON.stringify({
      kind: 'ADULT', personId: f.manager.personId, accountId: f.manager.accountId,
      draftRevision: 1, authorizationAction: 'CASE_RESPOND_ASSESSMENT_SCENE',
      confirmedAt: new Date().toISOString(),
    });
    const c1ChildConf = JSON.stringify({
      kind: 'CHILD', personId: child.personId, accountId: child.accountId,
      participationId: childParticipation.rows[0]!.id,
      draftRevision: 1, authorizationAction: 'PHONE_USE_CONTRACT_CONFIRM_SELF',
      confirmedAt: new Date().toISOString(),
    });

    const c1Res = await admin.query<{ id: string }>(
      `INSERT INTO digital_use_contract_versions
         (family_id, case_id, version, draft_revision, status, review_state,
          adult_party_person_id, child_party_person_id, child_participation_id,
          contract_purpose, phone_use_rules, execution_period, parent_support_measures,
          supervision_measures, incentives, breach_responsibilities, source_template_version,
          dependency_refs, parent_confirmation, child_confirmation, activated_at, created_by_person_id)
       VALUES ($1, $2, 1, 1, 'ACTIVE', 'CURRENT',
          $3, $4, $5,
          $6::jsonb, $6::jsonb, $6::jsonb, $6::jsonb,
          $6::jsonb, $6::jsonb, $6::jsonb, $7,
          $8::jsonb, $9::jsonb, $10::jsonb, now(), $3)
       RETURNING id`,
      [
        f.familyId, f.caseId, f.manager.personId, child.personId, childParticipation.rows[0]!.id,
        JSON.stringify(v('rule')), PHONE_USE_CONTRACT_CONTENT_VERSION,
        JSON.stringify([a1ContractDependency]),
        c1ParentConf, c1ChildConf,
      ]
    );
    const c1Id = c1Res.rows[0]!.id;

    const c2ParentConf = JSON.stringify({
      kind: 'ADULT', personId: f2.manager.personId, accountId: f2.manager.accountId,
      draftRevision: 1, authorizationAction: 'CASE_RESPOND_ASSESSMENT_SCENE',
      confirmedAt: new Date().toISOString(),
    });
    const c2ChildConf = JSON.stringify({
      kind: 'CHILD', personId: child2.personId, accountId: child2.accountId,
      participationId: child2Part.rows[0]!.id,
      draftRevision: 1, authorizationAction: 'PHONE_USE_CONTRACT_CONFIRM_SELF',
      confirmedAt: new Date().toISOString(),
    });

    const cUnrelatedRes = await admin.query<{ id: string }>(
      `INSERT INTO digital_use_contract_versions
         (family_id, case_id, version, draft_revision, status, review_state,
          adult_party_person_id, child_party_person_id, child_participation_id,
          contract_purpose, phone_use_rules, execution_period, parent_support_measures,
          supervision_measures, incentives, breach_responsibilities, source_template_version,
          dependency_refs, parent_confirmation, child_confirmation, activated_at, created_by_person_id)
       VALUES ($1, $2, 1, 1, 'ACTIVE', 'CURRENT',
          $3, $4, $5,
          $6::jsonb, $6::jsonb, $6::jsonb, $6::jsonb,
          $6::jsonb, $6::jsonb, $6::jsonb, $7,
          $8::jsonb, $9::jsonb, $10::jsonb, now(), $3)
       RETURNING id`,
      [
        f2.familyId, f2.caseId, f2.manager.personId, child2.personId, child2Part.rows[0]!.id,
        JSON.stringify(v('rule')), PHONE_USE_CONTRACT_CONTENT_VERSION,
        JSON.stringify([a2ContractDependency]),
        c2ParentConf, c2ChildConf,
      ]
    );
    const cUnrelatedId = cUnrelatedRes.rows[0]!.id;

    // 5. Verify database guard protection:
    // Direct unauthorized UPDATE of review_state without propagation owner fails with GOAL_REVIEW_STATE_RUNTIME_UNOWNED
    await expect(
      admin.query(`UPDATE goals SET review_state = 'NEEDS_REVIEW' WHERE id = $1`, [g1Id])
    ).rejects.toThrow('GOAL_REVIEW_STATE_RUNTIME_UNOWNED');

    await expect(
      admin.query(`UPDATE digital_use_contract_versions SET review_state = 'NEEDS_REVIEW' WHERE id = $1`, [c1Id])
    ).rejects.toThrow('PHONE_USE_CONTRACT_REVIEW_STATE_RUNTIME_UNOWNED');

    // A1: a normal runtime session cannot forge propagation authority by
    // manually setting the historical custom GUC.
    const appAttack = new pg.Client({ connectionString: process.env['DATABASE_URL']! });
    await appAttack.connect();
    try {
      await appAttack.query('BEGIN');
      await appAttack.query(
        `SELECT app.set_identity_context($1, 'FAMILY_MANAGEMENT')`,
        [f.manager.accountId]
      );
      await appAttack.query(
        `SELECT app.set_family_context($1, $2, 'FAMILY_MANAGEMENT')`,
        [f.familyId, f.manager.personId]
      );
      await appAttack.query(
        `SELECT set_config('app.dependency_review_propagation', 'on', true)`
      );
      const authority = await appAttack.query<{ authorized: boolean }>(
        `SELECT app.dependency_review_propagation_authorized() AS authorized`
      );
      expect(authority.rows[0]?.authorized).toBe(false);
      await expect(
        appAttack.query(
          `UPDATE digital_use_contract_versions
              SET review_state='NEEDS_REVIEW'
            WHERE id=$1`,
          [c1Id]
        )
      ).rejects.toThrow('PHONE_USE_CONTRACT_REVIEW_STATE_RUNTIME_UNOWNED');
      await appAttack.query('ROLLBACK');

      // The formal primitive itself also rejects forged account/person context.
      await appAttack.query('BEGIN');
      await appAttack.query(
        `SELECT set_config('app.family_id', $1, true),
                set_config('app.account_id', $2, true),
                set_config('app.person_id', $3, true),
                set_config('app.purpose', 'FAMILY_MANAGEMENT', true)`,
        [f.familyId, f.manager.accountId, child.personId]
      );
      await expect(
        appAttack.query(
          `SELECT app.propagate_downstream_dependency_review($1,$2,$3::jsonb)`,
          [f.familyId, f.caseId, JSON.stringify(a1Dependency)]
        )
      ).rejects.toThrow('PROPAGATE_DEPENDENCY_REVIEW_IDENTITY_INVALID');
      await appAttack.query('ROLLBACK');
    } finally {
      await appAttack.end();
    }

    // 6a. Negative tests: BLOCKER C-01 & C-02 privilege boundary and strict dependency validation
    // C-01: Unauthenticated caller fails closed
    await expect(
      admin.query(`SELECT app.propagate_downstream_dependency_review($1, $2, $3::jsonb)`, [
        f.familyId, f.caseId, JSON.stringify(a1Dependency),
      ])
    ).rejects.toThrow('PROPAGATE_DEPENDENCY_REVIEW_UNAUTHENTICATED');

    const client = await admin.connect();
    try {
      // C-01: Supplied family_id does not match authenticated context fails closed
      await client.query('BEGIN');
      await client.query(
        `SELECT set_config('app.family_id', $1, true),
                set_config('app.account_id', $2, true),
                set_config('app.person_id', $3, true),
                set_config('app.purpose', 'FAMILY_MANAGEMENT', true)`,
        [f.familyId, f.manager.accountId, f.manager.personId]
      );
      await expect(
        client.query(`SELECT app.propagate_downstream_dependency_review($1, $2, $3::jsonb)`, [
          f2.familyId, f.caseId, JSON.stringify(a1Dependency),
        ])
      ).rejects.toThrow('PROPAGATE_DEPENDENCY_REVIEW_FAMILY_MISMATCH');
      await client.query('ROLLBACK');

      // C-01: Case scope invalid (case belongs to f2, not f) fails closed
      await client.query('BEGIN');
      await client.query(
        `SELECT set_config('app.family_id', $1, true),
                set_config('app.account_id', $2, true),
                set_config('app.person_id', $3, true),
                set_config('app.purpose', 'FAMILY_MANAGEMENT', true)`,
        [f.familyId, f.manager.accountId, f.manager.personId]
      );
      await expect(
        client.query(`SELECT app.propagate_downstream_dependency_review($1, $2, $3::jsonb)`, [
          f.familyId, f2.caseId, JSON.stringify(a1Dependency),
        ])
      ).rejects.toThrow('PROPAGATE_DEPENDENCY_REVIEW_CASE_SCOPE_INVALID');
      await client.query('ROLLBACK');

      // C-02: Empty object {} fails closed
      await client.query('BEGIN');
      await client.query(
        `SELECT set_config('app.family_id', $1, true),
                set_config('app.account_id', $2, true),
                set_config('app.person_id', $3, true),
                set_config('app.purpose', 'FAMILY_MANAGEMENT', true)`,
        [f.familyId, f.manager.accountId, f.manager.personId]
      );
      await expect(
        client.query(`SELECT app.propagate_downstream_dependency_review($1, $2, $3::jsonb)`, [
          f.familyId, f.caseId, '{}',
        ])
      ).rejects.toThrow('PROPAGATE_DEPENDENCY_REVIEW_PAYLOAD_INVALID');
      await client.query('ROLLBACK');

      // C-02: Unknown dependency type fails closed
      await client.query('BEGIN');
      await client.query(
        `SELECT set_config('app.family_id', $1, true),
                set_config('app.account_id', $2, true),
                set_config('app.person_id', $3, true),
                set_config('app.purpose', 'FAMILY_MANAGEMENT', true)`,
        [f.familyId, f.manager.accountId, f.manager.personId]
      );
      await expect(
        client.query(`SELECT app.propagate_downstream_dependency_review($1, $2, $3::jsonb)`, [
          f.familyId, f.caseId, JSON.stringify({ type: 'UNKNOWN_TYPE', id: a1Id }),
        ])
      ).rejects.toThrow('PROPAGATE_DEPENDENCY_REVIEW_PAYLOAD_INVALID');
      await client.query('ROLLBACK');

      // C-02: Malformed UUID fails closed
      await client.query('BEGIN');
      await client.query(
        `SELECT set_config('app.family_id', $1, true),
                set_config('app.account_id', $2, true),
                set_config('app.person_id', $3, true),
                set_config('app.purpose', 'FAMILY_MANAGEMENT', true)`,
        [f.familyId, f.manager.accountId, f.manager.personId]
      );
      await expect(
        client.query(`SELECT app.propagate_downstream_dependency_review($1, $2, $3::jsonb)`, [
          f.familyId, f.caseId, JSON.stringify({ type: 'ASSERTION', assertionId: 'not-a-valid-uuid' }),
        ])
      ).rejects.toThrow('PROPAGATE_DEPENDENCY_REVIEW_PAYLOAD_INVALID');
      await client.query('ROLLBACK');

      // 6b. Genuine propagation with authenticated actor and valid dependency
      await client.query('BEGIN');
      await client.query(
        `SELECT set_config('app.family_id', $1, true),
                set_config('app.account_id', $2, true),
                set_config('app.person_id', $3, true),
                set_config('app.purpose', 'FAMILY_MANAGEMENT', true)`,
        [f.familyId, f.manager.accountId, f.manager.personId]
      );
      const propResult = await client.query<{ propagate_downstream_dependency_review: { goalsAffected: number; contractsAffected: number } }>(
        `SELECT app.propagate_downstream_dependency_review($1, $2, $3::jsonb)`,
        [f.familyId, f.caseId, JSON.stringify(a1Dependency)]
      );
      await client.query('COMMIT');
      expect(propResult.rows[0]!.propagate_downstream_dependency_review.goalsAffected).toBe(1);
      expect(propResult.rows[0]!.propagate_downstream_dependency_review.contractsAffected).toBe(1);
    } finally {
      client.release();
    }

    // 7. Verify propagated review state and untouched lifecycle/unrelated objects
    const g1After = await admin.query<{ review_state: string; lifecycle_status: string }>(
      `SELECT review_state, lifecycle_status FROM goals WHERE id = $1`, [g1Id]
    );
    expect(g1After.rows[0]!.review_state).toBe('NEEDS_REVIEW');
    expect(g1After.rows[0]!.lifecycle_status).toBe('ACTIVE'); // Lifecycle untouched

    const gUnrelatedAfter = await admin.query<{ review_state: string }>(
      `SELECT review_state FROM goals WHERE id = $1`, [gUnrelatedId]
    );
    expect(gUnrelatedAfter.rows[0]!.review_state).toBe('CURRENT'); // Unrelated untouched

    const c1After = await admin.query<{ review_state: string; status: string }>(
      `SELECT review_state, status FROM digital_use_contract_versions WHERE id = $1`, [c1Id]
    );
    expect(c1After.rows[0]!.review_state).toBe('NEEDS_REVIEW');
    expect(c1After.rows[0]!.status).toBe('ACTIVE'); // Lifecycle untouched

    const cUnrelatedAfter = await admin.query<{ review_state: string }>(
      `SELECT review_state FROM digital_use_contract_versions WHERE id = $1`, [cUnrelatedId]
    );
    expect(cUnrelatedAfter.rows[0]!.review_state).toBe('CURRENT'); // Unrelated untouched

    // 8. Verify audit logs recorded
    const audits = await admin.query<{ event_type: string; resource_type: string }>(
      `SELECT event_type, resource_type FROM business_audit_events
        WHERE family_id = $1 AND event_type IN ('GOAL_REVIEW_STATE_CHANGED', 'PHONE_USE_CONTRACT_REVIEW_STATE_CHANGED')`,
      [f.familyId]
    );
    expect(audits.rows.map(r => r.event_type)).toContain('GOAL_REVIEW_STATE_CHANGED');
    expect(audits.rows.map(r => r.event_type)).toContain('PHONE_USE_CONTRACT_REVIEW_STATE_CHANGED');

    // 9. A2: ACTIVE + NEEDS_REVIEW must recover through a NEW revision.
    // The predecessor remains immutable and cannot resume execution directly.
    const recoveryRevision = await app.inject({
      method: 'POST',
      url: `/api/v1/cases/${f.caseId}/digital-use/contract/1/revise`,
      headers: { ...auth(f.manager.token), 'idempotency-key': `f24-active-recovery-${crypto.randomUUID()}` },
      payload: {
        expectedCaseVersion: f.caseVersion,
        expectedActiveDraftRevision: 1,
        updateTrigger: 'NEW_PROBLEM',
        updateReason: 'Upstream dependency changed; create a reviewed successor',
      },
    });
    expect(recoveryRevision.statusCode, recoveryRevision.body).toBe(201);
    expect(recoveryRevision.json()).toMatchObject({ version: 2, status: 'DRAFT' });

    const beforeCorrection = await admin.query<{
      version: number;
      status: string;
      review_state: string;
      supersedes_id: string | null;
    }>(
      `SELECT version,status,review_state,supersedes_id
         FROM digital_use_contract_versions
        WHERE case_id=$1
        ORDER BY version`,
      [f.caseId]
    );
    expect(beforeCorrection.rows).toEqual([
      expect.objectContaining({
        version: 1,
        status: 'ACTIVE',
        review_state: 'NEEDS_REVIEW',
        supersedes_id: null,
      }),
      expect.objectContaining({
        version: 2,
        status: 'DRAFT',
        review_state: 'NEEDS_REVIEW',
        supersedes_id: c1Id,
      }),
    ]);

    const corrected = await app.inject({
      method: 'PATCH',
      url: `/api/v1/cases/${f.caseId}/digital-use/contract/drafts/2`,
      headers: { ...auth(f.manager.token), 'idempotency-key': `f24-active-correct-${crypto.randomUUID()}` },
      payload: {
        expectedCaseVersion: f.caseVersion,
        expectedDraftRevision: 1,
        dependencyRefs: [a2ContractDependency],
        terms: defaultTerms,
      },
    });
    expect(corrected.statusCode, corrected.body).toBe(200);
    expect(corrected.json()).toMatchObject({ version: 2, status: 'DRAFT', draftRevision: 2 });

    const correctedDb = await admin.query<{ review_state: string }>(
      `SELECT review_state FROM digital_use_contract_versions WHERE case_id=$1 AND version=2`,
      [f.caseId]
    );
    expect(correctedDb.rows[0]?.review_state).toBe('CURRENT');

    const adultConfirm = await app.inject({
      method: 'POST',
      url: `/api/v1/cases/${f.caseId}/digital-use/contract/2/confirm`,
      headers: { ...auth(f.manager.token), 'idempotency-key': `f24-active-adult-${crypto.randomUUID()}` },
      payload: { expectedCaseVersion: f.caseVersion, expectedDraftRevision: 2 },
    });
    expect(adultConfirm.statusCode, adultConfirm.body).toBe(200);

    const childConfirm = await app.inject({
      method: 'POST',
      url: `/api/v1/cases/${f.caseId}/digital-use/contract/2/confirm`,
      headers: { ...auth(child.token), 'idempotency-key': `f24-active-child-${crypto.randomUUID()}` },
      payload: { expectedCaseVersion: f.caseVersion, expectedDraftRevision: 2 },
    });
    expect(childConfirm.statusCode, childConfirm.body).toBe(200);

    const recoveredChain = await admin.query<{
      id: string;
      version: number;
      status: string;
      review_state: string;
      supersedes_id: string | null;
      superseded_at: Date | null;
    }>(
      `SELECT id,version,status,review_state,supersedes_id,superseded_at
         FROM digital_use_contract_versions
        WHERE case_id=$1
        ORDER BY version`,
      [f.caseId]
    );
    expect(recoveredChain.rows[0]).toMatchObject({
      id: c1Id,
      version: 1,
      status: 'SUPERSEDED',
      review_state: 'NEEDS_REVIEW',
    });
    expect(recoveredChain.rows[0]?.superseded_at).not.toBeNull();
    expect(recoveredChain.rows[1]).toMatchObject({
      version: 2,
      status: 'ACTIVE',
      review_state: 'CURRENT',
      supersedes_id: c1Id,
    });

    // 10. Verify idempotency of propagation:
    // Repeating propagation when already in NEEDS_REVIEW affects 0 rows and does not fail
    const repeatClient = await admin.connect();
    try {
      await repeatClient.query('BEGIN');
      await repeatClient.query(
        `SELECT set_config('app.family_id', $1, true),
                set_config('app.account_id', $2, true),
                set_config('app.person_id', $3, true),
                set_config('app.purpose', 'FAMILY_MANAGEMENT', true)`,
        [f.familyId, f.manager.accountId, f.manager.personId]
      );
      const repeatResult = await repeatClient.query<{ propagate_downstream_dependency_review: { goalsAffected: number; contractsAffected: number } }>(
        `SELECT app.propagate_downstream_dependency_review($1, $2, $3::jsonb)`,
        [f.familyId, f.caseId, JSON.stringify(a1Dependency)]
      );
      await repeatClient.query('COMMIT');
      expect(repeatResult.rows[0]!.propagate_downstream_dependency_review.goalsAffected).toBe(0);
      expect(repeatResult.rows[0]!.propagate_downstream_dependency_review.contractsAffected).toBe(0);
    } finally {
      repeatClient.release();
    }
  });

  it('A3 / N-05: Consent revoke reaches unversioned and exact-version Problem Formulation/Goal/Contract dependencies', async () => {
    async function seedGoal(
      fixture: Fixture,
      dependency: Record<string, unknown>,
      suffix: string
    ): Promise<string> {
      const formulation = await admin.query<{ id: string }>(
        `SELECT id FROM problem_formulations WHERE case_id=$1 AND version=1`,
        [fixture.caseId]
      );
      const evidence = await admin.query<{ id: string }>(
        `SELECT id FROM dialogue_messages WHERE case_id=$1 ORDER BY id LIMIT 1`,
        [fixture.caseId]
      );
      const row = await admin.query<{ id: string }>(
        `INSERT INTO goals
           (family_id,case_id,version,lifecycle_status,confirmation_state,review_state,
            problem_formulation_id,problem_formulation_version,baseline_refs,target_description,
            observation_method,observation_window,protective_conditions,parent_actions,
            review_point,dependency_refs,participant_responsibilities,saved_by_person_id)
         VALUES
           ($1,$2,1,'ACTIVE','UNCONFIRMED','CURRENT',$3,1,$4::jsonb,$5,
            'Direct check','7 days','["No harm"]'::jsonb,'["Support"]'::jsonb,
            'Weekly review',$6::jsonb,'[]'::jsonb,$7)
         RETURNING id`,
        [
          fixture.familyId,
          fixture.caseId,
          formulation.rows[0]!.id,
          JSON.stringify([{ type: 'DIALOGUE_MESSAGE', id: evidence.rows[0]!.id }]),
          `Consent propagation ${suffix}`,
          JSON.stringify([dependency]),
          fixture.manager.personId,
        ]
      );
      return row.rows[0]!.id;
    }

    async function seedDraftContract(
      fixture: Fixture,
      child: LoginResult,
      dependency: Record<string, unknown>
    ): Promise<string> {
      const row = await admin.query<{ id: string }>(
        `INSERT INTO digital_use_contract_versions
           (family_id,case_id,version,draft_revision,status,review_state,
            adult_party_person_id,child_party_person_id,
            contract_purpose,phone_use_rules,execution_period,parent_support_measures,
            supervision_measures,incentives,breach_responsibilities,source_template_version,
            dependency_refs,created_by_person_id)
         VALUES
           ($1,$2,1,1,'DRAFT','CURRENT',$3,$4,
            $5::jsonb,$5::jsonb,$5::jsonb,$5::jsonb,$5::jsonb,$5::jsonb,$5::jsonb,$6,$7::jsonb,$3)
         RETURNING id`,
        [
          fixture.familyId,
          fixture.caseId,
          fixture.manager.personId,
          child.personId,
          JSON.stringify(v('rule')),
          PHONE_USE_CONTRACT_CONTENT_VERSION,
          JSON.stringify([dependency]),
        ]
      );
      return row.rows[0]!.id;
    }

    async function propagate(
      fixture: Fixture,
      dependency: Record<string, unknown>
    ): Promise<{ goalsAffected: number; contractsAffected: number }> {
      const client = new pg.Client({ connectionString: process.env['DATABASE_URL']! });
      await client.connect();
      try {
        await client.query('BEGIN');
        await client.query(
          `SELECT app.set_identity_context($1, 'FAMILY_MANAGEMENT')`,
          [fixture.manager.accountId]
        );
        await client.query(
          `SELECT app.set_family_context($1, $2, 'FAMILY_MANAGEMENT')`,
          [fixture.familyId, fixture.manager.personId]
        );
        const result = await client.query<{
          propagate_downstream_dependency_review: {
            goalsAffected: number;
            contractsAffected: number;
          };
        }>(
          `SELECT app.propagate_downstream_dependency_review($1,$2,$3::jsonb)`,
          [fixture.familyId, fixture.caseId, JSON.stringify(dependency)]
        );
        await client.query('COMMIT');
        return result.rows[0]!.propagate_downstream_dependency_review;
      } finally {
        await client.end();
      }
    }

    async function setFormulationDependency(
      fixture: Fixture,
      dependency: Record<string, unknown>
    ): Promise<string> {
      const row = await admin.query<{ id: string }>(
        `UPDATE problem_formulations SET dependency_refs=$2::jsonb
          WHERE case_id=$1 AND version=1 RETURNING id`,
        [fixture.caseId, JSON.stringify([dependency])]
      );
      expect(row.rowCount).toBe(1);
      return row.rows[0]!.id;
    }

    async function seedGrantedConsent(fixture: Fixture, child: LoginResult): Promise<string> {
      const noticeHash = getCurrentNoticeHash();
      const request = await admin.query<{ id: string }>(
        `INSERT INTO guardian_consent_requests
         (family_id,guardian_person_id,subject_person_id,declared_age_band,notice_version,notice_hash,status,expires_at,completed_at)
         VALUES ($1,$2,$3,'UNDER_14','v1',$4,'GRANTED',now()+interval '24 hours',now()) RETURNING id`,
        [fixture.familyId, fixture.manager.personId, child.personId, noticeHash]
      );
      const evidence = buildConsentEvidence({
        channel: runtimeConsentChannel(process.env),
        acceptedTextHash: getAcceptanceTextHash('v1')!,
        clientIp: null,
        userAgent: null,
        pepper: 'a3-real-revoke',
      });
      const consent = await admin.query<{ id: string }>(
        `INSERT INTO consent_records
         (family_id,guardian_person_id,guardian_account_id,purpose,decision,version,onboarding_request_id,bound_person_id,bound_at,notice_version,notice_hash,policy_version,evidence)
         VALUES ($1,$2,$3,'UNDER_14_GUARDIAN_CONSENT','GRANTED',1,$4,$5,now(),'v1',$6,'v1',$7::jsonb) RETURNING id`,
        [
          fixture.familyId, fixture.manager.personId, fixture.manager.accountId,
          request.rows[0]!.id, child.personId, noticeHash, JSON.stringify(evidence),
        ]
      );
      await admin.query(
        `UPDATE person_compliance_profiles SET age_band='UNDER_14',minor_mode=true,verified_source='GUARDIAN_RELAY',guardian_person_id=$2,guardian_consent_record_id=$3,guardian_consent_version=1 WHERE person_id=$1`,
        [child.personId, fixture.manager.personId, consent.rows[0]!.id]
      );
      return consent.rows[0]!.id;
    }

    async function reviewStates(ids: { formulation: string; goal: string; contract: string }) {
      const one = async (table: string, id: string) =>
        (await admin.query<{ review_state: string }>(
          `SELECT review_state FROM ${table} WHERE id=$1`, [id]
        )).rows[0]?.review_state;
      return {
        formulation: await one('problem_formulations', ids.formulation),
        goal: await one('goals', ids.goal),
        contract: await one('digital_use_contract_versions', ids.contract),
      };
    }
    const all = (state: string) => ({ formulation: state, goal: state, contract: state });

    // ── N-05: the REAL production path. Guardian revokes Consent version 1
    // over HTTP → revoke route → propagation seam → Problem Formulation, Goal
    // and DigitalUseContractVersion review state.
    const revokeScenarios: Array<{
      label: string;
      stored: (consentId: string) => Record<string, unknown>;
      affected: boolean;
    }> = [
      {
        label: 'unversioned-stored-exact-version-revoke',
        stored: (id) => ({ type: 'CONSENT', id }),
        affected: true,
      },
      {
        label: 'unversioned-uppercase-stored',
        stored: (id) => ({ type: 'CONSENT', id: id.toUpperCase() }),
        affected: true,
      },
      {
        label: 'pinned-revoked-version',
        stored: (id) => ({ type: 'CONSENT', id, version: 1 }),
        affected: true,
      },
      {
        label: 'pinned-revoked-version-uppercase',
        stored: (id) => ({ type: 'CONSENT', id: id.toUpperCase(), version: 1 }),
        affected: true,
      },
      {
        label: 'pinned-other-version',
        stored: (id) => ({ type: 'CONSENT', id, version: 2 }),
        affected: false,
      },
      {
        label: 'pinned-other-version-uppercase',
        stored: (id) => ({ type: 'CONSENT', id: id.toUpperCase(), version: 2 }),
        affected: false,
      },
      {
        label: 'other-consent-identity',
        stored: () => ({ type: 'CONSENT', id: crypto.randomUUID() }),
        affected: false,
      },
    ];
    for (const scenario of revokeScenarios) {
      const child = await loginWithLabel(app, `n05-child-${crypto.randomUUID()}`);
      const fixture = await createTestFixture(`n05-${crypto.randomUUID().slice(0, 8)}`, child);
      const consentId = await seedGrantedConsent(fixture, child);
      const stored = scenario.stored(consentId);
      const ids = {
        formulation: await setFormulationDependency(fixture, stored),
        goal: await seedGoal(fixture, stored, scenario.label),
        contract: await seedDraftContract(fixture, child, stored),
      };
      expect(await reviewStates(ids), scenario.label).toEqual(all('CURRENT'));

      const revoked = await revokeConsent(
        app, fixture.manager.token, `n05-${crypto.randomUUID()}`, consentId, { reason: 'N-05 regression' }
      );
      expect(revoked.statusCode, `${scenario.label}: ${revoked.body}`).toBe(200);
      expect(await reviewStates(ids), scenario.label).toEqual(
        all(scenario.affected ? 'NEEDS_REVIEW' : 'CURRENT')
      );

      if (scenario.affected) {
        // Both propagated shapes run; each dependent is audited exactly once.
        const audits = await admin.query<{ event_type: string; n: string }>(
          `SELECT event_type, count(*) AS n FROM business_audit_events
            WHERE family_id=$1 AND metadata->>'reason'='DEPENDENCY_INVALIDATED'
            GROUP BY event_type ORDER BY event_type`,
          [fixture.familyId]
        );
        expect(audits.rows, scenario.label).toEqual([
          { event_type: 'GOAL_REVIEW_STATE_CHANGED', n: '1' },
          { event_type: 'PHONE_USE_CONTRACT_REVIEW_STATE_CHANGED', n: '1' },
        ]);
      }
    }

    // ── N-05: the production seam invoked for version N+1 leaves a ref
    // pinned to version N untouched, and still reaches an unversioned ref.
    // An unversioned propagation ({id}) reaches unversioned refs and leaves
    // version-pinned refs untouched.
    const seamPool = new pg.Pool({ connectionString: process.env['DATABASE_URL']!, max: 1 });
    try {
      for (const scenario of [
        { label: 'seam-pinned-n-revoke-n-plus-1', propagatedVersion: 2 as number | undefined, version: 1 as number | undefined, upper: false, affected: false },
        { label: 'seam-pinned-n-plus-1-exact', propagatedVersion: 2 as number | undefined, version: 2 as number | undefined, upper: true, affected: true },
        { label: 'seam-unversioned-revoke-n-plus-1', propagatedVersion: 2 as number | undefined, version: undefined, upper: true, affected: true },
        { label: 'seam-unversioned-propagate-to-unversioned', propagatedVersion: undefined, version: undefined, upper: true, affected: true },
        { label: 'seam-unversioned-propagate-leaves-pinned-untouched', propagatedVersion: undefined, version: 1 as number | undefined, upper: false, affected: false },
      ]) {
        const child = await loginWithLabel(app, `n05-child-${crypto.randomUUID()}`);
        const fixture = await createTestFixture(`n05-${crypto.randomUUID().slice(0, 8)}`, child);
        const consentId = crypto.randomUUID();
        const stored: Record<string, unknown> = {
          type: 'CONSENT',
          id: scenario.upper ? consentId.toUpperCase() : consentId,
          ...(scenario.version === undefined ? {} : { version: scenario.version }),
        };
        const ids = {
          formulation: await setFormulationDependency(fixture, stored),
          goal: await seedGoal(fixture, stored, scenario.label),
          contract: await seedDraftContract(fixture, child, stored),
        };
        const marked = await withRlsTransaction(
          seamPool,
          {
            familyId: fixture.familyId,
            accountId: fixture.manager.accountId,
            personId: fixture.manager.personId,
            purpose: 'GUARDIAN_CONSENT',
          },
          (tx) => markProblemFormulationsForConsentReview(
            tx,
            scenario.propagatedVersion === undefined
              ? { familyId: fixture.familyId, consentId }
              : { familyId: fixture.familyId, consentId, version: scenario.propagatedVersion }
          )
        );
        expect(marked, scenario.label).toBe(scenario.affected ? 1 : 0);
        expect(await reviewStates(ids), scenario.label).toEqual(
          all(scenario.affected ? 'NEEDS_REVIEW' : 'CURRENT')
        );
      }
    } finally {
      await seamPool.end();
    }

    // ── Matcher primitive. app.propagate_downstream_dependency_review is
    // exact per PROPAGATED shape; that exactness is what lets the seam emit
    // {id, version} and {id} together without an unversioned propagation ever
    // reaching a ref pinned to another version.
    const targetConsentId = crypto.randomUUID();
    const otherConsentId = crypto.randomUUID();
    const scenarios: Array<{
      label: string;
      stored: Record<string, unknown>;
      invalidated: Record<string, unknown>;
      affected: boolean;
    }> = [
      {
        label: 'identity-to-identity',
        stored: { type: 'CONSENT', id: targetConsentId },
        invalidated: { type: 'CONSENT', id: targetConsentId },
        affected: true,
      },
      {
        label: 'identity-to-identity-mixed-case',
        stored: { type: 'CONSENT', id: targetConsentId.toUpperCase() },
        invalidated: { type: 'CONSENT', id: targetConsentId },
        affected: true,
      },
      {
        label: 'identity-shape-never-reaches-versioned-storage',
        stored: { type: 'CONSENT', id: targetConsentId, version: 3 },
        invalidated: { type: 'CONSENT', id: targetConsentId },
        affected: false,
      },
      {
        label: 'versioned-shape-exact-per-primitive',
        stored: { type: 'CONSENT', id: targetConsentId },
        invalidated: { type: 'CONSENT', id: targetConsentId, version: 2 },
        affected: false,
      },
      {
        label: 'mixed-case-exact-version',
        stored: { type: 'CONSENT', id: targetConsentId.toUpperCase(), version: 2 },
        invalidated: { type: 'CONSENT', id: targetConsentId, version: 2 },
        affected: true,
      },
      {
        label: 'different-version',
        stored: { type: 'CONSENT', id: targetConsentId, version: 1 },
        invalidated: { type: 'CONSENT', id: targetConsentId, version: 2 },
        affected: false,
      },
      {
        label: 'different-consent',
        stored: { type: 'CONSENT', id: otherConsentId },
        invalidated: { type: 'CONSENT', id: targetConsentId },
        affected: false,
      },
    ];

    for (const scenario of scenarios) {
      const child = await loginWithLabel(
        app,
        `a3-child-${scenario.label}-${crypto.randomUUID()}`
      );
      const fixture = await createTestFixture(`a3-${scenario.label}`, child);
      const goalId = await seedGoal(fixture, scenario.stored, scenario.label);
      const contractId = await seedDraftContract(fixture, child, scenario.stored);

      const result = await propagate(fixture, scenario.invalidated);
      expect(result, scenario.label).toEqual({
        goalsAffected: scenario.affected ? 1 : 0,
        contractsAffected: scenario.affected ? 1 : 0,
      });

      const goal = await admin.query<{ review_state: string }>(
        `SELECT review_state FROM goals WHERE id=$1`,
        [goalId]
      );
      const contract = await admin.query<{ review_state: string }>(
        `SELECT review_state FROM digital_use_contract_versions WHERE id=$1`,
        [contractId]
      );
      const expectedState = scenario.affected ? 'NEEDS_REVIEW' : 'CURRENT';
      expect(goal.rows[0]?.review_state, scenario.label).toBe(expectedState);
      expect(contract.rows[0]?.review_state, scenario.label).toBe(expectedState);
    }
  });

  it('Finding #24 / Blocker C-04: Controlled recovery of open Contract Draft from NEEDS_REVIEW back to CURRENT', async () => {
    // 1. Setup fixture and child
    const child = await loginWithLabel(app, `s14-f24-rec-child-${crypto.randomUUID()}`);
    const f = await createTestFixture('f24-recovery', child);

    const childPart = await admin.query<{ id: string }>(
      `INSERT INTO case_participants
         (family_id, case_id, person_id, state, invite_token_hash, invite_expires_at, created_by_person_id, accepted_at)
       VALUES ($1, $2, $3, 'ACTIVE', $4, now() + interval '1 day', $5, now())
       RETURNING id`,
      [f.familyId, f.caseId, child.personId, crypto.randomUUID().replaceAll('-', '').repeat(2), f.manager.personId]
    );

    // 2. Create upstream assertions 1 and 2
    const a1Res = await admin.query<{ id: string }>(
      `INSERT INTO assertions
         (family_id, case_id, subject_person_id, source_kind, source_person_id,
          occurred_time_state, confirmation_status, kind, content)
       VALUES ($1, $2, $4, 'SELF_STATEMENT', $3, 'UNKNOWN', 'UNCONFIRMED', 'STATEMENT', 'Needs better study routine')
       RETURNING id`,
      [f.familyId, f.caseId, f.manager.personId, child.personId]
    );
    const a1Id = a1Res.rows[0]!.id;

    const a2Res = await admin.query<{ id: string }>(
      `INSERT INTO assertions
         (family_id, case_id, subject_person_id, source_kind, source_person_id,
          occurred_time_state, confirmation_status, kind, content)
       VALUES ($1, $2, $4, 'SELF_STATEMENT', $3, 'UNKNOWN', 'UNCONFIRMED', 'STATEMENT', 'Wants to reduce screen time')
       RETURNING id`,
      [f.familyId, f.caseId, f.manager.personId, child.personId]
    );
    const a2Id = a2Res.rows[0]!.id;

    const a1Dep = {
      type: 'ASSERTION' as const,
      id: a1Id,
    };
    const a2Dep = {
      type: 'ASSERTION' as const,
      id: a2Id,
    };

    // Complete A4004
    await admin.query(
      `INSERT INTO scene_node_states
         (family_id, case_id, scene_package_version, node_code, source_node_code,
          status, revision, branch_reason_codes, input_refs, output_refs, completed_at)
       VALUES ($1, $2, $3, 'A4004', 'A4001', 'COMPLETED', 1, ARRAY[]::text[], '[]'::jsonb, '[]'::jsonb, now())`,
      [f.familyId, f.caseId, DIGITAL_USE_PACKAGE_VERSION]
    );

    // Link upstream dependencies into problem_formulations
    await admin.query(
      `UPDATE problem_formulations
          SET dependency_refs = $1::jsonb
        WHERE case_id = $2 AND version = 1`,
      [JSON.stringify([a1Dep, a2Dep]), f.caseId]
    );

    // 3. Create open Contract Draft version 1 dependent on a1
    const createRes = await app.inject({
      method: 'POST',
      url: `/api/v1/cases/${f.caseId}/digital-use/contract/drafts`,
      headers: { ...auth(f.manager.token), 'idempotency-key': `rec-init-${crypto.randomUUID()}` },
      payload: {
        expectedCaseVersion: f.caseVersion,
        adultPartyPersonId: f.manager.personId,
        childPartyPersonId: child.personId,
        childParticipationId: childPart.rows[0]!.id,
        sourceTemplateVersion: PHONE_USE_CONTRACT_CONTENT_VERSION,
        dependencyRefs: [a1Dep],
        terms: defaultTerms,
      },
    });
    expect(createRes.statusCode, createRes.body).toBe(201);
    const draftV1 = createRes.json();
    expect(draftV1.draftRevision).toBe(1);
    const draftV1Db = await admin.query<{ review_state: string }>(
      `SELECT review_state FROM digital_use_contract_versions WHERE case_id = $1 AND version = 1`,
      [f.caseId]
    );
    expect(draftV1Db.rows[0]!.review_state).toBe('CURRENT');

    // 4. Invalidate a1 via propagation primitive
    const propClient = await admin.connect();
    try {
      await propClient.query('BEGIN');
      await propClient.query(
        `SELECT set_config('app.family_id', $1, true),
                set_config('app.account_id', $2, true),
                set_config('app.person_id', $3, true),
                set_config('app.purpose', 'FAMILY_MANAGEMENT', true)`,
        [f.familyId, f.manager.accountId, f.manager.personId]
      );
      const propResult = await propClient.query<{ propagate_downstream_dependency_review: { contractsAffected: number } }>(
        `SELECT app.propagate_downstream_dependency_review($1, $2, $3::jsonb)`,
        [f.familyId, f.caseId, JSON.stringify(a1Dep)]
      );
      await propClient.query('COMMIT');
      expect(propResult.rows[0]!.propagate_downstream_dependency_review.contractsAffected).toBe(1);
    } finally {
      propClient.release();
    }

    // 5. Verify Draft is now in NEEDS_REVIEW
    const draftAfterProp = await admin.query<{ review_state: string; status: string; draft_revision: number }>(
      `SELECT review_state, status, draft_revision FROM digital_use_contract_versions WHERE case_id = $1 AND version = 1`,
      [f.caseId]
    );
    expect(draftAfterProp.rows[0]!.review_state).toBe('NEEDS_REVIEW');
    expect(draftAfterProp.rows[0]!.status).toBe('DRAFT');

    // 6. Confirm MUST be blocked while in NEEDS_REVIEW
    const confirmBlocked = await app.inject({
      method: 'POST',
      url: `/api/v1/cases/${f.caseId}/digital-use/contract/1/confirm`,
      headers: { ...auth(f.manager.token), 'idempotency-key': `rec-conf-blocked-${crypto.randomUUID()}` },
      payload: {
        expectedCaseVersion: f.caseVersion,
        expectedDraftRevision: 1,
      },
    });
    expect(confirmBlocked.statusCode).toBe(409);
    expect(confirmBlocked.json().code).toBe('PHONE_USE_CONTRACT_STALE_REVISION');
    expect(confirmBlocked.json().message).toContain('Contract requires review');

    // 7. Attempting to recover with invalidated dependency (a1 valid_until expired) fails dependency revalidation
    await admin.query(`UPDATE assertions SET valid_until = now() - interval '1 second' WHERE id = $1`, [a1Id]);
    const updateWithInvalidDep = await app.inject({
      method: 'PATCH',
      url: `/api/v1/cases/${f.caseId}/digital-use/contract/drafts/1`,
      headers: { ...auth(f.manager.token), 'idempotency-key': `rec-fail-${crypto.randomUUID()}` },
      payload: {
        expectedCaseVersion: f.caseVersion,
        expectedDraftRevision: 1,
        dependencyRefs: [a1Dep],
        terms: defaultTerms,
      },
    });
    expect(updateWithInvalidDep.statusCode).toBe(422);
    expect(updateWithInvalidDep.json().code).toBe('PHONE_USE_CONTRACT_INVALID_PAYLOAD');
    expect(updateWithInvalidDep.json().message).toContain('Evidence dependency is no longer current-valid');

    // 8. Controlled recovery: update draft with valid corrected dependency (a2Dep)
    const updateRecovery = await app.inject({
      method: 'PATCH',
      url: `/api/v1/cases/${f.caseId}/digital-use/contract/drafts/1`,
      headers: { ...auth(f.manager.token), 'idempotency-key': `rec-success-${crypto.randomUUID()}` },
      payload: {
        expectedCaseVersion: f.caseVersion,
        expectedDraftRevision: 1,
        dependencyRefs: [a2Dep],
        terms: defaultTerms,
      },
    });
    expect(updateRecovery.statusCode, updateRecovery.body).toBe(200);
    const recoveredDraft = updateRecovery.json();
    expect(recoveredDraft.draftRevision).toBe(2);
    const recoveredDraftDb = await admin.query<{ review_state: string }>(
      `SELECT review_state FROM digital_use_contract_versions WHERE case_id = $1 AND version = 1`,
      [f.caseId]
    );
    expect(recoveredDraftDb.rows[0]!.review_state).toBe('CURRENT');

    // 9. Verify database audit log for review state recovery
    const recoveryAudit = await admin.query<{ event_type: string; metadata: any }>(
      `SELECT event_type, metadata FROM business_audit_events
        WHERE family_id = $1 AND event_type = 'PHONE_USE_CONTRACT_REVIEW_STATE_CHANGED'
        ORDER BY occurred_at DESC LIMIT 1`,
      [f.familyId]
    );
    expect(recoveryAudit.rows.length).toBe(1);
    expect(recoveryAudit.rows[0]!.metadata.fromReviewState).toBe('NEEDS_REVIEW');
    expect(recoveryAudit.rows[0]!.metadata.toReviewState).toBe('CURRENT');
    expect(recoveryAudit.rows[0]!.metadata.reason).toBe('DRAFT_CORRECTED_DEPENDENCIES_REVALIDATED');

    // 10. Confirm is now unblocked and succeeds with recovered draft revision 2
    const confirmAdult = await app.inject({
      method: 'POST',
      url: `/api/v1/cases/${f.caseId}/digital-use/contract/1/confirm`,
      headers: { ...auth(f.manager.token), 'idempotency-key': `rec-conf-adult-${crypto.randomUUID()}` },
      payload: {
        expectedCaseVersion: f.caseVersion,
        expectedDraftRevision: 2,
      },
    });
    expect(confirmAdult.statusCode, confirmAdult.body).toBe(200);
    expect(confirmAdult.json().status).toBe('PENDING_CONFIRMATION');

    const confirmChild = await app.inject({
      method: 'POST',
      url: `/api/v1/cases/${f.caseId}/digital-use/contract/1/confirm`,
      headers: { ...auth(child.token), 'idempotency-key': `rec-conf-child-${crypto.randomUUID()}` },
      payload: {
        expectedCaseVersion: f.caseVersion,
        expectedDraftRevision: 2,
      },
    });
    expect(confirmChild.statusCode, confirmChild.body).toBe(200);
    expect(confirmChild.json().status).toBe('ACTIVE');

    const finalContractDb = await admin.query<{ review_state: string; status: string }>(
      `SELECT review_state, status FROM digital_use_contract_versions WHERE case_id = $1 AND version = 1`,
      [f.caseId]
    );
    expect(finalContractDb.rows[0]!.status).toBe('ACTIVE');
    expect(finalContractDb.rows[0]!.review_state).toBe('CURRENT');
  });

  it('C-A2-02: exact nested RECORD_MARKER evidence invalidates once through runtime-role RLS', async () => {
    const appPool = new pg.Pool({ connectionString: process.env['DATABASE_URL']! });
    try {
      for (const variant of ['ASSERTION', 'OBSERVATION', 'DIALOGUE_MESSAGE', 'unrelated', 'wrong-marker', 'empty', 'malformed'] as const) {
        const child = await loginWithLabel(app, `f24-nested-${variant}`);
        const f = await createTestFixture(`f24-nested-${variant}`, child);
        const part = await admin.query<{ id: string }>(
          `INSERT INTO case_participants
             (family_id,case_id,person_id,state,invite_token_hash,invite_expires_at,created_by_person_id,accepted_at)
           VALUES ($1,$2,$3,'ACTIVE',$4,now()+interval '1 day',$5,now()) RETURNING id`,
          [f.familyId,f.caseId,child.personId,crypto.randomUUID().replaceAll('-','').repeat(2),f.manager.personId]
        );
        // Stored reference fixtures exercise the actual propagation matcher,
        // including malformed legacy JSON that public commands must reject.
        const positive = variant === 'ASSERTION' || variant === 'OBSERVATION' || variant === 'DIALOGUE_MESSAGE';
        const type = positive ? variant : 'ASSERTION';
        // The invalidated reference is a real carrier in this Case.
        const evidence = type === 'DIALOGUE_MESSAGE'
          ? await admin.query<{id:string}>(
              "INSERT INTO dialogue_messages (family_id,case_id,actor_account_id,source_person_id,content) VALUES ($1,$2,$3,$4,'nested evidence') RETURNING id",
              [f.familyId,f.caseId,f.manager.accountId,f.manager.personId])
          : type === 'OBSERVATION'
          ? await admin.query<{id:string}>(
              `INSERT INTO observations (family_id,case_id,subject_person_id,source_kind,source_person_id,occurred_time_state,confirmation_status,observation_code,value_state,value_type,value_text)
               VALUES ($1,$2,$3,'SELF_STATEMENT',$4,'UNKNOWN','UNCONFIRMED','test.nested','KNOWN','TEXT','nested evidence') RETURNING id`,
              [f.familyId,f.caseId,child.personId,f.manager.personId])
          : await admin.query<{id:string}>(
              `INSERT INTO assertions (family_id,case_id,subject_person_id,source_kind,source_person_id,occurred_time_state,confirmation_status,kind,content)
               VALUES ($1,$2,$3,'SELF_STATEMENT',$4,'UNKNOWN','UNCONFIRMED','STATEMENT','nested evidence') RETURNING id`,
              [f.familyId,f.caseId,child.personId,f.manager.personId]);
        const id = evidence.rows[0]!.id;
        const reference = { type, id };
        const nested = variant === 'unrelated' ? { type, id: crypto.randomUUID() } : reference;
        const marker = {
          type: 'RECORD_MARKER',
          markerCode: variant === 'wrong-marker' ? 'A200499' : 'A200401',
          evidenceRefs: variant === 'empty' ? [] : variant === 'malformed' ? [nested, {}] : [nested],
        };
        const c = await admin.query<{ id: string }>(
          `INSERT INTO digital_use_contract_versions
             (family_id,case_id,version,draft_revision,status,review_state,
              adult_party_person_id,child_party_person_id,child_participation_id,
              contract_purpose,phone_use_rules,execution_period,parent_support_measures,
              supervision_measures,incentives,breach_responsibilities,source_template_version,
              dependency_refs,created_by_person_id)
           VALUES ($1,$2,1,1,'DRAFT','CURRENT',$3,$4,$5,
              $6::jsonb,$6::jsonb,$6::jsonb,$6::jsonb,$6::jsonb,$6::jsonb,$6::jsonb,$7,$8::jsonb,$3)
           RETURNING id`,
          [f.familyId,f.caseId,f.manager.personId,child.personId,part.rows[0]!.id,
           JSON.stringify(v('rule')),PHONE_USE_CONTRACT_CONTENT_VERSION,JSON.stringify([marker])]
        );
        const ctx = { familyId:f.familyId, accountId:f.manager.accountId, personId:f.manager.personId, purpose:'FAMILY_MANAGEMENT' };
        const propagate = (familyId:string,caseId:string,dependency:unknown) => withRlsTransaction(appPool,ctx,async tx=>{
          const role = await tx.query("SELECT current_user AS role, rolbypassrls, rolsuper FROM pg_roles WHERE rolname=current_user");
          expect(role.rows[0]).toMatchObject({role:'xiaoshuyin_app',rolbypassrls:false,rolsuper:false});
          return (await tx.query(
            'SELECT app.propagate_downstream_dependency_review($1,$2,$3::jsonb) AS result',
            [familyId,caseId,JSON.stringify(dependency)]
          )).rows[0].result;
        });
        await expect(propagate(crypto.randomUUID(),f.caseId,reference)).rejects.toMatchObject({code:'42501'});
        await expect(propagate(f.familyId,crypto.randomUUID(),reference)).rejects.toMatchObject({code:'42501'});
        // Exercise both direct and typed EVIDENCE input forms.
        const dep = variant === 'OBSERVATION' ? {type:'EVIDENCE',evidence:reference} : reference;
        expect(await propagate(f.familyId,f.caseId,dep)).toEqual({goalsAffected:0,contractsAffected:positive?1:0});
        expect(await propagate(f.familyId,f.caseId,dep)).toEqual({goalsAffected:0,contractsAffected:0});
        const row = await admin.query('SELECT review_state,status,draft_revision,dependency_refs FROM digital_use_contract_versions WHERE id=$1',[c.rows[0]!.id]);
        expect(row.rows[0]).toMatchObject({review_state:positive?'NEEDS_REVIEW':'CURRENT',status:'DRAFT',draft_revision:1,dependency_refs:[marker]});
        const audit = await admin.query(
          "SELECT count(*)::int AS n FROM business_audit_events WHERE resource_id=$1 AND event_type='PHONE_USE_CONTRACT_REVIEW_STATE_CHANGED'",
          [c.rows[0]!.id]
        );
        expect(audit.rows[0].n).toBe(positive?1:0);
      }
    } finally {
      await appPool.end();
    }
  }, 30000);

});
