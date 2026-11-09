#!/usr/bin/env node
/**
 * coverage-audit.mjs — FR / SC / Acceptance substantive coverage audit.
 *
 * Slice 1 and Slice 2 keep their original mappings. Slice 5 (repo feature 006)
 * adds a substantive gate: every frozen FR / SC / Acceptance scenario and every
 * Ultimate Audit finding F-01–F-08 must map to a real, non-empty test file. A
 * missing / deleted proof fails closed.
 */

import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = new URL('..', import.meta.url).pathname;

const FR = {
  'FR-001': ['tests/integration/auth.test.ts', 'tests/db/schema-structure.test.ts'],
  'FR-002': ['tests/integration/auth.test.ts', 'tests/domain/session-token.test.ts'],
  'FR-003': ['tests/domain/provenance.test.ts', 'tests/integration/members.test.ts'],
  'FR-004': ['tests/integration/members.test.ts', 'tests/db/constraints.test.ts'],
  'FR-005': ['tests/integration/families.test.ts', 'tests/integration/consent-first.test.ts'],
  'FR-006': ['tests/integration/authorization-dimensions.test.ts', 'tests/domain/authorization.test.ts'],
  'FR-007': ['tests/integration/consent-first.test.ts', 'tests/db/consent-structure.test.ts', 'tests/db/schema-structure.test.ts'],
  'FR-008': ['tests/integration/consent-first.test.ts', 'tests/integration/consent-request.test.ts', 'tests/integration/consent-grant.test.ts'],
  'FR-009': ['tests/domain/age-band.test.ts'],
  'FR-010': ['tests/integration/consent-revoke.test.ts', 'tests/db/consent-structure.test.ts'],
  'FR-011': ['tests/integration/authorization.test.ts', 'tests/db/rls.test.ts'],
  'FR-012': ['tests/db/rls.test.ts', 'tests/db/roles.test.ts'],
  'FR-013': ['tests/db/rls.test.ts', 'tests/integration/authorization.test.ts'],
  'FR-014': ['tests/integration/idempotency.test.ts', 'tests/db/idempotency-rls.test.ts', 'tests/domain/idempotency-hash.test.ts'],
  'FR-015': ['tests/db/migration-repro.test.ts', 'tests/db/schema-structure.test.ts'],
  'FR-016': ['tests/db/constraints.test.ts'],
  'FR-017': ['tests/db/constraints.test.ts', 'tests/db/schema-structure.test.ts'],
};

const SC = {
  'SC-001': ['tests/integration/auth.test.ts', 'tests/integration/families.test.ts', 'tests/integration/members.test.ts'],
  'SC-002': ['tests/integration/authorization.test.ts', 'tests/db/rls.test.ts'],
  'SC-003': ['tests/integration/consent-first.test.ts', 'tests/integration/consent-revoke.test.ts'],
  'SC-004': ['tests/domain/age-band.test.ts', 'tests/db/schema-structure.test.ts'],
  'SC-005': ['tests/integration/idempotency.test.ts'],
  'SC-006': ['tests/db/constraints.test.ts', 'tests/db/schema-structure.test.ts'],
  'SC-007': ['tests/db/constraints.test.ts'],
  'SC-008': ['tests/domain/provenance.test.ts', 'tests/integration/members.test.ts'],
};

