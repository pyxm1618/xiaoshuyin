import { describe, expect, it } from 'vitest';
import {
  FAMILY_ALLIANCE_AUTHORITY_DOCUMENT,
  FAMILY_ALLIANCE_AUTHORITY_DOCUMENT_VERSION,
  FAMILY_ALLIANCE_AUTHORITY_SOURCE_BLOB,
  FAMILY_ALLIANCE_CONTENT_NODE_CODES,
  FAMILY_ALLIANCE_CONTENT_VERSION,
  resolveFamilyAllianceContent,
} from '@xiaoshuyin/scenes/digital-use';

describe('Family Alliance product-authority content', () => {
  it('resolves every A3000/help content reference to a real frozen authority body', () => {
    expect(FAMILY_ALLIANCE_CONTENT_VERSION).toBe('family-alliance-product-v1');
    expect(FAMILY_ALLIANCE_AUTHORITY_DOCUMENT).toBe('Docs/V1产品需求.md');
    expect(FAMILY_ALLIANCE_AUTHORITY_DOCUMENT_VERSION).toBe('v3.9');
    expect(FAMILY_ALLIANCE_AUTHORITY_SOURCE_BLOB)
      .toBe('8eb660cd905d8fba4b52fe0f74bbc214b3113117');
    expect(FAMILY_ALLIANCE_CONTENT_NODE_CODES).toEqual([
      'A3000','A3013','A3033','A3043','A3053','A3063',
      'A3073','A3083','A3093','A3103','A3113',
    ]);

    for (const nodeCode of FAMILY_ALLIANCE_CONTENT_NODE_CODES) {
      const asset = resolveFamilyAllianceContent(nodeCode);
      expect(asset.nodeCode).toBe(nodeCode);
      expect(asset.contentVersion).toBe(FAMILY_ALLIANCE_CONTENT_VERSION);
      expect(asset.sourceBlob).toBe(FAMILY_ALLIANCE_AUTHORITY_SOURCE_BLOB);
      expect(asset.sectionHeading.length).toBeGreaterThan(0);
      expect(asset.body.trim().length).toBeGreaterThan(0);
    }
  });

  it('retains verbatim authority text rather than metadata-only placeholder content', () => {
    expect(resolveFamilyAllianceContent('A3000').body).toContain(
      '达成“一致”意见比选择“正确”的意见更重要'
    );
    expect(resolveFamilyAllianceContent('A3013').body).toContain(
      '睡眠质量主要以第二天的主观感觉来判断'
    );
    expect(resolveFamilyAllianceContent('A3113').body).toContain(
      '我和你站在同一战线'
    );
  });

  it('fails closed for stale versions or nodes without an authoritative body', () => {
    expect(() => resolveFamilyAllianceContent('A3000', 'stale-version'))
      .toThrow('FAMILY_ALLIANCE_CONTENT_STALE');
    expect(() => resolveFamilyAllianceContent('A3023'))
      .toThrow('FAMILY_ALLIANCE_CONTENT_NOT_FOUND');
  });

  describe('Finding #4: Family Alliance compliance gate binds to target child', () => {
    it('requires target child resolution and fails closed when target is missing', async () => {
      const { pinAndAssertFamilyAllianceGates } = await import(
        '../../apps/server/api/src/services/digital-use-family-alliance.js'
      );
      const mockTx = {
        query: async () => ({ rows: [] }),
      } as any;

      // When target is not supplied and readDigitalUseAssessmentTarget returns null
      await expect(
        pinAndAssertFamilyAllianceGates(
          mockTx,
          '00000000-0000-7000-8000-000000000001',
          '00000000-0000-7000-8000-000000000002'
        )
      ).rejects.toThrow('TARGET_SCOPE_INVALID');
    });
  });
});
