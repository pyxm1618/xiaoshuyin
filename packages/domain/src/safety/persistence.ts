/**
 * Slice 9 — Safety persistence (plan §13, tasks T905).
 *
 * Three distinct artifacts, three distinct responsibilities:
 *
 *   `risk_events`            Safety trace: policy/rule/category identity,
 *                            decision Case revision, evidence references,
 *                            resolution link + verified authority reference.
 *   `case_events`            Case lifecycle transition: state/version pair and
 *                            the risk trace id only.
 *   `business_audit_events`  Cross-resource audit: actor/action/version and the
 *                            risk trace id (plus the resolver authority
 *                            reference only for a resolution).
 *
 * `risk_events` is append-only: this module exposes INSERT/SELECT reads only and
 * deliberately declares no UPDATE or DELETE primitive.
 */

import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import {
  businessAuditEvents,
  caseEvents,
  riskEvents,
  type RiskEventKind,
} from './schema.js';
import type {
  ApprovedPolicyIdentity,
  OpaqueEvidenceReference,
  SafetyCaseStatus,
} from './precheck.js';

/**
 * Structural Drizzle write context. Both the top-level database handle and a
 * Drizzle-owned transaction satisfy it; persistence never opens its own
 * transaction.
 */
type SafetySchemaTables = typeof import('./schema.js');
export type SafetyDb = NodePgDatabase<SafetySchemaTables>;
export type SafetyWriteTx = Pick<SafetyDb, 'insert' | 'select' | 'update' | 'execute'>;

export interface HoldEnteredRiskEventInput {
  familyId: string;
  caseId: string;
  actorAccountId: string;
  decisionCaseVersion: number;
  identity: ApprovedPolicyIdentity;
  riskCategoryRef: string;
  evidenceRefs: OpaqueEvidenceReference[];
}

export interface RiskResolvedRiskEventInput {
  familyId: string;
  caseId: string;
  actorAccountId: string;
  decisionCaseVersion: number;
  resolutionOfRiskEventId: string;
  evidenceRefs: OpaqueEvidenceReference[];
  resolutionAuthorityRef: string;
}

export interface SafetyCaseEventInput {
  familyId: string;
  caseId: string;
  actorAccountId: string;
  eventType: 'CASE_SAFETY_HOLD_ENTERED' | 'CASE_RISK_RESOLVED';
  fromStatus: SafetyCaseStatus;
  toStatus: SafetyCaseStatus;
  fromVersion: number;
  toVersion: number;
  riskEventId: string;
}

export interface SafetyAuditEventInput {
  familyId: string;
  caseId: string;
  actorAccountId: string;
  eventType: 'CASE_SAFETY_HOLD_ENTERED' | 'CASE_RISK_RESOLVED';
  riskEventId: string;
  fromVersion: number;
  toVersion: number;
  /** Present only for a successful resolution. */
  resolutionAuthorityRef?: string;
}

/** Exact `case_events.metadata` shape for the two Safety events. */
export function buildSafetyCaseEventMetadata(input: Omit<SafetyCaseEventInput, 'familyId' | 'caseId' | 'actorAccountId' | 'eventType'>) {
  return {
    fromStatus: input.fromStatus,
    toStatus: input.toStatus,
    fromVersion: input.fromVersion,
    toVersion: input.toVersion,
    riskEventId: input.riskEventId,
  };
}

/** Exact `business_audit_events.metadata` shape for the two Safety actions. */
export function buildSafetyAuditMetadata(
  input: Omit<SafetyAuditEventInput, 'familyId' | 'caseId' | 'actorAccountId' | 'eventType'>
) {
  return {
    riskEventId: input.riskEventId,
    fromVersion: input.fromVersion,
    toVersion: input.toVersion,
    ...(input.resolutionAuthorityRef === undefined
      ? {}
      : { resolutionAuthorityRef: input.resolutionAuthorityRef }),
  };
}

/** Insert a HOLD_ENTERED trace and return its id (same transaction). */
export async function insertHoldEnteredRiskEvent(
  tx: SafetyWriteTx,
  input: HoldEnteredRiskEventInput
): Promise<string> {
  const [row] = await tx
    .insert(riskEvents)
    .values({
      familyId: input.familyId,
      caseId: input.caseId,
      actorAccountId: input.actorAccountId,
      eventKind: 'HOLD_ENTERED' satisfies RiskEventKind,
      decisionCaseVersion: input.decisionCaseVersion,
      policyRef: input.identity.policyRef,
      policyVersion: input.identity.policyVersion,
      ruleRef: input.identity.ruleRef,
      ruleVersion: input.identity.ruleVersion,
      riskCategoryRef: input.riskCategoryRef,
      evidenceRefs: input.evidenceRefs,
    })
    .returning({ id: riskEvents.id });
  if (!row) throw new Error('RISK_EVENT_INSERT_RETURNED_NO_ROW');
  return row.id;
}

/** Insert a RISK_RESOLVED trace linked to the hold trace and return its id. */
export async function insertRiskResolvedRiskEvent(
  tx: SafetyWriteTx,
  input: RiskResolvedRiskEventInput
): Promise<string> {
  const [row] = await tx
    .insert(riskEvents)
    .values({
      familyId: input.familyId,
      caseId: input.caseId,
      actorAccountId: input.actorAccountId,
      eventKind: 'RISK_RESOLVED' satisfies RiskEventKind,
      decisionCaseVersion: input.decisionCaseVersion,
      evidenceRefs: input.evidenceRefs,
      resolutionOfRiskEventId: input.resolutionOfRiskEventId,
      resolutionAuthorityRef: input.resolutionAuthorityRef,
    })
    .returning({ id: riskEvents.id });
  if (!row) throw new Error('RISK_EVENT_INSERT_RETURNED_NO_ROW');
  return row.id;
}

/** Append the Safety Case Event with the exact frozen metadata shape. */
export async function insertSafetyCaseEvent(
  tx: SafetyWriteTx,
  input: SafetyCaseEventInput
): Promise<void> {
  await tx.insert(caseEvents).values({
    familyId: input.familyId,
    caseId: input.caseId,
    actorAccountId: input.actorAccountId,
    eventType: input.eventType,
    metadata: buildSafetyCaseEventMetadata(input),
  });
}

/** Append the Safety Business Audit Event (resource_type stays `CASE`). */
export async function insertSafetyAuditEvent(
  tx: SafetyWriteTx,
  input: SafetyAuditEventInput
): Promise<void> {
  await tx.insert(businessAuditEvents).values({
    familyId: input.familyId,
    actorAccountId: input.actorAccountId,
    eventType: input.eventType,
    resourceType: 'CASE',
    resourceId: input.caseId,
    metadata: buildSafetyAuditMetadata(input),
  });
}