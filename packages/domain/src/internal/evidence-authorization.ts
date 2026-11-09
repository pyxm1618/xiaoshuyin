/**
 * Non-exported Evidence writer authorization seam (COLD-001 / T069).
 *
 * Frozen semantics (`specs/003-evidence-core/plan.md` D-5,
 * `contracts/evidence-domain.md` §2, `contracts/security-idempotency.md` §1/§8):
 *
 *   action   = CASE_READ
 *   purpose  = FAMILY_MANAGEMENT
 *   resource = specific Case
 *
 * The four approved Evidence writers call this seam BEFORE any Person /
 * guardian / source-message / supersedes / Evidence ref / compliance read.
 * The seam reuses the single `authorize()` entry point and the facts read from
 * the database inside the caller's transaction — it never trusts the context
 * shape or caller-supplied facts.
 *
 * Deliberately absent: a second authorization engine, a new `EVIDENCE_WRITE`
 * action, or an extended `Action` / `Purpose` taxonomy. Any rejection is the
 * single internal domain reason `EVIDENCE_CASE_NOT_AUTHORIZED`; no public HTTP
 * error taxonomy is introduced here.
 *
 * This module is package-internal: it is not re-exported from
 * `packages/domain/src/index.ts`.
 */

import { authorize, type Purpose } from '@xiaoshuyin/authorization';
import { getCaseById } from '../cases.js';
import {
  getCurrentTransactionIdentityContext,
  getFamilyById,
  getPersonByAccountId,
  isFamilyMember,
  type Tx,
} from '../repository.js';

export interface EvidenceAuthorizationContext {
  familyId: string;
  caseId: string;
  actorAccountId: string;
  actorPersonId: string;
  purpose: Purpose;
}

const NOT_AUTHORIZED_MESSAGE = 'Evidence case is not authorized';

function notAuthorized(): never {
  throw Object.assign(new Error(NOT_AUTHORIZED_MESSAGE), {
    name: 'EvidenceDomainError',
    code: 'EVIDENCE_CASE_NOT_AUTHORIZED',
  });
}

/**
 * Mechanically revalidate the current Case / Family / Purpose authorization.
 *
 * Fail-closed conditions (all collapse to `EVIDENCE_CASE_NOT_AUTHORIZED`):
 *   - actorAccountId has no Person, or its Person id ≠ actorPersonId;
 *   - the Case does not exist, or `case.family_id !== familyId`;
 *   - DENY from the single `authorize()` (membership / manager / purpose).
 */
export async function assertEvidenceCaseAuthorized(
  tx: Tx,
  ctx: EvidenceAuthorizationContext
): Promise<void> {
  // UFA-001: bind the claimed writer context to the identity actually installed
  // in this PostgreSQL transaction before any Person / Case / Evidence read.
  const transactionIdentity = await getCurrentTransactionIdentityContext(tx);
  if (
    transactionIdentity.accountId !== ctx.actorAccountId ||
    transactionIdentity.personId !== ctx.actorPersonId ||
    transactionIdentity.familyId !== ctx.familyId ||
    transactionIdentity.purpose !== ctx.purpose
  ) {
    notAuthorized();
  }

  const actor = await getPersonByAccountId(tx, ctx.actorAccountId);
  if (!actor || actor.id !== ctx.actorPersonId) notAuthorized();

  const kase = await getCaseById(tx, ctx.caseId);
  if (!kase || kase.family_id !== ctx.familyId) notAuthorized();

  const membership = await isFamilyMember(tx, ctx.familyId, ctx.actorPersonId);
  const family = await getFamilyById(tx, ctx.familyId);

  const decision = authorize({
    actor: { accountId: ctx.actorAccountId, personId: ctx.actorPersonId },
    product: 'V1',
    family: { familyId: ctx.familyId },
    case: { caseId: ctx.caseId },
    resource: { type: 'CASE', familyId: ctx.familyId, caseId: ctx.caseId },
    action: 'CASE_READ',
    purpose: ctx.purpose,
    facts: {
      membership,
      familyCreatedByPersonId: family?.created_by_person_id ?? null,
      // Not consulted by the CASE_READ branch; authorization facts are read
      // from the database and never inferred from the caller context.
      actorAgeBand: null,
      guardianPersonId: null,
      targetIsFamilyMember: false,
      familyId: family ? ctx.familyId : null,
    },
  });

  if (decision.decision !== 'ALLOW') notAuthorized();
}