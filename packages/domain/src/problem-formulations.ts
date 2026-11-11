/**
 * Problem Formulation Core (Slice 8) — pure policy + family-scoped repository.
 *
 * Frozen sources:
 *   - specs/008-problem-formulation-core/spec.md
 *   - specs/008-problem-formulation-core/plan.md
 *   - specs/008-problem-formulation-core/data-model.md
 *
 * All SQL for `problem_formulations` lives here (guard R4). Routes and the
 * application service never hold direct SQL for this table.
 */

import type { PoolClient } from 'pg';
import { getCaseForUpdate, type CaseRow, type CasePhaseValue } from './cases.js';
import { canonicalJson, hashPayload } from './idempotency.js';

type Tx = PoolClient;

export const PROBLEM_FORMULATION_STATUSES = [
  'DRAFT',
  'PRESENTED',
  'CONFIRMED',
  'DISPUTED',
  'NEEDS_REVIEW',
  'SUPERSEDED',
] as const;

export type ProblemFormulationStatus =
  (typeof PROBLEM_FORMULATION_STATUSES)[number];

export const PG_INTEGER_MAX = 2147483647;

export type EvidenceRefType = 'DIALOGUE_MESSAGE' | 'ASSERTION' | 'OBSERVATION';

export interface EvidenceRef {
  type: EvidenceRefType;
  id: string;
}

export interface TextCondition {
  text: string;
}

export interface PrimaryProblem {
  text: string;
  evidenceRefs: EvidenceRef[];
}

export interface KeyFactor {
  text: string;
  evidenceRefs: EvidenceRef[];
}

export type UnknownState = 'UNKNOWN' | 'NOT_COLLECTED' | 'DECLINED';

export interface UnknownItem {
  topic: string;
  state: UnknownState;
  evidenceRefs: EvidenceRef[];
}

export interface ConflictItem {
  topic: string;
  conflictGroupId?: string;
  evidenceRefs?: EvidenceRef[];
}

export interface UserResponse {
  kind: 'CONFIRM' | 'DISPUTE' | 'CORRECTION';
  actorPersonId: string;
  respondedAt: string;
  note?: string;
}

export type DependencyRef =
  | { type: 'EVIDENCE'; evidence: EvidenceRef }
  | { type: 'CONSENT'; id: string; version?: number }
  | { type: 'POLICY'; key: string; version: string }
  | { type: 'PACKAGE'; key: string; version: string }
  | { type: 'CONTENT_VERSION'; key: string; version: string };

export interface ProblemFormulationContent {
  primaryProblem: PrimaryProblem;
  keyFactors: KeyFactor[];
  evidenceRefs: EvidenceRef[];
  unknowns: UnknownItem[];
  conflicts: ConflictItem[];
  sceneFit: string;
  alternativeExplanations: TextCondition[];
  reassessmentConditions: TextCondition[];
  exitConditions: TextCondition[];
  dependencyRefs: DependencyRef[];
}

export interface ProblemFormulationRow {
  id: string;
  family_id: string;
  case_id: string;
  version: number;
  status: ProblemFormulationStatus;
  primary_problem: PrimaryProblem;
  key_factors: KeyFactor[];
  evidence_refs: EvidenceRef[];
  unknowns: UnknownItem[];
  conflicts: ConflictItem[];
  scene_fit: string;
  alternative_explanations: TextCondition[];
  reassessment_conditions: TextCondition[];
  exit_conditions: TextCondition[];
  user_response: UserResponse | null;
  confirmed_by_person_id: string | null;
  confirmed_at: Date | null;
  dependency_refs: DependencyRef[];
  supersedes_version: number | null;
  created_at: Date;
  updated_at: Date;
}

export interface ProblemFormulationDto {
  id: string;
  caseId: string;
  version: number;
  status: ProblemFormulationStatus;
  primaryProblem: PrimaryProblem;
  keyFactors: KeyFactor[];
  evidenceRefs: EvidenceRef[];
  unknowns: UnknownItem[];
  conflicts: ConflictItem[];
  sceneFit: string;
  alternativeExplanations: TextCondition[];
  reassessmentConditions: TextCondition[];
  exitConditions: TextCondition[];
  userResponse: UserResponse | null;
  confirmedBy: string | null;
  confirmedAt: string | null;
  dependencyRefs: DependencyRef[];
  supersedesVersion: number | null;
  createdAt: string;
  updatedAt: string;
}

export type ProblemFormulationErrorCode =
  | 'PROBLEM_FORMULATION_VERSION_CONFLICT'
  | 'PROBLEM_FORMULATION_STATE_CONFLICT'
  | 'PROBLEM_FORMULATION_DEPENDENCY_INVALID'
  | 'PROBLEM_FORMULATION_EVIDENCE_INVALID'
  | 'TRACEABLE_PROBLEM_STATEMENT_REQUIRED'
  | 'CASE_PHASE_CONFLICT'
  | 'STALE_CASE_VERSION'
  | 'CASE_NOT_PRIMARY'
  | 'CASE_CLOSED'
  | 'SAFETY_HOLD_BLOCKED'
  | 'CORRECTION_NOOP'
  | 'REASSESSMENT_BASIS_INVALID';

export class ProblemFormulationError extends Error {
  readonly code: ProblemFormulationErrorCode;

  constructor(code: ProblemFormulationErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'ProblemFormulationError';
    this.code = code;
  }
}

export function pfError(
  code: ProblemFormulationErrorCode,
  message?: string
): ProblemFormulationError {
  return new ProblemFormulationError(code, message);
}

