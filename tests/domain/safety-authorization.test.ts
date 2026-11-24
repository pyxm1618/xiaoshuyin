/**
 * T906 — Safety authorization vocabulary and production fail-closed posture.
 *
 * Pure `authorize()` matrix: Enter is a Case-access action gated by the trusted
 * deterministic decision; Resolve additionally requires a separately verified
 * capability fact that no Family role can produce.
 */

import { describe, it, expect } from 'vitest';
import {
  authorize,
  type AuthInput,
  type AuthorizeFacts,
} from '../../packages/authorization/src/authorize.js';
const FAMILY_ID = '11111111-1111-1111-1111-111111111111';
const CASE_ID = '22222222-2222-2222-2222-222222222222';
const MANAGER_PERSON = '33333333-3333-3333-3333-333333333333';

function facts(over: Partial<AuthorizeFacts> = {}): AuthorizeFacts {
  return {
    membership: true,
    familyCreatedByPersonId: MANAGER_PERSON,
    actorAgeBand: 'ADULT',
    guardianPersonId: null,
    targetIsFamilyMember: true,
    familyId: FAMILY_ID,
    ...over,
  };
}

function resolverFact(over: Record<string, unknown> = {}) {
  return {
    verified: true,
    authorityRef: 'staff_assignment:aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    capability: 'SAFETY_RESOLVE',
    capabilityGrantId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    assignmentId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    familyId: FAMILY_ID,
    caseId: CASE_ID,
    accountId: 'staff-account',
    personId: 'staff-person',
    ...over,
  };
}

function input(action: AuthInput['action'], over: Partial<AuthInput> = {}): AuthInput {
  return {
    actor: { accountId: 'acct', personId: MANAGER_PERSON },
    product: 'V1',
    family: { familyId: FAMILY_ID },
    case: { caseId: CASE_ID },
    resource: { type: 'CASE', familyId: FAMILY_ID, caseId: CASE_ID },
    action,
    purpose: 'FAMILY_MANAGEMENT',
    facts: facts(),
    ...over,
  };
}

