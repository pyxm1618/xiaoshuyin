-- Migration 031: Downstream Dependency Review State Propagation (Finding #24)
-- Enforces downstream Goal and Phone Contract review_state = NEEDS_REVIEW
-- when material upstream dependencies are superseded, invalidated or disputed.
-- Preserves GOAL_REVIEW_STATE_RUNTIME_UNOWNED protection against arbitrary runtime writes.

-- 1. Extend digital_use_contract_versions with review_state
ALTER TABLE digital_use_contract_versions
  ADD COLUMN IF NOT EXISTS review_state text NOT NULL DEFAULT 'CURRENT';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'digital_use_contract_versions'::regclass
       AND conname = 'digital_use_contract_versions_review_state_check'
  ) THEN
    ALTER TABLE digital_use_contract_versions
      ADD CONSTRAINT digital_use_contract_versions_review_state_check
      CHECK (review_state IN ('CURRENT', 'NEEDS_REVIEW'));
  END IF;
END $$;

-- 2. Update digital_use_contract_versions RLS policy to permit controlled dependency review propagation
DROP POLICY IF EXISTS digital_use_contract_versions_scope ON digital_use_contract_versions;

CREATE POLICY digital_use_contract_versions_scope ON digital_use_contract_versions
  USING (
    family_id = app_family_id()
    AND (
      NULLIF(current_setting('app.dependency_review_propagation', true), '') = 'on'
      OR (
        app_current_purpose() = 'FAMILY_MANAGEMENT'
        AND EXISTS (
          SELECT 1 FROM families f
           WHERE f.id = digital_use_contract_versions.family_id
             AND f.created_by_person_id = app_person_id()
        )
      )
      OR (
        app_current_purpose() = 'PHONE_USE_CONTRACT'
        AND child_party_person_id = app_person_id()
      )
    )
  )
  WITH CHECK (
    family_id = app_family_id()
    AND (
      NULLIF(current_setting('app.dependency_review_propagation', true), '') = 'on'
      OR (
        app_current_purpose() = 'FAMILY_MANAGEMENT'
        AND EXISTS (
          SELECT 1 FROM families f
           WHERE f.id = digital_use_contract_versions.family_id
             AND f.created_by_person_id = app_person_id()
        )
      )
      OR (
        app_current_purpose() = 'PHONE_USE_CONTRACT'
        AND child_party_person_id = app_person_id()
      )
    )
  );

