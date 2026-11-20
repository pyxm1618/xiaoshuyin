/**
 * Phase 5 / C2 — internal Safety production entry / resolve orchestration.
 *
 * This module is deliberately NOT an HTTP route. It is the narrow production
 * seam between server-owned Safety inputs and the already-reviewed Slice 9
 * Domain Commands:
 *
 *   approved deterministic evaluator -> runSafetyPrecheck -> enterSafetyHold
 *   authenticated Staff actor         -> resolveRisk
 *
 * C2 owns no Safety persistence and no Staff control plane. In particular:
 *   - callers cannot supply a Safety decision or trusted policy identity;
 *   - callers cannot supply isHighRisk / canResolve authority booleans;
 *   - all business writes remain inside EnterSafetyHold / ResolveRisk;
 *   - ResolveRisk still owns production Staff authority verification;
 *   - there is intentionally no production approved professional rule asset
 *     yet. The default production policy runtime therefore fails closed until
 *     D6 provides a reviewed asset.
 */

import pg from 'pg';
import {
  SafetyError,
  getCaseById,
  runSafetyPrecheck,
  type ApprovedPolicyIdentity,
  type ApprovedRuleEvaluation,
  type OpaqueEvidenceReference,
  type SafetyCaseSnapshot,
} from '@xiaoshuyin/domain';
import { withIdentityTransaction, withRlsTransaction } from '../db/tx.js';
import { requireCurrentFamily } from '../family-context.js';
import { requireFamilyAction } from '../authz.js';
import { toHttpError } from '../plugins/error-handler.js';
import { enterSafetyHold } from './enter-safety-hold.js';
import { resolveRisk } from './resolve-risk.js';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ENTER_INPUT_KEYS = new Set(['actor', 'caseId', 'idempotencyKey']);
const RESOLVE_INPUT_KEYS = new Set([
  'actor',
  'caseId',
  'idempotencyKey',
  'expectedCaseVersion',
  'reviewEvidenceRefs',
]);
const ACTOR_KEYS = new Set(['accountId', 'personId']);

export type SafetyPolicyIdentityResult =
  | { status: 'AVAILABLE'; identity: ApprovedPolicyIdentity }
  | { status: 'UNAVAILABLE' };

export type SafetyApprovedEvaluationResult =
  | { status: 'AVAILABLE'; evaluation: ApprovedRuleEvaluation }
  | { status: 'UNAVAILABLE' };

/**
 * Server-owned seam implemented later by the approved professional Safety
 * asset. The production caller never receives these values from a client.
 */
export interface ApprovedSafetyPolicyRuntime {
  currentIdentity(input: {
    caseId: string;
  }): Promise<SafetyPolicyIdentityResult>;

  evaluate(input: {
    case: SafetyCaseSnapshot;
    trustedPolicyIdentity: ApprovedPolicyIdentity;
  }): Promise<SafetyApprovedEvaluationResult>;
}

export interface SafetyServerActor {
  accountId: string;
  personId: string;
}

export interface SafetyProductionEnterInput {
  actor: SafetyServerActor;
  caseId: string;
  idempotencyKey: string;
}

export interface SafetyProductionResolveInput {
  actor: SafetyServerActor;
  caseId: string;
  idempotencyKey: string;
  expectedCaseVersion: number;
  reviewEvidenceRefs: OpaqueEvidenceReference[];
}

export type SafetyProductionEnterResult =
  | { kind: 'ALLOW'; caseId: string; caseVersion: number }
  | { kind: 'ALREADY_HELD'; caseId: string; caseVersion: number }
  | {
      kind: 'ENTER_HOLD';
      caseId: string;
      caseVersion: number;
      command: { status: number; body: unknown };
    };

export interface SafetyProductionService {
  enter(input: SafetyProductionEnterInput): Promise<SafetyProductionEnterResult>;
  resolve(input: SafetyProductionResolveInput): Promise<{ status: number; body: unknown }>;
}

export class SafetyProductionEntryError extends Error {
  readonly code:
    | 'SAFETY_PRODUCTION_INPUT_INVALID'
    | 'SAFETY_PRODUCTION_RULE_ASSET_UNAVAILABLE';

  constructor(
    code:
      | 'SAFETY_PRODUCTION_INPUT_INVALID'
      | 'SAFETY_PRODUCTION_RULE_ASSET_UNAVAILABLE'
  ) {
    super(code);
    this.name = 'SafetyProductionEntryError';
    this.code = code;
  }
}

