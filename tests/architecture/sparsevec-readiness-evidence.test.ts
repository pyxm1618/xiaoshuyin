import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  MANIFEST_PATH,
  sha256Utf8,
  validateChineseManifest,
  type ChineseSampleManifest,
} from '../helpers/sparsevec-readiness.js';

const ROOT = resolve(import.meta.dirname, '../..');
const manifestRaw = JSON.parse(readFileSync(resolve(ROOT, MANIFEST_PATH), 'utf8')) as ChineseSampleManifest;

describe('Slice 21 T003 — Frozen Chinese sample manifest', () => {
  it('passes full manifest structural, SHA-256, anchor, length, rights, outbound, and privacy checks', () => {
    const validation = validateChineseManifest(manifestRaw);
    expect(validation).toEqual({ ok: true, manifest: manifestRaw });
  });

  it('freezes exact 6 documents and 3 queries with expected IDs, corrected D04 URL, and distractor sets', () => {
    expect(manifestRaw.documents.map((d) => d.doc_id)).toEqual(['D01', 'D02', 'D03', 'D04', 'D05', 'D06']);
    const d04 = manifestRaw.documents.find((d) => d.doc_id === 'D04');
    expect(d04?.source_url).toBe('http://fx.xwapp.moe.gov.cn/article/202209/63214de5f858056a22552341.html');

    expect(manifestRaw.queries.map((q) => q.query_id)).toEqual(['Q01', 'Q02', 'Q03']);
    const byQuery = Object.fromEntries(manifestRaw.queries.map((q) => [q.query_id, q]));
    expect(byQuery.Q01.expected_doc_id).toBe('D01');
    expect(byQuery.Q01.distractor_doc_ids).toEqual(['D04', 'D05']);
    expect(byQuery.Q02.expected_doc_id).toBe('D02');
    expect(byQuery.Q02.distractor_doc_ids).toEqual(['D04', 'D06']);
    expect(byQuery.Q03.expected_doc_id).toBe('D03');
    expect(byQuery.Q03.distractor_doc_ids).toEqual(['D05', 'D06']);
  });

  it('verifies every excerpt starts with its NFKC anchor, has 30..400 code points, and recomputes text_sha256', () => {
    for (const doc of manifestRaw.documents) {
      expect(doc.excerpt.startsWith(doc.anchor.normalize('NFKC'))).toBe(true);
      const codePoints = Array.from(doc.excerpt).length;
      expect(codePoints).toBeGreaterThanOrEqual(30);
      expect(codePoints).toBeLessThanOrEqual(400);
      expect(sha256Utf8(doc.excerpt)).toBe(doc.text_sha256);
    }
  });

  it('verifies mechanical key-term presence in query + target and absence in declared distractors', () => {
    const docsById = new Map(manifestRaw.documents.map((d) => [d.doc_id, d]));
    for (const q of manifestRaw.queries) {
      const key = q.key_term.normalize('NFKC');
      expect(q.query_text.normalize('NFKC').includes(key)).toBe(true);
      expect(docsById.get(q.expected_doc_id)?.excerpt.includes(key)).toBe(true);
      for (const distId of q.distractor_doc_ids) {
        expect(docsById.get(distId)?.excerpt.includes(key)).toBe(false);
      }
    }
  });
});
