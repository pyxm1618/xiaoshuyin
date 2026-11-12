-- ============================================================
-- Slice 8 ↔ Slice 9 shared vocabulary reconciliation
-- Migration: 010_problem_formulation_safety_vocabulary_reconcile.sql
--
-- 009 rewrote shared CHECKs from a main line that did not contain Slice 8.
-- This additive migration restores the Slice 8 literals while preserving the
-- Slice 9 Safety literals and metadata shape. No historical migration changed.
-- ============================================================

ALTER TABLE case_events DROP CONSTRAINT case_events_event_type_check;
ALTER TABLE case_events
  ADD CONSTRAINT case_events_event_type_check CHECK (
    event_type IN (
      'CASE_CREATED',
      'CASE_PRIMARY_ASSIGNED',
      'CASE_PRIMARY_REVOKED',
      'CASE_ASSESSMENT_STARTED',
      'CASE_PROBLEM_FORMULATION_PRESENTED',
      'CASE_PROBLEM_FORMULATION_CONFIRMED',
      'CASE_PROBLEM_FORMULATION_DISPUTED',
      'CASE_PROBLEM_FORMULATION_CORRECTED',
      'CASE_REASSESSMENT_STARTED',
      'CASE_SAFETY_HOLD_ENTERED',
      'CASE_RISK_RESOLVED'
    )
  );

ALTER TABLE case_events DROP CONSTRAINT case_events_metadata_shape_check;
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
    OR (
      event_type = 'CASE_ASSESSMENT_STARTED'
      AND jsonb_typeof(metadata) = 'object'
      AND metadata ? 'fromPhase'
      AND metadata ? 'toPhase'
      AND metadata ? 'version'
      AND metadata - 'fromPhase' - 'toPhase' - 'version' = '{}'::jsonb
      AND metadata ->> 'fromPhase' = 'INTAKE'
      AND metadata ->> 'toPhase' = 'ASSESSMENT'
      AND jsonb_typeof(metadata -> 'version') = 'number'
    )
    OR (
      event_type = 'CASE_PROBLEM_FORMULATION_PRESENTED'
      AND jsonb_typeof(metadata) = 'object'
      AND metadata ? 'formulationVersion'
      AND metadata ? 'fromPhase'
      AND metadata ? 'toPhase'
      AND metadata ? 'version'
      AND metadata - 'formulationVersion' - 'fromPhase' - 'toPhase' - 'version' = '{}'::jsonb
      AND metadata ->> 'fromPhase' = 'ASSESSMENT'
      AND metadata ->> 'toPhase' = 'PROBLEM_FORMULATION'
      AND jsonb_typeof(metadata -> 'formulationVersion') = 'number'
      AND jsonb_typeof(metadata -> 'version') = 'number'
    )
    OR (
      event_type = 'CASE_PROBLEM_FORMULATION_CONFIRMED'
      AND jsonb_typeof(metadata) = 'object'
      AND metadata ? 'formulationVersion'
      AND metadata ? 'fromStatus'
      AND metadata ? 'toStatus'
      AND metadata ? 'fromPhase'
      AND metadata ? 'toPhase'
      AND metadata ? 'version'
      AND metadata - 'formulationVersion' - 'fromStatus' - 'toStatus' - 'fromPhase' - 'toPhase' - 'version' = '{}'::jsonb
      AND metadata ->> 'fromStatus' = 'PRESENTED'
      AND metadata ->> 'toStatus' = 'CONFIRMED'
      AND metadata ->> 'fromPhase' = 'PROBLEM_FORMULATION'
      AND metadata ->> 'toPhase' = 'GOALS'
      AND jsonb_typeof(metadata -> 'formulationVersion') = 'number'
      AND jsonb_typeof(metadata -> 'version') = 'number'
    )
    OR (
      event_type = 'CASE_PROBLEM_FORMULATION_DISPUTED'
      AND jsonb_typeof(metadata) = 'object'
      AND metadata ? 'formulationVersion'
      AND metadata ? 'fromStatus'
      AND metadata ? 'toStatus'
      AND metadata ? 'version'
      AND metadata - 'formulationVersion' - 'fromStatus' - 'toStatus' - 'version' = '{}'::jsonb
      AND metadata ->> 'fromStatus' = 'PRESENTED'
      AND metadata ->> 'toStatus' = 'DISPUTED'
      AND jsonb_typeof(metadata -> 'formulationVersion') = 'number'
      AND jsonb_typeof(metadata -> 'version') = 'number'
    )
    OR (
      event_type = 'CASE_PROBLEM_FORMULATION_CORRECTED'
      AND jsonb_typeof(metadata) = 'object'
      AND metadata ? 'fromFormulationVersion'
      AND metadata ? 'toFormulationVersion'
      AND metadata ? 'fromStatus'
      AND metadata ? 'toStatus'
      AND metadata ? 'version'
      AND metadata - 'fromFormulationVersion' - 'toFormulationVersion' - 'fromStatus' - 'toStatus' - 'version' = '{}'::jsonb
      AND metadata ->> 'toStatus' = 'PRESENTED'
      AND jsonb_typeof(metadata -> 'fromFormulationVersion') = 'number'
      AND jsonb_typeof(metadata -> 'toFormulationVersion') = 'number'
      AND jsonb_typeof(metadata -> 'version') = 'number'
    )
    OR (
      event_type = 'CASE_REASSESSMENT_STARTED'
      AND jsonb_typeof(metadata) = 'object'
      AND metadata ? 'formulationVersion'
      AND metadata ? 'fromPhase'
      AND metadata ? 'toPhase'
      AND metadata ? 'version'
      AND metadata - 'formulationVersion' - 'fromPhase' - 'toPhase' - 'version' = '{}'::jsonb
      AND metadata ->> 'fromPhase' = 'PROBLEM_FORMULATION'
      AND metadata ->> 'toPhase' = 'ASSESSMENT'
      AND jsonb_typeof(metadata -> 'formulationVersion') = 'number'
      AND jsonb_typeof(metadata -> 'version') = 'number'
    )
      OR (
      event_type IN ('CASE_SAFETY_HOLD_ENTERED', 'CASE_RISK_RESOLVED')
      AND jsonb_typeof(metadata) = 'object'
      AND metadata ? 'fromStatus'
      AND metadata ? 'toStatus'
      AND metadata ? 'fromVersion'
      AND metadata ? 'toVersion'
      AND metadata ? 'riskEventId'
      AND metadata - 'fromStatus' - 'toStatus' - 'fromVersion' - 'toVersion'
                  - 'riskEventId' = '{}'::jsonb
      AND jsonb_typeof(metadata -> 'fromStatus') = 'string'
      AND jsonb_typeof(metadata -> 'toStatus') = 'string'
      AND jsonb_typeof(metadata -> 'riskEventId') = 'string'
      AND CASE
            WHEN jsonb_typeof(metadata -> 'fromVersion') = 'number'
             AND jsonb_typeof(metadata -> 'toVersion') = 'number'
            THEN (metadata ->> 'fromVersion')::numeric = trunc((metadata ->> 'fromVersion')::numeric)
                 AND (metadata ->> 'toVersion')::numeric = trunc((metadata ->> 'toVersion')::numeric)
                 AND (metadata ->> 'fromVersion')::numeric >= 1
                 AND (metadata ->> 'toVersion')::numeric >= 1
            ELSE false
          END
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
      'PARTICIPATION_INVITE_CREATED',
      'PARTICIPATION_ACCEPTED',
      'PARTICIPATION_DECLINED',
      'PARTICIPATION_EXPIRED',
      'PARTICIPATION_WITHDRAWN',
      'CASE_PRIMARY_SWITCHED',
      'CASE_ASSESSMENT_STARTED',
      'CASE_PROBLEM_FORMULATION_PRESENTED',
      'CASE_PROBLEM_FORMULATION_CONFIRMED',
      'CASE_PROBLEM_FORMULATION_DISPUTED',
      'CASE_PROBLEM_FORMULATION_CORRECTED',
      'CASE_REASSESSMENT_STARTED',
      'CASE_SAFETY_HOLD_ENTERED',
      'CASE_RISK_RESOLVED'
    )
  );

