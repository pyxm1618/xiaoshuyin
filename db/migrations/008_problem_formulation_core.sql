-- ============================================================
-- Slice 8 — Problem Formulation Core
-- Migration: 008_problem_formulation_core.sql
--
-- Additive reviewed migration. Owns exactly:
--   1. problem_formulation_status enum
--   2. problem_formulations table + constraints + indexes
--   3. ENABLE / FORCE RLS + Family policies (no DELETE policy)
--   4. least-privilege grants + cases(phase, version, updated_at) column grant
--   5-9. shared CHECK vocabulary extensions (events / audit / idempotency)
--
-- Baseline read from origin/main = 8e393c99 (2026-11-11). Historical
-- migrations 001-007 are not modified.
--
-- Current-main compatibility reconciliation (S8-FINAL-01): the migrator applies
-- missing files by filename order. A real current-main database may therefore
-- already have 009 applied before this 008 is ever applied. Every shared CHECK
-- rewritten below is the exact UNION of the current-main (Slice 9) vocabulary
-- and the Slice 8 vocabulary. Applying 008 alone on a database that already
-- contains legal Slice 9 Safety rows must succeed and must not drop any 009
-- literal, branch or metadata semantics. No Slice 8 product semantics change.
-- ============================================================

CREATE TYPE problem_formulation_status AS ENUM (
  'DRAFT',
  'PRESENTED',
  'CONFIRMED',
  'DISPUTED',
  'NEEDS_REVIEW',
  'SUPERSEDED'
);

CREATE TABLE problem_formulations (
  id                         uuid PRIMARY KEY DEFAULT uuidv7(),
  family_id                  uuid NOT NULL,
  case_id                    uuid NOT NULL,
  version                    integer NOT NULL,
  status                     problem_formulation_status NOT NULL,

  primary_problem            jsonb NOT NULL,
  key_factors                jsonb NOT NULL,
  evidence_refs              jsonb NOT NULL,
  unknowns                   jsonb NOT NULL,
  conflicts                  jsonb NOT NULL,
  scene_fit                  text NOT NULL,
  alternative_explanations   jsonb NOT NULL,
  reassessment_conditions    jsonb NOT NULL,
  exit_conditions            jsonb NOT NULL,

  user_response              jsonb NULL,
  confirmed_by_person_id     uuid NULL,
  confirmed_at               timestamptz NULL,
  dependency_refs            jsonb NOT NULL,

  supersedes_version         integer NULL,
  created_at                 timestamptz NOT NULL DEFAULT now(),
  updated_at                 timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT problem_formulations_case_family_fk
    FOREIGN KEY (case_id, family_id)
    REFERENCES cases (id, family_id) ON DELETE RESTRICT,

  CONSTRAINT problem_formulations_confirmer_fk
    FOREIGN KEY (family_id, confirmed_by_person_id)
    REFERENCES family_members (family_id, person_id) ON DELETE RESTRICT,

  CONSTRAINT problem_formulations_version_range_check
    CHECK (version BETWEEN 1 AND 2147483647),

  CONSTRAINT problem_formulations_version_chain_check CHECK (
    (version = 1 AND supersedes_version IS NULL)
    OR (
      version BETWEEN 2 AND 2147483647
      AND supersedes_version IS NOT NULL
      AND supersedes_version BETWEEN 1 AND 2147483646
      AND supersedes_version = version - 1
    )
  ),

  CONSTRAINT problem_formulations_not_draft_check
    CHECK (status <> 'DRAFT'),

  CONSTRAINT problem_formulations_confirmation_pair_check
    CHECK ((confirmed_by_person_id IS NULL) = (confirmed_at IS NULL)),

  CONSTRAINT problem_formulations_confirmation_status_check CHECK (
    CASE status
      WHEN 'CONFIRMED' THEN
        confirmed_by_person_id IS NOT NULL AND confirmed_at IS NOT NULL
      WHEN 'PRESENTED' THEN
        confirmed_by_person_id IS NULL AND confirmed_at IS NULL
      WHEN 'DISPUTED' THEN
        confirmed_by_person_id IS NULL AND confirmed_at IS NULL
      WHEN 'NEEDS_REVIEW' THEN
        confirmed_by_person_id IS NULL AND confirmed_at IS NULL
      WHEN 'SUPERSEDED' THEN true
      ELSE false
    END
  ),

  CONSTRAINT problem_formulations_primary_problem_shape_check
    CHECK (jsonb_typeof(primary_problem) = 'object'),

  CONSTRAINT problem_formulations_key_factors_shape_check
    CHECK (jsonb_typeof(key_factors) = 'array'),

  CONSTRAINT problem_formulations_evidence_refs_shape_check
    CHECK (jsonb_typeof(evidence_refs) = 'array' AND jsonb_array_length(evidence_refs) >= 1),

  CONSTRAINT problem_formulations_unknowns_shape_check
    CHECK (jsonb_typeof(unknowns) = 'array'),

  CONSTRAINT problem_formulations_conflicts_shape_check
    CHECK (jsonb_typeof(conflicts) = 'array'),

  CONSTRAINT problem_formulations_scene_fit_check
    CHECK (btrim(scene_fit) <> ''),

  CONSTRAINT problem_formulations_alternative_explanations_shape_check
    CHECK (jsonb_typeof(alternative_explanations) = 'array'),

  CONSTRAINT problem_formulations_reassessment_conditions_shape_check
    CHECK (jsonb_typeof(reassessment_conditions) = 'array'),

  CONSTRAINT problem_formulations_exit_conditions_shape_check
    CHECK (jsonb_typeof(exit_conditions) = 'array'),

  CONSTRAINT problem_formulations_user_response_shape_check
    CHECK (user_response IS NULL OR jsonb_typeof(user_response) = 'object'),

  CONSTRAINT problem_formulations_dependency_refs_shape_check
    CHECK (jsonb_typeof(dependency_refs) = 'array'),

  CONSTRAINT problem_formulations_case_version_key UNIQUE (case_id, version),

  CONSTRAINT problem_formulations_case_version_chain_fk
    FOREIGN KEY (case_id, supersedes_version)
    REFERENCES problem_formulations (case_id, version) ON DELETE RESTRICT
);

