/**
 * Generated OpenAPI document (F5).
 *
 * The frozen YAML
 * `specs/001-family-identity-core/contracts/identity-family-api.openapi.yaml`
 * is the Source of Truth. This module builds the generated JSON from the SAME
 * Zod schemas the routes use, so `openapi:check` can prove semantic
 * equivalence without hand-editing the generated artifact.
 */

import { z } from 'zod';
import {
  AgeBand,
  WritableSource,
  ProfileAttribute,
  ProvenanceValueInput,
  ProfileValue,
  ComplianceProfileSummary,
  PersonSummary,
  LoginResponse,
  MeResponse,
  CreatorInput,
  CreateFamilyRequest,
  FamilyResponse,
  CreateMemberRequest,
  UpdateMemberRequest,
  MemberResponse,
  CreateConsentRequestRequest,
  ConsentRequestResponse,
  GrantConsentRequest,
  ConsentRecord,
  ComplianceProfile,
  Notice,
  ErrorSchema,
  CreateCaseRequest,
  CaseResponse,
  CaseListResponse,
  CaseStatus,
  CasePhase,

  BindingBootstrapRequest,
  BindingCandidateDecisionRequest,
  BindingConfirmerDecisionRequest,
  BindingBootstrapGenericResponse,
  BindingBootstrapReusedResponse,
  BindingBootstrapCommittedResponse,
  BindingCandidatePairingResponse,
  BindingGenericResponse,
  BindingStatusResponse,
  BindingSessionCommittedResponse,
  BindingPendingListResponse,
  BindingConfirmerDecisionResponse,
  BindingNotFoundError,
  BindingContextInvalidError,
  CreateCaseMessageRequest,
  CaseMessageResponse,
  SwitchPrimaryCaseRequest,
  SwitchPrimaryCaseResponse,
  UnauthenticatedError,
  IdempotencyPayloadMismatchError,
  ValidationError,
  InternalError,
  CaseParticipationState,
  ParticipationNotice,
  CreateParticipationInviteRequest,
  CreateParticipationInviteResponse,
  ParticipationInvitePublicView,
  AcceptParticipationRequest,
  DeclineParticipationRequest,
  WithdrawParticipationRequest,
  ParticipationResource,
  ParticipationStateConflictError,
  ParticipationAlreadyExistsError,
  ParticipationTargetIneligibleError,
  InvitationNotAvailableError,
  ParticipationNotFoundError,
  ParticipationValidationError,
  DigitalUseSceneResponse,
  DigitalUseNodeResponse,
  DigitalUseApiError,
} from '@xiaoshuyin/contracts';

type JsonSchema = Record<string, unknown>;

function toJsonSchema(schema: z.ZodTypeAny): JsonSchema {
  const json = z.toJSONSchema(schema, {
    io: 'output',
    target: 'draft-2020-12',
    unrepresentable: 'any',
  }) as JsonSchema;
  delete json['$schema'];
  return json;
}

function ref(name: string) {
  return { $ref: `#/components/schemas/${name}` };
}

function paramRef(name: string) {
  return { $ref: `#/components/parameters/${name}` };
}

function jsonBody(schema: JsonSchema) {
  return { required: true, content: { 'application/json': { schema } } };
}

function refBody(name: string) {
  return jsonBody(ref(name));
}

function jsonResponse(description: string, schema: JsonSchema) {
  return { description, content: { 'application/json': { schema } } };
}

function refResponse(description: string, name: string) {
  return jsonResponse(description, ref(name));
}

const idempotencyKeyParam = paramRef('IdempotencyKey');
const familyIdPath = paramRef('FamilyIdPath');
const personIdPath = paramRef('PersonIdPath');
const consentIdPath = {
  name: 'id',
  in: 'path',
  required: true,
  schema: { type: 'string', format: 'uuid' },
};

const errorResponse = (description: string) => refResponse(description, 'Error');

// Case-specific error bodies are structurally fixed to one code (frozen
// cases-api.openapi.yaml §components.schemas).
const CaseAccessDeniedErrorSchema = z.strictObject({
  code: z.enum(['CASE_ACCESS_DENIED']),
  message: z.string(),
});
const CaseNotFoundErrorSchema = z.strictObject({
  code: z.enum(['CASE_NOT_FOUND']),
  message: z.string(),
});
const CurrentFamilyNotFoundErrorSchema = z.strictObject({
  code: z.enum(['CURRENT_FAMILY_NOT_FOUND']),
  message: z.string(),
});
const CurrentFamilyAmbiguousErrorSchema = z.strictObject({
  code: z.enum(['CURRENT_FAMILY_AMBIGUOUS']),
  message: z.string(),
});