export function toProblemFormulationDto(row: ProblemFormulationRow): ProblemFormulationDto {
  return {
    id: row.id,
    caseId: row.case_id,
    version: row.version,
    status: row.status,
    primaryProblem: row.primary_problem,
    keyFactors: row.key_factors,
    evidenceRefs: row.evidence_refs,
    unknowns: row.unknowns,
    conflicts: row.conflicts,
    sceneFit: row.scene_fit,
    alternativeExplanations: row.alternative_explanations,
    reassessmentConditions: row.reassessment_conditions,
    exitConditions: row.exit_conditions,
    userResponse: row.user_response,
    confirmedBy: row.confirmed_by_person_id,
    confirmedAt: row.confirmed_at ? new Date(row.confirmed_at).toISOString() : null,
    dependencyRefs: row.dependency_refs,
    supersedesVersion: row.supersedes_version,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

export function canonicalEvidenceKey(ref: EvidenceRef): string {
  return `${ref.type}:${ref.id.toLowerCase()}`;
}

export function canonicalEvidenceRefs(refs: readonly EvidenceRef[]): EvidenceRef[] {
  const seen = new Set<string>();
  const out: EvidenceRef[] = [];
  for (const ref of refs) {
    const key = canonicalEvidenceKey(ref);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ type: ref.type, id: ref.id.toLowerCase() });
  }
  out.sort((a, b) => canonicalEvidenceKey(a).localeCompare(canonicalEvidenceKey(b)));
  return out;
}

export function canonicalDependencyKey(dep: DependencyRef): string {
  switch (dep.type) {
    case 'EVIDENCE':
      return `EVIDENCE:${canonicalEvidenceKey(dep.evidence)}`;
    case 'CONSENT':
      return `CONSENT:${dep.id.toLowerCase()}${dep.version === undefined ? '' : `:${dep.version}`}`;
    default:
      return `${dep.type}:${dep.key}:${dep.version}`;
  }
}

export function canonicalDependencies(refs: readonly DependencyRef[]): DependencyRef[] {
  const seen = new Set<string>();
  const out: DependencyRef[] = [];
  for (const ref of refs) {
    const key = canonicalDependencyKey(ref);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(ref);
  }
  out.sort((a, b) => canonicalDependencyKey(a).localeCompare(canonicalDependencyKey(b)));
  return out;
}

export function isDependencySubset(
  required: readonly DependencyRef[],
  candidate: readonly DependencyRef[]
): boolean {
  const have = new Set(candidate.map(canonicalDependencyKey));
  return required.every((dep) => have.has(canonicalDependencyKey(dep)));
}

const LEGAL_TRANSITIONS: Record<string, readonly ProblemFormulationStatus[]> = {
  PRESENT: ['PRESENTED'],
  CONFIRM: ['PRESENTED'],
  DISPUTE: ['PRESENTED'],
};

export type FormulationCommand =
  | 'PRESENT'
  | 'CONFIRM'
  | 'DISPUTE'
  | 'CORRECTION';

export function assertStatusAllows(
  command: FormulationCommand,
  currentStatus: ProblemFormulationStatus
): void {
  if (command === 'CORRECTION') {
    if (
      currentStatus !== 'PRESENTED' &&
      currentStatus !== 'DISPUTED' &&
      currentStatus !== 'NEEDS_REVIEW'
    ) {
      throw pfError('PROBLEM_FORMULATION_STATE_CONFLICT');
    }
    return;
  }
  const allowed = LEGAL_TRANSITIONS[command] ?? [];
  if (!allowed.includes(currentStatus)) {
    throw pfError('PROBLEM_FORMULATION_STATE_CONFLICT');
  }
}

export function assertTransferableStatus(
  status: ProblemFormulationStatus
): void {
  if (status === 'SUPERSEDED' || status === 'CONFIRMED' || status === 'DRAFT') {
    throw pfError('PROBLEM_FORMULATION_STATE_CONFLICT');
  }
}

export function nextFormulationVersion(current: ProblemFormulationRow | null): number {
  if (current === null) return 1;
  if (current.version >= PG_INTEGER_MAX) {
    throw pfError('PROBLEM_FORMULATION_VERSION_CONFLICT');
  }
  return current.version + 1;
}

export function assertVersionBound(value: number): void {
  if (!Number.isInteger(value) || value < 1 || value > PG_INTEGER_MAX) {
    throw pfError('STALE_CASE_VERSION');
  }
}

/**
 * S8-FINAL-04: PostgreSQL `cases.version` is a 4-byte integer. Every Slice 8
 * increment path must reject the maximum value BEFORE constructing the SQL
 * `version = version + 1`, otherwise the database raises 22003 and the API
 * leaks a 500. The frozen business-conflict semantics for a non-incrementable
 * version are `STALE_CASE_VERSION` (409).
 */
export function assertCaseVersionIncrementable(value: number): void {
  assertVersionBound(value);
  if (value >= PG_INTEGER_MAX) {
    throw pfError('STALE_CASE_VERSION');
  }
}

export function parseIfMatchCaseVersion(header: string | undefined): number {
  if (typeof header !== 'string') throw pfError('STALE_CASE_VERSION');
  const match = /^"case-v([1-9][0-9]{0,9})"$/.exec(header);
  if (!match) throw pfError('STALE_CASE_VERSION');
  const parsed = Number(match[1]);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > PG_INTEGER_MAX) {
    throw pfError('STALE_CASE_VERSION');
  }
  return parsed;
}

export function caseVersionEtag(version: number): string {
  assertVersionBound(version);
  return `"case-v${version}"`;
}

export function assertCaseGuards(
  caseRow: CaseRow,
  expectedCaseVersion: number,
  requiredPhase: CasePhaseValue
): void {
  if (caseRow.status === 'SAFETY_HOLD') {
    throw pfError('SAFETY_HOLD_BLOCKED');
  }
  if (caseRow.status === 'CLOSED') {
    throw pfError('CASE_CLOSED');
  }
  if (!caseRow.is_primary) {
    throw pfError('CASE_NOT_PRIMARY');
  }
  if (caseRow.version !== expectedCaseVersion) {
    throw pfError('STALE_CASE_VERSION');
  }
  if (caseRow.phase !== requiredPhase) {
    throw pfError('CASE_PHASE_CONFLICT');
  }
}

