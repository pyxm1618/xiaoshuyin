import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const SPEC = 'specs/phase2-authority-contract-foundation/spec.md';

describe('Phase 2 Authority Contract Foundation convergence', () => {
  const text = readFileSync(SPEC, 'utf8');

  it('is converged but remains downstream-only', () => {
    expect(text).toContain('Status: **CONVERGED**');
    expect(text).toContain('downstream projection only');
    expect(text).toContain('P2-AUTH-011');
  });

  it('freezes the registered D3 and D7 semantics', () => {
    expect(text).toContain('P2-AUTH-001');
    expect(text).toContain('same-dimension credible true/false');
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
    expect(text).toContain('STAFF_ACCESS_ADMIN');
  });
});
