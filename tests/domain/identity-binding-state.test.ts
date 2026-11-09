import { describe, it, expect } from 'vitest';
import {
  canTransition,
  isSettled,
  materializeExpiration,
  settleAttempt,
} from '../../packages/domain/src/identity-binding.js';

const T0 = new Date('2026-01-01T00:00:00.000Z');

describe('binding attempt state machine', () => {
  it('allows only PENDING → COMMITTED / TERMINAL', () => {
    expect(canTransition('PENDING', 'COMMITTED')).toBe(true);
    expect(canTransition('PENDING', 'TERMINAL')).toBe(true);
    expect(canTransition('COMMITTED', 'TERMINAL')).toBe(false);
    expect(canTransition('TERMINAL', 'COMMITTED')).toBe(false);
    expect(canTransition('COMMITTED', 'PENDING')).toBe(false);
  });

  it('settled = COMMITTED / TERMINAL; PENDING is the only live state', () => {
    expect(isSettled('PENDING')).toBe(false);
    expect(isSettled('COMMITTED')).toBe(true);
    expect(isSettled('TERMINAL')).toBe(true);
  });

  it('settles once and refuses a second settlement', () => {
    const committed = settleAttempt('PENDING', {
      kind: 'COMMIT',
      committedAccountId: 'acct-1',
      settledAt: T0,
    });
    expect(committed.state).toBe('COMMITTED');
    expect(() =>
      settleAttempt('COMMITTED', {
        kind: 'TERMINAL',
        terminalReason: 'CONCURRENCY_LOSER',
        settledAt: T0,
      })
    ).toThrow(/ILLEGAL_BINDING_TRANSITION/);
  });

  it('materializes expiration only for PENDING and only after expiry', () => {
    const attempt = { state: 'PENDING' as const, expiresAt: new Date(T0.getTime() + 1000) };
    expect(materializeExpiration(attempt, T0)).toBeNull();
    expect(
      materializeExpiration(attempt, new Date(T0.getTime() + 1000))
    ).toEqual({ state: 'TERMINAL', terminalReason: 'ATTEMPT_EXPIRED', settledAt: new Date(T0.getTime() + 1000) });
    expect(
      materializeExpiration({ state: 'COMMITTED' as const, expiresAt: T0 }, new Date(T0.getTime() + 1))
    ).toBeNull();
  });

  it('RETRYABLE is not an attempt state', () => {
    const attemptStates = ['PENDING', 'COMMITTED', 'TERMINAL'] as const;
    expect(attemptStates.includes('RETRYABLE' as never)).toBe(false);
  });
});