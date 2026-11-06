import { describe, it, expect } from 'vitest';
import { authorize, isFamilyManager } from '../../packages/authorization/src/authorize.js';

describe('Authorization (T035/T036)', () => {
  const actor = { accountId: 'a1', personId: 'p1' };
  const baseInput = {
    actor,
    product: 'V1' as const,
    family: { familyId: 'f1' },
    case: null,
    resource: 'FAMILY' as const,
    purpose: 'FAMILY_MANAGEMENT' as const,
  };

  it('case !== null → UNSUPPORTED_DIMENSION', () => {
    const r = authorize({ ...baseInput, case: {} as any, action: 'FAMILY_READ' });
    expect(r).toEqual({ decision: 'DENY', reason: 'UNSUPPORTED_DIMENSION' });
  });

  it('unknown action → UNSUPPORTED_ACTION', () => {
    const r = authorize({ ...baseInput, action: 'UNKNOWN_ACTION' as any });
    expect(r).toEqual({ decision: 'DENY', reason: 'UNSUPPORTED_ACTION' });
  });

  it('unknown purpose → UNSUPPORTED_PURPOSE', () => {
    const r = authorize({ ...baseInput, purpose: 'UNKNOWN' as any, action: 'FAMILY_READ' });
    expect(r).toEqual({ decision: 'DENY', reason: 'UNSUPPORTED_PURPOSE' });
  });

  it('family action with null family → FAMILY_CONTEXT_REQUIRED', () => {
    const r = authorize({ ...baseInput, family: null, action: 'FAMILY_READ' });
    expect(r).toEqual({ decision: 'DENY', reason: 'FAMILY_CONTEXT_REQUIRED' });
  });

  it('IDENTITY_SELF_READ is allowed', () => {
    const r = authorize({ ...baseInput, family: null, action: 'IDENTITY_SELF_READ' });
    expect(r.decision).toBe('ALLOW');
  });

  it('isFamilyManager: creator is manager', () => {
    expect(isFamilyManager({ id: 'f1', createdByPersonId: 'p1' }, 'p1')).toBe(true);
  });

  it('isFamilyManager: non-creator is not manager', () => {
    expect(isFamilyManager({ id: 'f1', createdByPersonId: 'p1' }, 'p2')).toBe(false);
  });

  it('guardian and membership are independent (pure function test)', () => {
    // authorize does not read guardian relationship or membership
    // These are separate dimensions tested at integration level
    const r = authorize({ ...baseInput, action: 'GUARDIAN_CONSENT_GRANT' });
    expect(r.decision).toBe('ALLOW'); // membership assumed verified by RLS
  });
});
