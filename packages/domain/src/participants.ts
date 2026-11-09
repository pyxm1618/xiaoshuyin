/**
 * Slice 4 Case Participant Core.
 *
 * This is the single repository for case_participants SQL. Identity binding
 * remains owned by Slice 5; this module never reads or writes persons.account_id.
 */

import { createHash, createHmac } from 'node:crypto';
import type { PoolClient } from 'pg';
import {
  assertMinorProcessingAllowed,
  getComplianceProfileForGate,
  getConsentRecordForGate,
  getCurrentNoticeHash,
} from '@xiaoshuyin/compliance';

export const CASE_PARTICIPATION_STATES = [
  'PENDING',
  'ACTIVE',
  'DECLINED',
  'EXPIRED',
  'WITHDRAWN',
] as const;

export type CaseParticipationState = (typeof CASE_PARTICIPATION_STATES)[number];

export const PARTICIPATION_ERROR_CODES = [
  'PARTICIPATION_ALREADY_EXISTS',
  'PARTICIPATION_TARGET_INELIGIBLE',
  'INVITATION_NOT_AVAILABLE',
  'PARTICIPATION_NOT_FOUND',
  'PARTICIPATION_STATE_CONFLICT',
] as const;

export type ParticipationErrorCode = (typeof PARTICIPATION_ERROR_CODES)[number];
export type ParticipationCommand = 'ACCEPT' | 'DECLINE' | 'WITHDRAW';

