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

describe('Slice 4 participation authorization', () => {
  let h: Awaited<ReturnType<typeof buildParticipationApp>>;
  beforeAll(async()=>{h=await buildParticipationApp();});
  afterAll(async()=>{await h.close();});

  it('Family manager can read a target participation; ordinary member cannot use manager authority', async () => {
    const f=await createParticipationFixture(h,'auth-manager',{target:'manager'});
    const target=await addBoundAdultNonManagerToFamily(h,f.familyId,'auth-target');
    const created=await invite(h.app,f.manager.token,f.caseId,target.personId,'auth-manager-invite');
    expect(created.statusCode).toBe(201);

    const managerRead=await getParticipation(h.app,f.manager.token,created.json().participationId);
    expect(managerRead.statusCode).toBe(200);

    const nonManagerCreate=await invite(
      h.app,target.token,f.caseId,f.manager.personId,'auth-non-manager-invite'
    );
    expect(nonManagerCreate.statusCode).toBe(404);
    expect(nonManagerCreate.json().code).toBe('CASE_NOT_FOUND');
  });

  it('family RLS visibility does not replace self authorization', async () => {
    const f=await createParticipationFixture(h,'auth-self',{target:'manager'});
    const target=await addBoundAdultNonManagerToFamily(h,f.familyId,'auth-self-target');
    const other=await addBoundAdultNonManagerToFamily(h,f.familyId,'auth-self-other');
    const created=await invite(h.app,f.manager.token,f.caseId,target.personId,'auth-self-invite');
    expect(created.statusCode).toBe(201);

    const targetRead=await getParticipation(h.app,target.token,created.json().participationId);
    expect(targetRead.statusCode).toBe(200);
    const otherRead=await getParticipation(h.app,other.token,created.json().participationId);
    expect(otherRead.statusCode).toBe(404);
    expect(otherRead.json().code).toBe('PARTICIPATION_NOT_FOUND');
  });
});
