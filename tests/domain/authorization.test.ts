/**
 * T035/T036 + final-audit remediation (HIGH-01): authorize() contract tests.
 *
 * These tests pin the frozen contract in
 * `specs/001-family-identity-core/contracts/authorization-and-rls.md` §2:
 * real fact-based decisions, fail-closed defaults, structured resources,
 * and independent manager / guardian / age-band dimensions.
 */

import { describe, it, expect } from 'vitest';
import {
  authorize,
  isFamilyManager,
  type AuthorizeFacts,
  type Resource,
} from '../../packages/authorization/src/authorize.js';

const actor = { accountId: 'a1', personId: 'p1' };

function facts(overrides: Partial<AuthorizeFacts> = {}): AuthorizeFacts {
  return {
    membership: true,
    familyCreatedByPersonId: 'p1',
    actorAgeBand: 'ADULT',
    guardianPersonId: 'p1',
    targetIsFamilyMember: true,
    ...overrides,
  };
}

function baseInput(action: Parameters<typeof authorize>[0]['action'], resource: Resource) {
  return {
    actor,
    product: 'V1' as const,
    family: { familyId: 'f1' },
    case: null,
    resource,
    action,
    purpose: 'FAMILY_MANAGEMENT' as const,
    facts: facts(),
  };
}

describe('Authorization fail-closed (T035)', () => {
  it('case !== null → UNSUPPORTED_DIMENSION', () => {
    const r = authorize({ ...baseInput('FAMILY_READ', { type: 'FAMILY', familyId: 'f1' }), case: {} as never });
    expect(r).toEqual({ decision: 'DENY', reason: 'UNSUPPORTED_DIMENSION' });
  });

  it('unknown action → UNSUPPORTED_ACTION', () => {
    const r = authorize({ ...baseInput('FAMILY_READ', { type: 'FAMILY', familyId: 'f1' }), action: 'UNKNOWN_ACTION' as never });
    expect(r).toEqual({ decision: 'DENY', reason: 'UNSUPPORTED_ACTION' });
  });

  it('unknown purpose → UNSUPPORTED_PURPOSE', () => {
    const r = authorize({ ...baseInput('FAMILY_READ', { type: 'FAMILY', familyId: 'f1' }), purpose: 'UNKNOWN' as never });
    expect(r).toEqual({ decision: 'DENY', reason: 'UNSUPPORTED_PURPOSE' });
  });

  it('missing actor → NO_ACTOR', () => {
    const r = authorize({
      ...baseInput('FAMILY_READ', { type: 'FAMILY', familyId: 'f1' }),
      actor: { accountId: '', personId: '' },
    });
    expect(r).toEqual({ decision: 'DENY', reason: 'NO_ACTOR' });
  });

  it('family action with null family → FAMILY_CONTEXT_REQUIRED', () => {
    const r = authorize({ ...baseInput('FAMILY_READ', { type: 'FAMILY', familyId: 'f1' }), family: null });
    expect(r).toEqual({ decision: 'DENY', reason: 'FAMILY_CONTEXT_REQUIRED' });
  });

  it('family-scoped action without facts → denied (never assumed)', () => {
    const r = authorize({
      actor,
      product: 'V1',
      family: { familyId: 'f1' },
      case: null,
      resource: { type: 'FAMILY', familyId: 'f1' },
      action: 'FAMILY_READ',
      purpose: 'FAMILY_MANAGEMENT',
    });
    expect(r).toEqual({ decision: 'DENY', reason: 'NOT_FAMILY_MEMBER' });
  });
});

describe('IDENTITY_SELF_READ', () => {
  it('allows reading own identity', () => {
    const r = authorize({
      ...baseInput('IDENTITY_SELF_READ', { type: 'SELF', personId: 'p1' }),
      family: null,
      purpose: 'SELF_IDENTITY',
    });
    expect(r).toEqual({
      decision: 'ALLOW',
      basis: { membership: true, manager: false, purpose: 'SELF_IDENTITY' },
    });
  });

  it('resource person mismatch → denied', () => {
    const r = authorize({
      ...baseInput('IDENTITY_SELF_READ', { type: 'SELF', personId: 'p2' }),
      family: null,
      purpose: 'SELF_IDENTITY',
    });
    expect(r.decision).toBe('DENY');
  });

  it('non-SELF resource → denied', () => {
    const r = authorize({
      ...baseInput('IDENTITY_SELF_READ', { type: 'FAMILY', familyId: 'f1' }),
      family: null,
      purpose: 'SELF_IDENTITY',
    });
    expect(r.decision).toBe('DENY');
  });
});