export function mergeCorrection(
  current: ProblemFormulationContent,
  changes: Partial<ProblemFormulationContent>
): ProblemFormulationContent {
  const merged: ProblemFormulationContent = {
    primaryProblem: changes.primaryProblem ?? current.primaryProblem,
    keyFactors: changes.keyFactors ?? current.keyFactors,
    evidenceRefs: changes.evidenceRefs ?? current.evidenceRefs,
    unknowns: changes.unknowns ?? current.unknowns,
    conflicts: changes.conflicts ?? current.conflicts,
    sceneFit: changes.sceneFit ?? current.sceneFit,
    alternativeExplanations:
      changes.alternativeExplanations ?? current.alternativeExplanations,
    reassessmentConditions:
      changes.reassessmentConditions ?? current.reassessmentConditions,
    exitConditions: changes.exitConditions ?? current.exitConditions,
    dependencyRefs: changes.dependencyRefs ?? current.dependencyRefs,
  };
  // S8-FINAL-05: a correction is a no-op when the merged content is semantically
  // identical. Object key order is not semantic (JSONB round-trips reorder keys;
  // public Zod input preserves caller order), so compare canonical JSON where
  // object keys are sorted recursively. Array order is preserved because it is
  // part of the domain structure (`evidenceRefs` snapshot order, conflict sides,
  // condition lists), never globally sorted.
  if (canonicalJson(merged) === canonicalJson(current)) {
    throw pfError('CORRECTION_NOOP', 'correction changes nothing');
  }
  return merged;
}

export interface ResolvedEvidenceMember {
  ref: EvidenceRef;
  kind: EvidenceRefType;
  caseId: string;
  familyId: string;
  personIds: string[];
  usable: boolean;
  unknownState: UnknownState | null;
  conflictGroupId: string | null;
  assertionKind: string | null;
  confirmationStatus: string | null;
}

export interface EvidenceResolution {
  members: Map<string, ResolvedEvidenceMember>;
  missing: EvidenceRef[];
}

export interface ConflictGroupResolution {
  refs: EvidenceRef[];
  members: ResolvedEvidenceMember[];
}

export interface AuthoritativeEvidenceSet {
  refs: EvidenceRef[];
  members: ResolvedEvidenceMember[];
}

function lowerId(id: string): string {
  return id.toLowerCase();
}

export async function resolveEvidenceRefs(
  tx: Tx,
  caseId: string,
  refs: readonly EvidenceRef[]
): Promise<EvidenceResolution> {
  const byType: Record<EvidenceRefType, string[]> = {
    DIALOGUE_MESSAGE: [],
    ASSERTION: [],
    OBSERVATION: [],
  };
  for (const ref of refs) byType[ref.type].push(lowerId(ref.id));

  const members = new Map<string, ResolvedEvidenceMember>();
  const missing: EvidenceRef[] = [];

  if (byType.DIALOGUE_MESSAGE.length > 0) {
    const { rows } = await tx.query(
      `SELECT id, case_id, family_id, source_person_id
       FROM dialogue_messages
       WHERE case_id = $1 AND id = ANY($2::uuid[])`,
      [caseId, byType.DIALOGUE_MESSAGE]
    );
    for (const row of rows) {
      const ref: EvidenceRef = { type: 'DIALOGUE_MESSAGE', id: row.id };
      members.set(canonicalEvidenceKey(ref), {
        ref,
        kind: 'DIALOGUE_MESSAGE',
        caseId: row.case_id,
        familyId: row.family_id,
        personIds: row.source_person_id ? [row.source_person_id] : [],
        usable: true,
        unknownState: null,
        conflictGroupId: null,
        assertionKind: null,
        confirmationStatus: null,
      });
    }
  }

  if (byType.ASSERTION.length > 0) {
    const { rows } = await tx.query(
      `SELECT id, case_id, family_id, subject_person_id, source_person_id,
              valid_from, valid_until, supersedes_id, conflict_group_id, kind,
              confirmation_status
       FROM assertions
       WHERE case_id = $1 AND id = ANY($2::uuid[])`,
      [caseId, byType.ASSERTION]
    );
    const ids = rows.map((row) => row.id);
    const superseded = await supersededIds(tx, 'assertions', ids);
    for (const row of rows) {
      const ref: EvidenceRef = { type: 'ASSERTION', id: row.id };
      members.set(canonicalEvidenceKey(ref), {
        ref,
        kind: 'ASSERTION',
        caseId: row.case_id,
        familyId: row.family_id,
        personIds: [row.subject_person_id, row.source_person_id].filter(
          (value): value is string => typeof value === 'string'
        ),
        usable: isCurrentlyValid(row, superseded.has(row.id)),
        unknownState: null,
        conflictGroupId: row.conflict_group_id,
        assertionKind: row.kind,
        confirmationStatus: row.confirmation_status,
      });
    }
  }

  if (byType.OBSERVATION.length > 0) {
    const { rows } = await tx.query(
      `SELECT id, case_id, family_id, subject_person_id, source_person_id,
              valid_from, valid_until, supersedes_id, conflict_group_id, value_state,
              confirmation_status
       FROM observations
       WHERE case_id = $1 AND id = ANY($2::uuid[])`,
      [caseId, byType.OBSERVATION]
    );
    const ids = rows.map((row) => row.id);
    const superseded = await supersededIds(tx, 'observations', ids);
    for (const row of rows) {
      const ref: EvidenceRef = { type: 'OBSERVATION', id: row.id };
      const unknownState: UnknownState | null =
        row.value_state === 'UNKNOWN' ||
        row.value_state === 'NOT_COLLECTED' ||
        row.value_state === 'DECLINED'
          ? row.value_state
          : null;
      members.set(canonicalEvidenceKey(ref), {
        ref,
        kind: 'OBSERVATION',
        caseId: row.case_id,
        familyId: row.family_id,
        personIds: [row.subject_person_id, row.source_person_id].filter(
          (value): value is string => typeof value === 'string'
        ),
        usable: isCurrentlyValid(row, superseded.has(row.id)),
        unknownState,
        conflictGroupId: row.conflict_group_id,
        assertionKind: null,
        confirmationStatus: row.confirmation_status,
      });
    }
  }

  for (const ref of refs) {
    if (!members.has(canonicalEvidenceKey(ref))) missing.push(ref);
  }

  return { members, missing };
}

