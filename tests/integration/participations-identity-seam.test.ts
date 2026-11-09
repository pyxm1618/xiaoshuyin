import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  acceptInvite,
  addBoundAdultTargetToFamily,
  buildParticipationApp,
  createParticipationFixture,
  getParticipation,
  invite,
} from '../setup/participation.js';
import {
  bootstrap,
  candidateSession,
  confirmerDecision,
  personAccountId,
  startBinding,
  type BindingHarness,
  type TargetFixture,
} from '../setup/identity-binding.js';

describe('Slice 4 ↔ Slice 5 identity seam', () => {
  let h: Awaited<ReturnType<typeof buildParticipationApp>>;
  let binding: BindingHarness;

  beforeAll(async()=>{
    h=await buildParticipationApp();
    // The shared Slice 5 helpers only consume app/admin on these paths.
    // Production app is intentionally NOT injected with InMemoryInvitationPort.
    binding=h as unknown as BindingHarness;
  });
  afterAll(async()=>{await h.close();});

  it('Case C: real Slice 4 invitation drives Slice 5 binding, but explicit participation accept is still required', async () => {
    const f=await createParticipationFixture(h,'identity-case-c',{target:'member'});
    const created=await invite(
      h.app,f.manager.token,f.caseId,f.targetPersonId,'identity-case-c-invite'
    );
    expect(created.statusCode).toBe(201);
    expect(await personAccountId(binding,f.targetPersonId)).toBeNull();

    const target: TargetFixture={
      guardian:f.manager,
      familyId:f.familyId,
      targetPersonId:f.targetPersonId,
      invitationToken:created.json().inviteToken,
      participationId:created.json().participationId,
    };

    const {contextToken,attemptId}=await startBinding(
      binding,target,`s4_case_c_${Date.now()}_${crypto.randomUUID()}`
    );

    // Candidate AFFIRM alone does not bind and does not activate participation.
    expect(await personAccountId(binding,f.targetPersonId)).toBeNull();
    let row=(await h.admin.query(
      'SELECT state FROM case_participants WHERE id=$1',
      [created.json().participationId]
    )).rows[0];
    expect(row.state).toBe('PENDING');

    const confirm=await confirmerDecision(
      binding,
      f.manager.token,
      attemptId,
      {personId:f.targetPersonId,decision:'AFFIRM'}
    );
    expect(confirm.statusCode).toBe(200);
    expect(confirm.json().state).toBe('COMMITTED');

    const boundAccount=await personAccountId(binding,f.targetPersonId);
    expect(boundAccount).not.toBeNull();
    const p2=(await h.admin.query(
      'SELECT count(*)::int AS n FROM persons WHERE created_by_account_id=$1',
      [boundAccount]
    )).rows[0].n;
    expect(p2).toBe(0);

    const session=await candidateSession(binding,contextToken);
    expect(session.statusCode).toBe(200);
    expect(session.json().binding).toBe('COMMITTED');

    const pending=await getParticipation(
      h.app,session.json().sessionToken,created.json().participationId
    );
    expect(pending.statusCode).toBe(200);
    expect(pending.json().state).toBe('PENDING');

    const accepted=await acceptInvite(
      h.app,
      session.json().sessionToken,
      created.json().inviteToken,
      'identity-case-c-explicit-accept'
    );
    expect(accepted.statusCode).toBe(200);
    expect(accepted.json().state).toBe('ACTIVE');
  });

  it('Case B: correct existing Account is reused; wrong Account does not rebind; neither path auto-accepts', async () => {
    const f=await createParticipationFixture(h,'identity-case-b',{target:'manager'});
    const target=await addBoundAdultTargetToFamily(h,f.familyId,'identity-case-b');
    const created=await invite(
      h.app,f.manager.token,f.caseId,target.personId,'identity-case-b-invite'
    );
    expect(created.statusCode).toBe(201);

    const account=(await h.admin.query(
      'SELECT wechat_openid FROM accounts WHERE id=$1',[target.accountId]
    )).rows[0];
    const openid=String(account.wechat_openid);
    const correctCode=openid.startsWith('fake_')?openid.slice(5):openid;

    const reused=await bootstrap(binding,created.json().inviteToken,correctCode,'identity-case-b-reuse');
    expect(reused.statusCode).toBe(200);
    expect(reused.json().binding).toBe('REUSED');
    expect(reused.json().account.id).toBe(target.accountId);

    const wrong=await bootstrap(
      binding,
      created.json().inviteToken,
      `identity_case_b_wrong_${Date.now()}_${crypto.randomUUID()}`,
      'identity-case-b-wrong'
    );
    expect(wrong.statusCode).toBe(200);
    expect(wrong.json().binding).toBe('NOT_COMPLETED');
    expect(await personAccountId(binding,target.personId)).toBe(target.accountId);

    const row=(await h.admin.query(
      'SELECT state FROM case_participants WHERE id=$1',
      [created.json().participationId]
    )).rows[0];
    expect(row.state).toBe('PENDING');
  });

  it('terminal/expired real invitation is generic and cannot create a binding attempt or P2', async () => {
    const f=await createParticipationFixture(h,'identity-terminal',{target:'member'});
    const created=await invite(
      h.app,f.manager.token,f.caseId,f.targetPersonId,'identity-terminal-invite'
    );
    expect(created.statusCode).toBe(201);
    await h.admin.query(
      `UPDATE case_participants
       SET created_at=now()-interval '2 hours',
           invite_expires_at=now()-interval '1 hour'
       WHERE id=$1`,
      [created.json().participationId]
    );

    const res=await bootstrap(
      binding,
      created.json().inviteToken,
      `identity_terminal_${Date.now()}_${crypto.randomUUID()}`,
      'identity-terminal-bootstrap'
    );
    expect(res.statusCode).toBe(200);
    expect(res.json().binding).toBe('NOT_COMPLETED');
    expect(await personAccountId(binding,f.targetPersonId)).toBeNull();

    const attempts=(await h.admin.query(
      'SELECT count(*)::int AS n FROM binding_attempts WHERE target_person_id=$1',
      [f.targetPersonId]
    )).rows[0].n;
    expect(attempts).toBe(0);
  });
});
