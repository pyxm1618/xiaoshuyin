-- ============================================================================
-- Common Core Goal / ConfirmGoal Runtime
-- Migration: 026_common_core_goal_confirm_goal_runtime.sql
--
-- V1 minimum Goal persistence only. No Plan / Intervention / Review runtime.
-- Goal confirmation is separate from Goal persistence; only ConfirmGoal may
-- make the authoritative GOALS -> PLANNING transition.
-- ============================================================================

CREATE TYPE goal_lifecycle_status AS ENUM ('ACTIVE', 'SUPERSEDED');
CREATE TYPE goal_confirmation_state AS ENUM ('UNCONFIRMED', 'CONFIRMED');
CREATE TYPE goal_review_state AS ENUM ('CURRENT', 'NEEDS_REVIEW');

ALTER TABLE problem_formulations
  ADD CONSTRAINT problem_formulations_goal_binding_key
  UNIQUE (id, case_id, family_id, version);

CREATE TABLE goals (
  id                           uuid PRIMARY KEY DEFAULT uuidv7(),
  goal_id                      uuid NOT NULL DEFAULT uuidv7(),
  family_id                    uuid NOT NULL,
  case_id                      uuid NOT NULL,
  version                      integer NOT NULL,
  lifecycle_status             goal_lifecycle_status NOT NULL DEFAULT 'ACTIVE',
  confirmation_state           goal_confirmation_state NOT NULL DEFAULT 'UNCONFIRMED',
  review_state                 goal_review_state NOT NULL DEFAULT 'CURRENT',
  problem_formulation_id       uuid NOT NULL,
  problem_formulation_version  integer NOT NULL,
  baseline_refs                jsonb NOT NULL,
  target_description           text NOT NULL,
  observation_method           text NOT NULL,
  observation_window           text NOT NULL,
  protective_conditions        jsonb NOT NULL,
  parent_actions               jsonb NOT NULL,
  review_point                 text NOT NULL,
  dependency_refs              jsonb NOT NULL,
  participant_responsibilities jsonb NOT NULL DEFAULT '[]'::jsonb,
  saved_by_person_id           uuid NOT NULL,
  confirmed_by_person_id       uuid NULL,
  confirmed_at                 timestamptz NULL,
  supersedes_version           integer NULL,
  created_at                   timestamptz NOT NULL DEFAULT now(),
  updated_at                   timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT goals_case_family_fk
    FOREIGN KEY (case_id, family_id)
    REFERENCES cases (id, family_id) ON DELETE RESTRICT,
  CONSTRAINT goals_formulation_exact_fk
    FOREIGN KEY (
      problem_formulation_id,
      case_id,
      family_id,
      problem_formulation_version
    )
    REFERENCES problem_formulations (id, case_id, family_id, version)
    ON DELETE RESTRICT,
  CONSTRAINT goals_saved_by_family_fk
    FOREIGN KEY (family_id, saved_by_person_id)
    REFERENCES family_members (family_id, person_id) ON DELETE RESTRICT,
  CONSTRAINT goals_confirmed_by_family_fk
    FOREIGN KEY (family_id, confirmed_by_person_id)
    REFERENCES family_members (family_id, person_id) ON DELETE RESTRICT,
  CONSTRAINT goals_goal_version_key UNIQUE (goal_id, version),
  CONSTRAINT goals_version_range_check
    CHECK (version BETWEEN 1 AND 2147483647),
  CONSTRAINT goals_version_chain_check CHECK (
    (version = 1 AND supersedes_version IS NULL)
    OR (
      version BETWEEN 2 AND 2147483647
      AND supersedes_version = version - 1
    )
  ),
  CONSTRAINT goals_version_chain_fk
    FOREIGN KEY (goal_id, supersedes_version)
    REFERENCES goals (goal_id, version) ON DELETE RESTRICT,
  CONSTRAINT goals_baseline_refs_check
    CHECK (jsonb_typeof(baseline_refs) = 'array' AND jsonb_array_length(baseline_refs) >= 1),
  CONSTRAINT goals_target_description_check CHECK (btrim(target_description) <> ''),
  CONSTRAINT goals_observation_method_check CHECK (btrim(observation_method) <> ''),
  CONSTRAINT goals_observation_window_check CHECK (btrim(observation_window) <> ''),
  CONSTRAINT goals_protective_conditions_check
    CHECK (jsonb_typeof(protective_conditions) = 'array' AND jsonb_array_length(protective_conditions) >= 1),
  CONSTRAINT goals_parent_actions_check
    CHECK (jsonb_typeof(parent_actions) = 'array' AND jsonb_array_length(parent_actions) >= 1),
  CONSTRAINT goals_review_point_check CHECK (btrim(review_point) <> ''),
  CONSTRAINT goals_dependency_refs_check
    CHECK (jsonb_typeof(dependency_refs) = 'array' AND jsonb_array_length(dependency_refs) >= 1),
  CONSTRAINT goals_participant_responsibilities_check
    CHECK (jsonb_typeof(participant_responsibilities) = 'array'),
  CONSTRAINT goals_confirmation_pair_check
    CHECK ((confirmed_by_person_id IS NULL) = (confirmed_at IS NULL)),
  CONSTRAINT goals_confirmation_state_check CHECK (
    CASE confirmation_state
      WHEN 'UNCONFIRMED' THEN confirmed_by_person_id IS NULL AND confirmed_at IS NULL
      WHEN 'CONFIRMED' THEN
        lifecycle_status = 'ACTIVE'
        AND review_state = 'CURRENT'
        AND confirmed_by_person_id IS NOT NULL
        AND confirmed_at IS NOT NULL
      ELSE false
    END
  )
);

