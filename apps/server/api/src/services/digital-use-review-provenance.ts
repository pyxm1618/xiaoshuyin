import type pg from 'pg';
import type {
  ProfessionalReviewEvidenceRefType,
  ProfessionalReviewProvenanceType,
} from '@xiaoshuyin/contracts';
import {
  canonicalEvidenceKey,
  resolveEvidenceRefs,
  type EvidenceRef,
} from '@xiaoshuyin/domain';

function invalid(): never {
  throw Object.assign(new Error('Review provenance is invalid'), {
    code: 'SCENE_RESPONSE_INVALID',
  });
}

export async function assertProfessionalReviewProvenance(
  tx: pg.PoolClient,
  input: {
    readonly familyId: string;
    readonly caseId: string;
    readonly actorPersonId: string;
    readonly evidenceRefs: readonly ProfessionalReviewEvidenceRefType[];
    readonly provenance: readonly ProfessionalReviewProvenanceType[];
  }
): Promise<void> {
  const refs = input.evidenceRefs as readonly EvidenceRef[];
  const resolution = await resolveEvidenceRefs(tx, input.caseId, refs);
  if (resolution.missing.length > 0) invalid();

  for (const ref of refs) {
    const member = resolution.members.get(canonicalEvidenceKey(ref));
    if (
      member === undefined ||
      member.familyId !== input.familyId ||
      member.caseId !== input.caseId ||
      !member.usable ||
      member.conflictGroupId !== null ||
      member.confirmationStatus === 'DISPUTED'
    ) {
      invalid();
    }
  }

  const evidenceKeys = new Set(refs.map(canonicalEvidenceKey));
  for (const provenance of input.provenance) {
    if (provenance.kind === 'SYSTEM_METADATA') continue;

    if (provenance.kind === 'PARENT_AUTHORED_OBSERVATION') {
      if (provenance.sourcePersonId !== input.actorPersonId) invalid();
      continue;
    }

    if (provenance.kind === 'CHILD_AUTHORED_INPUT') {
      if (provenance.sourcePersonId === input.actorPersonId) invalid();
      const ref: EvidenceRef = {
        type: 'DIALOGUE_MESSAGE',
        id: provenance.sourceMessageId,
      };
      const key = canonicalEvidenceKey(ref);
      if (!evidenceKeys.has(key)) invalid();
      const member = resolution.members.get(key);
      if (
        member === undefined ||
        member.kind !== 'DIALOGUE_MESSAGE' ||
        !member.personIds.includes(provenance.sourcePersonId)
      ) {
        invalid();
      }
      continue;
    }

    if (provenance.transcriberPersonId !== input.actorPersonId) invalid();
    if (provenance.childPersonId === input.actorPersonId) invalid();
    const key = canonicalEvidenceKey(provenance.evidenceRef as EvidenceRef);
    if (!evidenceKeys.has(key)) invalid();
    const member = resolution.members.get(key);
    if (
      member === undefined ||
      member.kind === 'DIALOGUE_MESSAGE' ||
      !member.personIds.includes(provenance.transcriberPersonId) ||
      !member.personIds.includes(provenance.childPersonId)
    ) {
      invalid();
    }
  }
}
