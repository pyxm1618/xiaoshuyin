-- Slice 16 — authority-reconciled psychological / behavioral intervention contract foundation.
-- InterventionDefinition domain truth only. No Professional Approval, qualification,
-- Staff, Scene-package, Case/Phase or family eligibility authority is created here.
BEGIN;

CREATE TABLE intervention_definitions (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  scene_id text NOT NULL CHECK (length(btrim(scene_id)) BETWEEN 1 AND 128),
  intervention_code text NOT NULL CHECK (
    intervention_code = upper(intervention_code)
    AND intervention_code ~ '^[A-Z][A-Z0-9_]{1,63}$'
  ),
  version integer NOT NULL CHECK (version >= 1),
  content_hash text NOT NULL CHECK (content_hash ~ '^[0-9a-f]{64}$'),
  definition_state text NOT NULL DEFAULT 'CANDIDATE' CHECK (
    definition_state IN ('CANDIDATE','CURRENT','SUPERSEDED','RETIRED')
  ),
  revision integer NOT NULL DEFAULT 1 CHECK (revision >= 1),
  target_problem_or_mechanism text NOT NULL CHECK (length(btrim(target_problem_or_mechanism)) > 0),
  formulation_dependencies jsonb NOT NULL,
  supporting_evidence_requirements jsonb NOT NULL,
  applicable_conditions jsonb NOT NULL,
  exclusion_or_contraindication_conditions jsonb NOT NULL,
  age_and_development_scope jsonb NOT NULL,
  rationale text NOT NULL CHECK (length(btrim(rationale)) > 0),
  intervention_steps jsonb NOT NULL,
  participation_and_consent_requirements jsonb NOT NULL,
  baseline_and_observation jsonb NOT NULL,
  expected_observable_change jsonb NOT NULL,
  burden_and_barriers jsonb NOT NULL,
  adverse_or_worsening_signals jsonb NOT NULL,
  review_window_and_criteria jsonb NOT NULL,
  stop_reassess_safety_referral_conditions jsonb NOT NULL,
  allowed_combinations jsonb NOT NULL,
  conflicting_interventions jsonb NOT NULL,
  professional_source_refs jsonb NOT NULL,
  supersedes_id uuid REFERENCES intervention_definitions(id) ON DELETE RESTRICT,
  created_by_person_id uuid NOT NULL REFERENCES persons(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  superseded_at timestamptz,
  retired_at timestamptz,
  CONSTRAINT intervention_definitions_identity_version_key
    UNIQUE (scene_id, intervention_code, version),
  CONSTRAINT intervention_definitions_state_time_check CHECK (
    (definition_state = 'SUPERSEDED' AND superseded_at IS NOT NULL AND retired_at IS NULL)
    OR (definition_state = 'RETIRED' AND retired_at IS NOT NULL)
    OR (definition_state IN ('CANDIDATE','CURRENT') AND superseded_at IS NULL AND retired_at IS NULL)
  )
);

CREATE UNIQUE INDEX intervention_definitions_single_successor_idx
  ON intervention_definitions(supersedes_id)
  WHERE supersedes_id IS NOT NULL;

CREATE INDEX intervention_definitions_exact_identity_idx
  ON intervention_definitions(scene_id, intervention_code, version, content_hash);

CREATE FUNCTION app.guard_intervention_definition_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $function$
DECLARE predecessor intervention_definitions%ROWTYPE;
BEGIN
  IF NEW.supersedes_id IS NULL THEN
    IF NEW.version <> 1 THEN
      RAISE EXCEPTION 'INTERVENTION_DEFINITION_PREDECESSOR_REQUIRED' USING ERRCODE='23514';
    END IF;
    RETURN NEW;
  END IF;

  SELECT * INTO predecessor
    FROM intervention_definitions
   WHERE id = NEW.supersedes_id
   FOR UPDATE;

  IF predecessor.id IS NULL
     OR predecessor.scene_id <> NEW.scene_id
     OR predecessor.intervention_code <> NEW.intervention_code
     OR NEW.version <> predecessor.version + 1 THEN
    RAISE EXCEPTION 'INTERVENTION_DEFINITION_PREDECESSOR_MISMATCH' USING ERRCODE='23514';
  END IF;

  IF predecessor.definition_state = 'RETIRED' THEN
    RAISE EXCEPTION 'INTERVENTION_DEFINITION_RETIRED' USING ERRCODE='23514';
  END IF;

  IF predecessor.definition_state = 'SUPERSEDED' THEN
    RAISE EXCEPTION 'INTERVENTION_DEFINITION_TERMINAL' USING ERRCODE='23514';
  END IF;

  RETURN NEW;
END
$function$;

CREATE TRIGGER intervention_definition_insert_guard
  BEFORE INSERT ON intervention_definitions
  FOR EACH ROW EXECUTE FUNCTION app.guard_intervention_definition_insert();

CREATE FUNCTION app.guard_intervention_definition_immutable_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $function$
BEGIN
  IF ROW(
      NEW.scene_id, NEW.intervention_code, NEW.version, NEW.content_hash,
      NEW.target_problem_or_mechanism, NEW.formulation_dependencies,
      NEW.supporting_evidence_requirements, NEW.applicable_conditions,
      NEW.exclusion_or_contraindication_conditions, NEW.age_and_development_scope,
      NEW.rationale, NEW.intervention_steps, NEW.participation_and_consent_requirements,
      NEW.baseline_and_observation, NEW.expected_observable_change,
      NEW.burden_and_barriers, NEW.adverse_or_worsening_signals,
      NEW.review_window_and_criteria, NEW.stop_reassess_safety_referral_conditions,
      NEW.allowed_combinations, NEW.conflicting_interventions,
      NEW.professional_source_refs, NEW.supersedes_id, NEW.created_by_person_id,
      NEW.created_at
    ) IS DISTINCT FROM ROW(
      OLD.scene_id, OLD.intervention_code, OLD.version, OLD.content_hash,
      OLD.target_problem_or_mechanism, OLD.formulation_dependencies,
      OLD.supporting_evidence_requirements, OLD.applicable_conditions,
      OLD.exclusion_or_contraindication_conditions, OLD.age_and_development_scope,
      OLD.rationale, OLD.intervention_steps, OLD.participation_and_consent_requirements,
      OLD.baseline_and_observation, OLD.expected_observable_change,
      OLD.burden_and_barriers, OLD.adverse_or_worsening_signals,
      OLD.review_window_and_criteria, OLD.stop_reassess_safety_referral_conditions,
      OLD.allowed_combinations, OLD.conflicting_interventions,
      OLD.professional_source_refs, OLD.supersedes_id, OLD.created_by_person_id,
      OLD.created_at
    ) THEN
    RAISE EXCEPTION 'INTERVENTION_DEFINITION_IMMUTABLE' USING ERRCODE='23514';
  END IF;

  IF NEW.revision <> OLD.revision + 1 THEN
    RAISE EXCEPTION 'INTERVENTION_DEFINITION_STALE_REVISION' USING ERRCODE='40001';
  END IF;

  IF OLD.definition_state IN ('SUPERSEDED','RETIRED') THEN
    RAISE EXCEPTION 'INTERVENTION_DEFINITION_TERMINAL' USING ERRCODE='23514';
  END IF;

  IF NEW.definition_state NOT IN ('SUPERSEDED','RETIRED')
     OR NEW.definition_state = OLD.definition_state THEN
    RAISE EXCEPTION 'INTERVENTION_DEFINITION_INVALID_TRANSITION' USING ERRCODE='23514';
  END IF;

  RETURN NEW;
END
$function$;

CREATE TRIGGER intervention_definition_immutable_update_guard
  BEFORE UPDATE ON intervention_definitions
  FOR EACH ROW EXECUTE FUNCTION app.guard_intervention_definition_immutable_update();

ALTER TABLE intervention_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE intervention_definitions FORCE ROW LEVEL SECURITY;

CREATE POLICY intervention_definitions_runtime_read
  ON intervention_definitions FOR SELECT TO xiaoshuyin_app
  USING (app_account_id() IS NOT NULL AND app_person_id() IS NOT NULL);

CREATE POLICY intervention_definitions_professional_insert
  ON intervention_definitions FOR INSERT TO xiaoshuyin_app
  WITH CHECK (
    created_by_person_id = app_person_id()
    AND EXISTS (
      SELECT 1 FROM staff_assignments sa
       WHERE sa.account_id = app_account_id()
         AND sa.person_id = app_person_id()
         AND sa.capability = 'PROFESSIONAL_REVIEW'
         AND sa.scope_type = 'GLOBAL'
         AND sa.revoked_at IS NULL
         AND sa.valid_from <= clock_timestamp()
         AND (sa.valid_until IS NULL OR sa.valid_until > clock_timestamp())
    )
  );

CREATE POLICY intervention_definitions_professional_update
  ON intervention_definitions FOR UPDATE TO xiaoshuyin_app
  USING (
    EXISTS (
      SELECT 1 FROM staff_assignments sa
       WHERE sa.account_id = app_account_id()
         AND sa.person_id = app_person_id()
         AND sa.capability = 'PROFESSIONAL_REVIEW'
         AND sa.scope_type = 'GLOBAL'
         AND sa.revoked_at IS NULL
         AND sa.valid_from <= clock_timestamp()
         AND (sa.valid_until IS NULL OR sa.valid_until > clock_timestamp())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM staff_assignments sa
       WHERE sa.account_id = app_account_id()
         AND sa.person_id = app_person_id()
         AND sa.capability = 'PROFESSIONAL_REVIEW'
         AND sa.scope_type = 'GLOBAL'
         AND sa.revoked_at IS NULL
         AND sa.valid_from <= clock_timestamp()
         AND (sa.valid_until IS NULL OR sa.valid_until > clock_timestamp())
    )
  );

REVOKE ALL ON intervention_definitions FROM xiaoshuyin_app;
GRANT SELECT, INSERT, UPDATE ON intervention_definitions TO xiaoshuyin_app;

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
    'ALTER TABLE idempotency_keys ADD CONSTRAINT idempotency_keys_command_type_check CHECK ((%s) OR command_type IN (%L,%L,%L,%L))',
    current_expr,
    'INTERVENTION_DEFINITION_CREATE',
    'INTERVENTION_DEFINITION_SUCCESSOR_CREATE',
    'INTERVENTION_DEFINITION_RETIRE',
    'INTERVENTION_DEFINITION_SUPERSEDE'
  );
