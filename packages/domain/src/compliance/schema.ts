/**
 * Slice 10 — Typed Drizzle projection of the Compliance Feature Policy truth.
 *
 * This is a *projection* only (V1技术设计 §7.0):
 *   - `db/migrations/011_compliance_feature_policy_foundation.sql` is the only
 *     production schema-change vehicle;
 *   - `db/schema/index.ts` re-exports this module for drizzle-kit;
 *   - no independent business fact lives here.
 *
 * Column names, types and nullability must match the applied migration exactly.
 */

import { sql } from 'drizzle-orm';
import {
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

/** `compliance_feature_policies` — global versioned feature-policy truth. */
export const complianceFeaturePolicies = pgTable('compliance_feature_policies', {
  id: uuid('id')
    .primaryKey()
    .default(sql`uuidv7()`),
  featureCode: text('feature_code').notNull(),
  featureContractRevision: text('feature_contract_revision').notNull(),
  policyVersion: integer('policy_version').notNull(),
  anthropomorphicApplicability: text('anthropomorphic_applicability').notNull(),
  minorAccessRule: text('minor_access_rule').notNull(),
  aiDisclosureRule: text('ai_disclosure_rule').notNull(),
  generatedContentLabelRule: text('generated_content_label_rule').notNull(),
  usageReminderRule: text('usage_reminder_rule').notNull(),
  decisionBasis: text('decision_basis'),
  reviewEvidenceRef: text('review_evidence_ref'),
  effectiveFrom: timestamp('effective_from', { withTimezone: true }).notNull(),
  effectiveUntil: timestamp('effective_until', { withTimezone: true }),
  supersededByPolicyId: uuid('superseded_by_policy_id'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  approvedAt: timestamp('approved_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  publicationSourceRef: text('publication_source_ref').notNull(),
});