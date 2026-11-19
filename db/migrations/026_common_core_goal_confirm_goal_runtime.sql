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

CREATE FUNCTION goals_insert_guard() RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_case_phase case_phase;
  v_case_status case_status;
  v_is_primary boolean;
BEGIN
  IF NEW.lifecycle_status <> 'ACTIVE'
     OR NEW.confirmation_state <> 'UNCONFIRMED'
     OR NEW.review_state <> 'CURRENT'
     OR NEW.confirmed_by_person_id IS NOT NULL
     OR NEW.confirmed_at IS NOT NULL
  THEN
    RAISE EXCEPTION 'GOAL_INSERT_MUST_BE_UNCONFIRMED' USING ERRCODE='23514';
  END IF;

  IF current_user = 'xiaoshuyin_app'
     AND NEW.saved_by_person_id <> app_person_id()
  THEN
    RAISE EXCEPTION 'GOAL_SAVER_MUST_BE_AUTHENTICATED_ACTOR' USING ERRCODE='23514';
  END IF;

  SELECT phase, status, is_primary
    INTO v_case_phase, v_case_status, v_is_primary
    FROM cases
   WHERE id = NEW.case_id
     AND family_id = NEW.family_id;

  IF NOT FOUND
     OR v_case_phase <> 'GOALS'
     OR v_case_status <> 'OPEN'
     OR v_is_primary IS NOT TRUE
  THEN
    RAISE EXCEPTION 'GOAL_SAVE_CASE_PREREQUISITE_INVALID' USING ERRCODE='23514';
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM problem_formulations pf
     WHERE pf.id = NEW.problem_formulation_id
       AND pf.case_id = NEW.case_id
       AND pf.family_id = NEW.family_id
       AND pf.version = NEW.problem_formulation_version
       AND pf.status = 'CONFIRMED'
       AND pf.review_state = 'CURRENT'
  ) THEN
    RAISE EXCEPTION 'GOAL_SAVE_FORMULATION_PREREQUISITE_INVALID' USING ERRCODE='23514';
  END IF;

  RETURN NEW;
END
$function$;

CREATE TRIGGER goals_insert_guard
  BEFORE INSERT ON goals
  FOR EACH ROW EXECUTE FUNCTION goals_insert_guard();

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

  IF OLD.confirmation_state = 'CONFIRMED'
     AND (
       NEW.confirmation_state IS DISTINCT FROM OLD.confirmation_state
       OR NEW.confirmed_by_person_id IS DISTINCT FROM OLD.confirmed_by_person_id
       OR NEW.confirmed_at IS DISTINCT FROM OLD.confirmed_at
     )
  THEN
    RAISE EXCEPTION 'GOAL_CONFIRMATION_IMMUTABLE' USING ERRCODE='23514';
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

-- HIGH-001: preserve the historical app-role cases.phase privilege for every
-- other Case transition, while reserving entry into PLANNING for the formal
-- ConfirmGoal persistence primitive.
CREATE FUNCTION app.guard_goal_planning_transition() RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $function$
BEGIN
  IF current_user = 'xiaoshuyin_app'
     AND OLD.phase IS DISTINCT FROM NEW.phase
     AND NEW.phase = 'PLANNING'
  THEN
    RAISE EXCEPTION 'GOAL_PLANNING_TRANSITION_REQUIRES_FORMAL_COMMAND'
      USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END
$function$;

CREATE TRIGGER cases_goal_planning_transition_guard
  BEFORE UPDATE OF phase ON cases
  FOR EACH ROW EXECUTE FUNCTION app.guard_goal_planning_transition();

