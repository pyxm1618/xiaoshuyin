/**
 * Evidence Core domain — pure validators + the four approved type-specific
 * writers (`recordStatement`, `recordHypothesis`, `recordObservation`,
 * `assignConflictGroup`).
 *
 * Frozen contracts: `specs/003-evidence-core/contracts/evidence-domain.md`,
 * `data-model.md` §2–§12 and `plan.md` D-2…D-10.
 *
 * Deliberately absent: recordFact / createFact / confirmFact / promoteToFact /
 * updateAssertionKind / createAssertion(kind) / createEvidence. FACT remains a
 * semantic kind in the schema/union but has no production writer in this Slice.
 * The database `assertions` INSERT policy is the last line of defence.
 */

import {
  validateEvidenceProvenance,
  type EvidenceProvenanceFacts,
  type EvidenceProvenanceWriter,
  type ProvenanceSource,
} from './provenance.js';
import type { Tx } from './repository.js';
import {
  getAssertionRef,
  getAssertionSupersedeTarget,
  getDialogueMessageById,
  getGuardianPersonId,
  getObservationRef,
  getObservationSupersedeTarget,
  insertAuditEvent,

  insertEvidenceAssertion,
  insertEvidenceObservation,
  isFamilyMember,
  setAssertionConflictGroup,
  setObservationConflictGroup,
  generateUuidv7,
} from './repository.js';

// ── Frozen vocabularies ─────────────────────────────────────

export const ASSERTION_KINDS = ['STATEMENT', 'FACT', 'HYPOTHESIS'] as const;
export type AssertionKind = (typeof ASSERTION_KINDS)[number];

export const OBSERVATION_VALUE_STATES = [
  'KNOWN',
  'UNKNOWN',
  'NOT_COLLECTED',
  'DECLINED',
  'NOT_APPLICABLE',
] as const;
export type ObservationValueState = (typeof OBSERVATION_VALUE_STATES)[number];

export type ObservationValueType = 'TEXT' | 'NUMBER' | 'BOOLEAN';
export type EvidenceTimeState = 'KNOWN' | 'UNKNOWN';
export type EvidenceConfirmationStatus = 'UNCONFIRMED' | 'SOURCE_CONFIRMED' | 'DISPUTED';


export type EvidenceWriter = EvidenceProvenanceWriter;

// ── Errors ──────────────────────────────────────────────────

export type EvidenceErrorCode =
  | 'EVIDENCE_CONTENT_INVALID'
  | 'EVIDENCE_PROVENANCE_INVALID'
  | 'EVIDENCE_PERSON_REFERENCE_INVALID'
  | 'EVIDENCE_SUPERSEDES_INVALID'
  | 'EVIDENCE_HYPOTHESIS_SOURCE_UNAVAILABLE'
  | 'EVIDENCE_CONFLICT_INVALID'
  | 'EVIDENCE_CONFLICT_GROUP_IMMUTABLE'
  | 'EVIDENCE_TIME_INVALID'
  | 'EVIDENCE_VALUE_INVALID'
  | 'EVIDENCE_SERVER_OWNED_FIELD';

const ERROR_MESSAGES: Record<EvidenceErrorCode, string> = {
  EVIDENCE_CONTENT_INVALID: 'Evidence content is invalid',
  EVIDENCE_PROVENANCE_INVALID: 'Evidence provenance is not admissible',
  EVIDENCE_PERSON_REFERENCE_INVALID: 'Evidence person reference is invalid',
  EVIDENCE_SUPERSEDES_INVALID: 'Evidence supersedes reference is invalid',
  EVIDENCE_HYPOTHESIS_SOURCE_UNAVAILABLE: 'No admissible production hypothesis source',
  EVIDENCE_CONFLICT_INVALID: 'Conflict group assignment is invalid',
  EVIDENCE_CONFLICT_GROUP_IMMUTABLE: 'Conflict group cannot be migrated',
  EVIDENCE_TIME_INVALID: 'Evidence time is invalid',
  EVIDENCE_VALUE_INVALID: 'Observation value is invalid',
  EVIDENCE_SERVER_OWNED_FIELD: 'Server-owned field must not be supplied by the caller',
};

