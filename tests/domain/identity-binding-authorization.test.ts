import { describe, it, expect } from 'vitest';
import { authorize, type AuthInput, type AuthorizeFacts } from '../../packages/authorization/src/authorize.js';

const DIGEST = 'a'.repeat(64);

const FAMILY_FACTS: AuthorizeFacts = {
  membership: false,
  familyCreatedByPersonId: 'manager-1',
  actorAgeBand: null,
  guardianPersonId: null,
  targetIsFamilyMember: true,
  targetPersonId: 'p1',
  targetFamilyId: 'fam-1',
  targetAgeBand: 'UNDER_14',
  bindingGuardianPersonId: 'guardian-1',
  bindingFamilyCreatedByPersonId: 'manager-1',
};

function base(overrides: Partial<AuthInput> = {}): AuthInput {
  return {
    actor: { kind: 'ACCOUNT', accountId: 'acct-1', personId: 'guardian-1' },
    product: 'V1',
    family: null,
    case: null,
    resource: { type: 'BINDING', attemptId: 'attempt-1', personId: 'p1' },
    action: 'IDENTITY_BINDING_CONFIRMER_LIST',
    purpose: 'IDENTITY_BINDING',
    facts: FAMILY_FACTS,
    ...overrides,
  };
}

describe('authorize() binding actions', () => {
  it('bootstrap: WECHAT_CANDIDATE allow, ACCOUNT deny', () => {
    expect(
      authorize(
        base({
          actor: { kind: 'WECHAT_CANDIDATE', candidateIdentityDigest: DIGEST },
          action: 'IDENTITY_BINDING_BOOTSTRAP',
        })
      ).decision
    ).toBe('ALLOW');
    expect(
      authorize(
        base({
          actor: { kind: 'ACCOUNT', accountId: 'a', personId: 'p' },
          action: 'IDENTITY_BINDING_BOOTSTRAP',
        })
      )
    ).toEqual({ decision: 'DENY', reason: 'NO_ACTOR' });
  });

  it('candidate actions: BINDING_CONTEXT allow, ACCOUNT deny', () => {
    for (const action of [
      'IDENTITY_BINDING_CANDIDATE_DECIDE',
      'IDENTITY_BINDING_STATUS_SELF',
      'IDENTITY_BINDING_SESSION_EXCHANGE',
    ] as const) {
      expect(
        authorize(
          base({
            actor: { kind: 'BINDING_CONTEXT', contextId: 'ctx-1', candidateIdentityDigest: DIGEST },
            action,
            resource: { type: 'BINDING', attemptId: null, personId: null },
          })
        ).decision
      ).toBe('ALLOW');
      expect(
        authorize(base({ action, resource: { type: 'BINDING', attemptId: null, personId: null } }))
      ).toEqual({ decision: 'DENY', reason: 'BINDING_CONTEXT_INVALID' });
    }
  });

  it('UNDER_14 confirmer must be the current guardian', () => {
    expect(authorize(base()).decision).toBe('ALLOW');
    expect(
      authorize(base({ actor: { kind: 'ACCOUNT', accountId: 'a', personId: 'manager-1' } }))
    ).toEqual({ decision: 'DENY', reason: 'NOT_BINDING_AUTHORIZED_CONFIRMER' });
  });

  it('MINOR_14_17 without guardian falls back to the Family manager only', () => {
    const facts = {
      ...FAMILY_FACTS,
      targetAgeBand: 'MINOR_14_17' as const,
      bindingGuardianPersonId: null,
    };
    expect(
      authorize(base({ actor: { kind: 'ACCOUNT', accountId: 'a', personId: 'manager-1' }, facts }))
        .decision
    ).toBe('ALLOW');
    expect(
      authorize(base({ actor: { kind: 'ACCOUNT', accountId: 'a', personId: 'other' }, facts }))
    ).toEqual({ decision: 'DENY', reason: 'NOT_BINDING_AUTHORIZED_CONFIRMER' });
  });

  it('ADULT / UNKNOWN are never confirmable', () => {
    for (const targetAgeBand of ['ADULT', 'UNKNOWN'] as const) {
      expect(authorize(base({ facts: { ...FAMILY_FACTS, targetAgeBand } }))).toEqual({
        decision: 'DENY',
        reason: 'BINDING_AGE_UNSUPPORTED',
      });
    }
  });

  it('missing facts fail closed; second-party requires attempt id', () => {
    expect(authorize(base({ facts: { membership: false } }))).toEqual({
      decision: 'DENY',
      reason: 'BINDING_TARGET_INVALID',
    });
    expect(
      authorize(
        base({
          action: 'IDENTITY_BINDING_SECOND_PARTY_DECIDE',
          resource: { type: 'BINDING', attemptId: null, personId: 'p1' },
        })
      )
    ).toEqual({ decision: 'DENY', reason: 'BINDING_TARGET_INVALID' });
  });

  it('unregistered purpose / resource / candidate confirmer calls deny', () => {
    expect(authorize(base({ purpose: 'SELF_IDENTITY' }))).toEqual({
      decision: 'DENY',
      reason: 'UNSUPPORTED_PURPOSE',
    });
    expect(
      authorize(base({ resource: { type: 'FAMILY', familyId: 'fam-1' } }))
    ).toEqual({ decision: 'DENY', reason: 'BINDING_TARGET_INVALID' });
    // A BINDING_CONTEXT actor cannot call confirmer actions.
    expect(
      authorize(
        base({ actor: { kind: 'BINDING_CONTEXT', contextId: 'ctx-1', candidateIdentityDigest: DIGEST } })
      )
    ).toEqual({ decision: 'DENY', reason: 'NO_ACTOR' });
  });
});