-- 3. Update digital_use_contract_versions_guard() to guard review_state
CREATE OR REPLACE FUNCTION digital_use_contract_versions_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE material_changed boolean;
BEGIN
  IF NEW.family_id IS DISTINCT FROM OLD.family_id
     OR NEW.case_id IS DISTINCT FROM OLD.case_id
     OR NEW.version IS DISTINCT FROM OLD.version
     OR NEW.adult_party_person_id IS DISTINCT FROM OLD.adult_party_person_id
     OR NEW.child_party_person_id IS DISTINCT FROM OLD.child_party_person_id
     OR NEW.child_participation_id IS DISTINCT FROM OLD.child_participation_id
     OR NEW.source_template_version IS DISTINCT FROM OLD.source_template_version
     OR NEW.supersedes_id IS DISTINCT FROM OLD.supersedes_id
     OR NEW.created_by_person_id IS DISTINCT FROM OLD.created_by_person_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN RAISE EXCEPTION 'PHONE_USE_CONTRACT_IMMUTABLE_IDENTITY' USING ERRCODE = '23514';
  END IF;

  material_changed :=
       NEW.contract_purpose IS DISTINCT FROM OLD.contract_purpose
    OR NEW.phone_use_rules IS DISTINCT FROM OLD.phone_use_rules
    OR NEW.execution_period IS DISTINCT FROM OLD.execution_period
    OR NEW.parent_support_measures IS DISTINCT FROM OLD.parent_support_measures
    OR NEW.supervision_measures IS DISTINCT FROM OLD.supervision_measures
    OR NEW.incentives IS DISTINCT FROM OLD.incentives
    OR NEW.breach_responsibilities IS DISTINCT FROM OLD.breach_responsibilities
    OR NEW.dependency_refs IS DISTINCT FROM OLD.dependency_refs;

  IF NEW.review_state IS DISTINCT FROM OLD.review_state THEN
    IF NULLIF(current_setting('app.dependency_review_propagation', true), '') = 'on'
       AND OLD.review_state = 'CURRENT' AND NEW.review_state = 'NEEDS_REVIEW' THEN
      -- Controlled narrow propagation path permitted
    ELSE
      RAISE EXCEPTION 'PHONE_USE_CONTRACT_REVIEW_STATE_RUNTIME_UNOWNED' USING ERRCODE = '23514';
    END IF;
  END IF;

  IF app_current_purpose() = 'PHONE_USE_CONTRACT' THEN
    IF material_changed
       OR NEW.parent_confirmation IS DISTINCT FROM OLD.parent_confirmation
       OR NEW.supersedes_id IS DISTINCT FROM OLD.supersedes_id
       OR NEW.update_reason IS DISTINCT FROM OLD.update_reason
       OR NEW.update_trigger IS DISTINCT FROM OLD.update_trigger
    THEN
      RAISE EXCEPTION 'PHONE_USE_CONTRACT_CHILD_WRITE_SCOPE_INVALID' USING ERRCODE = '42501';
    END IF;
  ELSIF app_current_purpose() = 'FAMILY_MANAGEMENT' THEN
    IF NEW.child_confirmation IS DISTINCT FROM OLD.child_confirmation THEN
      RAISE EXCEPTION 'PHONE_USE_CONTRACT_CHILD_CONFIRMATION_PROVENANCE_INVALID' USING ERRCODE = '42501';
    END IF;
  ELSIF NULLIF(current_setting('app.dependency_review_propagation', true), '') = 'on' THEN
    IF material_changed
       OR NEW.status IS DISTINCT FROM OLD.status
       OR NEW.parent_confirmation IS DISTINCT FROM OLD.parent_confirmation
       OR NEW.child_confirmation IS DISTINCT FROM OLD.child_confirmation
       OR NEW.supersedes_id IS DISTINCT FROM OLD.supersedes_id
       OR NEW.update_reason IS DISTINCT FROM OLD.update_reason
       OR NEW.update_trigger IS DISTINCT FROM OLD.update_trigger
    THEN
      RAISE EXCEPTION 'PHONE_USE_CONTRACT_PROPAGATION_MUTATION_RESTRICTED' USING ERRCODE = '23514';
    END IF;
  ELSE
    RAISE EXCEPTION 'PHONE_USE_CONTRACT_PURPOSE_INVALID' USING ERRCODE = '42501';
  END IF;

  IF OLD.status IN ('ACTIVE','SUPERSEDED','PAUSED') AND material_changed THEN
    RAISE EXCEPTION 'PHONE_USE_CONTRACT_ACTIVE_TERMS_IMMUTABLE' USING ERRCODE = '23514';
  END IF;

  IF material_changed THEN
    IF OLD.status NOT IN ('DRAFT','PENDING_CONFIRMATION')
       OR NEW.status <> 'DRAFT'
       OR NEW.draft_revision <> OLD.draft_revision + 1
       OR NEW.parent_confirmation IS NOT NULL
       OR NEW.child_confirmation IS NOT NULL
    THEN RAISE EXCEPTION 'PHONE_USE_CONTRACT_DRAFT_REVISION_INVALID' USING ERRCODE = '23514';
    END IF;
  ELSIF NEW.draft_revision <> OLD.draft_revision THEN
    RAISE EXCEPTION 'PHONE_USE_CONTRACT_DRAFT_REVISION_INVALID' USING ERRCODE = '23514';
  END IF;

  IF NOT (
    (OLD.status = 'DRAFT' AND NEW.status IN ('DRAFT','PENDING_CONFIRMATION','ACTIVE'))
    OR (OLD.status = 'PENDING_CONFIRMATION' AND NEW.status IN ('DRAFT','PENDING_CONFIRMATION','ACTIVE'))
    OR (OLD.status = 'ACTIVE' AND NEW.status IN ('ACTIVE','SUPERSEDED'))
    OR (OLD.status = 'PAUSED' AND NEW.status IN ('PAUSED','ACTIVE','SUPERSEDED'))
    OR (OLD.status = 'SUPERSEDED' AND NEW.status = 'SUPERSEDED')
  ) THEN RAISE EXCEPTION 'PHONE_USE_CONTRACT_STATUS_TRANSITION_INVALID' USING ERRCODE = '23514';
  END IF;

  IF OLD.status IN ('ACTIVE','SUPERSEDED')
     AND (NEW.parent_confirmation IS DISTINCT FROM OLD.parent_confirmation
       OR NEW.child_confirmation IS DISTINCT FROM OLD.child_confirmation)
  THEN RAISE EXCEPTION 'PHONE_USE_CONTRACT_CONFIRMATION_IMMUTABLE' USING ERRCODE = '23514';
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END $$;

