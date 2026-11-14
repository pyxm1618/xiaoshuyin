import { z } from 'zod';
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
    'SUPPLEMENTAL_ASSESSMENT_BOUNDARY', 'TIMELINE', 'SOLUTION_SUMMARY',
    'PHONE_USE_CONTRACT_QUIZ_ATTEMPT', 'PHONE_USE_ROLEPLAY_SELECTION', 'PHONE_USE_CONTRACT_TOOL_SELECTION',
    'PHONE_USE_DURATION_COMPONENT', 'PHONE_USE_SUPERVISION_COMPONENT', 'PHONE_USE_SUPERVISION_LOG',
    'PHONE_USE_INCENTIVE_COMPONENT', 'PHONE_USE_BREACH_COMPONENT',
    'PARENT_SELF_REGULATION_CHECKLIST', 'PHONE_USE_CONTRACT_DOCUMENT',
    'PHONE_USE_CONTRACT_SUPPORT_LOG',
  ]),
  schemaVersion: z.string().min(1).max(64),
  sourceNodeCode: z.enum([
    '01000', 'A2007', 'A2010',
    'A4001', 'A4003', 'A4004', 'A4005', 'A4006', 'A4007', 'A4008', 'A4009', 'A4010', 'A4011', 'A4012',
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

export const DigitalUseSceneResponse = z.strictObject({
  caseId: z.string().uuid(),
  caseVersion: z.number().int().min(1).max(PG_INTEGER_MAX),
  sceneCode: z.literal('DIGITAL_USE'),
  scenePackageVersion: z.literal('v1'),
  currentNode: SceneNodeProjection.nullable(),
  nodes: z.array(SceneNodeProjection),
  artifacts: z.array(SceneArtifact),
  routeReasonCode: z.string().nullable(),
  downstream: DownstreamAvailability,
});
export type DigitalUseSceneResponseType = z.infer<typeof DigitalUseSceneResponse>;

export const DigitalUseNodeResponse = z.strictObject({
  caseId: z.string().uuid(),
  caseVersion: z.number().int().min(1).max(PG_INTEGER_MAX),
  sceneCode: z.literal('DIGITAL_USE'),
  scenePackageVersion: z.literal('v1'),
  node: SceneNodeProjection,
  artifacts: z.array(SceneArtifact),
  routeReasonCode: z.string().nullable(),
  downstream: DownstreamAvailability,
});
export type DigitalUseNodeResponseType = z.infer<typeof DigitalUseNodeResponse>;

export const StartDigitalUseAssessmentRequest = z.strictObject({
  expectedCaseVersion: z.number().int().min(1).max(PG_INTEGER_MAX),
});
export type StartDigitalUseAssessmentRequestType =
  z.infer<typeof StartDigitalUseAssessmentRequest>;

export const StartDigitalUseAssessmentResponse = DigitalUseSceneResponse;
export type StartDigitalUseAssessmentResponseType =
  z.infer<typeof StartDigitalUseAssessmentResponse>;

export const CompleteDigitalUseNodeRequest = z.strictObject({
  expectedCaseVersion: z.number().int().min(1).max(PG_INTEGER_MAX),
  expectedNodeRevision: z.number().int().min(1).max(PG_INTEGER_MAX),
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
