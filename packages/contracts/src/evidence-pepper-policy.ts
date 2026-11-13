/**
 * Single authoritative strength policy for the consent evidence pepper.
 *
 * The pepper is the deployment secret used only for HMAC-SHA256 hashing of
 * consent evidence metadata (raw client IP / User-Agent). Guardian consent and
 * the supplemental-assessment owner seam MUST share this exact minimum; there
 * is deliberately no second threshold and no second pepper policy.
 *
 * The measure is characters, matching the existing runtime boundary and the
 * existing Guardian `MIN_PEPPER_LENGTH = 16` semantics. It is not bytes.
 */
export const MIN_EVIDENCE_PEPPER_LENGTH = 16;

export function hasSufficientEvidencePepperStrength(value: unknown): value is string {
  return typeof value === 'string' && value.length >= MIN_EVIDENCE_PEPPER_LENGTH;
}