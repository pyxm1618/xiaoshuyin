/**
 * Slice 1 Consent Owner — internal purpose-scoped decision command.
 *
 * This is the ONE authoritative implementation that lets the existing Consent
 * owner carry the Digital Use 01004 purpose-scoped supplemental-assessment
 * decision (`GRANTED` / `DECLINED` / `REVOKED`). It is internal-only: there is no
 * public Consent API for this purpose, and it is not a generic consent engine.
 *
 * Hard boundaries (Frozen Spec FR-035–FR-039, FR-046–FR-050, FR-064–FR-070):
 *   - runs inside the CALLER-OWNED authoritative transaction / checked-out
 *     client; it never opens, commits or rolls back a transaction, never checks
 *     out a second client and never starts a nested idempotency command;
 *   - request-level idempotency stays the outer Scene command's responsibility
 *     (Slice 12), implemented with Slice 12 owned tables;
 *   - replay / concurrency safety comes only from a transaction-scoped scope
 *     lock, the version chain, uniqueness constraints and the DB guards;
 *   - actor == subject: the server-verified actor is the Consent subject, and
 *     no client-supplied / derived target subject exists for this purpose;
 *   - disclosure identity must be server-resolved and approved. There is no
 *     approved 01004 disclosure artifact in this repository yet, so the default
 *     authority always fails closed.
 */

import type { PoolClient } from 'pg';
import {
  SupplementalAssessmentConsentEvidence,
  type SupplementalAssessmentConsentEvidenceType,
} from '@xiaoshuyin/contracts';
import { buildSupplementalAssessmentConsentEvidence } from './evidence.js';

export type PurposeScopedConsentTx = PoolClient;

export const DIGITAL_USE_SUPPLEMENTAL_ASSESSMENT =
  'DIGITAL_USE_SUPPLEMENTAL_ASSESSMENT' as const;
export type SupplementalAssessmentPurpose = typeof DIGITAL_USE_SUPPLEMENTAL_ASSESSMENT;

export type SupplementalAssessmentDecision = 'GRANTED' | 'DECLINED' | 'REVOKED';

export type PurposeScopedConsentErrorCode =
  | 'CONSENT_INPUT_INVALID'
  | 'CONSENT_PURPOSE_UNSUPPORTED'
  | 'CONSENT_AUTHORIZATION_CONTEXT_MISSING'
  | 'CONSENT_DISCLOSURE_NOT_APPROVED'
  | 'CONSENT_SCOPE_UNAVAILABLE'
  | 'CONSENT_ACTOR_SUBJECT_INVALID'
  | 'CONSENT_STALE_VERSION'
  | 'CONSENT_DECISION_CONFLICT';

/**
 * Typed fail-closed error for the internal owner seam. Callers map it to their
 * own command outcome; it is not a public HTTP contract.
 */
export class PurposeScopedConsentError extends Error {
  readonly code: PurposeScopedConsentErrorCode;

  constructor(code: PurposeScopedConsentErrorCode, message: string) {
    super(message);
    this.name = 'PurposeScopedConsentError';
    this.code = code;
  }
}

// ── Approved disclosure authority (server-owned) ────────────────────────────

export interface ApprovedSupplementalAssessmentDisclosure {
  readonly purpose: SupplementalAssessmentPurpose;
  readonly reference: string;
  readonly version: string;
  readonly hash: string;
}

export interface SupplementalAssessmentDisclosureAuthority {
  /**
   * Resolve the CURRENT server-approved disclosure for the exact submitted
   * identity. Returning null means "not approved" and the owner fails closed.
   */
  resolveApprovedDisclosure(submitted: {
    readonly purpose: SupplementalAssessmentPurpose;
    readonly reference: string;
    readonly version: string;
    readonly hash: string;
  }): ApprovedSupplementalAssessmentDisclosure | null;
}

/**
 * Default authority: the repository only contains the formal guardian notice
 * catalog, which MUST NOT be reused as the 01004 disclosure. With no approved
 * 01004 disclosure artifact, every supplemental decision fails closed. Slice 12
 * must supply its own approved authority before 01004 can execute.
 */
export const NO_APPROVED_SUPPLEMENTAL_ASSESSMENT_DISCLOSURE_AUTHORITY: SupplementalAssessmentDisclosureAuthority =
  Object.freeze({
    resolveApprovedDisclosure: () => null,
  });

// ── Input / output ──────────────────────────────────────────────────────────

