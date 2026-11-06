/**
 * Case Core routes: POST /api/v1/cases, GET /api/v1/cases, GET /api/v1/cases/:id.
 *
 * Frozen sequence (contracts/authorization-rls-and-idempotency.md §6):
 *   auth → current Family → withRlsTransaction → read creator → authorize
 *   → idempotency reserve/replay/mismatch → Family FOR UPDATE
 *   → independent EXISTS(primary) → case → case_event → business_audit_event
 *   → idempotency fill → COMMIT.
 *
 * Authentication runs in `preValidation` so it precedes schema validation
 * (D-4 step 0). GET routes disable Fastify's implicit HEAD exposure, keeping
 * the surface at exactly the three frozen operations.
 *
 * No 23505 handling: the partial unique index is the last line of defence, so
 * a violation is a real failure that must roll the whole transaction back.
 */

import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import {
  CreateCaseRequest,
  CaseResponse,
  CaseListResponse,
  ErrorSchema,
} from '@xiaoshuyin/contracts';
import { authorize } from '@xiaoshuyin/authorization';
import {
  hashPayload,
  decideIdempotency,
  caseIdempotencyKeyBytes,
  isLegacyTextLookupSafe,
  getFamilyById,
  insertCase,
  insertCaseEvent,
  insertCaseAudit,
  listCases,
  getCaseById,
  lockFamilyForPrimaryDecision,
  existsCurrentPrimary,
  reserveIdempotency,
  getReservedIdempotency,
  completeIdempotency,
  type CaseRow,
} from '@xiaoshuyin/domain';
import { withIdentityTransaction, withRlsTransaction } from '../db/tx.js';
import { requireCurrentFamily } from '../family-context.js';
import { toHttpError } from '../plugins/error-handler.js';
import type pg from 'pg';

const CASE_COMMAND = 'CASE_CREATE' as const;

/**
 * Path parameter carries the frozen `format: uuid` for documentation, but is
 * NOT used as a validation gate: a malformed id must converge to the uniform
 * `404 CASE_NOT_FOUND` instead of a contract-external 422.
 */
const CaseIdParams = z.object({
  id: z.string().meta({ format: 'uuid' }),
});

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CaseNotFoundError = z.strictObject({
  code: z.literal('CASE_NOT_FOUND'),
  message: z.string(),
});

const CaseAccessDeniedError = z.strictObject({
  code: z.literal('CASE_ACCESS_DENIED'),
  message: z.string(),
});

const CurrentFamilyNotFoundError = z.strictObject({
  code: z.literal('CURRENT_FAMILY_NOT_FOUND'),
  message: z.string(),
});

const CurrentFamilyAmbiguousError = z.strictObject({
  code: z.literal('CURRENT_FAMILY_AMBIGUOUS'),
  message: z.string(),
});

const CaseDetailNotFound = z.union([CaseNotFoundError, CurrentFamilyNotFoundError]);

const BEARER_SECURITY = [{ bearerAuth: [] }];
const CASE_TAG = ['case'];

function httpError(code: string, message?: string): Error & { statusCode: number; code: string } {
  const base = toHttpError(code, message);
  return Object.assign(new Error(base.message), { statusCode: base.statusCode, code: base.code });
}

