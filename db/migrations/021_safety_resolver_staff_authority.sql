-- ============================================================================
-- AUTH-007 + AUTH-008 — Safety Resolver Staff Authority Foundation
-- Migration: 021_safety_resolver_staff_authority.sql
--
-- PR-local forward-only targeted foundation. Historical migrations 001–020
-- remain immutable.
--
-- Scope:
--   1. one Staff authority table, staff_assignments
--   2. DB-enforced CASE -> matching GLOBAL authority graph
--   3. runtime-read-only Staff facts + exact-Case Safety RLS
--   4. DB-enforced serialization for revoke/disable vs ResolveRisk
--   5. wall-clock-safe authority validation with clock_timestamp()
-- ============================================================================

ALTER TABLE persons
  ADD CONSTRAINT persons_id_account_key UNIQUE (id, account_id);

CREATE TABLE staff_assignments (
  id                       uuid PRIMARY KEY DEFAULT uuidv7(),
  account_id               uuid NOT NULL
                             REFERENCES accounts(id) ON DELETE RESTRICT,
  person_id                uuid NOT NULL,
  capability               text NOT NULL,
  scope_type               text NOT NULL,
  family_id                uuid,
  case_id                  uuid,
  capability_grant_id      uuid,
  capability_grant_scope_type text GENERATED ALWAYS AS (
    CASE WHEN scope_type = 'CASE' THEN 'GLOBAL'::text ELSE NULL::text END
  ) STORED,
  granted_by_account_id    uuid NOT NULL
                             REFERENCES accounts(id) ON DELETE RESTRICT,
  granted_at               timestamptz NOT NULL DEFAULT now(),
  valid_from               timestamptz NOT NULL DEFAULT now(),
  valid_until              timestamptz,
  revoked_by_account_id    uuid
                             REFERENCES accounts(id) ON DELETE RESTRICT,
  revoked_at               timestamptz,
  created_at               timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT staff_assignments_identity_fk
    FOREIGN KEY (person_id, account_id)
    REFERENCES persons(id, account_id)
    ON DELETE RESTRICT,

  CONSTRAINT staff_assignments_case_family_fk
    FOREIGN KEY (case_id, family_id)
    REFERENCES cases(id, family_id)
    ON DELETE RESTRICT,

  -- Composite target for the CASE -> GLOBAL authority edge.  id remains the
  -- primary identity; the extra key lets the FK mechanically bind the parent
  -- scope + Account + Person + capability as one graph invariant.
  CONSTRAINT staff_assignments_authority_identity_key
    UNIQUE (id, scope_type, account_id, person_id, capability),

  CONSTRAINT staff_assignments_capability_grant_identity_fk
    FOREIGN KEY (
      capability_grant_id,
      capability_grant_scope_type,
      account_id,
      person_id,
      capability
    )
    REFERENCES staff_assignments(
      id,
      scope_type,
      account_id,
      person_id,
      capability
    )
    ON DELETE RESTRICT,

  CONSTRAINT staff_assignments_capability_check CHECK (
    capability IN (
      'PROFESSIONAL_REVIEW',
      'SAFETY_REVIEW',
      'SAFETY_RESOLVE',
      'DATA_RIGHTS',
      'QUALITY_REVIEW',
      'EXCEPTION_SUPPORT',
      'SERVICE_CONTROL'
    )
  ),

  CONSTRAINT staff_assignments_scope_type_check CHECK (
    scope_type IN ('GLOBAL', 'CASE')
  ),

  CONSTRAINT staff_assignments_scope_shape_check CHECK (
    (
      scope_type = 'GLOBAL'
      AND family_id IS NULL
      AND case_id IS NULL
      AND capability_grant_id IS NULL
    )
    OR
    (
      scope_type = 'CASE'
      AND family_id IS NOT NULL
      AND case_id IS NOT NULL
      AND capability_grant_id IS NOT NULL
    )
  ),

  CONSTRAINT staff_assignments_validity_window_check CHECK (
    valid_until IS NULL OR valid_until > valid_from
  ),

  CONSTRAINT staff_assignments_revoke_pair_check CHECK (
    (revoked_at IS NULL AND revoked_by_account_id IS NULL)
    OR
    (revoked_at IS NOT NULL AND revoked_by_account_id IS NOT NULL)
  ),

  CONSTRAINT staff_assignments_revoke_time_check CHECK (
    revoked_at IS NULL OR revoked_at >= granted_at
  )
);

