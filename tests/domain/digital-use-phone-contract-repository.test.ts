import { describe, expect, it } from 'vitest';
import {
  activatePhoneUseContractCas,
  recordAdultContractConfirmationCas,
  recordChildContractConfirmationCas,
  supersedePhoneUseContractCas,
  updatePhoneUseContractDraftCas,
} from '@xiaoshuyin/domain';

function txCapture(rows: unknown[] = []) {
  const calls: Array<{ text: string; values: unknown[] }> = [];
  const tx = {
    query: async (text: string, values: unknown[] = []) => {
      calls.push({ text, values });
      return { rows };
    },
  } as any;
  return { tx, calls };
}

const term = { state: 'VALUE' as const, value: 'x' };

describe('Slice 14 Contract repository CAS fences', () => {
  it('draft correction is revision-fenced and invalidates both prior confirmations', async () => {
    const { tx, calls } = txCapture();
    await updatePhoneUseContractDraftCas(tx, {
      caseId: 'case',
      version: 2,
      expectedDraftRevision: 4,
      contractPurpose: term,
      phoneUseRules: term,
      executionPeriod: term,
      parentSupportMeasures: term,
      supervisionMeasures: term,
      incentives: term,
      breachResponsibilities: term,
      dependencyRefs: [],
    });
    const sql = calls[0]!.text;
    expect(sql).toContain('draft_revision=draft_revision+1');
    expect(sql).toContain('parent_confirmation=NULL');
    expect(sql).toContain('child_confirmation=NULL');
    expect(sql).toContain("status='DRAFT'");
    expect(sql).toContain('draft_revision=$3');
    expect(sql).toContain("status IN('DRAFT','PENDING_CONFIRMATION')");
  });

  it('each party confirmation is first-write-only for one draft revision', async () => {
    for (const [kind, fn] of [
      ['ADULT', recordAdultContractConfirmationCas],
      ['CHILD', recordChildContractConfirmationCas],
    ] as const) {
      const { tx, calls } = txCapture();
      await fn(tx, {
        caseId: 'case',
        version: 1,
        expectedDraftRevision: 3,
        confirmation: {
          kind,
          accountId: 'account',
          personId: 'person',
          draftRevision: 3,
          confirmedAt: new Date(0).toISOString(),
          authorizationAction: kind === 'ADULT'
            ? 'CASE_RESPOND_ASSESSMENT_SCENE'
            : 'PHONE_USE_CONTRACT_CONFIRM_SELF',
          ...(kind === 'CHILD' ? { participationId: 'participation' } : {}),
        },
      });
      expect(calls[0]!.text).toContain('draft_revision=$3');
      expect(calls[0]!.text).toMatch(/parent_confirmation IS NULL|child_confirmation IS NULL/);
    }
  });

  it('activation requires both confirmations and supersession only targets ACTIVE', async () => {
    {
      const { tx, calls } = txCapture();
      await activatePhoneUseContractCas(tx, {
        caseId: 'case',
        version: 3,
        expectedDraftRevision: 2,
      });
      expect(calls[0]!.text).toContain('parent_confirmation IS NOT NULL');
      expect(calls[0]!.text).toContain('child_confirmation IS NOT NULL');
      expect(calls[0]!.text).toContain("status='ACTIVE'");
      expect(calls[0]!.text).toContain('draft_revision=$3');
    }
    {
      const { tx, calls } = txCapture();
      await supersedePhoneUseContractCas(tx, { caseId: 'case', version: 2 });
      expect(calls[0]!.text).toContain("status='SUPERSEDED'");
      expect(calls[0]!.text).toContain("status='ACTIVE'");
    }
  });
});
