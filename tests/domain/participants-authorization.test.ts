import { describe, expect, it } from 'vitest';
import { authorize, type AuthInput } from '../../packages/authorization/src/authorize.js';

const ACCOUNT='11111111-1111-7111-8111-111111111111';
const ACTOR='22222222-2222-7222-8222-222222222222';
const OTHER='33333333-3333-7333-8333-333333333333';
const FAMILY='44444444-4444-7444-8444-444444444444';
const CASE='55555555-5555-7555-8555-555555555555';
const P='66666666-6666-7666-8666-666666666666';

const facts={
  membership:true,
  familyCreatedByPersonId:ACTOR,
  actorAgeBand:null,
  guardianPersonId:null,
  targetIsFamilyMember:true,
  familyId:FAMILY,
};

function base(overrides: Partial<AuthInput>): AuthInput {
  return {
    actor:{accountId:ACCOUNT,personId:ACTOR},
    product:'V1',
    family:null,
    case:null,
    participation:{personId:ACTOR,state:'PENDING'},
    resource:{type:'PARTICIPATION',participationId:P},
    action:'PARTICIPATION_READ_SELF',
    purpose:'PARTICIPATION',
    ...overrides,
  };
}

describe('Slice 4 participation authorization matrix', () => {
  it('manager create requires verified manager + family + case context', () => {
    const input=base({
      family:{familyId:FAMILY},
      case:{caseId:CASE},
      participation:null,
      resource:{type:'CASE',familyId:FAMILY,caseId:CASE},
      action:'PARTICIPATION_INVITE_CREATE',
      purpose:'FAMILY_MANAGEMENT',
      facts,
    });
    expect(authorize(input).decision).toBe('ALLOW');
    expect(authorize({...input,facts:{...facts,familyCreatedByPersonId:OTHER}})).toEqual({
      decision:'DENY',reason:'NOT_FAMILY_MANAGER',
    });
    expect(authorize({...input,case:null})).toEqual({
      decision:'DENY',reason:'CASE_CONTEXT_REQUIRED',
    });
  });

  it('target accept / decline / withdraw / self read require exact authenticated person', () => {
    for (const action of [
      'PARTICIPATION_READ_SELF',
      'PARTICIPATION_ACCEPT_SELF',
      'PARTICIPATION_DECLINE_SELF',
      'PARTICIPATION_WITHDRAW_SELF',
    ] as const) {
      expect(authorize(base({action})).decision,action).toBe('ALLOW');
      expect(authorize(base({
        action,
        participation:{personId:OTHER,state:'PENDING'},
      }))).toEqual({decision:'DENY',reason:'NOT_PARTICIPANT'});
    }
  });

  it('manager read is manager authority, not ordinary membership or guardian relationship', () => {
    const input=base({
      family:{familyId:FAMILY},
      participation:{personId:OTHER,state:'ACTIVE'},
      action:'PARTICIPATION_READ_MANAGER',
      purpose:'FAMILY_MANAGEMENT',
      facts:{...facts,guardianPersonId:OTHER},
    });
    expect(authorize(input).decision).toBe('ALLOW');
    expect(authorize({...input,facts:{...facts,familyCreatedByPersonId:OTHER,guardianPersonId:ACTOR}}))
      .toEqual({decision:'DENY',reason:'NOT_FAMILY_MANAGER'});
  });

  it('self RLS visibility is not a substitute for authorization context', () => {
    expect(authorize(base({participation:null}))).toEqual({
      decision:'DENY',reason:'PARTICIPATION_CONTEXT_REQUIRED',
    });
  });

  it('unknown action and purpose remain fail closed', () => {
    expect(authorize(base({action:'BOGUS' as never}))).toEqual({
      decision:'DENY',reason:'UNSUPPORTED_ACTION',
    });
    expect(authorize(base({purpose:'BOGUS' as never}))).toEqual({
      decision:'DENY',reason:'UNSUPPORTED_PURPOSE',
    });
  });
});
