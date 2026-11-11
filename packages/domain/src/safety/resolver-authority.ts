/**
 * Slice 9 — Safety-resolution authority fact source (plan §8.3).
 *
 * This is a FACT SOURCE, not a second authorization engine: its output feeds
 * the single `authorize()` decision. Frozen Spec §8.3 / C4:
 *
 *   - current authoritative Docs define NO concrete production resolver role;
 *   - Family manager / guardian / participant / ordinary Account must never be
 *     mapped to that authority by invention;
 *   - therefore the production source returns `UNAVAILABLE` for every caller,
 *     which makes `CASE_RESOLVE_RISK` deny by default.
 *
 * A controlled test composition may supply a `VERIFIED` fact to prove the
 * transition contract. That composition is test-only: it is not exported by
 * the production app, not route-accessible and not user-visible.
 */

export type SafetyResolutionAuthorityResult =
  | { status: 'VERIFIED'; authorityRef: string }
  | { status: 'DENIED' }
  | { status: 'UNAVAILABLE' };

export interface SafetyResolutionAuthorityInput {
  familyId: string;
  caseId: string;
  accountId: string;
  personId: string;
}

/** Port implemented by composition, not by business commands. */
export interface SafetyResolutionAuthoritySource {
  resolve(
    input: SafetyResolutionAuthorityInput
  ): Promise<SafetyResolutionAuthorityResult>;
}

/**
 * Production composition: no approved resolver authority exists, so no caller
 * receives a verified capability. This is the deny-by-default posture required
 * by FR-014.
 */
export function createProductionSafetyResolutionAuthoritySource(): SafetyResolutionAuthoritySource {
  return {
    async resolve(): Promise<SafetyResolutionAuthorityResult> {
      return { status: 'UNAVAILABLE' };
    },
  };
}