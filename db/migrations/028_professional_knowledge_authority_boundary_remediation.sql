-- ============================================================================
-- Slice 17 FINAL TWO-HIGH authority boundary remediation
-- Migration: 028_professional_knowledge_authority_boundary_remediation.sql
-- Forward-only: 025/026/027 remain immutable.
-- ============================================================================

BEGIN;

-- Ordinary runtime can keep candidate/edit/invalidation/retire semantics, but
-- cannot write formal review/approval evidence or release timestamps.
REVOKE INSERT ON professional_knowledge_review_evidence FROM xiaoshuyin_app;
REVOKE INSERT ON professional_knowledge_approval_evidence FROM xiaoshuyin_app;

REVOKE UPDATE ON professional_knowledge_versions FROM xiaoshuyin_app;
GRANT UPDATE (
  content,
  content_hash,
  source_set_hash,
  scope_metadata,
  locale,
  lifecycle_status,
  review_state,
  validity_state,
  revision
) ON professional_knowledge_versions TO xiaoshuyin_app;

CREATE FUNCTION app.guard_professional_knowledge_runtime_authority_elevation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $function$
BEGIN
  IF current_user = 'xiaoshuyin_app' THEN
    IF OLD.lifecycle_status IS DISTINCT FROM 'PUBLISHED'
       AND NEW.lifecycle_status = 'PUBLISHED' THEN
      RAISE EXCEPTION 'PROFESSIONAL_KNOWLEDGE_AUTHORITY_EXECUTOR_REQUIRED'
        USING ERRCODE = '42501';
    END IF;
    IF OLD.review_state IS DISTINCT FROM 'CURRENT'
       AND NEW.review_state = 'CURRENT' THEN
      RAISE EXCEPTION 'PROFESSIONAL_KNOWLEDGE_REVIEW_AUTHORITY_REQUIRED'
        USING ERRCODE = '42501';
    END IF;
    IF OLD.validity_state IS DISTINCT FROM 'VALID'
       AND NEW.validity_state = 'VALID' THEN
      RAISE EXCEPTION 'PROFESSIONAL_KNOWLEDGE_REVIEW_AUTHORITY_REQUIRED'
        USING ERRCODE = '42501';
    END IF;
    IF (
      NEW.content IS DISTINCT FROM OLD.content
      OR NEW.content_hash IS DISTINCT FROM OLD.content_hash
      OR NEW.source_set_hash IS DISTINCT FROM OLD.source_set_hash
      OR NEW.scope_metadata IS DISTINCT FROM OLD.scope_metadata
      OR NEW.locale IS DISTINCT FROM OLD.locale
    ) AND (
      NEW.review_state IS DISTINCT FROM 'PENDING'
      OR NEW.validity_state IS DISTINCT FROM 'UNKNOWN'
    ) THEN
      RAISE EXCEPTION 'PROFESSIONAL_KNOWLEDGE_SEMANTIC_EDIT_MUST_RESET_REVIEW'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END
$function$;

REVOKE ALL ON FUNCTION app.guard_professional_knowledge_runtime_authority_elevation()
  FROM PUBLIC;

CREATE TRIGGER zz_professional_knowledge_runtime_authority_elevation_guard
  BEFORE UPDATE ON professional_knowledge_versions
  FOR EACH ROW
  EXECUTE FUNCTION app.guard_professional_knowledge_runtime_authority_elevation();

-- xiaoshuyin_migrator is already a distinct NOBYPASSRLS identity. The
-- Professional Review helpers in 025/026 intentionally revoked PUBLIC execute,
-- so the controlled executor receives only the exact context/Staff seams used
-- by formal review/release. Ordinary xiaoshuyin_app grants are unchanged.
GRANT EXECUTE ON FUNCTION app.set_account_context(uuid, text)
  TO xiaoshuyin_migrator;
GRANT EXECUTE ON FUNCTION app.set_identity_context(uuid, text)
  TO xiaoshuyin_migrator;
GRANT EXECUTE ON FUNCTION app.validate_professional_review_assignment(uuid, uuid, uuid)
  TO xiaoshuyin_migrator;
GRANT EXECUTE ON FUNCTION app.professional_review_authorized()
  TO xiaoshuyin_migrator;
GRANT EXECUTE ON FUNCTION app.validate_professional_review_assignment_target(uuid, uuid, uuid)
  TO xiaoshuyin_migrator;
GRANT EXECUTE ON FUNCTION app.set_professional_review_context(uuid)
  TO xiaoshuyin_migrator;
