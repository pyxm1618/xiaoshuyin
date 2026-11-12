import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { digitalUseNodeManifest } from '../../../packages/scenes/digital-use/node-manifest.js';
import {
  validateDigitalUseGraph,
  validateDigitalUseParallelFidelity,
} from '../../../packages/scenes/digital-use/validators.js';

const snapshot = JSON.parse(
  readFileSync(new URL('../../fixtures/digital-use/v1-product-node-manifest.snapshot.json', import.meta.url), 'utf8')
) as {
  nodes: Array<{ nodeCode: string }>;
  parallelRelations: Array<{ left: string; right: string; semantics: string }>;
};

const expectedCodes = snapshot.nodes.map((node) => node.nodeCode);

describe('Slice 11 parallel fidelity', () => {
  it('preserves both approved parallel relations symmetrically', () => {
    expect(validateDigitalUseParallelFidelity(digitalUseNodeManifest, snapshot.parallelRelations)).toEqual({
      valid: true,
      issues: [],
    });
  });

  it('keeps FAMILY_ALLIANCE independently reachable if contract participation is absent', () => {
    const withoutContract = digitalUseNodeManifest.filter(
      (node) => node.stream !== 'PHONE_USE_CONTRACT' && node.nodeCode !== 'A5002'
    ) as any[];
    const familyNodes = withoutContract.filter(
      (node) => node.stream === 'FAMILY_ALLIANCE' || node.stream === 'FAMILY_ALLIANCE_REVIEW'
    );
    expect(familyNodes.map((node) => node.nodeCode)).toEqual(expect.arrayContaining(['A3000', 'A3001', 'A3002', 'A5001']));
    expect(familyNodes.map((node) => node.nodeCode)).not.toContain('A5002');
  });

  it('fails if the solution-stream activation relation is omitted rather than serialising it', () => {
    const mutated = digitalUseNodeManifest.map((node) => {
      if (node.nodeCode === 'A3000') return { ...node, canRunInParallelWith: [] as const };
      if (node.nodeCode === 'A4001') return { ...node, canRunInParallelWith: [] as const };
      return { ...node };
    }) as any[];

    const parallel = validateDigitalUseParallelFidelity(mutated, snapshot.parallelRelations);
    expect(parallel.valid).toBe(false);
    expect(parallel.issues.map((item) => item.code)).toContain('MISSING_PARALLEL_RELATION');

    const graph = validateDigitalUseGraph(mutated, expectedCodes);
    expect(graph.orphanNodeCodes).toEqual(expect.arrayContaining(['A4001', 'A4002', 'A4003', 'A4004']));
  });

  it('fails if A3001/A3002 parallel work is made one-sided', () => {
    const mutated = digitalUseNodeManifest.map((node) =>
      node.nodeCode === 'A3002' ? { ...node, canRunInParallelWith: [] as const } : { ...node }
    ) as any[];
    const result = validateDigitalUseParallelFidelity(mutated, snapshot.parallelRelations);
    expect(result.valid).toBe(false);
    expect(result.issues.map((item) => item.code)).toContain('ASYMMETRIC_PARALLEL_RELATION');
  });

  it('keeps A5001 and A5002 as separate review scopes', () => {
    const a5001 = digitalUseNodeManifest.find((node) => node.nodeCode === 'A5001');
    const a5002 = digitalUseNodeManifest.find((node) => node.nodeCode === 'A5002');
    expect(a5001?.stream).toBe('FAMILY_ALLIANCE_REVIEW');
    expect(a5002?.stream).toBe('PHONE_USE_CONTRACT_REVIEW');
    expect(a5001?.role).not.toBe(a5002?.role);
  });
});
