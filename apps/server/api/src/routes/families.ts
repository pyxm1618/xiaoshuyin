/**
 * Family routes: POST /api/v1/families, GET /api/v1/families/current.
 * Data access via packages/domain repository (guard R4).
 *
 * Frozen OpenAPI is the source of truth for request/response shapes and the
 * `Idempotency-Key` header.
 */

import type { FastifyInstance } from 'fastify';
import { CreateFamilyRequest } from '@xiaoshuyin/contracts';
import { withIdentityTransaction, setFamilyContext } from '../db/tx.js';
import { readIdempotencyKey, runIdempotentCommand, sendCommandOutcome } from '../idempotency.js';
import { toHttpError } from '../plugins/error-handler.js';
import {
  hashPayload,
  checkSourceAcceptability,
  resolveProvenanceProvider,
  insertFamilyMember,
  insertProfileValue,
  supersedeProfileValue,
  getProfileValuesBySource,
  insertAuditEvent,
  isFamilyMember,
  createFamily,
  generateUuidv7,
  getFamilyByIdFull,
  countFamilyMembers,
} from '@xiaoshuyin/domain';
import { resolveCurrentFamily } from '../family-context.js';
import { requireFamilyAction } from '../authz.js';
import { insertComplianceProfile } from '@xiaoshuyin/compliance';
import type pg from 'pg';

