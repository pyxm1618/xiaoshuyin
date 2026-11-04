-- ============================================================
-- Xiaoshuyin Slice 001: Family Identity Core — Initial Schema
-- Migration: 001_initial_schema.sql
-- Order: strictly per plan.md D-6.4 (steps 02-17)
-- Target: PostgreSQL 18 (native uuidv7())
-- ============================================================

-- ── Step 02: CREATE TYPE (8 enums) ──────────────────────────

CREATE TYPE age_band AS ENUM ('ADULT', 'MINOR_14_17', 'UNDER_14', 'UNKNOWN');

CREATE TYPE provenance_source AS ENUM (
  'SELF_STATEMENT',
  'GUARDIAN_OBSERVATION',
  'GUARDIAN_RELAY',
  'OTHER_MEMBER_RELAY',
  'MANUAL_DEVICE_DATA',
  'STAFF_RECORD',
  'AI_HYPOTHESIS',
  'SOURCE_CONFIRMED'
);

CREATE TYPE profile_attribute AS ENUM ('DISPLAY_NAME');

CREATE TYPE profile_value_status AS ENUM ('RECORDED', 'SUPERSEDED', 'RETRACTED');

CREATE TYPE consent_decision AS ENUM ('GRANTED', 'REVOKED');

CREATE TYPE consent_request_status AS ENUM ('PENDING', 'GRANTED', 'EXPIRED', 'ABANDONED');

CREATE TYPE consent_purpose AS ENUM ('UNDER_14_GUARDIAN_CONSENT');

CREATE TYPE account_status AS ENUM ('ACTIVE', 'DISABLED');

-- ── Step 03: accounts ───────────────────────────────────────

CREATE TABLE accounts (
  id              uuid PRIMARY KEY DEFAULT uuidv7(),
  wechat_openid   text NOT NULL UNIQUE CHECK (length(wechat_openid) BETWEEN 1 AND 128),
  session_epoch   integer NOT NULL DEFAULT 0 CHECK (session_epoch >= 0),
  status          account_status NOT NULL DEFAULT 'ACTIVE',
  created_at      timestamptz NOT NULL DEFAULT now(),
  last_login_at   timestamptz
);

-- ── Step 04: persons ────────────────────────────────────────

