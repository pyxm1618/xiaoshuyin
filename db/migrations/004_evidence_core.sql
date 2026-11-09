-- ============================================================================
-- 004_evidence_core.sql — Slice 3: Evidence Core
--
-- Scope: exactly three tables (`dialogue_messages`, `assertions`,
-- `observations`) plus their enums / constraints / indexes / RLS / grants and
-- the approved audit + idempotency CHECK extensions.
--
-- Order is frozen by data-model.md §2–§12 and plan.md D-2…D-11:
--   enums → dialogue_messages → assertions → observations →
--   constraints/indexes/FKs/CHECKs → ENABLE/FORCE RLS → command-specific
--   policies → grants → audit CHECKs → idempotency CHECK.
--
-- 001_initial_schema.sql / 002_case_core.sql / 003_* are NOT modified.
-- The runtime app role must never INSERT kind='FACT'; that guard lives in the
-- assertions INSERT policy (`kind <> 'FACT'`), not in application code only.
-- ============================================================================

-- ── Step 01: enums (frozen vocabulary and order) ────────────

CREATE TYPE assertion_kind AS ENUM (
  'STATEMENT',
  'FACT',
  'HYPOTHESIS'
);

CREATE TYPE observation_value_state AS ENUM (
  'KNOWN',
  'UNKNOWN',
  'NOT_COLLECTED',
  'DECLINED',
  'NOT_APPLICABLE'
);

CREATE TYPE observation_value_type AS ENUM (
  'TEXT',
  'NUMBER',
  'BOOLEAN'
);

CREATE TYPE evidence_time_state AS ENUM (
  'KNOWN',
  'UNKNOWN'
);

CREATE TYPE evidence_confirmation_status AS ENUM (
  'UNCONFIRMED',
  'SOURCE_CONFIRMED',
  'DISPUTED'
);

-- ── Step 02: dialogue_messages (raw Case input only) ────────
-- No title / summary / assertion kind / structured payload. A message is a
-- source, never a Fact and never an Assertion.

CREATE TABLE dialogue_messages (
  id               uuid PRIMARY KEY DEFAULT uuidv7(),
  family_id        uuid NOT NULL,
  case_id          uuid NOT NULL,
  actor_account_id uuid NOT NULL,
  source_person_id uuid NOT NULL,
  content          text NOT NULL,
  recorded_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT dialogue_messages_content_check CHECK (
    length(content) BETWEEN 1 AND 8000
    AND btrim(content) <> ''
  ),
  CONSTRAINT dialogue_messages_id_family_case_key UNIQUE (id, family_id, case_id),
  CONSTRAINT dialogue_messages_family_fk FOREIGN KEY (family_id)
    REFERENCES families (id) ON DELETE RESTRICT,
  CONSTRAINT dialogue_messages_actor_fk FOREIGN KEY (actor_account_id)
    REFERENCES accounts (id) ON DELETE RESTRICT,
  CONSTRAINT dialogue_messages_case_family_fk FOREIGN KEY (case_id, family_id)
    REFERENCES cases (id, family_id) ON DELETE RESTRICT
);

-- Family membership is the database last line of defence for the source
-- Person; actor↔source-person equivalence is an application-domain concern.
ALTER TABLE dialogue_messages
  ADD CONSTRAINT dialogue_messages_source_person_fk
    FOREIGN KEY (family_id, source_person_id)
    REFERENCES family_members (family_id, person_id) ON DELETE RESTRICT;

CREATE INDEX dialogue_messages_case_time_idx
  ON dialogue_messages (case_id, recorded_at ASC, id ASC);

CREATE INDEX dialogue_messages_family_source_time_idx
  ON dialogue_messages (family_id, source_person_id, recorded_at DESC);

-- ── Step 03: assertions ─────────────────────────────────────
-- FACT stays structurally expressible. No trigger, no confirmation workflow
-- and no caller-selectable writer exists in this Slice.

