/**
 * Problem Formulation application service (Slice 8).
 *
 * One canonical transaction/lock/idempotency ordering for the four public
 * commands and the three internal domain commands. No SQL lives here.
 */

import type pg from 'pg';
import {
  assertCaseGuards,
  assertStatusAllows,
  assertTransferableStatus,
  assertVersionBound,
  bumpCaseVersionWithoutPhaseChange,
  canonicalDependencies,
  canonicalEvidenceKey,
  caseVersionEtag,
  contentOf,
  getCaseById,
  deriveMandatoryDependencyRefs,
  deriveProcessingPersonIds,
  getCurrentProblemFormulation,
  getProblemFormulationByVersion,
  hasTraceableProblemStatement,
  insertProblemFormulationAudit,
  insertProblemFormulationCaseEvent,
  insertProblemFormulationVersion,
  isDependencySubset,
  lockCaseForProblemFormulation,
  lockCurrentProblemFormulation,
  markCurrentFormulationSuperseded,
  mergeCorrection,
  nextFormulationVersion,
  ProblemFormulationError,
  resolveActiveCaseParticipantPersonIds,
  resolveEvidenceRefs,
  resolveTraceableStatement,
  toProblemFormulationDto,
  transitionProblemFormulationStatus,
  validateFormulationContent,
  revalidateStoredEvidenceDependencies,
  reassessmentBasisFingerprint,
  validateReassessmentBasis,
  advanceCasePhaseAndVersion,
  pfError,
  type AuthoritativeEvidenceSet,
  type DependencyRef,
  type EvidenceRef,
  type ProblemFormulationContent,
  type ProblemFormulationDto,
  type ProblemFormulationRow,
  type ReassessmentBasis,
  type UserResponse,
} from '@xiaoshuyin/domain';
import {
  assertMinorProcessingAllowed,
  getComplianceProfileForUpdate,
  getConsentRecordForGate,
  getCurrentNoticeHash,
  type AgeBand,
} from '@xiaoshuyin/compliance';
import {
  acquireIdempotencySlot,
  caseIdempotencyKeyBytes,
  completeIdempotency,
  hashPayload,
  lockFamilyForPrimaryDecision,
  type IdempotencySlot,
} from '@xiaoshuyin/domain';
import { withRlsTransaction } from '../db/tx.js';
import { isKnownAuthorizationDenial, requireFamilyAction } from '../authz.js';
import { toHttpError } from '../plugins/error-handler.js';

export interface ServiceActor {
  accountId: string;
  personId: string;
}

export interface Envelope {
  caseVersion: number;
  current: ProblemFormulationDto | null;
}

function httpError(code: string, message?: string): Error & { statusCode: number; code: string } {
  const base = toHttpError(code, message);
  return Object.assign(new Error(base.message), {
    statusCode: base.statusCode,
    code: base.code,
  });
}

function mapServiceError(error: unknown): never {
  if (error instanceof ProblemFormulationError) {
    if (error.code === 'CORRECTION_NOOP' || error.code === 'REASSESSMENT_BASIS_INVALID') {
      throw httpError('VALIDATION_ERROR', error.message);
    }
    const base = toHttpError(error.code, error.message);
    throw Object.assign(new Error(base.message), {
      statusCode: base.statusCode,
      code: base.code,
    });
  }
  throw error;
}

async function authorize(
  tx: pg.PoolClient,
  input: {
    actor: ServiceActor;
    familyId: string;
    caseId: string;
    action:
      | 'CASE_START_ASSESSMENT'
      | 'CASE_PRESENT_PROBLEM_FORMULATION'
      | 'CASE_CONFIRM_PROBLEM_FORMULATION'
      | 'CASE_DISPUTE_PROBLEM_FORMULATION'
      | 'CASE_CORRECT_PROBLEM_FORMULATION'
      | 'CASE_REASSESS_FROM_FORMULATION'
      | 'CASE_READ';
  }
): Promise<void> {
  try {
    await requireFamilyAction(tx, {
      accountId: input.actor.accountId,
      personId: input.actor.personId,
      familyId: input.familyId,
      action: input.action,
      purpose: 'FAMILY_MANAGEMENT',
      resource: { type: 'CASE', familyId: input.familyId, caseId: input.caseId },
      caseId: input.caseId,
    });
  } catch (error) {
    if (!isKnownAuthorizationDenial(error)) throw error;
    throw httpError('CASE_NOT_FOUND', 'Case not found');
  }
}

interface ComplianceOutcome {
  under14Consents: { id: string; version: number }[];
}

