/**
 * S7-III-M03 — current-main populated upgrade regression.
 *
 * The audit proved this outside the repository. This test makes it repeatable
 * inside the repository for the REAL authoritative baseline:
 *
 *   1. create a throw-away database owned by the migrator role
 *   2. apply ONLY current-main 001–006 (7 reviewed SQL files; 004 has two)
 *   3. insert representative legal upstream data and snapshot rows/constraints
 *   4. run the real migrator, which APPLYs ONLY 007
 *   5. assert rows preserved, literals only appended, case_status still five-state
 *   6. replay and require 0 unexpected migrations + a stable schema fingerprint
 *
 * This is a different regression contract from
 * `tests/db/migration-upgrade-evidence.test.ts`, whose starting point is
 * 001–003. Neither test is rewritten to fit the other.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from 'pg';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ADMIN_URL = process.env['TEST_ADMIN_DATABASE_URL']!;
const MIGRATION_URL = process.env['MIGRATION_DATABASE_URL']!;
const ROOT = new URL('../..', import.meta.url).pathname;

/** Current authoritative main = 001–006. 004 contributes two reviewed files. */
const CURRENT_MAIN_MIGRATIONS = [
  '001_initial_schema.sql',
  '002_case_core.sql',
  '003_case_idempotency_key_bytes.sql',
  '004_evidence_core.sql',
  '004_identity_binding_runtime.sql',
  '005_case_participant_core.sql',
  '006_case_status_paused_removal.sql',
] as const;

const FIVE_CASE_STATUSES = ['OPEN', 'WAITING', 'LOST_CONTACT', 'SAFETY_HOLD', 'CLOSED'];

const EXPECTED_MAIN_AUDIT_LITERALS = [
  'FAMILY_CREATED',
  'MEMBER_CREATED',
  'MEMBER_PROFILE_VALUE_RECORDED',
  'CONSENT_REQUEST_CREATED',
  'CONSENT_GRANTED',
  'CONSENT_REVOKED',
  'CASE_CREATED',
  'MESSAGE_RECORDED',
  'ASSERTION_RECORDED',
  'OBSERVATION_RECORDED',
  'PARTICIPATION_INVITE_CREATED',
  'PARTICIPATION_ACCEPTED',
  'PARTICIPATION_DECLINED',
  'PARTICIPATION_EXPIRED',
  'PARTICIPATION_WITHDRAWN',
];

const EXPECTED_MAIN_IDEMPOTENCY_COMMANDS = [
  'FAMILY_CREATE',
  'MEMBER_CREATE',
  'MEMBER_UPDATE',
  'GUARDIAN_CONSENT_REQUEST',
  'GUARDIAN_CONSENT_GRANT',
  'GUARDIAN_CONSENT_REVOKE',
  'CASE_CREATE',
  'CASE_MESSAGE_CREATE',
  'PARTICIPATION_INVITE_CREATE',
  'PARTICIPATION_ACCEPT',
  'PARTICIPATION_DECLINE',
  'PARTICIPATION_WITHDRAW',
];

const SLICE7_AND_SLICE8_APPROVED_LITERALS = {
  case_events_event_type_check: [
    'CASE_ASSESSMENT_STARTED',
    'CASE_PRIMARY_ASSIGNED',
    'CASE_PRIMARY_REVOKED',
    'CASE_PROBLEM_FORMULATION_CONFIRMED',
    'CASE_PROBLEM_FORMULATION_CORRECTED',
    'CASE_PROBLEM_FORMULATION_DISPUTED',
    'CASE_PROBLEM_FORMULATION_PRESENTED',
    'CASE_REASSESSMENT_STARTED',
    'CASE_RISK_RESOLVED',
    'CASE_SAFETY_HOLD_ENTERED',
    'CASE_DIGITAL_USE_NODE_COMPLETED',
  ],
  business_audit_events_event_type_check: [
    'CASE_PRIMARY_SWITCHED',
    'CASE_ASSESSMENT_STARTED',
    'CASE_PROBLEM_FORMULATION_PRESENTED',
    'CASE_PROBLEM_FORMULATION_CONFIRMED',
    'CASE_PROBLEM_FORMULATION_DISPUTED',
    'CASE_PROBLEM_FORMULATION_CORRECTED',
    'CASE_REASSESSMENT_STARTED',
    'CASE_RISK_RESOLVED',
    'CASE_SAFETY_HOLD_ENTERED',
    'CONSENT_SUPPLEMENTAL_ASSESSMENT_GRANTED',
    'CONSENT_SUPPLEMENTAL_ASSESSMENT_DECLINED',
    'CONSENT_SUPPLEMENTAL_ASSESSMENT_REVOKED',
    'DIGITAL_USE_NODE_COMPLETED',
    'PHONE_USE_CONTRACT_DRAFT_SAVED',
    'PHONE_USE_CONTRACT_CONFIRMED',
    'PHONE_USE_CONTRACT_ACTIVATED',
    'PHONE_USE_CONTRACT_SUPERSEDED',
    'PHONE_USE_ROLEPLAY_RECORDED',
  ],
  idempotency_keys_command_type_check: [
    'CASE_SWITCH_PRIMARY',
    'CASE_START_ASSESSMENT',
    'PROBLEM_FORMULATION_PRESENT',
    'PROBLEM_FORMULATION_CONFIRM',
    'PROBLEM_FORMULATION_DISPUTE',
    'PROBLEM_FORMULATION_CORRECT',
    'CASE_REASSESS_FROM_FORMULATION',
    'CASE_ENTER_SAFETY_HOLD',
    'CASE_RESOLVE_RISK',
    'DIGITAL_USE_ASSESSMENT_RESUME',
    'DIGITAL_USE_NODE_RESPONSE',
    'PHONE_USE_CONTRACT_DRAFT_SAVE',
    'PHONE_USE_CONTRACT_CONFIRM',
    'PHONE_USE_CONTRACT_REVISE',
    'PHONE_USE_ROLEPLAY_CREATE',
    'PHONE_USE_ROLEPLAY_TURN',
    'PHONE_USE_ROLEPLAY_RATE',
    'PHONE_USE_ROLEPLAY_SELECT',
  ],
};


