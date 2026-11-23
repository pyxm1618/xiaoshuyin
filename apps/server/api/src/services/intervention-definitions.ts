import type pg from 'pg';
import {
  hashPayload,
  prepareInterventionDefinition,
  type InterventionDefinitionRecord,
} from '@xiaoshuyin/domain';
import {
  getCurrentInterventionDefinitionChainHead,
  getCurrentProfessionalReviewStaffAssignment,
  getExactInterventionDefinition,
  insertInterventionDefinitionAudit,
  insertInterventionDefinitionCandidate,
  lockInterventionDefinitionChain,
  transitionInterventionDefinitionStateCas,
} from '../../../../../packages/domain/src/intervention-definition-repository.js';
import { withIdentityTransaction } from '../db/tx.js';
import {
  lockIdempotentCommandInTransaction,
  peekIdempotentCommandInTransaction,
  runLockedIdempotentCommandInTransaction,
} from '../idempotency.js';
import {
  requireInterventionProfessionalQualification,
  unavailableProductionInterventionProfessionalQualificationProvider,
  type InterventionProfessionalQualificationProvider,
} from './intervention-professional-authority.js';

export interface InterventionDefinitionMutationActor {
  readonly accountId: string;
  readonly personId: string;
}

function assertExpectedApprovalScope(assertedScope: string, authoritativeScope: string): string {
  if (assertedScope !== authoritativeScope) {
    throw Object.assign(new Error('INTERVENTION_APPROVAL_SCOPE_MISMATCH'), {
      code: 'INTERVENTION_APPROVAL_SCOPE_MISMATCH',
    });
  }
  return authoritativeScope;
}

async function assertMutationAuthority(
  tx: pg.PoolClient,
  actor: InterventionDefinitionMutationActor,
  qualificationProvider: InterventionProfessionalQualificationProvider,
  approvalScope: string
): Promise<{ assignmentRef: string; qualificationRef: string }> {
  // Finding #17: Acquire row-level lock on authoritative Account row and revalidate status === 'ACTIVE'.
  // Closes TOCTOU gap where an account becomes inactive between earlier authorization and mutation commit.
  const accountRes = await tx.query<{ status: string }>(
    'SELECT status FROM accounts WHERE id = $1 FOR KEY SHARE',
    [actor.accountId]
  );
  if (accountRes.rows.length === 0 || accountRes.rows[0]?.status !== 'ACTIVE') {
    throw Object.assign(new Error('INTERVENTION_STAFF_AUTHORITY_INVALID'), {
      code: 'INTERVENTION_STAFF_AUTHORITY_INVALID',
    });
  }

  const staff = await getCurrentProfessionalReviewStaffAssignment(tx, actor);
  if (staff === null) {
    throw Object.assign(new Error('INTERVENTION_STAFF_AUTHORITY_INVALID'), {
      code: 'INTERVENTION_STAFF_AUTHORITY_INVALID',
    });
  }
  const qualification = await requireInterventionProfessionalQualification(
    qualificationProvider,
    { reviewerIdentityRef: actor.personId, approvalScope }
  );
  return { assignmentRef: staff.assignmentRef, qualificationRef: qualification.qualificationRef };
}

function hydrateInterventionDefinitionRecord(value: unknown): InterventionDefinitionRecord {
  if (typeof value !== 'object' || value === null) {
    throw Object.assign(new Error('INTERVENTION_REPLAY_INVALID'), {
      code: 'INTERVENTION_DEPENDENCY_UNAVAILABLE',
    });
  }
  const row = value as InterventionDefinitionRecord & {
    createdAt: Date | string;
    supersededAt: Date | string | null;
    retiredAt: Date | string | null;
  };
  const toDate = (date: Date | string | null): Date | null =>
    date === null ? null : date instanceof Date ? date : new Date(date);
  const createdAt = toDate(row.createdAt);
  if (createdAt === null || Number.isNaN(createdAt.getTime())) {
    throw Object.assign(new Error('INTERVENTION_REPLAY_INVALID'), {
      code: 'INTERVENTION_DEPENDENCY_UNAVAILABLE',
    });
  }
  const supersededAt = toDate(row.supersededAt);
  const retiredAt = toDate(row.retiredAt);
  if (
    (supersededAt !== null && Number.isNaN(supersededAt.getTime())) ||
    (retiredAt !== null && Number.isNaN(retiredAt.getTime()))
  ) {
    throw Object.assign(new Error('INTERVENTION_REPLAY_INVALID'), {
      code: 'INTERVENTION_DEPENDENCY_UNAVAILABLE',
    });
  }
  return {
    ...row,
    createdAt,
    supersededAt,
    retiredAt,
  };
}

