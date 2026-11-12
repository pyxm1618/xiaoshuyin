import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { digitalUseNodeManifest } from '../../../packages/scenes/digital-use/node-manifest.js';

const snapshot = JSON.parse(
  readFileSync(new URL('../../fixtures/digital-use/v1-product-node-manifest.snapshot.json', import.meta.url), 'utf8')
) as { forbiddenGapFillNodeCodes: string[] };

const byCode = new Map(digitalUseNodeManifest.map((node) => [node.nodeCode, node] as const));

describe('Slice 11 sparse/non-linear topology fidelity', () => {
  it('preserves A3033 exactly and never fills A3023/A3030/A3031/A3032', () => {
    expect(byCode.has('A3033')).toBe(true);
    for (const forbidden of snapshot.forbiddenGapFillNodeCodes) expect(byCode.has(forbidden)).toBe(false);
  });

  it('preserves the exact target-family identities without number+1 adjacency', () => {
    const expected = [
      'A3010','A3011','A3012','A3013',
      'A3020','A3021','A3022','A3033',
      'A3040','A3041','A3042','A3043',
      'A3050','A3051','A3052','A3053',
      'A3060','A3061','A3062','A3063',
      'A3070','A3071','A3072','A3073',
      'A3080','A3081','A3082','A3083',
      'A3090','A3091','A3092','A3093',
      'A3100','A3101','A3102','A3103',
      'A3110','A3111','A3112','A3113',
    ];
    const targetCodes = digitalUseNodeManifest
      .filter((node) => node.nodeCode.startsWith('A3') && !['A3000','A3001','A3002'].includes(node.nodeCode))
      .map((node) => node.nodeCode);
    expect([...targetCodes].sort()).toEqual([...expected].sort());
  });

  it('keeps A4004–A4009 distinct without inventing a mandatory numeric chain', () => {
    for (const code of ['A4004','A4005','A4006','A4007','A4008','A4009']) expect(byCode.has(code)).toBe(true);
    expect(byCode.get('A4004')?.allowedNext.map((route) => route.kind === 'NODE' ? route.targetNodeCode : null).filter(Boolean))
      .toEqual(['A4005','A4006','A4007','A4008','A4009']);
    for (const code of ['A4005','A4006','A4007','A4008','A4009']) {
      expect(byCode.get(code)?.allowedNext).toEqual([]);
      expect(byCode.get(code)?.helpOrReentryRefs).toContain('A4004_TOOL_CATALOG');
    }
  });

  it('keeps A5001 and A5002 separate review nodes', () => {
    expect(byCode.get('A5001')?.role).toBe('FAMILY_ALLIANCE_REVIEW');
    expect(byCode.get('A5002')?.role).toBe('PHONE_USE_CONTRACT_REVIEW');
    expect(byCode.get('A5001')?.stream).not.toBe(byCode.get('A5002')?.stream);
  });

  it('keeps A200401 only in record-contract semantics', () => {
    expect(byCode.has('A200401')).toBe(false);
    expect(byCode.get('A2003')?.recordContract.refs).toContain('A200401');
    expect(byCode.get('A2006')?.recordContract.refs).toContain('A200401');
    expect(byCode.get('A2008')?.recordContract.refs).toContain('A200401');
  });
});