export interface RecordPurposeScopedConsentDecisionInput {
  /** Server-verified Family scope. */
  readonly familyId: string;
  /** Server-verified Case scope; one decision belongs to exactly one Case. */
  readonly caseId: string;
  /** Server-verified authenticated + authorized actor (this IS the subject). */
  readonly actor: {
    readonly accountId: string;
    readonly personId: string;
  };
  readonly purpose: SupplementalAssessmentPurpose;
  readonly decision: SupplementalAssessmentDecision;
  /**
   * null  -> caller expects that no current decision exists yet.
   * number -> caller expects exactly that current version.
   */
  readonly expectedVersion: number | null;
  /** Server-resolved approved disclosure identity the user actually saw. */
  readonly disclosure: {
    readonly reference: string;
    readonly version: string;
    readonly hash: string;
  };
  /** Hash of the versioned confirmation / refusal statement the user accepted. */
  readonly confirmationStatementHash: string;
  /**
   * Proof supplied by the upstream Slice 12 command that the exact 01004
   * Scene/Assessment authorization already passed. The Consent owner does not
   * rebuild that authorization tree; it only refuses to proceed without it.
   */
  readonly sceneAuthorization: {
    readonly nodeCode: '01004';
    readonly verified: true;
  };
  /**
   * Server-supplied evidence request metadata. Raw IP / User-Agent are hashed
   * with the deployment pepper and never persisted as-is.
   */
  readonly evidence: {
    readonly clientIp: string | null;
    readonly userAgent: string | null;
    readonly pepper: string;
  };
}

export interface PurposeScopedConsentDecisionReference {
  readonly consentRecordId: string;
  readonly purpose: SupplementalAssessmentPurpose;
  readonly caseId: string;
  /** Always the same Person as the decision actor (actor == subject). */
  readonly decisionActorPersonId: string;
  readonly decision: SupplementalAssessmentDecision;
  readonly version: number;
  readonly decidedAt: string;
  readonly supersedesId: string | null;
  /** True when the same semantic decision was already current (no new row). */
  readonly replayed: boolean;
}

interface CurrentSupplementalConsentRow {
  id: string;
  decision: SupplementalAssessmentDecision;
  version: number;
  decided_at: Date;
  supersedes_id: string | null;
  notice_version: string;
  notice_hash: string;
  confirmation_statement_hash: string;
}

const SHA256_HEX = /^[0-9a-f]{64}$/;

const FORBIDDEN_INPUT_KEYS = [
  // No independent Consent subject may ever be supplied or derived here.
  'subjectPersonId',
  'subject_person_id',
  'consentSubjectPersonId',
  'decisionSubjectPersonId',
  'targetPersonId',
  'target_person_id',
  // No caller-authored disclosure content is authoritative.
  'disclosureText',
  'disclosure_text',
  'noticeBody',
  'notice_body',
  'noticeText',
  'notice_text',
] as const;

function fail(code: PurposeScopedConsentErrorCode, message: string): never {
  throw new PurposeScopedConsentError(code, message);
}

function assertNoForbiddenInput(input: RecordPurposeScopedConsentDecisionInput): void {
  for (const key of FORBIDDEN_INPUT_KEYS) {
    if (Object.prototype.hasOwnProperty.call(input as unknown as object, key)) {
      fail(
        'CONSENT_INPUT_INVALID',
        `Consent owner does not accept caller-supplied ${key}; actor identity is server-verified and equals the subject`
      );
    }
  }
}

