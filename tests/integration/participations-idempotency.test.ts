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

describe('Slice 4 participation idempotency', () => {
  let h: Awaited<ReturnType<typeof buildParticipationApp>>;
  beforeAll(async()=>{h=await buildParticipationApp();});
  afterAll(async()=>{await h.close();});

  it('same create key + same payload replays same participationId and same deterministic token without storing plaintext', async () => {
    const f=await createParticipationFixture(h,'idem-create',{target:'manager'});
    const target=await addBoundAdultTargetToFamily(h,f.familyId,'idem-create');
    const key='idem-create-0001';
    const first=await invite(h.app,f.manager.token,f.caseId,target.personId,key);
    const second=await invite(h.app,f.manager.token,f.caseId,target.personId,key);
    expect(first.statusCode).toBe(201);
    expect(second.statusCode).toBe(201);
    expect(second.json()).toEqual(first.json());

    const idem=(await h.admin.query(
      `SELECT response_body FROM idempotency_keys
       WHERE actor_account_id=$1
         AND command_type='PARTICIPATION_INVITE_CREATE'
         AND idempotency_key=$2`,
      [f.manager.accountId,key]
    )).rows;
    expect(idem).toHaveLength(1);
    expect(JSON.stringify(idem[0].response_body)).not.toContain(first.json().inviteToken);
    expect(idem[0].response_body.inviteToken).toBeUndefined();
  });

  it('same key + different canonical payload is 409 and creates no second participation', async () => {
    const f=await createParticipationFixture(h,'idem-mismatch',{target:'manager'});
    const t1=await addBoundAdultTargetToFamily(h,f.familyId,'idem-mismatch-1');
    const t2=await addBoundAdultTargetToFamily(h,f.familyId,'idem-mismatch-2');
    const key='idem-mismatch-0001';
    const first=await invite(h.app,f.manager.token,f.caseId,t1.personId,key);
    expect(first.statusCode).toBe(201);
    const mismatch=await invite(h.app,f.manager.token,f.caseId,t2.personId,key);
    expect(mismatch.statusCode).toBe(409);
    expect(mismatch.json().code).toBe('IDEMPOTENCY_PAYLOAD_MISMATCH');
    const {rows}=await h.admin.query(
      `SELECT person_id FROM case_participants WHERE case_id=$1`,[f.caseId]
    );
    expect(rows.map((r:any)=>r.person_id)).toEqual([t1.personId]);
  });

  it('concurrent same-key create converges to one row and one token', async () => {
    const f=await createParticipationFixture(h,'idem-concurrent',{target:'manager'});
    const target=await addBoundAdultTargetToFamily(h,f.familyId,'idem-concurrent');
    const key='idem-concurrent-0001';
    const [a,b]=await Promise.all([
      invite(h.app,f.manager.token,f.caseId,target.personId,key),
      invite(h.app,f.manager.token,f.caseId,target.personId,key),
    ]);
    expect([a.statusCode,b.statusCode]).toEqual([201,201]);
    expect(a.json()).toEqual(b.json());
    const count=(await h.admin.query(
      `SELECT count(*)::int AS n FROM case_participants WHERE case_id=$1 AND person_id=$2`,
      [f.caseId,target.personId]
    )).rows[0].n;
    expect(count).toBe(1);
  });

  it('accept same-key replay converges without duplicate accepted audit', async () => {
    const f=await createParticipationFixture(h,'idem-accept',{target:'manager'});
    const target=await addBoundAdultTargetToFamily(h,f.familyId,'idem-accept');
    const created=await invite(h.app,f.manager.token,f.caseId,target.personId,'idem-accept-invite');
    const key='idem-accept-0001';
    const first=await acceptInvite(h.app,target.token,created.json().inviteToken,key);
    const second=await acceptInvite(h.app,target.token,created.json().inviteToken,key);
    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    expect(second.json()).toEqual(first.json());
    const count=(await h.admin.query(
      `SELECT count(*)::int AS n FROM business_audit_events
       WHERE resource_id=$1 AND event_type='PARTICIPATION_ACCEPTED'`,
      [created.json().participationId]
    )).rows[0].n;
    expect(count).toBe(1);
  });
});
