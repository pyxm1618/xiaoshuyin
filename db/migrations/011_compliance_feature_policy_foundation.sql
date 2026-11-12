-- ============================================================================
-- Slice 10 — Compliance Feature Policy Foundation
-- Migration: 011_compliance_feature_policy_foundation.sql
--
-- Reviewed additive migration. Scope:
--   1. one versioned feature-policy truth table `compliance_feature_policies`
--   2. exact applicability / rule vocabularies and cross-field coherence
--   3. immutable published judgment + lifecycle-only supersession closure
--   4. same-feature advisory-lock + BEFORE INSERT/UPDATE overlap guard
--   5. exact feature/revision/effective-time lookup indexes
--   6. ENABLE + FORCE RLS: runtime sees only currently effective rows
--   7. column-level runtime SELECT only (no review/history provenance)
--   8. runtime has no INSERT/UPDATE/DELETE/TRUNCATE
--   9. controlled migrator-only publication function (no public/runtime command)
--
-- NOT created here: timers, usage sessions, notifications, generated-content
-- artifacts, export, PIPIA/regulatory workflow, A4003/Digital Use runtime,
-- Safety state, a second Compliance Profile/guardian/consent truth, or any
-- public policy browse/admin/mutation API.
--
-- Migration number reconciliation at T1001: current main highest prefix is
-- 010_problem_formulation_safety_vocabulary_reconcile.sql, so Slice 10 uses 011.
-- ============================================================================

-- ── Step 01: compliance_feature_policies (global policy truth) ─────────────
-- This is server-owned global policy data, not Family-owned user data: there is
-- deliberately no family_id / person_id column and no second tenancy context.

CREATE TABLE compliance_feature_policies (
  id                           uuid PRIMARY KEY DEFAULT uuidv7(),
  feature_code                 text NOT NULL,
  feature_contract_revision    text NOT NULL,
  policy_version               integer NOT NULL,
  anthropomorphic_applicability text NOT NULL,
  minor_access_rule            text NOT NULL,
  ai_disclosure_rule           text NOT NULL,
  generated_content_label_rule text NOT NULL,
  usage_reminder_rule          text NOT NULL,
  decision_basis               text,
  review_evidence_ref          text,
  effective_from               timestamptz NOT NULL,
  effective_until              timestamptz,
  superseded_by_policy_id      uuid,
  created_at                   timestamptz NOT NULL DEFAULT now(),
  approved_at                  timestamptz NOT NULL DEFAULT now(),
  publication_source_ref       text NOT NULL,

  CONSTRAINT compliance_feature_policies_identity_version_key
    UNIQUE (feature_code, feature_contract_revision, policy_version),

  -- Composite identity key makes cross-feature supersession structurally
  -- impossible (a policy may only be superseded by the same feature identity).
  CONSTRAINT compliance_feature_policies_id_identity_key
    UNIQUE (id, feature_code, feature_contract_revision),

  CONSTRAINT compliance_feature_policies_supersede_identity_fk
    FOREIGN KEY (superseded_by_policy_id, feature_code, feature_contract_revision)
    REFERENCES compliance_feature_policies (id, feature_code, feature_contract_revision)
    ON DELETE RESTRICT,

  CONSTRAINT compliance_feature_policies_no_self_supersede
    CHECK (superseded_by_policy_id IS NULL OR superseded_by_policy_id <> id),

  CONSTRAINT compliance_feature_policies_feature_code_shape
    CHECK (feature_code = btrim(feature_code)
           AND length(feature_code) BETWEEN 1 AND 120),

  CONSTRAINT compliance_feature_policies_revision_shape
    CHECK (feature_contract_revision = btrim(feature_contract_revision)
           AND length(feature_contract_revision) BETWEEN 1 AND 64),

  CONSTRAINT compliance_feature_policies_version_positive
    CHECK (policy_version >= 1),

  CONSTRAINT compliance_feature_policies_applicability_check
    CHECK (anthropomorphic_applicability IN ('REQUIRED', 'NOT_APPLICABLE', 'UNKNOWN')),

  CONSTRAINT compliance_feature_policies_minor_rule_check
    CHECK (minor_access_rule IN ('BASELINE', 'MINORS_BLOCKED')),

  CONSTRAINT compliance_feature_policies_ai_rule_check
    CHECK (ai_disclosure_rule IN ('BASELINE', 'REQUIRED')),

  CONSTRAINT compliance_feature_policies_label_rule_check
    CHECK (generated_content_label_rule IN ('BASELINE', 'REQUIRED')),

  CONSTRAINT compliance_feature_policies_usage_rule_check
    CHECK (usage_reminder_rule IN ('BASELINE', 'REQUIRED')),

  -- REQUIRED must carry the anthropomorphic AI disclosure + usage-reminder
  -- obligations; NOT_APPLICABLE must not carry the anthropomorphic
  -- usage-reminder rule. UNKNOWN is shaped as a real unresolved row and still
  -- fails closed in the evaluator.
  CONSTRAINT compliance_feature_policies_cross_field_check CHECK (
    (
      anthropomorphic_applicability <> 'REQUIRED'
      OR (ai_disclosure_rule = 'REQUIRED' AND usage_reminder_rule = 'REQUIRED')
    )
    AND (
      anthropomorphic_applicability <> 'NOT_APPLICABLE'
      OR usage_reminder_rule = 'BASELINE'
    )
  ),

  -- REQUIRED / NOT_APPLICABLE are reviewed conclusions and must carry both a
  -- decision basis and an opaque review evidence reference.
  CONSTRAINT compliance_feature_policies_provenance_check CHECK (
    (
      anthropomorphic_applicability = 'UNKNOWN'
      AND (decision_basis IS NULL OR (btrim(decision_basis) <> '' AND length(decision_basis) <= 1000))
      AND (review_evidence_ref IS NULL OR (btrim(review_evidence_ref) <> '' AND length(review_evidence_ref) <= 200))
    )
    OR (
      anthropomorphic_applicability IN ('REQUIRED', 'NOT_APPLICABLE')
      AND decision_basis IS NOT NULL
      AND btrim(decision_basis) <> ''
      AND length(decision_basis) <= 1000
      AND review_evidence_ref IS NOT NULL
      AND btrim(review_evidence_ref) <> ''
      AND length(review_evidence_ref) <= 200
    )
  ),

  CONSTRAINT compliance_feature_policies_publication_source_check
    CHECK (btrim(publication_source_ref) <> '' AND length(publication_source_ref) <= 200),

  CONSTRAINT compliance_feature_policies_effective_interval_check
    CHECK (effective_until IS NULL OR effective_until > effective_from),

  CONSTRAINT compliance_feature_policies_supersede_closure_check
    CHECK (superseded_by_policy_id IS NULL OR effective_until IS NOT NULL)
);

