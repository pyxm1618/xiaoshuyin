import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

const {
  getSceneNodeState,
  getSceneEvidenceText,
  listCurrentSceneEvidenceStatements,
  getCaseById,
  resolveEvidenceRefs,
  resolveActiveCaseParticipantPersonIds,
  getComplianceProfileForGate,
  prepareProblemFormulationInTransaction,
  presentProblemFormulationInTransaction,
} = vi.hoisted(() => ({
  getSceneNodeState: vi.fn(),
  getSceneEvidenceText: vi.fn(),
  listCurrentSceneEvidenceStatements: vi.fn(),
  getCaseById: vi.fn(),
  resolveEvidenceRefs: vi.fn(),
  resolveActiveCaseParticipantPersonIds: vi.fn(),
  getComplianceProfileForGate: vi.fn(),
  prepareProblemFormulationInTransaction: vi.fn(),
  presentProblemFormulationInTransaction: vi.fn(),
}));

vi.mock('@xiaoshuyin/domain', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@xiaoshuyin/domain')>();
  return {
    ...actual,
    getSceneNodeState,
    getSceneEvidenceText,
    listCurrentSceneEvidenceStatements,
    getCaseById,
    resolveEvidenceRefs,
    resolveActiveCaseParticipantPersonIds,
  };
});

vi.mock('@xiaoshuyin/compliance', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@xiaoshuyin/compliance')>();
  return { ...actual, getComplianceProfileForGate };
});

vi.mock('../../apps/server/api/src/services/problem-formulations.js', () => ({
  prepareProblemFormulationInTransaction,
  presentProblemFormulationInTransaction,
}));

import {
  buildDigitalUseProblemFormulationCandidate,
  presentDigitalUseProblemFormulationInTransaction,
} from '../../apps/server/api/src/services/digital-use-problem-formulation.js';

const caseId = '00000000-0000-7000-8000-000000000004';
const actorPersonId = '00000000-0000-7000-8000-000000000002';
const carrierId = '00000000-0000-7000-8000-000000000010';

function row(id: string, code: string, value: unknown) {
  return {
    id,
    family_id: '00000000-0000-7000-8000-000000000003',
    case_id: caseId,
    subject_person_id: actorPersonId,
    source_person_id: actorPersonId,
    content: `DUA:v1:${code}:${JSON.stringify(value)}`,
    confirmation_status: 'UNCONFIRMED',
    conflict_group_id: null,
    recorded_at: new Date('2026-11-13T00:00:00.000Z'),
  };
}

