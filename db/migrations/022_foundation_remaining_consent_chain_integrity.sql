-- Foundation Remaining Remediation — guardian Consent chain integrity
--
-- The supplemental purpose already enforces one successor per predecessor.
-- Guardian Consent used to rely only on route sequencing and a bound-person
-- version key, which left an unbound/history branch window. This forward-only
-- migration makes the same append-only chain invariant structural for the
-- existing guardian purpose without creating a second ledger.

ALTER TABLE consent_records NO FORCE ROW LEVEL SECURITY;

DO $$
DECLARE
  v_branched_predecessors integer;
BEGIN
  SELECT count(*)::integer
    INTO v_branched_predecessors
    FROM (
      SELECT supersedes_id
        FROM consent_records
       WHERE purpose = 'UNDER_14_GUARDIAN_CONSENT'
         AND supersedes_id IS NOT NULL
       GROUP BY supersedes_id
      HAVING count(*) > 1
    ) branched;

  IF v_branched_predecessors > 0 THEN
    RAISE EXCEPTION
      'GUARDIAN_CONSENT_EXISTING_BRANCH: % predecessor(s)',
      v_branched_predecessors
      USING ERRCODE = '23514';
  END IF;
END $$;

ALTER TABLE consent_records FORCE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX consent_guardian_supersedes_key
  ON consent_records (supersedes_id)
  WHERE purpose = 'UNDER_14_GUARDIAN_CONSENT'
    AND supersedes_id IS NOT NULL;
