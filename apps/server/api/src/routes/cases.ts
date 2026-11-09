/**
 * Case Core routes: POST /api/v1/cases, GET /api/v1/cases, GET /api/v1/cases/:id.
 *
 * Frozen sequence (contracts/authorization-rls-and-idempotency.md §6):
 *   auth → current Family → withRlsTransaction → read creator → authorize
 *   → idempotency reserve/replay/mismatch → Family FOR UPDATE
 *   → independent EXISTS(primary) → case → case_event → business_audit_event
 *   → idempotency fill → COMMIT.
 *
 * Authentication runs in route-level `onRequest` so it precedes content
 * parsing and schema validation (D-4 step 0). GET routes disable Fastify's
 * implicit HEAD exposure, keeping the surface at exactly the three frozen
 * operations.
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
  SwitchPrimaryCaseRequest,
  SwitchPrimaryCaseResponse,
  ErrorSchema,
} from '@xiaoshuyin/contracts';
import {
  hashPayload,
  decideIdempotency,
  caseIdempotencyKeyBytes,
  isLegacyTextLookupSafe,
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
  acquireIdempotencySlot,
  decideSwitchPrimary,
  lockCasesForSwitchPrimary,
  demotePrimaryCase,
  promotePrimaryCase,
  insertPrimaryAssignedEvent,
  insertPrimaryRevokedEvent,
  insertPrimarySwitchAudit,
  type CaseRow,
} from '@xiaoshuyin/domain';
import { withIdentityTransaction, withRlsTransaction } from '../db/tx.js';
import { requireCurrentFamily } from '../family-context.js';
import { readIdempotencyKey } from '../idempotency.js';
import { isKnownAuthorizationDenial, requireFamilyAction } from '../authz.js';
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
      // Idempotency-Key is a transport header, never a body field.
      const logicalKey = readIdempotencyKey(req);
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
            try {
              await requireFamilyAction(tx, {
                accountId,
                personId,
                familyId,
                action: 'CASE_CREATE',
                purpose: 'FAMILY_MANAGEMENT',
                resource: { type: 'FAMILY', familyId },
              });
            } catch (err) {
              // Only an explicit business denial (denyToError) maps to the
              // frozen 403. Unknown infrastructure failures — PostgreSQL
              // 57014 / 42501, connection loss, unexpected error — MUST
              // propagate so the global handler answers generic 500 and the
              // redacted unexpected-error log runs.
              if (!isKnownAuthorizationDenial(err)) throw err;
              // Family resolved but actor is not the V1 management subject.
              throw httpError('CASE_ACCESS_DENIED', 'Case access denied');
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
              if (replay.action !== 'REPLAY') {
                // A committed placeholder (0) is impossible in this
                // transaction model; treat it as a real invariant failure.
                throw httpError('INTERNAL_ERROR', 'Incomplete idempotency record');
              }
              // The frozen CASE_CREATE persisted completion contract is
              // `201 + CaseResponse` only. Any other stored status (0, 200,
              // 409, 500, …) is corrupted state and must never be replayed.
              if (replay.responseStatus !== 201) {
                throw httpError('INTERNAL_ERROR', 'Invalid idempotency completion status');
              }
              // Never trust a stored body blindly: a polluted 201 body must not
              // reach the client.
              const storedBody = CaseResponse.safeParse(replay.responseBody);
              if (!storedBody.success) {
                throw httpError('INTERNAL_ERROR', 'Invalid idempotency completion body');
              }
              return {
                kind: 'REPLAY' as const,
                status: 201,
                body: storedBody.data,
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
        // 4xx keep their frozen contract body; anything 5xx is rethrown so the
        // single generic INTERNAL_ERROR contract in errorHandler answers.
        if (err?.statusCode && err.statusCode < 500) {
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
            try {
              await requireFamilyAction(tx, {
                accountId,
                personId,
                familyId,
                action: 'CASE_LIST',
                purpose: 'FAMILY_MANAGEMENT',
                resource: { type: 'FAMILY', familyId },
              });
            } catch (err) {
              // Only an explicit business denial (denyToError) maps to the
              // frozen 403. Unknown infrastructure failures propagate to the
              // generic 500 handler.
              if (!isKnownAuthorizationDenial(err)) throw err;
              // Family resolved but actor is not the V1 management subject.
              throw httpError('CASE_ACCESS_DENIED', 'Case access denied');
            }

            const rows = await listCases(tx, familyId);
            return { items: rows.map(toCaseResponse) };
          }
        );
        return reply.status(200).send(result);
      } catch (err: any) {
        // 4xx keep their frozen contract body; anything 5xx is rethrown so the
        // single generic INTERNAL_ERROR contract in errorHandler answers.
        if (err?.statusCode && err.statusCode < 500) {
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
            try {
              await requireFamilyAction(tx, {
                accountId,
                personId,
                familyId,
                action: 'CASE_READ',
                purpose: 'FAMILY_MANAGEMENT',
                resource: { type: 'CASE', familyId, caseId },
                caseId,
              });
            } catch (err) {
              // Only an explicit business denial maps to the anti-enumeration
              // 404. Unknown infrastructure failures must not be reported as
              // "Case not found": they propagate to the generic 500 handler.
              if (!isKnownAuthorizationDenial(err)) throw err;
              // Anti-enumeration: "no access", "malformed id" and "does not
              // exist" are the same 404 body.
              throw httpError('CASE_NOT_FOUND', 'Case not found');
            }

            // A malformed id can never match a real row; RLS already limits
            // visibility to this Family.
            if (!UUID_PATTERN.test(caseId)) {
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
        // 4xx keep their frozen contract body; anything 5xx is rethrown so the
        // single generic INTERNAL_ERROR contract in errorHandler answers.
        if (err?.statusCode && err.statusCode < 500) {
          return reply.status(err.statusCode).send({ code: err.code, message: err.message });
        }
        throw err;
      }
    }
  );

  // ── POST /api/v1/cases/:id/switch-primary ────────────────
  app.post(
    '/api/v1/cases/:id/switch-primary',
    {
      onRequest: app.authenticate,
      schema: {
        operationId: 'switchPrimaryCase',
        summary: 'Switch the current primary Case',
        tags: CASE_TAG,
        security: BEARER_SECURITY,
        params: CaseIdParams,
        body: SwitchPrimaryCaseRequest,
        response: {
          200: SwitchPrimaryCaseResponse,
          401: ErrorSchema,
          404: CaseDetailNotFound,
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
      const rawCaseId = (req.params as { id: string }).id;

      // Idempotency-Key is a transport header, never a body field (G10/R-11).
      const logicalKey = readIdempotencyKey(req);
      const keyBytes = caseIdempotencyKeyBytes(logicalKey);

      // Strict schema decides 422 before any state read, so a shape error can
      // never be masked by a stale-view 409 (Acceptance 13).
      const parsed = SwitchPrimaryCaseRequest.safeParse(req.body ?? {});
      if (!parsed.success) {
        return reply.status(422).send({
          code: 'VALIDATION_ERROR',
          message: 'Invalid request body',
        });
      }

      // UUIDs compare lower-case in the view and in the canonical hash.
      const caseId = rawCaseId.toLowerCase();
      const expectedCaseId = parsed.data.expectedPrimaryCaseId?.toLowerCase() ?? null;

      const familyId = await withIdentityTransaction(
        pool,
        { accountId, purpose: 'FAMILY_MANAGEMENT' },
        (tx) => requireCurrentFamily(tx, personId)
      );

      const requestHash = hashPayload({
        familyId,
        targetCaseId: caseId,
        reason: parsed.data.reason,
        expectedPrimaryCaseId: expectedCaseId,
        expectedPrimaryVersion: parsed.data.expectedPrimaryVersion,
      });

      try {
        const result = await withRlsTransaction(
          pool,
          { familyId, accountId, personId, purpose: 'FAMILY_MANAGEMENT' },
          async (tx) => {
            try {
              await requireFamilyAction(tx, {
                accountId,
                personId,
                familyId,
                action: 'CASE_SWITCH_PRIMARY',
                purpose: 'FAMILY_MANAGEMENT',
                resource: { type: 'CASE', familyId, caseId },
                caseId,
              });
            } catch (err) {
              // Explicit denial and unknown infrastructure failures are
              // classified exactly like GET /cases/:id.
              if (!isKnownAuthorizationDenial(err)) throw err;
              throw httpError('CASE_NOT_FOUND', 'Case not found');
            }

            // A malformed id can never match a real row (D-4 detail 4).
            if (!UUID_PATTERN.test(caseId)) {
              throw httpError('CASE_NOT_FOUND', 'Case not found');
            }

            // Slot acquisition precedes every state read: a concurrent replay
            // must observe the original outcome, not the rewritten world.
            const slot = await acquireIdempotencySlot(tx, {
              actorAccountId: accountId,
              commandType: 'CASE_SWITCH_PRIMARY',
              keyBytes,
              requestHash,
            });
            if (slot.kind === 'REPLAY') {
              return { status: slot.status, body: slot.body };
            }
            if (slot.kind === 'MISMATCH') {
              throw httpError(
                'IDEMPOTENCY_PAYLOAD_MISMATCH',
                'Idempotency payload mismatch'
              );
            }
            if (slot.kind === 'POISONED' || slot.kind === 'CONTENTION') {
              throw httpError('INTERNAL_ERROR', 'Idempotency slot unavailable');
            }

            const locked = await lockFamilyForPrimaryDecision(tx, familyId);
            if (!locked) throw httpError('INTERNAL_ERROR', 'Family not visible');

            // Plan D-3.3: current + target Case rows are locked by ONE
            // deterministic statement (`id = ANY(...) ORDER BY id FOR UPDATE`).
            // Never re-introduce two unordered row locks here: a future
            // command locking the same pair in the opposite order would form
            // a lock cycle.
            const snapshot = await lockCasesForSwitchPrimary(tx, {
              familyId,
              targetCaseId: caseId,
            });
            if (snapshot.currentCount > 1) {
              throw httpError('INTERNAL_ERROR', 'Multiple open primaries');
            }
            const current = snapshot.current;
            const target = snapshot.target;
            if (!target) throw httpError('CASE_NOT_FOUND', 'Case not found');

            const decision = decideSwitchPrimary({
              current: current
                ? { caseId: current.id, status: current.status, version: current.version }
                : null,
              target: { caseId: target.id, status: target.status, version: target.version },
              expected: {
                caseId: expectedCaseId,
                version: parsed.data.expectedPrimaryVersion,
              },
            });
            if (decision.kind === 'DENY') throw httpError(decision.code);

            let demoted: CaseRow | null = null;
            if (decision.demote !== null) {
              demoted = await demotePrimaryCase(tx, decision.demote.caseId);
            }
            const promoted = await promotePrimaryCase(tx, decision.promote.caseId);

            if (demoted !== null) {
              await insertPrimaryRevokedEvent(tx, {
                familyId,
                caseId: demoted.id,
                actorAccountId: accountId,
                version: demoted.version,
                newPrimaryCaseId: promoted.id,
                reason: parsed.data.reason,
              });
            }
            await insertPrimaryAssignedEvent(tx, {
              familyId,
              caseId: promoted.id,
              actorAccountId: accountId,
              version: promoted.version,
              previousPrimaryCaseId: demoted?.id ?? null,
              reason: parsed.data.reason,
            });
            await insertPrimarySwitchAudit(tx, {
              familyId,
              targetCaseId: promoted.id,
              actorAccountId: accountId,
              previousPrimaryCaseId: demoted?.id ?? null,
              newPrimaryCaseId: promoted.id,
              // Versions are the real post-UPDATE `RETURNING` values; the
              // promotion branch keeps the nullable previous-primary semantics.
              previousVersion: demoted?.version ?? null,
              newVersion: promoted.version,
              reason: parsed.data.reason,
            });

            const body = {
              primary: toCaseResponse(promoted),
              previousPrimary: demoted === null ? null : toCaseResponse(demoted),
              switchedAt: new Date(promoted.updated_at).toISOString(),
            };

            await completeIdempotency(tx, {
              actorAccountId: accountId,
              commandType: 'CASE_SWITCH_PRIMARY',
              keyBytes,
              status: 200,
              body,
            });

            return { status: 200, body };
          }
        );
        return reply.status(result.status).send(result.body);
      } catch (err: any) {
        if (err?.statusCode && err.statusCode < 500) {
          return reply.status(err.statusCode).send({ code: err.code, message: err.message });
        }
        throw err;
      }
    }
  );
}
