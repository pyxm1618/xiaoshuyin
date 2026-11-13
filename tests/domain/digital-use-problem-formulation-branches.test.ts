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
import { resolveDigitalUseRuntimeNode } from '@xiaoshuyin/scenes/digital-use';

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
    tx: {} as never,
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
    ['UNKNOWN', false, true],
    ['DECLINED', false, true],
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
    ['UNKNOWN', false, true],
    ['DECLINED', false, true],
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

    const motivation = await applyDigitalUseNodeSemantics(
      ctx('A2006', { decision: 'UNKNOWN' }, [marker])
    );
    expect(motivation.conditions).toEqual({
      MOTIVATION_RECONSIDER_WILLING: false,
      MOTIVATION_RECONSIDER_UNWILLING: true,
    });
    expect(recordStatement.mock.calls.at(-1)?.[2].content)
      .toContain('"decision":"UNKNOWN"');

    const alliance = await applyDigitalUseNodeSemantics(
      ctx('A2008', { decision: 'DECLINED' }, [marker])
    );
    expect(alliance.conditions).toEqual({
      FAMILY_ALLIANCE_AGREED: false,
      FAMILY_ALLIANCE_DECLINED: true,
    });
    expect(recordStatement.mock.calls.at(-1)?.[2].content)
      .toContain('"decision":"DECLINED"');
  });

  it('A2009 never converts uncertainty into agreement', async () => {
    const result = await applyDigitalUseNodeSemantics(
      ctx('A2009', { decision: 'UNKNOWN' }, [marker])
    );
    expect(result.conditions).toEqual({
      RELATIONSHIP_ASSESSMENT_AGREED: false,
      RELATIONSHIP_ASSESSMENT_DECLINED: true,
    });
    expect(recordStatement.mock.calls.at(-1)?.[2].content)
      .toContain('"decision":"UNKNOWN"');
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
