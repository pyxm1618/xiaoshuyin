/**
 * Problem Formulation public routes (Slice 8).
 *
 * Exactly four frozen operations:
 *   GET  /api/v1/cases/:id/problem-formulations/current
 *   POST /api/v1/cases/:id/problem-formulations/:version/confirm
 *   POST /api/v1/cases/:id/problem-formulations/:version/dispute
 *   POST /api/v1/cases/:id/problem-formulations/:version/corrections
 *
 * StartAssessment / PresentProblemFormulation / ReassessFromFormulation are
 * internal application-service commands and have no public route.
 */

import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import {
  ProblemFormulationCurrentResponse,
  ProblemFormulationResponseRequest,
  ProblemFormulationCorrectionRequest,
  CaseNotFoundError,
  CurrentFamilyNotFoundError,
  CurrentFamilyAmbiguousError,
  ProblemFormulationConflictError,
  ProblemFormulationValidationError,
  UnauthenticatedError,
  InternalError,
  PG_INTEGER_MAX,
} from '@xiaoshuyin/contracts';
import { withIdentityTransaction } from '../db/tx.js';
import { requireCurrentFamily } from '../family-context.js';
import { readIdempotencyKey } from '../idempotency.js';
import { toHttpError } from '../plugins/error-handler.js';
import {
  confirmProblemFormulation,
  correctProblemFormulation,
  disputeProblemFormulation,
  getCurrentProblemFormulationView,
} from '../services/problem-formulations.js';
import type pg from 'pg';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CaseIdParams = z.object({ id: z.string().meta({ format: 'uuid' }) });

const FormulationVersionParams = z.object({
  id: z.string().meta({ format: 'uuid' }),
  version: z.coerce.number().int().min(1).max(PG_INTEGER_MAX),
});

const CaseDetailNotFound = z.union([CurrentFamilyNotFoundError, CaseNotFoundError]);

const ConflictOrFamilyAmbiguous = z.union([
  ProblemFormulationConflictError,
  CurrentFamilyAmbiguousError,
]);

const BEARER_SECURITY = [{ bearerAuth: [] }];
const CASE_TAG = ['case'];

function httpError(code: string, message?: string): Error & { statusCode: number; code: string } {
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
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > PG_INTEGER_MAX) {
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
  result: { status: number; body: unknown; etag: string }
) {
  return reply.header('ETag', result.etag).status(result.status).send(result.body);
}

function sendError(reply: FastifyReply, error: unknown): never {
  const typed = error as { statusCode?: number; code?: string; message?: string };
  if (typed?.statusCode && typed.statusCode < 500 && typed.code) {
    throw Object.assign(new Error(typed.message ?? typed.code), {
      statusCode: typed.statusCode,
      code: typed.code,
    });
  }
  throw error;
}

