import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  DIGITAL_USE_NODE_CONTENT_VERSION,
  DIGITAL_USE_PRODUCT_AUTHORITY,
  DIGITAL_USE_TARGET_CATALOG_VERSION,
  DIGITAL_USE_TARGET_OPTIONS,
  resolveDigitalUseNodeContent,
} from '@xiaoshuyin/scenes/digital-use';

const CANONICAL_TARGETS = [
  'SLEEP',
  'EXERCISE',
  'HOBBIES',
  'CHORES',
  'FAMILY_GATHERING',
  'OUTDOOR_ACTIVITY',
  'EMOTION_REGULATION_1',
  'TIME_MANAGEMENT',
  'FAMILY_RELATIONSHIP',
  'EMOTION_REGULATION_2',
] as const;

const FROZEN_AUTHORITY_SNAPSHOT = '379cb8cfb377924cd21ccfe55baa5aecdf207f5e';
const TARGET_PAGE_NODES = [
  'A3010',
  'A3020',
  'A3040',
  'A3050',
  'A3060',
  'A3070',
  'A3080',
  'A3090',
  'A3100',
  'A3110',
] as const;

function authorityText(): string {
  return readFileSync(resolve(process.cwd(), 'Docs/V1产品需求.md'), 'utf8');
}

describe('R07 Digital Use node content registry', () => {
  it('R07-REG-01 catalog options are exactly the ten canonical target codes', () => {
    expect(DIGITAL_USE_TARGET_OPTIONS.map((option) => option.code)).toEqual([
      ...CANONICAL_TARGETS,
    ]);
    expect(new Set(DIGITAL_USE_TARGET_OPTIONS.map((option) => option.code)).size).toBe(10);
    for (const option of DIGITAL_USE_TARGET_OPTIONS) {
      expect(option.displayName.length).toBeGreaterThan(0);
      expect(option.mandatoryBasis.length).toBeGreaterThan(0);
    }
  });

  it('R07-REG-02 A3002 content version and provenance are internally consistent', () => {
    const content = resolveDigitalUseNodeContent('A3002');
    expect(content).not.toBeNull();
    if (content === null || content.availability !== 'AVAILABLE') throw new Error('unexpected');
    expect(content.contentVersion).toBe(DIGITAL_USE_NODE_CONTENT_VERSION);
    expect(content.provenance.contentVersion).toBeDefined();
    expect(content.question?.options.map((option) => option.value)).toEqual([
      ...CANONICAL_TARGETS,
    ]);
    expect(content.question?.options).toHaveLength(10);
    expect(content.question?.selection).toBe('MULTI');
    expect(content.question?.submissionKind).toBe('TARGET_SELECTION');
    expect(content.question?.minSelections).toBe(0);
    expect(content.question?.maxSelections).toBe(10);
  });

  it('R07-REG-03 registered provenance pins the frozen product Authority snapshot', () => {
    // Provenance pins the registration snapshot. Later Authority revisions
    // elsewhere in the document must not silently re-point it.
    expect(DIGITAL_USE_PRODUCT_AUTHORITY).toMatchObject({
      authorityDocument: 'Docs/V1产品需求.md',
      authorityDocumentVersion: 'v3.9',
      sourceBlob: FROZEN_AUTHORITY_SNAPSHOT,
      sectionHeading: '## 目标清单',
    });
    expect(DIGITAL_USE_TARGET_CATALOG_VERSION).toBe('family-alliance-target-catalog-v1');
    expect(DIGITAL_USE_NODE_CONTENT_VERSION).toBe('digital-use-node-content-v1');

    const doc = authorityText();
    expect(doc).toContain(DIGITAL_USE_PRODUCT_AUTHORITY.sectionHeading);

    for (const nodeCode of ['A3002', ...TARGET_PAGE_NODES]) {
      const content = resolveDigitalUseNodeContent(nodeCode);
      if (content === null || content.availability !== 'AVAILABLE') {
        throw new Error(`${nodeCode} must be AVAILABLE`);
      }
      expect(content.provenance.sourceBlob, nodeCode).toBe(FROZEN_AUTHORITY_SNAPSHOT);
      expect(content.authorityKind, nodeCode).toBe('PRODUCT_FROZEN');
      expect(doc, nodeCode).toContain(content.provenance.sectionHeading);
      if (content.body !== null) expect(doc, nodeCode).toContain(content.body);
      if (content.question !== null) expect(doc, nodeCode).toContain(content.question.text);
    }
  });

  it('R07-REG-04 professional questionnaire nodes fail closed without fabricated content', () => {
    for (const nodeCode of ['A1001', '01002', '01003']) {
      const content = resolveDigitalUseNodeContent(nodeCode);
      if (content === null || content.availability !== 'UNAVAILABLE') {
        throw new Error(`${nodeCode} must be UNAVAILABLE`);
      }
      expect(content.authorityKind, nodeCode).toBeNull();
      expect(content.provenance, nodeCode).toBeNull();
      expect(content.missing.map((item) => item.contentKind), nodeCode).toEqual([
        'PROFESSIONAL_APPROVED_CONTENT',
        'APPROVED_CONTENT_VERSION',
      ]);
    }
  });

  it('R07-REG-05 structured and unregistered nodes return the explicit missing list', () => {
    for (const nodeCode of ['A3011', 'A3012', 'A3001', 'A4001']) {
      const content = resolveDigitalUseNodeContent(nodeCode);
      if (content === null || content.availability !== 'UNAVAILABLE') {
        throw new Error(`${nodeCode} must be UNAVAILABLE`);
      }
      expect(content.missing.map((item) => item.contentKind), nodeCode).toEqual([
        'NODE_CONTENT_NOT_REGISTERED',
      ]);
    }
  });
});
