/**
 * T121 — Production InvitationResolutionPort backed by Slice 4 runtime.
 *
 * Slice 4 Case Participant Core is the single truth for invitation /
 * participation lifecycle. This adapter only resolves facts:
 *   - token hash -> Slice 4 `case_participants` under its token RLS policy
 *   - participation id + binding target context -> Slice 4 pending invitation
 *
 * It never creates invitations, never writes participation state, and never
 * implements accept / decline / withdraw. Binding COMMITTED is not
 * participation acceptance; Slice 4 still requires an explicit accept.
 */

import type pg from 'pg';
import {
  getBindingInvitationByTokenHash,
  getBindingInvitationByTrustedTarget,
  hashParticipationInviteToken,
  type BindingInvitationFacts,
} from '@xiaoshuyin/domain';
import type {
  InvitationResolution,
  InvitationResolutionPort,
} from './invitation-port.js';

const TERMINAL: InvitationResolution = { status: 'TERMINAL_UNUSABLE' };

function toResolution(facts: BindingInvitationFacts | null): InvitationResolution {
  return facts
    ? {
        status: 'VALID',
        participationId: facts.participationId,
        targetPersonId: facts.targetPersonId,
        targetFamilyId: facts.targetFamilyId,
        expiresAt: facts.expiresAt,
      }
    : TERMINAL;
}

/**
 * Slice 4's public invitation lookup rejects tokens outside 1..256 bytes.
 * Issued tokens are fixed-length base64url values; a longer value can never
 * resolve to a stored hash, so fail closed without touching the DB.
 */
function isPlausibleToken(token: string): boolean {
  return token.length >= 1 && token.length <= 256;
}

/**
 * Resolve invitation facts inside the caller's existing transaction. The
 * caller is Slice 5 bootstrap (Gate 1) or commit (Gate 2); opening a second
 * transaction or caching a snapshot would defeat the frozen D-16 contract.
 */
export class Slice4InvitationPort implements InvitationResolutionPort {
  async resolveByToken(
    tx: pg.PoolClient,
    invitationToken: string
  ): Promise<InvitationResolution> {
    if (!isPlausibleToken(invitationToken)) return TERMINAL;

    const tokenHash = hashParticipationInviteToken(invitationToken);
    const previous = await readSetting(tx, 'app.invite_token_hash');
    try {
      // Slice 4 RLS exposes the row only while the exact token hash is the
      // transaction's invite credential. Restore it immediately afterwards so
      // the binding transaction never carries widened participation reads.
      await tx.query('SELECT app.set_invite_token_context($1)', [tokenHash]);
      return toResolution(await getBindingInvitationByTokenHash(tx, tokenHash));
    } finally {
      await restoreSetting(tx, 'app.invite_token_hash', previous);
    }
  }

  async resolveByParticipationId(
    tx: pg.PoolClient,
    participationId: string
  ): Promise<InvitationResolution> {
    // Gate 2 already locked the binding target facts. Read them from the same
    // binding GUCs instead of trusting any client-provided family / person.
    const context = (
      await tx.query<{ person_id: string | null; family_id: string | null }>(
        `SELECT app_binding_target_person_id()::text AS person_id,
                app_binding_target_family_id()::text AS family_id`
      )
    ).rows[0];
    if (!context?.person_id || !context.family_id) return TERMINAL;

    const previous = (
      await tx.query<{ family_id: string; person_id: string; purpose: string }>(
        `SELECT COALESCE(current_setting('app.family_id', true), '') AS family_id,
                COALESCE(current_setting('app.person_id', true), '') AS person_id,
                COALESCE(current_setting('app.purpose', true), '') AS purpose`
      )
    ).rows[0] ?? { family_id: '', person_id: '', purpose: '' };

    try {
      // Slice 4's participation read policy is family-scoped; bind the target
      // family / person for exactly this fact lookup.
      await tx.query('SELECT app.set_family_context($1, $2, $3)', [
        context.family_id,
        context.person_id,
        'IDENTITY_BINDING',
      ]);
      return toResolution(
        await getBindingInvitationByTrustedTarget(
          tx,
          participationId,
          context.family_id,
          context.person_id
        )
      );
    } finally {
      await tx.query(
        `SELECT set_config('app.family_id', $1, true),
                set_config('app.person_id', $2, true),
                set_config('app.purpose', $3, true)`,
        [previous.family_id, previous.person_id, previous.purpose]
      );
    }
  }
}

async function readSetting(tx: pg.PoolClient, name: string): Promise<string> {
  const { rows } = await tx.query<{ value: string }>(
    `SELECT COALESCE(current_setting($1, true), '') AS value`,
    [name]
  );
  return rows[0]?.value ?? '';
}

async function restoreSetting(
  tx: pg.PoolClient,
  name: string,
  value: string
): Promise<void> {
  await tx.query('SELECT set_config($1, $2, true)', [name, value]);
}