-- ============================================================================
-- Slice 9 — Safety Hold Control Foundation
-- Migration: 009_safety_hold_control_foundation.sql
--
-- Reviewed additive migration. Scope:
--   1. append-only `risk_events` trace table (Family/Case scoped)
--   2. `risk_events` structural invariants (composite FK, same-Case resolution
--      self-link, event-kind/shape CHECKs, unique resolution fence, indexes)
--   3. `risk_events` RLS: ENABLE + FORCE + Family-scope policy
--   4. runtime privileges: SELECT + INSERT only (no UPDATE/DELETE/TRUNCATE)
--   5. narrow `cases` column-level UPDATE grant for `status`
--   6. Case Event vocabulary + exact metadata shape for the two Safety events
--   7. Business Audit event vocabulary for the same two Safety actions
--   8. idempotency command vocabulary + bytea key representation for the two
--      Safety commands
--
-- NOT created here: `safety_states`, any mutable current-Safety column, any
-- support/referral/review/staff/operations object. `cases.status` stays the
-- single current Safety truth; `risk_events` is trace evidence only.
--
-- Migration number is integration metadata, not a product contract (plan §16).
-- At authoring time the verified main highest prefix is 007; Slice 8 planning
-- provisionally claims 008, so Slice 9 uses the provisional 009 prefix.
--
-- Baseline literals were re-read from the applied 001–007 migrations:
--   case_events.event_type: 3 values (CASE_CREATED, CASE_PRIMARY_ASSIGNED,
--     CASE_PRIMARY_REVOKED).
--   business_audit_events.event_type: 16 values (001/002/004/005 + 007).
--   business_audit_events.resource_type: 8 values (not modified here).
--   idempotency_keys.command_type: 13 values.
--   cases legal UPDATE columns before this Slice: is_primary, version,
--     updated_at; table-level UPDATE is still not granted.
-- ============================================================================

-- ── Step 01: risk_events (append-only Safety trace) ─────────
-- `decisions_case_version` binds the trace to the locked Case revision the
-- decision was made against. Policy/rule/category identities are opaque,
-- non-sensitive references — never raw user text or review narrative.

CREATE TABLE risk_events (
  id                          uuid PRIMARY KEY DEFAULT uuidv7(),
  family_id                   uuid NOT NULL,
  case_id                     uuid NOT NULL,
  actor_account_id            uuid NOT NULL,
  event_kind                  text NOT NULL,
  decision_case_version       integer NOT NULL,
  policy_ref                  text,
  policy_version              text,
  rule_ref                    text,
  rule_version                text,
  risk_category_ref           text,
  evidence_refs               jsonb NOT NULL DEFAULT '[]'::jsonb,
  resolution_of_risk_event_id uuid,
  resolution_authority_ref    text,
  created_at                  timestamptz NOT NULL DEFAULT now()
);

-- ── Step 02: structural invariants ──────────────────────────

ALTER TABLE risk_events
  -- Cross-Family links are structurally impossible, independent of RLS.
  ADD CONSTRAINT risk_events_case_family_fk
    FOREIGN KEY (case_id, family_id) REFERENCES cases (id, family_id)
    ON DELETE RESTRICT,
  ADD CONSTRAINT risk_events_actor_fk
    FOREIGN KEY (actor_account_id) REFERENCES accounts (id)
    ON DELETE RESTRICT,
  -- The resolution trace must point at a HOLD_ENTERED event of the SAME Case
  -- and Family. The referenced key below makes that composite link possible.
  ADD CONSTRAINT risk_events_id_case_family_key
    UNIQUE (id, case_id, family_id),
  ADD CONSTRAINT risk_events_resolution_same_case_fk
    FOREIGN KEY (resolution_of_risk_event_id, case_id, family_id)
    REFERENCES risk_events (id, case_id, family_id)
    ON DELETE RESTRICT,
  ADD CONSTRAINT risk_events_event_kind_check
    CHECK (event_kind IN ('HOLD_ENTERED', 'RISK_RESOLVED')),
  ADD CONSTRAINT risk_events_decision_version_check
    CHECK (decision_case_version >= 1),
  -- Entry records the deterministic policy/rule/category identity and forbids
  -- resolution-only fields. Resolution records the link + verified authority
  -- and does not duplicate the original policy payload.
  ADD CONSTRAINT risk_events_shape_check CHECK (
    (
      event_kind = 'HOLD_ENTERED'
      AND policy_ref IS NOT NULL
      AND btrim(policy_ref) <> ''
      AND policy_version IS NOT NULL
      AND btrim(policy_version) <> ''
      AND rule_ref IS NOT NULL
      AND btrim(rule_ref) <> ''
      AND rule_version IS NOT NULL
      AND btrim(rule_version) <> ''
      AND risk_category_ref IS NOT NULL
      AND btrim(risk_category_ref) <> ''
      AND jsonb_typeof(evidence_refs) = 'array'
      AND resolution_of_risk_event_id IS NULL
      AND resolution_authority_ref IS NULL
    )
    OR
    (
      event_kind = 'RISK_RESOLVED'
      AND policy_ref IS NULL
      AND policy_version IS NULL
      AND rule_ref IS NULL
      AND rule_version IS NULL
      AND risk_category_ref IS NULL
      AND jsonb_typeof(evidence_refs) = 'array'
      AND jsonb_array_length(evidence_refs) >= 1
      AND resolution_of_risk_event_id IS NOT NULL
      AND resolution_authority_ref IS NOT NULL
      AND btrim(resolution_authority_ref) <> ''
    )
  );