CREATE INDEX staff_assignments_actor_capability_scope_idx
  ON staff_assignments (account_id, person_id, capability, scope_type);

CREATE INDEX staff_assignments_case_capability_idx
  ON staff_assignments (case_id, capability, account_id)
  WHERE scope_type = 'CASE';

-- --------------------------------------------------------------------------
-- Serialization boundary
--
-- ResolveRisk and every Staff authority mutation for the same Account contend
-- on the same transaction advisory lock. Staff-row mutations additionally
-- contend on the exact row lock key. This keeps runtime SELECT-only while
-- making every INSERT/UPDATE/DELETE mutation path mechanically participate in
-- the serialization protocol.
-- --------------------------------------------------------------------------

CREATE FUNCTION app.serialize_staff_authority_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_old_account_key bigint;
  v_new_account_key bigint;
  v_row_id uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_new_account_key := hashtextextended('AUTH_ACCOUNT:' || NEW.account_id::text, 0);
    PERFORM pg_advisory_xact_lock(v_new_account_key);
    v_row_id := NEW.id;
  ELSIF TG_OP = 'DELETE' THEN
    v_old_account_key := hashtextextended('AUTH_ACCOUNT:' || OLD.account_id::text, 0);
    PERFORM pg_advisory_xact_lock(v_old_account_key);
    v_row_id := OLD.id;
  ELSE
    v_old_account_key := hashtextextended('AUTH_ACCOUNT:' || OLD.account_id::text, 0);
    v_new_account_key := hashtextextended('AUTH_ACCOUNT:' || NEW.account_id::text, 0);

    IF v_old_account_key = v_new_account_key THEN
      PERFORM pg_advisory_xact_lock(v_new_account_key);
    ELSE
      PERFORM pg_advisory_xact_lock(LEAST(v_old_account_key, v_new_account_key));
      PERFORM pg_advisory_xact_lock(GREATEST(v_old_account_key, v_new_account_key));
    END IF;
    v_row_id := NEW.id;
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended('AUTH_ROW:' || v_row_id::text, 0)
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END
$function$;

REVOKE ALL ON FUNCTION app.serialize_staff_authority_mutation() FROM PUBLIC;

CREATE TRIGGER staff_assignments_authority_serialization
  BEFORE INSERT OR UPDATE OR DELETE ON staff_assignments
  FOR EACH ROW
  EXECUTE FUNCTION app.serialize_staff_authority_mutation();

CREATE FUNCTION app.serialize_account_authority_status_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $function$
BEGIN
  PERFORM pg_advisory_xact_lock(
    hashtextextended('AUTH_ACCOUNT:' || OLD.id::text, 0)
  );
  RETURN NEW;
END
$function$;

REVOKE ALL ON FUNCTION app.serialize_account_authority_status_mutation() FROM PUBLIC;

CREATE TRIGGER accounts_authority_status_serialization
  BEFORE UPDATE OF status ON accounts
  FOR EACH ROW
  EXECUTE FUNCTION app.serialize_account_authority_status_mutation();

-- --------------------------------------------------------------------------
-- RLS + exact Staff Case context
-- --------------------------------------------------------------------------

ALTER TABLE staff_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_assignments FORCE ROW LEVEL SECURITY;

CREATE POLICY staff_assignments_runtime_self_read ON staff_assignments
  FOR SELECT
  TO xiaoshuyin_app
  USING (
    account_id = app_account_id()
    AND person_id = app_person_id()
  );

REVOKE ALL ON staff_assignments FROM xiaoshuyin_app;
GRANT SELECT ON staff_assignments TO xiaoshuyin_app;

CREATE POLICY accounts_runtime_safety_resolution_read ON accounts
  FOR SELECT
  TO xiaoshuyin_app
  USING (
    app_current_purpose() = 'SAFETY_RESOLUTION'
    AND id = app_account_id()
  );

