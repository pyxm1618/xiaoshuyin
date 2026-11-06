/**
 * Auth plugin: verifies session token, attaches actor to request.
 * Uses transaction-bound GUC to avoid pool reuse leakage (FR-013).
 *
 * The authentication work is exposed as a reusable `authenticate` hook so a
 * route that must authenticate BEFORE schema validation (Case Core, plan D-4
 * step 0) can run it in `preValidation` without duplicating the logic. The
 * global `preHandler` keeps the Slice 1 behaviour and skips the work when the
 * actor is already resolved.
 */

import type { FastifyInstance, FastifyRequest } from 'fastify';
import { verifyToken } from '../auth/session-token.js';
import type pg from 'pg';

declare module 'fastify' {
  interface FastifyRequest {
    actor: {
      accountId: string;
      personId: string | null;
    } | null;
  }

  interface FastifyInstance {
    authenticate: (req: FastifyRequest) => Promise<void>;
  }
}

const PUBLIC_PATHS = new Set(['/healthz', '/api/v1/auth/wechat']);

export function createAuthenticate(pool: pg.Pool, sessionSecret: string) {
  return async function authenticate(req: FastifyRequest): Promise<void> {
    if (req.actor) return;

    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw Object.assign(new Error('Missing authorization'), {
        statusCode: 401,
        code: 'UNAUTHENTICATED',
      });
    }

    const token = authHeader.slice(7);
    const payload = verifyToken(token, sessionSecret, -1);
    if (!payload) {
      throw Object.assign(new Error('Invalid token'), {
        statusCode: 401,
        code: 'UNAUTHENTICATED',
      });
    }

    // Use a transaction to set context and query safely (FR-013)
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // Set account context (transaction-bound)
      await client.query(`SELECT set_config('app.account_id', $1, true)`, [payload.accountId]);
      await client.query(`SELECT set_config('app.purpose', 'SELF_IDENTITY', true)`);

      // Get account and verify epoch
      const { rows: accounts } = await client.query(
        'SELECT id, session_epoch FROM accounts WHERE id = $1',
        [payload.accountId]
      );
      if (accounts.length === 0 || accounts[0].session_epoch !== payload.epoch) {
        await client.query('ROLLBACK');
        throw Object.assign(new Error('Invalid session'), {
          statusCode: 401,
          code: 'UNAUTHENTICATED',
        });
      }

      // Get personId (RLS: account_id = app_account_id())
      const { rows: personRows } = await client.query(
        'SELECT id FROM persons WHERE account_id = $1',
        [payload.accountId]
      );

      await client.query('COMMIT');

      req.actor = {
        accountId: payload.accountId,
        personId: personRows[0]?.id ?? null,
      };
    } catch (err) {
      try { await client.query('ROLLBACK'); } catch {}
      throw err;
    } finally {
      client.release();
    }
  };
}

export function registerAuthPlugin(app: FastifyInstance, pool: pg.Pool, sessionSecret: string) {
  app.decorateRequest('actor', null);

  const authenticate = createAuthenticate(pool, sessionSecret);
  app.decorate('authenticate', authenticate);

  app.addHook('preHandler', async (req: FastifyRequest) => {
    if (PUBLIC_PATHS.has(req.url)) return;
    await authenticate(req);
  });
}
