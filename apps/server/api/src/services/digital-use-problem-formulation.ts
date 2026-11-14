/**
 * Slice 12 — Digital Use -> authoritative Slice 8 Problem Formulation handoff.
 *
 * This module only builds a deterministic candidate from current Evidence and
 * calls the merged Slice 8 caller-owned transaction seam. It never writes the
 * problem_formulations table directly.
 */
import type pg from 'pg';
import {
  canonicalDependencies,
  canonicalEvidenceRefs,
  getSceneEvidenceText,
  getSceneNodeState,
  hashPayload,
  listCurrentSceneEvidenceStatements,
  resolveEvidenceRefs,
  type EvidenceRef,
  type ProblemFormulationContent,
  type StoredEvidenceRef,
} from '@xiaoshuyin/domain';
import { DIGITAL_USE_PACKAGE_VERSION } from '@xiaoshuyin/scenes/digital-use';
import {
  prepareProblemFormulationInTransaction,
  presentProblemFormulationInTransaction,
} from './problem-formulations.js';

export type ProblemFormulationCandidateDecision =
  | { readonly ok: true; readonly content: ProblemFormulationContent }
  | {
      readonly ok: false;
      readonly reasonCode:
        | 'PROBLEM_FORMULATION_CARRIER_UNAVAILABLE'
        | 'PROBLEM_FORMULATION_EVIDENCE_UNRESOLVED'
        | 'PROBLEM_FORMULATION_EVIDENCE_CONFLICT'
        | 'PROBLEM_FORMULATION_EVIDENCE_INVALID';
    };

function evidenceRef(ref: StoredEvidenceRef): EvidenceRef {
  return { type: ref.type, id: ref.id };
}

function structuredPayload(content: string): { code: string; value: unknown } | null {
  const match = /^DUA:v1:([^:]+):(.*)$/s.exec(content);
  if (!match) return null;
  try {
    return { code: match[1]!, value: JSON.parse(match[2]!) };
  } catch {
    return null;
  }
}

function collectUnresolvedStates(
  value: unknown,
  into: Set<'UNKNOWN' | 'NOT_COLLECTED' | 'DECLINED'>
): void {
  if (Array.isArray(value)) {
    for (const item of value) collectUnresolvedStates(item, into);
    return;
  }
  if (typeof value !== 'object' || value === null) return;
  const row = value as Record<string, unknown>;
  if (
    row['state'] === 'UNKNOWN' ||
    row['state'] === 'NOT_COLLECTED' ||
    row['state'] === 'DECLINED'
  ) {
    into.add(row['state']);
  }
  for (const nested of Object.values(row)) collectUnresolvedStates(nested, into);
}

type CurrentEvidenceAnalysis =
  | {
      readonly ok: true;
      readonly unknowns: ProblemFormulationContent['unknowns'];
    }
  | Exclude<ProblemFormulationCandidateDecision, { ok: true }>;

function analyzeCurrentEvidence(
  rows: Awaited<ReturnType<typeof listCurrentSceneEvidenceStatements>>
): CurrentEvidenceAnalysis {
  const knownByCode = new Map<string, Set<string>>();
  const unknownKeys = new Set<string>();
  const unknowns: ProblemFormulationContent['unknowns'] = [];

  for (const row of rows) {
    if (row.conflict_group_id !== null || row.confirmation_status === 'DISPUTED') {
      return { ok: false, reasonCode: 'PROBLEM_FORMULATION_EVIDENCE_CONFLICT' };
    }
    const structured = structuredPayload(row.content);
    if (!structured) {
      return { ok: false, reasonCode: 'PROBLEM_FORMULATION_EVIDENCE_INVALID' };
    }

    const unresolved = new Set<'UNKNOWN' | 'NOT_COLLECTED' | 'DECLINED'>();
    collectUnresolvedStates(structured.value, unresolved);
    if (unresolved.size > 0) {
      // Slice 8 permits UnknownItem without a native Observation ref. The exact
      // source assertion remains in top-level evidenceRefs; an empty nested ref
      // list avoids falsely claiming that an Assertion is an Observation.
      for (const state of unresolved) {
        const key = `${structured.code}:${state}`;
        if (unknownKeys.has(key)) continue;
        unknownKeys.add(key);
        unknowns.push({
          topic: structured.code,
          state,
          evidenceRefs: [],
        });
      }
      // Missing-like current reports never become Conflict merely because a
      // different approved source also has a usable current value.
      continue;
    }

    const values = knownByCode.get(structured.code) ?? new Set<string>();
    values.add(JSON.stringify(structured.value));
    knownByCode.set(structured.code, values);
  }

  if ([...knownByCode.values()].some((values) => values.size > 1)) {
    return { ok: false, reasonCode: 'PROBLEM_FORMULATION_EVIDENCE_CONFLICT' };
  }
  return { ok: true, unknowns };
}

/**
 * Build only when the current Assessment Evidence can be preserved without
 * inventing an owner-native Unknown/Conflict representation.
 */
