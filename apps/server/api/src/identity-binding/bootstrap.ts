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
  setBindingAttemptContext,
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
  findById,
} from './attempt-repository.js';
import { appendAudit } from './audit-repository.js';
import {
  find as findOperationKey,
  findBootstrapByRequestHash,
  insert as insertOperationKey,
  lockScope,
  mapAttempt,
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
  | { kind: 'REUSED'; sessionToken: string; accountId: string; personId: string }
  | { kind: 'COMMITTED' };

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
  // WeChat identity. A denial is NOT a WeChat authentication failure: it must
  // stay anti-enumeration and produce the same frozen generic bootstrap shape
  // as every other pre-attempt outcome (plan D-10.3 / D-11.1).
  const bootstrapDecision = authorize({
    actor: { kind: 'WECHAT_CANDIDATE', candidateIdentityDigest: identityDigest },
    product: 'V1',
    family: null,
    case: null,
    resource: { type: 'BINDING', attemptId: null, personId: null },
    action: 'IDENTITY_BINDING_BOOTSTRAP',
    purpose: 'IDENTITY_BINDING',
  });
  const authorizationDenied = bootstrapDecision.decision !== 'ALLOW';

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
      // The pending context is the transport credential for every generic
      // outcome, including authorization denial. No operation key, attempt,
      // confirmation or business audit is written on a DENY.
      const context = await createPendingContext(tx, deps, {
        identityDigest,
        tokenHash,
        openid,
      });
      if (authorizationDenied) {
        await clearOpenid(tx, context.id);
        return { kind: 'GENERIC', pendingContextToken: token };
      }

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

      const scopedExisting = await findOperationKey(tx, {
        scopeKind: scope.scopeKind,
        scopeKey: scope.scopeKey,
        commandType: 'BOOTSTRAP',
        idempotencyKey: input.idempotencyKey,
      });
      // An invitation becoming terminal changes the derived scope key
      // (participation id → token hash). Exact replay must still reach its
      // original operation key, so fall back to the invariant request
      // fingerprint (token + identity) before deciding EXECUTE.
      const existing =
        scopedExisting ??
        (await findBootstrapByRequestHash(tx, {
          idempotencyKey: input.idempotencyKey,
          requestHash,
        }));
      const decision = decideBindingOperation(existing ? { requestHash: existing.requestHash } : null, requestHash);
      if (decision.action === 'MISMATCH') {
        throw bindingError('IDEMPOTENCY_PAYLOAD_MISMATCH');
      }

      // Exact replay: no duplicate attempt / confirmation / audit. A fresh
      // opaque context token is issued and linked to the authoritative attempt
      // recorded on the operation key, never to whatever attempt happens to be
      // latest for the triple (M-01). A new invitation state or a later
      // attempt must not change the identity of an existing operation.
      if (decision.action === 'REPLAY') {
        if (existing?.attemptId) {
          // Attempt visibility is identity-bound and exact-id bound; for a
          // terminal invitation the participation id is no longer derivable,
          // so the id from the operation key is the only authoritative link.
          await setBindingAttemptContext(tx, {
            attemptId: existing.attemptId,
            identityDigest,
            // The operation key is the authoritative link. The current
            // invitation state may differ from the creation-time state, so it
            // must not narrow or redirect attempt visibility.
            invitationId: null,
          });
          const attempt = await findById(tx, existing.attemptId);
          if (attempt) {
            await linkAttempt(tx, context.id, attempt.id, attempt.invitationParticipationId);
            // Historical settled replay: the authoritative attempt is already
            // COMMITTED. Return the frozen `{ binding: "COMMITTED" }` without
            // re-executing commit, reviving the invitation, creating a
            // session, or writing a second business audit.
            if (attempt.state === 'COMMITTED' && attempt.committedAccountId) {
              await markCommitted(tx, context.id, attempt.committedAccountId);
              return { kind: 'COMMITTED' };
            }
            if (attempt.state === 'TERMINAL') {
              await clearOpenid(tx, context.id);
            }
          }
        }
        return { kind: 'GENERIC', pendingContextToken: token };
      }

      let operationKeyId: string | null = null;
      if (existing === null) {
        const inserted = await insertOperationKey(tx, {
          scopeKind: scope.scopeKind,
          scopeKey: scope.scopeKey,
          commandType: 'BOOTSTRAP',
          idempotencyKey: input.idempotencyKey,
          requestHash,
          attemptId: null,
        });
        operationKeyId = inserted?.id ?? null;
        if (!inserted) {
          // Defensive convergence for a concurrent insert into a different
          // scope row: bind the key that already exists instead of creating a
          // second business operation.
          const converged =
            (await findOperationKey(tx, {
              scopeKind: scope.scopeKind,
              scopeKey: scope.scopeKey,
              commandType: 'BOOTSTRAP',
              idempotencyKey: input.idempotencyKey,
            })) ??
            (await findBootstrapByRequestHash(tx, {
              idempotencyKey: input.idempotencyKey,
              requestHash,
            }));
          operationKeyId = converged?.id ?? null;
          if (converged && converged.requestHash !== requestHash) {
            throw bindingError('IDEMPOTENCY_PAYLOAD_MISMATCH');
          }
        }
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

      // Bind the operation key to the authoritative attempt in the same
      // transaction that creates / converges it. From this point an exact
      // replay of this key always resolves THIS attempt, even after a later
      // attempt for the same triple exists. The operation-key domain keeps its
      // PENDING purpose and exact-attempt scope for this write.
      await setBindingAttemptContext(tx, {
        attemptId: attempt.id,
        identityDigest,
        invitationId: attempt.invitationParticipationId,
        targetPersonId: attempt.targetPersonId,
        targetFamilyId: attempt.targetFamilyId,
        purpose: 'IDENTITY_BINDING_PENDING',
      });
      if (operationKeyId) {
        await mapAttempt(tx, { operationKeyId, attemptId: attempt.id });
      }

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