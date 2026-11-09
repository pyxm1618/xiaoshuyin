-- ============================================================================
-- 004_identity_binding_runtime.sql — Slice 006 Identity Binding Runtime
--
-- Additive only. Does NOT modify 001 / 002 / 003, Slice 1 tables / enums /
-- constraints / existing policies. Owns exactly five tables, five enums,
-- purpose-scoped RLS contexts, append-only triggers and least-privilege grants.
--
-- Frozen design: specs/006-identity-binding-runtime/plan.md D-2 / D-3 / D-4 /
-- D-5 / D-13 / D-15 / D-18.
-- ============================================================================

-- ── Step 01: enums (5) ──────────────────────────────────────

CREATE TYPE binding_attempt_state AS ENUM ('PENDING', 'COMMITTED', 'TERMINAL');

CREATE TYPE binding_confirmation_kind AS ENUM ('CANDIDATE', 'SECOND_PARTY');

CREATE TYPE binding_confirmer_authority AS ENUM ('GUARDIAN', 'FAMILY_MANAGER');

CREATE TYPE binding_operation_scope AS ENUM ('CANDIDATE_CONTEXT', 'ACCOUNT');

CREATE TYPE binding_operation_command AS ENUM (
  'BOOTSTRAP', 'CANDIDATE_DECISION', 'SECOND_PARTY_DECISION'
);

-- ── Step 02: binding_attempts ───────────────────────────────

CREATE TABLE binding_attempts (
  id                          uuid PRIMARY KEY DEFAULT uuidv7(),
  target_person_id            uuid NOT NULL REFERENCES persons(id) ON DELETE RESTRICT,
  target_family_id            uuid NOT NULL REFERENCES families(id) ON DELETE RESTRICT,
  invitation_participation_id uuid NOT NULL,
  candidate_identity_digest   text NOT NULL CHECK (candidate_identity_digest ~ '^[0-9a-f]{64}$'),
  state                       binding_attempt_state NOT NULL DEFAULT 'PENDING',
  terminal_reason             text,
  committed_account_id        uuid REFERENCES accounts(id) ON DELETE RESTRICT,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  expires_at                  timestamptz NOT NULL,
  settled_at                  timestamptz,
  CONSTRAINT binding_attempt_expiry_after_creation CHECK (expires_at > created_at),
  CONSTRAINT binding_attempt_terminal_reason_closed CHECK (
    terminal_reason IS NULL OR terminal_reason IN (
      'IDENTITY_CONFLICT',
      'TARGET_ALREADY_BOUND',
      'CANDIDATE_ACCOUNT_BOUND_OTHER_PERSON',
      'MULTI_FAMILY_BLOCK',
      'AGE_BAND_ADULT_UNSUPPORTED',
      'AGE_BAND_UNKNOWN_BLOCKED',
      'GUARDIAN_MISSING',
      'GUARDIAN_CONSENT_INVALID',
      'COMPLIANCE_BLOCKED',
      'INVITATION_TERMINAL',
      'ATTEMPT_EXPIRED',
      'CANDIDATE_REJECTED',
      'CANDIDATE_CANCELLED',
      'WRONG_CONFIRMER',
      'RECOGNITION_REJECTED',
      'CONFIRMER_REJECTED',
      'CONCURRENCY_LOSER'
    )
  ),
  CONSTRAINT binding_attempt_state_consistency CHECK (
    (state = 'PENDING')
      = (terminal_reason IS NULL AND committed_account_id IS NULL AND settled_at IS NULL)
  ),
  CONSTRAINT binding_attempt_terminal_consistency CHECK (
    state <> 'TERMINAL'
      OR (terminal_reason IS NOT NULL AND committed_account_id IS NULL AND settled_at IS NOT NULL)
  ),
  CONSTRAINT binding_attempt_committed_consistency CHECK (
    state <> 'COMMITTED'
      OR (terminal_reason IS NULL AND committed_account_id IS NOT NULL AND settled_at IS NOT NULL)
  )
);

-- ── Step 03: binding_pending_contexts ───────────────────────

