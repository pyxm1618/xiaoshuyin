/**
 * Confirmer runtime: pending list + second-party decision.
 *
 * The confirmer is authenticated independently (Bearer) and sees only the
 * minimal attempt fields needed to confirm. Authority follows the frozen age
 * matrix through the single `authorize()` entry; candidate-facing reasons are
 * never returned here.
 */

import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import {
  authorize,
  type Decision,
} from '@xiaoshuyin/authorization';
import {
  computeOperationScope,
  decideBindingOperation,
  hashPayload,
  type BindingConfirmerAuthority,
  type BindingOperationScope,
  type BindingTerminalReason,
} from '@xiaoshuyin/domain';
import {
  setBindingAttemptContext,
  setBindingGateContext,
  withBindingTargetTransaction,
} from '../db/tx.js';
import { bindingError, RetryableOperationError } from './errors.js';
import { readConfirmerFacts } from './gate.js';
import {
  findByIdForUpdate,
  listPendingByPerson,
  materializeExpired,
  materializeExpiredForPerson,
  settleTerminal,
} from './attempt-repository.js';
import { appendSecondParty, hasKind } from './confirmation-repository.js';
import {
  clearOpenid,
  findByAttemptIdForUpdate,
} from './pending-context-repository.js';
import { appendAudit } from './audit-repository.js';
import {
  find as findOperationKey,
  insert as insertOperationKey,
  lockScope,
  setScope,
} from './operation-key-repository.js';
import { commitAttempt, type CommitDeps } from './commit.js';

export interface ConfirmerDeps extends CommitDeps {
  pool: pg.Pool;
}

export interface PendingListItem {
  attemptId: string;
  createdAt: string;
  expiresAt: string;
}

function requireConfirmerDecision(
  decision: Decision,
  expectedAuthority: boolean
): Extract<Decision, { decision: 'ALLOW' }> | null {
  if (decision.decision !== 'ALLOW') return null;
  if (expectedAuthority && !decision.basis.authority) return null;
  return decision;
}

export async function listPendingBindings(
  deps: ConfirmerDeps,
  input: { accountId: string; personId: string; targetPersonId: string }
): Promise<PendingListItem[]> {
  return withBindingTargetTransaction(
    deps.pool,
    { targetPersonId: input.targetPersonId, actorAccountId: input.accountId },
    async (tx) => {
      const facts = await readConfirmerFacts(tx, input.targetPersonId, input.accountId);
      if (!facts) throw bindingError('BINDING_NOT_FOUND');
      await setBindingGateContext(tx, {
        targetPersonId: input.targetPersonId,
        targetFamilyId: facts.targetFamilyId,
        actorAccountId: input.accountId,
      });

      const decision = authorize({
        actor: {
          kind: 'ACCOUNT',
          accountId: input.accountId,
          personId: input.personId,
        },
        product: 'V1',
        family: null,
        case: null,
        resource: {
          type: 'BINDING',
          attemptId: null,
          personId: input.targetPersonId,
        },
        action: 'IDENTITY_BINDING_CONFIRMER_LIST',
        purpose: 'IDENTITY_BINDING',
        facts,
      });
      if (!requireConfirmerDecision(decision, false)) {
        throw bindingError('BINDING_NOT_FOUND');
      }

      // Expired attempts are conditionally materialized first, then the list only
// returns still-valid PENDING attempts (`expires_at > now()` in SQL).
      const expiredRows = await materializeExpiredForPerson(tx, input.targetPersonId);
      for (const expired of expiredRows) {
        // The audit insert policy requires the candidate identity digest GUC;
        // the target-only Gate context does not carry it, so bind the exact
        // attempt scope before writing the TERMINAL audit.
        await setBindingAttemptContext(tx, {
          attemptId: expired.id,
          identityDigest: expired.candidateIdentityDigest,
          invitationId: expired.invitationParticipationId,
          targetPersonId: expired.targetPersonId,
          targetFamilyId: expired.targetFamilyId,
          purpose: 'IDENTITY_BINDING_GATE',
        });
        await appendAudit(tx, {
          correlationId: randomUUID(),
          attemptId: expired.id,
          targetPersonId: expired.targetPersonId,
          targetFamilyId: expired.targetFamilyId,
          invitationParticipationId: expired.invitationParticipationId,
          actorAccountId: input.accountId,
          actorPersonId: input.personId,
          candidateIdentityDigest: expired.candidateIdentityDigest,
          eventType: 'BINDING_TERMINAL',
          result: 'TERMINAL',
          terminalReason: 'ATTEMPT_EXPIRED',
        });
      }

      const attempts = await listPendingByPerson(tx, input.targetPersonId);
      return attempts.map((attempt) => ({
        attemptId: attempt.id,
        createdAt: attempt.createdAt.toISOString(),
        expiresAt: attempt.expiresAt.toISOString(),
      }));
    }
  );
}

