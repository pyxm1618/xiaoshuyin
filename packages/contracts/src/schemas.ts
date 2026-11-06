import { z } from 'zod';

// ── Primitive types ─────────────────────────────────────────

export const AgeBand = z.enum(['ADULT', 'MINOR_14_17', 'UNDER_14', 'UNKNOWN']);
export type AgeBandType = z.infer<typeof AgeBand>;

export const WritableSource = z.enum([
  'SELF_STATEMENT',
  'GUARDIAN_OBSERVATION',
  'GUARDIAN_RELAY',
  'OTHER_MEMBER_RELAY',
]);
export type WritableSourceType = z.infer<typeof WritableSource>;

export const ProfileAttribute = z.enum(['DISPLAY_NAME']);
export type ProfileAttributeType = z.infer<typeof ProfileAttribute>;

export const ProvenanceSource = z.enum([
  'SELF_STATEMENT', 'GUARDIAN_OBSERVATION', 'GUARDIAN_RELAY', 'OTHER_MEMBER_RELAY',
  'MANUAL_DEVICE_DATA', 'STAFF_RECORD', 'AI_HYPOTHESIS', 'SOURCE_CONFIRMED',
]);

// ── Error schema ────────────────────────────────────────────

export const ErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.record(z.string(), z.unknown()).optional(),
});
export type ErrorType = z.infer<typeof ErrorSchema>;

// ── Provenance input ────────────────────────────────────────

export const ProvenanceValueInput = z.object({
  attribute: ProfileAttribute,
  valueText: z.string().min(1).max(120),
  sourceKind: WritableSource,
  providedByPersonId: z.string().uuid().optional(),
  observedAt: z.string().datetime().optional(),
});
export type ProvenanceValueInputType = z.infer<typeof ProvenanceValueInput>;

// ── Auth schemas ────────────────────────────────────────────

export const WechatLoginRequest = z.object({
  code: z.string().min(1),
});

export const WechatLoginResponse = z.object({
  account: z.object({
    id: z.string().uuid(),
  }),
  person: z.object({
    id: z.string().uuid(),
    profile: z.object({
      ageBand: AgeBand,
      minorMode: z.boolean(),
      verifiedSource: ProvenanceSource,
    }).nullable(),
    values: z.array(z.object({
      attribute: ProfileAttribute,
      valueText: z.string(),
      sourceKind: ProvenanceSource,
    })).optional(),
  }),
  token: z.string(),
});

// ── Family schemas ──────────────────────────────────────────

export const CreateFamilyRequest = z.object({
  displayName: z.string().min(1).max(60).optional(),
  ageBand: z.enum(['ADULT', 'MINOR_14_17', 'UNDER_14', 'UNKNOWN']),
  ageBandSource: z.string(),
  profileValues: z.array(ProvenanceValueInput).optional(),
  idempotencyKey: z.string().min(8).max(128),
});

export const FamilyResponse = z.object({
  id: z.string().uuid(),
  displayName: z.string().nullable(),
  isManager: z.boolean(),
  createdAt: z.string().datetime(),
});

// ── Member schemas ──────────────────────────────────────────

export const CreateMemberRequest = z.object({
  ageBand: AgeBand,
  ageBandSource: WritableSource,
  profileValues: z.array(ProvenanceValueInput).optional(),
  guardianConsentId: z.string().uuid().optional(),
  idempotencyKey: z.string().min(8).max(128),
});

export const UpdateMemberRequest = z.object({
  profileValues: z.array(ProvenanceValueInput).min(1),
  idempotencyKey: z.string().min(8).max(128),
});

export const MemberResponse = z.object({
  personId: z.string().uuid(),
  accountBound: z.boolean(),
  profile: z.object({
    ageBand: AgeBand,
    minorMode: z.boolean(),
    verifiedSource: ProvenanceSource,
  }).nullable(),
  values: z.array(z.object({
    attribute: ProfileAttribute,
    valueText: z.string(),
    sourceKind: ProvenanceSource,
    status: z.enum(['RECORDED', 'SUPERSEDED', 'RETRACTED']),
  })),
});

// ── Consent schemas ─────────────────────────────────────────

export const CreateConsentRequestRequest = z.object({
  noticeVersion: z.string().min(1),
  subjectPersonId: z.string().uuid().optional(),
  idempotencyKey: z.string().min(8).max(128),
});

export const ConsentRequestResponse = z.object({
  id: z.string().uuid(),
  status: z.enum(['PENDING', 'GRANTED', 'EXPIRED', 'ABANDONED']),
  noticeVersion: z.string(),
  expiresAt: z.string().datetime(),
});

export const GrantConsentRequest = z.object({
  consentRequestId: z.string().uuid(),
  accepted: z.literal(true),
  noticeVersion: z.string().min(1),
  noticeHash: z.string().regex(/^[0-9a-f]{64}$/),
  idempotencyKey: z.string().min(8).max(128),
});

export const ConsentRecordResponse = z.object({
  id: z.string().uuid(),
  decision: z.enum(['GRANTED', 'REVOKED']),
  version: z.number().int().min(1),
  noticeVersion: z.string(),
  decidedAt: z.string().datetime(),
  boundPersonId: z.string().uuid().nullable(),
});

export const RevokeConsentRequest = z.object({
  idempotencyKey: z.string().min(8).max(128),
});

// ── Compliance schemas ──────────────────────────────────────

export const ComplianceProfileResponse = z.object({
  ageBand: AgeBand,
  minorMode: z.boolean(),
  verifiedSource: ProvenanceSource,
  guardianConsentVersion: z.number().int().nullable(),
  effectiveAt: z.string().datetime(),
});

export const NoticeCatalogResponse = z.object({
  notices: z.array(z.object({
    version: z.string(),
    hash: z.string(),
    title: z.string(),
  })),
});

// ── Case Core schemas (Slice 2) ─────────────────────────────
// `CreateCaseRequest` is STRICT: the only legal business field is the
// idempotency key. Every undeclared field (familyId, creator, status, phase,
// primary, version, title, summary, description, ...) is rejected — never
// stripped — so the server can answer 422 with zero business writes.

export const CaseStatus = z.enum([
  'OPEN', 'WAITING', 'PAUSED', 'LOST_CONTACT', 'SAFETY_HOLD', 'CLOSED',
]);
export type CaseStatusType = z.infer<typeof CaseStatus>;

export const CasePhase = z.enum([
  'INTAKE', 'ASSESSMENT', 'PROBLEM_FORMULATION', 'GOALS',
  'PLANNING', 'EXECUTION', 'REVIEW', 'MAINTENANCE', 'CLOSED',
]);
export type CasePhaseType = z.infer<typeof CasePhase>;

export const CreateCaseRequest = z.strictObject({
  idempotencyKey: z.string().min(8).max(128),
});
export type CreateCaseRequestType = z.infer<typeof CreateCaseRequest>;

export const CaseResponse = z.strictObject({
  id: z.string().uuid(),
  status: CaseStatus,
  phase: CasePhase,
  primary: z.boolean(),
  version: z.number().int().min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type CaseResponseType = z.infer<typeof CaseResponse>;

export const CaseListResponse = z.strictObject({
  items: z.array(CaseResponse),
});
export type CaseListResponseType = z.infer<typeof CaseListResponse>;

export const CaseIdParams = z.object({
  id: z.string().uuid(),
});

