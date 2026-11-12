/**
 * drizzle-kit schema entry (V1技术设计 §7.0).
 *
 * The typed projection lives in `packages/domain/src/safety/schema.ts` so that
 * Slice 9 data access stays inside `packages/**`. This file exists only because
 * `db/drizzle.config.ts` points drizzle-kit at `./db/schema`.
 *
 * Never duplicate table definitions here: one Drizzle schema truth only.
 */

export * from '../../packages/domain/src/safety/schema.js';export * from '../../packages/domain/src/compliance/schema.js';