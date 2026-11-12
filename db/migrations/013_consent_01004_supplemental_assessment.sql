-- ============================================================================
-- Slice 1 Consent Owner — 01004 Narrow Post-Merge Remediation
-- Migration: 013_consent_01004_supplemental_assessment.sql
--
-- New forward migration. Purpose-discriminated expansion of the ONE existing
-- Consent truth (`consent_records` + Slice 1 Consent owner). No second table.
--
-- Scope:
--   1. purpose-discriminated field branch (guardian invariant preserved 100%)
--   2. DECLINED is legal only for DIGITAL_USE_SUPPLEMENTAL_ASSESSMENT
--   3. case / actor(=subject) / disclosure / confirmation identity columns
--   4. append-only version chain + one-current-truth DB invariants
--   5. purpose-discriminated evidence shape (never free-form jsonb)
--   6. three supplemental consent audit event types in business_audit_events
--
-- NOT done here:
--   - no historical migration edit
--   - no guardian constraint dropped/widened/reinterpreted
--   - no second consent table / audit table / idempotency table
--   - no public Consent API
--   - no 01004 / 01000 Scene runtime, routing, assessment or artifact table
--   - no 01004 disclosure content or approval system
-- ============================================================================

-- ── Step 01: guardian-oriented NOT NULL becomes purpose-discriminated ──────
-- The existing values are preserved; the branch CHECK below re-imposes the
-- exact same requirement for every UNDER_14_GUARDIAN_CONSENT row.
ALTER TABLE consent_records ALTER COLUMN guardian_person_id  DROP NOT NULL;
ALTER TABLE consent_records ALTER COLUMN guardian_account_id DROP NOT NULL;

-- ── Step 02: supplemental decision identity ────────────────────────────────
-- `decision_actor_person_id` is the canonical actor identity AND the Consent
-- subject (Owner ruling: actor == subject). There is deliberately no separate
-- target-subject column: the Frozen Spec forbids a second, independent subject.
ALTER TABLE consent_records
  ADD COLUMN case_id uuid,
  ADD COLUMN decision_actor_person_id uuid,
  ADD COLUMN decision_actor_account_id uuid,
  ADD COLUMN disclosure_reference text,
  ADD COLUMN confirmation_statement_hash text;

ALTER TABLE consent_records
  ADD CONSTRAINT consent_supplemental_case_fk
    FOREIGN KEY (case_id) REFERENCES cases (id) ON DELETE RESTRICT,
  ADD CONSTRAINT consent_supplemental_case_family_fk
    FOREIGN KEY (case_id, family_id) REFERENCES cases (id, family_id) ON DELETE RESTRICT,
  ADD CONSTRAINT consent_supplemental_actor_person_fk
    FOREIGN KEY (decision_actor_person_id) REFERENCES persons (id) ON DELETE RESTRICT,
  ADD CONSTRAINT consent_supplemental_actor_account_fk
    FOREIGN KEY (decision_actor_account_id) REFERENCES accounts (id) ON DELETE RESTRICT;

-- ── Step 03: replace the guardian-only binding CHECK with a purpose branch ──
-- Existing constraint is a historical *object*, not a historical migration
-- file: replacing it here is the only way to let the supplemental branch exist
-- without fabricating guardian/onboarding data. Every guardian clause below is
-- byte-for-byte the original semantics.
ALTER TABLE consent_records DROP CONSTRAINT consent_request_binding;