CREATE UNIQUE INDEX problem_formulations_one_current_per_case
  ON problem_formulations (case_id)
  WHERE status <> 'SUPERSEDED';

CREATE INDEX problem_formulations_family_case_idx
  ON problem_formulations (family_id, case_id);

CREATE INDEX problem_formulations_case_version_desc_idx
  ON problem_formulations (case_id, version DESC);

CREATE INDEX problem_formulations_supersedes_idx
  ON problem_formulations (case_id, supersedes_version)
  WHERE supersedes_version IS NOT NULL;

ALTER TABLE problem_formulations ENABLE ROW LEVEL SECURITY;
ALTER TABLE problem_formulations FORCE ROW LEVEL SECURITY;

CREATE POLICY problem_formulations_select ON problem_formulations
  FOR SELECT USING (family_id = app_family_id());

CREATE POLICY problem_formulations_insert ON problem_formulations
  FOR INSERT WITH CHECK (family_id = app_family_id());

CREATE POLICY problem_formulations_update ON problem_formulations
  FOR UPDATE
  USING (family_id = app_family_id())
  WITH CHECK (family_id = app_family_id());

GRANT SELECT, INSERT ON problem_formulations TO xiaoshuyin_app;
GRANT UPDATE (status, user_response, confirmed_by_person_id, confirmed_at, updated_at)
  ON problem_formulations TO xiaoshuyin_app;
GRANT USAGE ON TYPE problem_formulation_status TO xiaoshuyin_app;

GRANT UPDATE (phase, version, updated_at) ON cases TO xiaoshuyin_app;

ALTER TABLE case_events
  DROP CONSTRAINT case_events_event_type_check;
ALTER TABLE case_events
  ADD CONSTRAINT case_events_event_type_check CHECK (
    event_type IN (
      'CASE_CREATED',
      'CASE_PRIMARY_ASSIGNED',
      'CASE_PRIMARY_REVOKED',
      'CASE_ASSESSMENT_STARTED',
      'CASE_PROBLEM_FORMULATION_PRESENTED',
      'CASE_PROBLEM_FORMULATION_CONFIRMED',
      'CASE_PROBLEM_FORMULATION_DISPUTED',
      'CASE_PROBLEM_FORMULATION_CORRECTED',
      'CASE_REASSESSMENT_STARTED',
      -- Current-main / Slice 9 Safety literals (preserved verbatim).
      'CASE_SAFETY_HOLD_ENTERED',
      'CASE_RISK_RESOLVED'
    )
  );

ALTER TABLE case_events
  DROP CONSTRAINT case_events_metadata_shape_check;
