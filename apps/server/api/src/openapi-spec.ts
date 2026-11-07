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
    CurrentFamilyNotFoundError: toJsonSchema(CurrentFamilyNotFoundErrorSchema),
    CurrentFamilyAmbiguousError: toJsonSchema(CurrentFamilyAmbiguousErrorSchema),
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
      },
      schemas: {

        ...schemas,
      },
    },
  };
}