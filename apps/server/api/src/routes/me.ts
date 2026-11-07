/**
 * GET /api/v1/me — identity self-read.
 * Data access via packages/domain repository (guard R4).
 */

import type { FastifyInstance } from 'fastify';
import { withIdentityTransaction } from '../db/tx.js';
import { toHttpError } from '../plugins/error-handler.js';
import { requireSelfAction } from '../authz.js';
import { getAccountById, getPersonWithProfile, getProfileValues } from '@xiaoshuyin/domain';
import type pg from 'pg';

export function registerMeRoutes(app: FastifyInstance, pool: pg.Pool) {
  app.get('/api/v1/me', async (req, reply) => {
    const actor = req.actor;
    if (!actor?.accountId || !actor.personId) {
      const err = toHttpError('UNAUTHENTICATED');
      return reply.status(err.statusCode).send(err);
    }

    // FR-011: identity self-read also passes through the unified entry point.
    requireSelfAction(actor.accountId, actor.personId, 'SELF_IDENTITY');

    const result = await withIdentityTransaction(
      pool,
      { accountId: actor.accountId, purpose: 'SELF_IDENTITY' },
      async (tx) => {
        const account = await getAccountById(tx, actor.accountId);
        const person = await getPersonWithProfile(tx, actor.accountId);

        let values: any[] = [];
        if (person) {
          const vals = await getProfileValues(tx, person.id);
          values = vals.map((v: any) => ({
            attribute: v.attribute,
            valueText: v.value_text,
            sourceKind: v.source_kind,
            status: v.status,
          }));
        }

        return { account, person, values };
      }
    );

    return reply.status(200).send({
      account: {
        id: result.account.id,
        createdAt: result.account.created_at,
        lastLoginAt: result.account.last_login_at,
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