CREATE TABLE binding_pending_contexts (
  id                          uuid PRIMARY KEY DEFAULT uuidv7(),
  token_hash                  text NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  candidate_identity_digest   text NOT NULL CHECK (candidate_identity_digest ~ '^[0-9a-f]{64}$'),
  attempt_id                  uuid REFERENCES binding_attempts(id) ON DELETE RESTRICT,
  invitation_participation_id uuid,
  committed_account_id        uuid REFERENCES accounts(id) ON DELETE RESTRICT,
  openid_ciphertext           bytea,
  openid_nonce                bytea,
  openid_tag                  bytea,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  last_used_at                timestamptz,
  expires_at                  timestamptz NOT NULL,
  -- D-3.5 pairing issuance facts. Only the server may read them; the external
  -- challenge is a deterministic authenticated envelope over these facts plus
  -- the cryptographic bindings. Raw challenge bytes are never stored.
  pairing_issued_at           timestamptz,
  pairing_expires_at          timestamptz,
  pairing_issuance_id         uuid,
  CONSTRAINT binding_context_expiry_after_creation CHECK (expires_at > created_at),
  CONSTRAINT binding_context_pairing_complete CHECK (
    (pairing_issued_at IS NULL AND pairing_expires_at IS NULL AND pairing_issuance_id IS NULL)
    OR (pairing_issued_at IS NOT NULL AND pairing_expires_at IS NOT NULL AND pairing_issuance_id IS NOT NULL)
  ),
  CONSTRAINT binding_context_pairing_window CHECK (
    pairing_issued_at IS NULL
    OR (
      pairing_expires_at > pairing_issued_at
      AND pairing_expires_at <= expires_at
    )
  ),
  CONSTRAINT binding_context_encryption_complete CHECK (
    (openid_ciphertext IS NULL AND openid_nonce IS NULL AND openid_tag IS NULL)
    OR (openid_ciphertext IS NOT NULL AND openid_nonce IS NOT NULL AND openid_tag IS NOT NULL)
  ),
  CONSTRAINT binding_context_invitation_requires_attempt CHECK (
    invitation_participation_id IS NULL OR attempt_id IS NOT NULL
  ),
  CONSTRAINT binding_context_committed_requires_attempt CHECK (
    committed_account_id IS NULL OR attempt_id IS NOT NULL
  )
);

-- ── Step 04: binding_confirmations ──────────────────────────

CREATE TABLE binding_confirmations (
  id                       uuid PRIMARY KEY DEFAULT uuidv7(),
  attempt_id               uuid NOT NULL REFERENCES binding_attempts(id) ON DELETE RESTRICT,
  kind                     binding_confirmation_kind NOT NULL,
  actor_pending_context_id uuid REFERENCES binding_pending_contexts(id) ON DELETE RESTRICT,
  actor_account_id         uuid REFERENCES accounts(id) ON DELETE RESTRICT,
  actor_person_id          uuid REFERENCES persons(id) ON DELETE RESTRICT,
  authority                binding_confirmer_authority,
  target_confirmed         boolean NOT NULL,
  candidate_recognized     boolean NOT NULL,
  statement_version        text NOT NULL,
  recorded_at              timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT binding_confirmation_one_per_kind UNIQUE (attempt_id, kind),
  CONSTRAINT binding_confirmation_candidate_shape CHECK (
    kind <> 'CANDIDATE'
    OR (
      actor_pending_context_id IS NOT NULL
      AND actor_account_id IS NULL
      AND actor_person_id IS NULL
      AND authority IS NULL
      AND target_confirmed = true
      AND candidate_recognized = false
      AND statement_version = 'candidate-binding-v1'
    )
  ),
  CONSTRAINT binding_confirmation_second_party_shape CHECK (
    kind <> 'SECOND_PARTY'
    OR (
      actor_pending_context_id IS NULL
      AND actor_account_id IS NOT NULL
      AND actor_person_id IS NOT NULL
      AND authority IS NOT NULL
      AND target_confirmed = true
      AND candidate_recognized = true
      AND statement_version = 'second-party-recognition-v1'
    )
  )
);

-- ── Step 05: binding_operation_keys ─────────────────────────

CREATE TABLE binding_operation_keys (
  id              uuid PRIMARY KEY DEFAULT uuidv7(),
  scope_kind      binding_operation_scope NOT NULL,
  scope_key       text NOT NULL CHECK (length(scope_key) BETWEEN 16 AND 128),
  command_type    binding_operation_command NOT NULL,
  idempotency_key text NOT NULL CHECK (length(idempotency_key) BETWEEN 8 AND 128),
  request_hash    text NOT NULL CHECK (request_hash ~ '^[0-9a-f]{64}$'),
  attempt_id      uuid REFERENCES binding_attempts(id) ON DELETE RESTRICT,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT binding_operation_unique
    UNIQUE (scope_kind, scope_key, command_type, idempotency_key)
);

-- ── Step 06: identity_binding_audit_events ──────────────────