-- At most one resolution trace per hold trace.
CREATE UNIQUE INDEX risk_events_one_resolution_per_hold
  ON risk_events (resolution_of_risk_event_id)
  WHERE event_kind = 'RISK_RESOLVED';

-- ── Step 03: timeline indexes ───────────────────────────────

CREATE INDEX risk_events_case_time_idx   ON risk_events (case_id, created_at ASC);
CREATE INDEX risk_events_family_time_idx ON risk_events (family_id, created_at ASC);

-- ── Step 04: ENABLE + FORCE ROW LEVEL SECURITY ──────────────

ALTER TABLE risk_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_events FORCE  ROW LEVEL SECURITY;

CREATE POLICY risk_events_family_scope ON risk_events
  USING (family_id = app_family_id())
  WITH CHECK (family_id = app_family_id());

-- ── Step 05: runtime privileges (append-only) ───────────────

GRANT SELECT, INSERT ON risk_events TO xiaoshuyin_app;
-- No UPDATE / DELETE / TRUNCATE. Historical trace correction, if it is ever
-- required, must be a future explicit contract.

-- ── Step 06: narrow cases column UPDATE grant ───────────────
-- Table-level UPDATE stays denied. `is_primary, version, updated_at` were
-- already granted by 007; this adds only the Safety-required `status`.
-- `phase` is deliberately NOT granted: Safety transitions must preserve it.

GRANT UPDATE (status) ON cases TO xiaoshuyin_app;

-- ── Step 07: Case Event vocabulary + exact metadata shape ───

ALTER TABLE case_events
  DROP CONSTRAINT case_events_event_type_check;
ALTER TABLE case_events
  ADD CONSTRAINT case_events_event_type_check CHECK (
    event_type IN (
      'CASE_CREATED',
      'CASE_PRIMARY_ASSIGNED',
      'CASE_PRIMARY_REVOKED',
      'CASE_SAFETY_HOLD_ENTERED',
      'CASE_RISK_RESOLVED'
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
    -- Slice 9 Safety transitions: exactly the state/version pair and the
    -- risk trace id. No policy payload, evidence content, status text or
    -- free-form reason may be added.
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

-- ── Step 08: Business Audit event vocabulary ────────────────
-- Resource type stays `CASE`; no payload widening.

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
      'CASE_SAFETY_HOLD_ENTERED',
      'CASE_RISK_RESOLVED'
    )
  );

-- ── Step 09: idempotency command vocabulary ─────────────────

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
      'CASE_ENTER_SAFETY_HOLD',
      'CASE_RESOLVE_RISK'
    )
  );

-- Both Safety commands use the modern bytea exact-key representation
-- (UTF-16LE of the logical key), exactly like CASE_SWITCH_PRIMARY.
ALTER TABLE idempotency_keys
  DROP CONSTRAINT idempotency_keys_key_representation_check;
ALTER TABLE idempotency_keys
  ADD CONSTRAINT idempotency_keys_key_representation_check CHECK (
    (
      command_type NOT IN (
        'CASE_CREATE',
        'CASE_SWITCH_PRIMARY',
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
      command_type IN ('CASE_SWITCH_PRIMARY', 'CASE_ENTER_SAFETY_HOLD', 'CASE_RESOLVE_RISK')
      AND idempotency_key IS NULL
      AND idempotency_key_bytes IS NOT NULL
    )
  );