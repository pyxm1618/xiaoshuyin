/**
 * Candidate decision: AFFIRM / REJECT / CANCEL on the attempt associated with
 * the pending context. Every outcome is candidate-facing generic.
 */

import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import { authorize } from '@xiaoshuyin/authorization';
import {
  computeOperationScope,
  decideBindingOperation,
  hashPayload,
  type BindingOperationScope,
} from '@xiaoshuyin/domain';
import {
  setBindingAttemptContext,
  withBindingContextTransaction,
} from '../db/tx.js';
import { hashToken } from './crypto.js';
import { requireContext } from './context.js';
import {
  findByIdForUpdate,
  materializeExpired,
  settleTerminal,
} from './attempt-repository.js';
import { appendCandidate } from './confirmation-repository.js';
import { clearOpenid } from './pending-context-repository.js';
import { appendAudit } from './audit-repository.js';
import {
  find as findOperationKey,
  insert as insertOperationKey,
  lockScope,
  setScope,
} from './operation-key-repository.js';
import { bindingError } from './errors.js';

export interface CandidateDecisionDeps {
  pool: pg.Pool;
}

export interface CandidateDecisionInput {
  contextToken: string;
  decision: 'AFFIRM' | 'REJECT' | 'CANCEL';
  confirmationVersion?: string | undefined;
  idempotencyKey: string;
}

export interface CandidateDecisionResult {
  binding: 'NOT_COMPLETED';
}

