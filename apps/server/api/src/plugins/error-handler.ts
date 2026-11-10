/**
 * Error handler: single toHttpError() mapping.
 * Per plan.md D-6.2: unified error body, no target field leakage.
 */

import type { FastifyReply, FastifyRequest } from 'fastify';

export interface HttpError {
  statusCode: number;
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

const ERROR_MAP: Record<string, number> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FAMILY_MEMBER: 403,
  NOT_FAMILY_MANAGER: 403,
  FAMILY_MANAGER_MUST_BE_ADULT: 403,
  AGE_BAND_UNKNOWN: 403,
  GUARDIAN_CONSENT_REQUIRED: 403,
  GUARDIAN_CONSENT_REVOKED: 403,
  NOT_GUARDIAN: 403,
  GUARDIAN_CONSENT_ALREADY_BOUND: 403,
  GUARDIAN_CONSENT_EXPIRED: 403,
  GUARDIAN_CONSENT_NOTICE_MISMATCH: 403,
  // Frozen GateReason values (contracts/consent-onboarding.md §7)
  PROFILE_MISSING: 403,
  GUARDIAN_MISSING: 403,
  GUARDIAN_MISMATCH: 403,
  CONSENT_SUBJECT_MISMATCH: 403,
  NOTICE_VERSION_MISMATCH: 403,
  CURRENT_FAMILY_NOT_FOUND: 404,
  CURRENT_FAMILY_AMBIGUOUS: 409,
  CASE_NOT_FOUND: 404,
  CASE_ACCESS_DENIED: 403,
  // Slice 7 — SwitchPrimaryCase state conflicts (not validation).
  CASE_ALREADY_PRIMARY: 409,
  CASE_CLOSED: 409,
  SAFETY_HOLD_BLOCKED: 409,
  STALE_PRIMARY_VIEW: 409,
  // Slice 4 participation.
  PARTICIPATION_ALREADY_EXISTS: 409,
  PARTICIPATION_TARGET_INELIGIBLE: 403,
  INVITATION_NOT_AVAILABLE: 404,
  PARTICIPATION_NOT_FOUND: 404,
  PARTICIPATION_STATE_CONFLICT: 409,
  // Slice 006 identity binding.
  WECHAT_AUTH_FAILED: 401,
  BINDING_CONTEXT_INVALID: 401,
  BINDING_NOT_FOUND: 404,
  BINDING_STATE_CONFLICT: 409,
  VALIDATION_ERROR: 422,
  AGE_BAND_SOURCE_NOT_ALLOWED: 422,
  IDEMPOTENCY_PAYLOAD_MISMATCH: 409,
  FAMILY_ALREADY_OWNED: 409,
  MEMBER_ALREADY_EXISTS: 409,
  GUARDIAN_CONSENT_ALREADY_GRANTED: 409,
};

export function toHttpError(code: string, message?: string, details?: Record<string, unknown>): HttpError {
  const statusCode = ERROR_MAP[code] ?? 500;
  return {
    statusCode,
    code,
    message: message ?? code,
    ...(details ? { details } : {}),
  };
}

/**
 * Whitelist-only logging for unexpected/5xx failures.
 *
 * `pg` errors can carry SQL fragments, parameter values, request-derived
 * detail and stack frames, so neither the error object nor its message,
 * detail, query or parameters are logged. Only non-sensitive routing metadata
 * plus a strictly validated SQLSTATE are recorded.
 */
function logUnexpected(req: FastifyRequest, err: Error) {
  const rawCode = (err as { code?: unknown }).code;
  const sqlstate =
    typeof rawCode === 'string' && /^[0-9A-Z]{5}$/.test(rawCode) ? rawCode : undefined;
  req.log.error(
    {
      requestId: req.id,
      method: req.method,
      route: req.routeOptions?.url ?? null,
      ...(sqlstate ? { sqlstate } : {}),
    },
    'unhandled request error'
  );
}

/** The only 5xx body shape the API ever returns. */
function genericInternalError(reply: FastifyReply) {
  return reply.status(500).send({
    code: 'INTERNAL_ERROR',
    message: 'An internal error occurred',
  });
}

export function errorHandler(err: Error, req: FastifyRequest, reply: FastifyReply) {
  // Secure JSON parsing rejects prototype-polluting payloads and invalid JSON.
  // The Case create contract requires every undeclared business field to be a
  // 422 VALIDATION_ERROR with zero writes, so this parse failure is mapped for
  // that command only. Other endpoints keep the Fastify default (400).
  const routeUrl = req.routeOptions?.url ?? req.url;
  const strictJsonCommands = new Set([
    '/api/v1/cases',
    '/api/v1/cases/:id/messages',
    '/api/v1/cases/:id/switch-primary',
    '/api/v1/cases/:id/participation-invites',
    '/api/v1/participation-invites/:token/accept',
    '/api/v1/participations/:id/decline',
    '/api/v1/participations/:id/withdraw',
  ]);
  const isStrictCreateCommand =
    req.method === 'POST' && strictJsonCommands.has(routeUrl);
  if (isStrictCreateCommand && (err as any).code === 'FST_ERR_CTP_INVALID_JSON_BODY') {
    return reply.status(422).send({
      code: 'VALIDATION_ERROR',
      message: 'Invalid request body',
    });
  }

  // Route schema validation failures surface as Fastify 400s. The frozen
  // contract maps every schema violation to `422 VALIDATION_ERROR` with a
  // single body shape (no leaked field details).
  if ('validation' in err) {
    return reply.status(422).send({
      code: 'VALIDATION_ERROR',
      message: 'Invalid request body',
    });
  }

  if ('statusCode' in err && 'code' in err) {
    const httpErr = err as unknown as HttpError;
    // 4xx keep their contract message. Any 5xx — including typed
    // INTERNAL_ERROR raised by an invariant branch — is reported through the
    // single generic 500 contract so no internal detail reaches the client.
    if (httpErr.statusCode < 500) {
      return reply.status(httpErr.statusCode).send({
        code: httpErr.code,
        message: httpErr.message,
        ...(httpErr.details ? { details: httpErr.details } : {}),
      });
    }
    logUnexpected(req, err);
    return genericInternalError(reply);
  }

  logUnexpected(req, err);
  return genericInternalError(reply);
}