GRANT EXECUTE ON FUNCTION app.lock_professional_review_assignment_target(uuid, uuid, uuid)
  TO xiaoshuyin_migrator;

-- These policies expose only the review/release transaction surface needed by
-- the formal service while FORCE RLS remains enabled.
CREATE POLICY staff_assignments_professional_knowledge_authority_executor_read
  ON staff_assignments
  FOR SELECT TO xiaoshuyin_migrator
  USING (
    app_current_purpose() = 'PROFESSIONAL_KNOWLEDGE_ADMIN'
    AND account_id = app_account_id()
    AND person_id = app_person_id()
  );

CREATE POLICY professional_knowledge_items_authority_executor_select
  ON professional_knowledge_items
  FOR SELECT TO xiaoshuyin_migrator
  USING (app.professional_review_authorized());

CREATE POLICY professional_knowledge_versions_authority_executor_select
  ON professional_knowledge_versions
  FOR SELECT TO xiaoshuyin_migrator
  USING (app.professional_review_authorized());

CREATE POLICY professional_knowledge_versions_authority_executor_update
  ON professional_knowledge_versions
  FOR UPDATE TO xiaoshuyin_migrator
  USING (app.professional_review_authorized())
  WITH CHECK (
    session_user = 'xiaoshuyin_app'
    AND app.professional_review_authorized()
  );

CREATE POLICY professional_knowledge_sources_authority_executor_select
  ON professional_knowledge_sources
  FOR SELECT TO xiaoshuyin_migrator
  USING (app.professional_review_authorized());

CREATE POLICY professional_knowledge_review_evidence_authority_executor_insert
  ON professional_knowledge_review_evidence
  FOR INSERT TO xiaoshuyin_migrator
  WITH CHECK (
    session_user = 'xiaoshuyin_app'
    AND app.professional_review_authorized()
  );

CREATE POLICY professional_knowledge_approval_evidence_authority_executor_insert
  ON professional_knowledge_approval_evidence
  FOR INSERT TO xiaoshuyin_migrator
  WITH CHECK (
    session_user = 'xiaoshuyin_app'
    AND app.professional_review_authorized()
  );

-- Replay/mismatch is intentionally decidable before current Staff context.
CREATE POLICY idempotency_professional_knowledge_authority_executor_select
  ON idempotency_keys
  FOR SELECT TO xiaoshuyin_migrator
  USING (
    app_current_purpose() = 'PROFESSIONAL_KNOWLEDGE_ADMIN'
    AND actor_account_id = app_account_id()
    AND command_type IN (
      'PROFESSIONAL_KNOWLEDGE_REVIEW_RECORD',
      'PROFESSIONAL_KNOWLEDGE_RELEASE'
    )
  );

CREATE POLICY idempotency_professional_knowledge_authority_executor_insert
  ON idempotency_keys
  FOR INSERT TO xiaoshuyin_migrator
  WITH CHECK (
    app_current_purpose() = 'PROFESSIONAL_KNOWLEDGE_ADMIN'
    AND actor_account_id = app_account_id()
    AND command_type IN (
      'PROFESSIONAL_KNOWLEDGE_REVIEW_RECORD',
      'PROFESSIONAL_KNOWLEDGE_RELEASE'
    )
  );

CREATE POLICY audit_professional_knowledge_authority_executor_insert
  ON business_audit_events
  FOR INSERT TO xiaoshuyin_migrator
  WITH CHECK (
    family_id IS NULL
    AND actor_account_id = app_account_id()
    AND resource_type = 'PROFESSIONAL_KNOWLEDGE'
    AND event_type IN (
      'PROFESSIONAL_KNOWLEDGE_REVIEW_RECORDED',
      'PROFESSIONAL_KNOWLEDGE_RELEASED',
      'PROFESSIONAL_KNOWLEDGE_SUPERSEDED'
    )
    AND app.professional_review_authorized()
  );

CREATE POLICY intervention_definitions_professional_knowledge_authority_executor_read
  ON intervention_definitions
  FOR SELECT TO xiaoshuyin_migrator
  USING (
    app_current_purpose() = 'PROFESSIONAL_KNOWLEDGE_ADMIN'
    AND app.professional_review_authorized()
  );

-- Existing self-review evidence is ambiguous authority and must be reconciled
-- rather than silently blessed during upgrade. FORCE RLS is retained: two
-- migration-only SELECT policies are created solely for this preflight and
-- dropped immediately afterwards.
CREATE POLICY professional_knowledge_versions_migration_self_review_preflight
  ON professional_knowledge_versions
  FOR SELECT TO xiaoshuyin_migrator
  USING (true);

