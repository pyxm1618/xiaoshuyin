-- ============================================================================
-- 002_case_core.sql — Slice 2: Case Core container
--
-- Scope: `cases` + `case_events` only. No participant, statement, observation,
-- assertion, evidence, formulation, safety, plan, task, notification objects.
--
-- Order is frozen by plan.md D-11 / data-model.md §10:
--   enum → cases → cases constraints → cases indexes → case_events →
--   case_events indexes / metadata CHECK → ENABLE/FORCE RLS → policies →
--   GRANT → extend existing CHECK whitelists.
--
-- 001_initial_schema.sql is NOT modified.
-- ============================================================================

-- ── Step 01: enums (frozen vocabulary and order) ────────────
-- The database carries the full vocabulary so future transition commands
-- never need to rebuild the type. This Slice has no reachable path that
-- writes anything other than OPEN + INTAKE.

CREATE TYPE case_status AS ENUM (
  'OPEN',
  'WAITING',
  'PAUSED',
  'LOST_CONTACT',
  'SAFETY_HOLD',
  'CLOSED'
);

CREATE TYPE case_phase AS ENUM (
  'INTAKE',
  'ASSESSMENT',
  'PROBLEM_FORMULATION',
  'GOALS',
  'PLANNING',
  'EXECUTION',
  'REVIEW',
  'MAINTENANCE',
  'CLOSED'
);

-- ── Step 02: cases ──────────────────────────────────────────
-- Minimal container. Deliberately no title / summary / description /
-- problem_description / visibility / participant / deleted_at columns.
-- status and phase have no defaults: the application must write
-- OPEN + INTAKE explicitly so an omission fails instead of silently
-- producing a "successful" wrong row.

