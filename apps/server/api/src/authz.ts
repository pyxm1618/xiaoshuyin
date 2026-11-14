/**
 * Route-level adapter for the single authorization entry point.
 *
 * Contracts:
 *   - `Docs/V1技术设计.md` §9: every family-scoped read/write calls `authorize()`.
 *   - `contracts/authorization-and-rls.md` §2: identifiers supplied by the
 *     request are unverified parameters; membership / manager / guardian /
 *     age-band must be read from the database in the same transaction.
 *
 * RLS (`set_family_context`) remains the second, independent line of defense.
 * It is never used as a substitute for the business authorization decision.
 */

import type pg from 'pg';
import {
  authorize,
  type Action,
  type AuthorizeFacts,
  type Decision,
  type DenyReason,
  type Purpose,
  type Resource,
} from '@xiaoshuyin/authorization';
import { getFamilyById, isFamilyMember, type ParticipationRow, type PhoneUseContractVersionRow } from '@xiaoshuyin/domain';
import { getComplianceProfile } from '@xiaoshuyin/compliance';
import { toHttpError } from './plugins/error-handler.js';

export interface FamilyActionRequest {
  accountId: string;
  personId: string;
  familyId: string;
  action: Action;
  purpose: Purpose;
  resource: Resource;
  /** Present only for CASE_READ; the Case increment (plan D-6). */
  caseId?: string;
  /** Verified participation row resolved in this same transaction. */
  participation?: { personId: string; state: 'PENDING' | 'ACTIVE' | 'DECLINED' | 'EXPIRED' | 'WITHDRAWN' } | null;
  /** Verified guardian identity of the consent / request being acted on. */
  guardianPersonId?: string | null;
  /** Target person for MEMBER_UPDATE. */
  targetPersonId?: string | null;
  /**
   * Slice 9: separately verified Safety-resolution capability fact, supplied by
   * the composition's SafetyResolutionAuthoritySource. Absent means NO
   * capability — family roles never imply it.
   */
  safetyResolution?: { verified: boolean; authorityRef: string } | null;
}

async function readFacts(
  tx: pg.PoolClient,
  req: FamilyActionRequest
): Promise<AuthorizeFacts> {
  const needsAgeBand =
    req.action === 'GUARDIAN_CONSENT_REQUEST' || req.action === 'GUARDIAN_CONSENT_GRANT';

  const family = await getFamilyById(tx, req.familyId);
  const membership = await isFamilyMember(tx, req.familyId, req.personId);
  const profile = needsAgeBand ? await getComplianceProfile(tx, req.personId) : null;
  const targetIsFamilyMember =
    req.action === 'MEMBER_UPDATE' && req.targetPersonId
      ? await isFamilyMember(tx, req.familyId, req.targetPersonId)
      : false;

  return {
    membership,
    familyCreatedByPersonId: family?.created_by_person_id ?? null,
    actorAgeBand: profile ? (profile.age_band as AuthorizeFacts['actorAgeBand']) : null,
    guardianPersonId: req.guardianPersonId ?? null,
    targetIsFamilyMember,
    familyId: family ? req.familyId : null,
    safetyResolution: req.safetyResolution ?? null,
  };
}

export async function decideFamilyAction(
  tx: pg.PoolClient,
  req: FamilyActionRequest
): Promise<Decision> {
  const facts = await readFacts(tx, req);
  return authorize({
    actor: { accountId: req.accountId, personId: req.personId },
    product: 'V1',
    family: { familyId: req.familyId },
    // Case increment: a present caseId is the only way to add the case
    // dimension; collection-level Case actions stay `case: null`.
    case: req.caseId ? { caseId: req.caseId } : null,
    participation: req.participation ?? null,
    resource: req.resource,
    action: req.action,
    purpose: req.purpose,
    facts,
  });
}

export async function requireFamilyAction(
  tx: pg.PoolClient,
  req: FamilyActionRequest
): Promise<Extract<Decision, { decision: 'ALLOW' }>> {
  const decision = await decideFamilyAction(tx, req);
  if (decision.decision === 'DENY') throw denyToError(decision.reason);
  return decision;
}

/**
 * Identity-scoped decisions (`/me`, `/compliance/profile`) do not need family
 * facts; they still go through the same `authorize()` entry point.
 */
export function requireSelfAction(
  accountId: string,
  personId: string,
  purpose: Purpose
): void {
  const decision = authorize({
    actor: { accountId, personId },
    product: 'V1',
    family: null,
    case: null,
    resource: { type: 'SELF', personId },
    action: 'IDENTITY_SELF_READ',
    purpose,
  });
  if (decision.decision === 'DENY') throw denyToError(decision.reason);
}

/**
 * Marker for a *known authorization denial* produced by `denyToError()`.
 *
 * ULT-002: routes use this to distinguish an explicit business denial (which an
 * anti-enumeration route may collapse into 404) from an unknown infrastructure
 * failure (PostgreSQL `57014` statement timeout, connection loss, unexpected
 * error), which MUST propagate and reach the global 500 INTERNAL_ERROR handler.
 */