ALTER TABLE consent_records
  ADD CONSTRAINT consent_purpose_field_binding CHECK (
    (
      purpose = 'UNDER_14_GUARDIAN_CONSENT'
      AND guardian_person_id  IS NOT NULL
      AND guardian_account_id IS NOT NULL
      AND case_id IS NULL
      AND decision_actor_person_id IS NULL
      AND decision_actor_account_id IS NULL
      AND disclosure_reference IS NULL
      AND confirmation_statement_hash IS NULL
      AND (
        (decision = 'GRANTED' AND onboarding_request_id IS NOT NULL)
        OR (decision = 'REVOKED' AND onboarding_request_id IS NULL)
      )
    )
    OR
    (
      purpose = 'DIGITAL_USE_SUPPLEMENTAL_ASSESSMENT'
      AND guardian_person_id IS NULL
      AND guardian_account_id IS NULL
      AND onboarding_request_id IS NULL
      AND bound_person_id IS NULL
      AND bound_at IS NULL
      AND case_id IS NOT NULL
      AND decision_actor_person_id IS NOT NULL
      AND decision_actor_account_id IS NOT NULL
      AND disclosure_reference IS NOT NULL
      AND disclosure_reference = btrim(disclosure_reference)
      AND length(disclosure_reference) BETWEEN 1 AND 120
      AND confirmation_statement_hash IS NOT NULL
      AND confirmation_statement_hash ~ '^[0-9a-f]{64}$'
    )
  );

-- FR-063 / FR-071: adding DECLINED must not widen the guardian legal set.
ALTER TABLE consent_records
  ADD CONSTRAINT consent_guardian_decision_set CHECK (
    purpose <> 'UNDER_14_GUARDIAN_CONSENT'
    OR decision IN ('GRANTED', 'REVOKED')
  );

-- ── Step 04: purpose-discriminated evidence shape ──────────────────────────
-- Supplemental rows must carry the purpose-specific evidence object and it must
-- agree with the authoritative columns. Guardian rows are intentionally NOT
-- re-validated here: legacy guardian evidence must remain readable as-is (no
-- historical row may become invalid), and the existing repository already fails
-- closed on malformed guardian evidence at read time.
ALTER TABLE consent_records
  ADD CONSTRAINT consent_supplemental_evidence_shape CHECK (
    purpose <> 'DIGITAL_USE_SUPPLEMENTAL_ASSESSMENT'
    OR (
      jsonb_typeof(evidence) = 'object'
      AND evidence ?& ARRAY[
        'evidence_kind', 'purpose', 'disclosure_reference', 'disclosure_version',
        'disclosure_hash', 'confirmation_statement_hash', 'decision',
        'decision_actor_person_id', 'case_id', 'decided_at',
        'client_ip_hash', 'user_agent_hash'
      ]
      AND evidence ->> 'evidence_kind' = 'DIGITAL_USE_SUPPLEMENTAL_ASSESSMENT'
      AND evidence ->> 'purpose' = 'DIGITAL_USE_SUPPLEMENTAL_ASSESSMENT'
      AND evidence ->> 'disclosure_reference' = disclosure_reference
      AND evidence ->> 'disclosure_version' = notice_version
      AND evidence ->> 'disclosure_hash' = notice_hash
      AND evidence ->> 'confirmation_statement_hash' = confirmation_statement_hash
      AND evidence ->> 'decision' = decision::text
      AND evidence ->> 'decision_actor_person_id' = decision_actor_person_id::text
      AND evidence ->> 'case_id' = case_id::text
      AND (evidence ->> 'decided_at') IS NOT NULL
      AND (evidence ->> 'client_ip_hash') ~ '^[0-9a-f]{64}$'
      AND (evidence ->> 'user_agent_hash') ~ '^[0-9a-f]{64}$'
      AND (evidence ->> 'disclosure_hash') ~ '^[0-9a-f]{64}$'
      AND (evidence ->> 'confirmation_statement_hash') ~ '^[0-9a-f]{64}$'
    )
  );

-- ── Step 05: version / supersession / one-current-truth invariants ─────────
-- A chain is linear because:
--   * the first version of a logical scope is unique;
--   * every version is unique inside the scope;
--   * a predecessor may be superseded at most once;
--   * the INSERT guard requires version = predecessor.version + 1 and the same
--     Family + Case + purpose + actor(subject) scope.
CREATE UNIQUE INDEX consent_supplemental_scope_version_key
  ON consent_records (family_id, case_id, purpose, decision_actor_person_id, version)
  WHERE purpose = 'DIGITAL_USE_SUPPLEMENTAL_ASSESSMENT';

