import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import pg from 'pg';
import crypto from 'node:crypto';
import { buildApp } from '../../apps/server/api/src/app.js';
import { createAdminPool } from '../setup/db.js';
import {
  auth,
  commandHeaders,
  createFamily,
  createMember,
  loginWithLabel,
  type LoginResult,
} from '../setup/api.js';
import { createCase } from '../setup/participation.js';
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

describe('Workline C Targeted Remediation (#8, #9, #10, #12, #24)', () => {
  let app: FastifyInstance;
  let admin: pg.Pool;
  let migrator: pg.Client;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
    admin = createAdminPool();
    migrator = new pg.Client({ connectionString: process.env['MIGRATION_DATABASE_URL'] });
    await migrator.connect();

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
         'NOT_APPLICABLE','MINORS_BLOCKED','BASELINE','BASELINE','BASELINE',
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

  it('Finding #10: Roleplay select idempotency exact replay succeeds after completion', async () => {
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
      const f = await createTestFixture('finding10');

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

      // 2. Retry exact same select
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
        JSON.stringify([a1Dependency]),
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
        JSON.stringify([a2Dependency]),
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

    // 6. Trigger dependency invalidation by calling the dedicated propagation primitive
    const propResult = await admin.query<{ propagate_downstream_dependency_review: { goalsAffected: number; contractsAffected: number } }>(
      `SELECT app.propagate_downstream_dependency_review($1, $2, $3::jsonb)`,
      [f.familyId, f.caseId, JSON.stringify(a1Dependency)]
    );
    expect(propResult.rows[0]!.propagate_downstream_dependency_review.goalsAffected).toBe(1);
    expect(propResult.rows[0]!.propagate_downstream_dependency_review.contractsAffected).toBe(1);

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

    // 9. Verify Execution Gate:
    // Future execution (e.g. revise contract c1) MUST be blocked because review_state is NEEDS_REVIEW
    const reviseBlocked = await app.inject({
      method: 'POST',
      url: `/api/v1/cases/${f.caseId}/digital-use/contract/1/revise`,
      headers: { ...auth(f.manager.token), 'idempotency-key': `f24-blocked-${crypto.randomUUID()}` },
      payload: {
        expectedCaseVersion: f.caseVersion,
        expectedActiveDraftRevision: 1,
        updateTrigger: 'PERIOD_COMPLETE',
        updateReason: 'Attempting revision with invalid dependency',
      },
    });
    expect(reviseBlocked.statusCode).toBe(409);
    expect(reviseBlocked.json().code).toBe('PHONE_USE_CONTRACT_STALE_REVISION');
    expect(reviseBlocked.json().message).toContain('Contract requires review');

    // 10. Verify idempotency of propagation:
    // Repeating propagation when already in NEEDS_REVIEW affects 0 rows and does not fail
    const repeatResult = await admin.query<{ propagate_downstream_dependency_review: { goalsAffected: number; contractsAffected: number } }>(
      `SELECT app.propagate_downstream_dependency_review($1, $2, $3::jsonb)`,
      [f.familyId, f.caseId, JSON.stringify(a1Dependency)]
    );
    expect(repeatResult.rows[0]!.propagate_downstream_dependency_review.goalsAffected).toBe(0);
    expect(repeatResult.rows[0]!.propagate_downstream_dependency_review.contractsAffected).toBe(0);
  });
});
