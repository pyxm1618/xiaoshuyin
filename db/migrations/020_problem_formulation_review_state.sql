-- ============================================================
-- AUTH-006 — Problem Formulation Review-State Reconciliation
-- Migration: 020_problem_formulation_review_state.sql
--
-- Forward-only reconciliation of the Slice 8 lifecycle/review-state conflict.
-- Historical migration 008 remains immutable.
--
-- Data-governance rule:
--   legacy status=NEEDS_REVIEW rows do not retain enough authoritative
--   information to reconstruct their prior lifecycle without guessing.
--   Therefore this migration fails closed before any schema change when such
--   rows exist. An operator must reconcile those rows from external,
--   authoritative evidence before re-running the migration.
-- ============================================================

-- problem_formulations is FORCE RLS. The migrator owns the table, but FORCE
-- would still hide legacy rows from this existing-data preflight. Temporarily
-- remove FORCE (not RLS itself) so the owner sees every row. Each migration is
-- transactional; if the preflight raises, this catalog change rolls back with
-- the failure and FORCE remains in effect.
ALTER TABLE problem_formulations NO FORCE ROW LEVEL SECURITY;

DO $
DECLARE
  ambiguous_count bigint;
BEGIN
  SELECT count(*) INTO ambiguous_count
    FROM problem_formulations
   WHERE status::text = 'NEEDS_REVIEW';

  IF ambiguous_count <> 0 THEN
    RAISE EXCEPTION
      'AUTH006_AMBIGUOUS_LEGACY_NEEDS_REVIEW rows=%: automatic lifecycle reconstruction is forbidden',
      ambiguous_count
      USING ERRCODE = 'P0001',
            HINT = 'Reconcile each legacy NEEDS_REVIEW row from authoritative lifecycle evidence before applying AUTH-006.';
  END IF;
END
$;

ALTER TABLE problem_formulations FORCE ROW LEVEL SECURITY;

CREATE TYPE problem_formulation_review_state AS ENUM (
  'CURRENT',
  'NEEDS_REVIEW'
);

ALTER TABLE problem_formulations
  ADD COLUMN review_state problem_formulation_review_state NOT NULL DEFAULT 'CURRENT';

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

GRANT USAGE ON TYPE problem_formulation_status TO xiaoshuyin_app;
GRANT USAGE ON TYPE problem_formulation_review_state TO xiaoshuyin_app;
GRANT UPDATE (review_state) ON problem_formulations TO xiaoshuyin_app;
