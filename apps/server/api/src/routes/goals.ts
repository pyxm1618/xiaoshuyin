/**
 * Common Core Goal transport.
 *
 * Exactly one public mutation endpoint. The strict operation discriminator is
 * the only SAVE/CONFIRM branch selector.
 */
import type { FastifyInstance, FastifyReply } from 'fastify';
import type pg from 'pg';
import { z } from 'zod';
import {
  ErrorSchema,
  InternalError,
  UnauthenticatedError,
} from '@xiaoshuyin/contracts';
import { withIdentityTransaction } from '../db/tx.js';
import { requireCurrentFamily } from '../family-context.js';
import { readIdempotencyKey } from '../idempotency.js';
import { toHttpError } from '../plugins/error-handler.js';
import { confirmGoal, saveGoal } from '../services/goals.js';

const MAX_INT = 2147483647;
const UUID = z.string().uuid();

const EvidenceRef = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('DIALOGUE_MESSAGE'), id: UUID }),
  z.strictObject({ type: z.literal('ASSERTION'), id: UUID }),
  z.strictObject({ type: z.literal('OBSERVATION'), id: UUID }),
]);

const DependencyRef = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('EVIDENCE'), evidence: EvidenceRef }),
  z.strictObject({
    type: z.literal('CONSENT'),
    id: UUID,
    version: z.number().int().min(1).max(MAX_INT).optional(),
  }),
  z.strictObject({
    type: z.literal('POLICY'),
    key: z.string().min(1).max(200),
    version: z.string().min(1).max(100),
  }),
  z.strictObject({
    type: z.literal('PACKAGE'),
    key: z.string().min(1).max(200),
    version: z.string().min(1).max(100),
  }),
  z.strictObject({
    type: z.literal('CONTENT_VERSION'),
    key: z.string().min(1).max(200),
    version: z.string().min(1).max(100),
  }),
]);

const ParticipantResponsibility = z.strictObject({
  personId: UUID,
  responsibility: z.string().min(1).max(2000),
  evidenceRefs: z.array(EvidenceRef).min(1),
});

export const SaveGoalRequest = z.strictObject({
  operation: z.literal('SAVE'),
  problemFormulationId: UUID,
  problemFormulationVersion: z.number().int().min(1).max(MAX_INT),
  baselineRefs: z.array(EvidenceRef).min(1),
  targetDescription: z.string().min(1).max(4000),
  observationMethod: z.string().min(1).max(4000),
  observationWindow: z.string().min(1).max(2000),
  protectiveConditions: z.array(z.string().min(1).max(2000)).min(1),
  parentActions: z.array(z.string().min(1).max(2000)).min(1),
  reviewPoint: z.string().min(1).max(2000),
  dependencyRefs: z.array(DependencyRef).min(1),
  participantResponsibilities: z.array(ParticipantResponsibility).default([]),
});

export const ConfirmGoalRequest = z.strictObject({
  operation: z.literal('CONFIRM'),
  goalId: UUID,
  goalVersion: z.number().int().min(1).max(MAX_INT),
});

export const GoalMutationRequest = z.discriminatedUnion('operation', [
  SaveGoalRequest,
  ConfirmGoalRequest,
]);

const GoalSaveResponse = z.strictObject({
  operation: z.literal('SAVE'),
  goalId: UUID,
  goalVersion: z.number().int().min(1).max(MAX_INT),
  caseVersion: z.number().int().min(1).max(MAX_INT),
  phase: z.literal('GOALS'),
  confirmationState: z.literal('UNCONFIRMED'),
});

const GoalConfirmResponse = z.strictObject({
  operation: z.literal('CONFIRM'),
  goalId: UUID,
  goalVersion: z.number().int().min(1).max(MAX_INT),
  caseVersion: z.number().int().min(1).max(MAX_INT),
  phase: z.literal('PLANNING'),
  confirmationState: z.literal('CONFIRMED'),
  confirmedBy: UUID,
  confirmedAt: z.iso.datetime(),
});

