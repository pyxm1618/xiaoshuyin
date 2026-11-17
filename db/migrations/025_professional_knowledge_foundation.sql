-- Slice 17 — Professional Knowledge Foundation.
-- Conflict-safe number 025: active Slice 16 PR #57 owns candidate migration 024.
-- This migration creates only Professional Knowledge truth and extends the
-- existing Staff, idempotency and business-audit owners. It does not create
-- reviewer/qualification/approval authorities, Scene Package storage, RAG,
-- embeddings, chunks, source archives or a second audit/idempotency system.
BEGIN;

CREATE TABLE professional_knowledge_items (
  id                    uuid PRIMARY KEY DEFAULT uuidv7(),
  knowledge_key         text NOT NULL UNIQUE,
  created_by_account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  created_by_person_id  uuid NOT NULL,
  created_at            timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT professional_knowledge_items_creator_fk
    FOREIGN KEY (created_by_person_id, created_by_account_id)
    REFERENCES persons(id, account_id)
    ON DELETE RESTRICT,
  CONSTRAINT professional_knowledge_items_key_check
    CHECK (
      length(knowledge_key) BETWEEN 1 AND 160
      AND knowledge_key = btrim(knowledge_key)
    )
);

CREATE TABLE professional_knowledge_versions (
  id                    uuid PRIMARY KEY DEFAULT uuidv7(),
  knowledge_id          uuid NOT NULL
                          REFERENCES professional_knowledge_items(id)
                          ON DELETE RESTRICT,
  semantic_version      text NOT NULL,
  revision              integer NOT NULL DEFAULT 1,
  lifecycle_status      text NOT NULL DEFAULT 'CANDIDATE',
  review_state          text NOT NULL DEFAULT 'PENDING',
  validity_state        text NOT NULL DEFAULT 'UNKNOWN',
  content               jsonb NOT NULL,
  content_hash          text NOT NULL,
  source_set_hash       text NOT NULL,
  scope_metadata        jsonb NOT NULL,
  locale                text NOT NULL,
  supersedes_version_id uuid
                          REFERENCES professional_knowledge_versions(id)
                          ON DELETE RESTRICT,
  released_at           timestamptz,
  effective_from        timestamptz,
  effective_to          timestamptz,
  created_by_account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  created_by_person_id  uuid NOT NULL,
  created_at            timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at            timestamptz NOT NULL DEFAULT clock_timestamp(),

  CONSTRAINT professional_knowledge_versions_creator_fk
    FOREIGN KEY (created_by_person_id, created_by_account_id)
    REFERENCES persons(id, account_id)
    ON DELETE RESTRICT,
  CONSTRAINT professional_knowledge_versions_identity_key
    UNIQUE (knowledge_id, semantic_version),
  CONSTRAINT professional_knowledge_versions_revision_check
    CHECK (revision > 0),
  CONSTRAINT professional_knowledge_versions_semver_check
    CHECK (
      semantic_version ~ '^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?$'
    ),
  CONSTRAINT professional_knowledge_versions_lifecycle_check
    CHECK (
      lifecycle_status IN (
        'CANDIDATE','PUBLISHED','SUPERSEDED','RETIRED','EXPIRED'
      )
    ),
  CONSTRAINT professional_knowledge_versions_review_state_check
    CHECK (review_state IN ('PENDING','CURRENT','NEEDS_REVIEW')),
  CONSTRAINT professional_knowledge_versions_validity_state_check
    CHECK (validity_state IN ('UNKNOWN','VALID','INVALID')),
  CONSTRAINT professional_knowledge_versions_content_hash_check
    CHECK (content_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT professional_knowledge_versions_source_set_hash_check
    CHECK (source_set_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT professional_knowledge_versions_locale_check
    CHECK (length(locale) BETWEEN 2 AND 35 AND locale = btrim(locale)),
  CONSTRAINT professional_knowledge_versions_effective_window_check
    CHECK (
      effective_to IS NULL
      OR effective_from IS NULL
      OR effective_to > effective_from
    ),
  CONSTRAINT professional_knowledge_versions_release_shape_check
    CHECK (
      (lifecycle_status = 'CANDIDATE' AND released_at IS NULL)
      OR
      (lifecycle_status <> 'CANDIDATE' AND released_at IS NOT NULL)
    ),
  CONSTRAINT professional_knowledge_versions_not_self_superseding
    CHECK (supersedes_version_id IS NULL OR supersedes_version_id <> id)
);

CREATE UNIQUE INDEX professional_knowledge_versions_single_successor_idx
  ON professional_knowledge_versions (supersedes_version_id)
  WHERE supersedes_version_id IS NOT NULL;

CREATE INDEX professional_knowledge_versions_current_idx
  ON professional_knowledge_versions
    (knowledge_id, lifecycle_status, review_state, validity_state);

CREATE TABLE professional_knowledge_sources (
  id               uuid PRIMARY KEY DEFAULT uuidv7(),
  knowledge_version_id uuid NOT NULL
                    REFERENCES professional_knowledge_versions(id)
                    ON DELETE RESTRICT,
  ordinal          integer NOT NULL,
  source_ref       text NOT NULL,
  source_version   text NOT NULL,
  source_hash      text NOT NULL,
  locator          text,
  snapshot_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at       timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT professional_knowledge_sources_ordinal_key
    UNIQUE (knowledge_version_id, ordinal),
  CONSTRAINT professional_knowledge_sources_ref_version_key
    UNIQUE (knowledge_version_id, source_ref, source_version),
  CONSTRAINT professional_knowledge_sources_ordinal_check CHECK (ordinal > 0),
  CONSTRAINT professional_knowledge_sources_ref_check
    CHECK (length(source_ref) BETWEEN 1 AND 500 AND source_ref = btrim(source_ref)),
  CONSTRAINT professional_knowledge_sources_version_check
    CHECK (
      length(source_version) BETWEEN 1 AND 200
      AND source_version = btrim(source_version)
    ),
  CONSTRAINT professional_knowledge_sources_hash_check
    CHECK (source_hash ~ '^[0-9a-f]{64}$')
);

CREATE TABLE professional_knowledge_review_evidence (
  id                    uuid PRIMARY KEY DEFAULT uuidv7(),
  knowledge_version_id  uuid NOT NULL
                          REFERENCES professional_knowledge_versions(id)
                          ON DELETE RESTRICT,
  reviewed_revision     integer NOT NULL,
  content_hash          text NOT NULL,
  source_set_hash       text NOT NULL,
  reviewer_identity     text NOT NULL,
  reviewer_account_id   uuid NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  reviewer_person_id    uuid NOT NULL,
  staff_assignment_ref  uuid NOT NULL
                          REFERENCES staff_assignments(id)
                          ON DELETE RESTRICT,
  qualification_ref     text NOT NULL,
  review_outcome        text NOT NULL,
  review_reason_code    text,
  reviewed_at           timestamptz NOT NULL,
  recorded_at           timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT professional_knowledge_review_evidence_reviewer_fk
    FOREIGN KEY (reviewer_person_id, reviewer_account_id)
    REFERENCES persons(id, account_id)
    ON DELETE RESTRICT,
  CONSTRAINT professional_knowledge_review_evidence_revision_check
    CHECK (reviewed_revision > 0),
  CONSTRAINT professional_knowledge_review_evidence_content_hash_check
    CHECK (content_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT professional_knowledge_review_evidence_source_hash_check
    CHECK (source_set_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT professional_knowledge_review_evidence_outcome_check
    CHECK (review_outcome IN ('REVIEWED','NEEDS_REVIEW','NO_MATERIAL_IMPACT')),
  CONSTRAINT professional_knowledge_review_evidence_qualification_check
    CHECK (
      length(qualification_ref) BETWEEN 1 AND 500
      AND qualification_ref = btrim(qualification_ref)
    )
);

-- Local evidence of a successfully consumed external approval. This table is
-- NOT an Approval Authority and must never be used to mint/resolve approval.
CREATE TABLE professional_knowledge_approval_evidence (
  id                     uuid PRIMARY KEY DEFAULT uuidv7(),
  knowledge_version_id   uuid NOT NULL
                           REFERENCES professional_knowledge_versions(id)
                           ON DELETE RESTRICT,
  approval_proof_ref     text NOT NULL,
  content_hash           text NOT NULL,
  source_set_hash        text NOT NULL,
  approval_scope         jsonb NOT NULL,
  reviewer_identity      text NOT NULL,
  reviewer_account_id    uuid NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  reviewer_person_id     uuid NOT NULL,
  staff_assignment_ref   uuid NOT NULL
                           REFERENCES staff_assignments(id)
                           ON DELETE RESTRICT,
  qualification_ref      text NOT NULL,
  qualification_scope    jsonb NOT NULL,
  reviewed_at            timestamptz NOT NULL,
  effective_from         timestamptz NOT NULL,
  effective_to           timestamptz,
  professional_content_package_ref jsonb,
  consumed_at            timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT professional_knowledge_approval_evidence_proof_key
    UNIQUE (knowledge_version_id, approval_proof_ref),
  CONSTRAINT professional_knowledge_approval_evidence_reviewer_fk
    FOREIGN KEY (reviewer_person_id, reviewer_account_id)
    REFERENCES persons(id, account_id)
    ON DELETE RESTRICT,
  CONSTRAINT professional_knowledge_approval_evidence_proof_check
    CHECK (
      length(approval_proof_ref) BETWEEN 1 AND 500
      AND approval_proof_ref = btrim(approval_proof_ref)
    ),
  CONSTRAINT professional_knowledge_approval_evidence_content_hash_check
    CHECK (content_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT professional_knowledge_approval_evidence_source_hash_check
    CHECK (source_set_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT professional_knowledge_approval_evidence_window_check
    CHECK (effective_to IS NULL OR effective_to > effective_from)
);

-- A Staff assignment and a professional qualification are different facts.
-- This function validates only the existing Staff owner. It never resolves,
-- stores or infers a professional qualification.
CREATE FUNCTION app.validate_professional_review_assignment(
  p_assignment_id uuid,
  p_account_id uuid,
  p_person_id uuid
) RETURNS boolean
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, public
SET row_security = off
AS $function$
  SELECT EXISTS (
    SELECT 1
      FROM public.staff_assignments assignment
      JOIN public.accounts reviewer_account
        ON reviewer_account.id = assignment.account_id
     WHERE assignment.id = p_assignment_id
       AND assignment.account_id = p_account_id
       AND assignment.person_id = p_person_id
       AND assignment.capability = 'PROFESSIONAL_REVIEW'
       AND assignment.scope_type = 'GLOBAL'
       AND assignment.family_id IS NULL
       AND assignment.case_id IS NULL
       AND assignment.capability_grant_id IS NULL
       AND assignment.revoked_at IS NULL
       AND assignment.valid_from <= clock_timestamp()
       AND (
         assignment.valid_until IS NULL
         OR assignment.valid_until > clock_timestamp()
       )
       AND reviewer_account.status = 'ACTIVE'
  )
$function$;

REVOKE ALL ON FUNCTION app.validate_professional_review_assignment(uuid, uuid, uuid)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.validate_professional_review_assignment(uuid, uuid, uuid)
  TO xiaoshuyin_app;

CREATE FUNCTION app.professional_review_authorized()
RETURNS boolean
LANGUAGE sql
VOLATILE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $function$
  SELECT
    app_current_purpose() = 'PROFESSIONAL_KNOWLEDGE_ADMIN'
    AND app.validate_professional_review_assignment(
      NULLIF(current_setting('app.professional_review_assignment_id', true), '')::uuid,
      app_account_id(),
      app_person_id()
    )
$function$;

REVOKE ALL ON FUNCTION app.professional_review_authorized() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.professional_review_authorized() TO xiaoshuyin_app;

CREATE FUNCTION app.set_professional_review_context(p_assignment_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_account_id uuid;
  v_person_id uuid;
BEGIN
  v_account_id := app_account_id();
  v_person_id := app_person_id();

  IF p_assignment_id IS NULL
     OR v_account_id IS NULL
     OR v_person_id IS NULL
     OR app_current_purpose() <> 'PROFESSIONAL_KNOWLEDGE_ADMIN' THEN
    RAISE EXCEPTION 'PROFESSIONAL_REVIEW_ASSIGNMENT_REQUIRED'
      USING ERRCODE = '42501';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended('AUTH_ACCOUNT:' || v_account_id::text, 0)
  );
  PERFORM pg_advisory_xact_lock(
    hashtextextended('AUTH_ROW:' || p_assignment_id::text, 0)
  );

  IF app.validate_professional_review_assignment(
    p_assignment_id, v_account_id, v_person_id
  ) IS NOT TRUE THEN
    RAISE EXCEPTION 'PROFESSIONAL_REVIEW_ASSIGNMENT_REQUIRED'
      USING ERRCODE = '42501';
  END IF;

  PERFORM set_config(
    'app.professional_review_assignment_id',
    p_assignment_id::text,
    true
  );
END
$function$;

REVOKE ALL ON FUNCTION app.set_professional_review_context(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.set_professional_review_context(uuid) TO xiaoshuyin_app;

CREATE FUNCTION app.guard_professional_knowledge_version_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $function$
BEGIN
  IF NEW.knowledge_id IS DISTINCT FROM OLD.knowledge_id
     OR NEW.semantic_version IS DISTINCT FROM OLD.semantic_version
     OR NEW.created_by_account_id IS DISTINCT FROM OLD.created_by_account_id
     OR NEW.created_by_person_id IS DISTINCT FROM OLD.created_by_person_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR NEW.supersedes_version_id IS DISTINCT FROM OLD.supersedes_version_id THEN
    RAISE EXCEPTION 'PROFESSIONAL_KNOWLEDGE_IDENTITY_IMMUTABLE'
      USING ERRCODE = '23514';
  END IF;

  IF OLD.lifecycle_status <> 'CANDIDATE'
     AND (
       NEW.content IS DISTINCT FROM OLD.content
       OR NEW.content_hash IS DISTINCT FROM OLD.content_hash
       OR NEW.source_set_hash IS DISTINCT FROM OLD.source_set_hash
       OR NEW.scope_metadata IS DISTINCT FROM OLD.scope_metadata
       OR NEW.locale IS DISTINCT FROM OLD.locale
     ) THEN
    RAISE EXCEPTION 'PROFESSIONAL_KNOWLEDGE_RELEASED_SEMANTICS_IMMUTABLE'
      USING ERRCODE = '23514';
  END IF;

  IF OLD.lifecycle_status IN ('SUPERSEDED','RETIRED','EXPIRED')
     AND NEW.lifecycle_status IS DISTINCT FROM OLD.lifecycle_status THEN
    RAISE EXCEPTION 'PROFESSIONAL_KNOWLEDGE_TERMINAL_LIFECYCLE'
      USING ERRCODE = '23514';
  END IF;

  IF OLD.lifecycle_status = 'PUBLISHED'
     AND NEW.lifecycle_status NOT IN ('PUBLISHED','SUPERSEDED','RETIRED','EXPIRED') THEN
    RAISE EXCEPTION 'PROFESSIONAL_KNOWLEDGE_LIFECYCLE_REGRESSION'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.revision <= OLD.revision THEN
    RAISE EXCEPTION 'PROFESSIONAL_KNOWLEDGE_REVISION_MUST_ADVANCE'
      USING ERRCODE = '23514';
  END IF;

  NEW.updated_at := clock_timestamp();
  RETURN NEW;
END
$function$;

CREATE TRIGGER professional_knowledge_versions_update_guard
  BEFORE UPDATE ON professional_knowledge_versions
  FOR EACH ROW
  EXECUTE FUNCTION app.guard_professional_knowledge_version_update();

CREATE FUNCTION app.guard_professional_knowledge_append_only()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $function$
BEGIN
  RAISE EXCEPTION 'PROFESSIONAL_KNOWLEDGE_APPEND_ONLY'
    USING ERRCODE = '23514';
END
$function$;

CREATE TRIGGER professional_knowledge_sources_append_only
  BEFORE UPDATE OR DELETE ON professional_knowledge_sources
  FOR EACH ROW EXECUTE FUNCTION app.guard_professional_knowledge_append_only();
CREATE TRIGGER professional_knowledge_review_evidence_append_only
  BEFORE UPDATE OR DELETE ON professional_knowledge_review_evidence
  FOR EACH ROW EXECUTE FUNCTION app.guard_professional_knowledge_append_only();
CREATE TRIGGER professional_knowledge_approval_evidence_append_only
  BEFORE UPDATE OR DELETE ON professional_knowledge_approval_evidence
  FOR EACH ROW EXECUTE FUNCTION app.guard_professional_knowledge_append_only();

ALTER TABLE professional_knowledge_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE professional_knowledge_items FORCE ROW LEVEL SECURITY;
ALTER TABLE professional_knowledge_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE professional_knowledge_versions FORCE ROW LEVEL SECURITY;
ALTER TABLE professional_knowledge_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE professional_knowledge_sources FORCE ROW LEVEL SECURITY;
ALTER TABLE professional_knowledge_review_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE professional_knowledge_review_evidence FORCE ROW LEVEL SECURITY;
ALTER TABLE professional_knowledge_approval_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE professional_knowledge_approval_evidence FORCE ROW LEVEL SECURITY;

CREATE POLICY professional_knowledge_items_admin
  ON professional_knowledge_items
  FOR ALL TO xiaoshuyin_app
  USING (app.professional_review_authorized())
  WITH CHECK (app.professional_review_authorized());

CREATE POLICY professional_knowledge_versions_admin
  ON professional_knowledge_versions
  FOR ALL TO xiaoshuyin_app
  USING (app.professional_review_authorized())
  WITH CHECK (app.professional_review_authorized());

CREATE POLICY professional_knowledge_sources_admin
  ON professional_knowledge_sources
  FOR SELECT TO xiaoshuyin_app
  USING (app.professional_review_authorized());
CREATE POLICY professional_knowledge_sources_admin_insert
  ON professional_knowledge_sources
  FOR INSERT TO xiaoshuyin_app
  WITH CHECK (app.professional_review_authorized());

CREATE POLICY professional_knowledge_review_evidence_admin
  ON professional_knowledge_review_evidence
  FOR SELECT TO xiaoshuyin_app
  USING (app.professional_review_authorized());
CREATE POLICY professional_knowledge_review_evidence_admin_insert
  ON professional_knowledge_review_evidence
  FOR INSERT TO xiaoshuyin_app
  WITH CHECK (app.professional_review_authorized());

CREATE POLICY professional_knowledge_approval_evidence_admin
  ON professional_knowledge_approval_evidence
  FOR SELECT TO xiaoshuyin_app
  USING (app.professional_review_authorized());
CREATE POLICY professional_knowledge_approval_evidence_admin_insert
  ON professional_knowledge_approval_evidence
  FOR INSERT TO xiaoshuyin_app
  WITH CHECK (app.professional_review_authorized());

-- Family-facing reads can only see already published/current/valid content.
-- Exact approval + Scene binding + metadata eligibility stays in the service
-- boundary and is revalidated before delivery.
CREATE POLICY professional_knowledge_items_family_read
  ON professional_knowledge_items
  FOR SELECT TO xiaoshuyin_app
  USING (
    app_current_purpose() = 'PROFESSIONAL_KNOWLEDGE_CONSUMPTION'
    AND app_family_id() IS NOT NULL
  );

CREATE POLICY professional_knowledge_versions_family_read
  ON professional_knowledge_versions
  FOR SELECT TO xiaoshuyin_app
  USING (
    app_current_purpose() = 'PROFESSIONAL_KNOWLEDGE_CONSUMPTION'
    AND app_family_id() IS NOT NULL
    AND lifecycle_status = 'PUBLISHED'
    AND review_state = 'CURRENT'
    AND validity_state = 'VALID'
  );

CREATE POLICY professional_knowledge_sources_family_read
  ON professional_knowledge_sources
  FOR SELECT TO xiaoshuyin_app
  USING (
    app_current_purpose() = 'PROFESSIONAL_KNOWLEDGE_CONSUMPTION'
    AND app_family_id() IS NOT NULL
    AND EXISTS (
      SELECT 1
        FROM professional_knowledge_versions v
       WHERE v.id = knowledge_version_id
         AND v.lifecycle_status = 'PUBLISHED'
         AND v.review_state = 'CURRENT'
         AND v.validity_state = 'VALID'
    )
  );

REVOKE ALL ON
  professional_knowledge_items,
  professional_knowledge_versions,
  professional_knowledge_sources,
  professional_knowledge_review_evidence,
  professional_knowledge_approval_evidence
FROM xiaoshuyin_app;

GRANT SELECT, INSERT ON professional_knowledge_items TO xiaoshuyin_app;
GRANT SELECT, INSERT, UPDATE ON professional_knowledge_versions TO xiaoshuyin_app;
GRANT SELECT, INSERT ON professional_knowledge_sources TO xiaoshuyin_app;
GRANT SELECT, INSERT ON professional_knowledge_review_evidence TO xiaoshuyin_app;
GRANT SELECT, INSERT ON professional_knowledge_approval_evidence TO xiaoshuyin_app;

-- Extend the existing shared idempotency vocabulary; no knowledge-specific
-- idempotency table is introduced.
ALTER TABLE idempotency_keys
  DROP CONSTRAINT idempotency_keys_command_type_check;
ALTER TABLE idempotency_keys
  ADD CONSTRAINT idempotency_keys_command_type_check CHECK (
    command_type IN (
      'FAMILY_CREATE',
      'MEMBER_CREATE',
      'MEMBER_UPDATE',
      'GUARDIAN_CONSENT_REQUEST',
      'GUARDIAN_CONSENT_GRANT',
      'GUARDIAN_CONSENT_REVOKE',
      'CASE_CREATE',
      'CASE_MESSAGE_CREATE',
      'PARTICIPATION_INVITE_CREATE',
      'PARTICIPATION_ACCEPT',
      'PARTICIPATION_DECLINE',
      'PARTICIPATION_WITHDRAW',
      'CASE_SWITCH_PRIMARY',
      'CASE_START_ASSESSMENT',
      'PROBLEM_FORMULATION_PRESENT',
      'PROBLEM_FORMULATION_CONFIRM',
      'PROBLEM_FORMULATION_DISPUTE',
      'PROBLEM_FORMULATION_CORRECT',
      'CASE_REASSESS_FROM_FORMULATION',
      'PROBLEM_FORMULATION_REVIEW_RESOLVE',
      'CASE_ENTER_SAFETY_HOLD',
      'CASE_RESOLVE_RISK',
      'DIGITAL_USE_ASSESSMENT_RESUME',
      'DIGITAL_USE_NODE_RESPONSE',
      'PHONE_USE_CONTRACT_DRAFT_SAVE',
      'PHONE_USE_CONTRACT_CONFIRM',
      'PHONE_USE_CONTRACT_REVISE',
      'PHONE_USE_ROLEPLAY_CREATE',
      'PHONE_USE_ROLEPLAY_TURN',
      'PHONE_USE_ROLEPLAY_RATE',
      'PHONE_USE_ROLEPLAY_SELECT',
      'PROFESSIONAL_KNOWLEDGE_CANDIDATE_CREATE',
      'PROFESSIONAL_KNOWLEDGE_CANDIDATE_EDIT',
      'PROFESSIONAL_KNOWLEDGE_REVIEW_RECORD',
      'PROFESSIONAL_KNOWLEDGE_RELEASE',
      'PROFESSIONAL_KNOWLEDGE_RETIRE',
      'PROFESSIONAL_KNOWLEDGE_DEPENDENCY_PROPAGATE'
    )
  );

-- Reuse business_audit_events for global Professional Knowledge. Existing
-- family audit semantics are preserved; NULL family_id is permitted only by
-- the Professional Knowledge policies below.
ALTER TABLE business_audit_events
  ALTER COLUMN family_id DROP NOT NULL;

ALTER TABLE business_audit_events
  DROP CONSTRAINT business_audit_events_resource_type_check;
ALTER TABLE business_audit_events
  ADD CONSTRAINT business_audit_events_resource_type_check CHECK (
    resource_type IN (
      'FAMILY', 'PERSON', 'CONSENT', 'CASE', 'DIALOGUE_MESSAGE',
      'ASSERTION', 'OBSERVATION', 'CASE_PARTICIPANT', 'PROBLEM_FORMULATION',
      'PROFESSIONAL_KNOWLEDGE'
    )
  );

ALTER TABLE business_audit_events
  DROP CONSTRAINT business_audit_events_event_type_check;
ALTER TABLE business_audit_events
  ADD CONSTRAINT business_audit_events_event_type_check CHECK (
    event_type IN (
      'FAMILY_CREATED',
      'MEMBER_CREATED',
      'MEMBER_PROFILE_VALUE_RECORDED',
      'CONSENT_REQUEST_CREATED',
      'CONSENT_GRANTED',
      'CONSENT_REVOKED',
      'CASE_CREATED',
      'MESSAGE_RECORDED',
      'ASSERTION_RECORDED',
      'OBSERVATION_RECORDED',
      'PARTICIPATION_INVITE_CREATED',
      'PARTICIPATION_ACCEPTED',
      'PARTICIPATION_DECLINED',
      'PARTICIPATION_EXPIRED',
      'PARTICIPATION_WITHDRAWN',
      'CASE_PRIMARY_SWITCHED',
      'CASE_ASSESSMENT_STARTED',
      'CASE_PROBLEM_FORMULATION_PRESENTED',
      'CASE_PROBLEM_FORMULATION_CONFIRMED',
      'CASE_PROBLEM_FORMULATION_DISPUTED',
      'CASE_PROBLEM_FORMULATION_CORRECTED',
      'CASE_REASSESSMENT_STARTED',
      'CONSENT_SUPPLEMENTAL_ASSESSMENT_GRANTED',
      'CONSENT_SUPPLEMENTAL_ASSESSMENT_DECLINED',
      'CONSENT_SUPPLEMENTAL_ASSESSMENT_REVOKED',
      'DIGITAL_USE_NODE_COMPLETED',
      'PHONE_USE_CONTRACT_DRAFT_SAVED',
      'PHONE_USE_CONTRACT_CONFIRMED',
      'PHONE_USE_CONTRACT_ACTIVATED',
      'PHONE_USE_CONTRACT_SUPERSEDED',
      'PHONE_USE_ROLEPLAY_RECORDED',
      'CASE_PROBLEM_FORMULATION_REVIEW_RESOLVED',
      'CASE_PROBLEM_FORMULATION_MATERIAL_CHANGE_RESOLVED',
      'CASE_SAFETY_HOLD_ENTERED',
      'CASE_RISK_RESOLVED',
      'PROFESSIONAL_KNOWLEDGE_CANDIDATE_CREATED',
      'PROFESSIONAL_KNOWLEDGE_CANDIDATE_EDITED',
      'PROFESSIONAL_KNOWLEDGE_REVIEW_RECORDED',
      'PROFESSIONAL_KNOWLEDGE_RELEASED',
      'PROFESSIONAL_KNOWLEDGE_SUPERSEDED',
      'PROFESSIONAL_KNOWLEDGE_RETIRED',
      'PROFESSIONAL_KNOWLEDGE_VALIDITY_CHANGED'
    )
  );

CREATE POLICY audit_professional_knowledge_select
  ON business_audit_events
  FOR SELECT TO xiaoshuyin_app
  USING (
    family_id IS NULL
    AND resource_type = 'PROFESSIONAL_KNOWLEDGE'
    AND app.professional_review_authorized()
  );

CREATE POLICY audit_professional_knowledge_insert
  ON business_audit_events
  FOR INSERT TO xiaoshuyin_app
  WITH CHECK (
    family_id IS NULL
    AND resource_type = 'PROFESSIONAL_KNOWLEDGE'
    AND app.professional_review_authorized()
  );

COMMIT;
