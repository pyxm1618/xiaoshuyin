/**
 * GET /api/v1/me — identity self-read.
 */

import type { FastifyInstance } from 'fastify';
import { withIdentityTransaction } from '../db/tx.js';
import { toHttpError } from '../plugins/error-handler.js';
import type pg from 'pg';

export function registerMeRoutes(app: FastifyInstance, pool: pg.Pool) {
  app.get('/api/v1/me', async (req, reply) => {
    const actor = req.actor;
    if (!actor?.accountId) {
      const err = toHttpError('UNAUTHENTICATED');
      return reply.status(err.statusCode).send(err);
    }

    const result = await withIdentityTransaction(
      pool,
      { accountId: actor.accountId, purpose: 'SELF_IDENTITY' },
      async (tx) => {
        // Get account (without wechat_openid)
        const { rows: accounts } = await tx.query(
          'SELECT id, created_at, last_login_at FROM accounts WHERE id = $1',
          [actor.accountId]
        );

        // Get person with profile
        const { rows: persons } = await tx.query(
          `SELECT p.id, p.created_at,
                  cp.age_band, cp.minor_mode, cp.verified_source
           FROM persons p
           LEFT JOIN person_compliance_profiles cp ON cp.person_id = p.id
           WHERE p.account_id = $1`,
          [actor.accountId]
        );

        const person = persons[0] ?? null;

        let values: any[] = [];
        if (person) {
          const { rows: vals } = await tx.query(
            `SELECT attribute, value_text, source_kind, status
             FROM person_profile_values
             WHERE person_id = $1 AND status = 'RECORDED'`,
            [person.id]
          );
          values = vals.map((v: any) => ({
            attribute: v.attribute,
            valueText: v.value_text,
            sourceKind: v.source_kind,
            status: v.status,
          }));
        }

        return { accounts: accounts[0], person, values };
      }
    );

    return reply.status(200).send({
      account: {
        id: result.accounts.id,
        createdAt: result.accounts.created_at,
        lastLoginAt: result.accounts.last_login_at,
      },
      person: result.person
        ? {
            id: result.person.id,
            profile: result.person.age_band
              ? {
                  ageBand: result.person.age_band,
                  minorMode: result.person.minor_mode,
                  verifiedSource: result.person.verified_source,
                }
              : null,
            values: result.values,
          }
        : null,
    });
  });
}
