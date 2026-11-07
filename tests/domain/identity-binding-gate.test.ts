import { describe, it, expect } from 'vitest';
import {
  evaluateBindingGate,
  type BindingGateInput,
  type BindingInvitationResolution,
  type MinorGateResult,
} from '../../packages/domain/src/identity-binding-gate.js';

const INVITATION: BindingInvitationResolution = {
  status: 'VALID',
  participationId: 'part-1',
  targetPersonId: 'p1',
  targetFamilyId: 'fam-1',
  expiresAt: '2026-01-01T01:00:00.000Z',
};

const GUARDIAN = { accountId: 'acct-g', personId: 'guardian-1' };
const MANAGER = { accountId: 'acct-m', personId: 'manager-1' };

function input(overrides: Partial<BindingGateInput> = {}): BindingGateInput {
  return {
    stage: 'GATE_1',
    targetPersonId: 'p1',
    targetFamilyId: 'fam-1',
    targetAgeBand: 'UNDER_14',
    guardianPersonId: 'guardian-1',
    familyCreatedByPersonId: 'manager-1',
    membershipFamilyIds: ['fam-1'],
    invitation: INVITATION,
    candidateAccountId: null,
    candidateAccountBoundPersonId: null,
    targetAccountId: null,
    confirmer: null,
    minorGate: { decision: 'ALLOW' },
    ...overrides,
  };
}

function minor(reason: string): MinorGateResult {
  return { decision: 'BLOCK', reason };
}

describe('binding Gate matrix', () => {
  it('UNDER_14 + guardian + valid consent → PASS (GUARDIAN)', () => {
    expect(evaluateBindingGate(input())).toEqual({
      decision: 'PASS',
      ageBand: 'UNDER_14',
      authority: 'GUARDIAN',
    });
  });

  it('UNDER_14 without guardian → GUARDIAN_MISSING (no manager fallback)', () => {
    expect(
      evaluateBindingGate(input({ guardianPersonId: null }))
    ).toEqual({ decision: 'BLOCK', reason: 'GUARDIAN_MISSING' });
  });

  it('UNDER_14 invalid consent → GUARDIAN_CONSENT_INVALID, never PENDING', () => {
    expect(
      evaluateBindingGate(input({ minorGate: minor('GUARDIAN_CONSENT_REVOKED') }))
    ).toEqual({ decision: 'BLOCK', reason: 'GUARDIAN_CONSENT_INVALID' });
  });

  it('MINOR_14_17 with guardian → PASS (GUARDIAN), no UNDER_14 consent required', () => {
    expect(
      evaluateBindingGate(input({ targetAgeBand: 'MINOR_14_17' }))
    ).toEqual({ decision: 'PASS', ageBand: 'MINOR_14_17', authority: 'GUARDIAN' });
  });

  it('MINOR_14_17 without guardian → PASS (FAMILY_MANAGER)', () => {
    expect(
      evaluateBindingGate(
        input({ targetAgeBand: 'MINOR_14_17', guardianPersonId: null })
      )
    ).toEqual({ decision: 'PASS', ageBand: 'MINOR_14_17', authority: 'FAMILY_MANAGER' });
  });

  it('ADULT → AGE_BAND_ADULT_UNSUPPORTED', () => {
    expect(evaluateBindingGate(input({ targetAgeBand: 'ADULT' }))).toEqual({
      decision: 'BLOCK',
      reason: 'AGE_BAND_ADULT_UNSUPPORTED',
    });
  });

  it('UNKNOWN → AGE_BAND_UNKNOWN_BLOCKED', () => {
    expect(evaluateBindingGate(input({ targetAgeBand: 'UNKNOWN' }))).toEqual({
      decision: 'BLOCK',
      reason: 'AGE_BAND_UNKNOWN_BLOCKED',
    });
  });

  it('multi-family → MULTI_FAMILY_BLOCK', () => {
    expect(
      evaluateBindingGate(input({ membershipFamilyIds: ['fam-1', 'fam-2'] }))
    ).toEqual({ decision: 'BLOCK', reason: 'MULTI_FAMILY_BLOCK' });
  });

  it('not in target family → MULTI_FAMILY_BLOCK', () => {
    expect(
      evaluateBindingGate(input({ membershipFamilyIds: ['fam-2'] }))
    ).toEqual({ decision: 'BLOCK', reason: 'MULTI_FAMILY_BLOCK' });
  });

  it('terminal invitation → INVITATION_TERMINAL', () => {
    expect(
      evaluateBindingGate(input({ invitation: { status: 'TERMINAL_UNUSABLE' } }))
    ).toEqual({ decision: 'BLOCK', reason: 'INVITATION_TERMINAL' });
  });

  it('Gate 2 waits for both confirmations (PENDING, not TERMINAL)', () => {
    expect(
      evaluateBindingGate(
        input({
          stage: 'GATE_2',
          targetAgeBand: 'MINOR_14_17',
          confirmations: { candidate: true, secondParty: false },
        })
      )
    ).toEqual({ decision: 'PENDING', reason: 'AWAIT_CONFIRMATION' });
  });

  it('Gate 2 target already bound → TARGET_ALREADY_BOUND', () => {
    expect(
      evaluateBindingGate(
        input({
          stage: 'GATE_2',
          targetAgeBand: 'MINOR_14_17',
          targetAccountId: 'acct-other',
          confirmer: GUARDIAN,
          confirmations: { candidate: true, secondParty: true },
        })
      )
    ).toEqual({ decision: 'BLOCK', reason: 'TARGET_ALREADY_BOUND' });
  });

  it('Gate 2 wrong confirmer → WRONG_CONFIRMER', () => {
    expect(
      evaluateBindingGate(
        input({
          stage: 'GATE_2',
          targetAgeBand: 'MINOR_14_17',
          confirmer: MANAGER,
          confirmations: { candidate: true, secondParty: true },
        })
      )
    ).toEqual({ decision: 'BLOCK', reason: 'WRONG_CONFIRMER' });
  });

  it('Gate 2 candidate account bound to another Person → IDENTITY_CONFLICT', () => {
    expect(
      evaluateBindingGate(
        input({
          stage: 'GATE_2',
          targetAgeBand: 'MINOR_14_17',
          candidateAccountId: 'acct-c',
          candidateAccountBoundPersonId: 'p2',
          confirmer: GUARDIAN,
          confirmations: { candidate: true, secondParty: true },
        })
      )
    ).toEqual({ decision: 'BLOCK', reason: 'IDENTITY_CONFLICT' });
  });

  it('Gate 2 expired attempt → ATTEMPT_EXPIRED', () => {
    expect(
      evaluateBindingGate(
        input({
          stage: 'GATE_2',
          targetAgeBand: 'MINOR_14_17',
          attemptExpired: true,
          confirmer: GUARDIAN,
          confirmations: { candidate: true, secondParty: true },
        })
      )
    ).toEqual({ decision: 'BLOCK', reason: 'ATTEMPT_EXPIRED' });
  });

  it('verified_source is absent from the input and cannot grant authority', () => {
    // The only authority sources are guardian_person_id and family creator.
    const managerOnly = evaluateBindingGate(
      input({
        stage: 'GATE_2',
        targetAgeBand: 'MINOR_14_17',
        guardianPersonId: null,
        confirmer: { accountId: 'acct-x', personId: 'someone-else' },
        confirmations: { candidate: true, secondParty: true },
      })
    );
    expect(managerOnly).toEqual({ decision: 'BLOCK', reason: 'WRONG_CONFIRMER' });
  });
});