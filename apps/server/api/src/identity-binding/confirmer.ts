/**
 * Confirmer runtime: pending list + pairing decision.
 *
 * The confirmer is authenticated independently (Bearer). The only selector for
 * a second-party decision is the candidate-presented `pairingChallenge`; the
 * client never submits an attemptId. Pending-list rows are an operational view,
 * never an identity proof or pairing selector.
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
  findById,
  findByIdForUpdate,
  listPendingByPerson,
} from './attempt-repository.js';
import { appendSecondParty, hasKind, listByAttempt } from './confirmation-repository.js';
import {
  clearPairingIssuance,
  findByIdForUpdate as findContextByIdForUpdate,
} from './pending-context-repository.js';
import { appendAudit } from './audit-repository.js';
import {
  find as findOperationKey,
  insert as insertOperationKey,
  lockScope,
  setScope,
} from './operation-key-repository.js';
import { commitAttempt, type CommitDeps } from './commit.js';
import { decodePairingChallenge, type PairingChallengeFacts } from './crypto.js';
import { settleExpiredForPerson, settleTerminalAttempt } from './settlement.js';
import type { InvitationResolutionPort } from './invitation-port.js';

export interface ConfirmerDeps extends CommitDeps {
  pool: pg.Pool;
  identityBindingSecret: string;
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

      // The pending list is an operational view only. Expiry materialization
      // goes through the single settlement primitive: state + exactly-one
      // terminal audit + all-context secret scrub.
      await settleExpiredForPerson(tx, {
        targetPersonId: input.targetPersonId,
        correlationId: randomUUID(),
        actorAccountId: input.accountId,
        actorPersonId: input.personId,
      });

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
  targetPersonId: string;
  pairingChallenge: string;
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
  // The exact received ASCII challenge bytes are part of the canonical request
  // identity. No decode → re-encode alias is allowed; rotation changes bytes
  // and therefore the digest.
  const requestHash = hashPayload({
    personId: input.targetPersonId,
    pairingChallenge: input.pairingChallenge,
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

      // Independent confirmer authorization BEFORE any protected attempt read
      // or mutation. The attempt id passed to authorize() is resolved
      // server-side: either from the verified challenge or from the existing
      // operation-key binding on replay. The client never supplies it.
      const authorizeDecision = (attemptId: string): BindingConfirmerAuthority => {
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
            attemptId,
            personId: input.targetPersonId,
          },
          action: 'IDENTITY_BINDING_SECOND_PARTY_DECIDE',
          purpose: 'IDENTITY_BINDING',
          facts,
        });
        const allowed = requireConfirmerDecision(decision, true);
        if (!allowed) throw bindingError('BINDING_NOT_FOUND');
        return allowed.basis.authority as BindingConfirmerAuthority;
      };

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

      if (op.action === 'REPLAY') {
        if (!existing?.attemptId) throw bindingError('BINDING_NOT_FOUND');
        authorizeDecision(existing.attemptId);
        return replaySecondPartyOperation(tx, existing.attemptId, input);
      }

      const challenge = decodePairingChallenge(
        deps.identityBindingSecret,
        input.pairingChallenge
      );
      if (!challenge || challenge.targetPersonId !== input.targetPersonId) {
        throw bindingError('BINDING_NOT_FOUND');
      }

      const authority = authorizeDecision(challenge.attemptId);
      if (input.decision === 'REJECT') {
        await assertRejectNotAfterAffirmative(tx, challenge, input.targetPersonId);
      }
      const attempt = await verifyChallengeBinding(tx, deps, challenge, input, facts.targetFamilyId);

      if (input.decision === 'AFFIRM') {
        if (
          input.targetConfirmed !== true ||
          input.candidateRecognized !== true ||
          input.confirmationVersion !== 'second-party-recognition-v1'
        ) {
          throw bindingError('VALIDATION_ERROR');
        }
        // Second-party confirmation is single-use and unique per attempt.
        if (await hasKind(tx, attempt.id, 'SECOND_PARTY')) {
          throw bindingError('BINDING_NOT_FOUND');
        }
        const registration = await appendSecondParty(tx, {
          attemptId: attempt.id,
          actorAccountId: input.accountId,
          actorPersonId: input.personId,
          authority,
        });
        if (!registration) throw bindingError('BINDING_NOT_FOUND');

        await appendAudit(tx, {
          correlationId: randomUUID(),
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

        // Consume the issuance. The operation key replay reads the attempt
        // outcome, never this challenge again.
        await clearPairingIssuance(tx, challenge.contextId);

        const recorded = await insertOperationKey(tx, {
          scopeKind: scope.scopeKind,
          scopeKey: scope.scopeKey,
          commandType: 'SECOND_PARTY_DECISION',
          idempotencyKey: input.idempotencyKey,
          requestHash,
          attemptId: attempt.id,
        });
        if (!recorded) {
          const converged = await findOperationKey(tx, {
            scopeKind: scope.scopeKind,
            scopeKey: scope.scopeKey,
            commandType: 'SECOND_PARTY_DECISION',
            idempotencyKey: input.idempotencyKey,
          });
          if (!converged || converged.requestHash !== requestHash) {
            throw bindingError('IDEMPOTENCY_PAYLOAD_MISMATCH');
          }
          if (converged.attemptId !== attempt.id) {
            throw bindingError('IDEMPOTENCY_PAYLOAD_MISMATCH');
          }
        }

        return {
          state: 'PENDING',
          attemptId: attempt.id,
          targetPersonId: attempt.targetPersonId,
          targetFamilyId: attempt.targetFamilyId,
          shouldCommit: true,
        };
      }

      // REJECT is a strict false/false proposition (enforced by schema).
      if (
        input.targetConfirmed !== false ||
        input.candidateRecognized !== false ||
        input.confirmationVersion !== 'second-party-recognition-v1'
      ) {
        throw bindingError('VALIDATION_ERROR');
      }
      // An affirmative second-party decision is a historical fact and cannot
      // be revoked by a later REJECT.
      if (await hasKind(tx, attempt.id, 'SECOND_PARTY')) {
        throw bindingError('BINDING_STATE_CONFLICT');
      }

      const reason: BindingTerminalReason = 'RECOGNITION_REJECTED';
      await settleTerminalAttempt(tx, {
        attemptId: attempt.id,
        reason,
        correlationId: randomUUID(),
        actorAccountId: input.accountId,
        actorPersonId: input.personId,
      });

      const recorded = await insertOperationKey(tx, {
        scopeKind: scope.scopeKind,
        scopeKey: scope.scopeKey,
        commandType: 'SECOND_PARTY_DECISION',
        idempotencyKey: input.idempotencyKey,
        requestHash,
        attemptId: attempt.id,
      });
      if (!recorded) {
        throw bindingError('IDEMPOTENCY_PAYLOAD_MISMATCH');
      }

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

/**
 * Same-key replay reads ONLY the authoritative operation.attempt_id. It never
 * validates or resolves a current challenge, so a rotated / consumed challenge
 * cannot redirect an old operation to another attempt.
 */
