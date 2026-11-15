-- ============================================================
-- AUTH-006 — Problem Formulation Review-State Reconciliation
-- Migration: 020_problem_formulation_review_state.sql
--
-- Forward-only reconciliation of the Slice 8 lifecycle/review-state conflict.
-- Historical migration 008 remains immutable.
--
-- Data-governance rule:
--   Legacy status=NEEDS_REVIEW rows are reconstructed row-by-row from
--   authoritative persisted facts (version chain, case phase, user_response,
--   confirmation events/audit, family membership). Guessing or blanket
--   lifecycle defaults are forbidden. A row is only blocked when the
--   persisted facts are insufficient or contradictory; that case aborts the
--   whole migration atomically before any row or schema mutation persists.
-- ============================================================

-- The reconciliation reads tables that are FORCE RLS. The migrator is
-- NOBYPASSRLS, so FORCE would hide legacy rows from the analysis. Temporarily
-- remove FORCE (not RLS itself) on every table used by the reconstruction.
-- Each migration is transactional; any failure rolls these catalog changes back
-- with the failed migration and FORCE remains in effect.
ALTER TABLE problem_formulations NO FORCE ROW LEVEL SECURITY;
ALTER TABLE case_events NO FORCE ROW LEVEL SECURITY;
ALTER TABLE business_audit_events NO FORCE ROW LEVEL SECURITY;
ALTER TABLE family_members NO FORCE ROW LEVEL SECURITY;
ALTER TABLE persons NO FORCE ROW LEVEL SECURITY;
ALTER TABLE accounts NO FORCE ROW LEVEL SECURITY;

CREATE TEMP TABLE auth006_legacy_reconstruction (
  id uuid PRIMARY KEY,
  resolved_status text NOT NULL,
  confirmer uuid NULL,
  confirmed_at timestamptz NULL
) ON COMMIT DROP;

CREATE TYPE problem_formulation_review_state AS ENUM (
  'CURRENT',
  'NEEDS_REVIEW'
);

ALTER TABLE problem_formulations
  ADD COLUMN review_state problem_formulation_review_state NOT NULL DEFAULT 'CURRENT';

DO $$
DECLARE
  legacy record;
  user_kind text;
  confirm_event_count bigint;
  dispute_event_count bigint;
  correction_event_count bigint;
  presented_event_count bigint;
  confirmer_ids uuid[];
  confirmer_times timestamptz[];
  resolved_confirmer uuid;
  resolved_confirmed_at timestamptz;
  resolved_status text;
  ambiguous_ids uuid[] := ARRAY[]::uuid[];
  ambiguous_reasons text[] := ARRAY[]::text[];
