-- ============================================================================
-- Slice 1 Consent Owner — 01004 Narrow Post-Merge Remediation
-- Migration: 012_consent_01004_supplemental_enums.sql
--
-- Forward-additive enum expansion only.
--
-- Why a separate file: PostgreSQL allows `ALTER TYPE ... ADD VALUE` inside a
-- transaction, but the newly added label cannot be *used* by the same
-- transaction. The reviewed migrator wraps each file in one transaction, so the
-- labels are committed here first; `013_consent_01004_supplemental_assessment.sql`
-- may then reference them in CHECK constraints, indexes and trigger functions.
--
-- NOT done here:
--   - no column/constraint/trigger change
--   - no historical migration edit
--   - no second consent table
--   - no change to UNDER_14_GUARDIAN_CONSENT semantics
-- ============================================================================

-- The authoritative Consent ledger now represents the explicit supplementary
-- assessment refusal as its own decision value. It is only legal for
-- DIGITAL_USE_SUPPLEMENTAL_ASSESSMENT; 013 enforces that the guardian branch
-- keeps exactly GRANTED / REVOKED.
ALTER TYPE consent_decision ADD VALUE IF NOT EXISTS 'DECLINED';

-- Exactly one owner-approved purpose for Digital Use 01004. It stays distinct
-- from UNDER_14_GUARDIAN_CONSENT and is not a generic consent purpose registry.
ALTER TYPE consent_purpose ADD VALUE IF NOT EXISTS 'DIGITAL_USE_SUPPLEMENTAL_ASSESSMENT';