/** Exact Slice 8 constraint delta over the pre-Slice-8 schema. */
const SLICE8_NEW_CONSTRAINTS = [
  'problem_formulations_alternative_explanations_not_null',
  'problem_formulations_alternative_explanations_shape_check',
  'problem_formulations_case_family_fk',
  'problem_formulations_case_id_not_null',
  'problem_formulations_case_version_chain_fk',
  'problem_formulations_case_version_key',
  'problem_formulations_confirmation_pair_check',
  'problem_formulations_confirmation_status_check',
  'problem_formulations_confirmer_fk',
  'problem_formulations_conflicts_not_null',
  'problem_formulations_conflicts_shape_check',
  'problem_formulations_created_at_not_null',
  'problem_formulations_dependency_refs_not_null',
  'problem_formulations_dependency_refs_shape_check',
  'problem_formulations_evidence_refs_not_null',
  'problem_formulations_evidence_refs_shape_check',
  'problem_formulations_exit_conditions_not_null',
  'problem_formulations_exit_conditions_shape_check',
  'problem_formulations_family_id_not_null',
  'problem_formulations_id_not_null',
  'problem_formulations_key_factors_not_null',
  'problem_formulations_key_factors_shape_check',
  'problem_formulations_not_draft_check',
  'problem_formulations_pkey',
  'problem_formulations_primary_problem_not_null',
  'problem_formulations_primary_problem_shape_check',
  'problem_formulations_reassessment_conditions_not_null',
  'problem_formulations_reassessment_conditions_shape_check',
  'problem_formulations_scene_fit_check',
  'problem_formulations_scene_fit_not_null',
  'problem_formulations_status_not_null',
  'problem_formulations_unknowns_not_null',
  'problem_formulations_unknowns_shape_check',
  'problem_formulations_updated_at_not_null',
  'problem_formulations_user_response_shape_check',
  'problem_formulations_version_chain_check',
  'problem_formulations_version_not_null',
  'problem_formulations_version_range_check',
].sort();

/** Exact Slice 8 object-fingerprint delta. */
const SLICE8_NEW_OBJECTS = [
  'enum:problem_formulation_status',
  'policy:problem_formulations_insert',
  'policy:problem_formulations_select',
  'policy:problem_formulations_update',
  'table:problem_formulations',
].sort();

/** Exactly the constraints Slice 9 risk_events introduces. */
const SLICE9_RISK_EVENT_CONSTRAINTS = [
  'risk_events_actor_account_id_not_null',
  'risk_events_actor_fk',
  'risk_events_case_family_fk',
  'risk_events_case_id_not_null',
  'risk_events_created_at_not_null',
  'risk_events_decision_case_version_not_null',
  'risk_events_decision_version_check',
  'risk_events_event_kind_check',
  'risk_events_event_kind_not_null',
  'risk_events_evidence_refs_not_null',
  'risk_events_family_id_not_null',
  'risk_events_id_case_family_key',
  'risk_events_id_not_null',
  'risk_events_pkey',
  'risk_events_resolution_same_case_fk',
  'risk_events_shape_check',
];

/**
 * Slice 10 reviewed compliance feature-policy constraints (exact catalog names,
 * including PostgreSQL's 63-character truncation of the longer column names).
 */
const SLICE10_NEW_CONSTRAINTS = [
  'compliance_feature_policies_ai_disclosure_rule_not_null',
  'compliance_feature_policies_ai_rule_check',
  'compliance_feature_policies_anthropomorphic_applicabil_not_null',
  'compliance_feature_policies_applicability_check',
  'compliance_feature_policies_approved_at_not_null',
  'compliance_feature_policies_created_at_not_null',
  'compliance_feature_policies_cross_field_check',
  'compliance_feature_policies_effective_from_not_null',
  'compliance_feature_policies_effective_interval_check',
  'compliance_feature_policies_feature_code_not_null',
  'compliance_feature_policies_feature_code_shape',
  'compliance_feature_policies_feature_contract_revision_not_null',
  'compliance_feature_policies_generated_content_label_ru_not_null',
  'compliance_feature_policies_id_identity_key',
  'compliance_feature_policies_id_not_null',
  'compliance_feature_policies_identity_version_key',
  'compliance_feature_policies_label_rule_check',
  'compliance_feature_policies_minor_access_rule_not_null',
  'compliance_feature_policies_minor_rule_check',
  'compliance_feature_policies_no_self_supersede',
  'compliance_feature_policies_pkey',
  'compliance_feature_policies_policy_version_not_null',
  'compliance_feature_policies_provenance_check',
  'compliance_feature_policies_publication_source_check',
  'compliance_feature_policies_publication_source_ref_not_null',
  'compliance_feature_policies_revision_shape',
  'compliance_feature_policies_supersede_closure_check',
  'compliance_feature_policies_supersede_identity_fk',
  'compliance_feature_policies_usage_reminder_rule_not_null',
  'compliance_feature_policies_usage_rule_check',
  'compliance_feature_policies_version_positive',
];

