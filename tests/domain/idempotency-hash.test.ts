import { describe, it, expect } from 'vitest';
import {
  hashPayload,
  canonicalJson,
  decideIdempotency,
  IDEMPOTENCY_COMMAND_TYPES,
} from '../../packages/domain/src/idempotency.js';
import type { IdempotencyCommandType } from '../../packages/domain/src/idempotency.js';
import { toHttpError } from '../../apps/server/api/src/plugins/error-handler.js';

describe('Idempotency (T040)', () => {
  it('same payload different key order → same hash', () => {
    const h1 = hashPayload({ a: 1, b: 2 });
    const h2 = hashPayload({ b: 2, a: 1 });
    expect(h1).toBe(h2);
  });

  it('different payload → different hash', () => {
    const h1 = hashPayload({ a: 1 });
    const h2 = hashPayload({ a: 2 });
    expect(h1).not.toBe(h2);
  });

  it('canonical JSON sorts nested keys', () => {
    const j = canonicalJson({ z: { b: 1, a: 2 }, a: 3 });
    expect(j).toBe('{"a":3,"z":{"a":2,"b":1}}');
  });

  it('no existing → EXECUTE', () => {
    expect(decideIdempotency(null, 'hash1')).toEqual({ action: 'EXECUTE' });
  });

  it('same hash → REPLAY', () => {
    const r = decideIdempotency(
      { requestHash: 'hash1', responseStatus: 201, responseBody: { id: 'x' } },
      'hash1'
    );
    expect(r.action).toBe('REPLAY');
    if (r.action === 'REPLAY') {
      expect(r.responseStatus).toBe(201);
    }
  });

  it('different hash → MISMATCH', () => {
    const r = decideIdempotency(
      { requestHash: 'hash1', responseStatus: 201, responseBody: {} },
      'hash2'
    );
    expect(r).toEqual({ action: 'MISMATCH' });
  });
});

/**
 * T028 / T065 — CASE_CREATE shared idempotency contract.
 *
 * Scope is (actor_account_id, command_type, idempotency_key); the canonical
 * payload is exactly { familyId: verifiedCurrentFamilyId, body: {} }.
 * actor / command_type are in the scope, so they must never enter the hash.
 */
describe('CASE_CREATE idempotency contract (T028)', () => {
  const commandType: IdempotencyCommandType = 'CASE_CREATE';

  function canonicalCasePayload(familyId: string, body: Record<string, unknown> = {}) {
    return { familyId, body };
  }

  it('accepts CASE_CREATE as a registered command type', () => {
    expect(commandType).toBe('CASE_CREATE');
    expect(IDEMPOTENCY_COMMAND_TYPES).toContain('CASE_CREATE');
    // No second registry: the runtime list is the single source of the union.
    expect(IDEMPOTENCY_COMMAND_TYPES).toContain('FAMILY_CREATE');
  });

  it('canonical payload keeps familyId and the (empty) business body', () => {
    const payload = canonicalCasePayload('11111111-1111-7111-8111-111111111111');
    expect(Object.keys(payload).sort()).toEqual(['body', 'familyId']);
    expect(payload.body).toEqual({});
    expect(canonicalJson(payload)).toBe(
      '{"body":{},"familyId":"11111111-1111-7111-8111-111111111111"}'
    );
  });

  it('actor and command_type never enter the hash', () => {
    const familyId = '22222222-2222-7222-8222-222222222222';
    const base = hashPayload(canonicalCasePayload(familyId));
    const withActorWouldDiffer = hashPayload({
      ...canonicalCasePayload(familyId),
      actorAccountId: '33333333-3333-7333-8333-333333333333',
      commandType: 'CASE_CREATE',
    });
    expect(base).not.toBe(withActorWouldDiffer);
    // The frozen payload has exactly two keys; adding scope fields is a defect.
    expect(Object.keys(canonicalCasePayload(familyId)).sort()).toEqual(['body', 'familyId']);
  });

  it('same scope key + different request_hash → MISMATCH → 409 IDEMPOTENCY_PAYLOAD_MISMATCH', () => {
    const hashA = hashPayload(canonicalCasePayload('aaaaaaaa-aaaa-7aaa-8aaa-aaaaaaaaaaaa'));
    const hashB = hashPayload(canonicalCasePayload('bbbbbbbb-bbbb-7bbb-8bbb-bbbbbbbbbbbb'));
    expect(hashA).not.toBe(hashB);

    const decision = decideIdempotency(
      { requestHash: hashA, responseStatus: 201, responseBody: { id: 'case-a' } },
      hashB
    );
    expect(decision).toEqual({ action: 'MISMATCH' });

    const http = toHttpError('IDEMPOTENCY_PAYLOAD_MISMATCH');
    expect(http.statusCode).toBe(409);
    expect(http.code).toBe('IDEMPOTENCY_PAYLOAD_MISMATCH');
  });

  it('same scope key + same request_hash → REPLAY with the original body', () => {
    const hash = hashPayload(canonicalCasePayload('cccccccc-cccc-7ccc-8ccc-cccccccccccc'));
    const decision = decideIdempotency(
      { requestHash: hash, responseStatus: 201, responseBody: { id: 'case-c' } },
      hash
    );
    expect(decision.action).toBe('REPLAY');
    if (decision.action === 'REPLAY') {
      expect(decision.responseStatus).toBe(201);
      expect(decision.responseBody).toEqual({ id: 'case-c' });
    }
  });
});
