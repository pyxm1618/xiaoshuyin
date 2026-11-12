import { z } from 'zod';

function hasOnlyPairedUtf16Surrogates(value: string): boolean {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff) {
      if (i + 1 >= value.length) return false;
      const next = value.charCodeAt(i + 1);
      if (next < 0xdc00 || next > 0xdfff) return false;
      i += 1;
      continue;
    }
    if (code >= 0xdc00 && code <= 0xdfff) return false;
  }
  return true;
}

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

export const ProfileValueStatus = z.enum(['RECORDED', 'SUPERSEDED', 'RETRACTED']);

/**
 * Authoritative Consent decision vocabulary (internal).
 *
 * `DECLINED` belongs ONLY to `DIGITAL_USE_SUPPLEMENTAL_ASSESSMENT`. The public
 * guardian consent contract keeps using `GuardianConsentDecision` below, so the
 * internal enum expansion cannot widen the existing public API.
 */
export const ConsentDecision = z.enum(['GRANTED', 'DECLINED', 'REVOKED']);
export type ConsentDecisionType = z.infer<typeof ConsentDecision>;

export const ConsentRequestStatus = z.enum(['PENDING', 'GRANTED', 'EXPIRED', 'ABANDONED']);

/** Authoritative purpose vocabulary (internal). */
export const ConsentPurpose = z.enum([
  'UNDER_14_GUARDIAN_CONSENT',
  'DIGITAL_USE_SUPPLEMENTAL_ASSESSMENT',
]);
export type ConsentPurposeType = z.infer<typeof ConsentPurpose>;

/**
 * Public guardian consent surface. Frozen: the pre-existing guardian contract
 * accepts exactly this purpose and these decisions, nothing more.
 */
export const GuardianConsentPurpose = z.enum(['UNDER_14_GUARDIAN_CONSENT']);
export type GuardianConsentPurposeType = z.infer<typeof GuardianConsentPurpose>;
export const GuardianConsentDecision = z.enum(['GRANTED', 'REVOKED']);
export type GuardianConsentDecisionType = z.infer<typeof GuardianConsentDecision>;

/** The one owner-approved Digital Use 01004 purpose. */
export const SupplementalAssessmentConsentPurpose = z.literal(
  'DIGITAL_USE_SUPPLEMENTAL_ASSESSMENT'
);
export type SupplementalAssessmentConsentPurposeType = z.infer<
  typeof SupplementalAssessmentConsentPurpose
>;

export const AccountStatus = z.enum(['ACTIVE', 'DISABLED']);

/**
 * Consent channel. The channel is decided by the server runtime
 * (`NODE_ENV === 'test' ? 'TEST' : 'MINIPROGRAM'`); the request value is only a
 * consistency declaration and never drives the stored evidence.
 */
export const ConsentChannel = z.enum(['MINIPROGRAM', 'TEST']);
export type ConsentChannelType = z.infer<typeof ConsentChannel>;

// ── Error schema ────────────────────────────────────────────

export const ErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.record(z.string(), z.unknown()).optional(),
});
export type ErrorType = z.infer<typeof ErrorSchema>;

// ── Provenance input / output ───────────────────────────────

export const ProvenanceValueInput = z.strictObject({
  attribute: ProfileAttribute,
  value: z.string().min(1).max(120),
  source: WritableSource,
  providedByPersonId: z.string().uuid().optional(),
  observedAt: z.string().datetime().optional(),
});
export type ProvenanceValueInputType = z.infer<typeof ProvenanceValueInput>;

export const ProfileValue = z.strictObject({
  id: z.string().uuid(),
  attribute: ProfileAttribute,
  value: z.string(),
  source: WritableSource,
  providedByPersonId: z.string().uuid().nullable().optional(),
  observedAt: z.string().datetime().nullable().optional(),
  recordedAt: z.string().datetime(),
  status: ProfileValueStatus,
  supersedesId: z.string().uuid().nullable().optional(),
});
export type ProfileValueType = z.infer<typeof ProfileValue>;

