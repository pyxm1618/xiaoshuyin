/**
 * GET /api/v1/me — identity self-read.
 * Data access via packages/domain repository (guard R4).
 *
 * Frozen OpenAPI `MeResponse`:
 *   { account: { id, createdAt, status }, person: PersonSummary }
 */

import type { FastifyInstance } from 'fastify';
import { withIdentityTransaction } from '../db/tx.js';
import { toHttpError } from '../plugins/error-handler.js';
import { requireSelfAction } from '../authz.js';
import {
  getAccountById,
  getPersonWithProfile,
  getProfileValuesFull,
} from '@xiaoshuyin/domain';
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
          const vals = await getProfileValuesFull(tx, person.id);
          values = vals.map((v: any) => ({
            id: v.id,
            attribute: v.attribute,
            value: v.value_text,
            source: v.source_kind,
            providedByPersonId: v.provided_by_person_id,
            observedAt: v.observed_at ? v.observed_at.toISOString() : null,
            recordedAt: v.recorded_at.toISOString(),
            status: v.status,
            supersedesId: v.supersedes_id,
          }));
        }

        return { account, person, values };
      }
    );

    if (!result.account) {
      const err = toHttpError('UNAUTHENTICATED');
      return reply.status(err.statusCode).send(err);
    }

    return reply.status(200).send({
      account: {
        id: result.account.id,
        createdAt: result.account.created_at.toISOString(),
        status: result.account.status,
      },
      person: {
        id: result.person.id,
        createdAt: result.person.created_at.toISOString(),
        accountBound: true,
        ...(result.person.age_band
          ? {
              profile: {
                ageBand: result.person.age_band,
                minorMode: result.person.minor_mode,
                guardianPersonId: result.person.guardian_person_id,
                guardianConsentVersion: result.person.guardian_consent_version,
                verifiedSource: result.person.verified_source,
                effectiveAt: result.person.effective_at.toISOString(),
              },
            }
          : {}),
        values: result.values,
      },
    });
  });
}