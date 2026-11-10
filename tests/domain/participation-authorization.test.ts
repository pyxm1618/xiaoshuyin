import { describe, expect, it } from 'vitest';
import { authorize, type AuthInput } from '../../packages/authorization/src/authorize.js';

const ACCOUNT='11111111-1111-7111-8111-111111111111';
const ACTOR='22222222-2222-7222-8222-222222222222';
const OTHER='33333333-3333-7333-8333-333333333333';
const FAMILY='44444444-4444-7444-8444-444444444444';
const CASE='55555555-5555-7555-8555-555555555555';
const PARTICIPATION='66666666-6666-7666-8666-666666666666';

function base(overrides: Partial<AuthInput>): AuthInput {
  return {
    actor:{ accountId:ACCOUNT, personId:ACTOR },
    product:'V1',
    family:null,
    case:null,
    participation:null,
    resource:{ type:'PARTICIPATION', participationId:PARTICIPATION },
    action:'PARTICIPATION_READ_SELF',
    purpose:'PARTICIPATION',
    ...overrides,
  };
}

describe('Slice 4 authorization', () => {
  it('allows self actions only for the participation target', () => {
    const ok=authorize(base({
      participation:{ personId:ACTOR, state:'PENDING' },
      action:'PARTICIPATION_ACCEPT_SELF',
    }));
    expect(ok.decision).toBe('ALLOW');

    const no=authorize(base({
      participation:{ personId:OTHER, state:'PENDING' },
      action:'PARTICIPATION_ACCEPT_SELF',
    }));
    expect(no).toEqual({ decision:'DENY', reason:'NOT_PARTICIPANT' });
  });

  it('requires participation context for self and manager reads', () => {
    expect(authorize(base({ participation:null }))).toEqual({
      decision:'DENY', reason:'PARTICIPATION_CONTEXT_REQUIRED',
    });
  });

  it('invite create requires a verified Family manager and Case dimension', () => {
    const common={
      family:{ familyId:FAMILY },
      case:{ caseId:CASE },
      resource:{ type:'CASE' as const, familyId:FAMILY, caseId:CASE },
      action:'PARTICIPATION_INVITE_CREATE' as const,
      purpose:'FAMILY_MANAGEMENT' as const,
      facts:{
        membership:true,
        familyCreatedByPersonId:ACTOR,
        actorAgeBand:null,
        guardianPersonId:null,
        targetIsFamilyMember:true,
        familyId:FAMILY,
      },
    };
    expect(authorize(base(common)).decision).toBe('ALLOW');
    expect(authorize(base({
      ...common,
      facts:{ ...common.facts, familyCreatedByPersonId:OTHER },
    }))).toEqual({ decision:'DENY', reason:'NOT_FAMILY_MANAGER' });
    expect(authorize(base({ ...common, case:null }))).toEqual({
      decision:'DENY', reason:'CASE_CONTEXT_REQUIRED',
    });
  });

  it('manager read is manager authority, not ordinary membership or guardian authority', () => {
    const common={
      family:{ familyId:FAMILY },
      participation:{ personId:OTHER, state:'ACTIVE' as const },
      action:'PARTICIPATION_READ_MANAGER' as const,
      purpose:'FAMILY_MANAGEMENT' as const,
      facts:{
        membership:true,
        familyCreatedByPersonId:ACTOR,
        actorAgeBand:null,
        guardianPersonId:OTHER,
        targetIsFamilyMember:false,
        familyId:FAMILY,
      },
    };
    expect(authorize(base(common)).decision).toBe('ALLOW');
    expect(authorize(base({
      ...common,
      facts:{ ...common.facts, familyCreatedByPersonId:OTHER },
    }))).toEqual({ decision:'DENY', reason:'NOT_FAMILY_MANAGER' });
  });

  it('unknown action/purpose still fail closed', () => {
    expect(authorize(base({ action:'BOGUS' as never }))).toEqual({
      decision:'DENY', reason:'UNSUPPORTED_ACTION',
    });
    expect(authorize(base({ purpose:'BOGUS' as never }))).toEqual({
      decision:'DENY', reason:'UNSUPPORTED_PURPOSE',
    });
  });
});