export const ComplianceProfileSummary = z.strictObject({
  ageBand: AgeBand,
  minorMode: z.boolean(),
  guardianPersonId: z.string().uuid().nullable().optional(),
  guardianConsentVersion: z.number().int().nullable().optional(),
  verifiedSource: z.string(),
  effectiveAt: z.string().datetime().optional(),
});
export type ComplianceProfileSummaryType = z.infer<typeof ComplianceProfileSummary>;

export const PersonSummary = z.strictObject({
  id: z.string().uuid(),
  createdAt: z.string().datetime(),
  accountBound: z.boolean().optional(),
  profile: ComplianceProfileSummary.optional(),
  values: z.array(ProfileValue).optional(),
});
export type PersonSummaryType = z.infer<typeof PersonSummary>;

// ── Auth schemas ────────────────────────────────────────────

export const WechatLoginRequest = z.strictObject({
  code: z.string().min(1).max(512),
});

export const LoginResponse = z.strictObject({
  accountId: z.string().uuid(),
  sessionToken: z.string(),
  expiresAt: z.string().datetime(),
  person: PersonSummary,
});
export type LoginResponseType = z.infer<typeof LoginResponse>;

export const MeResponse = z.strictObject({
  account: z.strictObject({
    id: z.string().uuid(),
    createdAt: z.string().datetime(),
    status: AccountStatus,
  }),
  person: PersonSummary,
});
export type MeResponseType = z.infer<typeof MeResponse>;

// ── Family schemas ──────────────────────────────────────────

export const CreatorInput = z.strictObject({
  ageBand: AgeBand,
  ageBandSource: WritableSource,
  values: z.array(ProvenanceValueInput).max(1).optional(),
});
export type CreatorInputType = z.infer<typeof CreatorInput>;

export const CreateFamilyRequest = z.strictObject({
  displayName: z.string().min(1).max(60).optional(),
  creator: CreatorInput,
});
export type CreateFamilyRequestType = z.infer<typeof CreateFamilyRequest>;

export const FamilyResponse = z.strictObject({
  id: z.string().uuid(),
  displayName: z.string().nullable().optional(),
  createdAt: z.string().datetime(),
  isManager: z.boolean(),
  memberCount: z.number().int().min(1).optional(),
});
export type FamilyResponseType = z.infer<typeof FamilyResponse>;

// ── Member schemas ──────────────────────────────────────────

export const CreateMemberRequest = z.strictObject({
  ageBand: AgeBand,
  ageBandSource: WritableSource,
  values: z.array(ProvenanceValueInput).max(1).optional(),
  guardianConsentId: z.string().uuid().optional(),
});
export type CreateMemberRequestType = z.infer<typeof CreateMemberRequest>;

export const UpdateMemberRequest = z.strictObject({
  values: z.array(ProvenanceValueInput).min(1).max(1),
});
export type UpdateMemberRequestType = z.infer<typeof UpdateMemberRequest>;

export const MemberResponse = z.strictObject({
  personId: z.string().uuid(),
  familyId: z.string().uuid(),
  accountBound: z.boolean().optional(),
  profile: ComplianceProfileSummary,
  values: z.array(ProfileValue),
});
export type MemberResponseType = z.infer<typeof MemberResponse>;

// ── Consent schemas ─────────────────────────────────────────

export const CreateConsentRequestRequest = z.strictObject({
  declaredAgeBand: z.enum(['UNDER_14']),
  noticeVersion: z.string().min(1).max(64),
  channel: ConsentChannel,
  existingSubjectPersonId: z.string().uuid().optional(),
});
export type CreateConsentRequestRequestType = z.infer<typeof CreateConsentRequestRequest>;

export const ConsentRequestResponse = z.strictObject({
  requestId: z.string().uuid(),
  declaredAgeBand: z.enum(['UNDER_14']),
  noticeVersion: z.string(),
  noticeHash: z.string(),
  expiresAt: z.string().datetime(),
  status: ConsentRequestStatus,
});
export type ConsentRequestResponseType = z.infer<typeof ConsentRequestResponse>;

export const GrantConsentRequest = z.strictObject({
  onboardingRequestId: z.string().uuid(),
  noticeVersion: z.string().min(1).max(64),
  accepted: z.literal(true),
});
export type GrantConsentRequestType = z.infer<typeof GrantConsentRequest>;

