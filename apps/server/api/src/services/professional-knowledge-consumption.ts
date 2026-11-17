/**
 * Slice 17 — bounded family-facing Professional Knowledge consumption.
 *
 * There is deliberately no public route in this slice. The application seam
 * composes existing Authorization/RLS/Compliance/Safety owners and exact
 * Knowledge eligibility. Unauthorized protected-asset details collapse to one
 * non-enumerating denial; infrastructure dependency failures remain distinct.
 */
import type pg from 'pg';
import {
  createServerFeatureDescriptor,
  evaluateComplianceAtTransactionTime,
  type ComplianceObligation,
} from '@xiaoshuyin/compliance';
import {
  evaluateProfessionalKnowledgeEligibility,
  getCaseById,
  getProfessionalKnowledgeVersion,
  isFamilyMember,
  type ProfessionalApprovalValidation,
  type ProfessionalKnowledgeAgeBand,
  type ProfessionalKnowledgeRiskLevel,
  type ProfessionalKnowledgeVersionSnapshot,
  type ScenePackageKnowledgeBindingResult,
} from '@xiaoshuyin/domain';
import {
  resolveDigitalUseProfessionalKnowledgeBinding,
} from '@xiaoshuyin/scenes/digital-use';
import { drizzle } from 'drizzle-orm/node-postgres';
import { withRlsTransaction } from '../db/tx.js';
import {
  isKnownAuthorizationDenial,
  requireFamilyAction,
} from '../authz.js';

const KNOWLEDGE_CONSUMPTION_FEATURE = createServerFeatureDescriptor({
  featureCode: 'PROFESSIONAL_KNOWLEDGE_CONSUMPTION',
  featureContractRevision: 'v1',
  capabilityLabel: 'Professional Knowledge Consumption',
});

const KNOWLEDGE_CONSUMPTION_OBLIGATIONS = [
  'REQUIRE_GUARDIAN_CONSENT',
  'REQUIRE_MINOR_MODE',
] as const satisfies readonly ComplianceObligation[];

function protectedUnavailable(): never {
  throw Object.assign(new Error('PROTECTED_RESOURCE_NOT_FOUND'), {
    statusCode: 404,
    code: 'RESOURCE_NOT_FOUND',
  });
}

function blocked(code: string): never {
  throw Object.assign(new Error(code), {
    statusCode: 403,
    code,
  });
}

function dependencyUnavailable(dependency: string): never {
  throw Object.assign(new Error(dependency), {
    statusCode: 503,
    code: 'DEPENDENCY_UNAVAILABLE',
    dependency,
  });
}

export interface VerifiedKnowledgeEligibilityFacts {
  readonly stage: string | 'UNKNOWN' | null;
  readonly ageBand: ProfessionalKnowledgeAgeBand | 'UNKNOWN' | null;
  readonly locale: string | null;
  readonly applicabilityFacts: readonly string[] | null;
  readonly exclusionFacts: readonly string[] | null;
  readonly riskLevel: ProfessionalKnowledgeRiskLevel | 'UNKNOWN' | null;
}

export interface ProfessionalKnowledgeConsumptionDependencies {
  readonly resolveApproval: (
    tx: pg.PoolClient,
    version: ProfessionalKnowledgeVersionSnapshot
  ) => Promise<ProfessionalApprovalValidation>;
  readonly resolveEligibilityFacts: (
    tx: pg.PoolClient,
    input: {
      familyId: string;
      caseId: string;
      actorPersonId: string;
      targetPersonId: string;
      version: ProfessionalKnowledgeVersionSnapshot;
    }
  ) => Promise<VerifiedKnowledgeEligibilityFacts>;
  readonly resolveSceneBinding: (
    scenePackageVersion: string
  ) => ScenePackageKnowledgeBindingResult;
}

const productionConsumptionDependencies:
  ProfessionalKnowledgeConsumptionDependencies = {
    async resolveApproval() {
      return {
        status: 'UNAVAILABLE',
        dependency: 'APPROVED PROFESSIONAL REVIEWER — UNASSIGNED',
      };
    },
    async resolveEligibilityFacts() {
      return {
        stage: 'UNKNOWN',
        ageBand: 'UNKNOWN',
        locale: null,
        applicabilityFacts: null,
        exclusionFacts: null,
        riskLevel: 'UNKNOWN',
      };
    },
    resolveSceneBinding: resolveDigitalUseProfessionalKnowledgeBinding,
  };

