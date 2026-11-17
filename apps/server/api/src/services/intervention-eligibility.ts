import type pg from 'pg';
import {
  canonicalDependencyKey,
  canonicalEvidenceKey,
  contentOf,
  decideOrdinaryProgression,
  deriveAuthoritativeEvidenceSet,
  effectiveParticipationState,
  evaluateInterventionEligibility,
  getCaseForUpdate,
  getParticipationById,
  getSceneNodeState,
  isProblemFormulationAuthoritativeExecutionBasis,
  lockCurrentProblemFormulation,
  type InterventionDefinitionExactRef,
  type InterventionEligibilityResult,
  type InterventionGateState,
} from '@xiaoshuyin/domain';
import {
  getExactInterventionDefinition,
  insertInterventionDefinitionAudit,
} from '../../../../../packages/domain/src/intervention-definition-repository.js';
import {
  DIGITAL_USE_SUPPLEMENTAL_ASSESSMENT,
  getCurrentPurposeScopedConsentDecision,
} from '@xiaoshuyin/compliance';
import {
  productionDigitalUseInterventionInclusionProvider,
  type DigitalUseInterventionInclusionProvider,
} from '@xiaoshuyin/scenes/digital-use';
import { requireFamilyAction } from '../authz.js';
import { withDrizzleRlsTransaction } from '../db/drizzle-tx.js';
import {
  resolveInterventionProfessionalAuthority,
  unavailableProductionInterventionProfessionalAuthorityProvider,
  type InterventionProfessionalAuthorityProvider,
} from './intervention-professional-authority.js';

const UUID_REF =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface InterventionEligibilityOwnerAdapters {
  readonly resolveAgeDevelopment: (
    tx: pg.PoolClient,
    input: {
      familyId: string;
      caseId: string;
      actor: { accountId: string; personId: string };
    }
  ) => Promise<{ ageYears: number | null; developmentStages: readonly string[] }>;
  readonly resolveFacts: (
    tx: pg.PoolClient,
    input: {
      familyId: string;
      caseId: string;
      actor: { accountId: string; personId: string };
    }
  ) => Promise<
    Readonly<
      Record<
        string,
        string | number | boolean | readonly (string | number | boolean)[]
      >
    >
  >;
  readonly resolveParticipation: (
    tx: pg.PoolClient,
    input: {
      familyId: string;
      caseId: string;
      actor: { accountId: string; personId: string };
      requiredRefs: readonly string[];
    }
  ) => Promise<Readonly<Record<string, InterventionGateState>>>;
  readonly resolveConsent: (
    tx: pg.PoolClient,
    input: {
      familyId: string;
      caseId: string;
      actor: { accountId: string; personId: string };
      requiredPurposes: readonly string[];
    }
  ) => Promise<Readonly<Record<string, InterventionGateState>>>;
  readonly evaluateCompliance: (
    tx: pg.PoolClient,
    input: {
      familyId: string;
      caseId: string;
      actor: { accountId: string; personId: string };
    }
  ) => Promise<InterventionGateState>;
}

/**
 * Production owner composition is intentionally bounded to authority that
 * already exists today:
 * - exact case_participants refs use the existing Participation owner;
 * - the currently-approved case-scoped supplemental Consent purpose uses the
 *   existing Consent owner;
 * - no Slice 16 Compliance feature identity/legal authority exists, so
 *   Compliance remains UNKNOWN instead of inventing a policy;
 * - no target-person age/development identity is assigned by the frozen
 *   contract, so age/facts remain UNKNOWN unless a future authorized caller
 *   supplies an existing-owner adapter.
 */
