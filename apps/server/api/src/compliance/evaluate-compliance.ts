/**
 * Slice 10 — Authorized compliance composition boundary.
 *
 * Contract:
 *   Authentication / identity
 *     → existing `authorize()` (the single authorization entry)
 *     → existing RLS transaction (ONE checked-out client)
 *     → Compliance evaluation in the SAME REPEATABLE READ snapshot
 *     → caller's existing Safety / Domain gates
 *     → downstream effect
 *
 * The pure evaluator stays pure: authorization is composed here, never inside
 * `evaluateCompliance()`. A Compliance ALLOW never authorizes access, and a
 * Compliance BLOCK never mutates authorization truth. When authorization is
 * denied, no compliance provenance is returned to the caller (anti-enumeration).
 */

import type pg from 'pg';
import type {
  Action,
  DenyReason,
  Purpose,
  Resource,
} from '@xiaoshuyin/authorization';
import {
  evaluateComplianceAtTransactionTime,
  type ComplianceEvaluationResult,
  type ComplianceFeatureDescriptor,
  type ComplianceObligation,
} from '@xiaoshuyin/compliance';
import { decideFamilyAction } from '../authz.js';
import { withDrizzleRlsTransaction } from '../db/drizzle-tx.js';

export interface AuthorizedComplianceEvaluationInput {
  /** Authenticated actor identity (server-resolved, never client-asserted). */
  readonly actor: { readonly accountId: string; readonly personId: string };
  readonly familyId: string;
  /** The consuming command's existing authorization decision inputs. */
  readonly authorization: {
    readonly action: Action;
    readonly purpose: Purpose;
    readonly resource: Resource;
    readonly caseId?: string;
  };
  /** Server-resolved canonical feature descriptor. */
  readonly descriptor: ComplianceFeatureDescriptor;
  /** Target Person for person processing; `null` for policy-only evaluation. */
  readonly targetPersonId: string | null;
  /** Server-owned consumer capability declaration. */
  readonly supportedObligations: readonly ComplianceObligation[];
}

export type AuthorizedComplianceDecision =
  | {
      readonly decision: 'AUTHORIZATION_DENIED';
      readonly authorization: 'DENY';
      readonly authorizationReason: DenyReason;
      /** No compliance detail is exposed to an unauthorized caller. */
      readonly compliance: null;
      readonly downstreamAllowed: false;
    }
  | {
      readonly decision: 'COMPLIANCE_EVALUATED';
      readonly authorization: 'ALLOW';
      readonly compliance: ComplianceEvaluationResult;
      readonly downstreamAllowed: boolean;
    };

/**
 * Run the existing authorization decision and, only when it allows, the
 * compliance decision, inside ONE authoritative REPEATABLE READ snapshot on the
 * shared Drizzle/RLS transaction seam.
 *
 * Infrastructure failures from authorization fact reads or compliance reads are
 * not caught here: they propagate unchanged and are never converted into a
 * business denial or a compliance BLOCK.
 */
export async function evaluateAuthorizedCompliance(
  pool: pg.Pool,
  input: AuthorizedComplianceEvaluationInput
): Promise<AuthorizedComplianceDecision> {
  return withDrizzleRlsTransaction(
    pool,
    {
      familyId: input.familyId,
      accountId: input.actor.accountId,
      personId: input.actor.personId,
      purpose: input.authorization.purpose,
      // Policy + Person profile + guardian consent must share one snapshot.
      isolationLevel: 'REPEATABLE READ',
    },
    async (tx, client) => {
      const authorizationDecision = await decideFamilyAction(client, {
        accountId: input.actor.accountId,
        personId: input.actor.personId,
        familyId: input.familyId,
        action: input.authorization.action,
        purpose: input.authorization.purpose,
        resource: input.authorization.resource,
        ...(input.authorization.caseId === undefined
          ? {}
          : { caseId: input.authorization.caseId }),
        targetPersonId: input.targetPersonId,
      });

      if (authorizationDecision.decision === 'DENY') {
        return {
          decision: 'AUTHORIZATION_DENIED',
          authorization: 'DENY',
          authorizationReason: authorizationDecision.reason,
          compliance: null,
          downstreamAllowed: false,
        } as const;
      }

      const compliance = await evaluateComplianceAtTransactionTime(tx, client, {
        descriptor: input.descriptor,
        personId: input.targetPersonId,
        supportedObligations: input.supportedObligations,
      });

      return {
        decision: 'COMPLIANCE_EVALUATED',
        authorization: 'ALLOW',
        compliance,
        downstreamAllowed: compliance.gate === 'ALLOW',
      } as const;
    }
  );
}