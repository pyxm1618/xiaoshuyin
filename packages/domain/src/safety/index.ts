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
// S9-H01: `case-transition.ts` is a package-internal primitive shared only by
// EnterSafetyHold and ResolveRisk. It must never be reachable through the
// production `@xiaoshuyin/domain` root export surface.
export * from './guard.js';