// ── Slice 2 (002-case-core) ────────────────────────────────
const FR_002 = {
  'FR-001': ['tests/db/cases-schema.test.ts', 'tests/integration/cases-scope.test.ts'],
  'FR-002': ['tests/db/cases-schema.test.ts', 'tests/db/migration-repro.test.ts'],
  'FR-003': ['tests/db/cases-schema.test.ts', 'tests/domain/case-contracts.test.ts'],
  'FR-004': ['tests/integration/cases-create.test.ts'],
  'FR-005': ['tests/integration/cases-scope.test.ts', 'tests/domain/case-authorization.test.ts'],
  'FR-006': ['tests/db/cases-primary-concurrency.test.ts', 'tests/db/cases-schema.test.ts'],
  'FR-007': ['tests/db/cases-primary-concurrency.test.ts', 'tests/integration/cases-create.test.ts'],
  'FR-008': ['tests/integration/cases-authorization.test.ts', 'tests/domain/case-authorization.test.ts'],
  'FR-009': ['tests/domain/case-authorization.test.ts', 'tests/integration/cases-authorization.test.ts'],
  'FR-010': ['tests/integration/cases-read.test.ts', 'tests/db/cases-rls.test.ts'],
  'FR-011': ['tests/db/cases-rls.test.ts', 'tests/db/rls.test.ts'],
  'FR-012': ['tests/integration/cases-idempotency.test.ts', 'tests/domain/idempotency-hash.test.ts'],
  'FR-013': ['tests/integration/cases-create.test.ts', 'tests/domain/case-contracts.test.ts'],
  'FR-014': ['tests/integration/cases-audit.test.ts', 'tests/db/cases-events-metadata.test.ts'],
  'FR-015': ['tests/integration/cases-create.test.ts', 'tests/domain/case-contracts.test.ts'],
  'FR-016': ['tests/integration/cases-read.test.ts', 'tests/domain/case-contracts.test.ts'],
  'FR-017': ['tests/integration/cases-read.test.ts', 'tests/integration/cases-authorization.test.ts'],
  'FR-018': ['tests/integration/cases-scope.test.ts'],
  'FR-019': ['tests/integration/cases-read.test.ts', 'tests/integration/cases-authorization.test.ts'],
  'FR-020': ['tests/integration/cases-scope.test.ts', 'tests/db/cases-schema.test.ts'],
  'FR-021': ['tests/integration/cases-create.test.ts', 'tests/integration/cases-scope.test.ts'],
  'FR-022': ['tests/integration/cases-read.test.ts'],
  'FR-023': ['tests/integration/cases-read.test.ts', 'tests/db/cases-rls.test.ts'],
  'FR-024': ['tests/integration/cases-authorization.test.ts'],
  'FR-025': ['tests/integration/cases-read-no-audit.test.ts'],
};

const SC_002 = {
  'SC-001': ['tests/integration/cases-create.test.ts', 'tests/db/cases-primary-concurrency.test.ts'],
  'SC-002': ['tests/db/cases-primary-concurrency.test.ts', 'tests/integration/cases-idempotency.test.ts'],
  'SC-003': ['tests/integration/cases-create.test.ts', 'tests/domain/case-contracts.test.ts'],
  'SC-004': ['tests/integration/cases-read.test.ts', 'tests/db/cases-rls.test.ts'],
  'SC-005': ['tests/integration/cases-authorization.test.ts'],
  'SC-006': ['tests/integration/cases-idempotency.test.ts', 'tests/domain/idempotency-hash.test.ts'],
  'SC-007': ['tests/integration/cases-audit.test.ts', 'tests/integration/cases-read-no-audit.test.ts'],
  'SC-008': ['tests/integration/cases-scope.test.ts'],
  'SC-009': ['tests/integration/cases-create.test.ts', 'tests/domain/case-contracts.test.ts'],
  'SC-010': ['tests/integration/cases-read.test.ts', 'tests/integration/openapi-cases.test.ts'],
  'SC-011': ['tests/integration/cases-read.test.ts'],
};

const ACCEPTANCE_002 = {
  'A01-first-case-open-intake-primary': ['tests/integration/cases-create.test.ts'],
  'A02-candidate-retained': ['tests/integration/cases-create.test.ts'],
  'A03-concurrent-primary-invariant': ['tests/db/cases-primary-concurrency.test.ts'],
  'A04-list-detail-primary': ['tests/integration/cases-read.test.ts'],
  'A05-cross-family-isolation': ['tests/integration/cases-read.test.ts', 'tests/db/cases-rls.test.ts'],
  'A06-no-rls-context-default-deny': ['tests/db/cases-rls.test.ts'],
  'A07-non-manager-denied': ['tests/integration/cases-authorization.test.ts'],
  'A08-guardian-member-non-manager': ['tests/integration/cases-authorization.test.ts'],
  'A09-guardian-non-member': ['tests/integration/cases-authorization.test.ts'],
  'A10-fixed-404-403-semantics': ['tests/integration/cases-authorization.test.ts', 'tests/integration/cases-read.test.ts'],
  'A11-create-idempotency-http': ['tests/integration/cases-idempotency.test.ts'],
  'A12-shared-idempotency-mismatch': ['tests/domain/idempotency-hash.test.ts'],
  'A13-create-event-and-audit': ['tests/integration/cases-audit.test.ts'],
  'A14-read-no-audit': ['tests/integration/cases-read-no-audit.test.ts'],
  'A15-out-of-scope-schema-api': ['tests/integration/cases-scope.test.ts'],
  'A16-strict-422-zero-write': ['tests/integration/cases-create.test.ts'],
  'A17-empty-family': ['tests/integration/cases-read.test.ts'],
  'A18-rls-role-migration-uuidv7': ['tests/db/cases-schema.test.ts', 'tests/db/roles.test.ts', 'tests/db/migration-repro.test.ts'],
};

