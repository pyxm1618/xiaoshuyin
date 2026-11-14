import { describe, expect, it } from 'vitest';
import {
  authorize,
  type AuthInput,
  type AuthorizeFacts,
} from '../../packages/authorization/src/authorize.js';

const ACCOUNT = '11111111-1111-7111-8111-111111111111';
const CHILD = '22222222-2222-7222-8222-222222222222';
const PARENT = '33333333-3333-7333-8333-333333333333';
const SIBLING = '44444444-4444-7444-8444-444444444444';
const FAMILY = '55555555-5555-7555-8555-555555555555';
const CASE_ID = '66666666-6666-7666-8666-666666666666';
const CONTRACT = '77777777-7777-7777-8777-777777777777';
const PARTICIPATION = '88888888-8888-7888-8888-888888888888';

function facts(overrides: Partial<AuthorizeFacts> = {}): AuthorizeFacts {
  return {
    membership: true,
    familyCreatedByPersonId: PARENT,
    actorAgeBand: 'MINOR_14_17',
    guardianPersonId: PARENT,
    targetIsFamilyMember: true,
    familyId: FAMILY,
    phoneUseContractConfirmation: {
      contractVersionId: CONTRACT,
      contractFamilyId: FAMILY,
      contractCaseId: CASE_ID,
      contractPartyPersonId: CHILD,
      contractPartyRole: 'CHILD',
      participationId: PARTICIPATION,
      participationFamilyId: FAMILY,
      participationCaseId: CASE_ID,
      participationPersonId: CHILD,
      participationState: 'ACTIVE',
    },
    ...overrides,
  };
}

function input(overrides: Partial<AuthInput> = {}): AuthInput {
  return {
    actor: { accountId: ACCOUNT, personId: CHILD },
    product: 'V1',
    family: { familyId: FAMILY },
    case: { caseId: CASE_ID },
    participation: {
      participationId: PARTICIPATION,
      familyId: FAMILY,
      caseId: CASE_ID,
      personId: CHILD,
      state: 'ACTIVE',
    },
    resource: {
      type: 'PHONE_USE_CONTRACT_VERSION',
      familyId: FAMILY,
      caseId: CASE_ID,
      contractVersionId: CONTRACT,
      partyPersonId: CHILD,
      partyRole: 'CHILD',
    },
    action: 'PHONE_USE_CONTRACT_CONFIRM_SELF',
    purpose: 'PHONE_USE_CONTRACT',
    facts: facts(),
    ...overrides,
  };
}