CREATE TABLE cases (
  id                   uuid PRIMARY KEY DEFAULT uuidv7(),
  family_id            uuid NOT NULL,
  created_by_person_id uuid NOT NULL,
  status               case_status NOT NULL,
  phase                case_phase NOT NULL,
  is_primary           boolean NOT NULL,
  version              integer NOT NULL,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

-- ── Step 03: cases constraints ──────────────────────────────
-- `UNIQUE (id, family_id)` must exist before the case_events composite FK.

ALTER TABLE cases
  ADD CONSTRAINT cases_id_family_key UNIQUE (id, family_id),
  ADD CONSTRAINT cases_version_check CHECK (version >= 1),
  ADD CONSTRAINT cases_family_fk FOREIGN KEY (family_id)
    REFERENCES families (id) ON DELETE RESTRICT,
  ADD CONSTRAINT cases_creator_fk FOREIGN KEY (created_by_person_id)
    REFERENCES persons (id) ON DELETE RESTRICT;

-- ── Step 04: cases indexes ──────────────────────────────────
-- `cases_one_primary_open_per_family` is the last-resort database invariant:
-- application code serializes on the Family row and never treats 23505 as a
-- normal primary decision.

CREATE UNIQUE INDEX cases_one_primary_open_per_family
  ON cases (family_id)
  WHERE is_primary AND status <> 'CLOSED';

CREATE INDEX cases_family_list_idx
  ON cases (family_id, is_primary DESC, created_at ASC);

CREATE INDEX cases_family_status_idx
  ON cases (family_id, status);

-- ── Step 05: case_events ────────────────────────────────────
-- Append-only domain history. The composite FK makes a cross-Family event
-- structurally impossible, independent of RLS.

CREATE TABLE case_events (
  id               uuid PRIMARY KEY DEFAULT uuidv7(),
  family_id        uuid NOT NULL,
  case_id          uuid NOT NULL,
  actor_account_id uuid NOT NULL,
  event_type       text NOT NULL,
  metadata         jsonb NOT NULL,
  occurred_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT case_events_case_family_fk
    FOREIGN KEY (case_id, family_id) REFERENCES cases (id, family_id)
    ON DELETE RESTRICT,
  CONSTRAINT case_events_actor_fk
    FOREIGN KEY (actor_account_id) REFERENCES accounts (id)
    ON DELETE RESTRICT,
  CONSTRAINT case_events_event_type_check
    CHECK (event_type IN ('CASE_CREATED')),

  -- Shape invariant: exactly { primary, version }, boolean + integer >= 1.
  -- Extra keys (title / description / free text / PII) are rejected.
  -- The numeric clause is guarded by CASE so a non-numeric `version` can
  -- never raise a cast error instead of a clean CHECK violation.
  CONSTRAINT case_events_metadata_shape_check CHECK (
    jsonb_typeof(metadata) = 'object'
    AND metadata ? 'primary'
    AND metadata ? 'version'
    AND metadata - 'primary' - 'version' = '{}'::jsonb
    AND jsonb_typeof(metadata -> 'primary') = 'boolean'
    AND jsonb_typeof(metadata -> 'version') = 'number'
    AND CASE
          WHEN jsonb_typeof(metadata -> 'version') = 'number'
          THEN (metadata ->> 'version')::numeric = trunc((metadata ->> 'version')::numeric)
               AND (metadata ->> 'version')::numeric >= 1
          ELSE false
        END
  )
);

-- ── Step 06: case_events indexes ────────────────────────────

CREATE INDEX case_events_case_time_idx   ON case_events (case_id, occurred_at ASC);
CREATE INDEX case_events_family_time_idx ON case_events (family_id, occurred_at ASC);

-- ── Step 07: ENABLE + FORCE ROW LEVEL SECURITY ──────────────

ALTER TABLE cases       ENABLE ROW LEVEL SECURITY;
ALTER TABLE cases       FORCE  ROW LEVEL SECURITY;
ALTER TABLE case_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_events FORCE  ROW LEVEL SECURITY;

-- ── Step 08: policies (Family isolation only) ───────────────
-- No manager / participant / purpose predicate belongs in RLS.

CREATE POLICY cases_family_scope ON cases
  USING (family_id = app_family_id())
  WITH CHECK (family_id = app_family_id());

CREATE POLICY case_events_family_scope ON case_events
  USING (family_id = app_family_id())
  WITH CHECK (family_id = app_family_id());

-- ── Step 09: GRANT (least privilege) ────────────────────────
-- No UPDATE / DELETE in this Slice: there is no Case mutation command and
-- case_events is append-only.

GRANT SELECT, INSERT ON cases, case_events TO xiaoshuyin_app;

GRANT USAGE ON TYPE case_status TO xiaoshuyin_app;
GRANT USAGE ON TYPE case_phase  TO xiaoshuyin_app;

-- ── Step 10: extend existing CHECK whitelists ───────────────
-- Constraint names verified against pg_constraint before writing this file.

ALTER TABLE business_audit_events
  DROP CONSTRAINT business_audit_events_event_type_check;
ALTER TABLE business_audit_events
  ADD CONSTRAINT business_audit_events_event_type_check CHECK (
    event_type IN (
      'FAMILY_CREATED',
      'MEMBER_CREATED',
      'MEMBER_PROFILE_VALUE_RECORDED',
      'CONSENT_REQUEST_CREATED',
      'CONSENT_GRANTED',
      'CONSENT_REVOKED',
      'CASE_CREATED'
    )
  );

ALTER TABLE business_audit_events
  DROP CONSTRAINT business_audit_events_resource_type_check;
ALTER TABLE business_audit_events
  ADD CONSTRAINT business_audit_events_resource_type_check CHECK (
    resource_type IN ('FAMILY', 'PERSON', 'CONSENT', 'CASE')
  );

ALTER TABLE idempotency_keys
  DROP CONSTRAINT idempotency_keys_command_type_check;
ALTER TABLE idempotency_keys
  ADD CONSTRAINT idempotency_keys_command_type_check CHECK (
    command_type IN (
      'FAMILY_CREATE',
      'MEMBER_CREATE',
      'MEMBER_UPDATE',
      'GUARDIAN_CONSENT_REQUEST',
      'GUARDIAN_CONSENT_GRANT',
      'GUARDIAN_CONSENT_REVOKE',
      'CASE_CREATE'
    )
  );
