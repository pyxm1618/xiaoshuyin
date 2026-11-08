/**
 * Identity binding runtime routes — exactly six frozen capability surfaces.
 *
 *   1 POST /api/v1/identity-bindings/bootstrap
 *   2 POST /api/v1/identity-bindings/candidate-decision
 *   3 GET  /api/v1/identity-bindings/status
 *   4 POST /api/v1/identity-bindings/session
 *   5 GET  /api/v1/identity-bindings/pending
 *   6 POST /api/v1/identity-bindings/:attemptId/decision
 *
 * No participant / Case / Evidence / notification / UI route exists here.
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import {
  BindingBootstrapRequest,
  BindingCandidateDecisionRequest,
  BindingConfirmerDecisionRequest,
} from '@xiaoshuyin/contracts';
import {
  candidateBootstrapResponse,
  candidateBootstrapReusedResponse,
  candidateBootstrapCommittedResponse,
  candidateDecisionResponse,
  candidateSessionResponse,
  candidateStatusResponse,
} from '@xiaoshuyin/domain';
import { toHttpError } from '../plugins/error-handler.js';
import { bindingError } from '../identity-binding/errors.js';
import type { WechatAuthProvider } from '../auth/wechat-provider.js';
import {
  bootstrap,
  type BootstrapDeps,
} from '../identity-binding/bootstrap.js';
import { submitCandidateDecision } from '../identity-binding/candidate-decision.js';
import { getCandidateStatus } from '../identity-binding/candidate-status.js';
import { exchangeSession } from '../identity-binding/session-exchange.js';
import {
  listPendingBindings,
  submitConfirmerDecision,
  type ConfirmerDeps,
} from '../identity-binding/confirmer.js';
import type { InvitationResolutionPort } from '../identity-binding/invitation-port.js';

export interface IdentityBindingRouteDeps {
  pool: BootstrapDeps['pool'];
  invitationPort: InvitationResolutionPort;
  wechatProvider: WechatAuthProvider;
  identityBindingSecret: string;
  contextTtlSeconds: number;
  attemptTtlSeconds: number;
  sessionSecret: string;
}

const ConfirmerQuery = z.object({ personId: z.string().uuid() });

function contextToken(req: FastifyRequest): string {
  const raw = req.headers['x-binding-context'];
  const token = Array.isArray(raw) ? raw[0] : raw;
  if (typeof token !== 'string' || token.length === 0) {
    throw bindingError('BINDING_CONTEXT_INVALID');
  }
  return token;
}

function validationError(reply: FastifyReply) {
  const err = toHttpError('VALIDATION_ERROR', 'Invalid request body');
  // Send the frozen error envelope only; the transport status code is not part
  // of the body (same shape as errorHandler-generated 422s).
  return reply.status(err.statusCode).send({ code: err.code, message: err.message });
}

export function registerIdentityBindingRoutes(
  app: FastifyInstance,
  deps: IdentityBindingRouteDeps
): void {
  const bootstrapDeps: BootstrapDeps = {
    pool: deps.pool,
    invitationPort: deps.invitationPort,
    wechatProvider: deps.wechatProvider,
    identityBindingSecret: deps.identityBindingSecret,
    contextTtlSeconds: deps.contextTtlSeconds,
    attemptTtlSeconds: deps.attemptTtlSeconds,
    sessionSecret: deps.sessionSecret,
  };
  const commitDeps: ConfirmerDeps = {
    pool: deps.pool,
    invitationPort: deps.invitationPort,
    identityBindingSecret: deps.identityBindingSecret,
  };

  // 1. Bootstrap — independent from ordinary login; no session required.
  app.post('/api/v1/identity-bindings/bootstrap', async (req, reply) => {
    const parsed = BindingBootstrapRequest.safeParse(req.body);
    if (!parsed.success) return validationError(reply);

    const result = await bootstrap(bootstrapDeps, parsed.data);
    if (result.kind === 'COMMITTED') {
      return reply.status(200).send(candidateBootstrapCommittedResponse());
    }
    if (result.kind === 'REUSED') {
      return reply
        .status(200)
        .send(
          candidateBootstrapReusedResponse({
            sessionToken: result.sessionToken,
            accountId: result.accountId,
            personId: result.personId,
          })
        );
    }
    return reply.status(200).send(candidateBootstrapResponse(result.pendingContextToken));
  });

  // 2. Candidate decision — X-Binding-Context only.
  app.post('/api/v1/identity-bindings/candidate-decision', async (req, reply) => {
    const parsed = BindingCandidateDecisionRequest.safeParse(req.body);
    if (!parsed.success) return validationError(reply);
    if (parsed.data.decision === 'AFFIRM' && !parsed.data.confirmationVersion) {
      return validationError(reply);
    }
    const result = await submitCandidateDecision(
      { pool: deps.pool },
      {
        contextToken: contextToken(req),
        decision: parsed.data.decision,
        confirmationVersion: parsed.data.confirmationVersion ?? undefined,
        idempotencyKey: parsed.data.idempotencyKey,
      }
    );
    return reply.status(200).send(candidateDecisionResponse());
  });

  // 3. Candidate status — X-Binding-Context only.
  app.get(
    '/api/v1/identity-bindings/status',
    { exposeHeadRoute: false },
    async (req, reply) => {
      const result = await getCandidateStatus(
        { pool: deps.pool },
        contextToken(req)
      );
      return reply.status(200).send(candidateStatusResponse(result.binding === 'COMMITTED'));
    }
  );

  // 4. Session exchange — X-Binding-Context only.
  app.post('/api/v1/identity-bindings/session', async (req, reply) => {
    const result = await exchangeSession(
      { pool: deps.pool, sessionSecret: deps.sessionSecret },
      contextToken(req)
    );
    return reply
      .status(200)
      .send(
        candidateSessionResponse(
          result.binding === 'COMMITTED',
          result.binding === 'COMMITTED'
            ? {
                sessionToken: result.sessionToken,
                accountId: result.accountId,
                personId: result.personId,
              }
            : undefined
        )
      );
  });

  // 5. Confirmer pending list — Bearer only.
  app.get(
    '/api/v1/identity-bindings/pending',
    { exposeHeadRoute: false },
    async (req, reply) => {
      const parsed = ConfirmerQuery.safeParse(req.query);
      if (!parsed.success) return validationError(reply);
      const actor = req.actor;
      if (!actor?.accountId || !actor.personId) {
        throw Object.assign(new Error('UNAUTHENTICATED'), toHttpError('UNAUTHENTICATED'));
      }
      const attempts = await listPendingBindings(commitDeps, {
        accountId: actor.accountId,
        personId: actor.personId,
        targetPersonId: parsed.data.personId,
      });
      return reply.status(200).send({ attempts });
    }
  );

  // 6. Confirmer decision — Bearer only.
  app.post('/api/v1/identity-bindings/:attemptId/decision', async (req, reply) => {
    const params = z.object({ attemptId: z.string().uuid() }).safeParse(req.params);
    const body = BindingConfirmerDecisionRequest.safeParse(req.body);
    if (!params.success || !body.success) return validationError(reply);
    const actor = req.actor;
    if (!actor?.accountId || !actor.personId) {
      throw Object.assign(new Error('UNAUTHENTICATED'), toHttpError('UNAUTHENTICATED'));
    }
    const result = await submitConfirmerDecision(commitDeps, {
      accountId: actor.accountId,
      personId: actor.personId,
      attemptId: params.data.attemptId,
      targetPersonId: body.data.personId,
      decision: body.data.decision,
      targetConfirmed: body.data.targetConfirmed,
      candidateRecognized: body.data.candidateRecognized,
      confirmationVersion: body.data.confirmationVersion,
      idempotencyKey: body.data.idempotencyKey,
    });
    return reply.status(200).send({ state: result.state });
  });
}