ALTER TABLE business_audit_events
  DROP CONSTRAINT business_audit_events_resource_type_check;
ALTER TABLE business_audit_events
  ADD CONSTRAINT business_audit_events_resource_type_check CHECK (
    resource_type IN (
      'FAMILY', 'PERSON', 'CONSENT', 'CASE', 'DIALOGUE_MESSAGE',
      'ASSERTION', 'OBSERVATION', 'CASE_PARTICIPANT', 'PROBLEM_FORMULATION'
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
      'PARTICIPATION_INVITE_CREATE',
      'PARTICIPATION_ACCEPT',
      'PARTICIPATION_DECLINE',
      'PARTICIPATION_WITHDRAW',
      'CASE_SWITCH_PRIMARY',
      'CASE_START_ASSESSMENT',
      'PROBLEM_FORMULATION_PRESENT',
      'PROBLEM_FORMULATION_CONFIRM',
      'PROBLEM_FORMULATION_DISPUTE',
      'PROBLEM_FORMULATION_CORRECT',
      'CASE_REASSESS_FROM_FORMULATION',
      'CASE_ENTER_SAFETY_HOLD',
      'CASE_RESOLVE_RISK'
    )
  );

ALTER TABLE idempotency_keys
  DROP CONSTRAINT idempotency_keys_key_representation_check;
ALTER TABLE idempotency_keys
  ADD CONSTRAINT idempotency_keys_key_representation_check CHECK (
    (
      command_type NOT IN (
        'CASE_CREATE',
        'CASE_SWITCH_PRIMARY',
        'CASE_START_ASSESSMENT',
        'PROBLEM_FORMULATION_PRESENT',
        'PROBLEM_FORMULATION_CONFIRM',
        'PROBLEM_FORMULATION_DISPUTE',
        'PROBLEM_FORMULATION_CORRECT',
        'CASE_REASSESS_FROM_FORMULATION',
        'CASE_ENTER_SAFETY_HOLD',
        'CASE_RESOLVE_RISK'
      )
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
      command_type IN (
        'CASE_SWITCH_PRIMARY',
        'CASE_START_ASSESSMENT',
        'PROBLEM_FORMULATION_PRESENT',
        'PROBLEM_FORMULATION_CONFIRM',
        'PROBLEM_FORMULATION_DISPUTE',
        'PROBLEM_FORMULATION_CORRECT',
        'CASE_REASSESS_FROM_FORMULATION',
        'CASE_ENTER_SAFETY_HOLD',
        'CASE_RESOLVE_RISK'
      )
      AND idempotency_key IS NULL
      AND idempotency_key_bytes IS NOT NULL
    )
  );