describe('T1216 Digital Use Problem Formulation handoff', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSceneNodeState.mockResolvedValue({
      input_refs: [{ type: 'DIALOGUE_MESSAGE', id: carrierId }],
    });
    getSceneEvidenceText.mockResolvedValue('My child is having a digital-use problem.');
    getCaseById.mockResolvedValue({ created_by_person_id: actorPersonId });
    resolveActiveCaseParticipantPersonIds.mockResolvedValue([]);
    getComplianceProfileForGate.mockResolvedValue(null);
    prepareProblemFormulationInTransaction.mockResolvedValue({
      mandatoryDependencyRefs: [],
    });
    resolveEvidenceRefs.mockImplementation(async (_tx, _caseId, refs) => ({
      missing: [],
      members: new Map(refs.map((ref: { type: string; id: string }) => [
        `${ref.type}:${ref.id.toLowerCase()}`,
        {
          ref,
          kind: ref.type,
          caseId,
          familyId: '00000000-0000-7000-8000-000000000003',
          personIds: [actorPersonId],
          usable: true,
          unknownState: null,
          conflictGroupId: null,
          assertionKind: ref.type === 'ASSERTION' ? 'STATEMENT' : null,
          confirmationStatus: ref.type === 'ASSERTION' ? 'UNCONFIRMED' : null,
        },
      ])),
    }));
  });

  it('preserves carrier, current Evidence and nonmaterial Unknown without inventing facts', async () => {
    listCurrentSceneEvidenceStatements.mockResolvedValue([
      row('00000000-0000-7000-8000-000000000011', 'a1001.impact.sleep', {
        state: 'KNOWN', impacted: true,
      }),
      row('00000000-0000-7000-8000-000000000012', 'a1001.impact.study_or_necessary_affairs', {
        state: 'UNKNOWN',
      }),
      row('00000000-0000-7000-8000-000000000013', '01002.emotion', {
        state: 'KNOWN', selections: ['A'],
      }),
      row('00000000-0000-7000-8000-000000000014', '01003.family_relationship', {
        state: 'KNOWN', selection: 'A',
      }),
    ]);

    const result = await buildDigitalUseProblemFormulationCandidate({} as never, {
      actor: {
        accountId: '00000000-0000-7000-8000-000000000001',
        personId: actorPersonId,
      },
      familyId: '00000000-0000-7000-8000-000000000003',
      caseId,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.content.primaryProblem).toEqual({
      text: 'My child is having a digital-use problem.',
      evidenceRefs: [{ type: 'DIALOGUE_MESSAGE', id: carrierId }],
    });
    expect(result.content.unknowns).toContainEqual({
      topic: 'a1001.impact.study_or_necessary_affairs',
      state: 'UNKNOWN',
      evidenceRefs: [],
    });
    expect(result.content.evidenceRefs).toContainEqual({
      type: 'DIALOGUE_MESSAGE',
      id: carrierId,
    });
    expect(result.content.dependencyRefs).toContainEqual({
      type: 'PACKAGE',
      key: 'DIGITAL_USE',
      version: 'v1',
    });
    expect(prepareProblemFormulationInTransaction).toHaveBeenCalledTimes(1);
    expect(prepareProblemFormulationInTransaction.mock.calls[0]![1]).toMatchObject({
      familyId: '00000000-0000-7000-8000-000000000003',
      caseId,
      content: {
        dependencyRefs: [],
      },
    });
  });

  it('fails closed on contradictory current Evidence instead of choosing one side', async () => {
    listCurrentSceneEvidenceStatements.mockResolvedValue([
      row('00000000-0000-7000-8000-000000000021', '01002.emotion', {
        state: 'KNOWN', selections: ['A'],
      }),
      row('00000000-0000-7000-8000-000000000022', '01002.emotion', {
        state: 'KNOWN', selections: ['B'],
      }),
    ]);

    await expect(buildDigitalUseProblemFormulationCandidate({} as never, {
      actor: {
        accountId: '00000000-0000-7000-8000-000000000001',
        personId: actorPersonId,
      },
      familyId: '00000000-0000-7000-8000-000000000003',
      caseId,
    })).resolves.toEqual({
      ok: false,
      reasonCode: 'PROBLEM_FORMULATION_EVIDENCE_CONFLICT',
    });
  });

  it('uses the Slice 8 owner-computed mandatory dependency set without recomputing it', async () => {
    listCurrentSceneEvidenceStatements.mockResolvedValue([
      row('00000000-0000-7000-8000-000000000025', 'a1001.impact.sleep', {
        state: 'KNOWN', impacted: true,
      }),
    ]);
    prepareProblemFormulationInTransaction.mockResolvedValueOnce({
      mandatoryDependencyRefs: [
        {
          type: 'CONSENT',
          id: '00000000-0000-7000-8000-000000000026',
          version: 3,
        },
      ],
    });

    const result = await buildDigitalUseProblemFormulationCandidate({} as never, {
      actor: {
        accountId: '00000000-0000-7000-8000-000000000001',
        personId: actorPersonId,
      },
      familyId: '00000000-0000-7000-8000-000000000003',
      caseId,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.content.dependencyRefs).toContainEqual({
      type: 'CONSENT',
      id: '00000000-0000-7000-8000-000000000026',
      version: 3,
    });
    expect(result.content.dependencyRefs).toContainEqual({
      type: 'PACKAGE',
      key: 'DIGITAL_USE',
      version: 'v1',
    });
  });

  it('delegates presentation to the Slice 8 caller-owned seam and never writes formulation SQL', async () => {
    listCurrentSceneEvidenceStatements.mockResolvedValue([
      row('00000000-0000-7000-8000-000000000031', 'a1001.impact.sleep', {
        state: 'KNOWN', impacted: true,
      }),
    ]);
    presentProblemFormulationInTransaction.mockResolvedValue({
      status: 200,
      body: { caseVersion: 9, current: { version: 1 } },
      etag: '"case-v9"',
    });

    const result = await presentDigitalUseProblemFormulationInTransaction({} as never, {
      actor: {
        accountId: '00000000-0000-7000-8000-000000000001',
        personId: actorPersonId,
      },
      familyId: '00000000-0000-7000-8000-000000000003',
      caseId,
      nodeCode: '01003',
      expectedCaseVersion: 8,
      outerIdempotencyKey: '01234567-slice12-node-key',
    });

    expect(result).toEqual({ kind: 'PRESENTED', caseVersion: 9 });
    expect(presentProblemFormulationInTransaction).toHaveBeenCalledTimes(1);
    expect(presentProblemFormulationInTransaction.mock.calls[0]![1]).toMatchObject({
      caseId,
      expectedCaseVersion: 8,
      content: {
        primaryProblem: {
          text: 'My child is having a digital-use problem.',
        },
      },
    });

    const source = readFileSync(
      new URL('../../apps/server/api/src/services/digital-use-problem-formulation.ts', import.meta.url),
      'utf8'
    );
    expect(source).not.toMatch(/INSERT\s+INTO\s+problem_formulations/i);
    expect(source).not.toMatch(/UPDATE\s+problem_formulations/i);
  });
});
