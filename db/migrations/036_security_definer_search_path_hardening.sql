-- ============================================================================
-- Remediation V2 Finding #15 — SECURITY DEFINER privilege-boundary hardening
-- Forward-only migration. Historical migrations are intentionally untouched.
--
-- PostgreSQL implicitly searches the session temporary schema before ordinary
-- search_path entries for relations/types when pg_temp is omitted. Runtime
-- roles retain TEMP capability, so every SECURITY DEFINER function that uses
-- unqualified relation names must put pg_temp explicitly last and every named
-- schema ahead of it must be non-writable by untrusted roles.
-- ============================================================================

-- Preserve runtime USAGE while making named schemas non-writable even on
-- upgraded databases that may carry legacy CREATE grants.
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
REVOKE CREATE ON SCHEMA public FROM xiaoshuyin_app;
REVOKE CREATE ON SCHEMA app FROM PUBLIC;
REVOKE CREATE ON SCHEMA app FROM xiaoshuyin_app;

-- Scene artifact trigger: SECURITY DEFINER was introduced in migration 016.
-- Trigger execution does not require a direct runtime EXECUTE grant; remove the
-- default PUBLIC function privilege and make temporary-object resolution last.
ALTER FUNCTION public.scene_artifacts_insert_guard()
  SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.scene_artifacts_insert_guard()
  SET row_security = on;
REVOKE ALL ON FUNCTION public.scene_artifacts_insert_guard() FROM PUBLIC;

-- Goal confirmation: preserve the existing runtime grant and row-security
-- semantics; only the name-resolution / privilege boundary is hardened.
ALTER FUNCTION app.confirm_goal_transition(uuid, integer, uuid, integer, uuid)
  SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION app.confirm_goal_transition(uuid, integer, uuid, integer, uuid)
  SET row_security = on;
REVOKE ALL ON FUNCTION app.confirm_goal_transition(uuid, integer, uuid, integer, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.confirm_goal_transition(uuid, integer, uuid, integer, uuid)
  TO xiaoshuyin_app;

-- Professional Knowledge privileged commits require the trusted app schema for
-- helper resolution; pg_temp remains explicit and last.
ALTER FUNCTION app.commit_professional_knowledge_review(
  uuid, integer, text, text, text, text, timestamptz, text, text
) SET search_path = pg_catalog, public, app, pg_temp;
REVOKE ALL ON FUNCTION app.commit_professional_knowledge_review(
  uuid, integer, text, text, text, text, timestamptz, text, text
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.commit_professional_knowledge_review(
  uuid, integer, text, text, text, text, timestamptz, text, text
) TO xiaoshuyin_app;

ALTER FUNCTION app.commit_professional_knowledge_release(
  uuid, integer, timestamptz, jsonb
) SET search_path = pg_catalog, public, app, pg_temp;
REVOKE ALL ON FUNCTION app.commit_professional_knowledge_release(
  uuid, integer, timestamptz, jsonb
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.commit_professional_knowledge_release(
  uuid, integer, timestamptz, jsonb
) TO xiaoshuyin_app;
