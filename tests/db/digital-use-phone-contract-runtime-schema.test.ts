import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client } from 'pg';

const URL=process.env['MIGRATION_DATABASE_URL'] ?? process.env['DATABASE_URL']!;

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
    expect(columns.rows.some((r:any)=>r.table_name==='roleplay_turns'&&r.column_name==='user_rating'&&r.privilege_type==='UPDATE')).toBe(true);
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
  });
});
