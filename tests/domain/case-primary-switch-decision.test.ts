/**
 * T719 — SwitchPrimaryCase conflict decision (plan D-5 / R-10).
 *
 * Pure function, exhaustive over the six `case_status` values and the four
 * client-view classes. Ordering is frozen:
 *   CLOSED → SAFETY_HOLD(target) → SAFETY_HOLD(current) → ALREADY → STALE → ALLOW
 * CLOSED outranks SAFETY_HOLD, and ALREADY outranks STALE.
 */

import { describe, it, expect } from 'vitest';
import {
  decideSwitchPrimary,
  type SwitchPrimaryInput,
  type CaseStatusView,
} from '../../packages/domain/src/case-primary-switch.js';

const STATUSES: CaseStatusView[] = [
  'OPEN',
  'WAITING',

  'LOST_CONTACT',
  'SAFETY_HOLD',
  'CLOSED',
];

function row(caseId: string, status: CaseStatusView, version: number) {
  return { caseId, status, version };
}

function input(over: Partial<SwitchPrimaryInput> = {}): SwitchPrimaryInput {
  return {
    current: row('case-current', 'OPEN', 2),
    target: row('case-target', 'OPEN', 3),
    expected: { caseId: 'case-current', version: 2 },
    ...over,
  };
}

const MATCHING = { caseId: 'case-current', version: 2 };
const NO_VIEW = { caseId: null, version: null };
const STALE_ID = { caseId: 'case-other', version: 2 };
const STALE_VERSION = { caseId: 'case-current', version: 9 };

describe('decideSwitchPrimary (T719)', () => {
  it('covers all five statuses for the target with a matching view', () => {
    const expected: Record<CaseStatusView, string> = {
      OPEN: 'ALLOW',
      WAITING: 'ALLOW',

      LOST_CONTACT: 'ALLOW',
      SAFETY_HOLD: 'SAFETY_HOLD_BLOCKED',
      CLOSED: 'CASE_CLOSED',
    };
    for (const status of STATUSES) {
      const decision = decideSwitchPrimary(input({ target: row('case-target', status, 3) }));
      if (expected[status] === 'ALLOW') {
        expect(decision).toEqual({
          kind: 'ALLOW',
          demote: { caseId: 'case-current' },
          promote: { caseId: 'case-target' },
        });
      } else {
        expect(decision).toEqual({ kind: 'DENY', code: expected[status] });
      }
    }
  });

  it('covers all six statuses for the current primary (target OPEN, matching view)', () => {
    for (const status of STATUSES) {
      const decision = decideSwitchPrimary(
        input({ current: row('case-current', status, 2), expected: MATCHING })
      );
      if (status === 'SAFETY_HOLD') {
        expect(decision).toEqual({ kind: 'DENY', code: 'SAFETY_HOLD_BLOCKED' });
      } else {
        expect(decision).toEqual({
          kind: 'ALLOW',
          demote: { caseId: 'case-current' },
          promote: { caseId: 'case-target' },
        });
      }
    }
  });

  it('covers all four view classes for every target status', () => {
    const views = [NO_VIEW, MATCHING, STALE_ID, STALE_VERSION];
    for (const status of STATUSES) {
      for (const view of views) {
        const decision = decideSwitchPrimary(
          input({ target: row('case-target', status, 3), expected: view })
        );
        if (status === 'CLOSED') {
          expect(decision).toEqual({ kind: 'DENY', code: 'CASE_CLOSED' });
        } else if (status === 'SAFETY_HOLD') {
          expect(decision).toEqual({ kind: 'DENY', code: 'SAFETY_HOLD_BLOCKED' });
        } else if (view === NO_VIEW || view === STALE_ID || view === STALE_VERSION) {
          expect(decision).toEqual({ kind: 'DENY', code: 'STALE_PRIMARY_VIEW' });
        } else {
          expect(decision).toEqual({
            kind: 'ALLOW',
            demote: { caseId: 'case-current' },
            promote: { caseId: 'case-target' },
          });
        }
      }
    }
  });

  it('CLOSED outranks SAFETY_HOLD and STALE', () => {
    expect(
      decideSwitchPrimary(
        input({
          target: row('case-target', 'CLOSED', 3),
          current: row('case-current', 'SAFETY_HOLD', 2),
          expected: STALE_VERSION,
        })
      )
    ).toEqual({ kind: 'DENY', code: 'CASE_CLOSED' });
  });

  it('SAFETY_HOLD (current) outranks ALREADY and STALE', () => {
    expect(
      decideSwitchPrimary(
        input({
          current: row('case-target', 'SAFETY_HOLD', 3),
          target: row('case-target', 'OPEN', 3),
          expected: STALE_VERSION,
        })
      )
    ).toEqual({ kind: 'DENY', code: 'SAFETY_HOLD_BLOCKED' });
  });

  it('CASE_ALREADY_PRIMARY outranks STALE_PRIMARY_VIEW', () => {
    expect(
      decideSwitchPrimary(
        input({
          current: row('case-target', 'OPEN', 5),
          target: row('case-target', 'OPEN', 5),
          expected: STALE_VERSION,
        })
      )
    ).toEqual({ kind: 'DENY', code: 'CASE_ALREADY_PRIMARY' });
  });

  it('ALLOW demotes null exactly when there is no current primary (promotion)', () => {
    const promotion = decideSwitchPrimary(
      input({ current: null, expected: NO_VIEW })
    );
    expect(promotion).toEqual({
      kind: 'ALLOW',
      demote: null,
      promote: { caseId: 'case-target' },
    });

    const switchDecision = decideSwitchPrimary(input());
    expect(switchDecision.kind).toBe('ALLOW');
    if (switchDecision.kind === 'ALLOW') {
      expect(switchDecision.demote).toEqual({ caseId: 'case-current' });
    }
  });

  it('a promotion view is stale when a current primary exists', () => {
    expect(
      decideSwitchPrimary(input({ current: row('case-current', 'OPEN', 2), expected: NO_VIEW }))
    ).toEqual({ kind: 'DENY', code: 'STALE_PRIMARY_VIEW' });
  });

  it('a non-empty view is stale when there is no current primary', () => {
    expect(
      decideSwitchPrimary(
        input({ current: null, expected: { caseId: 'case-x', version: 2 } })
      )
    ).toEqual({ kind: 'DENY', code: 'STALE_PRIMARY_VIEW' });
  });
});