CREATE POLICY professional_knowledge_review_evidence_migration_self_review_preflight
  ON professional_knowledge_review_evidence
  FOR SELECT TO xiaoshuyin_migrator
  USING (true);

DO $preflight$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM professional_knowledge_review_evidence evidence
      JOIN professional_knowledge_versions version
        ON version.id = evidence.knowledge_version_id
     WHERE evidence.reviewer_account_id = version.created_by_account_id
        OR evidence.reviewer_person_id = version.created_by_person_id
  ) THEN
    RAISE EXCEPTION
      'PROFESSIONAL_KNOWLEDGE_EXISTING_SELF_REVIEW_REQUIRES_RECONCILIATION';
  END IF;
END
$preflight$;

DROP POLICY professional_knowledge_review_evidence_migration_self_review_preflight
  ON professional_knowledge_review_evidence;
DROP POLICY professional_knowledge_versions_migration_self_review_preflight
  ON professional_knowledge_versions;

CREATE FUNCTION app.guard_professional_knowledge_self_review()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_creator_account_id uuid;
  v_creator_person_id uuid;
BEGIN
  SELECT created_by_account_id, created_by_person_id
    INTO v_creator_account_id, v_creator_person_id
    FROM professional_knowledge_versions
   WHERE id = NEW.knowledge_version_id;

  IF NEW.reviewer_account_id = v_creator_account_id
     OR NEW.reviewer_person_id = v_creator_person_id THEN
    RAISE EXCEPTION 'PROFESSIONAL_KNOWLEDGE_SELF_REVIEW_FORBIDDEN'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END
$function$;

REVOKE ALL ON FUNCTION app.guard_professional_knowledge_self_review()
  FROM PUBLIC;

CREATE TRIGGER professional_knowledge_review_evidence_self_review_guard
  BEFORE INSERT ON professional_knowledge_review_evidence
  FOR EACH ROW
  EXECUTE FUNCTION app.guard_professional_knowledge_self_review();

-- Migration 026 validates the app-role release transition. The authority
-- executor needs the same final exact reviewer Staff revalidation.
CREATE FUNCTION app.guard_professional_knowledge_authority_executor_release()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_target_assignment_id uuid;
  v_target_account_id uuid;
  v_target_person_id uuid;
BEGIN
  IF current_user = 'xiaoshuyin_migrator'
     AND OLD.lifecycle_status = 'CANDIDATE'
     AND NEW.lifecycle_status = 'PUBLISHED' THEN
    v_target_assignment_id :=
      NULLIF(current_setting('app.professional_review_target_assignment_id', true), '')::uuid;
    v_target_account_id :=
      NULLIF(current_setting('app.professional_review_target_account_id', true), '')::uuid;
    v_target_person_id :=
      NULLIF(current_setting('app.professional_review_target_person_id', true), '')::uuid;

    IF v_target_assignment_id IS NULL
       OR v_target_account_id IS NULL
       OR v_target_person_id IS NULL
       OR app.validate_professional_review_assignment_target(
         v_target_assignment_id,
         v_target_account_id,
         v_target_person_id
       ) IS NOT TRUE THEN
      RAISE EXCEPTION 'PROFESSIONAL_REVIEW_TARGET_AUTHORITY_REQUIRED'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END
$function$;

REVOKE ALL ON FUNCTION app.guard_professional_knowledge_authority_executor_release()
  FROM PUBLIC;

CREATE TRIGGER zzz_professional_knowledge_authority_executor_release_guard
  BEFORE UPDATE OF lifecycle_status ON professional_knowledge_versions
  FOR EACH ROW
  EXECUTE FUNCTION app.guard_professional_knowledge_authority_executor_release();