const AUTHORIZATION_DENIAL = Symbol.for('xiaoshuyin.authorizationDenial');

export function isKnownAuthorizationDenial(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as Record<symbol, unknown>)[AUTHORIZATION_DENIAL] === true
  );
}

/**
 * Single HTTP mapping for authorization denials (contract §3). Denial bodies
 * never contain target object fields.
 *
 * `NO_ACTOR` maps to 401 UNAUTHENTICATED and is NOT marked as an
 * authorization denial: authentication failures keep the existing
 * authentication path and are never collapsed into an anti-enumeration 404.
 */
export function denyToError(reason: DenyReason): Error & { statusCode: number; code: string } {
  const error = (() => {
    switch (reason) {
      case 'NO_ACTOR':
        return Object.assign(new Error('UNAUTHENTICATED'), toHttpError('UNAUTHENTICATED'));
      case 'NOT_FAMILY_MEMBER':
        return Object.assign(new Error('NOT_FAMILY_MEMBER'), toHttpError('NOT_FAMILY_MEMBER'));
      case 'NOT_FAMILY_MANAGER':
        return Object.assign(new Error('NOT_FAMILY_MANAGER'), toHttpError('NOT_FAMILY_MANAGER'));
      case 'NOT_GUARDIAN':
        return Object.assign(new Error('NOT_GUARDIAN'), toHttpError('NOT_GUARDIAN'));
      case 'AGE_BAND_UNKNOWN':
        return Object.assign(new Error('AGE_BAND_UNKNOWN'), toHttpError('AGE_BAND_UNKNOWN'));
      case 'NOT_SAFETY_RESOLVER':
        // Slice 9: no separately verified Safety-resolution capability. This is
        // a business denial with a stable, non-leaking code.
        return Object.assign(
          new Error('SAFETY_RESOLUTION_AUTHORITY_DENIED'),
          toHttpError('SAFETY_RESOLUTION_AUTHORITY_DENIED')
        );
      default:
        return Object.assign(new Error(reason), toHttpError('FORBIDDEN', reason));
    }
  })();

  if (reason !== 'NO_ACTOR') {
    Object.defineProperty(error, AUTHORIZATION_DENIAL, {
      value: true,
      enumerable: false,
      configurable: true,
    });
  }

  return error;
}

/**
 * Slice 14 narrow adapter into the Authorization owner's
 * PHONE_USE_CONTRACT_CONFIRM_SELF action.
 *
 * Every fact comes from authoritative rows already read/locked by the caller
 * in this transaction. This function intentionally contains no local ALLOW
 * rule and cannot authorize adult/guardian proxy confirmation.
 */
export async function requirePhoneUseContractChildConfirmation(
  tx: pg.PoolClient,
  input: {
    accountId: string;
    personId: string;
    familyId: string;
    caseId: string;
    contract: Pick<
      PhoneUseContractVersionRow,
      'id' | 'family_id' | 'case_id' | 'child_party_person_id' | 'child_participation_id'
    >;
    participation: Pick<
      ParticipationRow,
      'id' | 'family_id' | 'case_id' | 'person_id' | 'state'
    >;
  }
): Promise<Extract<Decision, { decision: 'ALLOW' }>> {
  const [family, membership] = await Promise.all([
    getFamilyById(tx, input.familyId),
    isFamilyMember(tx, input.familyId, input.personId),
  ]);

  const decision = authorize({
    actor: { kind: 'ACCOUNT', accountId: input.accountId, personId: input.personId },
    product: 'V1',
    family: { familyId: input.familyId },
    case: { caseId: input.caseId },
    participation: {
      participationId: input.participation.id,
      familyId: input.participation.family_id,
      caseId: input.participation.case_id,
      personId: input.participation.person_id,
      state: input.participation.state,
    },
    resource: {
      type: 'PHONE_USE_CONTRACT_VERSION',
      familyId: input.familyId,
      caseId: input.caseId,
      contractVersionId: input.contract.id,
      partyPersonId: input.contract.child_party_person_id,
      partyRole: 'CHILD',
    },
    action: 'PHONE_USE_CONTRACT_CONFIRM_SELF',
    purpose: 'PHONE_USE_CONTRACT',
    facts: {
      membership,
      familyCreatedByPersonId: family?.created_by_person_id ?? null,
      actorAgeBand: null,
      guardianPersonId: null,
      targetIsFamilyMember: false,
      familyId: family ? input.familyId : null,
      phoneUseContractConfirmation: {
        contractVersionId: input.contract.id,
        contractFamilyId: input.contract.family_id,
        contractCaseId: input.contract.case_id,
        contractPartyPersonId: input.contract.child_party_person_id,
        contractPartyRole: 'CHILD',
        participationId: input.contract.child_participation_id,
        participationFamilyId: input.participation.family_id,
        participationCaseId: input.participation.case_id,
        participationPersonId: input.participation.person_id,
        participationState: input.participation.state,
      },
    },
  });
  if (decision.decision === 'DENY') throw denyToError(decision.reason);
  return decision;
}
