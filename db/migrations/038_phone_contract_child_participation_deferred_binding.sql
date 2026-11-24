-- ============================================================================
-- Remediation V2 Finding #12 — deferred child participation binding.
-- Forward-only migration. Historical Phone Contract migrations remain immutable.
--
-- Parent workflow may create/confirm a draft before the child has an ACTIVE
-- participation. The participation is bound exactly once, atomically with a
-- genuine child-authored confirmation under PHONE_USE_CONTRACT purpose.
-- ============================================================================

ALTER TABLE digital_use_contract_versions
  ALTER COLUMN child_participation_id DROP NOT NULL;

ALTER TABLE digital_use_contract_versions
  DROP CONSTRAINT digital_use_contract_versions_confirmation_provenance_check;

ALTER TABLE digital_use_contract_versions
  ADD CONSTRAINT digital_use_contract_versions_confirmation_provenance_check CHECK (
    (
      parent_confirmation IS NULL
      OR (
        parent_confirmation ->> 'kind' = 'ADULT'
        AND parent_confirmation ->> 'personId' = adult_party_person_id::text
        AND parent_confirmation ->> 'authorizationAction' = 'CASE_RESPOND_ASSESSMENT_SCENE'
      )
    )
    AND
    (
      child_confirmation IS NULL
      OR (
        child_participation_id IS NOT NULL
        AND child_confirmation ->> 'kind' = 'CHILD'
        AND child_confirmation ->> 'personId' = child_party_person_id::text
        AND child_confirmation ->> 'participationId' = child_participation_id::text
        AND child_confirmation ->> 'authorizationAction' = 'PHONE_USE_CONTRACT_CONFIRM_SELF'
      )
    )
  );

GRANT UPDATE (child_participation_id) ON digital_use_contract_versions TO xiaoshuyin_app;

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
    IF NOT (
      app_current_purpose() = 'PHONE_USE_CONTRACT'
      AND OLD.child_participation_id IS NULL
      AND NEW.child_participation_id IS NOT NULL
      AND OLD.child_confirmation IS NULL
      AND NEW.child_confirmation IS NOT NULL
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
    ) THEN
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
    IF NULLIF(current_setting('app.dependency_review_propagation', true), '') = 'on'
       AND OLD.review_state = 'CURRENT' AND NEW.review_state = 'NEEDS_REVIEW' THEN
      -- Controlled narrow propagation path permitted
    ELSIF NULLIF(current_setting('app.contract_draft_review_recovery', true), '') = 'on'
       AND OLD.status IN ('DRAFT', 'PENDING_CONFIRMATION')
       AND NEW.status = 'DRAFT'
       AND OLD.review_state = 'NEEDS_REVIEW' AND NEW.review_state = 'CURRENT'
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
