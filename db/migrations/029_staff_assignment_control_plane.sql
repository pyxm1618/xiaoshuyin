BEGIN;

-- Extend the existing finite vocabularies without reconstructing their prior entries.
DO $$
DECLARE
  extension record;
  previous_expression text;
BEGIN
  FOR extension IN
    SELECT * FROM (VALUES
      ('idempotency_keys', 'idempotency_keys_command_type_check',
       'command_type IN (''STAFF_AUTHORITY_GRANT'', ''STAFF_AUTHORITY_REVOKE'')'),
      ('business_audit_events', 'business_audit_events_resource_type_check',
       'resource_type = ''STAFF_ASSIGNMENT'''),
      ('business_audit_events', 'business_audit_events_scope_shape_check',
       'resource_type = ''STAFF_ASSIGNMENT'''),
      ('business_audit_events', 'business_audit_events_event_type_check',
       'event_type IN (''STAFF_AUTHORITY_GRANTED'', ''STAFF_AUTHORITY_REVOKED'')')
    ) AS extensions(table_name, constraint_name, new_expression)
  LOOP
    SELECT pg_get_expr(conbin, conrelid) INTO STRICT previous_expression
      FROM pg_constraint
     WHERE conrelid = extension.table_name::regclass
       AND conname = extension.constraint_name;
    EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I',
      extension.table_name, extension.constraint_name);
    EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I CHECK ((%s) OR (%s))',
      extension.table_name, extension.constraint_name, previous_expression, extension.new_expression);
  END LOOP;
END $$;

ALTER TABLE business_audit_events ADD CONSTRAINT business_audit_staff_event_pair_check
  CHECK ((resource_type = 'STAFF_ASSIGNMENT') =
         (event_type IN ('STAFF_AUTHORITY_GRANTED', 'STAFF_AUTHORITY_REVOKED')));

-- The existing migrator owns the bounded definer functions and remains NOBYPASSRLS.
-- Purpose is only a policy selector. Every callable function verifies live authority.
CREATE POLICY staff_control_read ON staff_assignments FOR SELECT TO xiaoshuyin_migrator
  USING (session_user = 'xiaoshuyin_app' AND app_current_purpose() = 'STAFF_AUTHORITY_CONTROL');
CREATE POLICY staff_control_insert ON staff_assignments FOR INSERT TO xiaoshuyin_migrator
  WITH CHECK (
    session_user = 'xiaoshuyin_app' AND app_current_purpose() = 'STAFF_AUTHORITY_CONTROL'
    AND granted_by_account_id = app_account_id() AND account_id <> app_account_id()
    AND person_id <> app_person_id() AND revoked_at IS NULL
  );
CREATE POLICY staff_control_revoke ON staff_assignments FOR UPDATE TO xiaoshuyin_migrator
  USING (session_user = 'xiaoshuyin_app' AND app_current_purpose() = 'STAFF_AUTHORITY_CONTROL'
         AND revoked_at IS NULL)
  WITH CHECK (session_user = 'xiaoshuyin_app' AND app_current_purpose() = 'STAFF_AUTHORITY_CONTROL'
              AND revoked_by_account_id = app_account_id() AND revoked_at IS NOT NULL);

CREATE POLICY staff_control_audit ON business_audit_events FOR INSERT TO xiaoshuyin_migrator
  WITH CHECK (
    session_user = 'xiaoshuyin_app' AND app_current_purpose() = 'STAFF_AUTHORITY_CONTROL'
    AND resource_type = 'STAFF_ASSIGNMENT' AND actor_account_id = app_account_id()
  );
CREATE POLICY staff_control_no_runtime_audit ON business_audit_events
  AS RESTRICTIVE FOR INSERT TO xiaoshuyin_app
  WITH CHECK (resource_type <> 'STAFF_ASSIGNMENT');

CREATE FUNCTION app.require_staff_authority_control(p_epoch integer, p_mutation boolean)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  actor_id uuid := app_account_id();
  actor_person uuid := app_person_id();
  checked_at timestamptz;
BEGIN
  IF session_user <> 'xiaoshuyin_app'
     OR app_current_purpose() IS DISTINCT FROM 'STAFF_AUTHORITY_CONTROL'
     OR actor_id IS NULL OR actor_person IS NULL OR p_epoch IS NULL
     OR p_mutation IS NULL THEN
    RAISE EXCEPTION 'STAFF_AUTHORITY_CONTROL_DENIED' USING ERRCODE = '42501';
  END IF;
  -- Mutations may cross each other's actor/target accounts. Order those
  -- commands before taking account locks. Consumers retain their existing keys.
  IF p_mutation THEN
    PERFORM pg_advisory_xact_lock(hashtextextended('STAFF_AUTHORITY_CONTROL_MUTATION', 0));
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('AUTH_ACCOUNT:' || actor_id::text, 0));
  checked_at := clock_timestamp();
  IF NOT EXISTS (
    SELECT 1 FROM staff_assignments sa
    JOIN accounts a ON a.id = sa.account_id
    WHERE sa.account_id = actor_id AND sa.person_id = actor_person
      AND a.status = 'ACTIVE' AND a.session_epoch = p_epoch
      AND sa.capability = 'SERVICE_CONTROL' AND sa.scope_type = 'GLOBAL'
      AND sa.revoked_at IS NULL AND sa.valid_from <= checked_at
      AND (sa.valid_until IS NULL OR checked_at < sa.valid_until)
  ) THEN
    RAISE EXCEPTION 'STAFF_AUTHORITY_CONTROL_DENIED' USING ERRCODE = '42501';
  END IF;
  RETURN actor_person;
