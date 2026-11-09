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

describe('Slice 4 create participation invite', () => {
  let h: Awaited<ReturnType<typeof buildParticipationApp>>;
  beforeAll(async()=>{h=await buildParticipationApp();});
  afterAll(async()=>{await h.close();});

  it('manager creates one PENDING invitation with bearer token, expiry and audit', async () => {
    const f=await createParticipationFixture(h,'invite-happy',{target:'manager'});
    const target=await addBoundAdultTargetToFamily(h,f.familyId,'invite-happy');
    const res=await invite(h.app,f.manager.token,f.caseId,target.personId,'invite-happy-key');
    expect(res.statusCode).toBe(201);
    expect(Object.keys(res.json()).sort()).toEqual([
      'caseId','createdAt','expiresAt','inviteToken','participationId','personId','state',
    ]);
    expect(res.json()).toMatchObject({
      caseId:f.caseId,personId:target.personId,state:'PENDING',
    });
    expect(res.json().inviteToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(new Date(res.json().expiresAt).getTime()).toBeGreaterThan(
      new Date(res.json().createdAt).getTime()
    );

    const row=(await h.admin.query(
      `SELECT state,invite_token_hash FROM case_participants WHERE id=$1`,
      [res.json().participationId]
    )).rows[0];
    expect(row.state).toBe('PENDING');
    expect(row.invite_token_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(row.invite_token_hash).not.toContain(res.json().inviteToken);

    const audit=(await h.admin.query(
      `SELECT event_type,resource_type,metadata
       FROM business_audit_events
       WHERE resource_id=$1 AND event_type='PARTICIPATION_INVITE_CREATED'`,
      [res.json().participationId]
    )).rows;
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({
      event_type:'PARTICIPATION_INVITE_CREATED',
      resource_type:'CASE_PARTICIPANT',
    });
    expect(JSON.stringify(audit[0])).not.toContain(res.json().inviteToken);
  });
});