function isCurrentlyValid(
  row: { valid_from: Date | null; valid_until: Date | null },
  isSuperseded: boolean
): boolean {
  if (isSuperseded) return false;
  const now = Date.now();
  if (row.valid_from !== null && new Date(row.valid_from).getTime() > now) return false;
  if (row.valid_until !== null && new Date(row.valid_until).getTime() <= now) return false;
  return true;
}

async function supersededIds(tx: Tx, table: 'assertions' | 'observations', ids: string[]) {
  if (ids.length === 0) return new Set<string>();
  const { rows } = await tx.query(
    `SELECT supersedes_id FROM ${table} WHERE supersedes_id = ANY($1::uuid[])`,
    [ids]
  );
  return new Set<string>(rows.map((row) => row.supersedes_id));
}

export async function resolveConflictGroup(
  tx: Tx,
  caseId: string,
  conflictGroupId: string
): Promise<ConflictGroupResolution> {
  const { rows } = await tx.query(
    `SELECT id, 'ASSERTION'::text AS ref_type FROM assertions
       WHERE case_id = $1 AND conflict_group_id = $2
     UNION ALL
     SELECT id, 'OBSERVATION'::text AS ref_type FROM observations
       WHERE case_id = $1 AND conflict_group_id = $2`,
    [caseId, conflictGroupId.toLowerCase()]
  );
  const refs = canonicalEvidenceRefs(
    rows.map((row) => ({
      type: row.ref_type === 'ASSERTION' ? 'ASSERTION' : 'OBSERVATION',
      id: row.id,
    }))
  );
  const resolution = refs.length > 0 ? await resolveEvidenceRefs(tx, caseId, refs) : null;
  return {
    refs,
    members: resolution
      ? refs
          .map((ref) => resolution.members.get(canonicalEvidenceKey(ref)))
          .filter((member): member is ResolvedEvidenceMember => member !== undefined)
      : [],
  };
}

export async function deriveAuthoritativeEvidenceSet(
  tx: Tx,
  caseId: string,
  content: Pick<ProblemFormulationContent, 'evidenceRefs' | 'conflicts'>
): Promise<AuthoritativeEvidenceSet> {
  const union: EvidenceRef[] = [...content.evidenceRefs];
  for (const conflict of content.conflicts) {
    if (!conflict.conflictGroupId) continue;
    const group = await resolveConflictGroup(tx, caseId, conflict.conflictGroupId);
    union.push(...group.refs);
  }
  const refs = canonicalEvidenceRefs(union);
  const resolution = await resolveEvidenceRefs(tx, caseId, refs);
  if (resolution.missing.length > 0) {
    throw pfError(
      'PROBLEM_FORMULATION_EVIDENCE_INVALID',
      'evidence reference does not exist in this Case'
    );
  }
  return {
    refs,
    members: refs.map((ref) => resolution.members.get(canonicalEvidenceKey(ref))!),
  };
}

