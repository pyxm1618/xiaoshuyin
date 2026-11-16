import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import crypto from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import pg from 'pg';
import { buildApp } from '../../apps/server/api/src/app.js';
import { retireInterventionDefinition } from '../../apps/server/api/src/services/intervention-definitions.js';
import {
  evaluateCurrentInterventionEligibility,
  type InterventionEligibilityOwnerAdapters,
} from '../../apps/server/api/src/services/intervention-eligibility.js';
import { prepareInterventionDefinition } from '../../packages/domain/src/index.js';
import type { DigitalUseInterventionInclusionProvider } from '../../packages/scenes/digital-use/index.js';
import { createAdminPool } from '../setup/db.js';
import {
  commandHeaders,
  createFamily,
  loginWithLabel,
  type LoginResult,
} from '../setup/api.js';
import { createCase } from '../setup/participation.js';
import {
  TEST_ONLY_QUALIFICATION_PROVIDER,
  interventionSemantic,
  professionalProof,
  professionalProvider,
} from '../support/intervention.js';

interface Fixture {
  manager: LoginResult;
  familyId: string;
  caseId: string;
  definitionId: string;
  version: number;
  contentHash: string;
}

describe('Slice 16 current eligibility snapshot / audit integration', () => {
  let app: FastifyInstance;
  let admin: pg.Pool;
  let appDb: pg.Pool;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
    admin = createAdminPool();
    appDb = new pg.Pool({ connectionString: process.env['DATABASE_URL']!, max: 5 });
  });

  afterAll(async () => {
    await appDb.end().catch(() => undefined);
    await admin.end().catch(() => undefined);
    await app.close().catch(() => undefined);
  });

  async function fixture(label: string): Promise<Fixture> {
    const manager = await loginWithLabel(app, 's16-snapshot-' + label);
    const family = await createFamily(app, manager.token, 's16-snapshot-' + label);
    expect(family.statusCode, family.body).toBe(201);
    const familyId = family.json().id as string;

    const kase = await createCase(app, manager.token, 's16-snapshot-' + label);
    expect(kase.statusCode, kase.body).toBe(201);
    const caseId = kase.json().id as string;

    const message = await app.inject({
      method: 'POST',
      url: '/api/v1/cases/' + caseId + '/messages',
      headers: commandHeaders(manager.token, 's16-snapshot-message-' + crypto.randomUUID()),
      payload: { content: 'Slice 16 snapshot fixture.' },
    });
    expect(message.statusCode, message.body).toBe(201);
    const messageId = message.json().id as string;

    await admin.query('BEGIN');
    try {
      await admin.query("UPDATE cases SET phase='GOALS' WHERE id=$1", [caseId]);
      await admin.query(
        "INSERT INTO problem_formulations " +
          "(family_id,case_id,version,status,primary_problem,key_factors,evidence_refs," +
          "unknowns,conflicts,scene_fit,alternative_explanations,reassessment_conditions," +
          "exit_conditions,user_response,confirmed_by_person_id,confirmed_at,dependency_refs," +
          "supersedes_version) VALUES " +
          "($1,$2,1,'CONFIRMED',$3::jsonb,'[]'::jsonb,$4::jsonb,'[]'::jsonb," +
          "'[]'::jsonb,'DIGITAL_USE','[]'::jsonb,'[]'::jsonb,'[]'::jsonb,$5::jsonb," +
          "$6,now(),'[]'::jsonb,NULL)",
        [
          familyId,
          caseId,
          JSON.stringify({ text: 'Current Slice 16 formulation.' }),
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
        "INSERT INTO scene_node_states " +
          "(family_id,case_id,scene_package_version,node_code,source_node_code,status," +
          "branch_reason_codes,input_refs,output_refs,revision) VALUES " +
          "($1,$2,'v1','A1001','A1001','AVAILABLE',ARRAY[]::text[]," +
          "'[]'::jsonb,'[]'::jsonb,1)",
        [familyId, caseId]
      );
      await admin.query('COMMIT');
    } catch (error) {
      await admin.query('ROLLBACK');
      throw error;
    }

    const semantic = interventionSemantic({
      formulation_dependencies: [],
      supporting_evidence_requirements: [],
      applicable_conditions: [],
      exclusion_or_contraindication_conditions: [],
      age_and_development_scope: {
        min_age_years: null,
        max_age_years: null,
        development_stages: [],
      },
      participation_and_consent_requirements: {
        required_participation_refs: [],
        required_consent_purposes: [],
      },
    });
    const prepared = prepareInterventionDefinition({
      sceneId: 'DIGITAL_USE',
      interventionCode:
        'TEST_SNAPSHOT_' + crypto.randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase(),
      version: 1,
      semantic,
    });
    const inserted = await admin.query<{ id: string }>(
      "INSERT INTO intervention_definitions " +
        "(scene_id,intervention_code,version,content_hash,definition_state," +
        "target_problem_or_mechanism,formulation_dependencies,supporting_evidence_requirements," +
        "applicable_conditions,exclusion_or_contraindication_conditions,age_and_development_scope," +
        "rationale,intervention_steps,participation_and_consent_requirements,baseline_and_observation," +
        "expected_observable_change,burden_and_barriers,adverse_or_worsening_signals," +
        "review_window_and_criteria,stop_reassess_safety_referral_conditions,allowed_combinations," +
        "conflicting_interventions,professional_source_refs,created_by_person_id) VALUES " +
        "($1,$2,$3,$4,'CANDIDATE',$5,$6::jsonb,$7::jsonb,$8::jsonb,$9::jsonb,$10::jsonb," +
        "$11,$12::jsonb,$13::jsonb,$14::jsonb,$15::jsonb,$16::jsonb,$17::jsonb,$18::jsonb," +
        "$19::jsonb,$20::jsonb,$21::jsonb,$22::jsonb,$23) RETURNING id",
      [
        prepared.sceneId, prepared.interventionCode, prepared.version, prepared.contentHash,
        semantic.target_problem_or_mechanism,
        JSON.stringify(semantic.formulation_dependencies),
        JSON.stringify(semantic.supporting_evidence_requirements),
        JSON.stringify(semantic.applicable_conditions),
        JSON.stringify(semantic.exclusion_or_contraindication_conditions),
        JSON.stringify(semantic.age_and_development_scope),
        semantic.rationale,
        JSON.stringify(semantic.intervention_steps),
        JSON.stringify(semantic.participation_and_consent_requirements),
        JSON.stringify(semantic.baseline_and_observation),
        JSON.stringify(semantic.expected_observable_change),
        JSON.stringify(semantic.burden_and_barriers),
        JSON.stringify(semantic.adverse_or_worsening_signals),
        JSON.stringify(semantic.review_window_and_criteria),
        JSON.stringify(semantic.stop_reassess_safety_referral_conditions),
        JSON.stringify(semantic.allowed_combinations),
        JSON.stringify(semantic.conflicting_interventions),
        JSON.stringify(semantic.professional_source_refs),
        manager.personId,
      ]
    );

    return {
      manager,
      familyId,
      caseId,
      definitionId: inserted.rows[0]!.id,
      version: prepared.version,
      contentHash: prepared.contentHash,
    };
  }

  const passAdapters: InterventionEligibilityOwnerAdapters = {
    async resolveAgeDevelopment() { return { ageYears: null, developmentStages: [] }; },
    async resolveFacts() { return {}; },
    async resolveParticipation() { return {}; },
    async resolveConsent() { return {}; },
    async evaluateCompliance() { return 'PASS'; },
  };

  it('reads one current snapshot and audits exact provenance without writing Case phase', async () => {
    const f = await fixture('exact-' + crypto.randomUUID());
    const provider = professionalProvider(
      professionalProof({
        definitionId: f.definitionId,
        definitionVersion: f.version,
        contentHash: f.contentHash,
      })
    );
    const before = await admin.query<{ phase: string; version: number }>(
      'SELECT phase,version FROM cases WHERE id=$1',
      [f.caseId]
    );

    const result = await evaluateCurrentInterventionEligibility(
      appDb,
      {
        actor: { accountId: f.manager.accountId, personId: f.manager.personId },
        familyId: f.familyId,
        caseId: f.caseId,
        definition: { id: f.definitionId, version: f.version, contentHash: f.contentHash },
        consideredDefinitions: [],
      },
      passAdapters,
      provider
    );

    expect(result.allowed).toBe(false);
    expect(result.reasonCodes).toContain('PACKAGE_NOT_INCLUDED');
    expect(result.scenePackageVersion).toBe('v1');
    expect(result.caseRevision).toBe(before.rows[0]!.version);
    expect(result.formulationVersion).toBe(1);
    expect(result.definitionId).toBe(f.definitionId);
    expect(result.definitionVersion).toBe(f.version);
    expect(result.definitionContentHash).toBe(f.contentHash);
    expect(result.approvalProofRef).toBe('TEST_APPROVAL:1');
    expect(result.dependencyRevisionRefs).toContain('PACKAGE:v1');

    const after = await admin.query<{ phase: string; version: number }>(
      'SELECT phase,version FROM cases WHERE id=$1',
      [f.caseId]
    );
    expect(after.rows[0]).toEqual(before.rows[0]);

    const audit = await admin.query<{
      family_id: string;
      event_type: string;
      resource_id: string;
      metadata: Record<string, unknown>;
    }>(
      "SELECT family_id,event_type,resource_id,metadata FROM business_audit_events " +
        "WHERE family_id=$1 AND resource_type='INTERVENTION_DEFINITION' " +
        "AND resource_id=$2 ORDER BY created_at DESC,id DESC LIMIT 1",
      [f.familyId, f.definitionId]
    );
    expect(audit.rows[0]).toMatchObject({
      family_id: f.familyId,
      event_type: 'INTERVENTION_ELIGIBILITY_BLOCKED',
      resource_id: f.definitionId,
    });
    expect(audit.rows[0]!.metadata).toMatchObject({
      definitionVersion: f.version,
      contentHash: f.contentHash,
      sceneId: 'DIGITAL_USE',
      scenePackageVersion: 'v1',
      approvalProofRef: 'TEST_APPROVAL:1',
      approvalStatus: 'VALID',
      allowed: false,
      caseRevision: before.rows[0]!.version,
      formulationVersion: 1,
    });
  });

  it('authorizes before protected reads and wrong-family context creates no eligibility audit', async () => {
    const f = await fixture('auth-' + crypto.randomUUID());
    const wrongFamily = crypto.randomUUID();
    const before = await admin.query<{ count: string }>(
      "SELECT count(*)::text AS count FROM business_audit_events " +
        "WHERE resource_type='INTERVENTION_DEFINITION' AND resource_id=$1",
      [f.definitionId]
    );
    await expect(
      evaluateCurrentInterventionEligibility(
        appDb,
        {
          actor: { accountId: f.manager.accountId, personId: f.manager.personId },
          familyId: wrongFamily,
          caseId: f.caseId,
          definition: { id: f.definitionId, version: f.version, contentHash: f.contentHash },
          consideredDefinitions: [],
        },
        passAdapters,
        professionalProvider()
      )
    ).rejects.toBeTruthy();
    const after = await admin.query<{ count: string }>(
      "SELECT count(*)::text AS count FROM business_audit_events " +
        "WHERE resource_type='INTERVENTION_DEFINITION' AND resource_id=$1",
      [f.definitionId]
    );
    expect(after.rows[0]!.count).toBe(before.rows[0]!.count);
  });

  it('blocks when reviewer authority proof changes between resolve and final revalidation', async () => {
    const f = await fixture('proof-drift-' + crypto.randomUUID());
    const exactPackage: DigitalUseInterventionInclusionProvider = {
      async resolve(input) {
        return { status: 'INCLUDED', inclusion: input };
      },
    };
    const valid = professionalProof({
      definitionId: f.definitionId,
      definitionVersion: f.version,
      contentHash: f.contentHash,
    });
    const revoked = professionalProof({
      definitionId: f.definitionId,
      definitionVersion: f.version,
      contentHash: f.contentHash,
      staffAuthority: {
        assignmentRef: 'TEST_STAFF_ASSIGNMENT:1',
        capability: 'PROFESSIONAL_REVIEW',
        scopeRef: 'GLOBAL',
        status: 'REVOKED',
      },
    });

    const result = await evaluateCurrentInterventionEligibility(
      appDb,
      {
        actor: { accountId: f.manager.accountId, personId: f.manager.personId },
        familyId: f.familyId,
        caseId: f.caseId,
        definition: {
          id: f.definitionId,
          version: f.version,
          contentHash: f.contentHash,
        },
        consideredDefinitions: [],
      },
      passAdapters,
      professionalProvider(valid, revoked),
      exactPackage
    );

    expect(result.allowed).toBe(false);
    expect(result.approvalStatus).toBe('INVALID');
    expect(result.professionalAuthorityBlockers).toContain(
      'APPROVAL_PROOF_CHANGED'
    );
  });

  it('serializes exact package inclusion consumption before concurrent retirement and blocks every later use', async () => {
    const f = await fixture('package-retire-' + crypto.randomUUID());
    await admin.query(
      "INSERT INTO staff_assignments " +
        "(account_id,person_id,capability,scope_type,granted_by_account_id) " +
        "VALUES ($1,$2,'PROFESSIONAL_REVIEW','GLOBAL',$1)",
      [f.manager.accountId, f.manager.personId]
    );

    let enteredResolve!: () => void;
    let releaseResolve!: () => void;
    const entered = new Promise<void>((resolve) => { enteredResolve = resolve; });
    const release = new Promise<void>((resolve) => { releaseResolve = resolve; });
    const blockingPackage: DigitalUseInterventionInclusionProvider = {
      async resolve(input) {
        enteredResolve();
        await release;
        return { status: 'INCLUDED', inclusion: input };
      },
    };
    const exactPackage: DigitalUseInterventionInclusionProvider = {
      async resolve(input) {
        return { status: 'INCLUDED', inclusion: input };
      },
    };
    const authority = professionalProvider(
      professionalProof({
        definitionId: f.definitionId,
        definitionVersion: f.version,
        contentHash: f.contentHash,
      })
    );

    const eligibilityPromise = evaluateCurrentInterventionEligibility(
      appDb,
      {
        actor: { accountId: f.manager.accountId, personId: f.manager.personId },
        familyId: f.familyId,
        caseId: f.caseId,
        definition: {
          id: f.definitionId,
          version: f.version,
          contentHash: f.contentHash,
        },
        consideredDefinitions: [],
      },
      passAdapters,
      authority,
      blockingPackage
    );

    await entered;

    let retirementSettled = false;
    const retirementPromise = retireInterventionDefinition(
      appDb,
      {
        actor: { accountId: f.manager.accountId, personId: f.manager.personId },
        definition: {
          id: f.definitionId,
          version: f.version,
          contentHash: f.contentHash,
          expectedRevision: 1,
        },
        approvalScope: 'DIGITAL_USE',
        idempotencyKey: 's16-package-retire-' + crypto.randomUUID(),
      },
      TEST_ONLY_QUALIFICATION_PROVIDER
    ).finally(() => {
      retirementSettled = true;
    });

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(retirementSettled).toBe(false);

    releaseResolve();
    const [beforeRetire, retired] = await Promise.all([
      eligibilityPromise,
      retirementPromise,
    ]);
    expect(beforeRetire.allowed).toBe(true);
    expect(retired.state).toBe('RETIRED');

    const afterRetire = await evaluateCurrentInterventionEligibility(
      appDb,
      {
        actor: { accountId: f.manager.accountId, personId: f.manager.personId },
        familyId: f.familyId,
        caseId: f.caseId,
        definition: {
          id: f.definitionId,
          version: f.version,
          contentHash: f.contentHash,
        },
        consideredDefinitions: [],
      },
      passAdapters,
      authority,
      exactPackage
    );
    expect(afterRetire.allowed).toBe(false);
    expect(afterRetire.reasonCodes).toContain('DEFINITION_RETIRED');
  });

});
