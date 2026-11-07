/**
 * Invitation-aware identity bootstrap: Phase A → Case B / Case C → Gate 1 →
 * Phase B attempt. Independent from ordinary login; never creates Person or a
 * formal Account, never issues an ordinary session before binding.
 *
 * Frozen order: 005 §5.1, plan D-3 / D-8 / D-14 / D-17.
 */

import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import { authorize } from '@xiaoshuyin/authorization';
import {
  computeOperationScope,
  decideBindingOperation,
  generateUuidv7,
  getPersonByAccountId,
  getPersonById,
  hashPayload,
  type BindingOperationScope,
} from '@xiaoshuyin/domain';
import { signToken } from '../auth/session-token.js';
import { findAccountByOpenid } from '../auth/binding-account.js';
import type { WechatAuthProvider } from '../auth/wechat-provider.js';
import {
  setBindingCandidateAccountId,
  setBindingGateContext,
  withBindingBootstrapTransaction,
} from '../db/tx.js';
import {
  createContextToken,
  deriveIdentityDigest,
  encryptOpenid,
  hashToken,
} from './crypto.js';
import {
  clearOpenid,
  createContext,
  linkAttempt,
  markCommitted,
  type PendingContextRow,
} from './pending-context-repository.js';
import {
  createAttempt,
  findLatestByTriple,
} from './attempt-repository.js';
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

export interface BootstrapDeps {
  pool: pg.Pool;
  invitationPort: InvitationResolutionPort;
  wechatProvider: WechatAuthProvider;
  identityBindingSecret: string;
  contextTtlSeconds: number;
  attemptTtlSeconds: number;
  sessionSecret: string;
}

export interface BootstrapInput {
  code: string;
  invitationToken: string;
  idempotencyKey: string;
}

export type BootstrapResult =
  | { kind: 'GENERIC'; pendingContextToken: string }
  | { kind: 'REUSED'; sessionToken: string; accountId: string; personId: string };

