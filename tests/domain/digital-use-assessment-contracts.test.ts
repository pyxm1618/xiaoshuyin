import { describe, expect, it } from 'vitest';
import { authorize } from '@xiaoshuyin/authorization';
import {
  CompleteDigitalUseNodeRequest,
  StartDigitalUseAssessmentRequest,
} from '@xiaoshuyin/contracts';
import { IDEMPOTENCY_COMMAND_TYPES } from '@xiaoshuyin/domain';

const familyId='00000000-0000-7000-8000-000000000001';
const caseId='00000000-0000-7000-8000-000000000002';
const personId='00000000-0000-7000-8000-000000000003';
const accountId='00000000-0000-7000-8000-000000000004';

function decide(action: 'CASE_READ_ASSESSMENT_SCENE'|'CASE_RESPOND_ASSESSMENT_SCENE', manager=true) {
  return authorize({
    actor:{accountId,personId}, product:'V1',
    family:{familyId}, case:{caseId},
    resource:{type:'CASE',familyId,caseId},
    action, purpose:'FAMILY_MANAGEMENT',
    facts:{
      membership:true,
      familyCreatedByPersonId: manager ? personId : '00000000-0000-7000-8000-000000000099',
      actorAgeBand:'ADULT',
      guardianPersonId:null,
      targetIsFamilyMember:false,
      familyId,
    },
  });
}

describe('T1204 Scene contracts and authorization', () => {
  it('authorizes only the existing family-manager Case dimension', () => {
    expect(decide('CASE_READ_ASSESSMENT_SCENE').decision).toBe('ALLOW');
    expect(decide('CASE_RESPOND_ASSESSMENT_SCENE').decision).toBe('ALLOW');
    expect(decide('CASE_READ_ASSESSMENT_SCENE', false)).toEqual({
      decision:'DENY', reason:'NOT_FAMILY_MANAGER',
    });
  });

  it('does not accept client-owned family/package/route authority', () => {
    expect(StartDigitalUseAssessmentRequest.safeParse({expectedCaseVersion:1,familyId}).success).toBe(false);
    expect(CompleteDigitalUseNodeRequest.safeParse({
      expectedCaseVersion:1,
      expectedNodeRevision:1,
      nextNode:'A2003',
      response:{answer:true},
    }).success).toBe(false);
  });

  it('registers resume/node-response identities in the one idempotency vocabulary', () => {
    expect(IDEMPOTENCY_COMMAND_TYPES).toContain('DIGITAL_USE_ASSESSMENT_RESUME');
    expect(IDEMPOTENCY_COMMAND_TYPES).toContain('DIGITAL_USE_NODE_RESPONSE');
  });
});
