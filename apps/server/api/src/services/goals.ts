/**
 * Common Core Goal / ConfirmGoal application orchestration.
 *
 * SAVE persists one immutable Goal version and leaves Case.phase=GOALS.
 * CONFIRM targets an exact persisted Goal/version and is the only production
 * owner of GOALS -> PLANNING.
 */
import type pg from 'pg';
import {
  GoalRuntimeError,
  assertCaseGuards,
  assertGoalDependenciesCoverProblemFormulation,
  bumpCaseVersionWithoutPhaseChange,
  canonicalEvidenceKey,
  caseVersionEtag,
  confirmGoalTransition,
  getSceneNodeState,
  getScenePackageBinding,
  goalContractFromRow,
  hashPayload,
  insertGoalAudit,
  insertGoalCaseEvent,
  insertGoalVersion,
  isProblemFormulationAuthoritativeExecutionBasis,
  lockActiveGoal,
  lockCaseForProblemFormulation,
  lockCurrentProblemFormulation,
  lockFamilyForPrimaryDecision,
  lockGoalVersion,
  normalizedGoalContract,
  resolveActiveCaseParticipantPersonIds,
  resolveEvidenceRefs,
  revalidateStoredEvidenceDependencies,
  supersedeGoalVersion,
  validateGoalContract,
  type DependencyRef,
  type GoalContractInput,
  type GoalRow,
} from '@xiaoshuyin/domain';
import {
  assertMinorProcessingAllowed,
  getComplianceProfileForUpdate,
  getConsentRecordForGate,
  getCurrentNoticeHash,
  type AgeBand,
} from '@xiaoshuyin/compliance';
import { withRlsTransaction } from '../db/tx.js';
import { isKnownAuthorizationDenial, requireFamilyAction } from '../authz.js';
import {
  runIdempotentCommandInTransaction,
  type CommandOutcome,
} from '../idempotency.js';
import { toHttpError } from '../plugins/error-handler.js';

export interface GoalServiceActor {
  accountId: string;
  personId: string;
}

export interface SaveGoalInput {
  actor: GoalServiceActor;
  familyId: string;
  caseId: string;
  expectedCaseVersion: number;
  idempotencyKey: string;
  contract: GoalContractInput;
}

export interface ConfirmGoalInput {
  actor: GoalServiceActor;
  familyId: string;
  caseId: string;
  expectedCaseVersion: number;
  idempotencyKey: string;
  goalId: string;
  goalVersion: number;
}

export interface GoalCommandResult {
  status: number;
  body: unknown;
  etag: string | null;
}

function httpError(
  code: string,
  message?: string
): Error & { statusCode: number; code: string } {
  const mapped = toHttpError(code, message);
  return Object.assign(new Error(mapped.message), {
    statusCode: mapped.statusCode,
    code: mapped.code,
  });
}

function rethrowKnown(error: unknown): never {
  if (error instanceof GoalRuntimeError) {
    throw httpError(error.code, error.message);
  }
  const code =
    typeof error === 'object' && error !== null
      ? (error as { code?: unknown }).code
      : undefined;
  if (typeof code === 'string') {
    const mapped = toHttpError(code);
    if (mapped.statusCode < 500) {
      throw httpError(code, (error as Error).message);
    }
  }
  throw error;
}

async function authorizeGoal(
  tx: pg.PoolClient,
  input: {
    actor: GoalServiceActor;
    familyId: string;
    caseId: string;
    action: 'CASE_SAVE_GOAL' | 'CASE_CONFIRM_GOAL';
  }
): Promise<void> {
  try {
    await requireFamilyAction(tx, {
      accountId: input.actor.accountId,
      personId: input.actor.personId,
      familyId: input.familyId,
      caseId: input.caseId,
      action: input.action,
      purpose: 'FAMILY_MANAGEMENT',
      resource: {
        type: 'CASE',
        familyId: input.familyId,
        caseId: input.caseId,
      },
    });
  } catch (error) {
    if (!isKnownAuthorizationDenial(error)) throw error;
    throw httpError('CASE_NOT_FOUND', 'Case not found');
  }
}

const CONSENT_REASONS = new Set([
  'GUARDIAN_CONSENT_REQUIRED',
  'GUARDIAN_CONSENT_REVOKED',
  'CONSENT_SUBJECT_MISMATCH',
  'NOTICE_VERSION_MISMATCH',
]);