END $$;

-- Minimal extension of the single existing audit owner for a global professional
-- asset. Existing family-scoped rows/policies retain their semantics.
ALTER TABLE business_audit_events ALTER COLUMN family_id DROP NOT NULL;
ALTER TABLE business_audit_events
  ADD CONSTRAINT business_audit_events_scope_shape_check CHECK (
    family_id IS NOT NULL OR resource_type = 'INTERVENTION_DEFINITION'
  );

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
    current_expr, 'INTERVENTION_DEFINITION'
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
    'ALTER TABLE business_audit_events ADD CONSTRAINT business_audit_events_event_type_check CHECK ((%s) OR event_type IN (%L,%L,%L,%L,%L,%L))',
    current_expr,
    'INTERVENTION_DEFINITION_CANDIDATE_CREATED',
    'INTERVENTION_DEFINITION_SUCCESSOR_CREATED',
    'INTERVENTION_DEFINITION_SUPERSEDED',
    'INTERVENTION_DEFINITION_RETIRED',
    'INTERVENTION_ELIGIBILITY_EVALUATED',
    'INTERVENTION_ELIGIBILITY_BLOCKED'
  );
END $$;

CREATE POLICY audit_staff_intervention_insert ON business_audit_events
  FOR INSERT TO xiaoshuyin_app
  WITH CHECK (
    family_id IS NULL
    AND resource_type = 'INTERVENTION_DEFINITION'
    AND actor_account_id = app_account_id()
    AND EXISTS (
      SELECT 1 FROM staff_assignments sa
       WHERE sa.account_id = app_account_id()
         AND sa.person_id = app_person_id()
         AND sa.capability = 'PROFESSIONAL_REVIEW'
         AND sa.scope_type = 'GLOBAL'
         AND sa.revoked_at IS NULL
         AND sa.valid_from <= clock_timestamp()
         AND (sa.valid_until IS NULL OR sa.valid_until > clock_timestamp())
    )
  );

COMMIT;