async function replaySecondPartyOperation(
  tx: pg.PoolClient,
  attemptId: string | null,
  input: ConfirmerDecisionInput
): Promise<DecisionTxResult> {
  if (!attemptId) throw bindingError('BINDING_NOT_FOUND');
  const attempt = await findById(tx, attemptId);
  if (!attempt || attempt.targetPersonId !== input.targetPersonId) {
    throw bindingError('BINDING_NOT_FOUND');
  }
  return {
    state: attempt.state,
    attemptId: attempt.id,
    targetPersonId: attempt.targetPersonId,
    targetFamilyId: attempt.targetFamilyId,
    // An AFFIRM retry after an infrastructure failure re-runs Phase C; the
    // commit path is conditional and cannot double confirmation or binding.
    shouldCommit: input.decision === 'AFFIRM' && attempt.state === 'PENDING',
  };
}

/**
 * D-9.4: an existing SECOND_PARTY affirmative confirmation is a historical fact
 * and cannot be revoked. This check runs before the PENDING-only challenge
 * verification so a correctly-bound REJECT after an affirmative (including an
 * already COMMITTED attempt) returns 409 rather than a generic 404.
 */
async function assertRejectNotAfterAffirmative(
  tx: pg.PoolClient,
  challenge: PairingChallengeFacts,
  targetPersonId: string
): Promise<void> {
  await setBindingAttemptContext(tx, {
    attemptId: challenge.attemptId,
    identityDigest: challenge.candidateIdentityDigest,
    invitationId: challenge.invitationParticipationId,
    targetPersonId: challenge.targetPersonId,
    purpose: 'IDENTITY_BINDING_GATE',
  });
  const attempt = await findById(tx, challenge.attemptId);
  if (!attempt || attempt.targetPersonId !== targetPersonId) {
    throw bindingError('BINDING_NOT_FOUND');
  }
  if (
    attempt.invitationParticipationId !== challenge.invitationParticipationId ||
    attempt.candidateIdentityDigest !== challenge.candidateIdentityDigest
  ) {
    throw bindingError('BINDING_NOT_FOUND');
  }
  if (await hasKind(tx, attempt.id, 'SECOND_PARTY')) {
    throw bindingError('BINDING_STATE_CONFLICT');
  }
}