export interface ConfirmerDecisionInput {
  accountId: string;
  personId: string;
  attemptId: string;
  targetPersonId: string;
  decision: 'AFFIRM' | 'REJECT';
  targetConfirmed: boolean;
  candidateRecognized: boolean;
  confirmationVersion: string;
  idempotencyKey: string;
}

export interface ConfirmerDecisionResult {
  state: 'PENDING' | 'COMMITTED' | 'TERMINAL';
}

interface DecisionTxResult {
  state: 'PENDING' | 'COMMITTED' | 'TERMINAL';
  attemptId: string;
  targetPersonId: string;
  targetFamilyId: string;
  shouldCommit: boolean;
}

export async function submitConfirmerDecision(
  deps: ConfirmerDeps,
  input: ConfirmerDecisionInput
): Promise<ConfirmerDecisionResult> {
  const requestHash = hashPayload({
    personId: input.targetPersonId,
    decision: input.decision,
    targetConfirmed: input.targetConfirmed,
    candidateRecognized: input.candidateRecognized,
    confirmationVersion: input.confirmationVersion,
  });

  const txResult = await withBindingTargetTransaction(
    deps.pool,
    { targetPersonId: input.targetPersonId, actorAccountId: input.accountId },
    async (tx): Promise<DecisionTxResult> => {
      const facts = await readConfirmerFacts(tx, input.targetPersonId, input.accountId);
      if (!facts) throw bindingError('BINDING_NOT_FOUND');
      await setBindingGateContext(tx, {
        targetPersonId: input.targetPersonId,
        targetFamilyId: facts.targetFamilyId,
        actorAccountId: input.accountId,
      });

      // Authorization boundary BEFORE any protected attempt state is read,
      // expiry materialized, or an idempotency fact written (H2). Only
      // server-side target facts are used; no candidate-sensitive data.
      const decision = authorize({
        actor: {
          kind: 'ACCOUNT',
          accountId: input.accountId,
          personId: input.personId,
        },
        product: 'V1',
        family: null,
        case: null,
        resource: {
          type: 'BINDING',
          attemptId: input.attemptId,
          personId: input.targetPersonId,
        },
        action: 'IDENTITY_BINDING_SECOND_PARTY_DECIDE',
        purpose: 'IDENTITY_BINDING',
        facts,
      });
      const allowed = requireConfirmerDecision(decision, true);
      if (!allowed) throw bindingError('BINDING_NOT_FOUND');
      const authority = allowed.basis.authority as BindingConfirmerAuthority;

      const attempt = await findByIdForUpdate(tx, input.attemptId);
      if (!attempt || attempt.targetPersonId !== input.targetPersonId) {
        throw bindingError('BINDING_NOT_FOUND');
      }

      // Attempt-scoped visibility for confirmations / pending context. The
      // target policy already exposed the attempt; this narrows it to one id.
      await setBindingAttemptContext(tx, {
        attemptId: attempt.id,
        identityDigest: attempt.candidateIdentityDigest,
        invitationId: attempt.invitationParticipationId,
        targetPersonId: attempt.targetPersonId,
        targetFamilyId: attempt.targetFamilyId,
        purpose: 'IDENTITY_BINDING_GATE',
      });

      const scope: BindingOperationScope = computeOperationScope({
        commandType: 'SECOND_PARTY_DECISION',
        accountId: input.accountId,
      });
      await setScope(tx, scope.scopeKey);
      await lockScope(tx, {
        scopeKind: scope.scopeKind,
        scopeKey: scope.scopeKey,
        commandType: 'SECOND_PARTY_DECISION',
        idempotencyKey: input.idempotencyKey,
      });
      const existing = await findOperationKey(tx, {
        scopeKind: scope.scopeKind,
        scopeKey: scope.scopeKey,
        commandType: 'SECOND_PARTY_DECISION',
        idempotencyKey: input.idempotencyKey,
      });
      const op = decideBindingOperation(
        existing ? { requestHash: existing.requestHash } : null,
        requestHash
      );
      if (op.action === 'MISMATCH') throw bindingError('IDEMPOTENCY_PAYLOAD_MISMATCH');
      const replayed = op.action === 'REPLAY';

      const correlationId = randomUUID();

      if (attempt.state !== 'PENDING') {
        if (!replayed) await recordOperation(tx, scope, input, requestHash, attempt.id);
        return {
          state: attempt.state,
          attemptId: attempt.id,
          targetPersonId: attempt.targetPersonId,
          targetFamilyId: attempt.targetFamilyId,
          shouldCommit: false,
        };
      }

      const expired = await materializeExpired(tx, attempt.id);
      if (expired) {
        await appendAudit(tx, {
          correlationId,
          attemptId: expired.id,
          targetPersonId: expired.targetPersonId,
          targetFamilyId: expired.targetFamilyId,
          invitationParticipationId: expired.invitationParticipationId,
          actorAccountId: input.accountId,
          actorPersonId: input.personId,
          candidateIdentityDigest: expired.candidateIdentityDigest,
          eventType: 'BINDING_TERMINAL',
          result: 'TERMINAL',
          terminalReason: 'ATTEMPT_EXPIRED',
        });
        if (!replayed) await recordOperation(tx, scope, input, requestHash, expired.id);
        return {
          state: 'TERMINAL',
          attemptId: expired.id,
          targetPersonId: expired.targetPersonId,
          targetFamilyId: expired.targetFamilyId,
          shouldCommit: false,
        };
      }


      if (input.decision === 'AFFIRM') {
        if (
          input.targetConfirmed !== true ||
          input.candidateRecognized !== true ||
          input.confirmationVersion !== 'second-party-recognition-v1'
        ) {
          throw bindingError('VALIDATION_ERROR');
        }
        const confirmation = await appendSecondParty(tx, {
          attemptId: attempt.id,
          actorAccountId: input.accountId,
          actorPersonId: input.personId,
          authority,
        });
        if (confirmation) {
          await appendAudit(tx, {
            correlationId,
            attemptId: attempt.id,
            targetPersonId: attempt.targetPersonId,
            targetFamilyId: attempt.targetFamilyId,
            invitationParticipationId: attempt.invitationParticipationId,
            actorAccountId: input.accountId,
            actorPersonId: input.personId,
            candidateIdentityDigest: attempt.candidateIdentityDigest,
            eventType: 'BINDING_SECOND_PARTY_CONFIRMED',
            result: 'PENDING',
          });
        }
        if (!replayed) await recordOperation(tx, scope, input, requestHash, attempt.id);
        return {
          state: 'PENDING',
          attemptId: attempt.id,
          targetPersonId: attempt.targetPersonId,
          targetFamilyId: attempt.targetFamilyId,
          shouldCommit: true,
        };
      }

      // REJECT: an affirmative second-party confirmation is never revoked.
      if (await hasKind(tx, attempt.id, 'SECOND_PARTY')) {
        throw bindingError('BINDING_STATE_CONFLICT');
      }
      const reason: BindingTerminalReason = input.candidateRecognized
        ? 'CONFIRMER_REJECTED'
        : 'RECOGNITION_REJECTED';
      const settled = await settleTerminal(tx, attempt.id, reason);
      if (settled) {
        await appendAudit(tx, {
          correlationId,
          attemptId: settled.id,
          targetPersonId: settled.targetPersonId,
          targetFamilyId: settled.targetFamilyId,
          invitationParticipationId: settled.invitationParticipationId,
          actorAccountId: input.accountId,
          actorPersonId: input.personId,
          candidateIdentityDigest: settled.candidateIdentityDigest,
          eventType: 'BINDING_SECOND_PARTY_REJECTED',
          result: 'TERMINAL',
          terminalReason: reason,
        });
        const context = await findByAttemptIdForUpdate(tx, attempt.id);
        if (context) await clearOpenid(tx, context.id);
      }
      if (!replayed) await recordOperation(tx, scope, input, requestHash, attempt.id);
      return {
        state: 'TERMINAL',
        attemptId: attempt.id,
        targetPersonId: attempt.targetPersonId,
        targetFamilyId: attempt.targetFamilyId,
        shouldCommit: false,
      };
    }
  );

  if (txResult.shouldCommit) {
    const commit = await commitAttempt(deps, {
      attemptId: txResult.attemptId,
      targetPersonId: txResult.targetPersonId,
      targetFamilyId: txResult.targetFamilyId,
      actorAccountId: input.accountId,
    });
    if (commit.outcome === 'COMMITTED') return { state: 'COMMITTED' };
    if (commit.outcome === 'TERMINAL') return { state: 'TERMINAL' };
    if (commit.outcome === 'PENDING') return { state: 'PENDING' };
    throw new RetryableOperationError();
  }

  return { state: txResult.state };
}

async function recordOperation(
  tx: pg.PoolClient,
  scope: BindingOperationScope,
  input: ConfirmerDecisionInput,
  requestHash: string,
  attemptId: string
): Promise<void> {
  await insertOperationKey(tx, {
    scopeKind: scope.scopeKind,
    scopeKey: scope.scopeKey,
    commandType: 'SECOND_PARTY_DECISION',
    idempotencyKey: input.idempotencyKey,
    requestHash,
    attemptId,
  });
}