CREATE TABLE assertions (
  id                   uuid PRIMARY KEY DEFAULT uuidv7(),
  family_id            uuid NOT NULL,
  case_id              uuid NOT NULL,
  subject_person_id    uuid NULL,
  source_kind          provenance_source NOT NULL,
  source_person_id     uuid NULL,
  source_message_id    uuid NULL,
  occurred_time_state  evidence_time_state NOT NULL,
  occurred_at          timestamptz NULL,
  recorded_at          timestamptz NOT NULL DEFAULT now(),
  valid_from           timestamptz NULL,
  valid_until          timestamptz NULL,
  confirmation_status  evidence_confirmation_status NOT NULL,
  supersedes_id        uuid NULL,
  conflict_group_id    uuid NULL,
  kind                 assertion_kind NOT NULL,
  content              text NOT NULL,

  CONSTRAINT assertions_content_check CHECK (
    length(content) BETWEEN 1 AND 8000
    AND btrim(content) <> ''
  ),
  CONSTRAINT assertions_occurred_time_check CHECK (
    (occurred_time_state = 'KNOWN') = (occurred_at IS NOT NULL)
  ),
  CONSTRAINT assertions_validity_window_check CHECK (
    valid_until IS NULL OR valid_from IS NULL OR valid_until > valid_from
  ),
  CONSTRAINT assertions_source_person_required_check CHECK (
    source_kind NOT IN (
      'SELF_STATEMENT', 'GUARDIAN_OBSERVATION',
      'GUARDIAN_RELAY', 'OTHER_MEMBER_RELAY'
    )
    OR source_person_id IS NOT NULL
  ),
  CONSTRAINT assertions_source_message_requires_person_check CHECK (
    source_message_id IS NULL OR source_person_id IS NOT NULL
  ),
  CONSTRAINT assertions_no_self_supersede_check CHECK (
    supersedes_id IS NULL OR supersedes_id <> id
  ),
  CONSTRAINT assertions_id_family_case_key UNIQUE (id, family_id, case_id)
);

ALTER TABLE assertions
  ADD CONSTRAINT assertions_case_family_fk FOREIGN KEY (case_id, family_id)
    REFERENCES cases (id, family_id) ON DELETE RESTRICT,
  ADD CONSTRAINT assertions_subject_person_fk FOREIGN KEY (family_id, subject_person_id)
    REFERENCES family_members (family_id, person_id) ON DELETE RESTRICT,
  ADD CONSTRAINT assertions_source_person_fk FOREIGN KEY (family_id, source_person_id)
    REFERENCES family_members (family_id, person_id) ON DELETE RESTRICT,
  ADD CONSTRAINT assertions_source_message_fk
    FOREIGN KEY (source_message_id, family_id, case_id)
    REFERENCES dialogue_messages (id, family_id, case_id) ON DELETE RESTRICT,
  ADD CONSTRAINT assertions_supersedes_fk
    FOREIGN KEY (supersedes_id, family_id, case_id)
    REFERENCES assertions (id, family_id, case_id) ON DELETE RESTRICT;

CREATE INDEX assertions_case_recorded_idx
  ON assertions (case_id, recorded_at ASC, id ASC);
CREATE INDEX assertions_case_subject_idx
  ON assertions (case_id, subject_person_id);
CREATE INDEX assertions_source_message_idx
  ON assertions (source_message_id);
CREATE INDEX assertions_conflict_group_idx
  ON assertions (conflict_group_id);
CREATE INDEX assertions_supersedes_idx
  ON assertions (supersedes_id);
CREATE INDEX assertions_valid_until_idx
  ON assertions (valid_until);

-- ── Step 04: observations (separate Evidence type) ──────────
-- No `kind` column: Observation can never be smuggled into assertion kind.