export function registerFamilyRoutes(app: FastifyInstance, pool: pg.Pool) {
  app.post('/api/v1/families', async (req, reply) => {
    const actor = req.actor;
    const accountId = actor?.accountId;
    const personId = actor?.personId;
    if (!accountId || !personId) {
      const err = toHttpError('UNAUTHENTICATED');
      return reply.status(err.statusCode).send(err);
    }

    const parsed = CreateFamilyRequest.safeParse(req.body);
    if (!parsed.success) {
      const err = toHttpError('VALIDATION_ERROR', 'Invalid request body');
      return reply.status(err.statusCode).send(err);
    }

    const { displayName, creator } = parsed.data;
    const idempotencyKey = readIdempotencyKey(req);
    const requestHash = hashPayload({ displayName, creator });

    try {
      const outcome = await runIdempotentCommand(
        pool,
        {
          accountId,
          personId,
          purpose: 'FAMILY_MANAGEMENT',
          commandType: 'FAMILY_CREATE',
          idempotencyKey,
          requestHash,
        },
        async (tx) => {
          // UUIDv7 comes from PostgreSQL 18, never from crypto.randomUUID().
          const newFamilyId = await generateUuidv7(tx);

          // Persist the real family row first so authorize() reads a real fact.
          await createFamily(tx, newFamilyId, personId, displayName ?? null);

          // FR-011 / §9: family creation goes through the unified entry point.
          const decision = await requireFamilyAction(tx, {
            accountId,
            personId,
            familyId: newFamilyId,
            action: 'FAMILY_CREATE',
            purpose: 'FAMILY_MANAGEMENT',
            resource: { type: 'FAMILY', familyId: newFamilyId },
          });

          // Creator MUST be ADULT + SELF_STATEMENT (CHK023 / T046).
          const sourceError = checkSourceAcceptability(
            'FAMILY_CREATE',
            creator.ageBand,
            creator.ageBandSource
          );
          if (sourceError) {
            throw Object.assign(new Error(sourceError), {
              statusCode: toHttpError(sourceError).statusCode,
              code: sourceError,
            });
          }

          await insertFamilyMember(tx, newFamilyId, personId);
          await insertComplianceProfile(tx, personId, 'ADULT', false, 'SELF_STATEMENT');

          for (const pv of creator.values ?? []) {
            // Subject of the creator's own values is the creator themself.
            const resolution = resolveProvenanceProvider({
              sourceKind: pv.source,
              subjectPersonId: personId,
              actorPersonId: personId,
              providedByPersonId: pv.providedByPersonId ?? null,
            });
            if (resolution.kind === 'INVALID') {
              throw Object.assign(new Error('Provenance provider not allowed'), {
                statusCode: 422,
                code: 'AGE_BAND_SOURCE_NOT_ALLOWED',
              });
            }
            if (resolution.kind === 'CANDIDATE') {
              const inFamily = await isFamilyMember(tx, newFamilyId, resolution.provider);
              if (!inFamily) {
                throw Object.assign(new Error('Provenance provider is not a family member'), {
                  statusCode: 422,
                  code: 'AGE_BAND_SOURCE_NOT_ALLOWED',
                });
              }
            }

            // F9: at most one RECORDED per (person, attribute, source).
            const existing = await getProfileValuesBySource(
              tx, personId, pv.attribute, pv.source
            );
            for (const ex of existing) {
              await supersedeProfileValue(tx, ex.id);
            }

            // F8: observedAt is preserved exactly when supplied; NULL otherwise.
            await insertProfileValue(
              tx,
              personId,
              pv.attribute,
              pv.value,
              pv.source,
              resolution.provider,
              accountId,
              existing[0]?.id ?? null,
              pv.observedAt ? new Date(pv.observedAt) : null
            );
          }

          await insertAuditEvent(tx, newFamilyId, accountId, 'FAMILY_CREATED', 'FAMILY', newFamilyId);

          const row = await getFamilyByIdFull(tx, newFamilyId);
          const memberCount = await countFamilyMembers(tx, newFamilyId);

          return {
            status: 201,
            body: {
              id: newFamilyId,
              displayName: displayName ?? null,
              createdAt: row.created_at.toISOString(),
              isManager: decision.basis.manager,
              memberCount,
            },
          };
        }
      );

      return sendCommandOutcome(reply, outcome);
    } catch (err: any) {
      if (err.statusCode) {
        return reply.status(err.statusCode).send({ code: err.code, message: err.message });
      }
      if (err.code === '23505') {
        const e = toHttpError('FAMILY_ALREADY_OWNED');
        return reply.status(e.statusCode).send(e);
      }
      throw err;
    }
  });

  app.get('/api/v1/families/current', async (req, reply) => {
    const actor = req.actor;
    const accountId = actor?.accountId;
    const personId = actor?.personId;
    if (!accountId || !personId) {
      const err = toHttpError('UNAUTHENTICATED');
      return reply.status(err.statusCode).send(err);
    }

    // §4.4: identity → resolve → authorize → set_family_context → target read,
    // all in ONE transaction.
    const resolution = await withIdentityTransaction(
      pool,
      { accountId, purpose: 'FAMILY_MANAGEMENT' },
      async (tx) => {
        const current = await resolveCurrentFamily(tx, personId);
        if (current.status !== 'RESOLVED') return current;

        // FR-011: no family-scoped read bypasses authorize(); isManager is the
        // decision basis, never recomputed from the row downstream.
        const decision = await requireFamilyAction(tx, {
          accountId,
          personId,
          familyId: current.family.id,
          action: 'FAMILY_READ',
          purpose: 'FAMILY_MANAGEMENT',
          resource: { type: 'FAMILY', familyId: current.family.id },
        });

        await setFamilyContext(tx, current.family.id, personId, 'FAMILY_MANAGEMENT');

        const family = await getFamilyByIdFull(tx, current.family.id);
        const memberCount = await countFamilyMembers(tx, current.family.id);

        return { ...current, family, manager: decision.basis.manager, memberCount };
      }
    );

    if (resolution.status === 'NONE') {
      const err = toHttpError('CURRENT_FAMILY_NOT_FOUND');
      return reply.status(err.statusCode).send(err);
    }

    if (resolution.status === 'AMBIGUOUS') {
      const err = toHttpError('CURRENT_FAMILY_AMBIGUOUS');
      return reply.status(err.statusCode).send(err);
    }

    const family = resolution.family;

    return reply.status(200).send({
      id: family.id,
      displayName: family.display_name,
      createdAt: family.created_at.toISOString(),
      isManager: resolution.manager,
      memberCount: resolution.memberCount,
    });
  });
}