-- Workline D Forward Migration: Safety / Identity / Authorization / Participation
-- Findings: #11 (binding operation key REUSED replay identity), #17 (active staff account DB RLS check), #32 (participation response idempotency command type)

BEGIN;

-- ── 1. Finding #11: Add REUSED account and person link to binding_operation_keys ──
ALTER TABLE binding_operation_keys
  ADD COLUMN IF NOT EXISTS reused_account_id uuid REFERENCES accounts(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS reused_person_id uuid REFERENCES persons(id) ON DELETE RESTRICT;

-- ── 2. Finding #17: Revalidate account ACTIVE in sensitive intervention DB write policies ──
DROP POLICY IF EXISTS intervention_definitions_professional_insert ON intervention_definitions;
CREATE POLICY intervention_definitions_professional_insert
  ON intervention_definitions FOR INSERT TO xiaoshuyin_app
  WITH CHECK (
    created_by_person_id = app_person_id()
    AND EXISTS (
      SELECT 1 FROM staff_assignments sa
       JOIN accounts a ON a.id = sa.account_id
       WHERE sa.account_id = app_account_id()
         AND sa.person_id = app_person_id()
         AND a.status = 'ACTIVE'
         AND sa.capability = 'PROFESSIONAL_REVIEW'
         AND sa.scope_type = 'GLOBAL'
         AND sa.revoked_at IS NULL
         AND sa.valid_from <= clock_timestamp()
         AND (sa.valid_until IS NULL OR sa.valid_until > clock_timestamp())
    )
  );

DROP POLICY IF EXISTS intervention_definitions_professional_update ON intervention_definitions;
CREATE POLICY intervention_definitions_professional_update
  ON intervention_definitions FOR UPDATE TO xiaoshuyin_app
  USING (
    EXISTS (
      SELECT 1 FROM staff_assignments sa
       JOIN accounts a ON a.id = sa.account_id
       WHERE sa.account_id = app_account_id()
         AND sa.person_id = app_person_id()
         AND a.status = 'ACTIVE'
         AND sa.capability = 'PROFESSIONAL_REVIEW'
         AND sa.scope_type = 'GLOBAL'
         AND sa.revoked_at IS NULL
         AND sa.valid_from <= clock_timestamp()
         AND (sa.valid_until IS NULL OR sa.valid_until > clock_timestamp())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM staff_assignments sa
       JOIN accounts a ON a.id = sa.account_id
       WHERE sa.account_id = app_account_id()
         AND sa.person_id = app_person_id()
         AND a.status = 'ACTIVE'
         AND sa.capability = 'PROFESSIONAL_REVIEW'
         AND sa.scope_type = 'GLOBAL'
         AND sa.revoked_at IS NULL
         AND sa.valid_from <= clock_timestamp()
         AND (sa.valid_until IS NULL OR sa.valid_until > clock_timestamp())
    )
  );

DROP POLICY IF EXISTS audit_staff_intervention_insert ON business_audit_events;
CREATE POLICY audit_staff_intervention_insert ON business_audit_events
  FOR INSERT TO xiaoshuyin_app
  WITH CHECK (
    family_id IS NULL
    AND resource_type = 'INTERVENTION_DEFINITION'
    AND actor_account_id = app_account_id()
    AND EXISTS (
      SELECT 1 FROM staff_assignments sa
       JOIN accounts a ON a.id = sa.account_id
       WHERE sa.account_id = app_account_id()
         AND sa.person_id = app_person_id()
         AND a.status = 'ACTIVE'
         AND sa.capability = 'PROFESSIONAL_REVIEW'
         AND sa.scope_type = 'GLOBAL'
         AND sa.revoked_at IS NULL
         AND sa.valid_from <= clock_timestamp()
         AND (sa.valid_until IS NULL OR sa.valid_until > clock_timestamp())
    )
  );

-- ── 3. Finding #32: Extend idempotency command types for PARTICIPATION_RESPONSE ──
DO $$
DECLARE
  v_con text;
BEGIN
  SELECT pg_get_constraintdef(oid) INTO v_con
    FROM pg_constraint
   WHERE conrelid='idempotency_keys'::regclass
     AND conname='idempotency_keys_command_type_check';
  v_con := regexp_replace(v_con, '^CHECK\s*', '');
  ALTER TABLE idempotency_keys DROP CONSTRAINT idempotency_keys_command_type_check;
  EXECUTE format(
    'ALTER TABLE idempotency_keys ADD CONSTRAINT idempotency_keys_command_type_check CHECK ((%s) OR command_type IN (%L))',
    v_con, 'PARTICIPATION_RESPONSE'
  );
END $$;

COMMIT;
