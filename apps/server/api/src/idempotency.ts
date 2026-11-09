/**
 * Unified idempotent command orchestration.
 *
 * All six mutating commands (FAMILY_CREATE, MEMBER_CREATE, MEMBER_UPDATE,
 * GUARDIAN_CONSENT_REQUEST, GUARDIAN_CONSENT_GRANT, GUARDIAN_CONSENT_REVOKE)
 * go through this single entry point so that:
 *   - a replay/mismatch is answered BEFORE any business validation runs,
 *   - the idempotency record is written in the SAME transaction as the
 *     business objects (no half-committed command),
 *   - concurrent same-key requests are serialized by a transaction-scoped
 *     advisory lock, so at most one business object can be created.
 *
 * Family context is NOT set here. Per contracts/authorization-and-rls.md §4.4
 * each command runs `resolve → authorize → set_family_context → read/write`
 * inside `fn`, in this same transaction.
 *
 * Data access stays in packages/** (guard R4); this module only orchestrates.
 */

import type { FastifyReply, FastifyRequest } from 'fastify';
import pg from 'pg';
import {
  decideIdempotency,
  getIdempotencyKey,
  insertIdempotencyKey,
  lockIdempotencyKey,
  type IdempotencyCommandType,
  deriveParticipationInviteToken,
} from '@xiaoshuyin/domain';
import { CreateParticipationInviteResponse } from '@xiaoshuyin/contracts';
import { withTransactionClient } from './db/tx.js';
import { toHttpError } from './plugins/error-handler.js';

export interface CommandResponse {
  status: number;
  body: unknown;
}

export type CommandOutcome =
  | { action: 'REPLAY'; status: number; body: unknown }
  | { action: 'MISMATCH' }
  | { action: 'EXECUTED'; status: number; body: unknown };

export interface IdempotentCommandConfig {
  accountId: string;
  personId: string;
  purpose: string;
  commandType: IdempotencyCommandType;
  idempotencyKey: string;
  requestHash: string;
  /** Optional redaction/serialization transform for persisted replay snapshots. */
  persistResponseBody?: (response: CommandResponse) => unknown;
}

const MIN_IDEMPOTENCY_KEY_LENGTH = 8;
const MAX_IDEMPOTENCY_KEY_LENGTH = 128;

/**
 * Frozen OpenAPI contract: `Idempotency-Key` is an HTTP header for all six
 * mutating commands, required, 8..128 characters.
 */
export function readIdempotencyKey(req: FastifyRequest): string {
  const raw = req.headers['idempotency-key'];
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (
    typeof value !== 'string' ||
    value.length < MIN_IDEMPOTENCY_KEY_LENGTH ||
    value.length > MAX_IDEMPOTENCY_KEY_LENGTH
  ) {
    const err = toHttpError('VALIDATION_ERROR', 'Idempotency-Key header is required');
    throw Object.assign(new Error(err.message), err);
  }
  return value;
}

function decide(
  existing: { request_hash: string; response_status: number; response_body: unknown } | null,
  requestHash: string
): CommandOutcome | null {
  const result = decideIdempotency(
    existing
      ? {
          requestHash: existing.request_hash,
          responseStatus: existing.response_status,
          responseBody: existing.response_body,
        }
      : null,
    requestHash
  );

  if (result.action === 'REPLAY') {
    return { action: 'REPLAY', status: result.responseStatus, body: result.responseBody };
  }
  if (result.action === 'MISMATCH') {
    return { action: 'MISMATCH' };
  }
  return null;
}

/**
 * Fast path read-only lookup. Runs before any business validation so a replay
 * is never rejected by state that has changed since the original request
 * (e.g. an already-GRANTED consent request).
 */
async function peekIdempotency(
  pool: pg.Pool,
  cfg: IdempotentCommandConfig
): Promise<CommandOutcome | null> {
  return withTransactionClient(pool, async (client) => {
    await client.query('SELECT app.set_identity_context($1, $2)', [cfg.accountId, 'SELF_IDENTITY']);
    const existing = await getIdempotencyKey(
      client, cfg.accountId, cfg.commandType, cfg.idempotencyKey
    );
    return decide(existing, cfg.requestHash);
  });
}

export async function runIdempotentCommand(
  pool: pg.Pool,
  cfg: IdempotentCommandConfig,
  fn: (tx: pg.PoolClient) => Promise<CommandResponse>
): Promise<CommandOutcome> {
  const early = await peekIdempotency(pool, cfg);
  if (early) return early;

  return withTransactionClient(pool, async (client) => {
    await client.query('SELECT app.set_identity_context($1, $2)', [cfg.accountId, cfg.purpose]);

    // Serialize same-key commands BEFORE the second lookup.
    await lockIdempotencyKey(client, cfg.accountId, cfg.commandType, cfg.idempotencyKey);

    // Re-check under the lock: a concurrent request may have committed already.
    const existing = await getIdempotencyKey(
      client, cfg.accountId, cfg.commandType, cfg.idempotencyKey
    );
    const decision = decide(existing, cfg.requestHash);
    if (decision) return decision;

    const response = await fn(client);

    await insertIdempotencyKey(
      client,
      cfg.accountId,
      cfg.commandType,
      cfg.idempotencyKey,
      cfg.requestHash,
      response.status,
      JSON.stringify(cfg.persistResponseBody ? cfg.persistResponseBody(response) : response.body)
    );

    return { action: 'EXECUTED', status: response.status, body: response.body };
  });
}

export function participationInviteSnapshot(response: CommandResponse): unknown {
  const parsed = CreateParticipationInviteResponse.safeParse(response.body);
  if (!parsed.success) {
    throw Object.assign(new Error('Invalid participation invite response'), {
      statusCode: 500,
      code: 'INTERNAL_ERROR',
    });
  }
  const { inviteToken: _secret, ...snapshot } = parsed.data;
  return snapshot;
}

export function rehydrateParticipationInviteReplay(
  outcome: CommandOutcome,
  secret: string
): CommandOutcome {
  if (outcome.action !== 'REPLAY') return outcome;
  if (
    typeof outcome.body !== 'object' ||
    outcome.body === null ||
    typeof (outcome.body as { participationId?: unknown }).participationId !== 'string'
  ) {
    throw Object.assign(new Error('Invalid participation invite replay snapshot'), {
      statusCode: 500,
      code: 'INTERNAL_ERROR',
    });
  }
  const participationId = (outcome.body as { participationId: string }).participationId;
  const hydrated = CreateParticipationInviteResponse.safeParse({
    ...(outcome.body as Record<string, unknown>),
    inviteToken: deriveParticipationInviteToken(secret, participationId),
  });
  if (!hydrated.success) {
    throw Object.assign(new Error('Invalid participation invite replay snapshot'), {
      statusCode: 500,
      code: 'INTERNAL_ERROR',
    });
  }
  return { ...outcome, body: hydrated.data };
}

export function sendCommandOutcome(reply: FastifyReply, outcome: CommandOutcome) {
  if (outcome.action === 'MISMATCH') {
    const err = toHttpError('IDEMPOTENCY_PAYLOAD_MISMATCH');
    return reply.status(err.statusCode).send(err);
  }
  return reply.status(outcome.status).send(outcome.body);
}