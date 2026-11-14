-- ============================================================================
-- Slice 1 Consent Owner — 01004 Audit 2 narrow remediation
-- Migration: 014_consent_01004_cross_purpose_supersede_guard.sql
--
-- New forward migration. No historical migration (012 / 013) is edited.
--
-- Scope:
--   1. refuse any existing cross-purpose supersession chain (fail closed)
--   2. enforce successor.purpose = predecessor.purpose for EVERY purpose
--
-- NOT done here:
--   - no table / column / index / RLS / enum / audit vocabulary change
--   - no historical data repair, rewrite, deletion or reinterpretation
--   - no generic Consent / supersession framework
--   - no public Consent API, no 01004 Scene runtime
-- ============================================================================

-- ── Step 01: existing-data preflight ────────────────────────────────────────
-- A new trigger can only stop future bad chains. Before installing it, prove
-- that the current dataset contains no cross-purpose supersession at all.
-- `consent_records` is FORCE RLS; the migration owner must temporarily read the
-- whole table so the preflight is not a silent zero-row false negative. On any
-- failure the enclosing migration transaction rolls this back together with the
-- error below, so the original FORCE state is preserved.
ALTER TABLE consent_records NO FORCE ROW LEVEL SECURITY;

DO $$
DECLARE
  v_cross_purpose_rows integer;
BEGIN
  SELECT count(*)::integer INTO v_cross_purpose_rows
    FROM consent_records successor
    JOIN consent_records predecessor ON predecessor.id = successor.supersedes_id
   WHERE successor.purpose <> predecessor.purpose;

  IF v_cross_purpose_rows > 0 THEN
    RAISE EXCEPTION
      'CONSENT_EXISTING_CROSS_PURPOSE_SUPERSESSION: % row(s)',
      v_cross_purpose_rows
      USING ERRCODE = '23514';
  END IF;
END $$;

ALTER TABLE consent_records FORCE ROW LEVEL SECURITY;

-- ── Step 02: purpose-identity supersession guard (all purposes) ─────────────
-- The predecessor of any consent decision must belong to the exact same
-- purpose. This is deliberately independent of the supplemental-only guard in
-- 013: a GUARDIAN successor may never supersede a SUPPLEMENTAL predecessor,
-- and a SUPPLEMENTAL successor may never supersede a GUARDIAN predecessor.
--
-- The supplemental branch keeps its complete Family + Case + purpose + actor
-- scope and version + 1 validation in 013; this function only adds the missing
-- purpose-identity invariant for every purpose, so guardian legal chains keep
-- working unchanged.
CREATE FUNCTION consent_records_supersede_purpose_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_predecessor_purpose consent_purpose;
BEGIN
  IF NEW.supersedes_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT purpose INTO v_predecessor_purpose
    FROM consent_records
   WHERE id = NEW.supersedes_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CONSENT_SUPERSEDE_TARGET_MISSING' USING ERRCODE = '23514';
  END IF;

  IF v_predecessor_purpose <> NEW.purpose THEN
    RAISE EXCEPTION 'CONSENT_SUPERSEDE_CROSS_PURPOSE' USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END $$;

CREATE TRIGGER consent_records_supersede_purpose_guard
  BEFORE INSERT ON consent_records
  FOR EACH ROW EXECUTE FUNCTION consent_records_supersede_purpose_guard();

COMMENT ON FUNCTION consent_records_supersede_purpose_guard() IS
  'Rejects any supersession whose successor purpose differs from its predecessor purpose (Audit 2 HIGH-01).';