async function runComplianceGate(
  tx: pg.PoolClient,
  personIds: readonly string[],
  mode: 'INTERNAL' | 'PUBLIC' = 'INTERNAL'
): Promise<ComplianceOutcome> {
  const under14Consents: { id: string; version: number }[] = [];

  for (const personId of [...new Set(personIds)].sort()) {
    const profileRow = await getComplianceProfileForUpdate(tx, personId);
    const profile = profileRow
      ? {
          ageBand: profileRow.age_band as AgeBand,
          minorMode: profileRow.minor_mode as boolean,
          guardianPersonId: profileRow.guardian_person_id as string | null,
          guardianConsentRecordId: profileRow.guardian_consent_record_id as string | null,
          guardianConsentVersion: profileRow.guardian_consent_version as number | null,
          verifiedSource: profileRow.verified_source as string,
        }
      : null;

    const consentRow =
      profile?.guardianConsentRecordId
        ? await getConsentRecordForGate(tx, profile.guardianConsentRecordId)
        : null;
    const consent = consentRow
      ? {
          id: consentRow.id as string,
          version: consentRow.version as number,
          decision: consentRow.decision as 'GRANTED' | 'REVOKED',
          boundPersonId: consentRow.bound_person_id as string | null,
          noticeHash: consentRow.notice_hash as string,
          guardianPersonId: consentRow.guardian_person_id as string,
        }
      : null;

    const result = assertMinorProcessingAllowed(personId, {
      getProfile: () => profile,
      getConsentRecord: (id: string) =>
        consent && id.toLowerCase() === consent.id.toLowerCase() ? consent : null,
      getCurrentNoticeHash,
    });

    if (result.decision === 'BLOCK') {
      throw httpError(
        mode === 'PUBLIC' ? 'PROBLEM_FORMULATION_DEPENDENCY_INVALID' : result.reason,
        result.reason
      );
    }

    if (profile?.ageBand === 'UNDER_14') {
      if (
        !consent ||
        profile.guardianConsentRecordId === null ||
        profile.guardianConsentVersion === null ||
        consent.id.toLowerCase() !== profile.guardianConsentRecordId.toLowerCase() ||
        consent.version !== profile.guardianConsentVersion
      ) {
        throw httpError(
          mode === 'PUBLIC'
            ? 'PROBLEM_FORMULATION_DEPENDENCY_INVALID'
            : 'GUARDIAN_CONSENT_REQUIRED',
          'Stale consent pointer'
        );
      }
      under14Consents.push({
        id: profile.guardianConsentRecordId,
        version: profile.guardianConsentVersion,
      });
    }
  }

  return { under14Consents };
}

async function processingPersonIds(
  tx: pg.PoolClient,
  input: {
    actor: ServiceActor;
    caseRow: { id: string; created_by_person_id: string };
    authoritative: AuthoritativeEvidenceSet;
  }
): Promise<string[]> {
  const participants = await resolveActiveCaseParticipantPersonIds(tx, input.caseRow.id);
  return deriveProcessingPersonIds({
    actorPersonId: input.actor.personId,
    caseCreatorPersonId: input.caseRow.created_by_person_id,
    activeParticipantPersonIds: participants,
    authoritativeMembers: input.authoritative.members,
  });
}

function mandatoryDependencies(
  authoritative: AuthoritativeEvidenceSet,
  compliance: ComplianceOutcome
) {
  return canonicalDependencies(
    deriveMandatoryDependencyRefs({
      authoritativeRefs: authoritative.refs,
      under14Consents: compliance.under14Consents,
    })
  );
}

/**
 * S8-FINAL-03: Confirm revalidates every stored dependency that current main
 * can authoritatively resolve. The server-mandatory subset check alone cannot
 * prove that an extra stored dependency (e.g. an additional Evidence ref) is
 * still valid; it only proves the mandatory refs were not omitted.
 *
 * EVIDENCE resolution lives in the domain package (single SQL owner).
 * CONSENT is checked against the existing compliance truth: the record must
 * still exist, still validate its frozen evidence schema, still be GRANTED,
 * and still match the stored version when one was pinned. POLICY / PACKAGE /
 * CONTENT_VERSION stay preserved without a fabricated validator.
 */
async function revalidateStoredDependencies(
  tx: pg.PoolClient,
  caseId: string,
  dependencyRefs: readonly DependencyRef[]
): Promise<void> {
  await revalidateStoredEvidenceDependencies(tx, caseId, dependencyRefs);
  for (const dep of dependencyRefs) {
    if (dep.type !== 'CONSENT') continue;
    const consent = await getConsentRecordForGate(tx, dep.id);
    if (!consent) {
      throw pfError(
        'PROBLEM_FORMULATION_DEPENDENCY_INVALID',
        'stored Consent dependency is no longer valid'
      );
    }
    if (consent.decision !== 'GRANTED') {
      throw pfError(
        'PROBLEM_FORMULATION_DEPENDENCY_INVALID',
        'stored Consent dependency is not GRANTED'
      );
    }
    if (dep.version !== undefined && Number(consent.version) !== dep.version) {
      throw pfError(
        'PROBLEM_FORMULATION_DEPENDENCY_INVALID',
        'stored Consent dependency version is stale'
      );
    }
  }
}

function envelope(caseVersion: number, row: ProblemFormulationRow | null): Envelope {
  const dto = row ? toProblemFormulationDto(row) : null;
  return {
    caseVersion,
    current: dto && dto.status !== 'SUPERSEDED' ? dto : null,
  };
}

function requestHash(payload: Record<string, unknown>): string {
  return hashPayload(payload);
}

async function acquireSlot(
  tx: pg.PoolClient,
  actor: ServiceActor,
  commandType: string,
  keyBytes: Buffer,
  hash: string
): Promise<IdempotencySlot> {
  const slot = await acquireIdempotencySlot(tx, {
    actorAccountId: actor.accountId,
    commandType,
    keyBytes,
    requestHash: hash,
  });
  if (slot.kind === 'MISMATCH') {
    throw httpError('IDEMPOTENCY_PAYLOAD_MISMATCH', 'Idempotency payload mismatch');
  }
  if (slot.kind === 'POISONED' || slot.kind === 'CONTENTION') {
    throw httpError('INTERNAL_ERROR', 'Idempotency slot unavailable');
  }
  return slot;
}

export interface CommandResult {
  status: number;
  body: unknown;
  etag: string | null;
}

/**
 * Savepoint names must be unique per invocation so that a caller-owned
 * transaction (Slice 12 same-transaction composition) cannot collide with, or
 * accidentally roll back to, its own savepoints. A counter is sufficient and
 * deterministic: savepoints are scoped to one transaction, and names are never
 * persisted.
 */