-- ── Step 02: lookup indexes ────────────────────────────────────────────────

-- Exact feature identity + half-open effective-period selection.
CREATE INDEX compliance_feature_policies_effective_lookup_idx
  ON compliance_feature_policies
     (feature_code, feature_contract_revision, effective_from, effective_until);

-- Current open version per exact identity (used by controlled publication).
CREATE INDEX compliance_feature_policies_current_open_idx
  ON compliance_feature_policies (feature_code, feature_contract_revision)
  WHERE effective_until IS NULL;

-- ── Step 03: effective-period overlap guard ────────────────────────────────
-- DB-level enforcement independent of any application-side precheck. A
-- same-feature transaction advisory lock serializes concurrent publishers,
-- including two concurrent first-publish attempts where no row exists yet.

CREATE FUNCTION compliance_feature_policies_overlap_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(
    hashtextextended(NEW.feature_code || chr(31) || NEW.feature_contract_revision, 0)
  );

  IF EXISTS (
    SELECT 1
      FROM compliance_feature_policies existing
     WHERE existing.feature_code = NEW.feature_code
       AND existing.feature_contract_revision = NEW.feature_contract_revision
       AND existing.id <> NEW.id
       AND tstzrange(existing.effective_from, existing.effective_until, '[)')
           && tstzrange(NEW.effective_from, NEW.effective_until, '[)')
  ) THEN
    RAISE EXCEPTION 'COMPLIANCE_POLICY_EFFECTIVE_OVERLAP' USING ERRCODE = '23P01';
  END IF;

  RETURN NEW;
END $$;

CREATE TRIGGER compliance_feature_policies_overlap_insert
  BEFORE INSERT ON compliance_feature_policies
  FOR EACH ROW EXECUTE FUNCTION compliance_feature_policies_overlap_guard();

CREATE TRIGGER compliance_feature_policies_overlap_update
  BEFORE UPDATE OF effective_from, effective_until ON compliance_feature_policies
  FOR EACH ROW EXECUTE FUNCTION compliance_feature_policies_overlap_guard();

-- ── Step 04: immutable published judgment ──────────────────────────────────
-- A published judgment may only be lifecycle-closed once: effective_until and
-- superseded_by_policy_id move from NULL to their final value. Re-review always
-- requires a new policy_version row.

