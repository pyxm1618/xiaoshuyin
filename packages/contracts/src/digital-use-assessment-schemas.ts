import { z } from 'zod';
import { FamilyAllianceReachableNode, FamilyAllianceTargetItemProjection } from './family-alliance-schemas.js';
import {
  PG_INTEGER_MAX,
  CurrentFamilyAmbiguousError,
  CurrentFamilyNotFoundError,
  InternalError,
  UnauthenticatedError,
  ValidationError,
} from './schemas.js';

export const SceneNodeStatus = z.enum([
  'LOCKED', 'AVAILABLE', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED', 'BLOCKED',
]);
export type SceneNodeStatusType = z.infer<typeof SceneNodeStatus>;

export const SceneRef = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('DIALOGUE_MESSAGE'), id: z.string().uuid() }),
  z.strictObject({ type: z.literal('ASSERTION'), id: z.string().uuid() }),
  z.strictObject({ type: z.literal('OBSERVATION'), id: z.string().uuid() }),
  z.strictObject({ type: z.literal('CONSENT'), id: z.string().uuid() }),
  z.strictObject({ type: z.literal('SCENE_ARTIFACT'), id: z.string().uuid() }),
  z.strictObject({ type: z.literal('TARGET_ITEM'), id: z.string().uuid() }),
  z.strictObject({
    type: z.literal('RECORD_MARKER'),
    markerCode: z.literal('A200401'),
    evidenceRefs: z.array(z.discriminatedUnion('type', [
      z.strictObject({ type: z.literal('DIALOGUE_MESSAGE'), id: z.string().uuid() }),
      z.strictObject({ type: z.literal('ASSERTION'), id: z.string().uuid() }),
      z.strictObject({ type: z.literal('OBSERVATION'), id: z.string().uuid() }),
    ])).min(1),
  }),
]);
export type SceneRefType = z.infer<typeof SceneRef>;

export const SceneArtifact = z.strictObject({
  id: z.string().uuid(),
  type: z.enum([
    'SUPPLEMENTAL_ASSESSMENT_BOUNDARY', 'TIMELINE', 'SOLUTION_SUMMARY', 'FAMILY_ALLIANCE_SELF_ASSESSMENT',
    'PHONE_USE_CONTRACT_QUIZ_ATTEMPT', 'PHONE_USE_ROLEPLAY_SELECTION', 'PHONE_USE_CONTRACT_TOOL_SELECTION',
    'PHONE_USE_DURATION_COMPONENT', 'PHONE_USE_SUPERVISION_COMPONENT', 'PHONE_USE_SUPERVISION_LOG',
    'PHONE_USE_INCENTIVE_COMPONENT', 'PHONE_USE_BREACH_COMPONENT',
    'PARENT_SELF_REGULATION_CHECKLIST', 'PHONE_USE_CONTRACT_DOCUMENT',
    'PHONE_USE_CONTRACT_SUPPORT_LOG', 'DIGITAL_USE_A5001_EFFECT_EVALUATION',
    'DIGITAL_USE_A5002_EFFECT_EVALUATION',
  ]),
  schemaVersion: z.string().min(1).max(64),
  sourceNodeCode: z.enum([
    '01000', 'A2007', 'A2010', 'A3000',
    'A4001', 'A4003', 'A4004', 'A4005', 'A4006', 'A4007', 'A4008', 'A4009', 'A4010', 'A4011', 'A4012',
    'A5001', 'A5002',
  ]),
  revision: z.number().int().min(1).max(PG_INTEGER_MAX),
  data: z.record(z.string(), z.unknown()),
  sourceRefs: z.array(SceneRef),
  createdAt: z.string().datetime(),
});
export type SceneArtifactType = z.infer<typeof SceneArtifact>;

export const SceneNodeProjection = z.strictObject({
  nodeCode: z.string().min(1).max(64),
  sourceNodeCode: z.string().min(1).max(64),
  status: SceneNodeStatus,
  revision: z.number().int().min(1).max(PG_INTEGER_MAX),
  branchReasonCodes: z.array(z.string()),
  inputRefs: z.array(SceneRef),
  outputRefs: z.array(SceneRef),
  enteredAt: z.string().datetime(),
  completedAt: z.string().datetime().nullable(),
});
export type SceneNodeProjectionType = z.infer<typeof SceneNodeProjection>;

