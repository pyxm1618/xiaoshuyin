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
export * from './evidence.js';
