/**
 * Evidence Core public route: POST /api/v1/cases/:id/messages.
 *
 * This is the only new public route in Slice 3. It stores the raw Case message
 * and never creates an Assertion / Observation / case_event / AI job.
 *
 * Frozen order (plan.md D-7/D-8, contracts/security-idempotency.md §6–§7):
 *   authenticate → strict body parse → Idempotency-Key header → current Family
 *   → RLS-scoped Case load + Case authorization preflight → canonical hash
 *   → shared idempotent command (BEGIN → family context → lock → second lookup
 *   → re-read/re-authorize → INSERT message → INSERT audit → snapshot → COMMIT).
 *
 * Replay must never happen before the current specific-Case authorization: the
 * preflight therefore runs before `runIdempotentCommand`, whose internal peek
 * would otherwise answer a stored 201 first.
 */

import type { FastifyInstance, FastifyReply } from 'fastify';
import type pg from 'pg';
import { z } from 'zod';
import {
  CreateCaseMessageRequest,
  CaseMessageResponse,
  ErrorSchema,
} from '@xiaoshuyin/contracts';
import {
  buildCaseMessageRequestHash,
  getCaseById,
} from '@xiaoshuyin/domain';
// AUD-II-001: explicit package-internal seam. This module is NOT exported from
// the production package entrypoint, keeping the Evidence public writer surface
// at exactly the four frozen writers.
import { recordDialogueMessage } from '@xiaoshuyin/domain/src/internal/message-writer.js';
import { withIdentityTransaction, withRlsTransaction, setFamilyContext } from '../db/tx.js';
import { requireCurrentFamily } from '../family-context.js';
import {
  readIdempotencyKey,
  runIdempotentCommand,
  sendCommandOutcome,
} from '../idempotency.js';
import { requireFamilyAction } from '../authz.js';
import { toHttpError } from '../plugins/error-handler.js';

const PURPOSE = 'FAMILY_MANAGEMENT' as const;
const COMMAND = 'CASE_MESSAGE_CREATE' as const;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The path parameter carries the frozen `format: uuid` for documentation but is
 * not a validation gate: a malformed id must converge to the uniform
 * anti-enumeration `404 CASE_NOT_FOUND`.
 */
const CaseIdParams = z.object({
  id: z.string().meta({ format: 'uuid' }),
});

const BEARER_SECURITY = [{ bearerAuth: [] }];

function caseNotFound(): Error & { statusCode: number; code: string } {
  return Object.assign(new Error('Case not found'), {
    statusCode: 404,
    code: 'CASE_NOT_FOUND',
  });
}

function validationError(): Error & { statusCode: number; code: string } {
  const base = toHttpError('VALIDATION_ERROR', 'Invalid request body');
  return Object.assign(new Error(base.message), {
    statusCode: base.statusCode,
    code: base.code,
  });
}

interface CaseContext {
  accountId: string;
  personId: string;
  familyId: string;
  caseId: string;
}

/**
 * RLS-scoped Case existence + approved Case-management authorization.
 * Every failure is the same 404 body (anti-enumeration).
 */
async function requireAuthorizedCase(tx: pg.PoolClient, ctx: CaseContext): Promise<void> {
  try {
    await requireFamilyAction(tx, {
      accountId: ctx.accountId,
      personId: ctx.personId,
      familyId: ctx.familyId,
      action: 'CASE_READ',
      purpose: PURPOSE,
      resource: { type: 'CASE', familyId: ctx.familyId, caseId: ctx.caseId },
      caseId: ctx.caseId,
    });
  } catch {
    throw caseNotFound();
  }

  if (!UUID_PATTERN.test(ctx.caseId)) throw caseNotFound();
  const found = await getCaseById(tx, ctx.caseId);
  if (!found) throw caseNotFound();
}

export function registerMessageRoutes(app: FastifyInstance, pool: pg.Pool) {
  app.post(
    '/api/v1/cases/:id/messages',
    {
      exposeHeadRoute: false,
      // Authentication precedes schema validation (frozen order step 0).
      onRequest: app.authenticate,
      schema: {
        operationId: 'createCaseMessage',
        summary: 'Record one raw dialogue message for an authorized Case',
        tags: ['case'],
        security: BEARER_SECURITY,
        params: CaseIdParams,
        body: CreateCaseMessageRequest,
        response: {
          201: CaseMessageResponse,
          401: ErrorSchema,
          404: ErrorSchema,
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
      const caseId = (req.params as { id: string }).id;

      // Strict contract: only `content`; whitespace-only is not a message.
      const parsed = CreateCaseMessageRequest.safeParse(req.body ?? {});
      if (!parsed.success || parsed.data.content.trim().length === 0) {
        const err = validationError();
        return reply.status(err.statusCode).send({ code: err.code, message: err.message });
      }
      const content = parsed.data.content;

      // Transport header (never a body field), 8..128 characters.
      const idempotencyKey = readIdempotencyKey(req);

      // Current Family resolution (Slice 1 semantics, no new error codes).
      const familyId = await withIdentityTransaction(
        pool,
        { accountId, purpose: PURPOSE },
        (tx) => requireCurrentFamily(tx, personId)
      );

      const ctx: CaseContext = { accountId, personId, familyId, caseId };
      const requestHash = buildCaseMessageRequestHash({ familyId, caseId, content });

      try {
        // Authorization preflight BEFORE any replay fast path.
        await withRlsTransaction(
          pool,
          { familyId, accountId, personId, purpose: PURPOSE },
          (tx) => requireAuthorizedCase(tx, ctx)
        );

        const outcome = await runIdempotentCommand(
          pool,
          {
            accountId,
            personId,
            purpose: PURPOSE,
            commandType: COMMAND,
            idempotencyKey,
            requestHash,
          },
          async (tx) => {
            // Re-establish context inside the command transaction and revalidate
            // (context drift between preflight and write must fail closed).
            try {
              await setFamilyContext(tx, familyId, personId, PURPOSE);
              await requireAuthorizedCase(tx, ctx);
            } catch (err: any) {
              if (err?.code === 'CASE_NOT_FOUND' || err?.code === '42501') {
                throw caseNotFound();
              }
              throw err;
            }

            // AUD-II-001: use the public domain message writer; the raw
            // repository insert is package-internal. Message + audit stay in
            // this transaction, and audit metadata remains `{}`.
            const message = await recordDialogueMessage(
              tx,
              {
                familyId,
                caseId,
                actorAccountId: accountId,
                actorPersonId: personId,
              },
              content
            );

            return {
              status: 201,
              body: {
                id: message.id,
                caseId,
                recordedAt: message.recordedAt.toISOString(),
              },
            };
          }
        );

        return sendCommandOutcome(reply, outcome);
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
}