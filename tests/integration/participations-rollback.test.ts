import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { activateParticipation } from '@xiaoshuyin/domain';
import { withRlsTransaction } from '../../apps/server/api/src/db/tx.js';
import {
  addBoundAdultNonManagerToFamily,
  buildParticipationApp,
  createParticipationFixture,
  invite,
} from '../setup/participation.js';

describe('Slice 4 transaction rollback', () => {
  let h: Awaited<ReturnType<typeof buildParticipationApp>>;
  let appPool: pg.Pool;

  beforeAll(async()=>{
    h=await buildParticipationApp();
    appPool=new pg.Pool({connectionString:process.env['DATABASE_URL']});
  });
  afterAll(async()=>{
    await appPool.end();
    await h.close();
  });

  async function pending(id:string){
    return (await h.admin.query(
      'SELECT state,accepted_at FROM case_participants WHERE id=$1',[id]
    )).rows[0];
  }

  it('audit CHECK failure after real participation mutation rolls the mutation back', async () => {
    const f=await createParticipationFixture(h,'rollback-audit',{target:'manager'});
    const target=await addBoundAdultNonManagerToFamily(h,f.familyId,'rollback-audit');
    const created=await invite(h.app,f.manager.token,f.caseId,target.personId,'rollback-audit-invite');

    await expect(
      withRlsTransaction(
        appPool,
        {
          familyId:f.familyId,
          accountId:target.accountId,
          personId:target.personId,
          purpose:'PARTICIPATION',
        },
        async(tx)=>{
          const changed=await activateParticipation(tx,created.json().participationId);
          expect(changed?.state).toBe('ACTIVE');
          await tx.query(
            `INSERT INTO business_audit_events
              (family_id,actor_account_id,event_type,resource_type,resource_id,metadata)
             VALUES ($1,$2,'ROLLBACK_TEST_INVALID_EVENT','CASE_PARTICIPANT',$3,'{}'::jsonb)`,
            [f.familyId,target.accountId,created.json().participationId]
          );
        }
      )
    ).rejects.toMatchObject({code:'23514'});

    expect(await pending(created.json().participationId)).toMatchObject({
      state:'PENDING',accepted_at:null,
    });
  });

  it('idempotency CHECK failure after real participation mutation rolls the entire transaction back', async () => {
    const f=await createParticipationFixture(h,'rollback-idem',{target:'manager'});
    const target=await addBoundAdultNonManagerToFamily(h,f.familyId,'rollback-idem');
    const created=await invite(h.app,f.manager.token,f.caseId,target.personId,'rollback-idem-invite');

    await expect(
      withRlsTransaction(
        appPool,
        {
          familyId:f.familyId,
          accountId:target.accountId,
          personId:target.personId,
          purpose:'PARTICIPATION',
        },
        async(tx)=>{
          const changed=await activateParticipation(tx,created.json().participationId);
          expect(changed?.state).toBe('ACTIVE');
          await tx.query(
            `INSERT INTO idempotency_keys
              (actor_account_id,command_type,idempotency_key,request_hash,response_status,response_body)
             VALUES ($1,'ROLLBACK_TEST_INVALID_COMMAND',$2,$3,200,'{}'::jsonb)`,
            [target.accountId,'rollback-invalid-key','a'.repeat(64)]
          );
        }
      )
    ).rejects.toMatchObject({code:'23514'});

    expect(await pending(created.json().participationId)).toMatchObject({
      state:'PENDING',accepted_at:null,
    });
    const idem=(await h.admin.query(
      `SELECT count(*)::int AS n FROM idempotency_keys
       WHERE actor_account_id=$1 AND idempotency_key='rollback-invalid-key'`,
      [target.accountId]
    )).rows[0].n;
    expect(idem).toBe(0);
  });
});
