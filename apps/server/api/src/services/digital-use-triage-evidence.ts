/**
 * Slice 12 — authoritative Evidence -> Integrated Triage snapshot adapter.
 *
 * I/O and deterministic parsing only. Business outcome logic remains in the
 * pure @xiaoshuyin/scenes/digital-use evaluator.
 */
import type pg from 'pg';
import {
  canonicalJson,
  listCurrentSceneEvidenceStatements,
  type SceneEvidenceStatementRow,
} from '@xiaoshuyin/domain';
import type {
  EmotionOption,
  FamilyRelationshipOption,
  IntegratedTriageEvidence,
  TriageEvidenceState,
} from '@xiaoshuyin/scenes/digital-use';

const ROOT_PREFIX = 'DUA:v1:';

function prefix(code: string): string {
  return `${ROOT_PREFIX}${code}:`;
}

function payloadOf(row: SceneEvidenceStatementRow, code: string): unknown {
  const expected = prefix(code);
  if (!row.content.startsWith(expected)) throw new Error('TRIAGE_EVIDENCE_PREFIX_INVALID');
  return JSON.parse(row.content.slice(expected.length));
}

function missingReason(state: string): 'UNKNOWN' | 'NOT_COLLECTED' | 'DECLINED' | null {
  if (state === 'UNKNOWN' || state === 'NOT_COLLECTED' || state === 'DECLINED') return state;
  return null;
}

function classifyRows<T>(
  rows: readonly SceneEvidenceStatementRow[],
  code: string,
  parser: (value: unknown) => TriageEvidenceState<T> | null
): TriageEvidenceState<T> {
  const selected = rows.filter((row) => row.content.startsWith(prefix(code)));
  if (selected.length === 0) return { kind: 'MISSING', reason: 'NO_RECORD' };
  if (selected.some((row) => row.conflict_group_id !== null)) {
    return { kind: 'CONFLICT', reason: 'CONFLICTING' };
  }

  const parsed: TriageEvidenceState<T>[] = [];
  try {
    for (const row of selected) {
      const value = parser(payloadOf(row, code));
      if (value === null) return { kind: 'CONFLICT', reason: 'INVALID' };
      parsed.push(value);
    }
  } catch {
    return { kind: 'CONFLICT', reason: 'INVALID' };
  }

  // Identical current statements from multiple admissible sources are not
  // contradictory. Distinct current route-driving meanings are.
  const distinct = new Map(parsed.map((item) => [canonicalJson(item), item]));
  if (distinct.size !== 1) return { kind: 'CONFLICT', reason: 'CONTRADICTORY' };
  return [...distinct.values()][0]!;
}

function parseEmotion(value: unknown): TriageEvidenceState<readonly EmotionOption[]> | null {
  if (typeof value !== 'object' || value === null) return null;
  const row = value as { state?: unknown; selections?: unknown };
  const reason = typeof row.state === 'string' ? missingReason(row.state) : null;
  if (reason !== null) return { kind: 'MISSING', reason };
  if (row.state !== 'KNOWN' || !Array.isArray(row.selections)) return null;
  if (row.selections.length < 1 || row.selections.length > 2) return null;
  const allowed = new Set(['A','B','C','D','E','F']);
  if (!row.selections.every((v) => typeof v === 'string' && allowed.has(v))) return null;
  if (new Set(row.selections).size !== row.selections.length) return null;
  return { kind: 'VALUE', value: row.selections as EmotionOption[] };
}

function parseFamily(value: unknown): TriageEvidenceState<FamilyRelationshipOption> | null {
  if (typeof value !== 'object' || value === null) return null;
  const row = value as { state?: unknown; selection?: unknown };
  const reason = typeof row.state === 'string' ? missingReason(row.state) : null;
  if (reason !== null) return { kind: 'MISSING', reason };
  if (
    row.state !== 'KNOWN' ||
    typeof row.selection !== 'string' ||
    !['A','B','C','D','E','F'].includes(row.selection)
  ) return null;
  return { kind: 'VALUE', value: row.selection as FamilyRelationshipOption };
}

function parseImpact(value: unknown): TriageEvidenceState<boolean> | null {
  if (typeof value !== 'object' || value === null) return null;
  const row = value as { state?: unknown; impacted?: unknown };
  const reason = typeof row.state === 'string' ? missingReason(row.state) : null;
  if (reason !== null) return { kind: 'MISSING', reason };
  if (row.state !== 'KNOWN' || typeof row.impacted !== 'boolean') return null;
  return { kind: 'VALUE', value: row.impacted };
}

function parseOtherNeed(value: unknown): TriageEvidenceState<boolean> | null {
  if (typeof value !== 'object' || value === null) return null;
  const row = value as { state?: unknown; present?: unknown };
  const reason = typeof row.state === 'string' ? missingReason(row.state) : null;
  if (reason !== null) return { kind: 'MISSING', reason };
  if (row.state !== 'KNOWN' || typeof row.present !== 'boolean') return null;
  return { kind: 'VALUE', value: row.present };
}

function optionalOtherNeed(
  rows: readonly SceneEvidenceStatementRow[]
): TriageEvidenceState<boolean> | undefined {
  const selected = rows.filter((row) => row.content.startsWith(prefix('triage.other_needs')));
  if (selected.length === 0) return undefined;
  return classifyRows(rows, 'triage.other_needs', parseOtherNeed);
}

function durationEvidencePresent(rows: readonly SceneEvidenceStatementRow[]): boolean {
  return rows.some((row) =>
    row.content.startsWith(prefix('a1001.duration.')) ||
    row.content.startsWith(prefix('a1001.duration.historical_band_auxiliary'))
  );
}

export async function loadIntegratedTriageEvidence(
  tx: pg.PoolClient,
  caseId: string
): Promise<IntegratedTriageEvidence> {
  const rows = await listCurrentSceneEvidenceStatements(tx, caseId, ROOT_PREFIX);
  return {
    emotion01002: classifyRows(rows, '01002.emotion', parseEmotion),
    family01003: classifyRows(rows, '01003.family_relationship', parseFamily),
    directImpact: {
      sleep: classifyRows(rows, 'a1001.impact.sleep', parseImpact),
      studyOrNecessaryAffairs: classifyRows(
        rows,
        'a1001.impact.study_or_necessary_affairs',
        parseImpact
      ),
      realWorldActivityDisplacement: classifyRows(
        rows,
        'a1001.impact.real_world_activity_displacement',
        parseImpact
      ),
    },
    ...(optionalOtherNeed(rows) === undefined ? {} : { otherNeeds: optionalOtherNeed(rows)! }),
    durationOnlyEvidencePresent: durationEvidencePresent(rows),
  };
}
