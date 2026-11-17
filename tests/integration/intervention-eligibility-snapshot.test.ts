import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import crypto from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import pg from 'pg';
import { buildApp } from '../../apps/server/api/src/app.js';
import { withIdentityTransaction } from '../../apps/server/api/src/db/tx.js';
import {
  createInterventionDefinitionCandidate,
  retireInterventionDefinition,
  supersedeInterventionDefinition,
} from '../../apps/server/api/src/services/intervention-definitions.js';
import {
  evaluateCurrentInterventionEligibility,
  productionInterventionOwnerAdapters,
  type InterventionEligibilityOwnerAdapters,
} from '../../apps/server/api/src/services/intervention-eligibility.js';
import type { DigitalUseInterventionInclusionProvider } from '../../packages/scenes/digital-use/index.js';
import {
  casRecordSceneNodeProgress,
  withdrawParticipation as withdrawParticipationOwner,
} from '../../packages/domain/src/index.js';
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
  evidenceAssertionId: string | null;
  participationId: string | null;
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

  async function fixture(
    label: string,
    options: {
      requiredAssertion?: boolean;
      nonStaffFamilyActor?: boolean;
      requiredParticipation?: boolean;
    } = {}
  ): Promise<Fixture> {
    const manager = await loginWithLabel(app, 's16-snapshot-' + label);
    const family = await createFamily(app, manager.token, 's16-' + label.slice(0, 20));
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
    let evidenceAssertionId: string | null = null;
    const participationId =
      options.requiredParticipation === true ? crypto.randomUUID() : null;

    await admin.query('BEGIN');
    try {
      if (options.requiredAssertion === true) {
        const assertion = await admin.query<{ id: string }>(
          "INSERT INTO assertions " +
            "(family_id,case_id,subject_person_id,source_kind,source_person_id," +
            "source_message_id,occurred_time_state,confirmation_status,kind,content) " +
            "VALUES ($1,$2,$3,'SELF_STATEMENT',$3,$4,'UNKNOWN','UNCONFIRMED'," +
            "'STATEMENT',$5) RETURNING id",
          [
            familyId,
            caseId,
            manager.personId,
            messageId,
            'Slice 16 authoritative evidence fixture.',
          ]
        );
        evidenceAssertionId = assertion.rows[0]!.id;
      }
      await admin.query("UPDATE cases SET phase='GOALS' WHERE id=$1", [caseId]);
      await admin.query(
        "INSERT INTO problem_formulations " +
          "(family_id,case_id,version,status,primary_problem,key_factors,evidence_refs," +
          "unknowns,conflicts,scene_fit,alternative_explanations,reassessment_conditions," +
          "exit_conditions,user_response,confirmed_by_person_id,confirmed_at,dependency_refs," +
          "supersedes_version) VALUES " +
          "($1,$2,1,'CONFIRMED',$3::jsonb,'[]'::jsonb,$4::jsonb,'[]'::jsonb," +
          "'[]'::jsonb,'DIGITAL_USE','[]'::jsonb,'[]'::jsonb,'[]'::jsonb,$5::jsonb," +
          "$6,now(),$7::jsonb,NULL)",
        [
          familyId,
          caseId,
          JSON.stringify({ text: 'Current Slice 16 formulation.' }),
          JSON.stringify(
            evidenceAssertionId === null
              ? [{ type: 'DIALOGUE_MESSAGE', id: messageId }]
              : [{ type: 'ASSERTION', id: evidenceAssertionId }]
          ),
          JSON.stringify({
            kind: 'CONFIRM',
            actorPersonId: manager.personId,
            respondedAt: new Date().toISOString(),
          }),
          manager.personId,
          JSON.stringify(
            evidenceAssertionId === null
              ? []
              : [
                  {
                    type: 'EVIDENCE',
                    evidence: { type: 'ASSERTION', id: evidenceAssertionId },
                  },
                ]
          ),
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
      if (participationId !== null) {
        const inviteTokenHash = crypto
          .createHash('sha256')
          .update('s16-participation-' + participationId)
          .digest('hex');
        await admin.query(
          "INSERT INTO case_participants " +
            "(id,family_id,case_id,person_id,state,invite_token_hash,invite_expires_at," +
            "created_by_person_id,accepted_at) " +
            "VALUES ($1,$2,$3,$4,'ACTIVE',$5,now()+interval '1 day',$4,now())",
          [
            participationId,
            familyId,
            caseId,
            manager.personId,
            inviteTokenHash,
          ]
        );
      }
      await admin.query('COMMIT');
    } catch (error) {
      await admin.query('ROLLBACK');
      throw error;
    }

    const semantic = interventionSemantic({
      formulation_dependencies: [],
      supporting_evidence_requirements:
        evidenceAssertionId === null
          ? []
          : ['ASSERTION:' + evidenceAssertionId.toLowerCase()],
      applicable_conditions: [],
      exclusion_or_contraindication_conditions: [],
      age_and_development_scope: {
        min_age_years: null,
        max_age_years: null,
        development_stages: [],
      },
      participation_and_consent_requirements: {
        required_participation_refs:
          participationId === null ? [] : [participationId],
        required_consent_purposes: [],
      },
    });
    const definitionActor =
      options.nonStaffFamilyActor === true
        ? await loginWithLabel(app, 's16-reviewer-' + label)
        : manager;
    await admin.query(
      "INSERT INTO staff_assignments " +
        "(account_id,person_id,capability,scope_type,granted_by_account_id) " +
        "VALUES ($1,$2,'PROFESSIONAL_REVIEW','GLOBAL',$1)",
      [definitionActor.accountId, definitionActor.personId]
    );
    const created = await createInterventionDefinitionCandidate(
      appDb,
      {
        actor: {
          accountId: definitionActor.accountId,
          personId: definitionActor.personId,
        },
        sceneId: 'DIGITAL_USE',
        interventionCode:
          'TEST_SNAPSHOT_' +
          crypto.randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase(),
        semantic,
        approvalScope: 'DIGITAL_USE',
        idempotencyKey: 's16-snapshot-definition-' + crypto.randomUUID(),
      },
      TEST_ONLY_QUALIFICATION_PROVIDER
    );
    return {
      manager,
      familyId,
      caseId,
      definitionId: created.id,
      version: created.version,
      contentHash: created.contentHash,
      evidenceAssertionId,
      participationId,
    };
  }

  const passAdapters: InterventionEligibilityOwnerAdapters = {
    async resolveAgeDevelopment() { return { ageYears: null, developmentStages: [] }; },
    async resolveFacts() { return {}; },
    async resolveParticipation() { return {}; },
    async resolveConsent() { return {}; },
    async evaluateCompliance() { return 'PASS'; },
  };

  const exactPackage: DigitalUseInterventionInclusionProvider = {
    async resolve(input) {
      return { status: 'INCLUDED', inclusion: input };
    },
  };

  function authorityFor(f: Fixture) {
    return professionalProvider(
      professionalProof({
        definitionId: f.definitionId,
        definitionVersion: f.version,
        contentHash: f.contentHash,
      })
    );
  }

  async function expectEligibilityStillWaiting(
    promise: Promise<unknown>,
    milliseconds = 50
  ): Promise<void> {
    let settled = false;
    void promise.finally(() => { settled = true; });
    await new Promise((resolve) => setTimeout(resolve, milliseconds));
    expect(settled).toBe(false);
  }

  it('allows an authorized non-staff Family manager to evaluate exact eligibility while mutation stays blocked', async () => {
    const f = await fixture('non-staff-' + crypto.randomUUID(), {
      nonStaffFamilyActor: true,
    });

    const staff = await admin.query<{ count: string }>(
      "SELECT count(*)::text AS count FROM staff_assignments " +
        "WHERE account_id=$1 AND person_id=$2 AND capability='PROFESSIONAL_REVIEW' " +
        "AND scope_type='GLOBAL' AND revoked_at IS NULL",
      [f.manager.accountId, f.manager.personId]
    );
    expect(staff.rows[0]!.count).toBe('0');

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
      authorityFor(f),
      exactPackage
    );

    expect(result.allowed).toBe(true);
    expect(result.reasonCodes).not.toContain('DEFINITION_NOT_EXACT');

    await withIdentityTransaction(
      appDb,
      { accountId: f.manager.accountId, purpose: 'SELF_IDENTITY' },
      async (tx) => {
        const visible = await tx.query<{ id: string }>(
          'SELECT id FROM intervention_definitions WHERE id=$1',
          [f.definitionId]
        );
        expect(visible.rows).toEqual([{ id: f.definitionId }]);

        const attemptedUpdate = await tx.query<{ id: string }>(
          "UPDATE intervention_definitions SET definition_state='RETIRED', " +
            "revision=revision+1, retired_at=clock_timestamp() WHERE id=$1 RETURNING id",
          [f.definitionId]
        );
        expect(attemptedUpdate.rowCount).toBe(0);
      }
    );

    await expect(
      retireInterventionDefinition(
        appDb,
        {
          actor: {
            accountId: f.manager.accountId,
            personId: f.manager.personId,
          },
          definition: {
            id: f.definitionId,
            version: f.version,
            contentHash: f.contentHash,
            expectedRevision: 1,
          },
          approvalScope: 'DIGITAL_USE',
          idempotencyKey: 's16-non-staff-retire-' + crypto.randomUUID(),
        },
        TEST_ONLY_QUALIFICATION_PROVIDER
      )
    ).rejects.toMatchObject({ code: 'INTERVENTION_STAFF_AUTHORITY_INVALID' });
  });

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
    expect(result.approvalArtifactIdentity).toBe('TEST_APPROVAL_ARTIFACT:1');
    expect(result.approvalProvenance).toMatchObject({
      approvalProofRef: 'TEST_APPROVAL:1',
      artifactIdentity: 'TEST_APPROVAL_ARTIFACT:1',
      reviewerIdentityRef: 'TEST_REVIEWER:1',
      staffAssignmentRef: 'TEST_STAFF_ASSIGNMENT:1',
      qualificationRef: 'TEST_QUALIFICATION:1',
      sourceRefs: ['TEST_SOURCE:v1'],
      approvalScope: 'DIGITAL_USE',
      publicationStatus: 'PUBLISHED',
    });
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
        "AND resource_id=$2 ORDER BY occurred_at DESC,id DESC LIMIT 1",
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
      approvalArtifactIdentity: 'TEST_APPROVAL_ARTIFACT:1',
      approvalProvenance: {
        approvalProofRef: 'TEST_APPROVAL:1',
        artifactIdentity: 'TEST_APPROVAL_ARTIFACT:1',
        reviewerIdentityRef: 'TEST_REVIEWER:1',
        staffAssignmentRef: 'TEST_STAFF_ASSIGNMENT:1',
        staffAuthorityScopeRef: 'GLOBAL',
        qualificationRef: 'TEST_QUALIFICATION:1',
        qualificationScopeRef: 'DIGITAL_USE',
        sourceRefs: ['TEST_SOURCE:v1'],
        approvalScope: 'DIGITAL_USE',
        reviewedAt: '2026-01-01T00:00:00.000Z',
        effectiveFrom: '2026-01-01T00:00:00.000Z',
        effectiveTo: '2027-01-01T00:00:00.000Z',
        publicationStatus: 'PUBLISHED',
        publishedAt: '2026-01-02T00:00:00.000Z',
      },
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

  it('blocks same proof identity when final reviewer Staff binding changes', async () => {
    const f = await fixture('staff-binding-drift-' + crypto.randomUUID());
    const original = professionalProof({
      definitionId: f.definitionId,
      definitionVersion: f.version,
      contentHash: f.contentHash,
    });
    const rebound = professionalProof({
      definitionId: f.definitionId,
      definitionVersion: f.version,
      contentHash: f.contentHash,
      staffAuthority: {
        ...original.staffAuthority,
        assignmentRef: 'TEST_STAFF_ASSIGNMENT:DIFFERENT',
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
      professionalProvider(original, rebound),
      exactPackage
    );

    expect(result.allowed).toBe(false);
    expect(result.approvalStatus).toBe('INVALID');
    expect(result.professionalAuthorityBlockers).toContain(
      'APPROVAL_PROOF_CHANGED'
    );
  });

  it('FR-049 blocks Case -> SAFETY_HOLD committed while eligibility is waiting on current Case authority', async () => {
    const f = await fixture('case-race-' + crypto.randomUUID());
    const writer = await admin.connect();
    try {
      await writer.query('BEGIN');
      await writer.query(
        "UPDATE cases SET status='SAFETY_HOLD', version=version+1, updated_at=now() WHERE id=$1",
        [f.caseId]
      );

      const eligibility = evaluateCurrentInterventionEligibility(
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
        authorityFor(f),
        exactPackage
      );
      await expectEligibilityStillWaiting(eligibility);
      await writer.query('COMMIT');

      const result = await eligibility;
      expect(result.allowed).toBe(false);
      expect(result.reasonCodes).toContain('CASE_NOT_CURRENT');
      expect(result.safetyResult).toBe('BLOCK');
      expect(result.caseRevision).toBeGreaterThan(1);
    } catch (error) {
      await writer.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      writer.release();
    }
  });

  it('AS-031 material Formulation correction/supersession cannot leave old eligibility authoritative', async () => {
    const f = await fixture('formulation-race-' + crypto.randomUUID());
    const writer = await admin.connect();
    try {
      await writer.query('BEGIN');
      const current = await writer.query<{ id: string }>(
        "SELECT id FROM problem_formulations WHERE case_id=$1 AND status<>'SUPERSEDED' FOR UPDATE",
        [f.caseId]
      );
      const currentId = current.rows[0]!.id;
      await writer.query(
        "UPDATE problem_formulations SET status='SUPERSEDED', updated_at=now() WHERE id=$1",
        [currentId]
      );
      await writer.query(
        "INSERT INTO problem_formulations " +
          "(family_id,case_id,version,status,primary_problem,key_factors,evidence_refs," +
          "unknowns,conflicts,scene_fit,alternative_explanations,reassessment_conditions," +
          "exit_conditions,user_response,confirmed_by_person_id,confirmed_at,dependency_refs," +
          "supersedes_version) " +
          "SELECT family_id,case_id,version+1,'PRESENTED'," +
          "jsonb_build_object('text','Materially corrected formulation'),key_factors," +
          "evidence_refs,unknowns,conflicts,scene_fit,alternative_explanations," +
          "reassessment_conditions,exit_conditions,NULL,NULL,NULL,dependency_refs,version " +
          "FROM problem_formulations WHERE id=$1",
        [currentId]
      );

      const eligibility = evaluateCurrentInterventionEligibility(
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
        authorityFor(f),
        exactPackage
      );
      await expectEligibilityStillWaiting(eligibility);
      await writer.query('COMMIT');

      const result = await eligibility;
      expect(result.allowed).toBe(false);
      expect(result.reasonCodes).toContain('FORMULATION_MISSING_OR_STALE');
      expect(result.formulationVersion === null || result.formulationVersion === 2).toBe(true);
    } catch (error) {
      await writer.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      writer.release();
    }
  });

  it('FR-049 required Evidence supersession commit cannot cross a positive eligibility decision', async () => {
    const f = await fixture('evidence-race-' + crypto.randomUUID(), {
      requiredAssertion: true,
    });
    expect(f.evidenceAssertionId).not.toBeNull();
    const evidenceId = f.evidenceAssertionId!;
    const writer = await admin.connect();
    try {
      await writer.query('BEGIN');
      await writer.query(
        "INSERT INTO assertions " +
          "(family_id,case_id,subject_person_id,source_kind,source_person_id," +
          "source_message_id,occurred_time_state,occurred_at,valid_from,valid_until," +
          "confirmation_status,supersedes_id,kind,content) " +
          "SELECT family_id,case_id,subject_person_id,source_kind,source_person_id," +
          "source_message_id,occurred_time_state,occurred_at,valid_from,valid_until," +
          "confirmation_status,id,kind,'Corrected authoritative evidence' " +
          "FROM assertions WHERE id=$1",
        [evidenceId]
      );
      await writer.query(
        "UPDATE problem_formulations SET review_state='NEEDS_REVIEW', updated_at=now() " +
          "WHERE case_id=$1 AND status<>'SUPERSEDED' AND review_state='CURRENT' " +
          "AND dependency_refs @> $2::jsonb",
        [
          f.caseId,
          JSON.stringify([
            {
              type: 'EVIDENCE',
              evidence: { type: 'ASSERTION', id: evidenceId.toLowerCase() },
            },
          ]),
        ]
      );

      const eligibility = evaluateCurrentInterventionEligibility(
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
        authorityFor(f),
        exactPackage
      );
      await expectEligibilityStillWaiting(eligibility);
      await writer.query('COMMIT');

      const result = await eligibility;
      expect(result.allowed).toBe(false);
      expect(result.reasonCodes).toContain('FORMULATION_MISSING_OR_STALE');
      expect(result.reasonCodes).toContain('EVIDENCE_MISSING_OR_UNKNOWN');
    } catch (error) {
      await writer.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      writer.release();
    }
  });

  it('FR-049 Scene package binding revision committed during eligibility is re-read before decision', async () => {
    const f = await fixture('package-race-' + crypto.randomUUID());
    const writer = await admin.connect();
    try {
      await writer.query('BEGIN');
      const revised = await casRecordSceneNodeProgress(writer, {
        caseId: f.caseId,
        nodeCode: 'A1001',
        scenePackageVersion: 'v1',
        expectedRevision: 1,
        branchReasonCodes: [],
        inputRefs: [],
        outputRefs: [],
      });
      expect(revised?.revision).toBe(2);

      const eligibility = evaluateCurrentInterventionEligibility(
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
        authorityFor(f),
        exactPackage
      );
      await expectEligibilityStillWaiting(eligibility);
      await writer.query('COMMIT');

      const result = await eligibility;
      expect(result.allowed).toBe(true);
      expect(result.scenePackageVersion).toBe('v1');
      expect(result.dependencyRevisionRefs).toContain('PACKAGE:v1:r2');
      expect(result.dependencyRevisionRefs).not.toContain('PACKAGE:v1:r1');
    } catch (error) {
      await writer.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      writer.release();
    }
  });

  it('serializes exact package inclusion consumption before concurrent supersession and blocks every later use', async () => {
    const f = await fixture('package-supersede-' + crypto.randomUUID());
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
      authorityFor(f),
      blockingPackage
    );

    await entered;

    let supersessionSettled = false;
    const supersessionPromise = supersedeInterventionDefinition(
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
        idempotencyKey: 's16-package-supersede-' + crypto.randomUUID(),
      },
      TEST_ONLY_QUALIFICATION_PROVIDER
    ).finally(() => {
      supersessionSettled = true;
    });

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(supersessionSettled).toBe(false);

    releaseResolve();
    const [beforeSupersede, superseded] = await Promise.all([
      eligibilityPromise,
      supersessionPromise,
    ]);
    expect(beforeSupersede.allowed).toBe(true);
    expect(superseded.state).toBe('SUPERSEDED');

    const afterSupersede = await evaluateCurrentInterventionEligibility(
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
      authorityFor(f),
      exactPackage
    );
    expect(afterSupersede.allowed).toBe(false);
    expect(afterSupersede.reasonCodes).toContain('DEFINITION_SUPERSEDED');
  });

  it('serializes exact package inclusion consumption before concurrent retirement and blocks every later use', async () => {
    const f = await fixture('package-retire-' + crypto.randomUUID());
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


  it('blocks when exact Approval expires during package await before the final decision boundary', async () => {
    const f = await fixture('approval-expiry-race-' + crypto.randomUUID());
    let proof: ReturnType<typeof professionalProof> | null = null;
    const provider = {
      async resolve() {
        proof = professionalProof({
          definitionId: f.definitionId,
          definitionVersion: f.version,
          contentHash: f.contentHash,
          effectiveTo: new Date(Date.now() + 180).toISOString(),
        });
        return proof;
      },
      async revalidate() {
        return proof;
      },
    };

    let enteredPackage!: () => void;
    let releasePackage!: () => void;
    const packageEntered = new Promise<void>((resolve) => { enteredPackage = resolve; });
    const packageRelease = new Promise<void>((resolve) => { releasePackage = resolve; });
    const blockingPackage: DigitalUseInterventionInclusionProvider = {
      async resolve(input) {
        enteredPackage();
        await packageRelease;
        return { status: 'INCLUDED', inclusion: input };
      },
    };

    const eligibility = evaluateCurrentInterventionEligibility(
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
      provider,
      blockingPackage
    );

    await packageEntered;
    expect(proof).not.toBeNull();
    const expiry = Date.parse(proof!.effectiveTo!);
    const remaining = Math.max(0, expiry - Date.now() + 30);
    await new Promise((resolve) => setTimeout(resolve, remaining));
    releasePackage();

    const result = await eligibility;
    expect(result.allowed).toBe(false);
    expect(result.approvalStatus).toBe('INVALID');
    expect(result.professionalAuthorityBlockers).toContain('APPROVAL_EXPIRED');

    const positiveAudit = await admin.query<{ count: string }>(
      "SELECT count(*)::text AS count FROM business_audit_events " +
        "WHERE family_id=$1 AND resource_type='INTERVENTION_DEFINITION' " +
        "AND resource_id=$2 AND metadata->>'allowed'='true'",
      [f.familyId, f.definitionId]
    );
    expect(positiveAudit.rows[0]!.count).toBe('0');
  });

  it('waits for the existing Participation owner withdrawal and never emits a stale-positive eligibility audit', async () => {
    const f = await fixture('participation-withdraw-race-' + crypto.randomUUID(), {
      requiredParticipation: true,
    });
    expect(f.participationId).not.toBeNull();

    const ownerAwareAdapters: InterventionEligibilityOwnerAdapters = {
      ...passAdapters,
      resolveParticipation: productionInterventionOwnerAdapters.resolveParticipation,
    };

    const writer = await admin.connect();
    let committed = false;
    try {
      await writer.query('BEGIN');
      const withdrawn = await withdrawParticipationOwner(writer, f.participationId!);
      expect(withdrawn?.state).toBe('WITHDRAWN');

      const eligibility = evaluateCurrentInterventionEligibility(
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
        ownerAwareAdapters,
        authorityFor(f),
        exactPackage
      );

      // A stale plain SELECT would observe the old ACTIVE row and finish here.
      // The authoritative owner lock must instead wait for the withdrawal.
      await expectEligibilityStillWaiting(eligibility);
      await writer.query('COMMIT');
      committed = true;

      const result = await eligibility;
      expect(result.allowed).toBe(false);
      expect(result.reasonCodes).toContain('PARTICIPATION_BLOCK');

      const positiveAudit = await admin.query<{ count: string }>(
        "SELECT count(*)::text AS count FROM business_audit_events " +
          "WHERE family_id=$1 AND resource_type='INTERVENTION_DEFINITION' " +
          "AND resource_id=$2 AND metadata->>'allowed'='true'",
        [f.familyId, f.definitionId]
      );
      expect(positiveAudit.rows[0]!.count).toBe('0');

      const blockedAudit = await admin.query<{
        event_type: string;
        metadata: Record<string, unknown>;
      }>(
        "SELECT event_type,metadata FROM business_audit_events " +
          "WHERE family_id=$1 AND resource_type='INTERVENTION_DEFINITION' " +
          "AND resource_id=$2 ORDER BY occurred_at DESC,id DESC LIMIT 1",
        [f.familyId, f.definitionId]
      );
      expect(blockedAudit.rows[0]!.event_type).toBe('INTERVENTION_ELIGIBILITY_BLOCKED');
      expect(blockedAudit.rows[0]!.metadata).toMatchObject({ allowed: false });
    } finally {
      if (!committed) await writer.query('ROLLBACK').catch(() => undefined);
      writer.release();
    }
  });

});
