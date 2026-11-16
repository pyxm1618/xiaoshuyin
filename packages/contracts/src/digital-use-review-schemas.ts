import { z } from 'zod';
import { PG_INTEGER_MAX } from './schemas.js';

/**
 * Slice 15 authority-reconciled submission envelopes.
 *
 * Professional questionnaire fields, dimensions, scoring and interpretation
 * are deliberately absent. The exact approved Professional Content Package
 * owns those semantics through the server-side consumer port.
 */
export const ProfessionalReviewPackageExpectation = z.strictObject({
  packageId: z.string().trim().min(1).max(200),
  packageVersion: z.string().trim().min(1).max(200),
  contentHash: z.string().trim().min(1).max(256),
});
export type ProfessionalReviewPackageExpectationType =
  z.infer<typeof ProfessionalReviewPackageExpectation>;

export const ProfessionalReviewEvidenceRef = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('DIALOGUE_MESSAGE'), id: z.string().uuid() }),
  z.strictObject({ type: z.literal('ASSERTION'), id: z.string().uuid() }),
  z.strictObject({ type: z.literal('OBSERVATION'), id: z.string().uuid() }),
]);
export type ProfessionalReviewEvidenceRefType =
  z.infer<typeof ProfessionalReviewEvidenceRef>;

export const ProfessionalReviewProvenance = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('PARENT_AUTHORED_OBSERVATION'),
    sourcePersonId: z.string().uuid(),
  }),
  z.strictObject({
    kind: z.literal('CHILD_AUTHORED_INPUT'),
    sourcePersonId: z.string().uuid(),
    sourceMessageId: z.string().uuid(),
  }),
  z.strictObject({
    kind: z.literal('PARENT_TRANSCRIBED_CHILD_CLAIM'),
    transcriberPersonId: z.string().uuid(),
    childPersonId: z.string().uuid(),
    evidenceRef: z.discriminatedUnion('type', [
      z.strictObject({ type: z.literal('ASSERTION'), id: z.string().uuid() }),
      z.strictObject({ type: z.literal('OBSERVATION'), id: z.string().uuid() }),
    ]),
  }),
  z.strictObject({
    kind: z.literal('SYSTEM_METADATA'),
    code: z.string().trim().min(1).max(120),
  }),
]);
export type ProfessionalReviewProvenanceType =
  z.infer<typeof ProfessionalReviewProvenance>;

const PackageOwnedNormalizedResponse = z.record(
  z.string().min(1).max(160),
  z.unknown()
);

export const A5001FamilyAllianceSubjectExpectation = z.strictObject({
  selectionRevision: z.number().int().min(1).max(PG_INTEGER_MAX),
  selectedTargets: z.array(z.strictObject({
    targetId: z.string().uuid(),
    targetCode: z.string().trim().min(1).max(64),
    targetRevision: z.number().int().min(1).max(PG_INTEGER_MAX),
  })).min(1).max(20).refine(
    (targets) =>
      new Set(targets.map((target) => target.targetId)).size === targets.length &&
      new Set(targets.map((target) => target.targetCode)).size === targets.length,
    { message: 'selected target identities must be unique' }
  ),
});
export type A5001FamilyAllianceSubjectExpectationType =
  z.infer<typeof A5001FamilyAllianceSubjectExpectation>;

export const A5001FamilyAllianceReviewSubmission = z.strictObject({
  kind: z.literal('FAMILY_ALLIANCE_REVIEW'),
  subject: A5001FamilyAllianceSubjectExpectation,
  professionalPackage: ProfessionalReviewPackageExpectation,
  normalizedResponse: PackageOwnedNormalizedResponse,
  evidenceRefs: z.array(ProfessionalReviewEvidenceRef).max(100).default([]),
  provenance: z.array(ProfessionalReviewProvenance).max(100).default([]),
});
export type A5001FamilyAllianceReviewSubmissionType =
  z.infer<typeof A5001FamilyAllianceReviewSubmission>;

export const A5002PhoneUseContractSubject = z.strictObject({
  contractId: z.string().uuid(),
  contractVersion: z.number().int().min(1).max(PG_INTEGER_MAX),
  contractRevision: z.number().int().min(1).max(PG_INTEGER_MAX),
  contractStatus: z.literal('ACTIVE'),
});
export type A5002PhoneUseContractSubjectType =
  z.infer<typeof A5002PhoneUseContractSubject>;

export const A5002PhoneUseContractReviewSubmission = z.strictObject({
  kind: z.literal('PHONE_USE_CONTRACT_REVIEW'),
  subject: A5002PhoneUseContractSubject,
  professionalPackage: ProfessionalReviewPackageExpectation,
  normalizedResponse: PackageOwnedNormalizedResponse,
  evidenceRefs: z.array(ProfessionalReviewEvidenceRef).max(100).default([]),
  provenance: z.array(ProfessionalReviewProvenance).max(100).default([]),
});
export type A5002PhoneUseContractReviewSubmissionType =
  z.infer<typeof A5002PhoneUseContractReviewSubmission>;
