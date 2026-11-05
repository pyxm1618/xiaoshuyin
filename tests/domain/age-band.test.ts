import { describe, it, expect } from 'vitest';
import { assertMinorProcessingAllowed } from '../../packages/compliance/src/age-gate.js';

describe('Age Gate (T031/T032)', () => {
  const makeDeps = (profile: any, consent: any = null) => ({
    getProfile: () => profile,
    getConsentRecord: () => consent,
    getCurrentNoticeHash: () => 'a'.repeat(64),
  });

  it('PROFILE_MISSING → BLOCK', () => {
    const r = assertMinorProcessingAllowed('p1', makeDeps(null));
    expect(r).toEqual({ decision: 'BLOCK', reason: 'PROFILE_MISSING' });
  });

  it('UNKNOWN → BLOCK', () => {
    const r = assertMinorProcessingAllowed('p1', makeDeps({ ageBand: 'UNKNOWN' }));
    expect(r).toEqual({ decision: 'BLOCK', reason: 'AGE_BAND_UNKNOWN' });
  });

  it('ADULT → ALLOW', () => {
    const r = assertMinorProcessingAllowed('p1', makeDeps({ ageBand: 'ADULT' }));
    expect(r).toEqual({ decision: 'ALLOW', minorMode: false });
  });

  it('MINOR_14_17 → ALLOW with minorMode', () => {
    const r = assertMinorProcessingAllowed('p1', makeDeps({ ageBand: 'MINOR_14_17' }));
    expect(r).toEqual({ decision: 'ALLOW', minorMode: true });
  });

  it('UNDER_14 with valid consent → ALLOW', () => {
    const r = assertMinorProcessingAllowed('p1', makeDeps(
      {
        ageBand: 'UNDER_14',
        guardianPersonId: 'g1',
        guardianConsentRecordId: 'cr1',
        guardianConsentVersion: 1,
      },
      {
        id: 'cr1',
        decision: 'GRANTED',
        boundPersonId: 'p1',
        noticeHash: 'a'.repeat(64),
        guardianPersonId: 'g1',
      }
    ));
    expect(r).toEqual({ decision: 'ALLOW', minorMode: true });
  });

  it('UNDER_14 with revoked consent → BLOCK', () => {
    const r = assertMinorProcessingAllowed('p1', makeDeps(
      {
        ageBand: 'UNDER_14',
        guardianPersonId: 'g1',
        guardianConsentRecordId: 'cr1',
        guardianConsentVersion: 1,
      },
      {
        id: 'cr1',
        decision: 'REVOKED',
        boundPersonId: 'p1',
        noticeHash: 'a'.repeat(64),
        guardianPersonId: 'g1',
      }
    ));
    expect(r).toEqual({ decision: 'BLOCK', reason: 'GUARDIAN_CONSENT_REVOKED' });
  });

  it('NOT_COLLECTED is not a valid age band (falls through to UNKNOWN)', () => {
    const r = assertMinorProcessingAllowed('p1', makeDeps({ ageBand: 'NOT_COLLECTED' }));
    expect(r.decision).toBe('BLOCK');
  });
});