export const DownstreamAvailability = z.strictObject({
  routeIntent: z.string().nullable(),
  available: z.boolean(),
  reasonCode: z.string().nullable(),
});

export const DigitalUseRecoveryMissingRequirement = z.strictObject({
  nodeCode: z.enum(['A1001', '01002', '01003']),
  evidenceCode: z.string().min(1).max(128),
  evidenceFamily: z.enum([
    'EMOTION',
    'FAMILY_RELATIONSHIP',
    'SLEEP',
    'STUDY_OR_NECESSARY_AFFAIRS',
    'REAL_WORLD_ACTIVITY_DISPLACEMENT',
    'OTHER_APPROVED',
  ]),
  missingState: z.enum([
    'NO_RECORD',
    'UNKNOWN',
    'NOT_COLLECTED',
    'DECLINED',
    'NOT_APPLICABLE',
  ]),
  reasonCode: z.string().min(1),
});
export type DigitalUseRecoveryMissingRequirementType =
  z.infer<typeof DigitalUseRecoveryMissingRequirement>;

export const DigitalUseRecovery = z.strictObject({
  reasonCode: z.string().min(1),
  missingRequirements: z.array(DigitalUseRecoveryMissingRequirement).min(1),
  correctionTargetNodeCode: z.enum(['A1001', '01002', '01003']),
});
export type DigitalUseRecoveryType = z.infer<typeof DigitalUseRecovery>;

export const DigitalUseSceneResponse = z.strictObject({
  targetPersonId: z.string().uuid(),
  caseId: z.string().uuid(),
  caseVersion: z.number().int().min(1).max(PG_INTEGER_MAX),
  sceneCode: z.literal('DIGITAL_USE'),
  scenePackageVersion: z.literal('v1'),
  currentNode: SceneNodeProjection.nullable(),
  activeNodes: z.array(SceneNodeProjection),
  reachableNodes: z.array(FamilyAllianceReachableNode),
  nodes: z.array(SceneNodeProjection),
  artifacts: z.array(SceneArtifact),
  targetSelectionRevision: z.number().int().min(0).max(PG_INTEGER_MAX),
  targets: z.array(FamilyAllianceTargetItemProjection),
  routeReasonCode: z.string().nullable(),
  recovery: DigitalUseRecovery.nullable(),
  downstream: DownstreamAvailability,
});
export type DigitalUseSceneResponseType = z.infer<typeof DigitalUseSceneResponse>;

export const DigitalUseNodeResponse = z.strictObject({
  targetPersonId: z.string().uuid(),
  caseId: z.string().uuid(),
  caseVersion: z.number().int().min(1).max(PG_INTEGER_MAX),
  sceneCode: z.literal('DIGITAL_USE'),
  scenePackageVersion: z.literal('v1'),
  node: SceneNodeProjection,
  activeNodes: z.array(SceneNodeProjection),
  reachableNodes: z.array(FamilyAllianceReachableNode),
  artifacts: z.array(SceneArtifact),
  targetSelectionRevision: z.number().int().min(0).max(PG_INTEGER_MAX),
  targets: z.array(FamilyAllianceTargetItemProjection),
  routeReasonCode: z.string().nullable(),
  recovery: DigitalUseRecovery.nullable(),
  downstream: DownstreamAvailability,
});
export type DigitalUseNodeResponseType = z.infer<typeof DigitalUseNodeResponse>;

export const StartDigitalUseAssessmentRequest = z.strictObject({
  targetPersonId: z.string().uuid(),
  expectedCaseVersion: z.number().int().min(1).max(PG_INTEGER_MAX),
});
export type StartDigitalUseAssessmentRequestType =
  z.infer<typeof StartDigitalUseAssessmentRequest>;

