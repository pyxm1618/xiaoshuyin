/**
 * Candidate status: binary candidate-facing result, no internal reason.
 */

import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import { authorize } from '@xiaoshuyin/authorization';
import {
  setBindingAttemptContext,
  withBindingContextTransaction,
} from '../db/tx.js';
import { requireContext } from './context.js';
import { findById } from './attempt-repository.js';
import { settleExpiredAttempt } from './settlement.js';
import { hashToken } from './crypto.js';

export interface CandidateStatusDeps {
  pool: pg.Pool;
}

export async function getCandidateStatus(
  deps: CandidateStatusDeps,
  contextToken: string
): Promise<{ binding: 'NOT_COMPLETED' | 'COMMITTED' }> {
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
        action: 'IDENTITY_BINDING_STATUS_SELF',
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

      const initial = await findById(tx, context.attemptId);
      if (!initial) return { binding: 'NOT_COMPLETED' };

      await setBindingAttemptContext(tx, {
        attemptId: initial.id,
        identityDigest: context.candidateIdentityDigest,
        invitationId: initial.invitationParticipationId,
        targetPersonId: initial.targetPersonId,
        targetFamilyId: initial.targetFamilyId,
        purpose: 'IDENTITY_BINDING_GATE',
      });

      if (initial.state === 'PENDING') {
        const expired = await settleExpiredAttempt(tx, {
          attemptId: initial.id,
          correlationId: randomUUID(),
        });
        if (expired) return { binding: 'NOT_COMPLETED' };
      }

      return {
        binding: initial.state === 'COMMITTED' ? 'COMMITTED' : 'NOT_COMPLETED',
      };
    }
  );
}