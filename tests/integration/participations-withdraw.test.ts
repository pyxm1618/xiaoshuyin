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

describe('Slice 4 participation withdraw', () => {
  let h: Awaited<ReturnType<typeof buildParticipationApp>>;
  beforeAll(async()=>{h=await buildParticipationApp();});
  afterAll(async()=>{await h.close();});

  it('ACTIVE target withdraws → WITHDRAWN while preserving acceptedAt', async () => {
    const f=await createParticipationFixture(h,'withdraw',{target:'manager'});
    const target=await addBoundAdultTargetToFamily(h,f.familyId,'withdraw');
    const created=await invite(h.app,f.manager.token,f.caseId,target.personId,'withdraw-invite');
    const accepted=await acceptInvite(
      h.app,target.token,created.json().inviteToken,'withdraw-accept'
    );
    expect(accepted.statusCode).toBe(200);
    const acceptedAt=accepted.json().acceptedAt;

    const withdrawn=await withdrawParticipation(
      h.app,target.token,created.json().participationId,'withdraw-command'
    );
    expect(withdrawn.statusCode).toBe(200);
    expect(withdrawn.json().state).toBe('WITHDRAWN');
    expect(withdrawn.json().acceptedAt).toBe(acceptedAt);
    expect(withdrawn.json().withdrawnAt).toBeTruthy();
  });

  it('PENDING cannot use withdraw as a decline substitute', async () => {
    const f=await createParticipationFixture(h,'withdraw-pending',{target:'manager'});
    const target=await addBoundAdultTargetToFamily(h,f.familyId,'withdraw-pending');
    const created=await invite(h.app,f.manager.token,f.caseId,target.personId,'withdraw-pending-invite');
    const res=await withdrawParticipation(
      h.app,target.token,created.json().participationId,'withdraw-pending-command'
    );
    expect(res.statusCode).toBe(409);
    expect(res.json()).toMatchObject({
      code:'PARTICIPATION_STATE_CONFLICT',currentState:'PENDING',
    });
  });
});