function assertInputShape(input: RecordPurposeScopedConsentDecisionInput): void {
  if (input.purpose !== DIGITAL_USE_SUPPLEMENTAL_ASSESSMENT) {
    fail('CONSENT_PURPOSE_UNSUPPORTED', 'Consent owner only records the approved 01004 purpose');
  }
  if (
    input.decision !== 'GRANTED' &&
    input.decision !== 'DECLINED' &&
    input.decision !== 'REVOKED'
  ) {
    fail('CONSENT_INPUT_INVALID', 'Unsupported consent decision');
  }
  if (
    input.expectedVersion !== null &&
    (!Number.isInteger(input.expectedVersion) || input.expectedVersion < 1)
  ) {
    fail('CONSENT_INPUT_INVALID', 'expectedVersion must be null or a positive integer');
  }
  if (
    typeof input.familyId !== 'string' ||
    typeof input.caseId !== 'string' ||
    typeof input.actor?.accountId !== 'string' ||
    typeof input.actor?.personId !== 'string'
  ) {
    fail('CONSENT_SCOPE_UNAVAILABLE', 'Family, Case and authenticated actor are required');
  }
  if (
    typeof input.disclosure?.reference !== 'string' ||
    input.disclosure.reference.length === 0 ||
    input.disclosure.reference.length > 120 ||
    typeof input.disclosure.version !== 'string' ||
    input.disclosure.version.length === 0 ||
    input.disclosure.version.length > 64 ||
    !SHA256_HEX.test(input.disclosure.hash ?? '')
  ) {
    fail('CONSENT_DISCLOSURE_NOT_APPROVED', 'Disclosure identity is missing or malformed');
  }
  if (!SHA256_HEX.test(input.confirmationStatementHash ?? '')) {
    fail('CONSENT_INPUT_INVALID', 'confirmationStatementHash must be a sha256 hex digest');
  }
  if (
    input.sceneAuthorization?.nodeCode !== '01004' ||
    input.sceneAuthorization?.verified !== true
  ) {
    fail(
      'CONSENT_AUTHORIZATION_CONTEXT_MISSING',
      'The upstream 01004 Scene/Assessment authorization has not been verified'
    );
  }
}

function resolveApprovedDisclosure(
  authority: SupplementalAssessmentDisclosureAuthority,
  submitted: { reference: string; version: string; hash: string }
): ApprovedSupplementalAssessmentDisclosure {
  let approved: ApprovedSupplementalAssessmentDisclosure | null = null;
  try {
    approved = authority.resolveApprovedDisclosure({
      purpose: DIGITAL_USE_SUPPLEMENTAL_ASSESSMENT,
      reference: submitted.reference,
      version: submitted.version,
      hash: submitted.hash,
    });
  } catch {
    approved = null;
  }
  if (
    approved === null ||
    approved.purpose !== DIGITAL_USE_SUPPLEMENTAL_ASSESSMENT ||
    approved.reference !== submitted.reference ||
    approved.version !== submitted.version ||
    approved.hash !== submitted.hash
  ) {
    fail(
      'CONSENT_DISCLOSURE_NOT_APPROVED',
      'No server-approved 01004 disclosure matches the submitted identity'
    );
  }
  return approved;
}

async function assertVerifiedScope(
  tx: PurposeScopedConsentTx,
  input: RecordPurposeScopedConsentDecisionInput
): Promise<void> {
  // Family must be visible in the caller-owned RLS context.
  const family = await tx.query('SELECT 1 FROM families WHERE id = $1', [input.familyId]);
  if (family.rows.length === 0) {
    fail('CONSENT_SCOPE_UNAVAILABLE', 'Verified Family scope is unavailable');
  }

  const kase = await tx.query('SELECT family_id FROM cases WHERE id = $1', [input.caseId]);
  if (kase.rows.length === 0 || kase.rows[0].family_id !== input.familyId) {
    fail('CONSENT_SCOPE_UNAVAILABLE', 'Case does not belong to the verified Family');
  }

  // actor == subject: the authenticated actor must be the Person of that account
  // and a member of the same Family. Family membership alone is still not
  // treated as authorization; the upstream Scene authorization is required.
  const actorPerson = await tx.query('SELECT account_id FROM persons WHERE id = $1', [
    input.actor.personId,
  ]);
  if (
    actorPerson.rows.length === 0 ||
    actorPerson.rows[0].account_id !== input.actor.accountId
  ) {
    fail(
      'CONSENT_ACTOR_SUBJECT_INVALID',
      'Decision actor is not the authenticated Person of the supplied account'
    );
  }

  const membership = await tx.query(
    'SELECT 1 FROM family_members WHERE family_id = $1 AND person_id = $2',
    [input.familyId, input.actor.personId]
  );
  if (membership.rows.length === 0) {
    fail(
      'CONSENT_ACTOR_SUBJECT_INVALID',
      'Decision actor is not a member of the verified Family'
    );
  }
}

async function lockScope(
  tx: PurposeScopedConsentTx,
  input: RecordPurposeScopedConsentDecisionInput
): Promise<void> {
  // Transaction-scoped serialization of one logical scope:
  // Family + Case + purpose + actor person (actor == subject).
  // It is not a business-command idempotency lock and writes no table.
  await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0::bigint))', [
    `consent:${DIGITAL_USE_SUPPLEMENTAL_ASSESSMENT}:${input.familyId}:${input.caseId}:${input.actor.personId}`,
  ]);
}