// ── Slice 5 (006-identity-binding-runtime) ─────────────────
const FR_006 = {
  'FR-001': ['tests/integration/identity-binding-ordinary-login-regression.test.ts', 'tests/integration/identity-binding-bootstrap.test.ts'],
  'FR-002': ['tests/integration/identity-binding-bootstrap-route.test.ts'],
  'FR-003': ['tests/integration/identity-binding-case-b.test.ts'],
  'FR-004': ['tests/integration/identity-binding-commit.test.ts'],
  'FR-005': ['tests/integration/identity-binding-bootstrap.test.ts', 'tests/db/identity-binding-context.test.ts'],
  'FR-006': ['tests/integration/identity-binding-gate1.test.ts', 'tests/db/identity-binding-facts.test.ts'],
  'FR-007': ['tests/integration/identity-binding-gate1.test.ts', 'tests/integration/identity-binding-candidate-auth.test.ts'],
  'FR-008': ['tests/integration/identity-binding-candidate.test.ts', 'tests/db/identity-binding-confirmation-repository.test.ts'],
  'FR-009': ['tests/integration/identity-binding-confirmer-independent.test.ts', 'tests/integration/identity-binding-confirmer-ordering.test.ts'],
  'FR-010': ['tests/integration/identity-binding-commit-gate2.test.ts', 'tests/integration/identity-binding-gate1.test.ts'],
  'FR-011': ['tests/integration/identity-binding-commit.test.ts', 'tests/integration/identity-binding-account.test.ts'],
  'FR-012': ['tests/db/identity-binding-attempt-repository.test.ts'],
  'FR-013': ['tests/integration/identity-binding-commit-settle.test.ts', 'tests/integration/identity-binding-replay.test.ts'],
  'FR-014': ['tests/integration/identity-binding-attempt-create.test.ts', 'tests/integration/identity-binding-failure-injection.test.ts'],
  'FR-015': ['tests/integration/identity-binding-replay.test.ts', 'tests/integration/identity-binding-attempt-create.test.ts'],
  'FR-016': ['tests/integration/identity-binding-no-p2.test.ts'],
  'FR-017': ['tests/db/identity-binding-concurrency.test.ts'],
  'FR-018': ['tests/integration/identity-binding-case-b.test.ts', 'tests/integration/identity-binding-commit.test.ts'],
  'FR-019': ['tests/integration/identity-binding-anti-enumeration.test.ts'],
  'FR-020': ['tests/integration/identity-binding-gate1.test.ts', 'tests/integration/identity-binding-anti-enumeration.test.ts'],
  'FR-021': ['tests/integration/identity-binding-no-p2.test.ts', 'tests/integration/identity-binding-failure-injection.test.ts'],
  'FR-022': ['tests/integration/identity-binding-idempotency.test.ts'],
  'FR-023': ['tests/integration/identity-binding-audit.test.ts', 'tests/db/identity-binding-audit-repository.test.ts'],
  'FR-024': ['tests/integration/identity-binding-authorization-surfaces.test.ts', 'tests/db/identity-binding-rls.test.ts'],
  'FR-025': ['tests/integration/identity-binding-invitation-contract.test.ts'],
  'FR-026': ['tests/integration/identity-binding-invitation-contract.test.ts'],
  'FR-027': ['tests/integration/identity-binding-routes.test.ts', 'tests/db/identity-binding-schema.test.ts'],
  'FR-028': ['tests/integration/identity-binding-error-envelope.test.ts', 'tests/integration/identity-binding-no-p2.test.ts'],
};