/** Domain error with a frozen machine code and a non-leaking message. */
export class EvidenceDomainError extends Error {
  readonly code: EvidenceErrorCode;

  constructor(code: EvidenceErrorCode) {
    super(ERROR_MESSAGES[code]);
    this.name = 'EvidenceDomainError';
    this.code = code;
  }
}

export type EvidenceFailure = { ok: false; code: EvidenceErrorCode };
export type EvidenceCheck = { ok: true } | EvidenceFailure;

function fail(code: EvidenceErrorCode): EvidenceFailure {
  return { ok: false, code };
}

function toDate(value: unknown): Date | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

// ── Time / validity ─────────────────────────────────────────

export type OccurredTimeValue =
  | { ok: true; occurredAt: Date | null }
  | EvidenceFailure;

export function validateOccurredTime(
  state: EvidenceTimeState,
  occurredAt: unknown
): OccurredTimeValue {
  if (state === 'UNKNOWN') {
    if (occurredAt !== null && occurredAt !== undefined) {
      return fail('EVIDENCE_TIME_INVALID');
    }
    return { ok: true, occurredAt: null };
  }
  if (state === 'KNOWN') {
    const date = toDate(occurredAt);
    if (!date) return fail('EVIDENCE_TIME_INVALID');
    return { ok: true, occurredAt: date };
  }
  return fail('EVIDENCE_TIME_INVALID');
}

export type ValidityWindow =
  | { ok: true; validFrom: Date | null; validUntil: Date | null }
  | EvidenceFailure;

export function validateValidity(
  validFrom: unknown,
  validUntil: unknown
): ValidityWindow {
  const from = toDate(validFrom);
  const until = toDate(validUntil);
  if (validFrom !== null && validFrom !== undefined && !from) {
    return fail('EVIDENCE_TIME_INVALID');
  }
  if (validUntil !== null && validUntil !== undefined && !until) {
    return fail('EVIDENCE_TIME_INVALID');
  }
  if (from && until && until.getTime() <= from.getTime()) {
    return fail('EVIDENCE_TIME_INVALID');
  }
  return { ok: true, validFrom: from, validUntil: until };
}

/** EXPIRED is derived from the clock; it is never a persisted value state. */
export function isExpired(validUntil: Date | null, now: Date = new Date()): boolean {
  return validUntil !== null && validUntil.getTime() <= now.getTime();
}

/** Server-owned fields must never arrive through a caller draft. */
export function assertNoServerOwnedFields(draft: unknown): EvidenceCheck {
  if (draft && typeof draft === 'object') {
    const keys = Object.keys(draft as Record<string, unknown>);
    if (keys.includes('recordedAt') || keys.includes('recorded_at')) {
      return fail('EVIDENCE_SERVER_OWNED_FIELD');
    }
  }
  return { ok: true };
}

// ── Observation value ───────────────────────────────────────

export type ObservationValue =
  | { state: 'KNOWN'; type: 'TEXT'; valueText: string }
  | { state: 'KNOWN'; type: 'NUMBER'; valueNumber: number; unit?: string }
  | { state: 'KNOWN'; type: 'BOOLEAN'; valueBoolean: boolean }
  | { state: 'UNKNOWN' }
  | { state: 'NOT_COLLECTED' }
  | { state: 'DECLINED' }
  | { state: 'NOT_APPLICABLE' };

export interface ObservationValueColumns {
  valueState: ObservationValueState;
  valueType: ObservationValueType | null;
  valueText: string | null;
  valueNumber: number | null;
  valueBoolean: boolean | null;
  unit: string | null;
}

const UNKNOWN_LIKE: ObservationValueState[] = [
  'UNKNOWN',
  'NOT_COLLECTED',
  'DECLINED',
  'NOT_APPLICABLE',
];

export type ObservationValueResult =
  | { ok: true; columns: ObservationValueColumns }
  | EvidenceFailure;

