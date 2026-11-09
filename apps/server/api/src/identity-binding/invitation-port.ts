/**
 * Slice 4 consumer port.
 *
 * Slice 006 never owns invitation lifecycle. It consumes only:
 *   - VALID (pending, unexpired, token usable) + target Person + target Family
 *   - TERMINAL_UNUSABLE (not found / expired / declined / withdrawn / accepted
 *     / invalidated)
 *
 * The production adapter is BLOCKED BY SLICE 4 RUNTIME (T121). The in-memory
 * fixture below is contract-level only and MUST NOT be used as a second
 * invitation model in production.
 */

import type pg from 'pg';

export type InvitationResolution =
  | {
      status: 'VALID';
      participationId: string;
      targetPersonId: string;
      targetFamilyId: string;
      expiresAt: string;
    }
  | { status: 'TERMINAL_UNUSABLE' };

export interface InvitationResolutionPort {
  resolveByToken(tx: pg.PoolClient, invitationToken: string): Promise<InvitationResolution>;
  /**
   * Gate 2 rechecks invitation validity at commit time. The token is never
   * stored (only its hash / resolution facts), so the same Slice 4 fact source
   * is queried by participation id. This is NOT a second invitation model.
   */
  resolveByParticipationId(
    tx: pg.PoolClient,
    participationId: string
  ): Promise<InvitationResolution>;
}

/** Fail-closed default until the real Slice 4 runtime adapter exists (T121). */
export class UnavailableInvitationPort implements InvitationResolutionPort {
  async resolveByToken(): Promise<InvitationResolution> {
    return { status: 'TERMINAL_UNUSABLE' };
  }
  async resolveByParticipationId(): Promise<InvitationResolution> {
    return { status: 'TERMINAL_UNUSABLE' };
  }
}

/** Contract-level fixture for domain / runtime tests only. */
export class InMemoryInvitationPort implements InvitationResolutionPort {
  private readonly byToken = new Map<string, InvitationResolution>();

  add(token: string, resolution: InvitationResolution): void {
    this.byToken.set(token, resolution);
  }

  remove(token: string): void {
    this.byToken.delete(token);
  }

  async resolveByToken(_tx: pg.PoolClient, invitationToken: string): Promise<InvitationResolution> {
    return this.byToken.get(invitationToken) ?? { status: 'TERMINAL_UNUSABLE' };
  }

  async resolveByParticipationId(
    _tx: pg.PoolClient,
    participationId: string
  ): Promise<InvitationResolution> {
    for (const resolution of this.byToken.values()) {
      if (resolution.status === 'VALID' && resolution.participationId === participationId) {
        return resolution;
      }
    }
    return { status: 'TERMINAL_UNUSABLE' };
  }
}