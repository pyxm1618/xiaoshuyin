/**
 * Slice 9 — Typed Drizzle projection (V1技术设计 §7.0).
 *
 * This file is the SINGLE Drizzle schema truth. It is a type-safe *projection*
 * of the reviewed SQL migrations; it is never an independent business-fact
 * source:
 *   - `db/migrations/*.sql` remains the only production schema-change vehicle;
 *   - `db/schema/index.ts` re-exports this module for drizzle-kit;
 *   - migration/DB introspection parity is asserted by tests/db/safety-*.test.ts.
 *
 * Only the tables Slice 9 reads or writes are projected. Column names, types
 * and nullability must match the applied migrations exactly.
 */

import { sql } from 'drizzle-orm';
import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

/**
 * `case_status` (002_case_core.sql, PAUSED removed by 006).
 * SAFETY_HOLD is a Case status — there is no parallel Safety current-state
 * column or table in this projection.
 */
export const caseStatus = pgEnum('case_status', [
  'OPEN',
  'WAITING',
  'LOST_CONTACT',
  'SAFETY_HOLD',
  'CLOSED',
]);

/** `case_phase` (002_case_core.sql). */
export const casePhase = pgEnum('case_phase', [
  'INTAKE',
  'ASSESSMENT',
  'PROBLEM_FORMULATION',
  'GOALS',
  'PLANNING',
  'EXECUTION',
  'REVIEW',
  'MAINTENANCE',
  'CLOSED',
]);

/** `cases` — Case aggregate container (002_case_core.sql). */
export const cases = pgTable('cases', {
  id: uuid('id')
    .primaryKey()
    .default(sql`uuidv7()`),
  familyId: uuid('family_id').notNull(),
  createdByPersonId: uuid('created_by_person_id').notNull(),
  status: caseStatus('status').notNull(),
  phase: casePhase('phase').notNull(),
  isPrimary: boolean('is_primary').notNull(),
  version: integer('version').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** `case_events` — append-only Case domain history (002_case_core.sql). */
export const caseEvents = pgTable('case_events', {
  id: uuid('id')
    .primaryKey()
    .default(sql`uuidv7()`),
  familyId: uuid('family_id').notNull(),
  caseId: uuid('case_id').notNull(),
  actorAccountId: uuid('actor_account_id').notNull(),
  eventType: text('event_type').notNull(),
  metadata: jsonb('metadata').notNull(),
  occurredAt: timestamp('occurred_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** `business_audit_events` — cross-resource business audit (001_initial_schema.sql). */
export const businessAuditEvents = pgTable('business_audit_events', {
  id: uuid('id')
    .primaryKey()
    .default(sql`uuidv7()`),
  familyId: uuid('family_id').notNull(),
  actorAccountId: uuid('actor_account_id').notNull(),
  eventType: text('event_type').notNull(),
  resourceType: text('resource_type').notNull(),
  resourceId: uuid('resource_id').notNull(),
  metadata: jsonb('metadata')
    .notNull()
    .default(sql`'{}'::jsonb`),
  occurredAt: timestamp('occurred_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});
/**
 * TypeScript-only closed vocabulary for `event_kind`. The database enforces it
 * with a CHECK constraint (not a PostgreSQL enum type), so no `pgEnum` is
 * declared here — declaring one would create a second schema object.
 */
export type RiskEventKind = 'HOLD_ENTERED' | 'RISK_RESOLVED';

/**
 * `risk_events` — append-only Safety trace (009_safety_hold_control_foundation.sql).
 *
 * This is trace evidence only. It contains NO current-Safety-state column:
 * `cases.status = 'SAFETY_HOLD'` remains the single current truth.
 */
export const riskEvents = pgTable('risk_events', {
  id: uuid('id')
    .primaryKey()
    .default(sql`uuidv7()`),
  familyId: uuid('family_id').notNull(),
  caseId: uuid('case_id').notNull(),
  actorAccountId: uuid('actor_account_id').notNull(),
  eventKind: text('event_kind').notNull(),
  decisionCaseVersion: integer('decision_case_version').notNull(),
  policyRef: text('policy_ref'),
  policyVersion: text('policy_version'),
  ruleRef: text('rule_ref'),
  ruleVersion: text('rule_version'),
  riskCategoryRef: text('risk_category_ref'),
  evidenceRefs: jsonb('evidence_refs')
    .notNull()
    .default(sql`'[]'::jsonb`),
  resolutionOfRiskEventId: uuid('resolution_of_risk_event_id'),
  resolutionAuthorityRef: text('resolution_authority_ref'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});