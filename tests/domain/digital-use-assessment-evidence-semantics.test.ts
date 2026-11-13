import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  recordStatement,
  listCurrentSceneEvidenceStatements,
} = vi.hoisted(() => ({
  recordStatement: vi.fn(),
  listCurrentSceneEvidenceStatements: vi.fn(),
}));

vi.mock('@xiaoshuyin/domain', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@xiaoshuyin/domain')>();
  return {
    ...actual,
    canonicalJson: (value: unknown) => JSON.stringify(value),
    listCurrentSceneEvidenceStatements,
    recordStatement,
  };
});

import { applyDigitalUseNodeSemantics } from '../../apps/server/api/src/services/digital-use-node-semantics.js';

function context(nodeCode: string, response: Record<string, unknown>) {
  return {
    tx: {} as never,
    actor: {
      accountId: '00000000-0000-7000-8000-000000000001',
      personId: '00000000-0000-7000-8000-000000000002',
    },
    familyId: '00000000-0000-7000-8000-000000000003',
    caseId: '00000000-0000-7000-8000-000000000004',
    nodeCode,
    response,
    currentInputRefs: [] as const,
  };
}

describe('T1210 A1001 / 01002 / 01003 Evidence semantics', () => {
  let seq = 0;
  let currentRows: Array<Record<string, unknown>> = [];

  beforeEach(() => {
    seq = 0;
    currentRows = [];
    recordStatement.mockReset();
    listCurrentSceneEvidenceStatements.mockReset();
    listCurrentSceneEvidenceStatements.mockImplementation(
      async (_tx: unknown, _caseId: string, prefix: string) =>
        currentRows.filter((row) =>
          typeof row.content === 'string' && row.content.startsWith(prefix)
        )
    );
    recordStatement.mockImplementation(async (_tx, ctx, draft) => {
      const id = `00000000-0000-7000-8000-${String(++seq).padStart(12, '0')}`;
      if (draft.supersedesId) {
        currentRows = currentRows.filter((row) => row.id !== draft.supersedesId);
      }
      currentRows.push({
        id,
        family_id: ctx.familyId,
        case_id: ctx.caseId,
        subject_person_id: draft.subjectPersonId,
        source_person_id: draft.sourcePersonId,
        content: draft.content,
        confirmation_status: draft.confirmationStatus,
        conflict_group_id: null,
        recorded_at: new Date('2026-11-13T00:00:00.000Z'),
      });
      return {
        id,
        recordedAt: new Date('2026-11-13T00:00:00.000Z'),
      };
    });
  });

  it('records broad devices, purpose-separated durations and functional impact', async () => {
    const result = await applyDigitalUseNodeSemantics(context('A1001', {
      reportedAgeYears: 10,
      devices: ['PHONE', 'COMPUTER', 'GAME_CONSOLE_OR_DEVICE'],
      purposeDurations: {
        learningResearchHomework: { state: 'KNOWN', minutesPerDay: 90, certainty: 'ESTIMATE' },
        necessaryContact: { state: 'KNOWN', minutesPerDay: 20, certainty: 'EXACT' },
        entertainmentGamingVideoSocialNonLearning: { state: 'KNOWN', minutesPerDay: 120, certainty: 'ESTIMATE' },
      },
      totalDuration: { state: 'KNOWN', minutesPerDay: 230, certainty: 'ESTIMATE' },
      historicalDurationBand: 'B',
      functionalImpact: {
        sleep: { state: 'KNOWN', impacted: false },
        studyOrNecessaryAffairs: { state: 'KNOWN', impacted: true },
        realWorldActivityDisplacement: { state: 'UNKNOWN' },
      },
    }));

    expect(result.conditions).toEqual({ A1001_ASSESSMENT_COMPLETE: true });
    expect(result.evidenceBasis).toContain('FUNCTIONAL_IMPACT');
    expect(result.evidenceBasis).toContain('TOTAL_DURATION');
    expect(result.outputRefs.length).toBeGreaterThanOrEqual(9);
    expect(
      recordStatement.mock.calls.map((call) => call[2].content)
    ).toEqual(expect.arrayContaining([
      expect.stringContaining('DUA:v1:a1001.devices:'),
      expect.stringContaining('DUA:v1:a1001.duration.learning_research_homework:'),
      expect.stringContaining('DUA:v1:a1001.impact.sleep:'),
    ]));
    expect(recordStatement.mock.calls.every((call) =>
      call[2].subjectPersonId === context('A1001', {}).actor.personId &&
      call[2].sourcePersonId === context('A1001', {}).actor.personId
    )).toBe(true);
  });

  it('preserves an explicit estimate as collected Evidence', async () => {
    await applyDigitalUseNodeSemantics(context('A1001', {
      devices: ['TABLET'],
      purposeDurations: {
        learningResearchHomework: { state: 'KNOWN', minutesPerDay: 75, certainty: 'ESTIMATE' },
        necessaryContact: { state: 'NOT_COLLECTED' },
        entertainmentGamingVideoSocialNonLearning: { state: 'DECLINED' },
      },
      functionalImpact: {
        sleep: { state: 'UNKNOWN' },
        studyOrNecessaryAffairs: { state: 'KNOWN', impacted: false },
        realWorldActivityDisplacement: { state: 'KNOWN', impacted: false },
      },
    }));

    expect(recordStatement.mock.calls.some((call) =>
      call[2].content.includes('"certainty":"ESTIMATE"') &&
      call[2].content.includes('"minutesPerDay":75')
    )).toBe(true);
  });

  it('enforces 01002 max two selections and routes valid F priority', async () => {
    await expect(applyDigitalUseNodeSemantics(context('01002', {
      state: 'KNOWN',
      selections: ['A', 'B', 'C'],
    }))).rejects.toMatchObject({ code: 'SCENE_RESPONSE_INVALID' });

    const result = await applyDigitalUseNodeSemantics(context('01002', {
      state: 'KNOWN',
      selections: ['C', 'F'],
    }));
    expect(result.conditions).toEqual({
      EMOTION_SEVERE_F: true,
      EMOTION_ASSESSMENT_NON_SEVERE: false,
    });
  });

  it.each(['UNKNOWN', 'NOT_COLLECTED', 'DECLINED'] as const)(
    'keeps 01002 %s as insufficient, never Conflict',
    async (state) => {
      const result = await applyDigitalUseNodeSemantics(context('01002', { state }));
      expect(result.progression).toBe('HOLD');
      expect(result.holdReasonCode).toBe('INTEGRATED_TRIAGE_INSUFFICIENT');
      expect(result.conditions.EMOTION_SEVERE_F).toBe(state);
    }
  );

  it('enforces 01003 exactly one selection and preserves unresolved states', async () => {
    // 01003 is only reachable after a valid non-F 01002 current Evidence value.
    await applyDigitalUseNodeSemantics(context('01002', {
      state: 'KNOWN',
      selections: ['A'],
    }));

    const f = await applyDigitalUseNodeSemantics(context('01003', {
      state: 'KNOWN',
      selection: 'F',
    }));
    expect(f.conditions).toEqual({ FAMILY_CONFLICT_SEVERE_F: true });

    await expect(applyDigitalUseNodeSemantics(context('01003', {
      state: 'KNOWN',
      selection: ['A', 'B'],
    }))).rejects.toMatchObject({ code: 'SCENE_RESPONSE_INVALID' });

    const unresolved = await applyDigitalUseNodeSemantics(context('01003', {
      state: 'DECLINED',
    }));
    expect(unresolved.progression).toBe('HOLD');
    expect(unresolved.conditions).toEqual({});
    expect(unresolved.outputRefs.length).toBeGreaterThan(0);
  });

  it('supersedes one actor-owned current response but never guesses among multiple current rows', async () => {
    listCurrentSceneEvidenceStatements.mockResolvedValueOnce([{
      id: '00000000-0000-7000-8000-000000000099',
      family_id: context('01002', {}).familyId,
      case_id: context('01002', {}).caseId,
      subject_person_id: context('01002', {}).actor.personId,
      source_person_id: context('01002', {}).actor.personId,
      content: 'DUA:v1:01002.emotion:{}',
      confirmation_status: 'UNCONFIRMED',
      conflict_group_id: null,
      recorded_at: new Date(),
    }]);

    await applyDigitalUseNodeSemantics(context('01002', {
      state: 'KNOWN',
      selections: ['A'],
    }));
    expect(recordStatement.mock.calls[0]![2].supersedesId)
      .toBe('00000000-0000-7000-8000-000000000099');

    listCurrentSceneEvidenceStatements.mockResolvedValueOnce([
      {
        id: '00000000-0000-7000-8000-000000000101',
        subject_person_id: context('01002', {}).actor.personId,
        source_person_id: context('01002', {}).actor.personId,
      },
      {
        id: '00000000-0000-7000-8000-000000000102',
        subject_person_id: context('01002', {}).actor.personId,
        source_person_id: context('01002', {}).actor.personId,
      },
    ]);
    await expect(applyDigitalUseNodeSemantics(context('01002', {
      state: 'KNOWN',
      selections: ['A'],
    }))).rejects.toMatchObject({ code: 'INTEGRATED_TRIAGE_BLOCKED' });
  });
});
