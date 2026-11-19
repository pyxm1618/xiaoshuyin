import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { digitalUseNodeManifest } from '../../../packages/scenes/digital-use/node-manifest.js';
import { routeDigitalUseTopology } from '../../../packages/scenes/digital-use/routing.js';

const snapshot = JSON.parse(
  readFileSync(new URL('../../fixtures/digital-use/v1-product-node-manifest.snapshot.json', import.meta.url), 'utf8')
) as {
  authorityRegression: {
    deviceScope: string[];
    purposeScope: string[];
    durationSemantics: string;
    universalAgeSixEligibilityGate: boolean;
    integratedEvidenceBasis: string[];
    durationOnlyRoutingForbidden: boolean;
    priorityBranches: Array<{ from: string; condition: string; to: string }>;
  };
};

describe('Slice 11 current Digital Use authority regression', () => {
  const a1001 = digitalUseNodeManifest.find((node) => node.nodeCode === 'A1001');

  it('keeps broad device scope including computer and game devices', () => {
    expect(a1001).toBeDefined();
    expect(a1001?.inputSchemaRefs).toEqual(expect.arrayContaining([
      'DEVICE_PHONE',
      'DEVICE_TABLET',
      'DEVICE_COMPUTER',
      'DEVICE_GAME_CONSOLE_OR_DEVICE',
      'DEVICE_RELATED_DIGITAL_DEVICE',
    ]));
    expect(snapshot.authorityRegression.deviceScope).toEqual(expect.arrayContaining([
      'PHONE', 'TABLET', 'COMPUTER', 'GAME_CONSOLE_OR_DEVICE', 'RELATED_DIGITAL_DEVICE',
    ]));
  });

  it('keeps purpose-separated duration and functional evidence instead of one total-duration gate', () => {
    expect(a1001?.inputSchemaRefs).toEqual(expect.arrayContaining([
      'PURPOSE_LEARNING_RESEARCH_HOMEWORK',
      'PURPOSE_NECESSARY_CONTACT',
      'PURPOSE_ENTERTAINMENT_GAMING_VIDEO_SOCIAL_NON_LEARNING',
      'DURATION_PER_PURPOSE',
      'TOTAL_DURATION_AUXILIARY_ONLY',
      'HISTORICAL_DURATION_BAND_AUXILIARY_ONLY',
      'FUNCTIONAL_IMPACT',
      'SLEEP',
      'REAL_WORLD_ACTIVITY_DISPLACEMENT',
      'EMOTION_EVIDENCE_01002',
      'FAMILY_RELATIONSHIP_OR_CONFLICT_EVIDENCE_01003',
      'OTHER_APPROVED_EVIDENCE',
    ]));
    expect(snapshot.authorityRegression.durationOnlyRoutingForbidden).toBe(true);
  });

  it('contains no universal age-six Scene eligibility hard gate', () => {
    expect(snapshot.authorityRegression.universalAgeSixEligibilityGate).toBe(false);
    expect(a1001?.policyRefs).toContain('NO_UNIVERSAL_AGE_SIX_SCENE_GATE');
    expect(JSON.stringify(digitalUseNodeManifest)).not.toMatch(/UNDER_?6.*(?:BLOCK|INELIGIBLE)|AGE_?6.*(?:BLOCK|INELIGIBLE)/i);
  });

  it('refuses total-duration-only and historical-band-only triage regardless of proposed outcome', () => {
    for (const condition of [
      'TRIAGE_NO_INTERVENTION_INTEGRATED',
      'TRIAGE_FURTHER_ASSESSMENT_INTEGRATED',
      'TRIAGE_CONTINUE_DIGITAL_USE_INTEGRATED',
    ]) {
      for (const basis of [['TOTAL_DURATION'], ['HISTORICAL_DURATION_BAND']] as const) {
        expect(routeDigitalUseTopology({
          sceneCode: 'DIGITAL_USE',
          packageVersion: 'v1',
          currentNodeCode: '01003',
          conditions: { FAMILY_CONFLICT_SEVERE_F: false, [condition]: true },
          evidenceBasis: basis,
        })).toMatchObject({ kind: 'BLOCKED', code: 'INSUFFICIENT_INTEGRATED_EVIDENCE' });
      }
    }
  });

  it('keeps 01002F→01005 and 01003F→01006 priority semantics', () => {
    expect(routeDigitalUseTopology({
      sceneCode: 'DIGITAL_USE',
      packageVersion: 'v1',
      currentNodeCode: '01002',
      conditions: { EMOTION_SEVERE_F: true, EMOTION_ASSESSMENT_NON_SEVERE: true },
    })).toMatchObject({ kind: 'NODE_ROUTE', nextNodeCode: '01005' });

    expect(routeDigitalUseTopology({
      sceneCode: 'DIGITAL_USE',
      packageVersion: 'v1',
      currentNodeCode: '01003',
      conditions: { FAMILY_CONFLICT_SEVERE_F: true, TRIAGE_NO_INTERVENTION_INTEGRATED: true },
      evidenceBasis: ['FUNCTIONAL_IMPACT'],
    })).toMatchObject({ kind: 'NODE_ROUTE', nextNodeCode: '01006' });
  });
});

describe('Phase 2 D3/D8 authority downstream projection', () => {
  const spec = readFileSync(new URL('../../../specs/011-digital-use-node-manifest-routing-foundation/spec.md', import.meta.url), 'utf8');
  const productAuthority = readFileSync(new URL('../../../Docs/V1产品需求.md', import.meta.url), 'utf8');

  it('freezes dimension-local conflict semantics and priority blocking', () => {
    expect(spec).toContain('FR-036 [Phase2-D3]');
    expect(spec).toContain('credible current true+false = `CONFLICT`');
    expect(spec).toContain('independent direct-impact dimension with valid true still establishes aggregate positive');
    expect(spec).toContain('FR-037 [Phase2-D3]');
    expect(productAuthority).toContain('不得跨 dimension 抵消已经成立的 positive');
    expect(productAuthority).toContain('没有任何独立 positive、且 route-driving direct-impact Conflict 存在时');
    expect(productAuthority).not.toMatch(/can overturn|推翻\s*(?:该\s*)?positive|能否定\/推翻/i);
  });

  it('routes INSUFFICIENT back to real evidence collection, not outcome pages', () => {
    expect(spec).toContain('FR-038 [Phase2-D8]');
    expect(spec).toContain('A1001/01002/01003');
    expect(spec).toContain('A2001/A2002 outcome pages MUST NOT be used');
  });
});
