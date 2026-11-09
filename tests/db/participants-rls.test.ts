import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client } from 'pg';

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