-- A Staff Case GUC is never authority by itself. Every policy calls this
-- verifier, which binds the GUC to the exact current assignment + matching
-- GLOBAL grant + ACTIVE Account using wall-clock time.
CREATE FUNCTION app.staff_case_authorized(p_case_id uuid)
RETURNS boolean
LANGUAGE sql
VOLATILE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $function$
  SELECT
    p_case_id IS NOT NULL
    AND app_current_purpose() = 'SAFETY_RESOLUTION'
    AND p_case_id = NULLIF(current_setting('app.staff_case_id', true), '')::uuid
    AND EXISTS (
      SELECT 1
        FROM public.staff_assignments assignment
        JOIN public.staff_assignments capability_grant
          ON capability_grant.id = assignment.capability_grant_id
        JOIN public.accounts reviewer_account
          ON reviewer_account.id = assignment.account_id
       WHERE assignment.id =
             NULLIF(current_setting('app.staff_assignment_id', true), '')::uuid
         AND assignment.scope_type = 'CASE'
         AND assignment.capability = 'SAFETY_RESOLVE'
         AND assignment.case_id = p_case_id
         AND assignment.account_id = app_account_id()
         AND assignment.person_id = app_person_id()
         AND assignment.revoked_at IS NULL
         AND assignment.valid_from <= clock_timestamp()
         AND (
           assignment.valid_until IS NULL
           OR assignment.valid_until > clock_timestamp()
         )
         AND capability_grant.scope_type = 'GLOBAL'
         AND capability_grant.capability = 'SAFETY_RESOLVE'
         AND capability_grant.account_id = assignment.account_id
         AND capability_grant.person_id = assignment.person_id
         AND capability_grant.revoked_at IS NULL
         AND capability_grant.valid_from <= clock_timestamp()
         AND (
           capability_grant.valid_until IS NULL
           OR capability_grant.valid_until > clock_timestamp()
         )
         AND reviewer_account.status = 'ACTIVE'
    )
$function$;