CREATE TABLE identity_binding_audit_events (
  id                          uuid PRIMARY KEY DEFAULT uuidv7(),
  correlation_id              uuid NOT NULL,
  attempt_id                  uuid REFERENCES binding_attempts(id) ON DELETE RESTRICT,
  target_person_id            uuid REFERENCES persons(id) ON DELETE RESTRICT,
  target_family_id            uuid REFERENCES families(id) ON DELETE RESTRICT,
  invitation_participation_id uuid,
  actor_account_id            uuid REFERENCES accounts(id) ON DELETE RESTRICT,
  actor_person_id             uuid REFERENCES persons(id) ON DELETE RESTRICT,
  candidate_identity_digest   text CHECK (
    candidate_identity_digest IS NULL OR candidate_identity_digest ~ '^[0-9a-f]{64}$'
  ),
  event_type                  text NOT NULL CHECK (event_type IN (
                                'BINDING_BOOTSTRAP_AUTHENTICATED',
                                'BINDING_GATE1_BLOCKED',
                                'BINDING_ATTEMPT_CREATED',
                                'BINDING_CANDIDATE_CONFIRMED',
                                'BINDING_CANDIDATE_REJECTED',
                                'BINDING_CANDIDATE_CANCELLED',
                                'BINDING_SECOND_PARTY_CONFIRMED',
                                'BINDING_SECOND_PARTY_REJECTED',
                                'BINDING_COMMITTED',
                                'BINDING_TERMINAL',
                                'BINDING_OPERATION_RETRYABLE'
                              )),
  result                      text NOT NULL CHECK (result IN ('PENDING','COMMITTED','TERMINAL','RETRYABLE')),
  terminal_reason             text,
  metadata                    jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  occurred_at                 timestamptz NOT NULL DEFAULT now()
);

-- ── Step 07: indexes ────────────────────────────────────────

CREATE UNIQUE INDEX binding_attempts_live_key
  ON binding_attempts (target_person_id, candidate_identity_digest, invitation_participation_id)
  WHERE state = 'PENDING';

CREATE INDEX binding_attempts_target_idx
  ON binding_attempts (target_person_id, state, created_at DESC);

CREATE INDEX binding_attempts_invitation_idx
  ON binding_attempts (invitation_participation_id, created_at DESC);

CREATE INDEX binding_context_attempt_idx
  ON binding_pending_contexts (attempt_id);

CREATE INDEX identity_binding_audit_attempt_idx
  ON identity_binding_audit_events (attempt_id, occurred_at DESC);

CREATE INDEX identity_binding_audit_person_idx
  ON identity_binding_audit_events (target_person_id, occurred_at DESC);

CREATE INDEX identity_binding_audit_correlation_idx
  ON identity_binding_audit_events (correlation_id, occurred_at DESC);

-- ── Step 08: binding context getters ────────────────────────

CREATE FUNCTION app_binding_context_hash() RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.binding_context_hash', true), '')
$$;

CREATE FUNCTION app_binding_context_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.binding_context_id', true), '')::uuid
$$;

CREATE FUNCTION app_binding_identity_digest() RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.binding_identity_digest', true), '')
$$;

CREATE FUNCTION app_binding_invitation_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.binding_invitation_id', true), '')::uuid
$$;

CREATE FUNCTION app_binding_attempt_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.binding_attempt_id', true), '')::uuid
$$;

CREATE FUNCTION app_binding_target_person_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.binding_target_person_id', true), '')::uuid
$$;

CREATE FUNCTION app_binding_target_family_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.binding_target_family_id', true), '')::uuid
$$;

CREATE FUNCTION app_binding_operation_scope() RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.binding_operation_scope', true), '')
$$;

-- Operation-key fingerprint used ONLY by BOOTSTRAP replay: an invitation may
-- become terminal between the original call and an exact replay, which changes
-- the derived scope key (resolved participation id → unresolved token hash).
-- The request fingerprint (token + identity digest) is stable across that
-- transition and lets replay find its original operation key → attempt.
CREATE FUNCTION app_binding_bootstrap_request_hash() RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.binding_bootstrap_request_hash', true), '')
$$;

CREATE FUNCTION app_binding_commit_account_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.binding_commit_account_id', true), '')::uuid
$$;

CREATE FUNCTION app_binding_candidate_account_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.binding_candidate_account_id', true), '')::uuid
$$;

-- ── Step 09: binding context setters (SECURITY INVOKER) ─────

CREATE FUNCTION app.set_binding_context(p_token_hash text, p_purpose text)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER AS $$
BEGIN
  IF p_token_hash IS NULL OR p_token_hash = '' OR p_purpose IS NULL OR p_purpose = '' THEN
    RAISE EXCEPTION 'RLS_CONTEXT_REQUIRED' USING ERRCODE = '42501';
  END IF;
  PERFORM set_config('app.binding_context_hash', p_token_hash, true);
  PERFORM set_config('app.purpose', p_purpose, true);
END $$;

CREATE FUNCTION app.set_binding_identity_context(p_identity_digest text, p_purpose text)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER AS $$
BEGIN
  IF p_identity_digest IS NULL OR p_identity_digest = ''
     OR p_purpose IS NULL OR p_purpose = '' THEN
    RAISE EXCEPTION 'RLS_CONTEXT_REQUIRED' USING ERRCODE = '42501';
  END IF;
  PERFORM set_config('app.binding_identity_digest', p_identity_digest, true);
  PERFORM set_config('app.purpose', p_purpose, true);
END $$;