export async function validateFormulationContent(
  tx: Tx,
  caseId: string,
  content: ProblemFormulationContent
): Promise<AuthoritativeEvidenceSet> {
  if (content.evidenceRefs.length < 1) {
    throw pfError('PROBLEM_FORMULATION_EVIDENCE_INVALID', 'evidenceRefs is empty');
  }
  if (!content.sceneFit.trim()) {
    throw pfError('PROBLEM_FORMULATION_EVIDENCE_INVALID', 'sceneFit is blank');
  }

  const topLevelKeys = new Set(content.evidenceRefs.map(canonicalEvidenceKey));
  const nestedRefs: EvidenceRef[] = [
    ...content.primaryProblem.evidenceRefs,
    ...content.keyFactors.flatMap((factor) => factor.evidenceRefs),
  ];
  for (const ref of nestedRefs) {
    if (!topLevelKeys.has(canonicalEvidenceKey(ref))) {
      throw pfError(
        'PROBLEM_FORMULATION_EVIDENCE_INVALID',
        'nested evidence ref is not part of the top-level snapshot'
      );
    }
  }

  const authoritative = await deriveAuthoritativeEvidenceSet(tx, caseId, content);

  for (const member of authoritative.members) {
    if (!member.usable) {
      throw pfError(
        'PROBLEM_FORMULATION_EVIDENCE_INVALID',
        'evidence reference is stale or superseded'
      );
    }
    if (member.caseId !== caseId || lowerId(member.caseId) !== lowerId(caseId)) {
      throw pfError(
        'PROBLEM_FORMULATION_EVIDENCE_INVALID',
        'evidence reference belongs to another Case'
      );
    }
  }

  const memberByKey = new Map(
    authoritative.members.map((member) => [canonicalEvidenceKey(member.ref), member])
  );

  for (const ref of content.primaryProblem.evidenceRefs) {
    assertPositiveSupport(memberByKey.get(canonicalEvidenceKey(ref)));
  }
  for (const factor of content.keyFactors) {
    for (const ref of factor.evidenceRefs) {
      assertPositiveSupport(memberByKey.get(canonicalEvidenceKey(ref)));
    }
  }

  for (const unknown of content.unknowns) {
    for (const ref of unknown.evidenceRefs) {
      const key = canonicalEvidenceKey(ref);
      if (!topLevelKeys.has(key)) {
        throw pfError(
          'PROBLEM_FORMULATION_EVIDENCE_INVALID',
          'UnknownItem evidence ref is outside the top-level snapshot'
        );
      }
      const member = memberByKey.get(key);
      if (!member) {
        throw pfError(
          'PROBLEM_FORMULATION_EVIDENCE_INVALID',
          'UnknownItem evidence ref does not exist in this Case'
        );
      }
      if (member.kind !== 'OBSERVATION') {
        throw pfError(
          'PROBLEM_FORMULATION_EVIDENCE_INVALID',
          'UnknownItem evidence ref must be an Observation'
        );
      }
      if (member.unknownState !== unknown.state) {
        throw pfError(
          'PROBLEM_FORMULATION_EVIDENCE_INVALID',
          'UnknownItem state does not match its Evidence state'
        );
      }
    }
  }
  for (const member of authoritative.members) {
    if (member.unknownState === null) continue;
    const covered = content.unknowns.some(
      (unknown) =>
        unknown.state === member.unknownState &&
        unknown.evidenceRefs.some(
          (ref) => canonicalEvidenceKey(ref) === canonicalEvidenceKey(member.ref)
        )
    );
    if (!covered) {
      throw pfError(
        'PROBLEM_FORMULATION_EVIDENCE_INVALID',
        `unknown state ${member.unknownState} is not represented by its Evidence ref`
      );
    }
  }

  // S8-FINAL-02: validating each supplied ConflictItem alone is only half of
  // the frozen §11.4 rule. Every conflict group that is *actually present* in
  // the authoritative Evidence set must also be represented by a legal
  // ConflictItem. A caller must not delete the ConflictItem and keep the
  // conflict-bearing Evidence — including by dropping `conflicts` entirely
  // while top-level refs still contain both sides of one group.
  const coveredConflictGroups = new Set<string>();
  for (const conflict of content.conflicts) {
    await validateConflictItem(tx, caseId, conflict, authoritative);
    if (conflict.conflictGroupId) {
      coveredConflictGroups.add(lowerId(conflict.conflictGroupId));
      continue;
    }
    for (const ref of canonicalEvidenceRefs(conflict.evidenceRefs ?? [])) {
      const member = authoritative.members.find(
        (item) => canonicalEvidenceKey(item.ref) === canonicalEvidenceKey(ref)
      );
      if (member?.conflictGroupId) {
        coveredConflictGroups.add(lowerId(member.conflictGroupId));
      }
    }
  }
  for (const member of authoritative.members) {
    if (member.conflictGroupId === null) continue;
    if (!coveredConflictGroups.has(lowerId(member.conflictGroupId))) {
      throw pfError(
        'PROBLEM_FORMULATION_EVIDENCE_INVALID',
        'conflict-bearing Evidence must be represented in conflicts'
      );
    }
  }

  return authoritative;
}

function assertPositiveSupport(member: ResolvedEvidenceMember | undefined): void {
  if (!member) {
    throw pfError('PROBLEM_FORMULATION_EVIDENCE_INVALID', 'missing supporting evidence');
  }
  if (member.unknownState !== null) {
    throw pfError(
      'PROBLEM_FORMULATION_EVIDENCE_INVALID',
      'unknown evidence cannot be positive support'
    );
  }
  if (member.conflictGroupId !== null) {
    throw pfError(
      'PROBLEM_FORMULATION_EVIDENCE_INVALID',
      'conflict-bearing evidence cannot be positive support'
    );
  }
  if (member.confirmationStatus === 'DISPUTED') {
    throw pfError(
      'PROBLEM_FORMULATION_EVIDENCE_INVALID',
      'DISPUTED evidence cannot be positive support'
    );
  }
}

async function validateConflictItem(
  tx: Tx,
  caseId: string,
  conflict: ConflictItem,
  authoritative: AuthoritativeEvidenceSet
): Promise<void> {
  const explicit = canonicalEvidenceRefs(conflict.evidenceRefs ?? []);
  if (conflict.conflictGroupId) {
    const group = await resolveConflictGroup(tx, caseId, conflict.conflictGroupId);
    if (group.refs.length < 2) {
      throw pfError(
        'PROBLEM_FORMULATION_EVIDENCE_INVALID',
        'conflict group does not resolve to two distinct sides'
      );
    }
    const groupKeys = new Set(group.refs.map(canonicalEvidenceKey));
    for (const ref of explicit) {
      if (!groupKeys.has(canonicalEvidenceKey(ref))) {
        throw pfError(
          'PROBLEM_FORMULATION_EVIDENCE_INVALID',
          'explicit conflict ref is not part of the server-resolved group'
        );
      }
    }
    for (const ref of group.refs) {
      if (!authoritative.refs.some((item) => canonicalEvidenceKey(item) === canonicalEvidenceKey(ref))) {
        throw pfError(
          'PROBLEM_FORMULATION_EVIDENCE_INVALID',
          'conflict group side is missing from the authoritative evidence set'
        );
      }
    }
    return;
  }

  if (explicit.length < 2) {
    throw pfError(
      'PROBLEM_FORMULATION_EVIDENCE_INVALID',
      'explicit conflict requires at least two distinct refs'
    );
  }
  const groups = new Set<string>();
  for (const ref of explicit) {
    const member = authoritative.members.find(
      (item) => canonicalEvidenceKey(item.ref) === canonicalEvidenceKey(ref)
    );
    if (!member || !member.conflictGroupId) {
      throw pfError(
        'PROBLEM_FORMULATION_EVIDENCE_INVALID',
        'explicit conflict refs are not a server-proven conflict pair'
      );
    }
    groups.add(member.conflictGroupId);
  }
  if (groups.size !== 1) {
    throw pfError(
      'PROBLEM_FORMULATION_EVIDENCE_INVALID',
      'explicit conflict refs do not share one conflict group'
    );
  }
  const groupId = [...groups][0];
  if (!groupId) {
    throw pfError(
      'PROBLEM_FORMULATION_EVIDENCE_INVALID',
      'explicit conflict refs do not share one conflict group'
    );
  }
  const group = await resolveConflictGroup(tx, caseId, groupId);
  if (group.refs.length < 2) {
    throw pfError(
      'PROBLEM_FORMULATION_EVIDENCE_INVALID',
      'conflict group does not resolve to two distinct sides'
    );
  }
}

