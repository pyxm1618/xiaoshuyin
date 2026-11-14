import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

const {
  getLatestSceneArtifact,
  insertSceneArtifact,
} = vi.hoisted(() => ({
  getLatestSceneArtifact: vi.fn(),
  insertSceneArtifact: vi.fn(),
}));

vi.mock('@xiaoshuyin/domain', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@xiaoshuyin/domain')>();
  return { ...actual, getLatestSceneArtifact, insertSceneArtifact };
});

import { applyDigitalUseNodeSemantics } from '../../apps/server/api/src/services/digital-use-node-semantics.js';

const actor = {
  accountId: '00000000-0000-7000-8000-000000000001',
  personId: '00000000-0000-7000-8000-000000000002',
};
const familyId = '00000000-0000-7000-8000-000000000003';
const caseId = '00000000-0000-7000-8000-000000000004';
const evidenceRef = {
  type: 'ASSERTION' as const,
  id: '00000000-0000-7000-8000-000000000010',
};

function ctx(nodeCode: string, response: Record<string, unknown>) {
  return {
    tx: {} as never,
    actor,
    familyId,
    caseId,
    nodeCode,
    response,
    currentInputRefs: [evidenceRef],
  };
}

describe('T1214 A2007 timeline artifact', () => {
  beforeEach(() => {
    getLatestSceneArtifact.mockReset();
    insertSceneArtifact.mockReset();
    getLatestSceneArtifact.mockResolvedValue(null);
    insertSceneArtifact.mockResolvedValue({
      id: '00000000-0000-7000-8000-000000000020',
      revision: 1,
    });
  });

  it('persists only user-entered timeline + draft follow-up basis', async () => {
    const result = await applyDigitalUseNodeSemantics(
      ctx('A2007', {
        timeline: {
          chosenDate: '2026-12-01',
          note: 'family chose this date',
        },
      })
    );
    expect(result.conditions).toEqual({ TIMELINE_SET: true });
    const input = insertSceneArtifact.mock.calls[0]![1];
    expect(input).toMatchObject({
      artifactType: 'TIMELINE',
      sourceNodeCode: 'A2007',
      revision: 1,
      sourceRefs: [evidenceRef],
    });
    expect(input.data).toEqual({
      timeline: {
        chosenDate: '2026-12-01',
        note: 'family chose this date',
      },
      followUpBasis: {
        kind: 'DRAFT_ONLY',
        schedulerCreated: false,
        notificationScheduled: false,
        notificationDelivered: false,
      },
    });
  });

  it('uses append-only supersession for a legal later artifact revision', async () => {
    getLatestSceneArtifact.mockResolvedValueOnce({
      id: '00000000-0000-7000-8000-000000000019',
      revision: 2,
    });
    await applyDigitalUseNodeSemantics(
      ctx('A2007', { timeline: { chosenDate: '2026-12-08' } })
    );
    expect(insertSceneArtifact.mock.calls[0]![1]).toMatchObject({
      revision: 3,
      supersedesId: '00000000-0000-7000-8000-000000000019',
    });
  });

  it('contains no scheduler/job/notification delivery implementation', () => {
    const source = readFileSync(
      new URL('../../apps/server/api/src/services/digital-use-node-semantics.ts', import.meta.url),
      'utf8'
    );
    expect(source).not.toMatch(/case_followup_schedules|pg-boss|enqueue\s*\(|INSERT\s+INTO\s+notifications/i);
  });
});

describe('T1215 A2010 solution summary boundary', () => {
  beforeEach(() => {
    getLatestSceneArtifact.mockReset();
    insertSceneArtifact.mockReset();
    getLatestSceneArtifact.mockImplementation(
      async (_tx: unknown, _caseId: string, type: string) => {
        if (type === 'TIMELINE') {
          return {
            id: '00000000-0000-7000-8000-000000000030',
            revision: 1,
            data: {
              timeline: { chosenDate: '2026-12-01' },
              followUpBasis: {
                kind: 'DRAFT_ONLY',
                schedulerCreated: false,
                notificationScheduled: false,
                notificationDelivered: false,
              },
            },
          };
        }
        return null;
      }
    );
    insertSceneArtifact.mockResolvedValue({
      id: '00000000-0000-7000-8000-000000000040',
      revision: 1,
    });
  });

  it('builds deterministic summary and exposes A3000 only as unavailable intent', async () => {
    const first = await applyDigitalUseNodeSemantics(
      ctx('A2010', { action: 'GENERATE_SUMMARY' })
    );
    const write = insertSceneArtifact.mock.calls[0]![1];
    expect(write.artifactType).toBe('SOLUTION_SUMMARY');
    expect(write.sourceNodeCode).toBe('A2010');
    expect(write.sourceRefs).toContainEqual({
      type: 'SCENE_ARTIFACT',
      id: '00000000-0000-7000-8000-000000000030',
    });
    expect(write.data).toMatchObject({
      activation: {
        activePlan: false,
        interventionActive: false,
        executionActive: false,
      },
      downstream: {
        routeIntent: 'A3000',
        available: false,
        reasonCode: 'DOWNSTREAM_RUNTIME_UNAVAILABLE',
      },
    });
    expect(first.conditions).toEqual({ SOLUTION_STAGE_READY: true });
  });

  it('creates no A3000 state or downstream business truth in semantics', () => {
    const source = readFileSync(
      new URL('../../apps/server/api/src/services/digital-use-node-semantics.ts', import.meta.url),
      'utf8'
    );
    expect(source).not.toMatch(/insertSceneNodeState\([^)]*A3000|activateFamilyAlliance|createIntervention|createGoal|createPlan/i);
  });
});
