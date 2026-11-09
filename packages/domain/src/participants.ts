/**
 * Slice 4 Case Participant Core.
 *
 * This module owns the participation lifecycle vocabulary and, in later
 * implementation phases, all SQL touching case_participants. Identity binding
 * remains owned by Slice 5; participation only consumes the authenticated
 * actor.personId result.
 */

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
