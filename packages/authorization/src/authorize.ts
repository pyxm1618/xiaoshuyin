/**
 * Unified authorize() — pure, fail-closed decision function.
 *
 * Frozen contracts:
 *   - `Docs/V1技术设计.md` §9 (single authorization entry, "ID present ≠ access")
 *   - `specs/001-family-identity-core/contracts/authorization-and-rls.md` §2
 *   - `specs/001-family-identity-core/plan.md` D-2 / D-5.2
 *   - `specs/002-case-core/plan.md` D-6 (Case increment only)
 *
 * Two independent dimensions (FR-006):
 *   - Family membership  → `family_members(family_id, person_id)`
 *   - Guardian relationship → `person_compliance_profiles.guardian_person_id`
 * They are never merged and never inferred from one another.
 *
 * The function is pure: it receives already-verified facts that the caller
 * MUST read from the database inside the request transaction. Missing facts
 * are treated as "false" (deny), never as "assumed true". `basis.manager` is
 * computed here (`familyCreatedByPersonId === actor.personId`); downstream
 * code MUST NOT recompute it.
 */

export type Action =
  | 'IDENTITY_SELF_READ' | 'FAMILY_CREATE' | 'FAMILY_READ'
  | 'MEMBER_CREATE' | 'MEMBER_UPDATE'
  | 'GUARDIAN_CONSENT_REQUEST' | 'GUARDIAN_CONSENT_GRANT' | 'GUARDIAN_CONSENT_REVOKE'
  | 'MINOR_PROCESSING'
  | 'CASE_CREATE' | 'CASE_LIST' | 'CASE_READ' | 'CASE_SWITCH_PRIMARY'
  // Slice 006 identity binding (plan D-12). Registered closed set; every entry
  // is fail-closed when its actor / facts / resource do not match.
  | 'IDENTITY_BINDING_BOOTSTRAP'
  | 'IDENTITY_BINDING_CANDIDATE_DECIDE'
  | 'IDENTITY_BINDING_STATUS_SELF'
  | 'IDENTITY_BINDING_SESSION_EXCHANGE'
  | 'IDENTITY_BINDING_CONFIRMER_LIST'
  | 'IDENTITY_BINDING_SECOND_PARTY_DECIDE';

export type Purpose =
  | 'SELF_IDENTITY' | 'FAMILY_MANAGEMENT' | 'GUARDIAN_CONSENT'
  | 'IDENTITY_BINDING';

/**
 * Structured resource contract (authorization-and-rls.md §2.1).
 * Every identifier below arrives from the request and is therefore an
 * unverified parameter until the facts/decision prove otherwise.
 */
export type Resource =
  | { type: 'SELF'; personId: string }
  | { type: 'FAMILY'; familyId: string }
  | { type: 'MEMBER'; familyId: string; personId: string }
  | { type: 'CONSENT'; familyId: string; consentId?: string }
  | { type: 'CASE'; familyId: string; caseId: string }
  | { type: 'BINDING'; attemptId: string | null; personId: string | null };

export type AgeBandValue = 'ADULT' | 'MINOR_14_17' | 'UNDER_14' | 'UNKNOWN';

export type DenyReason =
  | 'NO_ACTOR' | 'UNSUPPORTED_DIMENSION' | 'UNSUPPORTED_ACTION' | 'UNSUPPORTED_PURPOSE'
  | 'FAMILY_CONTEXT_REQUIRED' | 'NOT_FAMILY_MEMBER' | 'NOT_FAMILY_MANAGER'
  | 'NOT_GUARDIAN' | 'AGE_BAND_UNKNOWN' | 'CASE_CONTEXT_REQUIRED' | 'AUTHORIZATION_ERROR'
  // Slice 006 binding-specific denials.
  | 'BINDING_CONTEXT_INVALID' | 'NOT_BINDING_AUTHORIZED_CONFIRMER'
  | 'BINDING_AGE_UNSUPPORTED' | 'BINDING_TARGET_INVALID';

export type Decision =
  | {
      decision: 'ALLOW';
      basis: {
        membership: boolean;
        manager: boolean;
        purpose: Purpose;
        authority?: 'GUARDIAN' | 'FAMILY_MANAGER' | null;
      };
    }
  | { decision: 'DENY'; reason: DenyReason };

