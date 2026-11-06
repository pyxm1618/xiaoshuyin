/**
 * T030 — Case contracts (packages/contracts/src/schemas.ts).
 *
 * CreateCaseRequest is strict: the only legal business field is idempotencyKey.
 * Every forbidden client-controlled field must be rejected, not stripped.
 */

import { describe, it, expect } from 'vitest';
import {
  CreateCaseRequest,
  CaseResponse,
  CaseListResponse,
  CaseStatus,
  CasePhase,
} from '../../packages/contracts/src/schemas.js';

const KEY = 'case-key-0001';

describe('CreateCaseRequest (T030)', () => {
  it('accepts { idempotencyKey } only', () => {
    const parsed = CreateCaseRequest.safeParse({ idempotencyKey: KEY });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data).toEqual({ idempotencyKey: KEY });
  });

  it('enforces 8–128 characters', () => {
    expect(CreateCaseRequest.safeParse({ idempotencyKey: 'short' }).success).toBe(false);
    expect(CreateCaseRequest.safeParse({ idempotencyKey: 'x'.repeat(129) }).success).toBe(false);
    expect(CreateCaseRequest.safeParse({ idempotencyKey: 'x'.repeat(8) }).success).toBe(true);
    expect(CreateCaseRequest.safeParse({ idempotencyKey: 'x'.repeat(128) }).success).toBe(true);
  });

  it('requires idempotencyKey', () => {
    expect(CreateCaseRequest.safeParse({}).success).toBe(false);
  });

  const forbidden: Record<string, unknown> = {
    familyId: '11111111-1111-7111-8111-111111111111',
    createdByPersonId: '22222222-2222-7222-8222-222222222222',
    creator: 'someone',
    status: 'OPEN',
    phase: 'INTAKE',
    primary: true,
    isPrimary: true,
    version: 1,
    title: 't',
    summary: 's',
    description: 'd',
    problemDescription: 'p',
    problem_description: 'p',
    visibility: 'PRIVATE',
    participantId: '33333333-3333-7333-8333-333333333333',
  };

  for (const [field, value] of Object.entries(forbidden)) {
    it(`rejects undeclared field ${field}`, () => {
      const parsed = CreateCaseRequest.safeParse({ idempotencyKey: KEY, [field]: value });
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(parsed.error.issues.some((i) => i.code === 'unrecognized_keys')).toBe(true);
      }
    });
  }
});

describe('Case response contracts (T030)', () => {
  const caseBody = {
    id: '44444444-4444-7444-8444-444444444444',
    status: 'OPEN',
    phase: 'INTAKE',
    primary: true,
    version: 1,
    createdAt: '2026-11-05T00:00:00.000Z',
    updatedAt: '2026-11-05T00:00:00.000Z',
  };

  it('CaseResponse exposes exactly seven fields', () => {
    const shape = CaseResponse.parse(caseBody);
    expect(Object.keys(shape).sort()).toEqual([
      'createdAt', 'id', 'phase', 'primary', 'status', 'updatedAt', 'version',
    ]);
  });

  it('CaseResponse rejects content fields and family/creator leakage', () => {
    for (const extra of [
      { title: 'x' }, { summary: 'x' }, { description: 'x' },
      { problemDescription: 'x' }, { familyId: caseBody.id }, { createdByPersonId: caseBody.id },
    ]) {
      expect(CaseResponse.safeParse({ ...caseBody, ...extra }).success).toBe(false);
    }
  });

  it('CaseResponse requires the full field set', () => {
    for (const key of Object.keys(caseBody)) {
      const partial: Record<string, unknown> = { ...caseBody };
      delete partial[key];
      expect(CaseResponse.safeParse(partial).success, `missing ${key}`).toBe(false);
    }
  });

  it('CaseListResponse is { items: CaseResponse[] }', () => {
    expect(CaseListResponse.parse({ items: [caseBody] }).items.length).toBe(1);
    expect(CaseListResponse.parse({ items: [] }).items).toEqual([]);
    expect(CaseListResponse.safeParse({ items: [{ ...caseBody, title: 'x' }] }).success).toBe(false);
  });

  it('CaseStatus keeps the frozen vocabulary', () => {
    expect(CaseStatus.options).toEqual([
      'OPEN', 'WAITING', 'PAUSED', 'LOST_CONTACT', 'SAFETY_HOLD', 'CLOSED',
    ]);
  });

  it('CasePhase keeps the frozen vocabulary and order', () => {
    expect(CasePhase.options).toEqual([
      'INTAKE', 'ASSESSMENT', 'PROBLEM_FORMULATION', 'GOALS',
      'PLANNING', 'EXECUTION', 'REVIEW', 'MAINTENANCE', 'CLOSED',
    ]);
  });
});