export function registerProblemFormulationRoutes(
  app: FastifyInstance,
  pool: pg.Pool
): void {
  app.get(
    '/api/v1/cases/:id/problem-formulations/current',
    {
      onRequest: app.authenticate,
      exposeHeadRoute: false,
      schema: {
        operationId: 'getCurrentProblemFormulation',
        summary: 'Read the current Problem Formulation',
        tags: CASE_TAG,
        security: BEARER_SECURITY,
        params: CaseIdParams,
        response: {
          200: ProblemFormulationCurrentResponse,
          401: UnauthenticatedError,
          404: CaseDetailNotFound,
          409: CurrentFamilyAmbiguousError,
          500: InternalError,
        },
      },
    },
    async (req, reply) => {
      const actor = req.actor;
      if (!actor?.accountId || !actor.personId) {
        throw httpError('UNAUTHENTICATED');
      }
      const rawCaseId = (req.params as { id: string }).id;
      const caseId = rawCaseId.toLowerCase();
      if (!UUID_PATTERN.test(caseId)) {
        throw httpError('CASE_NOT_FOUND', 'Case not found');
      }
      try {
        const familyId = await resolveFamily(pool, actor.accountId, actor.personId);
        const body = await getCurrentProblemFormulationView(pool, {
          actor: { accountId: actor.accountId, personId: actor.personId },
          familyId,
          caseId,
        });
        return reply
          .header('ETag', `"case-v${body.caseVersion}"`)
          .status(200)
          .send(body);
      } catch (error) {
        sendError(reply, error);
      }
    }
  );

  app.post(
    '/api/v1/cases/:id/problem-formulations/:version/confirm',
    {
      onRequest: app.authenticate,
      schema: {
        operationId: 'confirmProblemFormulation',
        summary: 'Confirm the current Problem Formulation',
        tags: CASE_TAG,
        security: BEARER_SECURITY,
        params: FormulationVersionParams,
        body: ProblemFormulationResponseRequest,
        response: {
          200: ProblemFormulationCurrentResponse,
          401: UnauthenticatedError,
          404: CaseDetailNotFound,
          409: ConflictOrFamilyAmbiguous,
          422: ProblemFormulationValidationError,
          500: InternalError,
        },
      },
    },
    async (req, reply) => {
      const actor = req.actor;
      if (!actor?.accountId || !actor.personId) throw httpError('UNAUTHENTICATED');
      const params = req.params as { id: string; version: number };
      const caseId = params.id.toLowerCase();
      if (!UUID_PATTERN.test(caseId)) throw httpError('CASE_NOT_FOUND', 'Case not found');
      const expectedCaseVersion = readIfMatch(req);
      const idempotencyKey = readIdempotencyKey(req);
      try {
        const familyId = await resolveFamily(pool, actor.accountId, actor.personId);
        const result = await confirmProblemFormulation(pool, {
          actor: { accountId: actor.accountId, personId: actor.personId },
          familyId,
          caseId,
          expectedCaseVersion,
          idempotencyKey,
          formulationVersion: params.version,
          body: req.body as { note?: string },
        });
        return send(reply, result);
      } catch (error) {
        sendError(reply, error);
      }
    }
  );

  app.post(
    '/api/v1/cases/:id/problem-formulations/:version/dispute',
    {
      onRequest: app.authenticate,
      schema: {
        operationId: 'disputeProblemFormulation',
        summary: 'Dispute the current Problem Formulation',
        tags: CASE_TAG,
        security: BEARER_SECURITY,
        params: FormulationVersionParams,
        body: ProblemFormulationResponseRequest,
        response: {
          200: ProblemFormulationCurrentResponse,
          401: UnauthenticatedError,
          404: CaseDetailNotFound,
          409: ConflictOrFamilyAmbiguous,
          422: ProblemFormulationValidationError,
          500: InternalError,
        },
      },
    },
    async (req, reply) => {
      const actor = req.actor;
      if (!actor?.accountId || !actor.personId) throw httpError('UNAUTHENTICATED');
      const params = req.params as { id: string; version: number };
      const caseId = params.id.toLowerCase();
      if (!UUID_PATTERN.test(caseId)) throw httpError('CASE_NOT_FOUND', 'Case not found');
      const expectedCaseVersion = readIfMatch(req);
      const idempotencyKey = readIdempotencyKey(req);
      try {
        const familyId = await resolveFamily(pool, actor.accountId, actor.personId);
        const result = await disputeProblemFormulation(pool, {
          actor: { accountId: actor.accountId, personId: actor.personId },
          familyId,
          caseId,
          expectedCaseVersion,
          idempotencyKey,
          formulationVersion: params.version,
          body: req.body as { note?: string },
        });
        return send(reply, result);
      } catch (error) {
        sendError(reply, error);
      }
    }
  );

  app.post(
    '/api/v1/cases/:id/problem-formulations/:version/corrections',
    {
      onRequest: app.authenticate,
      schema: {
        operationId: 'correctProblemFormulation',
        summary: 'Create a corrected Problem Formulation version',
        tags: CASE_TAG,
        security: BEARER_SECURITY,
        params: FormulationVersionParams,
        body: ProblemFormulationCorrectionRequest,
        response: {
          201: ProblemFormulationCurrentResponse,
          401: UnauthenticatedError,
          404: CaseDetailNotFound,
          409: ConflictOrFamilyAmbiguous,
          422: ProblemFormulationValidationError,
          500: InternalError,
        },
      },
    },
    async (req, reply) => {
      const actor = req.actor;
      if (!actor?.accountId || !actor.personId) throw httpError('UNAUTHENTICATED');
      const params = req.params as { id: string; version: number };
      const caseId = params.id.toLowerCase();
      if (!UUID_PATTERN.test(caseId)) throw httpError('CASE_NOT_FOUND', 'Case not found');
      const expectedCaseVersion = readIfMatch(req);
      const idempotencyKey = readIdempotencyKey(req);
      const body = req.body as {
        changes: Record<string, unknown>;
        note?: string;
      };
      try {
        const familyId = await resolveFamily(pool, actor.accountId, actor.personId);
        const result = await correctProblemFormulation(pool, {
          actor: { accountId: actor.accountId, personId: actor.personId },
          familyId,
          caseId,
          expectedCaseVersion,
          idempotencyKey,
          formulationVersion: params.version,
          changes: body.changes,
          ...(body.note !== undefined ? { note: body.note } : {}),
        });
        return send(reply, result);
      } catch (error) {
        sendError(reply, error);
      }
    }
  );
}