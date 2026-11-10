import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client } from 'pg';

const URL = process.env['MIGRATION_DATABASE_URL'] ?? process.env['DATABASE_URL']!;

describe('Slice 4 invite token safe view', () => {
  let db: Client;
  beforeAll(async () => { db = new Client({ connectionString: URL }); await db.connect(); });
  afterAll(async () => { await db.end(); });

  it('exposes only the four safe columns', async () => {
    const { rows }=await db.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema='public' AND table_name='case_participant_invite_public'
      ORDER BY ordinal_position
    `);
    expect(rows.map((r:any)=>r.column_name)).toEqual([
      'participation_id','state','expires_at','created_at',
    ]);
  });

  it('uses security_invoker and filters to live PENDING invitations', async () => {
    const rel=await db.query(`
      SELECT reloptions FROM pg_class
      WHERE oid='case_participant_invite_public'::regclass
    `);
    expect(rel.rows[0].reloptions ?? []).toContain('security_invoker=true');
    const view=await db.query(`
      SELECT definition FROM pg_views
      WHERE schemaname='public' AND viewname='case_participant_invite_public'
    `);
    const def=String(view.rows[0].definition);
    expect(def).toContain('PENDING');
    expect(def).toMatch(/invite_expires_at\s*>\s*now\(\)/);
    for (const forbidden of ['person_id','case_id','family_id','invite_token_hash']) {
      expect(def).not.toMatch(new RegExp('SELECT[^;]*\\b'+forbidden+'\\b','i'));
    }
  });

  it('defines validated invite-token context helpers', async () => {
    const getter=await db.query(`
      SELECT pg_get_functiondef('app_invite_token_hash()'::regprocedure) AS def
    `);
    expect(String(getter.rows[0].def)).toContain('app.invite_token_hash');
    const setter=await db.query(`
      SELECT pg_get_functiondef('app.set_invite_token_context(text)'::regprocedure) AS def
    `);
    const def=String(setter.rows[0].def);
    expect(def).toContain('^[0-9a-f]{64}$');
    expect(def).toContain("set_config('app.invite_token_hash'");
  });
});
