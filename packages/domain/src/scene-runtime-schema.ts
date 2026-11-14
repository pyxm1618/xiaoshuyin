/**
 * Slice 12 typed Drizzle projection of the reviewed Scene runtime tables.
 *
 * The SQL migration is the schema-change authority. This module is only a
 * type-safe projection and does not own Scene topology, routing or facts.
 */
import { sql } from 'drizzle-orm';
import {
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

export const sceneNodeStatus = pgEnum('scene_node_status', [
  'LOCKED',
  'AVAILABLE',
  'IN_PROGRESS',
  'COMPLETED',
  'SKIPPED',
  'BLOCKED',
]);

export const sceneNodeStates = pgTable('scene_node_states', {
  id: uuid('id').primaryKey().default(sql`uuidv7()`),
  familyId: uuid('family_id').notNull(),
  caseId: uuid('case_id').notNull(),
  scenePackageVersion: text('scene_package_version').notNull(),
  nodeCode: text('node_code').notNull(),
  sourceNodeCode: text('source_node_code').notNull(),
  status: sceneNodeStatus('status').notNull(),
  branchReasonCodes: text('branch_reason_codes').array().notNull().default(sql`ARRAY[]::text[]`),
  inputRefs: jsonb('input_refs').notNull().default(sql`'[]'::jsonb`),
  outputRefs: jsonb('output_refs').notNull().default(sql`'[]'::jsonb`),
  enteredAt: timestamp('entered_at', { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  revision: integer('revision').notNull().default(1),
});

export const sceneArtifacts = pgTable('scene_artifacts', {
  id: uuid('id').primaryKey().default(sql`uuidv7()`),
  familyId: uuid('family_id').notNull(),
  caseId: uuid('case_id').notNull(),
  scenePackageVersion: text('scene_package_version').notNull(),
  artifactType: text('artifact_type').notNull(),
  schemaVersion: text('schema_version').notNull(),
  sourceNodeCode: text('source_node_code').notNull(),
  data: jsonb('data').notNull(),
  ownerPersonId: uuid('owner_person_id').notNull(),
  visibility: text('visibility').notNull(),
  sourceRefs: jsonb('source_refs').notNull().default(sql`'[]'::jsonb`),
  revision: integer('revision').notNull(),
  supersedesId: uuid('supersedes_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
