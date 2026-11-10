import { describe, expect, it } from 'vitest';
import {
  deriveParticipationInviteToken,
  hashParticipationInviteToken,
} from '../../packages/domain/src/participants.js';
import {
  participationInviteSnapshot,
  rehydrateParticipationInviteReplay,
} from '../../apps/server/api/src/idempotency.js';

const secret='s'.repeat(32);
const id='11111111-1111-7111-8111-111111111111';
const base={
  participationId:id,
  caseId:'22222222-2222-7222-8222-222222222222',
  personId:'33333333-3333-7333-8333-333333333333',
  state:'PENDING' as const,
  inviteToken:'bearer-secret',
  expiresAt:'2026-11-10T00:00:00.000Z',
  createdAt:'2026-11-09T00:00:00.000Z',
};

describe('Slice 4 participation bearer token and replay redaction', () => {
  it('derives deterministic HMAC-SHA256 base64url token from the frozen domain separator', () => {
    const token=deriveParticipationInviteToken(secret,id);
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(token).toBe(deriveParticipationInviteToken(secret,id));
    expect(token).not.toContain(id);
    expect(deriveParticipationInviteToken(secret,id)).not.toBe(
      deriveParticipationInviteToken(secret,'44444444-4444-7444-8444-444444444444')
    );
  });

  it('fails closed on a short secret', () => {
    expect(()=>deriveParticipationInviteToken('too-short',id)).toThrow(
      'PARTICIPATION_INVITE_TOKEN_SECRET_TOO_SHORT'
    );
  });

  it('stores only lowercase SHA-256 hex of the bearer token', () => {
    const token=deriveParticipationInviteToken(secret,id);
    expect(hashParticipationInviteToken(token)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('redacts token plaintext from the persisted idempotency response snapshot', () => {
    const snapshot=participationInviteSnapshot({status:201,body:base}) as Record<string,unknown>;
    expect(snapshot.inviteToken).toBeUndefined();
    expect(JSON.stringify(snapshot)).not.toContain(base.inviteToken);
    expect(snapshot.participationId).toBe(id);
  });

  it('same-key replay deterministically rehydrates the same bearer token from participationId', () => {
    const snapshot=participationInviteSnapshot({status:201,body:base});
    const replay=rehydrateParticipationInviteReplay(
      {action:'REPLAY',status:201,body:snapshot},
      secret
    );
    expect((replay.body as any).inviteToken).toBe(
      deriveParticipationInviteToken(secret,id)
    );
    expect(JSON.stringify(snapshot)).not.toContain((replay.body as any).inviteToken);
  });
});
