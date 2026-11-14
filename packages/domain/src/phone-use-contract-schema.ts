/**
 * Slice 14 typed Drizzle projection; migration 017 is schema authority.
 */
import { sql } from 'drizzle-orm';
import { integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const digitalUseContractVersions = pgTable('digital_use_contract_versions', {
  id: uuid('id').primaryKey().default(sql`uuidv7()`),
  familyId: uuid('family_id').notNull(),
  caseId: uuid('case_id').notNull(),
  version: integer('version').notNull(),
  draftRevision: integer('draft_revision').notNull().default(1),
  status: text('status').notNull(),
  adultPartyPersonId: uuid('adult_party_person_id').notNull(),
  childPartyPersonId: uuid('child_party_person_id').notNull(),
  childParticipationId: uuid('child_participation_id').notNull(),
  contractPurpose: jsonb('contract_purpose').notNull(),
  phoneUseRules: jsonb('phone_use_rules').notNull(),
  executionPeriod: jsonb('execution_period').notNull(),
  parentSupportMeasures: jsonb('parent_support_measures').notNull(),
  supervisionMeasures: jsonb('supervision_measures').notNull(),
  incentives: jsonb('incentives').notNull(),
  breachResponsibilities: jsonb('breach_responsibilities').notNull(),
  sourceTemplateVersion: text('source_template_version').notNull(),
  dependencyRefs: jsonb('dependency_refs').notNull().default(sql`'[]'::jsonb`),
  parentConfirmation: jsonb('parent_confirmation'),
  childConfirmation: jsonb('child_confirmation'),
  supersedesId: uuid('supersedes_id'),
  updateReason: text('update_reason'),
  updateTrigger: text('update_trigger'),
  createdByPersonId: uuid('created_by_person_id').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  activatedAt: timestamp('activated_at', { withTimezone: true }),
  supersededAt: timestamp('superseded_at', { withTimezone: true }),
  pausedAt: timestamp('paused_at', { withTimezone: true }),
});

export const roleplaySessions = pgTable('roleplay_sessions', {
  id: uuid('id').primaryKey().default(sql`uuidv7()`),
  familyId: uuid('family_id').notNull(),
  caseId: uuid('case_id').notNull(),
  actorPersonId: uuid('actor_person_id').notNull(),
  simulationRole: text('simulation_role').notNull(),
  status: text('status').notNull(),
  scenePackageVersion: text('scene_package_version').notNull(),
  professionalContentVersion: text('professional_content_version').notNull(),
  compliancePolicyRef: text('compliance_policy_ref').notNull(),
  adapterRef: text('adapter_ref').notNull(),
  selectedTurnId: uuid('selected_turn_id'),
  revision: integer('revision').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
});

export const roleplayTurns = pgTable('roleplay_turns', {
  id: uuid('id').primaryKey().default(sql`uuidv7()`),
  familyId: uuid('family_id').notNull(),
  caseId: uuid('case_id').notNull(),
  sessionId: uuid('session_id').notNull(),
  roundNumber: integer('round_number').notNull(),
  simulatedChildInput: text('simulated_child_input').notNull(),
  simulatedParentOutput: text('simulated_parent_output').notNull(),
  provenance: text('provenance').notNull(),
  modelRef: text('model_ref'),
  promptVersionRef: text('prompt_version_ref'),
  userRating: integer('user_rating'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
