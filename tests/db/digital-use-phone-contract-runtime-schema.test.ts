import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client } from 'pg';
import { getTableConfig, PgDialect } from 'drizzle-orm/pg-core';
import { digitalUseContractVersions } from '@xiaoshuyin/domain';
import * as drizzleSchema from '../../db/schema/index.js';

const URL=process.env['MIGRATION_DATABASE_URL'] ?? process.env['DATABASE_URL']!;

const pgDialect=new PgDialect();

function normalizeSqlExpr(value:string|null):string|null{
  return value===null?null:value.replace(/\s+/g,' ').trim();
}

function drizzleDefaultExpr(column:any):string|null{
  const value=column.default;
  if(value===undefined) return null;
  if(typeof value==='string'){
    return `'${value.replaceAll("'", "''")}'::${column.getSQLType()}`;
  }
  if(typeof value==='number'||typeof value==='bigint') return String(value);
  if(typeof value==='boolean') return value?'true':'false';
  if(value&&typeof value==='object'&&'queryChunks' in value){
    return normalizeSqlExpr(pgDialect.sqlToQuery(value).sql);
  }
  throw new Error(`Unsupported Drizzle default for ${column.name}`);
}

function drizzleGeneratedExpr(column:any):string|null{
  const generated=column.generated;
  if(!generated) return null;
  const raw=typeof generated.as==='function'?generated.as():generated.as;
  if(typeof raw==='string') return normalizeSqlExpr(raw);
  if(raw&&typeof raw==='object'&&'queryChunks' in raw){
    return normalizeSqlExpr(pgDialect.sqlToQuery(raw).sql);
  }
  throw new Error(`Unsupported Drizzle generated expression for ${column.name}`);
}

