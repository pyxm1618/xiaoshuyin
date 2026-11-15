-- AUTH-006 — Problem Formulation lifecycle / review-state reconciliation.
--
-- Forward-only reconciliation. Historical migration 008 remains immutable.
--
-- Legacy rows whose lifecycle column is NEEDS_REVIEW cannot be reconstructed
-- safely: migration 008 did not persist the prior lifecycle value. Refuse the
-- upgrade before changing schema rather than fabricate historical lifecycle.
DO $auth006$
DECLARE
  legacy_count bigint;
BEGIN
  SELECT count(*) INTO legacy_count
    FROM problem_formulations
   WHERE status = 'NEEDS_REVIEW';

  IF legacy_count > 0 THEN
    RAISE EXCEPTION
      'AUTH006_LEGACY_PROBLEM_FORMULATION_NEEDS_REVIEW_ROWS_REQUIRE_MANUAL_RECONCILIATION:% row(s)',
      legacy_count;
  END IF;
END
$auth006$;

CREATE TYPE problem_formulation_review_state AS ENUM (
  'CURRENT',
  'NEEDS_REVIEW'
);

ALTER TABLE problem_formulations
  ADD COLUMN review_state problem_formulation_review_state
  NOT NULL DEFAULT 'CURRENT';

-- Replace only the active lifecycle type. PostgreSQL enums cannot remove a
-- value in place, so the forward migration narrows through a replacement type.
DROP INDEX problem_formulations_one_current_per_case;

ALTER TABLE problem_formulations
  DROP CONSTRAINT problem_formulations_not_draft_check,
  DROP CONSTRAINT problem_formulations_confirmation_status_check;

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
    (
      status = 'CONFIRMED'
      AND confirmed_by_person_id IS NOT NULL
      AND confirmed_at IS NOT NULL
    )
    OR (
      status IN ('PRESENTED', 'DISPUTED')
      AND confirmed_by_person_id IS NULL
      AND confirmed_at IS NULL
    )
    OR status = 'SUPERSEDED'
  );

CREATE UNIQUE INDEX problem_formulations_one_current_per_case
  ON problem_formulations (case_id)
  WHERE status <> 'SUPERSEDED';

GRANT USAGE ON TYPE problem_formulation_status TO xiaoshuyin_app;
GRANT USAGE ON TYPE problem_formulation_review_state TO xiaoshuyin_app;
GRANT UPDATE (review_state) ON problem_formulations TO xiaoshuyin_app;