BEGIN
  FOR legacy IN
    SELECT id, case_id, family_id, version, user_response
      FROM problem_formulations
     WHERE status::text = 'NEEDS_REVIEW'
     ORDER BY id
  LOOP
    user_kind := legacy.user_response ->> 'kind';
    resolved_status := NULL;
    resolved_confirmer := NULL;
    resolved_confirmed_at := NULL;

    -- Authoritative confirmation facts for this exact formulation version.
    SELECT count(*) INTO confirm_event_count
      FROM (
        SELECT ce.actor_account_id, ce.occurred_at
          FROM case_events ce
         WHERE ce.case_id = legacy.case_id
           AND ce.event_type = 'CASE_PROBLEM_FORMULATION_CONFIRMED'
           AND ce.metadata ->> 'formulationVersion' = legacy.version::text
        UNION ALL
        SELECT bae.actor_account_id, bae.occurred_at
          FROM business_audit_events bae
         WHERE bae.resource_type = 'PROBLEM_FORMULATION'
           AND bae.resource_id = legacy.id
           AND bae.event_type = 'CASE_PROBLEM_FORMULATION_CONFIRMED'
      ) confirm_events;

    SELECT array_agg(DISTINCT p.id), array_agg(confirm_events.occurred_at)
      INTO confirmer_ids, confirmer_times
      FROM (
        SELECT ce.actor_account_id, ce.occurred_at AS occurred_at
          FROM case_events ce
         WHERE ce.case_id = legacy.case_id
           AND ce.event_type = 'CASE_PROBLEM_FORMULATION_CONFIRMED'
           AND ce.metadata ->> 'formulationVersion' = legacy.version::text
        UNION ALL
        SELECT bae.actor_account_id, bae.occurred_at
          FROM business_audit_events bae
         WHERE bae.resource_type = 'PROBLEM_FORMULATION'
           AND bae.resource_id = legacy.id
           AND bae.event_type = 'CASE_PROBLEM_FORMULATION_CONFIRMED'
      ) confirm_events
      JOIN persons p ON p.account_id = confirm_events.actor_account_id;

    SELECT count(*) INTO dispute_event_count
      FROM (
        SELECT 1
          FROM case_events ce
         WHERE ce.case_id = legacy.case_id
           AND ce.event_type = 'CASE_PROBLEM_FORMULATION_DISPUTED'
           AND ce.metadata ->> 'formulationVersion' = legacy.version::text
        UNION ALL
        SELECT 1
          FROM business_audit_events bae
         WHERE bae.resource_type = 'PROBLEM_FORMULATION'
           AND bae.resource_id = legacy.id
           AND bae.event_type = 'CASE_PROBLEM_FORMULATION_DISPUTED'
      ) dispute_events;

    SELECT count(*) INTO correction_event_count
      FROM (
        SELECT 1
          FROM case_events ce
         WHERE ce.case_id = legacy.case_id
           AND ce.event_type = 'CASE_PROBLEM_FORMULATION_CORRECTED'
           AND ce.metadata ->> 'toFormulationVersion' = legacy.version::text
        UNION ALL
        SELECT 1
          FROM business_audit_events bae
         WHERE bae.resource_type = 'PROBLEM_FORMULATION'
           AND bae.resource_id = legacy.id
           AND bae.event_type = 'CASE_PROBLEM_FORMULATION_CORRECTED'
      ) correction_events;

    SELECT count(*) INTO presented_event_count
      FROM (
        SELECT 1
          FROM case_events ce
         WHERE ce.case_id = legacy.case_id
           AND ce.event_type = 'CASE_PROBLEM_FORMULATION_PRESENTED'
           AND ce.metadata ->> 'formulationVersion' = legacy.version::text
        UNION ALL
        SELECT 1
          FROM business_audit_events bae
         WHERE bae.resource_type = 'PROBLEM_FORMULATION'
           AND bae.resource_id = legacy.id
           AND bae.event_type = 'CASE_PROBLEM_FORMULATION_PRESENTED'
      ) presented_events;

    IF confirm_event_count > 0
       AND (
         dispute_event_count > 0
         OR correction_event_count > 0
         OR user_kind = 'DISPUTE'
         OR user_kind = 'CORRECTION'
       ) THEN
      ambiguous_ids := ambiguous_ids || legacy.id;
      ambiguous_reasons := ambiguous_reasons
        || format('row %s: confirmation and dispute/correction history conflict', legacy.id);
    ELSIF confirm_event_count > 0 THEN
      IF coalesce(array_length(confirmer_ids, 1), 0) <> 1 THEN
        ambiguous_ids := ambiguous_ids || legacy.id;
        ambiguous_reasons := ambiguous_reasons
          || format('row %s: confirmation events do not resolve to exactly one Person', legacy.id);
      ELSE
        resolved_confirmer := confirmer_ids[1];
        SELECT min(event_time) INTO resolved_confirmed_at
          FROM unnest(confirmer_times) AS event_time;
        IF NOT EXISTS (
          SELECT 1
            FROM family_members fm
           WHERE fm.family_id = legacy.family_id
             AND fm.person_id = resolved_confirmer
        ) THEN
          ambiguous_ids := ambiguous_ids || legacy.id;
          ambiguous_reasons := ambiguous_reasons
            || format('row %s: confirmed Person is not a Family member', legacy.id);
        ELSE
          resolved_status := 'CONFIRMED';
        END IF;
      END IF;
    ELSIF dispute_event_count > 0 OR user_kind = 'DISPUTE' THEN
      IF correction_event_count > 0 OR user_kind = 'CORRECTION' THEN
        ambiguous_ids := ambiguous_ids || legacy.id;
        ambiguous_reasons := ambiguous_reasons
          || format('row %s: dispute and correction history conflict', legacy.id);
      ELSE
        resolved_status := 'DISPUTED';
      END IF;
    ELSIF user_kind = 'CONFIRM' THEN
      ambiguous_ids := ambiguous_ids || legacy.id;
      ambiguous_reasons := ambiguous_reasons
        || format('row %s: CONFIRM response has no authoritative confirmation event', legacy.id);
    ELSIF correction_event_count > 0
       OR user_kind = 'CORRECTION'
       OR presented_event_count > 0
       OR legacy.version = 1 THEN
      resolved_status := 'PRESENTED';
    ELSE
      ambiguous_ids := ambiguous_ids || legacy.id;
      ambiguous_reasons := ambiguous_reasons
        || format('row %s: persisted facts do not identify one legal lifecycle', legacy.id);
    END IF;

    IF resolved_status IS NULL THEN
      CONTINUE;
    END IF;

    INSERT INTO auth006_legacy_reconstruction
      (id, resolved_status, confirmer, confirmed_at)
    VALUES
      (legacy.id, resolved_status, resolved_confirmer, resolved_confirmed_at);
  END LOOP;

  IF coalesce(array_length(ambiguous_ids, 1), 0) > 0 THEN
    RAISE EXCEPTION
      'AUTH006_AMBIGUOUS_LEGACY_NEEDS_REVIEW rows=% ids=% reasons=%',
      array_length(ambiguous_ids, 1), ambiguous_ids::text, ambiguous_reasons::text
      USING ERRCODE = 'P0001',
            HINT = 'Reconcile each ambiguous legacy NEEDS_REVIEW row from authoritative lifecycle evidence; no row or schema change was persisted.';
  END IF;

  UPDATE problem_formulations p
     SET status = r.resolved_status::problem_formulation_status,
         confirmed_by_person_id = r.confirmer,
         confirmed_at = r.confirmed_at,
         review_state = 'NEEDS_REVIEW',
         updated_at = now()
    FROM auth006_legacy_reconstruction r
   WHERE p.id = r.id;
