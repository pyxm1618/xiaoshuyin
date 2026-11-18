import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const SPEC = 'specs/phase2-authority-contract-foundation/spec.md';

describe('Phase 2 Authority Contract Foundation convergence', () => {
  const text = readFileSync(SPEC, 'utf8');

  it('is converged but remains downstream-only', () => {
    expect(text).toContain('Status: **PARTIAL_AUTHORITY_CONVERGENCE**');
    expect(text).toContain('D3 status: **CLOSED**');
    expect(text).toContain('downstream projection only');
    expect(text).toContain('P2-AUTH-011');
  });

  it('records D3 source convergence and freezes D7 without authority laundering', () => {
    expect(text).toContain('P2-AUTH-001');
    expect(text).toContain('D3 source convergence');
    expect(text).toContain('cross-dimension cancellation of an established positive is forbidden');
    expect(text).toContain('D5 status: **EXTERNAL_DEPENDENCY**');
    expect(text).not.toContain('Product D3 source cleanup remains governance-blocked');
    expect(text).toContain('P2-AUTH-002');
    expect(text).toContain('never a fifth Authority');
  });

  it('freezes the D8 command and recovery contracts without runtime claims', () => {
    for (const id of ['P2-AUTH-003','P2-AUTH-004','P2-AUTH-005','P2-AUTH-006','P2-AUTH-007','P2-AUTH-008','P2-AUTH-009','P2-AUTH-010']) {
      expect(text).toContain(id);
    }
    expect(text).toContain('ConfirmGoal');
    expect(text).toContain('A1001/01002/01003');
    expect(text).toContain('SAFETY_RESOLVE');
    expect(text).toContain('SERVICE_CONTROL');
    expect(text).not.toContain('STAFF_ACCESS_ADMIN');
  });
});
