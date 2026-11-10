-- ============================================================================
-- 006_case_status_paused_removal.sql — Case-level PAUSED removal
--
-- Upstream: PR #21 removed Case-level PAUSED from the authoritative Docs.
-- This forward migration performs the only database-side change: it narrows
-- `public.case_status` from six labels to five, in the frozen order:
--
--   OPEN, WAITING, LOST_CONTACT, SAFETY_HOLD, CLOSED
--
-- Historical migrations 001–005 are immutable and keep the six-label type.
--
-- Data safety: if any `cases.status = 'PAUSED'` row exists, this migration
-- FAILS and rolls back. No automatic mapping to any other status is allowed;
-- no product contract authorizes reinterpreting a historical PAUSED Case.
--
-- Direct dependencies of `case_status` that must survive unchanged:
--   * cases.status column
--   * cases_one_primary_open_per_family (partial unique, predicate refs 'CLOSED')
--   * cases_family_status_idx
--   * GRANT USAGE ON TYPE case_status TO xiaoshuyin_app
--   * cases RLS: ENABLE + FORCE
--
-- The migrator executes this file inside a single transaction. Do not add
-- BEGIN / COMMIT here.
-- ============================================================================

-- ── Step 01: refuse a pre-existing intermediate type ────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM pg_type t
      JOIN pg_namespace n ON n.oid = t.typnamespace
     WHERE n.nspname = 'public' AND t.typname = 'case_status_v2'
  ) THEN
    RAISE EXCEPTION 'S3M02_CASE_STATUS_INTERMEDIATE_TYPE_EXISTS:case_status_v2'
      USING ERRCODE = 'P0001';
  END IF;
END;
$$;

-- ── Step 02: make the whole table visible to the migrator ───
-- cases has FORCE ROW LEVEL SECURITY and the migrator is NOBYPASSRLS with no
-- app.family_id context, so a plain count would silently see zero rows.
-- FORCE is restored before this file commits; any failure rolls it back.
ALTER TABLE cases NO FORCE ROW LEVEL SECURITY;

-- ── Step 03: refuse to reinterpret existing PAUSED rows ─────
DO $$
DECLARE
  paused_rows bigint;
BEGIN
  SELECT count(*) INTO paused_rows FROM cases WHERE status = 'PAUSED';
  IF paused_rows > 0 THEN
    RAISE EXCEPTION 'S3M01_CASE_PAUSED_ROWS_EXIST:% row(s)', paused_rows
      USING ERRCODE = 'P0001';
  END IF;
END;
$$;

-- ── Step 04: drop the two direct index dependencies ─────────
DROP INDEX cases_one_primary_open_per_family;
DROP INDEX cases_family_status_idx;

-- ── Step 05: replace the enum type ──────────────────────────
-- Stage the five-label type under an intermediate name first so the label
-- set cannot be extended in place; the official name is restored below.
CREATE TYPE case_status_v2 AS ENUM (
  'OPEN',
  'WAITING',
  'LOST_CONTACT',
  'SAFETY_HOLD',
  'CLOSED'
);

ALTER TABLE cases
  ALTER COLUMN status TYPE case_status_v2
  USING status::text::case_status_v2;

-- No CASCADE: any missed dependency must fail loudly instead of being dropped.
DROP TYPE case_status;

ALTER TYPE case_status_v2 RENAME TO case_status;

-- ── Step 06: restore the index definitions verbatim ─────────
CREATE UNIQUE INDEX cases_one_primary_open_per_family
  ON cases (family_id)
  WHERE is_primary AND status <> 'CLOSED';

CREATE INDEX cases_family_status_idx
  ON cases (family_id, status);

-- ── Step 07: restore the type privilege ─────────────────────
GRANT USAGE ON TYPE case_status TO xiaoshuyin_app;

-- ── Step 08: restore FORCE ROW LEVEL SECURITY ───────────────
ALTER TABLE cases FORCE ROW LEVEL SECURITY;

-- ── Step 09: postconditions ─────────────────────────────────
DO $$
DECLARE
  labels text[];
  index_count integer;
  predicate_ok integer;
  rls_ok boolean;
  priv_ok boolean;
  leftover integer;
BEGIN
  SELECT array_agg(e.enumlabel::text ORDER BY e.enumsortorder) INTO labels
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
   WHERE n.nspname = 'public' AND t.typname = 'case_status';

  IF labels IS DISTINCT FROM ARRAY[
       'OPEN', 'WAITING', 'LOST_CONTACT', 'SAFETY_HOLD', 'CLOSED'
     ]::text[] THEN
    RAISE EXCEPTION 'S3M03_CASE_STATUS_POSTCONDITION_FAILED:enum_labels=%', labels
      USING ERRCODE = 'P0001';
  END IF;

  SELECT count(*) INTO index_count
    FROM pg_indexes
   WHERE schemaname = 'public' AND tablename = 'cases'
     AND indexname IN ('cases_one_primary_open_per_family', 'cases_family_status_idx');
  IF index_count <> 2 THEN
    RAISE EXCEPTION 'S3M03_CASE_STATUS_POSTCONDITION_FAILED:index_count=%', index_count
      USING ERRCODE = 'P0001';
  END IF;

  SELECT count(*) INTO predicate_ok
    FROM pg_indexes
   WHERE schemaname = 'public' AND tablename = 'cases'
     AND indexname = 'cases_one_primary_open_per_family'
     AND indexdef LIKE '%CLOSED%';
  IF predicate_ok <> 1 THEN
    RAISE EXCEPTION 'S3M03_CASE_STATUS_POSTCONDITION_FAILED:index_predicate'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT (relrowsecurity AND relforcerowsecurity) INTO rls_ok
    FROM pg_class WHERE oid = 'cases'::regclass;
  IF rls_ok IS NOT TRUE THEN
    RAISE EXCEPTION 'S3M03_CASE_STATUS_POSTCONDITION_FAILED:rls_force'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT has_type_privilege('xiaoshuyin_app', 'public.case_status', 'USAGE') INTO priv_ok;
  IF priv_ok IS NOT TRUE THEN
    RAISE EXCEPTION 'S3M03_CASE_STATUS_POSTCONDITION_FAILED:type_usage_grant'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT count(*) INTO leftover
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
   WHERE n.nspname = 'public' AND t.typname = 'case_status_v2';
  IF leftover <> 0 THEN
    RAISE EXCEPTION 'S3M03_CASE_STATUS_POSTCONDITION_FAILED:intermediate_type_leftover'
      USING ERRCODE = 'P0001';
  END IF;
END;
$$;