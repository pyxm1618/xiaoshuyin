/**
 * Binding error codes and their frozen English messages.
 *
 * Codes are UPPER_SNAKE_CASE constants; the HTTP message is stable text and
 * never echoes the code or any P1 / family / guardian / consent detail.
 */

export const BINDING_ERRORS = {
  WECHAT_AUTH_FAILED: {
    statusCode: 401,
    code: 'WECHAT_AUTH_FAILED',
    message: 'WeChat authentication failed',
  },
  BINDING_CONTEXT_INVALID: {
    statusCode: 401,
    code: 'BINDING_CONTEXT_INVALID',
    message: 'Binding context invalid',
  },
  BINDING_NOT_FOUND: {
    statusCode: 404,
    code: 'BINDING_NOT_FOUND',
    message: 'Binding not found',
  },
  BINDING_STATE_CONFLICT: {
    statusCode: 409,
    code: 'BINDING_STATE_CONFLICT',
    message: 'Binding state conflict',
  },
  IDEMPOTENCY_PAYLOAD_MISMATCH: {
    statusCode: 409,
    code: 'IDEMPOTENCY_PAYLOAD_MISMATCH',
    message: 'Idempotency payload mismatch',
  },
  VALIDATION_ERROR: {
    statusCode: 422,
    code: 'VALIDATION_ERROR',
    message: 'Invalid request body',
  },
} as const;

export type BindingErrorCode = keyof typeof BINDING_ERRORS;

export function bindingError(code: BindingErrorCode): Error & {
  statusCode: number;
  code: string;
} {
  const def = BINDING_ERRORS[code];
  return Object.assign(new Error(def.message), {
    statusCode: def.statusCode,
    code: def.code,
  });
}

/** Technical failure whose operation result is RETRYABLE. */
export class RetryableOperationError extends Error {
  readonly retryable = true;
  readonly statusCode = 500;
  readonly code = 'INTERNAL_ERROR';
  constructor() {
    super('An internal error occurred');
  }
}