CREATE FUNCTION app.set_binding_gate_context(
  p_target_person uuid, p_target_family uuid, p_invitation uuid, p_actor_account uuid
) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER AS $$
BEGIN
  IF p_target_person IS NULL OR p_target_family IS NULL THEN
    RAISE EXCEPTION 'RLS_CONTEXT_REQUIRED' USING ERRCODE = '42501';
  END IF;
  PERFORM set_config('app.binding_target_person_id', p_target_person::text, true);
  PERFORM set_config('app.binding_target_family_id', p_target_family::text, true);
  IF p_invitation IS NOT NULL THEN
    PERFORM set_config('app.binding_invitation_id', p_invitation::text, true);
  END IF;
  IF p_actor_account IS NOT NULL THEN
    PERFORM set_config('app.account_id', p_actor_account::text, true);
  END IF;
  PERFORM set_config('app.purpose', 'IDENTITY_BINDING_GATE', true);
END $$;

-- Confirmer discovery resolves P1's unique Family *after* reading membership.
-- This setter establishes the target-person-only Gate context for that read.
CREATE FUNCTION app.set_binding_target_context(
  p_target_person uuid, p_actor_account uuid
) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER AS $$
BEGIN
  IF p_target_person IS NULL THEN
    RAISE EXCEPTION 'RLS_CONTEXT_REQUIRED' USING ERRCODE = '42501';
  END IF;
  PERFORM set_config('app.binding_target_person_id', p_target_person::text, true);
  IF p_actor_account IS NOT NULL THEN
    PERFORM set_config('app.account_id', p_actor_account::text, true);
  END IF;
  PERFORM set_config('app.purpose', 'IDENTITY_BINDING_GATE', true);
END $$;

CREATE FUNCTION app.set_binding_attempt_context(
  p_attempt uuid, p_identity_digest text, p_invitation uuid,
  p_target_person uuid DEFAULT NULL, p_target_family uuid DEFAULT NULL,
  p_purpose text DEFAULT 'IDENTITY_BINDING_PENDING'
) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER AS $$
BEGIN
  IF p_attempt IS NULL OR p_identity_digest IS NULL OR p_identity_digest = ''
     OR p_purpose IS NULL OR p_purpose = '' THEN
    RAISE EXCEPTION 'RLS_CONTEXT_REQUIRED' USING ERRCODE = '42501';
  END IF;
  PERFORM set_config('app.binding_attempt_id', p_attempt::text, true);
  PERFORM set_config('app.binding_identity_digest', p_identity_digest, true);
  IF p_invitation IS NOT NULL THEN
    PERFORM set_config('app.binding_invitation_id', p_invitation::text, true);
  END IF;
  IF p_target_person IS NOT NULL THEN
    PERFORM set_config('app.binding_target_person_id', p_target_person::text, true);
  END IF;
  IF p_target_family IS NOT NULL THEN
    PERFORM set_config('app.binding_target_family_id', p_target_family::text, true);
  END IF;
  PERFORM set_config('app.purpose', p_purpose, true);
END $$;

CREATE FUNCTION app.set_binding_commit_context(
  p_attempt uuid, p_target_person uuid, p_target_family uuid,
  p_context uuid, p_actor_account uuid
) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER AS $$
BEGIN
  IF p_attempt IS NULL OR p_target_person IS NULL OR p_target_family IS NULL THEN
    RAISE EXCEPTION 'RLS_CONTEXT_REQUIRED' USING ERRCODE = '42501';
  END IF;
  PERFORM set_config('app.binding_attempt_id', p_attempt::text, true);
  PERFORM set_config('app.binding_target_person_id', p_target_person::text, true);
  PERFORM set_config('app.binding_target_family_id', p_target_family::text, true);
  IF p_context IS NOT NULL THEN
    PERFORM set_config('app.binding_context_id', p_context::text, true);
  END IF;
  IF p_actor_account IS NOT NULL THEN
    PERFORM set_config('app.account_id', p_actor_account::text, true);
  END IF;
  PERFORM set_config('app.purpose', 'IDENTITY_BINDING_COMMIT', true);
END $$;

CREATE FUNCTION app.set_binding_operation_scope(p_scope text)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER AS $$
BEGIN
  IF p_scope IS NULL OR p_scope = '' THEN
    RAISE EXCEPTION 'RLS_CONTEXT_REQUIRED' USING ERRCODE = '42501';
  END IF;
  PERFORM set_config('app.binding_operation_scope', p_scope, true);
END $$;

CREATE FUNCTION app.set_binding_bootstrap_request_hash(p_hash text)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER AS $$
BEGIN
  IF p_hash IS NULL OR p_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'RLS_CONTEXT_REQUIRED' USING ERRCODE = '42501';
  END IF;
  PERFORM set_config('app.binding_bootstrap_request_hash', p_hash, true);
END $$;

CREATE FUNCTION app.set_binding_candidate_account_id(p_account uuid)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER AS $$
BEGIN
  IF p_account IS NULL THEN
    RAISE EXCEPTION 'RLS_CONTEXT_REQUIRED' USING ERRCODE = '42501';
  END IF;
  PERFORM set_config('app.binding_candidate_account_id', p_account::text, true);