-- 3. Update goals_update_guard() to allow propagation only under app.dependency_review_propagation = 'on'
CREATE OR REPLACE FUNCTION goals_update_guard()
RETURNS trigger
LANGUAGE plpgsql
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
    IF NULLIF(current_setting('app.dependency_review_propagation', true), '') = 'on'
       AND OLD.review_state = 'CURRENT' AND NEW.review_state = 'NEEDS_REVIEW' THEN
      -- Controlled narrow propagation path permitted
    ELSE
      RAISE EXCEPTION 'GOAL_REVIEW_STATE_RUNTIME_UNOWNED' USING ERRCODE='23514';
    END IF;
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
       NEW.confirmation_state <> OLD.confirmation_state
       OR NEW.confirmed_by_person_id IS DISTINCT FROM OLD.confirmed_by_person_id
       OR NEW.confirmed_at IS DISTINCT FROM OLD.confirmed_at
     ) THEN
    RAISE EXCEPTION 'GOAL_CONFIRMATION_IMMUTABLE' USING ERRCODE='23514';
  END IF;

  IF NEW.confirmation_state IS DISTINCT FROM OLD.confirmation_state THEN
    IF NOT (
      OLD.confirmation_state = 'UNCONFIRMED'
      AND NEW.confirmation_state = 'CONFIRMED'
      AND NEW.confirmed_by_person_id IS NOT NULL
      AND NEW.confirmed_at IS NOT NULL
      AND OLD.lifecycle_status = 'ACTIVE'
      AND NEW.lifecycle_status = OLD.lifecycle_status
    ) THEN
      RAISE EXCEPTION 'GOAL_CONFIRMATION_TRANSITION_INVALID' USING ERRCODE='23514';
    END IF;

    SELECT phase INTO v_case_phase
      FROM cases
     WHERE id = NEW.case_id;

    IF v_case_phase IS DISTINCT FROM 'PLANNING' THEN
      RAISE EXCEPTION 'GOAL_CONFIRMATION_PHASE_INVALID' USING ERRCODE='23514';
    END IF;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$function$;