const SC_006 = {
  'SC-001': ['tests/integration/identity-binding-commit.test.ts'],
  'SC-002': ['tests/integration/identity-binding-case-b.test.ts'],
  'SC-003': ['tests/db/identity-binding-attempt-repository.test.ts', 'tests/integration/identity-binding-replay.test.ts'],
  'SC-004': ['tests/integration/identity-binding-no-p2.test.ts'],
  'SC-005': ['tests/db/identity-binding-concurrency.test.ts'],
  'SC-006': ['tests/integration/identity-binding-idempotency.test.ts'],
  'SC-007': ['tests/integration/identity-binding-anti-enumeration.test.ts'],
  'SC-008': ['tests/integration/identity-binding-no-p2.test.ts', 'tests/integration/identity-binding-failure-injection.test.ts'],
  'SC-009': ['tests/integration/identity-binding-gate1.test.ts', 'tests/integration/identity-binding-commit-gate2.test.ts'],
  'SC-010': ['tests/integration/identity-binding-commit.test.ts', 'tests/integration/identity-binding-case-b.test.ts'],
  'SC-011': ['tests/integration/identity-binding-audit.test.ts'],
  'SC-012': ['tests/integration/identity-binding-invitation-contract.test.ts'],
  'SC-013': ['tests/integration/identity-binding-ordinary-login-regression.test.ts'],
  'SC-014': ['tests/integration/identity-binding-routes.test.ts', 'tests/db/identity-binding-schema.test.ts'],
};

const ACCEPTANCE_006 = {
  'AS-01': ['tests/integration/identity-binding-commit.test.ts'],
  'AS-02': ['tests/integration/identity-binding-commit.test.ts'],
  'AS-03': ['tests/integration/identity-binding-commit.test.ts'],
  'AS-04': ['tests/integration/identity-binding-candidate.test.ts'],
  'AS-05': ['tests/integration/identity-binding-confirmer-reject.test.ts'],
  'AS-06': ['tests/integration/identity-binding-bootstrap.test.ts'],
  'AS-07': ['tests/integration/identity-binding-attempt-create.test.ts', 'tests/integration/identity-binding-replay.test.ts'],
  'AS-08': ['tests/integration/identity-binding-case-b.test.ts'],
  'AS-09': ['tests/integration/identity-binding-case-b.test.ts'],
  'AS-10': ['tests/db/identity-binding-concurrency.test.ts'],
  'AS-11': ['tests/integration/identity-binding-idempotency.test.ts'],
  'AS-12': ['tests/integration/identity-binding-idempotency.test.ts'],
  'AS-13': ['tests/integration/identity-binding-failure-injection.test.ts', 'tests/integration/identity-binding-rollback.test.ts'],
  'AS-14': ['tests/integration/identity-binding-commit-gate2.test.ts', 'tests/integration/identity-binding-candidate.test.ts'],
  'AS-15': ['tests/integration/identity-binding-replay.test.ts'],
  'AS-16': ['tests/integration/identity-binding-no-p2.test.ts'],
  'AS-17': ['tests/integration/identity-binding-confirmer-independent.test.ts', 'tests/integration/identity-binding-authorization-surfaces.test.ts'],
  'AS-18': ['tests/integration/identity-binding-gate1.test.ts', 'tests/integration/identity-binding-anti-enumeration.test.ts'],
  'AS-19': ['tests/db/identity-binding-attempt-repository.test.ts', 'tests/integration/identity-binding-replay.test.ts'],
  'AS-20': ['tests/integration/identity-binding-bootstrap.test.ts', 'tests/db/identity-binding-context.test.ts'],
  'AS-21': ['tests/integration/identity-binding-commit.test.ts', 'tests/integration/identity-binding-account.test.ts'],
  'AS-22': ['tests/integration/identity-binding-failure-injection.test.ts'],
  'AS-23': ['tests/db/identity-binding-confirmation-repository.test.ts', 'tests/integration/identity-binding-idempotency.test.ts'],
  'AS-24': ['tests/db/identity-binding-rls.test.ts', 'tests/integration/identity-binding-audit.test.ts'],
};

