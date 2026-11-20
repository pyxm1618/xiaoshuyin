-- Slice 17 Phase 2 — Professional Authority / Release remediation.
-- Forward-only extension of the existing Staff Authority and business-audit owners.
BEGIN;

-- Preserve the body-only contentHash and provenance-only sourceSetHash meanings.
-- New successful approval-consumption evidence records the separate exact
-- authority-relevant semantic binding. Historical rows remain readable.
ALTER TABLE professional_knowledge_approval_evidence
  ADD COLUMN semantic_binding_hash text;

ALTER TABLE professional_knowledge_approval_evidence
  ADD CONSTRAINT professional_knowledge_approval_evidence_semantic_binding_hash_check
  CHECK (
    semantic_binding_hash IS NULL
    OR semantic_binding_hash ~ '^[0-9a-f]{64}$'
  );

-- Cross-reviewer validation must serialize with the same Staff owner mutation
-- protocol introduced by migration 021. The release actor is already authorized
-- through app.set_professional_review_context(); this seam locks the exact target
-- reviewer account/assignment before revalidating it, then records only the
-- exact tuple in transaction-local GUCs for the physical transition guard.
CREATE FUNCTION app.lock_professional_review_assignment_target(
  p_assignment_id uuid,
  p_account_id uuid,
  p_person_id uuid
) RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_valid boolean := false;
BEGIN
  IF p_assignment_id IS NULL
     OR p_account_id IS NULL
     OR p_person_id IS NULL
     OR app_current_purpose() <> 'PROFESSIONAL_KNOWLEDGE_ADMIN'
     OR app.professional_review_authorized() IS NOT TRUE THEN
    RETURN false;
  END IF;

  -- Reuse the single Staff Authority serialization keys. Staff mutation and
  -- Account disable/re-enable paths already take these exact keys.
  PERFORM pg_advisory_xact_lock(
    hashtextextended('AUTH_ACCOUNT:' || p_account_id::text, 0)
  );
  PERFORM pg_advisory_xact_lock(
    hashtextextended('AUTH_ROW:' || p_assignment_id::text, 0)
  );

  v_valid := app.validate_professional_review_assignment_target(
    p_assignment_id,
    p_account_id,
    p_person_id
  );

  IF v_valid IS TRUE THEN
    PERFORM set_config(
      'app.professional_review_target_assignment_id',
      p_assignment_id::text,
      true
    );
    PERFORM set_config(
      'app.professional_review_target_account_id',
      p_account_id::text,
      true
    );
    PERFORM set_config(
      'app.professional_review_target_person_id',
      p_person_id::text,
      true
    );
  END IF;

  RETURN COALESCE(v_valid, false);
END
$function$;

REVOKE ALL ON FUNCTION app.lock_professional_review_assignment_target(uuid, uuid, uuid)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.lock_professional_review_assignment_target(uuid, uuid, uuid)
  TO xiaoshuyin_app;

-- Final wall-clock Staff revalidation at the actual CANDIDATE -> PUBLISHED
-- transition. The target locks above prevent revoke/disable from committing
-- between approval validation and this transition; clock_timestamp() inside the
-- existing validator also catches expiry at the transition boundary.
CREATE FUNCTION app.guard_professional_knowledge_release_authority()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_assignment_id uuid;
  v_account_id uuid;
  v_person_id uuid;
BEGIN
  IF current_user = 'xiaoshuyin_app'
     AND OLD.lifecycle_status = 'CANDIDATE'
     AND NEW.lifecycle_status = 'PUBLISHED' THEN
    v_assignment_id :=
      NULLIF(current_setting('app.professional_review_target_assignment_id', true), '')::uuid;
    v_account_id :=
      NULLIF(current_setting('app.professional_review_target_account_id', true), '')::uuid;
    v_person_id :=
      NULLIF(current_setting('app.professional_review_target_person_id', true), '')::uuid;

    IF v_assignment_id IS NULL
       OR v_account_id IS NULL
       OR v_person_id IS NULL
       OR app.validate_professional_review_assignment_target(
            v_assignment_id,
            v_account_id,
            v_person_id
          ) IS NOT TRUE THEN
      RAISE EXCEPTION 'PROFESSIONAL_REVIEW_TARGET_AUTHORITY_REQUIRED'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END
$function$;

REVOKE ALL ON FUNCTION app.guard_professional_knowledge_release_authority()
  FROM PUBLIC;