async function assertKnowledgeCompliance(
  tx: pg.PoolClient,
  actorPersonId: string,
  targetPersonId: string
): Promise<void> {
  const result = await evaluateComplianceAtTransactionTime(
    drizzle(tx),
    tx,
    {
      descriptor: KNOWLEDGE_CONSUMPTION_FEATURE,
      actorPersonId,
      targetPersonId,
      supportedObligations: KNOWLEDGE_CONSUMPTION_OBLIGATIONS,
    }
  );
  if (result.gate !== 'ALLOW') blocked('COMPLIANCE_BLOCKED');
}

function isExplicitFamilyMembershipDenial(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: unknown }).code === '42501' &&
    typeof (error as { message?: unknown }).message === 'string' &&
    (error as { message: string }).message.includes('FAMILY_MEMBERSHIP_REQUIRED')
  );
}

export async function consumeProfessionalKnowledge(input: {
  pool: pg.Pool;
  actor: { accountId: string; personId: string };
  familyId: string;
  caseId: string;
  targetPersonId: string;
  versionId: string;
  dependencies?: ProfessionalKnowledgeConsumptionDependencies;
}): Promise<{
  versionId: string;
  semanticVersion: string;
  content: Readonly<Record<string, unknown>>;
}> {
  const dependencies = input.dependencies ?? productionConsumptionDependencies;
  try {
    return await withRlsTransaction(
    input.pool,
    {
      familyId: input.familyId,
      accountId: input.actor.accountId,
      personId: input.actor.personId,
      purpose: 'PROFESSIONAL_KNOWLEDGE_CONSUMPTION',
    },
    async (tx) => {
      try {
        await requireFamilyAction(tx, {
          accountId: input.actor.accountId,
          personId: input.actor.personId,
          familyId: input.familyId,
          caseId: input.caseId,
          action: 'CASE_READ_PROFESSIONAL_KNOWLEDGE',
          purpose: 'PROFESSIONAL_KNOWLEDGE_CONSUMPTION',
          resource: {
            type: 'CASE',
            familyId: input.familyId,
            caseId: input.caseId,
          },
        });
      } catch (error) {
        if (isKnownAuthorizationDenial(error)) protectedUnavailable();
        throw error;
      }

      const caseRow = await getCaseById(tx, input.caseId);
      if (!caseRow || caseRow.family_id !== input.familyId) protectedUnavailable();
      if (caseRow.status !== 'OPEN' && caseRow.status !== 'SAFETY_HOLD') protectedUnavailable();

      if (!await isFamilyMember(tx, input.familyId, input.targetPersonId)) {
        protectedUnavailable();
      }

      await assertKnowledgeCompliance(tx, input.actor.personId, input.targetPersonId);

      if (caseRow.status === 'SAFETY_HOLD') blocked('SAFETY_HOLD_BLOCKED');

      // RLS itself hides candidate/unpublished/non-current/invalid versions.
      const version = await getProfessionalKnowledgeVersion(tx, input.versionId);
      if (!version) protectedUnavailable();

      const approval = await dependencies.resolveApproval(tx, version);
      if (approval.status === 'UNAVAILABLE') {
        dependencyUnavailable(approval.dependency);
      }
      if (approval.status !== 'VALID') protectedUnavailable();

      const facts = await dependencies.resolveEligibilityFacts(tx, {
        familyId: input.familyId,
        caseId: input.caseId,
        actorPersonId: input.actor.personId,
        targetPersonId: input.targetPersonId,
        version,
      });
      const sceneBinding = dependencies.resolveSceneBinding(
        version.scope.scenePackageVersion
      );
      const eligibility = evaluateProfessionalKnowledgeEligibility({
        version,
        approval,
        sceneBinding,
        ...facts,
        intervention: version.scope.interventionDefinitionRef
          ? {
              status: 'UNAVAILABLE',
              reason: 'SLICE_16_AUTHORITATIVE_OWNER_NOT_MERGED',
            }
          : { status: 'NOT_REQUIRED' },
      });
      if (eligibility.status === 'UNAVAILABLE') {
        dependencyUnavailable(eligibility.dependency);
      }
      if (eligibility.status !== 'ELIGIBLE') protectedUnavailable();

      return {
        versionId: version.id,
        semanticVersion: version.semanticVersion,
        content: version.content,
      };
    }
    );
  } catch (error) {
    if (isExplicitFamilyMembershipDenial(error)) protectedUnavailable();
    throw error;
  }
}
