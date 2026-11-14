-- Foundation Remediation 1 — Database / Integrity
--
-- Forward-only remediation for:
--   REM1-001 accounts database access isolation
--   REM1-002 consent_records immutable-history privileges
--   REM1-003 business_audit_events append-only privileges
--   REM1-004 migration content integrity metadata
--
-- Historical migrations remain unchanged.

-- ── Step 01: migration checksum metadata ────────────────────
-- Existing databases may have filename/applied_at-only rows. NULL checksum
-- metadata is permitted only as the deterministic transition state; the
-- authoritative runner binds those rows to the repository bytes it first sees
-- after this migration becomes effective.
ALTER TABLE schema_migrations
  ADD COLUMN IF NOT EXISTS content_checksum text,
  ADD COLUMN IF NOT EXISTS checksum_origin text,
  ADD COLUMN IF NOT EXISTS checksum_bound_at timestamptz;

ALTER TABLE schema_migrations
  ADD CONSTRAINT schema_migrations_checksum_state_check CHECK (
    (
      content_checksum IS NULL
      AND checksum_origin IS NULL
      AND checksum_bound_at IS NULL
    )
    OR
    (
      content_checksum ~ '^[0-9a-f]{64}$'
      AND checksum_origin IN ('APPLIED', 'LEGACY_BASELINE')
      AND checksum_bound_at IS NOT NULL
    )
  );

-- ── Step 02: exact OpenID transaction context ───────────────
-- Login / binding must discover one exact Account before its UUID is known.
-- Keep that discovery inside the existing transaction-local GUC trust model
-- rather than leaving accounts globally readable.
CREATE FUNCTION app_account_openid() RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.account_openid', true), '')
$$;

CREATE FUNCTION app.set_account_openid_context(p_openid text)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  IF p_openid IS NULL OR length(p_openid) < 1 OR length(p_openid) > 128 THEN
    RAISE EXCEPTION 'RLS_CONTEXT_REQUIRED' USING ERRCODE = '42501';
  END IF;
  PERFORM set_config('app.account_openid', p_openid, true);
END $$;

REVOKE ALL ON FUNCTION app_account_openid() FROM PUBLIC;
REVOKE ALL ON FUNCTION app.set_account_openid_context(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_account_openid() TO xiaoshuyin_app;
GRANT EXECUTE ON FUNCTION app.set_account_openid_context(text) TO xiaoshuyin_app;

-- ── Step 03: accounts least-privilege RLS ───────────────────
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts FORCE ROW LEVEL SECURITY;

-- Maintenance authority is explicit and distinct from ordinary runtime.
CREATE POLICY accounts_migrator_all ON accounts
  TO xiaoshuyin_migrator
  USING (true)
  WITH CHECK (true);

-- Runtime reads are limited to the authenticated Account, the exact verified
-- OpenID in the current login/binding transaction, or the exact binding
-- candidate/committed Account already present in binding context.
CREATE POLICY accounts_runtime_read ON accounts
  FOR SELECT
  TO xiaoshuyin_app
  USING (
    (
      app_current_purpose() = 'SELF_IDENTITY'
      AND id = app_account_id()
    )
    OR
    (
      app_current_purpose() IN (
        'SELF_IDENTITY',
        'IDENTITY_BINDING_GATE',
        'IDENTITY_BINDING_COMMIT'
      )
      AND wechat_openid = app_account_openid()
    )
    OR
    (
      app_current_purpose() IN ('IDENTITY_BINDING_GATE', 'IDENTITY_BINDING_COMMIT')
      AND (
        id = app_binding_candidate_account_id()
        OR id = app_binding_commit_account_id()
      )
    )
  );

CREATE POLICY accounts_runtime_insert ON accounts
  FOR INSERT
  TO xiaoshuyin_app
  WITH CHECK (
    app_current_purpose() IN ('SELF_IDENTITY', 'IDENTITY_BINDING_COMMIT')
    AND wechat_openid = app_account_openid()
  );

-- Ordinary authenticated Account mutation is self-only. Column privileges
-- below further restrict the mutable surface to session bookkeeping.
CREATE POLICY accounts_runtime_self_update ON accounts
  FOR UPDATE
  TO xiaoshuyin_app
  USING (
    app_current_purpose() = 'SELF_IDENTITY'
    AND id = app_account_id()
  )
  WITH CHECK (
    app_current_purpose() = 'SELF_IDENTITY'
    AND id = app_account_id()
  );

-- Binding needs row locks to serialize Account reuse, but never business-field
-- mutation. WITH CHECK(false) makes this an exact-row locking policy only.
CREATE POLICY accounts_binding_lock ON accounts
  FOR UPDATE
  TO xiaoshuyin_app
  USING (
    app_current_purpose() IN ('IDENTITY_BINDING_GATE', 'IDENTITY_BINDING_COMMIT')
    AND (
      wechat_openid = app_account_openid()
      OR id = app_binding_candidate_account_id()
      OR id = app_binding_commit_account_id()
    )
  )
  WITH CHECK (false);

REVOKE UPDATE, DELETE ON accounts FROM xiaoshuyin_app;
GRANT UPDATE (session_epoch, last_login_at) ON accounts TO xiaoshuyin_app;

-- ── Step 04: immutable Consent history privileges ───────────
-- Consent state changes are append/supersede facts. The only legitimate UPDATE
-- is the one-time binding pair; existing database triggers enforce that pair
-- can move from (NULL,NULL) exactly once and supplemental rows reject all
-- UPDATEs.
REVOKE UPDATE, DELETE ON consent_records FROM xiaoshuyin_app;
GRANT UPDATE (bound_person_id, bound_at) ON consent_records TO xiaoshuyin_app;

-- ── Step 05: business audit append-only privileges ──────────
-- Runtime may append/read family-scoped events, but cannot rewrite history.
REVOKE UPDATE, DELETE ON business_audit_events FROM xiaoshuyin_app;
