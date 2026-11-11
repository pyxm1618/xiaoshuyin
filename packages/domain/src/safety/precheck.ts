/**
 * Slice 9 — deterministic Safety precheck (Frozen Spec §9.2 / §9.3, plan §6.1).
 *
 * Contract:
 *   - synchronous, deterministic, pure: no I/O, no clock, no network, no LLM,
 *     no RAG, no external Safety service;
 *   - evaluates ONLY an already-approved deterministic rule evaluation input;
 *   - never mutates business state;
 *   - never accepts a caller boolean (`isHighRisk`) as authority — an evaluation
 *     must carry the complete opaque policy/rule/version/category identity of
 *     an approved deterministic rule asset;
 *   - every decision is bound to the Case id + Case version it was made for,
 *     so a stale decision can be rejected by the caller;
 *   - no professional risk-word / threshold catalog is invented here.
 *
 * This module deliberately contains no vendor/SDK/model import.
 */

import { SafetyError } from './errors.js';

export type SafetyCaseStatus =
  | 'OPEN'
  | 'WAITING'
  | 'LOST_CONTACT'
  | 'SAFETY_HOLD'
  | 'CLOSED';

/** The minimum Case facts the precheck may consume. */
export interface SafetyCaseSnapshot {
  caseId: string;
  status: SafetyCaseStatus;
  version: number;
}

/** Opaque, non-sensitive evidence reference (never raw content). */
export interface OpaqueEvidenceReference {
  /** Bounded reference kind code, e.g. EVIDENCE / OBSERVATION. */
  kind: string;
  /** Opaque identifier of the referenced object. */
  ref: string;
}

/** Approved deterministic policy/rule identity (server-owned). */
export interface ApprovedPolicyIdentity {
  policyRef: string;
  policyVersion: string;
  ruleRef: string;
  ruleVersion: string;
}

/**
 * Deterministic rule outcome. This is the output of an approved deterministic
 * rule asset — NOT a caller-supplied "is high risk" boolean. `HOLD_REQUIRED`
 * is only meaningful together with the full policy/rule/category identity.
 */
export type ApprovedRuleOutcome = 'HOLD_REQUIRED' | 'NO_HOLD';

/**
 * Approved deterministic rule evaluation input.
 *
 * Production has no such asset yet (Frozen Spec C3): production makes no claim
 * that a professional detection rule exists. Tests provide deterministic
 * approved fixtures only.
 */
export interface ApprovedRuleEvaluation extends ApprovedPolicyIdentity {
  outcome: ApprovedRuleOutcome;
  /** Required exactly when `outcome === 'HOLD_REQUIRED'`. */
  riskCategoryRef?: string | null;
  evidenceRefs: OpaqueEvidenceReference[];
}

export type SafetyPrecheckDecision =
  | { kind: 'ALLOW'; caseId: string; caseVersion: number }
  | { kind: 'ALREADY_HELD'; caseId: string; caseVersion: number }
  | {
      kind: 'ENTER_HOLD';
      caseId: string;
      caseVersion: number;
      identity: ApprovedPolicyIdentity;
      riskCategoryRef: string;
      evidenceRefs: OpaqueEvidenceReference[];
    };

const EVALUATION_KEYS = new Set([
  'outcome',
  'policyRef',
  'policyVersion',
  'ruleRef',
  'ruleVersion',
  'riskCategoryRef',
  'evidenceRefs',
]);

const IDENTITY_KEYS = ['policyRef', 'policyVersion', 'ruleRef', 'ruleVersion'] as const;

const CASE_STATUSES = ['OPEN', 'WAITING', 'LOST_CONTACT', 'SAFETY_HOLD', 'CLOSED'] as const;

function invalid(reason: string): never {
  throw new SafetyError('SAFETY_PRECHECK_INVALID', reason);
}

function requireNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== 'string') invalid(`invalid ${field}`);
  if (value.trim() === '') invalid(`invalid ${field}`);
  return value;
}

function validateSnapshot(snapshot: unknown): SafetyCaseSnapshot {
  if (typeof snapshot !== 'object' || snapshot === null) invalid('invalid case snapshot');
  const candidate = snapshot as Record<string, unknown>;
  const caseId = requireNonEmptyString(candidate['caseId'], 'caseId');
  const status = candidate['status'];
  if (typeof status !== 'string' || !(CASE_STATUSES as readonly string[]).includes(status)) {
    invalid('invalid case status');
  }
  const version = candidate['version'];
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    invalid('invalid case version');
  }
  return { caseId, status: status as SafetyCaseStatus, version };
}

function validateEvidenceRefs(value: unknown): OpaqueEvidenceReference[] {
  if (!Array.isArray(value)) invalid('invalid evidenceRefs');
  return value.map((entry) => {
    if (typeof entry !== 'object' || entry === null) invalid('invalid evidence reference');
    const record = entry as Record<string, unknown>;
    const keys = Object.keys(record);
    if (keys.length !== 2 || !keys.includes('kind') || !keys.includes('ref')) {
      invalid('invalid evidence reference shape');
    }
    return {
      kind: requireNonEmptyString(record['kind'], 'evidence ref kind'),
      ref: requireNonEmptyString(record['ref'], 'evidence ref id'),
    };
  });
}

function validateIdentity(source: Record<string, unknown>): ApprovedPolicyIdentity {
  return {
    policyRef: requireNonEmptyString(source['policyRef'], 'policyRef'),
    policyVersion: requireNonEmptyString(source['policyVersion'], 'policyVersion'),
    ruleRef: requireNonEmptyString(source['ruleRef'], 'ruleRef'),
    ruleVersion: requireNonEmptyString(source['ruleVersion'], 'ruleVersion'),
  };
}