END $$;

CREATE FUNCTION app.set_binding_commit_account_id(p_account uuid)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER AS $$
BEGIN
  IF p_account IS NULL THEN
    RAISE EXCEPTION 'RLS_CONTEXT_REQUIRED' USING ERRCODE = '42501';
  END IF;
  PERFORM set_config('app.binding_commit_account_id', p_account::text, true);
END $$;

-- ── Step 10: ENABLE + FORCE RLS + new-table policies ────────

ALTER TABLE binding_pending_contexts      ENABLE ROW LEVEL SECURITY;
ALTER TABLE binding_pending_contexts      FORCE  ROW LEVEL SECURITY;
ALTER TABLE binding_attempts              ENABLE ROW LEVEL SECURITY;
ALTER TABLE binding_attempts              FORCE  ROW LEVEL SECURITY;
ALTER TABLE binding_confirmations         ENABLE ROW LEVEL SECURITY;
ALTER TABLE binding_confirmations         FORCE  ROW LEVEL SECURITY;
ALTER TABLE binding_operation_keys        ENABLE ROW LEVEL SECURITY;
ALTER TABLE binding_operation_keys        FORCE  ROW LEVEL SECURITY;
ALTER TABLE identity_binding_audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE identity_binding_audit_events FORCE  ROW LEVEL SECURITY;

CREATE POLICY binding_context_token_scope ON binding_pending_contexts
  USING (
    app_current_purpose() IN ('IDENTITY_BINDING_PENDING', 'IDENTITY_BINDING_GATE')
    AND (
      token_hash = app_binding_context_hash()
      OR id = app_binding_context_id()
    )
  )
  WITH CHECK (
    app_current_purpose() IN ('IDENTITY_BINDING_PENDING', 'IDENTITY_BINDING_GATE')
    AND (
      token_hash = app_binding_context_hash()
      OR id = app_binding_context_id()
    )
  );

-- A pending context linked to an attempt is visible while the attempt id is in
-- scope (confirmer Gate / commit), without re-presenting the context token.
CREATE POLICY binding_context_attempt_scope ON binding_pending_contexts
  USING (
    app_current_purpose() IN ('IDENTITY_BINDING_GATE', 'IDENTITY_BINDING_COMMIT')
    AND attempt_id = app_binding_attempt_id()
  )
  WITH CHECK (
    app_current_purpose() IN ('IDENTITY_BINDING_GATE', 'IDENTITY_BINDING_COMMIT')
    AND attempt_id = app_binding_attempt_id()
  );

CREATE POLICY binding_attempts_identity_scope ON binding_attempts
  USING (
    app_current_purpose() = 'IDENTITY_BINDING_PENDING'
    AND candidate_identity_digest = app_binding_identity_digest()
    AND invitation_participation_id = app_binding_invitation_id()
    AND (app_binding_attempt_id() IS NULL OR id = app_binding_attempt_id())
  )
  WITH CHECK (
    app_current_purpose() = 'IDENTITY_BINDING_PENDING'
    AND candidate_identity_digest = app_binding_identity_digest()
    AND invitation_participation_id = app_binding_invitation_id()
    AND (app_binding_attempt_id() IS NULL OR id = app_binding_attempt_id())
  );

-- Bootstrap replay must read the authoritative attempt reached through its
-- operation key even when the invitation is already terminal (no participation
-- id GUC is derivable). Exposure is still identity-bound and exact-id bound.
CREATE POLICY binding_attempts_operation_replay ON binding_attempts
  FOR SELECT
  USING (
    app_current_purpose() = 'IDENTITY_BINDING_PENDING'
    AND id = app_binding_attempt_id()
    AND candidate_identity_digest = app_binding_identity_digest()
  );

CREATE POLICY binding_attempts_target_scope ON binding_attempts
  USING (
    app_current_purpose() IN ('IDENTITY_BINDING_GATE', 'IDENTITY_BINDING_COMMIT')
    AND target_person_id = app_binding_target_person_id()
    AND target_family_id = app_binding_target_family_id()
  )
  WITH CHECK (
    app_current_purpose() IN ('IDENTITY_BINDING_GATE', 'IDENTITY_BINDING_COMMIT')
    AND target_person_id = app_binding_target_person_id()
    AND target_family_id = app_binding_target_family_id()
  );

CREATE POLICY binding_attempts_commit_scope ON binding_attempts
  USING (
    app_current_purpose() = 'IDENTITY_BINDING_COMMIT'
    AND id = app_binding_attempt_id()
    AND target_person_id = app_binding_target_person_id()
    AND target_family_id = app_binding_target_family_id()
  )
  WITH CHECK (
    app_current_purpose() = 'IDENTITY_BINDING_COMMIT'
    AND id = app_binding_attempt_id()
    AND target_person_id = app_binding_target_person_id()
    AND target_family_id = app_binding_target_family_id()
  );

