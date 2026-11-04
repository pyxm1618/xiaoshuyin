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
  CURRENT_FAMILY_NOT_FOUND: 404,
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

export function errorHandler(err: Error, _req: FastifyRequest, reply: FastifyReply) {
  if ('statusCode' in err && 'code' in err) {
    const httpErr = err as unknown as HttpError;
    return reply.status(httpErr.statusCode).send({
      code: httpErr.code,
      message: httpErr.message,
      ...(httpErr.details ? { details: httpErr.details } : {}),
    });
  }

  // Unexpected error
  return reply.status(500).send({
    code: 'INTERNAL_ERROR',
    message: 'An internal error occurred',
  });
}
