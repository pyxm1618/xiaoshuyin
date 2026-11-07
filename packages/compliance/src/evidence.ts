/**
 * Consent evidence construction.
 *
 * Per contracts/consent-onboarding.md §4, `consent_records.evidence` is a fixed
 * object shape validated by the single `ConsentEvidence` Zod schema in
 * `@xiaoshuyin/contracts`.
 *
 * Privacy rules enforced here:
 *   - raw client IP / User-Agent are NEVER returned;
 *   - only HMAC-SHA256(pepper, value) hex digests leave this module;
 *   - the pepper is supplied by the caller (deployment secret) and never stored.
 *
 * A missing header/IP is represented deterministically as the HMAC of the
 * empty string. No raw value is fabricated: absence stays absence.
 */

import { createHash, createHmac } from 'node:crypto';
import { ConsentEvidence, type ConsentEvidenceType } from '@xiaoshuyin/contracts';

export function sha256Hex(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

export function hmacSha256Hex(pepper: string, value: string): string {
  return createHmac('sha256', pepper).update(value).digest('hex');
}

export interface ConsentEvidenceInput {
  /** sha256 of the versioned acceptance / revocation statement. */
  acceptedTextHash: string;
  /** Raw client IP; hashed, never persisted as-is. */
  clientIp: string | null;
  /** Raw User-Agent; hashed, never persisted as-is. */
  userAgent: string | null;
  /** Deployment secret (EVIDENCE_HASH_PEPPER); never persisted. */
  pepper: string;
}

/**
 * Build and validate the frozen evidence object. Returns the parsed schema
 * output so the value stored in `consent_records.evidence` is exactly the
 * schema-validated shape (same source of truth for generation and storage).
 */
export function buildConsentEvidence(input: ConsentEvidenceInput): ConsentEvidenceType {
  const evidence = {
    channel: 'MINIPROGRAM' as const,
    accepted_text_hash: input.acceptedTextHash,
    declared_age_band: 'UNDER_14' as const,
    client_ip_hash: hmacSha256Hex(input.pepper, input.clientIp ?? ''),
    user_agent_hash: hmacSha256Hex(input.pepper, input.userAgent ?? ''),
  };
  return ConsentEvidence.parse(evidence);
}