CREATE POLICY binding_confirmations_attempt_scope ON binding_confirmations
  USING (
    app_current_purpose() IN (
      'IDENTITY_BINDING_PENDING', 'IDENTITY_BINDING_GATE', 'IDENTITY_BINDING_COMMIT'
    )
    AND attempt_id = app_binding_attempt_id()
  )
  WITH CHECK (
    app_current_purpose() IN (
      'IDENTITY_BINDING_PENDING', 'IDENTITY_BINDING_GATE', 'IDENTITY_BINDING_COMMIT'
    )
    AND attempt_id = app_binding_attempt_id()
  );

CREATE POLICY binding_confirmations_target_scope ON binding_confirmations
  USING (
    app_current_purpose() IN ('IDENTITY_BINDING_GATE', 'IDENTITY_BINDING_COMMIT')
    AND EXISTS (
      SELECT 1 FROM binding_attempts a
      WHERE a.id = attempt_id
        AND a.target_person_id = app_binding_target_person_id()
        AND a.target_family_id = app_binding_target_family_id()
    )
  )
  WITH CHECK (
    app_current_purpose() IN ('IDENTITY_BINDING_GATE', 'IDENTITY_BINDING_COMMIT')
    AND EXISTS (
      SELECT 1 FROM binding_attempts a
      WHERE a.id = attempt_id
        AND a.target_person_id = app_binding_target_person_id()
        AND a.target_family_id = app_binding_target_family_id()
    )
  );

CREATE POLICY binding_operation_keys_scope ON binding_operation_keys
  USING (
    (scope_kind = 'CANDIDATE_CONTEXT'
      AND app_current_purpose() = 'IDENTITY_BINDING_PENDING'
      AND scope_key = app_binding_operation_scope())
    OR (scope_kind = 'ACCOUNT'
      AND app_current_purpose() IN ('IDENTITY_BINDING_GATE', 'IDENTITY_BINDING_COMMIT')
      AND scope_key = app_account_id()::text)
  )
  WITH CHECK (
    (scope_kind = 'CANDIDATE_CONTEXT'
      AND app_current_purpose() = 'IDENTITY_BINDING_PENDING'
      AND scope_key = app_binding_operation_scope())
    OR (scope_kind = 'ACCOUNT'
      AND app_current_purpose() IN ('IDENTITY_BINDING_GATE', 'IDENTITY_BINDING_COMMIT')
      AND scope_key = app_account_id()::text)
  );

-- BOOTSTRAP replay after the invitation became terminal: the scope key derived
-- from the resolved participation id is no longer derivable, but the request
-- fingerprint (invitation token + candidate identity) is stable. This policy is
-- READ-ONLY and exposes only BOOTSTRAP keys matching that fingerprint; the
-- caller must still match the idempotency key in the query.
CREATE POLICY binding_operation_keys_bootstrap_fingerprint ON binding_operation_keys
  FOR SELECT
  USING (
    app_current_purpose() = 'IDENTITY_BINDING_PENDING'
    AND scope_kind = 'CANDIDATE_CONTEXT'
    AND command_type = 'BOOTSTRAP'
    AND request_hash = app_binding_bootstrap_request_hash()
  );

CREATE POLICY identity_binding_audit_insert_scope ON identity_binding_audit_events
  USING (false)
  WITH CHECK (
    app_current_purpose() IN (
      'IDENTITY_BINDING_PENDING',
      'IDENTITY_BINDING_GATE',
      'IDENTITY_BINDING_COMMIT'
    )
    AND (target_person_id IS NULL OR target_person_id = app_binding_target_person_id())
    AND (target_family_id IS NULL OR target_family_id = app_binding_target_family_id())
    AND (candidate_identity_digest IS NULL
         OR candidate_identity_digest = app_binding_identity_digest())
  );

-- ── Step 11: additive purpose-scoped Slice 1 policies ───────

CREATE POLICY persons_binding_target_read ON persons
  FOR SELECT
  USING (
    app_current_purpose() IN ('IDENTITY_BINDING_GATE', 'IDENTITY_BINDING_COMMIT')
    AND id = app_binding_target_person_id()
  );

-- Purpose-scoped read of the Person already bound to the authenticated
-- candidate Account. It exists ONLY to decide the ordinary-login-first
-- IDENTITY_CONFLICT at Gate 1 / Gate 2 (plan D-6.3, D-13.3, no-P2). It is never
-- an arbitrary person lookup, never widens Family scope, and never returns P2
-- data to the candidate. The GATE purpose is required because Gate 1 is the
-- first stage where the conflict is known.
CREATE POLICY persons_binding_candidate_account_read ON persons
  FOR SELECT
  USING (
    app_current_purpose() IN ('IDENTITY_BINDING_GATE', 'IDENTITY_BINDING_COMMIT')
    AND account_id = app_binding_candidate_account_id()
  );

