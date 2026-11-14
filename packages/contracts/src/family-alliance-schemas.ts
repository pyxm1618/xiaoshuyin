import { z } from 'zod';
import { PG_INTEGER_MAX } from './schemas.js';

export const FamilyAllianceTargetCode = z.enum([
  'SLEEP',
  'EXERCISE',
  'HOBBIES',
  'CHORES',
  'FAMILY_GATHERING',
  'OUTDOOR_ACTIVITY',
  'EMOTION_REGULATION_1',
  'TIME_MANAGEMENT',
  'FAMILY_RELATIONSHIP',
  'EMOTION_REGULATION_2',
]);
export type FamilyAllianceTargetCodeType = z.infer<typeof FamilyAllianceTargetCode>;

export const FamilyAllianceValueState = z.enum([
  'KNOWN',
  'UNKNOWN',
  'NOT_COLLECTED',
  'DECLINED',
  'CONFLICT',
  'NOT_APPLICABLE',
]);

const UnresolvedFamilyAllianceValueState = z.enum([
  'UNKNOWN',
  'NOT_COLLECTED',
  'DECLINED',
  'CONFLICT',
  'NOT_APPLICABLE',
]);

export const FamilyAllianceRatingDimension = z.union([
  z.strictObject({
    state: z.literal('KNOWN'),
    rating: z.number().int().min(1).max(10),
  }),
  z.strictObject({ state: UnresolvedFamilyAllianceValueState }),
]);

export const FamilyAllianceConcreteDimension = z.union([
  z.strictObject({
    state: z.literal('KNOWN'),
    concreteTargetText: z.string().trim().min(1).max(2000),
  }),
  z.strictObject({ state: UnresolvedFamilyAllianceValueState }),
]);

export const FamilyAllianceFeasibilityPayload = z.strictObject({
  concreteQuantified: FamilyAllianceConcreteDimension,
  need: FamilyAllianceRatingDimension,
  motivationBenefit: FamilyAllianceRatingDimension,
  abilityPossibility: FamilyAllianceRatingDimension,
  challengeResistance: FamilyAllianceRatingDimension,
});
export type FamilyAllianceFeasibilityPayloadType =
  z.infer<typeof FamilyAllianceFeasibilityPayload>;

export const FamilyAllianceProgressPayload = z.strictObject({
  stage: z.enum(['COMMUNICATION', 'EXECUTION', 'OBSERVATION', 'ADJUSTMENT']),
  state: FamilyAllianceValueState,
  modifyTarget: z.enum(['YES', 'NO', 'NOT_DECIDED']).optional(),
});
export type FamilyAllianceProgressPayloadType =
  z.infer<typeof FamilyAllianceProgressPayload>;

export const FamilyAllianceBinaryAnswer = z.enum([
  'YES',
  'NO',
  'UNKNOWN',
  'NOT_COLLECTED',
  'DECLINED',
]);

export const FamilyAllianceSelfAssessmentResponse = z.strictObject({
  kind: z.literal('SELF_ASSESSMENT'),
  answers: z.strictObject({
    emotionAttention: FamilyAllianceBinaryAnswer,
    negotiatedAgreement: FamilyAllianceBinaryAnswer,
    trustsAgreement: FamilyAllianceBinaryAnswer,
    familyCoordination: FamilyAllianceBinaryAnswer,
    parentEmotionFluctuation: FamilyAllianceBinaryAnswer,
    keepsPromises: FamilyAllianceBinaryAnswer,
  }),
});

export const FamilyAllianceCommunicationPrepResponse = z.strictObject({
  kind: z.literal('COMMUNICATION_PREP'),
  action: z.literal('ACKNOWLEDGED'),
});

export const FamilyAllianceTargetSelectionResponse = z.strictObject({
  kind: z.literal('TARGET_SELECTION'),
  confirmed: z.literal(true),
  selectedTargets: z.array(FamilyAllianceTargetCode)
    .max(10)
    .refine((values) => new Set(values).size === values.length),
});

export const FamilyAllianceTargetDefinitionResponse = z.strictObject({
  kind: z.literal('TARGET_DEFINITION'),
  concreteTargetText: z.string().trim().min(1).max(2000),
});

export const FamilyAllianceFeasibilityResponse = z.strictObject({
  kind: z.literal('FEASIBILITY'),
  feasibility: FamilyAllianceFeasibilityPayload,
});

export const FamilyAllianceProgressResponse = z.strictObject({
  kind: z.literal('PROGRESS'),
  progress: FamilyAllianceProgressPayload,
  note: z.string().trim().min(1).max(4000).optional(),
});

export const FamilyAllianceHelpResponse = z.strictObject({
  kind: z.literal('HELP'),
  action: z.literal('VIEWED'),
  note: z.string().trim().min(1).max(4000).optional(),
});

export const FamilyAllianceNodeResponsePayload = z.discriminatedUnion('kind', [
  FamilyAllianceSelfAssessmentResponse,
  FamilyAllianceCommunicationPrepResponse,
  FamilyAllianceTargetSelectionResponse,
  FamilyAllianceTargetDefinitionResponse,
  FamilyAllianceFeasibilityResponse,
  FamilyAllianceProgressResponse,
  FamilyAllianceHelpResponse,
]);
export type FamilyAllianceNodeResponsePayloadType =
  z.infer<typeof FamilyAllianceNodeResponsePayload>;

export const FamilyAllianceHelpHistoryEntry = z.strictObject({
  nodeCode: z.string().min(1).max(64),
  scenePackageVersion: z.literal('v1'),
  interactionRefs: z.array(z.string().min(1).max(160)),
  helpOrReentryRefs: z.array(z.string().min(1).max(160)),
  evidenceRefs: z.array(
    z.object({ type: z.string(), id: z.string().uuid() }).passthrough()
  ),
});

export const FamilyAllianceTargetItemProjection = z.strictObject({
  id: z.string().uuid(),
  targetCode: FamilyAllianceTargetCode,
  selectionRevision: z.number().int().min(1).max(PG_INTEGER_MAX),
  revision: z.number().int().min(1).max(PG_INTEGER_MAX),
  selected: z.boolean(),
  concreteTargetText: z.string().nullable(),
  feasibility: FamilyAllianceFeasibilityPayload.nullable(),
  progress: FamilyAllianceProgressPayload.nullable(),
  progressEvidenceRefs: z.array(z.object({ type: z.string(), id: z.string().uuid() }).passthrough()),
  helpHistoryRefs: z.array(FamilyAllianceHelpHistoryEntry),
  sourceRefs: z.array(z.object({ type: z.string() }).passthrough()),
  createdAt: z.string().datetime(),
});
export type FamilyAllianceTargetItemProjectionType =
  z.infer<typeof FamilyAllianceTargetItemProjection>;

export const FamilyAllianceReachableNode = z.strictObject({
  nodeCode: z.string().min(1).max(64),
  sourceNodeCode: z.string().min(1).max(64),
  entryModes: z.array(z.enum(['ROUTED', 'USER_INITIATED', 'SCHEDULED'])),
  interactionRefs: z.array(z.string().min(1).max(160)),
  outputRefs: z.array(z.string().min(1).max(160)),
  helpOrReentryRefs: z.array(z.string().min(1).max(160)),
  reasonCode: z.string().min(1).max(160),
});
export type FamilyAllianceReachableNodeType =
  z.infer<typeof FamilyAllianceReachableNode>;