/**
 * Facts that MUST be read from the database by the caller before deciding.
 * They are the verified inputs of the pure function — never caller opinions.
 */
export interface AuthorizeFacts {
  /** `family_members(familyId, actor.personId)` exists. */
  membership: boolean;
  // ── Slice 006 binding facts (all optional; absent = deny) ──
  targetPersonId?: string | null;
  targetFamilyId?: string | null;
  targetAgeBand?: AgeBandValue | null;
  /** Current guardian relationship of the target Person. */
  bindingGuardianPersonId?: string | null;
  /** Target family's `created_by_person_id`. */
  bindingFamilyCreatedByPersonId?: string | null;
  /** Real `families.created_by_person_id` for the target family. */
  familyCreatedByPersonId: string | null;
  /** Real `person_compliance_profiles.age_band` of the actor; null = no profile. */
  actorAgeBand: AgeBandValue | null;
  /** Real guardian identity of the consent / consent request being acted on. */
  guardianPersonId: string | null;
  /** Real membership of the targeted person in the target family. */
  targetIsFamilyMember: boolean;
  /**
   * Real `families.id` the facts were read from. Internal (not a frozen
   * contract) and used to prove that `FAMILY_CREATE` is deciding on the row
   * that was actually persisted in this transaction.
   */
  familyId?: string | null;
}

/**
 * Actor is a closed union in the Plan (ACCOUNT / BINDING_CONTEXT /
 * WECHAT_CANDIDATE). It is represented additively here so every Slice 1 caller
 * keeps passing `{ accountId, personId }` unchanged; `kind` defaults to
 * `ACCOUNT` when omitted.
 */
export interface AuthActor {
  kind?: 'ACCOUNT' | 'BINDING_CONTEXT' | 'WECHAT_CANDIDATE';
  accountId?: string;
  personId?: string;
  contextId?: string;
  candidateIdentityDigest?: string;
}

export interface AuthInput {
  actor: AuthActor;
  product: 'V1';
  family: { familyId: string } | null;
  case: { caseId: string } | null;
  resource: Resource;
  action: Action;
  purpose: Purpose;
  /** Required for every family-scoped action. Absent facts deny (fail-closed). */
  facts?: AuthorizeFacts;
}

const REGISTERED_ACTIONS: Action[] = [
  'IDENTITY_SELF_READ', 'FAMILY_CREATE', 'FAMILY_READ',
  'MEMBER_CREATE', 'MEMBER_UPDATE',
  'GUARDIAN_CONSENT_REQUEST', 'GUARDIAN_CONSENT_GRANT', 'GUARDIAN_CONSENT_REVOKE',
  'MINOR_PROCESSING',
  'CASE_CREATE', 'CASE_LIST', 'CASE_READ', 'CASE_SWITCH_PRIMARY',
  'IDENTITY_BINDING_BOOTSTRAP', 'IDENTITY_BINDING_CANDIDATE_DECIDE',
  'IDENTITY_BINDING_STATUS_SELF', 'IDENTITY_BINDING_SESSION_EXCHANGE',
  'IDENTITY_BINDING_CONFIRMER_LIST', 'IDENTITY_BINDING_SECOND_PARTY_DECIDE',
];

const REGISTERED_PURPOSES: Purpose[] = [
  'SELF_IDENTITY', 'FAMILY_MANAGEMENT', 'GUARDIAN_CONSENT', 'IDENTITY_BINDING',
];

const BINDING_ACTIONS: Action[] = [
  'IDENTITY_BINDING_BOOTSTRAP', 'IDENTITY_BINDING_CANDIDATE_DECIDE',
  'IDENTITY_BINDING_STATUS_SELF', 'IDENTITY_BINDING_SESSION_EXCHANGE',
  'IDENTITY_BINDING_CONFIRMER_LIST', 'IDENTITY_BINDING_SECOND_PARTY_DECIDE',
];

/** Actions that only make sense inside a resolved Family scope. */
const FAMILY_ACTIONS: Action[] = [
  'FAMILY_READ', 'MEMBER_CREATE', 'MEMBER_UPDATE',
  'GUARDIAN_CONSENT_REQUEST', 'GUARDIAN_CONSENT_GRANT', 'GUARDIAN_CONSENT_REVOKE',
];

