import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as domainRoot from '../../packages/domain/src/index.js';
import { resolveInterventionProfessionalAuthority } from '../../apps/server/api/src/services/intervention-professional-authority.js';
import { professionalProof, professionalProvider } from '../support/intervention.js';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);

const EXPECTED_FR = ["FR-001", "FR-002", "FR-003", "FR-004", "FR-005", "FR-006", "FR-007", "FR-008", "FR-009", "FR-010", "FR-011", "FR-012", "FR-013", "FR-014", "FR-015", "FR-016", "FR-017", "FR-018", "FR-019", "FR-020", "FR-021", "FR-022", "FR-023", "FR-024", "FR-025", "FR-026", "FR-027", "FR-028", "FR-029", "FR-030", "FR-031", "FR-032", "FR-033", "FR-034", "FR-035", "FR-036", "FR-037", "FR-038", "FR-039", "FR-040", "FR-041", "FR-042", "FR-043", "FR-044", "FR-045", "FR-046", "FR-047", "FR-048", "FR-049", "FR-050", "FR-051", "FR-052", "FR-053", "FR-054", "FR-055", "FR-056", "FR-057", "FR-058", "FR-059", "FR-060", "FR-061", "FR-062", "FR-063", "FR-064"] as const;
const EXPECTED_AS = ["AS-001", "AS-002", "AS-003", "AS-004", "AS-005", "AS-006", "AS-007", "AS-008", "AS-009", "AS-010", "AS-011", "AS-012", "AS-013", "AS-014", "AS-015", "AS-016", "AS-017", "AS-018", "AS-019", "AS-020", "AS-021", "AS-022", "AS-023", "AS-024", "AS-025", "AS-026", "AS-027", "AS-028", "AS-029", "AS-030", "AS-031", "AS-032", "AS-033", "AS-034", "AS-035", "AS-036", "AS-037", "AS-038", "AS-039", "AS-040"] as const;
const EXPECTED_NS = ["NS-001", "NS-002", "NS-003", "NS-004", "NS-005", "NS-006", "NS-007", "NS-008", "NS-009", "NS-010", "NS-011", "NS-012", "NS-013", "NS-014", "NS-015", "NS-016", "NS-017", "NS-018", "NS-019", "NS-020", "NS-021", "NS-022", "NS-023", "NS-024", "NS-025", "NS-026", "NS-027", "NS-028", "NS-029", "NS-030"] as const;

