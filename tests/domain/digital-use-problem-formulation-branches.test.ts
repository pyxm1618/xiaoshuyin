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
    recordStatement,
    listCurrentSceneEvidenceStatements,
  };
});

import { applyDigitalUseNodeSemantics } from '../../apps/server/api/src/services/digital-use-node-semantics.js';
import { resolveDigitalUseRuntimeNode, routeDigitalUseTopology } from '@xiaoshuyin/scenes/digital-use';

const actor = {
  accountId: '00000000-0000-7000-8000-000000000001',
  personId: '00000000-0000-7000-8000-000000000002',
};
const familyId = '00000000-0000-7000-8000-000000000003';
const caseId = '00000000-0000-7000-8000-000000000004';
const marker = {
  type: 'RECORD_MARKER' as const,
  markerCode: 'A200401' as const,
  evidenceRefs: [
    { type: 'ASSERTION' as const, id: '00000000-0000-7000-8000-000000000090' },
  ],
};

function ctx(
  nodeCode: string,
  response: Record<string, unknown>,
  currentInputRefs: readonly any[] = []
) {
  return {
    tx: { query: async () => ({ rows: [{ guardian_person_id: null }] }) } as never,
    targetPersonId: '00000000-0000-7000-8000-000000000005',
    actor,
    familyId,
    caseId,
    nodeCode,
    response,
    currentInputRefs,
  };
}

