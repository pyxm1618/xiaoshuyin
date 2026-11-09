/**
 * Slice 3 internal Message command writer (AUD-II-001).
 *
 * This module is an explicit *internal* seam for the approved public route
 * `POST /api/v1/cases/:id/messages`. It is deliberately NOT re-exported from
 * `packages/domain/src/index.ts`, so the production Evidence public writer
 * surface stays exactly the four frozen writers:
 *
 *   recordStatement / recordHypothesis / recordObservation / assignConflictGroup
 *
 * The server route imports this module by its package-internal path; it never
 * becomes a public package capability.
 */

import type { Tx } from '../repository.js';
import {
  insertAuditEvent,
  insertDialogueMessage,
  isFamilyMember,
} from '../repository.js';
import {
  EvidenceDomainError,
  type EvidenceWriteContext,
  type EvidenceWriteResult,
} from '../evidence.js';

function assertValidContent(content: unknown): void {
  if (
    typeof content !== 'string' ||
    content.length < 1 ||
    content.length > 8000 ||
    content.trim().length === 0
  ) {
    throw new EvidenceDomainError('EVIDENCE_CONTENT_INVALID');
  }
}

/**
 * Insert the raw Case message and its `MESSAGE_RECORDED` audit event inside the
 * caller's authorized transaction. `recorded_at` remains server-owned.
 */
export async function recordDialogueMessage(
  tx: Tx,
  ctx: EvidenceWriteContext,
  content: string
): Promise<EvidenceWriteResult> {
  assertValidContent(content);
  if (!(await isFamilyMember(tx, ctx.familyId, ctx.actorPersonId))) {
    throw new EvidenceDomainError('EVIDENCE_PERSON_REFERENCE_INVALID');
  }

  const row = await insertDialogueMessage(tx, {
    familyId: ctx.familyId,
    caseId: ctx.caseId,
    actorAccountId: ctx.actorAccountId,
    sourcePersonId: ctx.actorPersonId,
    content,
  });

  await insertAuditEvent(
    tx,
    ctx.familyId,
    ctx.actorAccountId,
    'MESSAGE_RECORDED',
    'DIALOGUE_MESSAGE',
    row.id
  );

  return { id: row.id, recordedAt: row.recorded_at };
}