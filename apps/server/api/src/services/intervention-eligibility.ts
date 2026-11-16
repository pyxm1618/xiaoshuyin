import type pg from 'pg';
import {
  canonicalDependencyKey,
  canonicalEvidenceKey,
  contentOf,
  deriveAuthoritativeEvidenceSet,
  evaluateInterventionEligibility,
  getCaseById,
  getCurrentProblemFormulation,
  getExactInterventionDefinition,
  getScenePackageBinding,
  isProblemFormulationAuthoritativeExecutionBasis,
  type InterventionEligibilityResult,
  type InterventionGateState,
} from '@xiaoshuyin/domain';
import {
  resolveProductionDigitalUseInterventionInclusion,
} from '@xiaoshuyin/scenes/digital-use';
import { requireFamilyAction } from '../authz.js';
import { withRlsTransaction } from '../db/tx.js';
import {
  resolveInterventionProfessionalAuthority,
  unavailableProductionInterventionProfessionalAuthorityProvider,
  type InterventionProfessionalAuthorityProvider,
} from './intervention-professional-authority.js';

export interface InterventionEligibilityOwnerAdapters {
  readonly resolveAgeDevelopment: (
    tx: pg.PoolClient,
    input: { familyId: string; caseId: string }
  ) => Promise<{ ageYears: number | null; developmentStages: readonly string[] }>;
  readonly resolveFacts: (
    tx: pg.PoolClient,
    input: { familyId: string; caseId: string }
  ) => Promise<Readonly<Record<string, string | number | boolean | readonly (string | number | boolean)[]>>>;
  readonly resolveParticipation: (
    tx: pg.PoolClient,
    input: { familyId: string; caseId: string; requiredRefs: readonly string[] }
  ) => Promise<Readonly<Record<string, InterventionGateState>>>;
  readonly resolveConsent: (
    tx: pg.PoolClient,
    input: { familyId: string; caseId: string; requiredPurposes: readonly string[] }
  ) => Promise<Readonly<Record<string, InterventionGateState>>>;
  readonly evaluateCompliance: (
    tx: pg.PoolClient,
    input: { familyId: string; caseId: string }
  ) => Promise<InterventionGateState>;
  readonly evaluateSafety: (
    tx: pg.PoolClient,
    input: { familyId: string; caseId: string }
  ) => Promise<InterventionGateState>;
}

/**
 * No fake production owner values. Until concrete existing-owner adapters are
 * composed by a caller, every unresolved control is UNKNOWN and fail-closed.
 */
export const failClosedProductionInterventionOwnerAdapters:
  InterventionEligibilityOwnerAdapters = Object.freeze({
    async resolveAgeDevelopment() { return { ageYears: null, developmentStages: [] }; },
    async resolveFacts() { return {}; },
    async resolveParticipation(
      _tx: pg.PoolClient,
      input: { familyId: string; caseId: string; requiredRefs: readonly string[] }
    ): Promise<Readonly<Record<string, InterventionGateState>>> {
      return Object.fromEntries(input.requiredRefs.map((ref: string) => [ref, 'UNKNOWN' as const]));
    },
    async resolveConsent(
      _tx: pg.PoolClient,
      input: { familyId: string; caseId: string; requiredPurposes: readonly string[] }
    ): Promise<Readonly<Record<string, InterventionGateState>>> {
      return Object.fromEntries(input.requiredPurposes.map((ref: string) => [ref, 'UNKNOWN' as const]));
    },
    async evaluateCompliance(): Promise<InterventionGateState> { return 'UNKNOWN'; },
    async evaluateSafety(): Promise<InterventionGateState> { return 'UNKNOWN'; },
  });