describe('FAMILY_CREATE', () => {
  it('allows when the persisted creator fact equals the actor', () => {
    const r = authorize({
      ...baseInput('FAMILY_CREATE', { type: 'FAMILY', familyId: 'f1' }),
      facts: facts({ membership: false, familyCreatedByPersonId: 'p1' }),
    });
    expect(r.decision).toBe('ALLOW');
    expect(r.decision === 'ALLOW' && r.basis.manager).toBe(true);
  });

  it('denies when the creator fact belongs to someone else', () => {
    const r = authorize({
      ...baseInput('FAMILY_CREATE', { type: 'FAMILY', familyId: 'f1' }),
      facts: facts({ membership: false, familyCreatedByPersonId: 'p2' }),
    });
    expect(r).toEqual({ decision: 'DENY', reason: 'NOT_FAMILY_MANAGER' });
  });

  it('denies when no creator fact is available', () => {
    const r = authorize({
      actor,
      product: 'V1',
      family: null,
      case: null,
      resource: { type: 'FAMILY', familyId: 'f1' },
      action: 'FAMILY_CREATE',
      purpose: 'FAMILY_MANAGEMENT',
    });
    expect(r).toEqual({ decision: 'DENY', reason: 'NOT_FAMILY_MANAGER' });
  });
});

describe('FAMILY_READ', () => {
  it('allows a member and reports real manager=false', () => {
    const r = authorize({
      ...baseInput('FAMILY_READ', { type: 'FAMILY', familyId: 'f1' }),
      facts: facts({ membership: true, familyCreatedByPersonId: 'p2' }),
    });
    expect(r.decision).toBe('ALLOW');
    expect(r.decision === 'ALLOW' && r.basis.manager).toBe(false);
  });

  it('allows the creator and reports real manager=true', () => {
    const r = authorize(baseInput('FAMILY_READ', { type: 'FAMILY', familyId: 'f1' }));
    expect(r.decision).toBe('ALLOW');
    expect(r.decision === 'ALLOW' && r.basis.manager).toBe(true);
  });

  it('non-member → NOT_FAMILY_MEMBER', () => {
    const r = authorize({
      ...baseInput('FAMILY_READ', { type: 'FAMILY', familyId: 'f1' }),
      facts: facts({ membership: false }),
    });
    expect(r).toEqual({ decision: 'DENY', reason: 'NOT_FAMILY_MEMBER' });
  });

  it('resource familyId mismatch → denied', () => {
    const r = authorize(baseInput('FAMILY_READ', { type: 'FAMILY', familyId: 'other' }));
    expect(r.decision).toBe('DENY');
  });
});

describe('MEMBER_CREATE / MEMBER_UPDATE', () => {
  it('MEMBER_CREATE: manager member allowed', () => {
    const r = authorize(baseInput('MEMBER_CREATE', { type: 'FAMILY', familyId: 'f1' }));
    expect(r.decision).toBe('ALLOW');
    expect(r.decision === 'ALLOW' && r.basis.manager).toBe(true);
  });

  it('MEMBER_CREATE: non-manager member denied', () => {
    const r = authorize({
      ...baseInput('MEMBER_CREATE', { type: 'FAMILY', familyId: 'f1' }),
      facts: facts({ familyCreatedByPersonId: 'p2' }),
    });
    expect(r).toEqual({ decision: 'DENY', reason: 'NOT_FAMILY_MANAGER' });
  });

  it('MEMBER_CREATE: non-member denied even if manager fact matches', () => {
    const r = authorize({
      ...baseInput('MEMBER_CREATE', { type: 'FAMILY', familyId: 'f1' }),
      facts: facts({ membership: false }),
    });
    expect(r).toEqual({ decision: 'DENY', reason: 'NOT_FAMILY_MEMBER' });
  });

  it('MEMBER_UPDATE: requires target really in the family', () => {
    const r = authorize({
      ...baseInput('MEMBER_UPDATE', { type: 'MEMBER', familyId: 'f1', personId: 'p9' }),
      facts: facts({ targetIsFamilyMember: false }),
    });
    expect(r).toEqual({ decision: 'DENY', reason: 'NOT_FAMILY_MEMBER' });
  });

  it('MEMBER_UPDATE: target mismatch and target member allowed path', () => {
    const mismatch = authorize(
      baseInput('MEMBER_UPDATE', { type: 'MEMBER', familyId: 'other', personId: 'p9' })
    );
    expect(mismatch.decision).toBe('DENY');

    const allowed = authorize(
      baseInput('MEMBER_UPDATE', { type: 'MEMBER', familyId: 'f1', personId: 'p9' })
    );
    expect(allowed.decision).toBe('ALLOW');
  });
});

