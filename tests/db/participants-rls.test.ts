import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client } from 'pg';
import { hashParticipationInviteToken } from '@xiaoshuyin/domain';
import {
  addBoundAdultNonManagerToFamily,
  buildParticipationApp,
  createParticipationFixture,
  invite,
} from '../setup/participation.js';

const URL = process.env['MIGRATION_DATABASE_URL'] ?? process.env['DATABASE_URL']!;

describe('Slice 4 case_participants RLS and grants', () => {
  let db: Client;
  beforeAll(async () => { db = new Client({ connectionString: URL }); await db.connect(); });
  afterAll(async () => { await db.end(); });

  it('ENABLEs and FORCEs RLS', async () => {
    const { rows }=await db.query(`
      SELECT relrowsecurity,relforcerowsecurity
      FROM pg_class WHERE oid='case_participants'::regclass
    `);
    expect(rows[0]).toMatchObject({ relrowsecurity:true, relforcerowsecurity:true });
  });

  it('has exactly family/self/token policies with no token write policy', async () => {
    const { rows }=await db.query(`
      SELECT policyname,cmd,qual,with_check FROM pg_policies
      WHERE schemaname='public' AND tablename='case_participants'
      ORDER BY policyname
    `);
    expect(rows.map((r:any)=>r.policyname)).toEqual([
      'case_participants_family_scope',
      'case_participants_invite_token_read',
      'case_participants_self_read',
    ]);
    const token=rows.find((r:any)=>r.policyname==='case_participants_invite_token_read');
    expect(token.cmd).toBe('SELECT');
    expect(String(token.qual)).toContain('app_invite_token_hash()');
    const self=rows.find((r:any)=>r.policyname==='case_participants_self_read');
    expect(self.cmd).toBe('SELECT');
    expect(String(self.qual)).toContain('app_person_id()');
  });

  it('runtime role has SELECT/INSERT/UPDATE but no DELETE', async () => {
    const { rows }=await db.query(`
      SELECT privilege_type FROM information_schema.role_table_grants
      WHERE grantee='xiaoshuyin_app' AND table_name='case_participants'
      ORDER BY privilege_type
    `);
    expect(rows.map((r:any)=>r.privilege_type)).toEqual(['INSERT','SELECT','UPDATE']);
  });
});


describe('Slice 4 case_participants RLS runtime behavior', () => {
  let h: Awaited<ReturnType<typeof buildParticipationApp>>;
  let appDb: Client;

  beforeAll(async()=>{
    h=await buildParticipationApp();
    appDb=new Client({connectionString:process.env['DATABASE_URL']!});
    await appDb.connect();
  });
  afterAll(async()=>{
    await appDb.end();
    await h.close();
  });

  async function inTx<T>(fn:()=>Promise<T>):Promise<T>{
    await appDb.query('BEGIN');
    try{return await fn();}
    finally{await appDb.query('ROLLBACK');}
  }

  it('no context sees zero participation rows', async () => {
    const f=await createParticipationFixture(h,'rls-none',{target:'manager'});
    const target=await addBoundAdultNonManagerToFamily(h,f.familyId,'rls-none');
    const created=await invite(h.app,f.manager.token,f.caseId,target.personId,'rls-none-invite');
    expect(created.statusCode).toBe(201);
    await inTx(async()=>{
      const {rows}=await appDb.query(
        'SELECT count(*)::int AS n FROM case_participants WHERE id=$1',
        [created.json().participationId]
      );
      expect(rows[0].n).toBe(0);
    });
  });

  it('self identity context can read only its own participation', async () => {
    const f=await createParticipationFixture(h,'rls-self',{target:'manager'});
    const target=await addBoundAdultNonManagerToFamily(h,f.familyId,'rls-self');
    const created=await invite(h.app,f.manager.token,f.caseId,target.personId,'rls-self-invite');
    await inTx(async()=>{
      await appDb.query('SELECT app.set_identity_context($1,$2)',[
        target.accountId,'PARTICIPATION'
      ]);
      const {rows}=await appDb.query(
        'SELECT id FROM case_participants WHERE id=$1',
        [created.json().participationId]
      );
      expect(rows.map((r:any)=>r.id)).toEqual([created.json().participationId]);
    });
  });

  it('verified Family context can read the Family row; wrong Family context cannot', async () => {
    const a=await createParticipationFixture(h,'rls-family-a',{target:'manager'});
    const target=await addBoundAdultNonManagerToFamily(h,a.familyId,'rls-family-a');
    const created=await invite(h.app,a.manager.token,a.caseId,target.personId,'rls-family-a-invite');
    const b=await createParticipationFixture(h,'rls-family-b',{target:'manager'});

    await inTx(async()=>{
      await appDb.query('SELECT app.set_identity_context($1,$2)',[
        a.manager.accountId,'FAMILY_MANAGEMENT'
      ]);
      await appDb.query('SELECT app.set_family_context($1,$2,$3)',[
        a.familyId,a.manager.personId,'FAMILY_MANAGEMENT'
      ]);
      const {rows}=await appDb.query(
        'SELECT id FROM case_participants WHERE id=$1',
        [created.json().participationId]
      );
      expect(rows).toHaveLength(1);
    });

    await inTx(async()=>{
      await appDb.query('SELECT app.set_identity_context($1,$2)',[
        b.manager.accountId,'FAMILY_MANAGEMENT'
      ]);
      await appDb.query('SELECT app.set_family_context($1,$2,$3)',[
        b.familyId,b.manager.personId,'FAMILY_MANAGEMENT'
      ]);
      const {rows}=await appDb.query(
        'SELECT id FROM case_participants WHERE id=$1',
        [created.json().participationId]
      );
      expect(rows).toHaveLength(0);
    });
  });

  it('invite token context reads only the matching safe row and cannot UPDATE', async () => {
    const f=await createParticipationFixture(h,'rls-token',{target:'manager'});
    const target=await addBoundAdultNonManagerToFamily(h,f.familyId,'rls-token');
    const created=await invite(h.app,f.manager.token,f.caseId,target.personId,'rls-token-invite');
    const hash=hashParticipationInviteToken(created.json().inviteToken);

    await inTx(async()=>{
      await appDb.query('SELECT app.set_invite_token_context($1)',[hash]);
      const safe=await appDb.query(
        'SELECT participation_id FROM case_participant_invite_public'
      );
      expect(safe.rows.map((r:any)=>r.participation_id)).toEqual([
        created.json().participationId,
      ]);
      const update=await appDb.query(
        `UPDATE case_participants SET updated_at=now() WHERE id=$1 RETURNING id`,
        [created.json().participationId]
      );
      expect(update.rows).toHaveLength(0);
    });

    await inTx(async()=>{
      await appDb.query('SELECT app.set_invite_token_context($1)',['f'.repeat(64)]);
      const safe=await appDb.query(
        'SELECT participation_id FROM case_participant_invite_public'
      );
      expect(safe.rows).toHaveLength(0);
    });
  });
});