-- 4. Extend business_audit_events constraints for downstream review
DO $$
DECLARE current_def text; current_expr text;
BEGIN
  -- resource_type: add PHONE_USE_CONTRACT
  SELECT pg_get_constraintdef(oid, true) INTO current_def
    FROM pg_constraint
   WHERE conrelid='business_audit_events'::regclass
     AND conname='business_audit_events_resource_type_check';
  IF current_def IS NOT NULL AND current_def LIKE 'CHECK (%' THEN
    IF current_def NOT LIKE '%PHONE_USE_CONTRACT%' THEN
      current_expr := substring(current_def FROM 8 FOR char_length(current_def)-8);
      ALTER TABLE business_audit_events DROP CONSTRAINT business_audit_events_resource_type_check;
      EXECUTE format(
        'ALTER TABLE business_audit_events ADD CONSTRAINT business_audit_events_resource_type_check CHECK ((%s) OR resource_type=%L)',
        current_expr, 'PHONE_USE_CONTRACT'
      );
    END IF;
  END IF;

  -- event_type: add GOAL_REVIEW_STATE_CHANGED, PHONE_USE_CONTRACT_REVIEW_STATE_CHANGED
  SELECT pg_get_constraintdef(oid, true) INTO current_def
    FROM pg_constraint
   WHERE conrelid='business_audit_events'::regclass
     AND conname='business_audit_events_event_type_check';
  IF current_def IS NOT NULL AND current_def LIKE 'CHECK (%' THEN
    IF current_def NOT LIKE '%GOAL_REVIEW_STATE_CHANGED%' THEN
      current_expr := substring(current_def FROM 8 FOR char_length(current_def)-8);
      ALTER TABLE business_audit_events DROP CONSTRAINT business_audit_events_event_type_check;
      EXECUTE format(
        'ALTER TABLE business_audit_events ADD CONSTRAINT business_audit_events_event_type_check CHECK ((%s) OR event_type IN (%L,%L))',
        current_expr, 'GOAL_REVIEW_STATE_CHANGED', 'PHONE_USE_CONTRACT_REVIEW_STATE_CHANGED'
      );
    END IF;
  END IF;
END $$;

