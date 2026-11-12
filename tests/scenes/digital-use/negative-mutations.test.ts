import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { digitalUseNodeManifest } from '../../../packages/scenes/digital-use/node-manifest.js';
import { routeDigitalUseTopology } from '../../../packages/scenes/digital-use/routing.js';
import {
  validateDigitalUseGraph,
  validateDigitalUseManifest,
  validateDigitalUseParallelFidelity,
  validateDigitalUseSnapshotFidelity,
} from '../../../packages/scenes/digital-use/validators.js';

const snapshot = JSON.parse(
  readFileSync(new URL('../../fixtures/digital-use/v1-product-node-manifest.snapshot.json', import.meta.url), 'utf8')
);
const expectedCodes = snapshot.nodes.map((node: any) => node.nodeCode);
const clone = () => digitalUseNodeManifest.map((node) => structuredClone(node)) as any[];

function issueCodes(result: { issues: readonly { code: string }[] }) {
  return result.issues.map((item) => item.code);
}

function authorityMutationIssues(manifest: any[]): string[] {
  const issues: string[] = [];
  const a1001 = manifest.find((node) => node.nodeCode === 'A1001');
  const refs = new Set(a1001?.inputSchemaRefs ?? []);
  for (const required of [
    'DEVICE_PHONE','DEVICE_TABLET','DEVICE_COMPUTER','DEVICE_GAME_CONSOLE_OR_DEVICE','DEVICE_RELATED_DIGITAL_DEVICE',
    'PURPOSE_LEARNING_RESEARCH_HOMEWORK','PURPOSE_NECESSARY_CONTACT','PURPOSE_ENTERTAINMENT_GAMING_VIDEO_SOCIAL_NON_LEARNING',
    'DURATION_PER_PURPOSE','TOTAL_DURATION_AUXILIARY_ONLY','HISTORICAL_DURATION_BAND_AUXILIARY_ONLY',
    'FUNCTIONAL_IMPACT','SLEEP','REAL_WORLD_ACTIVITY_DISPLACEMENT','EMOTION_EVIDENCE_01002',
    'FAMILY_RELATIONSHIP_OR_CONFLICT_EVIDENCE_01003','OTHER_APPROVED_EVIDENCE',
  ]) if (!refs.has(required)) issues.push('AUTHORITY_FIELD_MISSING');
  if ((a1001?.policyRefs ?? []).some((ref: string) => /AGE.*6.*(?:GATE|BLOCK|INELIGIBLE)|UNDER_?6.*(?:GATE|BLOCK|INELIGIBLE)/i.test(ref))) {
    issues.push('UNIVERSAL_AGE_SIX_GATE');
  }
  return issues;
}

