-- Slice 4 — Case Participant Core
-- Reviewed additive migration. Do not rewrite prior migrations.

-- ── Step 01: lifecycle enum ─────────────────────────────────
CREATE TYPE case_participation_state AS ENUM (
  'PENDING',
  'ACTIVE',
  'DECLINED',
  'EXPIRED',
  'WITHDRAWN'
);

-- ── Step 02: reverse unique key for composite membership FK ─
ALTER TABLE family_members
  ADD CONSTRAINT family_members_person_family_key UNIQUE (person_id, family_id);

-- ── Step 03: participation resource ─────────────────────────
CREATE TABLE case_participants (
  id                    uuid PRIMARY KEY DEFAULT uuidv7(),
  family_id             uuid NOT NULL,
  case_id               uuid NOT NULL,
  person_id             uuid NOT NULL,
  state                 case_participation_state NOT NULL,
  invite_token_hash     text NOT NULL,
  invite_expires_at     timestamptz NOT NULL,
  created_by_person_id  uuid NOT NULL,
  accepted_at           timestamptz,
  declined_at           timestamptz,
  expired_at            timestamptz,
  withdrawn_at          timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT case_participants_family_fk
    FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE RESTRICT,
  CONSTRAINT case_participants_person_fk
    FOREIGN KEY (person_id) REFERENCES persons(id) ON DELETE RESTRICT,
  CONSTRAINT case_participants_creator_fk
    FOREIGN KEY (created_by_person_id) REFERENCES persons(id) ON DELETE RESTRICT,
  CONSTRAINT case_participants_case_family_fk
    FOREIGN KEY (case_id, family_id)
    REFERENCES cases(id, family_id) ON DELETE RESTRICT,
  CONSTRAINT case_participants_person_family_fk
    FOREIGN KEY (person_id, family_id)
    REFERENCES family_members(person_id, family_id) ON DELETE RESTRICT,

  CONSTRAINT case_participants_token_key UNIQUE (invite_token_hash),
  CONSTRAINT case_participants_invite_token_hash_check
    CHECK (invite_token_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT case_participants_invite_expiry_check
    CHECK (invite_expires_at > created_at),
  CONSTRAINT case_participants_state_timestamps_check CHECK (
    (state = 'PENDING'
      AND accepted_at IS NULL AND declined_at IS NULL
      AND expired_at IS NULL AND withdrawn_at IS NULL)
    OR
    (state = 'ACTIVE'
      AND accepted_at IS NOT NULL AND declined_at IS NULL
      AND expired_at IS NULL AND withdrawn_at IS NULL)
    OR
    (state = 'DECLINED'
      AND accepted_at IS NULL AND declined_at IS NOT NULL
      AND expired_at IS NULL AND withdrawn_at IS NULL)
    OR
    (state = 'EXPIRED'
      AND accepted_at IS NULL AND declined_at IS NULL
      AND expired_at IS NOT NULL AND withdrawn_at IS NULL)
    OR
    (state = 'WITHDRAWN'
      AND accepted_at IS NOT NULL AND declined_at IS NULL
      AND expired_at IS NULL AND withdrawn_at IS NOT NULL)
  ),
  CONSTRAINT case_participants_expired_at_after_deadline_check
    CHECK (expired_at IS NULL OR expired_at >= invite_expires_at),
  CONSTRAINT case_participants_withdrawn_after_accept_check
    CHECK (
      withdrawn_at IS NULL
      OR (accepted_at IS NOT NULL AND withdrawn_at >= accepted_at)
    ),
  CONSTRAINT case_participants_accept_after_create_check
    CHECK (accepted_at IS NULL OR accepted_at >= created_at),
  CONSTRAINT case_participants_decline_after_create_check
    CHECK (declined_at IS NULL OR declined_at >= created_at)
);

CREATE UNIQUE INDEX case_participants_one_live_per_case_person
  ON case_participants (case_id, person_id)
  WHERE state IN ('PENDING', 'ACTIVE');

CREATE INDEX case_participants_family_case_idx
  ON case_participants (family_id, case_id);

CREATE INDEX case_participants_person_idx
  ON case_participants (person_id);

CREATE INDEX case_participants_expiry_idx
  ON case_participants (invite_expires_at)
  WHERE state = 'PENDING';

-- ── Step 04: token-only transaction context ─────────────────
CREATE FUNCTION app_invite_token_hash() RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.invite_token_hash', true), '')
$$;

CREATE FUNCTION app.set_invite_token_context(p_token_hash text)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  IF p_token_hash IS NULL OR p_token_hash = ''
     OR p_token_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'RLS_CONTEXT_REQUIRED' USING ERRCODE = '42501';
  END IF;

  PERFORM set_config('app.invite_token_hash', p_token_hash, true);
END $$;

-- ── Step 05: RLS ─────────────────────────────────────────────
ALTER TABLE case_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_participants FORCE ROW LEVEL SECURITY;

CREATE POLICY case_participants_family_scope ON case_participants
  FOR ALL
  USING (family_id = app_family_id())
  WITH CHECK (family_id = app_family_id());

CREATE POLICY case_participants_self_read ON case_participants
  FOR SELECT
  USING (person_id = app_person_id());

CREATE POLICY case_participants_invite_token_read ON case_participants
  FOR SELECT
  USING (
    state = 'PENDING'
    AND invite_token_hash = app_invite_token_hash()
  );

-- Safe unauthenticated projection. security_invoker keeps base-table RLS active.
CREATE VIEW case_participant_invite_public
WITH (security_invoker = true) AS
SELECT
  id AS participation_id,
  state,
  invite_expires_at AS expires_at,
  created_at
FROM case_participants
WHERE state = 'PENDING'
  AND invite_expires_at > now();

-- ── Step 06: extend shared audit/idempotency vocabularies ───
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
      'PARTICIPATION_WITHDRAWN'
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
      'OBSERVATION',
      'CASE_PARTICIPANT'
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
      'PARTICIPATION_WITHDRAW'
    )
  );

-- ── Step 07: least-privilege grants ─────────────────────────
GRANT SELECT, INSERT, UPDATE ON case_participants TO xiaoshuyin_app;
GRANT SELECT ON case_participant_invite_public TO xiaoshuyin_app;
GRANT USAGE ON TYPE case_participation_state TO xiaoshuyin_app;

REVOKE ALL ON FUNCTION app_invite_token_hash() FROM PUBLIC;
REVOKE ALL ON FUNCTION app.set_invite_token_context(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_invite_token_hash() TO xiaoshuyin_app;
GRANT EXECUTE ON FUNCTION app.set_invite_token_context(text) TO xiaoshuyin_app;
