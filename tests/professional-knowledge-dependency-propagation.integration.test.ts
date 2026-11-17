import { describe, expect, it } from 'vitest';
import {
  projectProfessionalKnowledgeDependencyImpact,
  validateProfessionalApproval,
} from '../packages/domain/src/professional-knowledge.js';

describe('impact-scoped Professional Knowledge dependency propagation', () => {
  it.each([
    ['SOURCE_WITHDRAWAL', 'NEEDS_REVIEW', 'INVALID', true],
    ['SOURCE_CORRECTION', 'NEEDS_REVIEW', 'UNKNOWN', true],
    ['SCENE_APPLICABILITY_MATERIAL_CHANGE', 'NEEDS_REVIEW', 'UNKNOWN', true],
    ['APPROVAL_EXPIRED', 'CURRENT', 'VALID', true],
    ['APPROVAL_REVOKED', 'CURRENT', 'VALID', true],
    ['STAFF_AUTHORITY_REVOKED', 'CURRENT', 'VALID', true],
    ['QUALIFICATION_REVOKED', 'CURRENT', 'VALID', true],
    ['SCENE_PACKAGE_SUPERSEDED', 'CURRENT', 'VALID', false],
  ] as const)('%s affects only its exact dependent with expected projection', (impact, reviewState, validityState, eligibilitySuppressed) => {
    expect(projectProfessionalKnowledgeDependencyImpact({
      current: { reviewState: 'CURRENT', validityState: 'VALID' },
      impact, exactDependent: true,
    })).toEqual({ reviewState, validityState, eligibilitySuppressed });
    expect(projectProfessionalKnowledgeDependencyImpact({
      current: { reviewState: 'CURRENT', validityState: 'VALID' },
      impact, exactDependent: false,
    })).toEqual({ reviewState: 'CURRENT', validityState: 'VALID', eligibilitySuppressed: false });
  });

  it('does not require a new content version for approval expiry/revocation', () => {
    const current = { reviewState: 'CURRENT' as const, validityState: 'VALID' as const };
    const expired = projectProfessionalKnowledgeDependencyImpact({
      current, impact: 'APPROVAL_EXPIRED', exactDependent: true,
    });
    expect(expired).toMatchObject(current);
    expect(expired.eligibilitySuppressed).toBe(true);
  });
});