describe('T1213 A2003 / A200401 / A2004-A2009', () => {
  let seq = 0;

  beforeEach(() => {
    seq = 0;
    recordStatement.mockReset();
    listCurrentSceneEvidenceStatements.mockReset();
    listCurrentSceneEvidenceStatements.mockResolvedValue([]);
    recordStatement.mockImplementation(async () => ({
      id: `00000000-0000-7000-8000-${String(++seq).padStart(12, '0')}`,
      recordedAt: new Date('2026-11-13T00:00:00.000Z'),
    }));
  });

  it('creates A200401 only as a record marker over A2003 Evidence refs', async () => {
    const result = await applyDigitalUseNodeSemantics(ctx('A2003', {
      expectedDuration: { state: 'UNKNOWN' },
      reason: { state: 'KNOWN', text: 'school-night conflict' },
      priorMethods: { state: 'DECLINED' },
      observedEffect: { state: 'NOT_COLLECTED' },
      difficulties: { state: 'KNOWN', text: 'hard to stop' },
    }));

    expect(result.conditions).toEqual({ PARENT_EXPECTATION_CAPTURED: true });
    const markerRef = result.outputRefs.find((ref) => ref.type === 'RECORD_MARKER');
    expect(markerRef).toMatchObject({
      type: 'RECORD_MARKER',
      markerCode: 'A200401',
    });
    expect(markerRef && markerRef.type === 'RECORD_MARKER'
      ? markerRef.evidenceRefs.length
      : 0).toBe(5);
    expect(() => resolveDigitalUseRuntimeNode('A200401')).toThrow('SCENE_NODE_NOT_FOUND');
  });

  it.each([
    ['YES', true, false],
    ['NO', false, true],
    ['ASKED_WHY', false, true],
    ['TRIED_BEFORE_NOT_WORKED', false, true],
    ['UNKNOWN', 'UNKNOWN', 'UNKNOWN'],
    ['DECLINED', 'DECLINED', 'DECLINED'],
  ] as const)(
    'A2004 preserves %s Evidence while applying the approved branch',
    async (decision, yes, no) => {
      const result = await applyDigitalUseNodeSemantics(
        ctx('A2004', { decision }, [marker])
      );
      expect(result.conditions).toEqual({
        COLLABORATIVE_DURATION_YES: yes,
        COLLABORATIVE_DURATION_NO: no,
      });
      expect(recordStatement.mock.calls.at(-1)?.[2].content)
        .toContain(`"decision":"${decision}"`);
    }
  );

  it.each([
    ['WILLING', true, false],
    ['UNWILLING', false, true],
    ['TRIED_BEFORE_NOT_WORKED', false, true],
    ['UNKNOWN', 'UNKNOWN', 'UNKNOWN'],
    ['DECLINED', 'DECLINED', 'DECLINED'],
  ] as const)(
    'A2005 preserves %s while routing willing/unwilling',
    async (decision, willing, unwilling) => {
      const result = await applyDigitalUseNodeSemantics(
        ctx('A2005', { decision }, [marker])
      );
      expect(result.conditions).toEqual({
        SOLUTION_APPROACH_WILLING: willing,
        SOLUTION_APPROACH_UNWILLING: unwilling,
      });
      expect(recordStatement.mock.calls.at(-1)?.[2].content)
        .toContain(`"decision":"${decision}"`);
    }
  );

  it('A2006 and A2008 require A200401 context and preserve uncertainty', async () => {
    await expect(
      applyDigitalUseNodeSemantics(ctx('A2006', { decision: 'UNKNOWN' }))
    ).rejects.toMatchObject({ code: 'SCENE_RESPONSE_INVALID' });

    // A2006 UNKNOWN preserves UNKNOWN and fails closed in routing
    const motivationUnknown = await applyDigitalUseNodeSemantics(
      ctx('A2006', { decision: 'UNKNOWN' }, [marker])
    );
    expect(motivationUnknown.conditions).toEqual({
      MOTIVATION_RECONSIDER_WILLING: 'UNKNOWN',
      MOTIVATION_RECONSIDER_UNWILLING: 'UNKNOWN',
    });
    expect(routeDigitalUseTopology({
      sceneCode: 'DIGITAL_USE',
      packageVersion: 'v1',
      currentNodeCode: 'A2006',
      conditions: motivationUnknown.conditions,
    })).toMatchObject({ kind: 'UNKNOWN', code: 'UNKNOWN_OR_UNSUPPORTED_CONDITION' });

    // A2006 UNWILLING produces true negative branch
    const motivationUnwilling = await applyDigitalUseNodeSemantics(
      ctx('A2006', { decision: 'UNWILLING' }, [marker])
    );
    expect(motivationUnwilling.conditions).toEqual({
      MOTIVATION_RECONSIDER_WILLING: false,
      MOTIVATION_RECONSIDER_UNWILLING: true,
    });
    expect(routeDigitalUseTopology({
      sceneCode: 'DIGITAL_USE',
      packageVersion: 'v1',
      currentNodeCode: 'A2006',
      conditions: motivationUnwilling.conditions,
    })).toMatchObject({ kind: 'NODE_ROUTE', nextNodeCode: 'A2009' });

    // A2008 DECLINED preserves DECLINED and fails closed in routing (not routing to MAIN)
    const allianceDeclined = await applyDigitalUseNodeSemantics(
      ctx('A2008', { decision: 'DECLINED' }, [marker])
    );
    expect(allianceDeclined.conditions).toEqual({
      FAMILY_ALLIANCE_AGREED: 'DECLINED',
      FAMILY_ALLIANCE_DECLINED: 'DECLINED',
    });
    expect(routeDigitalUseTopology({
      sceneCode: 'DIGITAL_USE',
      packageVersion: 'v1',
      currentNodeCode: 'A2008',
      conditions: allianceDeclined.conditions,
    })).toMatchObject({ kind: 'UNKNOWN', code: 'UNKNOWN_OR_UNSUPPORTED_CONDITION' });

    // A2008 DISAGREE produces true negative branch to MAIN
    const allianceDisagree = await applyDigitalUseNodeSemantics(
      ctx('A2008', { decision: 'DISAGREE' }, [marker])
    );
    expect(allianceDisagree.conditions).toEqual({
      FAMILY_ALLIANCE_AGREED: false,
      FAMILY_ALLIANCE_DECLINED: true,
    });
    expect(routeDigitalUseTopology({
      sceneCode: 'DIGITAL_USE',
      packageVersion: 'v1',
      currentNodeCode: 'A2008',
      conditions: allianceDisagree.conditions,
    })).toMatchObject({ kind: 'TERMINAL_ROUTE', terminalCode: 'MAIN' });
  });

  it('A2009 never converts uncertainty into agreement', async () => {
    // A2009 UNKNOWN preserves UNKNOWN and fails closed in routing
    const a2009Unknown = await applyDigitalUseNodeSemantics(
      ctx('A2009', { decision: 'UNKNOWN' }, [marker])
    );
    expect(a2009Unknown.conditions).toEqual({
      RELATIONSHIP_ASSESSMENT_AGREED: 'UNKNOWN',
      RELATIONSHIP_ASSESSMENT_DECLINED: 'UNKNOWN',
    });
    expect(routeDigitalUseTopology({
      sceneCode: 'DIGITAL_USE',
      packageVersion: 'v1',
      currentNodeCode: 'A2009',
      conditions: a2009Unknown.conditions,
    })).toMatchObject({ kind: 'UNKNOWN', code: 'UNKNOWN_OR_UNSUPPORTED_CONDITION' });

    const a2009Disagree = await applyDigitalUseNodeSemantics(
      ctx('A2009', { decision: 'DISAGREE' }, [marker])
    );
    expect(a2009Disagree.conditions).toEqual({
      RELATIONSHIP_ASSESSMENT_AGREED: false,
      RELATIONSHIP_ASSESSMENT_DECLINED: true,
    });
    expect(routeDigitalUseTopology({
      sceneCode: 'DIGITAL_USE',
      packageVersion: 'v1',
      currentNodeCode: 'A2009',
      conditions: a2009Disagree.conditions,
    })).toMatchObject({ kind: 'TERMINAL_ROUTE', terminalCode: 'MAIN' });
  });

  it('Finding #5: A2004, A2005 preserve UNKNOWN/DECLINED and route only on explicit negative values', async () => {
    // A2004
    const a2004Unknown = await applyDigitalUseNodeSemantics(
      ctx('A2004', { decision: 'UNKNOWN' })
    );
    expect(a2004Unknown.conditions).toEqual({
      COLLABORATIVE_DURATION_YES: 'UNKNOWN',
      COLLABORATIVE_DURATION_NO: 'UNKNOWN',
    });
    expect(routeDigitalUseTopology({
      sceneCode: 'DIGITAL_USE',
      packageVersion: 'v1',
      currentNodeCode: 'A2004',
      conditions: a2004Unknown.conditions,
    })).toMatchObject({ kind: 'UNKNOWN', code: 'UNKNOWN_OR_UNSUPPORTED_CONDITION' });

    const a2004No = await applyDigitalUseNodeSemantics(
      ctx('A2004', { decision: 'NO' })
    );
    expect(a2004No.conditions).toEqual({
      COLLABORATIVE_DURATION_YES: false,
      COLLABORATIVE_DURATION_NO: true,
    });
    expect(routeDigitalUseTopology({
      sceneCode: 'DIGITAL_USE',
      packageVersion: 'v1',
      currentNodeCode: 'A2004',
      conditions: a2004No.conditions,
    })).toMatchObject({ kind: 'NODE_ROUTE', nextNodeCode: 'A2006' });

    // A2005
    const a2005Declined = await applyDigitalUseNodeSemantics(
      ctx('A2005', { decision: 'DECLINED' }, [marker])
    );
    expect(a2005Declined.conditions).toEqual({
      SOLUTION_APPROACH_WILLING: 'DECLINED',
      SOLUTION_APPROACH_UNWILLING: 'DECLINED',
    });
    expect(routeDigitalUseTopology({
      sceneCode: 'DIGITAL_USE',
      packageVersion: 'v1',
      currentNodeCode: 'A2005',
      conditions: a2005Declined.conditions,
    })).toMatchObject({ kind: 'UNKNOWN', code: 'UNKNOWN_OR_UNSUPPORTED_CONDITION' });

    const a2005Unwilling = await applyDigitalUseNodeSemantics(
      ctx('A2005', { decision: 'UNWILLING' }, [marker])
    );
    expect(a2005Unwilling.conditions).toEqual({
      SOLUTION_APPROACH_WILLING: false,
      SOLUTION_APPROACH_UNWILLING: true,
    });
    expect(routeDigitalUseTopology({
      sceneCode: 'DIGITAL_USE',
      packageVersion: 'v1',
      currentNodeCode: 'A2005',
      conditions: a2005Unwilling.conditions,
    })).toMatchObject({ kind: 'NODE_ROUTE', nextNodeCode: 'A2008' });
  });

  it('mechanically routes A2001 advice/continue and A2002 further-assessment through the sole Slice 11 router', async () => {
    const advice = await applyDigitalUseNodeSemantics(
      ctx('A2001', { choice: 'GENERAL_ADVICE' }, [marker])
    );
    expect(routeDigitalUseTopology({
      sceneCode: 'DIGITAL_USE',
      packageVersion: 'v1',
      currentNodeCode: 'A2001',
      conditions: advice.conditions,
    })).toMatchObject({ kind: 'NODE_ROUTE', nextNodeCode: 'A1000' });

    const continueCurrent = await applyDigitalUseNodeSemantics(
      ctx('A2001', { choice: 'CONTINUE_DIGITAL_USE' }, [marker])
    );
    expect(routeDigitalUseTopology({
      sceneCode: 'DIGITAL_USE',
      packageVersion: 'v1',
      currentNodeCode: 'A2001',
      conditions: continueCurrent.conditions,
    })).toMatchObject({ kind: 'NODE_ROUTE', nextNodeCode: 'A2003' });

    const further = await applyDigitalUseNodeSemantics(
      ctx('A2002', { choice: 'FURTHER_ASSESSMENT' }, [marker])
    );
    expect(routeDigitalUseTopology({
      sceneCode: 'DIGITAL_USE',
      packageVersion: 'v1',
      currentNodeCode: 'A2002',
      conditions: further.conditions,
    })).toMatchObject({ kind: 'NODE_ROUTE', nextNodeCode: '01004' });
  });

  it('keeps initial A2003 truth distinct from later explicit continue choice', async () => {
    const fromA2001 = await applyDigitalUseNodeSemantics(
      ctx('A2001', { choice: 'CONTINUE_DIGITAL_USE' }, [marker])
    );
    expect(fromA2001.conditions.USER_CONTINUES_DIGITAL_USE).toBe(true);
    expect(recordStatement.mock.calls.at(-1)?.[2].content)
      .toContain('DUA:v1:a2001.user_choice:');
    expect(recordStatement.mock.calls.at(-1)?.[2].content)
      .not.toContain('a1001.impact.');

    const fromA2002 = await applyDigitalUseNodeSemantics(
      ctx('A2002', { choice: 'CONTINUE_DIGITAL_USE' }, [marker])
    );
    expect(fromA2002.conditions.USER_CONTINUES_DIGITAL_USE).toBe(true);
    expect(recordStatement.mock.calls.at(-1)?.[2].content)
      .toContain('DUA:v1:a2002.user_choice:');
    expect(recordStatement.mock.calls.at(-1)?.[2].content)
      .not.toContain('a1001.impact.');
  });
});
