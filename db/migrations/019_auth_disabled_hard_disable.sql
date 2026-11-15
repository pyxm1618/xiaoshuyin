-- AUTH-001 — DISABLED Account Hard Disable
--
-- Account status is an authority fact. Any status transition invalidates every
-- credential minted under the previous authority epoch. This applies in both
-- directions so DISABLED -> ACTIVE can never revive a pre-disable token.
--
-- Operational re-enable workflow remains out of scope; this migration only
-- makes the credential invalidation invariant mechanical at the database seam.

CREATE FUNCTION app.invalidate_account_sessions_on_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.session_epoch := OLD.session_epoch + 1;
  END IF;
  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION app.invalidate_account_sessions_on_status_change() FROM PUBLIC;

CREATE TRIGGER accounts_status_invalidates_sessions
  BEFORE UPDATE OF status ON accounts
  FOR EACH ROW
  EXECUTE FUNCTION app.invalidate_account_sessions_on_status_change();