export async function evaluateCurrentInterventionEligibilityInTransaction(
  tx: pg.PoolClient,
  input: {
    actor: { accountId: string; personId: string };
    familyId: string;
    caseId: string;
    definition: { id: string; version: number; contentHash: string };
    consideredInterventionCodes?: readonly string[];
  },
  adapters: InterventionEligibilityOwnerAdapters,
  professionalProvider: InterventionProfessionalAuthorityProvider =
    unavailableProductionInterventionProfessionalAuthorityProvider
): Promise<InterventionEligibilityResult> {
  await requireFamilyAction(tx, {
    accountId: input.actor.accountId,
    personId: input.actor.personId,
    familyId: input.familyId,
    caseId: input.caseId,
    action: 'CASE_READ',
    purpose: 'FAMILY_MANAGEMENT',
    resource: { type: 'CASE', familyId: input.familyId, caseId: input.caseId },
  });

  const caseRow = await getCaseById(tx, input.caseId);
  if (caseRow === null || caseRow.family_id !== input.familyId) {
    throw Object.assign(new Error('CASE_NOT_FOUND'), { code: 'CASE_NOT_FOUND', statusCode: 404 });
  }

  const formulation = await getCurrentProblemFormulation(tx, input.caseId);
  const authoritativeFormulation =
    formulation !== null && isProblemFormulationAuthoritativeExecutionBasis(formulation)
      ? formulation
      : null;
  const evidenceSet =
    authoritativeFormulation === null
      ? { refs: [], members: [] }
      : await deriveAuthoritativeEvidenceSet(tx, input.caseId, contentOf(authoritativeFormulation));
  const evidence: Record<string, { state: 'VALUE' | 'UNKNOWN' | 'DECLINED' | 'NOT_COLLECTED' | 'CONFLICTING' | 'NOT_APPLICABLE'; revisionRef: string }> = {};
  for (const member of evidenceSet.members) {
    const ref = canonicalEvidenceKey(member.ref);
    evidence[ref] = {
      state:
        member.conflictGroupId !== null
          ? 'CONFLICTING'
          : member.unknownState === null
            ? member.usable ? 'VALUE' : 'UNKNOWN'
            : member.unknownState,
      revisionRef: ref,
    };
  }

  const scenePackageVersion = await getScenePackageBinding(tx, input.caseId);
  const definition = await getExactInterventionDefinition(tx, input.definition);
  const professional =
    definition === null
      ? { status: 'INVALID' as const, reason: 'WRONG_DEFINITION' as const }
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

  let finalProfessional = professional;
  if (professional.status === 'VALID' && definition !== null) {
    const revalidated = await resolveInterventionProfessionalAuthority(
      professionalProvider,
      {
        definitionId: definition.id,
        definitionVersion: definition.version,
        contentHash: definition.contentHash,
        sceneId: definition.sceneId,
        sourceRefs: definition.semantic.professional_source_refs,
        approvalScope: definition.sceneId,
      },
      'REVALIDATE'
    );
    finalProfessional =
      revalidated.status === 'VALID' &&
      revalidated.approvalProofRef === professional.approvalProofRef &&
      revalidated.reviewerIdentityRef === professional.reviewerIdentityRef &&
      revalidated.qualificationRef === professional.qualificationRef
        ? revalidated
        : ({ status: 'INVALID', reason: 'APPROVAL_PROOF_CHANGED' } as const);
  }

  const packageInclusion =
    definition !== null && scenePackageVersion !== null
      ? resolveProductionDigitalUseInterventionInclusion({
          scenePackageVersion,
          definitionId: definition.id,
          definitionVersion: definition.version,
          contentHash: definition.contentHash,
        }).status === 'INCLUDED'
        ? 'PASS'
        : 'BLOCK'
      : 'UNKNOWN';

  const requiredParticipation =
    definition?.semantic.participation_and_consent_requirements.required_participation_refs ?? [];
  const requiredConsent =
    definition?.semantic.participation_and_consent_requirements.required_consent_purposes ?? [];
  const [ageDevelopment, facts, participation, consent, compliance, safety] =
    await Promise.all([
      adapters.resolveAgeDevelopment(tx, { familyId: input.familyId, caseId: input.caseId }),
      adapters.resolveFacts(tx, { familyId: input.familyId, caseId: input.caseId }),
      adapters.resolveParticipation(tx, { familyId: input.familyId, caseId: input.caseId, requiredRefs: requiredParticipation }),
      adapters.resolveConsent(tx, { familyId: input.familyId, caseId: input.caseId, requiredPurposes: requiredConsent }),
      adapters.evaluateCompliance(tx, { familyId: input.familyId, caseId: input.caseId }),
      adapters.evaluateSafety(tx, { familyId: input.familyId, caseId: input.caseId }),
    ]);

  return evaluateInterventionEligibility({
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
            dependencyRefs: authoritativeFormulation.dependency_refs.map(canonicalDependencyKey),
          },
    evidence,
    scenePackageVersion,
    expectedDefinition: {
      id: input.definition.id,
      sceneId: definition?.sceneId ?? '',
      interventionCode: definition?.interventionCode ?? '',
      version: input.definition.version,
      contentHash: input.definition.contentHash,
    },
    definition,
    professionalAuthority: {
      state: finalProfessional.status,
      approvalProofRef: finalProfessional.status === 'VALID' ? finalProfessional.approvalProofRef : null,
      reason: finalProfessional.status === 'VALID' ? null : finalProfessional.reason,
    },
    packageInclusion,
    ageYears: ageDevelopment.ageYears,
    developmentStages: ageDevelopment.developmentStages,
    facts,
    participation,
    consent,
    consideredInterventionCodes: input.consideredInterventionCodes ?? [],
    compliance,
    safety,
    dependencyRevisionRefs: [
      'CASE:' + caseRow.id + ':v' + caseRow.version,
      ...(authoritativeFormulation
        ? ['FORMULATION:' + authoritativeFormulation.id + ':v' + authoritativeFormulation.version]
        : []),
      ...Object.values(evidence).map((item) => item.revisionRef),
      ...(scenePackageVersion ? ['PACKAGE:' + scenePackageVersion] : []),
    ],
  });
}

export function evaluateCurrentInterventionEligibility(
  pool: pg.Pool,
  input: Parameters<typeof evaluateCurrentInterventionEligibilityInTransaction>[1],
  adapters: InterventionEligibilityOwnerAdapters =
    failClosedProductionInterventionOwnerAdapters,
  professionalProvider: InterventionProfessionalAuthorityProvider =
    unavailableProductionInterventionProfessionalAuthorityProvider
): Promise<InterventionEligibilityResult> {
  return withRlsTransaction(
    pool,
    {
      familyId: input.familyId,
      accountId: input.actor.accountId,
      personId: input.actor.personId,
      purpose: 'FAMILY_MANAGEMENT',
    },
    (tx) => evaluateCurrentInterventionEligibilityInTransaction(
      tx, input, adapters, professionalProvider
    )
  );
}