export const StartDigitalUseAssessmentResponse = DigitalUseSceneResponse;
export type StartDigitalUseAssessmentResponseType =
  z.infer<typeof StartDigitalUseAssessmentResponse>;

export const CompleteDigitalUseNodeRequest = z.strictObject({
  targetPersonId: z.string().uuid(),
  expectedCaseVersion: z.number().int().min(1).max(PG_INTEGER_MAX),
  expectedNodeRevision: z.number().int().min(0).max(PG_INTEGER_MAX),
  expectedScenePackageVersion: z.literal('v1').optional(),
  expectedSelectionRevision: z.number().int().min(0).max(PG_INTEGER_MAX).optional(),
  expectedTargetRevision: z.number().int().min(1).max(PG_INTEGER_MAX).optional(),
  response: z.record(z.string(), z.unknown()),
});
export type CompleteDigitalUseNodeRequestType =
  z.infer<typeof CompleteDigitalUseNodeRequest>;

export const CompleteDigitalUseNodeResponse = DigitalUseSceneResponse;
export type CompleteDigitalUseNodeResponseType =
  z.infer<typeof CompleteDigitalUseNodeResponse>;

export const SceneNodePathParams = z.strictObject({
  id: z.string().uuid(),
  nodeCode: z.string().min(1).max(64),
});
export const CasePathParams = z.strictObject({ id: z.string().uuid() });

export const SceneRuntimeError = z.strictObject({
  code: z.enum([
    'CASE_NOT_FOUND',
    'CASE_NOT_PRIMARY',
    'CASE_PHASE_CONFLICT',
    'CASE_NOT_OPEN',
    'STALE_CASE_VERSION',
    'SAFETY_HOLD_BLOCKED',
    'SCENE_NODE_NOT_FOUND',
    'SCENE_NODE_UNREACHABLE',
    'SCENE_PACKAGE_MISMATCH',
    'STALE_SCENE_PACKAGE',
    'STALE_NODE_REVISION',
    'STALE_SELECTION_REVISION',
    'STALE_TARGET_REVISION',
    'TARGET_SELECTION_INVALID',
    'TARGET_CODE_INVALID',
    'TARGET_NOT_SELECTED',
    'TARGET_SCOPE_INVALID',
    'TARGET_SELECTION_STATE_INVALID',
    'FAMILY_ALLIANCE_ENTRY_BLOCKED',
    'PROBLEM_FORMULATION_REQUIRED',
    'CONSENT_BLOCKED',
    'DEPENDENCY_UNAVAILABLE',
    'SCENE_RESPONSE_INVALID',
    'SCENE_ROUTE_BLOCKED',
    'SCENE_ROUTE_UNRESOLVED',
    'IDEMPOTENCY_PAYLOAD_MISMATCH',
    'INTEGRATED_TRIAGE_INSUFFICIENT',
    'INTEGRATED_TRIAGE_BLOCKED',
    'SUPPLEMENTAL_ASSESSMENT_CONSENT_REQUIRED',
    'SUPPLEMENTAL_ASSESSMENT_CONSENT_DECLINED',
    'APPROVED_INSTRUMENT_UNAVAILABLE',
    'DOWNSTREAM_RUNTIME_UNAVAILABLE',
    'COMPLIANCE_BLOCKED',
    'PHONE_USE_CONTRACT_NOT_FOUND',
    'PHONE_USE_CONTRACT_STALE_REVISION',
    'PHONE_USE_CONTRACT_CONSENT_BLOCKED',
    'DOWNSTREAM_AI_UNAVAILABLE',
    'PHONE_USE_FOLLOWUP_DOWNSTREAM_UNAVAILABLE',
    'VALIDATION_ERROR',
    'INTERNAL_ERROR',
  ]),
  message: z.string(),
});


export const DigitalUseApiError = z.union([
  UnauthenticatedError,
  CurrentFamilyNotFoundError,
  CurrentFamilyAmbiguousError,
  ValidationError,
  InternalError,
  SceneRuntimeError,
]);
export type DigitalUseApiErrorType = z.infer<typeof DigitalUseApiError>;
