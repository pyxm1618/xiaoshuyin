/**
 * Structural schema evidence for the five Slice 006 tables.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import { createAdminPool } from '../setup/db.js';

const TABLES = [
  'binding_pending_contexts',
  'binding_attempts',
  'binding_confirmations',
  'binding_operation_keys',
  'identity_binding_audit_events',
];

const ENUMS = [
  'binding_attempt_state',
  'binding_confirmation_kind',
  'binding_confirmer_authority',
  'binding_operation_scope',
  'binding_operation_command',
];

describe('identity binding schema', () => {
  let admin: pg.Pool;

  beforeAll(() => {
    admin = createAdminPool();
  });

  afterAll(async () => {
    await admin.end();
  });

  it('creates exactly the five owned tables with FORCE RLS', async () => {
    const { rows } = await admin.query(
      `SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity,
              pg_get_userbyid(c.relowner) AS owner
       FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relname = ANY($1::text[])`,
      [TABLES]
    );
    expect(rows.map((r) => r.relname).sort()).toEqual([...TABLES].sort());
    for (const row of rows) {
      expect(row.relrowsecurity).toBe(true);
      expect(row.relforcerowsecurity).toBe(true);
      expect(row.owner).toBe('xiaoshuyin_migrator');
    }
    const appOwns = await admin.query(
      `SELECT count(*)::int AS cnt FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relname = ANY($1::text[])
         AND pg_get_userbyid(c.relowner) = 'xiaoshuyin_app'`,
      [TABLES]
    );
    expect(appOwns.rows[0].cnt).toBe(0);
  });

  it('creates the five enums with the frozen labels', async () => {
    const { rows } = await admin.query(
      `SELECT t.typname,
              to_json(array_agg(e.enumlabel ORDER BY e.enumsortorder)) AS labels
       FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
       WHERE t.typname = ANY($1::text[]) GROUP BY t.typname`,
      [ENUMS]
    );
    const byName = Object.fromEntries(rows.map((r) => [r.typname, r.labels]));
    expect(byName['binding_attempt_state']).toEqual(['PENDING', 'COMMITTED', 'TERMINAL']);
    expect(byName['binding_confirmation_kind']).toEqual(['CANDIDATE', 'SECOND_PARTY']);
    expect(byName['binding_confirmer_authority']).toEqual(['GUARDIAN', 'FAMILY_MANAGER']);
    expect(byName['binding_operation_scope']).toEqual(['CANDIDATE_CONTEXT', 'ACCOUNT']);
    expect(byName['binding_operation_command']).toEqual([
      'BOOTSTRAP',
      'CANDIDATE_DECISION',
      'SECOND_PARTY_DECISION',
    ]);
  });

  it('enforces attempt state / terminal reason / confirmation checks', async () => {
    const constraints = await admin.query(
      `SELECT conname, pg_get_constraintdef(oid) AS def
       FROM pg_constraint
       WHERE conrelid IN (
         'binding_attempts'::regclass,
         'binding_confirmations'::regclass,
         'binding_pending_contexts'::regclass
       )`
    );
    const defs = constraints.rows.map((r) => `${r.conname}\n${r.def}`).join('\n');
    expect(defs).toContain('binding_attempt_terminal_reason_closed');
    expect(defs).toContain('binding_attempt_state_consistency');
    expect(defs).toContain('binding_attempt_committed_consistency');
    expect(defs).toContain('binding_attempt_terminal_consistency');
    expect(defs).toContain('binding_confirmation_candidate_shape');
    expect(defs).toContain('binding_confirmation_second_party_shape');
    expect(defs).toContain('binding_confirmation_one_per_kind');
    expect(defs).toContain('binding_context_encryption_complete');
    expect(defs).toContain('binding_context_pairing_complete');
    expect(defs).toContain('binding_context_pairing_window');
    expect(defs).toContain('binding_context_invitation_requires_attempt');
    expect(defs).toContain('binding_context_committed_requires_attempt');
    expect(defs).toContain('binding_attempt_expiry_after_creation');
  });

  it('stores the H-01 pairing issuance columns with all-null / all-present shape', async () => {
    const { rows } = await admin.query(
      `SELECT column_name, is_nullable, data_type
         FROM information_schema.columns
        WHERE table_name = 'binding_pending_contexts'
          AND column_name IN ('pairing_issued_at','pairing_expires_at','pairing_issuance_id')`
    );
    expect(rows.map((r) => r.column_name).sort()).toEqual([
      'pairing_expires_at',
      'pairing_issuance_id',
      'pairing_issued_at',
    ]);
    for (const row of rows) expect(row.is_nullable).toBe('YES');

    const defs = await admin.query(
      `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint
        WHERE conrelid = 'binding_pending_contexts'::regclass`
    );
    const text = defs.rows.map((r) => r.def).join('\n');
    expect(text).toContain('pairing_issued_at IS NULL');
    expect(text).toContain('pairing_expires_at <= expires_at');
  });

  it('adds H-02 lock policies on the authoritative Gate facts', async () => {
    const { rows } = await admin.query(
      `SELECT polname, polcmd FROM pg_policy
        WHERE polname IN (
          'persons_binding_lock','persons_binding_candidate_lock','families_binding_lock',
          'family_members_binding_lock','pcp_binding_lock','consent_binding_lock'
        )`
    );
    expect(rows).toHaveLength(6);
    for (const row of rows) expect(row.polcmd).toBe('w');
  });

  it('has the partial unique live index and no permanent triple uniqueness', async () => {
    const { rows } = await admin.query(
      `SELECT indexname, indexdef FROM pg_indexes
       WHERE tablename = 'binding_attempts'`
    );
    const live = rows.find((r) => r.indexname === 'binding_attempts_live_key')!;
    expect(live.indexdef).toContain('WHERE (state = ');
    expect(live.indexdef).toContain('PENDING');
    const uniqueIndexes = rows.filter((r) => r.indexdef.startsWith('CREATE UNIQUE INDEX'));
    // The primary key is a row identity constraint, not a permanent triple
    // uniqueness constraint. Assert that the ONLY business unique index is the
    // partial live key (no permanent (P1, identity, invitation) uniqueness).
    expect(
      uniqueIndexes
        .map((r) => r.indexname)
        .filter((name) => name !== 'binding_attempts_pkey')
    ).toEqual(['binding_attempts_live_key']);
  });

  it('has append-only triggers and audit is INSERT-only to the app role', async () => {
    const triggers = await admin.query(
      `SELECT tgname FROM pg_trigger WHERE NOT tgisinternal
         AND tgrelid IN ('binding_confirmations'::regclass, 'identity_binding_audit_events'::regclass)`
    );
    expect(triggers.rows.map((r) => r.tgname).sort()).toEqual([
      'binding_confirmations_no_update_delete',
      'identity_binding_audit_no_update_delete',
    ]);

    const priv = await admin.query(
      `SELECT
         has_table_privilege('xiaoshuyin_app','identity_binding_audit_events','INSERT') AS ins,
         has_table_privilege('xiaoshuyin_app','identity_binding_audit_events','SELECT') AS sel,
         has_table_privilege('xiaoshuyin_app','identity_binding_audit_events','UPDATE') AS upd,
         has_table_privilege('xiaoshuyin_app','binding_attempts','UPDATE') AS attempt_upd`
    );
    expect(priv.rows[0]).toEqual({
      ins: true,
      sel: false,
      upd: false,
      attempt_upd: true,
    });
  });

  it('defines the binding context getters / setters', async () => {
    const { rows } = await admin.query(
      `SELECT proname FROM pg_proc
       WHERE pronamespace IN ('app'::regnamespace, 'public'::regnamespace)
         AND (proname LIKE 'app_binding_%' OR proname LIKE 'set_binding_%')`
    );
    const names = rows.map((r) => r.proname);
    for (const name of [
      'app_binding_context_hash',
      'app_binding_identity_digest',
      'app_binding_invitation_id',
      'app_binding_attempt_id',
      'app_binding_target_person_id',
      'app_binding_target_family_id',
      'app_binding_operation_scope',
      'app_binding_commit_account_id',
      'app_binding_candidate_account_id',
      'set_binding_context',
      'set_binding_identity_context',
      'set_binding_gate_context',
      'set_binding_target_context',
      'set_binding_attempt_context',
      'set_binding_commit_context',
      'set_binding_operation_scope',
      'set_binding_commit_account_id',
      'set_binding_candidate_account_id',
    ]) {
      expect(names).toContain(name);
    }
  });

  it('adds purpose-scoped policies to Slice 1 tables without altering existing policies', async () => {
    const { rows } = await admin.query(
      `SELECT tablename, policyname FROM pg_policies
       WHERE policyname IN (
         'persons_binding_target_read','persons_binding_candidate_account_read',
         'persons_binding_commit_update','families_binding_read',
         'family_members_binding_read','pcp_binding_read','consent_binding_read'
       )`
    );
    expect(rows).toHaveLength(7);
    const existing = await admin.query(
      `SELECT count(*)::int AS cnt FROM pg_policies WHERE policyname IN (
         'persons_scope','families_scope','family_members_scope','pcp_scope','consent_scope'
       )`
    );
    expect(existing.rows[0].cnt).toBe(5);
  });

  it('registers the five new-table RLS policies', async () => {
    const { rows } = await admin.query(
      `SELECT policyname FROM pg_policies
       WHERE tablename IN (
         'binding_pending_contexts','binding_attempts','binding_confirmations',
         'binding_operation_keys','identity_binding_audit_events'
       )`
    );
    const names = rows.map((r) => r.policyname);
    for (const name of [
      'binding_context_token_scope',
      'binding_context_attempt_scope',
      'binding_attempts_identity_scope',
      'binding_attempts_target_scope',
      'binding_attempts_commit_scope',
      'binding_confirmations_attempt_scope',
      'binding_confirmations_target_scope',
      'binding_operation_keys_scope',
      'identity_binding_audit_insert_scope',
    ]) {
      expect(names).toContain(name);
    }
  });

  it('audit event_type closed set includes BINDING_OPERATION_RETRYABLE', async () => {
    const { rows } = await admin.query(
      `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint
       WHERE conrelid = 'identity_binding_audit_events'::regclass
         AND conname = 'identity_binding_audit_events_event_type_check'`
    );
    expect(rows[0].def).toContain('BINDING_OPERATION_RETRYABLE');
    // The runtime INSERT can really store the event.
    await admin.query(
      `INSERT INTO identity_binding_audit_events
         (correlation_id, event_type, result, metadata)
       VALUES (gen_random_uuid(), 'BINDING_OPERATION_RETRYABLE', 'RETRYABLE', '{}'::jsonb)`
    );
  });

  it('candidate account read is limited to GATE / COMMIT purposes', async () => {
    const { rows } = await admin.query(
      `SELECT pg_get_expr(polqual, polrelid) AS qual
       FROM pg_policy WHERE polname = 'persons_binding_candidate_account_read'`
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].qual).toContain('IDENTITY_BINDING_GATE');
    expect(rows[0].qual).toContain('IDENTITY_BINDING_COMMIT');
    expect(rows[0].qual).toContain('app_binding_candidate_account_id');
  });
});