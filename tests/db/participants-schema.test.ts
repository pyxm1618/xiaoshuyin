import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client } from 'pg';

const URL = process.env['MIGRATION_DATABASE_URL'] ?? process.env['DATABASE_URL']!;

describe('Slice 4 case_participants schema', () => {
  let db: Client;
  beforeAll(async () => { db = new Client({ connectionString: URL }); await db.connect(); });
  afterAll(async () => { await db.end(); });

  it('defines the frozen enum vocabulary and order', async () => {
    const { rows } = await db.query(`
      SELECT e.enumlabel
      FROM pg_type t JOIN pg_enum e ON e.enumtypid=t.oid
      WHERE t.typname='case_participation_state'
      ORDER BY e.enumsortorder
    `);
    expect(rows.map((r:any)=>r.enumlabel)).toEqual([
      'PENDING','ACTIVE','DECLINED','EXPIRED','WITHDRAWN',
    ]);
  });

  it('has exactly the frozen columns and no duplicated authority facts', async () => {
    const { rows } = await db.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema='public' AND table_name='case_participants'
      ORDER BY column_name
    `);
    expect(rows.map((r:any)=>r.column_name)).toEqual([
      'accepted_at','case_id','created_at','created_by_person_id','declined_at',
      'expired_at','family_id','id','invite_expires_at','invite_token_hash',
      'person_id','state','updated_at','withdrawn_at',
    ]);
    for (const forbidden of [
      'role','account_id','age_band','guardian_person_id','consent_id',
      'consent_version','binding_state','visibility','deleted_at',
    ]) {
      expect(rows.map((r:any)=>r.column_name)).not.toContain(forbidden);
    }
  });

  it('id uses uuidv7 fallback and state/expiry have no hidden defaults', async () => {
    const { rows } = await db.query(`
      SELECT column_name,column_default
      FROM information_schema.columns
      WHERE table_schema='public' AND table_name='case_participants'
        AND column_name IN ('id','state','invite_expires_at')
    `);
    const byName=Object.fromEntries(rows.map((r:any)=>[r.column_name,r.column_default]));
    expect(String(byName.id)).toMatch(/uuidv7\(\)/);
    expect(byName.state).toBeNull();
    expect(byName.invite_expires_at).toBeNull();
  });

  it('has composite Case and Family-member foreign keys plus reverse member uniqueness', async () => {
    const fks=await db.query(`
      SELECT pg_get_constraintdef(oid) AS def
      FROM pg_constraint
      WHERE conrelid='case_participants'::regclass AND contype='f'
    `);
    const defs=fks.rows.map((r:any)=>String(r.def).replace(/\s+/g,' '));
    expect(defs.some((d:string)=>/FOREIGN KEY \(case_id, family_id\) REFERENCES cases\(id, family_id\)/.test(d))).toBe(true);
    expect(defs.some((d:string)=>/FOREIGN KEY \(person_id, family_id\) REFERENCES family_members\(person_id, family_id\)/.test(d))).toBe(true);

    const unique=await db.query(`
      SELECT pg_get_constraintdef(oid) AS def
      FROM pg_constraint
      WHERE conrelid='family_members'::regclass AND contype='u'
    `);
    expect(unique.rows.map((r:any)=>r.def).some((d:string)=>/UNIQUE \(person_id, family_id\)/.test(d))).toBe(true);
  });
});