function outcomeBody(outcome: Awaited<ReturnType<typeof runLockedIdempotentCommandInTransaction>>):
  InterventionDefinitionRecord {
  if (outcome.action === 'MISMATCH') {
    throw Object.assign(new Error('IDEMPOTENCY_PAYLOAD_MISMATCH'), {
      code: 'IDEMPOTENCY_PAYLOAD_MISMATCH',
      statusCode: 409,
    });
  }
  return hydrateInterventionDefinitionRecord(outcome.body);
}

export async function createInterventionDefinitionCandidate(
  pool: pg.Pool,
  input: {
    actor: InterventionDefinitionMutationActor;
    sceneId: string;
    interventionCode: string;
    semantic: unknown;
    approvalScope: string;
    idempotencyKey: string;
  },
  qualificationProvider: InterventionProfessionalQualificationProvider =
    unavailableProductionInterventionProfessionalQualificationProvider
): Promise<InterventionDefinitionRecord> {
  return withIdentityTransaction(
    pool,
    { accountId: input.actor.accountId, purpose: 'SELF_IDENTITY' },
    async (tx) => {
      const prepared = prepareInterventionDefinition({
        sceneId: input.sceneId,
        interventionCode: input.interventionCode,
        version: 1,
        semantic: input.semantic,
      });
      const authoritativeScope = assertExpectedApprovalScope(
        input.approvalScope,
        prepared.sceneId
      );
      const requestHash = hashPayload({
        sceneId: prepared.sceneId,
        interventionCode: prepared.interventionCode,
        contentHash: prepared.contentHash,
        approvalScope: authoritativeScope,
      });
      const cfg = {
        accountId: input.actor.accountId,
        personId: input.actor.personId,
        purpose: 'SELF_IDENTITY',
        commandType: 'INTERVENTION_DEFINITION_CREATE' as const,
        idempotencyKey: input.idempotencyKey,
        requestHash,
      };
      const early = await peekIdempotentCommandInTransaction(tx, cfg);
      if (early) return outcomeBody(early);
      const authority = await assertMutationAuthority(tx, input.actor, qualificationProvider, authoritativeScope);
      await lockIdempotentCommandInTransaction(tx, cfg);
      const outcome = await runLockedIdempotentCommandInTransaction(tx, cfg, async () => {
        await lockInterventionDefinitionChain(tx, prepared.sceneId, prepared.interventionCode);
        const current = await getCurrentInterventionDefinitionChainHead(tx, prepared, true);
        if (current !== null) {
          throw Object.assign(new Error('INTERVENTION_DEFINITION_CONFLICT'), {
            code: 'INTERVENTION_DEFINITION_CONFLICT',
          });
        }
        const finalAuthority = await assertMutationAuthority(
          tx,
          input.actor,
          qualificationProvider,
          authoritativeScope
        );
        if (
          finalAuthority.assignmentRef !== authority.assignmentRef ||
          finalAuthority.qualificationRef !== authority.qualificationRef
        ) throw Object.assign(new Error('INTERVENTION_DEPENDENCY_UNAVAILABLE'), { code: 'INTERVENTION_DEPENDENCY_UNAVAILABLE' });
        const created = await insertInterventionDefinitionCandidate(tx, {
          ...prepared,
          supersedesId: null,
          createdByPersonId: input.actor.personId,
        });
        await insertInterventionDefinitionAudit(tx, {
          actorAccountId: input.actor.accountId,
          eventType: 'INTERVENTION_DEFINITION_CANDIDATE_CREATED',
          definitionId: created.id,
          metadata: {
            definitionVersion: created.version,
            contentHash: created.contentHash,
            revision: created.revision,
            staffAssignmentRef: authority.assignmentRef,
            qualificationRef: authority.qualificationRef,
          },
        });
        return { status: 201, body: created };
      });
      return outcomeBody(outcome);
    }
  );
}