CREATE UNIQUE INDEX consent_supplemental_supersedes_key
  ON consent_records (supersedes_id)
  WHERE purpose = 'DIGITAL_USE_SUPPLEMENTAL_ASSESSMENT'
    AND supersedes_id IS NOT NULL;

CREATE INDEX consent_supplemental_scope_head_idx
  ON consent_records (family_id, case_id, decision_actor_person_id, decided_at DESC)
  WHERE purpose = 'DIGITAL_USE_SUPPLEMENTAL_ASSESSMENT';

-- ── Step 06: supplemental INSERT guard ─────────────────────────────────────
-- Only the supplemental branch is affected. Guardian inserts keep their exact
-- existing path (the function returns immediately).
CREATE FUNCTION consent_records_supplemental_insert_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_previous consent_records%ROWTYPE;
BEGIN
  IF NEW.purpose <> 'DIGITAL_USE_SUPPLEMENTAL_ASSESSMENT' THEN
    RETURN NEW;
  END IF;

  -- Defensive duplicate of the CHECK: a supplemental row may never carry
  -- fabricated guardian / onboarding / binding facts.
  IF NEW.guardian_person_id IS NOT NULL
     OR NEW.guardian_account_id IS NOT NULL
     OR NEW.onboarding_request_id IS NOT NULL
     OR NEW.bound_person_id IS NOT NULL
     OR NEW.bound_at IS NOT NULL
     OR NEW.case_id IS NULL
     OR NEW.decision_actor_person_id IS NULL
     OR NEW.decision_actor_account_id IS NULL
     OR NEW.disclosure_reference IS NULL
     OR NEW.confirmation_statement_hash IS NULL
  THEN
    RAISE EXCEPTION 'CONSENT_SUPPLEMENTAL_FIELD_BINDING_INVALID' USING ERRCODE = '23514';
  END IF;

  -- Family + Case scope (also protected by the composite FK).
  IF NOT EXISTS (
    SELECT 1 FROM cases c
     WHERE c.id = NEW.case_id AND c.family_id = NEW.family_id
  ) THEN
    RAISE EXCEPTION 'CONSENT_SUPPLEMENTAL_CASE_SCOPE_INVALID' USING ERRCODE = '23514';
  END IF;

  -- actor == subject: the authenticated actor must be a member of this Family.
  IF NOT EXISTS (
    SELECT 1 FROM family_members fm
     WHERE fm.family_id = NEW.family_id
       AND fm.person_id = NEW.decision_actor_person_id
  ) THEN
    RAISE EXCEPTION 'CONSENT_SUPPLEMENTAL_ACTOR_SCOPE_INVALID' USING ERRCODE = '23514';
  END IF;

  -- actor person and actor account are the same server-verified identity.
  IF NOT EXISTS (
    SELECT 1 FROM persons p
     WHERE p.id = NEW.decision_actor_person_id
       AND p.account_id = NEW.decision_actor_account_id
  ) THEN
    RAISE EXCEPTION 'CONSENT_SUPPLEMENTAL_ACTOR_ACCOUNT_MISMATCH' USING ERRCODE = '23514';
  END IF;

  IF NEW.supersedes_id IS NULL THEN
    IF NEW.version <> 1 THEN
      RAISE EXCEPTION 'CONSENT_SUPPLEMENTAL_VERSION_INVALID' USING ERRCODE = '23514';
    END IF;
    -- A first refusal is DECLINED, never REVOKED.
    IF NEW.decision = 'REVOKED' THEN
      RAISE EXCEPTION 'CONSENT_SUPPLEMENTAL_REVOKE_WITHOUT_GRANT' USING ERRCODE = '23514';
    END IF;
  ELSE
    SELECT * INTO v_previous
      FROM consent_records
     WHERE id = NEW.supersedes_id
     FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'CONSENT_SUPPLEMENTAL_SUPERSEDE_TARGET_MISSING' USING ERRCODE = '23514';
    END IF;

    IF v_previous.purpose <> NEW.purpose
       OR v_previous.family_id <> NEW.family_id
       OR v_previous.case_id IS DISTINCT FROM NEW.case_id
       OR v_previous.decision_actor_person_id IS DISTINCT FROM NEW.decision_actor_person_id
    THEN
      RAISE EXCEPTION 'CONSENT_SUPPLEMENTAL_SUPERSEDE_SCOPE_MISMATCH' USING ERRCODE = '23514';
    END IF;

    IF NEW.version <> v_previous.version + 1 THEN
      RAISE EXCEPTION 'CONSENT_SUPPLEMENTAL_VERSION_INVALID' USING ERRCODE = '23514';
    END IF;

    -- FR-012: REVOKED withdraws an existing GRANTED only.
    IF NEW.decision = 'REVOKED' AND v_previous.decision <> 'GRANTED' THEN
      RAISE EXCEPTION 'CONSENT_SUPPLEMENTAL_REVOKE_WITHOUT_GRANT' USING ERRCODE = '23514';
    END IF;

    -- FR-008 / FR-010: DECLINED is a first-decision refusal only. Once a
    -- current truth exists, a non-revocation refusal is a semantic conflict.
    IF NEW.decision = 'DECLINED' THEN
      RAISE EXCEPTION 'CONSENT_SUPPLEMENTAL_DECLINE_AFTER_CURRENT' USING ERRCODE = '23514';
    END IF;

    -- No duplicate GRANTED / REVOKED version in the same chain.
    IF NEW.decision = v_previous.decision THEN
      RAISE EXCEPTION 'CONSENT_SUPPLEMENTAL_DUPLICATE_DECISION' USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END $$;