export function buildOpenApiDocument() {
  const schemas: Record<string, JsonSchema> = {
    Error: toJsonSchema(ErrorSchema),
    ErrorResponse: toJsonSchema(ErrorSchema),
    AgeBand: toJsonSchema(AgeBand),
    WritableSource: toJsonSchema(WritableSource),
    ProfileAttribute: toJsonSchema(ProfileAttribute),
    ProvenanceValueInput: toJsonSchema(ProvenanceValueInput),
    ProfileValue: toJsonSchema(ProfileValue),
    ComplianceProfileSummary: toJsonSchema(ComplianceProfileSummary),
    PersonSummary: toJsonSchema(PersonSummary),
    LoginResponse: toJsonSchema(LoginResponse),
    MeResponse: toJsonSchema(MeResponse),
    CreatorInput: toJsonSchema(CreatorInput),
    CreateFamilyRequest: toJsonSchema(CreateFamilyRequest),
    FamilyResponse: toJsonSchema(FamilyResponse),
    CreateMemberRequest: toJsonSchema(CreateMemberRequest),
    UpdateMemberRequest: toJsonSchema(UpdateMemberRequest),
    MemberResponse: toJsonSchema(MemberResponse),
    CreateConsentRequestRequest: toJsonSchema(CreateConsentRequestRequest),
    ConsentRequestResponse: toJsonSchema(ConsentRequestResponse),
    GrantConsentRequest: toJsonSchema(GrantConsentRequest),
    ConsentRecord: toJsonSchema(ConsentRecord),
    ComplianceProfile: toJsonSchema(ComplianceProfile),
    Notice: toJsonSchema(Notice),
    CreateCaseRequest: toJsonSchema(CreateCaseRequest),
    CaseResponse: toJsonSchema(CaseResponse),
    CaseListResponse: toJsonSchema(CaseListResponse),
    CaseStatus: toJsonSchema(CaseStatus),
    CasePhase: toJsonSchema(CasePhase),
    CaseAccessDeniedError: toJsonSchema(CaseAccessDeniedErrorSchema),
    CaseNotFoundError: toJsonSchema(CaseNotFoundErrorSchema),
    CreateCaseMessageRequest: toJsonSchema(CreateCaseMessageRequest),
    CaseMessageResponse: toJsonSchema(CaseMessageResponse),
    SwitchPrimaryCaseRequest: toJsonSchema(SwitchPrimaryCaseRequest),
    SwitchPrimaryCaseResponse: toJsonSchema(SwitchPrimaryCaseResponse),
    UnauthenticatedError: toJsonSchema(UnauthenticatedError),
    IdempotencyPayloadMismatchError: toJsonSchema(IdempotencyPayloadMismatchError),
    ValidationError: toJsonSchema(ValidationError),
    InternalError: toJsonSchema(InternalError),
    CurrentFamilyNotFoundError: toJsonSchema(CurrentFamilyNotFoundErrorSchema),
    CurrentFamilyAmbiguousError: toJsonSchema(CurrentFamilyAmbiguousErrorSchema),
    BindingBootstrapRequest: toJsonSchema(BindingBootstrapRequest),
    BindingCandidateDecisionRequest: toJsonSchema(BindingCandidateDecisionRequest),
    BindingConfirmerDecisionRequest: toJsonSchema(BindingConfirmerDecisionRequest),
    BindingBootstrapGenericResponse: toJsonSchema(BindingBootstrapGenericResponse),
    BindingBootstrapReusedResponse: toJsonSchema(BindingBootstrapReusedResponse),
    BindingBootstrapCommittedResponse: toJsonSchema(BindingBootstrapCommittedResponse),
    BindingCandidatePairingResponse: toJsonSchema(BindingCandidatePairingResponse),
    BindingGenericResponse: toJsonSchema(BindingGenericResponse),
    BindingStatusResponse: toJsonSchema(BindingStatusResponse),
    BindingSessionCommittedResponse: toJsonSchema(BindingSessionCommittedResponse),
    BindingPendingListResponse: toJsonSchema(BindingPendingListResponse),
    BindingConfirmerDecisionResponse: toJsonSchema(BindingConfirmerDecisionResponse),
    BindingNotFoundError: toJsonSchema(BindingNotFoundError),
    BindingContextInvalidError: toJsonSchema(BindingContextInvalidError),
    CaseParticipationState: toJsonSchema(CaseParticipationState),
    ParticipationNotice: toJsonSchema(ParticipationNotice),
    CreateParticipationInviteRequest: toJsonSchema(CreateParticipationInviteRequest),
    CreateParticipationInviteResponse: toJsonSchema(CreateParticipationInviteResponse),
    ParticipationInvitePublicView: toJsonSchema(ParticipationInvitePublicView),
    AcceptParticipationRequest: toJsonSchema(AcceptParticipationRequest),
    DeclineParticipationRequest: toJsonSchema(DeclineParticipationRequest),
    WithdrawParticipationRequest: toJsonSchema(WithdrawParticipationRequest),
    ParticipationResource: toJsonSchema(ParticipationResource),
    ParticipationStateConflictError: toJsonSchema(ParticipationStateConflictError),
    ParticipationAlreadyExistsError: toJsonSchema(ParticipationAlreadyExistsError),
    ParticipationTargetIneligibleError: toJsonSchema(ParticipationTargetIneligibleError),
    InvitationNotAvailableError: toJsonSchema(InvitationNotAvailableError),
    ParticipationNotFoundError: toJsonSchema(ParticipationNotFoundError),
  };

  const paths: Record<string, unknown> = {
    '/api/v1/auth/wechat': {
      post: {
        tags: ['auth'],
        operationId: 'loginWithWechat',
        requestBody: jsonBody(
          toJsonSchema(z.strictObject({ code: z.string().min(1).max(512) }))
        ),
        responses: {
          '200': refResponse('登录成功', 'LoginResponse'),
          '401': errorResponse('`UNAUTHENTICATED`'),
          '422': errorResponse('`VALIDATION_ERROR`'),
        },
      },
    },
    '/api/v1/auth/logout': {
      post: {
        tags: ['auth'],
        operationId: 'logout',
        security: [{ bearerAuth: [] }],
        responses: {
          '204': { description: '已登出' },
          '401': errorResponse('`UNAUTHENTICATED`'),
        },
      },
    },
    '/api/v1/me': {
      get: {
        tags: ['identity'],
        operationId: 'getMe',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': refResponse('当前身份', 'MeResponse'),
          '401': errorResponse('`UNAUTHENTICATED`'),
        },
      },
    },
    '/api/v1/families': {
      post: {
        tags: ['family'],
        operationId: 'createFamily',
        security: [{ bearerAuth: [] }],
        parameters: [idempotencyKeyParam],
        requestBody: refBody('CreateFamilyRequest'),
        responses: {
          '201': refResponse('家庭已建立', 'FamilyResponse'),
          '401': errorResponse('`UNAUTHENTICATED`'),
          '403': errorResponse('`FORBIDDEN`'),
          '409': errorResponse('`FAMILY_ALREADY_OWNED` / `IDEMPOTENCY_PAYLOAD_MISMATCH`'),
          '422': errorResponse('`VALIDATION_ERROR`'),
        },
      },
    },
    '/api/v1/families/current': {
      get: {
        tags: ['family'],
        operationId: 'getCurrentFamily',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': refResponse('当前家庭', 'FamilyResponse'),
          '401': errorResponse('`UNAUTHENTICATED`'),
          '403': errorResponse('`FORBIDDEN`'),
          '404': errorResponse('`CURRENT_FAMILY_NOT_FOUND`'),
          '409': errorResponse('`CURRENT_FAMILY_AMBIGUOUS`'),
        },
      },
    },
    '/api/v1/families/{id}/members': {
      post: {
        tags: ['family'],
        operationId: 'createMember',
        security: [{ bearerAuth: [] }],
        parameters: [familyIdPath, idempotencyKeyParam],
        requestBody: refBody('CreateMemberRequest'),
        responses: {
          '201': refResponse('成员已建立', 'MemberResponse'),
          '401': errorResponse('`UNAUTHENTICATED`'),
          '403': errorResponse('`FORBIDDEN`'),
          '409': errorResponse('`MEMBER_ALREADY_EXISTS` / `GUARDIAN_CONSENT_ALREADY_BOUND` / `IDEMPOTENCY_PAYLOAD_MISMATCH`'),
          '422': errorResponse('`VALIDATION_ERROR`'),
        },
      },
    },
    '/api/v1/families/{id}/members/{personId}': {
      patch: {
        tags: ['family'],
        operationId: 'updateMemberProfile',
        security: [{ bearerAuth: [] }],
        parameters: [familyIdPath, personIdPath, idempotencyKeyParam],
        requestBody: refBody('UpdateMemberRequest'),
        responses: {
          '200': refResponse('已更新', 'MemberResponse'),
          '401': errorResponse('`UNAUTHENTICATED`'),
          '403': errorResponse('`FORBIDDEN`'),
          '409': errorResponse('`IDEMPOTENCY_PAYLOAD_MISMATCH`'),
          '422': errorResponse('`VALIDATION_ERROR`'),
        },
      },
    },
    '/api/v1/consents': {
      get: {
        tags: ['consent'],
        operationId: 'listConsents',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': jsonResponse('同意记录', {
            type: 'object',
            required: ['items'],
            properties: { items: { type: 'array', items: ref('ConsentRecord') } },
          }),
          '401': errorResponse('`UNAUTHENTICATED`'),
          '403': errorResponse('`FORBIDDEN`'),
          '409': errorResponse('`CURRENT_FAMILY_AMBIGUOUS`'),
        },
      },
    },
    '/api/v1/consents/{id}/revoke': {
      post: {
        tags: ['consent'],
        operationId: 'revokeConsent',
        security: [{ bearerAuth: [] }],
        parameters: [consentIdPath, idempotencyKeyParam],
        requestBody: {
          required: false,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                additionalProperties: false,
                properties: { reason: { type: 'string', maxLength: 200 } },
              },
            },
          },
        },
        responses: {
          '200': refResponse('已撤回', 'ConsentRecord'),
          '401': errorResponse('`UNAUTHENTICATED`'),
          '403': errorResponse('`FORBIDDEN`'),
          '409': errorResponse('`CURRENT_FAMILY_AMBIGUOUS`'),
          '422': errorResponse('`VALIDATION_ERROR`'),
        },
      },
    },
    '/api/v1/compliance/profile': {
      get: {
        tags: ['compliance'],
        operationId: 'getOwnComplianceProfile',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': refResponse('自己的 profile', 'ComplianceProfile'),
          '401': errorResponse('`UNAUTHENTICATED`'),
          '403': errorResponse('`FORBIDDEN`'),
        },
      },
    },
    '/api/v1/compliance/notices': {
      get: {
        tags: ['compliance'],
        operationId: 'listComplianceNotices',
        responses: {
          '200': jsonResponse('告知目录', {
            type: 'object',
            required: ['notices'],
            properties: { notices: { type: 'array', items: ref('Notice') } },
          }),
        },
      },
    },
    '/api/v1/compliance/guardian-consents/requests': {
      post: {
        tags: ['consent'],
        operationId: 'createGuardianConsentRequest',
        security: [{ bearerAuth: [] }],
        parameters: [idempotencyKeyParam],
        requestBody: refBody('CreateConsentRequestRequest'),
        responses: {
          '201': refResponse('onboarding 已发起', 'ConsentRequestResponse'),
          '401': errorResponse('`UNAUTHENTICATED`'),
          '403': errorResponse('`FORBIDDEN`'),
          '404': errorResponse('`CURRENT_FAMILY_NOT_FOUND`'),
          '409': errorResponse('`CURRENT_FAMILY_AMBIGUOUS`'),
          '422': errorResponse('`VALIDATION_ERROR`'),
        },
      },
    },
    '/api/v1/compliance/guardian-consents': {
      post: {
        tags: ['consent'],
        operationId: 'grantGuardianConsent',
        security: [{ bearerAuth: [] }],
        parameters: [idempotencyKeyParam],
        requestBody: refBody('GrantConsentRequest'),
        responses: {
          '201': refResponse('同意已成立', 'ConsentRecord'),
          '401': errorResponse('`UNAUTHENTICATED`'),
          '403': errorResponse('`FORBIDDEN`'),
          '409': errorResponse('`CURRENT_FAMILY_AMBIGUOUS`'),
          '422': errorResponse('`VALIDATION_ERROR`'),
        },
      },
    },
    '/api/v1/cases': {
      post: {
        tags: ['case'],
        operationId: 'createCase',
        security: [{ bearerAuth: [] }],
        parameters: [paramRef('IdempotencyKeyHeader')],
        requestBody: refBody('CreateCaseRequest'),
        responses: {
          '201': refResponse('Case 已创建（或幂等重放原结果）', 'CaseResponse'),
          '401': errorResponse('`UNAUTHENTICATED`'),
          '403': refResponse('`CASE_ACCESS_DENIED`', 'CaseAccessDeniedError'),
          '404': refResponse('`CURRENT_FAMILY_NOT_FOUND`', 'CurrentFamilyNotFoundError'),
          '409': errorResponse(
            '`CURRENT_FAMILY_AMBIGUOUS`（current Family 无法唯一解析，真实可达） / `IDEMPOTENCY_PAYLOAD_MISMATCH`（共享幂等合同；当前 public HTTP command shape 下不可达）'
          ),
          '422': errorResponse('`VALIDATION_ERROR`'),
          '500': errorResponse('`INTERNAL_ERROR`'),
        },
      },
      get: {
        tags: ['case'],
        operationId: 'listCases',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': refResponse('当前家庭的 Case 集合（可能为空）', 'CaseListResponse'),
          '401': errorResponse('`UNAUTHENTICATED`'),
          '403': refResponse('`CASE_ACCESS_DENIED`', 'CaseAccessDeniedError'),
          '404': refResponse('`CURRENT_FAMILY_NOT_FOUND`', 'CurrentFamilyNotFoundError'),
          '409': errorResponse('`CURRENT_FAMILY_AMBIGUOUS`'),
          '500': errorResponse('`INTERNAL_ERROR`'),
        },
      },
    },
    '/api/v1/cases/{id}/switch-primary': {
      post: {
        tags: ['case'],
        operationId: 'switchPrimaryCase',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
          paramRef('IdempotencyKeyHeader'),
        ],
        requestBody: refBody('SwitchPrimaryCaseRequest'),
        responses: {
          '200': refResponse('主线 Case 已切换', 'SwitchPrimaryCaseResponse'),
          '401': errorResponse('`UNAUTHENTICATED`'),
          '404': jsonResponse('`CURRENT_FAMILY_NOT_FOUND` / `CASE_NOT_FOUND`', {
            oneOf: [ref('CurrentFamilyNotFoundError'), ref('CaseNotFoundError')],
          }),
          '409': errorResponse(
            '`CURRENT_FAMILY_AMBIGUOUS` / `IDEMPOTENCY_PAYLOAD_MISMATCH` / `CASE_ALREADY_PRIMARY` / `CASE_CLOSED` / `SAFETY_HOLD_BLOCKED` / `STALE_PRIMARY_VIEW`'
          ),
          '422': errorResponse('`VALIDATION_ERROR`'),
          '500': errorResponse('`INTERNAL_ERROR`'),
        },
      },
    },
    '/api/v1/cases/{id}/messages': {
      post: {
        tags: ['case'],
        operationId: 'createCaseMessage',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
          paramRef('IdempotencyKeyHeader'),
        ],
        requestBody: refBody('CreateCaseMessageRequest'),
        responses: {
          '201': refResponse('Message recorded', 'CaseMessageResponse'),
          '401': refResponse('`UNAUTHENTICATED`', 'UnauthenticatedError'),
          '404': jsonResponse('`CURRENT_FAMILY_NOT_FOUND` / `CASE_NOT_FOUND`', {
            oneOf: [ref('CurrentFamilyNotFoundError'), ref('CaseNotFoundError')],
          }),
          '409': jsonResponse(
            '`CURRENT_FAMILY_AMBIGUOUS` / `IDEMPOTENCY_PAYLOAD_MISMATCH`',
            {
              oneOf: [
                ref('CurrentFamilyAmbiguousError'),
                ref('IdempotencyPayloadMismatchError'),
              ],
            }
          ),
          '422': refResponse('`VALIDATION_ERROR`', 'ValidationError'),
          '500': refResponse('`INTERNAL_ERROR`', 'InternalError'),
        },
      },
    },
    '/api/v1/cases/{id}': {
      get: {
        tags: ['case'],
        operationId: 'getCase',
        security: [{ bearerAuth: [] }],
        parameters: [paramRef('CaseIdPath')],
        responses: {
          '200': refResponse('Case 详情', 'CaseResponse'),
          '401': errorResponse('`UNAUTHENTICATED`'),
          '404': jsonResponse('`CASE_NOT_FOUND` / `CURRENT_FAMILY_NOT_FOUND`', {
            oneOf: [ref('CaseNotFoundError'), ref('CurrentFamilyNotFoundError')],
          }),
          '409': refResponse('`CURRENT_FAMILY_AMBIGUOUS`', 'CurrentFamilyAmbiguousError'),
          '500': errorResponse('`INTERNAL_ERROR`'),
        },
      },
    },
    // ── Slice 4 Case Participant Core: exactly six surfaces ──
    '/api/v1/cases/{id}/participation-invites': {
      post: {
        tags: ['participation'],
        operationId: 'createParticipationInvite',
        security: [{ bearerAuth: [] }],
        parameters: [paramRef('CaseIdPath')],
        requestBody: refBody('CreateParticipationInviteRequest'),
        responses: {
          '201': refResponse('Participation invitation created', 'CreateParticipationInviteResponse'),
          '401': refResponse('`UNAUTHENTICATED`', 'UnauthenticatedError'),
          '403': refResponse('`PARTICIPATION_TARGET_INELIGIBLE`', 'ParticipationTargetIneligibleError'),
          '404': jsonResponse('`CASE_NOT_FOUND` / `CURRENT_FAMILY_NOT_FOUND`', {
            oneOf: [ref('CaseNotFoundError'), ref('CurrentFamilyNotFoundError')],
          }),
          '409': jsonResponse('Already exists / current-family ambiguity / idempotency mismatch', {
            oneOf: [
              ref('ParticipationAlreadyExistsError'),
              ref('IdempotencyPayloadMismatchError'),
              ref('CurrentFamilyAmbiguousError'),
            ],
          }),
          '422': jsonResponse('`VALIDATION_ERROR`', toJsonSchema(ParticipationValidationError)),
          '500': refResponse('`INTERNAL_ERROR`', 'InternalError'),
        },
      },
    },
    '/api/v1/participation-invites/{token}': {
      get: {
        tags: ['participation'],
        operationId: 'getParticipationInvite',
        parameters: [paramRef('InviteTokenPath')],
        responses: {
          '200': refResponse('Minimal safe invitation view', 'ParticipationInvitePublicView'),
          '404': refResponse('`INVITATION_NOT_AVAILABLE`', 'InvitationNotAvailableError'),
          '500': refResponse('`INTERNAL_ERROR`', 'InternalError'),
        },
      },
    },
    '/api/v1/participation-invites/{token}/accept': {
      post: {
        tags: ['participation'],
        operationId: 'acceptParticipationInvite',
        security: [{ bearerAuth: [] }],
        parameters: [paramRef('InviteTokenPath')],
        requestBody: refBody('AcceptParticipationRequest'),
        responses: {
          '200': refResponse('Participation active or converged', 'ParticipationResource'),
          '401': refResponse('`UNAUTHENTICATED`', 'UnauthenticatedError'),
          '404': refResponse('`PARTICIPATION_NOT_FOUND`', 'ParticipationNotFoundError'),
          '409': jsonResponse('State conflict / idempotency mismatch', {
            oneOf: [ref('ParticipationStateConflictError'), ref('IdempotencyPayloadMismatchError')],
          }),
          '422': jsonResponse('`VALIDATION_ERROR`', toJsonSchema(ParticipationValidationError)),
          '500': refResponse('`INTERNAL_ERROR`', 'InternalError'),
        },
      },
    },
    '/api/v1/participations/{id}/decline': {
      post: {
        tags: ['participation'],
        operationId: 'declineParticipation',
        security: [{ bearerAuth: [] }],
        parameters: [paramRef('ParticipationIdPath')],
        requestBody: refBody('DeclineParticipationRequest'),
        responses: {
          '200': refResponse('Participation declined or converged', 'ParticipationResource'),
          '401': refResponse('`UNAUTHENTICATED`', 'UnauthenticatedError'),
          '404': refResponse('`PARTICIPATION_NOT_FOUND`', 'ParticipationNotFoundError'),
          '409': jsonResponse('State conflict / idempotency mismatch', {
            oneOf: [ref('ParticipationStateConflictError'), ref('IdempotencyPayloadMismatchError')],
          }),
          '422': jsonResponse('`VALIDATION_ERROR`', toJsonSchema(ParticipationValidationError)),
          '500': refResponse('`INTERNAL_ERROR`', 'InternalError'),
        },
      },
    },
    '/api/v1/participations/{id}/withdraw': {
      post: {
        tags: ['participation'],
        operationId: 'withdrawParticipation',
        security: [{ bearerAuth: [] }],
        parameters: [paramRef('ParticipationIdPath')],
        requestBody: refBody('WithdrawParticipationRequest'),
        responses: {
          '200': refResponse('Participation withdrawn or converged', 'ParticipationResource'),
          '401': refResponse('`UNAUTHENTICATED`', 'UnauthenticatedError'),
          '404': refResponse('`PARTICIPATION_NOT_FOUND`', 'ParticipationNotFoundError'),
          '409': jsonResponse('State conflict / idempotency mismatch', {
            oneOf: [ref('ParticipationStateConflictError'), ref('IdempotencyPayloadMismatchError')],
          }),
          '422': jsonResponse('`VALIDATION_ERROR`', toJsonSchema(ParticipationValidationError)),
          '500': refResponse('`INTERNAL_ERROR`', 'InternalError'),
        },
      },
    },
    '/api/v1/participations/{id}': {
      get: {
        tags: ['participation'],
        operationId: 'getParticipation',
        security: [{ bearerAuth: [] }],
        parameters: [paramRef('ParticipationIdPath')],
        responses: {
          '200': refResponse('Minimal participation state', 'ParticipationResource'),
          '401': refResponse('`UNAUTHENTICATED`', 'UnauthenticatedError'),
          '404': refResponse('`PARTICIPATION_NOT_FOUND`', 'ParticipationNotFoundError'),
          '500': refResponse('`INTERNAL_ERROR`', 'InternalError'),
        },
      },
    },
    // ── Slice 006 identity binding: exactly six surfaces ──
    '/api/v1/identity-bindings/bootstrap': {
      post: {
        tags: ['identity-binding'],
        operationId: 'bootstrapIdentityBinding',
        requestBody: refBody('BindingBootstrapRequest'),
        responses: {
          '200': jsonResponse('generic / Case B 复用 / COMMITTED settled replay', {
            oneOf: [
              ref('BindingBootstrapGenericResponse'),
              ref('BindingBootstrapReusedResponse'),
              ref('BindingBootstrapCommittedResponse'),
            ],
          }),
          '401': errorResponse('`WECHAT_AUTH_FAILED`'),
          '409': errorResponse('`IDEMPOTENCY_PAYLOAD_MISMATCH`'),
          '422': errorResponse('`VALIDATION_ERROR`'),
        },
      },
    },
    '/api/v1/identity-bindings/candidate-decision': {
      post: {
        tags: ['identity-binding'],
        operationId: 'submitCandidateBindingDecision',
        parameters: [paramRef('BindingContextHeader')],
        requestBody: refBody('BindingCandidateDecisionRequest'),
        responses: {
          '200': jsonResponse('candidate AFFIRM fixed shape / REJECT-CANCEL generic', {
            oneOf: [
              ref('BindingGenericResponse'),
              ref('BindingCandidatePairingResponse'),
            ],
          }),
          '401': refResponse('`BINDING_CONTEXT_INVALID`', 'BindingContextInvalidError'),
          '409': errorResponse('`IDEMPOTENCY_PAYLOAD_MISMATCH`'),
          '422': errorResponse('`VALIDATION_ERROR`'),
        },
      },
    },
    '/api/v1/identity-bindings/status': {
      get: {
        tags: ['identity-binding'],
        operationId: 'getCandidateBindingStatus',
        parameters: [paramRef('BindingContextHeader')],
        responses: {
          '200': refResponse('candidate 可见状态', 'BindingStatusResponse'),
          '401': refResponse('`BINDING_CONTEXT_INVALID`', 'BindingContextInvalidError'),
        },
      },
    },
    '/api/v1/identity-bindings/session': {
      post: {
        tags: ['identity-binding'],
        operationId: 'exchangeBindingSession',
        parameters: [paramRef('BindingContextHeader')],
        responses: {
          '200': jsonResponse('未 COMMITTED generic / COMMITTED 普通会话', {
            oneOf: [
              ref('BindingGenericResponse'),
              ref('BindingSessionCommittedResponse'),
            ],
          }),
          '401': refResponse('`BINDING_CONTEXT_INVALID`', 'BindingContextInvalidError'),
        },
      },
    },
    '/api/v1/identity-bindings/pending': {
      get: {
        tags: ['identity-binding'],
        operationId: 'listPendingBindings',
        security: [{ bearerAuth: [] }],
        parameters: [paramRef('BindingPersonIdQuery')],
        responses: {
          '200': refResponse('最小 attempts 列表', 'BindingPendingListResponse'),
          '401': errorResponse('`UNAUTHENTICATED`'),
          '404': refResponse('`BINDING_NOT_FOUND`', 'BindingNotFoundError'),
          '422': errorResponse('`VALIDATION_ERROR`'),
        },
      },
    },
    '/api/v1/identity-bindings/pairing-decision': {
      post: {
        tags: ['identity-binding'],
        operationId: 'submitSecondPartyBindingPairingDecision',
        security: [{ bearerAuth: [] }],
        requestBody: refBody('BindingConfirmerDecisionRequest'),
        responses: {
          '200': refResponse('确认后 attempt 状态', 'BindingConfirmerDecisionResponse'),
          '401': errorResponse('`UNAUTHENTICATED`'),
          '404': refResponse('`BINDING_NOT_FOUND`', 'BindingNotFoundError'),
          '409': errorResponse('`BINDING_STATE_CONFLICT` / `IDEMPOTENCY_PAYLOAD_MISMATCH`'),
          '422': errorResponse('`VALIDATION_ERROR`'),
        },
      },
    },
    '/api/v1/cases/{id}/assessments': {
      post: {
        tags: ['digital-use-assessment'],
        operationId: 'startDigitalUseAssessment',
        security: [{ bearerAuth: [] }],
        parameters: [
          paramRef('CaseId'),
          paramRef('IdempotencyKeyHeader'),
        ],
        requestBody: jsonBody({
          type: 'object',
          additionalProperties: false,
          properties: {
            expectedCaseVersion: {
              type: 'integer',
              minimum: 1,
              maximum: 2147483647,
            },
          },
          required: ['expectedCaseVersion'],
        }),
        responses: {
          '200': jsonResponse('Digital Use Assessment started or resumed', toJsonSchema(DigitalUseSceneResponse)),
          '401': jsonResponse('`UNAUTHENTICATED`', toJsonSchema(DigitalUseApiError)),
          '404': jsonResponse('`CURRENT_FAMILY_NOT_FOUND` / `CASE_NOT_FOUND`', toJsonSchema(DigitalUseApiError)),
          '409': jsonResponse('Assessment state, Safety, Compliance or idempotency conflict', toJsonSchema(DigitalUseApiError)),
          '422': jsonResponse('Strict request or Scene validation failure', toJsonSchema(DigitalUseApiError)),
          '500': jsonResponse('`INTERNAL_ERROR`', toJsonSchema(DigitalUseApiError)),
        },
      },
    },
    '/api/v1/cases/{id}/scene': {
      get: {
        tags: ['digital-use-assessment'],
        operationId: 'getDigitalUseScene',
        security: [{ bearerAuth: [] }],
        parameters: [paramRef('CaseId')],
        responses: {
          '200': jsonResponse('Authorized current Digital Use Scene projection', toJsonSchema(DigitalUseSceneResponse)),
          '401': jsonResponse('`UNAUTHENTICATED`', toJsonSchema(DigitalUseApiError)),
          '404': jsonResponse('`CURRENT_FAMILY_NOT_FOUND` / `CASE_NOT_FOUND`', toJsonSchema(DigitalUseApiError)),
          '409': jsonResponse('Scene state/package conflict', toJsonSchema(DigitalUseApiError)),
          '422': jsonResponse('Scene validation failure', toJsonSchema(DigitalUseApiError)),
          '500': jsonResponse('`INTERNAL_ERROR`', toJsonSchema(DigitalUseApiError)),
        },
      },
    },
    '/api/v1/cases/{id}/scene/nodes/{nodeCode}': {
      get: {
        tags: ['digital-use-assessment'],
        operationId: 'getDigitalUseSceneNode',
        security: [{ bearerAuth: [] }],
        parameters: [
          paramRef('CaseId'),
          paramRef('NodeCode'),
        ],
        responses: {
          '200': jsonResponse('Authorized reachable Digital Use node', toJsonSchema(DigitalUseNodeResponse)),
          '401': jsonResponse('`UNAUTHENTICATED`', toJsonSchema(DigitalUseApiError)),
          '404': jsonResponse('`CURRENT_FAMILY_NOT_FOUND` / `CASE_NOT_FOUND`', toJsonSchema(DigitalUseApiError)),
          '409': jsonResponse('Scene state/package conflict', toJsonSchema(DigitalUseApiError)),
          '422': jsonResponse('Fabricated/unreachable node or validation failure', toJsonSchema(DigitalUseApiError)),
          '500': jsonResponse('`INTERNAL_ERROR`', toJsonSchema(DigitalUseApiError)),
        },
      },
    },
    '/api/v1/cases/{id}/scene/nodes/{nodeCode}/responses': {
      post: {
        tags: ['digital-use-assessment'],
        operationId: 'completeDigitalUseSceneNode',
        security: [{ bearerAuth: [] }],
        parameters: [
          paramRef('CaseId'),
          paramRef('NodeCode'),
          paramRef('IdempotencyKeyHeader'),
        ],
        requestBody: jsonBody({
          type: 'object',
          additionalProperties: false,
          properties: {
            expectedCaseVersion: {
              type: 'integer',
              minimum: 1,
              maximum: 2147483647,
            },
            expectedNodeRevision: {
              type: 'integer',
              minimum: 1,
              maximum: 2147483647,
            },
            response: {
              type: 'object',
              additionalProperties: true,
            },
          },
          required: ['expectedCaseVersion', 'expectedNodeRevision', 'response'],
        }),
        responses: {
          '200': jsonResponse('Node response committed or idempotently replayed', toJsonSchema(DigitalUseSceneResponse)),
          '401': jsonResponse('`UNAUTHENTICATED`', toJsonSchema(DigitalUseApiError)),
          '404': jsonResponse('`CURRENT_FAMILY_NOT_FOUND` / `CASE_NOT_FOUND`', toJsonSchema(DigitalUseApiError)),
          '409': jsonResponse('Concurrency, routing, Safety, Compliance or idempotency conflict', toJsonSchema(DigitalUseApiError)),
          '422': jsonResponse('Strict node response validation failure', toJsonSchema(DigitalUseApiError)),
          '500': jsonResponse('`INTERNAL_ERROR`', toJsonSchema(DigitalUseApiError)),
        },
      },
    },
    '/api/v1/cases/{id}/problem-formulations/current': {
      get: {
        tags: ['case'],
        operationId: 'getCurrentProblemFormulation',
        security: [{ bearerAuth: [] }],
        parameters: [paramRef('CaseId')],
        responses: {
          '200': refResponse(
            'Current Problem Formulation, or a true empty state for an authorized Case',
            'ProblemFormulationCurrentResponse'
          ),
          '401': refResponse('`UNAUTHENTICATED`', 'UnauthenticatedError'),
          '404': jsonResponse('`CURRENT_FAMILY_NOT_FOUND` / `CASE_NOT_FOUND`', {
            oneOf: [ref('CurrentFamilyNotFoundError'), ref('CaseNotFoundError')],
          }),
          '409': refResponse('`CURRENT_FAMILY_AMBIGUOUS`', 'CurrentFamilyAmbiguousError'),
          '500': refResponse('`INTERNAL_ERROR`', 'InternalError'),
        },
      },
    },
    '/api/v1/cases/{id}/problem-formulations/{version}/confirm': {
      post: {
        tags: ['case'],
        operationId: 'confirmProblemFormulation',
        security: [{ bearerAuth: [] }],
        parameters: [
          paramRef('CaseId'),
          paramRef('FormulationVersion'),
          paramRef('IdempotencyKeyHeader'),
          paramRef('IfMatchCaseVersionHeader'),
        ],
        requestBody: refBody('ProblemFormulationResponseRequest'),
        responses: {
          '200': refResponse(
            'Formulation confirmed and Case advanced to GOALS',
            'ProblemFormulationCurrentResponse'
          ),
          '401': refResponse('`UNAUTHENTICATED`', 'UnauthenticatedError'),
          '404': jsonResponse('`CURRENT_FAMILY_NOT_FOUND` / `CASE_NOT_FOUND`', {
            oneOf: [ref('CurrentFamilyNotFoundError'), ref('CaseNotFoundError')],
          }),
          '409': refResponse(
            'State, version, dependency, primary, Safety, Closed, Family ambiguity or idempotency conflict',
            'ProblemFormulationConflictError'
          ),
          '422': refResponse(
            'Strict request validation or Evidence fidelity failure',
            'ProblemFormulationValidationError'
          ),
          '500': refResponse('`INTERNAL_ERROR`', 'InternalError'),
        },
      },
    },
    '/api/v1/cases/{id}/problem-formulations/{version}/dispute': {
      post: {
        tags: ['case'],
        operationId: 'disputeProblemFormulation',
        security: [{ bearerAuth: [] }],
        parameters: [
          paramRef('CaseId'),
          paramRef('FormulationVersion'),
          paramRef('IdempotencyKeyHeader'),
          paramRef('IfMatchCaseVersionHeader'),
        ],
        requestBody: refBody('ProblemFormulationResponseRequest'),
        responses: {
          '200': refResponse(
            'Formulation disputed; Case remains in PROBLEM_FORMULATION',
            'ProblemFormulationCurrentResponse'
          ),
          '401': refResponse('`UNAUTHENTICATED`', 'UnauthenticatedError'),
          '404': jsonResponse('`CURRENT_FAMILY_NOT_FOUND` / `CASE_NOT_FOUND`', {
            oneOf: [ref('CurrentFamilyNotFoundError'), ref('CaseNotFoundError')],
          }),
          '409': refResponse(
            'State, version, primary, Safety, Closed, Family ambiguity or idempotency conflict',
            'ProblemFormulationConflictError'
          ),
          '422': refResponse(
            'Strict request validation failure',
            'ProblemFormulationValidationError'
          ),
          '500': refResponse('`INTERNAL_ERROR`', 'InternalError'),
        },
      },
    },
    '/api/v1/cases/{id}/problem-formulations/{version}/corrections': {
      post: {
        tags: ['case'],
        operationId: 'correctProblemFormulation',
        security: [{ bearerAuth: [] }],
        parameters: [
          paramRef('CaseId'),
          paramRef('FormulationVersion'),
          paramRef('IdempotencyKeyHeader'),
          paramRef('IfMatchCaseVersionHeader'),
        ],
        requestBody: refBody('ProblemFormulationCorrectionRequest'),
        responses: {
          '201': refResponse(
            'Complete corrected formulation version created; old version superseded',
            'ProblemFormulationCurrentResponse'
          ),
          '401': refResponse('`UNAUTHENTICATED`', 'UnauthenticatedError'),
          '404': jsonResponse('`CURRENT_FAMILY_NOT_FOUND` / `CASE_NOT_FOUND`', {
            oneOf: [ref('CurrentFamilyNotFoundError'), ref('CaseNotFoundError')],
          }),
          '409': refResponse(
            'State, version, primary, Safety, Closed, Family ambiguity or idempotency conflict',
            'ProblemFormulationConflictError'
          ),
          '422': refResponse(
            'Empty/no-op correction, strict schema, or full merged-formulation fidelity failure',
            'ProblemFormulationValidationError'
          ),
          '500': refResponse('`INTERNAL_ERROR`', 'InternalError'),
        },
      },
    },
  };

  return {
    openapi: '3.1.0',
    info: { title: 'Xiaoshuyin V1 — Identity & Family Core API', version: '0.1.0-plan' },
    tags: [
      { name: 'auth' },
      { name: 'identity' },
      { name: 'family' },
      { name: 'consent' },
      { name: 'compliance' },
      { name: 'case' },
      { name: 'participation' },
      { name: 'digital-use-assessment' },
    ],
    paths,
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'opaque-session-token' },
      },
      parameters: {
        IdempotencyKey: {
          name: 'Idempotency-Key',
          in: 'header',
          required: true,
          description: '关键命令幂等键（§8.5）。同 key 不同 payload → 409。',
          schema: { type: 'string', minLength: 8, maxLength: 128 },
        },
        FamilyIdPath: {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'string', format: 'uuid' },
        },
        PersonIdPath: {
          name: 'personId',
          in: 'path',
          required: true,
          schema: { type: 'string', format: 'uuid' },
        },
        IdempotencyKeyHeader: {
          name: 'Idempotency-Key',
          in: 'header',
          required: true,
          description: '关键命令幂等键（§8.5）。同 key 不同 payload → 409。',
          schema: { type: 'string', minLength: 8, maxLength: 128 },
        },
        CaseIdPath: {
          name: 'id',
          in: 'path',
          required: true,
          description: 'Case UUID（待验证参数；存在不代表有权访问）。',
          schema: { type: 'string', format: 'uuid' },
        },
        InviteTokenPath: {
          name: 'token',
          in: 'path',
          required: true,
          description: '不透明邀请 token；只作为 bearer capability，不构成 identity proof。',
          schema: { type: 'string', minLength: 1, maxLength: 256 },
        },
        ParticipationIdPath: {
          name: 'id',
          in: 'path',
          required: true,
          description: 'participation UUID（待验证参数；存在不代表有权访问）。',
          schema: { type: 'string', format: 'uuid' },
        },
        BindingContextHeader: {
          name: 'X-Binding-Context',
          in: 'header',
          required: true,
          description: 'opaque pending authentication context；不是普通会话。',
          schema: { type: 'string', minLength: 16, maxLength: 256 },
        },
        BindingPersonIdQuery: {
          name: 'personId',
          in: 'query',
          required: true,
          description: '待验证的 target Person P1；服务端读取唯一 Family。',
          schema: { type: 'string', format: 'uuid' },
        },
        FormulationVersionPath: {
          name: 'version',
          in: 'path',
          required: true,
          schema: { type: 'integer', minimum: 1, maximum: 2147483647 },
        },
        CaseId: {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'string', format: 'uuid' },
        },
        NodeCode: {
          name: 'nodeCode',
          in: 'path',
          required: true,
          schema: { type: 'string', minLength: 1, maxLength: 64 },
        },
        FormulationVersion: {
          name: 'version',
          in: 'path',
          required: true,
          schema: { type: 'integer', minimum: 1, maximum: 2147483647 },
        },
        IfMatchCaseVersionHeader: {
          name: 'If-Match',
          in: 'header',
          required: true,
          description:
            'Transport representation of the existing cases.version optimistic-concurrency token. It is not a second business version. Runtime must parse the decimal payload and reject values outside 1..2147483647 before repository/SQL access; the regex is only a lexical gate.',
          schema: {
            type: 'string',
            pattern: '^"case-v[1-9][0-9]{0,9}"$',
            example: '"case-v12"',
          },
        },

      },
      schemas: {

        ...schemas,
        ProblemFormulationStatus: {
          type: 'string',
          enum: ['DRAFT', 'PRESENTED', 'CONFIRMED', 'DISPUTED', 'NEEDS_REVIEW', 'SUPERSEDED'],
        },
        DialogueMessageRef: {
          type: 'object',
          additionalProperties: false,
          properties: {
            type: { type: 'string', enum: ['DIALOGUE_MESSAGE'] },
            id: { type: 'string', format: 'uuid' },
          },
          required: ['type', 'id'],
        },
        AssertionRef: {
          type: 'object',
          additionalProperties: false,
          properties: {
            type: { type: 'string', enum: ['ASSERTION'] },
            id: { type: 'string', format: 'uuid' },
          },
          required: ['type', 'id'],
        },
        ObservationRef: {
          type: 'object',
          additionalProperties: false,
          properties: {
            type: { type: 'string', enum: ['OBSERVATION'] },
            id: { type: 'string', format: 'uuid' },
          },
          required: ['type', 'id'],
        },
        EvidenceRef: {
          oneOf: [ref('DialogueMessageRef'), ref('AssertionRef'), ref('ObservationRef')],
        },
        PrimaryProblem: {
          type: 'object',
          additionalProperties: false,
          properties: {
            text: { type: 'string', minLength: 1 },
            evidenceRefs: { type: 'array', minItems: 1, items: ref('EvidenceRef') },
          },
          required: ['text', 'evidenceRefs'],
        },
        KeyFactor: {
          type: 'object',
          additionalProperties: false,
          properties: {
            text: { type: 'string', minLength: 1 },
            evidenceRefs: { type: 'array', minItems: 1, items: ref('EvidenceRef') },
          },
          required: ['text', 'evidenceRefs'],
        },
        UnknownItem: {
          type: 'object',
          additionalProperties: false,
          properties: {
            topic: { type: 'string', minLength: 1 },
            state: { type: 'string', enum: ['UNKNOWN', 'NOT_COLLECTED', 'DECLINED'] },
            evidenceRefs: { type: 'array', items: ref('EvidenceRef') },
          },
          required: ['topic', 'state', 'evidenceRefs'],
        },
        ConflictItem: {
          type: 'object',
          additionalProperties: false,
          properties: {
            topic: { type: 'string', minLength: 1 },
            conflictGroupId: { type: 'string', format: 'uuid' },
            evidenceRefs: {
              type: 'array',
              uniqueItems: true,
              items: ref('EvidenceRef'),
            },
          },
          required: ['topic'],
          anyOf: [
            { required: ['conflictGroupId'] },
            { required: ['evidenceRefs'], properties: { evidenceRefs: { minItems: 2 } } },
          ],
        },
        TextCondition: {
          type: 'object',
          additionalProperties: false,
          properties: { text: { type: 'string', minLength: 1 } },
          required: ['text'],
        },
        UserResponse: {
          type: 'object',
          additionalProperties: false,
          properties: {
            kind: { type: 'string', enum: ['CONFIRM', 'DISPUTE', 'CORRECTION'] },
            actorPersonId: { type: 'string', format: 'uuid' },
            respondedAt: { type: 'string', format: 'date-time' },
            note: { type: 'string', minLength: 1 },
          },
          required: ['kind', 'actorPersonId', 'respondedAt'],
        },
        EvidenceDependencyRef: {
          type: 'object',
          additionalProperties: false,
          properties: {
            type: { type: 'string', enum: ['EVIDENCE'] },
            evidence: ref('EvidenceRef'),
          },
          required: ['type', 'evidence'],
        },
        ConsentDependencyRef: {
          type: 'object',
          additionalProperties: false,
          properties: {
            type: { type: 'string', enum: ['CONSENT'] },
            id: { type: 'string', format: 'uuid' },
            version: { type: 'integer', minimum: 1, maximum: 2147483647 },
          },
          required: ['type', 'id'],
        },
        VersionedKeyDependencyRef: {
          type: 'object',
          additionalProperties: false,
          properties: {
            type: { type: 'string', enum: ['POLICY', 'PACKAGE', 'CONTENT_VERSION'] },
            key: { type: 'string', minLength: 1 },
            version: { type: 'string', minLength: 1 },
          },
          required: ['type', 'key', 'version'],
        },
        DependencyRef: {
          oneOf: [
            ref('EvidenceDependencyRef'),
            ref('ConsentDependencyRef'),
            ref('VersionedKeyDependencyRef'),
          ],
        },
        ProblemFormulationContent: {
          type: 'object',
          additionalProperties: false,
          properties: {
            primaryProblem: ref('PrimaryProblem'),
            keyFactors: { type: 'array', items: ref('KeyFactor') },
            evidenceRefs: { type: 'array', minItems: 1, items: ref('EvidenceRef') },
            unknowns: { type: 'array', items: ref('UnknownItem') },
            conflicts: { type: 'array', items: ref('ConflictItem') },
            sceneFit: { type: 'string', minLength: 1 },
            alternativeExplanations: { type: 'array', items: ref('TextCondition') },
            reassessmentConditions: { type: 'array', items: ref('TextCondition') },
            exitConditions: { type: 'array', items: ref('TextCondition') },
            dependencyRefs: { type: 'array', items: ref('DependencyRef') },
          },
          required: [
            'primaryProblem',
            'keyFactors',
            'evidenceRefs',
            'unknowns',
            'conflicts',
            'sceneFit',
            'alternativeExplanations',
            'reassessmentConditions',
            'exitConditions',
            'dependencyRefs',
          ],
        },
        ProblemFormulation: {
          type: 'object',
          additionalProperties: false,
          properties: {
            id: { type: 'string', format: 'uuid' },
            caseId: { type: 'string', format: 'uuid' },
            version: { type: 'integer', minimum: 1, maximum: 2147483647 },
            status: ref('ProblemFormulationStatus'),
            primaryProblem: ref('PrimaryProblem'),
            keyFactors: { type: 'array', items: ref('KeyFactor') },
            evidenceRefs: { type: 'array', minItems: 1, items: ref('EvidenceRef') },
            unknowns: { type: 'array', items: ref('UnknownItem') },
            conflicts: { type: 'array', items: ref('ConflictItem') },
            sceneFit: { type: 'string', minLength: 1 },
            alternativeExplanations: { type: 'array', items: ref('TextCondition') },
            reassessmentConditions: { type: 'array', items: ref('TextCondition') },
            exitConditions: { type: 'array', items: ref('TextCondition') },
            userResponse: { nullable: true, allOf: [ref('UserResponse')] },
            confirmedBy: { type: 'string', format: 'uuid', nullable: true },
            confirmedAt: { type: 'string', format: 'date-time', nullable: true },
            dependencyRefs: { type: 'array', items: ref('DependencyRef') },
            supersedesVersion: {
              type: 'integer',
              minimum: 1,
              maximum: 2147483647,
              nullable: true,
            },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
          required: [
            'id',
            'caseId',
            'version',
            'status',
            'primaryProblem',
            'keyFactors',
            'evidenceRefs',
            'unknowns',
            'conflicts',
            'sceneFit',
            'alternativeExplanations',
            'reassessmentConditions',
            'exitConditions',
            'userResponse',
            'confirmedBy',
            'confirmedAt',
            'dependencyRefs',
            'supersedesVersion',
            'createdAt',
            'updatedAt',
          ],
        },
        ProblemFormulationCurrentResponse: {
          type: 'object',
          additionalProperties: false,
          properties: {
            caseVersion: { type: 'integer', minimum: 1, maximum: 2147483647 },
            current: { nullable: true, allOf: [ref('ProblemFormulation')] },
          },
          required: ['caseVersion', 'current'],
        },
        ProblemFormulationResponseRequest: {
          type: 'object',
          additionalProperties: false,
          properties: { note: { type: 'string', minLength: 1 } },
        },
        ProblemFormulationContentChanges: {
          type: 'object',
          additionalProperties: false,
          minProperties: 1,
          properties: {
            primaryProblem: ref('PrimaryProblem'),
            keyFactors: { type: 'array', items: ref('KeyFactor') },
            evidenceRefs: { type: 'array', minItems: 1, items: ref('EvidenceRef') },
            unknowns: { type: 'array', items: ref('UnknownItem') },
            conflicts: { type: 'array', items: ref('ConflictItem') },
            sceneFit: { type: 'string', minLength: 1 },
            alternativeExplanations: { type: 'array', items: ref('TextCondition') },
            reassessmentConditions: { type: 'array', items: ref('TextCondition') },
            exitConditions: { type: 'array', items: ref('TextCondition') },
            dependencyRefs: { type: 'array', items: ref('DependencyRef') },
          },
        },
        ProblemFormulationCorrectionRequest: {
          type: 'object',
          additionalProperties: false,
          properties: {
            changes: ref('ProblemFormulationContentChanges'),
            note: { type: 'string', minLength: 1 },
          },
          required: ['changes'],
        },
        ProblemFormulationConflictError: {
          type: 'object',
          additionalProperties: false,
          properties: {
            code: {
              type: 'string',
              enum: [
                'CURRENT_FAMILY_AMBIGUOUS',
                'IDEMPOTENCY_PAYLOAD_MISMATCH',
                'CASE_NOT_PRIMARY',
                'CASE_PHASE_CONFLICT',
                'STALE_CASE_VERSION',
                'CASE_CLOSED',
                'SAFETY_HOLD_BLOCKED',
                'PROBLEM_FORMULATION_VERSION_CONFLICT',
                'PROBLEM_FORMULATION_STATE_CONFLICT',
                'PROBLEM_FORMULATION_DEPENDENCY_INVALID',
              ],
            },
            message: { type: 'string' },
          },
          required: ['code', 'message'],
        },
        ProblemFormulationValidationError: {
          type: 'object',
          additionalProperties: false,
          properties: {
            code: {
              type: 'string',
              enum: ['VALIDATION_ERROR', 'PROBLEM_FORMULATION_EVIDENCE_INVALID'],
            },
            message: { type: 'string' },
          },
          required: ['code', 'message'],
        },
      },
    },
  };
}