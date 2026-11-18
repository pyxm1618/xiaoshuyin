import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { digitalUseNodeManifest } from '../../../packages/scenes/digital-use/node-manifest.js';

const snapshot = JSON.parse(
  readFileSync(new URL('../../fixtures/digital-use/v1-product-node-manifest.snapshot.json', import.meta.url), 'utf8')
) as { nodes: Array<{ nodeCode: string }>; nonNodeMarkers: Array<{ code: string }>; forbiddenGapFillNodeCodes: string[] };

describe('Slice 11 production manifest completeness', () => {
  it('matches the independent exact 75-node inventory with no missing or extra node', () => {
    const actual = digitalUseNodeManifest.map((node) => node.nodeCode);
    const expected = snapshot.nodes.map((node) => node.nodeCode);
    expect(actual).toHaveLength(75);
    expect(new Set(actual).size).toBe(75);
    expect([...actual].sort()).toEqual([...expected].sort());
  });

  it('preserves sparse identity and never promotes A200401 to a node', () => {
    const actual = digitalUseNodeManifest.map((node) => node.nodeCode);
    expect(actual.filter((code) => code === 'A3033')).toHaveLength(1);
    for (const forbidden of snapshot.forbiddenGapFillNodeCodes) expect(actual).not.toContain(forbidden);
    expect(actual).not.toContain('A200401');
    expect(snapshot.nonNodeMarkers.map((marker) => marker.code)).toContain('A200401');
    expect(digitalUseNodeManifest.find((node) => node.nodeCode === 'A2003')?.recordContract.refs).toContain('A200401');
  });

  it('keeps A5001 and A5002 distinct', () => {
    const a5001 = digitalUseNodeManifest.find((node) => node.nodeCode === 'A5001');
    const a5002 = digitalUseNodeManifest.find((node) => node.nodeCode === 'A5002');
    expect(a5001?.role).toBe('FAMILY_ALLIANCE_REVIEW');
    expect(a5002?.role).toBe('PHONE_USE_CONTRACT_REVIEW');
  });

  it('gives every non-root canonical node an explicit routed or activation incoming edge', () => {
    const incoming = new Map(digitalUseNodeManifest.map((node) => [node.nodeCode, 0]));
    for (const node of digitalUseNodeManifest) {
      for (const route of node.allowedNext) {
        if (route.kind === 'NODE' && incoming.has(route.targetNodeCode)) {
          incoming.set(route.targetNodeCode, (incoming.get(route.targetNodeCode) ?? 0) + 1);
        }
      }
      for (const activation of node.activationFrom ?? []) {
        expect(incoming.has(activation.sourceNodeCode)).toBe(true);
        incoming.set(node.nodeCode, (incoming.get(node.nodeCode) ?? 0) + 1);
      }
    }
    expect([...incoming].filter(([code, count]) => code !== 'A1001' && count === 0)).toEqual([]);
  });

  it('binds the closeout nodes to explicit prerequisites and input contracts', () => {
    const byCode = new Map(digitalUseNodeManifest.map((node) => [node.nodeCode, node]));
    expect(byCode.get('A4001')).toMatchObject({
      prerequisites: ['A2010_COMPLETED', 'CURRENT_PROBLEM_FORMULATION_CONFIRMED'],
      inputSchemaRefs: ['A4001Response'],
    });
    expect(byCode.get('A5001')).toMatchObject({
      prerequisites: [
        'A3000_COMPLETED',
        'A3002_COMPLETED',
        'CURRENT_SELECTED_TARGET_PRESENT',
        'PROFESSIONAL_REVIEW_PACKAGE_APPROVED_PUBLISHED',
      ],
      inputSchemaRefs: ['A5001FamilyAllianceReviewSubmission'],
    });
    expect(byCode.get('A5002')).toMatchObject({
      prerequisites: [
        'ACTIVE_PHONE_USE_CONTRACT_VERSION',
        'PROFESSIONAL_REVIEW_PACKAGE_APPROVED_PUBLISHED',
      ],
      inputSchemaRefs: ['A5002PhoneUseContractReviewSubmission'],
    });
  });
});