export const ConsentRecord = z.strictObject({
  id: z.string().uuid(),
  purpose: GuardianConsentPurpose,
  decision: GuardianConsentDecision,
  version: z.number().int().min(1),
  guardianPersonId: z.string().uuid().optional(),
  onboardingRequestId: z.string().uuid().nullable().optional(),
  boundPersonId: z.string().uuid().nullable().optional(),
  boundAt: z.string().datetime().nullable().optional(),
  noticeVersion: z.string().optional(),
  noticeHash: z.string().optional(),
  policyVersion: z.string().optional(),
  decidedAt: z.string().datetime(),
  supersedesId: z.string().uuid().nullable().optional(),
});
export type ConsentRecordType = z.infer<typeof ConsentRecord>;

export const RevokeConsentRequest = z.strictObject({
  reason: z.string().max(200).optional(),
});
export type RevokeConsentRequestType = z.infer<typeof RevokeConsentRequest>;

// ── Consent evidence schema ─────────────────────────────────
//
// Single source of truth for `consent_records.evidence`
// (contracts/consent-onboarding.md §4). The same schema is used when the
// evidence is produced and when it is persisted, so a free-form jsonb shape
// is structurally impossible. `accepted_text_hash` is the hash of the
// versioned acceptance statement — it is deliberately NOT `notice_hash`.
//
// `channel` is server-decided: `TEST` under `NODE_ENV=test`, otherwise
// `MINIPROGRAM`. It is never taken from a request row.

export const ConsentEvidence = z.strictObject({
  channel: ConsentChannel,
  accepted_text_hash: z.string().regex(/^[0-9a-f]{64}$/),
  declared_age_band: z.literal('UNDER_14'),
  client_ip_hash: z.string().regex(/^[0-9a-f]{64}$/),
  user_agent_hash: z.string().regex(/^[0-9a-f]{64}$/),
});
export type ConsentEvidenceType = z.infer<typeof ConsentEvidence>;

/**
 * Purpose-discriminated evidence for `DIGITAL_USE_SUPPLEMENTAL_ASSESSMENT`.
 *
 * This is deliberately NOT the guardian `ConsentEvidence` shape. It proves
 * who (actor == subject), for which Case + purpose, against which approved
 * disclosure identity, with which confirmation statement, which decision and
 * when. It never stores Assessment answers, device usage facts, parent
 * observations, statements, impact narratives, raw IP or raw User-Agent.
 *
 * The `evidence_kind` discriminator makes the purpose branch structurally
 * unambiguous; the database CHECK requires this object to agree with the
 * authoritative columns.
 */
export const SupplementalAssessmentConsentEvidence = z.strictObject({
  evidence_kind: z.literal('DIGITAL_USE_SUPPLEMENTAL_ASSESSMENT'),
  purpose: SupplementalAssessmentConsentPurpose,
  disclosure_reference: z.string().min(1).max(120),
  disclosure_version: z.string().min(1).max(64),
  disclosure_hash: z.string().regex(/^[0-9a-f]{64}$/),
  confirmation_statement_hash: z.string().regex(/^[0-9a-f]{64}$/),
  decision: z.enum(['GRANTED', 'DECLINED', 'REVOKED']),
  decision_actor_person_id: z.string().uuid(),
  case_id: z.string().uuid(),
  decided_at: z.string().datetime(),
  client_ip_hash: z.string().regex(/^[0-9a-f]{64}$/),
  user_agent_hash: z.string().regex(/^[0-9a-f]{64}$/),
});
export type SupplementalAssessmentConsentEvidenceType = z.infer<
  typeof SupplementalAssessmentConsentEvidence
>;

// ── Compliance schemas ──────────────────────────────────────

export const ComplianceProfile = z.strictObject({
  personId: z.string().uuid(),
  ageBand: AgeBand,
  minorMode: z.boolean(),
  guardianPersonId: z.string().uuid().nullable().optional(),
  guardianConsentVersion: z.number().int().nullable().optional(),
  guardianConsentRecordId: z.string().uuid().nullable().optional(),
  verifiedSource: z.string(),
  effectiveAt: z.string().datetime(),
});
export type ComplianceProfileType = z.infer<typeof ComplianceProfile>;

