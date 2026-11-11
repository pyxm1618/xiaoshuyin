/**
 * Slice 9 — stable Safety machine semantics (plan §14).
 *
 * These codes are the closed Safety vocabulary. They never expose another
 * Family's object existence, evidence content, risk category, policy match or
 * review text.
 */

export const SAFETY_ERROR_CODES = [
  'CASE_CLOSED',
  'SAFETY_HOLD_ALREADY_ACTIVE',
  'SAFETY_HOLD_BLOCKED',
  'STALE_CASE_VERSION',
  'SAFETY_PRECHECK_STALE',
  'SAFETY_PRECHECK_INVALID',
  'SAFETY_REVIEW_EVIDENCE_INVALID',
  'SAFETY_RESOLUTION_AUTHORITY_DENIED',
  'SAFETY_RESOLUTION_AUTHORITY_UNAVAILABLE',
  'SAFETY_HOLD_REQUIRED',
] as const;

export type SafetyErrorCode = (typeof SAFETY_ERROR_CODES)[number];

/**
 * Typed domain failure carrying a stable machine code.
 *
 * `message` is a fixed, non-leaking string: it never includes Family/Case
 * identifiers, evidence content, policy references or review narrative.
 */
export class SafetyError extends Error {
  readonly code: SafetyErrorCode;

  constructor(code: SafetyErrorCode, message?: string) {
    // The stable machine code is always part of the message so callers and
    // tests match one string. `message` must never carry protected data.
    super(message ? `${code}: ${message}` : code);
    this.name = 'SafetyError';
    this.code = code;
  }
}

export function isSafetyError(error: unknown): error is SafetyError {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { name?: unknown }).name === 'SafetyError' &&
    typeof (error as { code?: unknown }).code === 'string' &&
    (SAFETY_ERROR_CODES as readonly string[]).includes(
      (error as { code: string }).code
    )
  );
}