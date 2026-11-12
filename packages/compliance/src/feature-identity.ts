/**
 * Slice 10 — Server-owned Compliance Feature Identity.
 *
 * A compliance feature identity is the pair
 *   `{ featureCode, featureContractRevision }`
 * and is always server-owned:
 *
 *   - it identifies a logical capability, never a page, route, prompt or
 *     client-supplied string;
 *   - the revision changes only when capability semantics change enough that a
 *     prior applicability judgment can no longer be assumed;
 *   - a separate `policyVersion` (see `feature-policy.ts`) versions the
 *     Compliance Policy judgment itself.
 *
 * The Common Core registry validates shape and uniqueness only. It contains no
 * Scene-specific product branch (no A4003 / Digital Use conditional).
 */

declare const complianceFeatureDescriptorBrand: unique symbol;

/**
 * A resolved, server-owned feature descriptor. The private brand prevents a
 * raw request object from being passed where an authoritative descriptor is
 * required: only the registry or the registration factory can produce one.
 */
export interface ComplianceFeatureDescriptor {
  readonly featureCode: string;
  readonly featureContractRevision: string;
  readonly [complianceFeatureDescriptorBrand]: true;
}

/** A server-owned registration of one logical capability. */
export interface ComplianceFeatureRegistration {
  readonly featureCode: string;
  readonly featureContractRevision: string;
  /** Human-readable capability label for internal diagnostics only. */
  readonly capabilityLabel: string;
}

export type ComplianceFeatureIdentityReason =
  | 'COMPLIANCE_FEATURE_UNKNOWN'
  | 'COMPLIANCE_FEATURE_REVISION_STALE';

export type ComplianceFeatureResolution =
  | { readonly ok: true; readonly descriptor: ComplianceFeatureDescriptor }
  | { readonly ok: false; readonly reasonCode: ComplianceFeatureIdentityReason };

export type ComplianceFeatureRegistrationErrorCode =
  | 'COMPLIANCE_FEATURE_REGISTRATION_SHAPE_INVALID'
  | 'COMPLIANCE_FEATURE_REGISTRATION_CONFLICT';

export class ComplianceFeatureRegistrationError extends Error {
  public readonly code: ComplianceFeatureRegistrationErrorCode;

  constructor(code: ComplianceFeatureRegistrationErrorCode, message: string) {
    super(message);
    this.name = 'ComplianceFeatureRegistrationError';
    this.code = code;
  }
}

/** Stable canonical feature-code shape; server-owned values only. */
export const COMPLIANCE_FEATURE_CODE_PATTERN = /^[A-Z][A-Z0-9_]{2,119}$/;
/** Contract-revision shape (lowercase, bounded, no free-form prose). */
export const COMPLIANCE_FEATURE_CONTRACT_REVISION_PATTERN = /^[a-z0-9][a-z0-9._-]{0,63}$/;

function isBoundedNonEmpty(value: unknown, maxLength: number): value is string {
  return typeof value === 'string' && value.length >= 1 && value.length <= maxLength;
}

function hasValidFeatureShape(candidate: {
  featureCode: string;
  featureContractRevision: string;
}): boolean {
  return (
    COMPLIANCE_FEATURE_CODE_PATTERN.test(candidate.featureCode) &&
    COMPLIANCE_FEATURE_CONTRACT_REVISION_PATTERN.test(candidate.featureContractRevision)
  );
}

function freezeDescriptor(
  featureCode: string,
  featureContractRevision: string
): ComplianceFeatureDescriptor {
  return Object.freeze({
    featureCode,
    featureContractRevision,
  }) as ComplianceFeatureDescriptor;
}

/**
 * Create a descriptor from a server-owned registration. This is the only
 * production entry point for a new descriptor; there is deliberately no
 * `descriptorFromClientString(...)` helper.
 */
export function createServerFeatureDescriptor(
  registration: ComplianceFeatureRegistration
): ComplianceFeatureDescriptor {
  if (
    !isBoundedNonEmpty(registration.featureCode, 120) ||
    !isBoundedNonEmpty(registration.featureContractRevision, 64) ||
    !isBoundedNonEmpty(registration.capabilityLabel, 200) ||
    !hasValidFeatureShape(registration)
  ) {
    throw new ComplianceFeatureRegistrationError(
      'COMPLIANCE_FEATURE_REGISTRATION_SHAPE_INVALID',
      'COMPLIANCE_FEATURE_REGISTRATION_SHAPE_INVALID'
    );
  }
  return freezeDescriptor(
    registration.featureCode,
    registration.featureContractRevision
  );
}

/**
 * Server-owned feature registry.
 *
 * Registration happens in server code. Resolution is exact: an unregistered
 * code is `COMPLIANCE_FEATURE_UNKNOWN`, and a registered code with a different
 * revision is `COMPLIANCE_FEATURE_REVISION_STALE` (never a silent fallback).
 */
export class ComplianceFeatureRegistry {
  private readonly revisionByCode: ReadonlyMap<string, string>;

  constructor(registrations: readonly ComplianceFeatureRegistration[]) {
    const revisionByCode = new Map<string, string>();

    for (const registration of registrations) {
      createServerFeatureDescriptor(registration);
      const existing = revisionByCode.get(registration.featureCode);
      if (existing !== undefined && existing !== registration.featureContractRevision) {
        throw new ComplianceFeatureRegistrationError(
          'COMPLIANCE_FEATURE_REGISTRATION_CONFLICT',
          `COMPLIANCE_FEATURE_REGISTRATION_CONFLICT: ${registration.featureCode}`
        );
      }
      revisionByCode.set(registration.featureCode, registration.featureContractRevision);
    }

    this.revisionByCode = revisionByCode;
  }

  /**
   * Resolve a candidate descriptor against this exact registry snapshot.
   * Malformed, unregistered or conflicting input never yields a descriptor.
   */
  resolve(candidate: {
    featureCode: string;
    featureContractRevision: string;
  }): ComplianceFeatureResolution {
    if (
      !isBoundedNonEmpty(candidate.featureCode, 120) ||
      !isBoundedNonEmpty(candidate.featureContractRevision, 64) ||
      !hasValidFeatureShape(candidate)
    ) {
      return { ok: false, reasonCode: 'COMPLIANCE_FEATURE_UNKNOWN' };
    }

    const registeredRevision = this.revisionByCode.get(candidate.featureCode);
    if (registeredRevision === undefined) {
      return { ok: false, reasonCode: 'COMPLIANCE_FEATURE_UNKNOWN' };
    }

    if (registeredRevision !== candidate.featureContractRevision) {
      return { ok: false, reasonCode: 'COMPLIANCE_FEATURE_REVISION_STALE' };
    }

    return {
      ok: true,
      descriptor: freezeDescriptor(candidate.featureCode, candidate.featureContractRevision),
    };
  }

  listRegisteredCodes(): readonly string[] {
    return [...this.revisionByCode.keys()].sort();
  }
}