export const Notice = z.strictObject({
  version: z.string(),
  hash: z.string(),
  title: z.string(),
  purpose: GuardianConsentPurpose,
  effectiveAt: z.string().datetime(),
});
export type NoticeType = z.infer<typeof Notice>;

export const NoticeCatalogResponse = z.strictObject({
  notices: z.array(Notice),
});
export type NoticeCatalogResponseType = z.infer<typeof NoticeCatalogResponse>;

export const ConsentListResponse = z.strictObject({
  items: z.array(ConsentRecord),
});
export type ConsentListResponseType = z.infer<typeof ConsentListResponse>;

// ── Case Core schemas (Slice 2) ─────────────────────────────
// `CreateCaseRequest` is a STRICT EMPTY business object: the idempotency key
// travels in the `Idempotency-Key` header, never in the body. Every undeclared
// field (idempotencyKey, familyId, creator, status, phase, primary, version,
// title, summary, description, ...) is rejected — never stripped — so the
// server can answer 422 with zero business writes.

export const CaseStatus = z.enum([
  'OPEN', 'WAITING', 'LOST_CONTACT', 'SAFETY_HOLD', 'CLOSED',
]);
export type CaseStatusType = z.infer<typeof CaseStatus>;

export const CasePhase = z.enum([
  'INTAKE', 'ASSESSMENT', 'PROBLEM_FORMULATION', 'GOALS',
  'PLANNING', 'EXECUTION', 'REVIEW', 'MAINTENANCE', 'CLOSED',
]);
export type CasePhaseType = z.infer<typeof CasePhase>;

export const CreateCaseRequest = z.strictObject({});
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

// ── SwitchPrimaryCase schemas (Slice 7) ─────────────────────
// Strict three-field request. Both view keys are required and must agree
// (both null or both present). `reason` keeps its raw length; only the
// blank check trims. The idempotency key travels in the HTTP header only.

export const SwitchPrimaryCaseRequest = z
  .strictObject({
    reason: z
      .string()
      .min(1)
      .max(500)
      .refine((value) => value.trim().length > 0, {
        message: 'reason must not be blank',
      })
      .refine((value) => !value.includes('\u0000'), {
        message: 'reason must not contain U+0000',
      })
      .refine(hasOnlyPairedUtf16Surrogates, {
        message: 'reason must be valid Unicode',
      }),
    expectedPrimaryCaseId: z.string().uuid().nullable(),
    expectedPrimaryVersion: z.number().int().min(1).nullable(),
  })
  .superRefine((value, ctx) => {
    const idPresent = value.expectedPrimaryCaseId !== null;
    const versionPresent = value.expectedPrimaryVersion !== null;
    if (idPresent !== versionPresent) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'expectedPrimaryCaseId and expectedPrimaryVersion must both be null or both be present',
        path: ['expectedPrimaryCaseId'],
      });
    }
  });
export type SwitchPrimaryCaseRequestType = z.infer<typeof SwitchPrimaryCaseRequest>;

export const SwitchPrimaryCaseResponse = z.strictObject({
  primary: CaseResponse,
  previousPrimary: CaseResponse.nullable(),
  switchedAt: z.string().datetime(),
});
export type SwitchPrimaryCaseResponseType = z.infer<typeof SwitchPrimaryCaseResponse>;

// ── Evidence Core message schemas (Slice 3) ─────────────────
// `content` is the only legal business field. The idempotency key travels in
// the `Idempotency-Key` HTTP header and is rejected inside the body. The
// response deliberately never echoes raw content (the idempotency response
// snapshot must not become a second copy of the message).

export const CreateCaseMessageRequest = z.strictObject({
  content: z.string().min(1).max(8000).refine(hasOnlyPairedUtf16Surrogates),
});
export type CreateCaseMessageRequestType = z.infer<typeof CreateCaseMessageRequest>;

export const CaseMessageResponse = z.strictObject({
  id: z.string().uuid(),
  caseId: z.string().uuid(),
  recordedAt: z.string().datetime(),
});
export type CaseMessageResponseType = z.infer<typeof CaseMessageResponse>;

export const UnauthenticatedError = z.strictObject({
  code: z.enum(['UNAUTHENTICATED']),
  message: z.string(),
});