async function assertGoalCompliance(
  tx: pg.PoolClient,
  personIds: readonly string[]
): Promise<void> {
  for (const personId of [...new Set(personIds)].sort()) {
    const profileRow = await getComplianceProfileForUpdate(tx, personId);
    const profile = profileRow
      ? {
          ageBand: profileRow.age_band as AgeBand,
          minorMode: profileRow.minor_mode as boolean,
          guardianPersonId: profileRow.guardian_person_id as string | null,
          guardianConsentRecordId:
            profileRow.guardian_consent_record_id as string | null,
          guardianConsentVersion:
            profileRow.guardian_consent_version as number | null,
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
          decision: consentRow.decision as 'GRANTED' | 'REVOKED',
          boundPersonId: consentRow.bound_person_id as string | null,
          noticeHash: consentRow.notice_hash as string,
          guardianPersonId: consentRow.guardian_person_id as string,
        }
      : null;

    const result = assertMinorProcessingAllowed(personId, {
      getProfile: () => profile,
      getConsentRecord: (id: string) =>
        consent && id.toLowerCase() === consent.id.toLowerCase()
          ? consent
          : null,
      getCurrentNoticeHash,
    });

    if (result.decision === 'BLOCK') {
      const code = CONSENT_REASONS.has(result.reason)
        ? 'CONSENT_BLOCKED'
        : 'COMPLIANCE_BLOCKED';
      throw httpError(code, result.reason);
    }
  }
}

async function assertGoalDependencyConsents(
  tx: pg.PoolClient,
  refs: GoalContractInput['dependencyRefs']
): Promise<void> {
  for (const ref of refs) {
    if (ref.type !== 'CONSENT') continue;
    const consent = await getConsentRecordForGate(tx, ref.id);
    if (
      !consent ||
      consent.decision !== 'GRANTED' ||
      (ref.version !== undefined && consent.version !== ref.version)
    ) {
      throw httpError(
        'CONSENT_BLOCKED',
        'Goal Consent dependency is no longer current'
      );
    }
  }
}

async function lockGoalBasis(
  tx: pg.PoolClient,
  input: {
    familyId: string;
    caseId: string;
    expectedCaseVersion: number;
  }
) {
  const familyLocked = await lockFamilyForPrimaryDecision(tx, input.familyId);
  if (!familyLocked) throw httpError('CASE_NOT_FOUND', 'Case not found');

  const caseRow = await lockCaseForProblemFormulation(tx, input.caseId);
  if (!caseRow) throw httpError('CASE_NOT_FOUND', 'Case not found');
  assertCaseGuards(caseRow, input.expectedCaseVersion, 'GOALS');

  const formulation = await lockCurrentProblemFormulation(tx, input.caseId);
  if (
    !formulation ||
    !isProblemFormulationAuthoritativeExecutionBasis(formulation)
  ) {
    throw httpError(
      'CASE_PHASE_CONFLICT',
      'Current confirmed Problem Formulation required'
    );
  }

  return { caseRow, formulation };
}

function assertExactFormulation(
  formulation: {
    id: string;
    version: number;
    dependency_refs: DependencyRef[];
  },
  contract: GoalContractInput
): void {
  if (
    formulation.id.toLowerCase() !==
      contract.problemFormulationId.toLowerCase() ||
    formulation.version !== contract.problemFormulationVersion
  ) {
    throw httpError(
      'CASE_PHASE_CONFLICT',
      'Goal is bound to a stale Problem Formulation'
    );
  }

  assertGoalDependenciesCoverProblemFormulation(
    formulation.dependency_refs,
    contract.dependencyRefs
  );
}

async function assertGoalEvidence(
  tx: pg.PoolClient,
  caseId: string,
  contract: GoalContractInput
): Promise<void> {
  const allRefs = [
    ...contract.baselineRefs,
    ...contract.participantResponsibilities.flatMap(
      (item) => item.evidenceRefs
    ),
  ];
  await revalidateStoredEvidenceDependencies(
    tx,
    caseId,
    contract.dependencyRefs
  );

  const resolved = await resolveEvidenceRefs(tx, caseId, allRefs);
  if (resolved.missing.length > 0) {
    throw httpError(
      'VALIDATION_ERROR',
      'Goal Evidence reference is missing or cross-Case'
    );
  }
  for (const member of resolved.members.values()) {
    if (!member.usable) {
      throw httpError('CASE_PHASE_CONFLICT', 'Goal Evidence is stale');
    }
  }

  const activeParticipants = new Set(
    await resolveActiveCaseParticipantPersonIds(tx, caseId)
  );
  for (const responsibility of contract.participantResponsibilities) {
    if (!activeParticipants.has(responsibility.personId)) {
      throw httpError(
        'VALIDATION_ERROR',
        'Participant responsibility requires ACTIVE participation'
      );
    }
    const supported = responsibility.evidenceRefs.some((ref) => {
      const member = resolved.members.get(canonicalEvidenceKey(ref));
      return member?.personIds.includes(responsibility.personId) === true;
    });
    if (!supported) {
      throw httpError(
        'VALIDATION_ERROR',
        'Participant responsibility lacks participant Evidence'
      );
    }
  }
}

