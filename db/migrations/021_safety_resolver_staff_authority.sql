-- ============================================================================
-- AUTH-007 + AUTH-008 — Safety Resolver Staff Authority Foundation
-- Migration: 021_safety_resolver_staff_authority.sql
--
-- Forward-only targeted foundation. Historical migrations remain immutable.
--
-- Scope:
--   1. one Staff authority table, `staff_assignments`
--   2. GLOBAL rows = explicit capability grants
--   3. CASE rows = exact Case assignments referencing one GLOBAL grant
--   4. self-only runtime read RLS; runtime cannot grant/revoke/mutate
--   5. narrow Staff Case RLS context function for SAFETY_RESOLVE only
--   6. narrow self Account read under SAFETY_RESOLUTION so Hard Disable remains
--      an authority fact at the production resolver source
--
-- NOT created here:
--   Staff UI / Admin Console / Staff SSO / IAM platform / CRM / employee
--   directory / generic ADMIN role / any Staff workflow / professional Safety
--   rule content.  Only SAFETY_RESOLVE is consumed by production in AUTH-007.
-- ============================================================================

-- The existing Account↔Person 1:1 model already has persons.id PK and
-- persons.account_id UNIQUE.  This additive composite key lets Staff authority
-- rows bind both identifiers mechanically, not by application convention.
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

  CONSTRAINT staff_assignments_capability_grant_fk
    FOREIGN KEY (capability_grant_id)
    REFERENCES staff_assignments(id)
    ON DELETE RESTRICT,

  -- AUTH-008 freezes the vocabulary but this migration creates no workflow for
  -- capabilities other than SAFETY_RESOLVE.
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

  -- One table, two explicit facts:
  --   GLOBAL = capability grant
  --   CASE   = Case assignment tied to a GLOBAL grant
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

-- Staff authority is not household authority.  Before a Case context is
-- established, the authenticated Account/Person can see only its own authority
-- rows.  Runtime receives no mutation privilege, so this is not a grant/revoke
-- workflow or Staff administration surface.
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

-- AUTH-001 composition: the production resolver must also be able to verify
-- that its exact authenticated Account is still ACTIVE.  This policy exposes
-- only that Account and only under the dedicated Safety-resolution purpose.
CREATE POLICY accounts_runtime_safety_resolution_read ON accounts
  FOR SELECT
  TO xiaoshuyin_app
  USING (
    app_current_purpose() = 'SAFETY_RESOLUTION'
    AND id = app_account_id()
  );

-- Establish the Family RLS context for a Staff resolver without manufacturing
-- family_members membership.  This is a database defence-in-depth gate, not a
-- second authorization system: the application still calls the single
-- authorize() seam with the verified fact returned by the production resolver
-- source.  Both GLOBAL capability grant and exact CASE assignment must be
-- current in the same transaction snapshot.
CREATE FUNCTION app.set_staff_case_context(
  p_assignment_id uuid,
  p_case_id uuid
) RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_family_id uuid;
BEGIN
  IF p_assignment_id IS NULL
     OR p_case_id IS NULL
     OR app_account_id() IS NULL
     OR app_person_id() IS NULL
     OR app_current_purpose() <> 'SAFETY_RESOLUTION' THEN
    RAISE EXCEPTION 'STAFF_ASSIGNMENT_REQUIRED' USING ERRCODE = '42501';
  END IF;

  SELECT assignment.family_id
    INTO v_family_id
    FROM staff_assignments assignment
    JOIN staff_assignments capability_grant
      ON capability_grant.id = assignment.capability_grant_id
    JOIN accounts reviewer_account
      ON reviewer_account.id = assignment.account_id
   WHERE assignment.id = p_assignment_id
     AND assignment.scope_type = 'CASE'
     AND assignment.capability = 'SAFETY_RESOLVE'
     AND assignment.case_id = p_case_id
     AND assignment.account_id = app_account_id()
     AND assignment.person_id = app_person_id()
     AND assignment.revoked_at IS NULL
     AND assignment.valid_from <= CURRENT_TIMESTAMP
     AND (
       assignment.valid_until IS NULL
       OR assignment.valid_until > CURRENT_TIMESTAMP
     )
     AND capability_grant.scope_type = 'GLOBAL'
     AND capability_grant.capability = 'SAFETY_RESOLVE'
     AND capability_grant.account_id = assignment.account_id
     AND capability_grant.person_id = assignment.person_id
     AND capability_grant.revoked_at IS NULL
     AND capability_grant.valid_from <= CURRENT_TIMESTAMP
     AND (
       capability_grant.valid_until IS NULL
       OR capability_grant.valid_until > CURRENT_TIMESTAMP
     )
     AND reviewer_account.status = 'ACTIVE';

  IF v_family_id IS NULL THEN
    RAISE EXCEPTION 'STAFF_ASSIGNMENT_REQUIRED' USING ERRCODE = '42501';
  END IF;

  PERFORM set_config('app.family_id', v_family_id::text, true);
  RETURN v_family_id;
END $$;

REVOKE ALL ON FUNCTION app.set_staff_case_context(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.set_staff_case_context(uuid, uuid) TO xiaoshuyin_app;