export function validateObservationValue(
  value: ObservationValue
): ObservationValueResult {
  if (!value || typeof value !== 'object') return fail('EVIDENCE_VALUE_INVALID');
  const record = value as unknown as Record<string, unknown>;
  const state = record['state'] as ObservationValueState;

  if (UNKNOWN_LIKE.includes(state)) {
    if (Object.keys(record).length !== 1) return fail('EVIDENCE_VALUE_INVALID');
    return {
      ok: true,
      columns: {
        valueState: state,
        valueType: null,
        valueText: null,
        valueNumber: null,
        valueBoolean: null,
        unit: null,
      },
    };
  }

  if (state !== 'KNOWN') return fail('EVIDENCE_VALUE_INVALID');
  const type = record['type'] as ObservationValueType;

  if (type === 'TEXT') {
    if (
      Object.keys(record).sort().join(',') !== 'state,type,valueText' ||
      typeof record['valueText'] !== 'string'
    ) {
      return fail('EVIDENCE_VALUE_INVALID');
    }
    return {
      ok: true,
      columns: {
        valueState: 'KNOWN',
        valueType: 'TEXT',
        valueText: record['valueText'] as string,
        valueNumber: null,
        valueBoolean: null,
        unit: null,
      },
    };
  }

  if (type === 'NUMBER') {
    const allowed = ['state', 'type', 'valueNumber', 'unit'];
    const keys = Object.keys(record);
    if (
      !keys.every((k) => allowed.includes(k)) ||
      !keys.includes('valueNumber') ||
      typeof record['valueNumber'] !== 'number' ||
      !Number.isFinite(record['valueNumber']) ||
      (record['unit'] !== undefined && typeof record['unit'] !== 'string')
    ) {
      return fail('EVIDENCE_VALUE_INVALID');
    }
    return {
      ok: true,
      columns: {
        valueState: 'KNOWN',
        valueType: 'NUMBER',
        valueText: null,
        valueNumber: record['valueNumber'] as number,
        valueBoolean: null,
        unit: (record['unit'] as string | undefined) ?? null,
      },
    };
  }

  if (type === 'BOOLEAN') {
    if (
      Object.keys(record).sort().join(',') !== 'state,type,valueBoolean' ||
      typeof record['valueBoolean'] !== 'boolean'
    ) {
      return fail('EVIDENCE_VALUE_INVALID');
    }
    return {
      ok: true,
      columns: {
        valueState: 'KNOWN',
        valueType: 'BOOLEAN',
        valueText: null,
        valueNumber: null,
        valueBoolean: record['valueBoolean'] as boolean,
        unit: null,
      },
    };
  }

  return fail('EVIDENCE_VALUE_INVALID');
}

// ── Provenance ──────────────────────────────────────────────

export type ProvenanceFacts = EvidenceProvenanceFacts;

/**
 * Public compatibility wrapper over the single frozen provenance seam.
 * All business rules live in provenance.ts so controlled and raw writers cannot drift.
 */
export function validateProvenance(
  facts: ProvenanceFacts
): EvidenceCheck {
  const validation = validateEvidenceProvenance(facts);
  return validation.ok ? { ok: true } : fail(validation.code);
}

// ── Person references / source message ──────────────────────

export interface PersonReferenceInput {
  subjectPersonId: string | null;
  sourcePersonId: string | null;
  subjectIsFamilyMember: boolean;
  sourceIsFamilyMember: boolean;
}

export function validatePersonReferences(
  input: PersonReferenceInput
): EvidenceCheck {
  if (input.subjectPersonId !== null && !input.subjectIsFamilyMember) {
    return fail('EVIDENCE_PERSON_REFERENCE_INVALID');
  }
  if (input.sourcePersonId !== null && !input.sourceIsFamilyMember) {
    return fail('EVIDENCE_PERSON_REFERENCE_INVALID');
  }
  return { ok: true };
}

export interface SourceMessageInput {
  sourceMessageId: string | null;
  sourcePersonId: string | null;
  message: {
    id: string;
    familyId: string;
    caseId: string;
    sourcePersonId: string;
  } | null;
  familyId: string;
  caseId: string;
}