/** Ultimate Audit findings F-01–F-08 → the tests that prove each one. */
const FINDINGS_006 = {
  'F-01': ['tests/integration/identity-binding-commit-gate2.test.ts'],
  'F-02': ['tests/integration/identity-binding-confirmer.test.ts', 'tests/integration/identity-binding-idempotency.test.ts'],
  'F-03': ['tests/db/identity-binding-rls.test.ts'],
  'F-04': ['tests/integration/identity-binding-pairing.test.ts'],
  'F-05': ['tests/integration/identity-binding-context-cleanup.test.ts', 'tests/integration/identity-binding-candidate.test.ts'],
  'F-06': ['tests/integration/openapi-semantic-equivalence.test.ts', 'tests/integration/identity-binding-candidate.test.ts'],
  'F-07': ['tests/integration/identity-binding-attempt-create.test.ts'],
  'F-08': ['tests/integration/identity-binding-failure-injection.test.ts', 'tests/integration/identity-binding-rollback.test.ts'],
};

/** The 26 reopened Slice-5 tasks and their direct verification files. */
const REOPENED_TASKS_006 = {
  T013: ['tests/db/identity-binding-rls.test.ts'],
  T036: ['tests/db/identity-binding-attempt-repository.test.ts'],
  T037: ['tests/db/identity-binding-confirmation-repository.test.ts'],
  T039: ['tests/db/identity-binding-operation-key-repository.test.ts'],
  T050: ['tests/integration/identity-binding-bootstrap.test.ts', 'tests/db/identity-binding-context.test.ts'],
  T055: ['tests/integration/identity-binding-attempt-create.test.ts'],
  T056: ['tests/integration/identity-binding-attempt-create.test.ts'],
  T059: ['tests/integration/identity-binding-candidate.test.ts'],
  T060: ['tests/integration/identity-binding-candidate.test.ts', 'tests/integration/identity-binding-context-cleanup.test.ts'],
  T065: ['tests/integration/identity-binding-confirmer.test.ts', 'tests/integration/identity-binding-pairing.test.ts'],
  T066: ['tests/integration/identity-binding-confirmer.test.ts'],
  T068: ['tests/integration/identity-binding-confirmer-reject.test.ts'],
  T073: ['tests/integration/identity-binding-commit-gate2.test.ts'],
  T074: ['tests/integration/identity-binding-commit-gate2.test.ts'],
  T080: ['tests/integration/identity-binding-commit-settle.test.ts', 'tests/integration/identity-binding-context-cleanup.test.ts'],
  T081: ['tests/integration/identity-binding-failure-injection.test.ts', 'tests/integration/identity-binding-rollback.test.ts'],
  T085: ['tests/integration/identity-binding-commit.test.ts', 'tests/integration/identity-binding-pairing.test.ts'],
  T091: ['tests/integration/identity-binding-candidate.test.ts', 'tests/db/identity-binding-schema.test.ts'],
  T092: ['tests/integration/openapi-semantic-equivalence.test.ts'],
  T097: ['tests/integration/openapi-semantic-equivalence.test.ts'],
  T101: ['tests/integration/identity-binding-anti-enumeration.test.ts'],
  T103: ['tests/db/identity-binding-rls.test.ts'],
  T104: ['tests/db/identity-binding-rls.test.ts'],
  T106: ['tests/integration/identity-binding-idempotency.test.ts'],
  T112: ['tests/integration/identity-binding-routes.test.ts', 'tests/integration/openapi-semantic-equivalence.test.ts'],
  T115: ['tests/integration/coverage-audit.test.ts'],
};

/**
 * M-05 substantive required proofs. An ID is only satisfied when the exact
 * named executable test exists and is not skipped. File existence / arbitrary
 * `it()` / coverage percentages are NOT accepted.
 */
