/**
 * T025 (domain half) — CASE_MESSAGE_CREATE canonical request hash.
 *
 * RED before the command type / canonical builder exists.
 */

import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import {
  IDEMPOTENCY_COMMAND_TYPES,
  buildCaseMessageRequestHash,
  hashPayload,
} from '../../packages/domain/src/idempotency.js';

const FAMILY = '11111111-1111-7111-8111-111111111111';
const CASE = '22222222-2222-7222-8222-222222222222';

function referenceHash(familyId: string, caseId: string, content: string): string {
  // canonicalJson sorts keys: body < caseId < familyId.
  return createHash('sha256')
    .update(JSON.stringify({ body: { content }, caseId, familyId }))
    .digest('hex');
}

describe('CASE_MESSAGE_CREATE idempotency hash (T025)', () => {
  it('registers the command type exactly once', () => {
    expect(IDEMPOTENCY_COMMAND_TYPES).toContain('CASE_MESSAGE_CREATE');
    expect(
      IDEMPOTENCY_COMMAND_TYPES.filter((t) => t === 'CASE_MESSAGE_CREATE').length
    ).toBe(1);
  });

  it('hashes exactly {familyId, caseId, body:{content}}', () => {
    const content = '孩子最近晚上总说还不想睡。';
    expect(buildCaseMessageRequestHash({ familyId: FAMILY, caseId: CASE, content })).toBe(
      referenceHash(FAMILY, CASE, content)
    );
    expect(buildCaseMessageRequestHash({ familyId: FAMILY, caseId: CASE, content })).toBe(
      hashPayload({ familyId: FAMILY, caseId: CASE, body: { content } })
    );
  });

  it('does not include the Idempotency-Key header value', () => {
    const a = buildCaseMessageRequestHash({
      familyId: FAMILY,
      caseId: CASE,
      content: 'same content',
    });
    const b = buildCaseMessageRequestHash({
      familyId: FAMILY,
      caseId: CASE,
      content: 'same content',
    });
    expect(a).toBe(b);
  });

  it('never trims or normalizes content', () => {
    const spaced = buildCaseMessageRequestHash({
      familyId: FAMILY,
      caseId: CASE,
      content: '  raw content  ',
    });
    const trimmed = buildCaseMessageRequestHash({
      familyId: FAMILY,
      caseId: CASE,
      content: 'raw content',
    });
    expect(spaced).not.toBe(trimmed);
    expect(spaced).toBe(referenceHash(FAMILY, CASE, '  raw content  '));
  });

  it('binds the family and the case (no cross-target replay)', () => {
    const base = buildCaseMessageRequestHash({ familyId: FAMILY, caseId: CASE, content: 'x' });
    expect(
      buildCaseMessageRequestHash({ familyId: FAMILY, caseId: '33333333-3333-7333-8333-333333333333', content: 'x' })
    ).not.toBe(base);
    expect(
      buildCaseMessageRequestHash({
        familyId: '44444444-4444-7444-8444-444444444444',
        caseId: CASE,
        content: 'x',
      })
    ).not.toBe(base);
  });
});