const SLICE10_NEW_OBJECTS = [
  'table:compliance_feature_policies',
  'policy:compliance_feature_policies_migrator_control',
  'policy:compliance_feature_policies_runtime_active',
  'trigger:compliance_feature_policies_guard',
  'trigger:compliance_feature_policies_overlap_insert',
  'trigger:compliance_feature_policies_overlap_update',
];

/** Exact Slice 12 Scene persistence constraints created by migration 015. */
const SLICE12_NEW_CONSTRAINTS = [
  'scene_node_states_pkey',
  'scene_node_states_id_not_null',
  'scene_node_states_family_id_not_null',
  'scene_node_states_case_id_not_null',
  'scene_node_states_scene_package_version_not_null',
  'scene_node_states_node_code_not_null',
  'scene_node_states_source_node_code_not_null',
  'scene_node_states_status_not_null',
  'scene_node_states_branch_reason_codes_not_null',
  'scene_node_states_input_refs_not_null',
  'scene_node_states_output_refs_not_null',
  'scene_node_states_entered_at_not_null',
  'scene_node_states_revision_not_null',
  'scene_node_states_case_family_fk',
  'scene_node_states_case_node_key',
  'scene_node_states_id_case_family_key',
  'scene_node_states_revision_check',
  'scene_node_states_package_check',
  'scene_node_states_node_code_check',
  'scene_node_states_source_node_code_check',
  'scene_node_states_refs_shape_check',
  'scene_node_states_completion_shape_check',
  'scene_artifacts_pkey',
  'scene_artifacts_id_not_null',
  'scene_artifacts_family_id_not_null',
  'scene_artifacts_case_id_not_null',
  'scene_artifacts_scene_package_version_not_null',
  'scene_artifacts_artifact_type_not_null',
  'scene_artifacts_schema_version_not_null',
  'scene_artifacts_source_node_code_not_null',
  'scene_artifacts_data_not_null',
  'scene_artifacts_owner_person_id_not_null',
  'scene_artifacts_visibility_not_null',
  'scene_artifacts_source_refs_not_null',
  'scene_artifacts_revision_not_null',
  'scene_artifacts_created_at_not_null',
  'scene_artifacts_case_family_fk',
  'scene_artifacts_owner_family_fk',
  'scene_artifacts_id_case_family_key',
  'scene_artifacts_supersedes_same_case_fk',
  'scene_artifacts_revision_check',
  'scene_artifacts_package_check',
  'scene_artifacts_type_check',
  'scene_artifacts_schema_version_check',
  'scene_artifacts_source_node_check',
  'scene_artifacts_type_source_check',
  'scene_artifacts_data_shape_check',
  'scene_artifacts_refs_shape_check',
  'scene_artifacts_visibility_check',
].sort();

const SLICE12_NEW_OBJECTS = [
  'enum:scene_node_status',
  'table:scene_node_states',
  'table:scene_artifacts',
  'policy:scene_node_states_family_scope',
  'policy:scene_artifacts_family_scope',
  'trigger:scene_node_states_guard',
  'trigger:scene_artifacts_insert_guard',
].sort();

/** Exact Slice 13 target persistence constraints created by migration 016. */
const SLICE13_NEW_CONSTRAINTS = [
  'digital_use_target_items_pkey',
  'digital_use_target_items_id_not_null',
  'digital_use_target_items_family_id_not_null',
  'digital_use_target_items_case_id_not_null',
  'digital_use_target_items_scene_package_version_not_null',
  'digital_use_target_items_target_code_not_null',
  'digital_use_target_items_selection_revision_not_null',
  'digital_use_target_items_revision_not_null',
  'digital_use_target_items_selected_not_null',
  'digital_use_target_items_progress_evidence_refs_not_null',
  'digital_use_target_items_help_history_refs_not_null',
  'digital_use_target_items_source_refs_not_null',
  'digital_use_target_items_created_by_person_id_not_null',
  'digital_use_target_items_created_at_not_null',
  'digital_use_target_items_case_family_fk',
  'digital_use_target_items_creator_family_fk',
  'digital_use_target_items_id_scope_key',
  'digital_use_target_items_supersedes_scope_fk',
  'digital_use_target_items_revision_key',
  'digital_use_target_items_revision_check',
  'digital_use_target_items_selection_revision_check',
  'digital_use_target_items_package_check',
  'digital_use_target_items_target_code_check',
  'digital_use_target_items_target_text_check',
  'digital_use_target_items_payload_shape_check',
  'digital_use_target_items_supersession_shape_check',
].sort();

const SLICE13_NEW_OBJECTS = [
  'table:digital_use_target_items',
  'policy:digital_use_target_items_family_scope',
  'trigger:digital_use_target_items_insert_guard',
  'trigger:digital_use_target_items_update_guard',
].sort();

