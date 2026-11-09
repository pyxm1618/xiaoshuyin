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

describe('Slice 4 cross-family boundary', () => {
  let h: Awaited<ReturnType<typeof buildParticipationApp>>;
  beforeAll(async()=>{h=await buildParticipationApp();});
  afterAll(async()=>{await h.close();});

  it('cross-family Case and target Person are rejected without writes', async () => {
    const a=await createParticipationFixture(h,'cross-a',{target:'manager'});
    const b=await createParticipationFixture(h,'cross-b',{target:'manager'});
    const targetB=await addBoundAdultNonManagerToFamily(h,b.familyId,'cross-target-b');

    const before=(await h.admin.query(
      `SELECT count(*)::int AS n FROM case_participants`
    )).rows[0].n;

    const wrongCase=await invite(
      h.app,a.manager.token,b.caseId,a.manager.personId,'cross-wrong-case'
    );
    expect(wrongCase.statusCode).toBe(404);
    expect(wrongCase.json().code).toBe('CASE_NOT_FOUND');

    const wrongTarget=await invite(
      h.app,a.manager.token,a.caseId,targetB.personId,'cross-wrong-target'
    );
    expect(wrongTarget.statusCode).toBe(403);
    expect(wrongTarget.json().code).toBe('PARTICIPATION_TARGET_INELIGIBLE');

    const after=(await h.admin.query(
      `SELECT count(*)::int AS n FROM case_participants`
    )).rows[0].n;
    expect(after).toBe(before);
  });

  it('client familyId spoof is rejected at strict schema with 422 before business writes', async () => {
    const f=await createParticipationFixture(h,'cross-spoof',{target:'manager'});
    const before=(await h.admin.query(
      `SELECT count(*)::int AS n FROM case_participants WHERE case_id=$1`,[f.caseId]
    )).rows[0].n;
    const res=await h.app.inject({
      method:'POST',
      url:`/api/v1/cases/${f.caseId}/participation-invites`,
      headers:{authorization:`Bearer ${f.manager.token}`},
      payload:{
        personId:f.manager.personId,
        idempotencyKey:'cross-spoof-key',
        familyId:'00000000-0000-7000-8000-000000000000',
      },
    });
    expect(res.statusCode).toBe(422);
    expect(res.json()).toEqual({
      code:'VALIDATION_ERROR',message:'Invalid request body',
    });
    const after=(await h.admin.query(
      `SELECT count(*)::int AS n FROM case_participants WHERE case_id=$1`,[f.caseId]
    )).rows[0].n;
    expect(after).toBe(before);
  });

  it('manager of another Family cannot read target participation', async () => {
    const a=await createParticipationFixture(h,'cross-read-a',{target:'manager'});
    const b=await createParticipationFixture(h,'cross-read-b',{target:'manager'});
    const created=await invite(
      h.app,a.manager.token,a.caseId,a.manager.personId,'cross-read-invite'
    );
    expect(created.statusCode).toBe(201);
    const res=await getParticipation(h.app,b.manager.token,created.json().participationId);
    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe('PARTICIPATION_NOT_FOUND');
  });
});