export const productionInterventionOwnerAdapters:
  InterventionEligibilityOwnerAdapters = Object.freeze({
    async resolveAgeDevelopment() {
      return { ageYears: null, developmentStages: [] };
    },
    async resolveFacts() {
      return {};
    },
    async resolveParticipation(
      tx: pg.PoolClient,
      input: {
        familyId: string;
        caseId: string;
        actor: { accountId: string; personId: string };
        requiredRefs: readonly string[];
      }
    ): Promise<Readonly<Record<string, InterventionGateState>>> {
      const result: Record<string, InterventionGateState> = {};
      for (const ref of input.requiredRefs) {
        if (!UUID_REF.test(ref)) {
          result[ref] = 'UNKNOWN';
          continue;
        }
        const row = await getParticipationById(tx, ref);
        if (
          row === null ||
          row.family_id !== input.familyId ||
          row.case_id !== input.caseId
        ) {
          result[ref] = 'BLOCK';
          continue;
        }
        const state = effectiveParticipationState(
          row.state,
          row.invite_expires_at
        );
        result[ref] =
          state === 'ACTIVE'
            ? 'PASS'
            : state === 'PENDING'
              ? 'UNKNOWN'
              : 'BLOCK';
      }
      return result;
    },
    async resolveConsent(
      tx: pg.PoolClient,
      input: {
        familyId: string;
        caseId: string;
        actor: { accountId: string; personId: string };
        requiredPurposes: readonly string[];
      }
    ): Promise<Readonly<Record<string, InterventionGateState>>> {
      const result: Record<string, InterventionGateState> = {};
      for (const purpose of input.requiredPurposes) {
        if (purpose !== DIGITAL_USE_SUPPLEMENTAL_ASSESSMENT) {
          // No generic Consent owner is invented for unsupported purposes.
          result[purpose] = 'UNKNOWN';
          continue;
        }
        const current = await getCurrentPurposeScopedConsentDecision(tx, {
          familyId: input.familyId,
          caseId: input.caseId,
          actor: input.actor,
          purpose: DIGITAL_USE_SUPPLEMENTAL_ASSESSMENT,
        });
        result[purpose] =
          current === null
            ? 'BLOCK'
            : current.decision === 'GRANTED'
              ? 'PASS'
              : 'BLOCK';
      }
      return result;
    },
    async evaluateCompliance(): Promise<InterventionGateState> {
      // A Compliance Feature Descriptor / Legal Authority for Intervention
      // eligibility has not been assigned. Truthful fail-closed dependency.
      return 'UNKNOWN';
    },
  });

