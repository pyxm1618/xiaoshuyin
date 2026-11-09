/**
 * Candidate decision: AFFIRM / REJECT / CANCEL on the attempt associated with
 * the pending context. Every outcome is candidate-facing generic.
 *
 * AFFIRM is the H-01 pairing issuance point:
 *   1. current dynamic eligibility (M-01 / D-8.5)
 *   2. insert/reuse the candidate confirmation
 *   3. issue or replay the current server-generated pairing challenge
 *
 * Hidden ineligibility / terminal / settled branches return the same fixed
 * AFFIRM shape with a decoy challenge and perform no candidate-facing leak.
 */

import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import { authorize } from '@xiaoshuyin/authorization';
import {
  computeOperationScope,
  decideBindingOperation,
  hashPayload,
  getPersonByAccountId,
  type BindingOperationScope,
} from '@xiaoshuyin/domain';
import {
  setBindingAttemptContext,
  setBindingCandidateAccountId,
  setBindingGateContext,
  withBindingContextTransaction,
} from '../db/tx.js';
import {
  createDecoyPairingChallenge,
  decodePairingChallenge,
  decryptOpenid,
  encodePairingChallenge,
  hashToken,
} from './crypto.js';
import { requireContext } from './context.js';
import {
  findById,
  findByIdForUpdate,

} from './attempt-repository.js';
import { appendCandidate, hasKind } from './confirmation-repository.js';
import {
  clearOpenidForFreshContext,
  clearPairingIssuance,
  setPairingIssuance,
  type PendingContextRow,
} from './pending-context-repository.js';
import { appendAudit } from './audit-repository.js';
import {
  find as findOperationKey,
  insert as insertOperationKey,
  lockScope,
  setScope,
} from './operation-key-repository.js';
import { bindingError } from './errors.js';
import { evaluateGateForTarget } from './gate.js';
import type { InvitationResolutionPort } from './invitation-port.js';
import { settleExpiredAttempt, settleTerminalAttempt } from './settlement.js';
import { findAccountByOpenid } from '../auth/binding-account.js';

export interface CandidateDecisionDeps {
  pool: pg.Pool;
  invitationPort: InvitationResolutionPort;
  identityBindingSecret: string;
  pairingTtlSeconds: number;
}

export interface CandidateDecisionInput {
  contextToken: string;
  decision: 'AFFIRM' | 'REJECT' | 'CANCEL';
  confirmationVersion?: string | undefined;
  idempotencyKey: string;
}

export interface CandidateDecisionResult {
  binding: 'NOT_COMPLETED';
  pairingChallenge?: string;
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
      if (authDecision.decision !== 'ALLOW') return generic(input.decision);

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

      if (op.action === 'REPLAY') {
        return replayCandidateOperation(
          tx,
          deps,
          context,
          existing?.attemptId ?? null,
          input
        );
      }

      // Record the operation before switching to the Gate purpose. The
      // operation key's attempt binding is authoritative and immutable.
      if (!existing) {
        await insertOperationKey(tx, {
          scopeKind: scope.scopeKind,
          scopeKey: scope.scopeKey,
          commandType: 'CANDIDATE_DECISION',
          idempotencyKey: input.idempotencyKey,
          requestHash,
          attemptId: context.attemptId,
        });
      }

      if (!context.attemptId || !context.invitationParticipationId) {
        return generic(input.decision);
      }

      await setBindingAttemptContext(tx, {
        attemptId: context.attemptId,
        identityDigest: context.candidateIdentityDigest,
        invitationId: context.invitationParticipationId,
      });
      const initial = await findById(tx, context.attemptId);
      if (!initial) return generic(input.decision);

      // Narrow to the exact target and switch to the Gate purpose. This makes
      // the current facts readable under the binding read policies and is
      // required for audit / confirmation / context-scope writes.
      await setBindingAttemptContext(tx, {
        attemptId: initial.id,
        identityDigest: context.candidateIdentityDigest,
        invitationId: initial.invitationParticipationId,
        targetPersonId: initial.targetPersonId,
        targetFamilyId: initial.targetFamilyId,
        purpose: 'IDENTITY_BINDING_GATE',
      });

      if (initial.candidateIdentityDigest !== context.candidateIdentityDigest) {
        return generic(input.decision);
      }

      const correlationId = randomUUID();