export const CurrentFamilyNotFoundError = z.strictObject({
  code: z.enum(['CURRENT_FAMILY_NOT_FOUND']),
  message: z.string(),
});

export const CaseNotFoundError = z.strictObject({
  code: z.enum(['CASE_NOT_FOUND']),
  message: z.string(),
});

export const IdempotencyPayloadMismatchError = z.strictObject({
  code: z.enum(['IDEMPOTENCY_PAYLOAD_MISMATCH']),
  message: z.string(),
});

export const ValidationError = z.strictObject({
  code: z.enum(['VALIDATION_ERROR']),
  message: z.string(),
  details: z.record(z.string(), z.unknown()).optional(),
});

export const InternalError = z.strictObject({
  code: z.enum(['INTERNAL_ERROR']),
  message: z.string(),
});


// ── Case Participant Core schemas (Slice 4) ─────────────────
// Frozen surface: specs/004-case-participant-core/contracts/participation-api.openapi.yaml.
// Idempotency is intentionally a request-body field for these four Slice 4
// commands; client-controlled family/case/state/TTL fields are rejected.

export const CaseParticipationState = z.enum([
  'PENDING', 'ACTIVE', 'DECLINED', 'EXPIRED', 'WITHDRAWN',
]);
export type CaseParticipationStateType = z.infer<typeof CaseParticipationState>;

const ParticipationIdempotencyKey = z.string().min(8).max(128);

export const CreateParticipationInviteRequest = z.strictObject({
  personId: z.string().uuid(),
  idempotencyKey: ParticipationIdempotencyKey,
});
export type CreateParticipationInviteRequestType =
  z.infer<typeof CreateParticipationInviteRequest>;

export const AcceptParticipationRequest = z.strictObject({
  idempotencyKey: ParticipationIdempotencyKey,
});
export type AcceptParticipationRequestType = z.infer<typeof AcceptParticipationRequest>;

export const DeclineParticipationRequest = z.strictObject({
  idempotencyKey: ParticipationIdempotencyKey,
});
export type DeclineParticipationRequestType = z.infer<typeof DeclineParticipationRequest>;

export const WithdrawParticipationRequest = z.strictObject({
  idempotencyKey: ParticipationIdempotencyKey,
});
export type WithdrawParticipationRequestType = z.infer<typeof WithdrawParticipationRequest>;

export const ParticipationNotice = z.strictObject({
  version: z.string().min(1),
  title: z.string().min(1),
  body: z.string().min(1),
});
export type ParticipationNoticeType = z.infer<typeof ParticipationNotice>;

export const CreateParticipationInviteResponse = z.strictObject({
  participationId: z.string().uuid(),
  caseId: z.string().uuid(),
  personId: z.string().uuid(),
  state: z.enum(['PENDING']),
  inviteToken: z.string().min(1).max(256),
  expiresAt: z.string().datetime(),
  createdAt: z.string().datetime(),
});
export type CreateParticipationInviteResponseType =
  z.infer<typeof CreateParticipationInviteResponse>;

export const ParticipationInvitePublicView = z.strictObject({
  participationId: z.string().uuid(),
  state: z.enum(['PENDING']),
  expiresAt: z.string().datetime(),
  notice: ParticipationNotice,
});
export type ParticipationInvitePublicViewType =
  z.infer<typeof ParticipationInvitePublicView>;

export const ParticipationResource = z.strictObject({
  id: z.string().uuid(),
  caseId: z.string().uuid(),
  personId: z.string().uuid(),
  state: CaseParticipationState,
  createdAt: z.string().datetime(),
  acceptedAt: z.string().datetime().nullable().optional(),
  declinedAt: z.string().datetime().nullable().optional(),
  expiredAt: z.string().datetime().nullable().optional(),
  withdrawnAt: z.string().datetime().nullable().optional(),
});
export type ParticipationResourceType = z.infer<typeof ParticipationResource>;