CREATE POLICY persons_binding_commit_update ON persons
  FOR UPDATE
  USING (
    app_current_purpose() = 'IDENTITY_BINDING_COMMIT'
    AND id = app_binding_target_person_id()
    AND account_id IS NULL
  )
  WITH CHECK (
    app_current_purpose() = 'IDENTITY_BINDING_COMMIT'
    AND id = app_binding_target_person_id()
    AND account_id = app_binding_commit_account_id()
  );

CREATE POLICY families_binding_read ON families
  FOR SELECT
  USING (
    app_current_purpose() IN ('IDENTITY_BINDING_GATE', 'IDENTITY_BINDING_COMMIT')
    AND id = app_binding_target_family_id()
  );

CREATE POLICY family_members_binding_read ON family_members
  FOR SELECT
  USING (
    app_current_purpose() IN ('IDENTITY_BINDING_GATE', 'IDENTITY_BINDING_COMMIT')
    AND person_id = app_binding_target_person_id()
  );

CREATE POLICY pcp_binding_read ON person_compliance_profiles
  FOR SELECT
  USING (
    app_current_purpose() IN ('IDENTITY_BINDING_GATE', 'IDENTITY_BINDING_COMMIT')
    AND person_id = app_binding_target_person_id()
  );

CREATE POLICY consent_binding_read ON consent_records
  FOR SELECT
  USING (
    app_current_purpose() IN ('IDENTITY_BINDING_GATE', 'IDENTITY_BINDING_COMMIT')
    AND family_id = app_binding_target_family_id()
    AND bound_person_id = app_binding_target_person_id()
  );

-- ── H-02: row-lock visibility policies ──────────────────────
-- PostgreSQL applies UPDATE policies to `SELECT ... FOR UPDATE`. The intended
-- read policies above are deliberately SELECT-only, so without these lock
-- policies a runtime-role `FOR UPDATE` would silently return zero rows and the
-- Gate would evaluate a stale snapshot while believing it held a lock.
--
-- These policies exist ONLY to make the exact target rows lockable. Their
-- WITH CHECK(false) guarantees they cannot write: any real UPDATE under the
-- Gate purpose is still rejected, and the only Person write path remains
-- `persons_binding_commit_update` under the COMMIT purpose.
CREATE POLICY persons_binding_lock ON persons
  FOR UPDATE
  USING (
    app_current_purpose() IN ('IDENTITY_BINDING_GATE', 'IDENTITY_BINDING_COMMIT')
    AND id = app_binding_target_person_id()
  )
  WITH CHECK (false);

-- Candidate-account conflict locking: an ordinary-login bind of the same
-- Account must not slip between Gate 2's candidate-account read and the Phase C
-- mutation. This policy only makes the already-bound Person row lockable under
-- the candidate Account GUC; it cannot write (WITH CHECK false).
CREATE POLICY persons_binding_candidate_lock ON persons
  FOR UPDATE
  USING (
    app_current_purpose() IN ('IDENTITY_BINDING_GATE', 'IDENTITY_BINDING_COMMIT')
    AND account_id = app_binding_candidate_account_id()
  )
  WITH CHECK (false);

CREATE POLICY families_binding_lock ON families
  FOR UPDATE
  USING (
    app_current_purpose() IN ('IDENTITY_BINDING_GATE', 'IDENTITY_BINDING_COMMIT')
    AND id = app_binding_target_family_id()
  )
  WITH CHECK (false);

CREATE POLICY family_members_binding_lock ON family_members
  FOR UPDATE
  USING (
    app_current_purpose() IN ('IDENTITY_BINDING_GATE', 'IDENTITY_BINDING_COMMIT')
    AND person_id = app_binding_target_person_id()
  )
  WITH CHECK (false);

CREATE POLICY pcp_binding_lock ON person_compliance_profiles
  FOR UPDATE
  USING (
    app_current_purpose() IN ('IDENTITY_BINDING_GATE', 'IDENTITY_BINDING_COMMIT')
    AND person_id = app_binding_target_person_id()
  )
  WITH CHECK (false);

CREATE POLICY consent_binding_lock ON consent_records
  FOR UPDATE
  USING (
    app_current_purpose() IN ('IDENTITY_BINDING_GATE', 'IDENTITY_BINDING_COMMIT')
    AND family_id = app_binding_target_family_id()
    AND bound_person_id = app_binding_target_person_id()
  )
  WITH CHECK (false);

-- Pre-attempt (attempt_id IS NULL) transport contexts are the only rows left
-- behind by blocked bootstrap branches. Repeated replay must not accumulate
-- decryptable OpenIDs, so the candidate's own identity scope may clear those
-- sensitive columns. This is UPDATE-only; reads stay token-scoped (F-05).
CREATE POLICY binding_context_no_attempt_identity_scope ON binding_pending_contexts
  FOR UPDATE
  USING (
    app_current_purpose() = 'IDENTITY_BINDING_PENDING'
    AND attempt_id IS NULL
    AND candidate_identity_digest = app_binding_identity_digest()
  )
  WITH CHECK (
    app_current_purpose() = 'IDENTITY_BINDING_PENDING'
    AND attempt_id IS NULL
    AND candidate_identity_digest = app_binding_identity_digest()
  );