-- Persistence primitive for the single application ConfirmGoal command.
-- It is intentionally not a two-UPDATE wrapper: exact RLS context, Family
-- manager authority, Case/Goal/PF state, Goal/PF dependency boundary and A2010
-- completion are rechecked before either authoritative write.
CREATE FUNCTION app.confirm_goal_transition(
  p_case_id uuid,
  p_expected_case_version integer,
  p_goal_id uuid,
  p_goal_version integer,
  p_actor_person_id uuid
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
SET row_security = on
AS $function$
DECLARE
  v_family_id uuid;
  v_case_created_by_person_id uuid;
  v_goal_family_id uuid;
  v_problem_formulation_id uuid;
  v_problem_formulation_version integer;
  v_goal_dependencies jsonb;
  v_formulation_dependencies jsonb;
  v_baseline_refs jsonb;
  v_protective_conditions jsonb;
  v_parent_actions jsonb;
  v_participant_responsibilities jsonb;
  v_dependency jsonb;
  v_ref jsonb;
  v_responsibility jsonb;
  v_ref_type text;
  v_ref_id uuid;
  v_responsibility_person_id uuid;
  v_person_id uuid;
  v_consent_id uuid;
  v_consent_version integer;
  v_age_band age_band;
  v_guardian_person_id uuid;
  v_guardian_consent_record_id uuid;
  v_consent_bound_person_id uuid;
  v_consent_notice_hash text;
  v_consent_guardian_person_id uuid;
  v_case_version integer;
  v_confirmed_goal_id uuid;
  -- Keep this synchronized with @xiaoshuyin/compliance getCurrentNoticeHash().
  v_current_notice_hash constant text :=
    '2f8bf14402d5a32ba9e399477567fe763a859a64af416fa68c7784485e2246bf';
BEGIN
  -- The privileged primitive must bind the Family Person to the authenticated
  -- Account. app.set_family_context() alone is only an RLS scope setter and may
  -- not be promoted into application authorization.
  IF app_current_purpose() IS DISTINCT FROM 'FAMILY_MANAGEMENT'
     OR app_family_id() IS NULL
     OR app_account_id() IS NULL
     OR app_person_id() IS NULL
     OR p_actor_person_id IS DISTINCT FROM app_person_id()
     OR NOT EXISTS (
       SELECT 1 FROM persons p
        WHERE p.id=app_person_id()
          AND p.account_id=app_account_id()
     )
  THEN
    RAISE EXCEPTION 'GOAL_CONFIRM_TRANSITION_CONTEXT_INVALID' USING ERRCODE='23514';
  END IF;

  SELECT c.family_id,c.created_by_person_id
    INTO v_family_id,v_case_created_by_person_id
    FROM cases c
   WHERE c.id=p_case_id
     AND c.family_id=app_family_id()
     AND c.status='OPEN'
     AND c.phase='GOALS'
     AND c.is_primary IS TRUE
     AND c.version=p_expected_case_version
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'GOAL_CONFIRM_TRANSITION_CASE_INVALID' USING ERRCODE='23514';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM families f
     WHERE f.id=v_family_id AND f.created_by_person_id=app_person_id()
  ) OR NOT EXISTS (
    SELECT 1 FROM family_members fm
     WHERE fm.family_id=v_family_id AND fm.person_id=app_person_id()
  ) THEN
    RAISE EXCEPTION 'GOAL_CONFIRM_TRANSITION_AUTHORITY_INVALID' USING ERRCODE='23514';
  END IF;

  SELECT g.family_id,g.problem_formulation_id,
         g.problem_formulation_version,g.dependency_refs,
         g.baseline_refs,g.protective_conditions,g.parent_actions,
         g.participant_responsibilities
    INTO v_goal_family_id,v_problem_formulation_id,
         v_problem_formulation_version,v_goal_dependencies,
         v_baseline_refs,v_protective_conditions,v_parent_actions,
         v_participant_responsibilities
    FROM goals g
   WHERE g.case_id=p_case_id
     AND g.goal_id=p_goal_id
     AND g.version=p_goal_version
     AND g.lifecycle_status='ACTIVE'
     AND g.confirmation_state='UNCONFIRMED'
     AND g.review_state='CURRENT'
   FOR UPDATE;
  IF NOT FOUND OR v_goal_family_id IS DISTINCT FROM v_family_id THEN
    RAISE EXCEPTION 'GOAL_CONFIRM_TRANSITION_GOAL_INVALID' USING ERRCODE='23514';
  END IF;

  SELECT pf.dependency_refs INTO v_formulation_dependencies
    FROM problem_formulations pf
   WHERE pf.id=v_problem_formulation_id
     AND pf.case_id=p_case_id
     AND pf.family_id=v_family_id
     AND pf.version=v_problem_formulation_version
     AND pf.status='CONFIRMED'
     AND pf.review_state='CURRENT'
     AND NOT EXISTS (
       SELECT 1 FROM problem_formulations newer
        WHERE newer.case_id=p_case_id
          AND newer.status<>'SUPERSEDED'
          AND newer.version>v_problem_formulation_version
     );
  IF NOT FOUND THEN
    RAISE EXCEPTION 'GOAL_CONFIRM_TRANSITION_FORMULATION_INVALID' USING ERRCODE='23514';
  END IF;

  -- Mirror the persisted Goal contract checks that formal confirmGoal() runs
  -- before it may use a stored Goal as an execution basis.
  IF jsonb_typeof(v_baseline_refs)<>'array'
     OR jsonb_array_length(v_baseline_refs)=0
     OR jsonb_typeof(v_protective_conditions)<>'array'
     OR jsonb_array_length(v_protective_conditions)=0
     OR jsonb_typeof(v_parent_actions)<>'array'
     OR jsonb_array_length(v_parent_actions)=0
     OR jsonb_typeof(v_participant_responsibilities)<>'array'
     OR jsonb_typeof(v_goal_dependencies)<>'array'
     OR jsonb_array_length(v_goal_dependencies)=0
  THEN
    RAISE EXCEPTION 'GOAL_CONFIRM_TRANSITION_CONTRACT_INVALID' USING ERRCODE='23514';
  END IF;

  FOR v_ref IN SELECT value FROM jsonb_array_elements(v_baseline_refs)
  LOOP
    IF jsonb_typeof(v_ref)<>'object'
       OR COALESCE(v_ref->>'type','') NOT IN ('DIALOGUE_MESSAGE','ASSERTION','OBSERVATION')
       OR COALESCE(v_ref->>'id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    THEN
      RAISE EXCEPTION 'GOAL_CONFIRM_TRANSITION_CONTRACT_INVALID' USING ERRCODE='23514';
    END IF;
  END LOOP;

  FOR v_ref IN SELECT value FROM jsonb_array_elements(v_protective_conditions)
  LOOP
    IF jsonb_typeof(v_ref)<>'string' OR btrim(v_ref #>> '{}')='' THEN
      RAISE EXCEPTION 'GOAL_CONFIRM_TRANSITION_CONTRACT_INVALID' USING ERRCODE='23514';
    END IF;
  END LOOP;

  FOR v_ref IN SELECT value FROM jsonb_array_elements(v_parent_actions)
  LOOP
    IF jsonb_typeof(v_ref)<>'string' OR btrim(v_ref #>> '{}')='' THEN
      RAISE EXCEPTION 'GOAL_CONFIRM_TRANSITION_CONTRACT_INVALID' USING ERRCODE='23514';
    END IF;
  END LOOP;

  FOR v_dependency IN SELECT value FROM jsonb_array_elements(v_goal_dependencies)
  LOOP
    IF jsonb_typeof(v_dependency)<>'object'
       OR COALESCE(v_dependency->>'type','') NOT IN ('EVIDENCE','CONSENT')
    THEN
      RAISE EXCEPTION 'GOAL_CONFIRM_TRANSITION_DEPENDENCY_UNSUPPORTED' USING ERRCODE='23514';
    END IF;

    IF v_dependency->>'type'='EVIDENCE' THEN
      v_ref:=v_dependency->'evidence';
      IF v_ref IS NULL
         OR jsonb_typeof(v_ref)<>'object'
         OR COALESCE(v_ref->>'type','') NOT IN ('DIALOGUE_MESSAGE','ASSERTION','OBSERVATION')
         OR COALESCE(v_ref->>'id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      THEN
        RAISE EXCEPTION 'GOAL_CONFIRM_TRANSITION_CONTRACT_INVALID' USING ERRCODE='23514';
      END IF;
    ELSE
      IF COALESCE(v_dependency->>'id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      THEN
        RAISE EXCEPTION 'GOAL_CONFIRM_TRANSITION_CONTRACT_INVALID' USING ERRCODE='23514';
      END IF;
      IF v_dependency ? 'version' THEN
        IF jsonb_typeof(v_dependency->'version')<>'number'
           OR (v_dependency->>'version')::numeric<>trunc((v_dependency->>'version')::numeric)
           OR (v_dependency->>'version')::numeric<1
           OR (v_dependency->>'version')::numeric>2147483647
        THEN
          RAISE EXCEPTION 'GOAL_CONFIRM_TRANSITION_CONTRACT_INVALID' USING ERRCODE='23514';
        END IF;
      END IF;
    END IF;
  END LOOP;

  IF jsonb_typeof(v_formulation_dependencies)<>'array' THEN
    RAISE EXCEPTION 'GOAL_CONFIRM_TRANSITION_FORMULATION_DEPENDENCY_UNSUPPORTED' USING ERRCODE='23514';
  END IF;

  -- Match the application canonicalDependencyKey/isDependencySubset semantics
  -- exactly. In particular, a versionless CONSENT dependency is NOT covered by
  -- the same Consent id with an added version (and vice versa).
  FOR v_dependency IN SELECT value FROM jsonb_array_elements(v_formulation_dependencies)
  LOOP
    IF jsonb_typeof(v_dependency)<>'object'
       OR COALESCE(v_dependency->>'type','') NOT IN ('EVIDENCE','CONSENT')
    THEN
      RAISE EXCEPTION 'GOAL_CONFIRM_TRANSITION_FORMULATION_DEPENDENCY_UNSUPPORTED' USING ERRCODE='23514';
    END IF;

    IF v_dependency->>'type'='EVIDENCE' THEN
      v_ref:=v_dependency->'evidence';
      IF v_ref IS NULL
         OR jsonb_typeof(v_ref)<>'object'
         OR COALESCE(v_ref->>'type','') NOT IN ('DIALOGUE_MESSAGE','ASSERTION','OBSERVATION')
         OR COALESCE(v_ref->>'id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      THEN
        RAISE EXCEPTION 'GOAL_CONFIRM_TRANSITION_FORMULATION_DEPENDENCY_UNSUPPORTED' USING ERRCODE='23514';
      END IF;

      IF NOT EXISTS (
        SELECT 1
          FROM jsonb_array_elements(v_goal_dependencies) goal_dependency(value)
         WHERE goal_dependency.value->>'type'='EVIDENCE'
           AND goal_dependency.value->'evidence'->>'type'=v_ref->>'type'
           AND (goal_dependency.value->'evidence'->>'id')::uuid=(v_ref->>'id')::uuid
      ) THEN
        RAISE EXCEPTION 'GOAL_CONFIRM_TRANSITION_DEPENDENCY_COVERAGE_INVALID' USING ERRCODE='23514';
      END IF;
    ELSE
      IF COALESCE(v_dependency->>'id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      THEN
        RAISE EXCEPTION 'GOAL_CONFIRM_TRANSITION_FORMULATION_DEPENDENCY_UNSUPPORTED' USING ERRCODE='23514';
      END IF;
      IF v_dependency ? 'version' THEN
        IF jsonb_typeof(v_dependency->'version')<>'number'
           OR (v_dependency->>'version')::numeric<>trunc((v_dependency->>'version')::numeric)
           OR (v_dependency->>'version')::numeric<1
           OR (v_dependency->>'version')::numeric>2147483647
        THEN
          RAISE EXCEPTION 'GOAL_CONFIRM_TRANSITION_FORMULATION_DEPENDENCY_UNSUPPORTED' USING ERRCODE='23514';
        END IF;
      END IF;

      IF NOT EXISTS (
        SELECT 1
          FROM jsonb_array_elements(v_goal_dependencies) goal_dependency(value)
         WHERE goal_dependency.value->>'type'='CONSENT'
           AND (goal_dependency.value->>'id')::uuid=(v_dependency->>'id')::uuid
           AND (
             (
               NOT (v_dependency ? 'version')
               AND NOT (goal_dependency.value ? 'version')
             )
             OR
             (
               v_dependency ? 'version'
               AND goal_dependency.value ? 'version'
               AND (goal_dependency.value->>'version')::integer=
                   (v_dependency->>'version')::integer
             )
           )
      ) THEN
        RAISE EXCEPTION 'GOAL_CONFIRM_TRANSITION_DEPENDENCY_COVERAGE_INVALID' USING ERRCODE='23514';
      END IF;
    END IF;
  END LOOP;

  FOR v_responsibility IN
    SELECT value FROM jsonb_array_elements(v_participant_responsibilities)
  LOOP
    IF jsonb_typeof(v_responsibility)<>'object'
       OR COALESCE(v_responsibility->>'personId','') !~*
          '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       OR btrim(COALESCE(v_responsibility->>'responsibility',''))=''
       OR jsonb_typeof(v_responsibility->'evidenceRefs')<>'array'
       OR jsonb_array_length(v_responsibility->'evidenceRefs')=0
    THEN
      RAISE EXCEPTION 'GOAL_CONFIRM_TRANSITION_CONTRACT_INVALID' USING ERRCODE='23514';
    END IF;

    FOR v_ref IN
      SELECT value FROM jsonb_array_elements(v_responsibility->'evidenceRefs')
    LOOP
      IF jsonb_typeof(v_ref)<>'object'
         OR COALESCE(v_ref->>'type','') NOT IN ('DIALOGUE_MESSAGE','ASSERTION','OBSERVATION')
         OR COALESCE(v_ref->>'id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      THEN
        RAISE EXCEPTION 'GOAL_CONFIRM_TRANSITION_CONTRACT_INVALID' USING ERRCODE='23514';
      END IF;
    END LOOP;
  END LOOP;

  -- Preserve the existing A2010 gate before the deeper revalidation work.
  IF NOT EXISTS (
    SELECT 1
      FROM scene_node_states a2010
      JOIN scene_node_states binding
        ON binding.case_id=a2010.case_id
       AND binding.family_id=a2010.family_id
       AND binding.node_code='A1001'
       AND binding.scene_package_version=a2010.scene_package_version
     WHERE a2010.case_id=p_case_id
       AND a2010.family_id=v_family_id
       AND a2010.node_code='A2010'
       AND a2010.status='COMPLETED'
  ) THEN
    RAISE EXCEPTION 'GOAL_CONFIRM_TRANSITION_A2010_REQUIRED' USING ERRCODE='23514';
  END IF;

  -- Revalidate every stored Goal Evidence dependency against current truth.
  FOR v_dependency IN SELECT value FROM jsonb_array_elements(v_goal_dependencies)
  LOOP
    IF v_dependency->>'type'<>'EVIDENCE' THEN CONTINUE; END IF;
    v_ref:=v_dependency->'evidence';
    v_ref_type:=v_ref->>'type';
    v_ref_id:=(v_ref->>'id')::uuid;

    IF v_ref_type='DIALOGUE_MESSAGE' THEN
      IF NOT EXISTS (
        SELECT 1 FROM dialogue_messages d
         WHERE d.id=v_ref_id AND d.case_id=p_case_id
      ) THEN
        RAISE EXCEPTION 'GOAL_CONFIRM_TRANSITION_EVIDENCE_INVALID' USING ERRCODE='23514';
      END IF;
    ELSIF v_ref_type='ASSERTION' THEN
      IF NOT EXISTS (
        SELECT 1 FROM assertions a
         WHERE a.id=v_ref_id
           AND a.case_id=p_case_id
           AND (a.valid_from IS NULL OR a.valid_from<=now())
           AND (a.valid_until IS NULL OR a.valid_until>now())
           AND NOT EXISTS (
             SELECT 1 FROM assertions successor
              WHERE successor.supersedes_id=a.id
           )
      ) THEN
        RAISE EXCEPTION 'GOAL_CONFIRM_TRANSITION_EVIDENCE_INVALID' USING ERRCODE='23514';
      END IF;
    ELSE
      IF NOT EXISTS (
        SELECT 1 FROM observations o
         WHERE o.id=v_ref_id
           AND o.case_id=p_case_id
           AND (o.valid_from IS NULL OR o.valid_from<=now())
           AND (o.valid_until IS NULL OR o.valid_until>now())
           AND NOT EXISTS (
             SELECT 1 FROM observations successor
              WHERE successor.supersedes_id=o.id
           )
      ) THEN
        RAISE EXCEPTION 'GOAL_CONFIRM_TRANSITION_EVIDENCE_INVALID' USING ERRCODE='23514';
      END IF;
    END IF;
  END LOOP;

  -- Baseline and participant-responsibility Evidence are also authoritative
  -- inputs to formal confirmGoal(), even when not duplicated in dependency_refs.
  FOR v_ref IN
    SELECT value FROM jsonb_array_elements(v_baseline_refs)
    UNION ALL
    SELECT evidence_ref
      FROM jsonb_array_elements(v_participant_responsibilities) responsibility,
           LATERAL jsonb_array_elements(responsibility->'evidenceRefs') evidence_ref
  LOOP
    v_ref_type:=v_ref->>'type';
    v_ref_id:=(v_ref->>'id')::uuid;

    IF v_ref_type='DIALOGUE_MESSAGE' THEN
      IF NOT EXISTS (
        SELECT 1 FROM dialogue_messages d
         WHERE d.id=v_ref_id AND d.case_id=p_case_id
      ) THEN
        RAISE EXCEPTION 'GOAL_CONFIRM_TRANSITION_EVIDENCE_INVALID' USING ERRCODE='23514';
      END IF;
    ELSIF v_ref_type='ASSERTION' THEN
      IF NOT EXISTS (
        SELECT 1 FROM assertions a
         WHERE a.id=v_ref_id
           AND a.case_id=p_case_id
           AND (a.valid_from IS NULL OR a.valid_from<=now())
           AND (a.valid_until IS NULL OR a.valid_until>now())
           AND NOT EXISTS (
             SELECT 1 FROM assertions successor
              WHERE successor.supersedes_id=a.id
           )
      ) THEN
        RAISE EXCEPTION 'GOAL_CONFIRM_TRANSITION_EVIDENCE_INVALID' USING ERRCODE='23514';
      END IF;
    ELSE
      IF NOT EXISTS (
        SELECT 1 FROM observations o
         WHERE o.id=v_ref_id
           AND o.case_id=p_case_id
           AND (o.valid_from IS NULL OR o.valid_from<=now())
           AND (o.valid_until IS NULL OR o.valid_until>now())
           AND NOT EXISTS (
             SELECT 1 FROM observations successor
              WHERE successor.supersedes_id=o.id
           )
      ) THEN
        RAISE EXCEPTION 'GOAL_CONFIRM_TRANSITION_EVIDENCE_INVALID' USING ERRCODE='23514';
      END IF;
    END IF;
  END LOOP;

  -- Participant responsibilities require current ACTIVE participation and at
  -- least one current Evidence member attributable to that Person.
  FOR v_responsibility IN
    SELECT value FROM jsonb_array_elements(v_participant_responsibilities)
  LOOP
    v_responsibility_person_id:=(v_responsibility->>'personId')::uuid;
    IF NOT EXISTS (
      SELECT 1 FROM case_participants cp
       WHERE cp.case_id=p_case_id
         AND cp.person_id=v_responsibility_person_id
         AND cp.state='ACTIVE'
    ) THEN
      RAISE EXCEPTION 'GOAL_CONFIRM_TRANSITION_PARTICIPANT_INVALID' USING ERRCODE='23514';
    END IF;

    IF NOT EXISTS (
      SELECT 1
        FROM jsonb_array_elements(v_responsibility->'evidenceRefs') ref(value)
       WHERE (
         (ref.value->>'type'='DIALOGUE_MESSAGE' AND EXISTS (
           SELECT 1 FROM dialogue_messages d
            WHERE d.id=(ref.value->>'id')::uuid
              AND d.case_id=p_case_id
              AND d.source_person_id=v_responsibility_person_id
         ))
         OR
         (ref.value->>'type'='ASSERTION' AND EXISTS (
           SELECT 1 FROM assertions a
            WHERE a.id=(ref.value->>'id')::uuid
              AND a.case_id=p_case_id
              AND (
                a.subject_person_id=v_responsibility_person_id
                OR a.source_person_id=v_responsibility_person_id
              )
         ))
         OR
         (ref.value->>'type'='OBSERVATION' AND EXISTS (
           SELECT 1 FROM observations o
            WHERE o.id=(ref.value->>'id')::uuid
              AND o.case_id=p_case_id
              AND (
                o.subject_person_id=v_responsibility_person_id
                OR o.source_person_id=v_responsibility_person_id
              )
         ))
       )
    ) THEN
      RAISE EXCEPTION 'GOAL_CONFIRM_TRANSITION_PARTICIPANT_EVIDENCE_INVALID' USING ERRCODE='23514';
    END IF;
  END LOOP;

  -- Revalidate Goal Consent dependencies with the same guardian-consent
  -- read gate as the application service: exact record, usable evidence,
  -- current GRANTED chain head and exact version when the Goal pins one.
  FOR v_dependency IN SELECT value FROM jsonb_array_elements(v_goal_dependencies)
  LOOP
    IF v_dependency->>'type'<>'CONSENT' THEN CONTINUE; END IF;
    v_consent_id:=(v_dependency->>'id')::uuid;

    -- Guardian revocation locks the predecessor before appending a successor.
    -- Check for a successor in a separate statement after acquiring that lock.
    PERFORM 1 FROM consent_records c
     WHERE c.id=v_consent_id AND c.purpose='UNDER_14_GUARDIAN_CONSENT'
     FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'GOAL_CONFIRM_TRANSITION_CONSENT_INVALID' USING ERRCODE='23514';
    END IF;

    SELECT c.version INTO v_consent_version
      FROM consent_records c
     WHERE c.id=v_consent_id
       AND c.purpose='UNDER_14_GUARDIAN_CONSENT'
       AND c.decision='GRANTED'
       AND NOT EXISTS (
         SELECT 1 FROM consent_records successor
          WHERE successor.supersedes_id=c.id
            AND successor.purpose=c.purpose
       )
       AND jsonb_typeof(c.evidence)='object'
       AND c.evidence ?& ARRAY[
         'channel','accepted_text_hash','declared_age_band',
         'client_ip_hash','user_agent_hash'
       ]
       AND (
         c.evidence - ARRAY[
           'channel','accepted_text_hash','declared_age_band',
           'client_ip_hash','user_agent_hash'
         ]::text[]
       )='{}'::jsonb
       AND jsonb_typeof(c.evidence->'channel')='string'
       AND c.evidence->>'channel' IN ('MINIPROGRAM','TEST')
       AND jsonb_typeof(c.evidence->'accepted_text_hash')='string'
       AND c.evidence->>'accepted_text_hash' ~ '^[0-9a-f]{64}$'
       AND jsonb_typeof(c.evidence->'declared_age_band')='string'
       AND c.evidence->>'declared_age_band'='UNDER_14'
       AND jsonb_typeof(c.evidence->'client_ip_hash')='string'
       AND c.evidence->>'client_ip_hash' ~ '^[0-9a-f]{64}$'
       AND jsonb_typeof(c.evidence->'user_agent_hash')='string'
       AND c.evidence->>'user_agent_hash' ~ '^[0-9a-f]{64}$';
    IF NOT FOUND
       OR (
         v_dependency ? 'version'
         AND v_consent_version<>(v_dependency->>'version')::integer
       )
    THEN
      RAISE EXCEPTION 'GOAL_CONFIRM_TRANSITION_CONSENT_INVALID' USING ERRCODE='23514';
    END IF;
  END LOOP;

  -- Formal confirmGoal() re-runs the minor-processing Compliance gate for the
  -- actor, Case creator and every ACTIVE participant. The privileged primitive
  -- must fail closed on the same authoritative state.
  FOR v_person_id IN
    SELECT DISTINCT subject_person_id
      FROM (
        SELECT app_person_id() AS subject_person_id
        UNION ALL SELECT v_case_created_by_person_id
        UNION ALL
        SELECT cp.person_id
          FROM case_participants cp
         WHERE cp.case_id=p_case_id
           AND cp.state='ACTIVE'
      ) subjects
     WHERE subject_person_id IS NOT NULL
  LOOP
    SELECT pcp.age_band,pcp.guardian_person_id,pcp.guardian_consent_record_id
      INTO v_age_band,v_guardian_person_id,v_guardian_consent_record_id
      FROM person_compliance_profiles pcp
     WHERE pcp.person_id=v_person_id
     FOR UPDATE;

    IF NOT FOUND OR v_age_band='UNKNOWN' THEN
      RAISE EXCEPTION 'GOAL_CONFIRM_TRANSITION_COMPLIANCE_INVALID' USING ERRCODE='23514';
    END IF;

    IF v_age_band='UNDER_14' THEN
      IF v_guardian_person_id IS NULL OR v_guardian_consent_record_id IS NULL THEN
        RAISE EXCEPTION 'GOAL_CONFIRM_TRANSITION_COMPLIANCE_INVALID' USING ERRCODE='23514';
      END IF;

      SELECT c.bound_person_id,c.notice_hash,c.guardian_person_id
        INTO v_consent_bound_person_id,v_consent_notice_hash,
             v_consent_guardian_person_id
        FROM consent_records c
       WHERE c.id=v_guardian_consent_record_id
         AND c.purpose='UNDER_14_GUARDIAN_CONSENT'
         AND c.decision='GRANTED'
         AND jsonb_typeof(c.evidence)='object'
         AND c.evidence ?& ARRAY[
           'channel','accepted_text_hash','declared_age_band',
           'client_ip_hash','user_agent_hash'
         ]
         AND (
           c.evidence - ARRAY[
             'channel','accepted_text_hash','declared_age_band',
             'client_ip_hash','user_agent_hash'
           ]::text[]
         )='{}'::jsonb
         AND jsonb_typeof(c.evidence->'channel')='string'
         AND c.evidence->>'channel' IN ('MINIPROGRAM','TEST')
         AND jsonb_typeof(c.evidence->'accepted_text_hash')='string'
         AND c.evidence->>'accepted_text_hash' ~ '^[0-9a-f]{64}$'
         AND jsonb_typeof(c.evidence->'declared_age_band')='string'
         AND c.evidence->>'declared_age_band'='UNDER_14'
         AND jsonb_typeof(c.evidence->'client_ip_hash')='string'
         AND c.evidence->>'client_ip_hash' ~ '^[0-9a-f]{64}$'
         AND jsonb_typeof(c.evidence->'user_agent_hash')='string'
         AND c.evidence->>'user_agent_hash' ~ '^[0-9a-f]{64}$';

      IF NOT FOUND
         OR v_consent_bound_person_id IS DISTINCT FROM v_person_id
         OR v_consent_notice_hash IS DISTINCT FROM v_current_notice_hash
         OR v_consent_guardian_person_id IS DISTINCT FROM v_guardian_person_id
      THEN
        RAISE EXCEPTION 'GOAL_CONFIRM_TRANSITION_COMPLIANCE_INVALID' USING ERRCODE='23514';
      END IF;
    END IF;
  END LOOP;

  UPDATE cases
     SET phase='PLANNING',version=version+1,updated_at=now()
   WHERE id=p_case_id
     AND family_id=v_family_id
     AND version=p_expected_case_version
     AND phase='GOALS'
   RETURNING version INTO v_case_version;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'GOAL_CONFIRM_TRANSITION_CASE_WRITE_CONFLICT' USING ERRCODE='23514';
  END IF;

  UPDATE goals
     SET confirmation_state='CONFIRMED',
         confirmed_by_person_id=p_actor_person_id,
         confirmed_at=now(),
         updated_at=now()
   WHERE case_id=p_case_id
     AND goal_id=p_goal_id
     AND version=p_goal_version
     AND lifecycle_status='ACTIVE'
     AND confirmation_state='UNCONFIRMED'
     AND review_state='CURRENT'
   RETURNING goal_id INTO v_confirmed_goal_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'GOAL_CONFIRM_TRANSITION_GOAL_WRITE_CONFLICT' USING ERRCODE='23514';
  END IF;
  INSERT INTO case_events (family_id, case_id, actor_account_id, event_type, metadata)
  VALUES (
    v_family_id, p_case_id, app_account_id(), 'CASE_GOAL_CONFIRMED',
    jsonb_build_object(
      'goalId', p_goal_id, 'goalVersion', p_goal_version,
      'fromPhase', 'GOALS', 'toPhase', 'PLANNING',
      'fromVersion', p_expected_case_version, 'toVersion', v_case_version
    )
  );
  IF NOT FOUND THEN
    RAISE EXCEPTION 'GOAL_CONFIRM_TRANSITION_EVENT_WRITE_FAILED' USING ERRCODE='23514';
  END IF;

  INSERT INTO business_audit_events (
    family_id, actor_account_id, event_type, resource_type, resource_id, metadata
  ) VALUES (
    v_family_id, app_account_id(), 'GOAL_CONFIRMED', 'GOAL', p_goal_id,
    jsonb_build_object(
      'goalVersion', p_goal_version, 'caseId', p_case_id,
      'fromCaseVersion', p_expected_case_version, 'toCaseVersion', v_case_version,
      'confirmedByPersonId', p_actor_person_id,
      'problemFormulationId', v_problem_formulation_id,
      'problemFormulationVersion', v_problem_formulation_version
    )
  );
  IF NOT FOUND THEN
    RAISE EXCEPTION 'GOAL_CONFIRM_TRANSITION_AUDIT_WRITE_FAILED' USING ERRCODE='23514';
  END IF;

  RETURN v_case_version;
END
$function$;

REVOKE ALL ON FUNCTION app.confirm_goal_transition(uuid, integer, uuid, integer, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.confirm_goal_transition(uuid, integer, uuid, integer, uuid) TO xiaoshuyin_app;

ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals FORCE ROW LEVEL SECURITY;

CREATE POLICY goals_family_scope ON goals
  USING (family_id = app_family_id())
  WITH CHECK (family_id = app_family_id());

REVOKE ALL ON goals FROM xiaoshuyin_app;
GRANT SELECT, INSERT ON goals TO xiaoshuyin_app;
GRANT UPDATE (lifecycle_status, updated_at) ON goals TO xiaoshuyin_app;

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
