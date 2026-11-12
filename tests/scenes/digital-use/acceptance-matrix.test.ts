import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { digitalUseNodeManifest } from '../../../packages/scenes/digital-use/node-manifest.js';
import { routeDigitalUseTopology } from '../../../packages/scenes/digital-use/routing.js';
import { normalizeDigitalUseSourceNodeCode, validateDigitalUseGraph } from '../../../packages/scenes/digital-use/validators.js';

const snapshot = JSON.parse(
  readFileSync(new URL('../../fixtures/digital-use/v1-product-node-manifest.snapshot.json', import.meta.url), 'utf8')
);
const byCode = new Map(digitalUseNodeManifest.map((node) => [node.nodeCode, node] as const));

function routed(from: string, condition: string, basis?: string[]) {
  return routeDigitalUseTopology({
    sceneCode: 'DIGITAL_USE', packageVersion: 'v1', currentNodeCode: from,
    conditions: { [condition]: true },
    ...(basis ? { evidenceBasis: basis as any } : {}),
  });
}

describe('Slice 11 frozen acceptance scenario matrix', () => {
  it('AS01–AS06 inventory/source/record/current-authority invariants', () => {
    expect(digitalUseNodeManifest).toHaveLength(75);
    expect(byCode.has('A3033')).toBe(true);
    expect(normalizeDigitalUseSourceNodeCode(byCode.get('A2010')!.sourceNodeCode)).toBe('A2010');
    expect(byCode.has('A200401')).toBe(false);
    expect(byCode.get('A2003')?.recordContract.refs).toContain('A200401');
    expect(byCode.get('A1001')?.inputSchemaRefs).toEqual(expect.arrayContaining(['DEVICE_COMPUTER','DEVICE_GAME_CONSOLE_OR_DEVICE']));
    expect(byCode.get('A1001')?.policyRefs).toContain('NO_UNIVERSAL_AGE_SIX_SCENE_GATE');
  });

  it('AS07–AS11 integrated triage, priority and decision branches', () => {
    expect(routed('01003','TRIAGE_NO_INTERVENTION_INTEGRATED',['TOTAL_DURATION'])).toMatchObject({kind:'BLOCKED'});
    expect(routed('01002','EMOTION_SEVERE_F')).toMatchObject({kind:'NODE_ROUTE',nextNodeCode:'01005'});
    expect(routed('01003','FAMILY_CONFLICT_SEVERE_F')).toMatchObject({kind:'NODE_ROUTE',nextNodeCode:'01006'});
    expect(routed('A2004','COLLABORATIVE_DURATION_YES')).toMatchObject({kind:'NODE_ROUTE',nextNodeCode:'A2005'});
    expect(routed('A2004','COLLABORATIVE_DURATION_NO')).toMatchObject({kind:'NODE_ROUTE',nextNodeCode:'A2006'});
    expect(routed('A2005','SOLUTION_APPROACH_WILLING')).toMatchObject({nextNodeCode:'A2007'});
    expect(routed('A2005','SOLUTION_APPROACH_UNWILLING')).toMatchObject({nextNodeCode:'A2008'});
    expect(routed('A2006','MOTIVATION_RECONSIDER_WILLING')).toMatchObject({nextNodeCode:'A2005'});
    expect(routed('A2006','MOTIVATION_RECONSIDER_UNWILLING')).toMatchObject({nextNodeCode:'A2009'});
    expect(routed('A2008','FAMILY_ALLIANCE_AGREED')).toMatchObject({nextNodeCode:'A2007'});
    expect(routed('A2009','RELATIONSHIP_ASSESSMENT_AGREED')).toMatchObject({nextNodeCode:'01004'});
  });

  it('AS12–AS21 family/contract/review topology remains distinct and non-linear', () => {
    expect(routed('A3000','FAMILY_ALLIANCE_SELF_ASSESSMENT_COMPLETE')).toMatchObject({nextNodeCode:'A3001'});
    expect(byCode.get('A3001')?.canRunInParallelWith).toContain('A3002');
    const graph=validateDigitalUseGraph(digitalUseNodeManifest,snapshot.nodes.map((n:any)=>n.nodeCode));
    expect(graph.orphanNodeCodes).toEqual([]);
    expect(byCode.get('A4001')?.role).toBe('CONTRACT_PREPARATION_QUIZ');
    expect(byCode.get('A4003')?.policyRefs).toEqual(expect.arrayContaining(['ADULT_GUARDIAN_ONLY_SIMULATION','COMPLIANCE_INDEPENDENT_GATE']));
    for(const code of ['A4004','A4005','A4006','A4007','A4008','A4009']) expect(byCode.has(code)).toBe(true);
    expect(routed('A4010','FORMAL_CONTRACT_CONFIRMED')).toMatchObject({nextNodeCode:'A4011'});
    expect(byCode.get('A4012')?.helpOrReentryRefs).toContain('A4011_EXECUTION_REENTRY');
    expect(byCode.get('A3000')?.canRunInParallelWith).toContain('A4001');
    expect(byCode.get('A5001')?.role).toBe('FAMILY_ALLIANCE_REVIEW');
    expect(byCode.get('A5002')?.role).toBe('PHONE_USE_CONTRACT_REVIEW');
  });

  it('AS31–AS35 model input cannot authorize, routing is deterministic, UI consolidation cannot erase nodes, no-match fails closed', async () => {
    const input={sceneCode:'DIGITAL_USE' as const,packageVersion:'v1' as const,currentNodeCode:'A2004',conditions:{COLLABORATIVE_DURATION_YES:true}};
    const [a,b]=await Promise.all([Promise.resolve(routeDigitalUseTopology(input)),Promise.resolve(routeDigitalUseTopology(input))]);
    expect(a).toEqual(b);
    expect(a.authority).toBe('TOPOLOGY_ONLY');
    expect(digitalUseNodeManifest.map((node)=>node.nodeCode)).toEqual(expect.arrayContaining(['A3000','A3001','A3002','A4001','A4002','A4003','A5001','A5002']));
    expect(routeDigitalUseTopology({...input,conditions:{}})).toMatchObject({kind:'BLOCKED',code:'NO_APPROVED_ROUTE'});
    expect(routeDigitalUseTopology({...input,conditions:{COLLABORATIVE_DURATION_YES:'CONFLICT'}})).toMatchObject({kind:'UNKNOWN'});
  });
});
