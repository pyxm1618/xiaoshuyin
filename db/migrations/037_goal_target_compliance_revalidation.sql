-- Finding #1 forward-only remediation: extend the Goal confirmation gate to
-- accept the PACKAGE dependency that Digital Use Problem Formulation authority
-- already produces (PACKAGE:DIGITAL_USE:v1).
--
-- Forward-only supersession: this migration does not edit
-- 026_common_core_goal_confirm_goal_runtime.sql. It redefines exactly one
-- function with CREATE OR REPLACE, preserving every existing gate and adding
-- only the PACKAGE dependency validation and exact coverage semantics.
--
-- Scope (Frozen): EVIDENCE and CONSENT behaviour is unchanged; unsupported
-- PACKAGE keys, non-matching versions, and a missing active Case package
-- binding fail closed. No new dependency type is authorized here.

CREATE OR REPLACE FUNCTION app.confirm_goal_transition(
  p_case_id uuid,
  p_expected_case_version integer,
  p_goal_id uuid,
  p_goal_version integer,
  p_actor_person_id uuid
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
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
  v_package_binding text;
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

  -- Finding #1 (Digital Use core): the only authorized PACKAGE dependency is
  -- the Case's active Scene package binding. Resolve it from the single A1001
  -- package anchor, which is also the A2010 gate's binding source below.
  SELECT a1001.scene_package_version
    INTO v_package_binding
    FROM scene_node_states a1001
   WHERE a1001.case_id=p_case_id
     AND a1001.node_code='A1001';

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
       OR COALESCE(v_dependency->>'type','') NOT IN ('EVIDENCE','CONSENT','PACKAGE')
    THEN
      RAISE EXCEPTION 'GOAL_CONFIRM_TRANSITION_DEPENDENCY_UNSUPPORTED' USING ERRCODE='23514';
    END IF;

    -- PACKAGE is a bounded package-binding dependency, not Evidence. It is
    -- accepted only for the canonical Digital Use key and only at the Case's
    -- active binding version; unsupported keys, versions, or a missing active
    -- binding fail closed.
    IF v_dependency->>'type'='PACKAGE' THEN
      IF jsonb_typeof(v_dependency->'key')<>'string'
         OR btrim(COALESCE(v_dependency->>'key',''))=''
         OR jsonb_typeof(v_dependency->'version')<>'string'
         OR btrim(COALESCE(v_dependency->>'version',''))=''
         OR v_dependency->>'key'<>'DIGITAL_USE'
         OR v_package_binding IS NULL
         OR v_dependency->>'version' IS DISTINCT FROM v_package_binding
      THEN
        RAISE EXCEPTION 'GOAL_CONFIRM_TRANSITION_DEPENDENCY_UNSUPPORTED' USING ERRCODE='23514';
      END IF;
      CONTINUE;
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
       OR COALESCE(v_dependency->>'type','') NOT IN ('EVIDENCE','CONSENT','PACKAGE')
    THEN
      RAISE EXCEPTION 'GOAL_CONFIRM_TRANSITION_FORMULATION_DEPENDENCY_UNSUPPORTED' USING ERRCODE='23514';
    END IF;

    -- PACKAGE coverage is exact on key and version, matching the application
    -- canonicalDependencyKey() projection PACKAGE:<key>:<version>.
    IF v_dependency->>'type'='PACKAGE' THEN
      IF jsonb_typeof(v_dependency->'key')<>'string'
         OR btrim(COALESCE(v_dependency->>'key',''))=''
         OR jsonb_typeof(v_dependency->'version')<>'string'
         OR btrim(COALESCE(v_dependency->>'version',''))=''
      THEN
        RAISE EXCEPTION 'GOAL_CONFIRM_TRANSITION_FORMULATION_DEPENDENCY_UNSUPPORTED' USING ERRCODE='23514';
      END IF;

      IF NOT EXISTS (
        SELECT 1
          FROM jsonb_array_elements(v_goal_dependencies) goal_dependency(value)
         WHERE goal_dependency.value->>'type'='PACKAGE'
           AND goal_dependency.value->>'key'=v_dependency->>'key'
           AND goal_dependency.value->>'version'=v_dependency->>'version'
      ) THEN
        RAISE EXCEPTION 'GOAL_CONFIRM_TRANSITION_DEPENDENCY_COVERAGE_INVALID' USING ERRCODE='23514';
      END IF;
      CONTINUE;
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

  -- Formal confirmGoal() re-runs the current CASE-processing Compliance gate
  -- for the actor, Case creator, every ACTIVE participant, and the bound Digital
  -- Use target even when that target is not an ACTIVE Case participant.
  -- Frozen Authority keeps guardian-consent v1 administration-only, so UNDER_14
  -- cannot be promoted into downstream CASE processing by this privileged seam.
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
        UNION ALL
        SELECT dac.target_person_id
          FROM digital_use_assessment_context dac
         WHERE dac.case_id=p_case_id
           AND dac.family_id=v_family_id
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
      RAISE EXCEPTION 'GOAL_CONFIRM_TRANSITION_COMPLIANCE_INVALID' USING ERRCODE='23514';
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
