import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client } from 'pg';

const ADMIN_URL = process.env['TEST_ADMIN_DATABASE_URL']!;

describe('Slice 4 live participation uniqueness', () => {
  let db: Client;
  beforeAll(async () => { db = new Client({ connectionString: ADMIN_URL }); await db.connect(); });
  afterAll(async () => { await db.end(); });

  it('has the frozen partial unique index', async () => {
    const { rows }=await db.query(`
      SELECT indexdef FROM pg_indexes
      WHERE schemaname='public' AND tablename='case_participants'
        AND indexname='case_participants_one_live_per_case_person'
    `);
    expect(rows).toHaveLength(1);
    const def=String(rows[0].indexdef).replace(/\s+/g,' ');
    expect(def).toMatch(/UNIQUE INDEX/);
    expect(def).toMatch(/\(case_id, person_id\)/);
    expect(def).toContain('PENDING');
    expect(def).toContain('ACTIVE');
  });

  it('allows terminal history but never two PENDING/ACTIVE rows for one Case/Person', async () => {
    await db.query('BEGIN');
    try {
      const account=(await db.query(
        `INSERT INTO accounts (wechat_openid) VALUES ('s4_live_' || uuidv7()) RETURNING id`
      )).rows[0].id;
      const person=(await db.query(
        `INSERT INTO persons (account_id,created_by_account_id) VALUES ($1,$1) RETURNING id`,[account]
      )).rows[0].id;
      const family=(await db.query(
        `INSERT INTO families (created_by_person_id,display_name) VALUES ($1,'s4') RETURNING id`,[person]
      )).rows[0].id;
      await db.query(`INSERT INTO family_members (family_id,person_id) VALUES ($1,$2)`,[family,person]);
      const caseId=(await db.query(
        `INSERT INTO cases (family_id,created_by_person_id,status,phase,is_primary,version)
         VALUES ($1,$2,'OPEN','INTAKE',true,1) RETURNING id`,[family,person]
      )).rows[0].id;

      const insertPending=(hash:string)=>db.query(
        `INSERT INTO case_participants
          (family_id,case_id,person_id,state,invite_token_hash,invite_expires_at,created_by_person_id)
         VALUES ($1,$2,$3,'PENDING',$4,now()+interval '1 hour',$3) RETURNING id`,
        [family,caseId,person,hash]
      );

      const first=(await insertPending('a'.repeat(64))).rows[0].id;
      await expect(insertPending('b'.repeat(64))).rejects.toMatchObject({ code: '23505' });
      await db.query('ROLLBACK');

      // Re-seed in a fresh transaction after the expected uniqueness error aborts the first.
      await db.query('BEGIN');
      const account2=(await db.query(
        `INSERT INTO accounts (wechat_openid) VALUES ('s4_live_' || uuidv7()) RETURNING id`
      )).rows[0].id;
      const person2=(await db.query(
        `INSERT INTO persons (account_id,created_by_account_id) VALUES ($1,$1) RETURNING id`,[account2]
      )).rows[0].id;
      const family2=(await db.query(
        `INSERT INTO families (created_by_person_id,display_name) VALUES ($1,'s4') RETURNING id`,[person2]
      )).rows[0].id;
      await db.query(`INSERT INTO family_members (family_id,person_id) VALUES ($1,$2)`,[family2,person2]);
      const case2=(await db.query(
        `INSERT INTO cases (family_id,created_by_person_id,status,phase,is_primary,version)
         VALUES ($1,$2,'OPEN','INTAKE',true,1) RETURNING id`,[family2,person2]
      )).rows[0].id;
      const p1=(await db.query(
        `INSERT INTO case_participants
          (family_id,case_id,person_id,state,invite_token_hash,invite_expires_at,created_by_person_id)
         VALUES ($1,$2,$3,'PENDING',$4,now()+interval '1 hour',$3) RETURNING id`,
        [family2,case2,person2,'c'.repeat(64)]
      )).rows[0].id;
      await db.query(
        `UPDATE case_participants SET state='DECLINED',declined_at=now(),updated_at=now() WHERE id=$1`,[p1]
      );
      await db.query(
        `INSERT INTO case_participants
          (family_id,case_id,person_id,state,invite_token_hash,invite_expires_at,created_by_person_id)
         VALUES ($1,$2,$3,'PENDING',$4,now()+interval '1 hour',$3)`,
        [family2,case2,person2,'d'.repeat(64)]
      );
    } finally {
      await db.query('ROLLBACK').catch(()=>{});
    }
  });
});