export async function createInterventionDefinitionSuccessor(
  pool: pg.Pool,
  input: {
    actor: InterventionDefinitionMutationActor;
    predecessor: { id: string; version: number; contentHash: string; expectedRevision: number };
    semantic: unknown;
    approvalScope: string;
    idempotencyKey: string;
  },
  qualificationProvider: InterventionProfessionalQualificationProvider =
    unavailableProductionInterventionProfessionalQualificationProvider
): Promise<InterventionDefinitionRecord> {
  return withIdentityTransaction(
    pool,
    { accountId: input.actor.accountId, purpose: 'SELF_IDENTITY' },
    async (tx) => {
      const predecessor = await getExactInterventionDefinition(tx, input.predecessor, false);
      if (predecessor === null) throw Object.assign(new Error('INTERVENTION_DEFINITION_NOT_FOUND'), { code: 'INTERVENTION_DEFINITION_NOT_FOUND' });
      const prepared = prepareInterventionDefinition({
        sceneId: predecessor.sceneId,
        interventionCode: predecessor.interventionCode,
        version: predecessor.version + 1,
        semantic: input.semantic,
      });
      const authoritativeScope = assertExpectedApprovalScope(
        input.approvalScope,
        predecessor.sceneId
      );
      const requestHash = hashPayload({
        predecessor: input.predecessor,
        contentHash: prepared.contentHash,
        approvalScope: authoritativeScope,
      });
      const cfg = {
        accountId: input.actor.accountId,
        personId: input.actor.personId,
        purpose: 'SELF_IDENTITY',
        commandType: 'INTERVENTION_DEFINITION_SUCCESSOR_CREATE' as const,
        idempotencyKey: input.idempotencyKey,
        requestHash,
      };
      const early = await peekIdempotentCommandInTransaction(tx, cfg);
      if (early) return outcomeBody(early);
      const authority = await assertMutationAuthority(tx, input.actor, qualificationProvider, authoritativeScope);
      await lockIdempotentCommandInTransaction(tx, cfg);
      const outcome = await runLockedIdempotentCommandInTransaction(tx, cfg, async () => {
        await lockInterventionDefinitionChain(tx, prepared.sceneId, prepared.interventionCode);
        const locked = await getExactInterventionDefinition(tx, input.predecessor, true);
        if (
          locked === null ||
          locked.revision !== input.predecessor.expectedRevision ||
          (locked.state !== 'CANDIDATE' && locked.state !== 'CURRENT')
        ) {
          throw Object.assign(new Error('INTERVENTION_DEFINITION_STALE_REVISION'), {
            code: 'INTERVENTION_DEFINITION_STALE_REVISION',
          });
        }
        const current = await getCurrentInterventionDefinitionChainHead(
          tx,
          { sceneId: locked.sceneId, interventionCode: locked.interventionCode },
          true
        );
        if (current?.id !== locked.id) {
          throw Object.assign(new Error('INTERVENTION_DEFINITION_STALE_REVISION'), {
            code: 'INTERVENTION_DEFINITION_STALE_REVISION',
          });
        }
        const lockedScope = assertExpectedApprovalScope(authoritativeScope, locked.sceneId);
        const finalAuthority = await assertMutationAuthority(
          tx,
          input.actor,
          qualificationProvider,
          lockedScope
        );
        if (
          finalAuthority.assignmentRef !== authority.assignmentRef ||
          finalAuthority.qualificationRef !== authority.qualificationRef
        ) throw Object.assign(new Error('INTERVENTION_DEPENDENCY_UNAVAILABLE'), { code: 'INTERVENTION_DEPENDENCY_UNAVAILABLE' });
        const created = await insertInterventionDefinitionCandidate(tx, {
          ...prepared,
          supersedesId: locked.id,
          createdByPersonId: input.actor.personId,
        });
        const superseded = await transitionInterventionDefinitionStateCas(tx, {
          id: locked.id,
          expectedRevision: locked.revision,
          expectedState: locked.state,
          nextState: 'SUPERSEDED',
        });
        if (superseded === null) throw Object.assign(new Error('INTERVENTION_DEFINITION_STALE_REVISION'), { code: 'INTERVENTION_DEFINITION_STALE_REVISION' });
        await insertInterventionDefinitionAudit(tx, {
          actorAccountId: input.actor.accountId,
          eventType: 'INTERVENTION_DEFINITION_SUCCESSOR_CREATED',
          definitionId: created.id,
          metadata: {
            predecessorId: locked.id,
            definitionVersion: created.version,
            contentHash: created.contentHash,
            revision: created.revision,
            staffAssignmentRef: authority.assignmentRef,
            qualificationRef: authority.qualificationRef,
          },
        });
        return { status: 201, body: created };
      });
      return outcomeBody(outcome);
    }
  );
}