async function readCurrentDecision(
  tx: PurposeScopedConsentTx,
  input: RecordPurposeScopedConsentDecisionInput
): Promise<CurrentSupplementalConsentRow | null> {
  const { rows } = await tx.query(
    `SELECT c.id, c.decision, c.version, c.decided_at, c.supersedes_id,
            c.notice_version, c.notice_hash, c.confirmation_statement_hash
       FROM consent_records c
      WHERE c.family_id = $1
        AND c.case_id = $2
        AND c.purpose = $3
        AND c.decision_actor_person_id = $4
        AND NOT EXISTS (SELECT 1 FROM consent_records s WHERE s.supersedes_id = c.id)
      FOR UPDATE OF c`,
    [
      input.familyId,
      input.caseId,
      DIGITAL_USE_SUPPLEMENTAL_ASSESSMENT,
      input.actor.personId,
    ]
  );
  if (rows.length === 0) return null;
  if (rows.length > 1) {
    // Defensive: the DB chain constraints make this impossible. Never guess.
    fail('CONSENT_DECISION_CONFLICT', 'Multiple current supplemental decisions exist');
  }
  return rows[0] as CurrentSupplementalConsentRow;
}

function sameSemanticPayload(
  current: CurrentSupplementalConsentRow,
  input: RecordPurposeScopedConsentDecisionInput
): boolean {
  return (
    current.decision === input.decision &&
    current.notice_version === input.disclosure.version &&
    current.notice_hash === input.disclosure.hash &&
    current.confirmation_statement_hash === input.confirmationStatementHash
  );
}

function referenceFromRow(
  row: {
    id: string;
    decision: SupplementalAssessmentDecision;
    version: number;
    decided_at: Date;
    supersedes_id: string | null;
  },
  input: RecordPurposeScopedConsentDecisionInput,
  replayed: boolean
): PurposeScopedConsentDecisionReference {
  return {
    consentRecordId: row.id,
    purpose: DIGITAL_USE_SUPPLEMENTAL_ASSESSMENT,
    caseId: input.caseId,
    decisionActorPersonId: input.actor.personId,
    decision: row.decision,
    version: row.version,
    decidedAt: new Date(row.decided_at).toISOString(),
    supersedesId: row.supersedes_id,
    replayed,
  };
}

function auditEventType(decision: SupplementalAssessmentDecision): string {
  switch (decision) {
    case 'GRANTED':
      return 'CONSENT_SUPPLEMENTAL_ASSESSMENT_GRANTED';
    case 'DECLINED':
      return 'CONSENT_SUPPLEMENTAL_ASSESSMENT_DECLINED';
    case 'REVOKED':
      return 'CONSENT_SUPPLEMENTAL_ASSESSMENT_REVOKED';
  }
}

// ── The one authoritative owner seam ────────────────────────────────────────

/**
 * Record one purpose-scoped supplemental-assessment consent decision in the ONE
 * authoritative Consent ledger.
 *
 * The caller MUST already hold an authoritative transaction with its verified
 * Family/identity RLS context. This function uses that client only: it never
 * opens, commits, rolls back, checks out another client or starts an idempotency
 * command. If the outer transaction later rolls back, every row written here
 * (including the audit event) disappears with it.
 */
