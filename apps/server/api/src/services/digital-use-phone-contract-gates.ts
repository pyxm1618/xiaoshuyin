/**
 * Slice 14 Phone Use Contract control-plane dependency gates.
 *
 * Single shared composition seam consumed by the authoritative Contract
 * runtime and Slice 15 A5002. It owns no Contract, Consent, Evidence,
 * Participation, Scene or Authorization truth.
 */
import type pg from 'pg';
import {
  canonicalEvidenceKey,
  isParticipationProcessingAllowed,
  listCurrentDigitalUseTargetItems,
  lockParticipationById,
  revalidateStoredEvidenceDependencies,
  resolveEvidenceRefs,
  resolveSceneArtifactRefCurrentness,
  type EvidenceRef,
  type StoredSceneRef,
} from '@xiaoshuyin/domain';
import {
  DIGITAL_USE_SUPPLEMENTAL_ASSESSMENT,
  getCurrentPurposeScopedConsentDecision,
} from '@xiaoshuyin/compliance';
import { toHttpError } from '../plugins/error-handler.js';
import type { DigitalUseActor } from './digital-use-assessment.js';

function contractGateError(
  code: string,
  message?: string
): Error & { statusCode: number; code: string } {
  const mapped = toHttpError(code, message);
  return Object.assign(new Error(mapped.message), {
    statusCode: mapped.statusCode,
    code: mapped.code,
  });
}

function toStoredRefs(refs: readonly unknown[]): readonly StoredSceneRef[] {
  return refs as readonly StoredSceneRef[];
}