/** Actions that additionally require `families.created_by_person_id === actor`. */
const MANAGER_ACTIONS: Action[] = [
  'MEMBER_CREATE', 'MEMBER_UPDATE', 'GUARDIAN_CONSENT_REQUEST',
];

/** Case actions (Slice 2 increment, plan D-6.2). */
const CASE_ACTIONS: Action[] = ['CASE_CREATE', 'CASE_LIST', 'CASE_READ', 'CASE_SWITCH_PRIMARY'];

const EMPTY_FACTS: AuthorizeFacts = {
  membership: false,
  familyCreatedByPersonId: null,
  actorAgeBand: null,
  guardianPersonId: null,
  targetIsFamilyMember: false,
  familyId: null,
};

export interface FamilyInfo {
  id: string;
  createdByPersonId: string;
}

/** Pure management predicate (plan.md D-2) — never reads family_members. */
export function isFamilyManager(family: FamilyInfo, actorPersonId: string): boolean {
  return family.createdByPersonId === actorPersonId;
}

function allow(
  manager: boolean,
  purpose: Purpose,
  membership = true,
  authority?: 'GUARDIAN' | 'FAMILY_MANAGER' | null
): Decision {
  return {
    decision: 'ALLOW',
    basis: { membership, manager, purpose, ...(authority !== undefined ? { authority } : {}) },
  };
}

function deny(reason: DenyReason): Decision {
  return { decision: 'DENY', reason };
}

/**
 * Resource identifiers are request-supplied and therefore untrusted: a
 * mismatch against the resolved family scope is a denial, not a new context.
 */
function familyResourceMatches(
  input: AuthInput,
  target: 'FAMILY' | 'MEMBER' | 'CONSENT'
): boolean {
  if (input.family === null) return false;
  if (input.resource.type !== target) return false;
  return input.resource.familyId === input.family.familyId;
}

/**
 * Binding actions are a separate Gate (plan D-12). They never use Family
 * membership as authority; candidate actions are context-scoped, confirmer
 * actions use the frozen age matrix and the target Family's creator / current
 * guardian. Missing facts deny.
 */
function decideBindingAction(input: AuthInput, facts: AuthorizeFacts): Decision {
  if (input.purpose !== 'IDENTITY_BINDING') return deny('UNSUPPORTED_PURPOSE');
  if (input.resource.type !== 'BINDING') return deny('BINDING_TARGET_INVALID');

  const actor = input.actor;
  const kind = actor.kind ?? 'ACCOUNT';

  switch (input.action) {
    case 'IDENTITY_BINDING_BOOTSTRAP': {
      if (kind !== 'WECHAT_CANDIDATE' || !actor.candidateIdentityDigest) {
        return deny('NO_ACTOR');
      }
      return allow(false, input.purpose, false, null);
    }

    case 'IDENTITY_BINDING_CANDIDATE_DECIDE':
    case 'IDENTITY_BINDING_STATUS_SELF':
    case 'IDENTITY_BINDING_SESSION_EXCHANGE': {
      if (kind !== 'BINDING_CONTEXT' || !actor.contextId) {
        return deny('BINDING_CONTEXT_INVALID');
      }
      if (!actor.candidateIdentityDigest) return deny('BINDING_CONTEXT_INVALID');
      return allow(false, input.purpose, false, null);
    }

    case 'IDENTITY_BINDING_CONFIRMER_LIST':
    case 'IDENTITY_BINDING_SECOND_PARTY_DECIDE': {
      if (kind !== 'ACCOUNT' || !actor.accountId || !actor.personId) {
        return deny('NO_ACTOR');
      }
      if (
        !facts.targetPersonId ||
        !facts.targetFamilyId ||
        !facts.targetAgeBand ||
        !facts.bindingFamilyCreatedByPersonId ||
        !facts.targetIsFamilyMember
      ) {
        return deny('BINDING_TARGET_INVALID');
      }
      if (
        input.action === 'IDENTITY_BINDING_SECOND_PARTY_DECIDE' &&
        (!input.resource.attemptId || !input.resource.personId)
      ) {
        return deny('BINDING_TARGET_INVALID');
      }
      if (input.resource.personId && input.resource.personId !== facts.targetPersonId) {
        return deny('BINDING_TARGET_INVALID');
      }

      const ageBand = facts.targetAgeBand;
      if (ageBand === 'ADULT' || ageBand === 'UNKNOWN') {
        return deny('BINDING_AGE_UNSUPPORTED');
      }

      if (ageBand === 'UNDER_14') {
        if (!facts.bindingGuardianPersonId) return deny('BINDING_TARGET_INVALID');
        if (actor.personId !== facts.bindingGuardianPersonId) {
          return deny('NOT_BINDING_AUTHORIZED_CONFIRMER');
        }
        return allow(false, input.purpose, false, 'GUARDIAN');
      }

      // MINOR_14_17
      if (facts.bindingGuardianPersonId) {
        if (actor.personId !== facts.bindingGuardianPersonId) {
          return deny('NOT_BINDING_AUTHORIZED_CONFIRMER');
        }
        return allow(false, input.purpose, false, 'GUARDIAN');
      }
      if (actor.personId !== facts.bindingFamilyCreatedByPersonId) {
        return deny('NOT_BINDING_AUTHORIZED_CONFIRMER');
      }
      return allow(false, input.purpose, false, 'FAMILY_MANAGER');
    }

    default:
      return deny('UNSUPPORTED_ACTION');
  }
}