CREATE UNIQUE INDEX goals_one_active_per_case
  ON goals (case_id)
  WHERE lifecycle_status = 'ACTIVE';

CREATE UNIQUE INDEX goals_one_authoritative_confirmed_per_case
  ON goals (case_id)
  WHERE lifecycle_status = 'ACTIVE' AND confirmation_state = 'CONFIRMED';

CREATE INDEX goals_family_case_version_idx
  ON goals (family_id, case_id, version DESC);

CREATE FUNCTION goals_update_guard() RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_case_phase case_phase;
BEGIN
  IF ROW(
      NEW.id, NEW.goal_id, NEW.family_id, NEW.case_id, NEW.version,
      NEW.problem_formulation_id, NEW.problem_formulation_version,
      NEW.baseline_refs, NEW.target_description, NEW.observation_method,
      NEW.observation_window, NEW.protective_conditions, NEW.parent_actions,
      NEW.review_point, NEW.dependency_refs, NEW.participant_responsibilities,
      NEW.saved_by_person_id, NEW.supersedes_version, NEW.created_at
    ) IS DISTINCT FROM ROW(
      OLD.id, OLD.goal_id, OLD.family_id, OLD.case_id, OLD.version,
      OLD.problem_formulation_id, OLD.problem_formulation_version,
      OLD.baseline_refs, OLD.target_description, OLD.observation_method,
      OLD.observation_window, OLD.protective_conditions, OLD.parent_actions,
      OLD.review_point, OLD.dependency_refs, OLD.participant_responsibilities,
      OLD.saved_by_person_id, OLD.supersedes_version, OLD.created_at
    ) THEN
    RAISE EXCEPTION 'GOAL_CONTRACT_IMMUTABLE' USING ERRCODE='23514';
  END IF;

  IF NEW.review_state IS DISTINCT FROM OLD.review_state THEN
    RAISE EXCEPTION 'GOAL_REVIEW_STATE_RUNTIME_UNOWNED' USING ERRCODE='23514';
  END IF;

  IF NEW.lifecycle_status IS DISTINCT FROM OLD.lifecycle_status THEN
    IF NOT (
      OLD.lifecycle_status = 'ACTIVE'
      AND NEW.lifecycle_status = 'SUPERSEDED'
      AND OLD.confirmation_state = 'UNCONFIRMED'
      AND NEW.confirmation_state = OLD.confirmation_state
      AND NEW.confirmed_by_person_id IS NOT DISTINCT FROM OLD.confirmed_by_person_id
      AND NEW.confirmed_at IS NOT DISTINCT FROM OLD.confirmed_at
    ) THEN
      RAISE EXCEPTION 'GOAL_LIFECYCLE_TRANSITION_INVALID' USING ERRCODE='23514';
    END IF;
  END IF;

  IF NEW.confirmation_state IS DISTINCT FROM OLD.confirmation_state THEN
    IF NOT (
      OLD.confirmation_state = 'UNCONFIRMED'
      AND NEW.confirmation_state = 'CONFIRMED'
      AND OLD.lifecycle_status = 'ACTIVE'
      AND NEW.lifecycle_status = 'ACTIVE'
      AND OLD.review_state = 'CURRENT'
      AND NEW.review_state = 'CURRENT'
      AND NEW.confirmed_by_person_id IS NOT NULL
      AND NEW.confirmed_at IS NOT NULL
      AND NEW.confirmed_by_person_id = app_person_id()
    ) THEN
      RAISE EXCEPTION 'GOAL_CONFIRMATION_TRANSITION_INVALID' USING ERRCODE='23514';
    END IF;

    SELECT phase INTO v_case_phase
      FROM cases
     WHERE id = NEW.case_id
       AND family_id = NEW.family_id;

    IF NOT FOUND OR v_case_phase <> 'PLANNING' THEN
      RAISE EXCEPTION 'GOAL_CONFIRMATION_REQUIRES_PLANNING_TRANSITION' USING ERRCODE='23514';
    END IF;
  END IF;

  IF NEW.updated_at < OLD.updated_at THEN
    RAISE EXCEPTION 'GOAL_UPDATED_AT_REGRESSION' USING ERRCODE='23514';
  END IF;

  RETURN NEW;
