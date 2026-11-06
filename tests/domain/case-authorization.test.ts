/**
 * T029 — authorize() Case branch (contracts/authorization-rls-and-idempotency.md §2.2).
 *
 * Fail-closed ordering:
 *   action registry → purpose registry → case branch:
 *     family null → FAMILY_CONTEXT_REQUIRED
 *     purpose != FAMILY_MANAGEMENT → UNSUPPORTED_PURPOSE
 *     createdByPersonId missing / mismatch → NOT_FAMILY_MANAGER
 *     CASE_CREATE|CASE_LIST + case != null → UNSUPPORTED_DIMENSION
 *     CASE_READ + case == null → CASE_CONTEXT_REQUIRED
 *     otherwise ALLOW { manager: true }
 */

import { describe, it, expect } from 'vitest';
import { authorize, type AuthInput } from '../../packages/authorization/src/authorize.js';

const ACTOR = { accountId: 'acc-1', personId: 'person-1' };
const OTHER = 'person-2';

function input(over: Partial<AuthInput> = {}): AuthInput {
  return {
    actor: ACTOR,
    product: 'V1',
    family: { familyId: 'fam-1', createdByPersonId: ACTOR.personId },
    case: null,
    resource: 'CASE',
    action: 'CASE_CREATE',
    purpose: 'FAMILY_MANAGEMENT',
    ...over,
  };
}

describe('authorize() — Case actions (T029)', () => {
  it('CASE_CREATE allows the Family management subject', () => {
    expect(authorize(input())).toEqual({ decision: 'ALLOW', basis: { manager: true } });
  });

  it('CASE_LIST allows the Family management subject', () => {
    expect(authorize(input({ action: 'CASE_LIST' }))).toEqual({
      decision: 'ALLOW',
      basis: { manager: true },
    });
  });

  it('CASE_READ allows the Family management subject with a case context', () => {
    expect(
      authorize(input({ action: 'CASE_READ', case: { caseId: 'case-1' } }))
    ).toEqual({ decision: 'ALLOW', basis: { manager: true } });
  });

  it('denies a plain family member (not the creator) with NOT_FAMILY_MANAGER', () => {
    expect(
      authorize(input({ family: { familyId: 'fam-1', createdByPersonId: OTHER } }))
    ).toEqual({ decision: 'DENY', reason: 'NOT_FAMILY_MANAGER' });
  });

  it('denies when createdByPersonId is missing (fail-closed)', () => {
    expect(authorize(input({ family: { familyId: 'fam-1' } }))).toEqual({
      decision: 'DENY',
      reason: 'NOT_FAMILY_MANAGER',
    });
  });

  it('denies without family context', () => {
    expect(authorize(input({ family: null }))).toEqual({
      decision: 'DENY',
      reason: 'FAMILY_CONTEXT_REQUIRED',
    });
  });

  it('denies Case actions outside FAMILY_MANAGEMENT purpose', () => {
    expect(authorize(input({ purpose: 'GUARDIAN_CONSENT' }))).toEqual({
      decision: 'DENY',
      reason: 'UNSUPPORTED_PURPOSE',
    });
  });

  it('denies unknown actions with UNSUPPORTED_ACTION', () => {
    expect(authorize(input({ action: 'CASE_CLOSE' as never }))).toEqual({
      decision: 'DENY',
      reason: 'UNSUPPORTED_ACTION',
    });
  });

  it('denies CASE_CREATE / CASE_LIST carrying a case dimension', () => {
    for (const action of ['CASE_CREATE', 'CASE_LIST'] as const) {
      expect(authorize(input({ action, case: { caseId: 'case-1' } }))).toEqual({
        decision: 'DENY',
        reason: 'UNSUPPORTED_DIMENSION',
      });
    }
  });

  it('requires a case context for CASE_READ', () => {
    expect(authorize(input({ action: 'CASE_READ', case: null }))).toEqual({
      decision: 'DENY',
      reason: 'CASE_CONTEXT_REQUIRED',
    });
  });

  it('keeps Slice 1 behavior: non-Case actions reject a case dimension', () => {
    expect(
      authorize(
        input({ action: 'FAMILY_READ', resource: 'FAMILY', case: { caseId: 'case-1' } })
      )
    ).toEqual({ decision: 'DENY', reason: 'UNSUPPORTED_DIMENSION' });
  });

  it('normalizes unexpected exceptions to AUTHORIZATION_ERROR', () => {
    const hostile = {
      get action(): AuthInput['action'] {
        throw new Error('boom');
      },
    } as unknown as AuthInput;
    expect(authorize(hostile)).toEqual({ decision: 'DENY', reason: 'AUTHORIZATION_ERROR' });
  });
});