-- Review is one DB-bound operation: exact revision lock, creator/reviewer
-- segregation, exact Staff revalidation, evidence, state transition and success
-- audit all commit or roll back together. Qualification is resolved and
-- validated by the formal application command before this primitive is called;
-- this boundary persists that exact validated qualification reference.
CREATE FUNCTION app.commit_professional_knowledge_review(
  p_version_id uuid,
  p_expected_revision integer,
  p_reviewer_identity text,
  p_qualification_ref text,
  p_review_outcome text,
  p_review_reason_code text,
  p_reviewed_at timestamptz,
  p_next_review_state text,
  p_next_validity_state text
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, app
AS $function$
DECLARE
  v_actor_account_id uuid;
  v_actor_person_id uuid;
  v_assignment_id uuid;
  v_version professional_knowledge_versions%ROWTYPE;
  v_revision integer;
BEGIN
  IF session_user <> 'xiaoshuyin_app'
     OR app_current_purpose() <> 'PROFESSIONAL_KNOWLEDGE_ADMIN'
     OR app.professional_review_authorized() IS NOT TRUE THEN
    RAISE EXCEPTION 'PROFESSIONAL_KNOWLEDGE_FORMAL_REVIEW_COMMAND_REQUIRED'
      USING ERRCODE = '42501';
  END IF;

  v_actor_account_id := app_account_id();
  v_actor_person_id := app_person_id();
  v_assignment_id :=
    NULLIF(current_setting('app.professional_review_assignment_id', true), '')::uuid;

  IF v_actor_account_id IS NULL
     OR v_actor_person_id IS NULL
     OR v_assignment_id IS NULL
     OR p_reviewer_identity IS NULL
     OR btrim(p_reviewer_identity) = ''
     OR p_qualification_ref IS NULL
     OR btrim(p_qualification_ref) = ''
     OR p_reviewed_at IS NULL THEN
    RAISE EXCEPTION 'PROFESSIONAL_KNOWLEDGE_REVIEW_COMMAND_INVALID'
      USING ERRCODE = '42501';
  END IF;

  IF NOT (
    (
      p_review_outcome = 'NEEDS_REVIEW'
      AND p_next_review_state = 'NEEDS_REVIEW'
      AND p_next_validity_state = 'UNKNOWN'
    )
    OR
    (
      p_review_outcome IN ('REVIEWED', 'NO_MATERIAL_IMPACT')
      AND p_next_review_state = 'CURRENT'
      AND p_next_validity_state = 'VALID'
    )
  ) THEN
    RAISE EXCEPTION 'PROFESSIONAL_KNOWLEDGE_REVIEW_TRANSITION_INVALID'
      USING ERRCODE = '42501';
  END IF;

  SELECT *
    INTO v_version
    FROM professional_knowledge_versions
   WHERE id = p_version_id
   FOR UPDATE;

  IF NOT FOUND OR v_version.revision <> p_expected_revision THEN
    RETURN NULL;
  END IF;

  IF v_version.created_by_account_id = v_actor_account_id
     OR v_version.created_by_person_id = v_actor_person_id THEN
    RAISE EXCEPTION 'PROFESSIONAL_KNOWLEDGE_SELF_REVIEW_FORBIDDEN'
      USING ERRCODE = '42501';
  END IF;

  -- Revalidate the exact actor assignment at the physical transition boundary.
  IF app.validate_professional_review_assignment(
       v_assignment_id,
       v_actor_account_id,
       v_actor_person_id
     ) IS NOT TRUE THEN
    RAISE EXCEPTION 'PROFESSIONAL_REVIEW_AUTHORITY_REQUIRED'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO professional_knowledge_review_evidence
    (knowledge_version_id, reviewed_revision, content_hash, source_set_hash,
     reviewer_identity, reviewer_account_id, reviewer_person_id,
     staff_assignment_ref, qualification_ref, review_outcome,
     review_reason_code, reviewed_at)
  VALUES
    (v_version.id, v_version.revision, v_version.content_hash,
     v_version.source_set_hash, p_reviewer_identity, v_actor_account_id,
     v_actor_person_id, v_assignment_id, p_qualification_ref,
     p_review_outcome, p_review_reason_code, p_reviewed_at);

  UPDATE professional_knowledge_versions
     SET review_state = p_next_review_state,
         validity_state = p_next_validity_state,
         revision = revision + 1
   WHERE id = v_version.id
     AND revision = p_expected_revision
  RETURNING revision INTO v_revision;

  IF v_revision IS NULL THEN
    RETURN NULL;
  END IF;

  INSERT INTO business_audit_events
    (family_id, actor_account_id, event_type, resource_type, resource_id, metadata)
  VALUES
    (NULL, v_actor_account_id, 'PROFESSIONAL_KNOWLEDGE_REVIEW_RECORDED',
     'PROFESSIONAL_KNOWLEDGE', v_version.id,
     jsonb_build_object(
       'revision', v_revision,
       'contentHash', v_version.content_hash,
       'sourceSetHash', v_version.source_set_hash,
       'reviewState', p_next_review_state,
       'validityState', p_next_validity_state,
       'reasonCode', p_review_reason_code
     ));

  RETURN v_revision;
END
$function$;

REVOKE ALL ON FUNCTION app.commit_professional_knowledge_review(
  uuid, integer, text, text, text, text, timestamptz, text, text
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.commit_professional_knowledge_review(
  uuid, integer, text, text, text, text, timestamptz, text, text
) TO xiaoshuyin_app;

-- Release is likewise one DB-bound operation. The application command has
-- already validated external approval/qualification and exact semantic/Scene
-- bindings. This primitive re-checks the persisted exact version, exact target
-- Staff tuple, exact proof binding, writes approval evidence, publishes and
-- writes the success audit atomically.
CREATE FUNCTION app.commit_professional_knowledge_release(
  p_version_id uuid,
  p_expected_revision integer,
  p_effective_from timestamptz,
  p_evidence jsonb
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, app
AS $function$
DECLARE
  v_actor_account_id uuid;
  v_version professional_knowledge_versions%ROWTYPE;
  v_target_assignment_id uuid;
  v_target_account_id uuid;
  v_target_person_id uuid;
  v_expected_scope jsonb;
  v_scene_binding jsonb;
  v_revision integer;
BEGIN
  IF session_user <> 'xiaoshuyin_app'
     OR app_current_purpose() <> 'PROFESSIONAL_KNOWLEDGE_ADMIN'
     OR app.professional_review_authorized() IS NOT TRUE THEN
    RAISE EXCEPTION 'PROFESSIONAL_KNOWLEDGE_FORMAL_RELEASE_COMMAND_REQUIRED'
      USING ERRCODE = '42501';
  END IF;

  v_actor_account_id := app_account_id();

  SELECT *
    INTO v_version
    FROM professional_knowledge_versions
   WHERE id = p_version_id
   FOR UPDATE;

  IF NOT FOUND
     OR v_version.revision <> p_expected_revision
     OR v_version.lifecycle_status <> 'CANDIDATE'
     OR v_version.review_state <> 'CURRENT'
     OR v_version.validity_state <> 'VALID' THEN
    RETURN NULL;
  END IF;

  v_target_assignment_id :=
    NULLIF(current_setting('app.professional_review_target_assignment_id', true), '')::uuid;
  v_target_account_id :=
    NULLIF(current_setting('app.professional_review_target_account_id', true), '')::uuid;
  v_target_person_id :=
    NULLIF(current_setting('app.professional_review_target_person_id', true), '')::uuid;

  IF v_target_assignment_id IS NULL
     OR v_target_account_id IS NULL
     OR v_target_person_id IS NULL
     OR p_evidence IS NULL
     OR jsonb_typeof(p_evidence) <> 'object'
     OR p_evidence ->> 'reviewerAccountId' IS DISTINCT FROM v_target_account_id::text
     OR p_evidence ->> 'reviewerPersonId' IS DISTINCT FROM v_target_person_id::text
     OR p_evidence ->> 'staffAssignmentRef' IS DISTINCT FROM v_target_assignment_id::text
     OR app.validate_professional_review_assignment_target(
          v_target_assignment_id,
          v_target_account_id,
          v_target_person_id
        ) IS NOT TRUE THEN
    RAISE EXCEPTION 'PROFESSIONAL_REVIEW_TARGET_AUTHORITY_REQUIRED'
      USING ERRCODE = '42501';
  END IF;

  IF p_evidence ->> 'approvalProofRef' IS NULL
     OR btrim(p_evidence ->> 'approvalProofRef') = ''
     OR p_evidence ->> 'reviewerIdentity' IS NULL
     OR btrim(p_evidence ->> 'reviewerIdentity') = ''
     OR p_evidence ->> 'qualificationRef' IS NULL
     OR btrim(p_evidence ->> 'qualificationRef') = ''
     OR p_evidence ->> 'contentHash' IS DISTINCT FROM v_version.content_hash
     OR p_evidence ->> 'sourceSetHash' IS DISTINCT FROM v_version.source_set_hash THEN
    RAISE EXCEPTION 'PROFESSIONAL_KNOWLEDGE_APPROVAL_BINDING_INVALID'
      USING ERRCODE = '42501';
  END IF;

  v_expected_scope := jsonb_build_object(
    'product', v_version.scope_metadata -> 'product',
    'sceneCode', v_version.scope_metadata -> 'sceneCode',
    'scenePackageVersion', v_version.scope_metadata -> 'scenePackageVersion',
    'stages', v_version.scope_metadata -> 'stages',
    'ageBands', v_version.scope_metadata -> 'ageBands',
    'locale', to_jsonb(v_version.locale)
  );

  IF p_evidence -> 'approvalScope' IS DISTINCT FROM v_expected_scope
     OR p_evidence -> 'qualificationScope' IS DISTINCT FROM v_expected_scope THEN
    RAISE EXCEPTION 'PROFESSIONAL_KNOWLEDGE_APPROVAL_SCOPE_INVALID'
      USING ERRCODE = '42501';
  END IF;

  v_scene_binding := p_evidence -> 'sceneBindingRef';
  IF jsonb_typeof(v_scene_binding) <> 'object'
     OR v_scene_binding ->> 'knowledgeId' IS DISTINCT FROM v_version.knowledge_id::text
     OR v_scene_binding ->> 'semanticVersion' IS DISTINCT FROM v_version.semantic_version
     OR v_scene_binding ->> 'contentHash' IS DISTINCT FROM v_version.content_hash
     OR v_scene_binding ->> 'sourceSetHash' IS DISTINCT FROM v_version.source_set_hash
     OR v_scene_binding ->> 'sceneCode'
          IS DISTINCT FROM v_version.scope_metadata ->> 'sceneCode'
     OR v_scene_binding ->> 'scenePackageVersion'
          IS DISTINCT FROM v_version.scope_metadata ->> 'scenePackageVersion' THEN
    RAISE EXCEPTION 'PROFESSIONAL_KNOWLEDGE_SCENE_BINDING_INVALID'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO professional_knowledge_approval_evidence
    (knowledge_version_id, approval_proof_ref, content_hash, source_set_hash,
     semantic_binding_hash, approval_scope, reviewer_identity, reviewer_account_id,
     reviewer_person_id, staff_assignment_ref, qualification_ref, qualification_scope,
     reviewed_at, effective_from, effective_to,
     professional_content_package_ref, scene_binding_ref)
  VALUES
    (v_version.id,
     p_evidence ->> 'approvalProofRef',
     v_version.content_hash,
     v_version.source_set_hash,
     NULLIF(p_evidence ->> 'semanticBindingHash', ''),
     p_evidence -> 'approvalScope',
     p_evidence ->> 'reviewerIdentity',
     v_target_account_id,
     v_target_person_id,
     v_target_assignment_id,
     p_evidence ->> 'qualificationRef',
     p_evidence -> 'qualificationScope',
     (p_evidence ->> 'reviewedAt')::timestamptz,
     (p_evidence ->> 'effectiveFrom')::timestamptz,
     NULLIF(p_evidence ->> 'effectiveTo', '')::timestamptz,
     p_evidence -> 'professionalContentPackageRef',
     v_scene_binding);

  UPDATE professional_knowledge_versions
     SET lifecycle_status = 'PUBLISHED',
         released_at = clock_timestamp(),
         effective_from = p_effective_from,
         revision = revision + 1
   WHERE id = v_version.id
     AND revision = p_expected_revision
     AND lifecycle_status = 'CANDIDATE'
     AND review_state = 'CURRENT'
     AND validity_state = 'VALID'
  RETURNING revision INTO v_revision;

  IF v_revision IS NULL THEN
    RETURN NULL;
  END IF;

  INSERT INTO business_audit_events
    (family_id, actor_account_id, event_type, resource_type, resource_id, metadata)
  VALUES
    (NULL, v_actor_account_id, 'PROFESSIONAL_KNOWLEDGE_RELEASED',
     'PROFESSIONAL_KNOWLEDGE', v_version.id,
     jsonb_build_object(
       'knowledgeId', v_version.knowledge_id,
       'semanticVersion', v_version.semantic_version,
       'contentHash', v_version.content_hash,
       'sourceSetHash', v_version.source_set_hash,
       'semanticBindingHash', p_evidence ->> 'semanticBindingHash',
       'approvalProofRef', p_evidence ->> 'approvalProofRef',
       'sceneBindingRef', v_scene_binding,
       'revision', v_revision
     ));

  RETURN v_revision;
END
$function$;

REVOKE ALL ON FUNCTION app.commit_professional_knowledge_release(
  uuid, integer, timestamptz, jsonb
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.commit_professional_knowledge_release(
  uuid, integer, timestamptz, jsonb
) TO xiaoshuyin_app;

COMMIT;
