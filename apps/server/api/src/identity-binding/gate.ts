/**
 * App-layer binding Gate composition (plan D-8.1 / D-8.2).
 *
 * Reads the authoritative Slice 1 facts inside the current transaction and
 * calls `assertMinorProcessingAllowed`; the pure age / pre-gate matrix lives in
 * `@xiaoshuyin/domain` and never imports compliance. Gate 1 and Gate 2 use the
 * same composition; Gate 2 simply re-reads current values.
 */

import type pg from 'pg';
import {
  getFamilyById,
  getMembershipFamilyIds,
  getPersonById,
  lockBindingGateRows,
  evaluateBindingGate,
  type BindingAgeBand,
  type BindingGateInput,
  type BindingGateResult,
  type BindingInvitationResolution,
  type MinorGateResult,
} from '@xiaoshuyin/domain';
import {
  assertMinorProcessingAllowed,
  getComplianceProfileForGate,
  getConsentRecordForGate,
  getCurrentNoticeHash,
  type AgeBand,
  type ComplianceProfile,
  type ConsentRecord,
} from '@xiaoshuyin/compliance';
import type { AuthorizeFacts } from '@xiaoshuyin/authorization';
import { setBindingGateContext } from '../db/tx.js';

export interface BindingTargetFacts {
  personExists: boolean;
  targetAccountId: string | null;
  membershipFamilyIds: string[];
  targetFamilyId: string | null;
  familyCreatedByPersonId: string | null;
  ageBand: BindingAgeBand | null;
  guardianPersonId: string | null;
  minorGate: MinorGateResult;
}

function toComplianceProfile(row: any): ComplianceProfile | null {
  if (!row) return null;
  return {
    ageBand: row.age_band as AgeBand,
    minorMode: row.minor_mode,
    guardianPersonId: row.guardian_person_id ?? null,
    guardianConsentRecordId: row.guardian_consent_record_id ?? null,
    guardianConsentVersion: row.guardian_consent_version ?? null,
    verifiedSource: row.verified_source,
  };
}

function toConsentRecord(row: any): ConsentRecord | null {
  if (!row) return null;
  return {
    id: row.id,
    decision: row.decision,
    boundPersonId: row.bound_person_id ?? null,
    noticeHash: row.notice_hash,
    guardianPersonId: row.guardian_person_id,
  };
}

async function readMinorGate(
  tx: pg.PoolClient,
  targetPersonId: string
): Promise<{ profile: ComplianceProfile | null; gate: MinorGateResult }> {
  const rawProfile = await getComplianceProfileForGate(tx, targetPersonId);
  if (!rawProfile) {
    return { profile: null, gate: { decision: 'BLOCK', reason: 'PROFILE_MISSING' } };
  }
  const profile = toComplianceProfile(rawProfile)!;
  const rawConsent = profile.guardianConsentRecordId
    ? await getConsentRecordForGate(tx, profile.guardianConsentRecordId)
    : null;
  const consent = toConsentRecord(rawConsent);

  const result = assertMinorProcessingAllowed(targetPersonId, {
    getProfile: () => profile,
    getConsentRecord: (id) => (consent && consent.id === id ? consent : null),
    getCurrentNoticeHash: () => getCurrentNoticeHash(),
  });

  return {
    profile,
    gate:
      result.decision === 'ALLOW'
        ? { decision: 'ALLOW' }
        : { decision: 'BLOCK', reason: result.reason },
  };
}

/**
 * Read current P1 facts. `targetFamilyId` is only derived when P1 has exactly
 * one membership; multiple / zero memberships keep it null so the pure Gate
 * returns MULTI_FAMILY_BLOCK / COMPLIANCE_BLOCKED without picking a Family.
 */
export async function readBindingTargetFacts(
  tx: pg.PoolClient,
  targetPersonId: string
): Promise<BindingTargetFacts> {
  const person = await getPersonById(tx, targetPersonId);
  if (!person) {
    return {
      personExists: false,
      targetAccountId: null,
      membershipFamilyIds: [],
      targetFamilyId: null,
      familyCreatedByPersonId: null,
      ageBand: null,
      guardianPersonId: null,
      minorGate: { decision: 'NOT_APPLICABLE' },
    };
  }

  const membershipFamilyIds = await getMembershipFamilyIds(tx, targetPersonId);
  const targetFamilyId = membershipFamilyIds.length === 1 ? membershipFamilyIds[0]! : null;
  const family = targetFamilyId ? await getFamilyById(tx, targetFamilyId) : null;
  const { profile, gate } = await readMinorGate(tx, targetPersonId);

  return {
    personExists: true,
    targetAccountId: person.account_id,
    membershipFamilyIds,
    targetFamilyId,
    familyCreatedByPersonId: family?.created_by_person_id ?? null,
    ageBand: profile ? (profile.ageBand as BindingAgeBand) : null,
    guardianPersonId: profile?.guardianPersonId ?? null,
    minorGate: gate,
  };
}

