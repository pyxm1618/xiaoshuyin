/**
 * Capability → ordinary session bridge.
 *
 * Only a COMMITTED attempt whose committed account matches the pending context
 * can exchange a session. It creates no Account / Person / binding, does not
 * bump session_epoch, and returns a generic result otherwise.
 */

import type pg from 'pg';
import { getPersonById } from '@xiaoshuyin/domain';
import { authorize } from '@xiaoshuyin/authorization';
import { signToken } from '../auth/session-token.js';
import { getAccountById } from '../auth/binding-account.js';
import {
  setBindingAttemptContext,
  setBindingGateContext,
  withBindingContextTransaction,
} from '../db/tx.js';
import { requireContext } from './context.js';
import { findById } from './attempt-repository.js';
import { hashToken } from './crypto.js';

export interface SessionExchangeDeps {
  pool: pg.Pool;
  sessionSecret: string;
}

export type SessionExchangeResult =
  | { binding: 'NOT_COMPLETED' }
  | {
      binding: 'COMMITTED';
      sessionToken: string;
      accountId: string;
      personId: string;
    };

export async function exchangeSession(
  deps: SessionExchangeDeps,
  contextToken: string
): Promise<SessionExchangeResult> {
  return withBindingContextTransaction(
    deps.pool,
    { tokenHash: hashToken(contextToken) },
    async (tx) => {
      const context = await requireContext(tx, contextToken);
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
        action: 'IDENTITY_BINDING_SESSION_EXCHANGE',
        purpose: 'IDENTITY_BINDING',
      });
      if (authDecision.decision !== 'ALLOW') return { binding: 'NOT_COMPLETED' };

      if (!context.attemptId) return { binding: 'NOT_COMPLETED' };

      if (!context.invitationParticipationId) return { binding: 'NOT_COMPLETED' };

      await setBindingAttemptContext(tx, {
        attemptId: context.attemptId,
        identityDigest: context.candidateIdentityDigest,
        invitationId: context.invitationParticipationId,
      });

      const attempt = await findById(tx, context.attemptId);
      if (!attempt || attempt.state !== 'COMMITTED') {
        return { binding: 'NOT_COMPLETED' };
      }

      // Identity / committed-account consistency (four-element check).
      if (attempt.candidateIdentityDigest !== context.candidateIdentityDigest) {
        return { binding: 'NOT_COMPLETED' };
      }
      if (
        context.committedAccountId === null ||
        context.committedAccountId !== attempt.committedAccountId
      ) {
        return { binding: 'NOT_COMPLETED' };
      }

      await setBindingAttemptContext(tx, {
        attemptId: attempt.id,
        identityDigest: context.candidateIdentityDigest,
        invitationId: attempt.invitationParticipationId,
        targetPersonId: attempt.targetPersonId,
        targetFamilyId: attempt.targetFamilyId,
      });
      // The target GUC unlocks the Slice 1 `persons_binding_target_read` policy.
      await setBindingGateContext(tx, {
        targetPersonId: attempt.targetPersonId,
        targetFamilyId: attempt.targetFamilyId,
      });

      const person = await getPersonById(tx, attempt.targetPersonId);
      const account = await getAccountById(tx, attempt.committedAccountId);
      if (!person || !account || person.account_id !== account.id) {
        return { binding: 'NOT_COMPLETED' };
      }

      const expiresAtSeconds = Math.floor(Date.now() / 1000) + 86400;
      const sessionToken = signToken(
        {
          accountId: account.id,
          epoch: account.sessionEpoch,
          exp: expiresAtSeconds,
        },
        deps.sessionSecret
      );

      return {
        binding: 'COMMITTED',
        sessionToken,
        accountId: account.id,
        personId: person.id,
      };
    }
  );
}