let savepointSequence = 0;

function nextBusinessSavepointName(): string {
  savepointSequence += 1;
  return `pf_business_${savepointSequence}`;
}

async function executeIdempotentBusiness(
  tx: pg.PoolClient,
  input: {
    actor: ServiceActor;
    commandType: string;
    keyBytes: Buffer;
    slot: IdempotencySlot;
  },
  business: () => Promise<CommandResult>
): Promise<CommandResult> {
  if (input.slot.kind === 'REPLAY') {
    const body = input.slot.body as { caseVersion?: unknown } | null;
    return {
      status: input.slot.status,
      body: input.slot.body,
      etag:
        body && typeof body.caseVersion === 'number'
          ? caseVersionEtag(body.caseVersion)
          : null,
    };
  }
  const savepoint = nextBusinessSavepointName();
  await tx.query(`SAVEPOINT ${savepoint}`);
  try {
    const result = await business();
    await tx.query(`RELEASE SAVEPOINT ${savepoint}`);
    await completeIdempotency(tx, {
      actorAccountId: input.actor.accountId,
      commandType: input.commandType as never,
      keyBytes: input.keyBytes,
      status: result.status,
      body: result.body,
    });
    return result;
  } catch (error) {
    const typed =
      error instanceof ProblemFormulationError
        ? error.code === 'CORRECTION_NOOP' || error.code === 'REASSESSMENT_BASIS_INVALID'
          ? { statusCode: 422, code: 'VALIDATION_ERROR', message: error.message }
          : toHttpError(error.code, error.message)
        : (error as { statusCode?: number; code?: string; message?: string });
    if (
      typeof typed.statusCode === 'number' &&
      typed.statusCode >= 400 &&
      typed.statusCode < 500 &&
      typeof typed.code === 'string'
    ) {
      await tx.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
      await tx.query(`RELEASE SAVEPOINT ${savepoint}`);
      const body = { code: typed.code, message: typed.message ?? typed.code };
      await completeIdempotency(tx, {
        actorAccountId: input.actor.accountId,
        commandType: input.commandType as never,
        keyBytes: input.keyBytes,
        status: typed.statusCode,
        body,
      });
      return { status: typed.statusCode, body, etag: null };
    }
    throw error;
  }
}

async function lockFamily(
  tx: pg.PoolClient,
  familyId: string
): Promise<void> {
  const locked = await lockFamilyForPrimaryDecision(tx, familyId);
  if (!locked) throw httpError('INTERNAL_ERROR', 'Family not visible');
}

async function lockCase(
  tx: pg.PoolClient,
  caseId: string
) {
  const row = await lockCaseForProblemFormulation(tx, caseId);
  if (!row) throw httpError('CASE_NOT_FOUND', 'Case not found');
  return row;
}

export interface MutationInput {
  actor: ServiceActor;
  familyId: string;
  caseId: string;
  expectedCaseVersion: number;
  idempotencyKey: string;
}

export interface PresentProblemFormulationInput extends MutationInput {
  content: ProblemFormulationContent;
}

/** The RLS context every Slice 8 command runs under (public and in-tx alike). */
function familyManagementRlsContext(input: {
  actor: ServiceActor;
  familyId: string;
}): { familyId: string; accountId: string; personId: string; purpose: string } {
  return {
    familyId: input.familyId,
    accountId: input.actor.accountId,
    personId: input.actor.personId,
    purpose: 'FAMILY_MANAGEMENT',
  };
}

export async function getCurrentProblemFormulationView(
  pool: pg.Pool,
  input: { actor: ServiceActor; familyId: string; caseId: string }
): Promise<Envelope> {
  return withRlsTransaction(
    pool,
    {
      familyId: input.familyId,
      accountId: input.actor.accountId,
      personId: input.actor.personId,
      purpose: 'FAMILY_MANAGEMENT',
    },
    async (tx) => {
      await authorize(tx, {
        actor: input.actor,
        familyId: input.familyId,
        caseId: input.caseId,
        action: 'CASE_READ',
      });
      const caseRow = await getCaseById(tx, input.caseId);
      if (!caseRow) throw httpError('CASE_NOT_FOUND', 'Case not found');
      const current = await getCurrentProblemFormulation(tx, input.caseId);
      return envelope(caseRow.version, current);
    }
  );
}

/**
 * Slice 8 same-transaction composition seam (post-merge owner remediation).
 *
 * Slice 12 must be able to run an authoritative Slice 8 command inside a
 * CALLER-OWNED transaction so that
 *   `StartAssessment` + `A1001 initialization`
 * and
 *   `Assessment final Scene effects` + `PresentProblemFormulation`
 * commit or roll back as one atomic unit.
 *
 * There is exactly ONE authoritative implementation per command:
 *
 *   startAssessment(pool)            --withRlsTransaction--> startAssessmentAuthoritativeCommand(tx)
 *   startAssessmentInTransaction(tx) ----------------------> startAssessmentAuthoritativeCommand(tx)
 *
 * Caller-owned contract (this seam NEVER opens a second transaction):
 * 1. the caller owns BEGIN / COMMIT / ROLLBACK; this seam issues none of them
 *    and never rolls back the caller transaction itself;
 * 2. the passed client is the ONLY connection used — no second pool checkout;
 * 3. the caller has already established the identity + Family RLS context for
 *    `input.actor` / `input.familyId` (`app.set_identity_context` +
 *    `app.set_family_context`, purpose `FAMILY_MANAGEMENT`). This seam never
 *    re-establishes or overwrites that context, so authorization and RLS stay
 *    exactly as fail-closed as the public path;
 * 4. the caller MUST NOT hold a row lock on the target Case before calling.
 *    The canonical lock order Family -> Case -> Problem Formulation resources
 *    is acquired INSIDE this seam; pre-locking the Case in the caller would
 *    invert that order and reintroduce deadlock risk;
 * 5. idempotency (`CASE_START_ASSESSMENT`) stays owned by this authoritative
 *    core. Slot acquisition, the business SAVEPOINT and completion all belong
 *    to the caller's outer transaction and therefore roll back with it.
 *
 * Return value, HTTP status and error vocabulary are identical to the public
 * command; no second error mapping exists.
 */
