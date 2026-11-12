import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { digitalUseNodeManifest } from '../../../packages/scenes/digital-use/node-manifest.js';
import { normalizeDigitalUseSourceNodeCode, validateDigitalUseManifest } from '../../../packages/scenes/digital-use/validators.js';

const snapshot = JSON.parse(
  readFileSync(new URL('../../fixtures/digital-use/v1-product-node-manifest.snapshot.json', import.meta.url), 'utf8')
) as { nodes: Array<{ nodeCode: string; sourceNodeCode: string }> };

describe('Slice 11 source identity', () => {
  it('round-trips every source identity and preserves approved presentation literals', () => {
    const expected = new Map(snapshot.nodes.map((node) => [node.nodeCode, node.sourceNodeCode]));
    for (const node of digitalUseNodeManifest) {
      expect(node.sourceNodeCode).toBe(expected.get(node.nodeCode));
      expect(normalizeDigitalUseSourceNodeCode(node.sourceNodeCode)).toBe(node.nodeCode);
    }
    expect(expected.get('01002')).toBe('01002');
    expect(expected.get('A2010')).toBe('A 2010');
    expect(expected.get('A3070')).toBe('A 3070');
    expect(expected.get('A4002')).toBe('A 4002');
  });

  it('rejects duplicate normalized source identity', () => {
    const mutated = digitalUseNodeManifest.map((node) => ({ ...node })) as any[];
    mutated[1] = { ...mutated[1], sourceNodeCode: mutated[0].sourceNodeCode };
    const result = validateDigitalUseManifest(mutated, snapshot.nodes.map((node) => node.nodeCode));
    expect(result.valid).toBe(false);
    expect(result.issues.map((item) => item.code)).toContain('DUPLICATE_SOURCE_IDENTITY');
  });
});
