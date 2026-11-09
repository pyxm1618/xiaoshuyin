/**
 * T029 — authorize() Case branch (contracts/authorization-rls-and-idempotency.md §2.2).
 *
 * Fail-closed ordering (Slice 1 Final facts + Case increment):
 *   action registry → purpose registry → actor present → Case branch:
 *     family null → FAMILY_CONTEXT_REQUIRED
 *     purpose != FAMILY_MANAGEMENT → UNSUPPORTED_PURPOSE
 *     facts.membership false → NOT_FAMILY_MEMBER
 *     facts.familyCreatedByPersonId missing / mismatch → NOT_FAMILY_MANAGER
 *     CASE_CREATE|CASE_LIST + case != null → UNSUPPORTED_DIMENSION
 *     CASE_CREATE|CASE_LIST + resource != FAMILY(familyId) → NOT_FAMILY_MEMBER
 *     CASE_READ + case == null → CASE_CONTEXT_REQUIRED
 *     CASE_READ + resource != CASE(familyId, caseId) → NOT_FAMILY_MEMBER
 *     otherwise ALLOW { membership: true, manager: true, purpose }
 */

import { describe, it, expect } from 'vitest';
import {
  authorize,
  type AuthInput,
  type AuthorizeFacts,
} from '../../packages/authorization/src/authorize.js';

const ACTOR = { accountId: 'acc-1', personId: 'person-1' };
const OTHER = 'person-2';

const MANAGER_FACTS: AuthorizeFacts = {
  membership: true,
  familyCreatedByPersonId: ACTOR.personId,
  actorAgeBand: null,
  guardianPersonId: null,
  targetIsFamilyMember: false,
  familyId: 'fam-1',
};

const ALLOW_MANAGER = {
  decision: 'ALLOW',
  basis: { membership: true, manager: true, purpose: 'FAMILY_MANAGEMENT' },
} as const;

function input(over: Partial<AuthInput> = {}): AuthInput {
  return {
    actor: ACTOR,
    product: 'V1',
    family: { familyId: 'fam-1' },
    case: null,
    resource: { type: 'FAMILY', familyId: 'fam-1' },
    action: 'CASE_CREATE',
    purpose: 'FAMILY_MANAGEMENT',
    facts: MANAGER_FACTS,
    ...over,
  };
}

describe('authorize() — Case actions (T029)', () => {
  it('CASE_CREATE allows the Family management subject', () => {
    expect(authorize(input())).toEqual(ALLOW_MANAGER);
  });

  it('CASE_LIST allows the Family management subject', () => {
    expect(authorize(input({ action: 'CASE_LIST' }))).toEqual(ALLOW_MANAGER);
  });

  it('CASE_READ allows the Family management subject with a case context', () => {
    expect(
      authorize(
        input({
          action: 'CASE_READ',
          case: { caseId: 'case-1' },
          resource: { type: 'CASE', familyId: 'fam-1', caseId: 'case-1' },
        })
      )
    ).toEqual(ALLOW_MANAGER);
  });

  it('denies a plain family member (not the creator) with NOT_FAMILY_MANAGER', () => {
    expect(
      authorize(input({ facts: { ...MANAGER_FACTS, familyCreatedByPersonId: OTHER } }))
    ).toEqual({ decision: 'DENY', reason: 'NOT_FAMILY_MANAGER' });
  });

  it('denies when facts are absent (fail-closed, membership never assumed)', () => {
    const { facts: _facts, ...withoutFacts } = input();
    expect(authorize(withoutFacts as AuthInput)).toEqual({
      decision: 'DENY',
      reason: 'NOT_FAMILY_MEMBER',
    });
  });

  it('denies when createdByPersonId is missing (fail-closed)', () => {
    expect(
      authorize(input({ facts: { ...MANAGER_FACTS, familyCreatedByPersonId: null } }))
    ).toEqual({ decision: 'DENY', reason: 'NOT_FAMILY_MANAGER' });
  });

  it('denies when facts.membership is false (RLS visibility is not authorization)', () => {
    expect(authorize(input({ facts: { ...MANAGER_FACTS, membership: false } }))).toEqual({
      decision: 'DENY',
      reason: 'NOT_FAMILY_MEMBER',
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

  it('denies CASE_CREATE / CASE_LIST with a non-FAMILY resource', () => {
    for (const action of ['CASE_CREATE', 'CASE_LIST'] as const) {
      expect(
        authorize(
          input({
            action,
            resource: { type: 'CASE', familyId: 'fam-1', caseId: 'case-1' },
          })
        )
      ).toEqual({ decision: 'DENY', reason: 'NOT_FAMILY_MEMBER' });
    }
  });

  it('denies CASE_CREATE / CASE_LIST whose resource family id does not match', () => {
    for (const action of ['CASE_CREATE', 'CASE_LIST'] as const) {
      expect(
        authorize(input({ action, resource: { type: 'FAMILY', familyId: 'fam-2' } }))
      ).toEqual({ decision: 'DENY', reason: 'NOT_FAMILY_MEMBER' });
    }
  });

  it('requires a case context for CASE_READ', () => {
    expect(authorize(input({ action: 'CASE_READ', case: null }))).toEqual({
      decision: 'DENY',
      reason: 'CASE_CONTEXT_REQUIRED',
    });
  });

  it('denies CASE_READ when resource is not CASE', () => {
    expect(
      authorize(input({ action: 'CASE_READ', case: { caseId: 'case-1' } }))
    ).toEqual({ decision: 'DENY', reason: 'NOT_FAMILY_MEMBER' });
  });

  it('denies CASE_READ when resource family id does not match', () => {
    expect(
      authorize(
        input({
          action: 'CASE_READ',
          case: { caseId: 'case-1' },
          resource: { type: 'CASE', familyId: 'fam-2', caseId: 'case-1' },
        })
      )
    ).toEqual({ decision: 'DENY', reason: 'NOT_FAMILY_MEMBER' });
  });

  it('denies CASE_READ when resource case id does not match the case dimension', () => {
    expect(
      authorize(
        input({
          action: 'CASE_READ',
          case: { caseId: 'case-1' },
          resource: { type: 'CASE', familyId: 'fam-1', caseId: 'case-2' },
        })
      )
    ).toEqual({ decision: 'DENY', reason: 'NOT_FAMILY_MEMBER' });
  });

  it('keeps Slice 1 behavior: non-Case actions reject a case dimension', () => {
    expect(
      authorize(
        input({
          action: 'FAMILY_READ',
          resource: { type: 'FAMILY', familyId: 'fam-1' },
          case: { caseId: 'case-1' },
        })
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