REVOKE ALL ON FUNCTION app.staff_case_authorized(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.staff_case_authorized(uuid) TO xiaoshuyin_app;

-- The one DB entry point for Staff ResolveRisk context. Lock order:
--   Account serialization -> GLOBAL grant key -> CASE assignment key -> Case row.
-- No app.family_id is set, so this context can never become household-Family
-- authority. The Case row lock is held until the surrounding transaction ends.
CREATE FUNCTION app.set_staff_case_context(
  p_assignment_id uuid,
  p_case_id uuid
) RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_account_id uuid;
  v_person_id uuid;
  v_grant_id uuid;
  v_family_id uuid;
  v_case_family_id uuid;
  v_now timestamptz;
BEGIN
  v_account_id := app_account_id();
  v_person_id := app_person_id();

  IF p_assignment_id IS NULL
     OR p_case_id IS NULL
     OR v_account_id IS NULL
     OR v_person_id IS NULL
     OR app_current_purpose() <> 'SAFETY_RESOLUTION' THEN
    RAISE EXCEPTION 'STAFF_ASSIGNMENT_REQUIRED' USING ERRCODE = '42501';
  END IF;

  -- First lock is the Account serialization key. Every grant/assignment
  -- mutation and Account status mutation for this actor must take it too.
  PERFORM pg_advisory_xact_lock(
    hashtextextended('AUTH_ACCOUNT:' || v_account_id::text, 0)
  );

  -- Structural lookup only; a concurrent mutation that won the Account lock
  -- has already committed before this statement can run.
  SELECT assignment.capability_grant_id
    INTO v_grant_id
    FROM public.staff_assignments assignment
   WHERE assignment.id = p_assignment_id
     AND assignment.account_id = v_account_id
     AND assignment.person_id = v_person_id
     AND assignment.scope_type = 'CASE'
     AND assignment.capability = 'SAFETY_RESOLVE'
     AND assignment.case_id = p_case_id;

  IF v_grant_id IS NULL THEN
    RAISE EXCEPTION 'STAFF_ASSIGNMENT_REQUIRED' USING ERRCODE = '42501';
  END IF;

  -- Deterministic authority-row order after the Account lock.
  PERFORM pg_advisory_xact_lock(
    hashtextextended('AUTH_ROW:' || v_grant_id::text, 0)
  );
  PERFORM pg_advisory_xact_lock(
    hashtextextended('AUTH_ROW:' || p_assignment_id::text, 0)
  );

  v_now := clock_timestamp();

  SELECT assignment.family_id
    INTO v_family_id
    FROM public.staff_assignments assignment
    JOIN public.staff_assignments capability_grant
      ON capability_grant.id = assignment.capability_grant_id
    JOIN public.accounts reviewer_account
      ON reviewer_account.id = assignment.account_id
   WHERE assignment.id = p_assignment_id
     AND assignment.scope_type = 'CASE'
     AND assignment.capability = 'SAFETY_RESOLVE'
     AND assignment.case_id = p_case_id
     AND assignment.account_id = v_account_id
     AND assignment.person_id = v_person_id
     AND assignment.revoked_at IS NULL
     AND assignment.valid_from <= v_now
     AND (assignment.valid_until IS NULL OR assignment.valid_until > v_now)
     AND capability_grant.id = v_grant_id
     AND capability_grant.scope_type = 'GLOBAL'
     AND capability_grant.capability = 'SAFETY_RESOLVE'
     AND capability_grant.account_id = assignment.account_id
     AND capability_grant.person_id = assignment.person_id
     AND capability_grant.revoked_at IS NULL
     AND capability_grant.valid_from <= v_now
     AND (
       capability_grant.valid_until IS NULL
       OR capability_grant.valid_until > v_now
     )
     AND reviewer_account.status = 'ACTIVE';

  IF v_family_id IS NULL THEN
    RAISE EXCEPTION 'STAFF_ASSIGNMENT_REQUIRED' USING ERRCODE = '42501';
  END IF;

  PERFORM set_config('app.staff_assignment_id', p_assignment_id::text, true);
  PERFORM set_config('app.staff_case_id', p_case_id::text, true);

  -- Exact Case row lock. The Staff RLS policy below revalidates the same
  -- authority using clock_timestamp(), so an expired fact cannot create scope.
  SELECT target_case.family_id
    INTO v_case_family_id
    FROM public.cases target_case
   WHERE target_case.id = p_case_id
   FOR UPDATE;

  IF v_case_family_id IS NULL OR v_case_family_id <> v_family_id THEN
    RAISE EXCEPTION 'STAFF_ASSIGNMENT_REQUIRED' USING ERRCODE = '42501';
  END IF;

  RETURN v_family_id;
END
$function$;

REVOKE ALL ON FUNCTION app.set_staff_case_context(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.set_staff_case_context(uuid, uuid) TO xiaoshuyin_app;

-- Staff exact-Case policies are additive. Existing household Family policies
-- are left byte-for-byte unchanged.
CREATE POLICY cases_staff_safety_select ON cases
  FOR SELECT TO xiaoshuyin_app
  USING (app.staff_case_authorized(id));

CREATE POLICY cases_staff_safety_update ON cases
  FOR UPDATE TO xiaoshuyin_app
  USING (app.staff_case_authorized(id))
  WITH CHECK (app.staff_case_authorized(id));

CREATE POLICY case_events_staff_safety_insert ON case_events
  FOR INSERT TO xiaoshuyin_app
  WITH CHECK (app.staff_case_authorized(case_id));

CREATE POLICY risk_events_staff_safety_select ON risk_events
  FOR SELECT TO xiaoshuyin_app
  USING (app.staff_case_authorized(case_id));

CREATE POLICY risk_events_staff_safety_insert ON risk_events
  FOR INSERT TO xiaoshuyin_app
  WITH CHECK (app.staff_case_authorized(case_id));

CREATE POLICY dialogue_messages_staff_safety_select ON dialogue_messages
  FOR SELECT TO xiaoshuyin_app
  USING (app.staff_case_authorized(case_id));

CREATE POLICY assertions_staff_safety_select ON assertions
  FOR SELECT TO xiaoshuyin_app
  USING (app.staff_case_authorized(case_id));

CREATE POLICY observations_staff_safety_select ON observations
  FOR SELECT TO xiaoshuyin_app
  USING (app.staff_case_authorized(case_id));

CREATE POLICY audit_staff_safety_insert ON business_audit_events
  FOR INSERT TO xiaoshuyin_app
  WITH CHECK (
    resource_type = 'CASE'
    AND EXISTS (
      SELECT 1
        FROM public.cases target_case
       WHERE target_case.id = resource_id
         AND target_case.family_id = family_id
         AND app.staff_case_authorized(target_case.id)
    )
  );
