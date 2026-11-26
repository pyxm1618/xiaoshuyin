import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import type { GoalContractInput } from '@xiaoshuyin/domain';
import { saveGoal, confirmGoal } from '../../apps/server/api/src/services/goals.js';
import { createAdminPool } from '../setup/db.js';

const PREFIX='a2-goal-target-';

type Fixture={
  accountId:string;
  ownerPersonId:string;
  targetPersonId:string;
  familyId:string;
  caseId:string;
  formulationId:string;
  evidenceId:string;
  contract:GoalContractInput;
};

describe('A/#2 Goal compliance includes the bound Digital Use target',()=>{
  let admin:pg.Pool;
  let pool:pg.Pool;
  let seq=0;

  beforeAll(()=>{
    admin=createAdminPool();
    pool=new pg.Pool({connectionString:process.env['DATABASE_URL']});
  });

  afterAll(async()=>{
    await pool.end();
    await admin.end();
  });

  async function prepare(label:string):Promise<Fixture>{
    const accountId=(await admin.query(
      'INSERT INTO accounts (wechat_openid) VALUES ($1) RETURNING id',
      [`${PREFIX}${label}-${Date.now()}-${seq++}`]
    )).rows[0].id as string;
    const ownerPersonId=(await admin.query(
      'INSERT INTO persons (account_id,created_by_account_id) VALUES ($1,$1) RETURNING id',
      [accountId]
    )).rows[0].id as string;
    const targetPersonId=(await admin.query(
      'INSERT INTO persons (account_id,created_by_account_id) VALUES (NULL,$1) RETURNING id',
      [accountId]
    )).rows[0].id as string;
    const familyId=(await admin.query('SELECT uuidv7() AS id')).rows[0].id as string;
    await admin.query(
      'INSERT INTO families (id,display_name,created_by_person_id) VALUES ($1,$2,$3)',
      [familyId,`A2-${label}`,ownerPersonId]
    );
    await admin.query(
      'INSERT INTO family_members (family_id,person_id) VALUES ($1,$2),($1,$3) ON CONFLICT DO NOTHING',
      [familyId,ownerPersonId,targetPersonId]
    );
    const caseId=(await admin.query(
      "INSERT INTO cases (family_id,created_by_person_id,status,phase,is_primary,version) VALUES ($1,$2,'OPEN','GOALS',true,7) RETURNING id",
      [familyId,ownerPersonId]
    )).rows[0].id as string;

    await admin.query(
      "INSERT INTO person_compliance_profiles (person_id,age_band,minor_mode,verified_source) VALUES ($1,'ADULT',false,'SELF_STATEMENT'),($2,'MINOR_14_17',true,'GUARDIAN_RELAY')",
      [ownerPersonId,targetPersonId]
    );
    await admin.query(
      'INSERT INTO digital_use_assessment_context (case_id,family_id,target_person_id,created_by_person_id) VALUES ($1,$2,$3,$4)',
      [caseId,familyId,targetPersonId,ownerPersonId]
    );

    const evidenceId=crypto.randomUUID();
    await admin.query(
      `INSERT INTO assertions (
         id,family_id,case_id,subject_person_id,source_kind,source_person_id,
         occurred_time_state,occurred_at,valid_from,confirmation_status,kind,content
       ) VALUES ($1,$2,$3,$4,'SELF_STATEMENT',$4,'KNOWN',now(),now()-interval '1 day',
                 'SOURCE_CONFIRMED','STATEMENT','A/#2 goal target compliance evidence')`,
      [evidenceId,familyId,caseId,ownerPersonId]
    );
    const evidence=[{type:'ASSERTION',id:evidenceId}];
    const dependencyRefs=[{type:'EVIDENCE',evidence:evidence[0]}];
    const formulationId=(await admin.query(
      `INSERT INTO problem_formulations
         (family_id,case_id,version,status,review_state,primary_problem,key_factors,
          evidence_refs,unknowns,conflicts,scene_fit,alternative_explanations,
          reassessment_conditions,exit_conditions,user_response,confirmed_by_person_id,
          confirmed_at,dependency_refs,supersedes_version)
       VALUES ($1,$2,1,'CONFIRMED','CURRENT',
          jsonb_build_object('text','A/#2 basis','evidenceRefs',$3::jsonb),
          '[]'::jsonb,$3::jsonb,'[]'::jsonb,'[]'::jsonb,'digital-use',
          '[]'::jsonb,'[]'::jsonb,'[]'::jsonb,
          jsonb_build_object('kind','CONFIRM','actorPersonId',$4::uuid::text,'respondedAt',now()::text),
          $4,now(),$5::jsonb,NULL)
       RETURNING id`,
      [familyId,caseId,JSON.stringify(evidence),ownerPersonId,JSON.stringify(dependencyRefs)]
    )).rows[0].id as string;

    const contract:GoalContractInput={
      problemFormulationId:formulationId,
      problemFormulationVersion:1,
      baselineRefs:[{type:'ASSERTION',id:evidenceId}],
      targetDescription:'Preserve a safe and observable Digital Use goal.',
      observationMethod:'Record agreed observations.',
      observationWindow:'14 days',
      protectiveConditions:['Preserve safety and required contact.'],
      parentActions:['Use the agreed support action.'],
      reviewPoint:'Review after 14 days.',
      dependencyRefs:[{type:'EVIDENCE',evidence:{type:'ASSERTION',id:evidenceId}}],
      participantResponsibilities:[],
    };
    return {accountId,ownerPersonId,targetPersonId,familyId,caseId,formulationId,evidenceId,contract};
  }

  async function cleanup(f:Fixture){
    await admin.query('DELETE FROM scene_node_states WHERE case_id=$1',[f.caseId]).catch(()=>undefined);
    await admin.query('DELETE FROM goals WHERE case_id=$1',[f.caseId]).catch(()=>undefined);
    await admin.query('DELETE FROM problem_formulations WHERE case_id=$1',[f.caseId]).catch(()=>undefined);
    await admin.query('DELETE FROM digital_use_assessment_context WHERE case_id=$1',[f.caseId]).catch(()=>undefined);
    await admin.query('DELETE FROM assertions WHERE case_id=$1',[f.caseId]).catch(()=>undefined);
    await admin.query('DELETE FROM case_events WHERE case_id=$1',[f.caseId]).catch(()=>undefined);
    await admin.query('DELETE FROM business_audit_events WHERE family_id=$1',[f.familyId]).catch(()=>undefined);
    await admin.query('DELETE FROM idempotency_keys WHERE actor_account_id=$1',[f.accountId]).catch(()=>undefined);
    await admin.query('DELETE FROM person_compliance_profiles WHERE person_id IN ($1,$2)',[f.ownerPersonId,f.targetPersonId]).catch(()=>undefined);
    await admin.query('DELETE FROM cases WHERE id=$1',[f.caseId]).catch(()=>undefined);
    await admin.query('DELETE FROM family_members WHERE family_id=$1',[f.familyId]).catch(()=>undefined);
    await admin.query('DELETE FROM families WHERE id=$1',[f.familyId]).catch(()=>undefined);
    await admin.query('DELETE FROM persons WHERE id IN ($1,$2)',[f.ownerPersonId,f.targetPersonId]).catch(()=>undefined);
    await admin.query('DELETE FROM accounts WHERE id=$1',[f.accountId]).catch(()=>undefined);
  }

  async function assertTargetIsNotParticipant(f:Fixture){
    const {rows}=await admin.query<{n:number}>(
      "SELECT count(*)::int AS n FROM case_participants WHERE case_id=$1 AND person_id=$2 AND state='ACTIVE'",
      [f.caseId,f.targetPersonId]
    );
    expect(rows[0].n).toBe(0);
  }

  async function driftTargetToUnknown(f:Fixture){
    await admin.query(
      "UPDATE person_compliance_profiles SET age_band='UNKNOWN',minor_mode=false,updated_at=now() WHERE person_id=$1",
      [f.targetPersonId]
    );
  }

  it('blocks Goal Save after a bound non-participant target drifts to UNKNOWN',async()=>{
    const f=await prepare('save');
    try{
      await assertTargetIsNotParticipant(f);
      await driftTargetToUnknown(f);
      await expect(saveGoal(pool,{
        actor:{accountId:f.accountId,personId:f.ownerPersonId},
        familyId:f.familyId,
        caseId:f.caseId,
        expectedCaseVersion:7,
        idempotencyKey:`a2-save-${Date.now()}-${seq++}`,
        contract:f.contract,
      })).rejects.toMatchObject({code:'COMPLIANCE_BLOCKED'});

      const state=await admin.query(
        'SELECT version,(SELECT count(*)::int FROM goals WHERE case_id=$1) AS goals FROM cases WHERE id=$1',
        [f.caseId]
      );
      expect(state.rows[0]).toEqual({version:7,goals:0});
    }finally{
      await cleanup(f);
    }
  });

  it('blocks Goal Confirm when the bound non-participant target drifts after Save',async()=>{
    const f=await prepare('confirm');
    try{
      await assertTargetIsNotParticipant(f);
      const saved=await saveGoal(pool,{
        actor:{accountId:f.accountId,personId:f.ownerPersonId},
        familyId:f.familyId,
        caseId:f.caseId,
        expectedCaseVersion:7,
        idempotencyKey:`a2-save-ok-${Date.now()}-${seq++}`,
        contract:f.contract,
      });
      expect(saved.status).toBe(201);
      const body=saved.body as {goalId:string;goalVersion:number;caseVersion:number};

      await admin.query(
        `INSERT INTO scene_node_states
           (family_id,case_id,scene_package_version,node_code,source_node_code,status,completed_at)
         VALUES
           ($1,$2,'a2-v1','A1001','A1001','COMPLETED',now()),
           ($1,$2,'a2-v1','A2010','A2007','COMPLETED',now())`,
        [f.familyId,f.caseId]
      );
      await driftTargetToUnknown(f);

      await expect(confirmGoal(pool,{
        actor:{accountId:f.accountId,personId:f.ownerPersonId},
        familyId:f.familyId,
        caseId:f.caseId,
        expectedCaseVersion:body.caseVersion,
        idempotencyKey:`a2-confirm-${Date.now()}-${seq++}`,
        goalId:body.goalId,
        goalVersion:body.goalVersion,
      })).rejects.toMatchObject({code:'COMPLIANCE_BLOCKED'});

      const state=await admin.query(
        'SELECT c.phase,c.version,g.confirmation_state FROM cases c JOIN goals g ON g.case_id=c.id WHERE c.id=$1 AND g.goal_id=$2 AND g.version=$3',
        [f.caseId,body.goalId,body.goalVersion]
      );
      expect(state.rows[0]).toEqual({
        phase:'GOALS',
        version:body.caseVersion,
        confirmation_state:'UNCONFIRMED',
      });
    }finally{
      await cleanup(f);
    }
  });
});
