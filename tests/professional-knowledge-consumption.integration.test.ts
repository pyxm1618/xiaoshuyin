import { describe, expect, it } from 'vitest';
import { authorize } from '../packages/authorization/src/authorize.js';

function decision(overrides: Record<string, unknown> = {}) {
  return authorize({
    actor: { accountId: 'a1', personId: 'p1' },
    product: 'V1',
    family: { familyId: 'f1' },
    case: { caseId: 'c1' },
    resource: { type: 'CASE', familyId: 'f1', caseId: 'c1' },
    action: 'CASE_READ_PROFESSIONAL_KNOWLEDGE',
    purpose: 'PROFESSIONAL_KNOWLEDGE_CONSUMPTION',
    facts: {
      membership: true,
      familyCreatedByPersonId: 'p1',
      actorAgeBand: 'ADULT',
      guardianPersonId: null,
      targetIsFamilyMember: false,
      familyId: 'f1',
    },
    ...overrides,
  } as any);
}

describe('family Professional Knowledge consumption authorization', () => {
  it('allows only exact Family/Case manager consumption context', () => {
    expect(decision().decision).toBe('ALLOW');
  });

  it.each([
    ['wrong purpose', { purpose: 'FAMILY_MANAGEMENT' }],
    ['wrong family', { resource: { type: 'CASE', familyId: 'f2', caseId: 'c1' } }],
    ['wrong case', { resource: { type: 'CASE', familyId: 'f1', caseId: 'c2' } }],
    ['missing case', { case: null }],
  ])('fails closed for %s', (_label, patch) => {
    expect(decision(patch).decision).toBe('DENY');
  });

  it('does not grant any Professional Knowledge administration action', () => {
    expect(
      authorize({
        actor: { accountId: 'a1', personId: 'p1' },
        product: 'V1',
        family: { familyId: 'f1' },
        case: null,
        resource: { type: 'FAMILY', familyId: 'f1' },
        action: 'MEMBER_UPDATE',
        purpose: 'PROFESSIONAL_KNOWLEDGE_CONSUMPTION',
        facts: {
          membership: true,
          familyCreatedByPersonId: 'p1',
          actorAgeBand: 'ADULT',
          guardianPersonId: null,
          targetIsFamilyMember: true,
          familyId: 'f1',
        },
      }).decision
    ).toBe('DENY');
  });
});