export async function assertPhoneUseContractDependencies(
  tx: pg.PoolClient,
  input: {
    actor: DigitalUseActor;
    familyId: string;
    caseId: string;
    dependencyRefs: readonly unknown[];
  }
): Promise<readonly StoredSceneRef[]> {
  const refs = toStoredRefs(input.dependencyRefs);
  const evidenceRefs: EvidenceRef[] = [];
  const sceneArtifactIds: string[] = [];
  const consentIds: string[] = [];
  const targetItemIds: string[] = [];

  for (const ref of refs) {
    if (ref.type === 'RECORD_MARKER') {
      if (ref.markerCode !== 'A200401' || ref.evidenceRefs.length === 0) {
        throw contractGateError(
          'PHONE_USE_CONTRACT_INVALID_PAYLOAD',
          'Record marker dependency is invalid'
        );
      }
      evidenceRefs.push(...ref.evidenceRefs);
      continue;
    }
    if (
      ref.type === 'DIALOGUE_MESSAGE' ||
      ref.type === 'ASSERTION' ||
      ref.type === 'OBSERVATION'
    ) {
      evidenceRefs.push(ref);
      continue;
    }
    if (ref.type === 'SCENE_ARTIFACT') {
      sceneArtifactIds.push(ref.id);
      continue;
    }
    if (ref.type === 'CONSENT') {
      consentIds.push(ref.id);
      continue;
    }
    if (ref.type === 'TARGET_ITEM') {
      targetItemIds.push(ref.id);
      continue;
    }
    throw contractGateError(
      'PHONE_USE_CONTRACT_INVALID_PAYLOAD',
      'Unsupported Contract dependency ref'
    );
  }

  if (evidenceRefs.length > 0) {
    const evidenceDependencies = evidenceRefs.map((evidence) => ({
      type: 'EVIDENCE' as const,
      evidence,
    }));
    try {
      await revalidateStoredEvidenceDependencies(
        tx,
        input.caseId,
        evidenceDependencies
      );
    } catch (error) {
      const code =
        typeof error === 'object' && error !== null
          ? (error as { code?: unknown }).code
          : undefined;
      if (code === 'PROBLEM_FORMULATION_DEPENDENCY_INVALID') {
        throw contractGateError(
          'PHONE_USE_CONTRACT_INVALID_PAYLOAD',
          'Evidence dependency is no longer current-valid'
        );
      }
      throw error;
    }

    const resolution = await resolveEvidenceRefs(
      tx,
      input.caseId,
      evidenceRefs
    );
    if (resolution.missing.length > 0) {
      throw contractGateError(
        'PHONE_USE_CONTRACT_INVALID_PAYLOAD',
        'Evidence dependency is outside the authorized Case'
      );
    }
    for (const ref of evidenceRefs) {
      const member = resolution.members.get(canonicalEvidenceKey(ref));
      if (
        !member ||
        member.familyId.toLowerCase() !== input.familyId.toLowerCase() ||
        member.caseId.toLowerCase() !== input.caseId.toLowerCase()
      ) {
        throw contractGateError(
          'PHONE_USE_CONTRACT_INVALID_PAYLOAD',
          'Evidence dependency is outside the authorized Case'
        );
      }
      if (
        member.kind !== 'DIALOGUE_MESSAGE' &&
        (member.conflictGroupId !== null ||
          member.confirmationStatus === 'DISPUTED')
      ) {
        throw contractGateError(
          'PHONE_USE_CONTRACT_INVALID_PAYLOAD',
          'Evidence dependency requires conflict review'
        );
      }
    }
  }

  for (const artifactId of sceneArtifactIds) {
    const currentness = await resolveSceneArtifactRefCurrentness(tx, {
      artifactId,
      familyId: input.familyId,
      caseId: input.caseId,
    });
    if (currentness.status !== 'CURRENT') {
      throw contractGateError(
        'PHONE_USE_CONTRACT_INVALID_PAYLOAD',
        'Scene Artifact dependency is no longer current'
      );
    }
  }

  if (targetItemIds.length > 0) {
    const currentTargets = await listCurrentDigitalUseTargetItems(tx, input.caseId);
    const currentIds = new Set(
      currentTargets
        .filter(
          (row) =>
            row.family_id.toLowerCase() === input.familyId.toLowerCase() &&
            row.case_id.toLowerCase() === input.caseId.toLowerCase()
        )
        .map((row) => row.id.toLowerCase())
    );
    for (const targetItemId of targetItemIds) {
      if (!currentIds.has(targetItemId.toLowerCase())) {
        throw contractGateError(
          'PHONE_USE_CONTRACT_INVALID_PAYLOAD',
          'Target Item dependency is no longer current'
        );
      }
    }
  }

  for (const consentId of consentIds) {
    const currentConsent = await getCurrentPurposeScopedConsentDecision(tx, {
      familyId: input.familyId,
      caseId: input.caseId,
      actor: input.actor,
      purpose: DIGITAL_USE_SUPPLEMENTAL_ASSESSMENT,
    });
    if (
      currentConsent === null ||
      currentConsent.decision !== 'GRANTED' ||
      currentConsent.consentRecordId.toLowerCase() !== consentId.toLowerCase()
    ) {
      throw contractGateError(
        'PHONE_USE_CONTRACT_INVALID_PAYLOAD',
        'Consent dependency is no longer current'
      );
    }
  }

  return refs;
}

export async function assertPhoneUseContractChildParticipation(
  tx: pg.PoolClient,
  input: {
    familyId: string;
    caseId: string;
    childPersonId: string;
    participationId: string;
  }
) {
  const participation = await lockParticipationById(tx, input.participationId);
  if (
    !participation ||
    participation.family_id !== input.familyId ||
    participation.case_id !== input.caseId ||
    participation.person_id !== input.childPersonId ||
    participation.state !== 'ACTIVE'
  ) {
    throw contractGateError(
      'PHONE_USE_CONTRACT_INVALID_PAYLOAD',
      'Child participation is not current'
    );
  }
  if (!(await isParticipationProcessingAllowed(tx, participation.person_id))) {
    throw contractGateError('PHONE_USE_CONTRACT_CONSENT_BLOCKED');
  }
  return participation;
}
