-- Migration 031: Forward remediation for Professional Knowledge effective window (Finding #21)
--
-- Enforces the authoritative version validity contract:
--   effective_from <= current authoritative time
--   AND (effective_to IS NULL OR current authoritative time < effective_to)
--
-- 1. Updates app.commit_professional_knowledge_release() to persist effective_to
--    from the release evidence payload into professional_knowledge_versions.effective_to.
--    Hardens search_path to pg_catalog, public, app, pg_temp against privilege escalation.
-- 2. Backfills any historical published versions where effective_to was retained in evidence
--    but omitted from the versions row.
-- 3. Strengthens RLS family read policies on professional_knowledge_versions and
--    professional_knowledge_sources to strictly enforce the effective window.
--
-- Note: Transaction boundaries are controlled by the migration runner; no top-level
-- BEGIN / COMMIT statements are permitted here.

-- ── 1. Re-declare app.commit_professional_knowledge_release with effective_to persistence ──

CREATE OR REPLACE FUNCTION app.commit_professional_knowledge_release(
  p_version_id uuid,
  p_expected_revision integer,
  p_effective_from timestamptz,
  p_evidence jsonb
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, app, pg_temp
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
         effective_to = NULLIF(p_evidence ->> 'effectiveTo', '')::timestamptz,
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

-- ── 2. Backfill effective_to on existing versions from approval evidence ──

UPDATE professional_knowledge_versions v
   SET effective_to = e.effective_to
  FROM professional_knowledge_approval_evidence e
 WHERE e.knowledge_version_id = v.id
   AND v.effective_to IS NULL
   AND e.effective_to IS NOT NULL;

-- ── 3. Update family read RLS policies to strictly enforce effective window ──

DROP POLICY IF EXISTS professional_knowledge_versions_family_read ON professional_knowledge_versions;
CREATE POLICY professional_knowledge_versions_family_read
  ON professional_knowledge_versions
  FOR SELECT TO xiaoshuyin_app
  USING (
    app_current_purpose() = 'PROFESSIONAL_KNOWLEDGE_CONSUMPTION'
    AND app_family_id() IS NOT NULL
    AND lifecycle_status = 'PUBLISHED'
    AND review_state = 'CURRENT'
    AND validity_state = 'VALID'
    AND effective_from <= transaction_timestamp()
    AND (
      effective_to IS NULL
      OR transaction_timestamp() < effective_to
    )
  );

DROP POLICY IF EXISTS professional_knowledge_sources_family_read ON professional_knowledge_sources;
CREATE POLICY professional_knowledge_sources_family_read
  ON professional_knowledge_sources
  FOR SELECT TO xiaoshuyin_app
  USING (
    app_current_purpose() = 'PROFESSIONAL_KNOWLEDGE_CONSUMPTION'
    AND app_family_id() IS NOT NULL
    AND EXISTS (
      SELECT 1
        FROM professional_knowledge_versions v
       WHERE v.id = professional_knowledge_sources.knowledge_version_id
         AND v.lifecycle_status = 'PUBLISHED'
         AND v.review_state = 'CURRENT'
         AND v.validity_state = 'VALID'
         AND v.effective_from <= transaction_timestamp()
         AND (
           v.effective_to IS NULL
           OR transaction_timestamp() < v.effective_to
         )
    )
  );