async function assertStoredGoalCurrent(
  tx: pg.PoolClient,
  input: {
    caseId: string;
    goal: GoalRow;
    formulation: {
      id: string;
      version: number;
      dependency_refs: DependencyRef[];
    };
  }
): Promise<GoalContractInput> {
  if (
    input.goal.lifecycle_status !== 'ACTIVE' ||
    input.goal.confirmation_state !== 'UNCONFIRMED' ||
    input.goal.review_state !== 'CURRENT'
  ) {
    throw httpError('CASE_PHASE_CONFLICT', 'Goal version is stale');
  }

  const contract = goalContractFromRow(input.goal);
  validateGoalContract(contract);
  assertExactFormulation(input.formulation, contract);
  await assertGoalEvidence(tx, input.caseId, contract);
  await assertGoalDependencyConsents(tx, contract.dependencyRefs);
  return contract;
}

async function assertA2010Completed(
  tx: pg.PoolClient,
  caseId: string
): Promise<void> {
  const binding = await getScenePackageBinding(tx, caseId);
  const a2010 = await getSceneNodeState(tx, caseId, 'A2010', true);
  if (
    binding === null ||
    a2010 === null ||
    a2010.scene_package_version !== binding ||
    a2010.status !== 'COMPLETED'
  ) {
    throw httpError(
      'CASE_PHASE_CONFLICT',
      'A2010 solution-stage prerequisite is incomplete'
    );
  }
}

function commandResult(outcome: CommandOutcome): GoalCommandResult {
  if (outcome.action === 'MISMATCH') {
    throw httpError(
      'IDEMPOTENCY_PAYLOAD_MISMATCH',
      'Idempotency payload mismatch'
    );
  }
  const body = outcome.body as { caseVersion?: unknown };
  const etag =
    typeof body?.caseVersion === 'number'
      ? caseVersionEtag(body.caseVersion)
      : null;
  return { status: outcome.status, body: outcome.body, etag };
}

export async function saveGoal(
  pool: pg.Pool,
  input: SaveGoalInput
): Promise<GoalCommandResult> {
  try {
    validateGoalContract(input.contract);

    return await withRlsTransaction(
      pool,
      {
        familyId: input.familyId,
        accountId: input.actor.accountId,
        personId: input.actor.personId,
        purpose: 'FAMILY_MANAGEMENT',
      },
      async (tx) => {
        await authorizeGoal(tx, {
          actor: input.actor,
          familyId: input.familyId,
          caseId: input.caseId,
          action: 'CASE_SAVE_GOAL',
        });

        const requestHash = hashPayload({
          familyId: input.familyId,
          caseId: input.caseId,
          expectedCaseVersion: input.expectedCaseVersion,
          operation: 'SAVE',
          contract: normalizedGoalContract(input.contract),
        });

        const outcome = await runIdempotentCommandInTransaction(
          tx,
          {
            accountId: input.actor.accountId,
            personId: input.actor.personId,
            purpose: 'FAMILY_MANAGEMENT',
            commandType: 'GOAL_SAVE',
            idempotencyKey: input.idempotencyKey,
            requestHash,
          },
          async () => {
            const { caseRow, formulation } = await lockGoalBasis(tx, input);
            assertExactFormulation(formulation, input.contract);
            await assertGoalEvidence(tx, input.caseId, input.contract);
            await assertGoalDependencyConsents(
              tx,
              input.contract.dependencyRefs
            );

            const activeParticipants =
              await resolveActiveCaseParticipantPersonIds(tx, input.caseId);
            await assertGoalCompliance(tx, [
              input.actor.personId,
              caseRow.created_by_person_id,
              ...activeParticipants,
            ]);

            const active = await lockActiveGoal(tx, input.caseId);
            if (active?.confirmation_state === 'CONFIRMED') {
              throw httpError(
                'CASE_PHASE_CONFLICT',
                'Confirmed Goal cannot be replaced'
              );
            }

            const nextVersion = active ? active.version + 1 : 1;
            if (nextVersion > 2147483647) {
              throw httpError(
                'CASE_PHASE_CONFLICT',
                'Goal version exhausted'
              );
            }

            if (active) {
              await supersedeGoalVersion(tx, {
                goalId: active.goal_id,
                goalVersion: active.version,
              });
            }

            const goal = await insertGoalVersion(tx, {
              goalId: active?.goal_id ?? null,
              familyId: input.familyId,
              caseId: input.caseId,
              version: nextVersion,
              supersedesVersion: active?.version ?? null,
              savedByPersonId: input.actor.personId,
              contract: input.contract,
            });

            const updatedCase = await bumpCaseVersionWithoutPhaseChange(tx, {
              caseId: input.caseId,
              expectedVersion: input.expectedCaseVersion,
            });

            await insertGoalAudit(tx, {
              familyId: input.familyId,
              actorAccountId: input.actor.accountId,
              eventType: 'GOAL_SAVED',
              goalId: goal.goal_id,
              metadata: {
                goalVersion: goal.version,
                caseId: input.caseId,
                caseVersion: updatedCase.version,
                problemFormulationId: goal.problem_formulation_id,
                problemFormulationVersion:
                  goal.problem_formulation_version,
              },
            });

            return {
              status: 201,
              body: {
                operation: 'SAVE',
                goalId: goal.goal_id,
                goalVersion: goal.version,
                caseVersion: updatedCase.version,
                phase: 'GOALS',
                confirmationState: 'UNCONFIRMED',
              },
            };
          }
        );

        return commandResult(outcome);
      }
    );
  } catch (error) {
    return rethrowKnown(error);
  }
}