export function validateSourceMessage(
  input: SourceMessageInput
): EvidenceCheck {
  if (input.sourceMessageId === null || input.sourceMessageId === undefined) {
    return { ok: true };
  }
  const { message } = input;
  if (
    !message ||
    message.id !== input.sourceMessageId ||
    message.familyId !== input.familyId ||
    message.caseId !== input.caseId ||
    message.sourcePersonId !== input.sourcePersonId
  ) {
    return fail('EVIDENCE_PERSON_REFERENCE_INVALID');
  }
  return { ok: true };
}

// ── Conflict group ──────────────────────────────────────────

export interface ConflictRefInput {
  kind: 'ASSERTION' | 'OBSERVATION';
  id: string;
  familyId: string;
  caseId: string;
  conflictGroupId: string | null;
}

export type ConflictAssignment =
  | { ok: true; existingGroupId: string | null }
  | EvidenceFailure;

export function validateConflictAssignment(
  refs: ConflictRefInput[],
  familyId: string,
  caseId: string
): ConflictAssignment {
  if (!Array.isArray(refs) || refs.length < 2) {
    return fail('EVIDENCE_CONFLICT_INVALID');
  }

  const ids = new Set<string>();
  for (const ref of refs) {
    if (ref.kind !== 'ASSERTION' && ref.kind !== 'OBSERVATION') {
      return fail('EVIDENCE_CONFLICT_INVALID');
    }
    if (!ref.id || ids.has(ref.id)) return fail('EVIDENCE_CONFLICT_INVALID');
    ids.add(ref.id);
    if (ref.familyId !== familyId || ref.caseId !== caseId) {
      return fail('EVIDENCE_CONFLICT_INVALID');
    }
  }

  const groups = refs
    .map((ref) => ref.conflictGroupId)
    .filter((group): group is string => group !== null);
  if (groups.length === 0) return { ok: true, existingGroupId: null };

  const unique = new Set(groups);
  if (unique.size > 1) return fail('EVIDENCE_CONFLICT_GROUP_IMMUTABLE');

  return { ok: true, existingGroupId: groups[0]! };
}

// ── Supersedes ──────────────────────────────────────────────

export interface SupersedesInput {
  kind: 'ASSERTION' | 'OBSERVATION';
  newId?: string | null;
  supersedesId: string | null;
  target: {
    id: string;
    kind: 'ASSERTION' | 'OBSERVATION';
    familyId: string;
    caseId: string;
  } | null;
  familyId: string;
  caseId: string;
}

export function validateSupersedes(
  input: SupersedesInput
): EvidenceCheck {
  if (input.supersedesId === null || input.supersedesId === undefined) {
    return { ok: true };
  }
  if (input.newId && input.newId === input.supersedesId) {
    return fail('EVIDENCE_SUPERSEDES_INVALID');
  }
  const { target } = input;
  if (!target) return fail('EVIDENCE_SUPERSEDES_INVALID');
  if (target.kind !== input.kind) return fail('EVIDENCE_SUPERSEDES_INVALID');
  if (target.id !== input.supersedesId) return fail('EVIDENCE_SUPERSEDES_INVALID');
  if (target.familyId !== input.familyId || target.caseId !== input.caseId) {
    return fail('EVIDENCE_SUPERSEDES_INVALID');
  }
  return { ok: true };
}

// ── Writers ─────────────────────────────────────────────────

export interface EvidenceWriteContext {
  familyId: string;
  caseId: string;
  actorAccountId: string;
  /** Already-authorized actor Person (Case authorization happened first). */
  actorPersonId: string;
}

export interface EvidenceWriteResult {
  id: string;
  recordedAt: Date;
}


export interface AssertionDraft {
  subjectPersonId: string | null;
  sourceKind: ProvenanceSource;
  sourcePersonId: string | null;
  sourceMessageId?: string | null;
  occurredTimeState: EvidenceTimeState;
  occurredAt?: Date | string | null;
  validFrom?: Date | string | null;
  validUntil?: Date | string | null;
  confirmationStatus: EvidenceConfirmationStatus;
  supersedesId?: string | null;
  content: string;
}