CREATE TRIGGER zz_professional_knowledge_release_authority_guard
  BEFORE UPDATE OF lifecycle_status ON professional_knowledge_versions
  FOR EACH ROW
  EXECUTE FUNCTION app.guard_professional_knowledge_release_authority();

-- Extend the existing audit vocabulary; do not create a second ledger.
DO $$
DECLARE current_def text; current_expr text;
BEGIN
  SELECT pg_get_constraintdef(oid, true) INTO current_def
    FROM pg_constraint
   WHERE conrelid='business_audit_events'::regclass
     AND conname='business_audit_events_event_type_check';
  IF current_def IS NULL OR current_def NOT LIKE 'CHECK (%' THEN
    RAISE EXCEPTION 'business audit event authority missing';
  END IF;
  current_expr := substring(current_def FROM 8 FOR char_length(current_def)-8);
  ALTER TABLE business_audit_events
    DROP CONSTRAINT business_audit_events_event_type_check;
  EXECUTE format(
    'ALTER TABLE business_audit_events ADD CONSTRAINT business_audit_events_event_type_check CHECK ((%s) OR event_type=%L)',
    current_expr,
    'PROFESSIONAL_KNOWLEDGE_AUTHORITY_DENIED'
  );
END $$;

-- Exact logical failed command retries are idempotent in the audit ledger even
-- though the business/idempotency transaction itself rolled back.
CREATE UNIQUE INDEX business_audit_events_professional_denial_dedupe_idx
  ON business_audit_events (
    actor_account_id,
    resource_id,
    ((metadata ->> 'denialFingerprint'))
  )
  WHERE event_type = 'PROFESSIONAL_KNOWLEDGE_AUTHORITY_DENIED'
    AND resource_type = 'PROFESSIONAL_KNOWLEDGE'
    AND family_id IS NULL;

-- Durable denial receipts must remain subject to FORCE RLS. Do not use
-- SECURITY DEFINER/BYPASSRLS: add one narrow insert-only policy for the exact
-- denial event shape. The normal success-audit policy remains Staff-authorized.
CREATE POLICY audit_professional_knowledge_authority_denial_insert
  ON business_audit_events
  FOR INSERT TO xiaoshuyin_app
  WITH CHECK (
    family_id IS NULL
    AND actor_account_id = app_account_id()
    AND app_current_purpose() = 'PROFESSIONAL_KNOWLEDGE_ADMIN'
    AND event_type = 'PROFESSIONAL_KNOWLEDGE_AUTHORITY_DENIED'
    AND resource_type = 'PROFESSIONAL_KNOWLEDGE'
    AND jsonb_typeof(metadata) = 'object'
    AND metadata ?& ARRAY[
      'denialFingerprint',
      'decisionCategory',
      'reasonCode',
      'dependencyCategory'
    ]
    AND (metadata - ARRAY[
      'denialFingerprint',
      'decisionCategory',
      'reasonCode',
      'dependencyCategory'
    ]::text[]) = '{}'::jsonb
    AND (metadata ->> 'denialFingerprint') ~ '^[0-9a-f]{64}$'
    AND (metadata ->> 'decisionCategory') IN ('INVALID','UNAVAILABLE')
    AND (metadata ->> 'reasonCode') IN (
      'APPROVAL_INVALID',
      'APPROVAL_UNAVAILABLE',
      'APPROVAL_PROOF_ID_MISMATCH',
      'STAFF_AUTHORITY_INVALID',
      'STAFF_AUTHORITY_UNAVAILABLE',
      'PROFESSIONAL_QUALIFICATION_INVALID',
      'PROFESSIONAL_QUALIFICATION_UNAVAILABLE',
      'SCENE_PACKAGE_BINDING_INVALID',
      'SCENE_PACKAGE_BINDING_UNAVAILABLE',
      'INTERVENTION_DEFINITION_INVALID',
      'INTERVENTION_DEFINITION_UNAVAILABLE'
    )
    AND (
      metadata -> 'dependencyCategory' = 'null'::jsonb
      OR metadata ->> 'dependencyCategory' IN (
        'APPROVAL',
        'STAFF_AUTHORITY',
        'PROFESSIONAL_QUALIFICATION',
        'SCENE_PACKAGE_BINDING',
        'INTERVENTION_DEFINITION'
      )
    )
  );

COMMIT;