-- 5. Dedicated Narrow Privileged Propagation Function
CREATE OR REPLACE FUNCTION app.propagate_downstream_dependency_review(
  p_family_id uuid,
  p_case_id uuid,
  p_dependency jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_effective_family_id uuid := p_family_id;
  v_actor_account_id uuid;
  v_goals_count integer := 0;
  v_contracts_count integer := 0;
  v_goal record;
  v_contract record;
  v_evidence_obj jsonb;
BEGIN
  IF p_family_id IS NULL AND p_case_id IS NULL THEN
    RAISE EXCEPTION 'PROPAGATE_DEPENDENCY_REVIEW_SCOPE_REQUIRED' USING ERRCODE = '23514';
  END IF;
  IF p_dependency IS NULL OR jsonb_typeof(p_dependency) <> 'object' THEN
    RAISE EXCEPTION 'PROPAGATE_DEPENDENCY_REVIEW_PAYLOAD_INVALID' USING ERRCODE = '23514';
  END IF;

  IF v_effective_family_id IS NULL AND p_case_id IS NOT NULL THEN
    SELECT family_id INTO v_effective_family_id FROM cases WHERE id = p_case_id;
  END IF;
  IF v_effective_family_id IS NOT NULL THEN
    PERFORM set_config('app.family_id', v_effective_family_id::text, true);
  END IF;

  v_actor_account_id := app_account_id();
  IF v_actor_account_id IS NULL AND v_effective_family_id IS NOT NULL THEN
    SELECT COALESCE(p.account_id, p.created_by_account_id)
      INTO v_actor_account_id
      FROM families f
      JOIN persons p ON f.created_by_person_id = p.id
     WHERE f.id = v_effective_family_id;
  END IF;

  -- Activate transaction-scoped propagation permission
  PERFORM set_config('app.dependency_review_propagation', 'on', true);

  IF p_dependency->>'type' = 'EVIDENCE' THEN
    v_evidence_obj := p_dependency->'evidence';
  ELSE
    v_evidence_obj := p_dependency;
  END IF;

  -- 1. Scan and mark affected goals
  FOR v_goal IN
    SELECT g.id, g.goal_id, g.family_id, g.case_id, g.version
      FROM goals g
     WHERE (p_family_id IS NULL OR g.family_id = p_family_id)
       AND (p_case_id IS NULL OR g.case_id = p_case_id)
       AND g.lifecycle_status = 'ACTIVE'
       AND g.review_state = 'CURRENT'
       AND (
         g.dependency_refs @> jsonb_build_array(p_dependency)
         OR (v_evidence_obj IS NOT NULL AND g.baseline_refs @> jsonb_build_array(v_evidence_obj))
         OR (v_evidence_obj IS NOT NULL AND EXISTS (
           SELECT 1
             FROM jsonb_array_elements(g.participant_responsibilities) pr
            WHERE pr->'evidenceRefs' @> jsonb_build_array(v_evidence_obj)
         ))
       )
     FOR UPDATE
  LOOP
    UPDATE goals
       SET review_state = 'NEEDS_REVIEW',
           updated_at = now()
     WHERE id = v_goal.id;

    v_goals_count := v_goals_count + 1;

    INSERT INTO business_audit_events (
      family_id, actor_account_id, event_type, resource_type, resource_id, metadata
    ) VALUES (
      v_goal.family_id, v_actor_account_id, 'GOAL_REVIEW_STATE_CHANGED', 'GOAL', v_goal.goal_id,
      jsonb_build_object(
        'goalId', v_goal.goal_id,
        'goalVersion', v_goal.version,
        'caseId', v_goal.case_id,
        'fromReviewState', 'CURRENT',
        'toReviewState', 'NEEDS_REVIEW',
        'reason', 'DEPENDENCY_INVALIDATED',
        'dependency', p_dependency
      )
    );
  END LOOP;

  -- 2. Scan and mark affected phone contracts
  FOR v_contract IN
    SELECT c.id, c.family_id, c.case_id, c.version, c.draft_revision
      FROM digital_use_contract_versions c
     WHERE (p_family_id IS NULL OR c.family_id = p_family_id)
       AND (p_case_id IS NULL OR c.case_id = p_case_id)
       AND c.status IN ('DRAFT', 'PENDING_CONFIRMATION', 'ACTIVE')
       AND c.review_state = 'CURRENT'
       AND (
         c.dependency_refs @> jsonb_build_array(p_dependency)
         OR (v_evidence_obj IS NOT NULL AND c.dependency_refs @> jsonb_build_array(v_evidence_obj))
         OR (p_dependency->>'type' = 'CONSENT' AND EXISTS (
           SELECT 1
             FROM jsonb_array_elements(c.dependency_refs) d
            WHERE d->>'type' = 'CONSENT'
              AND (d->>'id')::uuid = (p_dependency->>'id')::uuid
         ))
       )
     FOR UPDATE
  LOOP
    UPDATE digital_use_contract_versions
       SET review_state = 'NEEDS_REVIEW',
           updated_at = now()
     WHERE id = v_contract.id;

    v_contracts_count := v_contracts_count + 1;

    INSERT INTO business_audit_events (
      family_id, actor_account_id, event_type, resource_type, resource_id, metadata
    ) VALUES (
      v_contract.family_id, v_actor_account_id, 'PHONE_USE_CONTRACT_REVIEW_STATE_CHANGED', 'PHONE_USE_CONTRACT', v_contract.id,
      jsonb_build_object(
        'contractVersionId', v_contract.id,
        'version', v_contract.version,
        'draftRevision', v_contract.draft_revision,
        'caseId', v_contract.case_id,
        'fromReviewState', 'CURRENT',
        'toReviewState', 'NEEDS_REVIEW',
        'reason', 'DEPENDENCY_INVALIDATED',
        'dependency', p_dependency
      )
    );
  END LOOP;

  RETURN jsonb_build_object(
    'goalsAffected', v_goals_count,
    'contractsAffected', v_contracts_count
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION app.propagate_downstream_dependency_review(uuid, uuid, jsonb) TO xiaoshuyin_app;
