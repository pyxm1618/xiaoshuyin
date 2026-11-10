import {
  acceptInvite,
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

describe('Slice 4 participation read', () => {
  let h: Awaited<ReturnType<typeof buildParticipationApp>>;
  beforeAll(async()=>{h=await buildParticipationApp();});
  afterAll(async()=>{await h.close();});

  it('self and Family manager may read the same minimal participation resource', async () => {
    const f=await createParticipationFixture(h,'read',{target:'manager'});
    const target=await addBoundAdultTargetToFamily(h,f.familyId,'read');
    const created=await invite(h.app,f.manager.token,f.caseId,target.personId,'read-invite');
    const self=await getParticipation(h.app,target.token,created.json().participationId);
    const manager=await getParticipation(h.app,f.manager.token,created.json().participationId);
    expect(self.statusCode).toBe(200);
    expect(manager.statusCode).toBe(200);
    expect(self.json()).toEqual(manager.json());
    expect(Object.keys(self.json()).sort()).toEqual([
      'acceptedAt','caseId','createdAt','declinedAt','expiredAt',
      'id','personId','state','withdrawnAt',
    ]);
    const serialized=JSON.stringify(self.json());
    for(const forbidden of [
      'familyId','inviteToken','inviteTokenHash','guardian','consent',
      'evidence','assertion','observation','plan','goal'
    ]) expect(serialized).not.toContain(forbidden);
  });

  it('unrelated authenticated account receives uniform 404', async () => {
    const f=await createParticipationFixture(h,'read-wrong',{target:'manager'});
    const target=await addBoundAdultTargetToFamily(h,f.familyId,'read-wrong');
    const wrong=await addBoundAdultTargetToFamily(h,f.familyId,'read-wrong-2');
    const created=await invite(h.app,f.manager.token,f.caseId,target.personId,'read-wrong-invite');
    const res=await getParticipation(h.app,wrong.token,created.json().participationId);
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({
      code:'PARTICIPATION_NOT_FOUND',message:'Participation not found',
    });
  });
});