describe('Safety authorization vocabulary (T906)', () => {
  it('denies direct business authorization for CASE_ENTER_SAFETY_HOLD (Finding #14)', () => {
    // Hold entry is a system-level transition triggered by deterministic evaluation,
    // not a user-initiated business action. Family Managers cannot directly request hold.
    expect(authorize(input('CASE_ENTER_SAFETY_HOLD'))).toEqual({
      decision: 'DENY',
      reason: 'UNSUPPORTED_ACTION',
    });
  });

  it('registers CASE_RESOLVE_RISK through the single authorization entry', () => {
    const decision = authorize(
      input('CASE_RESOLVE_RISK', {
        actor: { accountId: 'staff-account', personId: 'staff-person' },
        purpose: 'SAFETY_RESOLUTION',
        facts: facts({
          membership: false,
          familyCreatedByPersonId: 'someone-else',
          safetyResolution: resolverFact(),
        }),
      })
    );
    expect(decision).toEqual({
      decision: 'ALLOW',
      basis: {
        membership: false,
        manager: false,
        purpose: 'SAFETY_RESOLUTION',
        authority: 'SAFETY_RESOLVER',
      },
    });
  });

  it('denies Resolve for Family Manager / guardian / ordinary member / ordinary Account alone', () => {
    expect(
      authorize(input('CASE_RESOLVE_RISK', { facts: facts({ safetyResolution: null }) }))
    ).toEqual({ decision: 'DENY', reason: 'NOT_SAFETY_RESOLVER' });

    expect(
      authorize(
        input('CASE_RESOLVE_RISK', {
          facts: facts({
            familyCreatedByPersonId: 'someone-else',
            guardianPersonId: MANAGER_PERSON,
            safetyResolution: null,
          }),
        })
      )
    ).toEqual({ decision: 'DENY', reason: 'NOT_SAFETY_RESOLVER' });

    expect(
      authorize(
        input('CASE_RESOLVE_RISK', {
          facts: facts({
            familyCreatedByPersonId: 'someone-else',
            safetyResolution: null,
          }),
        })
      )
    ).toEqual({ decision: 'DENY', reason: 'NOT_SAFETY_RESOLVER' });

    expect(
      authorize(
        input('CASE_RESOLVE_RISK', {
          actor: { accountId: 'ordinary-account', personId: 'ordinary-person' },
          facts: facts({
            membership: false,
            familyCreatedByPersonId: 'someone-else',
            safetyResolution: null,
          }),
        })
      )
    ).toEqual({ decision: 'DENY', reason: 'NOT_SAFETY_RESOLVER' });
  });

  it('requires the exact SAFETY_RESOLVE capability, reviewer identity and Case scope', () => {
    const staffInput = (safetyResolution: ReturnType<typeof resolverFact>) =>
      input('CASE_RESOLVE_RISK', {
        actor: { accountId: 'staff-account', personId: 'staff-person' },
        purpose: 'SAFETY_RESOLUTION',
        facts: facts({
          membership: false,
          familyCreatedByPersonId: 'someone-else',
          safetyResolution,
        }),
      });

    for (const invalid of [
      resolverFact({ verified: false }),
      resolverFact({ authorityRef: '' }),
      resolverFact({ capability: 'SAFETY_REVIEW' }),
      resolverFact({ familyId: 'other-family' }),
      resolverFact({ caseId: 'other-case' }),
      resolverFact({ accountId: 'other-account' }),
      resolverFact({ personId: 'other-person' }),
      resolverFact({ assignmentId: '' }),
      resolverFact({ capabilityGrantId: '' }),
    ]) {
      expect(authorize(staffInput(invalid))).toEqual({
        decision: 'DENY',
        reason: 'NOT_SAFETY_RESOLVER',
      });
    }
  });

  it('never promotes role-like strings or AI/candidate principals into resolver authority', () => {
    const roleLike = {
      verified: true,
      authorityRef: 'ADMIN',
    };
    expect(
      authorize(
        input('CASE_RESOLVE_RISK', {
          facts: facts({ safetyResolution: roleLike }),
        })
      )
    ).toEqual({ decision: 'DENY', reason: 'NOT_SAFETY_RESOLVER' });

    expect(
      authorize(
        input('CASE_RESOLVE_RISK', {
          actor: {
            kind: 'WECHAT_CANDIDATE',
            accountId: 'staff-account',
            personId: 'staff-person',
            candidateIdentityDigest: 'a'.repeat(64),
          },
          purpose: 'SAFETY_RESOLUTION',
          facts: facts({
            membership: false,
            familyCreatedByPersonId: 'someone-else',
            safetyResolution: resolverFact(),
          }),
        })
      )
    ).toEqual({ decision: 'DENY', reason: 'NO_ACTOR' });

    expect(
      authorize(
        input('CASE_RESOLVE_RISK', {
          actor: {},
          facts: facts({ safetyResolution: resolverFact() }),
        })
      )
    ).toEqual({ decision: 'DENY', reason: 'NO_ACTOR' });
  });

  it('requires Family/Case access for CASE_RESOLVE_RISK (no shortcut around authorize)', () => {
    const action = 'CASE_RESOLVE_RISK' as const;
    const capability = { verified: true, authorityRef: 'authority.ref' };
    expect(
      authorize(
        input(action, {
          family: null,
          facts: facts({ safetyResolution: capability }),
        })
      )
    ).toEqual({ decision: 'DENY', reason: 'FAMILY_CONTEXT_REQUIRED' });

    expect(
      authorize(
        input(action, {
          resource: { type: 'CASE', familyId: 'other-family', caseId: CASE_ID },
          facts: facts({ safetyResolution: capability }),
        })
      ).decision
    ).toBe('DENY');

    expect(
      authorize(
        input(action, {
          facts: facts({ membership: false, safetyResolution: capability }),
        })
      ).decision
    ).toBe('DENY');
  });

});