describe('Slice 14 phone-use Contract runtime schema', () => {
  let db:Client;
  beforeAll(async()=>{db=new Client({connectionString:URL});await db.connect();});
  afterAll(async()=>{await db.end();});

  it('creates only the three approved Slice 14 business tables', async () => {
    const {rows}=await db.query(
      `SELECT tablename FROM pg_tables
       WHERE schemaname='public'
         AND tablename IN ('digital_use_contract_versions','roleplay_sessions','roleplay_turns')
       ORDER BY tablename`
    );
    expect(rows.map((r:any)=>r.tablename)).toEqual([
      'digital_use_contract_versions','roleplay_sessions','roleplay_turns',
    ]);
    const forbidden=await db.query(
      `SELECT tablename FROM pg_tables
       WHERE schemaname='public'
         AND tablename IN ('phone_contract_scene_states','phone_contract_scene_artifacts','generic_contract_engine','generic_workflow_tables')`
    );
    expect(forbidden.rows).toHaveLength(0);
  });

  it('keeps actual Contract columns aligned with the Drizzle projection and drizzle-kit entrypoint', async () => {
    expect(drizzleSchema.digitalUseContractVersions).toBe(digitalUseContractVersions);

    const {rows}=await db.query<{
      name:string;sql_type:string;not_null:boolean;
      default_expr:string|null;generated_expr:string|null;
    }>(
      `SELECT a.attname AS name,
              format_type(a.atttypid, a.atttypmod) AS sql_type,
              a.attnotnull AS not_null,
              CASE WHEN a.attgenerated='' THEN pg_get_expr(ad.adbin,ad.adrelid) ELSE NULL END AS default_expr,
              CASE WHEN a.attgenerated<>'' THEN pg_get_expr(ad.adbin,ad.adrelid) ELSE NULL END AS generated_expr
         FROM pg_attribute a
         LEFT JOIN pg_attrdef ad
           ON ad.adrelid=a.attrelid AND ad.adnum=a.attnum
        WHERE a.attrelid='public.digital_use_contract_versions'::regclass
          AND a.attnum > 0
          AND NOT a.attisdropped
        ORDER BY a.attnum`
    );
    const projected=getTableConfig(digitalUseContractVersions).columns.map((column)=>({
      name:column.name,
      sql_type:column.getSQLType(),
      not_null:column.notNull,
      default_expr:normalizeSqlExpr(drizzleDefaultExpr(column)),
      generated_expr:normalizeSqlExpr(drizzleGeneratedExpr(column)),
    }));
    const actual=rows.map((column)=>({
      ...column,
      default_expr:normalizeSqlExpr(column.default_expr),
      generated_expr:normalizeSqlExpr(column.generated_expr),
    }));
    expect(actual).toEqual(projected);
    expect(projected.find((column)=>column.name==='child_participation_id')).toEqual({
      name:'child_participation_id',
      sql_type:'uuid',
      not_null:false,
      default_expr:null,
      generated_expr:null,
    });
    expect(projected.find((column)=>column.name==='status')).toMatchObject({
      default_expr:"'DRAFT'::text",
      generated_expr:null,
    });
    expect(projected.at(-1)).toEqual({
      name:'review_state',
      sql_type:'text',
      not_null:true,
      default_expr:"'CURRENT'::text",
      generated_expr:null,
    });
  });

  it('FORCEs RLS on every new business table', async () => {
    const {rows}=await db.query(
      `SELECT relname,relrowsecurity,relforcerowsecurity
         FROM pg_class
        WHERE relname IN ('digital_use_contract_versions','roleplay_sessions','roleplay_turns')
        ORDER BY relname`
    );
    expect(rows).toHaveLength(3);
    for(const row of rows){
      expect(row.relrowsecurity,row.relname).toBe(true);
      expect(row.relforcerowsecurity,row.relname).toBe(true);
    }
  });

  it('has one-current-ACTIVE, one-open-draft and one-successor DB fences', async () => {
    const {rows}=await db.query(
      `SELECT indexname,indexdef FROM pg_indexes
        WHERE schemaname='public' AND tablename='digital_use_contract_versions'
        ORDER BY indexname`
    );
    const byName=Object.fromEntries(rows.map((r:any)=>[r.indexname,r.indexdef]));
    expect(byName['digital_use_contract_versions_one_active_per_case']).toContain("WHERE (status = 'ACTIVE'");
    expect(byName['digital_use_contract_versions_one_open_draft_per_case']).toContain('DRAFT');
    expect(byName['digital_use_contract_versions_one_open_draft_per_case']).toContain('PENDING_CONFIRMATION');
    expect(byName['digital_use_contract_versions_one_successor_per_version']).toContain('supersedes_id');
  });

  it('enforces Contract identity/provenance/immutability in the database', async () => {
    const {rows}=await db.query(
      `SELECT conname FROM pg_constraint
        WHERE conrelid='digital_use_contract_versions'::regclass
        ORDER BY conname`
    );
    const names=rows.map((r:any)=>r.conname);
    expect(names).toEqual(expect.arrayContaining([
      'digital_use_contract_versions_case_version_key',
      'digital_use_contract_versions_confirmation_provenance_check',
      'digital_use_contract_versions_confirmation_revision_check',
      'digital_use_contract_versions_status_timestamps_check',
      'digital_use_contract_versions_supersedes_scope_fk',
    ]));
    const triggers=await db.query(
      `SELECT tgname FROM pg_trigger
        WHERE tgrelid='digital_use_contract_versions'::regclass
          AND NOT tgisinternal`
    );
    expect(triggers.rows.map((r:any)=>r.tgname)).toEqual([
      'digital_use_contract_versions_guard',
    ]);
    const provenance=await db.query(
      `SELECT pg_get_constraintdef(oid,true) AS def
         FROM pg_constraint
        WHERE conrelid='digital_use_contract_versions'::regclass
          AND conname='digital_use_contract_versions_confirmation_provenance_check'`
    );
    expect(provenance.rows[0].def).toContain('child_participation_id IS NOT NULL');
    const guard=await db.query(
      `SELECT pg_get_functiondef(p.oid) AS def
         FROM pg_proc p
         JOIN pg_namespace n ON n.oid=p.pronamespace
        WHERE n.nspname='public'
          AND p.proname='digital_use_contract_versions_guard'`
    );
    expect(guard.rows[0].def).toContain('OLD.child_participation_id IS NULL');
    expect(guard.rows[0].def).toContain("cp.state = 'ACTIVE'");
    expect(guard.rows[0].def).toContain("app_current_purpose() = 'PHONE_USE_CONTRACT'");
  });

  it('uses least-privilege table grants and has no DELETE grant', async () => {
    const {rows}=await db.query(
      `SELECT table_name,privilege_type FROM information_schema.role_table_grants
        WHERE grantee='xiaoshuyin_app'
          AND table_name IN ('digital_use_contract_versions','roleplay_sessions','roleplay_turns')
        ORDER BY table_name,privilege_type`
    );
    const keys=rows.map((r:any)=>`${r.table_name}:${r.privilege_type}`);
    for(const table of ['digital_use_contract_versions','roleplay_sessions','roleplay_turns']){
      expect(keys).toContain(`${table}:SELECT`);
      expect(keys).toContain(`${table}:INSERT`);
      expect(keys).not.toContain(`${table}:DELETE`);
      expect(keys).not.toContain(`${table}:UPDATE`);
    }
    const columns=await db.query(
      `SELECT table_name,column_name,privilege_type
         FROM information_schema.column_privileges
        WHERE grantee='xiaoshuyin_app'
          AND table_name IN ('digital_use_contract_versions','roleplay_sessions','roleplay_turns')`
    );
    expect(columns.rows.some((r:any)=>r.table_name==='digital_use_contract_versions'&&r.column_name==='child_confirmation'&&r.privilege_type==='UPDATE')).toBe(true);
    expect(columns.rows.some((r:any)=>r.table_name==='digital_use_contract_versions'&&r.column_name==='child_participation_id'&&r.privilege_type==='UPDATE')).toBe(true);
    expect(columns.rows.some((r:any)=>r.table_name==='roleplay_turns'&&r.column_name==='user_rating'&&r.privilege_type==='UPDATE')).toBe(true);

    const sceneGrants=await db.query(
      `SELECT privilege_type FROM information_schema.role_table_grants
        WHERE grantee='xiaoshuyin_app' AND table_name='scene_artifacts'
        ORDER BY privilege_type`
    );
    expect(sceneGrants.rows.map((r:any)=>r.privilege_type)).toEqual(['INSERT','SELECT']);
    expect(sceneGrants.rows.some((r:any)=>r.privilege_type==='UPDATE')).toBe(false);
    expect(sceneGrants.rows.some((r:any)=>r.privilege_type==='DELETE')).toBe(false);
  });

  it('extends the existing Scene Artifact owner rather than creating a private Scene store', async () => {
    const {rows}=await db.query(
      `SELECT pg_get_constraintdef(oid) AS def
         FROM pg_constraint
        WHERE conrelid='scene_artifacts'::regclass
          AND conname='scene_artifacts_type_source_check'`
    );
    expect(rows[0].def).toContain('PHONE_USE_CONTRACT_QUIZ_ATTEMPT');
    expect(rows[0].def).toContain('PHONE_USE_ROLEPLAY_SELECTION');
    expect(rows[0].def).toContain('PHONE_USE_CONTRACT_DOCUMENT');
    expect(rows[0].def).toContain("source_node_code = 'A4010'");
  });
});
