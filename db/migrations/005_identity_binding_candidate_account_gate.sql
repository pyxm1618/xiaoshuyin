-- 005_identity_binding_candidate_account_gate.sql
--
-- Additive remediation for the frozen Plan gap recorded in the Slice 5 audit:
-- Plan D-13.3 defined `persons_binding_candidate_account_read` for the commit
-- context only, but D-6.3 / No-P2 and 005 §5.5 require the ordinary-login-first
-- identity conflict (candidate Account already bound to another Person) to be
-- TERMINAL and never PENDING. Gate 1 is the first stage where that conflict is
-- known, so the same read policy must also apply under IDENTITY_BINDING_GATE.
--
-- This migration only widens an existing 006-owned policy predicate; it does
-- not change any Slice 1 policy, table, column, grant or runtime semantics.

DROP POLICY IF EXISTS persons_binding_candidate_account_read ON persons;

CREATE POLICY persons_binding_candidate_account_read ON persons
  USING (
    app_current_purpose() IN ('IDENTITY_BINDING_GATE', 'IDENTITY_BINDING_COMMIT')
    AND account_id = app_binding_candidate_account_id()
  );