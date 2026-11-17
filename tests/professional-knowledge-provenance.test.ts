import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  hashProfessionalKnowledgeSourceSet,
  type ProfessionalKnowledgeSourceSnapshot,
} from '../packages/domain/src/professional-knowledge.js';

const a: ProfessionalKnowledgeSourceSnapshot = {
  sourceRef: 'source:guideline:a',
  sourceVersion: '2026.1',
  sourceHash: 'a'.repeat(64),
  locator: '§4',
  metadata: { year: 2026, canonical: true },
};
const b: ProfessionalKnowledgeSourceSnapshot = {
  sourceRef: 'source:guideline:b',
  sourceVersion: '2025.4',
  sourceHash: 'b'.repeat(64),
  locator: null,
  metadata: { year: 2025 },
};

describe('professional knowledge source provenance', () => {
  it('hashes the exact source set independently of input order', () => {
    expect(hashProfessionalKnowledgeSourceSet([a, b])).toBe(
      hashProfessionalKnowledgeSourceSet([b, a])
    );
    expect(hashProfessionalKnowledgeSourceSet([a, b])).not.toBe(
      hashProfessionalKnowledgeSourceSet([a])
    );
  });

  it('requires opaque refs, exact versions and hashes in the domain contract', () => {
    const hash = hashProfessionalKnowledgeSourceSet([a]);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(a.sourceRef).toBe('source:guideline:a');
    expect(a.sourceVersion).toBe('2026.1');
    expect(a.sourceHash).toHaveLength(64);
  });

  it('contains no source ingestion/archive/OCR/crawler behavior', () => {
    const domain = readFileSync(
      new URL('../packages/domain/src/professional-knowledge.ts', import.meta.url),
      'utf8'
    );
    const repo = readFileSync(
      new URL('../packages/domain/src/professional-knowledge-repository.ts', import.meta.url),
      'utf8'
    );
    for (const forbidden of [
      'raw_pdf',
      'knowledge_source_archive',
      'ocr(',
      'crawler',
      'document_parser',
      'family_evidence_to_knowledge',
    ]) {
      expect((domain + repo).toLowerCase()).not.toContain(forbidden);
    }
  });
});
