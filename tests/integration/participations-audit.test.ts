import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  acceptInvite,
  addBoundAdultNonManagerToFamily,
  buildParticipationApp,
  createParticipationFixture,
  declineParticipation,
  getParticipation,
  invite,
  withdrawParticipation,
} from '../setup/participation.js';

describe('Slice 4 participation audit', () => {
  let h: Awaited<ReturnType<typeof buildParticipationApp>>;
  beforeAll(async()=>{h=await buildParticipationApp();});
  afterAll(async()=>{await h.close();});

  async function events(id:string){
    return (await h.admin.query(
      `SELECT event_type,actor_account_id,resource_type,resource_id,metadata
       FROM business_audit_events
       WHERE resource_id=$1
         AND event_type LIKE 'PARTICIPATION_%'
       ORDER BY occurred_at,event_type`,
      [id]
    )).rows;
  }

  it('records invite + accept exactly once with actor/resource and no bearer/openid leakage', async () => {
    const f=await createParticipationFixture(h,'audit-accept',{target:'manager'});
    const target=await addBoundAdultNonManagerToFamily(h,f.familyId,'audit-accept');
    const created=await invite(h.app,f.manager.token,f.caseId,target.personId,'audit-accept-invite');
    await acceptInvite(h.app,target.token,created.json().inviteToken,'audit-accept-command');
    await acceptInvite(h.app,target.token,created.json().inviteToken,'audit-accept-command');

    const rows=await events(created.json().participationId);
    expect(rows.map((r:any)=>r.event_type)).toEqual([
      'PARTICIPATION_INVITE_CREATED','PARTICIPATION_ACCEPTED',
    ]);
    const inviteEvent=rows.find((r:any)=>r.event_type==='PARTICIPATION_INVITE_CREATED');
    const acceptEvent=rows.find((r:any)=>r.event_type==='PARTICIPATION_ACCEPTED');
    expect(inviteEvent.actor_account_id).toBe(f.manager.accountId);
    expect(acceptEvent.actor_account_id).toBe(target.accountId);
    for(const row of rows){
      expect(row.resource_type).toBe('CASE_PARTICIPANT');
      expect(row.resource_id).toBe(created.json().participationId);
      const serialized=JSON.stringify(row);
      expect(serialized).not.toContain(created.json().inviteToken);
      expect(serialized).not.toMatch(/wechat_openid|openid/i);
    }
  });

  it('records decline and withdraw exactly once', async () => {
    const d=await createParticipationFixture(h,'audit-decline',{target:'manager'});
    const dt=await addBoundAdultNonManagerToFamily(h,d.familyId,'audit-decline');
    const di=await invite(h.app,d.manager.token,d.caseId,dt.personId,'audit-decline-invite');
    await declineParticipation(h.app,dt.token,di.json().participationId,'audit-decline-command');
    await declineParticipation(h.app,dt.token,di.json().participationId,'audit-decline-command-2');
    expect((await events(di.json().participationId))
      .filter((r:any)=>r.event_type==='PARTICIPATION_DECLINED')).toHaveLength(1);

    const w=await createParticipationFixture(h,'audit-withdraw',{target:'manager'});
    const wt=await addBoundAdultNonManagerToFamily(h,w.familyId,'audit-withdraw');
    const wi=await invite(h.app,w.manager.token,w.caseId,wt.personId,'audit-withdraw-invite');
    await acceptInvite(h.app,wt.token,wi.json().inviteToken,'audit-withdraw-accept');
    await withdrawParticipation(h.app,wt.token,wi.json().participationId,'audit-withdraw-command');
    await withdrawParticipation(h.app,wt.token,wi.json().participationId,'audit-withdraw-command-2');
    expect((await events(wi.json().participationId))
      .filter((r:any)=>r.event_type==='PARTICIPATION_WITHDRAWN')).toHaveLength(1);
  });

  it('materialized expiry is audited exactly once', async () => {
    const f=await createParticipationFixture(h,'audit-expiry',{target:'manager'});
    const target=await addBoundAdultNonManagerToFamily(h,f.familyId,'audit-expiry');
    const created=await invite(h.app,f.manager.token,f.caseId,target.personId,'audit-expiry-invite');
    await h.admin.query(
      `UPDATE case_participants
       SET created_at=now()-interval '2 hours',
           invite_expires_at=now()-interval '1 hour'
       WHERE id=$1`,[created.json().participationId]
    );
    const one=await getParticipation(h.app,target.token,created.json().participationId);
    const two=await getParticipation(h.app,target.token,created.json().participationId);
    expect(one.json().state).toBe('EXPIRED');
    expect(two.json().state).toBe('EXPIRED');
    expect((await events(created.json().participationId))
      .filter((r:any)=>r.event_type==='PARTICIPATION_EXPIRED')).toHaveLength(1);
  });
});
