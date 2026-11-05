/**
 * Auth routes: POST /api/v1/auth/wechat, POST /api/v1/auth/logout.
 * Login: code → openid → Account → Person (same transaction).
 * Logout: session_epoch + 1, invalidating all prior tokens.
 */

import type { FastifyInstance } from 'fastify';
import { WechatLoginRequest } from '@xiaoshuyin/contracts';
import type { WechatAuthProvider } from '../auth/wechat-provider.js';
import { signToken } from '../auth/session-token.js';
import { toHttpError } from '../plugins/error-handler.js';
import type pg from 'pg';

export function registerAuthRoutes(
  app: FastifyInstance,
  pool: pg.Pool,
  wechatProvider: WechatAuthProvider,
  sessionSecret: string
) {
  app.post('/api/v1/auth/wechat', async (req, reply) => {
    const parsed = WechatLoginRequest.safeParse(req.body);
    if (!parsed.success) {
      const err = toHttpError('VALIDATION_ERROR', 'Invalid request body');
      return reply.status(err.statusCode).send(err);
    }

    const { code } = parsed.data;
    const { openid } = await wechatProvider.code2session(code);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Check if account exists
      const { rows: existing } = await client.query(
        'SELECT id FROM accounts WHERE wechat_openid = $1',
        [openid]
      );

      let accountId: string;
      let epoch: number;
      let personId: string | null;
      let isNew = false;

      if (existing.length > 0) {
        accountId = existing[0].id;
        // Bump epoch for new session
        await client.query(
          'UPDATE accounts SET last_login_at = now(), session_epoch = session_epoch + 1 WHERE id = $1',
          [accountId]
        );
        const { rows: updated } = await client.query(
          'SELECT session_epoch FROM accounts WHERE id = $1',
          [accountId]
        );
        epoch = updated[0].session_epoch;

        // Set account context for RLS before querying persons
        await client.query(`SELECT set_config('app.account_id', $1, true)`, [accountId]);
        await client.query(`SELECT set_config('app.purpose', 'SELF_IDENTITY', true)`);

        // Find existing person
        const { rows: persons } = await client.query(
          'SELECT id FROM persons WHERE account_id = $1',
          [accountId]
        );
        personId = persons[0]?.id ?? null;
      } else {
        isNew = true;
        // Create new account
        const { rows: newAccount } = await client.query(
          `INSERT INTO accounts (wechat_openid, session_epoch) VALUES ($1, 0) RETURNING id`,
          [openid]
        );
        accountId = newAccount[0].id;
        epoch = 0;

        // Set account context for person creation (use set_config directly since this is the bootstrap path)
        await client.query(`SELECT set_config('app.account_id', $1, true)`, [accountId]);
        await client.query(`SELECT set_config('app.purpose', 'SELF_IDENTITY', true)`);

        // Create person
        const { rows: newPerson } = await client.query(
          `INSERT INTO persons (account_id, created_by_account_id) VALUES ($1, $1) RETURNING id`,
          [accountId]
        );
        personId = newPerson[0].id;
      }

      await client.query('COMMIT');

      // Sign token
      const token = signToken(
        {
          accountId,
          epoch,
          exp: Math.floor(Date.now() / 1000) + 86400,
        },
        sessionSecret
      );

      return reply.status(isNew ? 201 : 200).send({
        account: { id: accountId },
        person: {
          id: personId,
          profile: null,
          values: [],
        },
        token,
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  });

  app.post('/api/v1/auth/logout', async (req, reply) => {
    const actor = (req as any).actor;
    if (!actor?.accountId) {
      const err = toHttpError('UNAUTHENTICATED');
      return reply.status(err.statusCode).send(err);
    }

    // Bump epoch to invalidate all tokens
    await pool.query(
      'UPDATE accounts SET session_epoch = session_epoch + 1 WHERE id = $1',
      [actor.accountId]
    );

    return reply.status(200).send({ success: true });
  });
}