CREATE FUNCTION compliance_feature_policies_guard_update() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_superseder_effective_from timestamptz;
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id
  OR NEW.feature_code IS DISTINCT FROM OLD.feature_code
  OR NEW.feature_contract_revision IS DISTINCT FROM OLD.feature_contract_revision
  OR NEW.policy_version IS DISTINCT FROM OLD.policy_version
  OR NEW.anthropomorphic_applicability IS DISTINCT FROM OLD.anthropomorphic_applicability
  OR NEW.minor_access_rule IS DISTINCT FROM OLD.minor_access_rule
  OR NEW.ai_disclosure_rule IS DISTINCT FROM OLD.ai_disclosure_rule
  OR NEW.generated_content_label_rule IS DISTINCT FROM OLD.generated_content_label_rule
  OR NEW.usage_reminder_rule IS DISTINCT FROM OLD.usage_reminder_rule
  OR NEW.decision_basis IS DISTINCT FROM OLD.decision_basis
  OR NEW.review_evidence_ref IS DISTINCT FROM OLD.review_evidence_ref
  OR NEW.created_at IS DISTINCT FROM OLD.created_at
  OR NEW.approved_at IS DISTINCT FROM OLD.approved_at
  OR NEW.publication_source_ref IS DISTINCT FROM OLD.publication_source_ref
  OR NEW.effective_from IS DISTINCT FROM OLD.effective_from
  THEN
    RAISE EXCEPTION 'COMPLIANCE_POLICY_JUDGMENT_IMMUTABLE' USING ERRCODE = '23514';
  END IF;

  IF OLD.effective_until IS NOT NULL AND NEW.effective_until IS DISTINCT FROM OLD.effective_until THEN
    RAISE EXCEPTION 'COMPLIANCE_POLICY_CLOSURE_IMMUTABLE' USING ERRCODE = '23514';
  END IF;

  IF OLD.superseded_by_policy_id IS NOT NULL
     AND NEW.superseded_by_policy_id IS DISTINCT FROM OLD.superseded_by_policy_id THEN
    RAISE EXCEPTION 'COMPLIANCE_POLICY_CLOSURE_IMMUTABLE' USING ERRCODE = '23514';
  END IF;

  IF NEW.superseded_by_policy_id IS NOT NULL THEN
    SELECT p.effective_from
      INTO v_superseder_effective_from
      FROM compliance_feature_policies p
     WHERE p.id = NEW.superseded_by_policy_id;

    IF v_superseder_effective_from IS NULL
       OR NEW.effective_until IS NULL
       OR NEW.effective_until <> v_superseder_effective_from THEN
      RAISE EXCEPTION 'COMPLIANCE_POLICY_SUPERSESSION_INTERVAL_MISMATCH' USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END $$;

CREATE TRIGGER compliance_feature_policies_guard
  BEFORE UPDATE ON compliance_feature_policies
  FOR EACH ROW EXECUTE FUNCTION compliance_feature_policies_guard_update();

-- ── Step 05: ENABLE + FORCE ROW LEVEL SECURITY ─────────────────────────────
-- Global policy least privilege, not Family tenancy. Runtime sees only rows
-- effective at the current transaction time. Corruption that creates two
-- simultaneously-effective rows is intentionally left visible so the evaluator
-- can detect ambiguity and fail closed instead of RLS hiding the defect.

ALTER TABLE compliance_feature_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_feature_policies FORCE  ROW LEVEL SECURITY;

CREATE POLICY compliance_feature_policies_runtime_active
  ON compliance_feature_policies
  FOR SELECT TO xiaoshuyin_app
  USING (
    effective_from <= transaction_timestamp()
    AND (effective_until IS NULL OR transaction_timestamp() < effective_until)
  );

CREATE POLICY compliance_feature_policies_migrator_control
  ON compliance_feature_policies
  FOR ALL TO xiaoshuyin_migrator
  USING (true)
  WITH CHECK (true);

-- ── Step 06: least-privilege grants ────────────────────────────────────────
-- Runtime: evaluator-required columns only. decision_basis, review_evidence_ref,
-- approved_at and publication_source_ref stay unavailable to the runtime role.
-- No table-level SELECT grant means `SELECT *` must fail.

GRANT SELECT (
  id,
  feature_code,
  feature_contract_revision,
  policy_version,
  anthropomorphic_applicability,
  minor_access_rule,
  ai_disclosure_rule,
  generated_content_label_rule,
  usage_reminder_rule,
  effective_from,
  effective_until
) ON compliance_feature_policies TO xiaoshuyin_app;

-- Controlled provisioning role: full history read + publish (no delete/truncate).
GRANT SELECT, INSERT, UPDATE ON compliance_feature_policies TO xiaoshuyin_migrator;

-- ── Step 07: controlled reviewed publication representation ────────────────
-- Deployment-time / internal provisioning only. There is no runtime or public
-- publication command, no reviewer account and no approval queue. The function
-- serializes on the exact feature identity, re-reads and locks the current open
-- version, rejects stale/monotonic violations, closes the previous interval and
-- inserts the new immutable judgment in one transaction.