export interface ObservationDraft extends AssertionDraft {
  observationCode: string;
  value: ObservationValue;
}

function assertValidContent(content: unknown): void {
  if (
    typeof content !== 'string' ||
    content.length < 1 ||
    content.length > 8000 ||
    content.trim().length === 0
  ) {
    throw new EvidenceDomainError('EVIDENCE_CONTENT_INVALID');
  }
}

async function resolvePersonFacts(
  tx: Tx,
  ctx: EvidenceWriteContext,
  subjectPersonId: string | null,
  sourcePersonId: string | null
): Promise<{
  subjectIsFamilyMember: boolean;
  sourceIsFamilyMember: boolean;
  sourceIsGuardianOfSubject: boolean;
}> {
  const subjectIsFamilyMember = subjectPersonId
    ? await isFamilyMember(tx, ctx.familyId, subjectPersonId)
    : false;
  const sourceIsFamilyMember = sourcePersonId
    ? await isFamilyMember(tx, ctx.familyId, sourcePersonId)
    : false;
  let sourceIsGuardianOfSubject = false;
  if (subjectPersonId && sourcePersonId) {
    const guardianPersonId = await getGuardianPersonId(tx, subjectPersonId);
    sourceIsGuardianOfSubject =
      guardianPersonId !== null && guardianPersonId === sourcePersonId;
  }
  return { subjectIsFamilyMember, sourceIsFamilyMember, sourceIsGuardianOfSubject };
}

async function verifySourceMessage(
  tx: Tx,
  ctx: EvidenceWriteContext,
  sourceMessageId: string | null,
  sourcePersonId: string | null
): Promise<void> {
  if (sourceMessageId === null) return;
  const row = await getDialogueMessageById(tx, sourceMessageId);
  const validation = validateSourceMessage({
    sourceMessageId,
    sourcePersonId,
    message: row
      ? {
          id: row.id,
          familyId: row.family_id,
          caseId: row.case_id,
          sourcePersonId: row.source_person_id,
        }
      : null,
    familyId: ctx.familyId,
    caseId: ctx.caseId,
  });
  if (!validation.ok) throw new EvidenceDomainError(validation.code);
}

export async function recordStatement(
  tx: Tx,
  ctx: EvidenceWriteContext,
  draft: AssertionDraft
): Promise<EvidenceWriteResult> {
  return writeAssertion(tx, ctx, draft, 'STATEMENT', 'RECORD_STATEMENT');
}

/**
 * Future-facing capability contract only. This Slice has no admissible
 * hypothesis provenance (no AI caller / AI runtime), so the function always
 * fails closed before touching the transaction.
 */
export async function recordHypothesis(
  _tx: Tx,
  _ctx: EvidenceWriteContext,
  draft: AssertionDraft
): Promise<EvidenceWriteResult> {
  const validation = validateProvenance({
    writer: 'RECORD_HYPOTHESIS',
    sourceKind: draft.sourceKind,
    subjectPersonId: draft.subjectPersonId,
    sourcePersonId: draft.sourcePersonId,
    subjectIsFamilyMember: true,
    sourceIsFamilyMember: true,
    sourceIsGuardianOfSubject: false,
  });
  if (!validation.ok) throw new EvidenceDomainError(validation.code);
  throw new EvidenceDomainError('EVIDENCE_HYPOTHESIS_SOURCE_UNAVAILABLE');
}

