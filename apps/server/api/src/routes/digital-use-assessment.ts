/**
 * Slice 12 — exactly four public Digital Use Assessment / Scene APIs.
 *
 * No hidden mutation/bypass route exists here. Family/package/phase/node route
 * authority is resolved server-side; request bodies contain only the frozen
 * optimistic-concurrency tokens and structured user response.
 */
import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import { z } from 'zod';
import {
  CompleteDigitalUseNodeRequest,
  DigitalUseNodeResponse,
  DigitalUseSceneResponse,
  ErrorSchema,
  SceneRuntimeError,
  StartDigitalUseAssessmentRequest,
} from '@xiaoshuyin/contracts';
import { withIdentityTransaction } from '../db/tx.js';
import { requireCurrentFamily } from '../family-context.js';
import { readIdempotencyKey } from '../idempotency.js';
import { toHttpError } from '../plugins/error-handler.js';
import {
  getDigitalUseNode,
  getDigitalUseScene,
  startOrResumeDigitalUseAssessment,
} from '../services/digital-use-assessment.js';
import { completeDigitalUseNodeResponse } from '../services/digital-use-node-response.js';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CaseIdParams = z.object({
  id: z.string().meta({ format: 'uuid' }),
});

const SceneNodeParams = z.object({
  id: z.string().meta({ format: 'uuid' }),
  nodeCode: z.string().min(1).max(64),
});

const BEARER_SECURITY = [{ bearerAuth: [] }];
const TAGS = ['digital-use-assessment'];

function httpError(code: string, message?: string): Error & { statusCode: number; code: string } {
  const mapped = toHttpError(code, message);
  return Object.assign(new Error(mapped.message), {
    statusCode: mapped.statusCode,
    code: mapped.code,
  });
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

function actorOf(req: { actor?: { accountId?: string; personId?: string } }) {
  const actor = req.actor;
  if (!actor?.accountId || !actor.personId) throw httpError('UNAUTHENTICATED');
  return { accountId: actor.accountId, personId: actor.personId };
}

function caseIdOf(raw: string): string {
  const caseId = raw.toLowerCase();
  if (!UUID_PATTERN.test(caseId)) throw httpError('CASE_NOT_FOUND', 'Case not found');
  return caseId;
}

const ReadErrors = {
  401: ErrorSchema,
  404: ErrorSchema,
  409: SceneRuntimeError,
  422: SceneRuntimeError,
  500: ErrorSchema,
} as const;

const MutationErrors = {
  401: ErrorSchema,
  404: ErrorSchema,
  409: SceneRuntimeError,
  422: SceneRuntimeError,
  500: ErrorSchema,
} as const;

export function registerDigitalUseAssessmentRoutes(
  app: FastifyInstance,
  pool: pg.Pool,
  options: { readonly evidencePepper: string }
): void {
  app.post(
    '/api/v1/cases/:id/assessments',
    {
      onRequest: app.authenticate,
      schema: {
        operationId: 'startDigitalUseAssessment',
        summary: 'Start or resume the Digital Use Assessment',
        tags: TAGS,
        security: BEARER_SECURITY,
        params: CaseIdParams,
        body: StartDigitalUseAssessmentRequest,
        response: {
          200: DigitalUseSceneResponse,
          ...MutationErrors,
        },
      },
    },
    async (req, reply) => {
      const actor = actorOf(req);
      const caseId = caseIdOf((req.params as { id: string }).id);
      const body = StartDigitalUseAssessmentRequest.parse(req.body);
      const idempotencyKey = readIdempotencyKey(req);
      const familyId = await resolveFamily(pool, actor.accountId, actor.personId);
      const result = await startOrResumeDigitalUseAssessment(pool, {
        actor,
        familyId,
        caseId,
        expectedCaseVersion: body.expectedCaseVersion,
        idempotencyKey,
      });
      return reply.status(200).send(result);
    }
  );

  app.get(
    '/api/v1/cases/:id/scene',
    {
      onRequest: app.authenticate,
      exposeHeadRoute: false,
      schema: {
        operationId: 'getDigitalUseScene',
        summary: 'Read the authorized current Digital Use Scene projection',
        tags: TAGS,
        security: BEARER_SECURITY,
        params: CaseIdParams,
        response: {
          200: DigitalUseSceneResponse,
          ...ReadErrors,
        },
      },
    },
    async (req, reply) => {
      const actor = actorOf(req);
      const caseId = caseIdOf((req.params as { id: string }).id);
      const familyId = await resolveFamily(pool, actor.accountId, actor.personId);
      const result = await getDigitalUseScene(pool, { actor, familyId, caseId });
      return reply.status(200).send(result);
    }
  );

  app.get(
    '/api/v1/cases/:id/scene/nodes/:nodeCode',
    {
      onRequest: app.authenticate,
      exposeHeadRoute: false,
      schema: {
        operationId: 'getDigitalUseSceneNode',
        summary: 'Read one authorized reachable Digital Use Scene node',
        tags: TAGS,
        security: BEARER_SECURITY,
        params: SceneNodeParams,
        response: {
          200: DigitalUseNodeResponse,
          ...ReadErrors,
        },
      },
    },
    async (req, reply) => {
      const actor = actorOf(req);
      const params = req.params as { id: string; nodeCode: string };
      const caseId = caseIdOf(params.id);
      const familyId = await resolveFamily(pool, actor.accountId, actor.personId);
      const result = await getDigitalUseNode(pool, {
        actor,
        familyId,
        caseId,
        nodeCode: params.nodeCode,
      });
      return reply.status(200).send(result);
    }
  );

  app.post(
    '/api/v1/cases/:id/scene/nodes/:nodeCode/responses',
    {
      onRequest: app.authenticate,
      schema: {
        operationId: 'completeDigitalUseSceneNode',
        summary: 'Record one structured response for the current Digital Use node',
        tags: TAGS,
        security: BEARER_SECURITY,
        params: SceneNodeParams,
        body: CompleteDigitalUseNodeRequest,
        response: {
          200: DigitalUseSceneResponse,
          ...MutationErrors,
        },
      },
    },
    async (req, reply) => {
      const actor = actorOf(req);
      const params = req.params as { id: string; nodeCode: string };
      const caseId = caseIdOf(params.id);
      const body = CompleteDigitalUseNodeRequest.parse(req.body);
      const idempotencyKey = readIdempotencyKey(req);
      const familyId = await resolveFamily(pool, actor.accountId, actor.personId);
      const userAgentRaw = req.headers['user-agent'];
      const userAgent = Array.isArray(userAgentRaw)
        ? userAgentRaw[0] ?? null
        : typeof userAgentRaw === 'string'
          ? userAgentRaw
          : null;

      const result = await completeDigitalUseNodeResponse(pool, {
        actor,
        familyId,
        caseId,
        nodeCode: params.nodeCode,
        expectedCaseVersion: body.expectedCaseVersion,
        expectedNodeRevision: body.expectedNodeRevision,
        response: body.response as Readonly<Record<string, unknown>>,
        idempotencyKey,
        requestEvidence: {
          clientIp: req.ip ?? null,
          userAgent,
          pepper: options.evidencePepper,
        },
      });
      return reply.status(200).send(result);
    }
  );
}