async function terminalTransition(
  pool: pg.Pool,
  input: {
    actor: InterventionDefinitionMutationActor;
    definition: { id: string; version: number; contentHash: string; expectedRevision: number };
    approvalScope: string;
    idempotencyKey: string;
    nextState: 'SUPERSEDED' | 'RETIRED';
  },
  qualificationProvider: InterventionProfessionalQualificationProvider
): Promise<InterventionDefinitionRecord> {
  return withIdentityTransaction(
    pool,
    { accountId: input.actor.accountId, purpose: 'SELF_IDENTITY' },
    async (tx) => {
      const chainIdentity = await getExactInterventionDefinition(tx, input.definition, false);
      if (chainIdentity === null) {
        throw Object.assign(new Error('INTERVENTION_DEFINITION_STALE_REVISION'), {
          code: 'INTERVENTION_DEFINITION_STALE_REVISION',
        });
      }
      const authoritativeScope = assertExpectedApprovalScope(
        input.approvalScope,
        chainIdentity.sceneId
      );
      const requestHash = hashPayload({
        definition: input.definition,
        nextState: input.nextState,
        approvalScope: authoritativeScope,
      });
      const commandType =
        input.nextState === 'RETIRED'
          ? 'INTERVENTION_DEFINITION_RETIRE'
          : 'INTERVENTION_DEFINITION_SUPERSEDE';
      const cfg = {
        accountId: input.actor.accountId,
        personId: input.actor.personId,
        purpose: 'SELF_IDENTITY',
        commandType,
        idempotencyKey: input.idempotencyKey,
        requestHash,
      } as const;
      const early = await peekIdempotentCommandInTransaction(tx, cfg);
      if (early) return outcomeBody(early);
      const authority = await assertMutationAuthority(tx, input.actor, qualificationProvider, authoritativeScope);
      await lockIdempotentCommandInTransaction(tx, cfg);
      const outcome = await runLockedIdempotentCommandInTransaction(tx, cfg, async () => {
        await lockInterventionDefinitionChain(
          tx,
          chainIdentity.sceneId,
          chainIdentity.interventionCode
        );
        const current = await getExactInterventionDefinition(tx, input.definition, true);
        if (
          current === null ||
          current.revision !== input.definition.expectedRevision ||
          (current.state !== 'CANDIDATE' && current.state !== 'CURRENT')
        ) throw Object.assign(new Error('INTERVENTION_DEFINITION_STALE_REVISION'), { code: 'INTERVENTION_DEFINITION_STALE_REVISION' });
        const lockedScope = assertExpectedApprovalScope(authoritativeScope, current.sceneId);
        const finalAuthority = await assertMutationAuthority(
          tx,
          input.actor,
          qualificationProvider,
          lockedScope
        );
        if (
          finalAuthority.assignmentRef !== authority.assignmentRef ||
          finalAuthority.qualificationRef !== authority.qualificationRef
        ) throw Object.assign(new Error('INTERVENTION_DEPENDENCY_UNAVAILABLE'), { code: 'INTERVENTION_DEPENDENCY_UNAVAILABLE' });
        const changed = await transitionInterventionDefinitionStateCas(tx, {
          id: current.id,
          expectedRevision: current.revision,
          expectedState: current.state,
          nextState: input.nextState,
        });
        if (changed === null) throw Object.assign(new Error('INTERVENTION_DEFINITION_STALE_REVISION'), { code: 'INTERVENTION_DEFINITION_STALE_REVISION' });
        await insertInterventionDefinitionAudit(tx, {
          actorAccountId: input.actor.accountId,
          eventType:
            input.nextState === 'RETIRED'
              ? 'INTERVENTION_DEFINITION_RETIRED'
              : 'INTERVENTION_DEFINITION_SUPERSEDED',
          definitionId: changed.id,
          metadata: {
            definitionVersion: changed.version,
            contentHash: changed.contentHash,
            revision: changed.revision,
            staffAssignmentRef: authority.assignmentRef,
            qualificationRef: authority.qualificationRef,
          },
        });
        return { status: 200, body: changed };
      });
      return outcomeBody(outcome);
    }
  );
}

export function retireInterventionDefinition(
  pool: pg.Pool,
  input: Omit<Parameters<typeof terminalTransition>[1], 'nextState'>,
  qualificationProvider: InterventionProfessionalQualificationProvider =
    unavailableProductionInterventionProfessionalQualificationProvider
) {
  return terminalTransition(pool, { ...input, nextState: 'RETIRED' }, qualificationProvider);
}

export function supersedeInterventionDefinition(
  pool: pg.Pool,
  input: Omit<Parameters<typeof terminalTransition>[1], 'nextState'>,
  qualificationProvider: InterventionProfessionalQualificationProvider =
    unavailableProductionInterventionProfessionalQualificationProvider
) {
  return terminalTransition(pool, { ...input, nextState: 'SUPERSEDED' }, qualificationProvider);
}

export function requestInterventionProfessionalReview(): never {
  throw Object.assign(new Error('INTERVENTION_DEPENDENCY_UNAVAILABLE'), {
    code: 'INTERVENTION_DEPENDENCY_UNAVAILABLE',
  });
}
