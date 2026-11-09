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

describe('Slice 4 participation concurrency', () => {
  let h: Awaited<ReturnType<typeof buildParticipationApp>>;
  beforeAll(async()=>{h=await buildParticipationApp();});
  afterAll(async()=>{await h.close();});

  it('accept vs decline has exactly one successful state transition', async () => {
    const f=await createParticipationFixture(h,'race-ad',{target:'manager'});
    const target=await addBoundAdultTargetToFamily(h,f.familyId,'race-ad');
    const created=await invite(h.app,f.manager.token,f.caseId,target.personId,'race-ad-invite');
    const [accept,decline]=await Promise.all([
      acceptInvite(h.app,target.token,created.json().inviteToken,'race-ad-accept'),
      declineParticipation(h.app,target.token,created.json().participationId,'race-ad-decline'),
    ]);
    expect([accept.statusCode,decline.statusCode].sort()).toEqual([200,409]);
    const row=(await h.admin.query(
      `SELECT state FROM case_participants WHERE id=$1`,[created.json().participationId]
    )).rows[0];
    expect(['ACTIVE','DECLINED']).toContain(row.state);
    const transitions=(await h.admin.query(
      `SELECT count(*)::int AS n FROM business_audit_events
       WHERE resource_id=$1
         AND event_type IN ('PARTICIPATION_ACCEPTED','PARTICIPATION_DECLINED')`,
      [created.json().participationId]
    )).rows[0].n;
    expect(transitions).toBe(1);
  });

  it('concurrent double accept converges to ACTIVE with exactly one transition audit', async () => {
    const f=await createParticipationFixture(h,'race-aa',{target:'manager'});
    const target=await addBoundAdultTargetToFamily(h,f.familyId,'race-aa');
    const created=await invite(h.app,f.manager.token,f.caseId,target.personId,'race-aa-invite');
    const [a,b]=await Promise.all([
      acceptInvite(h.app,target.token,created.json().inviteToken,'race-aa-1'),
      acceptInvite(h.app,target.token,created.json().inviteToken,'race-aa-2'),
    ]);
    expect([a.statusCode,b.statusCode]).toEqual([200,200]);
    expect(a.json().state).toBe('ACTIVE');
    expect(b.json().state).toBe('ACTIVE');
    const count=(await h.admin.query(
      `SELECT count(*)::int AS n FROM business_audit_events
       WHERE resource_id=$1 AND event_type='PARTICIPATION_ACCEPTED'`,
      [created.json().participationId]
    )).rows[0].n;
    expect(count).toBe(1);
  });

  it('different create keys cannot produce two live rows for one Case/Person', async () => {
    const f=await createParticipationFixture(h,'race-invite',{target:'manager'});
    const target=await addBoundAdultTargetToFamily(h,f.familyId,'race-invite');
    const keyA='race-invite-a';
    const keyB='race-invite-b';
    const [a,b]=await Promise.all([
      invite(h.app,f.manager.token,f.caseId,target.personId,keyA),
      invite(h.app,f.manager.token,f.caseId,target.personId,keyB),
    ]);
    expect([a.statusCode,b.statusCode].sort()).toEqual([201,409]);

    const loser=a.statusCode===409?{res:a,key:keyA}:{res:b,key:keyB};
    const replay=await invite(
      h.app,f.manager.token,f.caseId,target.personId,loser.key
    );
    expect(replay.statusCode).toBe(409);
    expect(replay.json()).toEqual(loser.res.json());

    const count=(await h.admin.query(
      `SELECT count(*)::int AS n FROM case_participants
       WHERE case_id=$1 AND person_id=$2 AND state IN ('PENDING','ACTIVE')`,
      [f.caseId,target.personId]
    )).rows[0].n;
    expect(count).toBe(1);

    const recorded=(await h.admin.query(
      `SELECT count(*)::int AS n FROM idempotency_keys
       WHERE actor_account_id=$1
         AND command_type='PARTICIPATION_INVITE_CREATE'
         AND idempotency_key IN ($2,$3)`,
      [f.manager.accountId,keyA,keyB]
    )).rows[0].n;
    expect(recorded).toBe(2);
  });
});
