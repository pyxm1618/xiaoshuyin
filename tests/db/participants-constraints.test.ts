import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client } from 'pg';

const URL = process.env['MIGRATION_DATABASE_URL'] ?? process.env['DATABASE_URL']!;

describe('Slice 4 case_participants constraints', () => {
  let db: Client;
  beforeAll(async () => { db = new Client({ connectionString: URL }); await db.connect(); });
  afterAll(async () => { await db.end(); });

  it('enforces token hash shape and expiry ordering', async () => {
    const { rows }=await db.query(`
      SELECT conname, pg_get_constraintdef(oid) AS def
      FROM pg_constraint
      WHERE conrelid='case_participants'::regclass AND contype='c'
    `);
    const map=Object.fromEntries(rows.map((r:any)=>[r.conname,String(r.def).replace(/\s+/g,' ')]));
    expect(map.case_participants_invite_token_hash_check).toMatch(/\^\[0-9a-f\]\{64\}\$/);
    expect(map.case_participants_invite_expiry_check).toMatch(/invite_expires_at > created_at/);
    expect(map.case_participants_expired_at_after_deadline_check).toMatch(/expired_at.*invite_expires_at/);
    expect(map.case_participants_withdrawn_after_accept_check).toMatch(/withdrawn_at.*accepted_at/);
    expect(map.case_participants_accept_after_create_check).toMatch(/accepted_at.*created_at/);
    expect(map.case_participants_decline_after_create_check).toMatch(/declined_at.*created_at/);
  });

  it('encodes the five legal state/timestamp shapes in one CHECK', async () => {
    const { rows }=await db.query(`
      SELECT pg_get_constraintdef(oid) AS def
      FROM pg_constraint
      WHERE conrelid='case_participants'::regclass
        AND conname='case_participants_state_timestamps_check'
    `);
    expect(rows).toHaveLength(1);
    const def=String(rows[0].def);
    for (const state of ['PENDING','ACTIVE','DECLINED','EXPIRED','WITHDRAWN']) {
      expect(def).toContain(state);
    }
    expect(def).toContain('accepted_at');
    expect(def).toContain('declined_at');
    expect(def).toContain('expired_at');
    expect(def).toContain('withdrawn_at');
  });

  it('token hash is globally unique', async () => {
    const { rows }=await db.query(`
      SELECT pg_get_constraintdef(oid) AS def
      FROM pg_constraint
      WHERE conrelid='case_participants'::regclass AND contype='u'
    `);
    expect(rows.map((r:any)=>r.def).some((d:string)=>/UNIQUE \(invite_token_hash\)/.test(d))).toBe(true);
  });
});
