-- Slice 17 Phase 3 entry — close direct consumable INSERT bypass.
-- Forward-only: preserve historical 025/026 identities and checksums.
BEGIN;

CREATE FUNCTION app.guard_professional_knowledge_version_insert_lifecycle()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $function$
BEGIN
  -- The runtime application role may create only a pristine Candidate.
  -- Review/validity/release state must be earned through the existing
  -- mutation/review/release authority paths; an INSERT cannot mint a
  -- consumable Published/Current/Valid version.
  IF current_user = 'xiaoshuyin_app'
     AND (
       NEW.lifecycle_status <> 'CANDIDATE'
       OR NEW.review_state <> 'PENDING'
       OR NEW.validity_state <> 'UNKNOWN'
       OR NEW.revision <> 1
       OR NEW.released_at IS NOT NULL
       OR NEW.effective_from IS NOT NULL
       OR NEW.effective_to IS NOT NULL
     ) THEN
    RAISE EXCEPTION 'PROFESSIONAL_KNOWLEDGE_INITIAL_STATE_REQUIRED'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END
$function$;

REVOKE ALL ON FUNCTION app.guard_professional_knowledge_version_insert_lifecycle()
  FROM PUBLIC;

CREATE TRIGGER yy_professional_knowledge_insert_lifecycle_guard
  BEFORE INSERT ON professional_knowledge_versions
  FOR EACH ROW
  EXECUTE FUNCTION app.guard_professional_knowledge_version_insert_lifecycle();

COMMIT;