const CaseIdParams = z.object({ id: UUID });
const BEARER_SECURITY = [{ bearerAuth: [] }];
const CASE_TAG = ['case'];

function httpError(
  code: string,
  message?: string
): Error & { statusCode: number; code: string } {
  const base = toHttpError(code, message);
  return Object.assign(new Error(base.message), {
    statusCode: base.statusCode,
    code: base.code,
  });
}

function readIfMatch(req: { headers: Record<string, unknown> }): number {
  const raw = req.headers['if-match'];
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== 'string') {
    throw httpError('VALIDATION_ERROR', 'If-Match header is required');
  }
  const match = /^"case-v([1-9][0-9]{0,9})"$/.exec(value);
  if (!match) {
    throw httpError('VALIDATION_ERROR', 'If-Match header is malformed');
  }
  const parsed = Number(match[1]);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_INT) {
    throw httpError('VALIDATION_ERROR', 'If-Match version is out of range');
  }
  return parsed;
}

async function resolveFamily(
  pool: pg.Pool,
  accountId: string,
  personId: string
): Promise<string> {
  return withIdentityTransaction(
    pool,
    { accountId, purpose: 'FAMILY_MANAGEMENT' },
    (tx) => requireCurrentFamily(tx, personId)
  );
}

function send(
  reply: FastifyReply,
  result: { status: number; body: unknown; etag: string | null }
) {
  if (result.etag !== null) reply.header('ETag', result.etag);
  return reply.status(result.status).send(result.body);
}

export function registerGoalRoutes(
  app: FastifyInstance,
  pool: pg.Pool
): void {
  app.post(
    '/api/v1/cases/:id/goals',
    {
      onRequest: app.authenticate,
      schema: {
        operationId: 'mutateGoal',
        summary: 'Save or confirm the Common Core Goal',
        tags: CASE_TAG,
        security: BEARER_SECURITY,
        params: CaseIdParams,
        body: GoalMutationRequest,
        response: {
          200: GoalConfirmResponse,
          201: GoalSaveResponse,
          401: UnauthenticatedError,
          404: ErrorSchema,
          409: ErrorSchema,
          422: ErrorSchema,
          500: InternalError,
        },
      },
    },
    async (req, reply) => {
      const actor = req.actor;
      if (!actor?.accountId || !actor.personId) {
        throw httpError('UNAUTHENTICATED');
      }

      const caseId = (req.params as { id: string }).id.toLowerCase();
      const expectedCaseVersion = readIfMatch(req);
      const idempotencyKey = readIdempotencyKey(req);
      const familyId = await resolveFamily(
        pool,
        actor.accountId,
        actor.personId
      );
      const body = req.body as z.infer<typeof GoalMutationRequest>;

      if (body.operation === 'SAVE') {
        return send(
          reply,
          await saveGoal(pool, {
            actor: {
              accountId: actor.accountId,
              personId: actor.personId,
            },
            familyId,
            caseId,
            expectedCaseVersion,
            idempotencyKey,
            contract: {
              problemFormulationId: body.problemFormulationId,
              problemFormulationVersion: body.problemFormulationVersion,
              baselineRefs: body.baselineRefs,
              targetDescription: body.targetDescription,
              observationMethod: body.observationMethod,
              observationWindow: body.observationWindow,
              protectiveConditions: body.protectiveConditions,
              parentActions: body.parentActions,
              reviewPoint: body.reviewPoint,
              dependencyRefs: body.dependencyRefs.map((ref) =>
                ref.type === 'CONSENT' && ref.version === undefined
                  ? { type: 'CONSENT' as const, id: ref.id }
                  : ref
              ),
              participantResponsibilities:
                body.participantResponsibilities,
            },
          })
        );
      }

      return send(
        reply,
        await confirmGoal(pool, {
          actor: {
            accountId: actor.accountId,
            personId: actor.personId,
          },
          familyId,
          caseId,
          expectedCaseVersion,
          idempotencyKey,
          goalId: body.goalId,
          goalVersion: body.goalVersion,
        })
      );
    }
  );
}
