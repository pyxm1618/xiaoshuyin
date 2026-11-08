/**
 * Phase C commit: Gate 2 recheck + Account create/reuse + P1 binding + attempt
 * settlement + audit, all in one transaction (plan D-6 / D-8 / D-14).
 *
 * Business failures settle TERMINAL and commit; infrastructure failures roll
 * back and surface as RETRYABLE (the Phase B confirmation is preserved).
 */

import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import {
  bindPersonAccountIfUnbound,
  getPersonByAccountId,
  lockPersonForBinding,
  type BindingAttemptRow,
  type BindingTerminalReason,
} from '@xiaoshuyin/domain';
import { createOrReuseAccount, findAccountByOpenid } from '../auth/binding-account.js';
import {
  setBindingCandidateAccountId,
  setBindingCommitAccountId,
  withBindingCommitTransaction,
} from '../db/tx.js';
import { decryptOpenid, deriveIdentityDigest } from './crypto.js';
import { evaluateGateForTarget } from './gate.js';
import {
  clearOpenid,
  findByAttemptIdForUpdate,
  markCommittedForAttempt,
  type PendingContextRow,
} from './pending-context-repository.js';
import {
  findByIdForUpdate,
  materializeExpired,
  settleCommitted,
  settleTerminal,
} from './attempt-repository.js';
import { listByAttempt } from './confirmation-repository.js';
import { appendAudit } from './audit-repository.js';
import { RetryableOperationError } from './errors.js';
import type { InvitationResolutionPort } from './invitation-port.js';

export interface CommitDeps {
  pool: pg.Pool;
  invitationPort: InvitationResolutionPort;
  identityBindingSecret: string;
}

export interface CommitInput {
  attemptId: string;
  targetPersonId: string;
  targetFamilyId: string;
  actorAccountId: string;
}

export type CommitOutcome =
  | { outcome: 'COMMITTED'; accountId: string }
  | { outcome: 'PENDING' }
  | { outcome: 'TERMINAL'; reason: BindingTerminalReason }
  | { outcome: 'RETRYABLE' };

function isBindingBusinessError(err: unknown): boolean {
  const statusCode = (err as { statusCode?: unknown })?.statusCode;
  return typeof statusCode === 'number' && statusCode >= 400 && statusCode < 500;
}

export async function commitAttempt(
  deps: CommitDeps,
  input: CommitInput
): Promise<CommitOutcome> {
  try {
    return await withBindingCommitTransaction(
      deps.pool,
      {
        attemptId: input.attemptId,
        targetPersonId: input.targetPersonId,
        targetFamilyId: input.targetFamilyId,
        actorAccountId: input.actorAccountId,
      },
      (tx) => commitInTransaction(deps, tx, input)
    );
  } catch (err) {
    if (isBindingBusinessError(err)) throw err;

    await bestEffortRetryableAudit(deps, input);
    return { outcome: 'RETRYABLE' };
  }
}