export function deriveProcessingPersonIds(input: {
  actorPersonId: string;
  caseCreatorPersonId: string;
  activeParticipantPersonIds: readonly string[];
  authoritativeMembers: readonly ResolvedEvidenceMember[];
}): string[] {
  const ids = new Set<string>();
  ids.add(input.actorPersonId);
  ids.add(input.caseCreatorPersonId);
  for (const personId of input.activeParticipantPersonIds) ids.add(personId);
  for (const member of input.authoritativeMembers) {
    for (const personId of member.personIds) ids.add(personId);
  }
  return [...ids].filter((id) => typeof id === 'string' && id.length > 0).sort();
}

export function deriveMandatoryDependencyRefs(input: {
  authoritativeRefs: readonly EvidenceRef[];
  under14Consents: readonly { id: string; version: number }[];
}): DependencyRef[] {
  const deps: DependencyRef[] = input.authoritativeRefs.map((evidence) => ({
    type: 'EVIDENCE',
    evidence,
  }));
  for (const consent of input.under14Consents) {
    deps.push({ type: 'CONSENT', id: consent.id, version: consent.version });
  }
  return canonicalDependencies(deps);
}

/**
 * S8-FINAL-03: Confirm must revalidate every stored dependency that current
 * main can authoritatively resolve, not only the server-mandatory subset.
 *
 * EVIDENCE is always resolvable: the referenced row must still exist in the
 * same Case, must not be superseded, and must be inside its raw validity
 * window. Caller-supplied extra Evidence dependencies therefore cannot expire
 * silently between Present and Confirm.
 *
 * POLICY / PACKAGE / CONTENT_VERSION have no authoritative current-main
 * registry in the pinned base; they are preserved and never falsely reported
 * as verified. CONSENT is validated by the application service through the
 * existing compliance truth (`getConsentRecordForGate`).
 */
export async function revalidateStoredEvidenceDependencies(
  tx: Tx,
  caseId: string,
  dependencyRefs: readonly DependencyRef[]
): Promise<void> {
  const evidenceRefs: EvidenceRef[] = [];
  for (const dep of dependencyRefs) {
    if (dep.type === 'EVIDENCE') evidenceRefs.push(dep.evidence);
  }
  if (evidenceRefs.length === 0) return;

  const canonical = canonicalEvidenceRefs(evidenceRefs);
  const resolution = await resolveEvidenceRefs(tx, caseId, canonical);
  if (resolution.missing.length > 0) {
    throw pfError(
      'PROBLEM_FORMULATION_DEPENDENCY_INVALID',
      'stored Evidence dependency no longer exists in this Case'
    );
  }
  for (const ref of canonical) {
    const member = resolution.members.get(canonicalEvidenceKey(ref));
    if (
      !member ||
      !member.usable ||
      lowerId(member.caseId) !== lowerId(caseId)
    ) {
      throw pfError(
        'PROBLEM_FORMULATION_DEPENDENCY_INVALID',
        'stored Evidence dependency is no longer current-valid'
      );
    }
  }
}

export async function resolveActiveCaseParticipantPersonIds(
  tx: Tx,
  caseId: string
): Promise<string[]> {
  const { rows } = await tx.query(
    `SELECT DISTINCT person_id FROM case_participants
     WHERE case_id = $1 AND state = 'ACTIVE'
     ORDER BY person_id`,
    [caseId]
  );
  return rows.map((row) => row.person_id);
}

export async function hasTraceableProblemStatement(
  tx: Tx,
  caseId: string
): Promise<boolean> {
  return (await resolveTraceableStatement(tx, caseId)) !== null;
}

export async function resolveTraceableStatement(
  tx: Tx,
  caseId: string
): Promise<EvidenceRef | null> {
  const message = await tx.query(
    `SELECT id FROM dialogue_messages WHERE case_id = $1 ORDER BY recorded_at DESC, id DESC LIMIT 1`,
    [caseId]
  );
  if (message.rows[0]) {
    return { type: 'DIALOGUE_MESSAGE', id: message.rows[0].id };
  }
  const assertion = await tx.query(
    `SELECT a.id FROM assertions a
     WHERE a.case_id = $1
       AND a.kind = 'STATEMENT'
       AND (a.valid_from IS NULL OR a.valid_from <= now())
       AND (a.valid_until IS NULL OR a.valid_until > now())
       AND NOT EXISTS (
         SELECT 1 FROM assertions successor WHERE successor.supersedes_id = a.id
       )
     ORDER BY a.recorded_at DESC, a.id DESC
     LIMIT 1`,
    [caseId]
  );
  if (assertion.rows[0]) return { type: 'ASSERTION', id: assertion.rows[0].id };
  return null;
}

const ROW_COLUMNS = `id, family_id, case_id, version, status,
  primary_problem, key_factors, evidence_refs, unknowns, conflicts, scene_fit,
  alternative_explanations, reassessment_conditions, exit_conditions,
  user_response, confirmed_by_person_id, confirmed_at, dependency_refs,
  supersedes_version, created_at, updated_at`;

export async function getCurrentProblemFormulation(
  tx: Tx,
  caseId: string
): Promise<ProblemFormulationRow | null> {
  const { rows } = await tx.query<ProblemFormulationRow>(
    `SELECT ${ROW_COLUMNS} FROM problem_formulations
     WHERE case_id = $1 AND status <> 'SUPERSEDED'
     ORDER BY version DESC`,
    [caseId]
  );
  if (rows.length > 1) throw new Error('PROBLEM_FORMULATION_MULTIPLE_CURRENT');
  return rows[0] ?? null;
}

