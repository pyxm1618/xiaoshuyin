import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  buildParticipationApp,
  createParticipationFixture,
} from '../setup/participation.js';

describe('Slice 4 participation terminal history', () => {
  let h: Awaited<ReturnType<typeof buildParticipationApp>>;

  beforeAll(async () => { h = await buildParticipationApp(); });
  afterAll(async () => { await h.close(); });

  it('terminal history is retained and a later invitation may coexist', async () => {
    const f=await createParticipationFixture(h,'history-terminal',{target:'member'});
    const first=(await h.admin.query(
      `INSERT INTO case_participants
        (family_id,case_id,person_id,state,invite_token_hash,invite_expires_at,created_by_person_id)
       VALUES ($1,$2,$3,'PENDING',$4,now()+interval '1 hour',$5)
       RETURNING id`,
      [f.familyId,f.caseId,f.targetPersonId,'1'.repeat(64),f.manager.personId]
    )).rows[0].id as string;

    await h.admin.query(
      `UPDATE case_participants
       SET state='DECLINED',declined_at=now(),updated_at=now()
       WHERE id=$1`,[first]
    );

    const second=(await h.admin.query(
      `INSERT INTO case_participants
        (family_id,case_id,person_id,state,invite_token_hash,invite_expires_at,created_by_person_id)
       VALUES ($1,$2,$3,'PENDING',$4,now()+interval '1 hour',$5)
       RETURNING id`,
      [f.familyId,f.caseId,f.targetPersonId,'2'.repeat(64),f.manager.personId]
    )).rows[0].id as string;

    const {rows}=await h.admin.query(
      `SELECT id,state,declined_at FROM case_participants
       WHERE case_id=$1 AND person_id=$2 ORDER BY created_at,id`,
      [f.caseId,f.targetPersonId]
    );
    expect(rows).toHaveLength(2);
    expect(rows.find((r:any)=>r.id===first)).toMatchObject({state:'DECLINED'});
    expect(rows.find((r:any)=>r.id===first).declined_at).not.toBeNull();
    expect(rows.find((r:any)=>r.id===second)).toMatchObject({state:'PENDING'});
  });

  it('WITHDRAWN preserves the original accepted_at timestamp', async () => {
    const f=await createParticipationFixture(h,'history-withdraw',{target:'member'});
    const row=(await h.admin.query(
      `INSERT INTO case_participants
        (family_id,case_id,person_id,state,invite_token_hash,invite_expires_at,
         created_by_person_id,accepted_at)
       VALUES ($1,$2,$3,'ACTIVE',$4,now()+interval '1 hour',$5,now()-interval '1 minute')
       RETURNING id,accepted_at`,
      [f.familyId,f.caseId,f.targetPersonId,'3'.repeat(64),f.manager.personId]
    )).rows[0];

    await h.admin.query(
      `UPDATE case_participants
       SET state='WITHDRAWN',withdrawn_at=now(),updated_at=now()
       WHERE id=$1`,[row.id]
    );

    const after=(await h.admin.query(
      `SELECT state,accepted_at,withdrawn_at FROM case_participants WHERE id=$1`,[row.id]
    )).rows[0];
    expect(after.state).toBe('WITHDRAWN');
    expect(new Date(after.accepted_at).toISOString()).toBe(new Date(row.accepted_at).toISOString());
    expect(new Date(after.withdrawn_at).getTime()).toBeGreaterThanOrEqual(new Date(after.accepted_at).getTime());
  });

  it('terminal rows cannot be directly reshaped into an illegal ACTIVE row', async () => {
    const f=await createParticipationFixture(h,'history-no-reactivate',{target:'member'});
    const row=(await h.admin.query(
      `INSERT INTO case_participants
        (family_id,case_id,person_id,state,invite_token_hash,invite_expires_at,
         created_by_person_id,declined_at)
       VALUES ($1,$2,$3,'DECLINED',$4,now()+interval '1 hour',$5,now())
       RETURNING id`,
      [f.familyId,f.caseId,f.targetPersonId,'4'.repeat(64),f.manager.personId]
    )).rows[0];
    await expect(
      h.admin.query(`UPDATE case_participants SET state='ACTIVE' WHERE id=$1`,[row.id])
    ).rejects.toMatchObject({code:'23514'});
  });
});
