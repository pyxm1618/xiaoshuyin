import { z } from 'zod';
import { PG_INTEGER_MAX } from './schemas.js';
import { FamilyAllianceTargetCode } from './family-alliance-schemas.js';

/**
 * Slice 15 A5001 only.
 *
 * This is a bounded Scene-local Family Alliance effect-evaluation contract.
 * It is intentionally not a generic Review schema and contains no A5002
 * Contract-review fields.
 */
export const A5001ArtifactDiscriminator =
  z.literal('DIGITAL_USE_A5001_EFFECT_EVALUATION');

export const A5001ReviewUnresolvedState = z.enum([
  'UNKNOWN',
  'NOT_COLLECTED',
  'DECLINED',
]);

export const A5001ReviewDimension = z.union([
  z.strictObject({
    state: z.literal('KNOWN'),
    note: z.string().trim().min(1).max(4000),
  }),
  z.strictObject({ state: A5001ReviewUnresolvedState }),
]);
export type A5001ReviewDimensionType = z.infer<typeof A5001ReviewDimension>;

export const A5001FamilyDimensions = z.strictObject({
  emotionalSupport: A5001ReviewDimension,
  childVoiceNegotiation: A5001ReviewDimension,
  trust: A5001ReviewDimension,
  coordination: A5001ReviewDimension,
  parentStability: A5001ReviewDimension,
  parentPromiseConsistency: A5001ReviewDimension,
});

export const A5001TargetDimensions = z.strictObject({
  attempted: A5001ReviewDimension,
  partialOrNotAttempted: A5001ReviewDimension,
  barriers: A5001ReviewDimension,
  help: A5001ReviewDimension,
  change: A5001ReviewDimension,
  adverseChange: A5001ReviewDimension,
  uncertainty: A5001ReviewDimension,
});

export const A5001EvidenceRef = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('DIALOGUE_MESSAGE'), id: z.string().uuid() }),
  z.strictObject({ type: z.literal('ASSERTION'), id: z.string().uuid() }),
  z.strictObject({ type: z.literal('OBSERVATION'), id: z.string().uuid() }),
]);

export const A5001TargetEvaluation = z.strictObject({
  targetCode: FamilyAllianceTargetCode,
  expectedTargetRevision: z.number().int().min(1).max(PG_INTEGER_MAX),
  dimensions: A5001TargetDimensions,
});

export const A5001FamilyAllianceReviewResponse = z.strictObject({
  kind: z.literal('FAMILY_ALLIANCE_REVIEW'),
  familyDimensions: A5001FamilyDimensions,
  targetEvaluations: z.array(A5001TargetEvaluation)
    .max(10)
    .refine(
      (values) => new Set(values.map((value) => value.targetCode)).size === values.length,
      { message: 'target evaluations must be unique by targetCode' }
    ),
  evidenceRefs: z.array(A5001EvidenceRef).max(100).default([]),
});
export type A5001FamilyAllianceReviewResponseType =
  z.infer<typeof A5001FamilyAllianceReviewResponse>;

export const A5001_FAMILY_DIMENSION_KEYS = [
  'emotionalSupport',
  'childVoiceNegotiation',
  'trust',
  'coordination',
  'parentStability',
  'parentPromiseConsistency',
] as const;

export const A5001_TARGET_DIMENSION_KEYS = [
  'attempted',
  'partialOrNotAttempted',
  'barriers',
  'help',
  'change',
  'adverseChange',
  'uncertainty',
] as const;
