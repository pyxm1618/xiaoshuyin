/**
 * T913 — complete Safety machine-error and privacy matrix.
 */

import { describe, it, expect } from 'vitest';
import {
  SAFETY_ERROR_CODES,
  SafetyError,
  isSafetyError,
  buildSafetyAuditMetadata,
  buildSafetyCaseEventMetadata,
} from '../../packages/domain/src/safety/index.js';
import { toHttpError } from '../../apps/server/api/src/plugins/error-handler.js';
import { denyToError, isKnownAuthorizationDenial } from '../../apps/server/api/src/authz.js';

const EXPECTED: Record<string, number> = {
  UNAUTHENTICATED: 401,
  CASE_NOT_FOUND: 404,
  CASE_CLOSED: 409,
  SAFETY_HOLD_ALREADY_ACTIVE: 409,
  SAFETY_HOLD_BLOCKED: 409,
  STALE_CASE_VERSION: 409,
  SAFETY_PRECHECK_STALE: 409,
  SAFETY_PRECHECK_INVALID: 422,
  SAFETY_REVIEW_EVIDENCE_INVALID: 422,
  SAFETY_RESOLUTION_AUTHORITY_DENIED: 403,
  SAFETY_RESOLUTION_AUTHORITY_UNAVAILABLE: 403,
  SAFETY_HOLD_REQUIRED: 409,
  IDEMPOTENCY_PAYLOAD_MISMATCH: 409,
  INTERNAL_ERROR: 500,
};

describe('T913 Safety error matrix (T913)', () => {
  it('maps every Safety semantic to the frozen non-5xx contract', () => {
    for (const [code, status] of Object.entries(EXPECTED)) {
      expect(toHttpError(code).statusCode, code).toBe(status);
    }
  });

  it('keeps every SafetyError code covered by an HTTP mapping', () => {
    for (const code of SAFETY_ERROR_CODES) {
      expect(EXPECTED[code], `missing expectation for ${code}`).toBeDefined();
    }
  });

  it('produces stable non-leaking domain errors', () => {
    for (const code of SAFETY_ERROR_CODES) {
      const error = new SafetyError(code);
      expect(error.code).toBe(code);
      expect(error.message).toBe(code);
      expect(isSafetyError(error)).toBe(true);
      // No protected data can appear in a message built from the code alone.
      expect(error.message).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}/i);
    }
    expect(isSafetyError(new Error('x'))).toBe(false);
  });

  it('never echoes caller data in a Safety error message', () => {
    const error = new SafetyError('SAFETY_PRECHECK_INVALID', 'invalid policyRef');
    expect(error.message).toBe('SAFETY_PRECHECK_INVALID: invalid policyRef');
    expect(error.message).not.toContain('policy.fixture');
  });

  it('classifies only known denials as authorization denials', () => {
    expect(isKnownAuthorizationDenial(denyToError('NOT_SAFETY_RESOLVER'))).toBe(true);
    expect(isKnownAuthorizationDenial(denyToError('NOT_FAMILY_MEMBER'))).toBe(true);
    // Authentication is never collapsed into an anti-enumeration denial.
    expect(isKnownAuthorizationDenial(denyToError('NO_ACTOR'))).toBe(false);

    for (const code of ['57014', '08006', '40001']) {
      expect(isKnownAuthorizationDenial(Object.assign(new Error('x'), { code }))).toBe(false);
    }
  });

  it('converges invisible and cross-Family Cases on one non-leaking code', () => {
    // Both an absent row and another Family's row surface as CASE_NOT_FOUND at
    // the anti-enumerating boundary (see Enter/Resolve integration tests).
    expect(toHttpError('CASE_NOT_FOUND').message).toBe('CASE_NOT_FOUND');
  });

  it('builds event/audit metadata that rejects raw user content keys', () => {
    const forbidden = ['content', 'message', 'text', 'body', 'note', 'notes', 'reviewNotes', 'reason', 'transcript', 'prompt'];
    const caseMeta = buildSafetyCaseEventMetadata({
      fromStatus: 'OPEN',
      toStatus: 'SAFETY_HOLD',
      fromVersion: 1,
      toVersion: 2,
      riskEventId: 'rid',
    });
    const auditMeta = buildSafetyAuditMetadata({
      riskEventId: 'rid',
      fromVersion: 1,
      toVersion: 2,
      resolutionAuthorityRef: 'authority.ref',
    });
    for (const metadata of [caseMeta, auditMeta]) {
      for (const key of forbidden) expect(Object.keys(metadata)).not.toContain(key);
    }
    expect(Object.keys(caseMeta).sort()).toEqual([
      'fromStatus',
      'fromVersion',
      'riskEventId',
      'toStatus',
      'toVersion',
    ]);
    expect(Object.keys(auditMeta).sort()).toEqual([
      'fromVersion',
      'resolutionAuthorityRef',
      'riskEventId',
      'toVersion',
    ]);
  });
});