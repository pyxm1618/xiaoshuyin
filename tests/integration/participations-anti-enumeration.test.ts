import {
  acceptInvite,
  addBoundAdultNonManagerToFamily,
  addBoundAdultTargetToFamily,
  buildParticipationApp,
  createParticipationFixture,
  declineParticipation,
  getParticipation,
  invite,
  lookupInvite,
  withdrawParticipation,
} from '../setup/participation.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

describe('Slice 4 anti-enumeration', () => {
  let h: Awaited<ReturnType<typeof buildParticipationApp>>;
  beforeAll(async()=>{h=await buildParticipationApp();});
  afterAll(async()=>{await h.close();});

  it('nonexistent Case, cross-Family Case and non-manager create all converge to CASE_NOT_FOUND', async () => {
    const a=await createParticipationFixture(h,'enum-a',{target:'manager'});
    const b=await createParticipationFixture(h,'enum-b',{target:'manager'});
    const member=await addBoundAdultNonManagerToFamily(h,a.familyId,'enum-member');

    const responses=[
      await invite(
        h.app,a.manager.token,'00000000-0000-7000-8000-000000000001',
        a.manager.personId,'enum-missing'
      ),
      await invite(h.app,a.manager.token,b.caseId,a.manager.personId,'enum-cross'),
      await invite(h.app,member.token,a.caseId,a.manager.personId,'enum-non-manager'),
    ];
    for(const res of responses){
      expect(res.statusCode).toBe(404);
      expect(res.json()).toEqual({code:'CASE_NOT_FOUND',message:'Case not found'});
    }
  });

  it('unauthorized accept/decline/withdraw/read all return the same PARTICIPATION_NOT_FOUND body', async () => {
    const f=await createParticipationFixture(h,'enum-resource',{target:'manager'});
    const target=await addBoundAdultNonManagerToFamily(h,f.familyId,'enum-target');
    const wrong=await addBoundAdultNonManagerToFamily(h,f.familyId,'enum-wrong');
    const created=await invite(h.app,f.manager.token,f.caseId,target.personId,'enum-resource-invite');
    const responses=[
      await acceptInvite(h.app,wrong.token,created.json().inviteToken,'enum-wrong-accept'),
      await declineParticipation(h.app,wrong.token,created.json().participationId,'enum-wrong-decline'),
      await withdrawParticipation(h.app,wrong.token,created.json().participationId,'enum-wrong-withdraw'),
      await getParticipation(h.app,wrong.token,created.json().participationId),
    ];
    for(const res of responses){
      expect(res.statusCode).toBe(404);
      expect(res.json()).toEqual({
        code:'PARTICIPATION_NOT_FOUND',message:'Participation not found',
      });
    }
  });

  it('409 lifecycle detail is visible only after target authorization', async () => {
    const f=await createParticipationFixture(h,'enum-conflict',{target:'manager'});
    const target=await addBoundAdultNonManagerToFamily(h,f.familyId,'enum-conflict-target');
    const wrong=await addBoundAdultNonManagerToFamily(h,f.familyId,'enum-conflict-wrong');
    const created=await invite(h.app,f.manager.token,f.caseId,target.personId,'enum-conflict-invite');

    const targetConflict=await withdrawParticipation(
      h.app,target.token,created.json().participationId,'enum-target-withdraw'
    );
    expect(targetConflict.statusCode).toBe(409);
    expect(targetConflict.json()).toMatchObject({
      code:'PARTICIPATION_STATE_CONFLICT',currentState:'PENDING',
    });

    const wrongAttempt=await withdrawParticipation(
      h.app,wrong.token,created.json().participationId,'enum-wrong-withdraw-2'
    );
    expect(wrongAttempt.statusCode).toBe(404);
    expect(wrongAttempt.json().currentState).toBeUndefined();
  });
});