export interface ParticipationResource {
  id: string;
  familyId: string;
  caseId: string;
  personId: string;
  state: CaseParticipationState;
  inviteTokenHash: string;
  inviteExpiresAt: Date;
  createdByPersonId: string;
  acceptedAt: Date | null;
  declinedAt: Date | null;
  expiredAt: Date | null;
  withdrawnAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ParticipationPublicResource {
  id: string;
  caseId: string;
  personId: string;
  state: CaseParticipationState;
  createdAt: Date;
  acceptedAt: Date | null;
  declinedAt: Date | null;
  expiredAt: Date | null;
  withdrawnAt: Date | null;
}

export interface ParticipationRow {
  id: string;
  family_id: string;
  case_id: string;
  person_id: string;
  state: CaseParticipationState;
  invite_token_hash: string;
  invite_expires_at: Date;
  created_by_person_id: string;
  accepted_at: Date | null;
  declined_at: Date | null;
  expired_at: Date | null;
  withdrawn_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export const PARTICIPATION_NOTICE = Object.freeze({
  version: 'participation-notice-v1',
  title: '参与邀请',
  body:
    '你被邀请参与一个已经存在的 Case。参与是有限的：你可以查看本次参与说明，选择接受或拒绝。拒绝不是失败，也不会关闭 Case。接受后你只能访问明确允许给你的内容。',
});

export function effectiveParticipationState(
  state: CaseParticipationState,
  inviteExpiresAt: Date,
  now: Date = new Date()
): CaseParticipationState {
  if (state === 'PENDING' && now.getTime() >= inviteExpiresAt.getTime()) {
    return 'EXPIRED';
  }
  return state;
}

export type ParticipationCommandPlan =
  | { action: 'TRANSITION'; from: 'PENDING' | 'ACTIVE'; to: 'ACTIVE' | 'DECLINED' | 'WITHDRAWN' }
  | { action: 'CONVERGED'; state: 'ACTIVE' | 'DECLINED' | 'WITHDRAWN' }
  | { action: 'EXPIRE_AND_CONFLICT'; currentState: 'EXPIRED' }
  | { action: 'CONFLICT'; currentState: CaseParticipationState };

export function planParticipationCommand(
  state: CaseParticipationState,
  command: ParticipationCommand,
  inviteExpiresAt: Date,
  now: Date = new Date()
): ParticipationCommandPlan {
  if (state === 'PENDING' && now.getTime() >= inviteExpiresAt.getTime()) {
    return { action: 'EXPIRE_AND_CONFLICT', currentState: 'EXPIRED' };
  }

  if (command === 'ACCEPT') {
    if (state === 'PENDING') return { action: 'TRANSITION', from: 'PENDING', to: 'ACTIVE' };
    if (state === 'ACTIVE') return { action: 'CONVERGED', state: 'ACTIVE' };
    return { action: 'CONFLICT', currentState: state };
  }

  if (command === 'DECLINE') {
    if (state === 'PENDING') return { action: 'TRANSITION', from: 'PENDING', to: 'DECLINED' };
    if (state === 'DECLINED') return { action: 'CONVERGED', state: 'DECLINED' };
    return { action: 'CONFLICT', currentState: state };
  }

  if (state === 'ACTIVE') return { action: 'TRANSITION', from: 'ACTIVE', to: 'WITHDRAWN' };
  if (state === 'WITHDRAWN') return { action: 'CONVERGED', state: 'WITHDRAWN' };
  return { action: 'CONFLICT', currentState: state };
}

export function deriveParticipationInviteToken(secret: string, participationId: string): string {
  if (Buffer.byteLength(secret, 'utf8') < 32) {
    throw new Error('PARTICIPATION_INVITE_TOKEN_SECRET_TOO_SHORT');
  }
  return createHmac('sha256', secret)
    .update(`participation-invite:v1:${participationId}`, 'utf8')
    .digest('base64url');
}

export function hashParticipationInviteToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

const PARTICIPATION_COLUMNS = `
  id, family_id, case_id, person_id, state, invite_token_hash,
  invite_expires_at, created_by_person_id, accepted_at, declined_at,
  expired_at, withdrawn_at, created_at, updated_at
`;

export function toParticipationResource(row: ParticipationRow): ParticipationPublicResource {
  return {
    id: row.id,
    caseId: row.case_id,
    personId: row.person_id,
    state: row.state,
    createdAt: row.created_at,
    acceptedAt: row.accepted_at,
    declinedAt: row.declined_at,
    expiredAt: row.expired_at,
    withdrawnAt: row.withdrawn_at,
  };
}

export async function allocateParticipationId(tx: PoolClient): Promise<string> {
  const { rows } = await tx.query<{ id: string }>('SELECT uuidv7() AS id');
  const row = rows[0];
  if (!row) throw new Error('PARTICIPATION_ID_ALLOCATION_FAILED');
  return row.id;
}

export async function insertParticipationInvite(
  tx: PoolClient,
  input: {
    id: string;
    familyId: string;
    caseId: string;
    personId: string;
    inviteTokenHash: string;
    ttlSeconds: number;
    createdByPersonId: string;
  }
): Promise<ParticipationRow> {
  const { rows } = await tx.query<ParticipationRow>(
    `INSERT INTO case_participants
       (id, family_id, case_id, person_id, state, invite_token_hash,
        invite_expires_at, created_by_person_id)
     VALUES ($1, $2, $3, $4, 'PENDING', $5,
             now() + make_interval(secs => $6::int), $7)
     RETURNING ${PARTICIPATION_COLUMNS}`,
    [
      input.id,
      input.familyId,
      input.caseId,
      input.personId,
      input.inviteTokenHash,
      input.ttlSeconds,
      input.createdByPersonId,
    ]
  );
  const row = rows[0];
  if (!row) throw new Error('PARTICIPATION_INSERT_RETURNED_NO_ROW');
  return row;
}

export async function hasLiveParticipation(
  tx: PoolClient,
  caseId: string,
  personId: string
): Promise<boolean> {
  const { rows } = await tx.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM case_participants
       WHERE case_id=$1 AND person_id=$2 AND state IN ('PENDING','ACTIVE')
     ) AS exists`,
    [caseId, personId]
  );
  return rows[0]?.exists === true;
}

export async function getParticipationById(
  tx: PoolClient,
  participationId: string
): Promise<ParticipationRow | null> {
  const { rows } = await tx.query<ParticipationRow>(
    `SELECT ${PARTICIPATION_COLUMNS}
     FROM case_participants
     WHERE id=$1`,
    [participationId]
  );
  return rows[0] ?? null;
}

export async function lockParticipationById(
  tx: PoolClient,
  participationId: string
): Promise<ParticipationRow | null> {
  const { rows } = await tx.query<ParticipationRow>(
    `SELECT ${PARTICIPATION_COLUMNS}
     FROM case_participants
     WHERE id=$1
     FOR UPDATE`,
    [participationId]
  );
  return rows[0] ?? null;
}

export async function getParticipationByTokenHash(
  tx: PoolClient,
  tokenHash: string
): Promise<ParticipationRow | null> {
  const { rows } = await tx.query<ParticipationRow>(
    `SELECT ${PARTICIPATION_COLUMNS}
     FROM case_participants
     WHERE invite_token_hash=$1 AND state='PENDING'`,
    [tokenHash]
  );
  return rows[0] ?? null;
}

export async function getLiveParticipationByTokenHash(
  tx: PoolClient,
  tokenHash: string
): Promise<ParticipationRow | null> {
  const { rows } = await tx.query<ParticipationRow>(
    `SELECT ${PARTICIPATION_COLUMNS}
     FROM case_participants
     WHERE invite_token_hash=$1
       AND state='PENDING'
       AND invite_expires_at > now()`,
    [tokenHash]
  );
  return rows[0] ?? null;
}

export interface ParticipationInvitePublicRow {
  participation_id: string;
  state: 'PENDING';
  expires_at: Date;
  created_at: Date;
}

export async function getPublicParticipationInvite(
  tx: PoolClient
): Promise<ParticipationInvitePublicRow | null> {
  const { rows } = await tx.query<ParticipationInvitePublicRow>(
    `SELECT participation_id, state, expires_at, created_at
     FROM case_participant_invite_public`
  );
  if (rows.length > 1) throw new Error('INVITE_TOKEN_VIEW_RETURNED_MULTIPLE_ROWS');
  return rows[0] ?? null;
}

export async function materializeParticipationExpiry(
  tx: PoolClient,
  participationId: string
): Promise<ParticipationRow | null> {
  const { rows } = await tx.query<ParticipationRow>(
    `UPDATE case_participants
     SET state='EXPIRED', expired_at=now(), updated_at=now()
     WHERE id=$1 AND state='PENDING' AND invite_expires_at <= now()
     RETURNING ${PARTICIPATION_COLUMNS}`,
    [participationId]
  );
  return rows[0] ?? null;
}

export async function activateParticipation(
  tx: PoolClient,
  participationId: string
): Promise<ParticipationRow | null> {
  const { rows } = await tx.query<ParticipationRow>(
    `UPDATE case_participants
     SET state='ACTIVE', accepted_at=now(), updated_at=now()
     WHERE id=$1 AND state='PENDING' AND invite_expires_at > now()
     RETURNING ${PARTICIPATION_COLUMNS}`,
    [participationId]
  );
  return rows[0] ?? null;
}

export async function declineParticipation(
  tx: PoolClient,
  participationId: string
): Promise<ParticipationRow | null> {
  const { rows } = await tx.query<ParticipationRow>(
    `UPDATE case_participants
     SET state='DECLINED', declined_at=now(), updated_at=now()
     WHERE id=$1 AND state='PENDING' AND invite_expires_at > now()
     RETURNING ${PARTICIPATION_COLUMNS}`,
    [participationId]
  );
  return rows[0] ?? null;
}

export async function withdrawParticipation(
  tx: PoolClient,
  participationId: string
): Promise<ParticipationRow | null> {
  const { rows } = await tx.query<ParticipationRow>(
    `UPDATE case_participants
     SET state='WITHDRAWN', withdrawn_at=now(), updated_at=now()
     WHERE id=$1 AND state='ACTIVE'
     RETURNING ${PARTICIPATION_COLUMNS}`,
    [participationId]
  );
  return rows[0] ?? null;
}

export type ParticipationAuditEvent =
  | 'PARTICIPATION_INVITE_CREATED'
  | 'PARTICIPATION_ACCEPTED'
  | 'PARTICIPATION_DECLINED'
  | 'PARTICIPATION_EXPIRED'
  | 'PARTICIPATION_WITHDRAWN';

export async function insertParticipationAudit(
  tx: PoolClient,
  input: {
    familyId: string;
    actorAccountId: string;
    participationId: string;
    eventType: ParticipationAuditEvent;
    metadata: Record<string, unknown>;
  }
): Promise<void> {
  await tx.query(
    `INSERT INTO business_audit_events
       (family_id, actor_account_id, event_type, resource_type, resource_id, metadata)
     VALUES ($1,$2,$3,'CASE_PARTICIPANT',$4,$5::jsonb)`,
    [
      input.familyId,
      input.actorAccountId,
      input.eventType,
      input.participationId,
      JSON.stringify(input.metadata),
    ]
  );
}

export async function isParticipationProcessingAllowed(
  tx: PoolClient,
  personId: string
): Promise<boolean> {
  const row = await getComplianceProfileForGate(tx, personId);
  const profile = row
    ? {
        ageBand: row.age_band as 'ADULT' | 'MINOR_14_17' | 'UNDER_14' | 'UNKNOWN',
        minorMode: row.minor_mode as boolean,
        guardianPersonId: (row.guardian_person_id ?? null) as string | null,
        guardianConsentRecordId: (row.guardian_consent_record_id ?? null) as string | null,
        guardianConsentVersion: (row.guardian_consent_version ?? null) as number | null,
        verifiedSource: row.verified_source as string,
      }
    : null;

  let consent: {
    id: string;
    decision: 'GRANTED' | 'REVOKED';
    boundPersonId: string | null;
    noticeHash: string;
    guardianPersonId: string;
  } | null = null;

  if (profile?.guardianConsentRecordId) {
    const c = await getConsentRecordForGate(tx, profile.guardianConsentRecordId);
    consent = c
      ? {
          id: c.id,
          decision: c.decision,
          boundPersonId: c.bound_person_id,
          noticeHash: c.notice_hash,
          guardianPersonId: c.guardian_person_id,
        }
      : null;
  }

  return assertMinorProcessingAllowed(personId, {
    getProfile: () => profile,
    getConsentRecord: () => consent,
    getCurrentNoticeHash,
  }).decision === 'ALLOW';
}

export interface BindingInvitationFacts {
  participationId: string;
  targetPersonId: string;
  targetFamilyId: string;
  expiresAt: string;
}

export async function getBindingInvitationByTokenHash(
  tx: PoolClient,
  tokenHash: string
): Promise<BindingInvitationFacts | null> {
  const row = await getLiveParticipationByTokenHash(tx, tokenHash);
  if (!row) return null;
  return {
    participationId: row.id,
    targetPersonId: row.person_id,
    targetFamilyId: row.family_id,
    expiresAt: row.invite_expires_at.toISOString(),
  };
}

export async function getBindingInvitationByTrustedTarget(
  tx: PoolClient,
  participationId: string,
  targetFamilyId: string,
  targetPersonId: string
): Promise<BindingInvitationFacts | null> {
  const { rows } = await tx.query<ParticipationRow>(
    `SELECT ${PARTICIPATION_COLUMNS}
     FROM case_participants
     WHERE id=$1
       AND family_id=$2
       AND person_id=$3
       AND state='PENDING'
       AND invite_expires_at > now()`,
    [participationId, targetFamilyId, targetPersonId]
  );
  const row=rows[0];
  if (!row) return null;
  return {
    participationId: row.id,
    targetPersonId: row.person_id,
    targetFamilyId: row.family_id,
    expiresAt: row.invite_expires_at.toISOString(),
  };
}