END $$;

CREATE FUNCTION app.audit_staff_authority(p_assignment staff_assignments, p_event text)
RETURNS void LANGUAGE sql
SET search_path = pg_catalog, public, pg_temp
AS $$
  INSERT INTO business_audit_events
    (family_id, actor_account_id, event_type, resource_type, resource_id, occurred_at, metadata)
  VALUES (
    p_assignment.family_id, app_account_id(), p_event, 'STAFF_ASSIGNMENT', p_assignment.id, clock_timestamp(),
    jsonb_build_object(
      'accountId', p_assignment.account_id, 'personId', p_assignment.person_id,
      'capability', p_assignment.capability, 'scope', p_assignment.scope_type,
      'caseId', p_assignment.case_id, 'parentGrantId', p_assignment.capability_grant_id
    )
  );
$$;

CREATE FUNCTION app.grant_staff_authority(
  p_epoch integer, p_account uuid, p_person uuid, p_capability text, p_scope text,
  p_family uuid, p_case uuid, p_parent uuid, p_from timestamptz, p_until timestamptz
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  actor_person uuid;
  assignment staff_assignments;
  checked_at timestamptz;
BEGIN
  actor_person := app.require_staff_authority_control(p_epoch, true);
  IF p_account = app_account_id() OR p_person = actor_person THEN
    RAISE EXCEPTION 'STAFF_AUTHORITY_SELF_GRANT_DENIED' USING ERRCODE = '42501';
  END IF;
  IF p_account IS NULL OR p_person IS NULL OR p_capability IS NULL
     OR p_scope IS NULL OR p_scope NOT IN ('GLOBAL', 'CASE')
     OR (p_scope = 'GLOBAL' AND (p_family IS NOT NULL OR p_case IS NOT NULL OR p_parent IS NOT NULL))
     OR (p_scope = 'CASE' AND (p_family IS NULL OR p_case IS NULL OR p_parent IS NULL))
     OR p_from IS NULL OR NOT isfinite(p_from)
     OR (p_until IS NOT NULL AND (NOT isfinite(p_until) OR p_until <= p_from)) THEN
    RAISE EXCEPTION 'STAFF_AUTHORITY_GRANT_INVALID' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('AUTH_ACCOUNT:' || p_account::text, 0));
  -- Check operator again after waiting on the target and use wall-clock time.
  PERFORM app.require_staff_authority_control(p_epoch, true);
  checked_at := clock_timestamp();
  IF p_scope = 'CASE' AND NOT EXISTS (
    SELECT 1 FROM staff_assignments sa
    WHERE sa.id = p_parent AND sa.account_id = p_account AND sa.person_id = p_person
      AND sa.capability = p_capability AND sa.scope_type = 'GLOBAL'
      AND sa.revoked_at IS NULL AND sa.valid_from <= checked_at
      AND (sa.valid_until IS NULL OR checked_at < sa.valid_until)
  ) THEN
    RAISE EXCEPTION 'STAFF_AUTHORITY_PARENT_INVALID' USING ERRCODE = '22023';
  END IF;
  -- Reject overlapping windows, including scheduled grants. Revoked authority
  -- remains historical and never contributes an active interval.
  IF EXISTS (
    SELECT 1 FROM staff_assignments sa
    WHERE sa.account_id = p_account AND sa.person_id = p_person
      AND sa.capability = p_capability AND sa.scope_type = p_scope
      AND sa.case_id IS NOT DISTINCT FROM p_case AND sa.revoked_at IS NULL
      AND (p_until IS NULL OR sa.valid_from < p_until)
      AND (sa.valid_until IS NULL OR p_from < sa.valid_until)
      AND (sa.scope_type = 'GLOBAL' OR EXISTS (
        SELECT 1 FROM staff_assignments parent
        WHERE parent.id = sa.capability_grant_id AND parent.revoked_at IS NULL
          AND (parent.valid_until IS NULL OR p_from < parent.valid_until)
      ))
  ) THEN
    RAISE EXCEPTION 'STAFF_AUTHORITY_GRANT_OVERLAP' USING ERRCODE = '23505';
  END IF;
  -- Identity, vocabulary, Case/Family and exact parent binding use the existing constraints.
  INSERT INTO staff_assignments
    (account_id, person_id, capability, scope_type, family_id, case_id,
     capability_grant_id, granted_by_account_id, granted_at, valid_from, valid_until)
  VALUES (p_account, p_person, p_capability, p_scope, p_family, p_case,
          p_parent, app_account_id(), checked_at, p_from, p_until)
  RETURNING * INTO assignment;
  PERFORM app.audit_staff_authority(assignment, 'STAFF_AUTHORITY_GRANTED');
  RETURN to_jsonb(assignment) - 'capability_grant_scope_type';