CREATE TABLE observations (
  id                   uuid PRIMARY KEY DEFAULT uuidv7(),
  family_id            uuid NOT NULL,
  case_id              uuid NOT NULL,
  subject_person_id    uuid NULL,
  source_kind          provenance_source NOT NULL,
  source_person_id     uuid NULL,
  source_message_id    uuid NULL,
  occurred_time_state  evidence_time_state NOT NULL,
  occurred_at          timestamptz NULL,
  recorded_at          timestamptz NOT NULL DEFAULT now(),
  valid_from           timestamptz NULL,
  valid_until          timestamptz NULL,
  confirmation_status  evidence_confirmation_status NOT NULL,
  supersedes_id        uuid NULL,
  conflict_group_id    uuid NULL,
  observation_code     text NOT NULL,
  value_state          observation_value_state NOT NULL,
  value_type           observation_value_type NULL,
  value_text           text NULL,
  value_number         numeric NULL,
  value_boolean        boolean NULL,
  unit                 text NULL,

  CONSTRAINT observations_code_check CHECK (
    observation_code ~ '^[a-z][a-z0-9_.-]{0,127}$'
  ),
  CONSTRAINT observations_typed_value_check CHECK (
    (
      value_state = 'KNOWN'
      AND value_type IS NOT NULL
      AND (
        (
          value_type = 'TEXT'
          AND value_text IS NOT NULL
          AND value_number IS NULL
          AND value_boolean IS NULL
          AND unit IS NULL
        )
        OR (
          value_type = 'NUMBER'
          AND value_number IS NOT NULL
          AND value_text IS NULL
          AND value_boolean IS NULL
        )
        OR (
          value_type = 'BOOLEAN'
          AND value_boolean IS NOT NULL
          AND value_text IS NULL
          AND value_number IS NULL
          AND unit IS NULL
        )
      )
    )
    OR (
      value_state IN ('UNKNOWN', 'NOT_COLLECTED', 'DECLINED', 'NOT_APPLICABLE')
      AND value_type IS NULL
      AND value_text IS NULL
      AND value_number IS NULL
      AND value_boolean IS NULL
      AND unit IS NULL
    )
  ),
  CONSTRAINT observations_occurred_time_check CHECK (
    (occurred_time_state = 'KNOWN') = (occurred_at IS NOT NULL)
  ),
  CONSTRAINT observations_validity_window_check CHECK (
    valid_until IS NULL OR valid_from IS NULL OR valid_until > valid_from
  ),
  CONSTRAINT observations_source_person_required_check CHECK (
    source_kind NOT IN (
      'SELF_STATEMENT', 'GUARDIAN_OBSERVATION',
      'GUARDIAN_RELAY', 'OTHER_MEMBER_RELAY'
    )
    OR source_person_id IS NOT NULL
  ),
  CONSTRAINT observations_source_message_requires_person_check CHECK (
    source_message_id IS NULL OR source_person_id IS NOT NULL
  ),
  CONSTRAINT observations_no_self_supersede_check CHECK (
    supersedes_id IS NULL OR supersedes_id <> id
  ),
  CONSTRAINT observations_id_family_case_key UNIQUE (id, family_id, case_id)
);

ALTER TABLE observations
  ADD CONSTRAINT observations_case_family_fk FOREIGN KEY (case_id, family_id)
    REFERENCES cases (id, family_id) ON DELETE RESTRICT,
  ADD CONSTRAINT observations_subject_person_fk FOREIGN KEY (family_id, subject_person_id)
    REFERENCES family_members (family_id, person_id) ON DELETE RESTRICT,
  ADD CONSTRAINT observations_source_person_fk FOREIGN KEY (family_id, source_person_id)
    REFERENCES family_members (family_id, person_id) ON DELETE RESTRICT,
  ADD CONSTRAINT observations_source_message_fk
    FOREIGN KEY (source_message_id, family_id, case_id)
    REFERENCES dialogue_messages (id, family_id, case_id) ON DELETE RESTRICT,
  ADD CONSTRAINT observations_supersedes_fk
    FOREIGN KEY (supersedes_id, family_id, case_id)
    REFERENCES observations (id, family_id, case_id) ON DELETE RESTRICT;

CREATE INDEX observations_case_recorded_idx
  ON observations (case_id, recorded_at ASC, id ASC);
CREATE INDEX observations_case_code_recorded_idx
  ON observations (case_id, observation_code, recorded_at DESC);
CREATE INDEX observations_case_subject_idx
  ON observations (case_id, subject_person_id);
