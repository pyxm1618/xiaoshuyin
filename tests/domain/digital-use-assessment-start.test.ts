import { describe, expect, it } from 'vitest';
import { decideAssessmentEntry } from '../../apps/server/api/src/services/digital-use-assessment.js';

describe('T1207 Assessment start/resume decision', () => {
  const base = {
    status: 'OPEN' as const,
    phase: 'INTAKE' as const,
    is_primary: true,
    version: 4,
  };

  it('starts only from INTAKE and resumes only from ASSESSMENT', () => {
    expect(decideAssessmentEntry(base, 4)).toBe('START');
    expect(decideAssessmentEntry({ ...base, phase: 'ASSESSMENT' }, 4)).toBe('RESUME');
  });

  it('fails closed on non-primary, stale, held, closed and later phases', () => {
    expect(() => decideAssessmentEntry({ ...base, is_primary: false }, 4)).toThrow('CASE_NOT_PRIMARY');
    expect(() => decideAssessmentEntry(base, 3)).toThrow('STALE_CASE_VERSION');
    expect(() => decideAssessmentEntry({ ...base, status: 'SAFETY_HOLD' }, 4)).toThrow('SAFETY_HOLD_BLOCKED');
    expect(() => decideAssessmentEntry({ ...base, status: 'CLOSED' }, 4)).toThrow('CASE_CLOSED');
    expect(() => decideAssessmentEntry({ ...base, phase: 'PROBLEM_FORMULATION' }, 4)).toThrow('CASE_PHASE_CONFLICT');
  });
});
