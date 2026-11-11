/**
 * Slice 9 — TEST-ONLY Safety resolution authority compositions.
 *
 * These sources prove the ResolveRisk transition contract. They are:
 *   - imported exclusively from `tests/**`;
 *   - never exported by `@xiaoshuyin/domain`, the API app, or any route module;
 *   - not composed into `buildApp()`;
 *   - not user-visible and create no staff account, queue, hotline or claim of
 *     human review.
 *
 * This is test evidence for code semantics only (Frozen Spec C5).
 */

import type {
  SafetyResolutionAuthorityResult,
  SafetyResolutionAuthoritySource,
} from '../../packages/domain/src/safety/index.js';

export const TEST_SAFETY_AUTHORITY_REF = 'test-verified-authority';

export function createVerifiedTestSafetyResolutionAuthoritySource(
  authorityRef: string = TEST_SAFETY_AUTHORITY_REF
): SafetyResolutionAuthoritySource {
  return {
    async resolve(): Promise<SafetyResolutionAuthorityResult> {
      return { status: 'VERIFIED', authorityRef };
    },
  };
}

export function createDeniedTestSafetyResolutionAuthoritySource(): SafetyResolutionAuthoritySource {
  return {
    async resolve(): Promise<SafetyResolutionAuthorityResult> {
      return { status: 'DENIED' };
    },
  };
}

export function createUnavailableTestSafetyResolutionAuthoritySource(): SafetyResolutionAuthoritySource {
  return {
    async resolve(): Promise<SafetyResolutionAuthorityResult> {
      return { status: 'UNAVAILABLE' };
    },
  };
}