async function verifyChallengeBinding(
  tx: pg.PoolClient,
  deps: ConfirmerDeps,
  challenge: PairingChallengeFacts,
  input: ConfirmerDecisionInput,
  targetFamilyId: string
): Promise<{
  id: string;
  state: 'PENDING' | 'COMMITTED' | 'TERMINAL';
  targetPersonId: string;
  targetFamilyId: string;
  invitationParticipationId: string;
  candidateIdentityDigest: string;
  expiresAt: Date;
}> {
  await setBindingAttemptContext(tx, {
    attemptId: challenge.attemptId,
    identityDigest: challenge.candidateIdentityDigest,
    invitationId: challenge.invitationParticipationId,
    targetPersonId: challenge.targetPersonId,
    targetFamilyId,
    purpose: 'IDENTITY_BINDING_GATE',
  });

  const attempt = await findByIdForUpdate(tx, challenge.attemptId);
  if (!attempt) throw bindingError('BINDING_NOT_FOUND');
  if (
    attempt.targetPersonId !== challenge.targetPersonId ||
    attempt.targetFamilyId !== targetFamilyId ||
    attempt.invitationParticipationId !== challenge.invitationParticipationId ||
    attempt.candidateIdentityDigest !== challenge.candidateIdentityDigest
  ) {
    throw bindingError('BINDING_NOT_FOUND');
  }
  if (attempt.state !== 'PENDING') throw bindingError('BINDING_NOT_FOUND');
  if (attempt.expiresAt.getTime() <= Date.now()) throw bindingError('BINDING_NOT_FOUND');

  const context = await findContextByIdForUpdate(tx, challenge.contextId);
  if (!context) throw bindingError('BINDING_NOT_FOUND');
  if (
    context.attemptId !== attempt.id ||
    context.candidateIdentityDigest !== attempt.candidateIdentityDigest ||
    context.invitationParticipationId !== attempt.invitationParticipationId ||
    context.pairingIssuanceId !== challenge.pairingIssuanceId ||
    !context.pairingIssuedAt ||
    !context.pairingExpiresAt ||
    context.pairingIssuedAt.getTime() !== challenge.pairingIssuedAt.getTime() ||
    context.pairingExpiresAt.getTime() !== challenge.pairingExpiresAt.getTime()
  ) {
    throw bindingError('BINDING_NOT_FOUND');
  }
  if (context.expiresAt.getTime() <= Date.now()) throw bindingError('BINDING_NOT_FOUND');

  // Invitation current state is a Gate 2 fact, not a pairing-selector fact.
  // The challenge is exact-bound to the attempt's invitation id above; if that
  // invitation has since become terminal, the commit path must settle TERMINAL
  // through Gate 2 rather than treating the correctly-bound challenge as 404.
  const confirmations = await listByAttempt(tx, attempt.id);
  if (!confirmations.some((c) => c.kind === 'CANDIDATE')) {
    throw bindingError('BINDING_NOT_FOUND');
  }

  return {
    id: attempt.id,
    state: attempt.state,
    targetPersonId: attempt.targetPersonId,
    targetFamilyId: attempt.targetFamilyId,
    invitationParticipationId: attempt.invitationParticipationId,
    candidateIdentityDigest: attempt.candidateIdentityDigest,
    expiresAt: attempt.expiresAt,
  };
}