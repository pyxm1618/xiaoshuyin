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

-- xiaoshuyin_migrator is already a distinct NOBYPASSRLS identity. These
-- policies expose only the review/release transaction surface needed by the
-- formal service while FORCE RLS remains enabled.
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
  WITH CHECK (app.professional_review_authorized());

CREATE POLICY professional_knowledge_sources_authority_executor_select
  ON professional_knowledge_sources
  FOR SELECT TO xiaoshuyin_migrator
  USING (app.professional_review_authorized());

CREATE POLICY professional_knowledge_review_evidence_authority_executor_insert
  ON professional_knowledge_review_evidence
  FOR INSERT TO xiaoshuyin_migrator
  WITH CHECK (app.professional_review_authorized());

CREATE POLICY professional_knowledge_approval_evidence_authority_executor_insert
  ON professional_knowledge_approval_evidence
  FOR INSERT TO xiaoshuyin_migrator
  WITH CHECK (app.professional_review_authorized());

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

COMMIT;
