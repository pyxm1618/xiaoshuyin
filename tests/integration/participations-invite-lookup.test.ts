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

describe('Slice 4 public invitation lookup', () => {
  let h: Awaited<ReturnType<typeof buildParticipationApp>>;
  beforeAll(async()=>{h=await buildParticipationApp();});
  afterAll(async()=>{await h.close();});

  it('returns only the frozen safe projection for a live PENDING token', async () => {
    const f=await createParticipationFixture(h,'lookup-live',{target:'manager'});
    const target=await addBoundAdultTargetToFamily(h,f.familyId,'lookup-live');
    const created=await invite(h.app,f.manager.token,f.caseId,target.personId,'lookup-live-key');
    expect(created.statusCode).toBe(201);
    const res=await lookupInvite(h.app,created.json().inviteToken);
    expect(res.statusCode).toBe(200);
    expect(Object.keys(res.json()).sort()).toEqual([
      'expiresAt','notice','participationId','state',
    ]);
    expect(res.json().state).toBe('PENDING');
    expect(Object.keys(res.json().notice).sort()).toEqual(['body','title','version']);
    const serialized=JSON.stringify(res.json());
    for(const forbidden of [
      target.personId,f.caseId,f.familyId,'guardianPersonId','consentId','ageBand'
    ]) expect(serialized).not.toContain(forbidden);
  });

  it('invalid, expired and terminal invitations all converge to the same 404', async () => {
    const invalid=await lookupInvite(h.app,'invalid-token');
    expect(invalid.statusCode).toBe(404);
    expect(invalid.json()).toEqual({
      code:'INVITATION_NOT_AVAILABLE',message:'Invitation not available',
    });

    const f=await createParticipationFixture(h,'lookup-terminal',{target:'manager'});
    const target=await addBoundAdultTargetToFamily(h,f.familyId,'lookup-terminal');
    const created=await invite(h.app,f.manager.token,f.caseId,target.personId,'lookup-term-key');
    expect(created.statusCode).toBe(201);
    const declined=await declineParticipation(
      h.app,target.token,created.json().participationId,'lookup-term-decline'
    );
    expect(declined.statusCode).toBe(200);
    const terminal=await lookupInvite(h.app,created.json().inviteToken);
    expect(terminal.statusCode).toBe(404);
    expect(terminal.json()).toEqual(invalid.json());

    const e=await createParticipationFixture(h,'lookup-expired',{target:'manager'});
    const expTarget=await addBoundAdultTargetToFamily(h,e.familyId,'lookup-expired');
    const exp=await invite(h.app,e.manager.token,e.caseId,expTarget.personId,'lookup-exp-key');
    await h.admin.query(
      `UPDATE case_participants
       SET created_at=now()-interval '2 hours',
           invite_expires_at=now()-interval '1 hour'
       WHERE id=$1`,[exp.json().participationId]
    );
    const expired=await lookupInvite(h.app,exp.json().inviteToken);
    expect(expired.statusCode).toBe(404);
    expect(expired.json()).toEqual(invalid.json());
  });
});