export async function bootstrap(
  deps: BootstrapDeps,
  input: BootstrapInput
): Promise<BootstrapResult> {
  // WeChat authentication is outside the DB transaction.
  let openid: string;
  try {
    ({ openid } = await deps.wechatProvider.code2session(input.code));
  } catch {
    throw bindingError('WECHAT_AUTH_FAILED');
  }

  const identityDigest = deriveIdentityDigest(deps.identityBindingSecret, openid);

  // Single authorization entry (plan D-12). The actor is the just-authenticated
  // WeChat identity; a denial fails closed before any DB write.
  const bootstrapDecision = authorize({
    actor: { kind: 'WECHAT_CANDIDATE', candidateIdentityDigest: identityDigest },
    product: 'V1',
    family: null,
    case: null,
    resource: { type: 'BINDING', attemptId: null, personId: null },
    action: 'IDENTITY_BINDING_BOOTSTRAP',
    purpose: 'IDENTITY_BINDING',
  });
  if (bootstrapDecision.decision !== 'ALLOW') {
    throw bindingError('WECHAT_AUTH_FAILED');
  }

  const token = createContextToken();
  const tokenHash = hashToken(token);
  const correlationId = randomUUID();
  const requestHash = hashPayload({
    invitationToken: input.invitationToken,
    identityDigest,
  });

  const result = await withBindingBootstrapTransaction(
    deps.pool,
    { contextHash: tokenHash, identityDigest },
    async (tx): Promise<BootstrapResult> => {
      const invitation = await deps.invitationPort.resolveByToken(tx, input.invitationToken);
      const scope: BindingOperationScope = computeOperationScope({
        commandType: 'BOOTSTRAP',
        invitationParticipationId:
          invitation.status === 'VALID' ? invitation.participationId : null,
        invitationToken: input.invitationToken,
        candidateIdentityDigest: identityDigest,
      });

      await setScope(tx, scope.scopeKey);
      await lockScope(tx, {
        scopeKind: scope.scopeKind,
        scopeKey: scope.scopeKey,
        commandType: 'BOOTSTRAP',
        idempotencyKey: input.idempotencyKey,
      });

      const existing = await findOperationKey(tx, {
        scopeKind: scope.scopeKind,
        scopeKey: scope.scopeKey,
        commandType: 'BOOTSTRAP',
        idempotencyKey: input.idempotencyKey,
      });
      const decision = decideBindingOperation(existing ? { requestHash: existing.requestHash } : null, requestHash);
      if (decision.action === 'MISMATCH') {
        throw bindingError('IDEMPOTENCY_PAYLOAD_MISMATCH');
      }

      const context = await createPendingContext(tx, deps, {
        identityDigest,
        tokenHash,
        openid,
      });

      // Exact replay: no duplicate attempt / confirmation / audit. A fresh
      // opaque context token is issued and linked to the authoritative attempt
      // when one exists, so status / session remain usable.
      if (decision.action === 'REPLAY') {
        if (invitation.status === 'VALID') {
          // Attempt visibility requires the invitation GUC in addition to the
          // identity digest set by the bootstrap wrapper. Set the target Gate
          // context BEFORE reading the authoritative attempt (H3).
          await setBindingGateContext(tx, {
            targetPersonId: invitation.targetPersonId,
            targetFamilyId: invitation.targetFamilyId,
            invitationId: invitation.participationId,
            actorAccountId: null,
          });
          const attempt = await findLatestByTriple(tx, {
            targetPersonId: invitation.targetPersonId,
            candidateIdentityDigest: identityDigest,
            invitationParticipationId: invitation.participationId,
          });
          if (attempt) {
            await linkAttempt(tx, context.id, attempt.id, invitation.participationId);
            // A settled COMMITTED replay must make status / session usable
            // without re-executing the commit.
            if (attempt.state === 'COMMITTED' && attempt.committedAccountId) {
              await markCommitted(tx, context.id, attempt.committedAccountId);
            }
          }
        }
        return { kind: 'GENERIC', pendingContextToken: token };
      }

      if (existing === null) {
        await insertOperationKey(tx, {
          scopeKind: scope.scopeKind,
          scopeKey: scope.scopeKey,
          commandType: 'BOOTSTRAP',
          idempotencyKey: input.idempotencyKey,
          requestHash,
          attemptId: null,
        });
      }

      await appendAudit(tx, {
        correlationId,
        eventType: 'BINDING_BOOTSTRAP_AUTHENTICATED',
        result: 'PENDING',
        candidateIdentityDigest: identityDigest,
      });

      // ── Invalid / terminal invitation: generic, no P1 association ──
      if (invitation.status !== 'VALID') {
        await appendAudit(tx, {
          correlationId,
          eventType: 'BINDING_GATE1_BLOCKED',
          result: 'TERMINAL',
          terminalReason: 'INVITATION_TERMINAL',
          candidateIdentityDigest: identityDigest,
        });
        await clearOpenid(tx, context.id);
        return { kind: 'GENERIC', pendingContextToken: token };
      }

      // ── Gate context: target facts are read strictly server-side ──
      await setBindingGateContext(tx, {
        targetPersonId: invitation.targetPersonId,
        targetFamilyId: invitation.targetFamilyId,
        invitationId: invitation.participationId,
        actorAccountId: null,
      });

      const targetPerson = await getPersonById(tx, invitation.targetPersonId);
      const candidateAccount = await findAccountByOpenid(tx, openid);
      if (candidateAccount) {
        await setBindingCandidateAccountId(tx, candidateAccount.id);
      }
      const candidateBoundPerson = candidateAccount
        ? await getPersonByAccountId(tx, candidateAccount.id)
        : null;

      // ── Case B: P1 already has an Account ──
      if (targetPerson && targetPerson.account_id !== null) {
        if (candidateAccount && candidateAccount.id === targetPerson.account_id) {
          // Correct Account → reuse existing binding; never re-confirm.
          const expiresAtSeconds = Math.floor(Date.now() / 1000) + 86400;
          const sessionToken = signToken(
            {
              accountId: candidateAccount.id,
              epoch: candidateAccount.sessionEpoch,
              exp: expiresAtSeconds,
            },
            deps.sessionSecret
          );
          return {
            kind: 'REUSED',
            sessionToken,
            accountId: candidateAccount.id,
            personId: targetPerson.id,
          };
        }
        // Wrong Account → reject without rebinding; no P1 association leaks.
        await appendAudit(tx, {
          correlationId,
          eventType: 'BINDING_GATE1_BLOCKED',
          result: 'TERMINAL',
          terminalReason: 'IDENTITY_CONFLICT',
          candidateIdentityDigest: identityDigest,
        });
        await clearOpenid(tx, context.id);
        return { kind: 'GENERIC', pendingContextToken: token };
      }

      // ── Case C: Gate 1 before any P1-specific attempt ──
      const gate = await evaluateGateForTarget(tx, {
        stage: 'GATE_1',
        targetPersonId: invitation.targetPersonId,
        targetFamilyId: invitation.targetFamilyId,
        invitation,
        candidateAccountId: candidateAccount?.id ?? null,
        candidateAccountBoundPersonId: candidateBoundPerson?.id ?? null,
        confirmer: null,
      });

      if (gate.result.decision !== 'PASS') {
        const reason =
          gate.result.decision === 'BLOCK' ? gate.result.reason : 'COMPLIANCE_BLOCKED';
        await appendAudit(tx, {
          correlationId,
          eventType: 'BINDING_GATE1_BLOCKED',
          result: 'TERMINAL',
          terminalReason: reason,
          candidateIdentityDigest: identityDigest,
        });
        await clearOpenid(tx, context.id);
        return { kind: 'GENERIC', pendingContextToken: token };
      }

      // ── Phase B: create or converge the single live attempt ──
      const { attempt, created } = await createAttempt(tx, {
        targetPersonId: invitation.targetPersonId,
        targetFamilyId: invitation.targetFamilyId,
        invitationParticipationId: invitation.participationId,
        candidateIdentityDigest: identityDigest,
        ttlSeconds: deps.attemptTtlSeconds,
      });

      await linkAttempt(tx, context.id, attempt.id, invitation.participationId);

      if (created) {
        await appendAudit(tx, {
          correlationId,
          attemptId: attempt.id,
          targetPersonId: attempt.targetPersonId,
          targetFamilyId: attempt.targetFamilyId,
          invitationParticipationId: attempt.invitationParticipationId,
          candidateIdentityDigest: identityDigest,
          eventType: 'BINDING_ATTEMPT_CREATED',
          result: 'PENDING',
        });
      }

      return { kind: 'GENERIC', pendingContextToken: token };
    }
  );

  return result;
}

async function createPendingContext(
  tx: pg.PoolClient,
  deps: BootstrapDeps,
  input: { identityDigest: string; tokenHash: string; openid: string }
): Promise<PendingContextRow> {
  const contextId = await generateUuidv7(tx);
  const encrypted = encryptOpenid(deps.identityBindingSecret, contextId, input.openid);
  return createContext(tx, {
    id: contextId,
    tokenHash: input.tokenHash,
    identityDigest: input.identityDigest,
    ttlSeconds: deps.contextTtlSeconds,
    ciphertext: encrypted.ciphertext,
    nonce: encrypted.nonce,
    tag: encrypted.tag,
  });
}