function toCaseResponse(row: CaseRow) {
  return {
    id: row.id,
    status: row.status,
    phase: row.phase,
    primary: row.is_primary,
    version: row.version,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

export function registerCaseRoutes(app: FastifyInstance, pool: pg.Pool) {
  // ── POST /api/v1/cases ───────────────────────────────────
  app.post(
    '/api/v1/cases',
    {
      // Authentication precedes schema validation (D-4 step 0).
      onRequest: app.authenticate,
      schema: {
        operationId: 'createCase',
        summary: 'Create a Case container',
        tags: CASE_TAG,
        security: BEARER_SECURITY,
        body: CreateCaseRequest,
        response: {
          201: CaseResponse,
          401: ErrorSchema,
          403: CaseAccessDeniedError,
          404: CurrentFamilyNotFoundError,
          409: ErrorSchema,
          422: ErrorSchema,
          500: ErrorSchema,
        },
      },
    },
    async (req, reply: FastifyReply) => {
      const actor = req.actor;
      if (!actor?.accountId || !actor.personId) {
        const err = toHttpError('UNAUTHENTICATED');
        return reply.status(err.statusCode).send(err);
      }
      const accountId = actor.accountId;
      const personId = actor.personId;

      // Strict contract: reject undeclared fields before any DB work.
      const parsed = CreateCaseRequest.safeParse(req.body ?? {});
      if (!parsed.success) {
        const err = toHttpError('VALIDATION_ERROR', 'Invalid request body');
        return reply.status(err.statusCode).send(err);
      }
      const logicalKey = parsed.data.idempotencyKey;
      const keyBytes = caseIdempotencyKeyBytes(logicalKey);
      // The legacy text column can only be queried for keys PostgreSQL can
      // receive as text; the exact byte identity is always queried.
      const legacyKeyText = isLegacyTextLookupSafe(logicalKey) ? logicalKey : null;

      // 1. Resolve the current target Family (Slice 1 semantics, no new codes).
      const familyId = await withIdentityTransaction(
        pool,
        { accountId, purpose: 'FAMILY_MANAGEMENT' },
        (tx) => requireCurrentFamily(tx, personId)
      );

      // Canonical command context: the verified Family id participates in the
      // hash but is never a client field.
      const requestHash = hashPayload({ familyId, body: {} });

      try {
        const outcome = await withRlsTransaction(
          pool,
          { familyId, accountId, personId, purpose: 'FAMILY_MANAGEMENT' },
          async (tx) => {
            const family = await getFamilyById(tx, familyId);
            const decision = authorize({
              actor: { accountId, personId },
              product: 'V1',
              family: {
                familyId,
                ...(family?.created_by_person_id
                  ? { createdByPersonId: family.created_by_person_id }
                  : {}),
              },
              case: null,
              resource: 'CASE',
              action: 'CASE_CREATE',
              purpose: 'FAMILY_MANAGEMENT',
            });
            if (decision.decision === 'DENY') {
              throw httpError('CASE_ACCESS_DENIED');
            }

            // Idempotency: exact byte identity first, then the legacy raw-text
            // row. REPLAY / MISMATCH never lock the Family row and never write
            // business rows.
            const decideExisting = (
              existing: Awaited<ReturnType<typeof getReservedIdempotency>>
            ) => {
              if (!existing) {
                throw httpError('INTERNAL_ERROR', 'Idempotency record not visible');
              }
              // Shared contract: no second mismatch predicate in the route.
              const replay = decideIdempotency(
                {
                  requestHash: existing.request_hash,
                  responseStatus: existing.response_status,
                  responseBody: existing.response_body,
                },
                requestHash
              );
              if (replay.action === 'MISMATCH') {
                return { kind: 'MISMATCH' as const };
              }
              if (replay.action !== 'REPLAY' || replay.responseStatus === 0) {
                // A committed placeholder is impossible in this transaction
                // model; treat it as a real invariant failure, not a success.
                throw httpError('INTERNAL_ERROR', 'Incomplete idempotency record');
              }
              return {
                kind: 'REPLAY' as const,
                status: replay.responseStatus,
                body: replay.responseBody,
              };
            };

            const existing = await getReservedIdempotency(tx, {
              actorAccountId: accountId,
              commandType: CASE_COMMAND,
              keyBytes,
              legacyKeyText,
            });
            if (existing) return decideExisting(existing);

            const reserved = await reserveIdempotency(tx, {
              actorAccountId: accountId,
              commandType: CASE_COMMAND,
              keyBytes,
              requestHash,
            });

            if (!reserved) {
              // A concurrent transaction owns the same exact scope key.
              const concurrent = await getReservedIdempotency(tx, {
                actorAccountId: accountId,
                commandType: CASE_COMMAND,
                keyBytes,
                legacyKeyText,
              });
              return decideExisting(concurrent);
            }

            // Family serialization point for primary assignment.
            await lockFamilyForPrimaryDecision(tx, familyId);
            const hasPrimary = await existsCurrentPrimary(tx, familyId);

            const row = await insertCase(tx, {
              familyId,
              createdByPersonId: personId,
              isPrimary: !hasPrimary,
            });

            await insertCaseEvent(tx, {
              familyId,
              caseId: row.id,
              actorAccountId: accountId,
              primary: row.is_primary,
              version: row.version,
            });

            await insertCaseAudit(tx, {
              familyId,
              caseId: row.id,
              actorAccountId: accountId,
              primary: row.is_primary,
              version: row.version,
            });

            const body = toCaseResponse(row);
            await completeIdempotency(tx, {
              actorAccountId: accountId,
              commandType: CASE_COMMAND,
              keyBytes,
              status: 201,
              body,
            });

            return { kind: 'CREATED' as const, status: 201, body };
          }
        );

        if (outcome.kind === 'MISMATCH') {
          const err = toHttpError('IDEMPOTENCY_PAYLOAD_MISMATCH');
          return reply.status(err.statusCode).send(err);
        }
        return reply.status(outcome.status).send(outcome.body);
      } catch (err: any) {
        if (err?.statusCode) {
          return reply.status(err.statusCode).send({ code: err.code, message: err.message });
        }
        throw err;
      }
    }
  );

  // ── GET /api/v1/cases ────────────────────────────────────
  app.get(
    '/api/v1/cases',
    {
      exposeHeadRoute: false,
      onRequest: app.authenticate,
      schema: {
        operationId: 'listCases',
        summary: 'List the current Family Cases',
        tags: CASE_TAG,
        security: BEARER_SECURITY,
        response: {
          200: CaseListResponse,
          401: ErrorSchema,
          403: CaseAccessDeniedError,
          404: CurrentFamilyNotFoundError,
          409: ErrorSchema,
          500: ErrorSchema,
        },
      },
    },
    async (req, reply: FastifyReply) => {
      const actor = req.actor;
      if (!actor?.accountId || !actor.personId) {
        const err = toHttpError('UNAUTHENTICATED');
        return reply.status(err.statusCode).send(err);
      }
      const accountId = actor.accountId;
      const personId = actor.personId;

      const familyId = await withIdentityTransaction(
        pool,
        { accountId, purpose: 'FAMILY_MANAGEMENT' },
        (tx) => requireCurrentFamily(tx, personId)
      );

      try {
        const result = await withRlsTransaction(
          pool,
          { familyId, accountId, personId, purpose: 'FAMILY_MANAGEMENT' },
          async (tx) => {
            const family = await getFamilyById(tx, familyId);
            const decision = authorize({
              actor: { accountId, personId },
              product: 'V1',
              family: {
                familyId,
                ...(family?.created_by_person_id
                  ? { createdByPersonId: family.created_by_person_id }
                  : {}),
              },
              case: null,
              resource: 'CASE',
              action: 'CASE_LIST',
              purpose: 'FAMILY_MANAGEMENT',
            });
            if (decision.decision === 'DENY') {
              throw httpError('CASE_ACCESS_DENIED');
            }

            const rows = await listCases(tx, familyId);
            return { items: rows.map(toCaseResponse) };
          }
        );
        return reply.status(200).send(result);
      } catch (err: any) {
        if (err?.statusCode) {
          return reply.status(err.statusCode).send({ code: err.code, message: err.message });
        }
        throw err;
      }
    }
  );

  // ── GET /api/v1/cases/:id ────────────────────────────────
  app.get(
    '/api/v1/cases/:id',
    {
      exposeHeadRoute: false,
      onRequest: app.authenticate,
      schema: {
        operationId: 'getCase',
        summary: 'Read a single Case',
        tags: CASE_TAG,
        security: BEARER_SECURITY,
        params: CaseIdParams,
        response: {
          200: CaseResponse,
          401: ErrorSchema,
          404: CaseDetailNotFound,
          409: CurrentFamilyAmbiguousError,
          500: ErrorSchema,
        },
      },
    },
    async (req, reply: FastifyReply) => {
      const actor = req.actor;
      if (!actor?.accountId || !actor.personId) {
        const err = toHttpError('UNAUTHENTICATED');
        return reply.status(err.statusCode).send(err);
      }
      const accountId = actor.accountId;
      const personId = actor.personId;
      const caseId = (req.params as { id: string }).id;

      const familyId = await withIdentityTransaction(
        pool,
        { accountId, purpose: 'FAMILY_MANAGEMENT' },
        (tx) => requireCurrentFamily(tx, personId)
      );

      try {
        const row = await withRlsTransaction(
          pool,
          { familyId, accountId, personId, purpose: 'FAMILY_MANAGEMENT' },
          async (tx) => {
            const family = await getFamilyById(tx, familyId);
            const decision = authorize({
              actor: { accountId, personId },
              product: 'V1',
              family: {
                familyId,
                ...(family?.created_by_person_id
                  ? { createdByPersonId: family.created_by_person_id }
                  : {}),
              },
              case: { caseId },
              resource: 'CASE',
              action: 'CASE_READ',
              purpose: 'FAMILY_MANAGEMENT',
            });

            // Anti-enumeration: "no access", "malformed id" and "does not
            // exist" are the same 404 body. RLS already limits visibility to
            // this Family, and a malformed id can never match a real row.
            if (decision.decision === 'DENY' || !UUID_PATTERN.test(caseId)) {
              throw httpError('CASE_NOT_FOUND', 'Case not found');
            }

            const found = await getCaseById(tx, caseId);
            if (!found) {
              throw httpError('CASE_NOT_FOUND', 'Case not found');
            }
            return toCaseResponse(found);
          }
        );
        return reply.status(200).send(row);
      } catch (err: any) {
        if (err?.statusCode) {
          return reply.status(err.statusCode).send({ code: err.code, message: err.message });
        }
        throw err;
      }
    }
  );
}
