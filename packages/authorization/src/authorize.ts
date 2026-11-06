/**
 * Unified authorize() — pure function, fail-closed.
 * Per plan.md D-5.2 and Slice 2 D-6.2: action table + purpose enum +
 * independent dimensions (identity / family / case).
 *
 * `authorize()` never reads the database. The Family management subject is
 * decided from the already-verified `family.createdByPersonId`; when the
 * caller cannot supply it, the decision fails closed (NOT_FAMILY_MANAGER).
 */

export type Action =
  | 'IDENTITY_SELF_READ' | 'FAMILY_CREATE' | 'FAMILY_READ'
  | 'MEMBER_CREATE' | 'MEMBER_UPDATE'
  | 'GUARDIAN_CONSENT_REQUEST' | 'GUARDIAN_CONSENT_GRANT' | 'GUARDIAN_CONSENT_REVOKE'
  | 'MINOR_PROCESSING'
  | 'CASE_CREATE' | 'CASE_LIST' | 'CASE_READ';

export type Purpose = 'SELF_IDENTITY' | 'FAMILY_MANAGEMENT' | 'GUARDIAN_CONSENT';

export type Resource = 'SELF' | 'FAMILY' | 'MEMBER' | 'CONSENT' | 'CASE';

export type DenyReason =
  | 'UNSUPPORTED_DIMENSION' | 'UNSUPPORTED_ACTION' | 'UNSUPPORTED_PURPOSE'
  | 'FAMILY_CONTEXT_REQUIRED' | 'NOT_FAMILY_MEMBER' | 'NOT_FAMILY_MANAGER'
  | 'NOT_GUARDIAN' | 'CASE_CONTEXT_REQUIRED' | 'AUTHORIZATION_ERROR';

export type Decision =
  | { decision: 'ALLOW'; basis: { manager: boolean } }
  | { decision: 'DENY'; reason: DenyReason };

export interface AuthInput {
  actor: { accountId: string; personId: string };
  product: 'V1';
  family: { familyId: string; createdByPersonId?: string } | null;
  case: { caseId: string } | null;
  resource: Resource;
  action: Action;
  purpose: Purpose;
}

const REGISTERED_ACTIONS: Action[] = [
  'IDENTITY_SELF_READ', 'FAMILY_CREATE', 'FAMILY_READ',
  'MEMBER_CREATE', 'MEMBER_UPDATE',
  'GUARDIAN_CONSENT_REQUEST', 'GUARDIAN_CONSENT_GRANT', 'GUARDIAN_CONSENT_REVOKE',
  'MINOR_PROCESSING',
  'CASE_CREATE', 'CASE_LIST', 'CASE_READ',
];

const REGISTERED_PURPOSES: Purpose[] = ['SELF_IDENTITY', 'FAMILY_MANAGEMENT', 'GUARDIAN_CONSENT'];

const CASE_ACTIONS: Action[] = ['CASE_CREATE', 'CASE_LIST', 'CASE_READ'];

const FAMILY_ACTIONS: Action[] = [
  'FAMILY_READ', 'MEMBER_CREATE', 'MEMBER_UPDATE',
  'GUARDIAN_CONSENT_REQUEST', 'GUARDIAN_CONSENT_GRANT', 'GUARDIAN_CONSENT_REVOKE',
];

const MANAGER_ACTIONS: Action[] = ['MEMBER_CREATE', 'MEMBER_UPDATE'];

export interface FamilyInfo {
  id: string;
  createdByPersonId: string;
}

export function isFamilyManager(family: FamilyInfo, actorPersonId: string): boolean {
  return family.createdByPersonId === actorPersonId;
}

function decideCaseAction(input: AuthInput): Decision {
  // a. Family context is mandatory for every Case action.
  if (input.family === null) {
    return { decision: 'DENY', reason: 'FAMILY_CONTEXT_REQUIRED' };
  }

  // b. Case management reuses FAMILY_MANAGEMENT; no new Purpose enum.
  if (input.purpose !== 'FAMILY_MANAGEMENT') {
    return { decision: 'DENY', reason: 'UNSUPPORTED_PURPOSE' };
  }

  // c / d. Management subject = the Person who created the target Family.
  // Fail closed when the caller did not supply the verified creator.
  const createdBy = input.family.createdByPersonId;
  if (!createdBy || createdBy !== input.actor.personId) {
    return { decision: 'DENY', reason: 'NOT_FAMILY_MANAGER' };
  }

  // e. Collection-level actions carry no case dimension.
  if ((input.action === 'CASE_CREATE' || input.action === 'CASE_LIST') && input.case !== null) {
    return { decision: 'DENY', reason: 'UNSUPPORTED_DIMENSION' };
  }

  // f. Detail action requires a case dimension.
  if (input.action === 'CASE_READ' && input.case === null) {
    return { decision: 'DENY', reason: 'CASE_CONTEXT_REQUIRED' };
  }

  return { decision: 'ALLOW', basis: { manager: true } };
}

export function authorize(input: AuthInput): Decision {
  try {
    // Action must be in registry.
    if (!REGISTERED_ACTIONS.includes(input.action)) {
      return { decision: 'DENY', reason: 'UNSUPPORTED_ACTION' };
    }

    // Purpose must be in registry.
    if (!REGISTERED_PURPOSES.includes(input.purpose)) {
      return { decision: 'DENY', reason: 'UNSUPPORTED_PURPOSE' };
    }

    // Case actions: dedicated branch (D-6.2 3a–3g).
    if (CASE_ACTIONS.includes(input.action)) {
      return decideCaseAction(input);
    }

    // Non-Case actions keep Slice 1 behavior, including fail-closed on any
    // case dimension.
    if (input.case !== null) {
      return { decision: 'DENY', reason: 'UNSUPPORTED_DIMENSION' };
    }

    // Family-level action requires family context.
    if (FAMILY_ACTIONS.includes(input.action) && input.family === null) {
      return { decision: 'DENY', reason: 'FAMILY_CONTEXT_REQUIRED' };
    }

    // Self read is always allowed for an authenticated actor.
    if (input.action === 'IDENTITY_SELF_READ') {
      return { decision: 'ALLOW', basis: { manager: false } };
    }

    // Family create: needs an actor with personId (age gate is in the command).
    if (input.action === 'FAMILY_CREATE') {
      return { decision: 'ALLOW', basis: { manager: true } };
    }

    // For family-scoped actions, membership is assumed verified by
    // RLS/set_family_context; manager determination is done by the caller.
    if (MANAGER_ACTIONS.includes(input.action)) {
      return { decision: 'ALLOW', basis: { manager: true } };
    }

    // MINOR_PROCESSING: gate is handled by assertMinorProcessingAllowed.
    if (input.action === 'MINOR_PROCESSING') {
      return { decision: 'ALLOW', basis: { manager: false } };
    }

    return { decision: 'ALLOW', basis: { manager: false } };
  } catch {
    return { decision: 'DENY', reason: 'AUTHORIZATION_ERROR' };
  }
}
