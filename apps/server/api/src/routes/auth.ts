/**
 * Auth routes: POST /api/v1/auth/wechat, POST /api/v1/auth/logout.
 * Login: code → openid → Account → Person (same transaction).
 * Logout: session_epoch + 1, invalidating all prior tokens.
 *
 * Frozen OpenAPI contract:
 *   - login always responds 200 with `{ accountId, sessionToken, expiresAt, person }`
 *   - logout responds 204 with no body
 */

import type { FastifyInstance } from 'fastify';
import { WechatLoginRequest } from '@xiaoshuyin/contracts';
import type { WechatAuthProvider } from '../auth/wechat-provider.js';
import { signToken } from '../auth/session-token.js';
import { isAccountAuthorityEligible } from '../auth/account-authority.js';
import { createOrReuseAccount } from '../auth/binding-account.js';
import { toHttpError } from '../plugins/error-handler.js';
import { withAccountTransaction } from '../db/tx.js';
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
      await client.query(`SELECT set_config('app.purpose', 'SELF_IDENTITY', true)`);
      await client.query('SELECT app.set_account_openid_context($1)', [openid]);

      // Reuse the identity-binding Account owner instead of a second
      // SELECT-none -> INSERT implementation. ON CONFLICT serializes concurrent
      // first-login creation and then re-reads the one authoritative Account.
      const { account, inserted } = await createOrReuseAccount(client, openid, false);
      const accountId = account.id;
      if (!isAccountAuthorityEligible({ status: account.status })) {
        const err = toHttpError('UNAUTHENTICATED');
        throw Object.assign(new Error(err.message), err);
      }

      await client.query('SELECT app.set_account_context($1, $2)', [
        accountId,
        'SELF_IDENTITY',
      ]);

      let epoch: number;
      let personId: string;
      let personCreatedAt: Date;

      if (inserted) {
        epoch = account.sessionEpoch;
        const { rows: newPerson } = await client.query(
          `INSERT INTO persons (account_id, created_by_account_id)
           VALUES ($1, $1)
           RETURNING id, created_at`,
          [accountId]
        );
        personId = newPerson[0].id;
        personCreatedAt = newPerson[0].created_at;
      } else {
        // Issuance linearization point: after the authoritative conflict re-read,
        // establish exact Account context and acquire the row lock through this
        // conditional UPDATE. This preserves hard-disable without requiring the
        // pre-context OpenID lookup itself to hold UPDATE authority.
        const { rows: updated } = await client.query(
          `UPDATE accounts
              SET last_login_at = now(), session_epoch = session_epoch + 1
            WHERE id = $1 AND status = 'ACTIVE'
            RETURNING session_epoch`,
          [accountId]
        );
        if (!updated[0]) {
          const err = toHttpError('UNAUTHENTICATED');
          throw Object.assign(new Error(err.message), err);
        }
        epoch = updated[0].session_epoch;

        const { rows: persons } = await client.query(
          'SELECT id, created_at FROM persons WHERE account_id = $1',
          [accountId]
        );
        if (!persons[0]) {
          // A reused Account without its one Person is genuine integrity
          // corruption. Do not "repair" it by silently creating new identity.
          throw Object.assign(new Error('Person missing for existing account'), {
            statusCode: 500,
            code: 'INTERNAL_ERROR',
          });
        }
        personId = persons[0].id;
        personCreatedAt = persons[0].created_at;
      }

      await client.query('COMMIT');

      // Sign token
      const expiresAtSeconds = Math.floor(Date.now() / 1000) + 86400;
      const token = signToken(
        {
          accountId,
          epoch,
          exp: expiresAtSeconds,
        },
        sessionSecret
      );

      return reply.status(200).send({
        accountId,
        sessionToken: token,
        expiresAt: new Date(expiresAtSeconds * 1000).toISOString(),
        person: {
          id: personId,
          createdAt: personCreatedAt.toISOString(),
          accountBound: true,
        },
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

    // Bump epoch to invalidate all tokens under the authenticated Account RLS subject.
    await withAccountTransaction(
      pool,
      { accountId: actor.accountId, purpose: 'SELF_IDENTITY' },
      async (tx) => {
        await tx.query(
          'UPDATE accounts SET session_epoch = session_epoch + 1 WHERE id = $1',
          [actor.accountId]
        );
      }
    );

    return reply.status(204).send();
  });
}