END
$function$;

CREATE TRIGGER goals_update_guard
  BEFORE UPDATE ON goals
  FOR EACH ROW EXECUTE FUNCTION goals_update_guard();

ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals FORCE ROW LEVEL SECURITY;

CREATE POLICY goals_family_scope ON goals
  USING (family_id = app_family_id())
  WITH CHECK (family_id = app_family_id());

REVOKE ALL ON goals FROM xiaoshuyin_app;
GRANT SELECT, INSERT ON goals TO xiaoshuyin_app;
GRANT UPDATE (
  lifecycle_status,
  confirmation_state,
  confirmed_by_person_id,
  confirmed_at,
  updated_at
) ON goals TO xiaoshuyin_app;

GRANT USAGE ON TYPE goal_lifecycle_status TO xiaoshuyin_app;
GRANT USAGE ON TYPE goal_confirmation_state TO xiaoshuyin_app;
GRANT USAGE ON TYPE goal_review_state TO xiaoshuyin_app;

DO $$
DECLARE current_def text; current_expr text;
BEGIN
  SELECT pg_get_constraintdef(oid, true) INTO current_def
    FROM pg_constraint
   WHERE conrelid='idempotency_keys'::regclass
     AND conname='idempotency_keys_command_type_check';
  IF current_def IS NULL OR current_def NOT LIKE 'CHECK (%' THEN
    RAISE EXCEPTION 'idempotency command authority missing';
  END IF;
  current_expr := substring(current_def FROM 8 FOR char_length(current_def)-8);
  ALTER TABLE idempotency_keys DROP CONSTRAINT idempotency_keys_command_type_check;
  EXECUTE format(
    'ALTER TABLE idempotency_keys ADD CONSTRAINT idempotency_keys_command_type_check CHECK ((%s) OR command_type IN (%L,%L))',
    current_expr, 'GOAL_SAVE', 'GOAL_CONFIRM'
  );
END $$;