CREATE INDEX observations_source_message_idx
  ON observations (source_message_id);
CREATE INDEX observations_conflict_group_idx
  ON observations (conflict_group_id);
CREATE INDEX observations_supersedes_idx
  ON observations (supersedes_id);
CREATE INDEX observations_valid_until_idx
  ON observations (valid_until);

-- ── Step 05: ENABLE + FORCE ROW LEVEL SECURITY ──────────────

ALTER TABLE dialogue_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE dialogue_messages FORCE  ROW LEVEL SECURITY;
ALTER TABLE assertions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE assertions        FORCE  ROW LEVEL SECURITY;
ALTER TABLE observations      ENABLE ROW LEVEL SECURITY;
ALTER TABLE observations      FORCE  ROW LEVEL SECURITY;

-- ── Step 06: command-specific policies ─────────────────────
-- Family isolation only. Business authorization (manager / Case actor /
-- Person reference) stays in the application/domain layer. The one extra
-- database capability guard is the assertions INSERT `kind <> 'FACT'`.

CREATE POLICY dialogue_messages_select ON dialogue_messages
  FOR SELECT USING (family_id = app_family_id());

CREATE POLICY dialogue_messages_insert ON dialogue_messages
  FOR INSERT WITH CHECK (family_id = app_family_id());

CREATE POLICY assertions_select ON assertions
  FOR SELECT USING (family_id = app_family_id());

CREATE POLICY assertions_insert ON assertions
  FOR INSERT WITH CHECK (
    family_id = app_family_id()
    AND kind <> 'FACT'
  );

-- Runtime only gets UPDATE(conflict_group_id); the policy still scopes the row
-- to the current Family and never widens the column grant.
CREATE POLICY assertions_update ON assertions
  FOR UPDATE
  USING (family_id = app_family_id())
  WITH CHECK (family_id = app_family_id());

CREATE POLICY observations_select ON observations
  FOR SELECT USING (family_id = app_family_id());

CREATE POLICY observations_insert ON observations
  FOR INSERT WITH CHECK (family_id = app_family_id());

CREATE POLICY observations_update ON observations
  FOR UPDATE
  USING (family_id = app_family_id())
  WITH CHECK (family_id = app_family_id());

-- No DELETE policy: Evidence rows are append-only.

-- ── Step 07: GRANT (least privilege) ───────────────────────

GRANT SELECT, INSERT ON dialogue_messages TO xiaoshuyin_app;
GRANT SELECT, INSERT ON assertions        TO xiaoshuyin_app;
GRANT SELECT, INSERT ON observations      TO xiaoshuyin_app;

GRANT UPDATE (conflict_group_id) ON assertions   TO xiaoshuyin_app;
GRANT UPDATE (conflict_group_id) ON observations TO xiaoshuyin_app;

GRANT USAGE ON TYPE assertion_kind               TO xiaoshuyin_app;
GRANT USAGE ON TYPE observation_value_state      TO xiaoshuyin_app;
GRANT USAGE ON TYPE observation_value_type       TO xiaoshuyin_app;
GRANT USAGE ON TYPE evidence_time_state          TO xiaoshuyin_app;
GRANT USAGE ON TYPE evidence_confirmation_status TO xiaoshuyin_app;

-- ── Step 08: extend existing CHECK whitelists ───────────────
-- Constraint names verified against pg_constraint before this file was written.

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
      'CASE_CREATED',
      'MESSAGE_RECORDED',
      'ASSERTION_RECORDED',
      'OBSERVATION_RECORDED'
    )
  );

ALTER TABLE business_audit_events
  DROP CONSTRAINT business_audit_events_resource_type_check;
ALTER TABLE business_audit_events
  ADD CONSTRAINT business_audit_events_resource_type_check CHECK (
    resource_type IN (
      'FAMILY',
      'PERSON',
      'CONSENT',
      'CASE',
      'DIALOGUE_MESSAGE',
      'ASSERTION',
      'OBSERVATION'
    )
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
      'CASE_CREATE',
      'CASE_MESSAGE_CREATE'
    )
  );