async function startAssessmentAuthoritativeCommand(
  tx: pg.PoolClient,
  input: MutationInput
): Promise<CommandResult> {
  await authorize(tx, {
    actor: input.actor,
    familyId: input.familyId,
    caseId: input.caseId,
    action: 'CASE_START_ASSESSMENT',
  });

  const hash = requestHash({
    familyId: input.familyId,
    caseId: input.caseId,
    expectedCaseVersion: input.expectedCaseVersion,
  });
  const keyBytes = caseIdempotencyKeyBytes(input.idempotencyKey);
  const slot = await acquireSlot(
    tx,
    input.actor,
    'CASE_START_ASSESSMENT',
    keyBytes,
    hash
  );
  return executeIdempotentBusiness(
    tx,
    {
      actor: input.actor,
      commandType: 'CASE_START_ASSESSMENT',
      keyBytes,
      slot,
    },
    async () => {
      await lockFamily(tx, input.familyId);
      const caseRow = await lockCase(tx, input.caseId);
      assertCaseGuards(caseRow, input.expectedCaseVersion, 'INTAKE');

      const carrier = await resolveTraceableStatement(tx, input.caseId);
      if (!carrier) throw pfError('TRACEABLE_PROBLEM_STATEMENT_REQUIRED');

      const carrierResolution = await resolveEvidenceRefs(tx, input.caseId, [carrier]);
      const carrierMember = carrierResolution.members.get(canonicalEvidenceKey(carrier));
      if (
        !carrierMember ||
        !carrierMember.usable ||
        carrierMember.caseId !== input.caseId ||
        (carrier.type === 'ASSERTION' && carrierMember.assertionKind !== 'STATEMENT')
      ) {
        throw pfError('TRACEABLE_PROBLEM_STATEMENT_REQUIRED');
      }
      const carrierMembers = [carrierMember];
      const personIds = deriveProcessingPersonIds({
        actorPersonId: input.actor.personId,
        caseCreatorPersonId: caseRow.created_by_person_id,
        activeParticipantPersonIds: await resolveActiveCaseParticipantPersonIds(tx, input.caseId),
        authoritativeMembers: carrierMembers,
      });
      await runComplianceGate(tx, personIds);

      const updated = await advanceCasePhaseAndVersion(tx, {
        caseId: input.caseId,
        expectedVersion: input.expectedCaseVersion,
        fromPhase: 'INTAKE',
        toPhase: 'ASSESSMENT',
      });

      await insertProblemFormulationCaseEvent(tx, {
        familyId: input.familyId,
        caseId: input.caseId,
        actorAccountId: input.actor.accountId,
        eventType: 'CASE_ASSESSMENT_STARTED',
        metadata: {
          fromPhase: 'INTAKE',
          toPhase: 'ASSESSMENT',
          version: updated.version,
        },
      });
      await insertProblemFormulationAudit(tx, {
        familyId: input.familyId,
        caseId: input.caseId,
        actorAccountId: input.actor.accountId,
        eventType: 'CASE_ASSESSMENT_STARTED',
        resourceType: 'CASE',
        resourceId: input.caseId,
        metadata: {
          fromPhase: 'INTAKE',
          toPhase: 'ASSESSMENT',
          version: updated.version,
        },
      });

      const body = envelope(updated.version, null);
      return { status: 200, body, etag: caseVersionEtag(updated.version) };
    }
  );
}

/**
 * Public entry point. External behavior is unchanged: this function owns its
 * RLS transaction and delegates to the same authoritative core as the in-tx
 * seam.
 */
export async function startAssessment(
  pool: pg.Pool,
  input: MutationInput
): Promise<CommandResult> {
  try {
    return await withRlsTransaction(pool, familyManagementRlsContext(input), (tx) =>
      startAssessmentAuthoritativeCommand(tx, input)
    );
  } catch (error) {
    return mapServiceError(error);
  }
}

/**
 * Caller-owned transaction entry point. The caller owns BEGIN / COMMIT /
 * ROLLBACK and has already established the RLS context; see the contract on
 * `startAssessmentAuthoritativeCommand` for the full precondition list.
 */
export async function startAssessmentInTransaction(
  tx: pg.PoolClient,
  input: MutationInput
): Promise<CommandResult> {
  try {
    return await startAssessmentAuthoritativeCommand(tx, input);
  } catch (error) {
    return mapServiceError(error);
  }
}

/**
 * Slice 8 same-transaction composition seam (post-merge owner remediation).
 *
 * Same contract as `startAssessmentAuthoritativeCommand`:
 *   presentProblemFormulation(pool)            -> withRlsTransaction -> this core
 *   presentProblemFormulationInTransaction(tx) ---------------------> this core
 *
 * The caller owns BEGIN / COMMIT / ROLLBACK, provides the single
 * `pg.PoolClient` with its RLS context already established, and MUST NOT
 * pre-lock the target Case: the canonical Family -> Case -> Problem
 * Formulation lock order is acquired here. Idempotency
 * (`PROBLEM_FORMULATION_PRESENT`), the formulation write, the Case
 * phase/version change, the Case event and the business audit all stay inside
 * the caller's outer transaction and roll back with it.
 */
