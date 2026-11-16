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

export const FamilyAllianceNarrativeDimension = z.union([
  z.strictObject({
    state: z.literal('KNOWN'),
    text: z.string().trim().min(1).max(4000),
  }),
  z.strictObject({ state: UnresolvedFamilyAllianceValueState }),
]);

/**
 * Authority preserves two feasibility rows rather than collapsing them:
 * problem behaviour is a narrative child-perspective record; replacement
 * behaviour is the concrete/quantified target plus four 1–10 user ratings.
 */
export const FamilyAllianceFeasibilityPayload = z.strictObject({
  problemBehavior: z.strictObject({
    concreteBehavior: FamilyAllianceNarrativeDimension,
    need: FamilyAllianceNarrativeDimension,
    motivationBenefit: FamilyAllianceNarrativeDimension,
    abilityConditions: FamilyAllianceNarrativeDimension,
    challengeResistance: FamilyAllianceNarrativeDimension,
  }),
  replacementBehavior: z.strictObject({
    concreteQuantified: FamilyAllianceConcreteDimension,
    need: FamilyAllianceRatingDimension,
    motivationBenefit: FamilyAllianceRatingDimension,
    abilityPossibility: FamilyAllianceRatingDimension,
    challengeResistance: FamilyAllianceRatingDimension,
  }),
});
export type FamilyAllianceFeasibilityPayloadType =
  z.infer<typeof FamilyAllianceFeasibilityPayload>;

const FamilyAllianceProgressMatrixRow = z.strictObject({
  needMatch: FamilyAllianceNarrativeDimension,
  motivationMatch: FamilyAllianceNarrativeDimension,
  abilityMatch: FamilyAllianceNarrativeDimension,
  challengeResistance: FamilyAllianceNarrativeDimension,
});

const FamilyAllianceModifyTarget = z.enum(['YES', 'NO', 'NOT_DECIDED']);

export const FamilyAllianceGeneralProgressPayload = z.strictObject({
  kind: z.literal('GENERAL_MATRIX'),
  taskPlan: FamilyAllianceNarrativeDimension,
  communication: FamilyAllianceProgressMatrixRow,
  childFeedback: FamilyAllianceProgressMatrixRow,
  userObservation: FamilyAllianceProgressMatrixRow,
  otherFamilyFeedback: FamilyAllianceProgressMatrixRow,
  modifyTarget: FamilyAllianceModifyTarget,
});

const FamilyAllianceCountRecord = z.union([
  z.strictObject({ state: z.literal('KNOWN'), count: z.number().int().min(0).max(PG_INTEGER_MAX) }),
  z.strictObject({ state: UnresolvedFamilyAllianceValueState }),
]);
const FamilyAllianceThreeObservationRecord = z.union([
  z.strictObject({
    state: z.literal('KNOWN'),
    observations: z.array(z.string().trim().min(1).max(1000)).length(3),
  }),
  z.strictObject({ state: UnresolvedFamilyAllianceValueState }),
]);
const FamilyAllianceJournalRecord = z.union([
  z.strictObject({ state: z.literal('KNOWN'), text: z.string().trim().min(1).max(8000) }),
  z.strictObject({ state: UnresolvedFamilyAllianceValueState }),
]);
const FamilyAllianceSelfCareRecord = z.union([
  z.strictObject({
    state: z.literal('KNOWN'),
    durationMinutes: z.number().int().min(0).max(1440),
    activities: z.array(z.string().trim().min(1).max(1000)).min(1).max(32),
  }),
  z.strictObject({ state: UnresolvedFamilyAllianceValueState }),
]);

export const FamilyAllianceEmotionRegulation1ProgressPayload = z.strictObject({
  kind: z.literal('EMOTION_REGULATION_1'),
  listening: FamilyAllianceCountRecord,
  affirmation: FamilyAllianceThreeObservationRecord,
  reducedEvaluation: FamilyAllianceCountRecord,
  selfRegulationJournal: FamilyAllianceJournalRecord,
  selfCare: FamilyAllianceSelfCareRecord,
  effectEvaluation: z.strictObject({
    intrinsicMotivation: FamilyAllianceNarrativeDimension,
    selfEsteemConfidence: FamilyAllianceNarrativeDimension,
    abilityPotential: FamilyAllianceNarrativeDimension,
  }),
  modifyTarget: FamilyAllianceModifyTarget,
});

export const FamilyAllianceEmotionRegulation2ProgressPayload = z.strictObject({
  kind: z.literal('EMOTION_REGULATION_2_LOG'),
  entries: z.array(z.strictObject({
    time: z.string().trim().min(1).max(200),
    childEmotion: FamilyAllianceNarrativeDimension,
    emotionFeedback: FamilyAllianceNarrativeDimension,
    childStress: FamilyAllianceNarrativeDimension,
    selfGrowth: FamilyAllianceNarrativeDimension,
  })).min(1).max(64),
  modifyTarget: FamilyAllianceModifyTarget,
});

export const FamilyAllianceProgressPayload = z.discriminatedUnion('kind', [
  FamilyAllianceGeneralProgressPayload,
  FamilyAllianceEmotionRegulation1ProgressPayload,
  FamilyAllianceEmotionRegulation2ProgressPayload,
]);
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

export const FamilyAllianceContentRef = z.strictObject({
  nodeCode: z.string().min(1).max(64),
  contentVersion: z.string().min(1).max(128),
  authorityDocument: z.literal('Docs/V1产品需求.md'),
  authorityDocumentVersion: z.literal('v3.9'),
  sourceBlob: z.string().regex(/^[0-9a-f]{40}$/),
  sectionHeading: z.string().min(1).max(200),
});

export const FamilyAllianceHelpHistoryEntry = z.strictObject({
  nodeCode: z.string().min(1).max(64),
  scenePackageVersion: z.literal('v1'),
  contentRef: FamilyAllianceContentRef.optional(),
  interactionRefs: z.array(z.string().min(1).max(160)),
  helpOrReentryRefs: z.array(z.string().min(1).max(160)),
  authorityRefs: z.array(z.string().min(1).max(160)),
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
