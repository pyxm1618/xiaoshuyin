/**
 * S7-II-M01 — reason representability at the request boundary.
 *
 * PostgreSQL JSONB cannot persist U+0000 or an unpaired UTF-16 surrogate.
 * The request schema must reject those inputs as 422 before any write while
 * preserving every legal Unicode value byte-for-byte (no trim, no replace,
 * no silent normalization).
 */

import { describe, it, expect } from 'vitest';
import { SwitchPrimaryCaseRequest } from '@xiaoshuyin/contracts';

const NULL_VIEW = { expectedPrimaryCaseId: null, expectedPrimaryVersion: null };

function parse(reason: string) {
  return SwitchPrimaryCaseRequest.safeParse({ reason, ...NULL_VIEW });
}

describe('SwitchPrimaryCaseRequest reason Unicode boundary (S7-II-M01)', () => {
  it('accepts legal Chinese / emoji / quotes / newline / surrounding spaces and keeps the raw value', () => {
    const values = [
      '中文理由',
      '😀 emoji 理由',
      'quote "double" and \'single\'',
      'line one\nline two',
      '  leading and trailing  ',
      '多语言 English 中文 😀',
    ];
    for (const reason of values) {
      const result = parse(reason);
      expect(result.success, reason).toBe(true);
      if (result.success) expect(result.data.reason).toBe(reason);
    }
  });

  it('rejects U+0000 with 422 semantics', () => {
    expect(parse('a\u0000b').success).toBe(false);
    expect(parse('\u0000').success).toBe(false);
  });

  it('rejects an isolated high surrogate', () => {
    expect(parse('\uD800').success).toBe(false);
    expect(parse('a\uD800b').success).toBe(false);
    expect(parse('\uD800\u0041').success).toBe(false);
  });

  it('rejects an isolated low surrogate', () => {
    expect(parse('\uDC00').success).toBe(false);
    expect(parse('a\uDC00b').success).toBe(false);
    expect(parse('\u0041\uDC00').success).toBe(false);
  });

  it('still rejects blank, empty and over-length reasons', () => {
    expect(parse('').success).toBe(false);
    expect(parse('   ').success).toBe(false);
    expect(parse('a'.repeat(501)).success).toBe(false);
  });
});