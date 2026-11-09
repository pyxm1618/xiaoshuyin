import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type pg from 'pg';
import {
  getBindingInvitationByTokenHash,
  getBindingInvitationByTrustedTarget,
  hashParticipationInviteToken,
} from '@xiaoshuyin/domain';
import type {
  InvitationResolution,
  InvitationResolutionPort,
} from '../../apps/server/api/src/identity-binding/invitation-port.js';
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

function invitationResult(
  row: {
    participationId: string;
    targetPersonId: string;
    targetFamilyId: string;
    expiresAt: string;
  } | null
): InvitationResolution {
  return row ? { status: 'VALID', ...row } : { status: 'TERMINAL_UNUSABLE' };
}

/**
 * Test-only integration bridge. It does not fake invitation facts: both Gate 1
 * and Gate 2 read the real Slice 4 case_participants runtime under real RLS.
 * Production ownership stays with Slice 5 T121 after Slice 4 merges main.
 */
class AuthoritativeSlice4TestInvitationPort implements InvitationResolutionPort {
  async resolveByToken(tx: pg.PoolClient, invitationToken: string): Promise<InvitationResolution> {
    if (invitationToken.length < 1 || invitationToken.length > 256) {
      return { status: 'TERMINAL_UNUSABLE' };
    }
    const tokenHash = hashParticipationInviteToken(invitationToken);
    const previous=(await tx.query(
      `SELECT COALESCE(current_setting('app.invite_token_hash',true),'') AS value`
    )).rows[0]?.value ?? '';
    await tx.query('SELECT app.set_invite_token_context($1)', [tokenHash]);
    const row=await getBindingInvitationByTokenHash(tx,tokenHash);
    await tx.query(
      `SELECT set_config('app.invite_token_hash',$1,true)`,
      [previous]
    );
    return invitationResult(row);
  }

  async resolveByParticipationId(
    tx: pg.PoolClient,
    participationId: string
  ): Promise<InvitationResolution> {
    const context=(await tx.query(
      `SELECT
         app_binding_target_person_id()::text AS person_id,
         app_binding_target_family_id()::text AS family_id`
    )).rows[0];
    if (!context?.person_id || !context?.family_id) {
      return { status: 'TERMINAL_UNUSABLE' };
    }

    const previous=(await tx.query(
      `SELECT
         COALESCE(current_setting('app.family_id',true),'') AS family_id,
         COALESCE(current_setting('app.person_id',true),'') AS person_id,
         COALESCE(current_setting('app.purpose',true),'') AS purpose`
    )).rows[0];
    await tx.query('SELECT app.set_family_context($1,$2,$3)',[
      context.family_id,context.person_id,'IDENTITY_BINDING'
    ]);
    const row=await getBindingInvitationByTrustedTarget(
      tx,participationId,context.family_id,context.person_id
    );
    await tx.query(
      `SELECT
         set_config('app.family_id',$1,true),
         set_config('app.person_id',$2,true),
         set_config('app.purpose',$3,true)`,
      [previous.family_id,previous.person_id,previous.purpose]
    );
    return invitationResult(row);
  }
}

describe('Slice 4 ↔ Slice 5 identity seam', () => {
  let h: Awaited<ReturnType<typeof buildParticipationApp>>;
  let binding: BindingHarness;

  beforeAll(async()=>{
    h=await buildParticipationApp(new AuthoritativeSlice4TestInvitationPort());
    // Real Slice 5 runtime + real Slice 4 DB facts. Only the production port
    // wiring remains deferred to Slice 5 T121 after this runtime merges main.
    binding=h as unknown as BindingHarness;
  });
  afterAll(async()=>{await h.close();});

  it('Case C: real Slice 4 invitation drives Slice 5 binding, but explicit participation accept is still required', async () => {
    const f=await createParticipationFixture(h,'identity-case-c',{target:'member',ageBand:'MINOR_14_17'});
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

  it('ADULT with no Account cannot use Case C invitation to create a new binding path', async () => {
    const f=await createParticipationFixture(h,'identity-adult-case-c',{target:'member',ageBand:'ADULT'});
    const created=await invite(
      h.app,f.manager.token,f.caseId,f.targetPersonId,'identity-adult-case-c-invite'
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
    const boot=await bootstrap(
      binding,
      target.invitationToken,
      `s4_adult_case_c_${Date.now()}_${crypto.randomUUID()}`,
      'identity-adult-case-c-bootstrap'
    );
    expect(boot.statusCode).toBe(200);
    expect(boot.json().binding).toBe('NOT_COMPLETED');
    expect(await personAccountId(binding,f.targetPersonId)).toBeNull();

    const row=(await h.admin.query(
      'SELECT state FROM case_participants WHERE id=$1',
      [created.json().participationId]
    )).rows[0];
    expect(row.state).toBe('PENDING');
  });

  it('multi-family Case C is blocked generically and creates no committed binding', async () => {
    const f=await createParticipationFixture(h,'identity-multifamily',{target:'member',ageBand:'MINOR_14_17'});
    const created=await invite(
      h.app,f.manager.token,f.caseId,f.targetPersonId,'identity-multifamily-invite'
    );
    expect(created.statusCode).toBe(201);

    const otherOwner=await (async()=>{
      const { loginWithLabel, createFamily }=await import('../setup/api.js');
      const owner=await loginWithLabel(h.app,`s4-multifamily-owner-${crypto.randomUUID()}`);
      const family=await createFamily(h.app,owner.token,`s4-multifamily-${crypto.randomUUID()}`);
      expect(family.statusCode).toBe(201);
      return {owner,familyId:family.json().id as string};
    })();
    await h.admin.query(
      'INSERT INTO family_members (family_id,person_id) VALUES ($1,$2)',
      [otherOwner.familyId,f.targetPersonId]
    );

    const res=await bootstrap(
      binding,
      created.json().inviteToken,
      `s4_multifamily_${Date.now()}_${crypto.randomUUID()}`,
      'identity-multifamily-bootstrap'
    );
    expect(res.statusCode).toBe(200);
    expect(res.json().binding).toBe('NOT_COMPLETED');
    expect(await personAccountId(binding,f.targetPersonId)).toBeNull();

    const committed=(await h.admin.query(
      `SELECT count(*)::int AS n FROM binding_attempts
       WHERE target_person_id=$1 AND state='COMMITTED'`,
      [f.targetPersonId]
    )).rows[0].n;
    expect(committed).toBe(0);
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
