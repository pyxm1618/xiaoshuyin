/**
 * Instance-level Consent runtime dependencies (Finding #40).
 *
 * The evidence pepper and the server-decided consent channel are bound ONCE at
 * application composition time (`loadRuntimeConfig` → `buildApp` → route
 * registration) and passed down explicitly. No route or service reads
 * `process.env` for either value and `buildApp` never mutates the process
 * environment: two apps built in the same process stay fully isolated.
 *
 * This lives in the compliance package because the consent-evidence contract
 * (and the pepper length rule) is owned here, and because both consuming route
 * modules must share one validated dependency shape.
 */

import {
  MIN_EVIDENCE_PEPPER_LENGTH,
  type ConsentChannelType,
} from '@xiaoshuyin/contracts';

export interface ConsentRuntimeDependencies {
  /** Deployment secret used only for HMAC evidence digests; never persisted. */
  readonly evidencePepper: string;
  /** Server-decided channel stored in consent evidence. */
  readonly consentChannel: ConsentChannelType;
}

export const MIN_PEPPER_LENGTH = MIN_EVIDENCE_PEPPER_LENGTH;

function invalid(detail: string): never {
  throw Object.assign(new Error(`CONSENT_RUNTIME_INVALID: ${detail}`), {
    statusCode: 500,
    code: 'INTERNAL_ERROR',
  });
}

/**
 * Validate the injected dependencies at registration time. A missing or short
 * pepper is a hard composition failure — exactly like the previous ambient
 * accessor — but it can no longer be satisfied by process-wide state.
 */
export function requireConsentRuntimeDependencies(
  dependencies: ConsentRuntimeDependencies
): ConsentRuntimeDependencies {
  const pepper = dependencies?.evidencePepper;
  if (typeof pepper !== 'string' || pepper.length < MIN_PEPPER_LENGTH) {
    invalid(`evidencePepper must be at least ${MIN_PEPPER_LENGTH} characters`);
  }
  if (
    dependencies.consentChannel !== 'TEST' &&
    dependencies.consentChannel !== 'MINIPROGRAM'
  ) {
    invalid('consentChannel must be TEST or MINIPROGRAM');
  }
  return dependencies;
}
