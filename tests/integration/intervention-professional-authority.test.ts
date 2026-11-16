import { describe, expect, it } from 'vitest';
import {
  requireInterventionProfessionalQualification,
  resolveInterventionProfessionalAuthority,
  unavailableProductionInterventionProfessionalAuthorityProvider,
  unavailableProductionInterventionProfessionalQualificationProvider,
} from '../../apps/server/api/src/services/intervention-professional-authority.js';
import {
  professionalProof,
  professionalProvider,
} from '../support/intervention.js';

const request = {
  definitionId: '00000000-0000-7000-8000-000000000016',
  definitionVersion: 1,
  contentHash: 'a'.repeat(64),
  sceneId: 'DIGITAL_USE',
  sourceRefs: ['TEST_SOURCE:v1'],
  approvalScope: 'DIGITAL_USE',
};

describe('Slice 16 Professional Approval / qualification consumer seam', () => {
  it('production Professional Approval and qualification are truthfully unavailable', async () => {
    await expect(
      resolveInterventionProfessionalAuthority(
        unavailableProductionInterventionProfessionalAuthorityProvider,
        request,
        'RESOLVE'
      )
    ).resolves.toEqual({
      status: 'UNAVAILABLE',
      reason: 'NOT_PROFESSIONALLY_APPROVED',
    });
    await expect(
      requireInterventionProfessionalQualification(
        unavailableProductionInterventionProfessionalQualificationProvider,
        { reviewerIdentityRef: 'reviewer', approvalScope: 'DIGITAL_USE' }
      )
    ).rejects.toMatchObject({ code: 'INTERVENTION_QUALIFICATION_MISSING' });
  });

  it('distinguishes technical authority dependency failure from a real missing approval', async () => {
    const technicalFailure = {
      async resolve() { throw new Error('provider unavailable'); },
      async revalidate() { throw new Error('provider unavailable'); },
    };
    await expect(
      resolveInterventionProfessionalAuthority(
        technicalFailure,
        request,
        'RESOLVE'
      )
    ).resolves.toEqual({
      status: 'UNAVAILABLE',
      reason: 'DEPENDENCY_UNAVAILABLE',
    });

    await expect(
      requireInterventionProfessionalQualification(
        { async resolve() { throw new Error('qualification provider unavailable'); } },
        { reviewerIdentityRef: 'reviewer', approvalScope: 'DIGITAL_USE' }
      )
    ).rejects.toMatchObject({ code: 'INTERVENTION_DEPENDENCY_UNAVAILABLE' });
  });

  it('accepts only an exact valid approval proof', async () => {
    const result = await resolveInterventionProfessionalAuthority(
      professionalProvider(),
      request,
      'RESOLVE',
      Date.parse('2026-11-16T00:00:00.000Z')
    );
    expect(result.status).toBe('VALID');
  });

  const failures = [
    ['wrong definition', { definitionId: 'wrong' }, 'WRONG_DEFINITION'],
    ['wrong version', { definitionVersion: 2 }, 'WRONG_VERSION'],
    ['wrong hash', { contentHash: 'b'.repeat(64) }, 'WRONG_HASH'],
    ['wrong sources', { sourceRefs: ['OTHER'] }, 'SOURCE_REFS_MISMATCH'],
    ['wrong approval scope', { approvalScope: 'OTHER' }, 'APPROVAL_SCOPE_MISMATCH'],
    ['revoked staff authority', { staffAuthority: { assignmentRef: 'x', capability: 'PROFESSIONAL_REVIEW' as const, scopeRef: 'GLOBAL', status: 'REVOKED' as const } }, 'STAFF_AUTHORITY_INVALID'],
    ['missing qualification', { professionalQualification: { qualificationRef: '', scopeRef: 'DIGITAL_USE', status: 'VALID' as const } }, 'QUALIFICATION_MISSING'],
    ['unapproved', { reviewStatus: 'DRAFT' as const }, 'APPROVAL_NOT_APPROVED'],
    ['unpublished', { publicationStatus: 'UNPUBLISHED' as const }, 'UNPUBLISHED'],
    ['retired', { lifecycleStatus: 'RETIRED' as const }, 'RETIRED'],
    ['superseded', { lifecycleStatus: 'SUPERSEDED' as const }, 'SUPERSEDED'],
    ['expired', { effectiveTo: '2026-01-01T00:00:00.000Z' }, 'APPROVAL_EXPIRED'],
  ] as const;

  for (const [label, override, reason] of failures) {
    it('blocks ' + label, async () => {
      const result = await resolveInterventionProfessionalAuthority(
        professionalProvider(professionalProof(override)),
        request,
        'RESOLVE',
        Date.parse('2026-11-16T00:00:00.000Z')
      );
      expect(result).toMatchObject({ status: 'INVALID', reason });
    });
  }
});
