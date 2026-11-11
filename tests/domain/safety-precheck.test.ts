/**
 * T904 — deterministic Safety precheck contract.
 *
 * Proves: pure/deterministic, current-state aware, no invented professional
 * rule catalog, strict runtime validation, no caller-boolean authority, and
 * Case id/version-bound decisions.
 */

import { describe, it, expect } from 'vitest';
import {
  runSafetyPrecheck,
  assertDecisionFreshForCase,
  isEnterHoldDecision,
  SafetyError,
  type ApprovedPolicyIdentity,
  type SafetyCaseSnapshot,
} from '../../packages/domain/src/safety/index.js';

const TRUSTED: ApprovedPolicyIdentity = {
  policyRef: 'policy.fixture',
  policyVersion: '1',
  ruleRef: 'rule.fixture',
  ruleVersion: '1',
};

function openCase(over: Partial<SafetyCaseSnapshot> = {}): SafetyCaseSnapshot {
  return { caseId: 'case-fixture', status: 'OPEN', version: 3, ...over };
}

function holdEvaluation(over: Record<string, unknown> = {}) {
  return {
    outcome: 'HOLD_REQUIRED',
    ...TRUSTED,
    riskCategoryRef: 'CATEGORY_FIXTURE',
    evidenceRefs: [{ kind: 'EVIDENCE', ref: 'ref-fixture' }],
    ...over,
  } as never;
}

function noHoldEvaluation(over: Record<string, unknown> = {}) {
  return {
    outcome: 'NO_HOLD',
    ...TRUSTED,
    evidenceRefs: [],
    ...over,
  } as never;
}