export async function lockCurrentProblemFormulation(
  tx: Tx,
  caseId: string
): Promise<ProblemFormulationRow | null> {
  const { rows } = await tx.query<ProblemFormulationRow>(
    `SELECT ${ROW_COLUMNS} FROM problem_formulations
     WHERE case_id = $1 AND status <> 'SUPERSEDED'
     ORDER BY version DESC
     LIMIT 1
     FOR UPDATE`,
    [caseId]
  );
  return rows[0] ?? null;
}

export async function getProblemFormulationByVersion(
  tx: Tx,
  caseId: string,
  version: number
): Promise<ProblemFormulationRow | null> {
  const { rows } = await tx.query<ProblemFormulationRow>(
    `SELECT ${ROW_COLUMNS} FROM problem_formulations
     WHERE case_id = $1 AND version = $2`,
    [caseId, version]
  );
  return rows[0] ?? null;
}

export interface InsertProblemFormulationInput {
  familyId: string;
  caseId: string;
  version: number;
  content: ProblemFormulationContent;
  userResponse: UserResponse | null;
  supersedesVersion: number | null;
}

export async function insertProblemFormulationVersion(
  tx: Tx,
  input: InsertProblemFormulationInput
): Promise<ProblemFormulationRow> {
  const { rows } = await tx.query<ProblemFormulationRow>(
    `INSERT INTO problem_formulations
       (family_id, case_id, version, status,
        primary_problem, key_factors, evidence_refs, unknowns, conflicts, scene_fit,
        alternative_explanations, reassessment_conditions, exit_conditions,
        user_response, dependency_refs, supersedes_version)
     VALUES ($1, $2, $3, 'PRESENTED',
             $4::jsonb, $5::jsonb, $6::jsonb, $7::jsonb, $8::jsonb, $9,
             $10::jsonb, $11::jsonb, $12::jsonb,
             $13::jsonb, $14::jsonb, $15)
     RETURNING ${ROW_COLUMNS}`,
    [
      input.familyId,
      input.caseId,
      input.version,
      JSON.stringify(input.content.primaryProblem),
      JSON.stringify(input.content.keyFactors),
      JSON.stringify(input.content.evidenceRefs),
      JSON.stringify(input.content.unknowns),
      JSON.stringify(input.content.conflicts),
      input.content.sceneFit,
      JSON.stringify(input.content.alternativeExplanations),
      JSON.stringify(input.content.reassessmentConditions),
      JSON.stringify(input.content.exitConditions),
      input.userResponse === null ? null : JSON.stringify(input.userResponse),
      JSON.stringify(input.content.dependencyRefs),
      input.supersedesVersion,
    ]
  );
  const row = rows[0];
  if (!row) throw new Error('PROBLEM_FORMULATION_INSERT_RETURNED_NO_ROW');
  return row;
}

export async function markCurrentFormulationSuperseded(
  tx: Tx,
  input: { id: string; caseId: string; expectedStatus: ProblemFormulationStatus }
): Promise<ProblemFormulationRow> {
  const { rows } = await tx.query<ProblemFormulationRow>(
    `UPDATE problem_formulations
        SET status = 'SUPERSEDED', updated_at = now()
      WHERE id = $1 AND case_id = $2 AND status = $3
      RETURNING ${ROW_COLUMNS}`,
    [input.id, input.caseId, input.expectedStatus]
  );
  const row = rows[0];
  if (!row) throw pfError('PROBLEM_FORMULATION_STATE_CONFLICT');
  return row;
}

export async function transitionProblemFormulationStatus(
  tx: Tx,
  input: {
    id: string;
    caseId: string;
    expectedStatus: ProblemFormulationStatus;
    nextStatus: ProblemFormulationStatus;
    userResponse: UserResponse;
    confirmedByPersonId: string | null;
    confirmedAt: Date | null;
  }
): Promise<ProblemFormulationRow> {
  const { rows } = await tx.query<ProblemFormulationRow>(
    `UPDATE problem_formulations
        SET status = $4,
            user_response = $5::jsonb,
            confirmed_by_person_id = $6,
            confirmed_at = $7,
            updated_at = now()
      WHERE id = $1 AND case_id = $2 AND status = $3
      RETURNING ${ROW_COLUMNS}`,
    [
      input.id,
      input.caseId,
      input.expectedStatus,
      input.nextStatus,
      JSON.stringify(input.userResponse),
      input.confirmedByPersonId,
      input.confirmedAt,
    ]
  );
  const row = rows[0];
  if (!row) throw pfError('PROBLEM_FORMULATION_STATE_CONFLICT');
  return row;
}

export async function advanceCasePhaseAndVersion(
  tx: Tx,
  input: {
    caseId: string;
    expectedVersion: number;
    fromPhase: CasePhaseValue;
    toPhase: CasePhaseValue;
  }
): Promise<CaseRow> {
  assertCaseVersionIncrementable(input.expectedVersion);
  const { rows } = await tx.query<CaseRow>(
    `UPDATE cases
        SET phase = $3, version = version + 1, updated_at = now()
      WHERE id = $1 AND version = $2 AND phase = $4
      RETURNING id, family_id, created_by_person_id, status, phase,
                is_primary, version, created_at, updated_at`,
    [input.caseId, input.expectedVersion, input.toPhase, input.fromPhase]
  );
  const row = rows[0];
  if (!row) throw pfError('STALE_CASE_VERSION');
  return row;
}

export async function bumpCaseVersionWithoutPhaseChange(
  tx: Tx,
  input: { caseId: string; expectedVersion: number }
): Promise<CaseRow> {
  assertCaseVersionIncrementable(input.expectedVersion);
  const { rows } = await tx.query<CaseRow>(
    `UPDATE cases
        SET version = version + 1, updated_at = now()
      WHERE id = $1 AND version = $2
      RETURNING id, family_id, created_by_person_id, status, phase,
                is_primary, version, created_at, updated_at`,
    [input.caseId, input.expectedVersion]
  );
  const row = rows[0];
  if (!row) throw pfError('STALE_CASE_VERSION');
  return row;
}