export const SUBSTANTIVE_PROOFS = {
  'H-01-valid-decoy': {
    file: 'tests/integration/identity-binding-anti-enumeration.test.ts',
    test: 'H-01: valid and decoy AFFIRM challenges are externally indistinguishable',
  },
  'H-01-challenge-envelope': {
    file: 'tests/domain/identity-binding-crypto.test.ts',
    test: 'pairing challenge is exactly 192 unpadded base64url characters',
  },
  'H-01-exact-byte-replay': {
    file: 'tests/integration/identity-binding-candidate.test.ts',
    test: 'AFFIRM same key + same issuance replays the exact original challenge bytes',
  },
  'H-01-confirmer-exact-binding': {
    file: 'tests/integration/identity-binding-confirmer.test.ts',
    test: 'H-01: wrong challenge bindings fail closed with zero mutation',
  },
  'H-02-gate2-barrier': {
    file: 'tests/integration/identity-binding-commit-gate2.test.ts',
    test: 'concurrent consent revoke committed before the linearization point blocks the commit (F-01)',
  },
  'H-02-runtime-lock': {
    file: 'tests/db/identity-binding-rls.test.ts',
    test: 'H-02: runtime role locks authoritative Gate rows and blocks concurrent invalidation',
  },
  'M-01-consent-revoked': {
    file: 'tests/integration/identity-binding-candidate.test.ts',
    test: 'M-01: consent revoked after bootstrap blocks AFFIRM and scrubs every context',
  },
  'M-01-fact-matrix': {
    file: 'tests/integration/identity-binding-candidate.test.ts',
    test: 'M-01: terminal invitation, P1 bound externally and multi-family all block AFFIRM',
  },
  'M-02-replay-cleanup': {
    file: 'tests/integration/identity-binding-bootstrap.test.ts',
    test: 'M-02: settled, pre-attempt and Case B replay contexts retain no OpenID secret',
  },
  'M-03-status-expiry': {
    file: 'tests/integration/identity-binding-status.test.ts',
    test: 'M-03: status expiry settles once and scrubs every attempt context',
  },
  'M-04-settlement': {
    file: 'tests/integration/identity-binding-commit-settle.test.ts',
    test: 'M-04: Phase C expiry uses one settlement for state, audit and cleanup',
  },
  'confirmationVersion-matrix': {
    file: 'tests/integration/identity-binding-candidate.test.ts',
    test: 'confirmationVersion matrix is preserved for AFFIRM and REJECT/CANCEL',
  },
  'RLS-negative-writes': {
    file: 'tests/db/identity-binding-rls.test.ts',
    test: 'GATE purpose reads the target but cannot write it (F-03 negative matrix)',
  },
  'rollback-matrix': {
    file: 'tests/integration/identity-binding-rollback.test.ts',
    test: 'rolls back the newly created Account when the P1 binding update loses',
  },
  'MINOR-guardian': {
    file: 'tests/integration/identity-binding-commit.test.ts',
    test: 'binds Account A ↔ existing P1 exactly once; no Person increment',
  },
  'true-CaseB-mismatch': {
    file: 'tests/integration/identity-binding-anti-enumeration.test.ts',
    test: 'true Case B mismatch (P1 bound to A, candidate authenticates as B) is generically indistinguishable',
  },

  // ── MEDIUM-01 exact replay must not re-run mutable authority ──
  'MEDIUM-01-replay-committed': {
    file: 'tests/integration/identity-binding-confirmer-replay.test.ts',
    test: 'Case A: a COMMITTED operation replays its historical outcome after the confirmer is revoked',
  },
  'MEDIUM-01-replay-terminal': {
    file: 'tests/integration/identity-binding-confirmer-replay.test.ts',
    test: 'Case B: a TERMINAL operation replays its historical outcome after the confirmer is revoked',
  },
  'MEDIUM-01-replay-pending-continuation': {
    file: 'tests/integration/identity-binding-confirmer-replay.test.ts',
    test: 'Case C: a PENDING operation resumes Phase C after authority / consent invalidation',
  },
  'MEDIUM-01-replay-payload-mismatch': {
    file: 'tests/integration/identity-binding-confirmer-replay.test.ts',
    test: 'same operation key + different payload is still 409 IDEMPOTENCY_PAYLOAD_MISMATCH',
  },

  // ── H-01 direct proofs (rotation / consumed / rotated mismatch / race) ──
  'H-01-rotation-new-bytes': {
    file: 'tests/integration/identity-binding-pairing-rotation.test.ts',
    test: 'H-01 rotation: a new issuance returns new challenge bytes',
  },
  'H-01-old-issuance-invalid': {
    file: 'tests/integration/identity-binding-pairing-rotation.test.ts',
    test: 'H-01 rotation: the old issuance is invalid after rotation',
  },
  'H-01-consumed-new-key-404': {
    file: 'tests/integration/identity-binding-pairing-rotation.test.ts',
    test: 'H-01 consumed challenge + NEW operation key is 404 with zero mutation',
  },
  'H-01-same-key-rotated-409': {
    file: 'tests/integration/identity-binding-pairing-rotation.test.ts',
    test: 'H-01 same operation key + rotated challenge is 409 IDEMPOTENCY_PAYLOAD_MISMATCH',
  },
  'H-01-two-confirmer-concurrency': {
    file: 'tests/integration/identity-binding-pairing-rotation.test.ts',
    test: 'H-01 two-confirmer race writes exactly one SECOND_PARTY confirmation and commits once',
  },

  // ── H-02 direct DB barrier matrix (runtime role, per fact class) ──
  'H-02-profile-age-barrier': {
    file: 'tests/integration/identity-binding-gate2-barrier-matrix.test.ts',
    test: 'profile / age-band barrier blocks the commit',
  },
  'H-02-profile-missing-barrier': {
    file: 'tests/integration/identity-binding-gate2-barrier-matrix.test.ts',
    test: 'missing compliance profile barrier blocks the commit',
  },
  'H-02-consent-barrier': {
    file: 'tests/integration/identity-binding-gate2-barrier-matrix.test.ts',
    test: 'consent barrier blocks the commit',
  },
  'H-02-guardian-barrier': {
    file: 'tests/integration/identity-binding-gate2-barrier-matrix.test.ts',
    test: 'guardian relationship barrier blocks the commit',
  },
  'H-02-membership-authority-barrier': {
    file: 'tests/integration/identity-binding-gate2-barrier-matrix.test.ts',
    test: 'membership barrier blocks the commit',
  },
  'H-02-P1-conflict-barrier': {
    file: 'tests/integration/identity-binding-gate2-barrier-matrix.test.ts',
    test: 'P1 binding conflict barrier blocks the commit',
  },
  'H-02-candidate-account-conflict': {
    file: 'tests/integration/identity-binding-gate2-barrier-matrix.test.ts',
    test: 'candidate Account conflict barrier blocks the commit',
  },
  'H-02-invitation-seam': {
    file: 'tests/integration/identity-binding-gate2-barrier-matrix.test.ts',
    test: 'invitation seam barrier blocks the commit (CONTRACT-SEAM PROOF ONLY)',
  },

  // ── M-01 direct eligibility matrix ──
  'M-01-profile': {
    file: 'tests/integration/identity-binding-candidate-eligibility.test.ts',
    test: 'M-01: profile invalidation blocks AFFIRM',
  },
  'M-01-age-band': {
    file: 'tests/integration/identity-binding-candidate-eligibility.test.ts',
    test: 'M-01: age-band invalidation blocks AFFIRM',
  },
  'M-01-guardian': {
    file: 'tests/integration/identity-binding-candidate-eligibility.test.ts',
    test: 'M-01: guardian relationship invalidation blocks AFFIRM',
  },
  'M-01-consent': {
    file: 'tests/integration/identity-binding-candidate-eligibility.test.ts',
    test: 'M-01: consent invalidation blocks AFFIRM',
  },
  'M-01-membership': {
    file: 'tests/integration/identity-binding-candidate-eligibility.test.ts',
    test: 'M-01: membership invalidation blocks AFFIRM',
  },
  'M-01-invitation': {
    file: 'tests/integration/identity-binding-candidate-eligibility.test.ts',
    test: 'M-01: invitation invalidation blocks AFFIRM',
  },
  'M-01-P1-conflict': {
    file: 'tests/integration/identity-binding-candidate-eligibility.test.ts',
    test: 'M-01: P1 binding conflict blocks AFFIRM',
  },
  'M-01-candidate-account-conflict': {
    file: 'tests/integration/identity-binding-candidate-eligibility.test.ts',
    test: 'M-01: candidate identity / account conflict blocks AFFIRM',
  },
};