async function writeAssertion(
  tx: Tx,
  ctx: EvidenceWriteContext,
  draft: AssertionDraft,
  kind: 'STATEMENT' | 'HYPOTHESIS',
  writer: EvidenceWriter
): Promise<EvidenceWriteResult> {
  const serverOwned = assertNoServerOwnedFields(draft);
  if (!serverOwned.ok) throw new EvidenceDomainError(serverOwned.code);

  assertValidContent(draft.content);

  const occurred = validateOccurredTime(draft.occurredTimeState, draft.occurredAt);
  if (!occurred.ok) throw new EvidenceDomainError(occurred.code);
  const validity = validateValidity(draft.validFrom, draft.validUntil);
  if (!validity.ok) throw new EvidenceDomainError(validity.code);

  const subjectPersonId = draft.subjectPersonId ?? null;
  const sourcePersonId = draft.sourcePersonId ?? null;
  const sourceMessageId = draft.sourceMessageId ?? null;

  const personFacts = await resolvePersonFacts(tx, ctx, subjectPersonId, sourcePersonId);
  const personReference = validatePersonReferences({
    subjectPersonId,
    sourcePersonId,
    subjectIsFamilyMember: personFacts.subjectIsFamilyMember,
    sourceIsFamilyMember: personFacts.sourceIsFamilyMember,
  });
  if (!personReference.ok) throw new EvidenceDomainError(personReference.code);

  const provenance = validateProvenance({
    writer,
    sourceKind: draft.sourceKind,
    subjectPersonId,
    sourcePersonId,
    subjectIsFamilyMember: personFacts.subjectIsFamilyMember,
    sourceIsFamilyMember: personFacts.sourceIsFamilyMember,
    sourceIsGuardianOfSubject: personFacts.sourceIsGuardianOfSubject,
  });
  if (!provenance.ok) throw new EvidenceDomainError(provenance.code);

  await verifySourceMessage(tx, ctx, sourceMessageId, sourcePersonId);

  const supersedesId = draft.supersedesId ?? null;
  if (supersedesId !== null) {
    const target = await getAssertionSupersedeTarget(tx, supersedesId);
    const supersedes = validateSupersedes({
      kind: 'ASSERTION',
      newId: null,
      supersedesId,
      target: target
        ? {
            id: target.id,
            kind: 'ASSERTION',
            familyId: target.family_id,
            caseId: target.case_id,
          }
        : null,
      familyId: ctx.familyId,
      caseId: ctx.caseId,
    });
    if (!supersedes.ok) throw new EvidenceDomainError(supersedes.code);
  }

  const inserted = await insertEvidenceAssertion(tx, {
    familyId: ctx.familyId,
    caseId: ctx.caseId,
    subjectPersonId,
    sourceKind: draft.sourceKind,
    sourcePersonId,
    sourceMessageId,
    occurredTimeState: draft.occurredTimeState,
    occurredAt: occurred.occurredAt,
    validFrom: validity.validFrom,
    validUntil: validity.validUntil,
    confirmationStatus: draft.confirmationStatus,
    supersedesId,
    kind,
    content: draft.content,
  });

  await insertAuditEvent(
    tx,
    ctx.familyId,
    ctx.actorAccountId,
    'ASSERTION_RECORDED',
    'ASSERTION',
    inserted.id
  );

  return { id: inserted.id, recordedAt: inserted.recorded_at };
}

