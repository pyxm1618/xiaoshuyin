import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  FamilyAllianceFeasibilityPayload,
  FamilyAllianceNodeResponsePayload,
  FamilyAllianceSelfAssessmentResponse,
} from '@xiaoshuyin/contracts';
import {
  digitalUseNodeManifest,
  type DigitalUseNodeManifestEntry,
} from '@xiaoshuyin/scenes/digital-use';

const FAMILY_NODES = [
  'A3000','A3001','A3002',
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
] as const;

const familyManifest = (digitalUseNodeManifest as readonly DigitalUseNodeManifestEntry[])
  .filter((node) => node.stream === 'FAMILY_ALLIANCE');

function rootFile(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

describe('Slice 13 FAMILY_ALLIANCE frozen-scope governance', () => {
  it('FA-GOV-01 protects the exact 43-node canonical inventory without inferred gaps', () => {
    expect(familyManifest.map((node) => node.nodeCode)).toEqual(FAMILY_NODES);
    expect(familyManifest).toHaveLength(43);
    for (const invented of ['A3023','A3030','A3031','A3032']) {
      expect(familyManifest.some((node) => node.nodeCode === invented)).toBe(false);
    }
  });

  it('FA-GOV-02 retains A3033, A3090-A3093 and A3111 exactly', () => {
    expect(familyManifest.find((node) => node.nodeCode === 'A3033')?.role)
      .toBe('HELP_EXERCISE');
    expect(
      familyManifest
        .filter((node) => ['A3090','A3091','A3092','A3093'].includes(node.nodeCode))
        .map((node) => node.nodeCode)
    ).toEqual(['A3090','A3091','A3092','A3093']);
    expect(familyManifest.find((node) => node.nodeCode === 'A3111')?.role)
      .toBe('FEASIBILITY_EMOTION_REGULATION_2');
  });

  it('FA-GOV-03 preserves reciprocal A3001/A3002 parallel topology in the single Manifest', () => {
    const a3001 = familyManifest.find((node) => node.nodeCode === 'A3001')!;
    const a3002 = familyManifest.find((node) => node.nodeCode === 'A3002')!;
    expect(a3001.canRunInParallelWith).toContain('A3002');
    expect(a3002.canRunInParallelWith).toContain('A3001');
    expect(a3002.prerequisites).not.toContain('A3001');
  });

  it('FA-GOV-04 A3000 preserves YES/NO and explicit unknown/declined states', () => {
    for (const answer of ['YES','NO','UNKNOWN','NOT_COLLECTED','DECLINED'] as const) {
      const parsed = FamilyAllianceSelfAssessmentResponse.safeParse({
        kind: 'SELF_ASSESSMENT',
        answers: {
          emotionAttention: answer,
          negotiatedAgreement: answer,
          trustsAgreement: answer,
          familyCoordination: answer,
          parentEmotionFluctuation: answer,
          keepsPromises: answer,
        },
      });
      expect(parsed.success, answer).toBe(true);
    }
    expect(FamilyAllianceSelfAssessmentResponse.safeParse({
      kind: 'SELF_ASSESSMENT',
      answers: {
        emotionAttention: 'KNOWN',
        negotiatedAgreement: 'YES',
        trustsAgreement: 'YES',
        familyCoordination: 'YES',
        parentEmotionFluctuation: 'YES',
        keepsPromises: 'YES',
      },
    }).success).toBe(false);
  });

  it('FA-GOV-05 feasibility keeps five approved dimensions but has no score/cutoff engine', () => {
    const payload = {
      concreteQuantified: {
        state: 'KNOWN',
        concreteTargetText: 'Weekdays: devices outside the bedroom by 21:30.',
      },
      need: { state: 'KNOWN', rating: 8 },
      motivationBenefit: { state: 'KNOWN', rating: 7 },
      abilityPossibility: { state: 'KNOWN', rating: 6 },
      challengeResistance: { state: 'CONFLICT' },
    } as const;
    const parsed = FamilyAllianceFeasibilityPayload.safeParse(payload);
    expect(parsed.success).toBe(true);

    for (const extra of [
      { totalScore: 21 },
      { score: 7 },
      { cutoff: 6 },
      { feasible: true },
      { riskThreshold: 3 },
    ]) {
      expect(FamilyAllianceFeasibilityPayload.safeParse({ ...payload, ...extra }).success)
        .toBe(false);
    }
  });

  it('FA-GOV-06 invalid target/node payload additions are rejected by strict schemas', () => {
    expect(FamilyAllianceNodeResponsePayload.safeParse({
      kind: 'TARGET_SELECTION',
      confirmed: true,
      selectedTargets: ['NOT_A_TARGET'],
    }).success).toBe(false);
    expect(FamilyAllianceNodeResponsePayload.safeParse({
      kind: 'TARGET_SELECTION',
      confirmed: true,
      selectedTargets: ['SLEEP'],
      nextNode: 'A4001',
    }).success).toBe(false);
  });

  it('FA-GOV-07 production adds no second router, policy engine, Evidence truth or idempotency store', () => {
    const orchestrator = rootFile('apps/server/api/src/services/digital-use-family-alliance.ts');
    const semantics = rootFile('apps/server/api/src/services/family-alliance-semantics.ts');
    const migration = rootFile('db/migrations/016_digital_use_family_alliance_runtime.sql');
    const combined = [orchestrator, semantics, migration].join('\n');

    expect(combined).not.toMatch(/family_alliance_idempotency/i);
    expect(combined).not.toMatch(/family_alliance_(answers|evidence|facts)/i);
    expect(combined).not.toMatch(/CREATE TABLE\s+(goals|tasks|checkins|outcomes|plan_versions)/i);
    expect(combined).not.toMatch(/InterventionInstance|PlanVersion|pg-boss|xstate|CQRS|event sourcing/i);
    expect(orchestrator).toContain('routeDigitalUseTopology');
    expect(orchestrator).toContain('assertOrdinaryProgressionAllowedRaw');
    expect(orchestrator).toContain('evaluateComplianceAtTransactionTime');
    expect(semantics).toContain('recordStatement');
  });

  it('FA-GOV-08 Family Alliance runtime contains no A400 implementation or AI/RAG authority', () => {
    const orchestrator = rootFile('apps/server/api/src/services/digital-use-family-alliance.ts');
    const semantics = rootFile('apps/server/api/src/services/family-alliance-semantics.ts');
    const combined = [orchestrator, semantics].join('\n');
    expect(combined).not.toMatch(/A400[1-9]|A401[0-2]/);
    expect(combined).not.toMatch(/\b(LLM|RAG|embedding|prompt runtime|AI routing|OpenAI|Anthropic)\b/i);
  });

  it('FA-GOV-09 bounded persistence is target Scene state, never Goal/Task truth', () => {
    const migration = rootFile('db/migrations/016_digital_use_family_alliance_runtime.sql');
    expect(migration).toMatch(/CREATE TABLE digital_use_target_items/);
    expect(migration).not.toMatch(/CREATE TABLE\s+(family_alliance_answers|goals|tasks|checkins|outcomes)/i);
    expect(migration).toMatch(/WHERE superseded_at IS NULL/);
    expect(migration).toMatch(/ENABLE ROW LEVEL SECURITY/);
    expect(migration).toMatch(/FORCE ROW LEVEL SECURITY/);
  });

  it('FA-GOV-10 handler owns business semantics only; no local topology declarations exist', () => {
    const orchestrator = rootFile('apps/server/api/src/services/digital-use-family-alliance.ts');
    const semantics = rootFile('apps/server/api/src/services/family-alliance-semantics.ts');
    expect(semantics).not.toMatch(/allowedNext\s*:/);
    expect(semantics).not.toMatch(/prerequisites\s*:/);
    expect(semantics).not.toMatch(/canRunInParallelWith\s*:/);
    expect(orchestrator).not.toMatch(/nodeCode\s*\+\s*1/);
    expect(orchestrator).not.toMatch(/parseInt\([^)]*node/i);
  });
});
