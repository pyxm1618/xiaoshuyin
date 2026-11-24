-- Migration 035: Workline C post-merge nested evidence propagation.
-- Forward-only replacement of the 033 propagation function. Historical SQL unchanged.
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

  IF v_caller_family_id IS NULL OR v_actor_account_id IS NULL THEN
    RAISE EXCEPTION 'PROPAGATE_DEPENDENCY_REVIEW_UNAUTHENTICATED' USING ERRCODE = '42501';
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
    IF v_version_str IS NULL OR v_version_str !~ '^[1-9][0-9]*$' THEN
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

  -- 3. Privilege Elevation ONLY AFTER all checks succeed
  PERFORM set_config('app.dependency_review_propagation', 'on', true);

  -- 4. Scan and mark affected goals
  FOR v_goal IN
    SELECT g.id, g.goal_id, g.family_id, g.case_id, g.version
      FROM goals g
     WHERE g.family_id = v_caller_family_id
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

  -- 5. Scan and mark affected phone contracts
  FOR v_contract IN
    SELECT c.id, c.family_id, c.case_id, c.version, c.draft_revision
      FROM digital_use_contract_versions c
     WHERE c.family_id = v_caller_family_id
       AND (p_case_id IS NULL OR c.case_id = p_case_id)
       AND c.status IN ('DRAFT', 'PENDING_CONFIRMATION', 'ACTIVE')
       AND c.review_state = 'CURRENT'
       AND (
         c.dependency_refs @> jsonb_build_array(p_dependency)
         OR (v_evidence_obj IS NOT NULL AND c.dependency_refs @> jsonb_build_array(v_evidence_obj))
         -- Only the frozen A200401 RECORD_MARKER shape may carry nested evidence.
         -- Malformed containers and malformed member refs are never wildcards.
         OR (
           v_evidence_obj->>'type' IN ('ASSERTION', 'OBSERVATION', 'DIALOGUE_MESSAGE')
           AND EXISTS (
             SELECT 1
               FROM jsonb_array_elements(c.dependency_refs) marker
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
                      OR COALESCE(ref->>'id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}
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

REVOKE ALL ON FUNCTION app.propagate_downstream_dependency_review(uuid, uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.propagate_downstream_dependency_review(uuid, uuid, jsonb) TO xiaoshuyin_app;

                )
           )
         )
         OR (v_dep_type = 'CONSENT' AND EXISTS (
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

REVOKE ALL ON FUNCTION app.propagate_downstream_dependency_review(uuid, uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.propagate_downstream_dependency_review(uuid, uuid, jsonb) TO xiaoshuyin_app;