END
$$;

ALTER TABLE problem_formulations FORCE ROW LEVEL SECURITY;
ALTER TABLE case_events FORCE ROW LEVEL SECURITY;
ALTER TABLE business_audit_events FORCE ROW LEVEL SECURITY;
ALTER TABLE family_members FORCE ROW LEVEL SECURITY;
ALTER TABLE persons FORCE ROW LEVEL SECURITY;
ALTER TABLE accounts FORCE ROW LEVEL SECURITY;

-- Rebuild the lifecycle enum so NEEDS_REVIEW is not merely hidden behind a
-- runtime validator: it is no longer a legal persisted lifecycle value.
ALTER TABLE problem_formulations
  DROP CONSTRAINT problem_formulations_not_draft_check,
  DROP CONSTRAINT problem_formulations_confirmation_status_check;

DROP INDEX problem_formulations_one_current_per_case;

CREATE TYPE problem_formulation_status_auth006 AS ENUM (
  'DRAFT',
  'PRESENTED',
  'CONFIRMED',
  'DISPUTED',
  'SUPERSEDED'
);

ALTER TABLE problem_formulations
  ALTER COLUMN status TYPE problem_formulation_status_auth006
  USING status::text::problem_formulation_status_auth006;

DROP TYPE problem_formulation_status;
ALTER TYPE problem_formulation_status_auth006 RENAME TO problem_formulation_status;

ALTER TABLE problem_formulations
  ADD CONSTRAINT problem_formulations_not_draft_check
    CHECK (status <> 'DRAFT'),
  ADD CONSTRAINT problem_formulations_confirmation_status_check CHECK (
    CASE status
      WHEN 'CONFIRMED' THEN
        confirmed_by_person_id IS NOT NULL AND confirmed_at IS NOT NULL
      WHEN 'PRESENTED' THEN
        confirmed_by_person_id IS NULL AND confirmed_at IS NULL
      WHEN 'DISPUTED' THEN
        confirmed_by_person_id IS NULL AND confirmed_at IS NULL
      WHEN 'SUPERSEDED' THEN true
      ELSE false
    END
  );

CREATE UNIQUE INDEX problem_formulations_one_current_per_case
  ON problem_formulations (case_id)
  WHERE status <> 'SUPERSEDED';

-- AUTH-006 authoritative review-resolution command. This is the only
-- application command allowed to resolve NEEDS_REVIEW.
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
      'PHONE_USE_ROLEPLAY_SELECT'
    )
  );

ALTER TABLE idempotency_keys
  DROP CONSTRAINT idempotency_keys_key_representation_check;
ALTER TABLE idempotency_keys
  ADD CONSTRAINT idempotency_keys_key_representation_check CHECK (
    (
      command_type NOT IN (
        'CASE_CREATE',
        'CASE_SWITCH_PRIMARY',
        'CASE_START_ASSESSMENT',
        'PROBLEM_FORMULATION_PRESENT',
        'PROBLEM_FORMULATION_CONFIRM',
        'PROBLEM_FORMULATION_DISPUTE',
        'PROBLEM_FORMULATION_CORRECT',
        'CASE_REASSESS_FROM_FORMULATION',
        'PROBLEM_FORMULATION_REVIEW_RESOLVE',
        'CASE_ENTER_SAFETY_HOLD',
        'CASE_RESOLVE_RISK'
      )
      AND idempotency_key IS NOT NULL
      AND idempotency_key_bytes IS NULL
    )
    OR (
      command_type = 'CASE_CREATE'
      AND (
        (idempotency_key IS NOT NULL AND idempotency_key_bytes IS NULL)
        OR (idempotency_key IS NULL AND idempotency_key_bytes IS NOT NULL)
      )
    )
    OR (
      command_type IN (
        'CASE_SWITCH_PRIMARY',
        'CASE_START_ASSESSMENT',
        'PROBLEM_FORMULATION_PRESENT',
        'PROBLEM_FORMULATION_CONFIRM',
        'PROBLEM_FORMULATION_DISPUTE',
        'PROBLEM_FORMULATION_CORRECT',
        'CASE_REASSESS_FROM_FORMULATION',
        'PROBLEM_FORMULATION_REVIEW_RESOLVE',
        'CASE_ENTER_SAFETY_HOLD',
        'CASE_RESOLVE_RISK'
      )
      AND idempotency_key IS NULL
      AND idempotency_key_bytes IS NOT NULL
    )
  );

-- Minimal authoritative review-resolution audit vocabulary. Only the two
-- Problem Formulation AUTH-006 outcomes are added; no generic review runtime.
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
      'CASE_RISK_RESOLVED'
    )
  );

GRANT USAGE ON TYPE problem_formulation_status TO xiaoshuyin_app;
GRANT USAGE ON TYPE problem_formulation_review_state TO xiaoshuyin_app;
GRANT UPDATE (review_state) ON problem_formulations TO xiaoshuyin_app;