async function presentProblemFormulationAuthoritativeCommand(
  tx: pg.PoolClient,
  input: PresentProblemFormulationInput
): Promise<CommandResult> {
  await authorize(tx, {
    actor: input.actor,
    familyId: input.familyId,
    caseId: input.caseId,
    action: 'CASE_PRESENT_PROBLEM_FORMULATION',
  });

  const hash = requestHash({
    familyId: input.familyId,
    caseId: input.caseId,
    expectedCaseVersion: input.expectedCaseVersion,
    candidate: input.content,
  });
  const keyBytes = caseIdempotencyKeyBytes(input.idempotencyKey);
  const slot = await acquireSlot(
    tx,
    input.actor,
    'PROBLEM_FORMULATION_PRESENT',
    keyBytes,
    hash
  );
  return executeIdempotentBusiness(
    tx,
    {
      actor: input.actor,
      commandType: 'PROBLEM_FORMULATION_PRESENT',
      keyBytes,
      slot,
    },
    async () => {
      await lockFamily(tx, input.familyId);
      const caseRow = await lockCase(tx, input.caseId);
      assertCaseGuards(caseRow, input.expectedCaseVersion, 'ASSESSMENT');

      const authoritative = await validateFormulationContent(
        tx,
        input.caseId,
        input.content
      );
      const persons = await processingPersonIds(tx, {
        actor: input.actor,
        caseRow,
        authoritative,
      });
      const compliance = await runComplianceGate(tx, persons);

      const mandatory = mandatoryDependencies(authoritative, compliance);
      if (!isDependencySubset(mandatory, input.content.dependencyRefs)) {
        throw pfError(
          'PROBLEM_FORMULATION_DEPENDENCY_INVALID',
          'mandatory dependency refs are missing from the candidate'
        );
      }

      const current = await lockCurrentProblemFormulation(tx, input.caseId);
      const version = nextFormulationVersion(current);
      if (current) {
        await markCurrentFormulationSuperseded(tx, {
          id: current.id,
          caseId: input.caseId,
          expectedStatus: current.status,
        });
      }

      const inserted = await insertProblemFormulationVersion(tx, {
        familyId: input.familyId,
        caseId: input.caseId,
        version,
        content: input.content,
        userResponse: null,
        supersedesVersion: current ? current.version : null,
      });

      const updated = await advanceCasePhaseAndVersion(tx, {
        caseId: input.caseId,
        expectedVersion: input.expectedCaseVersion,
        fromPhase: 'ASSESSMENT',
        toPhase: 'PROBLEM_FORMULATION',
      });

      await insertProblemFormulationCaseEvent(tx, {
        familyId: input.familyId,
        caseId: input.caseId,
        actorAccountId: input.actor.accountId,
        eventType: 'CASE_PROBLEM_FORMULATION_PRESENTED',
        metadata: {
          formulationVersion: inserted.version,
          fromPhase: 'ASSESSMENT',
          toPhase: 'PROBLEM_FORMULATION',
          version: updated.version,
        },
      });
      await insertProblemFormulationAudit(tx, {
        familyId: input.familyId,
        caseId: input.caseId,
        actorAccountId: input.actor.accountId,
        eventType: 'CASE_PROBLEM_FORMULATION_PRESENTED',
        resourceType: 'PROBLEM_FORMULATION',
        resourceId: inserted.id,
        metadata: {
          formulationVersion: inserted.version,
          fromPhase: 'ASSESSMENT',
          toPhase: 'PROBLEM_FORMULATION',
          version: updated.version,
        },
      });

      const body = envelope(updated.version, inserted);
      return { status: 200, body, etag: caseVersionEtag(updated.version) };
    }
  );
}

/**
 * Public entry point. External behavior is unchanged: this function owns its
 * RLS transaction and delegates to the same authoritative core as the in-tx
 * seam.
 */
export async function presentProblemFormulation(
  pool: pg.Pool,
  input: PresentProblemFormulationInput
): Promise<CommandResult> {
  try {
    return await withRlsTransaction(pool, familyManagementRlsContext(input), (tx) =>
      presentProblemFormulationAuthoritativeCommand(tx, input)
    );
  } catch (error) {
    return mapServiceError(error);
  }
}

/**
 * Caller-owned transaction entry point. The caller owns BEGIN / COMMIT /
 * ROLLBACK and has already established the RLS context; see the contract on
 * `presentProblemFormulationAuthoritativeCommand` for the full precondition
 * list.
 */
export async function presentProblemFormulationInTransaction(
  tx: pg.PoolClient,
  input: PresentProblemFormulationInput
): Promise<CommandResult> {
  try {
    return await presentProblemFormulationAuthoritativeCommand(tx, input);
  } catch (error) {
    return mapServiceError(error);
  }
}

async function lockCurrentForResponse(
  tx: pg.PoolClient,
  input: { caseId: string; formulationVersion: number }
): Promise<ProblemFormulationRow> {
  const current = await lockCurrentProblemFormulation(tx, input.caseId);
  if (!current) throw pfError('PROBLEM_FORMULATION_STATE_CONFLICT');
  if (current.version !== input.formulationVersion) {
    throw pfError('PROBLEM_FORMULATION_VERSION_CONFLICT');
  }
  return current;
}

async function revalidateCurrent(
  tx: pg.PoolClient,
  caseId: string,
  current: ProblemFormulationRow
): Promise<AuthoritativeEvidenceSet> {
  return validateFormulationContent(tx, caseId, contentOf(current));
}

