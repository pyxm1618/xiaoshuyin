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
import { getFamilyById, isFamilyMember } from '@xiaoshuyin/domain';
import { getComplianceProfile } from '@xiaoshuyin/compliance';
import { toHttpError } from './plugins/error-handler.js';

export interface FamilyActionRequest {
  accountId: string;
  personId: string;
  familyId: string;
  action: Action;
  purpose: Purpose;
  resource: Resource;
  /** Verified guardian identity of the consent / request being acted on. */
  guardianPersonId?: string | null;
  /** Target person for MEMBER_UPDATE. */
  targetPersonId?: string | null;
}

async function readFacts(
  tx: pg.PoolClient,
  req: FamilyActionRequest
): Promise<AuthorizeFacts> {
  const needsAgeBand = req.action === 'GUARDIAN_CONSENT_REQUEST';

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
    case: null,
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
 * Single HTTP mapping for authorization denials (contract §3). Denial bodies
 * never contain target object fields.
 */
export function denyToError(reason: DenyReason): Error & { statusCode: number; code: string } {
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
    default:
      return Object.assign(new Error(reason), toHttpError('FORBIDDEN', reason));
  }
}