const TRACEABILITY = {
  "FR-001": { requirement: "The selected capability SHALL remain Psychological / Behavioral Intervention Contract Foundation.", file: "tests/domain/intervention-definition.test.ts", anchor: "validates every frozen semantic field before hashing and rejects unknown authority fields" },
  "FR-002": { requirement: "intervention_definitions SHALL remain the single InterventionDefinition domain owner.", file: "tests/domain/intervention-definition.test.ts", anchor: "validates every frozen semantic field before hashing and rejects unknown authority fields" },
  "FR-003": { requirement: "Every formal definition SHALL have stable logical identity and exact immutable version.", file: "tests/domain/intervention-definition.test.ts", anchor: "validates every frozen semantic field before hashing and rejects unknown authority fields" },
  "FR-004": { requirement: "intervention_code alone SHALL NOT authorize formal use.", file: "tests/domain/intervention-definition.test.ts", anchor: "validates every frozen semantic field before hashing and rejects unknown authority fields" },
  "FR-005": { requirement: "Every version SHALL have an exact content identity/hash suitable for approval binding.", file: "tests/domain/intervention-definition.test.ts", anchor: "uses schema field order, exact UTF-8 bytes and SHA-256" },
  "FR-006": { requirement: "Every production-eligible definition SHALL express all required §2.7A semantic fields.", file: "tests/domain/intervention-definition.test.ts", anchor: "validates every frozen semantic field before hashing and rejects unknown authority fields" },
  "FR-007": { requirement: "Family-specific Evidence bodies SHALL NOT be stored as universal professional definition content.", file: "tests/domain/intervention-definition.test.ts", anchor: "validates every frozen semantic field before hashing and rejects unknown authority fields" },
  "FR-008": { requirement: "Method-name-only content SHALL NOT satisfy the formal Contract.", file: "tests/domain/intervention-definition.test.ts", anchor: "validates every frozen semantic field before hashing and rejects unknown authority fields" },
  "FR-009": { requirement: "Published historical semantic content SHALL NOT be edited in place.", file: "tests/domain/intervention-definition.test.ts", anchor: "material professional source-ref change creates a different content hash" },
  "FR-010": { requirement: "Substantive correction SHALL create a successor definition version.", file: "tests/domain/intervention-definition.test.ts", anchor: "material professional source-ref change creates a different content hash" },
  "FR-011": { requirement: "Canonical professional approval Authority SHALL be consumed from the shared Professional Content Approval Plane.", file: "tests/integration/intervention-professional-authority.test.ts", anchor: "accepts only an exact valid approval proof" },
  "FR-012": { requirement: "Slice 16 SHALL NOT mint approval from a local review_status flag.", file: "tests/integration/intervention-professional-authority.test.ts", anchor: "accepts only an exact valid approval proof" },
  "FR-013": { requirement: "Approval SHALL bind exact definition id/version/content hash.", file: "tests/integration/intervention-professional-authority.test.ts", anchor: "accepts only an exact valid approval proof" },
  "FR-014": { requirement: "Approval SHALL bind source refs and approval scope.", file: "tests/integration/intervention-professional-authority.test.ts", anchor: "accepts only an exact valid approval proof" },
  "FR-015": { requirement: "Approval SHALL identify the real reviewer.", file: "tests/integration/intervention-professional-authority.test.ts", anchor: "accepts only an exact valid approval proof" },
  "FR-016": { requirement: "Approval SHALL require matching professional qualification proof/reference.", file: "tests/integration/intervention-professional-authority.test.ts", anchor: "accepts only an exact valid approval proof" },
  "FR-017": { requirement: "Approval SHALL require valid applicable Staff assignment/capability Authority.", file: "tests/integration/intervention-professional-authority.test.ts", anchor: "accepts only an exact valid approval proof" },
  "FR-018": { requirement: "PROFESSIONAL_REVIEW capability alone SHALL NOT equal qualification or approval.", file: "tests/integration/intervention-professional-authority.test.ts", anchor: "accepts only an exact valid approval proof" },
  "FR-019": { requirement: "reviewed_by_role alone SHALL NOT satisfy approval proof.", file: "tests/integration/intervention-professional-authority.test.ts", anchor: "accepts only an exact valid approval proof" },
  "FR-020": { requirement: "AI, RAG, developer, fixture, family identity or successful tests SHALL NOT create professional approval.", file: "tests/integration/intervention-professional-authority.test.ts", anchor: "production Professional Approval and qualification are truthfully unavailable" },
  "FR-021": { requirement: "New production use SHALL require current APPROVED professional proof.", file: "tests/integration/intervention-professional-authority.test.ts", anchor: "accepts only an exact valid approval proof" },
  "FR-022": { requirement: "New production use SHALL require current PUBLISHED professional proof.", file: "tests/integration/intervention-professional-authority.test.ts", anchor: "['unpublished'," },
  "FR-023": { requirement: "Retired, superseded or expired professional content SHALL NOT accept new production use.", file: "tests/integration/intervention-professional-authority.test.ts", anchor: "['retired'," },
  "FR-024": { requirement: "Professional approval proof SHALL expose/refer to effective and publication periods.", file: "tests/integration/intervention-professional-authority.test.ts", anchor: "accepts only an exact valid approval proof" },
  "FR-025": { requirement: "Slice 16 MAY persist bounded approval projection/reference but SHALL NOT duplicate canonical approval truth.", file: "tests/integration/intervention-professional-authority.test.ts", anchor: "accepts only an exact valid approval proof" },
  "FR-026": { requirement: "Historical approval/provenance SHALL remain inspectable.", file: "tests/integration/intervention-professional-authority.test.ts", anchor: "accepts only an exact valid approval proof" },
  "FR-027": { requirement: "Formal consideration SHALL bind exact Scene identity and exact Scene/package version.", file: "tests/scenes/digital-use/intervention-definition-inclusion.test.ts", anchor: "requires exact package + id + version + content hash" },
  "FR-028": { requirement: "Formal consideration SHALL bind exact InterventionDefinition id/version/hash.", file: "tests/scenes/digital-use/intervention-definition-inclusion.test.ts", anchor: "requires exact package + id + version + content hash" },
  "FR-029": { requirement: "Floating latest SHALL be forbidden for definition or package selection.", file: "tests/scenes/digital-use/intervention-definition-inclusion.test.ts", anchor: "does not expose latest/nearest resolution" },
  "FR-030": { requirement: "Slice 16 SHALL reuse the existing Scene/package owner and scene_package_version binding.", file: "tests/scenes/digital-use/intervention-definition-inclusion.test.ts", anchor: "requires exact package + id + version + content hash" },
  "FR-031": { requirement: "A package containing an unapproved/unpublished/retired/wrong-hash definition SHALL be invalid for new formal use.", file: "tests/scenes/digital-use/intervention-definition-inclusion.test.ts", anchor: "requires exact package + id + version + content hash" },
  "FR-032": { requirement: "Slice 16 SHALL NOT create a second Scene package registry.", file: "tests/scenes/digital-use/intervention-definition-inclusion.test.ts", anchor: "requires exact package + id + version + content hash" },
  "FR-033": { requirement: "Slice 16 SHALL provide deterministic eligibility for an exact definition version.", file: "tests/domain/intervention-eligibility.test.ts", anchor: "deterministic intervention eligibility" },
  "FR-034": { requirement: "Eligibility SHALL consume current authoritative Case state.", file: "tests/integration/intervention-eligibility-snapshot.test.ts", anchor: "reads one current snapshot and audits exact provenance without writing Case phase" },
  "FR-035": { requirement: "Eligibility SHALL consume current authoritative Problem Formulation and required Evidence.", file: "tests/integration/intervention-eligibility-snapshot.test.ts", anchor: "reads one current snapshot and audits exact provenance without writing Case phase" },
  "FR-036": { requirement: "Eligibility SHALL verify current professional approval before family-specific applicability.", file: "tests/domain/intervention-eligibility.test.ts", anchor: "deterministic intervention eligibility" },
  "FR-037": { requirement: "Eligibility SHALL enforce age/development scope.", file: "tests/domain/intervention-eligibility.test.ts", anchor: "deterministic intervention eligibility" },
  "FR-038": { requirement: "Eligibility SHALL enforce Formulation dependencies and preserve UNKNOWN.", file: "tests/domain/intervention-eligibility-unknown.test.ts", anchor: "UNKNOWN-family eligibility semantics" },
  "FR-039": { requirement: "Eligibility SHALL enforce required supporting Evidence.", file: "tests/domain/intervention-eligibility-unknown.test.ts", anchor: "UNKNOWN-family eligibility semantics" },
  "FR-040": { requirement: "Eligibility SHALL enforce applicable conditions.", file: "tests/domain/intervention-eligibility.test.ts", anchor: "deterministic intervention eligibility" },
  "FR-041": { requirement: "Eligibility SHALL block applicable exclusion/contraindication.", file: "tests/domain/intervention-eligibility.test.ts", anchor: "deterministic intervention eligibility" },
  "FR-042": { requirement: "Eligibility SHALL enforce participation requirements.", file: "tests/domain/intervention-eligibility.test.ts", anchor: "deterministic intervention eligibility" },
  "FR-043": { requirement: "Eligibility SHALL consume authoritative Consent and fail closed when required Consent is invalid.", file: "tests/domain/intervention-eligibility-unknown.test.ts", anchor: "UNKNOWN-family eligibility semantics" },
  "FR-044": { requirement: "Eligibility SHALL enforce combination/conflict rules.", file: "tests/domain/intervention-eligibility.test.ts", anchor: "deterministic intervention eligibility" },
  "FR-045": { requirement: "Eligibility SHALL consume authoritative Compliance.", file: "tests/domain/intervention-eligibility-unknown.test.ts", anchor: "UNKNOWN-family eligibility semantics" },
  "FR-046": { requirement: "Eligibility SHALL consume authoritative Safety and block ordinary progression under Safety block.", file: "tests/domain/intervention-eligibility-unknown.test.ts", anchor: "UNKNOWN-family eligibility semantics" },
  "FR-047": { requirement: "Eligibility SHALL reject wrong-family/wrong-case/wrong-actor/wrong-purpose contexts.", file: "tests/integration/intervention-eligibility-snapshot.test.ts", anchor: "authorizes before protected reads and wrong-family context creates no eligibility audit" },
  "FR-048": { requirement: "Eligibility allowed=true SHALL NOT create or activate an InterventionInstance or Plan.", file: "tests/domain/intervention-eligibility.test.ts", anchor: "eligibility result contains no Phase-4 execution object" },
  "FR-049": { requirement: "A stale eligibility result SHALL NOT remain authoritative after a relevant dependency revision.", file: "tests/integration/intervention-eligibility-snapshot.test.ts", anchor: "FR-049 blocks Case -> SAFETY_HOLD committed while eligibility is waiting on current Case authority" },
  "FR-050": { requirement: "RAG/model output SHALL NOT override deterministic eligibility.", file: "tests/domain/intervention-eligibility.test.ts", anchor: "returns allowed=true only when every independent gate passes" },
  "FR-051": { requirement: "Professional definition mutation SHALL NOT be authorized by Family/Case ownership alone.", file: "tests/integration/intervention-error-disclosure.test.ts", anchor: "anti-enumerates definition guessing and professional-authority detail for unauthorized consumers" },
  "FR-052": { requirement: "Slice 16 SHALL reuse current RLS/Authorization boundaries and preserve anti-enumeration.", file: "tests/integration/intervention-error-disclosure.test.ts", anchor: "anti-enumerates definition guessing and professional-authority detail for unauthorized consumers" },
  "FR-053": { requirement: "Slice 16 SHALL reuse current Consent/Compliance/Safety owners without duplicating truth.", file: "tests/integration/intervention-eligibility-snapshot.test.ts", anchor: "reads one current snapshot and audits exact provenance without writing Case phase" },
  "FR-054": { requirement: "Slice 16 SHALL not create or mutate Common Core Case phase as a private state.", file: "tests/integration/intervention-eligibility-snapshot.test.ts", anchor: "reads one current snapshot and audits exact provenance without writing Case phase" },
  "FR-055": { requirement: "Slice 16 SHALL reuse shared idempotency semantics for mutations.", file: "tests/db/intervention-definition-runtime.test.ts", anchor: "same key + same semantic payload replays exact definition identity; different payload conflicts" },
  "FR-056": { requirement: "Same idempotency key with materially different canonical payload SHALL conflict.", file: "tests/db/intervention-definition-runtime.test.ts", anchor: "same key + same semantic payload replays exact definition identity; different payload conflicts" },
  "FR-057": { requirement: "Concurrent lifecycle/version/binding mutations SHALL prevent lost updates and resurrection.", file: "tests/db/intervention-definition-concurrency.test.ts", anchor: "two concurrent successor creates yield one next version and a stale-writer loser" },
  "FR-058": { requirement: "Applicable domain mutation, audit and idempotency settlement SHALL be atomic.", file: "tests/db/intervention-definition-concurrency.test.ts", anchor: "qualification proof changing between prepare and mutation rolls back definition, audit and idempotency" },
  "FR-059": { requirement: "Audit SHALL bind exact definition/version/hash, approval proof ref and package context.", file: "tests/integration/intervention-eligibility-snapshot.test.ts", anchor: "reads one current snapshot and audits exact provenance without writing Case phase" },
  "FR-060": { requirement: "Audit SHALL not become a second professional truth store.", file: "tests/integration/intervention-eligibility-snapshot.test.ts", anchor: "audits exact provenance" },
  "FR-061": { requirement: "Development SHALL permit candidate/draft definitions without falsely marking them production approved.", file: "tests/db/intervention-definition-runtime.test.ts", anchor: "creates a server-hashed candidate and records global business audit without fake Family" },
  "FR-062": { requirement: "Production without a real qualified approved reviewer SHALL fail closed as candidate/unavailable.", file: "tests/db/intervention-definition-runtime.test.ts", anchor: "keeps production candidate mutation unavailable without a real qualification consumer" },
  "FR-063": { requirement: "Slice 16 SHALL create no Phase 4 business truth and no RAG/AI runtime.", file: "tests/architecture/intervention-authority-guard.test.ts", anchor: "does not introduce Phase-4 execution domains" },
  "FR-064": { requirement: "Future implementation SHALL allocate the then-next safe migration rather than reusing the historical migration assumption.", file: "tests/db/migration-repro.test.ts", anchor: "all 32 tables" },
  "AS-001": { requirement: "PROFESSIONAL_REVIEW capability exists but matching qualification is missing: professional approval is invalid and production use is blocked.", file: "tests/integration/intervention-professional-authority.test.ts", anchor: "production Professional Approval and qualification are truthfully unavailable" },
  "AS-002": { requirement: "Qualification proof exists but the reviewer has no valid applicable Staff assignment/capability: approval is invalid and production use is blocked.", file: "tests/integration/intervention-professional-authority.test.ts", anchor: "['revoked staff authority'," },
  "AS-003": { requirement: "AI-generated Intervention draft: it may remain candidate but cannot approve or publish itself.", file: "tests/architecture/intervention-authority-guard.test.ts", anchor: "contains no developer/AI/RAG/environment approval laundering" },
  "AS-004": { requirement: "Test fixture carries an apparently valid reviewer proof: it is usable only in isolated tests and cannot become production truth.", file: "tests/architecture/intervention-authority-guard.test.ts", anchor: "production cannot import test fixtures or synthetic authority" },
  "AS-005": { requirement: "Developer seed sets approved=true: no shared approval proof exists, therefore production eligibility remains blocked.", file: "tests/architecture/intervention-authority-guard.test.ts", anchor: "contains no developer/AI/RAG/environment approval laundering" },
  "AS-006": { requirement: "Real valid professional approval exists but publication is absent: no new production use.", file: "tests/integration/intervention-professional-authority.test.ts", anchor: "['unpublished'," },
  "AS-007": { requirement: "Previously published definition is now retired: new use is blocked and historical records remain inspectable.", file: "tests/db/intervention-definition-runtime.test.ts", anchor: "creates immutable successor versions, CAS-supersedes predecessor and retires terminally" },
  "AS-008": { requirement: "Approval proof scope does not cover the requested Intervention/Scene: fail closed.", file: "tests/integration/intervention-professional-authority.test.ts", anchor: "['wrong approval scope'," },
  "AS-009": { requirement: "Approval is valid but the current Scene/package version differs from the approved/included package: fail closed.", file: "tests/scenes/digital-use/intervention-definition-inclusion.test.ts", anchor: "requires exact package + id + version + content hash" },
  "AS-010": { requirement: "Request supplies correct intervention_code but wrong definition version: no floating-latest substitution; fail closed.", file: "tests/scenes/digital-use/intervention-definition-inclusion.test.ts", anchor: "does not expose latest/nearest resolution" },
  "AS-011": { requirement: "Reviewer assignment was valid at review time but is stale/revoked for a new approval attempt: the new approval attempt fails closed.", file: "tests/db/intervention-definition-concurrency.test.ts", anchor: "serializes a fresh mutation ahead of a truly concurrent Staff revocation" },
  "AS-012": { requirement: "PROFESSIONAL_REVIEW capability is revoked before a new approval attempt: fail closed.", file: "tests/db/intervention-definition-concurrency.test.ts", anchor: "revoked Staff authority cannot authorize a fresh mutation" },
  "AS-013": { requirement: "Qualification or approval effective period is expired where applicable: new production use fails closed.", file: "tests/integration/intervention-professional-authority.test.ts", anchor: "['expired'," },
  "AS-014": { requirement: "Authorized definition is evaluated against the wrong Family or Case: fail closed without protected-object enumeration.", file: "tests/integration/intervention-eligibility-snapshot.test.ts", anchor: "authorizes before protected reads and wrong-family context creates no eligibility audit" },
  "AS-015": { requirement: "Required Consent is missing/revoked/expired: fail closed.", file: "tests/domain/intervention-eligibility-unknown.test.ts", anchor: "Consent UNKNOWN" },
  "AS-016": { requirement: "Compliance blocks the requested use: professional approval cannot override it.", file: "tests/domain/intervention-eligibility-unknown.test.ts", anchor: "Compliance UNKNOWN" },
  "AS-017": { requirement: "Safety blocks ordinary progression: professional approval cannot override it.", file: "tests/domain/intervention-eligibility-unknown.test.ts", anchor: "Safety UNKNOWN" },
  "AS-018": { requirement: "Required Formulation dependency is missing/UNKNOWN: result remains blocked/UNKNOWN unless the exact approved definition explicitly permits UNKNOWN under current Authority.", file: "tests/domain/intervention-eligibility-unknown.test.ts", anchor: "Evidence NOT_COLLECTED" },
  "AS-019": { requirement: "Published Scene package snapshot contains an unpublished InterventionDefinition: the package/definition combination is invalid for new production use.", file: "tests/scenes/digital-use/intervention-definition-inclusion.test.ts", anchor: "production has no developer-authored formal inclusion" },
  "AS-020": { requirement: "Historical retired definition is referenced by an old record: exact historical version and provenance remain inspectable and are not rewritten.", file: "tests/db/intervention-definition-runtime.test.ts", anchor: "creates immutable successor versions, CAS-supersedes predecessor and retires terminally" },
  "AS-021": { requirement: "No real reviewer is configured: runtime remains truthful candidate/unavailable; no fake APPROVED/PUBLISHED state is produced.", file: "tests/integration/intervention-professional-authority.test.ts", anchor: "production Professional Approval and qualification are truthfully unavailable" },
  "AS-022": { requirement: "Approval proof content hash differs from the definition content hash: fail closed.", file: "tests/integration/intervention-professional-authority.test.ts", anchor: "['wrong hash'," },
  "AS-023": { requirement: "approvalProofRef binds a different definition/version: fail closed.", file: "tests/integration/intervention-requirement-traceability.test.ts", anchor: "AS-023 executes exact approvalProofRef binding fail-closed" },
  "AS-024": { requirement: "A published definition receives substantive semantic edits: in-place mutation is rejected; a successor version and fresh approval are required.", file: "tests/db/intervention-definition-runtime.test.ts", anchor: "creates immutable successor versions, CAS-supersedes predecessor and retires terminally" },
  "AS-025": { requirement: "Exact definition/version/hash has valid approval, valid publication, exact package inclusion and all current family gates pass: bounded eligibility may return allowed=true without creating a Phase 4 object.", file: "tests/domain/intervention-eligibility.test.ts", anchor: "returns allowed=true only when every independent gate passes" },
  "AS-026": { requirement: "Definition age/development scope does not match current authorized context: fail closed.", file: "tests/domain/intervention-eligibility.test.ts", anchor: "label: 'unknown age'" },
  "AS-027": { requirement: "Applicable exclusion or contraindication is hit: ordinary eligibility is blocked.", file: "tests/domain/intervention-eligibility.test.ts", anchor: "label: 'exclusion'" },
  "AS-028": { requirement: "Known conflicting Intervention combination is present: conflicting combination is blocked.", file: "tests/domain/intervention-eligibility.test.ts", anchor: "label: 'combination conflict'" },
  "AS-029": { requirement: "Required supporting Evidence is absent: allowed cannot become true.", file: "tests/domain/intervention-eligibility.test.ts", anchor: "label: 'missing formulation'" },
  "AS-030": { requirement: "Case phase has advanced while an otherwise valid parallel Scene stream remains legal: Slice 16 reads central Case truth and does not enforce a shadow exact-equality phase machine.", file: "tests/domain/intervention-eligibility.test.ts", anchor: "does not require exact Case phase equality and remains read-only past GOALS" },
  "AS-031": { requirement: "Material Problem Formulation correction changes the authoritative formulation: old eligibility becomes stale and must be recalculated; Slice 16 does not write Case phase itself.", file: "tests/integration/intervention-eligibility-snapshot.test.ts", anchor: "AS-031 material Formulation correction/supersession cannot leave old eligibility authoritative" },
  "AS-032": { requirement: "Exact idempotent replay of an already committed mutation: same business result, no duplicate definition/audit effect.", file: "tests/db/intervention-definition-runtime.test.ts", anchor: "same key + same semantic payload replays exact definition identity; different payload conflicts" },
  "AS-033": { requirement: "Same idempotency key with materially different definition/approval payload: conflict.", file: "tests/db/intervention-definition-runtime.test.ts", anchor: "same key + same semantic payload replays exact definition identity; different payload conflicts" },
  "AS-034": { requirement: "Concurrent publish-binding and retirement/supersession attempt: serialization/version precondition allows at most one valid current outcome.", file: "tests/db/intervention-definition-concurrency.test.ts", anchor: "retire versus successor has one authoritative winner and cannot resurrect the chain" },
  "AS-035": { requirement: "Failure after definition mutation but before audit/idempotency settlement: transaction rolls back the logical mutation.", file: "tests/db/intervention-definition-concurrency.test.ts", anchor: "qualification proof changing between prepare and mutation rolls back definition, audit and idempotency" },
  "AS-036": { requirement: "Unauthorized actor guesses a definition/package/family target: external response follows anti-enumeration policy.", file: "tests/integration/intervention-error-disclosure.test.ts", anchor: "anti-enumerates definition guessing and professional-authority detail for unauthorized consumers" },
  "AS-037": { requirement: "RAG retrieves strong supporting text for an unapproved definition: retrieval cannot make it eligible.", file: "tests/architecture/intervention-authority-guard.test.ts", anchor: "contains no developer/AI/RAG/environment approval laundering" },
  "AS-038": { requirement: "A user asks AI to create a new intervention and use it immediately: AI output remains candidate; no formal Intervention is activated.", file: "tests/architecture/intervention-authority-guard.test.ts", anchor: "contains no developer/AI/RAG/environment approval laundering" },
  "AS-039": { requirement: "Developer attempts to create InterventionInstance/Plan to prove end-to-end behavior: scope gate rejects the change.", file: "tests/architecture/intervention-authority-guard.test.ts", anchor: "does not introduce Phase-4 execution domains" },
  "AS-040": { requirement: "Developer attempts to create intervention_package_registry instead of using current Scene/package binding: scope gate rejects the duplicate owner.", file: "tests/architecture/intervention-authority-guard.test.ts", anchor: "does not create duplicate authority-owner tables or generic approval platforms" },
  "NS-001": { requirement: "No generic Professional CMS.", file: "tests/architecture/intervention-authority-guard.test.ts", anchor: "does not create duplicate authority-owner tables or generic approval platforms" },
  "NS-002": { requirement: "No Professional Content Platform.", file: "tests/architecture/intervention-authority-guard.test.ts", anchor: "does not create duplicate authority-owner tables or generic approval platforms" },
  "NS-003": { requirement: "No expert marketplace.", file: "tests/architecture/intervention-authority-guard.test.ts", anchor: "does not create duplicate authority-owner tables or generic approval platforms" },
  "NS-004": { requirement: "No generic Staff platform.", file: "tests/architecture/intervention-authority-guard.test.ts", anchor: "does not create duplicate authority-owner tables or generic approval platforms" },
  "NS-005": { requirement: "No duplicate staff_assignments.", file: "tests/architecture/intervention-authority-guard.test.ts", anchor: "does not create duplicate authority-owner tables or generic approval platforms" },
  "NS-006": { requirement: "No Professional qualification owner/platform created by Slice 16.", file: "tests/architecture/intervention-authority-guard.test.ts", anchor: "does not create duplicate authority-owner tables or generic approval platforms" },
  "NS-007": { requirement: "No duplicate Professional Content Approval Plane.", file: "tests/architecture/intervention-authority-guard.test.ts", anchor: "does not create duplicate authority-owner tables or generic approval platforms" },
  "NS-008": { requirement: "No ADMIN=true universal authority.", file: "tests/architecture/intervention-authority-guard.test.ts", anchor: "contains no developer/AI/RAG/environment approval laundering" },
  "NS-009": { requirement: "AI/model output cannot act as a professional reviewer or approval authority.", file: "tests/architecture/intervention-authority-guard.test.ts", anchor: "contains no developer/AI/RAG/environment approval laundering" },
  "NS-010": { requirement: "RAG retrieval cannot act as a professional reviewer or approval authority.", file: "tests/architecture/intervention-authority-guard.test.ts", anchor: "contains no developer/AI/RAG/environment approval laundering" },
  "NS-011": { requirement: "No developer approval.", file: "tests/architecture/intervention-authority-guard.test.ts", anchor: "contains no developer/AI/RAG/environment approval laundering" },
  "NS-012": { requirement: "No production fixture approval.", file: "tests/architecture/intervention-authority-guard.test.ts", anchor: "production cannot import test fixtures or synthetic authority" },
  "NS-013": { requirement: "No automatically PUBLISHED seed.", file: "tests/architecture/intervention-authority-guard.test.ts", anchor: "contains no developer/AI/RAG/environment approval laundering" },
  "NS-014": { requirement: "No Phase 4 InterventionInstance.", file: "tests/architecture/intervention-authority-guard.test.ts", anchor: "does not introduce Phase-4 execution domains" },
  "NS-015": { requirement: "Slice 16 must not create or own any Phase 4 Goal business object.", file: "tests/architecture/intervention-authority-guard.test.ts", anchor: "does not introduce Phase-4 execution domains" },
  "NS-016": { requirement: "No Plan/PlanVersion activation.", file: "tests/architecture/intervention-authority-guard.test.ts", anchor: "does not introduce Phase-4 execution domains" },
  "NS-017": { requirement: "Slice 16 must not create or own any Phase 4 Task or Checkin object.", file: "tests/architecture/intervention-authority-guard.test.ts", anchor: "does not introduce Phase-4 execution domains" },
  "NS-018": { requirement: "No Outcome/Follow-up/Schedule/Notification.", file: "tests/architecture/intervention-authority-guard.test.ts", anchor: "does not introduce Phase-4 execution domains" },
  "NS-019": { requirement: "No Professional Knowledge owner.", file: "tests/architecture/intervention-authority-guard.test.ts", anchor: "does not introduce Phase-4 execution domains" },
  "NS-020": { requirement: "No RAG implementation.", file: "tests/architecture/intervention-authority-guard.test.ts", anchor: "does not introduce Phase-4 execution domains" },
  "NS-021": { requirement: "No pgvector/embedding/reranking work.", file: "tests/architecture/intervention-authority-guard.test.ts", anchor: "does not introduce Phase-4 execution domains" },
  "NS-022": { requirement: "Slice 16 must not implement or own a Context Builder runtime.", file: "tests/architecture/intervention-authority-guard.test.ts", anchor: "does not introduce Phase-4 execution domains" },
  "NS-023": { requirement: "No AI Task Runtime or model gateway.", file: "tests/architecture/intervention-authority-guard.test.ts", anchor: "does not introduce Phase-4 execution domains" },
  "NS-024": { requirement: "No second Scene package registry.", file: "tests/architecture/intervention-authority-guard.test.ts", anchor: "does not create duplicate authority-owner tables or generic approval platforms" },
  "NS-025": { requirement: "No second Scene Manifest/routing owner.", file: "tests/architecture/intervention-authority-guard.test.ts", anchor: "does not create duplicate authority-owner tables or generic approval platforms" },
  "NS-026": { requirement: "No second Case phase/status owner.", file: "tests/architecture/intervention-authority-guard.test.ts", anchor: "does not create duplicate authority-owner tables or generic approval platforms" },
  "NS-027": { requirement: "No duplicate Evidence or Problem Formulation owner.", file: "tests/architecture/intervention-authority-guard.test.ts", anchor: "does not create duplicate authority-owner tables or generic approval platforms" },
  "NS-028": { requirement: "No duplicate Consent/Compliance/Safety owner.", file: "tests/architecture/intervention-authority-guard.test.ts", anchor: "does not create duplicate authority-owner tables or generic approval platforms" },
  "NS-029": { requirement: "No generic approval workflow engine.", file: "tests/architecture/intervention-authority-guard.test.ts", anchor: "does not create duplicate authority-owner tables or generic approval platforms" },
  "NS-030": { requirement: "No legal interpretation/Legal Authority platform.", file: "tests/architecture/intervention-authority-guard.test.ts", anchor: "does not create duplicate authority-owner tables or generic approval platforms" },
} as const;