export function fileOk(rel, root = ROOT) {
  const full = join(root, rel);
  if (!existsSync(full) || !statSync(full).isFile()) return false;
  const content = readFileSync(full, 'utf-8');
  return content.includes('it(') || content.includes('test(') || content.includes('describe(');
}

/**
 * Exact executable proof check. The named test must be present with a normal
 * `it`/`test` call and must not be skipped. This is what makes a deleted,
 * renamed, unexecuted or unrelated mapping fail closed.
 */
export function proofOk(rel, testName, root = ROOT) {
  const full = join(root, rel);
  if (!existsSync(full) || !statSync(full).isFile()) return false;
  const content = readFileSync(full, 'utf-8');
  const quoted = [
    `it('${testName}'`,
    `it("${testName}"`,
    `test('${testName}'`,
    `test("${testName}"`,
  ];
  const present = quoted.some((needle) => content.includes(needle));
  if (!present) return false;
  const skipped = quoted.some((needle) =>
    content.includes(needle.replace(/^(it|test)/, '$1.skip'))
  );
  return !skipped;
}

function checkProofs(root, missing) {
  let ok = 0;
  const total = Object.keys(SUBSTANTIVE_PROOFS).length;
  for (const [id, proof] of Object.entries(SUBSTANTIVE_PROOFS)) {
    if (!proofOk(proof.file, proof.test, root)) {
      missing.push(`[Slice 5 Substantive Proofs] ${id}: ${proof.file} :: ${proof.test}`);
    } else {
      ok++;
    }
  }
  return { label: 'Slice 5 Substantive Proofs', ok, total };
}

