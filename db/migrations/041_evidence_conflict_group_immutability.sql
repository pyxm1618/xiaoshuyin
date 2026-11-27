-- Final bounded remediation R02 — Evidence conflict-group immutability at the DB.
--
-- The domain already treats `conflict_group_id` as write-once: legal first
-- grouping and idempotent re-assignment are allowed, while migrating an
-- existing group to another group (or clearing it) fails closed. Before this
-- migration the database accepted any of those transitions through the
-- column-level runtime grant, so a direct UPDATE could silently rewrite the
-- conflict-group history.
--
-- Allowed:   NULL -> A  (first legal grouping)
--            A    -> A  (repeat / idempotent assignment)
-- Rejected:  A    -> B  (silent migration)
--            A    -> NULL (silent history erasure)
--
-- Forward-only: historical rows are not rewritten and no escape hatch is
-- introduced. Both Evidence tables share the same frozen invariant.
-- Historical migrations 001-040 remain immutable.

CREATE OR REPLACE FUNCTION evidence_conflict_group_immutable_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $function$
BEGIN
  IF OLD.conflict_group_id IS NOT NULL
     AND NEW.conflict_group_id IS DISTINCT FROM OLD.conflict_group_id THEN
    RAISE EXCEPTION
      'EVIDENCE_CONFLICT_GROUP_IMMUTABLE: conflict_group_id is write-once'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END
$function$;

REVOKE ALL ON FUNCTION evidence_conflict_group_immutable_guard() FROM PUBLIC;

CREATE TRIGGER assertions_conflict_group_immutable
  BEFORE UPDATE OF conflict_group_id ON assertions
  FOR EACH ROW EXECUTE FUNCTION evidence_conflict_group_immutable_guard();

CREATE TRIGGER observations_conflict_group_immutable
  BEFORE UPDATE OF conflict_group_id ON observations
  FOR EACH ROW EXECUTE FUNCTION evidence_conflict_group_immutable_guard();
