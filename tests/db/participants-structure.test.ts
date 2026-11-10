import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client } from 'pg';
import { buildApp } from '../../apps/server/api/src/app.js';

const URL=process.env['MIGRATION_DATABASE_URL'] ?? process.env['DATABASE_URL']!;

describe('Slice 4 structural scope boundary', () => {
  let db: Client;
  beforeAll(async()=>{db=new Client({connectionString:URL});await db.connect();});
  afterAll(async()=>{await db.end();});

  it('case_participants is the only new participation business table', async () => {
    const {rows}=await db.query(
      `SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename`
    );
    const names=rows.map((r:any)=>r.tablename);
    expect(names).toContain('case_participants');
    for(const forbidden of [
      'participant_responses','participation_responses','participant_roles',
      'intervention_instances','interventions','goals','plans','plan_items',
      'task_assignments','notifications','notification_deliveries',
      'assessments','problem_formulations','scenes','ai_outputs',
    ]){
      expect(names,forbidden).not.toContain(forbidden);
    }
  });

  it('adds no role/visibility/generic-response enum vocabulary', async () => {
    const {rows}=await db.query(
      `SELECT t.typname FROM pg_type t
       JOIN pg_namespace n ON n.oid=t.typnamespace
       WHERE n.nspname='public' AND t.typtype='e' ORDER BY t.typname`
    );
    const names=rows.map((r:any)=>String(r.typname));
    for(const forbidden of [
      'participant_role','participation_role','visibility','response_type',
      'intervention_type','notification_type'
    ]){
      expect(names).not.toContain(forbidden);
    }
  });

  it('runtime exposes no generic participant response or out-of-scope management routes', async () => {
    const routes:string[]=[];
    const app=await buildApp({
      onRoute(route){
        const methods=Array.isArray(route.method)?route.method:[route.method];
        for(const method of methods){
          const key=`${String(method).toUpperCase()} ${route.url}`;
          if(key.includes('particip')) routes.push(key);
        }
      },
    });
    await app.ready();
    try{
      const joined=routes.join('\n');
      for(const forbidden of [
        '/responses','/participants','/cancel','/restore','/pause','/resume',
        '/close','/switch-primary','/interventions','/goals','/plans','/tasks'
      ]){
        expect(joined).not.toContain(forbidden);
      }
    }finally{
      await app.close();
    }
  });
});
