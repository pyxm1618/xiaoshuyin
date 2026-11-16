import type pg from 'pg';
import {
  getCurrentInterventionDefinitionChainHead,
  getCurrentProfessionalReviewStaffAssignment,
  getExactInterventionDefinition,
  hashPayload,
  insertInterventionDefinitionAudit,
  insertInterventionDefinitionCandidate,
  lockInterventionDefinitionChain,
  prepareInterventionDefinition,
  transitionInterventionDefinitionStateCas,
  type InterventionDefinitionRecord,
} from '@xiaoshuyin/domain';
import { withIdentityTransaction } from '../db/tx.js';
import {
  lockIdempotentCommandInTransaction,
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

async function assertMutationAuthority(
  tx: pg.PoolClient,
  actor: InterventionDefinitionMutationActor,
  qualificationProvider: InterventionProfessionalQualificationProvider,
  approvalScope: string
): Promise<{ assignmentRef: string; qualificationRef: string }> {
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

function outcomeBody(outcome: Awaited<ReturnType<typeof runLockedIdempotentCommandInTransaction>>):
  InterventionDefinitionRecord {
  if (outcome.action === 'MISMATCH') {
    throw Object.assign(new Error('IDEMPOTENCY_PAYLOAD_MISMATCH'), {
      code: 'IDEMPOTENCY_PAYLOAD_MISMATCH',
      statusCode: 409,
    });
  }
  return outcome.body as InterventionDefinitionRecord;
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
      const authority = await assertMutationAuthority(
        tx, input.actor, qualificationProvider, input.approvalScope
      );
      const prepared = prepareInterventionDefinition({
        sceneId: input.sceneId,
        interventionCode: input.interventionCode,
        version: 1,
        semantic: input.semantic,
      });
      const requestHash = hashPayload({
        sceneId: prepared.sceneId,
        interventionCode: prepared.interventionCode,
        contentHash: prepared.contentHash,
        approvalScope: input.approvalScope,
        qualificationRef: authority.qualificationRef,
        staffAssignmentRef: authority.assignmentRef,
      });
      const cfg = {
        accountId: input.actor.accountId,
        personId: input.actor.personId,
        purpose: 'SELF_IDENTITY',
        commandType: 'INTERVENTION_DEFINITION_CREATE' as const,
        idempotencyKey: input.idempotencyKey,
        requestHash,
      };
      await lockIdempotentCommandInTransaction(tx, cfg);
      const outcome = await runLockedIdempotentCommandInTransaction(tx, cfg, async () => {
        const finalAuthority = await assertMutationAuthority(tx, input.actor, qualificationProvider, input.approvalScope);
        if (
          finalAuthority.assignmentRef !== authority.assignmentRef ||
          finalAuthority.qualificationRef !== authority.qualificationRef
        ) throw Object.assign(new Error('INTERVENTION_DEPENDENCY_UNAVAILABLE'), { code: 'INTERVENTION_DEPENDENCY_UNAVAILABLE' });
        await lockInterventionDefinitionChain(tx, prepared.sceneId, prepared.interventionCode);
        const current = await getCurrentInterventionDefinitionChainHead(tx, prepared, true);
        if (current !== null) {
          throw Object.assign(new Error('INTERVENTION_DEFINITION_CONFLICT'), {
            code: 'INTERVENTION_DEFINITION_CONFLICT',
          });
        }
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
      const authority = await assertMutationAuthority(
        tx, input.actor, qualificationProvider, input.approvalScope
      );
      const predecessor = await getExactInterventionDefinition(tx, input.predecessor, false);
      if (predecessor === null) throw Object.assign(new Error('INTERVENTION_DEFINITION_NOT_FOUND'), { code: 'INTERVENTION_DEFINITION_NOT_FOUND' });
      const prepared = prepareInterventionDefinition({
        sceneId: predecessor.sceneId,
        interventionCode: predecessor.interventionCode,
        version: predecessor.version + 1,
        semantic: input.semantic,
      });
      const requestHash = hashPayload({
        predecessor: input.predecessor,
        contentHash: prepared.contentHash,
        approvalScope: input.approvalScope,
        qualificationRef: authority.qualificationRef,
        staffAssignmentRef: authority.assignmentRef,
      });
      const cfg = {
        accountId: input.actor.accountId,
        personId: input.actor.personId,
        purpose: 'SELF_IDENTITY',
        commandType: 'INTERVENTION_DEFINITION_SUCCESSOR_CREATE' as const,
        idempotencyKey: input.idempotencyKey,
        requestHash,
      };
      await lockIdempotentCommandInTransaction(tx, cfg);
      const outcome = await runLockedIdempotentCommandInTransaction(tx, cfg, async () => {
        const finalAuthority = await assertMutationAuthority(tx, input.actor, qualificationProvider, input.approvalScope);
        if (
          finalAuthority.assignmentRef !== authority.assignmentRef ||
          finalAuthority.qualificationRef !== authority.qualificationRef
        ) throw Object.assign(new Error('INTERVENTION_DEPENDENCY_UNAVAILABLE'), { code: 'INTERVENTION_DEPENDENCY_UNAVAILABLE' });
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
      const authority = await assertMutationAuthority(
        tx, input.actor, qualificationProvider, input.approvalScope
      );
      const requestHash = hashPayload({
        definition: input.definition,
        nextState: input.nextState,
        approvalScope: input.approvalScope,
        qualificationRef: authority.qualificationRef,
        staffAssignmentRef: authority.assignmentRef,
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
      await lockIdempotentCommandInTransaction(tx, cfg);
      const outcome = await runLockedIdempotentCommandInTransaction(tx, cfg, async () => {
        const finalAuthority = await assertMutationAuthority(tx, input.actor, qualificationProvider, input.approvalScope);
        if (
          finalAuthority.assignmentRef !== authority.assignmentRef ||
          finalAuthority.qualificationRef !== authority.qualificationRef
        ) throw Object.assign(new Error('INTERVENTION_DEPENDENCY_UNAVAILABLE'), { code: 'INTERVENTION_DEPENDENCY_UNAVAILABLE' });
        const current = await getExactInterventionDefinition(tx, input.definition, true);
        if (
          current === null ||
          current.revision !== input.definition.expectedRevision ||
          (current.state !== 'CANDIDATE' && current.state !== 'CURRENT')
        ) throw Object.assign(new Error('INTERVENTION_DEFINITION_STALE_REVISION'), { code: 'INTERVENTION_DEFINITION_STALE_REVISION' });
        await lockInterventionDefinitionChain(tx, current.sceneId, current.interventionCode);
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