export interface EvaluateGateOptions {
  stage: 'GATE_1' | 'GATE_2';
  targetPersonId: string;
  targetFamilyId: string;
  invitation: BindingInvitationResolution;
  candidateAccountId: string | null;
  candidateAccountBoundPersonId: string | null;
  confirmer: { accountId: string; personId: string } | null;
  attemptExpired?: boolean;
  confirmations?: { candidate: boolean; secondParty: boolean };
}

export async function evaluateGateForTarget(
  tx: pg.PoolClient,
  opts: EvaluateGateOptions
): Promise<{ facts: BindingTargetFacts; result: BindingGateResult }> {
  const facts = await readBindingTargetFacts(tx, opts.targetPersonId);

  const input: BindingGateInput = {
    stage: opts.stage,
    targetPersonId: facts.personExists ? opts.targetPersonId : null,
    // The Gate compares every current membership against the invitation's
    // target Family; never substitute a Family derived from membership.
    targetFamilyId: opts.targetFamilyId,
    targetAgeBand: facts.ageBand,
    guardianPersonId: facts.guardianPersonId,
    familyCreatedByPersonId: facts.familyCreatedByPersonId,
    membershipFamilyIds: facts.membershipFamilyIds,
    invitation: opts.invitation,
    candidateAccountId: opts.candidateAccountId,
    candidateAccountBoundPersonId: opts.candidateAccountBoundPersonId,
    targetAccountId: facts.targetAccountId,
    confirmer: opts.confirmer,
    minorGate: facts.minorGate,
    ...(opts.attemptExpired !== undefined
      ? { attemptExpired: opts.attemptExpired }
      : {}),
    ...(opts.confirmations ? { confirmations: opts.confirmations } : {}),
  };

  return { facts, result: evaluateBindingGate(input) };
}

/** Resolve P1's unique Family; multiple / zero memberships are not a target. */
export async function resolveTargetFamilyId(
  tx: pg.PoolClient,
  targetPersonId: string
): Promise<string | null> {
  const ids = await getMembershipFamilyIds(tx, targetPersonId);
  return ids.length === 1 ? ids[0]! : null;
}

/**
 * Establish the Gate 2 concurrency-safe consistency boundary (F-01).
 *
 * Gate 2 is evaluated from current authoritative facts. A fresh SELECT alone is
 * not enough: an invalidating change (consent revoke, guardian change,
 * membership change) that commits before the binding linearization point must
 * block the commit. Locking the authoritative rows in a fixed order forces such
 * changes to either commit before we read (and be observed by the Gate) or wait
 * until this transaction finishes (i.e. after the linearization point).
 *
 * Lock order (canonical, matches the executed SQL): persons → families →
 * family_members → person_compliance_profiles → consent_records. Callers must
 * hold the attempt/context locks first (D-6.1) and must not acquire these in a
 * different order.
 */
export async function lockBindingGateFacts(
  tx: pg.PoolClient,
  targetPersonId: string,
  targetFamilyId: string
): Promise<void> {
  await lockBindingGateRows(tx, targetPersonId, targetFamilyId);
}

/**
 * Authorization facts for the confirmer actions (plan D-12.2).
 *
 * The transaction starts with only the target Person GUC (membership read);
 * once the unique Family is known, the Family GUC is set so the additive
 * binding policies can read `families` / profile / consent.
 */
export async function readConfirmerFacts(
  tx: pg.PoolClient,
  targetPersonId: string,
  actorAccountId: string
): Promise<(AuthorizeFacts & {
  targetPersonId: string;
  targetFamilyId: string;
  targetAgeBand: BindingAgeBand;
  bindingGuardianPersonId: string | null;
  bindingFamilyCreatedByPersonId: string;
}) | null> {
  const person = await getPersonById(tx, targetPersonId);
  if (!person) return null;
  const targetFamilyId = await resolveTargetFamilyId(tx, targetPersonId);
  if (!targetFamilyId) return null;

  await setBindingGateContext(tx, {
    targetPersonId,
    targetFamilyId,
    actorAccountId,
  });

  const facts = await readBindingTargetFacts(tx, targetPersonId);
  if (!facts.targetFamilyId || !facts.ageBand || !facts.familyCreatedByPersonId) {
    return null;
  }
  return {
    membership: false,
    familyCreatedByPersonId: facts.familyCreatedByPersonId,
    actorAgeBand: null,
    guardianPersonId: facts.guardianPersonId,
    targetIsFamilyMember: true,
    familyId: facts.targetFamilyId,
    targetPersonId,
    targetFamilyId: facts.targetFamilyId,
    targetAgeBand: facts.ageBand,
    bindingGuardianPersonId: facts.guardianPersonId,
    bindingFamilyCreatedByPersonId: facts.familyCreatedByPersonId,
  };
}