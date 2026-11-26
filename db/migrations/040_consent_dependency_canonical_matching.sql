-- Forward-only correction: UUID identity and exact optional version semantics.
CREATE FUNCTION app.consent_dependency_matches(stored jsonb, propagated jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE STRICT
SET search_path = pg_catalog, public, app
AS $$
  SELECT stored->>'type' = 'CONSENT'
    AND (stored->>'id')::uuid = (propagated->>'id')::uuid
    AND CASE WHEN propagated ? 'version'
      THEN stored->'version' = propagated->'version'
      ELSE NOT (stored ? 'version') END
$$;
REVOKE ALL ON FUNCTION app.consent_dependency_matches(jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.consent_dependency_matches(jsonb, jsonb) TO xiaoshuyin_app;

CREATE OR REPLACE FUNCTION app.propagate_downstream_dependency_review(
  p_family_id uuid,
  p_case_id uuid,
  p_dependency jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
  v_caller_family_id uuid;
  v_actor_account_id uuid;
  v_actor_person_id uuid;
  v_goals_count integer := 0;
  v_contracts_count integer := 0;
  v_goal record;
  v_contract record;
  v_dep_type text;
  v_dep_id text;
  v_sub_type text;
  v_sub_id text;
  v_version_str text;
  v_evidence_obj jsonb;
BEGIN
  -- 1. Scope / Authentication Boundary Checks (BLOCKER C-01)
  -- Must be authenticated and executed within an already-bound family session
  v_caller_family_id := app_family_id();
  v_actor_account_id := app_account_id();
  v_actor_person_id := app_person_id();

  IF v_caller_family_id IS NULL OR v_actor_account_id IS NULL OR v_actor_person_id IS NULL THEN
    RAISE EXCEPTION 'PROPAGATE_DEPENDENCY_REVIEW_UNAUTHENTICATED' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM persons p
     WHERE p.id = v_actor_person_id
       AND p.account_id = v_actor_account_id
  ) OR NOT EXISTS (
    SELECT 1
      FROM family_members fm
     WHERE fm.family_id = v_caller_family_id
       AND fm.person_id = v_actor_person_id
  ) THEN
    RAISE EXCEPTION 'PROPAGATE_DEPENDENCY_REVIEW_IDENTITY_INVALID' USING ERRCODE = '42501';
  END IF;

  -- Caller cannot supply a foreign family_id to escape or override session scope
  IF p_family_id IS NOT NULL AND p_family_id <> v_caller_family_id THEN
    RAISE EXCEPTION 'PROPAGATE_DEPENDENCY_REVIEW_FAMILY_MISMATCH' USING ERRCODE = '42501';
  END IF;

  -- If p_case_id is supplied, verify that it belongs to the authenticated family
  IF p_case_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM cases WHERE id = p_case_id AND family_id = v_caller_family_id
    ) THEN
      RAISE EXCEPTION 'PROPAGATE_DEPENDENCY_REVIEW_CASE_SCOPE_INVALID' USING ERRCODE = '42501';
    END IF;
  END IF;

  -- 2. Strict Dependency Shape Validation (BLOCKER C-02)
  -- Reject null, non-objects, empty objects '{}', or unknown/malformed shapes fail closed
  IF p_dependency IS NULL OR jsonb_typeof(p_dependency) <> 'object' THEN
    RAISE EXCEPTION 'PROPAGATE_DEPENDENCY_REVIEW_PAYLOAD_INVALID' USING ERRCODE = '23514';
  END IF;

  v_dep_type := p_dependency->>'type';
  IF v_dep_type IS NULL OR v_dep_type NOT IN (
    'ASSERTION', 'OBSERVATION', 'DIALOGUE_MESSAGE', 'CONSENT', 'SCENE_ARTIFACT', 'TARGET_ITEM', 'EVIDENCE'
  ) THEN
    RAISE EXCEPTION 'PROPAGATE_DEPENDENCY_REVIEW_PAYLOAD_INVALID' USING ERRCODE = '23514';
  END IF;

  IF v_dep_type = 'EVIDENCE' THEN
    IF p_dependency->'evidence' IS NULL OR jsonb_typeof(p_dependency->'evidence') <> 'object' THEN
      RAISE EXCEPTION 'PROPAGATE_DEPENDENCY_REVIEW_PAYLOAD_INVALID' USING ERRCODE = '23514';
    END IF;
    v_sub_type := p_dependency->'evidence'->>'type';
    v_sub_id := p_dependency->'evidence'->>'id';
    IF v_sub_type IS NULL OR v_sub_type NOT IN ('ASSERTION', 'OBSERVATION', 'DIALOGUE_MESSAGE') THEN
      RAISE EXCEPTION 'PROPAGATE_DEPENDENCY_REVIEW_PAYLOAD_INVALID' USING ERRCODE = '23514';
    END IF;
    IF v_sub_id IS NULL OR v_sub_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
      RAISE EXCEPTION 'PROPAGATE_DEPENDENCY_REVIEW_PAYLOAD_INVALID' USING ERRCODE = '23514';
    END IF;
    v_evidence_obj := p_dependency->'evidence';
  ELSIF v_dep_type = 'CONSENT' THEN
    v_dep_id := p_dependency->>'id';
    v_version_str := p_dependency->>'version';
    IF v_dep_id IS NULL OR v_dep_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
      RAISE EXCEPTION 'PROPAGATE_DEPENDENCY_REVIEW_PAYLOAD_INVALID' USING ERRCODE = '23514';
    END IF;
    IF v_version_str IS NOT NULL AND v_version_str !~ '^[1-9][0-9]*$' THEN
      RAISE EXCEPTION 'PROPAGATE_DEPENDENCY_REVIEW_PAYLOAD_INVALID' USING ERRCODE = '23514';
    END IF;
    v_evidence_obj := NULL;
  ELSE
    -- Directly typed reference: ASSERTION, OBSERVATION, DIALOGUE_MESSAGE, SCENE_ARTIFACT, TARGET_ITEM
    v_dep_id := p_dependency->>'id';
    IF v_dep_id IS NULL OR v_dep_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
      RAISE EXCEPTION 'PROPAGATE_DEPENDENCY_REVIEW_PAYLOAD_INVALID' USING ERRCODE = '23514';
    END IF;
    v_evidence_obj := p_dependency;
  END IF;

  -- 3. Controlled transaction-local authority marker.
  -- Caller-settable GUCs are not authority.
  INSERT INTO app.dependency_review_propagation_authority(backend_pid, transaction_id)
  VALUES (pg_backend_pid(), pg_current_xact_id());

  -- 4. Scan and mark affected goals
  FOR v_goal IN
    SELECT g.id, g.goal_id, g.family_id, g.case_id, g.version
      FROM goals g
     WHERE g.family_id = v_caller_family_id
       AND (p_case_id IS NULL OR g.case_id = p_case_id)
       AND g.lifecycle_status = 'ACTIVE'
       AND g.review_state = 'CURRENT'
       AND (
         (v_dep_type <> 'CONSENT' AND g.dependency_refs @> jsonb_build_array(p_dependency))
         OR (
           v_dep_type = 'CONSENT'
           AND EXISTS (
             SELECT 1
               FROM jsonb_array_elements(g.dependency_refs) d
              WHERE d->>'type' = 'CONSENT'
                AND app.consent_dependency_matches(d, p_dependency)
           )
         )
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

  -- 5. Scan and mark affected phone contracts
  FOR v_contract IN
    SELECT c.id, c.family_id, c.case_id, c.version, c.draft_revision
      FROM digital_use_contract_versions c
     WHERE c.family_id = v_caller_family_id
       AND (p_case_id IS NULL OR c.case_id = p_case_id)
       AND c.status IN ('DRAFT', 'PENDING_CONFIRMATION', 'ACTIVE')
       AND c.review_state = 'CURRENT'
       AND (
         (v_dep_type <> 'CONSENT' AND c.dependency_refs @> jsonb_build_array(p_dependency))
         OR (v_evidence_obj IS NOT NULL AND c.dependency_refs @> jsonb_build_array(v_evidence_obj))
         -- Only frozen A200401 RECORD_MARKERs with well-formed evidence refs.
         OR (
           v_evidence_obj->>'type' IN ('ASSERTION', 'OBSERVATION', 'DIALOGUE_MESSAGE')
           AND EXISTS (
             SELECT 1
               FROM jsonb_array_elements(c.dependency_refs) AS markers(marker)
              WHERE marker->>'type' = 'RECORD_MARKER'
                AND marker->>'markerCode' = 'A200401'
                AND jsonb_typeof(marker->'evidenceRefs') = 'array'
                AND marker->'evidenceRefs' @> jsonb_build_array(
                  jsonb_build_object('type', v_evidence_obj->>'type', 'id', v_evidence_obj->>'id')
                )
                AND NOT EXISTS (
                  SELECT 1
                    FROM jsonb_array_elements(
                      CASE WHEN jsonb_typeof(marker->'evidenceRefs') = 'array'
                           THEN marker->'evidenceRefs' ELSE '[]'::jsonb END
                    ) AS refs(ref)
                   WHERE jsonb_typeof(ref) IS DISTINCT FROM 'object'
                      OR COALESCE(ref->>'type', '') NOT IN ('ASSERTION', 'OBSERVATION', 'DIALOGUE_MESSAGE')
                      OR jsonb_typeof(ref->'id') IS DISTINCT FROM 'string'
                      OR COALESCE(ref->>'id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
                )
           )
         )
         OR (v_dep_type = 'CONSENT' AND EXISTS (
           SELECT 1
             FROM jsonb_array_elements(c.dependency_refs) d
            WHERE d->>'type' = 'CONSENT'
              AND app.consent_dependency_matches(d, p_dependency)
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

  DELETE FROM app.dependency_review_propagation_authority
   WHERE backend_pid = pg_backend_pid()
     AND transaction_id = pg_current_xact_id();

  RETURN jsonb_build_object(
    'goalsAffected', v_goals_count,
    'contractsAffected', v_contracts_count
  );
END;
$function$;
REVOKE ALL ON FUNCTION app.propagate_downstream_dependency_review(uuid, uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.propagate_downstream_dependency_review(uuid, uuid, jsonb) TO xiaoshuyin_app;


-- A2: independent review validity recovery on the existing lifecycle.
CREATE OR REPLACE FUNCTION digital_use_contract_versions_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE material_changed boolean;
BEGIN
  IF NEW.family_id IS DISTINCT FROM OLD.family_id
     OR NEW.case_id IS DISTINCT FROM OLD.case_id
     OR NEW.version IS DISTINCT FROM OLD.version
     OR NEW.adult_party_person_id IS DISTINCT FROM OLD.adult_party_person_id
     OR NEW.child_party_person_id IS DISTINCT FROM OLD.child_party_person_id
     OR NEW.source_template_version IS DISTINCT FROM OLD.source_template_version
     OR NEW.supersedes_id IS DISTINCT FROM OLD.supersedes_id
     OR NEW.created_by_person_id IS DISTINCT FROM OLD.created_by_person_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN RAISE EXCEPTION 'PHONE_USE_CONTRACT_IMMUTABLE_IDENTITY' USING ERRCODE = '23514';
  END IF;

  IF NEW.child_participation_id IS DISTINCT FROM OLD.child_participation_id THEN
    IF NOT ((
      app_current_purpose() = 'PHONE_USE_CONTRACT'
      AND OLD.child_participation_id IS NULL
      AND NEW.child_participation_id IS NOT NULL
      AND OLD.child_confirmation IS NULL
      AND NEW.child_confirmation IS NOT NULL
      AND NEW.child_confirmation ? 'kind'
      AND NEW.child_confirmation ? 'personId'
      AND NEW.child_confirmation ? 'participationId'
      AND NEW.child_confirmation ? 'authorizationAction'
      AND NEW.child_confirmation ->> 'kind' = 'CHILD'
      AND NEW.child_confirmation ->> 'personId' = NEW.child_party_person_id::text
      AND NEW.child_confirmation ->> 'participationId' = NEW.child_participation_id::text
      AND NEW.child_confirmation ->> 'authorizationAction' = 'PHONE_USE_CONTRACT_CONFIRM_SELF'
      AND EXISTS (
        SELECT 1
          FROM case_participants cp
         WHERE cp.id = NEW.child_participation_id
           AND cp.family_id = NEW.family_id
           AND cp.case_id = NEW.case_id
           AND cp.person_id = NEW.child_party_person_id
           AND cp.state = 'ACTIVE'
      )
    ) IS TRUE) THEN
      RAISE EXCEPTION 'PHONE_USE_CONTRACT_IMMUTABLE_IDENTITY' USING ERRCODE = '23514';
    END IF;
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
    IF app.dependency_review_propagation_authorized()
       AND OLD.review_state = 'CURRENT' AND NEW.review_state = 'NEEDS_REVIEW' THEN
      -- Controlled narrow propagation path permitted
    ELSIF NULLIF(current_setting('app.contract_active_review_recovery', true), '') = 'on'
       AND OLD.status = 'ACTIVE' AND NEW.status = 'ACTIVE'
       AND OLD.review_state = 'NEEDS_REVIEW' AND NEW.review_state = 'CURRENT'
       AND NOT material_changed
       AND app_current_purpose() = 'FAMILY_MANAGEMENT'
       AND OLD.adult_party_person_id = app_person_id()
       AND EXISTS (SELECT 1 FROM persons p WHERE p.id=app_person_id() AND p.account_id=app_account_id())
       AND EXISTS (SELECT 1 FROM families f WHERE f.id=OLD.family_id AND f.id=app_family_id()
                     AND f.created_by_person_id=app_person_id())
       AND EXISTS (SELECT 1 FROM family_members fm WHERE fm.family_id=OLD.family_id AND fm.person_id=app_person_id()) THEN
      -- Authorized no-material-change review preserves terms, version and confirmations.
    ELSIF NULLIF(current_setting('app.contract_draft_review_recovery', true), '') = 'on'
       AND OLD.status IN ('DRAFT', 'PENDING_CONFIRMATION')
       AND NEW.status = 'DRAFT'
       AND OLD.review_state = 'NEEDS_REVIEW' AND NEW.review_state = 'CURRENT'
       AND NEW.dependency_refs IS DISTINCT FROM OLD.dependency_refs
       AND app_current_purpose() = 'FAMILY_MANAGEMENT' THEN
      -- Controlled draft correction recovery permitted after dependencies revalidated
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
  ELSIF app.dependency_review_propagation_authorized() THEN
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