/**
 * Case actions reuse FAMILY_MANAGEMENT and the verified manager fact; there is
 * no separate Case role. Collection actions carry no case dimension while the
 * detail action requires one and its resource id must match (id present ≠
 * access).
 */
function decideCaseAction(
  input: AuthInput,
  facts: AuthorizeFacts,
  actorPersonId: string
): Decision {
  // a. Family context is mandatory for every Case action.
  if (input.family === null) return deny('FAMILY_CONTEXT_REQUIRED');

  // b. Case management reuses FAMILY_MANAGEMENT; no new Purpose enum.
  if (input.purpose !== 'FAMILY_MANAGEMENT') return deny('UNSUPPORTED_PURPOSE');

  // c. Membership is a verified fact; RLS visibility is not authorization.
  if (!facts.membership) return deny('NOT_FAMILY_MEMBER');

  // d. Management subject = the Person who created the target Family.
  const manager = facts.familyCreatedByPersonId === actorPersonId;
  if (!manager) return deny('NOT_FAMILY_MANAGER');

  // e. Collection-level actions carry no case dimension.
  if (input.action === 'CASE_CREATE' || input.action === 'CASE_LIST') {
    if (input.case !== null) return deny('UNSUPPORTED_DIMENSION');
    if (input.resource.type !== 'FAMILY') return deny('NOT_FAMILY_MEMBER');
    if (input.resource.familyId !== input.family.familyId) {
      return deny('NOT_FAMILY_MEMBER');
    }
    return allow(true, input.purpose);
  }

  // f. Detail action requires a case dimension.
  if (input.case === null) return deny('CASE_CONTEXT_REQUIRED');
  if (input.resource.type !== 'CASE') return deny('NOT_FAMILY_MEMBER');
  if (input.resource.familyId !== input.family.familyId) {
    return deny('NOT_FAMILY_MEMBER');
  }
  if (input.resource.caseId !== input.case.caseId) return deny('NOT_FAMILY_MEMBER');

  return allow(true, input.purpose);
}