CREATE TRIGGER consent_records_supplemental_insert_guard
  BEFORE INSERT ON consent_records
  FOR EACH ROW EXECUTE FUNCTION consent_records_supplemental_insert_guard();

-- ── Step 07: supplemental rows are strictly append-only ────────────────────
-- The pre-existing guard already makes the business columns immutable for all
-- rows. This additional guard closes the remaining columns and forbids every
-- UPDATE on a supplemental decision fact (no current-truth flag, no mutation).
CREATE FUNCTION consent_records_supplemental_update_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.purpose = 'DIGITAL_USE_SUPPLEMENTAL_ASSESSMENT' THEN
    RAISE EXCEPTION 'CONSENT_SUPPLEMENTAL_RECORD_IMMUTABLE' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER consent_records_supplemental_update_guard
  BEFORE UPDATE ON consent_records
  FOR EACH ROW EXECUTE FUNCTION consent_records_supplemental_update_guard();

-- ── Step 08: minimal supplemental audit vocabulary ─────────────────────────
-- Reuse the existing `business_audit_events` store and `CONSENT` resource type.
-- The pre-existing vocabulary is preserved verbatim; only three exact
-- supplemental outcomes are added.
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
      'CASE_SAFETY_HOLD_ENTERED',
      'CASE_RISK_RESOLVED',
      'CONSENT_SUPPLEMENTAL_ASSESSMENT_GRANTED',
      'CONSENT_SUPPLEMENTAL_ASSESSMENT_DECLINED',
      'CONSENT_SUPPLEMENTAL_ASSESSMENT_REVOKED'
    )
  );

COMMENT ON COLUMN consent_records.case_id IS
  'DIGITAL_USE_SUPPLEMENTAL_ASSESSMENT case scope; NULL for guardian consent.';
COMMENT ON COLUMN consent_records.decision_actor_person_id IS
  'Server-verified decision actor; for supplemental consent this IS the Consent subject (actor == subject).';
COMMENT ON COLUMN consent_records.disclosure_reference IS
  'Server-resolved approved disclosure identity; never client-supplied content.';