/**
 * Production bridge from Slice 006 identity binding to the authoritative
 * Slice 4 participation runtime. It does not own invitation lifecycle.
 */
import type pg from 'pg';
import {
  getBindingInvitationByTokenHash,
  getBindingInvitationByTrustedTarget,
  hashParticipationInviteToken,
} from '@xiaoshuyin/domain';
import { setFamilyContext, setInviteTokenContext } from '../db/tx.js';
import type {
  InvitationResolution,
  InvitationResolutionPort,
} from './invitation-port.js';

function valid(
  row: {
    participationId: string;
    targetPersonId: string;
    targetFamilyId: string;
    expiresAt: string;
  } | null
): InvitationResolution {
  return row ? { status: 'VALID', ...row } : { status: 'TERMINAL_UNUSABLE' };
}

export class Slice4InvitationAdapter implements InvitationResolutionPort {
  async resolveByToken(
    tx: pg.PoolClient,
    invitationToken: string
  ): Promise<InvitationResolution> {
    if (invitationToken.length < 1 || invitationToken.length > 256) {
      return { status: 'TERMINAL_UNUSABLE' };
    }
    const tokenHash = hashParticipationInviteToken(invitationToken);
    await setInviteTokenContext(tx, tokenHash);
    return valid(await getBindingInvitationByTokenHash(tx, tokenHash));
  }

  async resolveByParticipationId(
    tx: pg.PoolClient,
    participationId: string
  ): Promise<InvitationResolution> {
    const { rows } = await tx.query<{
      target_person_id: string | null;
      target_family_id: string | null;
    }>(
      \`SELECT
         app_binding_target_person_id()::text AS target_person_id,
         app_binding_target_family_id()::text AS target_family_id\`
    );
    const context = rows[0];
    if (!context?.target_person_id || !context.target_family_id) {
      return { status: 'TERMINAL_UNUSABLE' };
    }

    // Gate 2 supplied these facts from the locked authoritative attempt.
    // Establish family RLS only from those trusted server-side values.
    await setFamilyContext(
      tx,
      context.target_family_id,
      context.target_person_id,
      'IDENTITY_BINDING'
    );
    return valid(
      await getBindingInvitationByTrustedTarget(
        tx,
        participationId,
        context.target_family_id,
        context.target_person_id
      )
    );
  }
}