ALTER TABLE case_events
  ADD CONSTRAINT case_events_metadata_shape_check CHECK (
    (
      event_type = 'CASE_CREATED'
      AND jsonb_typeof(metadata) = 'object'
      AND metadata ? 'primary'
      AND metadata ? 'version'
      AND metadata - 'primary' - 'version' = '{}'::jsonb
      AND jsonb_typeof(metadata -> 'primary') = 'boolean'
      AND jsonb_typeof(metadata -> 'version') = 'number'
      AND CASE
            WHEN jsonb_typeof(metadata -> 'version') = 'number'
            THEN (metadata ->> 'version')::numeric = trunc((metadata ->> 'version')::numeric)
                 AND (metadata ->> 'version')::numeric >= 1
            ELSE false
          END
    )
    OR (
      event_type = 'CASE_PRIMARY_ASSIGNED'
      AND jsonb_typeof(metadata) = 'object'
      AND metadata ? 'primary'
      AND metadata ? 'version'
      AND metadata ? 'previousPrimaryCaseId'
      AND metadata ? 'reason'
      AND metadata - 'primary' - 'version' - 'previousPrimaryCaseId' - 'reason' = '{}'::jsonb
      AND metadata -> 'primary' = 'true'::jsonb
      AND jsonb_typeof(metadata -> 'version') = 'number'
      AND CASE
            WHEN jsonb_typeof(metadata -> 'version') = 'number'
            THEN (metadata ->> 'version')::numeric = trunc((metadata ->> 'version')::numeric)
                 AND (metadata ->> 'version')::numeric >= 1
            ELSE false
          END
      AND (
            jsonb_typeof(metadata -> 'previousPrimaryCaseId') = 'null'
            OR jsonb_typeof(metadata -> 'previousPrimaryCaseId') = 'string'
          )
      AND jsonb_typeof(metadata -> 'reason') = 'string'
      AND btrim(metadata ->> 'reason') <> ''
      AND length(metadata ->> 'reason') <= 500
    )
    OR (
      event_type = 'CASE_PRIMARY_REVOKED'
      AND jsonb_typeof(metadata) = 'object'
      AND metadata ? 'primary'
      AND metadata ? 'version'
      AND metadata ? 'newPrimaryCaseId'
      AND metadata ? 'reason'
      AND metadata - 'primary' - 'version' - 'newPrimaryCaseId' - 'reason' = '{}'::jsonb
      AND metadata -> 'primary' = 'false'::jsonb
      AND jsonb_typeof(metadata -> 'version') = 'number'
      AND CASE
            WHEN jsonb_typeof(metadata -> 'version') = 'number'
            THEN (metadata ->> 'version')::numeric = trunc((metadata ->> 'version')::numeric)
                 AND (metadata ->> 'version')::numeric >= 1
            ELSE false
          END
      AND jsonb_typeof(metadata -> 'newPrimaryCaseId') = 'string'
      AND jsonb_typeof(metadata -> 'reason') = 'string'
      AND btrim(metadata ->> 'reason') <> ''
      AND length(metadata ->> 'reason') <= 500
    )
    OR (
      event_type = 'CASE_ASSESSMENT_STARTED'
      AND jsonb_typeof(metadata) = 'object'
      AND metadata ? 'fromPhase'
      AND metadata ? 'toPhase'
      AND metadata ? 'version'
      AND metadata - 'fromPhase' - 'toPhase' - 'version' = '{}'::jsonb
      AND metadata ->> 'fromPhase' = 'INTAKE'
      AND metadata ->> 'toPhase' = 'ASSESSMENT'
      AND jsonb_typeof(metadata -> 'version') = 'number'
    )
    OR (
      event_type = 'CASE_PROBLEM_FORMULATION_PRESENTED'
      AND jsonb_typeof(metadata) = 'object'
      AND metadata ? 'formulationVersion'
      AND metadata ? 'fromPhase'
      AND metadata ? 'toPhase'
      AND metadata ? 'version'
      AND metadata - 'formulationVersion' - 'fromPhase' - 'toPhase' - 'version' = '{}'::jsonb
      AND metadata ->> 'fromPhase' = 'ASSESSMENT'
      AND metadata ->> 'toPhase' = 'PROBLEM_FORMULATION'
      AND jsonb_typeof(metadata -> 'formulationVersion') = 'number'
      AND jsonb_typeof(metadata -> 'version') = 'number'
    )
    OR (
      event_type = 'CASE_PROBLEM_FORMULATION_CONFIRMED'
      AND jsonb_typeof(metadata) = 'object'
      AND metadata ? 'formulationVersion'
      AND metadata ? 'fromStatus'
      AND metadata ? 'toStatus'
      AND metadata ? 'fromPhase'
      AND metadata ? 'toPhase'
      AND metadata ? 'version'
      AND metadata - 'formulationVersion' - 'fromStatus' - 'toStatus' - 'fromPhase' - 'toPhase' - 'version' = '{}'::jsonb
      AND metadata ->> 'fromStatus' = 'PRESENTED'
      AND metadata ->> 'toStatus' = 'CONFIRMED'
      AND metadata ->> 'fromPhase' = 'PROBLEM_FORMULATION'
      AND metadata ->> 'toPhase' = 'GOALS'
      AND jsonb_typeof(metadata -> 'formulationVersion') = 'number'
      AND jsonb_typeof(metadata -> 'version') = 'number'
    )
    OR (
      event_type = 'CASE_PROBLEM_FORMULATION_DISPUTED'
      AND jsonb_typeof(metadata) = 'object'
      AND metadata ? 'formulationVersion'
      AND metadata ? 'fromStatus'
      AND metadata ? 'toStatus'
      AND metadata ? 'version'
      AND metadata - 'formulationVersion' - 'fromStatus' - 'toStatus' - 'version' = '{}'::jsonb
      AND metadata ->> 'fromStatus' = 'PRESENTED'
      AND metadata ->> 'toStatus' = 'DISPUTED'
      AND jsonb_typeof(metadata -> 'formulationVersion') = 'number'
      AND jsonb_typeof(metadata -> 'version') = 'number'
    )
    OR (
      event_type = 'CASE_PROBLEM_FORMULATION_CORRECTED'
      AND jsonb_typeof(metadata) = 'object'
      AND metadata ? 'fromFormulationVersion'
      AND metadata ? 'toFormulationVersion'
      AND metadata ? 'fromStatus'
      AND metadata ? 'toStatus'
      AND metadata ? 'version'
      AND metadata - 'fromFormulationVersion' - 'toFormulationVersion' - 'fromStatus' - 'toStatus' - 'version' = '{}'::jsonb
      AND metadata ->> 'toStatus' = 'PRESENTED'
      AND jsonb_typeof(metadata -> 'fromFormulationVersion') = 'number'
      AND jsonb_typeof(metadata -> 'toFormulationVersion') = 'number'
      AND jsonb_typeof(metadata -> 'version') = 'number'
    )
    OR (
      event_type = 'CASE_REASSESSMENT_STARTED'
      AND jsonb_typeof(metadata) = 'object'
      AND metadata ? 'formulationVersion'
      AND metadata ? 'fromPhase'
      AND metadata ? 'toPhase'
      AND metadata ? 'version'
      AND metadata - 'formulationVersion' - 'fromPhase' - 'toPhase' - 'version' = '{}'::jsonb
      AND metadata ->> 'fromPhase' = 'PROBLEM_FORMULATION'
      AND metadata ->> 'toPhase' = 'ASSESSMENT'
      AND jsonb_typeof(metadata -> 'formulationVersion') = 'number'
      AND jsonb_typeof(metadata -> 'version') = 'number'
    )
    -- Current-main / Slice 9 Safety transitions: exactly the state/version pair
    -- and the risk trace id. Preserved verbatim from
    -- 009_safety_hold_control_foundation.sql so applying 008 on an
    -- already-Slice-9 database accepts existing Safety rows.
    OR (
      event_type IN ('CASE_SAFETY_HOLD_ENTERED', 'CASE_RISK_RESOLVED')
      AND jsonb_typeof(metadata) = 'object'
      AND metadata ? 'fromStatus'
      AND metadata ? 'toStatus'
      AND metadata ? 'fromVersion'
      AND metadata ? 'toVersion'
      AND metadata ? 'riskEventId'
      AND metadata - 'fromStatus' - 'toStatus' - 'fromVersion' - 'toVersion'
                  - 'riskEventId' = '{}'::jsonb
      AND jsonb_typeof(metadata -> 'fromStatus') = 'string'
      AND jsonb_typeof(metadata -> 'toStatus') = 'string'
      AND jsonb_typeof(metadata -> 'riskEventId') = 'string'
      AND CASE
            WHEN jsonb_typeof(metadata -> 'fromVersion') = 'number'
             AND jsonb_typeof(metadata -> 'toVersion') = 'number'
            THEN (metadata ->> 'fromVersion')::numeric = trunc((metadata ->> 'fromVersion')::numeric)
                 AND (metadata ->> 'toVersion')::numeric = trunc((metadata ->> 'toVersion')::numeric)
                 AND (metadata ->> 'fromVersion')::numeric >= 1
                 AND (metadata ->> 'toVersion')::numeric >= 1
            ELSE false
          END
    )
  );