async function commitInTransaction(
  deps: CommitDeps,
  tx: pg.PoolClient,
  input: CommitInput
): Promise<CommitOutcome> {
  // Plan D-6.1 lock order: attempt first, then the linked pending context.
  const attempt = await findByIdForUpdate(tx, input.attemptId);
  if (!attempt) throw new RetryableOperationError();

  const context = await findByAttemptIdForUpdate(tx, input.attemptId);
  if (!context) throw new RetryableOperationError();

  const correlationId = randomUUID();

  if (attempt.state === 'COMMITTED') {
    return { outcome: 'COMMITTED', accountId: attempt.committedAccountId! };
  }
  if (attempt.state === 'TERMINAL') {
    return { outcome: 'TERMINAL', reason: attempt.terminalReason! };
  }

  // ── M8: four-element consistency before any Phase C write ──
  // P1 / authenticated identity / invitation / attempt-context association.
  if (
    context.candidateIdentityDigest !== attempt.candidateIdentityDigest ||
    context.invitationParticipationId !== attempt.invitationParticipationId ||
    attempt.targetPersonId !== input.targetPersonId ||
    attempt.targetFamilyId !== input.targetFamilyId
  ) {
    return terminalize(tx, attempt, context, 'IDENTITY_CONFLICT', correlationId);
  }

  const expired = await materializeExpired(tx, attempt.id);
  if (expired) {
    return terminalize(tx, expired, context, 'ATTEMPT_EXPIRED', correlationId);
  }

  const confirmations = await listByAttempt(tx, attempt.id);
  const candidateConfirmation = confirmations.find((c) => c.kind === 'CANDIDATE');
  const secondPartyConfirmation = confirmations.find((c) => c.kind === 'SECOND_PARTY');
  if (!candidateConfirmation || !secondPartyConfirmation) {
    return { outcome: 'PENDING' };
  }

  if (
    context.openidCiphertext === null ||
    context.openidNonce === null ||
    context.openidTag === null
  ) {
    throw new RetryableOperationError();
  }

  let openid: string;
  try {
    openid = decryptOpenid(deps.identityBindingSecret, context.id, {
      ciphertext: context.openidCiphertext,
      nonce: context.openidNonce,
      tag: context.openidTag,
    });
  } catch {
    throw new RetryableOperationError();
  }

  // M8: the decrypted WeChat identity must be the identity the attempt was
  // created for; otherwise this is an identity conflict, never a commit.
  if (
    deriveIdentityDigest(deps.identityBindingSecret, openid) !==
    attempt.candidateIdentityDigest
  ) {
    return terminalize(tx, attempt, context, 'IDENTITY_CONFLICT', correlationId);
  }

  const candidateAccount = await findAccountByOpenid(tx, openid);
  if (candidateAccount) {
    await setBindingCandidateAccountId(tx, candidateAccount.id);
  }
  const candidateBoundPerson = candidateAccount
    ? await getPersonByAccountId(tx, candidateAccount.id)
    : null;

  const invitation = await deps.invitationPort.resolveByParticipationId(
    tx,
    attempt.invitationParticipationId
  );

  const gate = await evaluateGateForTarget(tx, {
    stage: 'GATE_2',
    targetPersonId: attempt.targetPersonId,
    targetFamilyId: attempt.targetFamilyId,
    invitation,
    candidateAccountId: candidateAccount?.id ?? null,
    candidateAccountBoundPersonId: candidateBoundPerson?.id ?? null,
    confirmer: {
      accountId: secondPartyConfirmation.actorAccountId!,
      personId: secondPartyConfirmation.actorPersonId!,
    },
    confirmations: { candidate: true, secondParty: true },
  });

  if (gate.result.decision === 'PENDING') return { outcome: 'PENDING' };
  if (gate.result.decision === 'BLOCK') {
    return terminalize(tx, attempt, context, gate.result.reason, correlationId);
  }

  // ── Lock P1 and enforce the 1:1 / 0..1 invariants ──
  const person = await lockPersonForBinding(tx, attempt.targetPersonId);
  if (!person) {
    return terminalize(tx, attempt, context, 'IDENTITY_CONFLICT', correlationId);
  }
  if (person.account_id !== null) {
    return terminalize(tx, attempt, context, 'TARGET_ALREADY_BOUND', correlationId);
  }

  // H4: Account creation and the P1 binding share a savepoint. If the
  // conditional P1 update loses, rolling back to the savepoint removes the
  // Account created by THIS transaction before the TERMINAL outcome commits,
  // so a loser can never leave an orphan Account.
  await tx.query('SAVEPOINT binding_phase_c');
  const { account } = await createOrReuseAccount(tx, openid);
  await setBindingCandidateAccountId(tx, account.id);
  const boundPerson = await getPersonByAccountId(tx, account.id);
  if (boundPerson && boundPerson.id !== attempt.targetPersonId) {
    await tx.query('ROLLBACK TO SAVEPOINT binding_phase_c');
    await tx.query('RELEASE SAVEPOINT binding_phase_c');
    return terminalize(tx, attempt, context, 'IDENTITY_CONFLICT', correlationId);
  }
  if (boundPerson && boundPerson.id === attempt.targetPersonId) {
    await tx.query('ROLLBACK TO SAVEPOINT binding_phase_c');
    await tx.query('RELEASE SAVEPOINT binding_phase_c');
    return terminalize(tx, attempt, context, 'TARGET_ALREADY_BOUND', correlationId);
  }

  await setBindingCommitAccountId(tx, account.id);
  const rowCount = await bindPersonAccountIfUnbound(tx, attempt.targetPersonId, account.id);
  if (rowCount !== 1) {
    await tx.query('ROLLBACK TO SAVEPOINT binding_phase_c');
    await tx.query('RELEASE SAVEPOINT binding_phase_c');
    return terminalize(tx, attempt, context, 'CONCURRENCY_LOSER', correlationId);
  }
  await tx.query('RELEASE SAVEPOINT binding_phase_c');

  const settled = await settleCommitted(tx, attempt.id, account.id);
  if (!settled) {
    const authoritative = await findByIdForUpdate(tx, attempt.id);
    if (authoritative?.state === 'COMMITTED') {
      return { outcome: 'COMMITTED', accountId: authoritative.committedAccountId! };
    }
    if (authoritative?.state === 'TERMINAL') {
      return { outcome: 'TERMINAL', reason: authoritative.terminalReason! };
    }
    throw new RetryableOperationError();
  }

  // All transport contexts linked to this attempt become session-exchangeable
// (bootstrap replay is allowed to mint a new context for the same attempt).
  await markCommittedForAttempt(tx, attempt.id, account.id);
  await appendAudit(tx, {
    correlationId,
    attemptId: settled.id,
    targetPersonId: settled.targetPersonId,
    targetFamilyId: settled.targetFamilyId,
    invitationParticipationId: settled.invitationParticipationId,
    actorAccountId: secondPartyConfirmation.actorAccountId,
    actorPersonId: secondPartyConfirmation.actorPersonId,
    eventType: 'BINDING_COMMITTED',
    result: 'COMMITTED',
  });

  return { outcome: 'COMMITTED', accountId: account.id };
}

