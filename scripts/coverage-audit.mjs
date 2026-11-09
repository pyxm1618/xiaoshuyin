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
import ts from 'typescript';

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
    test: 'profile / age-band: Gate lock blocks the concurrent profile UPDATE',
  },
  'H-02-profile-missing-barrier': {
    file: 'tests/integration/identity-binding-gate2-barrier-matrix.test.ts',
    test: 'missing compliance profile: Gate lock blocks the concurrent profile DELETE',
  },
  'H-02-consent-barrier': {
    file: 'tests/integration/identity-binding-gate2-barrier-matrix.test.ts',
    test: 'consent: Gate lock blocks the concurrent runtime-role consent UPDATE',
  },
  'H-02-guardian-barrier': {
    file: 'tests/integration/identity-binding-gate2-barrier-matrix.test.ts',
    test: 'guardian relationship: Gate lock blocks the concurrent guardian UPDATE',
  },
  'H-02-membership-authority-barrier': {
    file: 'tests/integration/identity-binding-gate2-barrier-matrix.test.ts',
    test: 'membership insert: binding-first second-family INSERT cannot cross the linearization point',
  },
  'H-02-P1-conflict-barrier': {
    file: 'tests/integration/identity-binding-gate2-barrier-matrix.test.ts',
    test: 'P1 binding conflict: Gate lock blocks the concurrent P1 binding UPDATE',
  },
  'H-02-candidate-account-conflict': {
    file: 'tests/integration/identity-binding-gate2-barrier-matrix.test.ts',
    test: 'candidate Account conflict: stale Gate PASS still fails closed in Phase C',
  },
  'H-02-invitation-seam': {
    file: 'tests/integration/identity-binding-gate2-barrier-matrix.test.ts',
    test: 'invitation seam: invalidation-first fails closed (CONTRACT-SEAM PROOF ONLY)',
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

/**
 * Substantive assertions per stable proof ID.
 *
 * `assertions` must appear inside the exact test function body. For tests that
 * delegate to a shared helper (Gate 2 barrier / M-01 eligibility), the critical
 * terminal assertions live in that helper, so `helperAssertions` must appear in
 * the same file. Removing the key assertion therefore makes the audit fail
 * closed instead of accepting an empty `it('name', () => {})`.
 */
export const PROOF_ASSERTIONS = {
  // ── H-01 direct proofs ──────────────────────────────────────
  'H-01-valid-decoy': {
    assertions: [
      "expect(Object.keys(res.json()).sort()).toEqual(['binding', 'pairingChallenge']);",
      'expect(res.json().pairingChallenge).toMatch(/^[A-Za-z0-9_-]{192}$/);',
    ],
  },
  'H-01-challenge-envelope': {
    assertions: [
      'expect(challenge).toHaveLength(192);',
      'expect(isPairingChallengeShape(challenge)).toBe(true);',
    ],
  },
  'H-01-exact-byte-replay': {
    assertions: [
      'expect(replay.json().pairingChallenge).toBe(first.json().pairingChallenge);',
      'expect(secondExpiry.rows[0].pairing_expires_at).toEqual(firstExpiry.rows[0].pairing_expires_at);',
    ],
  },
  'H-01-confirmer-exact-binding': {
    assertions: [
      'expect(await snapshotB()).toEqual(before);',
      "expect(attemptA.rows[0].state).toBe('PENDING');",
    ],
  },
  'H-01-rotation-new-bytes': {
    assertions: [
      'expect(challengeB).not.toBe(challengeA);',
      "expect(current.json().state).toBe('COMMITTED');",
    ],
  },
  'H-01-old-issuance-invalid': {
    assertions: [
      "expect(old.json().code).toBe('BINDING_NOT_FOUND');",
      'expect(await secondPartyCount(h, attemptId)).toBe(0);',
    ],
  },
  'H-01-consumed-new-key-404': {
    assertions: [
      "expect(reused.json().code).toBe('BINDING_NOT_FOUND');",
      'expect(await secondPartyCount(h, attemptId)).toBe(before.confirmations);',
    ],
  },
  'H-01-same-key-rotated-409': {
    assertions: [
      "expect(mismatch.json().code).toBe('IDEMPOTENCY_PAYLOAD_MISMATCH');",
      "expect(state.rows[0].state).toBe('PENDING');",
    ],
  },
  'H-01-two-confirmer-concurrency': {
    assertions: [
      'expect(await secondPartyCount(h, attemptId)).toBe(1);',
      'expect(committedAudit.rows[0].n).toBe(1);',
    ],
  },

  // ── H-02 direct barrier proofs ──────────────────────────────
  'H-02-gate2-barrier': {
    assertions: [
      "expect(outcome.outcome).toBe('TERMINAL');",
      'expect(committedAudit.rows[0].n).toBe(0);',
    ],
  },
  'H-02-runtime-lock': {
    assertions: ['expect(result.rowCount).toBeGreaterThanOrEqual(1);'],
  },
  'H-02-profile-age-barrier': {
    helperAssertions: [
      {
        helper: 'runBindingFirst',
        assertions: [
          'expect(blocked.blocked).toBe(true);',
          "expect(outcome.outcome).toBe('COMMITTED');",
        ],
      },
    ],
  },
  'H-02-profile-missing-barrier': {
    helperAssertions: [
      {
        helper: 'runBindingFirst',
        assertions: [
          'expect(blocked.blocked).toBe(true);',
          "expect(outcome.outcome).toBe('COMMITTED');",
        ],
      },
    ],
  },
  'H-02-consent-barrier': {
    helperAssertions: [
      {
        helper: 'runBindingFirst',
        assertions: [
          'expect(blocked.blocked).toBe(true);',
          "expect(outcome.outcome).toBe('COMMITTED');",
        ],
      },
    ],
  },
  'H-02-guardian-barrier': {
    helperAssertions: [
      {
        helper: 'runBindingFirst',
        assertions: [
          'expect(blocked.blocked).toBe(true);',
          "expect(outcome.outcome).toBe('COMMITTED');",
        ],
      },
    ],
  },
  'H-02-membership-authority-barrier': {
    assertions: [
      'expect(before.rows[0].n).toBe(1);',
      'expect(after.rows[0].n).toBe(2);',
      'expect(committed.rows[0].n).toBe(1);',
      "expect(await terminalAuditCount(attemptId, 'MULTI_FAMILY_BLOCK')).toBe(0);",
    ],
    helperAssertions: [
      {
        helper: 'runBindingFirst',
        assertions: [
          'expect(blocked.blocked).toBe(true);',
          "expect(outcome.outcome).toBe('COMMITTED');",
        ],
      },
    ],
  },
  'H-02-P1-conflict-barrier': {
    helperAssertions: [
      {
        helper: 'runBindingFirst',
        assertions: [
          'expect(blocked.blocked).toBe(true);',
          "expect(outcome.outcome).toBe('COMMITTED');",
        ],
      },
    ],
  },
  'H-02-candidate-account-conflict': {
    assertions: [
      "expect(outcome.outcome).toBe('TERMINAL');",
      "expect(outcome).toMatchObject({ outcome: 'TERMINAL', reason: 'IDENTITY_CONFLICT' });",
    ],
    helperAssertions: [
      {
        helper: 'assertTerminalNoBinding',
        assertions: [
          "expect(attempt.rows[0].state).toBe('TERMINAL');",
          'expect(attempt.rows[0].terminal_reason).toBe(reason);',
          'expect(attempt.rows[0].committed_account_id).toBeNull();',
        ],
      },
    ],
  },
  'H-02-invitation-seam': {
    assertions: [
      "expect(outcome.outcome).toBe('TERMINAL');",
      "expect(outcome).toMatchObject({ outcome: 'TERMINAL', reason: 'INVITATION_TERMINAL' });",
    ],
    helperAssertions: [
      {
        helper: 'assertTerminalNoBinding',
        assertions: [
          "expect(attempt.rows[0].state).toBe('TERMINAL');",
          'expect(attempt.rows[0].terminal_reason).toBe(reason);',
          'expect(attempt.rows[0].committed_account_id).toBeNull();',
        ],
      },
    ],
  },

  // ── M-01 direct eligibility proofs ──────────────────────────
  'M-01-consent-revoked': {
    assertions: [
      'expect(confirmations.rows[0].n).toBe(0);',
      'expect(audit.rows[0].n).toBe(1);',
      'expect(contexts.rows[0].n).toBe(0);',
    ],
  },
  'M-01-fact-matrix': {
    assertions: [
      "expect(attempt.rows[0].state).toBe('TERMINAL');",
      'expect(attempt.rows[0].terminal_reason).toBe(c.reason);',
    ],
  },
  'M-01-profile': {
    helperAssertions: [
      {
        helper: 'runHiddenFailure',
        assertions: [
          "expect(context.rows[0].pairing_issuance_id, input.label).toBeNull();",
          "expect(candidateConfirmation.rows[0].n, input.label).toBe(0);",
          "expect(terminalAudit.rows[0].n, input.label).toBe(1);",
          "expect(allContexts.rows[0].n, input.label).toBe(0);",
          "expect(attempt.rows[0], input.label).toMatchObject({",
        ],
      },
    ],
  },
  'M-01-age-band': {
    helperAssertions: [
      {
        helper: 'runHiddenFailure',
        assertions: [
          "expect(context.rows[0].pairing_issuance_id, input.label).toBeNull();",
          "expect(candidateConfirmation.rows[0].n, input.label).toBe(0);",
          "expect(terminalAudit.rows[0].n, input.label).toBe(1);",
          "expect(allContexts.rows[0].n, input.label).toBe(0);",
          "expect(attempt.rows[0], input.label).toMatchObject({",
        ],
      },
    ],
  },
  'M-01-guardian': {
    helperAssertions: [
      {
        helper: 'runHiddenFailure',
        assertions: [
          "expect(context.rows[0].pairing_issuance_id, input.label).toBeNull();",
          "expect(candidateConfirmation.rows[0].n, input.label).toBe(0);",
          "expect(terminalAudit.rows[0].n, input.label).toBe(1);",
          "expect(allContexts.rows[0].n, input.label).toBe(0);",
          "expect(attempt.rows[0], input.label).toMatchObject({",
        ],
      },
    ],
  },
  'M-01-consent': {
    helperAssertions: [
      {
        helper: 'runHiddenFailure',
        assertions: [
          "expect(context.rows[0].pairing_issuance_id, input.label).toBeNull();",
          "expect(candidateConfirmation.rows[0].n, input.label).toBe(0);",
          "expect(terminalAudit.rows[0].n, input.label).toBe(1);",
          "expect(allContexts.rows[0].n, input.label).toBe(0);",
          "expect(attempt.rows[0], input.label).toMatchObject({",
        ],
      },
    ],
  },
  'M-01-membership': {
    helperAssertions: [
      {
        helper: 'runHiddenFailure',
        assertions: [
          "expect(context.rows[0].pairing_issuance_id, input.label).toBeNull();",
          "expect(candidateConfirmation.rows[0].n, input.label).toBe(0);",
          "expect(terminalAudit.rows[0].n, input.label).toBe(1);",
          "expect(allContexts.rows[0].n, input.label).toBe(0);",
          "expect(attempt.rows[0], input.label).toMatchObject({",
        ],
      },
    ],
  },
  'M-01-invitation': {
    helperAssertions: [
      {
        helper: 'runHiddenFailure',
        assertions: [
          "expect(context.rows[0].pairing_issuance_id, input.label).toBeNull();",
          "expect(candidateConfirmation.rows[0].n, input.label).toBe(0);",
          "expect(terminalAudit.rows[0].n, input.label).toBe(1);",
          "expect(allContexts.rows[0].n, input.label).toBe(0);",
          "expect(attempt.rows[0], input.label).toMatchObject({",
        ],
      },
    ],
  },
  'M-01-P1-conflict': {
    helperAssertions: [
      {
        helper: 'runHiddenFailure',
        assertions: [
          "expect(context.rows[0].pairing_issuance_id, input.label).toBeNull();",
          "expect(candidateConfirmation.rows[0].n, input.label).toBe(0);",
          "expect(terminalAudit.rows[0].n, input.label).toBe(1);",
          "expect(allContexts.rows[0].n, input.label).toBe(0);",
          "expect(attempt.rows[0], input.label).toMatchObject({",
          "expect(person.rows[0].account_id, input.label).toBe(",
        ],
      },
    ],
  },
  'M-01-candidate-account-conflict': {
    helperAssertions: [
      {
        helper: 'runHiddenFailure',
        assertions: [
          "expect(context.rows[0].pairing_issuance_id, input.label).toBeNull();",
          "expect(candidateConfirmation.rows[0].n, input.label).toBe(0);",
          "expect(terminalAudit.rows[0].n, input.label).toBe(1);",
          "expect(allContexts.rows[0].n, input.label).toBe(0);",
          "expect(attempt.rows[0], input.label).toMatchObject({",
        ],
      },
    ],
  },

  // ── M-02 / M-03 / M-04 + contract / RLS / rollback / MINOR / Case B ──
  'M-02-replay-cleanup': {
    assertions: [
      'expect(rows).toHaveLength(1);',
      "expect(reused.json().binding).toBe('REUSED');",
    ],
  },
  'M-03-status-expiry': {
    assertions: [
      'expect(secrets.rows[0].n).toBe(0);',
      'expect(audit.rows[0].n).toBe(1);',
    ],
  },
  'M-04-settlement': {
    assertions: [
      "expect(outcome).toMatchObject({ outcome: 'TERMINAL', reason: 'ATTEMPT_EXPIRED' });",
      "expect(await auditCount(attemptId, 'BINDING_TERMINAL')).toBe(1);",
      'expect(secrets.rows[0].n).toBe(0);',
      'expect(binding.rows[0].account_id).toBeNull();',
    ],
  },
  'confirmationVersion-matrix': {
    assertions: [
      'expect(omitted.statusCode).toBe(422);',
      'expect(wrong.statusCode).toBe(422);',
      'expect(present.statusCode).toBe(422);',
    ],
  },
  'RLS-negative-writes': {
    assertions: ['expect(result.read).toBe(1);', 'expect(denied).toBe(true);'],
  },
  'rollback-matrix': {
    assertions: [
      'expect(accountsAfter.rows[0].n).toBe(0);',
      'expect(person.rows[0].account_id).toBeNull();',
    ],
  },
  'MINOR-guardian': {
    assertions: [
      "expect(confirm.json().state).toBe('COMMITTED');",
      'expect(p2.rows[0].cnt).toBe(0);',
    ],
  },
  'true-CaseB-mismatch': {
    assertions: [
      'expect(mismatch).toEqual(baseline);',
      'expect(attempts.rows[0].n).toBe(0);',
      'expect(confirmations.rows[0].n).toBe(0);',
    ],
  },

  // ── MEDIUM-01 historical replay proofs ──────────────────────
  'MEDIUM-01-replay-committed': {
    assertions: [
      "expect(replay.json().state).toBe('COMMITTED');",
      'expect(after).toEqual(before);',
    ],
  },
  'MEDIUM-01-replay-terminal': {
    assertions: [
      "expect(replay.json().state).toBe('TERMINAL');",
      'expect(after).toEqual(before);',
    ],
  },
  'MEDIUM-01-replay-pending-continuation': {
    assertions: [
      "expect(replay.json().state).toBe('TERMINAL');",
      'expect(after.confirmations).toBe(2);',
      'expect(terminalAudit.rows[0].n).toBe(1);',
    ],
  },
  'MEDIUM-01-replay-payload-mismatch': {
    assertions: [
      "expect(mismatch.json().code).toBe('IDEMPOTENCY_PAYLOAD_MISMATCH');",
      'expect(await mutationSnapshot(h, attemptId, target.targetPersonId)).toEqual(before);',
    ],
  },
};

export function fileOk(rel, root = ROOT) {
  const full = join(root, rel);
  if (!existsSync(full) || !statSync(full).isFile()) return false;
  const content = readFileSync(full, 'utf-8');
  return content.includes('it(') || content.includes('test(') || content.includes('describe(');
}

function parseSource(content) {
  return ts.createSourceFile(
    'proof.ts',
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );
}

/**
 * Locate the exact executable `it/test(name, fn)` call. Property-access forms
 * (it.skip / it.only / it.todo / it.concurrent / it.each) are deliberately not
 * identified, so they fail closed as "missing-or-skipped-test".
 */
export function findTestCall(content, testName) {
  const source = parseSource(content);
  let found = null;
  const visit = (node) => {
    if (found) return;
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      (node.expression.text === 'it' || node.expression.text === 'test') &&
      node.arguments.length >= 2 &&
      ts.isStringLiteral(node.arguments[0]) &&
      node.arguments[0].text === testName
    ) {
      found = node;
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found ? { source, node: found } : null;
}

/** Names of functions invoked inside the exact test callback. */
export function collectCalleeNames(node) {
  const names = new Set();
  const visit = (n) => {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression)) {
      names.add(n.expression.text);
    }
    ts.forEachChild(n, visit);
  };
  visit(node);
  return names;
}