-- ── Step 12: append-only / immutable triggers ───────────────

CREATE FUNCTION binding_confirmations_append_only() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'BINDING_CONFIRMATION_IMMUTABLE' USING ERRCODE = '23514';
END $$;

CREATE TRIGGER binding_confirmations_no_update_delete
  BEFORE UPDATE OR DELETE ON binding_confirmations
  FOR EACH ROW EXECUTE FUNCTION binding_confirmations_append_only();

CREATE FUNCTION identity_binding_audit_append_only() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'IDENTITY_BINDING_AUDIT_IMMUTABLE' USING ERRCODE = '23514';
END $$;

CREATE TRIGGER identity_binding_audit_no_update_delete
  BEFORE UPDATE OR DELETE ON identity_binding_audit_events
  FOR EACH ROW EXECUTE FUNCTION identity_binding_audit_append_only();

-- ── Step 13: GRANT to xiaoshuyin_app (least privilege) ──────

GRANT SELECT, INSERT, UPDATE ON
  binding_pending_contexts,
  binding_attempts
TO xiaoshuyin_app;

GRANT SELECT, INSERT ON
  binding_confirmations
TO xiaoshuyin_app;

-- Operation keys may only be updated to bind the immutable attempt identity.
GRANT SELECT, INSERT, UPDATE ON
  binding_operation_keys
TO xiaoshuyin_app;

-- Audit is write-only to the runtime; forensic reads use migrator / test admin.
GRANT INSERT ON identity_binding_audit_events TO xiaoshuyin_app;

GRANT USAGE ON TYPE binding_attempt_state       TO xiaoshuyin_app;
GRANT USAGE ON TYPE binding_confirmation_kind   TO xiaoshuyin_app;
GRANT USAGE ON TYPE binding_confirmer_authority TO xiaoshuyin_app;
GRANT USAGE ON TYPE binding_operation_scope     TO xiaoshuyin_app;
GRANT USAGE ON TYPE binding_operation_command   TO xiaoshuyin_app;

GRANT EXECUTE ON FUNCTION app_binding_context_hash()       TO xiaoshuyin_app;
GRANT EXECUTE ON FUNCTION app_binding_context_id()         TO xiaoshuyin_app;
GRANT EXECUTE ON FUNCTION app_binding_identity_digest()    TO xiaoshuyin_app;
GRANT EXECUTE ON FUNCTION app_binding_invitation_id()      TO xiaoshuyin_app;
GRANT EXECUTE ON FUNCTION app_binding_attempt_id()         TO xiaoshuyin_app;
GRANT EXECUTE ON FUNCTION app_binding_target_person_id()   TO xiaoshuyin_app;
GRANT EXECUTE ON FUNCTION app_binding_target_family_id()   TO xiaoshuyin_app;
GRANT EXECUTE ON FUNCTION app_binding_operation_scope()    TO xiaoshuyin_app;
GRANT EXECUTE ON FUNCTION app_binding_bootstrap_request_hash() TO xiaoshuyin_app;
GRANT EXECUTE ON FUNCTION app_binding_commit_account_id()  TO xiaoshuyin_app;
GRANT EXECUTE ON FUNCTION app_binding_candidate_account_id() TO xiaoshuyin_app;

GRANT EXECUTE ON FUNCTION app.set_binding_context(text, text)                 TO xiaoshuyin_app;
GRANT EXECUTE ON FUNCTION app.set_binding_identity_context(text, text)        TO xiaoshuyin_app;
GRANT EXECUTE ON FUNCTION app.set_binding_gate_context(uuid, uuid, uuid, uuid) TO xiaoshuyin_app;
GRANT EXECUTE ON FUNCTION app.set_binding_target_context(uuid, uuid) TO xiaoshuyin_app;
GRANT EXECUTE ON FUNCTION app.set_binding_attempt_context(uuid, text, uuid, uuid, uuid, text) TO xiaoshuyin_app;
GRANT EXECUTE ON FUNCTION app.set_binding_commit_context(uuid, uuid, uuid, uuid, uuid) TO xiaoshuyin_app;
GRANT EXECUTE ON FUNCTION app.set_binding_operation_scope(text)               TO xiaoshuyin_app;
GRANT EXECUTE ON FUNCTION app.set_binding_bootstrap_request_hash(text)        TO xiaoshuyin_app;
GRANT EXECUTE ON FUNCTION app.set_binding_commit_account_id(uuid)             TO xiaoshuyin_app;
GRANT EXECUTE ON FUNCTION app.set_binding_candidate_account_id(uuid)          TO xiaoshuyin_app;