      // M-03/M-04: one authoritative expiry settlement path. Do not transition
      // the state here and terminalize again later.
      if (initial.state === 'PENDING' && initial.expiresAt.getTime() <= Date.now()) {
        await settleExpiredAttempt(tx, { attemptId: initial.id, correlationId });
        return generic(input.decision);
      }
      if (initial.state !== 'PENDING') {
        return generic(input.decision);
      }

      if (input.decision !== 'AFFIRM') {
        const reason =
          input.decision === 'REJECT' ? 'CANDIDATE_REJECTED' : 'CANDIDATE_CANCELLED';
        await settleTerminalAttempt(tx, {
          attemptId: initial.id,
          reason,
          correlationId,
        });
        return { binding: 'NOT_COMPLETED' };
      }

      if (input.confirmationVersion !== 'candidate-binding-v1') {
        throw bindingError('VALIDATION_ERROR');
      }

      // ── M-01 current dynamic eligibility ───────────────────
      const attempt = await findByIdForUpdate(tx, initial.id);
      if (!attempt || attempt.state !== 'PENDING') return generic('AFFIRM');

      const invitation = await deps.invitationPort.resolveByParticipationId(
        tx,
        attempt.invitationParticipationId
      );
      if (invitation.status !== 'VALID') {
        await settleTerminalAttempt(tx, {
          attemptId: attempt.id,
          reason: 'INVITATION_TERMINAL',
          correlationId,
        });
        return generic('AFFIRM');
      }

      await setBindingGateContext(tx, {
        targetPersonId: attempt.targetPersonId,
        targetFamilyId: attempt.targetFamilyId,
        invitationId: attempt.invitationParticipationId,
        actorAccountId: null,
      });

      const candidateAccount = await resolveCandidateAccount(tx, deps, context);
      if (candidateAccount) {
        await setBindingCandidateAccountId(tx, candidateAccount.id);
      }
      const candidateBoundPerson = candidateAccount
        ? await getPersonByAccountId(tx, candidateAccount.id)
        : null;

      const gate = await evaluateGateForTarget(tx, {
        stage: 'GATE_2',
        targetPersonId: attempt.targetPersonId,
        targetFamilyId: attempt.targetFamilyId,
        invitation,
        candidateAccountId: candidateAccount?.id ?? null,
        candidateAccountBoundPersonId: candidateBoundPerson?.id ?? null,
        confirmer: null,
        confirmations: { candidate: false, secondParty: false },
      });
      if (gate.result.decision === 'BLOCK') {
        await settleTerminalAttempt(tx, {
          attemptId: attempt.id,
          reason: gate.result.reason,
          correlationId,
        });
        return generic('AFFIRM');
      }

      const confirmation = await appendCandidate(tx, attempt.id, context.id);
      if (confirmation) {
        await appendAudit(tx, {
          correlationId,
          attemptId: attempt.id,
          targetPersonId: attempt.targetPersonId,
          targetFamilyId: attempt.targetFamilyId,
          invitationParticipationId: attempt.invitationParticipationId,
          candidateIdentityDigest: attempt.candidateIdentityDigest,
          eventType: 'BINDING_CANDIDATE_CONFIRMED',
          result: 'PENDING',
        });
      }

      const challenge = await issueOrReplayChallenge(tx, deps, context, attempt, correlationId);
      if (!challenge) return generic('AFFIRM');
      return { binding: 'NOT_COMPLETED', pairingChallenge: challenge };
    }
  );
}

function generic(decision: 'AFFIRM' | 'REJECT' | 'CANCEL'): CandidateDecisionResult {
  if (decision !== 'AFFIRM') return { binding: 'NOT_COMPLETED' };
  return { binding: 'NOT_COMPLETED', pairingChallenge: createDecoyPairingChallenge() };
}

