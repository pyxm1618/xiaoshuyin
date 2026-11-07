/**
 * Identity binding audit sink (Slice 006-owned, append-only, runtime-insert-only).
 *
 * Never stores token, token hash, openid, ciphertext, consent text or any PII
 * beyond the frozen minimum. Phase-A / pre-attempt blocks pass null target
 * fields so no candidate↔P1 association is created.
 */

import type pg from 'pg';
import type { BindingTerminalReason } from '@xiaoshuyin/domain';

export type BindingAuditEventType =
  | 'BINDING_BOOTSTRAP_AUTHENTICATED'
  | 'BINDING_GATE1_BLOCKED'
  | 'BINDING_ATTEMPT_CREATED'
  | 'BINDING_CANDIDATE_CONFIRMED'
  | 'BINDING_CANDIDATE_REJECTED'
  | 'BINDING_CANDIDATE_CANCELLED'
  | 'BINDING_SECOND_PARTY_CONFIRMED'
  | 'BINDING_SECOND_PARTY_REJECTED'
  | 'BINDING_COMMITTED'
  | 'BINDING_TERMINAL';

export type BindingAuditResult = 'PENDING' | 'COMMITTED' | 'TERMINAL' | 'RETRYABLE';

export interface BindingAuditInput {
  correlationId: string;
  attemptId?: string | null;
  targetPersonId?: string | null;
  targetFamilyId?: string | null;
  invitationParticipationId?: string | null;
  actorAccountId?: string | null;
  actorPersonId?: string | null;
  candidateIdentityDigest?: string | null;
  eventType: BindingAuditEventType;
  result: BindingAuditResult;
  terminalReason?: BindingTerminalReason | null;
  metadata?: Record<string, unknown>;
}

export async function appendAudit(
  tx: pg.PoolClient,
  input: BindingAuditInput
): Promise<void> {
  await tx.query(
    `INSERT INTO identity_binding_audit_events
       (correlation_id, attempt_id, target_person_id, target_family_id,
        invitation_participation_id, actor_account_id, actor_person_id,
        candidate_identity_digest, event_type, result, terminal_reason, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
    [
      input.correlationId,
      input.attemptId ?? null,
      input.targetPersonId ?? null,
      input.targetFamilyId ?? null,
      input.invitationParticipationId ?? null,
      input.actorAccountId ?? null,
      input.actorPersonId ?? null,
      input.candidateIdentityDigest ?? null,
      input.eventType,
      input.result,
      input.terminalReason ?? null,
      JSON.stringify(input.metadata ?? {}),
    ]
  );
}