describe('Authorization owner — genuine child phone-use Contract confirmation', () => {
  it('ALLOW: exact authenticated child + exact Family + Case + Contract + party + ACTIVE participation', () => {
    expect(authorize(input())).toEqual({
      decision: 'ALLOW',
      basis: {
        membership: true,
        manager: false,
        purpose: 'PHONE_USE_CONTRACT',
      },
    });
  });

  it('denies when there is no authenticated Account/Person actor', () => {
    expect(authorize(input({ actor: {} }))).toEqual({
      decision: 'DENY',
      reason: 'NO_ACTOR',
    });
  });

  it('denies non-ACCOUNT actor kinds even if account/person fields are injected', () => {
    expect(
      authorize(
        input({
          actor: {
            kind: 'BINDING_CONTEXT',
            accountId: ACCOUNT,
            personId: CHILD,
            contextId: 'ctx',
            candidateIdentityDigest: 'a'.repeat(64),
          },
        })
      )
    ).toEqual({ decision: 'DENY', reason: 'NO_ACTOR' });
  });

  it('denies an actor who is not the exact participation target', () => {
    expect(
      authorize(input({ actor: { accountId: ACCOUNT, personId: SIBLING } }))
    ).toEqual({ decision: 'DENY', reason: 'NOT_PARTICIPANT' });
  });

  it('denies missing participation context', () => {
    expect(authorize(input({ participation: null }))).toEqual({
      decision: 'DENY',
      reason: 'PARTICIPATION_CONTEXT_REQUIRED',
    });
  });

  it('denies every non-ACTIVE participation state', () => {
    for (const state of ['PENDING', 'DECLINED', 'EXPIRED', 'WITHDRAWN'] as const) {
      expect(
        authorize(
          input({
            participation: {
              participationId: PARTICIPATION,
              familyId: FAMILY,
              caseId: CASE_ID,
              personId: CHILD,
              state,
            },
          })
        )
      ).toEqual({ decision: 'DENY', reason: 'PARTICIPATION_NOT_ACTIVE' });
    }
  });

  it('denies when authoritative participation state is not ACTIVE', () => {
    const confirmation = facts().phoneUseContractConfirmation!;
    expect(
      authorize(
        input({
          facts: facts({
            phoneUseContractConfirmation: {
              ...confirmation,
              participationState: 'WITHDRAWN',
            },
          }),
        })
      )
    ).toEqual({
      decision: 'DENY',
      reason: 'CONTRACT_CONFIRMATION_CONTEXT_INVALID',
    });
  });

  it('denies ordinary Family membership without the exact active participation', () => {
    expect(
      authorize(
        input({
          participation: {
            personId: CHILD,
            state: 'ACTIVE',
          },
        })
      )
    ).toEqual({
      decision: 'DENY',
      reason: 'CONTRACT_CONFIRMATION_CONTEXT_INVALID',
    });
  });

  it('denies an actor who is not a current Family member', () => {
    expect(authorize(input({ facts: facts({ membership: false }) }))).toEqual({
      decision: 'DENY',
      reason: 'NOT_FAMILY_MEMBER',
    });
  });

  it('denies missing authoritative Contract/participation facts', () => {
    expect(
      authorize(
        input({
          facts: facts({ phoneUseContractConfirmation: null }),
        })
      )
    ).toEqual({
      decision: 'DENY',
      reason: 'CONTRACT_CONFIRMATION_CONTEXT_INVALID',
    });
  });

  it('denies wrong or missing Family context', () => {
    expect(authorize(input({ family: null }))).toEqual({
      decision: 'DENY',
      reason: 'FAMILY_CONTEXT_REQUIRED',
    });

    expect(
      authorize(
        input({
          family: { familyId: 'wrong-family' },
        })
      )
    ).toEqual({
      decision: 'DENY',
      reason: 'CONTRACT_CONFIRMATION_CONTEXT_INVALID',
    });

    expect(
      authorize(
        input({
          resource: {
            type: 'PHONE_USE_CONTRACT_VERSION',
            familyId: 'wrong-family',
            caseId: CASE_ID,
            contractVersionId: CONTRACT,
            partyPersonId: CHILD,
            partyRole: 'CHILD',
          },
        })
      )
    ).toEqual({
      decision: 'DENY',
      reason: 'CONTRACT_CONFIRMATION_CONTEXT_INVALID',
    });
  });

  it('denies wrong or missing Case context', () => {
    expect(authorize(input({ case: null }))).toEqual({
      decision: 'DENY',
      reason: 'CASE_CONTEXT_REQUIRED',
    });

    expect(
      authorize(input({ case: { caseId: 'wrong-case' } }))
    ).toEqual({
      decision: 'DENY',
      reason: 'CONTRACT_CONFIRMATION_CONTEXT_INVALID',
    });

    const confirmation = facts().phoneUseContractConfirmation!;
    expect(
      authorize(
        input({
          facts: facts({
            phoneUseContractConfirmation: {
              ...confirmation,
              contractCaseId: 'wrong-case',
            },
          }),
        })
      )
    ).toEqual({
      decision: 'DENY',
      reason: 'CONTRACT_CONFIRMATION_CONTEXT_INVALID',
    });
  });

  it('denies the wrong Contract version', () => {
    expect(
      authorize(
        input({
          resource: {
            type: 'PHONE_USE_CONTRACT_VERSION',
            familyId: FAMILY,
            caseId: CASE_ID,
            contractVersionId: 'wrong-contract',
            partyPersonId: CHILD,
            partyRole: 'CHILD',
          },
        })
      )
    ).toEqual({
      decision: 'DENY',
      reason: 'CONTRACT_CONFIRMATION_CONTEXT_INVALID',
    });
  });

  it('denies a wrong Contract party even when that Person is an ACTIVE participant', () => {
    const confirmation = facts().phoneUseContractConfirmation!;
    expect(
      authorize(
        input({
          actor: { accountId: ACCOUNT, personId: SIBLING },
          participation: {
            participationId: 'sibling-participation',
            familyId: FAMILY,
            caseId: CASE_ID,
            personId: SIBLING,
            state: 'ACTIVE',
          },
          facts: facts({
            phoneUseContractConfirmation: {
              ...confirmation,
              participationId: 'sibling-participation',
              participationPersonId: SIBLING,
            },
          }),
        })
      )
    ).toEqual({ decision: 'DENY', reason: 'NOT_CONTRACT_PARTY' });
  });

  it('denies parent / Family manager impersonation as the child', () => {
    const confirmation = facts().phoneUseContractConfirmation!;
    expect(
      authorize(
        input({
          actor: { accountId: 'parent-account', personId: PARENT },
          participation: {
            participationId: 'parent-participation',
            familyId: FAMILY,
            caseId: CASE_ID,
            personId: PARENT,
            state: 'ACTIVE',
          },
          facts: facts({
            familyCreatedByPersonId: PARENT,
            guardianPersonId: PARENT,
            phoneUseContractConfirmation: {
              ...confirmation,
              participationId: 'parent-participation',
              participationPersonId: PARENT,
            },
          }),
        })
      )
    ).toEqual({ decision: 'DENY', reason: 'NOT_CONTRACT_PARTY' });
  });

  it('denies guardian authority as a substitute for child Contract confirmation', () => {
    const confirmation = facts().phoneUseContractConfirmation!;
    expect(
      authorize(
        input({
          actor: { accountId: 'guardian-account', personId: PARENT },
          participation: {
            participationId: 'guardian-participation',
            familyId: FAMILY,
            caseId: CASE_ID,
            personId: PARENT,
            state: 'ACTIVE',
          },
          facts: facts({
            familyCreatedByPersonId: 'another-manager',
            guardianPersonId: PARENT,
            phoneUseContractConfirmation: {
              ...confirmation,
              participationId: 'guardian-participation',
              participationPersonId: PARENT,
            },
          }),
        })
      )
    ).toEqual({ decision: 'DENY', reason: 'NOT_CONTRACT_PARTY' });
  });

  it('denies a participation belonging to another Case', () => {
    expect(
      authorize(
        input({
          participation: {
            participationId: PARTICIPATION,
            familyId: FAMILY,
            caseId: 'other-case',
            personId: CHILD,
            state: 'ACTIVE',
          },
        })
      )
    ).toEqual({
      decision: 'DENY',
      reason: 'CONTRACT_CONFIRMATION_CONTEXT_INVALID',
    });
  });

  it('denies a participation belonging to another Family', () => {
    expect(
      authorize(
        input({
          participation: {
            participationId: PARTICIPATION,
            familyId: 'other-family',
            caseId: CASE_ID,
            personId: CHILD,
            state: 'ACTIVE',
          },
        })
      )
    ).toEqual({
      decision: 'DENY',
      reason: 'CONTRACT_CONFIRMATION_CONTEXT_INVALID',
    });
  });

  it('denies mismatched authoritative participation identity', () => {
    const confirmation = facts().phoneUseContractConfirmation!;
    expect(
      authorize(
        input({
          facts: facts({
            phoneUseContractConfirmation: {
              ...confirmation,
              participationId: 'other-participation',
            },
          }),
        })
      )
    ).toEqual({
      decision: 'DENY',
      reason: 'CONTRACT_CONFIRMATION_CONTEXT_INVALID',
    });
  });

  it('denies unsupported resources instead of treating Case/Participation as Contract authority', () => {
    expect(
      authorize(
        input({
          resource: { type: 'CASE', familyId: FAMILY, caseId: CASE_ID },
        })
      )
    ).toEqual({
      decision: 'DENY',
      reason: 'CONTRACT_CONFIRMATION_CONTEXT_INVALID',
    });
  });

  it('denies every existing non-Contract purpose', () => {
    for (const purpose of [
      'SELF_IDENTITY',
      'FAMILY_MANAGEMENT',
      'GUARDIAN_CONSENT',
      'PARTICIPATION',
      'IDENTITY_BINDING',
    ] as const) {
      expect(authorize(input({ purpose }))).toEqual({
        decision: 'DENY',
        reason: 'UNSUPPORTED_PURPOSE',
      });
    }
  });

  it('keeps the action registry closed', () => {
    expect(authorize(input({ action: 'CONTRACT_CONFIRM' as never }))).toEqual({
      decision: 'DENY',
      reason: 'UNSUPPORTED_ACTION',
    });
  });

  it('keeps participation self actions from acquiring a Case dimension', () => {
    expect(
      authorize({
        actor: { accountId: ACCOUNT, personId: CHILD },
        product: 'V1',
        family: null,
        case: { caseId: CASE_ID },
        participation: { personId: CHILD, state: 'ACTIVE' },
        resource: { type: 'PARTICIPATION', participationId: PARTICIPATION },
        action: 'PARTICIPATION_READ_SELF',
        purpose: 'PARTICIPATION',
      })
    ).toEqual({ decision: 'DENY', reason: 'UNSUPPORTED_DIMENSION' });
  });

  it('does not promote Family manager facts into this self-confirmation authority', () => {
    const decision = authorize(
      input({
        facts: facts({ familyCreatedByPersonId: CHILD }),
      })
    );
    expect(decision).toEqual({
      decision: 'ALLOW',
      basis: {
        membership: true,
        manager: false,
        purpose: 'PHONE_USE_CONTRACT',
      },
    });
  });
});