async function replayCandidateOperation(
  tx: pg.PoolClient,
  deps: CandidateDecisionDeps,
  context: PendingContextRow,
  attemptId: string | null,
  input: CandidateDecisionInput
): Promise<CandidateDecisionResult> {
  if (input.decision !== 'AFFIRM' || !attemptId || context.attemptId !== attemptId) {
    return generic(input.decision);
  }
  if (
    !context.pairingIssuedAt ||
    !context.pairingExpiresAt ||
    !context.pairingIssuanceId ||
    !context.invitationParticipationId
  ) {
    return generic('AFFIRM');
  }
  if (context.pairingExpiresAt.getTime() <= Date.now()) return generic('AFFIRM');

  await setBindingAttemptContext(tx, {
    attemptId,
    identityDigest: context.candidateIdentityDigest,
    invitationId: context.invitationParticipationId,
  });
  const attempt = await findById(tx, attemptId);
  if (!attempt || attempt.state !== 'PENDING') return generic('AFFIRM');
  if (await hasKind(tx, attemptId, 'SECOND_PARTY')) return generic('AFFIRM');

  return {
    binding: 'NOT_COMPLETED',
    pairingChallenge: encodePairingChallenge(
      deps.identityBindingSecret,
      {
        contextId: context.id,
        candidateIdentityDigest: context.candidateIdentityDigest,
        attemptId,
        targetPersonId: attempt.targetPersonId,
        invitationParticipationId: context.invitationParticipationId,
        pairingIssuanceId: context.pairingIssuanceId,
        pairingIssuedAt: context.pairingIssuedAt,
        pairingExpiresAt: context.pairingExpiresAt,
      }
    ),
  };
}

/**
 * The replay helper is called from inside the transaction closure where the
 * secret is available; the implementation is separated only for readability.
 */


async function resolveCandidateAccount(
  tx: pg.PoolClient,
  deps: CandidateDecisionDeps,
  context: PendingContextRow
): Promise<{ id: string } | null> {
  if (
    !context.openidCiphertext ||
    !context.openidNonce ||
    !context.openidTag
  ) {
    return null;
  }
  let openid: string;
  try {
    openid = decryptOpenid(deps.identityBindingSecret, context.id, {
      ciphertext: context.openidCiphertext,
      nonce: context.openidNonce,
      tag: context.openidTag,
    });
  } catch {
    return null;
  }
  return findAccountByOpenid(tx, openid);
}

async function issueOrReplayChallenge(
  tx: pg.PoolClient,
  deps: CandidateDecisionDeps,
  context: PendingContextRow,
  attempt: {
    id: string;
    targetPersonId: string;
    targetFamilyId: string;
    invitationParticipationId: string;
    candidateIdentityDigest: string;
    expiresAt: Date;
  },
  correlationId: string
): Promise<string | null> {
  const now = new Date();
  const ttlMs = deps.pairingTtlSeconds * 1000;
  const upperBound = Math.min(context.expiresAt.getTime(), attempt.expiresAt.getTime());
  const desiredExpiry = Math.min(now.getTime() + ttlMs, upperBound);
  if (desiredExpiry <= now.getTime()) {
    // The context or attempt is already at/over its own lifetime. Settle the
    // attempt if it expired; the context expiry is handled by requireContext.
    if (attempt.expiresAt.getTime() <= now.getTime()) {
      await settleExpiredAttempt(tx, { attemptId: attempt.id, correlationId });
    }
    return null;
  }

  let issuanceId = context.pairingIssuanceId;
  let issuedAt = context.pairingIssuedAt;
  let expiresAt = context.pairingExpiresAt;
  const reusable =
    issuanceId !== null &&
    issuedAt !== null &&
    expiresAt !== null &&
    expiresAt.getTime() > now.getTime() &&
    (await hasKind(tx, attempt.id, 'CANDIDATE'));

  if (!reusable) {
    const row = await setPairingIssuance(tx, context.id, {
      pairingIssuanceId: randomUUID(),
      pairingIssuedAt: now,
      pairingExpiresAt: new Date(desiredExpiry),
    });
    if (!row) return null;
    issuanceId = row.pairingIssuanceId;
    issuedAt = row.pairingIssuedAt;
    expiresAt = row.pairingExpiresAt;
  }

  if (!issuanceId || !issuedAt || !expiresAt) return null;
  return encodePairingChallenge(deps.identityBindingSecret, {
    contextId: context.id,
    candidateIdentityDigest: context.candidateIdentityDigest,
    attemptId: attempt.id,
    targetPersonId: attempt.targetPersonId,
    invitationParticipationId: attempt.invitationParticipationId,
    pairingIssuanceId: issuanceId,
    pairingIssuedAt: issuedAt,
    pairingExpiresAt: expiresAt,
  });
}

/** Exported for tests that need to inspect the exact replay envelope. */
export async function clearCandidatePairing(
  tx: pg.PoolClient,
  contextId: string
): Promise<void> {
  await clearPairingIssuance(tx, contextId);
  await clearOpenidForFreshContext(tx, contextId);
}