import { describe, expect, it } from 'vitest';
import { DigitalUseNodeResponse } from '@xiaoshuyin/contracts';
import { resolveDigitalUseRuntimeNode } from '@xiaoshuyin/scenes/digital-use';

describe('T1208 authorized Scene/node read contracts', () => {
  it('keeps A200401 and fabricated identities non-addressable', () => {
    expect(() => resolveDigitalUseRuntimeNode('A200401')).toThrow('SCENE_NODE_NOT_FOUND');
    expect(() => resolveDigitalUseRuntimeNode('A999999')).toThrow('SCENE_NODE_NOT_FOUND');
  });

  it('requires server-owned package/case/node state in node response', () => {
    const parsed = DigitalUseNodeResponse.safeParse({
      caseId: '00000000-0000-7000-8000-000000000001',
      caseVersion: 2,
      sceneCode: 'DIGITAL_USE',
      scenePackageVersion: 'v1',
      node: {
        nodeCode: 'A1001',
        sourceNodeCode: 'A1001',
        status: 'AVAILABLE',
        revision: 1,
        branchReasonCodes: [],
        inputRefs: [],
        outputRefs: [],
        enteredAt: '2026-11-13T00:00:00.000Z',
        completedAt: null,
      },
      artifacts: [],
      routeReasonCode: null,
      downstream: { routeIntent: null, available: true, reasonCode: null },
    });
    expect(parsed.success).toBe(true);
    expect(DigitalUseNodeResponse.safeParse({
      ...(parsed.success ? parsed.data : {}),
      scenePackageVersion: 'client-chosen-v2',
    }).success).toBe(false);
  });
});