describe('GUARDIAN_CONSENT_REQUEST (membership + manager + ADULT)', () => {
  const input = (ageBand: AuthorizeFacts['actorAgeBand'], createdBy = 'p1') =>
    authorize({
      ...baseInput('GUARDIAN_CONSENT_REQUEST', { type: 'FAMILY', familyId: 'f1' }),
      purpose: 'GUARDIAN_CONSENT',
      facts: facts({ actorAgeBand: ageBand, familyCreatedByPersonId: createdBy }),
    });

  it('ADULT manager → allowed', () => {
    expect(input('ADULT').decision).toBe('ALLOW');
  });

  it('non-manager member → NOT_FAMILY_MANAGER', () => {
    expect(input('ADULT', 'p2')).toEqual({ decision: 'DENY', reason: 'NOT_FAMILY_MANAGER' });
  });

  it('manager with missing profile → AGE_BAND_UNKNOWN', () => {
    expect(input(null)).toEqual({ decision: 'DENY', reason: 'AGE_BAND_UNKNOWN' });
  });

  it('MINOR_14_17 → denied', () => {
    expect(input('MINOR_14_17')).toEqual({ decision: 'DENY', reason: 'AGE_BAND_UNKNOWN' });
  });

  it('UNDER_14 → denied', () => {
    expect(input('UNDER_14')).toEqual({ decision: 'DENY', reason: 'AGE_BAND_UNKNOWN' });
  });

  it('UNKNOWN → denied (never treated as ADULT)', () => {
    expect(input('UNKNOWN')).toEqual({ decision: 'DENY', reason: 'AGE_BAND_UNKNOWN' });
  });
});

describe('GUARDIAN_CONSENT_GRANT / REVOKE (guardian is its own dimension)', () => {
  it('guardian matching the consent row → allowed', () => {
    const r = authorize({
      ...baseInput('GUARDIAN_CONSENT_GRANT', { type: 'CONSENT', familyId: 'f1', consentId: 'c1' }),
      purpose: 'GUARDIAN_CONSENT',
    });
    expect(r.decision).toBe('ALLOW');
  });

  it('member but not guardian → NOT_GUARDIAN', () => {
    const r = authorize({
      ...baseInput('GUARDIAN_CONSENT_GRANT', { type: 'CONSENT', familyId: 'f1', consentId: 'c1' }),
      purpose: 'GUARDIAN_CONSENT',
      facts: facts({ guardianPersonId: 'p2' }),
    });
    expect(r).toEqual({ decision: 'DENY', reason: 'NOT_GUARDIAN' });
  });

  it('guardian fact missing → NOT_GUARDIAN', () => {
    const r = authorize({
      ...baseInput('GUARDIAN_CONSENT_REVOKE', { type: 'CONSENT', familyId: 'f1', consentId: 'c1' }),
      purpose: 'GUARDIAN_CONSENT',
      facts: facts({ guardianPersonId: null }),
    });
    expect(r).toEqual({ decision: 'DENY', reason: 'NOT_GUARDIAN' });
  });

  it('non-member → NOT_FAMILY_MEMBER (membership cannot be replaced by guardian)', () => {
    const r = authorize({
      ...baseInput('GUARDIAN_CONSENT_REVOKE', { type: 'CONSENT', familyId: 'f1', consentId: 'c1' }),
      purpose: 'GUARDIAN_CONSENT',
      facts: facts({ membership: false }),
    });
    expect(r).toEqual({ decision: 'DENY', reason: 'NOT_FAMILY_MEMBER' });
  });

  it('business manager status alone is not guardian authority', () => {
    const r = authorize({
      ...baseInput('GUARDIAN_CONSENT_GRANT', { type: 'CONSENT', familyId: 'f1', consentId: 'c1' }),
      purpose: 'GUARDIAN_CONSENT',
      facts: facts({ guardianPersonId: 'p2', familyCreatedByPersonId: 'p1' }),
    });
    expect(r).toEqual({ decision: 'DENY', reason: 'NOT_GUARDIAN' });
  });
});

describe('MINOR_PROCESSING + isFamilyManager', () => {
  it('MINOR_PROCESSING delegates to the processing gate (authorize allows)', () => {
    const r = authorize({
      ...baseInput('MINOR_PROCESSING', { type: 'MEMBER', familyId: 'f1', personId: 'p9' }),
      facts: facts({ membership: false }),
    });
    expect(r.decision).toBe('ALLOW');
  });

  it('isFamilyManager: creator is manager', () => {
    expect(isFamilyManager({ id: 'f1', createdByPersonId: 'p1' }, 'p1')).toBe(true);
  });

  it('isFamilyManager: non-creator is not manager', () => {
    expect(isFamilyManager({ id: 'f1', createdByPersonId: 'p1' }, 'p2')).toBe(false);
  });
});