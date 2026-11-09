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

describe('Slice 4 participation decline', () => {
  let h: Awaited<ReturnType<typeof buildParticipationApp>>;
  beforeAll(async()=>{h=await buildParticipationApp();});
  afterAll(async()=>{await h.close();});

  it('target declines PENDING → DECLINED and repeated decline converges', async () => {
    const f=await createParticipationFixture(h,'decline',{target:'manager'});
    const target=await addBoundAdultTargetToFamily(h,f.familyId,'decline');
    const created=await invite(h.app,f.manager.token,f.caseId,target.personId,'decline-invite');
    const first=await declineParticipation(
      h.app,target.token,created.json().participationId,'decline-command'
    );
    expect(first.statusCode).toBe(200);
    expect(first.json().state).toBe('DECLINED');
    expect(first.json().declinedAt).toBeTruthy();

    const second=await declineParticipation(
      h.app,target.token,created.json().participationId,'decline-command-2'
    );
    expect(second.statusCode).toBe(200);
    expect(second.json()).toEqual(first.json());
  });
});