ALTER TABLE business_audit_events
  DROP CONSTRAINT business_audit_events_event_type_check;
ALTER TABLE business_audit_events
  ADD CONSTRAINT business_audit_events_event_type_check CHECK (
    event_type IN (
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
      'CASE_PRIMARY_SWITCHED',
      'CASE_ASSESSMENT_STARTED',
      'CASE_PROBLEM_FORMULATION_PRESENTED',
      'CASE_PROBLEM_FORMULATION_CONFIRMED',
      'CASE_PROBLEM_FORMULATION_DISPUTED',
      'CASE_PROBLEM_FORMULATION_CORRECTED',
      'CASE_REASSESSMENT_STARTED',
      -- Current-main / Slice 9 Safety audit actions (preserved verbatim).
      'CASE_SAFETY_HOLD_ENTERED',
      'CASE_RISK_RESOLVED'
    )
  );

ALTER TABLE business_audit_events
  DROP CONSTRAINT business_audit_events_resource_type_check;
ALTER TABLE business_audit_events
  ADD CONSTRAINT business_audit_events_resource_type_check CHECK (
    resource_type IN (
      'FAMILY',
      'PERSON',
      'CONSENT',
      'CASE',
      'DIALOGUE_MESSAGE',
      'ASSERTION',
      'OBSERVATION',
      'CASE_PARTICIPANT',
      'PROBLEM_FORMULATION'
    )
  );

