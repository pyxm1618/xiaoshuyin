/**
 * T720 — SwitchPrimaryCase request / response contracts (plan D-6.2 / D-12.2).
 *
 * The request is a strict object with exactly three fields. Both view keys are
 * required (explicit null allowed) and must agree: both null or both non-null.
 * `reason` keeps its raw length (no `.trim()` transform) but must be non-blank.
 */

import { describe, it, expect } from 'vitest';
import {
  SwitchPrimaryCaseRequest,
  SwitchPrimaryCaseResponse,
} from '../../packages/contracts/src/schemas.js';

const VALID_UUID = '0192f0c4-1111-7000-8000-000000000001';

function parse(body: unknown) {
  return SwitchPrimaryCaseRequest.safeParse(body);
}

describe('SwitchPrimaryCaseRequest (T720)', () => {
  it('accepts a promotion view with two nulls', () => {
    expect(
      parse({ reason: '处理完旧主线', expectedPrimaryCaseId: null, expectedPrimaryVersion: null })
        .success
    ).toBe(true);
  });

  it('accepts a matching non-null view', () => {
    expect(
      parse({
        reason: '转到现在的主要问题',
        expectedPrimaryCaseId: VALID_UUID,
        expectedPrimaryVersion: 3,
      }).success
    ).toBe(true);
  });

  it('accepts a single-character reason and a 500-character reason, rejects 501', () => {
    const base = { expectedPrimaryCaseId: null, expectedPrimaryVersion: null };
    expect(parse({ reason: 'x', ...base }).success).toBe(true);
    expect(parse({ reason: 'x'.repeat(500), ...base }).success).toBe(true);
    expect(parse({ reason: 'x'.repeat(501), ...base }).success).toBe(false);
  });

  it('rejects empty, whitespace-only, and non-string reasons', () => {
    const base = { expectedPrimaryCaseId: null, expectedPrimaryVersion: null };
    expect(parse({ reason: '', ...base }).success).toBe(false);
    expect(parse({ reason: '   ', ...base }).success).toBe(false);
    expect(parse({ reason: '\n\t', ...base }).success).toBe(false);
    expect(parse({ reason: 42, ...base }).success).toBe(false);
  });

  it('rejects a missing view key', () => {
    expect(parse({ reason: 'x', expectedPrimaryCaseId: null }).success).toBe(false);
    expect(parse({ reason: 'x', expectedPrimaryVersion: null }).success).toBe(false);
  });

  it('rejects contradictory views (one null, one non-null)', () => {
    expect(
      parse({
        reason: 'x',
        expectedPrimaryCaseId: VALID_UUID,
        expectedPrimaryVersion: null,
      }).success
    ).toBe(false);
    expect(
      parse({
        reason: 'x',
        expectedPrimaryCaseId: null,
        expectedPrimaryVersion: 2,
      }).success
    ).toBe(false);
  });

  it('rejects a non-uuid view id, a zero/negative/fractional version', () => {
    expect(
      parse({ reason: 'x', expectedPrimaryCaseId: 'case-1', expectedPrimaryVersion: 2 }).success
    ).toBe(false);
    for (const version of [0, -1, 1.5]) {
      expect(
        parse({ reason: 'x', expectedPrimaryCaseId: VALID_UUID, expectedPrimaryVersion: version })
          .success
      ).toBe(false);
    }
  });

  it('rejects every undeclared field, including body idempotencyKey', () => {
    const base = { reason: 'x', expectedPrimaryCaseId: null, expectedPrimaryVersion: null };
    for (const extra of [
      { isPrimary: true },
      { primary: true },
      { version: 1 },
      { status: 'OPEN' },
      { phase: 'INTAKE' },
      { familyId: VALID_UUID },
      { targetCaseId: VALID_UUID },
      { idempotencyKey: 'key-12345678' },
    ]) {
      expect(parse({ ...base, ...extra }).success).toBe(false);
    }
  });
});

describe('SwitchPrimaryCaseResponse (T720)', () => {
  it('is exactly primary / previousPrimary / switchedAt', () => {
    expect(Object.keys(SwitchPrimaryCaseResponse.shape).sort()).toEqual([
      'previousPrimary',
      'primary',
      'switchedAt',
    ]);
  });

  it('accepts a full response with null previousPrimary', () => {
    const caseRow = {
      id: VALID_UUID,
      status: 'OPEN',
      phase: 'INTAKE',
      primary: true,
      version: 4,
      createdAt: '2026-11-07T08:45:02.000Z',
      updatedAt: '2026-11-07T08:45:02.000Z',
    };
    expect(
      SwitchPrimaryCaseResponse.safeParse({
        primary: caseRow,
        previousPrimary: null,
        switchedAt: '2026-11-07T08:45:02.000Z',
      }).success
    ).toBe(true);
  });
});