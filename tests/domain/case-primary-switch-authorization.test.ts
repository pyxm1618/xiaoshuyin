/**
 * T721 — `authorize()` increment for CASE_SWITCH_PRIMARY (plan D-10.2).
 *
 * Single authorization entry point. No `authorizeCase()`, no new Purpose, no
 * MANAGER_ACTIONS change. The Case-scoped branch requires a non-null case
 * context and a CASE resource matching the family; DENY reasons are the frozen
 * Slice 1 / Slice 2 vocabulary.
 */

import { describe, it, expect } from 'vitest';
import {
  authorize,
  type AuthInput,
  type AuthorizeFacts,
} from '../../packages/authorization/src/authorize.js';

const ACTOR = { accountId: 'acc-1', personId: 'person-1' };
const OTHER = 'person-2';
const FAMILY_ID = 'fam-1';
const CASE_ID = 'case-1';

const MANAGER_FACTS: AuthorizeFacts = {
  membership: true,
  familyCreatedByPersonId: ACTOR.personId,
  actorAgeBand: null,
  guardianPersonId: null,
  targetIsFamilyMember: false,
  familyId: FAMILY_ID,
};

const ALLOW_MANAGER = {
  decision: 'ALLOW',
  basis: { membership: true, manager: true, purpose: 'FAMILY_MANAGEMENT' },
} as const;

function input(over: Partial<AuthInput> = {}): AuthInput {
  return {
    actor: ACTOR,
    product: 'V1',
    family: { familyId: FAMILY_ID },
    case: { caseId: CASE_ID },
    resource: { type: 'CASE', familyId: FAMILY_ID, caseId: CASE_ID },
    action: 'CASE_SWITCH_PRIMARY' as never,
    purpose: 'FAMILY_MANAGEMENT',
    facts: MANAGER_FACTS,
    ...over,
  };
}

describe('authorize() — CASE_SWITCH_PRIMARY (T721)', () => {
  it('is in the registered action vocabulary (no UNSUPPORTED_ACTION)', () => {
    expect(authorize(input())).toEqual(ALLOW_MANAGER);
  });

  it('denies without family context', () => {
    expect(authorize(input({ family: null }))).toEqual({
      decision: 'DENY',
      reason: 'FAMILY_CONTEXT_REQUIRED',
    });
  });

  it('denies outside FAMILY_MANAGEMENT purpose with UNSUPPORTED_PURPOSE', () => {
    expect(authorize(input({ purpose: 'GUARDIAN_CONSENT' }))).toEqual({
      decision: 'DENY',
      reason: 'UNSUPPORTED_PURPOSE',
    });
  });

  it('denies a non-member (membership is authorization, not RLS visibility)', () => {
    expect(authorize(input({ facts: { ...MANAGER_FACTS, membership: false } }))).toEqual({
      decision: 'DENY',
      reason: 'NOT_FAMILY_MEMBER',
    });
  });

  it('denies when createdByPersonId is missing', () => {
    expect(
      authorize(input({ facts: { ...MANAGER_FACTS, familyCreatedByPersonId: null } }))
    ).toEqual({ decision: 'DENY', reason: 'NOT_FAMILY_MANAGER' });
  });

  it('denies a plain member (createdByPersonId mismatch)', () => {
    expect(
      authorize(input({ facts: { ...MANAGER_FACTS, familyCreatedByPersonId: OTHER } }))
    ).toEqual({ decision: 'DENY', reason: 'NOT_FAMILY_MANAGER' });
  });

  it('requires a Case dimension', () => {
    expect(
      authorize(
        input({ case: null, resource: { type: 'FAMILY', familyId: FAMILY_ID } })
      )
    ).toEqual({ decision: 'DENY', reason: 'CASE_CONTEXT_REQUIRED' });
  });

  it('denies a mismatched CASE resource (cross-family / wrong case id)', () => {
    expect(
      authorize(
        input({ resource: { type: 'CASE', familyId: FAMILY_ID, caseId: 'case-2' } })
      )
    ).toEqual({ decision: 'DENY', reason: 'NOT_FAMILY_MEMBER' });
    expect(
      authorize(
        input({ resource: { type: 'CASE', familyId: 'fam-2', caseId: CASE_ID } })
      )
    ).toEqual({ decision: 'DENY', reason: 'NOT_FAMILY_MEMBER' });
  });

  it('does not change CASE_CREATE / CASE_LIST collection semantics', () => {
    expect(
      authorize(
        input({
          action: 'CASE_CREATE',
          case: null,
          resource: { type: 'FAMILY', familyId: FAMILY_ID },
        })
      )
    ).toEqual(ALLOW_MANAGER);
    expect(
      authorize(
        input({
          action: 'CASE_LIST',
          case: null,
          resource: { type: 'FAMILY', familyId: FAMILY_ID },
        })
      )
    ).toEqual(ALLOW_MANAGER);
    expect(
      authorize(
        input({
          action: 'CASE_CREATE',
          case: { caseId: CASE_ID },
          resource: { type: 'CASE', familyId: FAMILY_ID, caseId: CASE_ID },
        })
      )
    ).toEqual({ decision: 'DENY', reason: 'UNSUPPORTED_DIMENSION' });
  });

  it('does not add an authorizeCase entry point', async () => {
    const mod: Record<string, unknown> = await import(
      '../../packages/authorization/src/index.js'
    );
    expect(mod['authorizeCase']).toBeUndefined();
  });
});