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
import {
  createProductionSafetyResolutionAuthoritySource,
} from '../../packages/domain/src/safety/index.js';

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
  it('registers both Safety actions through the single authorization entry', () => {
    expect(authorize(input('CASE_ENTER_SAFETY_HOLD')).decision).toBe('ALLOW');
    expect(
      authorize(
        input('CASE_RESOLVE_RISK', {
          facts: facts({ safetyResolution: { verified: true, authorityRef: 'authority.ref' } }),
        })
      ).decision
    ).toBe('ALLOW');
  });

  it('allows Enter for a family manager without any resolver capability', () => {
    const decision = authorize(
      input('CASE_ENTER_SAFETY_HOLD', { facts: facts({ safetyResolution: null }) })
    );
    expect(decision.decision).toBe('ALLOW');
  });

  it('denies Resolve for manager / guardian / member alone', () => {
    // manager
    expect(
      authorize(input('CASE_RESOLVE_RISK', { facts: facts({ safetyResolution: null }) }))
    ).toEqual({ decision: 'DENY', reason: 'NOT_SAFETY_RESOLVER' });

    // guardian-only (not manager), still a member
    expect(
      authorize(
        input('CASE_RESOLVE_RISK', {
          facts: facts({
            familyCreatedByPersonId: 'someone-else',
            guardianPersonId: MANAGER_PERSON,
            safetyResolution: null,
          }),
        })
      ).decision
    ).toBe('DENY');

    // plain member
    expect(
      authorize(
        input('CASE_RESOLVE_RISK', {
          facts: facts({ familyCreatedByPersonId: 'someone-else', safetyResolution: null }),
        })
      ).decision
    ).toBe('DENY');
  });

  it('denies Resolve for a capability fact that is not verified or has no authority ref', () => {
    for (const safetyResolution of [
      { verified: false, authorityRef: 'authority.ref' },
      { verified: true, authorityRef: '' },
      { verified: true, authorityRef: '   ' },
    ]) {
      expect(
        authorize(input('CASE_RESOLVE_RISK', { facts: facts({ safetyResolution }) })).decision
      ).toBe('DENY');
    }
  });

  it('never infers resolver authority from a role-like string', () => {
    for (const pseudo of ['FAMILY_MANAGER', 'GUARDIAN', 'ADMIN', 'STAFF', 'SYSTEM', 'AI']) {
      expect(
        authorize(
          input('CASE_RESOLVE_RISK', {
            facts: facts({ safetyResolution: { verified: true, authorityRef: pseudo } }),
            actor: { accountId: 'acct', personId: MANAGER_PERSON },
          })
        ).decision
      ).toBe('ALLOW');
    }
    // The above proves the authority is the *fact*, not a role name: with no
    // fact the same actor is denied.
    expect(
      authorize(input('CASE_RESOLVE_RISK', { facts: facts({ safetyResolution: null }) })).decision
    ).toBe('DENY');
  });

  it('has no actor path for a model/system principal', () => {
    expect(
      authorize(
        input('CASE_RESOLVE_RISK', {
          actor: {},
          facts: facts({ safetyResolution: { verified: true, authorityRef: 'authority.ref' } }),
        })
      )
    ).toEqual({ decision: 'DENY', reason: 'NO_ACTOR' });
  });

  it('requires Family/Case access for both actions (no shortcut around authorize)', () => {
    for (const action of ['CASE_ENTER_SAFETY_HOLD', 'CASE_RESOLVE_RISK'] as const) {
      const capability =
        action === 'CASE_RESOLVE_RISK'
          ? { verified: true, authorityRef: 'authority.ref' }
          : null;
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
    }
  });

  it('production resolver source never yields a capability', async () => {
    const source = createProductionSafetyResolutionAuthoritySource();
    for (const name of ['manager', 'guardian', 'member', 'admin', 'staff', 'ai']) {
      await expect(
        source.resolve({ familyId: FAMILY_ID, caseId: CASE_ID, accountId: name, personId: name })
      ).resolves.toEqual({ status: 'UNAVAILABLE' });
    }
  });
});