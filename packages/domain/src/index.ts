export * from './provenance.js';
export * from './idempotency.js';

// AUD-II-001: explicit production export boundary.
//
// A wildcard `export * from './repository.js'` exposed every low-level Evidence
// repository write primitive, letting a production caller bypass the frozen
// domain writers. Only the pre-existing, approved repository API is re-exported
// here; Evidence write primitives stay package-internal inside repository.ts and
// are reachable only through `evidence.ts`.
export {
  getPersonByAccountId,
  insertPerson,
  getAccountById,
  resolveCurrentFamily,
  getFamilyById,
  getFamilyByIdFull,
  createFamily,
  generateUuidv7,
  insertFamilyMember,
  isFamilyMember,
  countFamilyMembers,
  getPersonById,
  getMembershipFamilyIds,
  lockBindingGateRows,
  bindPersonAccountIfUnbound,
  lockPersonForBinding,
  getProfileValues,
  getProfileValuesWithId,
  getProfileValuesFull,
  getProfileValuesBySource,
  insertProfileValue,
  supersedeProfileValue,
  insertAuditEvent,
  lockIdempotencyKey,
  getIdempotencyKey,
  insertIdempotencyKey,
  getPersonWithProfile,
} from './repository.js';
export type {
  Tx,
  PersonRow,
  CurrentFamilyRow,
  CurrentFamilyResolution,
} from './repository.js';

export * from './cases.js';
export * from './case-primary-switch.js';
export * from './problem-formulations.js';
export * from './evidence.js';
export * from './identity-binding.js';
export * from './identity-binding-gate.js';
export * from './identity-binding-anti-enumeration.js';

export * from './participants.js';
// Slice 9 Safety control foundation. The typed Drizzle projection is exported
// as `safetySchema` only; Safety command/persistence primitives are added by
// their own reviewed tasks.
export * from './safety/index.js';
// Slice 10 — typed Drizzle projection of the compliance feature-policy truth.
// The policy evaluator itself belongs to `@xiaoshuyin/compliance`.
export * from './compliance/schema.js';
// Slice 12 — typed projection only; topology/routing remains @xiaoshuyin/scenes.
export * from './scene-runtime-schema.js';
export * from './scene-runtime-repository.js';

// Slice 14 — bounded phone-use Contract/roleplay persistence.
export * from './phone-use-contract-schema.js';
export * from './phone-use-contract-repository.js';