CREATE FUNCTION app.publish_compliance_feature_policy(
  p_feature_code                text,
  p_feature_contract_revision   text,
  p_expected_current_version    integer,
  p_policy_version              integer,
  p_applicability               text,
  p_minor_access_rule           text,
  p_ai_disclosure_rule          text,
  p_generated_content_label_rule text,
  p_usage_reminder_rule         text,
  p_decision_basis              text,
  p_review_evidence_ref         text,
  p_effective_from              timestamptz,
  p_publication_source_ref      text
) RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE
  v_current_id      uuid;
  v_current_version integer;
  v_max_version     integer;
  v_new_id          uuid;
BEGIN
  IF p_feature_code IS NULL OR p_feature_contract_revision IS NULL
     OR btrim(p_feature_code) = '' OR btrim(p_feature_contract_revision) = ''
     OR p_policy_version IS NULL OR p_policy_version < 1
     OR p_effective_from IS NULL THEN
    RAISE EXCEPTION 'COMPLIANCE_POLICY_PUBLICATION_INVALID' USING ERRCODE = '23514';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_feature_code || chr(31) || p_feature_contract_revision, 0)
  );

  SELECT id, policy_version
    INTO v_current_id, v_current_version
    FROM compliance_feature_policies
   WHERE feature_code = p_feature_code
     AND feature_contract_revision = p_feature_contract_revision
     AND effective_until IS NULL
   FOR UPDATE;

  IF v_current_id IS NULL THEN
    -- First publication for this exact identity: caller must expect none.
    IF p_expected_current_version IS NOT NULL THEN
      RAISE EXCEPTION 'COMPLIANCE_POLICY_STALE' USING ERRCODE = '40001';
    END IF;
  ELSE
    IF p_expected_current_version IS DISTINCT FROM v_current_version THEN
      RAISE EXCEPTION 'COMPLIANCE_POLICY_STALE' USING ERRCODE = '40001';
    END IF;

    IF p_policy_version <= v_current_version THEN
      RAISE EXCEPTION 'COMPLIANCE_POLICY_VERSION_NOT_MONOTONIC' USING ERRCODE = '23514';
    END IF;
  END IF;

  -- Monotonic policy version is a property of the whole reviewed history, not
  -- only the current open row. An explicitly expired history (no open row) must
  -- never be mistaken for a first publication.
  SELECT MAX(policy_version)
    INTO v_max_version
    FROM compliance_feature_policies
   WHERE feature_code = p_feature_code
     AND feature_contract_revision = p_feature_contract_revision;

  IF v_max_version IS NOT NULL AND p_policy_version <= v_max_version THEN
    RAISE EXCEPTION 'COMPLIANCE_POLICY_VERSION_NOT_MONOTONIC' USING ERRCODE = '23514';
  END IF;

  IF v_current_id IS NOT NULL THEN
    UPDATE compliance_feature_policies
       SET effective_until = p_effective_from
     WHERE id = v_current_id;
  END IF;

  INSERT INTO compliance_feature_policies (
    feature_code,
    feature_contract_revision,
    policy_version,
    anthropomorphic_applicability,
    minor_access_rule,
    ai_disclosure_rule,
    generated_content_label_rule,
    usage_reminder_rule,
    decision_basis,
    review_evidence_ref,
    effective_from,
    publication_source_ref
  ) VALUES (
    p_feature_code,
    p_feature_contract_revision,
    p_policy_version,
    p_applicability,
    p_minor_access_rule,
    p_ai_disclosure_rule,
    p_generated_content_label_rule,
    p_usage_reminder_rule,
    p_decision_basis,
    p_review_evidence_ref,
    p_effective_from,
    p_publication_source_ref
  )
  RETURNING id INTO v_new_id;

  IF v_current_id IS NOT NULL THEN
    UPDATE compliance_feature_policies
       SET superseded_by_policy_id = v_new_id
     WHERE id = v_current_id;
  END IF;

  RETURN v_new_id;
END $$;

-- PostgreSQL grants EXECUTE on new functions to PUBLIC by default. The
-- publication representation must not be reachable by the runtime role.
REVOKE ALL ON FUNCTION app.publish_compliance_feature_policy(
  text, text, integer, integer, text, text, text, text, text, text, text,
  timestamptz, text
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION app.publish_compliance_feature_policy(
  text, text, integer, integer, text, text, text, text, text, text, text,
  timestamptz, text
) TO xiaoshuyin_migrator;

-- The runtime role deliberately receives no EXECUTE on the publication
-- function and no INSERT/UPDATE/DELETE/TRUNCATE on the table.