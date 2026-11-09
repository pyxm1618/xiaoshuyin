-- ============================================================
-- Slice 7 — SwitchPrimaryCase
-- Migration: 005_case_primary_switch.sql
--
-- Reviewed additive migration. Scope is exactly six statements:
--   1. case_events event vocabulary (3 values)
--   2. case_events metadata shape (per event type)
--   3. business_audit_events event vocabulary (existing values + 1)
--   4. idempotency_keys command vocabulary (existing values + 1)
--   5. idempotency_keys key representation (bytea-only for the new command)
--   6. column-level GRANT UPDATE (is_primary, version, updated_at) on cases
--
-- No new table / column / index / enum / policy. `001` / `002` / `003` are not
-- modified. Rollback notes: plan.md D-9.7.
--
-- G7 measured baseline on the merged main (2026-11-09): business_audit_events
-- already carries the Slice 3 event types (MESSAGE_RECORDED, ASSERTION_RECORDED,
-- OBSERVATION_RECORDED) and idempotency_keys.command_type already carries
-- CASE_MESSAGE_CREATE. This migration preserves every existing literal and only
-- appends the Slice 7 literal.
-- ============================================================

ALTER TABLE case_events
  DROP CONSTRAINT case_events_event_type_check;
ALTER TABLE case_events
  ADD CONSTRAINT case_events_event_type_check CHECK (
    event_type IN (
      'CASE_CREATED',
      'CASE_PRIMARY_ASSIGNED',
      'CASE_PRIMARY_REVOKED'
    )
  );

ALTER TABLE case_events
  DROP CONSTRAINT case_events_metadata_shape_check;
ALTER TABLE case_events
  ADD CONSTRAINT case_events_metadata_shape_check CHECK (
    (
      event_type = 'CASE_CREATED'
      AND jsonb_typeof(metadata) = 'object'
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
    OR (
      event_type = 'CASE_PRIMARY_ASSIGNED'
      AND jsonb_typeof(metadata) = 'object'
      AND metadata ? 'primary'
      AND metadata ? 'version'
      AND metadata ? 'previousPrimaryCaseId'
      AND metadata ? 'reason'
      AND metadata - 'primary' - 'version' - 'previousPrimaryCaseId' - 'reason' = '{}'::jsonb
      AND metadata -> 'primary' = 'true'::jsonb
      AND jsonb_typeof(metadata -> 'version') = 'number'
      AND CASE
            WHEN jsonb_typeof(metadata -> 'version') = 'number'
            THEN (metadata ->> 'version')::numeric = trunc((metadata ->> 'version')::numeric)
                 AND (metadata ->> 'version')::numeric >= 1
            ELSE false
          END
      AND (
            jsonb_typeof(metadata -> 'previousPrimaryCaseId') = 'null'
            OR jsonb_typeof(metadata -> 'previousPrimaryCaseId') = 'string'
          )
      AND jsonb_typeof(metadata -> 'reason') = 'string'
      AND btrim(metadata ->> 'reason') <> ''
      AND length(metadata ->> 'reason') <= 500
    )
    OR (
      event_type = 'CASE_PRIMARY_REVOKED'
      AND jsonb_typeof(metadata) = 'object'
      AND metadata ? 'primary'
      AND metadata ? 'version'
      AND metadata ? 'newPrimaryCaseId'
      AND metadata ? 'reason'
      AND metadata - 'primary' - 'version' - 'newPrimaryCaseId' - 'reason' = '{}'::jsonb
      AND metadata -> 'primary' = 'false'::jsonb
      AND jsonb_typeof(metadata -> 'version') = 'number'
      AND CASE
            WHEN jsonb_typeof(metadata -> 'version') = 'number'
            THEN (metadata ->> 'version')::numeric = trunc((metadata ->> 'version')::numeric)
                 AND (metadata ->> 'version')::numeric >= 1
            ELSE false
          END
      AND jsonb_typeof(metadata -> 'newPrimaryCaseId') = 'string'
      AND jsonb_typeof(metadata -> 'reason') = 'string'
      AND btrim(metadata ->> 'reason') <> ''
      AND length(metadata ->> 'reason') <= 500
    )
  );

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
      'OBSERVATION_RECORDED',
      'CASE_PRIMARY_SWITCHED'
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
      'CASE_MESSAGE_CREATE',
      'CASE_SWITCH_PRIMARY'
    )
  );

ALTER TABLE idempotency_keys
  DROP CONSTRAINT idempotency_keys_key_representation_check;
ALTER TABLE idempotency_keys
  ADD CONSTRAINT idempotency_keys_key_representation_check CHECK (
    (
      command_type NOT IN ('CASE_CREATE', 'CASE_SWITCH_PRIMARY')
      AND idempotency_key IS NOT NULL
      AND idempotency_key_bytes IS NULL
    )
    OR (
      command_type = 'CASE_CREATE'
      AND (
        (idempotency_key IS NOT NULL AND idempotency_key_bytes IS NULL)
        OR (idempotency_key IS NULL AND idempotency_key_bytes IS NOT NULL)
      )
    )
    OR (
      command_type = 'CASE_SWITCH_PRIMARY'
      AND idempotency_key IS NULL
      AND idempotency_key_bytes IS NOT NULL
    )
  );

GRANT UPDATE (is_primary, version, updated_at) ON cases TO xiaoshuyin_app;