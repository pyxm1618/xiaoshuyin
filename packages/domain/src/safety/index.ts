/**
 * Slice 9 — Safety control foundation domain surface.
 *
 * The typed Drizzle projection is re-exported as a namespace so the API layer
 * can bind it to a transaction without importing schema internals.
 */

export * as safetySchema from './schema.js';
export * from './errors.js';
export * from './precheck.js';
export * from './persistence.js';
export * from './resolver-authority.js';
export * from './case-transition.js';export * from './guard.js';