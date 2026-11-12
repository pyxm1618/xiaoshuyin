import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const snapshot = JSON.parse(
  readFileSync(new URL('../../fixtures/digital-use/v1-product-node-manifest.snapshot.json', import.meta.url), 'utf8')
) as {
  frozenSpecBlob: string;
  nodes: Array<{ nodeCode: string; sourceNodeCode: string }>;
  nonNodeMarkers: Array<{ code: string }>;
  forbiddenGapFillNodeCodes: string[];
  authorityRegression: {
    deviceScope: string[];
    universalAgeSixEligibilityGate: boolean;
    durationOnlyRoutingForbidden: boolean;
    integratedEvidenceBasis: string[];
  };
};

describe('Slice 11 independent canonical product snapshot', () => {
  it('is pinned to the Frozen Spec and exact 75-node inventory', () => {
    expect(snapshot.frozenSpecBlob).toBe('8d47a2b8ad0431540598ceecef14550bd383fe1f');
    expect(snapshot.nodes).toHaveLength(75);
    expect(new Set(snapshot.nodes.map((node) => node.nodeCode)).size).toBe(75);
  });

  it('preserves sparse identity and A200401 as record marker only', () => {
    const codes = snapshot.nodes.map((node) => node.nodeCode);
    expect(codes).toContain('A3033');
    expect(snapshot.forbiddenGapFillNodeCodes).toEqual(['A3023', 'A3030', 'A3031', 'A3032']);
    for (const forbidden of snapshot.forbiddenGapFillNodeCodes) expect(codes).not.toContain(forbidden);
    expect(codes).not.toContain('A200401');
    expect(snapshot.nonNodeMarkers.map((marker) => marker.code)).toContain('A200401');
  });

  it('preserves source literals and remediated authority semantics independently of production code', () => {
    const byCode = new Map(snapshot.nodes.map((node) => [node.nodeCode, node.sourceNodeCode]));
    expect(byCode.get('01002')).toBe('01002');
    expect(byCode.get('A2010')).toBe('A 2010');
    expect(byCode.get('A3070')).toBe('A 3070');
    expect(byCode.get('A4002')).toBe('A 4002');
    expect(snapshot.authorityRegression.deviceScope).toEqual(
      expect.arrayContaining(['PHONE', 'TABLET', 'COMPUTER', 'GAME_CONSOLE_OR_DEVICE', 'RELATED_DIGITAL_DEVICE'])
    );
    expect(snapshot.authorityRegression.universalAgeSixEligibilityGate).toBe(false);
    expect(snapshot.authorityRegression.durationOnlyRoutingForbidden).toBe(true);
    expect(snapshot.authorityRegression.integratedEvidenceBasis).toEqual(
      expect.arrayContaining(['FUNCTIONAL_IMPACT', 'SLEEP', 'REAL_WORLD_ACTIVITY_DISPLACEMENT', 'EMOTION', 'FAMILY_RELATIONSHIP_OR_CONFLICT'])
    );
  });
});
