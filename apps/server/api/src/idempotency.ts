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
 * Data access stays in packages/** (guard R4); this module only orchestrates.
 */

import type { FastifyReply } from 'fastify';
import pg from 'pg';
import {
  decideIdempotency,
  getIdempotencyKey,
  insertIdempotencyKey,
  lockIdempotencyKey,
  type IdempotencyCommandType,
} from '@xiaoshuyin/domain';
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
  /** Resolved inside the transaction, only on the EXECUTE path. */
  resolveFamilyId?: (tx: pg.PoolClient) => Promise<string | null>;
  /** FAMILY_CREATE only: create the family row before the business callback. */
  createFamily?: { newFamilyId: string; displayName: string | null };
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
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT app.set_identity_context($1, $2)', [cfg.accountId, 'SELF_IDENTITY']);
    const existing = await getIdempotencyKey(
      client, cfg.accountId, cfg.commandType, cfg.idempotencyKey
    );
    await client.query('COMMIT');
    return decide(existing, cfg.requestHash);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function runIdempotentCommand(
  pool: pg.Pool,
  cfg: IdempotentCommandConfig,
  fn: (tx: pg.PoolClient) => Promise<CommandResponse>
): Promise<CommandOutcome> {
  const early = await peekIdempotency(pool, cfg);
  if (early) return early;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT app.set_identity_context($1, $2)', [cfg.accountId, cfg.purpose]);

    // Serialize same-key commands BEFORE the second lookup.
    await lockIdempotencyKey(client, cfg.accountId, cfg.commandType, cfg.idempotencyKey);

    // Re-check under the lock: a concurrent request may have committed already.
    const existing = await getIdempotencyKey(
      client, cfg.accountId, cfg.commandType, cfg.idempotencyKey
    );
    const decision = decide(existing, cfg.requestHash);
    if (decision) {
      await client.query('COMMIT');
      return decision;
    }

    if (cfg.resolveFamilyId) {
      const familyId = await cfg.resolveFamilyId(client);
      if (familyId) {
        await client.query('SELECT app.set_family_context($1, $2, $3)', [
          familyId, cfg.personId, cfg.purpose,
        ]);
      }
    }

    if (cfg.createFamily) {
      await client.query('SELECT app.create_family($1, $2, $3)', [
        cfg.createFamily.newFamilyId, cfg.personId, cfg.createFamily.displayName,
      ]);
    }

    const response = await fn(client);

    await insertIdempotencyKey(
      client,
      cfg.accountId,
      cfg.commandType,
      cfg.idempotencyKey,
      cfg.requestHash,
      response.status,
      JSON.stringify(response.body)
    );

    await client.query('COMMIT');
    return { action: 'EXECUTED', status: response.status, body: response.body };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export function sendCommandOutcome(reply: FastifyReply, outcome: CommandOutcome) {
  if (outcome.action === 'MISMATCH') {
    const err = toHttpError('IDEMPOTENCY_PAYLOAD_MISMATCH');
    return reply.status(err.statusCode).send(err);
  }
  return reply.status(outcome.status).send(outcome.body);
}
