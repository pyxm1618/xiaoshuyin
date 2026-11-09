import { describe, expect, it } from 'vitest';
import {
  AcceptParticipationRequest,
  CaseParticipationState,
  CreateParticipationInviteRequest,
  CreateParticipationInviteResponse,
  DeclineParticipationRequest,
  ParticipationInvitePublicView,
  ParticipationResource,
  WithdrawParticipationRequest,
} from '../../packages/contracts/src/schemas.js';

const PERSON_ID = '11111111-1111-7111-8111-111111111111';
const CASE_ID = '22222222-2222-7222-8222-222222222222';
const PARTICIPATION_ID = '33333333-3333-7333-8333-333333333333';
const IDEM = 'participant-key-0001';
const TS = '2026-11-09T00:00:00.000Z';

describe('Slice 4 participation contracts', () => {
  it('freezes the participation state vocabulary', () => {
    expect(CaseParticipationState.options).toEqual([
      'PENDING', 'ACTIVE', 'DECLINED', 'EXPIRED', 'WITHDRAWN',
    ]);
  });

  it('create invite request is strict and client cannot control scope/state/token/ttl', () => {
    expect(CreateParticipationInviteRequest.parse({
      personId: PERSON_ID,
      idempotencyKey: IDEM,
    })).toEqual({ personId: PERSON_ID, idempotencyKey: IDEM });

    for (const extra of [
      { familyId: PERSON_ID },
      { caseId: CASE_ID },
      { state: 'PENDING' },
      { expiresAt: TS },
      { inviteToken: 'secret' },
      { guardianPersonId: PERSON_ID },
      { consentId: PERSON_ID },
      { role: 'CHILD' },
    ]) {
      expect(CreateParticipationInviteRequest.safeParse({
        personId: PERSON_ID,
        idempotencyKey: IDEM,
        ...extra,
      }).success).toBe(false);
    }
  });

  it('accept/decline/withdraw bodies contain only idempotencyKey', () => {
    for (const schema of [
      AcceptParticipationRequest,
      DeclineParticipationRequest,
      WithdrawParticipationRequest,
    ]) {
      expect(schema.parse({ idempotencyKey: IDEM })).toEqual({ idempotencyKey: IDEM });
      expect(schema.safeParse({ idempotencyKey: IDEM, familyId: PERSON_ID }).success).toBe(false);
      expect(schema.safeParse({}).success).toBe(false);
    }
  });

  it('create response alone may carry inviteToken', () => {
    const created = CreateParticipationInviteResponse.parse({
      participationId: PARTICIPATION_ID,
      caseId: CASE_ID,
      personId: PERSON_ID,
      state: 'PENDING',
      inviteToken: 'opaque-token',
      expiresAt: TS,
      createdAt: TS,
    });
    expect(created.inviteToken).toBe('opaque-token');

    const resource = {
      id: PARTICIPATION_ID,
      caseId: CASE_ID,
      personId: PERSON_ID,
      state: 'ACTIVE',
      createdAt: TS,
      acceptedAt: TS,
      declinedAt: null,
      expiredAt: null,
      withdrawnAt: null,
    };
    expect(ParticipationResource.safeParse(resource).success).toBe(true);
    expect(ParticipationResource.safeParse({ ...resource, inviteToken: 'secret' }).success).toBe(false);
    expect(ParticipationResource.safeParse({ ...resource, inviteTokenHash: 'a'.repeat(64) }).success).toBe(false);
    expect(ParticipationResource.safeParse({ ...resource, familyId: PERSON_ID }).success).toBe(false);
  });

  it('public invite view leaks no target/case/family identity', () => {
    const view = {
      participationId: PARTICIPATION_ID,
      state: 'PENDING',
      expiresAt: TS,
      notice: {
        version: 'participation-notice-v1',
        title: '参与邀请',
        body: 'generic',
      },
    };
    expect(ParticipationInvitePublicView.safeParse(view).success).toBe(true);
    for (const extra of [
      { personId: PERSON_ID },
      { caseId: CASE_ID },
      { familyId: PERSON_ID },
      { ageBand: 'UNDER_14' },
      { guardianPersonId: PERSON_ID },
      { consentId: PERSON_ID },
    ]) {
      expect(ParticipationInvitePublicView.safeParse({ ...view, ...extra }).success).toBe(false);
    }
  });
});