export async function confirmProblemFormulation(
  pool: pg.Pool,
  input: MutationInput & {
    formulationVersion: number;
    body: { note?: string };
  }
): Promise<{ status: number; body: unknown; etag: string | null }> {
  try {
    return await withRlsTransaction(
      pool,
      {
        familyId: input.familyId,
        accountId: input.actor.accountId,
        personId: input.actor.personId,
        purpose: 'FAMILY_MANAGEMENT',
      },
      async (tx) => {
        await authorize(tx, {
          actor: input.actor,
          familyId: input.familyId,
          caseId: input.caseId,
          action: 'CASE_CONFIRM_PROBLEM_FORMULATION',
        });

        const hash = requestHash({
          familyId: input.familyId,
          caseId: input.caseId,
          formulationVersion: input.formulationVersion,
          expectedCaseVersion: input.expectedCaseVersion,
          body: input.body,
        });
        const keyBytes = caseIdempotencyKeyBytes(input.idempotencyKey);
        const slot = await acquireSlot(
          tx,
          input.actor,
          'PROBLEM_FORMULATION_CONFIRM',
          keyBytes,
          hash
        );
        return executeIdempotentBusiness(
          tx,
          {
            actor: input.actor,
            commandType: 'PROBLEM_FORMULATION_CONFIRM',
            keyBytes,
            slot,
          },
          async () => {

        await lockFamily(tx, input.familyId);
        const caseRow = await lockCase(tx, input.caseId);
        assertCaseGuards(caseRow, input.expectedCaseVersion, 'PROBLEM_FORMULATION');

        const current = await lockCurrentForResponse(tx, {
          caseId: input.caseId,
          formulationVersion: input.formulationVersion,
        });
        assertStatusAllows('CONFIRM', current.status);
        assertTransferableStatus(current.status);

        const authoritative = await revalidateCurrent(tx, input.caseId, current);
        const persons = await processingPersonIds(tx, {
          actor: input.actor,
          caseRow,
          authoritative,
        });
        const compliance = await runComplianceGate(tx, persons, 'PUBLIC');

        const mandatory = mandatoryDependencies(authoritative, compliance);
        await revalidateStoredDependencies(tx, input.caseId, current.dependency_refs);
        if (!isDependencySubset(mandatory, current.dependency_refs)) {
          throw pfError(
            'PROBLEM_FORMULATION_DEPENDENCY_INVALID',
            'mandatory dependency refs are missing from the stored current formulation'
          );
        }

        const confirmedAt = new Date();
        const response: UserResponse = {
          kind: 'CONFIRM',
          actorPersonId: input.actor.personId,
          respondedAt: confirmedAt.toISOString(),
          ...(input.body.note !== undefined ? { note: input.body.note } : {}),
        };

        const confirmed = await transitionProblemFormulationStatus(tx, {
          id: current.id,
          caseId: input.caseId,
          expectedStatus: current.status,
          nextStatus: 'CONFIRMED',
          userResponse: response,
          confirmedByPersonId: input.actor.personId,
          confirmedAt,
        });

        const updated = await advanceCasePhaseAndVersion(tx, {
          caseId: input.caseId,
          expectedVersion: input.expectedCaseVersion,
          fromPhase: 'PROBLEM_FORMULATION',
          toPhase: 'GOALS',
        });

        await insertProblemFormulationCaseEvent(tx, {
          familyId: input.familyId,
          caseId: input.caseId,
          actorAccountId: input.actor.accountId,
          eventType: 'CASE_PROBLEM_FORMULATION_CONFIRMED',
          metadata: {
            formulationVersion: confirmed.version,
            fromStatus: current.status,
            toStatus: 'CONFIRMED',
            fromPhase: 'PROBLEM_FORMULATION',
            toPhase: 'GOALS',
            version: updated.version,
          },
        });
        await insertProblemFormulationAudit(tx, {
          familyId: input.familyId,
          caseId: input.caseId,
          actorAccountId: input.actor.accountId,
          eventType: 'CASE_PROBLEM_FORMULATION_CONFIRMED',
          resourceType: 'PROBLEM_FORMULATION',
          resourceId: confirmed.id,
          metadata: {
            formulationVersion: confirmed.version,
            fromStatus: current.status,
            toStatus: 'CONFIRMED',
            fromPhase: 'PROBLEM_FORMULATION',
            toPhase: 'GOALS',
            version: updated.version,
          },
        });

        const body = envelope(updated.version, confirmed);
        return { status: 200, body, etag: caseVersionEtag(updated.version) };
          }
        );
      }
    );
  } catch (error) {
    return mapServiceError(error);
  }
}