export async function lockCaseForProblemFormulation(
  tx: Tx,
  caseId: string
): Promise<CaseRow | null> {
  return getCaseForUpdate(tx, caseId);
}

export async function insertProblemFormulationCaseEvent(
  tx: Tx,
  input: {
    familyId: string;
    caseId: string;
    actorAccountId: string;
    eventType:
      | 'CASE_ASSESSMENT_STARTED'
      | 'CASE_PROBLEM_FORMULATION_PRESENTED'
      | 'CASE_PROBLEM_FORMULATION_CONFIRMED'
      | 'CASE_PROBLEM_FORMULATION_DISPUTED'
      | 'CASE_PROBLEM_FORMULATION_CORRECTED'
      | 'CASE_REASSESSMENT_STARTED';
    metadata: Record<string, unknown>;
  }
): Promise<void> {
  await tx.query(
    `INSERT INTO case_events (family_id, case_id, actor_account_id, event_type, metadata)
     VALUES ($1, $2, $3, $4, $5::jsonb)`,
    [
      input.familyId,
      input.caseId,
      input.actorAccountId,
      input.eventType,
      JSON.stringify(input.metadata),
    ]
  );
}

export async function insertProblemFormulationAudit(
  tx: Tx,
  input: {
    familyId: string;
    caseId: string;
    actorAccountId: string;
    eventType: string;
    resourceType: 'CASE' | 'PROBLEM_FORMULATION';
    resourceId: string;
    metadata: Record<string, unknown>;
  }
): Promise<void> {
  await tx.query(
    `INSERT INTO business_audit_events
       (family_id, actor_account_id, event_type, resource_type, resource_id, metadata)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
    [
      input.familyId,
      input.actorAccountId,
      input.eventType,
      input.resourceType,
      input.resourceId,
      JSON.stringify(input.metadata),
    ]
  );
}

export function contentOf(
  row: ProblemFormulationRow
): ProblemFormulationContent {
  return {
    primaryProblem: row.primary_problem,
    keyFactors: row.key_factors,
    evidenceRefs: row.evidence_refs,
    unknowns: row.unknowns,
    conflicts: row.conflicts,
    sceneFit: row.scene_fit,
    alternativeExplanations: row.alternative_explanations,
    reassessmentConditions: row.reassessment_conditions,
    exitConditions: row.exit_conditions,
    dependencyRefs: row.dependency_refs,
  };
}

export type ReassessmentBasis =
  | { kind: 'REASSESSMENT_CONDITION'; text: string }
  | { kind: 'ALTERNATIVE_EXPLANATION'; text: string }
  | { kind: 'CONFLICT'; topic: string }
  | { kind: 'CORRECTION'; version: number };

export function canonicalReassessmentBasis(
  basis: ReassessmentBasis
): { kind: ReassessmentBasis['kind']; value: string } {
  switch (basis.kind) {
    case 'REASSESSMENT_CONDITION':
    case 'ALTERNATIVE_EXPLANATION':
      return { kind: basis.kind, value: basis.text.trim() };
    case 'CONFLICT':
      return { kind: basis.kind, value: basis.topic.trim() };
    case 'CORRECTION':
      return { kind: basis.kind, value: String(basis.version) };
    default:
      throw pfError('REASSESSMENT_BASIS_INVALID', 'unsupported reassessment basis');
  }
}

export function reassessmentBasisFingerprint(basis: ReassessmentBasis): string {
  return hashPayload(canonicalReassessmentBasis(basis) as never);
}

export async function validateReassessmentBasis(
  tx: Tx,
  current: ProblemFormulationRow,
  basis: ReassessmentBasis
): Promise<string> {
  const canonical = canonicalReassessmentBasis(basis);
  if (canonical.kind !== 'CORRECTION' && canonical.value.length === 0) {
    throw pfError('REASSESSMENT_BASIS_INVALID', 'reassessment basis is empty');
  }
  switch (canonical.kind) {
    case 'REASSESSMENT_CONDITION':
      if (!current.reassessment_conditions.some((item) => item.text.trim() === canonical.value)) {
        throw pfError('REASSESSMENT_BASIS_INVALID', 'basis is not a current reassessment condition');
      }
      return `${canonical.kind}:${canonical.value}`;
    case 'ALTERNATIVE_EXPLANATION':
      if (!current.alternative_explanations.some((item) => item.text.trim() === canonical.value)) {
        throw pfError('REASSESSMENT_BASIS_INVALID', 'basis is not a current alternative explanation');
      }
      return `${canonical.kind}:${canonical.value}`;
    case 'CONFLICT':
      if (!current.conflicts.some((item) => item.topic.trim() === canonical.value)) {
        throw pfError('REASSESSMENT_BASIS_INVALID', 'basis is not a current conflict');
      }
      return `${canonical.kind}:${canonical.value}`;
    case 'CORRECTION': {
      const version = Number(canonical.value);
      if (!Number.isInteger(version) || version < 1) {
        throw pfError('REASSESSMENT_BASIS_INVALID', 'invalid correction version');
      }
      if (current.supersedes_version !== version) {
        throw pfError('REASSESSMENT_BASIS_INVALID', 'basis correction is not the current version chain');
      }
      const predecessor = await getProblemFormulationByVersion(tx, current.case_id, version);
      if (
        !predecessor ||
        current.user_response?.kind !== 'CORRECTION' ||
        current.supersedes_version !== version
      ) {
        throw pfError(
          'REASSESSMENT_BASIS_INVALID',
          'basis version was not produced by a correction'
        );
      }
      return `CORRECTION:${version}`;
    }
    default:
      throw pfError('REASSESSMENT_BASIS_INVALID', 'unsupported reassessment basis');
  }
}


