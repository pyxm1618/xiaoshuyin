import { describe, it, expect } from 'vitest';
import {
  InMemoryInvitationPort,
  UnavailableInvitationPort,
} from '../../apps/server/api/src/identity-binding/invitation-port.js';

describe('Slice 4 invitation consumer port', () => {
  it('contract fixture resolves VALID and unknown tokens are TERMINAL_UNUSABLE', async () => {
    const port = new InMemoryInvitationPort();
    port.add('token-1', {
      status: 'VALID',
      participationId: 'part-1',
      targetPersonId: 'p1',
      targetFamilyId: 'fam-1',
      expiresAt: '2026-01-01T01:00:00.000Z',
    });
    await expect(port.resolveByToken({} as never, 'token-1')).resolves.toMatchObject({
      status: 'VALID',
      targetPersonId: 'p1',
    });
    await expect(port.resolveByToken({} as never, 'nope')).resolves.toEqual({
      status: 'TERMINAL_UNUSABLE',
    });
  });

  it('Gate 2 can re-resolve the same fact source by participation id', async () => {
    const port = new InMemoryInvitationPort();
    port.add('token-1', {
      status: 'VALID',
      participationId: 'part-1',
      targetPersonId: 'p1',
      targetFamilyId: 'fam-1',
      expiresAt: '2026-01-01T01:00:00.000Z',
    });
    await expect(
      port.resolveByParticipationId({} as never, 'part-1')
    ).resolves.toMatchObject({ status: 'VALID', participationId: 'part-1' });
    await expect(
      port.resolveByParticipationId({} as never, 'part-2')
    ).resolves.toEqual({ status: 'TERMINAL_UNUSABLE' });
  });

  it('unavailable production port is fail-closed (no fake invitation)', async () => {
    const port = new UnavailableInvitationPort();
    await expect(port.resolveByToken({} as never, 'any')).resolves.toEqual({
      status: 'TERMINAL_UNUSABLE',
    });
    await expect(
      port.resolveByParticipationId({} as never, 'any')
    ).resolves.toEqual({ status: 'TERMINAL_UNUSABLE' });
  });

  it('expired / consumed / withdrawn are represented by TERMINAL_UNUSABLE only', async () => {
    const port = new InMemoryInvitationPort();
    port.add('expired', { status: 'TERMINAL_UNUSABLE' });
    port.add('withdrawn', { status: 'TERMINAL_UNUSABLE' });
    for (const token of ['expired', 'withdrawn']) {
      await expect(port.resolveByToken({} as never, token)).resolves.toEqual({
        status: 'TERMINAL_UNUSABLE',
      });
    }
  });
});