/** Exact Slice 14 Contract/roleplay constraints created by migration 017. */
const SLICE14_NEW_CONSTRAINTS = [
  'digital_use_contract_versions_id_not_null',
  'digital_use_contract_versions_family_id_not_null',
  'digital_use_contract_versions_case_id_not_null',
  'digital_use_contract_versions_version_not_null',
  'digital_use_contract_versions_draft_revision_not_null',
  'digital_use_contract_versions_status_not_null',
  'digital_use_contract_versions_adult_party_person_id_not_null',
  'digital_use_contract_versions_child_party_person_id_not_null',
  'digital_use_contract_versions_child_participation_id_not_null',
  'digital_use_contract_versions_contract_purpose_not_null',
  'digital_use_contract_versions_phone_use_rules_not_null',
  'digital_use_contract_versions_execution_period_not_null',
  'digital_use_contract_versions_parent_support_measures_not_null',
  'digital_use_contract_versions_supervision_measures_not_null',
  'digital_use_contract_versions_incentives_not_null',
  'digital_use_contract_versions_breach_responsibilities_not_null',
  'digital_use_contract_versions_source_template_version_not_null',
  'digital_use_contract_versions_dependency_refs_not_null',
  'digital_use_contract_versions_created_by_person_id_not_null',
  'digital_use_contract_versions_created_at_not_null',
  'digital_use_contract_versions_updated_at_not_null',
  'digital_use_contract_versions_pkey',
  'digital_use_contract_versions_child_participation_id_fkey',
  'digital_use_contract_versions_case_family_fk',
  'digital_use_contract_versions_adult_family_fk',
  'digital_use_contract_versions_child_family_fk',
  'digital_use_contract_versions_creator_family_fk',
  'digital_use_contract_versions_id_scope_key',
  'digital_use_contract_versions_case_version_key',
  'digital_use_contract_versions_revision_check',
  'digital_use_contract_versions_status_check',
  'digital_use_contract_versions_party_check',
  'digital_use_contract_versions_template_check',
  'digital_use_contract_versions_terms_shape_check',
  'digital_use_contract_versions_update_trigger_check',
  'digital_use_contract_versions_update_reason_check',
  'digital_use_contract_versions_status_timestamps_check',
  'digital_use_contract_versions_confirmation_revision_check',
  'digital_use_contract_versions_confirmation_provenance_check',
  'digital_use_contract_versions_supersedes_self_check',
  'digital_use_contract_versions_initial_or_revision_check',
  'digital_use_contract_versions_supersedes_scope_fk',
  'roleplay_sessions_id_not_null',
  'roleplay_sessions_family_id_not_null',
  'roleplay_sessions_case_id_not_null',
  'roleplay_sessions_actor_person_id_not_null',
  'roleplay_sessions_simulation_role_not_null',
  'roleplay_sessions_status_not_null',
  'roleplay_sessions_scene_package_version_not_null',
  'roleplay_sessions_professional_content_version_not_null',
  'roleplay_sessions_compliance_policy_ref_not_null',
  'roleplay_sessions_adapter_ref_not_null',
  'roleplay_sessions_revision_not_null',
  'roleplay_sessions_created_at_not_null',
  'roleplay_sessions_pkey',
  'roleplay_sessions_case_family_fk',
  'roleplay_sessions_actor_family_fk',
  'roleplay_sessions_id_scope_key',
  'roleplay_sessions_status_check',
  'roleplay_sessions_role_check',
  'roleplay_sessions_revision_check',
  'roleplay_sessions_version_refs_check',
  'roleplay_sessions_completion_shape_check',
  'roleplay_sessions_selected_turn_fk',
  'roleplay_turns_id_not_null',
  'roleplay_turns_family_id_not_null',
  'roleplay_turns_case_id_not_null',
  'roleplay_turns_session_id_not_null',
  'roleplay_turns_round_number_not_null',
  'roleplay_turns_simulated_child_input_not_null',
  'roleplay_turns_simulated_parent_output_not_null',
  'roleplay_turns_provenance_not_null',
  'roleplay_turns_created_at_not_null',
  'roleplay_turns_pkey',
  'roleplay_turns_session_scope_fk',
  'roleplay_turns_id_session_key',
  'roleplay_turns_round_key',
  'roleplay_turns_round_check',
  'roleplay_turns_provenance_check',
  'roleplay_turns_input_check',
  'roleplay_turns_output_check',
  'roleplay_turns_rating_check',
].sort();

const SLICE14_NEW_OBJECTS = [
  'table:digital_use_contract_versions',
  'table:roleplay_sessions',
  'table:roleplay_turns',
  'policy:digital_use_contract_versions_scope',
  'policy:roleplay_sessions_scope',
  'policy:roleplay_turns_scope',
  'trigger:digital_use_contract_versions_guard',
].sort();


/** Constraints whose definitions 007 is authorized to rewrite. */
const SLICE7_CONSTRAINT_CHANGES = [
  'case_events_event_type_check',
  'case_events_metadata_shape_check',
  'business_audit_events_event_type_check',
  'idempotency_keys_command_type_check',
  'idempotency_keys_key_representation_check',
];

function urlForDatabase(baseUrl: string, database: string): string {
  const url = new URL(baseUrl);
  url.pathname = `/${database}`;
  return url.toString();
}

function runMigrator(connectionString: string): string {
  return execFileSync(process.execPath, [join(ROOT, 'scripts', 'db-migrate.mjs')], {
    cwd: ROOT,
    env: { ...process.env, MIGRATION_DATABASE_URL: connectionString },
    encoding: 'utf8',
    timeout: 120_000,
  });
}

function dedupeSorted(values: string[]): string[] {
  return [...new Set(values)].sort();
}