describe('runSafetyPrecheck (T904)', () => {
  it('is deterministic: identical inputs produce deeply equal decisions', () => {
    const input = {
      case: openCase(),
      trustedPolicyIdentity: TRUSTED,
      approvedEvaluation: holdEvaluation(),
    };
    const first = runSafetyPrecheck(input);
    const second = runSafetyPrecheck(input);
    const third = runSafetyPrecheck({
      case: { ...openCase() },
      trustedPolicyIdentity: { ...TRUSTED },
      approvedEvaluation: holdEvaluation(),
    });
    expect(second).toEqual(first);
    expect(third).toEqual(first);
  });

  it('returns ALREADY_HELD for a Case already in SAFETY_HOLD without evaluating rules', () => {
    expect(
      runSafetyPrecheck({
        case: openCase({ status: 'SAFETY_HOLD' }),
        trustedPolicyIdentity: TRUSTED,
      })
    ).toEqual({ kind: 'ALREADY_HELD', caseId: 'case-fixture', caseVersion: 3 });

    // Even an otherwise-valid hold evaluation cannot add a second decision.
    expect(
      runSafetyPrecheck({
        case: openCase({ status: 'SAFETY_HOLD' }),
        trustedPolicyIdentity: TRUSTED,
        approvedEvaluation: holdEvaluation(),
      }).kind
    ).toBe('ALREADY_HELD');
  });

  it('returns ENTER_HOLD bound to the Case id/version and the approved identity', () => {
    const decision = runSafetyPrecheck({
      case: openCase(),
      trustedPolicyIdentity: TRUSTED,
      approvedEvaluation: holdEvaluation(),
    });
    expect(decision).toEqual({
      kind: 'ENTER_HOLD',
      caseId: 'case-fixture',
      caseVersion: 3,
      identity: TRUSTED,
      riskCategoryRef: 'CATEGORY_FIXTURE',
      evidenceRefs: [{ kind: 'EVIDENCE', ref: 'ref-fixture' }],
    });
  });

  it('returns ALLOW when the approved deterministic rule says NO_HOLD', () => {
    expect(
      runSafetyPrecheck({
        case: openCase({ status: 'WAITING' }),
        trustedPolicyIdentity: TRUSTED,
        approvedEvaluation: noHoldEvaluation(),
      })
    ).toEqual({ kind: 'ALLOW', caseId: 'case-fixture', caseVersion: 3 });
  });

  it('rejects a raw caller boolean or any undeclared evaluation field', () => {
    for (const extra of [
      { isHighRisk: true },
      { highRisk: true },
      { risk: true },
      { matched: true },
      { reason: 'some free text' },
    ]) {
      expect(() =>
        runSafetyPrecheck({
          case: openCase(),
          trustedPolicyIdentity: TRUSTED,
          approvedEvaluation: holdEvaluation(extra),
        })
      ).toThrow(SafetyError);
    }
  });

  it('rejects a missing or malformed approved evaluation on a non-held Case', () => {
    for (const approvedEvaluation of [undefined, null]) {
      expect(() =>
        runSafetyPrecheck({
          case: openCase(),
          trustedPolicyIdentity: TRUSTED,
          ...(approvedEvaluation === undefined ? {} : { approvedEvaluation }),
        })
      ).toThrow(/SAFETY_PRECHECK_INVALID/);
    }

    for (const bad of [
      holdEvaluation({ outcome: 'RISK' }),
      holdEvaluation({ policyRef: '' }),
      holdEvaluation({ policyVersion: '   ' }),
      holdEvaluation({ ruleRef: undefined }),
      holdEvaluation({ ruleVersion: 7 }),
      holdEvaluation({ riskCategoryRef: null }),
      holdEvaluation({ riskCategoryRef: '  ' }),
      holdEvaluation({ evidenceRefs: 'not-an-array' }),
      holdEvaluation({ evidenceRefs: [{ kind: 'EVIDENCE' }] }),
      holdEvaluation({ evidenceRefs: [{ kind: '', ref: 'x' }] }),
      holdEvaluation({ evidenceRefs: [{ kind: 'EVIDENCE', ref: 'x', content: 'raw text' }] }),
    ]) {
      expect(() =>
        runSafetyPrecheck({
          case: openCase(),
          trustedPolicyIdentity: TRUSTED,
          approvedEvaluation: bad,
        })
      ).toThrow(/SAFETY_PRECHECK_INVALID/);
    }
  });

  it('rejects a malformed Case snapshot', () => {
    for (const snapshot of [
      { caseId: '', status: 'OPEN', version: 1 },
      { caseId: 'c', status: 'PAUSED', version: 1 },
      { caseId: 'c', status: 'OPEN', version: 0 },
      { caseId: 'c', status: 'OPEN', version: 1.5 },
      { caseId: 'c', status: 'OPEN' },
    ]) {
      expect(() =>
        runSafetyPrecheck({
          case: snapshot as never,
          trustedPolicyIdentity: TRUSTED,
        })
      ).toThrow(/SAFETY_PRECHECK_INVALID/);
    }
  });

  it('rejects a stale policy or rule identity instead of applying it', () => {
    const staleIdentities: Array<Partial<ApprovedPolicyIdentity>> = [
      { policyVersion: '2' },
      { policyRef: 'policy.other' },
      { ruleVersion: '2' },
      { ruleRef: 'rule.other' },
    ];
    for (const stale of staleIdentities) {
      expect(() =>
        runSafetyPrecheck({
          case: openCase(),
          trustedPolicyIdentity: { ...TRUSTED, ...stale },
          approvedEvaluation: holdEvaluation(),
        })
      ).toThrow(/SAFETY_PRECHECK_STALE/);
    }
  });

  it('binds every decision to the Case version it evaluated', () => {
    const decision = runSafetyPrecheck({
      case: openCase({ version: 3 }),
      trustedPolicyIdentity: TRUSTED,
      approvedEvaluation: holdEvaluation(),
    });
    expect(() =>
      assertDecisionFreshForCase(decision, { caseId: 'case-fixture', status: 'OPEN', version: 4 })
    ).toThrow(/SAFETY_PRECHECK_STALE/);
    expect(
      assertDecisionFreshForCase(decision, { caseId: 'case-fixture', status: 'OPEN', version: 3 })
    ).toBe(decision);
  });

  it('refuses to apply an ENTER_HOLD decision to a closed or already-held Case', () => {
    const decision = runSafetyPrecheck({
      case: openCase(),
      trustedPolicyIdentity: TRUSTED,
      approvedEvaluation: holdEvaluation(),
    });
    expect(() =>
      assertDecisionFreshForCase(decision, { caseId: 'case-fixture', status: 'CLOSED', version: 3 })
    ).toThrow(/CASE_CLOSED/);
    expect(() =>
      assertDecisionFreshForCase(decision, {
        caseId: 'case-fixture',
        status: 'SAFETY_HOLD',
        version: 3,
      })
    ).toThrow(/SAFETY_HOLD_ALREADY_ACTIVE/);
  });

  it('refuses to treat a non-ENTER_HOLD decision as a hold authority', () => {
    const allow = runSafetyPrecheck({
      case: openCase(),
      trustedPolicyIdentity: TRUSTED,
      approvedEvaluation: noHoldEvaluation(),
    });
    expect(isEnterHoldDecision(allow)).toBe(false);
    expect(() =>
      assertDecisionFreshForCase(allow, { caseId: 'case-fixture', status: 'OPEN', version: 3 })
    ).toThrow(/SAFETY_PRECHECK_INVALID/);
  });

  it('evaluates an unclosed Case in every non-held status (CLOSED handling belongs to the command)', () => {
    for (const status of ['OPEN', 'WAITING', 'LOST_CONTACT'] as const) {
      expect(
        runSafetyPrecheck({
          case: openCase({ status }),
          trustedPolicyIdentity: TRUSTED,
          approvedEvaluation: holdEvaluation(),
        }).kind
      ).toBe('ENTER_HOLD');
    }
  });

  it('never returns a decision carrying raw free text', () => {
    const decision = runSafetyPrecheck({
      case: openCase(),
      trustedPolicyIdentity: TRUSTED,
      approvedEvaluation: holdEvaluation(),
    });
    const serialized = JSON.stringify(decision);
    expect(serialized).not.toContain('isHighRisk');
    // Only opaque references are present.
    expect(JSON.parse(serialized).evidenceRefs).toEqual([
      { kind: 'EVIDENCE', ref: 'ref-fixture' },
    ]);
  });
});