export async function buildDigitalUseProblemFormulationCandidate(
  tx: pg.PoolClient,
  input: {
    actor: { accountId: string; personId: string };
    familyId: string;
    caseId: string;
  }
): Promise<ProblemFormulationCandidateDecision> {
  const a1001 = await getSceneNodeState(tx, input.caseId, 'A1001');
  const carrier = a1001?.input_refs.find(
    (ref): ref is StoredEvidenceRef =>
      ref.type === 'DIALOGUE_MESSAGE' ||
      ref.type === 'ASSERTION' ||
      ref.type === 'OBSERVATION'
  );
  if (!carrier || carrier.type === 'OBSERVATION') {
    return { ok: false, reasonCode: 'PROBLEM_FORMULATION_CARRIER_UNAVAILABLE' };
  }

  const carrierText = await getSceneEvidenceText(tx, {
    caseId: input.caseId,
    ref: carrier,
  });
  if (!carrierText || carrierText.trim().length === 0) {
    return { ok: false, reasonCode: 'PROBLEM_FORMULATION_CARRIER_UNAVAILABLE' };
  }

  const currentAssessment = await listCurrentSceneEvidenceStatements(
    tx,
    input.caseId,
    'DUA:v1:'
  );
  const analysis = analyzeCurrentEvidence(currentAssessment);
  if (!analysis.ok) return analysis;

  const refs = canonicalEvidenceRefs([
    evidenceRef(carrier),
    ...currentAssessment.map((row) => ({
      type: 'ASSERTION' as const,
      id: row.id,
    })),
  ]);

  const resolution = await resolveEvidenceRefs(tx, input.caseId, refs);
  if (
    resolution.missing.length > 0 ||
    refs.some((ref) => {
      const member = resolution.members.get(`${ref.type}:${ref.id.toLowerCase()}`);
      return !member || !member.usable || member.conflictGroupId !== null;
    })
  ) {
    return { ok: false, reasonCode: 'PROBLEM_FORMULATION_EVIDENCE_INVALID' };
  }

  // Build the content shell first. Mandatory dependencies are computed only
  // by the Slice 8 owner preparation seam below; Slice 12 does not duplicate
  // processing-person, minor-consent or Compliance dependency logic.
  const content: ProblemFormulationContent = {
    primaryProblem: {
      text: carrierText,
      evidenceRefs: [evidenceRef(carrier)],
    },
    keyFactors: [],
    evidenceRefs: refs,
    unknowns: analysis.unknowns,
    conflicts: [],
    sceneFit: 'DIGITAL_USE',
    alternativeExplanations: [],
    reassessmentConditions: [],
    exitConditions: [],
    dependencyRefs: [],
  };

  const prepared = await prepareProblemFormulationInTransaction(tx, {
    actor: input.actor,
    familyId: input.familyId,
    caseId: input.caseId,
    content,
  });

  return {
    ok: true,
    content: {
      ...content,
      dependencyRefs: canonicalDependencies([
        ...prepared.mandatoryDependencyRefs,
        {
          type: 'PACKAGE',
          key: 'DIGITAL_USE',
          version: DIGITAL_USE_PACKAGE_VERSION,
        },
      ]),
    },
  };
}

function formulationIdempotencyKey(input: {
  caseId: string;
  nodeCode: string;
  outerIdempotencyKey: string;
}): string {
  const digest = hashPayload(input);
  return `slice12-pf-${digest.slice(0, 48)}`;
}

export async function presentDigitalUseProblemFormulationInTransaction(
  tx: pg.PoolClient,
  input: {
    actor: { accountId: string; personId: string };
    familyId: string;
    caseId: string;
    nodeCode: string;
    expectedCaseVersion: number;
    outerIdempotencyKey: string;
  }
): Promise<
  | { readonly kind: 'UNAVAILABLE'; readonly reasonCode: string }
  | { readonly kind: 'PRESENTED'; readonly caseVersion: number }
> {
  const candidate = await buildDigitalUseProblemFormulationCandidate(tx, {
    actor: input.actor,
    familyId: input.familyId,
    caseId: input.caseId,
  });
  if (!candidate.ok) {
    return { kind: 'UNAVAILABLE', reasonCode: candidate.reasonCode };
  }

  // IMPORTANT: caller must invoke this before taking its own Case row lock.
  // Slice 8 owns Family -> Case -> Problem Formulation lock ordering.
  const owner = await presentProblemFormulationInTransaction(tx, {
    actor: input.actor,
    familyId: input.familyId,
    caseId: input.caseId,
    expectedCaseVersion: input.expectedCaseVersion,
    idempotencyKey: formulationIdempotencyKey({
      caseId: input.caseId,
      nodeCode: input.nodeCode,
      outerIdempotencyKey: input.outerIdempotencyKey,
    }),
    content: candidate.content,
  });

  const caseVersion =
    typeof owner.body === 'object' && owner.body !== null
      ? (owner.body as { caseVersion?: unknown }).caseVersion
      : undefined;
  if (owner.status !== 200 || typeof caseVersion !== 'number') {
    throw Object.assign(new Error('PROBLEM_FORMULATION_HANDOFF_INVALID_OWNER_RESULT'), {
      code: 'INTERNAL_ERROR',
    });
  }
  return { kind: 'PRESENTED', caseVersion };
}