/** Extract every quoted literal from a CHECK expression. */
function constraintLiterals(definition: string): string[] {
  return dedupeSorted([...definition.matchAll(/'([^']*)'/g)].map((match) => match[1]!));
}

function normalizeDefinition(definition: string): string {
  return definition.replace(/\s+/g, ' ').trim();
}

interface SeedIds {
  accountId: string;
  secondAccountId: string;
  personId: string;
  secondPersonId: string;
  familyId: string;
  caseId: string;
  messageId: string;
  participationId: string;
}

/**
 * Slice 1 Consent Owner — 01004 narrow post-merge remediation.
 *
 * Three guardian-oriented constraints are intentionally replaced by the
 * purpose-discriminated branch (Frozen Spec FR-056 / FR-071). Every guardian
 * clause is re-imposed by `consent_purpose_field_binding`, so no guardian
 * invariant is dropped or widened.
 */
const CONSENT_OWNER_REPLACED_CONSTRAINTS = [
  'consent_records_guardian_person_id_not_null',
  'consent_records_guardian_account_id_not_null',
  'consent_request_binding',
];

const CONSENT_OWNER_NEW_CONSTRAINTS = [
  'consent_supplemental_case_fk',
  'consent_supplemental_case_family_fk',
  'consent_supplemental_actor_person_fk',
  'consent_supplemental_actor_account_fk',
  'consent_purpose_field_binding',
  'consent_guardian_decision_set',
  'consent_supplemental_evidence_shape',
];

const CONSENT_OWNER_NEW_OBJECTS = [
  'trigger:consent_records_supplemental_insert_guard',
  'trigger:consent_records_supplemental_update_guard',
  'trigger:consent_records_supersede_purpose_guard',
];

const CONSENT_OWNER_CHANGED_CONSTRAINTS = ['business_audit_events_event_type_check'];

describe('current-main 001–006 -> Slice 7 007 populated upgrade (S7-III-M03)', () => {
  let admin: Client;
  let seed: Client;
  let database: string;
  let upgradeUrl: string;
  let ids: SeedIds;
  let beforeRows: Record<string, unknown>;
  let beforeConstraints: Record<string, string>;
  let beforeObjects: string;
  let beforeAuditLiterals: string[];
  let beforeIdempotencyLiterals: string[];
  let beforeCaseEventLiterals: string[];

  beforeAll(async () => {
    admin = new Client({ connectionString: ADMIN_URL });
    await admin.connect();
    database = `xiaoshuyin_s7iii_up_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
    await admin.query(`CREATE DATABASE "${database}" OWNER xiaoshuyin_migrator`);
    upgradeUrl = urlForDatabase(MIGRATION_URL, database);

    // Apply ONLY current-main 001–006 through the real reviewed SQL files and
    // record them exactly the way scripts/db-migrate.mjs does.
    const migrator = new Client({ connectionString: upgradeUrl });
    await migrator.connect();
    try {
      await migrator.query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          filename   text PRIMARY KEY,
          applied_at timestamptz NOT NULL DEFAULT now()
        )
      `);
      for (const filename of CURRENT_MAIN_MIGRATIONS) {
        const sql = readFileSync(join(ROOT, 'db', 'migrations', filename), 'utf-8');
        await migrator.query('BEGIN');
        await migrator.query(sql);
        await migrator.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [filename]);
        await migrator.query('COMMIT');
      }
      const { rows } = await migrator.query('SELECT count(*)::int AS c FROM schema_migrations');
      expect(rows[0].c).toBe(7);
    } finally {
      await migrator.end();
    }

    seed = new Client({ connectionString: urlForDatabase(ADMIN_URL, database) });
    await seed.connect();
    ids = await seedCurrentMainData(seed);

    beforeRows = await rowSnapshot(seed);
    beforeConstraints = await constraintDefinitions(seed);
    beforeObjects = await objectFingerprint(seed);
    beforeCaseEventLiterals = constraintLiterals(
      beforeConstraints['case_events_event_type_check']!
    );
    beforeAuditLiterals = constraintLiterals(
      beforeConstraints['business_audit_events_event_type_check']!
    );
    beforeIdempotencyLiterals = constraintLiterals(
      beforeConstraints['idempotency_keys_command_type_check']!
    );

    // Baseline sanity: the populated database really is the current-main shape.
    expect(beforeCaseEventLiterals).toEqual(['CASE_CREATED']);
    expect(beforeAuditLiterals).toEqual(dedupeSorted(EXPECTED_MAIN_AUDIT_LITERALS));
    expect(beforeIdempotencyLiterals).toEqual(
      dedupeSorted(EXPECTED_MAIN_IDEMPOTENCY_COMMANDS)
    );
  }, 180_000);

  afterAll(async () => {
    await seed?.end().catch(() => {});
    if (admin && database) {
      await admin
        .query(
          'SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()',
          [database]
        )
        .catch(() => {});
      await admin.query(`DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`).catch(() => {});
      const { rows } = await admin
        .query('SELECT count(*)::int AS c FROM pg_database WHERE datname = $1', [database])
        .catch(() => ({ rows: [{ c: NaN }] }));
      expect(rows[0].c).toBe(0);
    }
    await admin?.end().catch(() => {});
  }, 180_000);

  it('applies only 007 over populated current-main data and preserves every row', async () => {
    const output = runMigrator(upgradeUrl);
    for (const filename of CURRENT_MAIN_MIGRATIONS) {
      expect(output).toContain(`SKIP ${filename}`);
    }
    expect(output).toContain('APPLY 007_case_primary_switch.sql');
    // Slice 9 appends one reviewed migration on top of the current main shape.
    expect(output).toContain('APPLY 009_safety_hold_control_foundation.sql');
    expect(output).not.toContain('APPLY 001_initial_schema.sql');
    expect(output).not.toContain('APPLY 006_case_status_paused_removal.sql');
    expect(output).toMatch(/Migration complete: 12 new, 7 previously applied\./);

    // Rows preserved verbatim, table by table.
    expect(await rowSnapshot(seed)).toEqual(beforeRows);

    // case_status remains exactly the five frozen states, no PAUSED.
    const { rows: enumRows } = await seed.query(
      `SELECT e.enumlabel::text AS label
         FROM pg_enum e
         JOIN pg_type t ON t.oid = e.enumtypid
         JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname = 'public' AND t.typname = 'case_status'
        ORDER BY e.enumsortorder`
    );
    expect(enumRows.map((row: any) => row.label)).toEqual(FIVE_CASE_STATUSES);

    const { rows: caseRows } = await seed.query(
      'SELECT id, status::text AS status FROM cases WHERE family_id = $1 ORDER BY id',
      [ids.familyId]
    );
    expect(caseRows).toHaveLength(5);
    expect(dedupeSorted(caseRows.map((row: any) => row.status))).toEqual(
      dedupeSorted(FIVE_CASE_STATUSES)
    );

    // Main literals ⊆ Post-007 literals.
    const afterConstraints = await constraintDefinitions(seed);
    const afterCaseEventLiterals = constraintLiterals(
      afterConstraints['case_events_event_type_check']!
    );
    const afterAuditLiterals = constraintLiterals(
      afterConstraints['business_audit_events_event_type_check']!
    );
    const afterIdempotencyLiterals = constraintLiterals(
      afterConstraints['idempotency_keys_command_type_check']!
    );

    for (const literal of beforeCaseEventLiterals) {
      expect(afterCaseEventLiterals).toContain(literal);
    }
    for (const literal of beforeAuditLiterals) {
      expect(afterAuditLiterals).toContain(literal);
    }
    for (const literal of beforeIdempotencyLiterals) {
      expect(afterIdempotencyLiterals).toContain(literal);
    }

    // Only explicitly reviewed later-slice literals were added — exactly, not more.
    const added = (after: string[], before: string[]) => after.filter((v) => !before.includes(v));
    expect([...added(afterCaseEventLiterals, beforeCaseEventLiterals)].sort()).toEqual(
      [...SLICE7_AND_SLICE8_APPROVED_LITERALS.case_events_event_type_check].sort()
    );
    expect([...added(afterAuditLiterals, beforeAuditLiterals)].sort()).toEqual(
      [...SLICE7_AND_SLICE8_APPROVED_LITERALS.business_audit_events_event_type_check].sort()
    );
    expect([...added(afterIdempotencyLiterals, beforeIdempotencyLiterals)].sort()).toEqual(
      [...SLICE7_AND_SLICE8_APPROVED_LITERALS.idempotency_keys_command_type_check].sort()
    );

    // Existing data still satisfies the revalidated constraints (inserts pass).
    await seed.query(
      `INSERT INTO business_audit_events
         (family_id, actor_account_id, event_type, resource_type, resource_id)
       VALUES ($1, $2, 'CASE_PRIMARY_SWITCHED', 'CASE', $3)`,
      [ids.familyId, ids.accountId, ids.caseId]
    );

    // Constraint layer: every legacy name survives; the delta is exactly the
    // reviewed Slice 8 + Slice 9 constraint sets.
    const beforeConstraintNames = Object.keys(beforeConstraints).sort();
    const afterConstraintNames = Object.keys(afterConstraints).sort();
    for (const name of beforeConstraintNames) {
      if (CONSENT_OWNER_REPLACED_CONSTRAINTS.includes(name)) continue;
      expect(afterConstraintNames).toContain(name);
    }
    // The replaced guardian invariants are re-imposed by the purpose branch.
    for (const name of CONSENT_OWNER_REPLACED_CONSTRAINTS.slice(0, 2)) {
      expect(afterConstraintNames).not.toContain(name);
    }
    expect(afterConstraintNames).toContain('consent_purpose_field_binding');
    expect(afterConstraints['consent_purpose_field_binding']).toContain(
      "guardian_person_id IS NOT NULL"
    );
    expect(afterConstraints['consent_purpose_field_binding']).toContain(
      "guardian_account_id IS NOT NULL"
    );
    const newConstraints = afterConstraintNames.filter(
      (name) => !beforeConstraintNames.includes(name)
    );
    expect(newConstraints.sort()).toEqual(
      [
        ...SLICE8_NEW_CONSTRAINTS,
        ...SLICE9_RISK_EVENT_CONSTRAINTS,
        ...SLICE10_NEW_CONSTRAINTS,
        ...CONSENT_OWNER_NEW_CONSTRAINTS,
        ...SLICE12_NEW_CONSTRAINTS,
        ...SLICE13_NEW_CONSTRAINTS,
        ...SLICE14_NEW_CONSTRAINTS,
      ].sort()
    );
    const changedConstraints = beforeConstraintNames.filter(
      (name) => afterConstraintNames.includes(name) && afterConstraints[name] !== beforeConstraints[name]
    );
    // `business_audit_events_event_type_check` is already part of the Slice 7
    // set; the Consent remediation extends that same constraint, so this is a
    // union of changed constraint names, never a duplicated literal.
    expect(changedConstraints.sort()).toEqual(
      [
        ...new Set([
          ...SLICE7_CONSTRAINT_CHANGES,
          'business_audit_events_resource_type_check',
          ...CONSENT_OWNER_CHANGED_CONSTRAINTS,
        ]),
      ].sort()
    );

    // Exactly the reviewed later-slice objects are added; legacy entries survive.
    const beforeSet = new Set(beforeObjects.split('|'));
    const afterFingerprint = await objectFingerprint(seed);
    const afterSet = new Set(afterFingerprint.split('|'));
    for (const entry of beforeSet) {
      expect(afterSet.has(entry), `lost object ${entry}`).toBe(true);
    }
    expect([...afterSet].filter((e) => !beforeSet.has(e)).sort()).toEqual([
      ...SLICE8_NEW_OBJECTS,
      ...SLICE10_NEW_OBJECTS,
      'policy:risk_events_family_scope',
      'table:risk_events',
      ...CONSENT_OWNER_NEW_OBJECTS,
      ...SLICE12_NEW_OBJECTS,
      ...SLICE13_NEW_OBJECTS,
      ...SLICE14_NEW_OBJECTS,
    ].sort());

    // Column-level UPDATE grant, never table-level.
    const { rows: columnGrants } = await seed.query(
      `SELECT column_name FROM information_schema.column_privileges
        WHERE grantee = 'xiaoshuyin_app' AND table_name = 'cases' AND privilege_type = 'UPDATE'
        ORDER BY column_name`
    );
    expect(columnGrants.map((row: any) => row.column_name)).toEqual([
      'is_primary',
      'phase',
      'status',
      'updated_at',
      'version',
    ]);
    const { rows: tableGrant } = await seed.query(
      "SELECT has_table_privilege('xiaoshuyin_app', 'public.cases', 'UPDATE') AS ok"
    );
    expect(tableGrant[0].ok).toBe(false);
  }, 180_000);

  it('replay applies 0 unexpected migrations and leaves the schema stable', async () => {
    const beforeReplayRows = await rowSnapshot(seed);
    const beforeReplayConstraints = await constraintDefinitions(seed);
    const beforeReplayObjects = await objectFingerprint(seed);

    const output = runMigrator(upgradeUrl);
    expect(output).toMatch(/Migration complete: 0 new, 19 previously applied\./);
    expect(output).not.toContain('APPLY 007_case_primary_switch.sql');
    expect(output).not.toContain('APPLY 009_safety_hold_control_foundation.sql');

    expect(await rowSnapshot(seed)).toEqual(beforeReplayRows);
    expect(await constraintDefinitions(seed)).toEqual(beforeReplayConstraints);
    expect(await objectFingerprint(seed)).toEqual(beforeReplayObjects);

    const { rows: applied } = await seed.query(
      'SELECT filename FROM schema_migrations ORDER BY filename'
    );
    expect(applied.map((row: any) => row.filename)).toEqual([
      ...CURRENT_MAIN_MIGRATIONS,
      '007_case_primary_switch.sql',
      '008_problem_formulation_core.sql',
      '009_safety_hold_control_foundation.sql',
      '010_problem_formulation_safety_vocabulary_reconcile.sql',
      '011_compliance_feature_policy_foundation.sql',
      '012_consent_01004_supplemental_enums.sql',
      '013_consent_01004_supplemental_assessment.sql',
      '014_consent_01004_cross_purpose_supersede_guard.sql',
      '015_digital_use_assessment_runtime.sql',
      '016_digital_use_family_alliance_runtime.sql',
      '017_digital_use_phone_use_contract_runtime.sql',
      '018_foundation_database_integrity_1.sql',
    ]);
  }, 180_000);
});