export async function submitCandidateDecision(
  deps: CandidateDecisionDeps,
  input: CandidateDecisionInput
): Promise<CandidateDecisionResult> {
  const requestHash = hashPayload({
    decision: input.decision,
    confirmationVersion: input.confirmationVersion ?? null,
  });

  return withBindingContextTransaction(
    deps.pool,
    { tokenHash: hashToken(input.contextToken) },
    async (tx) => {
      const context = await requireContext(tx, input.contextToken);

      // Single authorization entry; DENY is candidate-facing generic and
      // happens before any operation-key / confirmation / audit write.
      const authDecision = authorize({
        actor: {
          kind: 'BINDING_CONTEXT',
          contextId: context.id,
          candidateIdentityDigest: context.candidateIdentityDigest,
        },
        product: 'V1',
        family: null,
        case: null,
        resource: { type: 'BINDING', attemptId: context.attemptId, personId: null },
        action: 'IDENTITY_BINDING_CANDIDATE_DECIDE',
        purpose: 'IDENTITY_BINDING',
      });
      if (authDecision.decision !== 'ALLOW') return { binding: 'NOT_COMPLETED' };

      const scope: BindingOperationScope = computeOperationScope({
        commandType: 'CANDIDATE_DECISION',
        contextId: context.id,
      });
      await setScope(tx, scope.scopeKey);
      await lockScope(tx, {
        scopeKind: scope.scopeKind,
        scopeKey: scope.scopeKey,
        commandType: 'CANDIDATE_DECISION',
        idempotencyKey: input.idempotencyKey,
      });

      const existing = await findOperationKey(tx, {
        scopeKind: scope.scopeKind,
        scopeKey: scope.scopeKey,
        commandType: 'CANDIDATE_DECISION',
        idempotencyKey: input.idempotencyKey,
      });
      const op = decideBindingOperation(
        existing ? { requestHash: existing.requestHash } : null,
        requestHash
      );
      if (op.action === 'MISMATCH') throw bindingError('IDEMPOTENCY_PAYLOAD_MISMATCH');
      if (op.action === 'REPLAY') return { binding: 'NOT_COMPLETED' };

      if (!context.attemptId) {
        await insertOperationKey(tx, {
          scopeKind: scope.scopeKind,
          scopeKey: scope.scopeKey,
          commandType: 'CANDIDATE_DECISION',
          idempotencyKey: input.idempotencyKey,
          requestHash,
          attemptId: null,
        });
        return { binding: 'NOT_COMPLETED' };
      }

      // Attempt visibility comes from the identity/invitation GUCs, so the
// attempt context MUST be established before the row is read.
      if (!context.invitationParticipationId) {
        await insertOperationKey(tx, {
          scopeKind: scope.scopeKind,
          scopeKey: scope.scopeKey,
          commandType: 'CANDIDATE_DECISION',
          idempotencyKey: input.idempotencyKey,
          requestHash,
          attemptId: null,
        });
        return { binding: 'NOT_COMPLETED' };
      }

      await setBindingAttemptContext(tx, {
        attemptId: context.attemptId,
        identityDigest: context.candidateIdentityDigest,
        invitationId: context.invitationParticipationId,
      });

      const attempt = await findByIdForUpdate(tx, context.attemptId);
      if (!attempt) {
        await insertOperationKey(tx, {
          scopeKind: scope.scopeKind,
          scopeKey: scope.scopeKey,
          commandType: 'CANDIDATE_DECISION',
          idempotencyKey: input.idempotencyKey,
          requestHash,
          attemptId: null,
        });
        return { binding: 'NOT_COMPLETED' };
      }

      // Narrow to the exact target for audit / confirmation policies.
      await setBindingAttemptContext(tx, {
        attemptId: attempt.id,
        identityDigest: context.candidateIdentityDigest,
        invitationId: attempt.invitationParticipationId,
        targetPersonId: attempt.targetPersonId,
        targetFamilyId: attempt.targetFamilyId,
      });

      // Four-element consistency: the context identity must own this attempt.
      if (attempt.candidateIdentityDigest !== context.candidateIdentityDigest) {
        return { binding: 'NOT_COMPLETED' };
      }

      const correlationId = randomUUID();

      // Expiration is materialized on access; expired attempts never commit.
      const expired = await materializeExpired(tx, attempt.id);
      if (expired) {
        await appendAudit(tx, {
          correlationId,
          attemptId: expired.id,
          targetPersonId: expired.targetPersonId,
          targetFamilyId: expired.targetFamilyId,
          invitationParticipationId: expired.invitationParticipationId,

          candidateIdentityDigest: context.candidateIdentityDigest,
          eventType: 'BINDING_TERMINAL',
          result: 'TERMINAL',
          terminalReason: 'ATTEMPT_EXPIRED',
        });
        await clearOpenid(tx, context.id);
        await recordOperation(tx, scope, input, requestHash, expired.id);
        return { binding: 'NOT_COMPLETED' };
      }

      if (attempt.state !== 'PENDING') {
        await recordOperation(tx, scope, input, requestHash, attempt.id);
        return { binding: 'NOT_COMPLETED' };
      }

      if (input.decision === 'AFFIRM') {
        if (input.confirmationVersion !== 'candidate-binding-v1') {
          throw bindingError('VALIDATION_ERROR');
        }
        const confirmation = await appendCandidate(tx, attempt.id, context.id);
        if (confirmation) {
          await appendAudit(tx, {
            correlationId,
            attemptId: attempt.id,
            targetPersonId: attempt.targetPersonId,
            targetFamilyId: attempt.targetFamilyId,
            invitationParticipationId: attempt.invitationParticipationId,

            candidateIdentityDigest: context.candidateIdentityDigest,
            eventType: 'BINDING_CANDIDATE_CONFIRMED',
            result: 'PENDING',
          });
        }
        await recordOperation(tx, scope, input, requestHash, attempt.id);
        return { binding: 'NOT_COMPLETED' };
      }

      const reason =
        input.decision === 'REJECT' ? 'CANDIDATE_REJECTED' : 'CANDIDATE_CANCELLED';
      const settled = await settleTerminal(tx, attempt.id, reason);
      if (settled) {
        await appendAudit(tx, {
          correlationId,
          attemptId: settled.id,
          targetPersonId: settled.targetPersonId,
          targetFamilyId: settled.targetFamilyId,
          invitationParticipationId: settled.invitationParticipationId,

          candidateIdentityDigest: context.candidateIdentityDigest,
          eventType:
            input.decision === 'REJECT'
              ? 'BINDING_CANDIDATE_REJECTED'
              : 'BINDING_CANDIDATE_CANCELLED',
          result: 'TERMINAL',
          terminalReason: reason,
        });
        await clearOpenid(tx, context.id);
      }
      await recordOperation(tx, scope, input, requestHash, attempt.id);
      return { binding: 'NOT_COMPLETED' };
    }
  );
}


async function recordOperation(
  tx: pg.PoolClient,
  scope: BindingOperationScope,
  input: CandidateDecisionInput,
  requestHash: string,
  attemptId: string | null
): Promise<void> {
  await insertOperationKey(tx, {
    scopeKind: scope.scopeKind,
    scopeKey: scope.scopeKey,
    commandType: 'CANDIDATE_DECISION',
    idempotencyKey: input.idempotencyKey,
    requestHash,
    attemptId,
  });
}