export const ParticipationAlreadyExistsError = z.strictObject({
  code: z.enum(['PARTICIPATION_ALREADY_EXISTS']),
  message: z.string(),
});
export const ParticipationTargetIneligibleError = z.strictObject({
  code: z.enum(['PARTICIPATION_TARGET_INELIGIBLE']),
  message: z.string(),
});
export const InvitationNotAvailableError = z.strictObject({
  code: z.enum(['INVITATION_NOT_AVAILABLE']),
  message: z.string(),
});
export const ParticipationNotFoundError = z.strictObject({
  code: z.enum(['PARTICIPATION_NOT_FOUND']),
  message: z.string(),
});
export const ParticipationValidationError = z.strictObject({
  code: z.enum(['VALIDATION_ERROR']),
  message: z.string(),
});
export type ParticipationValidationErrorType = z.infer<typeof ParticipationValidationError>;

export const ParticipationStateConflictError = z.strictObject({
  code: z.enum(['PARTICIPATION_STATE_CONFLICT']),
  message: z.string(),
  currentState: CaseParticipationState,
});
// ── Problem Formulation Core schemas (Slice 8) ─────────────
// Frozen surface: specs/008-problem-formulation-core/contracts/problem-formulation-api.openapi.yaml.
// Every DB-backed integer version is bounded to PostgreSQL `integer` (1..2147483647);
// `If-Match` parsing/range validation is a separate route gate before SQL.

export const PG_INTEGER_MAX = 2147483647;

export const ProblemFormulationStatus = z.enum([
  'DRAFT', 'PRESENTED', 'CONFIRMED', 'DISPUTED', 'NEEDS_REVIEW', 'SUPERSEDED',
]);
export type ProblemFormulationStatusType = z.infer<typeof ProblemFormulationStatus>;

export const EvidenceRef = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('DIALOGUE_MESSAGE'), id: z.string().uuid() }),
  z.strictObject({ type: z.literal('ASSERTION'), id: z.string().uuid() }),
  z.strictObject({ type: z.literal('OBSERVATION'), id: z.string().uuid() }),
]);
export type EvidenceRefType = z.infer<typeof EvidenceRef>;

export const PrimaryProblem = z.strictObject({
  text: z.string().min(1),
  evidenceRefs: z.array(EvidenceRef).min(1),
});
export type PrimaryProblemType = z.infer<typeof PrimaryProblem>;

export const KeyFactor = z.strictObject({
  text: z.string().min(1),
  evidenceRefs: z.array(EvidenceRef).min(1),
});
export type KeyFactorType = z.infer<typeof KeyFactor>;

export const UnknownItem = z.strictObject({
  topic: z.string().min(1),
  state: z.enum(['UNKNOWN', 'NOT_COLLECTED', 'DECLINED']),
  evidenceRefs: z.array(EvidenceRef),
});
export type UnknownItemType = z.infer<typeof UnknownItem>;

function refKey(ref: { type: string; id: string }): string {
  return `${ref.type}:${ref.id.toLowerCase()}`;
}

export const ConflictItem = z
  .strictObject({
    topic: z.string().min(1),
    conflictGroupId: z.string().uuid().optional(),
    evidenceRefs: z.array(EvidenceRef).optional(),
  })
  .superRefine((value, ctx) => {
    const refs = value.evidenceRefs ?? [];
    if (value.conflictGroupId === undefined && refs.length < 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'evidenceRefs must contain at least two distinct refs when conflictGroupId is absent',
        path: ['evidenceRefs'],
      });
    }
    const keys = refs.map(refKey);
    if (new Set(keys).size !== keys.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'evidenceRefs must not contain duplicate refs',
        path: ['evidenceRefs'],
      });
    }
  });
export type ConflictItemType = z.infer<typeof ConflictItem>;

export const TextCondition = z.strictObject({
  text: z.string().min(1),
});
export type TextConditionType = z.infer<typeof TextCondition>;

export const UserResponse = z.strictObject({
  kind: z.enum(['CONFIRM', 'DISPUTE', 'CORRECTION']),
  actorPersonId: z.string().uuid(),
  respondedAt: z.string().datetime(),
  note: z.string().min(1).optional(),
});
export type UserResponseType = z.infer<typeof UserResponse>;

export const DependencyRef = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('EVIDENCE'), evidence: EvidenceRef }),
  z.strictObject({
    type: z.literal('CONSENT'),
    id: z.string().uuid(),
    version: z.number().int().min(1).max(PG_INTEGER_MAX).optional(),
  }),
  z.strictObject({
    type: z.enum(['POLICY', 'PACKAGE', 'CONTENT_VERSION']),
    key: z.string().min(1),
    version: z.string().min(1),
  }),
]);
export type DependencyRefType = z.infer<typeof DependencyRef>;

