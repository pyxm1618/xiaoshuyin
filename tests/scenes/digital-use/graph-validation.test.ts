import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { digitalUseNodeManifest } from '../../../packages/scenes/digital-use/node-manifest.js';
import { validateDigitalUseManifest } from '../../../packages/scenes/digital-use/validators.js';

const snapshot = JSON.parse(
  readFileSync(new URL('../../fixtures/digital-use/v1-product-node-manifest.snapshot.json', import.meta.url), 'utf8')
) as { nodes: Array<{ nodeCode: string }> };

const expectedCodes = snapshot.nodes.map((node) => node.nodeCode);

describe('Slice 11 core manifest validators', () => {
  it('passes the canonical manifest structural/target/branch checks', () => {
    expect(validateDigitalUseManifest(digitalUseNodeManifest, expectedCodes)).toEqual({ valid: true, issues: [] });
  });

  it.each([
    ['missing node', (copy: any[]) => copy.filter((node) => node.nodeCode !== 'A3033'), 'INVENTORY_COUNT'],
    ['extra node', (copy: any[]) => [...copy, { ...copy[0], nodeCode: 'A9999', sourceNodeCode: 'A9999' }], 'INVENTORY_COUNT'],
    ['duplicate node', (copy: any[]) => [...copy.slice(0, -1), { ...copy[0] }], 'DUPLICATE_NODE_CODE'],
    ['invalid target', (copy: any[]) => copy.map((node) => node.nodeCode === 'A1001' ? { ...node, allowedNext: [{ ...node.allowedNext[0], targetNodeCode: 'A9999' }] } : node), 'INVALID_NODE_TARGET'],
    ['missing reason', (copy: any[]) => copy.map((node) => node.nodeCode === 'A1001' ? { ...node, allowedNext: [{ ...node.allowedNext[0], reasonCode: '', reason: '' }] } : node), 'MISSING_BRANCH_REASON'],
    ['hidden default', (copy: any[]) => copy.map((node) => node.nodeCode === 'A1001' ? { ...node, allowedNext: [{ ...node.allowedNext[0], conditionRef: 'DEFAULT' }] } : node), 'HIDDEN_DEFAULT_BRANCH'],
    ['A200401 promoted', (copy: any[]) => [...copy.slice(0, -1), { ...copy[0], nodeCode: 'A200401', sourceNodeCode: 'A200401' }], 'A200401_IS_NOT_NODE'],
    ['gap fill invented', (copy: any[]) => [...copy.slice(0, -1), { ...copy[0], nodeCode: 'A3023', sourceNodeCode: 'A3023' }], 'INVENTED_GAP_FILL_NODE'],
  ])('rejects %s', (_name, mutate, expectedIssue) => {
    const result = validateDigitalUseManifest(mutate(digitalUseNodeManifest.map((node) => ({ ...node })) as any[]), expectedCodes);
    expect(result.valid).toBe(false);
    expect(result.issues.map((item) => item.code)).toContain(expectedIssue);
  });
});