CREATE TABLE persons (
  id                     uuid PRIMARY KEY DEFAULT uuidv7(),
  account_id             uuid UNIQUE REFERENCES accounts(id) ON DELETE RESTRICT,
  created_by_account_id  uuid NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

-- ── Step 05: families ───────────────────────────────────────

CREATE TABLE families (
  id                    uuid PRIMARY KEY DEFAULT uuidv7(),
  display_name          text CHECK (display_name IS NULL OR length(display_name) BETWEEN 1 AND 60),
  created_by_person_id  uuid NOT NULL UNIQUE REFERENCES persons(id) ON DELETE RESTRICT,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- ── Step 06: family_members ─────────────────────────────────

CREATE TABLE family_members (
  id         uuid PRIMARY KEY DEFAULT uuidv7(),
  family_id  uuid NOT NULL REFERENCES families(id) ON DELETE RESTRICT,
  person_id  uuid NOT NULL REFERENCES persons(id) ON DELETE RESTRICT
               DEFERRABLE INITIALLY DEFERRED,
  joined_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT family_members_family_person_key UNIQUE (family_id, person_id)
);

-- ── Step 07: guardian_consent_requests ──────────────────────

CREATE TABLE guardian_consent_requests (
  id                  uuid PRIMARY KEY DEFAULT uuidv7(),
  family_id           uuid NOT NULL REFERENCES families(id) ON DELETE RESTRICT,
  guardian_person_id  uuid NOT NULL REFERENCES persons(id) ON DELETE RESTRICT,
  subject_person_id   uuid REFERENCES persons(id) ON DELETE RESTRICT,
  declared_age_band   age_band NOT NULL CHECK (declared_age_band = 'UNDER_14'),
  notice_version      text NOT NULL,
  notice_hash         text NOT NULL CHECK (notice_hash ~ '^[0-9a-f]{64}$'),
  status              consent_request_status NOT NULL DEFAULT 'PENDING',
  expires_at          timestamptz NOT NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  completed_at        timestamptz,
  CONSTRAINT gcr_expiry_after_creation CHECK (expires_at > created_at),
  CONSTRAINT gcr_completed_consistency CHECK (
    (status = 'GRANTED') = (completed_at IS NOT NULL)
  )
);

-- ── Step 08: consent_records ────────────────────────────────

CREATE TABLE consent_records (
  id                     uuid PRIMARY KEY DEFAULT uuidv7(),
  family_id              uuid NOT NULL REFERENCES families(id) ON DELETE RESTRICT,
  guardian_person_id     uuid NOT NULL REFERENCES persons(id) ON DELETE RESTRICT,
  guardian_account_id    uuid NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  purpose                consent_purpose NOT NULL,
  decision               consent_decision NOT NULL,
  version                integer NOT NULL CHECK (version >= 1),
  onboarding_request_id  uuid
                           REFERENCES guardian_consent_requests(id) ON DELETE RESTRICT,
  bound_person_id        uuid REFERENCES persons(id) ON DELETE RESTRICT,
  bound_at               timestamptz,
  notice_version         text NOT NULL,
  notice_hash            text NOT NULL CHECK (notice_hash ~ '^[0-9a-f]{64}$'),
  policy_version         text NOT NULL,
  evidence               jsonb NOT NULL CHECK (jsonb_typeof(evidence) = 'object'),
  decided_at             timestamptz NOT NULL DEFAULT now(),
  supersedes_id          uuid REFERENCES consent_records(id) ON DELETE RESTRICT,
  CONSTRAINT consent_binding_consistency CHECK (
    (bound_person_id IS NULL) = (bound_at IS NULL)
  ),
  CONSTRAINT consent_no_self_supersede CHECK (supersedes_id IS NULL OR supersedes_id <> id),
  CONSTRAINT consent_subject_not_guardian CHECK (
    bound_person_id IS NULL OR bound_person_id <> guardian_person_id
  ),
  CONSTRAINT consent_request_binding CHECK (
    (decision = 'GRANTED' AND onboarding_request_id IS NOT NULL)
    OR (decision = 'REVOKED' AND onboarding_request_id IS NULL)
  )
);

CREATE UNIQUE INDEX consent_granted_request_key
  ON consent_records (onboarding_request_id)
  WHERE onboarding_request_id IS NOT NULL;

CREATE UNIQUE INDEX consent_subject_version_key
  ON consent_records (bound_person_id, purpose, version)
  WHERE bound_person_id IS NOT NULL;

-- ── Step 09: person_compliance_profiles ─────────────────────

CREATE TABLE person_compliance_profiles (
  person_id                   uuid PRIMARY KEY REFERENCES persons(id) ON DELETE RESTRICT,
  age_band                    age_band NOT NULL,
  minor_mode                  boolean NOT NULL,
  guardian_person_id          uuid REFERENCES persons(id) ON DELETE RESTRICT,
  guardian_consent_version    integer CHECK (guardian_consent_version >= 1),
  guardian_consent_record_id  uuid REFERENCES consent_records(id) ON DELETE RESTRICT,
  verified_source             provenance_source NOT NULL,
  effective_at                timestamptz NOT NULL DEFAULT now(),
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT pcp_minor_mode_matches_band
    CHECK (minor_mode = (age_band IN ('MINOR_14_17', 'UNDER_14'))),

  CONSTRAINT pcp_guardian_not_self
    CHECK (guardian_person_id IS NULL OR guardian_person_id <> person_id),

  CONSTRAINT pcp_under14_requires_consent CHECK (
    age_band <> 'UNDER_14'
    OR (guardian_person_id IS NOT NULL
        AND guardian_consent_record_id IS NOT NULL
        AND guardian_consent_version IS NOT NULL)
  ),

  CONSTRAINT pcp_non_under14_no_consent CHECK (
    age_band = 'UNDER_14' OR guardian_consent_record_id IS NULL
  ),

  CONSTRAINT pcp_under14_guardian_source CHECK (
    age_band <> 'UNDER_14'
    OR verified_source IN ('GUARDIAN_RELAY', 'GUARDIAN_OBSERVATION')
  ),

  CONSTRAINT pcp_consent_version_pair CHECK (
    (guardian_consent_record_id IS NULL) = (guardian_consent_version IS NULL)
  )
);

-- ── Step 10: person_profile_values ──────────────────────────

CREATE TABLE person_profile_values (
  id                      uuid PRIMARY KEY DEFAULT uuidv7(),
  person_id               uuid NOT NULL REFERENCES persons(id) ON DELETE RESTRICT,
  attribute               profile_attribute NOT NULL,
  value_text              text NOT NULL CHECK (length(value_text) BETWEEN 1 AND 120),
  source_kind             provenance_source NOT NULL,
  provided_by_person_id   uuid REFERENCES persons(id) ON DELETE RESTRICT,
  recorded_by_account_id  uuid NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  observed_at             timestamptz,
  recorded_at             timestamptz NOT NULL DEFAULT now(),
  status                  profile_value_status NOT NULL DEFAULT 'RECORDED',
  supersedes_id           uuid REFERENCES person_profile_values(id) ON DELETE RESTRICT,

  CONSTRAINT ppv_no_self_supersede CHECK (supersedes_id IS NULL OR supersedes_id <> id),

  CONSTRAINT ppv_provider_required_for_person_sources CHECK (
    source_kind NOT IN ('SELF_STATEMENT', 'GUARDIAN_OBSERVATION',
                        'GUARDIAN_RELAY', 'OTHER_MEMBER_RELAY')
    OR provided_by_person_id IS NOT NULL
  )
);

-- ── Step 11: business_audit_events ──────────────────────────

CREATE TABLE business_audit_events (
  id               uuid PRIMARY KEY DEFAULT uuidv7(),
  family_id        uuid NOT NULL REFERENCES families(id) ON DELETE RESTRICT,
  actor_account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  event_type       text NOT NULL CHECK (event_type IN (
                     'FAMILY_CREATED',
                     'MEMBER_CREATED',
                     'MEMBER_PROFILE_VALUE_RECORDED',
                     'CONSENT_REQUEST_CREATED',
                     'CONSENT_GRANTED',
                     'CONSENT_REVOKED')),
  resource_type    text NOT NULL CHECK (resource_type IN ('FAMILY','PERSON','CONSENT')),
  resource_id      uuid NOT NULL,
  metadata         jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at      timestamptz NOT NULL DEFAULT now()
);

-- ── Step 12: idempotency_keys ───────────────────────────────

CREATE TABLE idempotency_keys (
  id                uuid PRIMARY KEY DEFAULT uuidv7(),
  actor_account_id  uuid NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  command_type      text NOT NULL CHECK (command_type IN (
                      'FAMILY_CREATE','MEMBER_CREATE','MEMBER_UPDATE',
                      'GUARDIAN_CONSENT_REQUEST','GUARDIAN_CONSENT_GRANT',
                      'GUARDIAN_CONSENT_REVOKE')),
  idempotency_key   text NOT NULL CHECK (length(idempotency_key) BETWEEN 8 AND 128),
  request_hash      text NOT NULL CHECK (request_hash ~ '^[0-9a-f]{64}$'),
  response_status   integer NOT NULL,
  response_body     jsonb NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT idempotency_scope_key UNIQUE (actor_account_id, command_type, idempotency_key)
);

-- ── Step 13: remaining indexes ──────────────────────────────

CREATE INDEX family_members_person_idx ON family_members (person_id);
CREATE INDEX gcr_guardian_idx ON guardian_consent_requests (guardian_person_id);
CREATE INDEX consent_guardian_idx ON consent_records (guardian_person_id, decided_at DESC);
CREATE INDEX bae_family_time_idx ON business_audit_events (family_id, occurred_at DESC);
CREATE INDEX ppv_current_idx
  ON person_profile_values (person_id, attribute)
  WHERE status = 'RECORDED';

-- ── Step 14: RLS context functions ──────────────────────────

CREATE SCHEMA IF NOT EXISTS app;

CREATE FUNCTION app_family_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.family_id', true), '')::uuid
$$;

CREATE FUNCTION app_person_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.person_id', true), '')::uuid
$$;

CREATE FUNCTION app_account_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.account_id', true), '')::uuid
$$;

CREATE FUNCTION app_current_purpose() RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.purpose', true), '')
$$;

CREATE FUNCTION app.set_account_context(p_account_id uuid, p_purpose text)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER AS $$
BEGIN
  IF p_account_id IS NULL OR p_purpose IS NULL OR p_purpose = '' THEN
    RAISE EXCEPTION 'RLS_CONTEXT_REQUIRED' USING ERRCODE = '42501';
  END IF;
  PERFORM set_config('app.account_id', p_account_id::text, true);
  PERFORM set_config('app.purpose',    p_purpose,          true);
END $$;

CREATE FUNCTION app.set_identity_context(p_account_id uuid, p_purpose text)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE v_person uuid;
BEGIN
  PERFORM app.set_account_context(p_account_id, p_purpose);
  SELECT id INTO v_person FROM persons WHERE account_id = p_account_id;
  IF v_person IS NOT NULL THEN
    PERFORM set_config('app.person_id', v_person::text, true);
  END IF;
END $$;

CREATE FUNCTION app.set_family_context(
  p_family_id uuid, p_person_id uuid, p_purpose text
) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER AS $$
BEGIN
  IF p_family_id IS NULL OR p_person_id IS NULL OR p_purpose IS NULL
     OR p_purpose = '' THEN
    RAISE EXCEPTION 'RLS_CONTEXT_REQUIRED' USING ERRCODE = '42501';
  END IF;

  PERFORM set_config('app.family_id', p_family_id::text, true);
  PERFORM set_config('app.person_id', p_person_id::text, true);
  PERFORM set_config('app.purpose',   p_purpose,        true);

  IF NOT EXISTS (
    SELECT 1 FROM family_members
    WHERE family_id = p_family_id AND person_id = p_person_id
  ) THEN
    RAISE EXCEPTION 'FAMILY_MEMBERSHIP_REQUIRED' USING ERRCODE = '42501';
  END IF;
END $$;

CREATE FUNCTION app.create_family(
  p_family_id uuid, p_creator_person_id uuid, p_display_name text
) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER AS $$
BEGIN
  IF p_family_id IS NULL OR p_creator_person_id IS NULL THEN
    RAISE EXCEPTION 'RLS_CONTEXT_REQUIRED' USING ERRCODE = '42501';
  END IF;

  PERFORM set_config('app.family_id', p_family_id::text, true);
  PERFORM set_config('app.person_id', p_creator_person_id::text, true);
  PERFORM set_config('app.purpose',   'FAMILY_MANAGEMENT',  true);

  INSERT INTO families (id, display_name, created_by_person_id)
  VALUES (p_family_id, p_display_name, p_creator_person_id);
END $$;

-- ── Step 15: ENABLE + FORCE RLS + policies ──────────────────

ALTER TABLE families                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE families                    FORCE  ROW LEVEL SECURITY;
ALTER TABLE family_members              ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_members              FORCE  ROW LEVEL SECURITY;
ALTER TABLE guardian_consent_requests   ENABLE ROW LEVEL SECURITY;
ALTER TABLE guardian_consent_requests   FORCE  ROW LEVEL SECURITY;
ALTER TABLE consent_records             ENABLE ROW LEVEL SECURITY;
ALTER TABLE consent_records             FORCE  ROW LEVEL SECURITY;
ALTER TABLE persons                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE persons                     FORCE  ROW LEVEL SECURITY;
ALTER TABLE person_compliance_profiles  ENABLE ROW LEVEL SECURITY;
ALTER TABLE person_compliance_profiles  FORCE  ROW LEVEL SECURITY;
ALTER TABLE person_profile_values       ENABLE ROW LEVEL SECURITY;
ALTER TABLE person_profile_values       FORCE  ROW LEVEL SECURITY;
ALTER TABLE business_audit_events       ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_audit_events       FORCE  ROW LEVEL SECURITY;
ALTER TABLE idempotency_keys            ENABLE ROW LEVEL SECURITY;
ALTER TABLE idempotency_keys            FORCE  ROW LEVEL SECURITY;

-- idempotency_keys: identity-level scope
CREATE POLICY idempotency_scope ON idempotency_keys
  USING (actor_account_id = app_account_id())
  WITH CHECK (actor_account_id = app_account_id());

-- guardian_consent_requests: family-level scope
CREATE POLICY gcr_scope ON guardian_consent_requests
  USING (family_id = app_family_id()) WITH CHECK (family_id = app_family_id());

-- consent_records: family-level scope
CREATE POLICY consent_scope ON consent_records
  USING (family_id = app_family_id()) WITH CHECK (family_id = app_family_id());

-- business_audit_events: family-level scope
CREATE POLICY audit_scope ON business_audit_events
  USING (family_id = app_family_id()) WITH CHECK (family_id = app_family_id());

-- families: family context OR actor is member; write only self-create
CREATE POLICY families_scope ON families
  USING (
    id = app_family_id()
    OR EXISTS (SELECT 1 FROM family_members fm
               WHERE fm.family_id = families.id
                 AND fm.person_id = app_person_id())
  )
  WITH CHECK (
    id = app_family_id()
    AND created_by_person_id = app_person_id()
  );

-- family_members: family context OR own membership row
CREATE POLICY family_members_scope ON family_members
  USING (
    family_id = app_family_id()
    OR person_id = app_person_id()
  )
  WITH CHECK (family_id = app_family_id());

-- persons: account self OR person self OR family membership
CREATE POLICY persons_scope ON persons
  USING (
    account_id = app_account_id()
    OR id = app_person_id()
    OR EXISTS (SELECT 1 FROM family_members fm
               WHERE fm.person_id = persons.id
                 AND fm.family_id = app_family_id())
  )
  WITH CHECK (
    account_id = app_account_id()
    OR EXISTS (SELECT 1 FROM family_members fm
               WHERE fm.person_id = persons.id
                 AND fm.family_id = app_family_id())
  );

-- person_compliance_profiles: self OR family membership
CREATE POLICY pcp_scope ON person_compliance_profiles
  USING (
    person_id = app_person_id()
    OR EXISTS (SELECT 1 FROM family_members fm
               WHERE fm.person_id = person_compliance_profiles.person_id
                 AND fm.family_id = app_family_id())
  )
  WITH CHECK (EXISTS (SELECT 1 FROM family_members fm
                      WHERE fm.person_id = person_compliance_profiles.person_id
                        AND fm.family_id = app_family_id()));

-- person_profile_values: self OR family membership
CREATE POLICY ppv_scope ON person_profile_values
  USING (
    person_id = app_person_id()
    OR EXISTS (SELECT 1 FROM family_members fm
               WHERE fm.person_id = person_profile_values.person_id
                 AND fm.family_id = app_family_id())
  )
  WITH CHECK (EXISTS (SELECT 1 FROM family_members fm
                      WHERE fm.person_id = person_profile_values.person_id
                        AND fm.family_id = app_family_id()));

-- ── Step 16: consent immutable trigger ──────────────────────

CREATE FUNCTION consent_records_guard_update() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.guardian_person_id  IS DISTINCT FROM OLD.guardian_person_id
  OR NEW.guardian_account_id IS DISTINCT FROM OLD.guardian_account_id
  OR NEW.family_id           IS DISTINCT FROM OLD.family_id
  OR NEW.purpose             IS DISTINCT FROM OLD.purpose
  OR NEW.decision            IS DISTINCT FROM OLD.decision
  OR NEW.version             IS DISTINCT FROM OLD.version
  OR NEW.notice_version      IS DISTINCT FROM OLD.notice_version
  OR NEW.notice_hash         IS DISTINCT FROM OLD.notice_hash
  OR NEW.policy_version      IS DISTINCT FROM OLD.policy_version
  OR NEW.evidence            IS DISTINCT FROM OLD.evidence
  OR NEW.decided_at          IS DISTINCT FROM OLD.decided_at
  OR NEW.supersedes_id       IS DISTINCT FROM OLD.supersedes_id
  OR NEW.onboarding_request_id IS DISTINCT FROM OLD.onboarding_request_id
  THEN
    RAISE EXCEPTION 'CONSENT_RECORD_IMMUTABLE' USING ERRCODE = '23514';
  END IF;
  IF OLD.bound_person_id IS NULL AND OLD.bound_at IS NULL THEN
    IF (NEW.bound_person_id IS NULL) <> (NEW.bound_at IS NULL) THEN
      RAISE EXCEPTION 'CONSENT_BINDING_PARTIAL' USING ERRCODE = '23514';
    END IF;
  ELSE
    IF NEW.bound_person_id IS DISTINCT FROM OLD.bound_person_id
    OR NEW.bound_at        IS DISTINCT FROM OLD.bound_at THEN
      RAISE EXCEPTION 'CONSENT_BINDING_IS_IMMUTABLE' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER consent_records_guard
  BEFORE UPDATE ON consent_records
  FOR EACH ROW EXECUTE FUNCTION consent_records_guard_update();

-- ── Step 17: GRANT to xiaoshuyin_app ────────────────────────

GRANT SELECT, INSERT, UPDATE, DELETE ON
  accounts,
  persons,
  families,
  family_members,
  guardian_consent_requests,
  consent_records,
  person_compliance_profiles,
  person_profile_values,
  business_audit_events,
  idempotency_keys
TO xiaoshuyin_app;

GRANT USAGE ON TYPE age_band TO xiaoshuyin_app;
GRANT USAGE ON TYPE provenance_source TO xiaoshuyin_app;
GRANT USAGE ON TYPE profile_attribute TO xiaoshuyin_app;
GRANT USAGE ON TYPE profile_value_status TO xiaoshuyin_app;
GRANT USAGE ON TYPE consent_decision TO xiaoshuyin_app;
GRANT USAGE ON TYPE consent_request_status TO xiaoshuyin_app;
GRANT USAGE ON TYPE consent_purpose TO xiaoshuyin_app;
GRANT USAGE ON TYPE account_status TO xiaoshuyin_app;

GRANT USAGE ON SCHEMA app TO xiaoshuyin_app;
GRANT EXECUTE ON FUNCTION app.set_account_context(uuid, text) TO xiaoshuyin_app;
GRANT EXECUTE ON FUNCTION app.set_identity_context(uuid, text) TO xiaoshuyin_app;
GRANT EXECUTE ON FUNCTION app.set_family_context(uuid, uuid, text) TO xiaoshuyin_app;
GRANT EXECUTE ON FUNCTION app.create_family(uuid, uuid, text) TO xiaoshuyin_app;
