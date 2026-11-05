import { describe, it, expect } from 'vitest';
import { computeSupersede, checkSourceAcceptability } from '../../packages/domain/src/provenance.js';

describe('Provenance (T033/T034)', () => {
  const baseValue = {
    personId: 'p1',
    attribute: 'DISPLAY_NAME' as const,
    valueText: '小明',
    sourceKind: 'GUARDIAN_RELAY' as const,
    providedByPersonId: 'g1',
  };

  it('same source supersedes old RECORDED row', () => {
    const existing = [
      { ...baseValue, id: 'v1', status: 'RECORDED' as const, supersedesId: null },
    ];
    const result = computeSupersede(existing, baseValue);
    expect(result.supersededIds).toEqual(['v1']);
    expect(result.newValues[0]!.supersedesId).toBe('v1');
    expect(result.newValues[0]!.status).toBe('RECORDED');
  });

  it('different source coexists (no supersede)', () => {
    const existing = [
      { ...baseValue, id: 'v1', status: 'RECORDED' as const, supersedesId: null },
    ];
    const result = computeSupersede(existing, { ...baseValue, sourceKind: 'SELF_STATEMENT' });
    expect(result.supersededIds).toEqual([]);
    expect(result.newValues[0]!.supersedesId).toBeNull();
  });

  it('FAMILY_CREATE: only SELF_STATEMENT allowed', () => {
    expect(checkSourceAcceptability('FAMILY_CREATE', 'ADULT', 'SELF_STATEMENT')).toBeNull();
    expect(checkSourceAcceptability('FAMILY_CREATE', 'ADULT', 'GUARDIAN_RELAY')).toBe('AGE_BAND_SOURCE_NOT_ALLOWED');
    expect(checkSourceAcceptability('FAMILY_CREATE', 'MINOR_14_17', 'SELF_STATEMENT')).toBe('FAMILY_MANAGER_MUST_BE_ADULT');
  });

  it('MEMBER_CREATE_UNDER_14: only guardian-origin allowed', () => {
    expect(checkSourceAcceptability('MEMBER_CREATE_UNDER_14', 'UNDER_14', 'GUARDIAN_RELAY')).toBeNull();
    expect(checkSourceAcceptability('MEMBER_CREATE_UNDER_14', 'UNDER_14', 'GUARDIAN_OBSERVATION')).toBeNull();
    expect(checkSourceAcceptability('MEMBER_CREATE_UNDER_14', 'UNDER_14', 'SELF_STATEMENT')).toBe('AGE_BAND_SOURCE_NOT_ALLOWED');
    expect(checkSourceAcceptability('MEMBER_CREATE_UNDER_14', 'UNDER_14', 'OTHER_MEMBER_RELAY')).toBe('AGE_BAND_SOURCE_NOT_ALLOWED');
  });

  it('MEMBER_CREATE_OTHER: all 4 writable sources allowed', () => {
    expect(checkSourceAcceptability('MEMBER_CREATE_OTHER', 'MINOR_14_17', 'SELF_STATEMENT')).toBeNull();
    expect(checkSourceAcceptability('MEMBER_CREATE_OTHER', 'ADULT', 'OTHER_MEMBER_RELAY')).toBeNull();
    expect(checkSourceAcceptability('MEMBER_CREATE_OTHER', 'UNKNOWN', 'MANUAL_DEVICE_DATA')).toBe('AGE_BAND_SOURCE_NOT_ALLOWED');
  });
});