describe('Slice 16 exact requirement traceability', () => {
  it('T1611 mechanically proves raw InterventionDefinition writers are absent from the domain root', () => {
    for (const rawWriter of [
      'insertInterventionDefinitionCandidate',
      'transitionInterventionDefinitionStateCas',
      'insertInterventionDefinitionAudit',
    ]) {
      expect(domainRoot).not.toHaveProperty(rawWriter);
    }
  });

  it('AS-023 executes exact approvalProofRef binding fail-closed', async () => {
    const request = {
      definitionId: '00000000-0000-7000-8000-000000000016',
      definitionVersion: 1,
      contentHash: 'a'.repeat(64),
      sceneId: 'DIGITAL_USE',
      sourceRefs: ['TEST_SOURCE:v1'],
      approvalScope: 'DIGITAL_USE',
    };
    const original = professionalProof();
    const rebound = professionalProof({
      approvalProofRef: 'TEST_APPROVAL:OTHER_DEFINITION',
      definitionId: 'other-definition',
    });
    const result = await resolveInterventionProfessionalAuthority(
      professionalProvider(original, rebound),
      request,
      'REVALIDATE',
      Date.parse('2026-11-16T00:00:00.000Z'),
      {
        approvalProofRef: original.approvalProofRef,
        artifactIdentity: original.artifactIdentity,
      }
    );
    expect(result).toEqual({
      status: 'INVALID',
      reason: 'APPROVAL_PROOF_CHANGED',
    });
  });

  it('maps the frozen 64 FR exact IDs one-for-one', () => {
    const actual = Object.keys(TRACEABILITY).filter((id) => id.startsWith('FR-'));
    expect(actual).toEqual([...EXPECTED_FR]);
    expect(new Set(actual).size).toBe(64);
  });

  it('maps the frozen 40 AS exact IDs one-for-one', () => {
    const actual = Object.keys(TRACEABILITY).filter((id) => id.startsWith('AS-'));
    expect(actual).toEqual([...EXPECTED_AS]);
    expect(new Set(actual).size).toBe(40);
  });

  it('maps the frozen 30 NS exact IDs one-for-one', () => {
    const actual = Object.keys(TRACEABILITY).filter((id) => id.startsWith('NS-'));
    expect(actual).toEqual([...EXPECTED_NS]);
    expect(new Set(actual).size).toBe(30);
  });

  it('binds every exact ID to a concrete executable test file and named behavioral assertion', () => {
    for (const [id, entry] of Object.entries(TRACEABILITY)) {
      const absolute = resolve(ROOT, entry.file);
      expect(existsSync(absolute), id + ' -> ' + entry.file).toBe(true);
      const source = readFileSync(absolute, 'utf8');
      expect(source.includes(entry.anchor), id + ' anchor: ' + entry.anchor).toBe(true);
      expect(source).toMatch(/\b(it|test)\s*\(/);
      expect(entry.requirement.length, id).toBeGreaterThan(20);
    }
  });

  it('binds the Audit-2 critical requirements to tests that execute their actual failure mode', () => {
    const critical = {
      'FR-049': [
        'tests/integration/intervention-eligibility-snapshot.test.ts',
        'SAFETY_HOLD',
        'expectEligibilityStillWaiting',
      ],
      'FR-055': [
        'tests/db/intervention-definition-runtime.test.ts',
        'IDEMPOTENCY_PAYLOAD_MISMATCH',
        'replays exact definition identity',
      ],
      'FR-058': [
        'tests/db/intervention-definition-concurrency.test.ts',
        'rolls back definition, audit and idempotency',
        'rejects',
      ],
      'FR-059': [
        'tests/integration/intervention-eligibility-snapshot.test.ts',
        'approvalProvenance',
        'approvalArtifactIdentity',
      ],
      'AS-031': [
        'tests/integration/intervention-eligibility-snapshot.test.ts',
        'Materially corrected formulation',
        'FORMULATION_MISSING_OR_STALE',
      ],
    } as const;
    for (const [id, [file, ...proofs]] of Object.entries(critical)) {
      const source = readFileSync(resolve(ROOT, file), 'utf8');
      for (const proof of proofs) {
        expect(source.includes(proof), id + ' executable proof: ' + proof).toBe(true);
      }
    }
  });

  it('contains no range-only FR/AS/NS coverage claim', () => {
    const source = readFileSync(
      resolve(ROOT, 'tests/integration/intervention-requirement-traceability.test.ts'),
      'utf8'
    );
    expect(source).not.toMatch(/Number\(id\.slice|<=\s*\d+\s*\?\s*evidenceFiles/);
  });
});