export async function evaluateCurrentInterventionEligibilityInTransaction(
  tx: pg.PoolClient,
  input: {
    actor: { accountId: string; personId: string };
    familyId: string;
    caseId: string;
    definition: { id: string; version: number; contentHash: string };
    consideredDefinitions?: readonly InterventionDefinitionExactRef[];
  },
  adapters: InterventionEligibilityOwnerAdapters,
  professionalProvider: InterventionProfessionalAuthorityProvider =
    unavailableProductionInterventionProfessionalAuthorityProvider,
  packageInclusionProvider: DigitalUseInterventionInclusionProvider =
    productionDigitalUseInterventionInclusionProvider
): Promise<InterventionEligibilityResult> {
  // Authorization is first and uses the frozen CASE_READ + FAMILY_MANAGEMENT
  // composition. No protected professional/package/family details are read
  // before this succeeds.
  await requireFamilyAction(tx, {
    accountId: input.actor.accountId,
    personId: input.actor.personId,
    familyId: input.familyId,
    caseId: input.caseId,
    action: 'CASE_READ',
    purpose: 'FAMILY_MANAGEMENT',
    resource: { type: 'CASE', familyId: input.familyId, caseId: input.caseId },
  });

  // Decision-boundary authority pin: use the existing Case owner row lock.
  // Under READ COMMITTED this sees the latest committed authority and prevents
  // status/phase/primary/version writes from crossing this eligibility decision.
  const caseRow = await getCaseForUpdate(tx, input.caseId);
  if (caseRow === null || caseRow.family_id !== input.familyId) {
    throw Object.assign(new Error('CASE_NOT_FOUND'), {
      code: 'CASE_NOT_FOUND',
      statusCode: 404,
    });
  }

  const definition = await getExactInterventionDefinition(tx, input.definition);

  // The existing Formulation owner is also the serialization point used by
  // Evidence correction propagation (review_state -> NEEDS_REVIEW). Holding
  // this lock therefore prevents a relevant Evidence supersession commit from
  // crossing a positive decision.
  const formulation = await lockCurrentProblemFormulation(tx, input.caseId);
  const authoritativeFormulation =
    formulation !== null &&
    isProblemFormulationAuthoritativeExecutionBasis(formulation)
      ? formulation
      : null;

  // Read only Evidence required by this exact definition. The existing
  // Formulation/Evidence owner still derives authority/provenance; Slice 16
  // merely filters the returned owner snapshot to exact required refs.
  const requiredEvidence = new Set(
    definition?.semantic.supporting_evidence_requirements ?? []
  );
  const evidenceSet =
    authoritativeFormulation === null || requiredEvidence.size === 0
      ? { refs: [], members: [] }
      : await deriveAuthoritativeEvidenceSet(
          tx,
          input.caseId,
          contentOf(authoritativeFormulation)
        );
  const evidence: Record<
    string,
    {
      state:
        | 'VALUE'
        | 'UNKNOWN'
        | 'DECLINED'
        | 'NOT_COLLECTED'
        | 'CONFLICTING'
        | 'NOT_APPLICABLE';
      revisionRef: string;
    }
  > = {};
  for (const member of evidenceSet.members) {
    const ref = canonicalEvidenceKey(member.ref);
    if (!requiredEvidence.has(ref)) continue;
    evidence[ref] = {
      state:
        member.conflictGroupId !== null
          ? 'CONFLICTING'
          : member.unknownState === null
            ? member.usable
              ? 'VALUE'
              : 'UNKNOWN'
            : member.unknownState,
      revisionRef: ref,
    };
  }

  // Pin the canonical A1001 package binding with the existing Scene runtime
  // row lock. No second package registry or package authority is introduced.
  const scenePackageEntry = await getSceneNodeState(tx, input.caseId, 'A1001', true);
  const scenePackageVersion = scenePackageEntry?.scene_package_version ?? null;
  const professional =
    definition === null
      ? ({ status: 'INVALID', reason: 'WRONG_DEFINITION' } as const)
      : await resolveInterventionProfessionalAuthority(
          professionalProvider,
          {
            definitionId: definition.id,
            definitionVersion: definition.version,
            contentHash: definition.contentHash,
            sceneId: definition.sceneId,
            sourceRefs: definition.semantic.professional_source_refs,
            approvalScope: definition.sceneId,
          },
          'RESOLVE'
        );

  const requiredParticipation =
    definition?.semantic.participation_and_consent_requirements
      .required_participation_refs ?? [];
  const requiredConsent =
    definition?.semantic.participation_and_consent_requirements
      .required_consent_purposes ?? [];

  const [ageDevelopment, facts, participation, consent, compliance] =
    await Promise.all([
      adapters.resolveAgeDevelopment(tx, {
        familyId: input.familyId,
        caseId: input.caseId,
        actor: input.actor,
      }),
      adapters.resolveFacts(tx, {
        familyId: input.familyId,
        caseId: input.caseId,
        actor: input.actor,
      }),
      adapters.resolveParticipation(tx, {
        familyId: input.familyId,
        caseId: input.caseId,
        actor: input.actor,
        requiredRefs: requiredParticipation,
      }),
      adapters.resolveConsent(tx, {
        familyId: input.familyId,
        caseId: input.caseId,
        actor: input.actor,
        requiredPurposes: requiredConsent,
      }),
      adapters.evaluateCompliance(tx, {
        familyId: input.familyId,
        caseId: input.caseId,
        actor: input.actor,
      }),
    ]);

  // Safety consumes the existing single ordinary-progression rule. It remains
  // independent from Professional Approval and Compliance.
  const safety = decideOrdinaryProgression(caseRow.status).allowed
    ? ('PASS' as const)
    : ('BLOCK' as const);

  // Final exact-row lock prevents retirement/supersession from crossing the
  // decision. Case/Formulation/package authority is already pinned above and
  // Consent uses its existing owner advisory lock. Revalidate the exact
  // professional proof only after the exact definition lock.
  const finalDefinition =
    definition === null
      ? null
      : await getExactInterventionDefinition(tx, input.definition, true);

  let finalProfessional = professional;
  if (professional.status === 'VALID' && finalDefinition !== null) {
    const revalidated = await resolveInterventionProfessionalAuthority(
      professionalProvider,
      {
        definitionId: finalDefinition.id,
        definitionVersion: finalDefinition.version,
        contentHash: finalDefinition.contentHash,
        sceneId: finalDefinition.sceneId,
        sourceRefs: finalDefinition.semantic.professional_source_refs,
        approvalScope: finalDefinition.sceneId,
      },
      'REVALIDATE',
      Date.now(),
      {
        approvalProofRef: professional.approvalProofRef,
        artifactIdentity: professional.artifactIdentity,
      }
    );
    finalProfessional =
      revalidated.status === 'VALID' &&
      revalidated.approvalProofRef === professional.approvalProofRef &&
      revalidated.artifactIdentity === professional.artifactIdentity &&
      revalidated.reviewerIdentityRef === professional.reviewerIdentityRef &&
      revalidated.qualificationRef === professional.qualificationRef
        ? revalidated
        : ({ status: 'INVALID', reason: 'APPROVAL_PROOF_CHANGED' } as const);
  }

  let packageInclusion: InterventionGateState = 'UNKNOWN';
  if (finalDefinition !== null && scenePackageVersion !== null) {
    try {
      const inclusion = await packageInclusionProvider.resolve({
        scenePackageVersion,
        definitionId: finalDefinition.id,
        definitionVersion: finalDefinition.version,
        contentHash: finalDefinition.contentHash,
      });
      packageInclusion = inclusion.status === 'INCLUDED' ? 'PASS' : 'BLOCK';
    } catch {
      // Technical package-owner failure is not equivalent to "not included".
      packageInclusion = 'UNKNOWN';
    }
  }

  const result = evaluateInterventionEligibility({
    authorization: 'PASS',
    case: {
      id: caseRow.id,
      familyId: caseRow.family_id,
      status: caseRow.status,
      phase: caseRow.phase,
      version: caseRow.version,
      isPrimary: caseRow.is_primary,
    },
    formulation:
      authoritativeFormulation === null
        ? null
        : {
            id: authoritativeFormulation.id,
            version: authoritativeFormulation.version,
            status: authoritativeFormulation.status,
            reviewState: authoritativeFormulation.review_state,
            dependencyRefs:
              authoritativeFormulation.dependency_refs.map(canonicalDependencyKey),
          },
    evidence,
    scenePackageVersion,
    expectedDefinition: {
      id: input.definition.id,
      sceneId: finalDefinition?.sceneId ?? '',
      interventionCode: finalDefinition?.interventionCode ?? '',
      version: input.definition.version,
      contentHash: input.definition.contentHash,
    },
    definition: finalDefinition,
    professionalAuthority: {
      state: finalProfessional.status,
      approvalProofRef:
        finalProfessional.status === 'VALID'
          ? finalProfessional.approvalProofRef
          : null,
      artifactIdentity:
        finalProfessional.status === 'VALID'
          ? finalProfessional.artifactIdentity
          : null,
      provenance:
        finalProfessional.status === 'VALID'
          ? {
              approvalProofRef: finalProfessional.proof.approvalProofRef,
              artifactIdentity: finalProfessional.proof.artifactIdentity,
              reviewerIdentityRef: finalProfessional.proof.reviewerIdentityRef,
              staffAssignmentRef: finalProfessional.proof.staffAuthority.assignmentRef,
              staffAuthorityScopeRef: finalProfessional.proof.staffAuthority.scopeRef,
              qualificationRef: finalProfessional.proof.professionalQualification.qualificationRef,
              qualificationScopeRef: finalProfessional.proof.professionalQualification.scopeRef,
              sourceRefs: finalProfessional.proof.sourceRefs,
              approvalScope: finalProfessional.proof.approvalScope,
              reviewedAt: finalProfessional.proof.reviewedAt,
              effectiveFrom: finalProfessional.proof.effectiveFrom,
              effectiveTo: finalProfessional.proof.effectiveTo,
              publicationStatus: finalProfessional.proof.publicationStatus,
              publishedAt: finalProfessional.proof.publishedAt,
            }
          : null,
      reason:
        finalProfessional.status === 'VALID' ? null : finalProfessional.reason,
    },
    packageInclusion,
    ageYears: ageDevelopment.ageYears,
    developmentStages: ageDevelopment.developmentStages,
    facts,
    participation,
    consent,
    consideredDefinitions: input.consideredDefinitions ?? [],
    compliance,
    safety,
    dependencyRevisionRefs: [
      'CASE:' + caseRow.id + ':v' + caseRow.version,
      ...(authoritativeFormulation
        ? [
            'FORMULATION:' +
              authoritativeFormulation.id +
              ':v' +
              authoritativeFormulation.version,
          ]
        : []),
      ...Object.values(evidence).map((item) => item.revisionRef),
      ...(scenePackageVersion ? ['PACKAGE:' + scenePackageVersion] : []),
    ],
  });

  await insertInterventionDefinitionAudit(tx, {
    familyId: input.familyId,
    actorAccountId: input.actor.accountId,
    eventType: result.allowed
      ? 'INTERVENTION_ELIGIBILITY_EVALUATED'
      : 'INTERVENTION_ELIGIBILITY_BLOCKED',
    definitionId: input.definition.id,
    metadata: {
      definitionVersion: input.definition.version,
      contentHash: input.definition.contentHash,
      sceneId: result.sceneId,
      scenePackageVersion: result.scenePackageVersion,
      approvalProofRef: result.approvalProofRef,
      approvalArtifactIdentity: result.approvalArtifactIdentity,
      approvalProvenance: result.approvalProvenance,
      approvalStatus: result.approvalStatus,
      allowed: result.allowed,
      reasonCodes: result.reasonCodes,
      caseRevision: result.caseRevision,
      formulationVersion: result.formulationVersion,
      dependencyRevisionRefs: result.dependencyRevisionRefs,
    },
  });

  return result;
}

export function evaluateCurrentInterventionEligibility(
  pool: pg.Pool,
  input: Parameters<
    typeof evaluateCurrentInterventionEligibilityInTransaction
  >[1],
  adapters: InterventionEligibilityOwnerAdapters =
    productionInterventionOwnerAdapters,
  professionalProvider: InterventionProfessionalAuthorityProvider =
    unavailableProductionInterventionProfessionalAuthorityProvider,
  packageInclusionProvider: DigitalUseInterventionInclusionProvider =
    productionDigitalUseInterventionInclusionProvider
): Promise<InterventionEligibilityResult> {
  return withDrizzleRlsTransaction(
    pool,
    {
      familyId: input.familyId,
      accountId: input.actor.accountId,
      personId: input.actor.personId,
      purpose: 'FAMILY_MANAGEMENT',
    },
    (_tx, client) =>
      evaluateCurrentInterventionEligibilityInTransaction(
        client,
        input,
        adapters,
        professionalProvider,
        packageInclusionProvider
      )
  );
}
