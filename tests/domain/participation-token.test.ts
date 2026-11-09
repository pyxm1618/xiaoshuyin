import { describe, expect, it } from 'vitest';
import {
  deriveParticipationInviteToken,
  hashParticipationInviteToken,
} from '../../packages/domain/src/participants.js';

const secret='s'.repeat(32);
const id='11111111-1111-7111-8111-111111111111';

describe('Slice 4 invitation token', () => {
  it('is deterministic HMAC-SHA256 base64url over the frozen domain separator', () => {
    const first=deriveParticipationInviteToken(secret,id);
    const second=deriveParticipationInviteToken(secret,id);
    expect(first).toBe(second);
    expect(first).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(first).not.toContain(id);
  });

  it('changes with participation id or secret', () => {
    expect(deriveParticipationInviteToken(secret,id)).not.toBe(
      deriveParticipationInviteToken(secret,'22222222-2222-7222-8222-222222222222')
    );
    expect(deriveParticipationInviteToken(secret,id)).not.toBe(
      deriveParticipationInviteToken('t'.repeat(32),id)
    );
  });

  it('stores only SHA-256 hex of the bearer token', () => {
    const token=deriveParticipationInviteToken(secret,id);
    const hash=hashParticipationInviteToken(token);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain(token);
  });
});