export const ProblemFormulationContent = z.strictObject({
  primaryProblem: PrimaryProblem,
  keyFactors: z.array(KeyFactor),
  evidenceRefs: z.array(EvidenceRef).min(1),
  unknowns: z.array(UnknownItem),
  conflicts: z.array(ConflictItem),
  sceneFit: z.string().min(1),
  alternativeExplanations: z.array(TextCondition),
  reassessmentConditions: z.array(TextCondition),
  exitConditions: z.array(TextCondition),
  dependencyRefs: z.array(DependencyRef),
});
export type ProblemFormulationContentType = z.infer<typeof ProblemFormulationContent>;

export const ProblemFormulation = z.strictObject({
  id: z.string().uuid(),
  caseId: z.string().uuid(),
  version: z.number().int().min(1).max(PG_INTEGER_MAX),
  status: ProblemFormulationStatus,
  primaryProblem: PrimaryProblem,
  keyFactors: z.array(KeyFactor),
  evidenceRefs: z.array(EvidenceRef).min(1),
  unknowns: z.array(UnknownItem),
  conflicts: z.array(ConflictItem),
  sceneFit: z.string().min(1),
  alternativeExplanations: z.array(TextCondition),
  reassessmentConditions: z.array(TextCondition),
  exitConditions: z.array(TextCondition),
  userResponse: UserResponse.nullable(),
  confirmedBy: z.string().uuid().nullable(),
  confirmedAt: z.string().datetime().nullable(),
  dependencyRefs: z.array(DependencyRef),
  supersedesVersion: z.number().int().min(1).max(PG_INTEGER_MAX).nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type ProblemFormulationType = z.infer<typeof ProblemFormulation>;

export const ProblemFormulationCurrentResponse = z.strictObject({
  caseVersion: z.number().int().min(1).max(PG_INTEGER_MAX),
  current: ProblemFormulation.nullable(),
});
export type ProblemFormulationCurrentResponseType =
  z.infer<typeof ProblemFormulationCurrentResponse>;

export const ProblemFormulationResponseRequest = z.strictObject({
  note: z.string().min(1).optional(),
});
export type ProblemFormulationResponseRequestType =
  z.infer<typeof ProblemFormulationResponseRequest>;

export const ProblemFormulationContentChanges = z
  .strictObject({
    primaryProblem: PrimaryProblem.optional(),
    keyFactors: z.array(KeyFactor).optional(),
    evidenceRefs: z.array(EvidenceRef).min(1).optional(),
    unknowns: z.array(UnknownItem).optional(),
    conflicts: z.array(ConflictItem).optional(),
    sceneFit: z.string().min(1).optional(),
    alternativeExplanations: z.array(TextCondition).optional(),
    reassessmentConditions: z.array(TextCondition).optional(),
    exitConditions: z.array(TextCondition).optional(),
    dependencyRefs: z.array(DependencyRef).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'changes must contain at least one field',
  });
export type ProblemFormulationContentChangesType =
  z.infer<typeof ProblemFormulationContentChanges>;

export const ProblemFormulationCorrectionRequest = z.strictObject({
  changes: ProblemFormulationContentChanges,
  note: z.string().min(1).optional(),
});
export type ProblemFormulationCorrectionRequestType =
  z.infer<typeof ProblemFormulationCorrectionRequest>;
export const CurrentFamilyAmbiguousError = z.strictObject({
  code: z.enum(['CURRENT_FAMILY_AMBIGUOUS']),
  message: z.string(),
});

export const ProblemFormulationConflictError = z.strictObject({
  code: z.enum([
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
  ]),
  message: z.string(),
});
export type ProblemFormulationConflictErrorType =
  z.infer<typeof ProblemFormulationConflictError>;

export const ProblemFormulationValidationError = z.strictObject({
  code: z.enum(['VALIDATION_ERROR', 'PROBLEM_FORMULATION_EVIDENCE_INVALID']),
  message: z.string(),
});
export type ProblemFormulationValidationErrorType =
  z.infer<typeof ProblemFormulationValidationError>;
