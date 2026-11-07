/**
 * Evidence hash pepper accessor.
 *
 * The pepper is a deployment secret (`EVIDENCE_HASH_PEPPER`). It is consumed
 * by the consent-evidence builder only; it is never persisted, logged, or
 * committed, and there is deliberately no fallback value: a missing or short
 * pepper is a hard startup/runtime failure, never a silent continuation.
 */

export const MIN_PEPPER_LENGTH = 16;

export function requireEvidencePepper(env: NodeJS.ProcessEnv = process.env): string {
  const pepper = env['EVIDENCE_HASH_PEPPER'];
  if (!pepper || pepper.length < MIN_PEPPER_LENGTH) {
    throw Object.assign(
      new Error(`EVIDENCE_HASH_PEPPER must be at least ${MIN_PEPPER_LENGTH} characters`),
      { statusCode: 500, code: 'INTERNAL_ERROR' }
    );
  }
  return pepper;
}