export async function disputeProblemFormulation(
  pool: pg.Pool,
  input: MutationInput & {
    formulationVersion: number;
    body: { note?: string };
  }
): Promise<{ status: number; body: unknown; etag: string | null }> {
  try {
    return await withRlsTransaction(
      pool,
      {
        familyId: input.familyId,
        accountId: input.actor.accountId,
        personId: input.actor.personId,
        purpose: 'FAMILY_MANAGEMENT',
      },
      async (tx) => {
        await authorize(tx, {
          actor: input.actor,
          familyId: input.familyId,
          caseId: input.caseId,
          action: 'CASE_DISPUTE_PROBLEM_FORMULATION',
        });

        const hash = requestHash({
          familyId: input.familyId,
          caseId: input.caseId,
          formulationVersion: input.formulationVersion,
          expectedCaseVersion: input.expectedCaseVersion,
          body: input.body,
        });
        const keyBytes = caseIdempotencyKeyBytes(input.idempotencyKey);
        const slot = await acquireSlot(
          tx,
          input.actor,
          'PROBLEM_FORMULATION_DISPUTE',
          keyBytes,
          hash
        );
        return executeIdempotentBusiness(
          tx,
          {
            actor: input.actor,
            commandType: 'PROBLEM_FORMULATION_DISPUTE',
            keyBytes,
            slot,
          },
          async () => {

        await lockFamily(tx, input.familyId);
        const caseRow = await lockCase(tx, input.caseId);
        assertCaseGuards(caseRow, input.expectedCaseVersion, 'PROBLEM_FORMULATION');

        const current = await lockCurrentForResponse(tx, {
          caseId: input.caseId,
          formulationVersion: input.formulationVersion,
        });
        assertStatusAllows('DISPUTE', current.status);

        const authoritative = await revalidateCurrent(tx, input.caseId, current);
        const persons = await processingPersonIds(tx, {
          actor: input.actor,
          caseRow,
          authoritative,
        });
        await runComplianceGate(tx, persons, 'PUBLIC');

        const response: UserResponse = {
          kind: 'DISPUTE',
          actorPersonId: input.actor.personId,
          respondedAt: new Date().toISOString(),
          ...(input.body.note !== undefined ? { note: input.body.note } : {}),
        };

        const disputed = await transitionProblemFormulationStatus(tx, {
          id: current.id,
          caseId: input.caseId,
          expectedStatus: current.status,
          nextStatus: 'DISPUTED',
          userResponse: response,
          confirmedByPersonId: null,
          confirmedAt: null,
        });

        const updated = await bumpCaseVersionWithoutPhaseChange(tx, {
          caseId: input.caseId,
          expectedVersion: input.expectedCaseVersion,
        });

        await insertProblemFormulationCaseEvent(tx, {
          familyId: input.familyId,
          caseId: input.caseId,
          actorAccountId: input.actor.accountId,
          eventType: 'CASE_PROBLEM_FORMULATION_DISPUTED',
          metadata: {
            formulationVersion: disputed.version,
            fromStatus: current.status,
            toStatus: 'DISPUTED',
            version: updated.version,
          },
        });
        await insertProblemFormulationAudit(tx, {
          familyId: input.familyId,
          caseId: input.caseId,
          actorAccountId: input.actor.accountId,
          eventType: 'CASE_PROBLEM_FORMULATION_DISPUTED',
          resourceType: 'PROBLEM_FORMULATION',
          resourceId: disputed.id,
          metadata: {
            formulationVersion: disputed.version,
            fromStatus: current.status,
            toStatus: 'DISPUTED',
            version: updated.version,
          },
        });

        const body = envelope(updated.version, disputed);
        return { status: 200, body, etag: caseVersionEtag(updated.version) };
          }
        );
      }
    );
  } catch (error) {
    return mapServiceError(error);
  }
}

export async function correctProblemFormulation(
  pool: pg.Pool,
  input: MutationInput & {
    formulationVersion: number;
    changes: Partial<ProblemFormulationContent>;
    note?: string;
  }
): Promise<{ status: number; body: unknown; etag: string | null }> {
  try {
    return await withRlsTransaction(
      pool,
      {
        familyId: input.familyId,
        accountId: input.actor.accountId,
        personId: input.actor.personId,
        purpose: 'FAMILY_MANAGEMENT',
      },
      async (tx) => {
        await authorize(tx, {
          actor: input.actor,
          familyId: input.familyId,
          caseId: input.caseId,
          action: 'CASE_CORRECT_PROBLEM_FORMULATION',
        });

        const hash = requestHash({
          familyId: input.familyId,
          caseId: input.caseId,
          formulationVersion: input.formulationVersion,
          expectedCaseVersion: input.expectedCaseVersion,
          changes: input.changes,
          note: input.note ?? null,
        });
        const keyBytes = caseIdempotencyKeyBytes(input.idempotencyKey);
        const slot = await acquireSlot(
          tx,
          input.actor,
          'PROBLEM_FORMULATION_CORRECT',
          keyBytes,
          hash
        );
        return executeIdempotentBusiness(
          tx,
          {
            actor: input.actor,
            commandType: 'PROBLEM_FORMULATION_CORRECT',
            keyBytes,
            slot,
          },
          async () => {

        await lockFamily(tx, input.familyId);
        const caseRow = await lockCase(tx, input.caseId);
        assertCaseGuards(caseRow, input.expectedCaseVersion, 'PROBLEM_FORMULATION');

        const current = await lockCurrentForResponse(tx, {
          caseId: input.caseId,
          formulationVersion: input.formulationVersion,
        });
        assertStatusAllows('CORRECTION', current.status);

        const merged = mergeCorrection(contentOf(current), input.changes);
        const authoritative = await validateFormulationContent(tx, input.caseId, merged);
        const persons = await processingPersonIds(tx, {
          actor: input.actor,
          caseRow,
          authoritative,
        });
        const compliance = await runComplianceGate(tx, persons, 'PUBLIC');

        const mandatory = mandatoryDependencies(authoritative, compliance);
        if (!isDependencySubset(mandatory, merged.dependencyRefs)) {
          throw pfError(
            'PROBLEM_FORMULATION_DEPENDENCY_INVALID',
            'mandatory dependency refs are missing from the corrected formulation'
          );
        }

        const response: UserResponse = {
          kind: 'CORRECTION',
          actorPersonId: input.actor.personId,
          respondedAt: new Date().toISOString(),
          ...(input.note !== undefined ? { note: input.note } : {}),
        };

        await markCurrentFormulationSuperseded(tx, {
          id: current.id,
          caseId: input.caseId,
          expectedStatus: current.status,
        });

        const inserted = await insertProblemFormulationVersion(tx, {
          familyId: input.familyId,
          caseId: input.caseId,
          version: nextFormulationVersion(current),
          content: merged,
          userResponse: response,
          supersedesVersion: current.version,
        });

        const updated = await bumpCaseVersionWithoutPhaseChange(tx, {
          caseId: input.caseId,
          expectedVersion: input.expectedCaseVersion,
        });

        await insertProblemFormulationCaseEvent(tx, {
          familyId: input.familyId,
          caseId: input.caseId,
          actorAccountId: input.actor.accountId,
          eventType: 'CASE_PROBLEM_FORMULATION_CORRECTED',
          metadata: {
            fromFormulationVersion: current.version,
            toFormulationVersion: inserted.version,
            fromStatus: current.status,
            toStatus: 'PRESENTED',
            version: updated.version,
          },
        });
        await insertProblemFormulationAudit(tx, {
          familyId: input.familyId,
          caseId: input.caseId,
          actorAccountId: input.actor.accountId,
          eventType: 'CASE_PROBLEM_FORMULATION_CORRECTED',
          resourceType: 'PROBLEM_FORMULATION',
          resourceId: inserted.id,
          metadata: {
            fromFormulationVersion: current.version,
            toFormulationVersion: inserted.version,
            fromStatus: current.status,
            toStatus: 'PRESENTED',
            version: updated.version,
          },
        });

        const body = envelope(updated.version, inserted);
        return { status: 201, body, etag: caseVersionEtag(updated.version) };
          }
        );
      }
    );
  } catch (error) {
    return mapServiceError(error);
  }
}

