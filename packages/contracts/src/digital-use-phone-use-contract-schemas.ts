import { z } from 'zod';
import { PG_INTEGER_MAX } from './schemas.js';
import { SceneRef } from './digital-use-assessment-schemas.js';

export const PhoneUseContractStatus=z.enum(['DRAFT','PENDING_CONFIRMATION','ACTIVE','SUPERSEDED','PAUSED']);
export const ContractTermValue=z.discriminatedUnion('state',[
 z.strictObject({state:z.literal('VALUE'),value:z.string().trim().min(1).max(8000)}),
 z.strictObject({state:z.literal('NOT_APPLICABLE'),reason:z.string().trim().min(1).max(2000)}),
 z.strictObject({state:z.literal('PENDING')}),
]);
export type ContractTermValueType=z.infer<typeof ContractTermValue>;
export const PhoneUseContractTerms=z.strictObject({
 purpose:ContractTermValue,phoneUseRules:ContractTermValue,executionPeriod:ContractTermValue,
 parentSupportMeasures:ContractTermValue,supervisionMeasures:ContractTermValue,incentives:ContractTermValue,breachResponsibilities:ContractTermValue,
});
export type PhoneUseContractTermsType=z.infer<typeof PhoneUseContractTerms>;
export const PhoneUseContractConfirmation=z.strictObject({
 kind:z.enum(['ADULT','CHILD']),accountId:z.string().uuid(),personId:z.string().uuid(),
 draftRevision:z.number().int().min(1).max(PG_INTEGER_MAX),confirmedAt:z.string().datetime(),
 authorizationAction:z.string().min(1).max(120),participationId:z.string().uuid().optional(),
});
export const PhoneUseContractDto=z.strictObject({
 id:z.string().uuid(),familyId:z.string().uuid(),caseId:z.string().uuid(),
 version:z.number().int().min(1).max(PG_INTEGER_MAX),draftRevision:z.number().int().min(1).max(PG_INTEGER_MAX),status:PhoneUseContractStatus,
 adultPartyPersonId:z.string().uuid(),childPartyPersonId:z.string().uuid(),childParticipationId:z.string().uuid(),
 terms:PhoneUseContractTerms,sourceTemplateVersion:z.string().min(1).max(128),dependencyRefs:z.array(SceneRef),
 parentConfirmation:PhoneUseContractConfirmation.nullable(),childConfirmation:PhoneUseContractConfirmation.nullable(),
 supersedesId:z.string().uuid().nullable(),updateReason:z.string().nullable(),updateTrigger:z.enum(['PERIOD_COMPLETE','NEW_PROBLEM']).nullable(),
 createdByPersonId:z.string().uuid(),createdAt:z.string().datetime(),updatedAt:z.string().datetime(),
 activatedAt:z.string().datetime().nullable(),supersededAt:z.string().datetime().nullable(),pausedAt:z.string().datetime().nullable(),
});
export type PhoneUseContractDtoType=z.infer<typeof PhoneUseContractDto>;
export const SavePhoneUseContractDraftRequest=z.strictObject({
 expectedCaseVersion:z.number().int().min(1).max(PG_INTEGER_MAX),
 adultPartyPersonId:z.string().uuid(),childPartyPersonId:z.string().uuid(),childParticipationId:z.string().uuid(),
 sourceTemplateVersion:z.string().min(1).max(128),dependencyRefs:z.array(SceneRef).max(64),terms:PhoneUseContractTerms,
});
export const UpdatePhoneUseContractDraftRequest=z.strictObject({
 expectedCaseVersion:z.number().int().min(1).max(PG_INTEGER_MAX),expectedDraftRevision:z.number().int().min(1).max(PG_INTEGER_MAX),
 dependencyRefs:z.array(SceneRef).max(64),terms:PhoneUseContractTerms,
});
export const ConfirmPhoneUseContractRequest=z.strictObject({
 expectedCaseVersion:z.number().int().min(1).max(PG_INTEGER_MAX),expectedDraftRevision:z.number().int().min(1).max(PG_INTEGER_MAX),
});
export const RevisePhoneUseContractRequest=z.strictObject({
 expectedCaseVersion:z.number().int().min(1).max(PG_INTEGER_MAX),expectedActiveDraftRevision:z.number().int().min(1).max(PG_INTEGER_MAX),
 updateTrigger:z.enum(['PERIOD_COMPLETE','NEW_PROBLEM']),updateReason:z.string().trim().min(1).max(2000),
});
export const PhoneUseContractVersionPathParams=z.strictObject({id:z.string().uuid(),version:z.coerce.number().int().min(1).max(PG_INTEGER_MAX)});
export const PhoneUseContractContentMeta=z.strictObject({contentVersion:z.string().min(1),sourceBlob:z.string().regex(/^[0-9a-f]{40}$/),approved:z.literal(true)});
export const PhoneUseContractTemplateResponse=z.strictObject({meta:PhoneUseContractContentMeta,sections:z.array(z.string()),sourceText:z.string()});
export const PhoneUseContractExamplesResponse=z.strictObject({meta:PhoneUseContractContentMeta,examples:z.array(z.strictObject({id:z.string(),title:z.string(),sourceText:z.string()})).length(4)});
export const PhoneUseContractFaqResponse=z.strictObject({meta:PhoneUseContractContentMeta,topics:z.array(z.string()).min(1),sourceText:z.string()});
export const CreatePhoneUseRoleplayRequest=z.strictObject({
 expectedCaseVersion:z.number().int().min(1).max(PG_INTEGER_MAX),professionalContentVersion:z.string().min(1).max(128),
});
export const CreatePhoneUseRoleplayTurnRequest=z.strictObject({
 expectedSessionRevision:z.number().int().min(1).max(PG_INTEGER_MAX),simulatedChildInput:z.string().trim().min(1).max(8000),
});
export const RatePhoneUseRoleplayRequest=z.strictObject({turnId:z.string().uuid(),rating:z.number().int().min(1).max(5)});
export const SelectPhoneUseRoleplayRequest=z.strictObject({
 expectedSessionRevision:z.number().int().min(1).max(PG_INTEGER_MAX),turnId:z.string().uuid(),expectedNodeRevision:z.number().int().min(1).max(PG_INTEGER_MAX),
});
export const PhoneUseRoleplaySessionDto=z.strictObject({
 id:z.string().uuid(),familyId:z.string().uuid(),caseId:z.string().uuid(),actorPersonId:z.string().uuid(),
 simulationRole:z.literal('ADULT_PLAYS_CHILD_AI_SIMULATES_PARENT'),status:z.enum(['OPEN','COMPLETED']),
 scenePackageVersion:z.string(),professionalContentVersion:z.string(),compliancePolicyRef:z.string(),adapterRef:z.string(),
 selectedTurnId:z.string().uuid().nullable(),revision:z.number().int().min(1),createdAt:z.string().datetime(),completedAt:z.string().datetime().nullable(),
});
export const PhoneUseRoleplayTurnDto=z.strictObject({
 id:z.string().uuid(),sessionId:z.string().uuid(),roundNumber:z.number().int().min(1),simulatedChildInput:z.string(),simulatedParentOutput:z.string(),
 provenance:z.literal('SIMULATION'),modelRef:z.string().nullable(),promptVersionRef:z.string().nullable(),userRating:z.number().int().min(1).max(5).nullable(),createdAt:z.string().datetime(),
});
export const PhoneUseContractRuntimeError=z.strictObject({code:z.enum([
 'PHONE_USE_CONTRACT_NOT_FOUND','PHONE_USE_CONTRACT_UNAUTHORIZED','PHONE_USE_CONTRACT_INVALID_PAYLOAD','PHONE_USE_CONTRACT_QUIZ_NOT_PASSED',
 'PHONE_USE_CONTRACT_MISSING_CONFIRMATION','PHONE_USE_CONTRACT_INVALID_CONFIRMATION_SOURCE','PHONE_USE_CONTRACT_STALE_REVISION',
 'PHONE_USE_CONTRACT_CONTENT_STALE','PHONE_USE_CONTRACT_ILLEGAL_ENTRY','PHONE_USE_CONTRACT_CONSENT_BLOCKED',
 'PHONE_USE_CONTRACT_COMPLIANCE_BLOCKED','PHONE_USE_CONTRACT_SAFETY_BLOCKED','PHONE_USE_CONTRACT_PACKAGE_DRIFT',
 'PHONE_USE_ROLEPLAY_DOWNSTREAM_UNAVAILABLE','PHONE_USE_FOLLOWUP_DOWNSTREAM_UNAVAILABLE','IDEMPOTENCY_PAYLOAD_MISMATCH','INTERNAL_ERROR'
]),message:z.string()});