async function terminalize(
  tx: pg.PoolClient,
  attempt: BindingAttemptRow,
  context: PendingContextRow,
  reason: BindingTerminalReason,
  correlationId: string
): Promise<CommitOutcome> {
  const settled = await settleTerminal(tx, attempt.id, reason);
  if (settled) {
    await appendAudit(tx, {
      correlationId,
      attemptId: settled.id,
      targetPersonId: settled.targetPersonId,
      targetFamilyId: settled.targetFamilyId,
      invitationParticipationId: settled.invitationParticipationId,
        eventType: 'BINDING_TERMINAL',
      result: 'TERMINAL',
      terminalReason: reason,
    });
    await clearOpenid(tx, context.id);
  }
  return { outcome: 'TERMINAL', reason };
}

async function bestEffortRetryableAudit(deps: CommitDeps, input: CommitInput): Promise<void> {
  try {
    await withBindingCommitTransaction(
      deps.pool,
      {
        attemptId: input.attemptId,
        targetPersonId: input.targetPersonId,
        targetFamilyId: input.targetFamilyId,
        actorAccountId: input.actorAccountId,
      },
      async (tx) => {
        await appendAudit(tx, {
          correlationId: randomUUID(),
          attemptId: input.attemptId,
          targetPersonId: input.targetPersonId,
          targetFamilyId: input.targetFamilyId,
          // RETRYABLE is an operation-level outcome, never an attempt state and
          // never `BINDING_TERMINAL` (plan D-15.2).
          eventType: 'BINDING_OPERATION_RETRYABLE',
          result: 'RETRYABLE',
          metadata: { outcome: 'RETRYABLE_OPERATION_FAILURE' },
        });
      }
    );
  } catch {
    // Best effort only; never changes the retryable operation result.
  }
}