ALTER TABLE idempotency_keys
  DROP CONSTRAINT idempotency_keys_command_type_check;
ALTER TABLE idempotency_keys
  ADD CONSTRAINT idempotency_keys_command_type_check CHECK (
    command_type IN (
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
      'CASE_SWITCH_PRIMARY',
      'CASE_START_ASSESSMENT',
      'PROBLEM_FORMULATION_PRESENT',
      'PROBLEM_FORMULATION_CONFIRM',
      'PROBLEM_FORMULATION_DISPUTE',
      'PROBLEM_FORMULATION_CORRECT',
      'CASE_REASSESS_FROM_FORMULATION',
      -- Current-main / Slice 9 Safety commands (preserved verbatim).
      'CASE_ENTER_SAFETY_HOLD',
      'CASE_RESOLVE_RISK'
    )
  );

ALTER TABLE idempotency_keys
  DROP CONSTRAINT idempotency_keys_key_representation_check;
ALTER TABLE idempotency_keys
  ADD CONSTRAINT idempotency_keys_key_representation_check CHECK (
    (
      command_type NOT IN (
        'CASE_CREATE',
        'CASE_SWITCH_PRIMARY',
        'CASE_START_ASSESSMENT',
        'PROBLEM_FORMULATION_PRESENT',
        'PROBLEM_FORMULATION_CONFIRM',
        'PROBLEM_FORMULATION_DISPUTE',
        'PROBLEM_FORMULATION_CORRECT',
        'CASE_REASSESS_FROM_FORMULATION',
        -- Current-main / Slice 9 Safety commands use the same bytea exact-key
        -- representation; preserved verbatim.
        'CASE_ENTER_SAFETY_HOLD',
        'CASE_RESOLVE_RISK'
      )
      AND idempotency_key IS NOT NULL
      AND idempotency_key_bytes IS NULL
    )
    OR (
      command_type = 'CASE_CREATE'
      AND (
        (idempotency_key IS NOT NULL AND idempotency_key_bytes IS NULL)
        OR (idempotency_key IS NULL AND idempotency_key_bytes IS NOT NULL)
      )
    )
    OR (
      command_type IN (
        'CASE_SWITCH_PRIMARY',
        'CASE_START_ASSESSMENT',
        'PROBLEM_FORMULATION_PRESENT',
        'PROBLEM_FORMULATION_CONFIRM',
        'PROBLEM_FORMULATION_DISPUTE',
        'PROBLEM_FORMULATION_CORRECT',
        'CASE_REASSESS_FROM_FORMULATION',
        'CASE_ENTER_SAFETY_HOLD',
        'CASE_RESOLVE_RISK'
      )
      AND idempotency_key IS NULL
      AND idempotency_key_bytes IS NOT NULL
    )
  );