export function authorize(input: AuthInput): Decision {
  try {
    // 1. Closed registries.
    if (!REGISTERED_ACTIONS.includes(input.action)) return deny('UNSUPPORTED_ACTION');
    if (!REGISTERED_PURPOSES.includes(input.purpose)) return deny('UNSUPPORTED_PURPOSE');

    const facts = input.facts ?? EMPTY_FACTS;

    // 2. Binding actions have their own actor kinds (candidate context has no
    //    Account / Person). They are decided before the Account actor check.
    if (BINDING_ACTIONS.includes(input.action)) {
      return decideBindingAction(input, facts);
    }

    // 3. No authenticated Account actor → nothing else can be authorized.
    if (!input.actor?.accountId || !input.actor?.personId) return deny('NO_ACTOR');

    const actorPersonId = input.actor.personId;

    // 4. Case actions: dedicated branch (D-6.2); Case increment only.
    if (CASE_ACTIONS.includes(input.action)) {
      return decideCaseAction(input, facts, actorPersonId);
    }

    // 5. Non-Case actions keep Slice 1 fail-closed behavior on the case dimension.
    if (input.case !== null) return deny('UNSUPPORTED_DIMENSION');

    // 6. Family-scoped actions require an explicit family context.
    if (FAMILY_ACTIONS.includes(input.action) && input.family === null) {
      return deny('FAMILY_CONTEXT_REQUIRED');
    }

    // Real, instantaneous manager computation — never assumed, never stored.
    const manager = facts.familyCreatedByPersonId === actorPersonId;

    switch (input.action) {
      case 'IDENTITY_SELF_READ': {
        if (input.resource.type !== 'SELF') return deny('NOT_FAMILY_MEMBER');
        if (input.resource.personId !== actorPersonId) return deny('NOT_FAMILY_MEMBER');
        return allow(false, input.purpose);
      }

      case 'FAMILY_CREATE': {
        // The new family's `created_by_person_id` is written from actor.personId
        // by the creation command; the caller passes that persisted fact back.
        // Anything other than "the row says this actor" is a denial.
        //
        // Resource hardening: the request-supplied family id must equal the
        // real row that was just persisted, and the real row id must be the
        // one the facts were read from (id present ≠ access).
        if (input.resource.type !== 'FAMILY') return deny('NOT_FAMILY_MEMBER');
        if (facts.familyId === null || facts.familyId === undefined) return deny('NOT_FAMILY_MEMBER');
        if (facts.familyId !== input.resource.familyId) return deny('NOT_FAMILY_MEMBER');
        if (facts.familyCreatedByPersonId === null) return deny('NOT_FAMILY_MANAGER');
        if (facts.familyCreatedByPersonId !== actorPersonId) return deny('NOT_FAMILY_MANAGER');
        return allow(true, input.purpose);
      }

      case 'FAMILY_READ': {
        if (!familyResourceMatches(input, 'FAMILY')) return deny('NOT_FAMILY_MEMBER');
        if (!facts.membership) return deny('NOT_FAMILY_MEMBER');
        return allow(manager, input.purpose);
      }

      case 'MEMBER_CREATE': {
        if (!familyResourceMatches(input, 'FAMILY')) return deny('NOT_FAMILY_MEMBER');
        if (!facts.membership) return deny('NOT_FAMILY_MEMBER');
        if (!manager) return deny('NOT_FAMILY_MANAGER');
        return allow(true, input.purpose);
      }

      case 'MEMBER_UPDATE': {
        if (!familyResourceMatches(input, 'MEMBER')) return deny('NOT_FAMILY_MEMBER');
        if (!facts.membership) return deny('NOT_FAMILY_MEMBER');
        if (!manager) return deny('NOT_FAMILY_MANAGER');
        // Target person must really belong to this family.
        if (!facts.targetIsFamilyMember) return deny('NOT_FAMILY_MEMBER');
        return allow(true, input.purpose);
      }

      case 'GUARDIAN_CONSENT_REQUEST': {
        // Frozen action table (§2.3): membership + manager + actor ADULT.
        // UNKNOWN / MINOR_14_17 / UNDER_14 / missing profile NEVER pass.
        if (!familyResourceMatches(input, 'FAMILY')) return deny('NOT_FAMILY_MEMBER');
        if (!facts.membership) return deny('NOT_FAMILY_MEMBER');
        if (!manager) return deny('NOT_FAMILY_MANAGER');
        if (facts.actorAgeBand !== 'ADULT') return deny('AGE_BAND_UNKNOWN');
        return allow(true, input.purpose);
      }

      case 'GUARDIAN_CONSENT_GRANT':
      case 'GUARDIAN_CONSENT_REVOKE': {
        if (!familyResourceMatches(input, 'CONSENT')) return deny('NOT_FAMILY_MEMBER');
        if (!facts.membership) return deny('NOT_FAMILY_MEMBER');
        // Guardian authority is a separate dimension: membership and manager
        // status must never be promoted to guardian authority.
        if (facts.guardianPersonId === null) return deny('NOT_GUARDIAN');
        if (facts.guardianPersonId !== actorPersonId) return deny('NOT_GUARDIAN');
        return allow(manager, input.purpose);
      }

      case 'MINOR_PROCESSING': {
        // No family requirement of its own: the processing gate
        // (`assertMinorProcessingAllowed`, consent-onboarding.md §7) decides.
        return allow(false, input.purpose);
      }

      default:
        return deny('UNSUPPORTED_ACTION');
    }
  } catch {
    return deny('AUTHORIZATION_ERROR');
  }
}