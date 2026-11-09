import { describe, it, expect } from 'vitest';
import {
  canCreateNewAttempt,
  computeOperationScope,
  decideBindingOperation,
} from '../../packages/domain/src/identity-binding.js';

describe('operation-level idempotency', () => {
  it('BOOTSTRAP scope is stable and independent of attempt identity', () => {
    const a = computeOperationScope({
      commandType: 'BOOTSTRAP',
      invitationParticipationId: 'part-1',
      candidateIdentityDigest: 'a'.repeat(64),
    });
    const b = computeOperationScope({
      commandType: 'BOOTSTRAP',
      invitationParticipationId: 'part-1',
      candidateIdentityDigest: 'a'.repeat(64),
    });
    expect(a).toEqual(b);
    expect(a.scopeKind).toBe('CANDIDATE_CONTEXT');
    expect(a.scopeKey).toMatch(/^[0-9a-f]{64}$/);
  });

  it('unresolved invitation uses the token hash, never the token', () => {
    const scope = computeOperationScope({
      commandType: 'BOOTSTRAP',
      invitationToken: 'secret-token',
      candidateIdentityDigest: 'a'.repeat(64),
    });
    expect(scope.scopeKey).not.toContain('secret-token');
  });

  it('CANDIDATE_DECISION scopes by context id; SECOND_PARTY by account', () => {
    expect(
      computeOperationScope({ commandType: 'CANDIDATE_DECISION', contextId: 'ctx-1' })
    ).toEqual({ scopeKind: 'CANDIDATE_CONTEXT', scopeKey: 'ctx-1' });
    expect(
      computeOperationScope({ commandType: 'SECOND_PARTY_DECISION', accountId: 'acct-1' })
    ).toEqual({ scopeKind: 'ACCOUNT', scopeKey: 'acct-1' });
  });

  it('same payload → REPLAY; different payload → MISMATCH; absent → EXECUTE', () => {
    expect(decideBindingOperation(null, 'h')).toEqual({ action: 'EXECUTE' });
    expect(decideBindingOperation({ requestHash: 'h' }, 'h')).toEqual({ action: 'REPLAY' });
    expect(decideBindingOperation({ requestHash: 'h' }, 'other')).toEqual({
      action: 'MISMATCH',
    });
  });

  it('new attempt only when invitation valid and no live attempt', () => {
    expect(canCreateNewAttempt({ invitationValid: true, liveAttemptExists: false })).toBe(true);
    expect(canCreateNewAttempt({ invitationValid: true, liveAttemptExists: true })).toBe(false);
    expect(canCreateNewAttempt({ invitationValid: false, liveAttemptExists: false })).toBe(false);
  });

  it('operation key is not the attempt identity', () => {
    const scope = computeOperationScope({
      commandType: 'CANDIDATE_DECISION',
      contextId: 'attempt-uuid-like',
    });
    expect(scope.scopeKey).toBe('attempt-uuid-like');
    // The value is only a scope key; no attempt state is encoded.
    expect(scope).not.toHaveProperty('state');
  });
});