describe('Slice 11 required negative mutation fixtures', () => {
  it('fails missing node / A3033 removed', () => {
    const mutated = clone().filter((node) => node.nodeCode !== 'A3033');
    const result = validateDigitalUseManifest(mutated, expectedCodes);
    expect(issueCodes(result)).toEqual(expect.arrayContaining(['INVENTORY_COUNT','MISSING_CANONICAL_NODE','SPARSE_A3033_FIDELITY']));
  });

  it('fails extra node', () => {
    const mutated = clone();
    mutated.push({ ...structuredClone(mutated[0]), nodeCode: 'A9999', sourceNodeCode: 'A9999' });
    expect(issueCodes(validateDigitalUseManifest(mutated, expectedCodes))).toEqual(expect.arrayContaining(['INVENTORY_COUNT','EXTRA_CANONICAL_NODE']));
  });

  it('fails duplicate node and duplicate normalized source identity', () => {
    const mutated = clone();
    mutated[1] = { ...mutated[1], nodeCode: mutated[0].nodeCode, sourceNodeCode: 'A1001' };
    const issues = issueCodes(validateDigitalUseManifest(mutated, expectedCodes));
    expect(issues).toContain('DUPLICATE_NODE_CODE');
    expect(issues).toContain('DUPLICATE_SOURCE_IDENTITY');
  });

  it('fails invalid target, missing reason and hidden default', () => {
    const invalid = clone();
    const a1001 = invalid.find((node) => node.nodeCode === 'A1001');
    a1001.allowedNext[0].targetNodeCode = 'A9999';
    expect(issueCodes(validateDigitalUseManifest(invalid, expectedCodes))).toContain('INVALID_NODE_TARGET');

    const missing = clone();
    const a2004 = missing.find((node) => node.nodeCode === 'A2004');
    a2004.allowedNext[0].reasonCode = '';
    a2004.allowedNext[0].reason = '';
    expect(issueCodes(validateDigitalUseManifest(missing, expectedCodes))).toContain('MISSING_BRANCH_REASON');

    const fallback = clone();
    fallback.find((node) => node.nodeCode === 'A2004').allowedNext[0].conditionRef = 'DEFAULT';
    expect(issueCodes(validateDigitalUseManifest(fallback, expectedCodes))).toContain('HIDDEN_DEFAULT_BRANCH');
  });

  it('fails orphan and accidental dead end', () => {
    const orphan = clone();
    const a3033 = orphan.find((node) => node.nodeCode === 'A3033');
    a3033.entryMode = ['ROUTED']; a3033.helpOrReentryRefs = [];
    expect(issueCodes(validateDigitalUseGraph(orphan, expectedCodes))).toContain('ORPHAN_NODE');

    const dead = clone();
    const a3002 = dead.find((node) => node.nodeCode === 'A3002');
    a3002.entryMode = ['ROUTED']; a3002.helpOrReentryRefs = []; a3002.canRunInParallelWith = [];
    expect(issueCodes(validateDigitalUseGraph(dead, expectedCodes))).toContain('ACCIDENTAL_DEAD_END');
  });

  it('fails missing parallel relation', () => {
    const mutated = clone();
    mutated.find((node) => node.nodeCode === 'A3001').canRunInParallelWith = [];
    expect(issueCodes(validateDigitalUseParallelFidelity(mutated, snapshot.parallelRelations))).toContain('MISSING_PARALLEL_RELATION');
  });

  it('fails invented numeric adjacency through independent snapshot drift', () => {
    const mutated = clone();
    const a4005 = mutated.find((node) => node.nodeCode === 'A4005');
    a4005.allowedNext = [{
      kind: 'NODE', targetNodeCode: 'A4006', conditionRef: 'NUMERIC_NEXT',
      reasonCode: 'NUMERIC_NEXT', reason: 'invented numeric adjacency', authorityRefs: ['V1-D43'],
    }];
    expect(issueCodes(validateDigitalUseSnapshotFidelity(mutated, snapshot))).toContain('SNAPSHOT_ROUTE_DRIFT');
  });

  it('fails A200401 promotion', () => {
    const mutated = clone();
    mutated[mutated.length - 1] = { ...mutated[0], nodeCode: 'A200401', sourceNodeCode: 'A200401' };
    expect(issueCodes(validateDigitalUseManifest(mutated, expectedCodes))).toContain('A200401_IS_NOT_NODE');
  });

  it('fails A5001/A5002 collapse', () => {
    const mutated = clone();
    const a5002 = mutated.find((node) => node.nodeCode === 'A5002');
    a5002.role = 'FAMILY_ALLIANCE_REVIEW';
    a5002.stream = 'FAMILY_ALLIANCE_REVIEW';
    const issues = issueCodes(validateDigitalUseManifest(mutated, expectedCodes));
    expect(issues).toContain('REVIEW_NODE_COLLAPSE');
  });

  it('fails restored phone/tablet-only authority semantics', () => {
    const mutated = clone();
    mutated.find((node) => node.nodeCode === 'A1001').inputSchemaRefs =
      ['DEVICE_PHONE','DEVICE_TABLET','DURATION_PER_PURPOSE'];
    expect(authorityMutationIssues(mutated)).toContain('AUTHORITY_FIELD_MISSING');
  });

  it('fails a restored universal age-six eligibility hard gate', () => {
    const mutated = clone();
    mutated.find((node) => node.nodeCode === 'A1001').policyRefs.push('UNDER_6_SCENE_INELIGIBLE_GATE');
    expect(authorityMutationIssues(mutated)).toContain('UNIVERSAL_AGE_SIX_GATE');
  });

  it('fails duration-only routing for every integrated A200x outcome', () => {
    for (const condition of ['TRIAGE_NO_INTERVENTION_INTEGRATED','TRIAGE_FURTHER_ASSESSMENT_INTEGRATED','TRIAGE_CONTINUE_DIGITAL_USE_INTEGRATED']) {
      expect(routeDigitalUseTopology({
        sceneCode: 'DIGITAL_USE', packageVersion: 'v1', currentNodeCode: '01003',
        conditions: { [condition]: true }, evidenceBasis: ['TOTAL_DURATION'],
      })).toMatchObject({ kind: 'BLOCKED', code: 'INSUFFICIENT_INTEGRATED_EVIDENCE' });
    }
  });

  it('does not allow a model-created illegal route', () => {
    const result = routeDigitalUseTopology({
      sceneCode: 'DIGITAL_USE', packageVersion: 'v1', currentNodeCode: 'A2004',
      conditions: {}, modelProposedNextNodeCode: 'A5002',
    } as any);
    expect(result).toMatchObject({ kind: 'BLOCKED', code: 'NO_APPROVED_ROUTE' });
    expect(result).not.toHaveProperty('nextNodeCode', 'A5002');
  });
});