export async function confirmGoal(
  pool: pg.Pool,
  input: ConfirmGoalInput
): Promise<GoalCommandResult> {
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
        await authorizeGoal(tx, {
          actor: input.actor,
          familyId: input.familyId,
          caseId: input.caseId,
          action: 'CASE_CONFIRM_GOAL',
        });

        const requestHash = hashPayload({
          familyId: input.familyId,
          caseId: input.caseId,
          expectedCaseVersion: input.expectedCaseVersion,
          operation: 'CONFIRM',
          goalId: input.goalId.toLowerCase(),
          goalVersion: input.goalVersion,
        });

        const outcome = await runIdempotentCommandInTransaction(
          tx,
          {
            accountId: input.actor.accountId,
            personId: input.actor.personId,
            purpose: 'FAMILY_MANAGEMENT',
            commandType: 'GOAL_CONFIRM',
            idempotencyKey: input.idempotencyKey,
            requestHash,
          },
          async () => {
            const { caseRow, formulation } = await lockGoalBasis(tx, input);
            const goal = await lockGoalVersion(tx, {
              caseId: input.caseId,
              goalId: input.goalId,
              goalVersion: input.goalVersion,
            });
            if (!goal) {
              throw httpError(
                'CASE_PHASE_CONFLICT',
                'Goal version does not exist for this Case'
              );
            }

            await assertStoredGoalCurrent(tx, {
              caseId: input.caseId,
              goal,
              formulation,
            });

            const activeParticipants =
              await resolveActiveCaseParticipantPersonIds(tx, input.caseId);
            await assertGoalCompliance(tx, [
              input.actor.personId,
              caseRow.created_by_person_id,
              ...activeParticipants,
            ]);
            await assertA2010Completed(tx, input.caseId);

            const transition = await confirmGoalTransition(tx, {
              caseId: input.caseId,
              expectedCaseVersion: input.expectedCaseVersion,
              goalId: input.goalId,
              goalVersion: input.goalVersion,
              actorPersonId: input.actor.personId,
              fromPhase: 'GOALS',
              toPhase: 'PLANNING',
            });
            const updatedCase = { version: transition.caseVersion };
            const confirmed = transition.goal;

            await insertGoalCaseEvent(tx, {
              familyId: input.familyId,
              caseId: input.caseId,
              actorAccountId: input.actor.accountId,
              goalId: confirmed.goal_id,
              goalVersion: confirmed.version,
              fromVersion: input.expectedCaseVersion,
              toVersion: updatedCase.version,
            });

            await insertGoalAudit(tx, {
              familyId: input.familyId,
              actorAccountId: input.actor.accountId,
              eventType: 'GOAL_CONFIRMED',
              goalId: confirmed.goal_id,
              metadata: {
                goalVersion: confirmed.version,
                caseId: input.caseId,
                fromCaseVersion: input.expectedCaseVersion,
                toCaseVersion: updatedCase.version,
                confirmedByPersonId: input.actor.personId,
                problemFormulationId:
                  confirmed.problem_formulation_id,
                problemFormulationVersion:
                  confirmed.problem_formulation_version,
              },
            });

            return {
              status: 200,
              body: {
                operation: 'CONFIRM',
                goalId: confirmed.goal_id,
                goalVersion: confirmed.version,
                caseVersion: updatedCase.version,
                phase: 'PLANNING',
                confirmationState: 'CONFIRMED',
                confirmedBy: confirmed.confirmed_by_person_id,
                confirmedAt:
                  confirmed.confirmed_at?.toISOString() ?? null,
              },
            };
          }
        );

        return commandResult(outcome);
      }
    );
  } catch (error) {
    return rethrowKnown(error);
  }
}