DO $$
DECLARE current_def text; current_expr text;
BEGIN
  SELECT pg_get_constraintdef(oid, true) INTO current_def
    FROM pg_constraint
   WHERE conrelid='business_audit_events'::regclass
     AND conname='business_audit_events_resource_type_check';
  IF current_def IS NULL OR current_def NOT LIKE 'CHECK (%' THEN
    RAISE EXCEPTION 'business audit resource authority missing';
  END IF;
  current_expr := substring(current_def FROM 8 FOR char_length(current_def)-8);
  ALTER TABLE business_audit_events DROP CONSTRAINT business_audit_events_resource_type_check;
  EXECUTE format(
    'ALTER TABLE business_audit_events ADD CONSTRAINT business_audit_events_resource_type_check CHECK ((%s) OR resource_type=%L)',
    current_expr, 'GOAL'
  );

  SELECT pg_get_constraintdef(oid, true) INTO current_def
    FROM pg_constraint
   WHERE conrelid='business_audit_events'::regclass
     AND conname='business_audit_events_event_type_check';
  IF current_def IS NULL OR current_def NOT LIKE 'CHECK (%' THEN
    RAISE EXCEPTION 'business audit event authority missing';
  END IF;
  current_expr := substring(current_def FROM 8 FOR char_length(current_def)-8);
  ALTER TABLE business_audit_events DROP CONSTRAINT business_audit_events_event_type_check;
  EXECUTE format(
    'ALTER TABLE business_audit_events ADD CONSTRAINT business_audit_events_event_type_check CHECK ((%s) OR event_type IN (%L,%L))',
    current_expr, 'GOAL_SAVED', 'GOAL_CONFIRMED'
  );
END $$;

DO $$
DECLARE current_def text; current_expr text;
BEGIN
  SELECT pg_get_constraintdef(oid, true) INTO current_def
    FROM pg_constraint
   WHERE conrelid='case_events'::regclass
     AND conname='case_events_event_type_check';
  IF current_def IS NULL OR current_def NOT LIKE 'CHECK (%' THEN
    RAISE EXCEPTION 'case event type authority missing';
  END IF;
  current_expr := substring(current_def FROM 8 FOR char_length(current_def)-8);
  ALTER TABLE case_events DROP CONSTRAINT case_events_event_type_check;
  EXECUTE format(
    'ALTER TABLE case_events ADD CONSTRAINT case_events_event_type_check CHECK ((%s) OR event_type=%L)',
    current_expr, 'CASE_GOAL_CONFIRMED'
  );

  SELECT pg_get_constraintdef(oid, true) INTO current_def
    FROM pg_constraint
   WHERE conrelid='case_events'::regclass
     AND conname='case_events_metadata_shape_check';
  IF current_def IS NULL OR current_def NOT LIKE 'CHECK (%' THEN
    RAISE EXCEPTION 'case event metadata authority missing';
  END IF;
  current_expr := substring(current_def FROM 8 FOR char_length(current_def)-8);
  ALTER TABLE case_events DROP CONSTRAINT case_events_metadata_shape_check;
  EXECUTE format($ddl$
    ALTER TABLE case_events
      ADD CONSTRAINT case_events_metadata_shape_check CHECK (
        (%s)
        OR (
          event_type = %L
          AND jsonb_typeof(metadata) = 'object'
          AND metadata ? 'goalId'
          AND metadata ? 'goalVersion'
          AND metadata ? 'fromPhase'
          AND metadata ? 'toPhase'
          AND metadata ? 'fromVersion'
          AND metadata ? 'toVersion'
          AND metadata - 'goalId' - 'goalVersion' - 'fromPhase' - 'toPhase'
                       - 'fromVersion' - 'toVersion' = '{}'::jsonb
          AND jsonb_typeof(metadata -> 'goalId') = 'string'
          AND jsonb_typeof(metadata -> 'goalVersion') = 'number'
          AND metadata ->> 'fromPhase' = 'GOALS'
          AND metadata ->> 'toPhase' = 'PLANNING'
          AND CASE
                WHEN jsonb_typeof(metadata -> 'fromVersion') = 'number'
                 AND jsonb_typeof(metadata -> 'toVersion') = 'number'
                 AND jsonb_typeof(metadata -> 'goalVersion') = 'number'
                THEN (metadata ->> 'goalVersion')::numeric = trunc((metadata ->> 'goalVersion')::numeric)
                 AND (metadata ->> 'fromVersion')::numeric = trunc((metadata ->> 'fromVersion')::numeric)
                 AND (metadata ->> 'toVersion')::numeric = trunc((metadata ->> 'toVersion')::numeric)
                 AND (metadata ->> 'goalVersion')::numeric >= 1
                 AND (metadata ->> 'fromVersion')::numeric >= 1
                 AND (metadata ->> 'toVersion')::numeric = (metadata ->> 'fromVersion')::numeric + 1
                ELSE false
              END
        )
      )
  $ddl$, current_expr, 'CASE_GOAL_CONFIRMED');
END $$;