export async function recordPurposeScopedConsentDecision(
  tx: PurposeScopedConsentTx,
  input: RecordPurposeScopedConsentDecisionInput,
  disclosureAuthority: SupplementalAssessmentDisclosureAuthority =
    NO_APPROVED_SUPPLEMENTAL_ASSESSMENT_DISCLOSURE_AUTHORITY
): Promise<PurposeScopedConsentDecisionReference> {
  assertNoForbiddenInput(input);
  assertInputShape(input);

  // Disclosure owner capability gate: fail closed BEFORE any read/write.
  const approvedDisclosure = resolveApprovedDisclosure(disclosureAuthority, input.disclosure);

  await assertVerifiedScope(tx, input);
  await lockScope(tx, input);

  const current = await readCurrentDecision(tx, input);

  if (current === null) {
    if (input.expectedVersion !== null) {
      fail('CONSENT_STALE_VERSION', 'No current decision exists for the expected version');
    }
    if (input.decision === 'REVOKED') {
      // A first refusal is DECLINED, never REVOKED.
      fail('CONSENT_DECISION_CONFLICT', 'REVOKED requires an existing current GRANTED decision');
    }
  } else {
    if (input.expectedVersion !== current.version) {
      fail('CONSENT_STALE_VERSION', 'expectedVersion is not the current consent version');
    }

    if (input.decision === current.decision) {
      if (sameSemanticPayload(current, input)) {
        // Replay-safe no-op: no second row, no duplicate audit event.
        return referenceFromRow(current, input, true);
      }
      fail(
        'CONSENT_DECISION_CONFLICT',
        'The current decision has a different semantic payload'
      );
    }

    if (input.decision === 'DECLINED') {
      // An explicit refusal after a current truth exists is not a revocation and
      // must never be silently rewritten to REVOKED.
      fail(
        'CONSENT_DECISION_CONFLICT',
        'DECLINED is only a first-decision refusal; revoke must be explicit'
      );
    }
    if (input.decision === 'REVOKED' && current.decision !== 'GRANTED') {
      fail('CONSENT_DECISION_CONFLICT', 'REVOKED requires a current GRANTED decision');
    }
    if (input.decision === 'GRANTED' && current.decision === 'REVOKED') {
      // The Frozen Spec defines DECLINED -> GRANTED and GRANTED -> REVOKED.
      // It does not define a re-grant after formal revocation: fail closed
      // instead of inventing a transition.
      fail(
        'CONSENT_DECISION_CONFLICT',
        'GRANTED after REVOKED is not an approved supplemental transition'
      );
    }
  }

  const decidedAt = new Date();
  const version = current === null ? 1 : current.version + 1;
  const supersedesId = current?.id ?? null;

  const evidence: SupplementalAssessmentConsentEvidenceType =
    buildSupplementalAssessmentConsentEvidence({
      decision: input.decision,
      decisionActorPersonId: input.actor.personId,
      caseId: input.caseId,
      disclosureReference: approvedDisclosure.reference,
      disclosureVersion: approvedDisclosure.version,
      disclosureHash: approvedDisclosure.hash,
      confirmationStatementHash: input.confirmationStatementHash,
      decidedAt,
      clientIp: input.evidence.clientIp,
      userAgent: input.evidence.userAgent,
      pepper: input.evidence.pepper,
    });
  // Defense in depth: the stored evidence is always the schema-validated object.
  SupplementalAssessmentConsentEvidence.parse(evidence);

  let inserted: {
    id: string;
    decision: SupplementalAssessmentDecision;
    version: number;
    decided_at: Date;
    supersedes_id: string | null;
  };
  try {
    const { rows } = await tx.query(
      `INSERT INTO consent_records (
         family_id, guardian_person_id, guardian_account_id, purpose, decision, version,
         onboarding_request_id, bound_person_id, bound_at,
         case_id, decision_actor_person_id, decision_actor_account_id,
         disclosure_reference, confirmation_statement_hash,
         notice_version, notice_hash, policy_version, evidence, decided_at, supersedes_id
       ) VALUES (
         $1, NULL, NULL, $2, $3, $4,
         NULL, NULL, NULL,
         $5, $6, $7,
         $8, $9,
         $10, $11, $12, $13, $14, $15
       )
       RETURNING id, decision, version, decided_at, supersedes_id`,
      [
        input.familyId,
        DIGITAL_USE_SUPPLEMENTAL_ASSESSMENT,
        input.decision,
        version,
        input.caseId,
        input.actor.personId,
        input.actor.accountId,
        approvedDisclosure.reference,
        input.confirmationStatementHash,
        approvedDisclosure.version,
        approvedDisclosure.hash,
        approvedDisclosure.version,
        JSON.stringify(evidence),
        decidedAt,
        supersedesId,
      ]
    );
    inserted = rows[0];
  } catch (error: unknown) {
    const pgCode = (error as { code?: string }).code;
    if (pgCode === '23505' || pgCode === '23514') {
      // A concurrent writer won the same version/scope, or a DB invariant
      // rejected the semantic transition. Both are fail-closed conflicts.
      fail('CONSENT_DECISION_CONFLICT', 'The supplemental consent decision conflicts');
    }
    throw error;
  }

  await tx.query(
    `INSERT INTO business_audit_events
       (family_id, actor_account_id, event_type, resource_type, resource_id)
     VALUES ($1, $2, $3, 'CONSENT', $4)`,
    [input.familyId, input.actor.accountId, auditEventType(inserted.decision), inserted.id]
  );

  return referenceFromRow(inserted, input, false);
}