import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getCurrentNoticeHash } from '@xiaoshuyin/compliance';
import {
  acceptInvite,
  addBoundAdultNonManagerToFamily,
  buildParticipationApp,
  createParticipationFixture,
  declineParticipation,
  invite,
  withdrawParticipation,
} from '../setup/participation.js';

describe('Slice 4 participation compliance gate', () => {
  let h: Awaited<ReturnType<typeof buildParticipationApp>>;

  beforeAll(async()=>{h=await buildParticipationApp();});
  afterAll(async()=>{await h.close();});

  const evidence={
    channel:'TEST',
    accepted_text_hash:'a'.repeat(64),
    declared_age_band:'UNDER_14',
    client_ip_hash:'b'.repeat(64),
    user_agent_hash:'c'.repeat(64),
  };

  async function makeUnder14Valid(
    familyId:string,
    guardian:{personId:string;accountId:string},
    targetPersonId:string
  ){
    const noticeHash=getCurrentNoticeHash();
    const request=(await h.admin.query(
      `INSERT INTO guardian_consent_requests
        (family_id,guardian_person_id,subject_person_id,declared_age_band,
         notice_version,notice_hash,status,expires_at,completed_at)
       VALUES ($1,$2,$3,'UNDER_14','v1',$4,'GRANTED',
               now()+interval '24 hours',now())
       RETURNING id`,
      [familyId,guardian.personId,targetPersonId,noticeHash]
    )).rows[0].id as string;

    const consent=(await h.admin.query(
      `INSERT INTO consent_records
        (family_id,guardian_person_id,guardian_account_id,purpose,decision,version,
         onboarding_request_id,bound_person_id,bound_at,notice_version,notice_hash,
         policy_version,evidence)
       VALUES ($1,$2,$3,'UNDER_14_GUARDIAN_CONSENT','GRANTED',1,
               $4,$5,now(),'v1',$6,'v1',$7::jsonb)
       RETURNING id`,
      [
        familyId,guardian.personId,guardian.accountId,request,targetPersonId,
        noticeHash,JSON.stringify(evidence),
      ]
    )).rows[0].id as string;

    await h.admin.query(
      `UPDATE person_compliance_profiles
       SET age_band='UNDER_14',
           minor_mode=true,
           guardian_person_id=$2,
           guardian_consent_record_id=$3,
           guardian_consent_version=1,
           verified_source='GUARDIAN_RELAY',
           updated_at=now()
       WHERE person_id=$1`,
      [targetPersonId,guardian.personId,consent]
    );
    return {consent,noticeHash};
  }

  async function revoke(
    familyId:string,
    guardian:{personId:string;accountId:string},
    targetPersonId:string,
    priorConsentId:string,
    noticeHash:string
  ){
    const revoked=(await h.admin.query(
      `INSERT INTO consent_records
        (family_id,guardian_person_id,guardian_account_id,purpose,decision,version,
         onboarding_request_id,bound_person_id,bound_at,notice_version,notice_hash,
         policy_version,evidence,supersedes_id)
       VALUES ($1,$2,$3,'UNDER_14_GUARDIAN_CONSENT','REVOKED',2,
               NULL,$4,now(),'v1',$5,'v1',$6::jsonb,$7)
       RETURNING id`,
      [
        familyId,guardian.personId,guardian.accountId,targetPersonId,
        noticeHash,JSON.stringify(evidence),priorConsentId,
      ]
    )).rows[0].id as string;
    await h.admin.query(
      `UPDATE person_compliance_profiles
       SET guardian_consent_record_id=$2,
           guardian_consent_version=2,
           updated_at=now()
       WHERE person_id=$1`,
      [targetPersonId,revoked]
    );
    return revoked;
  }

  it('UNDER_14 with current valid consent may be invited and explicitly accept', async () => {
    const f=await createParticipationFixture(h,'compliance-u14-valid',{target:'manager'});
    const target=await addBoundAdultNonManagerToFamily(h,f.familyId,'compliance-u14-valid');
    await makeUnder14Valid(f.familyId,f.manager,target.personId);

    const created=await invite(
      h.app,f.manager.token,f.caseId,target.personId,'compliance-u14-valid-invite'
    );
    expect(created.statusCode).toBe(201);
    const accepted=await acceptInvite(
      h.app,target.token,created.json().inviteToken,'compliance-u14-valid-accept'
    );
    expect(accepted.statusCode).toBe(200);
    expect(accepted.json().state).toBe('ACTIVE');
  });

  it('accept re-reads current UNDER_14 consent and blocks after revocation', async () => {
    const f=await createParticipationFixture(h,'compliance-u14-revoke',{target:'manager'});
    const target=await addBoundAdultNonManagerToFamily(h,f.familyId,'compliance-u14-revoke');
    const valid=await makeUnder14Valid(f.familyId,f.manager,target.personId);
    const created=await invite(
      h.app,f.manager.token,f.caseId,target.personId,'compliance-u14-revoke-invite'
    );
    expect(created.statusCode).toBe(201);

    await revoke(
      f.familyId,f.manager,target.personId,valid.consent,valid.noticeHash
    );

    const accepted=await acceptInvite(
      h.app,target.token,created.json().inviteToken,'compliance-u14-revoke-accept'
    );
    expect(accepted.statusCode).toBe(404);
    expect(accepted.json()).toEqual({
      code:'PARTICIPATION_NOT_FOUND',message:'Participation not found',
    });
    const row=(await h.admin.query(
      'SELECT state FROM case_participants WHERE id=$1',
      [created.json().participationId]
    )).rows[0];
    expect(row.state).toBe('PENDING');
  });

  it('invite create also re-reads current consent and rejects revoked target', async () => {
    const f=await createParticipationFixture(h,'compliance-u14-create-block',{target:'manager'});
    const target=await addBoundAdultNonManagerToFamily(h,f.familyId,'compliance-u14-create-block');
    const valid=await makeUnder14Valid(f.familyId,f.manager,target.personId);
    await revoke(
      f.familyId,f.manager,target.personId,valid.consent,valid.noticeHash
    );
    const res=await invite(
      h.app,f.manager.token,f.caseId,target.personId,'compliance-u14-create-block-invite'
    );
    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe('PARTICIPATION_TARGET_INELIGIBLE');
  });

  it('decline and withdraw are not blocked by a later invalid compliance state', async () => {
    // Decline after gate becomes invalid.
    const d=await createParticipationFixture(h,'compliance-decline',{target:'manager'});
    const dt=await addBoundAdultNonManagerToFamily(h,d.familyId,'compliance-decline');
    const dc=await makeUnder14Valid(d.familyId,d.manager,dt.personId);
    const di=await invite(h.app,d.manager.token,d.caseId,dt.personId,'compliance-decline-invite');
    await revoke(d.familyId,d.manager,dt.personId,dc.consent,dc.noticeHash);
    const declined=await declineParticipation(
      h.app,dt.token,di.json().participationId,'compliance-decline-command'
    );
    expect(declined.statusCode).toBe(200);
    expect(declined.json().state).toBe('DECLINED');

    // Withdraw after a valid accept, then consent becomes invalid.
    const w=await createParticipationFixture(h,'compliance-withdraw',{target:'manager'});
    const wt=await addBoundAdultNonManagerToFamily(h,w.familyId,'compliance-withdraw');
    const wc=await makeUnder14Valid(w.familyId,w.manager,wt.personId);
    const wi=await invite(h.app,w.manager.token,w.caseId,wt.personId,'compliance-withdraw-invite');
    const active=await acceptInvite(
      h.app,wt.token,wi.json().inviteToken,'compliance-withdraw-accept'
    );
    expect(active.statusCode).toBe(200);
    await revoke(w.familyId,w.manager,wt.personId,wc.consent,wc.noticeHash);
    const withdrawn=await withdrawParticipation(
      h.app,wt.token,wi.json().participationId,'compliance-withdraw-command'
    );
    expect(withdrawn.statusCode).toBe(200);
    expect(withdrawn.json().state).toBe('WITHDRAWN');
  });

  it('UNKNOWN current profile fails closed at invite creation with zero participation write', async () => {
    const f=await createParticipationFixture(h,'compliance-unknown-create',{target:'manager'});
    const target=await addBoundAdultNonManagerToFamily(h,f.familyId,'compliance-unknown-create');
    await h.admin.query(
      `UPDATE person_compliance_profiles
       SET age_band='UNKNOWN',
           minor_mode=false,
           guardian_person_id=NULL,
           guardian_consent_record_id=NULL,
           guardian_consent_version=NULL,
           verified_source='SELF_STATEMENT',
           updated_at=now()
       WHERE person_id=$1`,
      [target.personId]
    );

    const before=(await h.admin.query(
      'SELECT count(*)::int AS n FROM case_participants WHERE case_id=$1 AND person_id=$2',
      [f.caseId,target.personId]
    )).rows[0].n;
    const res=await invite(
      h.app,f.manager.token,f.caseId,target.personId,'compliance-unknown-create-invite'
    );
    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({
      code:'PARTICIPATION_TARGET_INELIGIBLE',
      message:'Participation target is not eligible',
    });
    const after=(await h.admin.query(
      'SELECT count(*)::int AS n FROM case_participants WHERE case_id=$1 AND person_id=$2',
      [f.caseId,target.personId]
    )).rows[0].n;
    expect(after).toBe(before);
  });

  it('accept re-reads current profile and fails closed if it becomes UNKNOWN', async () => {
    const f=await createParticipationFixture(h,'compliance-unknown-accept',{target:'manager'});
    const target=await addBoundAdultNonManagerToFamily(h,f.familyId,'compliance-unknown-accept');
    const created=await invite(
      h.app,f.manager.token,f.caseId,target.personId,'compliance-unknown-accept-invite'
    );
    expect(created.statusCode).toBe(201);

    await h.admin.query(
      `UPDATE person_compliance_profiles
       SET age_band='UNKNOWN',
           minor_mode=false,
           guardian_person_id=NULL,
           guardian_consent_record_id=NULL,
           guardian_consent_version=NULL,
           verified_source='SELF_STATEMENT',
           updated_at=now()
       WHERE person_id=$1`,
      [target.personId]
    );

    const accepted=await acceptInvite(
      h.app,target.token,created.json().inviteToken,'compliance-unknown-accept-command'
    );
    expect(accepted.statusCode).toBe(404);
    expect(accepted.json()).toEqual({
      code:'PARTICIPATION_NOT_FOUND',message:'Participation not found',
    });
    const row=(await h.admin.query(
      'SELECT state,accepted_at FROM case_participants WHERE id=$1',
      [created.json().participationId]
    )).rows[0];
    expect(row.state).toBe('PENDING');
    expect(row.accepted_at).toBeNull();
  });

  it('MINOR_14_17 current profile is allowed in minor mode without UNDER_14 consent', async () => {
    const f=await createParticipationFixture(h,'compliance-minor',{target:'manager'});
    const target=await addBoundAdultNonManagerToFamily(h,f.familyId,'compliance-minor');
    await h.admin.query(
      `UPDATE person_compliance_profiles
       SET age_band='MINOR_14_17',
           minor_mode=true,
           guardian_person_id=NULL,
           guardian_consent_record_id=NULL,
           guardian_consent_version=NULL,
           verified_source='GUARDIAN_RELAY',
           updated_at=now()
       WHERE person_id=$1`,
      [target.personId]
    );
    const created=await invite(
      h.app,f.manager.token,f.caseId,target.personId,'compliance-minor-invite'
    );
    expect(created.statusCode).toBe(201);
    const accepted=await acceptInvite(
      h.app,target.token,created.json().inviteToken,'compliance-minor-accept'
    );
    expect(accepted.statusCode).toBe(200);
    expect(accepted.json().state).toBe('ACTIVE');
  });
});