export async function recordObservation(
  tx: Tx,
  ctx: EvidenceWriteContext,
  draft: ObservationDraft
): Promise<EvidenceWriteResult> {
  const serverOwned = assertNoServerOwnedFields(draft);
  if (!serverOwned.ok) throw new EvidenceDomainError(serverOwned.code);

  const occurred = validateOccurredTime(draft.occurredTimeState, draft.occurredAt);
  if (!occurred.ok) throw new EvidenceDomainError(occurred.code);
  const validity = validateValidity(draft.validFrom, draft.validUntil);
  if (!validity.ok) throw new EvidenceDomainError(validity.code);
  const value = validateObservationValue(draft.value);
  if (!value.ok) throw new EvidenceDomainError(value.code);

  const subjectPersonId = draft.subjectPersonId ?? null;
  const sourcePersonId = draft.sourcePersonId ?? null;
  const sourceMessageId = draft.sourceMessageId ?? null;

  const personFacts = await resolvePersonFacts(tx, ctx, subjectPersonId, sourcePersonId);
  const personReference = validatePersonReferences({
    subjectPersonId,
    sourcePersonId,
    subjectIsFamilyMember: personFacts.subjectIsFamilyMember,
    sourceIsFamilyMember: personFacts.sourceIsFamilyMember,
  });
  if (!personReference.ok) throw new EvidenceDomainError(personReference.code);

  const provenance = validateProvenance({
    writer: 'RECORD_OBSERVATION',
    sourceKind: draft.sourceKind,
    subjectPersonId,
    sourcePersonId,
    subjectIsFamilyMember: personFacts.subjectIsFamilyMember,
    sourceIsFamilyMember: personFacts.sourceIsFamilyMember,
    sourceIsGuardianOfSubject: personFacts.sourceIsGuardianOfSubject,
  });
  if (!provenance.ok) throw new EvidenceDomainError(provenance.code);

  await verifySourceMessage(tx, ctx, sourceMessageId, sourcePersonId);

  const supersedesId = draft.supersedesId ?? null;
  if (supersedesId !== null) {
    const target = await getObservationSupersedeTarget(tx, supersedesId);
    const supersedes = validateSupersedes({
      kind: 'OBSERVATION',
      newId: null,
      supersedesId,
      target: target
        ? {
            id: target.id,
            kind: 'OBSERVATION',
            familyId: target.family_id,
            caseId: target.case_id,
          }
        : null,
      familyId: ctx.familyId,
      caseId: ctx.caseId,
    });
    if (!supersedes.ok) throw new EvidenceDomainError(supersedes.code);
  }

  const columns = value.columns;
  const inserted = await insertEvidenceObservation(tx, {
    familyId: ctx.familyId,
    caseId: ctx.caseId,
    subjectPersonId,
    sourceKind: draft.sourceKind,
    sourcePersonId,
    sourceMessageId,
    occurredTimeState: draft.occurredTimeState,
    occurredAt: occurred.occurredAt,
    validFrom: validity.validFrom,
    validUntil: validity.validUntil,
    confirmationStatus: draft.confirmationStatus,
    supersedesId,
    observationCode: draft.observationCode,
    valueState: columns.valueState,
    valueType: columns.valueType,
    valueText: columns.valueText,
    valueNumber: columns.valueNumber,
    valueBoolean: columns.valueBoolean,
    unit: columns.unit,
  });

  await insertAuditEvent(
    tx,
    ctx.familyId,
    ctx.actorAccountId,
    'OBSERVATION_RECORDED',
    'OBSERVATION',
    inserted.id
  );

  return { id: inserted.id, recordedAt: inserted.recorded_at };
}

export interface ConflictGroupRef {
  kind: 'ASSERTION' | 'OBSERVATION';
  id: string;
}

export interface ConflictGroupResult {
  conflictGroupId: string;
}

export async function assignConflictGroup(
  tx: Tx,
  ctx: EvidenceWriteContext,
  refs: ConflictGroupRef[]
): Promise<ConflictGroupResult> {
  if (!Array.isArray(refs) || refs.length < 2) {
    throw new EvidenceDomainError('EVIDENCE_CONFLICT_INVALID');
  }

  const resolved: ConflictRefInput[] = [];
  for (const ref of refs) {
    const row =
      ref.kind === 'ASSERTION'
        ? await getAssertionRef(tx, ref.id)
        : await getObservationRef(tx, ref.id);
    if (!row) throw new EvidenceDomainError('EVIDENCE_CONFLICT_INVALID');
    resolved.push({
      kind: ref.kind,
      id: row.id,
      familyId: row.family_id,
      caseId: row.case_id,
      conflictGroupId: row.conflict_group_id,
    });
  }

  const validation = validateConflictAssignment(resolved, ctx.familyId, ctx.caseId);
  if (!validation.ok) throw new EvidenceDomainError(validation.code);

  const groupId = validation.existingGroupId ?? (await generateUuidv7(tx));

  for (const ref of resolved) {
    if (ref.conflictGroupId === groupId) continue;
    const updated =
      ref.kind === 'ASSERTION'
        ? await setAssertionConflictGroup(tx, ref.id, groupId)
        : await setObservationConflictGroup(tx, ref.id, groupId);
    if (!updated) {
      // AUD-II-002: a concurrent transaction already assigned a different
      // group (or the row vanished). Never migrate an existing group.
      throw new EvidenceDomainError('EVIDENCE_CONFLICT_GROUP_IMMUTABLE');
    }
  }

  return { conflictGroupId: groupId };
}