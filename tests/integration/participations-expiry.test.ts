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

describe('Slice 4 participation expiry', () => {
  let h: Awaited<ReturnType<typeof buildParticipationApp>>;
  beforeAll(async()=>{h=await buildParticipationApp();});
  afterAll(async()=>{await h.close();});

  async function makeExpired(label:string){
    const f=await createParticipationFixture(h,label,{target:'manager'});
    const target=await addBoundAdultTargetToFamily(h,f.familyId,label);
    const created=await invite(h.app,f.manager.token,f.caseId,target.personId,`${label}-invite`);
    expect(created.statusCode).toBe(201);
    await h.admin.query(
      `UPDATE case_participants
       SET created_at=now()-interval '2 hours',
           invite_expires_at=now()-interval '1 hour'
       WHERE id=$1`,[created.json().participationId]
    );
    return {f,target,created};
  }

  it('public lookup derives expired as unavailable without leaking reason', async () => {
    const {created}=await makeExpired('expiry-lookup');
    const res=await lookupInvite(h.app,created.json().inviteToken);
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({
      code:'INVITATION_NOT_AVAILABLE',message:'Invitation not available',
    });
  });

  it('REM2-004: expired PENDING is materialized and a fresh invite is allowed', async () => {
    const {f,target,created}=await makeExpired('expiry-reinvite');
    const reinvite=await invite(h.app,f.manager.token,f.caseId,target.personId,'expiry-reinvite-new');
    expect(reinvite.statusCode).toBe(201);
    expect(reinvite.json().participationId).not.toBe(created.json().participationId);
    expect(reinvite.json().state).toBe('PENDING');

    const old=(await h.admin.query(
      `SELECT state,expired_at FROM case_participants WHERE id=$1`,
      [created.json().participationId]
    )).rows[0];
    expect(old.state).toBe('EXPIRED');
    expect(old.expired_at).not.toBeNull();
    const audit=(await h.admin.query(
      `SELECT count(*)::int AS n FROM business_audit_events
       WHERE resource_id=$1 AND event_type='PARTICIPATION_EXPIRED'`,
      [created.json().participationId]
    )).rows[0].n;
    expect(audit).toBe(1);
  });

  it('accept at/after deadline materializes EXPIRED and returns authorized 409', async () => {
    const {target,created}=await makeExpired('expiry-accept');
    const res=await acceptInvite(h.app,target.token,created.json().inviteToken,'expiry-accept-command');
    expect(res.statusCode).toBe(409);
    expect(res.json()).toMatchObject({
      code:'PARTICIPATION_STATE_CONFLICT',currentState:'EXPIRED',
    });
    const row=(await h.admin.query(
      `SELECT state,expired_at FROM case_participants WHERE id=$1`,
      [created.json().participationId]
    )).rows[0];
    expect(row.state).toBe('EXPIRED');
    expect(row.expired_at).not.toBeNull();
    const audits=(await h.admin.query(
      `SELECT count(*)::int AS n FROM business_audit_events
       WHERE resource_id=$1 AND event_type='PARTICIPATION_EXPIRED'`,
      [created.json().participationId]
    )).rows[0].n;
    expect(audits).toBe(1);
  });

  it('ordinary authorized read materializes a never-before-accessed expired PENDING row exactly once', async () => {
    const {target,created}=await makeExpired('expiry-read');
    const first=await getParticipation(h.app,target.token,created.json().participationId);
    const second=await getParticipation(h.app,target.token,created.json().participationId);
    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    expect(first.json().state).toBe('EXPIRED');
    expect(second.json().state).toBe('EXPIRED');
    const audits=(await h.admin.query(
      `SELECT count(*)::int AS n FROM business_audit_events
       WHERE resource_id=$1 AND event_type='PARTICIPATION_EXPIRED'`,
      [created.json().participationId]
    )).rows[0].n;
    expect(audits).toBe(1);
  });
});
