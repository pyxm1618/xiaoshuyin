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

describe('Slice 4 participation accept', () => {
  let h: Awaited<ReturnType<typeof buildParticipationApp>>;
  beforeAll(async()=>{h=await buildParticipationApp();});
  afterAll(async()=>{await h.close();});

  it('bound target explicitly accepts PENDING → ACTIVE; manager action does not auto-accept', async () => {
    const f=await createParticipationFixture(h,'accept',{target:'manager'});
    const target=await addBoundAdultTargetToFamily(h,f.familyId,'accept');
    const created=await invite(h.app,f.manager.token,f.caseId,target.personId,'accept-invite');
    expect(created.statusCode).toBe(201);

    const before=await getParticipation(h.app,f.manager.token,created.json().participationId);
    expect(before.statusCode).toBe(200);
    expect(before.json().state).toBe('PENDING');

    const accepted=await acceptInvite(
      h.app,target.token,created.json().inviteToken,'accept-command'
    );
    expect(accepted.statusCode).toBe(200);
    expect(accepted.json()).toMatchObject({
      id:created.json().participationId,
      caseId:f.caseId,
      personId:target.personId,
      state:'ACTIVE',
    });
    expect(accepted.json().acceptedAt).toBeTruthy();
  });

  it('wrong account cannot accept another target token and receives no oracle', async () => {
    const f=await createParticipationFixture(h,'accept-wrong',{target:'manager'});
    const target=await addBoundAdultTargetToFamily(h,f.familyId,'accept-wrong');
    const wrong=await addBoundAdultTargetToFamily(h,f.familyId,'accept-wrong-2');
    const created=await invite(h.app,f.manager.token,f.caseId,target.personId,'accept-wrong-invite');
    const res=await acceptInvite(h.app,wrong.token,created.json().inviteToken,'accept-wrong-command');
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({
      code:'PARTICIPATION_NOT_FOUND',message:'Participation not found',
    });
  });
});