function invalidInput(): never {
  throw new SafetyProductionEntryError('SAFETY_PRODUCTION_INPUT_INVALID');
}

function ruleAssetUnavailable(): never {
  throw new SafetyProductionEntryError(
    'SAFETY_PRODUCTION_RULE_ASSET_UNAVAILABLE'
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertExactKeys(
  value: unknown,
  expected: ReadonlySet<string>
): asserts value is Record<string, unknown> {
  if (!isRecord(value)) invalidInput();
  const keys = Object.keys(value);
  if (
    keys.length !== expected.size ||
    keys.some((key) => !expected.has(key))
  ) {
    invalidInput();
  }
}

function requireString(value: unknown): string {
  if (typeof value !== 'string' || value.trim() === '') invalidInput();
  return value;
}

function validateActor(value: unknown): SafetyServerActor {
  assertExactKeys(value, ACTOR_KEYS);
  return {
    accountId: requireString(value['accountId']),
    personId: requireString(value['personId']),
  };
}

function validateEnterInput(value: unknown): SafetyProductionEnterInput {
  assertExactKeys(value, ENTER_INPUT_KEYS);
  const caseId = requireString(value['caseId']).toLowerCase();
  if (!UUID_PATTERN.test(caseId)) invalidInput();

  const idempotencyKey = requireString(value['idempotencyKey']);
  if (idempotencyKey.length < 8 || idempotencyKey.length > 128) {
    invalidInput();
  }

  return {
    actor: validateActor(value['actor']),
    caseId,
    idempotencyKey,
  };
}

function validateResolveInput(value: unknown): SafetyProductionResolveInput {
  assertExactKeys(value, RESOLVE_INPUT_KEYS);
  const caseId = requireString(value['caseId']).toLowerCase();
  if (!UUID_PATTERN.test(caseId)) invalidInput();

  const idempotencyKey = requireString(value['idempotencyKey']);
  if (idempotencyKey.length < 8 || idempotencyKey.length > 128) {
    invalidInput();
  }

  const expectedCaseVersion = value['expectedCaseVersion'];
  if (
    typeof expectedCaseVersion !== 'number' ||
    !Number.isInteger(expectedCaseVersion) ||
    expectedCaseVersion < 1
  ) {
    invalidInput();
  }

  if (!Array.isArray(value['reviewEvidenceRefs'])) invalidInput();

  return {
    actor: validateActor(value['actor']),
    caseId,
    idempotencyKey,
    expectedCaseVersion,
    reviewEvidenceRefs: value['reviewEvidenceRefs'] as OpaqueEvidenceReference[],
  };
}

function httpError(code: string, message?: string) {
  const error = toHttpError(code, message);
  return Object.assign(new Error(error.message), error);
}

function sameIdentity(
  left: ApprovedPolicyIdentity,
  right: ApprovedPolicyIdentity
): boolean {
  return (
    left.policyRef === right.policyRef &&
    left.policyVersion === right.policyVersion &&
    left.ruleRef === right.ruleRef &&
    left.ruleVersion === right.ruleVersion
  );
}

async function requireCurrentIdentity(
  runtime: ApprovedSafetyPolicyRuntime,
  caseId: string
): Promise<ApprovedPolicyIdentity> {
  const result = await runtime.currentIdentity({ caseId });
  if (result.status !== 'AVAILABLE') ruleAssetUnavailable();
  return result.identity;
}

async function requireApprovedEvaluation(
  runtime: ApprovedSafetyPolicyRuntime,
  input: {
    case: SafetyCaseSnapshot;
    trustedPolicyIdentity: ApprovedPolicyIdentity;
  }
): Promise<ApprovedRuleEvaluation> {
  const result = await runtime.evaluate(input);
  if (result.status !== 'AVAILABLE') ruleAssetUnavailable();

  // C2 strengthens the orchestration boundary for both outcomes. A stale
  // NO_HOLD evaluation must never become ALLOW simply because it was produced
  // by a superseded approved rule identity.
  if (!sameIdentity(result.evaluation, input.trustedPolicyIdentity)) {
    throw new SafetyError('SAFETY_PRECHECK_STALE');
  }

  return result.evaluation;
}

async function readAuthorizedCaseSnapshot(
  pool: pg.Pool,
  input: {
    actor: SafetyServerActor;
    caseId: string;
  }
): Promise<SafetyCaseSnapshot> {
  const familyId = await withIdentityTransaction(
    pool,
    { accountId: input.actor.accountId, purpose: 'FAMILY_MANAGEMENT' },
    (tx) => requireCurrentFamily(tx, input.actor.personId)
  );

  return withRlsTransaction(
    pool,
    {
      familyId,
      accountId: input.actor.accountId,
      personId: input.actor.personId,
      purpose: 'FAMILY_MANAGEMENT',
    },
    async (tx) => {
      await requireFamilyAction(tx, {
        accountId: input.actor.accountId,
        personId: input.actor.personId,
        familyId,
        action: 'CASE_ENTER_SAFETY_HOLD',
        purpose: 'FAMILY_MANAGEMENT',
        resource: { type: 'CASE', familyId, caseId: input.caseId },
        caseId: input.caseId,
      });

      const row = await getCaseById(tx, input.caseId);
      if (!row || row.family_id !== familyId) {
        throw httpError('CASE_NOT_FOUND', 'Case not found');
      }

      return {
        caseId: row.id,
        status: row.status,
        version: row.version,
      };
    }
  );
}

/**
 * Construct the narrow C2 production orchestrator around an approved runtime.
 *
 * The runtime is a composition dependency, never a per-request/client field.
 * D6 may supply the real reviewed implementation later without changing either
 * Domain Command or exposing a public Safety mutation endpoint.
 */
export function createSafetyProductionService(
  pool: pg.Pool,
  runtime: ApprovedSafetyPolicyRuntime
): SafetyProductionService {
  return {
    async enter(rawInput) {
      const input = validateEnterInput(rawInput);
      const snapshot = await readAuthorizedCaseSnapshot(pool, {
        actor: input.actor,
        caseId: input.caseId,
      });

      const trustedPolicyIdentity = await requireCurrentIdentity(
        runtime,
        snapshot.caseId
      );

      const approvedEvaluation =
        snapshot.status === 'SAFETY_HOLD'
          ? undefined
          : await requireApprovedEvaluation(runtime, {
              case: snapshot,
              trustedPolicyIdentity,
            });

      const decision = runSafetyPrecheck({
        case: snapshot,
        trustedPolicyIdentity,
        ...(approvedEvaluation === undefined
          ? {}
          : { approvedEvaluation }),
      });

      if (decision.kind === 'ALLOW' || decision.kind === 'ALREADY_HELD') {
        return decision;
      }

      // Re-read the server-owned current identity immediately before the
      // command. EnterSafetyHold then compares this value with the decision
      // again after locking/re-reading the Case, preserving the existing
      // policy-identity + Case-version TOCTOU protections.
      const currentIdentity = await requireCurrentIdentity(
        runtime,
        snapshot.caseId
      );

      const command = await enterSafetyHold(pool, {
        accountId: input.actor.accountId,
        personId: input.actor.personId,
        caseId: snapshot.caseId,
        idempotencyKey: input.idempotencyKey,
        expectedCaseVersion: snapshot.version,
        decision,
        trustedPolicyIdentity: currentIdentity,
      });

      return {
        kind: 'ENTER_HOLD',
        caseId: snapshot.caseId,
        caseVersion: snapshot.version,
        command,
      };
    },

    async resolve(rawInput) {
      const input = validateResolveInput(rawInput);
      const trustedPolicyIdentity = await requireCurrentIdentity(
        runtime,
        input.caseId
      );

      // ResolveRisk remains the single legal exit and performs the authoritative
      // production Staff capability + exact Case assignment verification in its
      // own transaction. This layer supplies no isStaff/canResolve shortcut.
      return resolveRisk(pool, {
        accountId: input.actor.accountId,
        personId: input.actor.personId,
        caseId: input.caseId,
        idempotencyKey: input.idempotencyKey,
        expectedCaseVersion: input.expectedCaseVersion,
        reviewEvidenceRefs: input.reviewEvidenceRefs,
        trustedPolicyIdentity,
      });
    },
  };
}

/**
 * Current production composition before D6.
 *
 * There is intentionally NO fake policy/rule identity and NO invented
 * professional detection rule. Any formal C2 invocation therefore fails
 * closed/unavailable before a Safety mutation until D6 installs the reviewed
 * runtime asset.
 */
export function createProductionSafetyPolicyRuntime(): ApprovedSafetyPolicyRuntime {
  return {
    async currentIdentity() {
      return { status: 'UNAVAILABLE' };
    },
    async evaluate() {
      return { status: 'UNAVAILABLE' };
    },
  };
}

export function createProductionSafetyService(
  pool: pg.Pool
): SafetyProductionService {
  return createSafetyProductionService(
    pool,
    createProductionSafetyPolicyRuntime()
  );
}