/** Bodies of a helper declared as `function name(){}` or `const name = () => {}`. */
export function findHelperBodies(source, helperName) {
  const bodies = [];
  const visit = (node) => {
    if (
      ts.isFunctionDeclaration(node) &&
      node.name &&
      node.name.text === helperName &&
      node.body
    ) {
      bodies.push(node.body.getText(source));
    }
    if (ts.isVariableStatement(node)) {
      for (const decl of node.declarationList.declarations) {
        if (
          ts.isIdentifier(decl.name) &&
          decl.name.text === helperName &&
          decl.initializer &&
          (ts.isArrowFunction(decl.initializer) || ts.isFunctionExpression(decl.initializer)) &&
          decl.initializer.body
        ) {
          bodies.push(decl.initializer.body.getText(source));
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return bodies;
}

/** Extract the exact test function body via the TypeScript AST, or null. */
export function extractTestBody(content, testName) {
  const found = findTestCall(content, testName);
  return found ? found.node.arguments[1].getText(found.source) : null;
}

export function loadExecutionEvidence(path) {
  if (!path || !existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch {
    return null;
  }
}

function executedPassed(evidence, rel, testName) {
  const target = rel.replace(/^\.\//, '').replace(/\\/g, '/');
  for (const file of evidence.testResults ?? []) {
    const name = String(file.name ?? '').replace(/\\/g, '/');
    if (!name.endsWith(target)) continue;
    for (const assertion of file.assertionResults ?? []) {
      const title = String(assertion.title ?? '');
      const full = String(assertion.fullName ?? '');
      if (
        assertion.status === 'passed' &&
        (title === testName || full === testName || full.endsWith(` > ${testName}`))
      ) {
        return true;
      }
    }
  }
  return false;
}

const BROAD_ASSERTIONS = new Set(['expect(', 'toBe(', 'toEqual(']);

/**
 * Exact substantive proof check:
 *   file + exact test name + still-executable body + requirement-specific
 *   assertion contract + executed PASS evidence.
 *
 * There is no "any expect()" fallback: a proof without an explicit assertion
 * contract fails closed, and each configured assertion must be a real
 * requirement assertion rather than a generic token.
 */
export function proofOk(rel, proof, root = ROOT, execution = null) {
  const full = join(root, rel);
  if (!existsSync(full) || !statSync(full).isFile()) {
    return { ok: false, reason: 'missing-file' };
  }
  const content = readFileSync(full, 'utf-8');
  const found = findTestCall(content, proof.test);
  if (!found) return { ok: false, reason: 'missing-or-skipped-test' };
  const body = found.node.arguments[1].getText(found.source);

  const cfg = PROOF_ASSERTIONS[proof.id];
  if (!cfg) return { ok: false, reason: 'missing-proof-assertion' };
  const directAssertions = cfg.assertions ?? [];
  const helperEntries = cfg.helperAssertions ?? [];
  const allAssertions = [
    ...directAssertions,
    ...helperEntries.flatMap((entry) => entry.assertions ?? []),
  ];
  if (allAssertions.length === 0) {
    return { ok: false, reason: 'no-requirement-assertion' };
  }
  for (const assertion of allAssertions) {
    const trimmed = assertion.trim();
    if (BROAD_ASSERTIONS.has(trimmed)) {
      return { ok: false, reason: 'broad-assertion' };
    }
    if (!trimmed.includes('expect(')) {
      return { ok: false, reason: 'not-an-assertion' };
    }
  }
  for (const assertion of directAssertions) {
    if (!body.includes(assertion)) return { ok: false, reason: 'assertion-removed' };
  }

  // A helper assertion is only valid when the EXACT test actually calls the
  // named helper and that helper body carries the requirement assertion. A
  // matching string elsewhere in the same file is NOT enough.
  const callees = collectCalleeNames(found.node.arguments[1]);
  for (const entry of helperEntries) {
    if (!entry.helper || typeof entry.helper !== 'string') {
      return { ok: false, reason: 'missing-helper-name' };
    }
    if (!callees.has(entry.helper)) {
      return { ok: false, reason: 'helper-not-called' };
    }
    const helperBodies = findHelperBodies(found.source, entry.helper);
    if (helperBodies.length === 0) return { ok: false, reason: 'helper-not-found' };
    if (helperBodies.length > 1) return { ok: false, reason: 'helper-ambiguous' };
    for (const assertion of entry.assertions ?? []) {
      if (!helperBodies[0].includes(assertion)) {
        return { ok: false, reason: 'helper-assertion-removed' };
      }
    }
  }

  if (!execution) return { ok: false, reason: 'unexecuted-no-evidence' };
  if (!executedPassed(execution, rel, proof.test)) {
    return { ok: false, reason: 'unexecuted' };
  }
  return { ok: true };
}

function checkProofs(root, missing, execution) {
  let ok = 0;
  const total = Object.keys(SUBSTANTIVE_PROOFS).length;
  for (const [id, proof] of Object.entries(SUBSTANTIVE_PROOFS)) {
    const result = proofOk(proof.file, { ...proof, id }, root, execution);
    if (!result.ok) {
      missing.push(
        `[Slice 5 Substantive Proofs] ${id}: ${proof.file} :: ${proof.test} (${result.reason})`
      );
    } else {
      ok++;
    }
  }
  return { label: 'Slice 5 Substantive Proofs', ok, total, substantive: true };
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
  return { label, ok, total, substantive: false };
}
// ── Slice 3 (003-evidence-core) ────────────────────────────
const FR_003 = {
  'FR-001': ['tests/db/evidence-schema.test.ts', 'tests/domain/evidence-capabilities.test.ts'],
  'FR-002': ['tests/db/evidence-schema.test.ts', 'tests/db/evidence-fks-supersedes.test.ts'],
  'FR-003': ['tests/db/evidence-observation-storage.test.ts', 'tests/domain/evidence-observation.test.ts'],
  'FR-004': ['tests/domain/evidence-provenance.test.ts', 'tests/integration/evidence-write.test.ts'],
  'FR-005': ['tests/db/evidence-observation-storage.test.ts', 'tests/domain/evidence-observation.test.ts'],
  'FR-006': ['tests/domain/evidence-conflict-supersedes.test.ts', 'tests/integration/evidence-write.test.ts'],
  'FR-007': ['tests/db/evidence-fks-supersedes.test.ts', 'tests/domain/evidence-conflict-supersedes.test.ts'],
  'FR-008': ['tests/db/evidence-fact-guard.test.ts', 'tests/domain/evidence-capabilities.test.ts'],
  'FR-009': ['tests/integration/messages-create.test.ts', 'tests/integration/openapi-evidence.test.ts'],
  'FR-010': ['tests/integration/messages-authorization.test.ts', 'tests/integration/messages-authorization-before-replay.test.ts'],
  'FR-011': ['tests/db/evidence-rls-grants.test.ts', 'tests/db/evidence-fact-guard.test.ts'],
  'FR-012': ['tests/integration/evidence-scope.test.ts', 'tests/domain/evidence-capabilities.test.ts'],
  'FR-013': ['tests/integration/openapi-evidence.test.ts', 'tests/integration/messages-create.test.ts'],
  'FR-014': ['tests/integration/evidence-scope.test.ts', 'tests/domain/evidence-conflict-supersedes.test.ts'],
  'FR-015': ['tests/integration/openapi-evidence.test.ts', 'tests/integration/evidence-scope.test.ts'],
  'FR-016': ['tests/domain/evidence-provenance.test.ts', 'tests/domain/evidence-person-reference.test.ts'],
  'FR-017': ['tests/integration/messages-idempotency.test.ts', 'tests/db/evidence-audit-idempotency.test.ts'],
  'FR-018': ['tests/integration/messages-authorization.test.ts', 'tests/integration/evidence-scope.test.ts'],
  'FR-019': ['tests/integration/messages-create.test.ts', 'tests/domain/evidence-person-reference.test.ts'],
  'FR-020': ['tests/integration/evidence-scope.test.ts', 'tests/db/migration-repro.test.ts'],
  'FR-021': ['tests/db/evidence-fks-supersedes.test.ts', 'tests/domain/evidence-person-reference.test.ts'],
};

const SC_003 = {
  'SC-001': ['tests/db/evidence-schema.test.ts', 'tests/domain/evidence-capabilities.test.ts'],
  'SC-002': ['tests/domain/evidence-provenance.test.ts', 'tests/integration/evidence-write.test.ts'],
  'SC-003': ['tests/domain/evidence-conflict-supersedes.test.ts', 'tests/integration/evidence-write.test.ts'],
  'SC-004': ['tests/db/evidence-observation-storage.test.ts', 'tests/domain/evidence-observation.test.ts'],
  'SC-005': ['tests/db/evidence-fks-supersedes.test.ts', 'tests/domain/evidence-conflict-supersedes.test.ts'],
  'SC-006': ['tests/db/evidence-rls-grants.test.ts', 'tests/integration/messages-authorization.test.ts'],
  'SC-007': ['tests/integration/messages-create.test.ts', 'tests/integration/evidence-scope.test.ts'],
  'SC-008': ['tests/integration/evidence-scope.test.ts', 'tests/integration/openapi-evidence.test.ts'],
  'SC-009': ['tests/domain/evidence-provenance.test.ts', 'tests/domain/evidence-conflict-supersedes.test.ts'],
  'SC-010': ['tests/integration/evidence-scope.test.ts', 'tests/db/migration-repro.test.ts'],
};

const ACCEPTANCE_003 = {
  'A01-message-raw-only-zero-assertion': ['tests/integration/messages-create.test.ts'],
  'A02-guardian-relay-stays-statement': ['tests/integration/evidence-write.test.ts', 'tests/domain/evidence-provenance.test.ts'],
  'A03-conflict-no-winner': ['tests/integration/evidence-write.test.ts', 'tests/domain/evidence-conflict-supersedes.test.ts'],
  'A04-unknown-states-roundtrip': ['tests/db/evidence-observation-storage.test.ts', 'tests/domain/evidence-observation.test.ts'],
  'A05-hypothesis-cannot-become-fact': ['tests/domain/evidence-capabilities.test.ts', 'tests/db/evidence-fact-guard.test.ts', 'tests/db/evidence-rls-grants.test.ts'],
  'A06-supersedes-keeps-old-history': ['tests/db/evidence-fks-supersedes.test.ts', 'tests/integration/evidence-write.test.ts'],
  'A07-cross-family-isolation': ['tests/integration/messages-authorization.test.ts', 'tests/db/evidence-rls-grants.test.ts'],
  'A08-provenance-traceability': ['tests/db/evidence-schema.test.ts', 'tests/domain/evidence-provenance.test.ts'],
  'A09-only-approved-message-post': ['tests/integration/openapi-evidence.test.ts', 'tests/integration/evidence-scope.test.ts'],
  'A10-observation-separate-from-assertion': ['tests/db/evidence-schema.test.ts', 'tests/db/evidence-observation-storage.test.ts'],
  'A11-ai-extractor-cannot-confirm-fact': ['tests/domain/evidence-capabilities.test.ts', 'tests/domain/evidence-provenance.test.ts'],
  'A12-dependency-gate-blocked': ['tests/integration/evidence-scope.test.ts', 'tests/db/migration-repro.test.ts'],
  'A13-family-a-cannot-reference-family-b-person': ['tests/domain/evidence-person-reference.test.ts', 'tests/db/evidence-fks-supersedes.test.ts'],
};

function auditSlice3() {
  console.log('');
  console.log('# 003-evidence-core — FR / SC / Acceptance / Checklist Coverage Audit');
  console.log('');

  const missing3 = [];
  let fr3Ok = 0;
  let sc3Ok = 0;
  let acc3Ok = 0;

  const table = (label, entries, onOk) => {
    console.log(`## ${label}`);
    console.log('');
    console.log('| Item | Test files | Status |');
    console.log('|---|---|---|');
    for (const [id, files] of Object.entries(entries)) {
      const bad = files.filter((f) => !fileOk(f));
      if (bad.length > 0) {
        missing3.push(`${id}: ${bad.join(', ')}`);
        console.log(`| ${id} | ${files.join(', ')} | MISSING (${bad.join(', ')}) |`);
      } else {
        onOk();
        console.log(`| ${id} | ${files.join(', ')} | COVERED |`);
      }
    }
    console.log('');
  };

  table('Functional Requirements (21)', FR_003, () => { fr3Ok++; });
  table('Success Criteria (10)', SC_003, () => { sc3Ok++; });
  table('Acceptance Scenarios (13)', ACCEPTANCE_003, () => { acc3Ok++; });

  const checklistPath = join(
    ROOT,
    'specs',
    '003-evidence-core',
    'checklists',
    'requirements-quality.md'
  );
  const checklist = readFileSync(checklistPath, 'utf-8');
  const checked = [...checklist.matchAll(/^- \[x\] CHK(\d{3})/gm)].length;
  const chkTotal = 115;
  if (checked !== chkTotal) missing3.push(`Checklist: ${checked}/${chkTotal}`);

  console.log(`FR ${fr3Ok}/${Object.keys(FR_003).length}`);
  console.log(`SC ${sc3Ok}/${Object.keys(SC_003).length}`);
  console.log(`Acceptance ${acc3Ok}/${Object.keys(ACCEPTANCE_003).length}`);
  console.log(`Checklist ${checked}/${chkTotal}`);
  console.log(`missing = ${missing3.length}`);
  if (missing3.length > 0) {
    for (const m of missing3) console.log(`  MISSING ${m}`);
    console.log('coverage-audit (003): FAIL');
    process.exitCode = 1;
  } else {
    console.log('coverage-audit (003): PASS');
  }
}



export function audit(root = ROOT, options = {}) {
  const missing = [];
  const execution = options.execution ?? null;
  const proofIds = Object.keys(SUBSTANTIVE_PROOFS).sort();
  const assertionIds = Object.keys(PROOF_ASSERTIONS).sort();
  if (JSON.stringify(proofIds) !== JSON.stringify(assertionIds)) {
    missing.push(
      `[Slice 5 Substantive Proofs] assertion-contract keys must equal proof keys ` +
        `(proofs=${proofIds.length}, assertions=${assertionIds.length})`
    );
  }
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
    checkSection('Slice 3 FR', FR_003, root, missing),
    checkSection('Slice 3 SC', SC_003, root, missing),
    checkSection('Slice 3 Acceptance', ACCEPTANCE_003, root, missing),
    checkProofs(root, missing, execution),
  ];
  return { missing, sections, executionProvided: Boolean(execution) };
}

function printSection(section) {
  const suffix = section.substantive ? ' (substantive)' : ' (structural, not substantive)';
  console.log(`${section.label}: ${section.ok}/${section.total}${suffix}`);
}

function main() {
  const executionPath = process.env['COVERAGE_EXECUTION_EVIDENCE'];
  const execution = loadExecutionEvidence(executionPath);
  const { missing, sections } = audit(ROOT, { execution });
  console.log('# FR / SC / Acceptance substantive coverage audit');
  console.log('');
  if (!execution) {
    console.log(`execution evidence: MISSING (${executionPath ?? '<not provided>'})`);
    console.log('  substantive proofs cannot PASS without executed PASS evidence.');
    console.log('');
  } else {
    console.log(`execution evidence: ${executionPath}`);
    console.log('');
  }
  for (const section of sections) printSection(section);
  auditSlice3();
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
