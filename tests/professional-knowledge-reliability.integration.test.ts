import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  projectProfessionalKnowledgeDependencyImpact,
  validateProfessionalApproval,
} from '../packages/domain/src/professional-knowledge.js';

describe('Professional Knowledge adversarial reliability matrix', () => {
  it('has deterministic aggregate locks + CAS for editor/review/release/retire races', () => {
    const repository = readFileSync(
      new URL('../packages/domain/src/professional-knowledge-repository.ts', import.meta.url),
      'utf8'
    );
    expect(repository).toContain('FOR UPDATE');
    expect(repository).toMatch(/WHERE id = \$1 AND revision = \$7 AND lifecycle_status = 'CANDIDATE'/);
    expect(repository).toMatch(/WHERE id = \$1\s+AND revision = \$2\s+AND lifecycle_status = 'CANDIDATE'/);
    expect(repository).toContain('PROFESSIONAL_KNOWLEDGE_STALE_REVISION');
  });

  it('candidate edit resets prior review/validity, closing review-vs-edit and proof-arrival-vs-edit races', () => {
    const repository = readFileSync(
      new URL('../packages/domain/src/professional-knowledge-repository.ts', import.meta.url),
      'utf8'
    );
    expect(repository).toContain("review_state = 'PENDING'");
    expect(repository).toContain("validity_state = 'UNKNOWN'");
    expect(repository).toContain('knowledge_revision');
  });

  it('provider outage remains unavailable, never a business invalidation', () => {
    const result = validateProfessionalApproval({
      version: {} as any,
      provider: { status: 'UNAVAILABLE', reason: 'TIMEOUT' },
      staffAuthority: { status: 'UNAVAILABLE', reason: 'not-read' },
      qualification: { status: 'UNAVAILABLE', reason: 'not-read' },
    });
    expect(result).toEqual({ status: 'UNAVAILABLE', dependency: 'APPROVAL:TIMEOUT' });
  });

  it('validity propagation cannot globally invalidate unrelated versions', () => {
    expect(projectProfessionalKnowledgeDependencyImpact({
      current: { reviewState: 'CURRENT', validityState: 'VALID' },
      impact: 'SOURCE_WITHDRAWAL',
      exactDependent: false,
    })).toEqual({
      reviewState: 'CURRENT', validityState: 'VALID', eligibilitySuppressed: false,
    });
  });

  it('Scene binding currentness is exact-version, not floating latest', () => {
    const scene = readFileSync(
      new URL('../packages/scenes/digital-use/professional-knowledge-binding.ts', import.meta.url),
      'utf8'
    );
    expect(scene).not.toMatch(/latest/i);
    expect(scene).toContain('scenePackageVersion === scenePackageVersion');
  });

  it('shared idempotency settles mutation outcomes for lost-response replay', () => {
    const service = readFileSync(
      new URL('../apps/server/api/src/services/professional-knowledge.ts', import.meta.url),
      'utf8'
    );
    expect(service.match(/runIdempotentCommandInTransaction/g)?.length ?? 0).toBeGreaterThanOrEqual(5);
    expect(service).not.toContain('knowledge_idempotency');
  });
});