END $$;

CREATE FUNCTION app.revoke_staff_authority(p_epoch integer, p_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  assignment staff_assignments;
BEGIN
  PERFORM app.require_staff_authority_control(p_epoch, true);
  SELECT * INTO assignment FROM staff_assignments WHERE id = p_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'STAFF_AUTHORITY_ASSIGNMENT_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('AUTH_ACCOUNT:' || assignment.account_id::text, 0));
  PERFORM app.require_staff_authority_control(p_epoch, true);
  UPDATE staff_assignments
     SET revoked_at = clock_timestamp(), revoked_by_account_id = app_account_id()
   WHERE id = p_id AND account_id = assignment.account_id AND revoked_at IS NULL
   RETURNING * INTO assignment;
  IF FOUND THEN
    PERFORM app.audit_staff_authority(assignment, 'STAFF_AUTHORITY_REVOKED');
  ELSE
    SELECT * INTO STRICT assignment FROM staff_assignments WHERE id = p_id AND revoked_at IS NOT NULL;
  END IF;
  RETURN to_jsonb(assignment) - 'capability_grant_scope_type';
END $$;

-- The shared projection runs with the caller's RLS. Ordinary runtime access
-- is limited to the authenticated self context and cannot query the inventory.
CREATE FUNCTION app.staff_authority_projection(p_account uuid, p_person uuid, p_case uuid)
RETURNS SETOF jsonb LANGUAGE plpgsql SECURITY INVOKER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  checked_at timestamptz := clock_timestamp();
BEGIN
  IF current_user <> 'xiaoshuyin_migrator' AND (
    app_current_purpose() IS DISTINCT FROM 'SELF_IDENTITY'
    OR p_account IS NULL OR p_person IS NULL OR p_case IS NOT NULL
    OR p_account IS DISTINCT FROM app_account_id() OR p_person IS DISTINCT FROM app_person_id()
  ) THEN
    RAISE EXCEPTION 'STAFF_AUTHORITY_CONTROL_DENIED' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT (to_jsonb(sa) - 'capability_grant_scope_type') || jsonb_build_object('status', CASE
      WHEN sa.revoked_at IS NOT NULL THEN 'REVOKED'
      WHEN a.status IS DISTINCT FROM 'ACTIVE' THEN 'DISABLED'
      WHEN sa.valid_until <= checked_at THEN 'EXPIRED'
      WHEN sa.valid_from > checked_at THEN 'FUTURE'
      WHEN sa.scope_type = 'CASE' AND (
        parent.id IS NULL OR parent.revoked_at IS NOT NULL OR parent.valid_from > checked_at
        OR parent.valid_until <= checked_at
      ) THEN 'INVALID_PARENT'
      ELSE 'ACTIVE'
    END)
    FROM staff_assignments sa
    JOIN accounts a ON a.id = sa.account_id
    -- Existing exact Case/Family and parent identity constraints enforce both edges.
    LEFT JOIN staff_assignments parent ON parent.id = sa.capability_grant_id
    WHERE (p_case IS NOT NULL AND sa.case_id = p_case)
       OR (p_case IS NULL AND sa.account_id = p_account AND sa.person_id = p_person)
    ORDER BY sa.granted_at, sa.id;
END $$;

CREATE FUNCTION app.read_staff_authority(p_epoch integer, p_account uuid, p_person uuid, p_case uuid)
RETURNS SETOF jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  PERFORM app.require_staff_authority_control(p_epoch, false);
  IF (p_case IS NULL AND (p_account IS NULL OR p_person IS NULL))
     OR (p_case IS NOT NULL AND (p_account IS NOT NULL OR p_person IS NOT NULL)) THEN
    RAISE EXCEPTION 'STAFF_AUTHORITY_READ_FILTER_INVALID' USING ERRCODE = '22023';
  END IF;
  RETURN QUERY SELECT app.staff_authority_projection(p_account, p_person, p_case);
END $$;

REVOKE ALL ON FUNCTION app.staff_authority_projection(uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.staff_authority_projection(uuid, uuid, uuid) TO xiaoshuyin_app;

REVOKE ALL ON FUNCTION app.audit_staff_authority(staff_assignments, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.require_staff_authority_control(integer, boolean),
  app.grant_staff_authority(integer, uuid, uuid, text, text, uuid, uuid, uuid, timestamptz, timestamptz),
  app.revoke_staff_authority(integer, uuid),
  app.read_staff_authority(integer, uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.require_staff_authority_control(integer, boolean),
  app.grant_staff_authority(integer, uuid, uuid, text, text, uuid, uuid, uuid, timestamptz, timestamptz),
  app.revoke_staff_authority(integer, uuid),
  app.read_staff_authority(integer, uuid, uuid, uuid) TO xiaoshuyin_app;

COMMIT;
