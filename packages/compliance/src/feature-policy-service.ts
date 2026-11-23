/**
 * Slice 10 — Internal compliance service composition.
 *
 * This is the only consumer-facing foundation contract: authorized server code
 * passes a *resolved* feature descriptor plus server-owned supported-obligation
 * configuration. There is no public policy endpoint, no client feature string
 * and no downstream obligation execution here.
 */

import { getCurrentNoticeHash } from './notices.js';
import type { ComplianceFeatureDescriptor } from './feature-identity.js';
import {
  assertComplianceObligationsSupported,
  evaluateCompliance,
  type ComplianceEvaluationResult,
  type ComplianceEvaluationSnapshot,
  type ComplianceObligation,
} from './feature-policy.js';
import {
  loadCompliancePersonSnapshot,
  loadCompliancePolicySnapshot,
  type CompliancePersonQueryExecutor,
  type CompliancePolicyQueryExecutor,
} from './feature-policy-repository.js';

export interface ComplianceEvaluationRequest {
  /** Must already be a server-resolved descriptor, never a request string. */
  readonly descriptor: ComplianceFeatureDescriptor;
  /** Authenticated actor whose feature eligibility is evaluated. */
  readonly actorPersonId: string;
  /** Target Person when the consuming command performs person processing. */
  readonly targetPersonId: string | null;
  readonly processingCategory?: ComplianceEvaluationSnapshot['processingCategory'];
  /** Server-owned capability declaration; never request/client input. */
  readonly supportedObligations: readonly ComplianceObligation[];
}

/**
 * Load the validated snapshot for one evaluation inside the caller's existing
 * transaction. Policy and person facts intentionally share the same client so
 * they belong to the same consistent snapshot.
 */
export async function loadComplianceEvaluationSnapshot(
  policyExecutor: CompliancePolicyQueryExecutor,
  personExecutor: CompliancePersonQueryExecutor,
  request: ComplianceEvaluationRequest
): Promise<ComplianceEvaluationSnapshot> {
  const policySnapshot = await loadCompliancePolicySnapshot(
    policyExecutor,
    request.descriptor
  );

  const actor = await loadCompliancePersonSnapshot(
    personExecutor,
    request.actorPersonId
  );
  const person =
    request.targetPersonId === null
      ? null
      : request.targetPersonId === request.actorPersonId
        ? actor
        : await loadCompliancePersonSnapshot(personExecutor, request.targetPersonId);

  return {
    feature: request.descriptor,
    evaluatedAt: policySnapshot.evaluatedAt,
    candidatePolicies: policySnapshot.policies,
    actor,
    personProcessingRequired: request.targetPersonId !== null,
    processingCategory: request.processingCategory,
    person,
    currentNoticeHash: getCurrentNoticeHash(),
  };
}

/**
 * Evaluate compliance at the authoritative transaction time. A database or
 * infrastructure failure propagates from snapshot loading unchanged; it is
 * never converted into a business BLOCK or ALLOW.
 */
export async function evaluateComplianceAtTransactionTime(
  policyExecutor: CompliancePolicyQueryExecutor,
  personExecutor: CompliancePersonQueryExecutor,
  request: ComplianceEvaluationRequest
): Promise<ComplianceEvaluationResult> {
  const snapshot = await loadComplianceEvaluationSnapshot(
    policyExecutor,
    personExecutor,
    request
  );

  const result = evaluateCompliance(snapshot);
  return assertComplianceObligationsSupported(result, request.supportedObligations);
}