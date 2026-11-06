-- ============================================================================
-- 003_case_idempotency_key_bytes.sql — exact CASE_CREATE idempotency identity
--
-- Owner-approved technical storage amendment (Round 2, Finding 4).
--
-- The frozen logical scope is (actor_account_id, command_type, logical
-- idempotencyKey). The logical key is a JS string of 8–128 UTF-16 code units
-- and may contain U+0000 or lone surrogates, which PostgreSQL `text` cannot
-- represent. A digest is NOT an acceptable substitute: identity must be exact.
--
-- Therefore new CASE_CREATE reservations store the key as `bytea`
-- (UTF-16LE bytes of the logical string), which is deterministic, reversible
-- and injective for every legal input.
--
-- Backward compatibility:
--   * every non-CASE_CREATE command keeps `idempotency_key text NOT NULL`
--     and a NULL bytea column — physical semantics unchanged;
--   * CASE_CREATE rows written before this migration (raw logical text) stay
--     readable through the existing text column;
--   * new CASE_CREATE rows use the bytea column and leave the text column NULL.
--
-- 001_initial_schema.sql and 002_case_core.sql are NOT modified.
-- ============================================================================

-- ── Step 01: physical representation column ─────────────────
ALTER TABLE idempotency_keys
  ADD COLUMN idempotency_key_bytes bytea NULL;

-- The text column stays present and required for every other command type,
-- but new CASE_CREATE rows use the bytea column instead.
ALTER TABLE idempotency_keys
  ALTER COLUMN idempotency_key DROP NOT NULL;

-- ── Step 02: representation invariant ───────────────────────
-- Non-CASE_CREATE: text only (Slice 1 semantics frozen).
-- CASE_CREATE: exactly one of the two representations, never both, never none.
ALTER TABLE idempotency_keys
  ADD CONSTRAINT idempotency_keys_key_representation_check CHECK (
    (
      command_type <> 'CASE_CREATE'
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
  );

-- ── Step 03: exact byte identity ────────────────────────────
-- PostgreSQL treats NULLs as distinct in a UNIQUE index, so:
--   * Slice 1 rows and legacy CASE_CREATE rows are covered by the existing
--     `idempotency_scope_key` (actor, command, text key) constraint;
--   * new CASE_CREATE rows are covered by this bytea constraint.
-- No digest, no placeholder namespace, no truncation.
CREATE UNIQUE INDEX idempotency_scope_key_bytes
  ON idempotency_keys (actor_account_id, command_type, idempotency_key_bytes);