function validateEvaluation(value: unknown): ApprovedRuleEvaluation {
  if (typeof value !== 'object' || value === null) invalid('invalid rule evaluation');
  const record = value as Record<string, unknown>;

  // Strict shape: unknown keys (for example `isHighRisk`) are invalid, so a
  // caller cannot smuggle an authority boolean into the decision.
  for (const key of Object.keys(record)) {
    if (!EVALUATION_KEYS.has(key)) invalid(`unexpected evaluation field ${key}`);
  }

  const outcome = record['outcome'];
  if (outcome !== 'HOLD_REQUIRED' && outcome !== 'NO_HOLD') {
    invalid('invalid rule outcome');
  }

  const identity = validateIdentity(record);

  if (outcome === 'HOLD_REQUIRED') {
    const category = requireNonEmptyString(record['riskCategoryRef'], 'riskCategoryRef');
    return {
      ...identity,
      outcome,
      riskCategoryRef: category,
      evidenceRefs: validateEvidenceRefs(record['evidenceRefs'] ?? []),
    };
  }

  return {
    ...identity,
    outcome,
    riskCategoryRef: null,
    evidenceRefs: validateEvidenceRefs(record['evidenceRefs'] ?? []),
  };
}

function identityMatches(
  decision: ApprovedPolicyIdentity,
  trusted: ApprovedPolicyIdentity
): boolean {
  for (const key of IDENTITY_KEYS) {
    if (decision[key] !== trusted[key]) return false;
  }
  return true;
}

/**
 * Run the deterministic Safety precheck.
 *
 * Determinism: identical inputs produce a deeply equal decision. The function
 * reads no ambient state (no clock, no env, no network).
 */
export function runSafetyPrecheck(input: {
  case: SafetyCaseSnapshot;
  /**
   * The currently approved policy/rule identity from the trusted deterministic
   * seam. Required to prove the evaluation is not stale.
   */
  trustedPolicyIdentity: ApprovedPolicyIdentity;
  /**
   * Approved deterministic rule evaluation. Not required when the Case is
   * already SAFETY_HOLD (the decision is then ALREADY_HELD).
   */
  approvedEvaluation?: ApprovedRuleEvaluation | null;
}): SafetyPrecheckDecision {
  const snapshot = validateSnapshot(input.case);
  const trusted = validateIdentity(input.trustedPolicyIdentity as unknown as Record<string, unknown>);

  // Already held: ordinary progression stays blocked; no new hold is decided.
  if (snapshot.status === 'SAFETY_HOLD') {
    return { kind: 'ALREADY_HELD', caseId: snapshot.caseId, caseVersion: snapshot.version };
  }

  // A non-held Case must be evaluated against a complete approved evaluation.
  if (input.approvedEvaluation === undefined || input.approvedEvaluation === null) {
    invalid('missing approved rule evaluation');
  }
  const evaluation = validateEvaluation(input.approvedEvaluation);

  if (evaluation.outcome === 'NO_HOLD') {
    return { kind: 'ALLOW', caseId: snapshot.caseId, caseVersion: snapshot.version };
  }

  // HOLD_REQUIRED is only usable against the still-current approved identity.
  if (!identityMatches(evaluation, trusted)) {
    throw new SafetyError('SAFETY_PRECHECK_STALE');
  }

  return {
    kind: 'ENTER_HOLD',
    caseId: snapshot.caseId,
    caseVersion: snapshot.version,
    identity: {
      policyRef: evaluation.policyRef,
      policyVersion: evaluation.policyVersion,
      ruleRef: evaluation.ruleRef,
      ruleVersion: evaluation.ruleVersion,
    },
    riskCategoryRef: evaluation.riskCategoryRef ?? invalid('missing risk category'),
    evidenceRefs: evaluation.evidenceRefs.map((reference) => ({ ...reference })),
  };
}

/**
 * Revalidate a decision against the locked/current Case snapshot.
 *
 * `EnterSafetyHold` must call this after locking the Case row so a decision
 * produced for version N can never be applied to a Case that has moved to
 * N+1. Returns the `ENTER_HOLD` decision narrowed for the caller.
 */
export function assertDecisionFreshForCase(
  decision: SafetyPrecheckDecision,
  current: { caseId: string; status: SafetyCaseStatus; version: number }
): Extract<SafetyPrecheckDecision, { kind: 'ENTER_HOLD' }> {
  if (decision.kind !== 'ENTER_HOLD') {
    throw new SafetyError('SAFETY_PRECHECK_INVALID', 'decision cannot enter hold');
  }
  if (decision.caseId !== current.caseId) {
    throw new SafetyError('SAFETY_PRECHECK_INVALID', 'decision case mismatch');
  }
  if (decision.caseVersion !== current.version) {
    throw new SafetyError('SAFETY_PRECHECK_STALE');
  }
  if (current.status === 'SAFETY_HOLD') {
    throw new SafetyError('SAFETY_HOLD_ALREADY_ACTIVE');
  }
  if (current.status === 'CLOSED') {
    throw new SafetyError('CASE_CLOSED');
  }
  return decision;
}

/** Narrow a decision that must be revalidated before a hold transition. */
export function isEnterHoldDecision(
  decision: SafetyPrecheckDecision
): decision is Extract<SafetyPrecheckDecision, { kind: 'ENTER_HOLD' }> {
  return decision.kind === 'ENTER_HOLD';
}