function checkSection(label, mapping, root, missing) {
  let ok = 0;
  const total = Object.keys(mapping).length;
  for (const [id, files] of Object.entries(mapping)) {
    const bad = files.filter((f) => !fileOk(f, root));
    if (bad.length > 0) {
      missing.push(`[${label}] ${id}: ${bad.join(', ')}`);
    } else {
      ok++;
    }
  }
  return { label, ok, total };
}

export function audit(root = ROOT) {
  const missing = [];
  const sections = [
    checkSection('Slice 1 FR', FR, root, missing),
    checkSection('Slice 1 SC', SC, root, missing),
    checkSection('Slice 2 FR', FR_002, root, missing),
    checkSection('Slice 2 SC', SC_002, root, missing),
    checkSection('Slice 2 Acceptance', ACCEPTANCE_002, root, missing),
    checkSection('Slice 5 FR', FR_006, root, missing),
    checkSection('Slice 5 SC', SC_006, root, missing),
    checkSection('Slice 5 Acceptance', ACCEPTANCE_006, root, missing),
    checkSection('Slice 5 Findings', FINDINGS_006, root, missing),
    checkSection('Slice 5 Reopened Tasks', REOPENED_TASKS_006, root, missing),
    checkProofs(root, missing),
  ];
  return { missing, sections };
}

function printSection(section) {
  console.log(`${section.label}: ${section.ok}/${section.total}`);
}

function main() {
  const { missing, sections } = audit(ROOT);
  console.log('# FR / SC / Acceptance substantive coverage audit');
  console.log('');
  for (const section of sections) printSection(section);
  console.log('');
  console.log(`missing = ${missing.length}`);
  if (missing.length > 0) {
    for (const m of missing) console.log(`  MISSING ${m}`);
    console.log('coverage-audit: FAIL');
    process.exit(1);
  }
  const totalOk = sections.reduce((sum, s) => sum + s.ok, 0);
  const total = sections.reduce((sum, s) => sum + s.total, 0);
  console.log(`coverage-audit: PASS (${totalOk}/${total}, missing = 0)`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}