async function seedCurrentMainData(client: Client): Promise<SeedIds> {
  const suffix = `${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
  const { rows: firstAccount } = await client.query(
    'INSERT INTO accounts (wechat_openid) VALUES ($1) RETURNING id',
    [`s7iii_a_${suffix}`]
  );
  const accountId = firstAccount[0].id;
  const { rows: secondAccount } = await client.query(
    'INSERT INTO accounts (wechat_openid) VALUES ($1) RETURNING id',
    [`s7iii_b_${suffix}`]
  );
  const secondAccountId = secondAccount[0].id;

  const { rows: firstPerson } = await client.query(
    'INSERT INTO persons (account_id, created_by_account_id) VALUES ($1, $1) RETURNING id',
    [accountId]
  );
  const personId = firstPerson[0].id;
  const { rows: secondPerson } = await client.query(
    'INSERT INTO persons (account_id, created_by_account_id) VALUES ($1, $1) RETURNING id',
    [secondAccountId]
  );
  const secondPersonId = secondPerson[0].id;

  await client.query(
    `INSERT INTO person_compliance_profiles (person_id, age_band, minor_mode, verified_source)
     VALUES ($1, 'ADULT', false, 'SELF_STATEMENT'), ($2, 'ADULT', false, 'SELF_STATEMENT')`,
    [personId, secondPersonId]
  );

  const { rows: family } = await client.query(
    'INSERT INTO families (display_name, created_by_person_id) VALUES ($1, $2) RETURNING id',
    [`s7iii-${suffix}`, personId]
  );
  const familyId = family[0].id;
  await client.query(
    `INSERT INTO family_members (family_id, person_id) VALUES ($1, $2), ($1, $3)`,
    [familyId, personId, secondPersonId]
  );

  // Five-state Case data: exactly one primary/open row.
  const caseIds: string[] = [];
  for (const [index, status] of FIVE_CASE_STATUSES.entries()) {
    const { rows } = await client.query(
      `INSERT INTO cases (family_id, created_by_person_id, status, phase, is_primary, version)
       VALUES ($1, $2, $3, 'INTAKE', $4, 1) RETURNING id`,
      [familyId, personId, status, index === 0]
    );
    caseIds.push(rows[0].id);
  }
  const caseId = caseIds[0]!;

  await client.query(
    `INSERT INTO case_events (family_id, case_id, actor_account_id, event_type, metadata)
     VALUES ($1, $2, $3, 'CASE_CREATED', '{"primary":true,"version":1}'::jsonb)`,
    [familyId, caseId, accountId]
  );

  const { rows: message } = await client.query(
    `INSERT INTO dialogue_messages (family_id, case_id, actor_account_id, source_person_id, content)
     VALUES ($1, $2, $3, $4, 'seed message') RETURNING id`,
    [familyId, caseId, accountId, personId]
  );
  const messageId = message[0].id;

  await client.query(
    `INSERT INTO assertions
       (family_id, case_id, subject_person_id, source_kind, source_person_id,
        source_message_id, occurred_time_state, confirmation_status, kind, content)
     VALUES ($1, $2, $3, 'SELF_STATEMENT', $3, $4, 'UNKNOWN', 'UNCONFIRMED', 'STATEMENT',
             'seed assertion')`,
    [familyId, caseId, personId, messageId]
  );

  await client.query(
    `INSERT INTO observations
       (family_id, case_id, subject_person_id, source_kind, source_person_id,
        source_message_id, occurred_time_state, confirmation_status,
        observation_code, value_state)
     VALUES ($1, $2, $3, 'SELF_STATEMENT', $3, $4, 'UNKNOWN', 'UNCONFIRMED',
             'sleep_hours', 'UNKNOWN')`,
    [familyId, caseId, personId, messageId]
  );

  const { rows: participation } = await client.query(
    `INSERT INTO case_participants
       (family_id, case_id, person_id, state, invite_token_hash, invite_expires_at,
        created_by_person_id)
     VALUES ($1, $2, $3, 'PENDING', $4, now() + interval '1 day', $5)
     RETURNING id`,
    [familyId, caseId, secondPersonId, 'c'.repeat(64), personId]
  );

  // Existing audit literals from the Evidence and Participant eras.
  const auditRows: Array<[string, string, string]> = [
    ['FAMILY_CREATED', 'FAMILY', familyId],
    ['MEMBER_CREATED', 'PERSON', secondPersonId],
    ['CASE_CREATED', 'CASE', caseId],
    ['MESSAGE_RECORDED', 'DIALOGUE_MESSAGE', messageId],
    ['ASSERTION_RECORDED', 'ASSERTION', caseId],
    ['OBSERVATION_RECORDED', 'OBSERVATION', caseId],
    ['PARTICIPATION_INVITE_CREATED', 'CASE_PARTICIPANT', participation[0].id],
  ];
  for (const [eventType, resourceType, resourceId] of auditRows) {
    await client.query(
      `INSERT INTO business_audit_events
         (family_id, actor_account_id, event_type, resource_type, resource_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [familyId, accountId, eventType, resourceType, resourceId]
    );
  }

  // Existing idempotency command literals (text representation).
  const idempotencyRows: Array<[string, string]> = [
    ['CASE_CREATE', 's7iii-case-create'],
    ['CASE_MESSAGE_CREATE', 's7iii-message-create'],
    ['PARTICIPATION_INVITE_CREATE', 's7iii-invite-create'],
  ];
  for (const [commandType, key] of idempotencyRows) {
    await client.query(
      `INSERT INTO idempotency_keys
         (actor_account_id, command_type, idempotency_key, request_hash, response_status, response_body)
       VALUES ($1, $2, $3, $4, 201, '{}'::jsonb)`,
      [accountId, commandType, key, 'd'.repeat(64)]
    );
  }

  return {
    accountId,
    secondAccountId,
    personId,
    secondPersonId,
    familyId,
    caseId,
    messageId,
    participationId: participation[0].id,
  };
}

