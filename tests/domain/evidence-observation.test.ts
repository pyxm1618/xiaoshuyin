/**
 * T020 — pure Observation domain semantics.
 *
 * RED before the Evidence domain types/validators exist.
 */

import { describe, it, expect } from 'vitest';
import {
  OBSERVATION_VALUE_STATES,
  validateObservationValue,
  validateOccurredTime,
  validateValidity,
  isExpired,
  assertNoServerOwnedFields,
} from '../../packages/domain/src/evidence.js';

describe('Observation typed values (T020)', () => {
  it('normalizes KNOWN TEXT', () => {
    const result = validateObservationValue({ state: 'KNOWN', type: 'TEXT', valueText: 'text' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.columns).toEqual({
        valueState: 'KNOWN',
        valueType: 'TEXT',
        valueText: 'text',
        valueNumber: null,
        valueBoolean: null,
        unit: null,
      });
    }
  });

  it('preserves numeric 0 (not unknown / null)', () => {
    const result = validateObservationValue({
      state: 'KNOWN',
      type: 'NUMBER',
      valueNumber: 0,
      unit: 'hours',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.columns.valueNumber).toBe(0);
      expect(result.columns.valueState).toBe('KNOWN');
      expect(result.columns.unit).toBe('hours');
    }
  });

  it('preserves boolean false (not unknown / null)', () => {
    const result = validateObservationValue({
      state: 'KNOWN',
      type: 'BOOLEAN',
      valueBoolean: false,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.columns.valueBoolean).toBe(false);
      expect(result.columns.valueState).toBe('KNOWN');
    }
  });

  it('rejects non-finite numeric values', () => {
    for (const valueNumber of [Number.NaN, Number.POSITIVE_INFINITY]) {
      const result = validateObservationValue({
        state: 'KNOWN',
        type: 'NUMBER',
        valueNumber,
      } as any);
      expect(result.ok, String(valueNumber)).toBe(false);
    }
  });

  it('rejects KNOWN variants carrying a second value dimension', () => {
    const result = validateObservationValue({
      state: 'KNOWN',
      type: 'TEXT',
      valueText: 'text',
      valueNumber: 1,
    } as any);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('EVIDENCE_VALUE_INVALID');
  });

  it('maps every unknown-like state to all-NULL value columns', () => {
    for (const state of ['UNKNOWN', 'NOT_COLLECTED', 'DECLINED', 'NOT_APPLICABLE'] as const) {
      const result = validateObservationValue({ state } as any);
      expect(result.ok, state).toBe(true);
      if (result.ok) {
        expect(result.columns).toEqual({
          valueState: state,
          valueType: null,
          valueText: null,
          valueNumber: null,
          valueBoolean: null,
          unit: null,
        });
      }
    }
  });

  it('canonical N/A state is NOT_APPLICABLE and EXPIRED is never a value state', () => {
    expect(OBSERVATION_VALUE_STATES).toEqual([
      'KNOWN',
      'UNKNOWN',
      'NOT_COLLECTED',
      'DECLINED',
      'NOT_APPLICABLE',
    ]);
    expect(OBSERVATION_VALUE_STATES).not.toContain('EXPIRED');
    expect(validateObservationValue({ state: 'N_A' } as any).ok).toBe(false);
  });

  it('rejects unknown-like states smuggling values', () => {
    const result = validateObservationValue({ state: 'UNKNOWN', valueText: 'x' } as any);
    expect(result.ok).toBe(false);
  });
});

describe('Occurred / recorded time (T020)', () => {
  it('KNOWN requires a timestamp', () => {
    expect(validateOccurredTime('KNOWN', null).ok).toBe(false);
    const known = validateOccurredTime('KNOWN', new Date('2026-01-01T00:00:00Z'));
    expect(known.ok).toBe(true);
    if (known.ok) expect(known.occurredAt).toBeInstanceOf(Date);
  });

  it('UNKNOWN requires null and never borrows recorded_at', () => {
    expect(validateOccurredTime('UNKNOWN', new Date()).ok).toBe(false);
    const unknown = validateOccurredTime('UNKNOWN', null);
    expect(unknown.ok).toBe(true);
    if (unknown.ok) expect(unknown.occurredAt).toBeNull();
  });

  it('rejects caller-supplied recordedAt', () => {
    const result = assertNoServerOwnedFields({ recordedAt: new Date(), content: 'x' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('EVIDENCE_SERVER_OWNED_FIELD');
    expect(assertNoServerOwnedFields({ content: 'x' }).ok).toBe(true);
  });

  it('validity window requires until > from when both present', () => {
    expect(
      validateValidity(new Date('2026-02-01T00:00:00Z'), new Date('2026-01-01T00:00:00Z')).ok
    ).toBe(false);
    expect(
      validateValidity(new Date('2026-01-01T00:00:00Z'), new Date('2026-01-01T00:00:00Z')).ok
    ).toBe(false);
    expect(
      validateValidity(new Date('2026-01-01T00:00:00Z'), new Date('2026-02-01T00:00:00Z')).ok
    ).toBe(true);
    expect(validateValidity(null, null).ok).toBe(true);
  });

  it('EXPIRED is derived from the clock, never persisted', () => {
    const now = new Date('2026-03-01T00:00:00Z');
    expect(isExpired(new Date('2026-02-01T00:00:00Z'), now)).toBe(true);
    expect(isExpired(new Date('2026-04-01T00:00:00Z'), now)).toBe(false);
    expect(isExpired(null, now)).toBe(false);
  });
});