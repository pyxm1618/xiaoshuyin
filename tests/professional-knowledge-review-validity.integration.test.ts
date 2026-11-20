import { describe, expect, it } from 'vitest';
import {
  projectProfessionalKnowledgeDependencyImpact,
  restoreProfessionalKnowledgeAfterNoMaterialImpact,
} from '../packages/domain/src/professional-knowledge.js';

describe('professional knowledge review / validity plane', () => {
  it('keeps NEEDS_REVIEW outside lifecycle and independently invalidates use', () => {
    const projected = projectProfessionalKnowledgeDependencyImpact({
      current: { reviewState: 'CURRENT', validityState: 'VALID' },
      impact: 'SOURCE_WITHDRAWAL',
      exactDependent: true,
    });
    expect(projected.reviewState).toBe('NEEDS_REVIEW');
    expect(projected.validityState).toBe('INVALID');
    expect(projected.eligibilitySuppressed).toBe(true);
  });

  it('restores CURRENT/VALID without a lifecycle mutation when review finds no material impact', () => {
    expect(
      restoreProfessionalKnowledgeAfterNoMaterialImpact({
        reviewState: 'NEEDS_REVIEW',
        validityState: 'UNKNOWN',
      })
    ).toEqual({ reviewState: 'CURRENT', validityState: 'VALID' });
  });

  it('does not promote review activity into Professional Approval', () => {
    const reviewed = {
      lifecycleStatus: 'CANDIDATE',
      reviewState: 'CURRENT',
      validityState: 'VALID',
    };
    expect(reviewed.reviewState).toBe('CURRENT');
    expect(reviewed).not.toHaveProperty('approved');
    expect(reviewed.lifecycleStatus).toBe('CANDIDATE');
  });
});