const SEEDED_TABLES = [
  'accounts',
  'persons',
  'families',
  'family_members',
  'person_compliance_profiles',
  'cases',
  'case_events',
  'dialogue_messages',
  'assertions',
  'observations',
  'case_participants',
  'business_audit_events',
  'idempotency_keys',
] as const;

async function rowSnapshot(client: Client): Promise<Record<string, unknown>> {
  const snapshot: Record<string, unknown> = {};
  for (const table of SEEDED_TABLES) {
    // `person_compliance_profiles` is keyed by person_id, so order by the
    // canonical row text instead of assuming an `id` column on every table.
    const { rows } = await client.query(
      `SELECT count(*)::int AS c,
              coalesce(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text), '[]'::jsonb) AS rows
         FROM ${table} t`
    );
    snapshot[table] = rows[0];
  }
  return snapshot;
}

async function constraintDefinitions(client: Client): Promise<Record<string, string>> {
  const { rows } = await client.query(`
    SELECT c.conname, pg_get_constraintdef(c.oid) AS definition
      FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
     WHERE n.nspname = 'public'
     ORDER BY c.conname
  `);
  return Object.fromEntries(
    rows.map((row: any) => [row.conname, normalizeDefinition(row.definition)])
  );
}

async function objectFingerprint(client: Client): Promise<string> {
  const { rows } = await client.query(`
    SELECT kind || ':' || name AS entry FROM (
      SELECT 'enum' AS kind, t.typname AS name
        FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
       WHERE n.nspname = 'public' AND t.typtype = 'e'
      UNION ALL
      SELECT 'table', tablename FROM pg_tables
       WHERE schemaname = 'public' AND tablename <> 'schema_migrations'
      UNION ALL
      SELECT 'policy', policyname FROM pg_policies WHERE schemaname = 'public'
      UNION ALL
      SELECT 'trigger', tgname FROM pg_trigger WHERE NOT tgisinternal
    ) objects
    ORDER BY 1
  `);
  return rows.map((row: any) => row.entry).join('|');
}