export async function reassessFromFormulation(
  pool: pg.Pool,
  input: MutationInput & { formulationVersion: number; basis: ReassessmentBasis }
): Promise<{ status: number; body: unknown; etag: string | null }> {
  try {
    return await withRlsTransaction(
      pool,
      {
        familyId: input.familyId,
        accountId: input.actor.accountId,
        personId: input.actor.personId,
        purpose: 'FAMILY_MANAGEMENT',
      },
      async (tx) => {
        await authorize(tx, {
          actor: input.actor,
          familyId: input.familyId,
          caseId: input.caseId,
          action: 'CASE_REASSESS_FROM_FORMULATION',
        });

        const validatedBasisFingerprint = reassessmentBasisFingerprint(input.basis);
        const hash = requestHash({
          familyId: input.familyId,
          caseId: input.caseId,
          formulationVersion: input.formulationVersion,
          expectedCaseVersion: input.expectedCaseVersion,
          validatedBasisFingerprint,
        });
        const keyBytes = caseIdempotencyKeyBytes(input.idempotencyKey);
        const slot = await acquireSlot(
          tx,
          input.actor,
          'CASE_REASSESS_FROM_FORMULATION',
          keyBytes,
          hash
        );
        return executeIdempotentBusiness(
          tx,
          {
            actor: input.actor,
            commandType: 'CASE_REASSESS_FROM_FORMULATION',
            keyBytes,
            slot,
          },
          async () => {

        await lockFamily(tx, input.familyId);
        const caseRow = await lockCase(tx, input.caseId);
        assertCaseGuards(caseRow, input.expectedCaseVersion, 'PROBLEM_FORMULATION');

        const current = await lockCurrentProblemFormulation(tx, input.caseId);
        if (!current) throw pfError('PROBLEM_FORMULATION_STATE_CONFLICT');
        if (current.version !== input.formulationVersion) {
          throw pfError('PROBLEM_FORMULATION_VERSION_CONFLICT');
        }
        await validateReassessmentBasis(tx, current, input.basis);

        const authoritative = await revalidateCurrent(tx, input.caseId, current);
        const persons = await processingPersonIds(tx, {
          actor: input.actor,
          caseRow,
          authoritative,
        });
        await runComplianceGate(tx, persons);

        const updated = await advanceCasePhaseAndVersion(tx, {
          caseId: input.caseId,
          expectedVersion: input.expectedCaseVersion,
          fromPhase: 'PROBLEM_FORMULATION',
          toPhase: 'ASSESSMENT',
        });

        await insertProblemFormulationCaseEvent(tx, {
          familyId: input.familyId,
          caseId: input.caseId,
          actorAccountId: input.actor.accountId,
          eventType: 'CASE_REASSESSMENT_STARTED',
          metadata: {
            formulationVersion: current.version,
            fromPhase: 'PROBLEM_FORMULATION',
            toPhase: 'ASSESSMENT',
            version: updated.version,
          },
        });
        await insertProblemFormulationAudit(tx, {
          familyId: input.familyId,
          caseId: input.caseId,
          actorAccountId: input.actor.accountId,
          eventType: 'CASE_REASSESSMENT_STARTED',
          resourceType: 'CASE',
          resourceId: input.caseId,
          metadata: {
            formulationVersion: current.version,
            fromPhase: 'PROBLEM_FORMULATION',
            toPhase: 'ASSESSMENT',
            version: updated.version,
          },
        });

        const body = envelope(updated.version, current);
        return { status: 200, body, etag: caseVersionEtag(updated.version) };
          }
        );
      }
    );
  } catch (error) {
    return mapServiceError(error);
  }
}

export function formulationVersionRef(
  refs: readonly EvidenceRef[]
): string[] {
  return refs.map((ref) => canonicalEvidenceKey(ref));
}

export function assertSafeVersion(value: number): void {
  assertVersionBound(value);
}

export async function findFormulationByVersion(
  tx: pg.PoolClient,
  caseId: string,
  version: number
): Promise<ProblemFormulationRow | null> {
  return getProblemFormulationByVersion(tx, caseId, version);
}