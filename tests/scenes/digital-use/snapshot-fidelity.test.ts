import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { digitalUseNodeManifest } from '../../../packages/scenes/digital-use/node-manifest.js';
import { validateDigitalUseSnapshotFidelity } from '../../../packages/scenes/digital-use/validators.js';

const snapshot = JSON.parse(
  readFileSync(new URL('../../fixtures/digital-use/v1-product-node-manifest.snapshot.json', import.meta.url), 'utf8')
);

describe('Slice 11 independent snapshot fidelity gate', () => {
  it('passes canonical production semantics against the frozen independent fixture', () => {
    expect(validateDigitalUseSnapshotFidelity(digitalUseNodeManifest, snapshot)).toEqual({
      valid: true,
      issues: [],
    });
  });

  it.each([
    ['source identity', (copy: any[]) => copy.map((node) => node.nodeCode === 'A2010' ? { ...node, sourceNodeCode: 'A2010' } : node), 'SNAPSHOT_SOURCE_DRIFT'],
    ['route target', (copy: any[]) => copy.map((node) => node.nodeCode === 'A2004' ? { ...node, allowedNext: [{ ...node.allowedNext[0], targetNodeCode: 'A2006' }, node.allowedNext[1]] } : node), 'SNAPSHOT_ROUTE_DRIFT'],
    ['entry mode', (copy: any[]) => copy.map((node) => node.nodeCode === 'A5001' ? { ...node, entryMode: ['ROUTED'] } : node), 'SNAPSHOT_ENTRY_MODE_DRIFT'],
    ['parallel relation', (copy: any[]) => copy.map((node) => node.nodeCode === 'A3001' ? { ...node, canRunInParallelWith: [] } : node), 'SNAPSHOT_PARALLEL_DRIFT'],
    ['record semantics', (copy: any[]) => copy.map((node) => node.nodeCode === 'A2003' ? { ...node, recordContract: { refs: [], semantics: node.recordContract.semantics } } : node), 'SNAPSHOT_RECORD_DRIFT'],
  ])('blocks %s drift instead of changing the snapshot', (_name, mutate, expectedIssue) => {
    const mutated = mutate(digitalUseNodeManifest.map((node) => ({ ...node })) as any[]);
    const result = validateDigitalUseSnapshotFidelity(mutated, snapshot);
    expect(result.valid).toBe(false);
    expect(result.issues.map((item) => item.code)).toContain(expectedIssue);
  });
});
