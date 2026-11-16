import { describe, expect, it } from 'vitest';
import {
  A5001FamilyAllianceReviewSubmission,
  A5002PhoneUseContractReviewSubmission,
} from '@xiaoshuyin/contracts';
import { hashPayload } from '@xiaoshuyin/domain';
import {
  a5001CanonicalRequestFingerprint,
} from '../../apps/server/api/src/services/digital-use-family-alliance-review.js';
import {
  a5002CanonicalRequestFingerprint,
} from '../../apps/server/api/src/services/digital-use-phone-contract-review.js';
import {
  requireProfessionalReviewPackage,
  unavailableProductionProfessionalReviewContentProvider,
  type ProfessionalReviewContentProvider,
  type ProfessionalReviewResolvedPackage,
} from '../../apps/server/api/src/services/digital-use-review-professional-content.js';
import {
  TEST_A5001_PACKAGE,
  TEST_A5002_PACKAGE,
  TestProfessionalReviewContentProvider,
  normalizedReviewResponse,
} from '../support/digital-use-review-professional-content.js';

const actor = {
  accountId: '00000000-0000-4000-8000-000000000010',
  personId: '00000000-0000-4000-8000-000000000011',
};

const a5001ExactSubject: Parameters<
  typeof a5001CanonicalRequestFingerprint
>[2] = {
  familyId: '00000000-0000-4000-8000-000000000020',
  caseId: '00000000-0000-4000-8000-000000000021',
  scenePackageVersion: 'v1',
  familyAllianceSubject: {
    selfAssessmentArtifactId: '00000000-0000-4000-8000-000000000022',
    selfAssessmentRevision: 2,
    targetSelectionNodeRevision: 3,
    selectionRevision: 3,
  },
  selectedTargets: [{
    id: '00000000-0000-4000-8000-000000000012',
    targetCode: 'SLEEP',
    revision: 4,
    selectionRevision: 3,
    concreteTargetText: null,
    feasibility: null,
    progress: null,
    progressEvidenceRefs: [],
    helpHistoryRefs: [],
    sourceRefs: [],
  }],
};

const a5002ExactSubject: Parameters<
  typeof a5002CanonicalRequestFingerprint
>[2] = {
  familyId: '00000000-0000-4000-8000-000000000030',
  caseId: '00000000-0000-4000-8000-000000000031',
  scenePackageVersion: 'v1',
  contractId: '00000000-0000-4000-8000-000000000013',
  contractVersion: 2,
  contractRevision: 7,
  contractStatus: 'ACTIVE',
  sourceTemplateVersion: 'v1',
  executionPeriod: { state: 'VALUE', value: 'Two weeks.' },
  adultPartyPersonId: actor.personId,
  childPartyPersonId: '00000000-0000-4000-8000-000000000014',
  childParticipationId: '00000000-0000-4000-8000-000000000015',
  contractTermsFingerprint: 'sha256:test-contract-terms',
  supersedesId: null,
  lineage: [{
    contractId: '00000000-0000-4000-8000-000000000013',
    version: 2,
    revision: 7,
    status: 'ACTIVE',
    supersedesId: null,
  }],
};

function a5001Response() {
  return {
    kind: 'FAMILY_ALLIANCE_REVIEW',
    subject: {
      selectionRevision: 3,
      selectedTargets: [{
        targetId: '00000000-0000-4000-8000-000000000012',
        targetCode: 'SLEEP',
        targetRevision: 4,
      }],
    },
    professionalPackage: TEST_A5001_PACKAGE,
    packageResponse: normalizedReviewResponse,
    evidenceRefs: [],
    provenance: [{
      kind: 'PARENT_AUTHORED_OBSERVATION',
      sourcePersonId: actor.personId,
    }],
  } as const;
}

function a5002Response() {
  return {
    kind: 'PHONE_USE_CONTRACT_REVIEW',
    subject: {
      contractId: '00000000-0000-4000-8000-000000000013',
      contractVersion: 2,
      contractRevision: 7,
      contractStatus: 'ACTIVE',
    },
    professionalPackage: TEST_A5002_PACKAGE,
    packageResponse: normalizedReviewResponse,
    evidenceRefs: [],
    provenance: [{
      kind: 'PARENT_AUTHORED_OBSERVATION',
      sourcePersonId: actor.personId,
    }],
  } as const;
}

describe('Slice 15 authority-reconciled review contracts and fingerprints', () => {
  it('T1510 A5001 fingerprint binds actor, Case, server exact subject, package and normalized response', () => {
    const base = {
      actor,
      familyId: a5001ExactSubject.familyId,
      caseId: a5001ExactSubject.caseId,
      nodeCode: 'A5001',
      expectedCaseVersion: 5,
      expectedNodeRevision: 0,
      expectedScenePackageVersion: 'v1' as const,
      expectedSelectionRevision: 3,
      response: a5001Response(),
    };
    const fingerprint = (
      value: Parameters<typeof a5001CanonicalRequestFingerprint>[0],
      normalized = normalizedReviewResponse,
      subject = a5001ExactSubject
    ) => hashPayload(
      a5001CanonicalRequestFingerprint(value, normalized, subject).fingerprint
    );
    const original = fingerprint(base);
    expect(fingerprint(base)).toBe(original);

    expect(fingerprint({
      ...base,
      actor: { ...actor, personId: '00000000-0000-4000-8000-000000000099' },
    })).not.toBe(original);
    expect(fingerprint(
      base,
      normalizedReviewResponse,
      {
        ...a5001ExactSubject,
        familyAllianceSubject: {
          ...a5001ExactSubject.familyAllianceSubject,
          selectionRevision: 4,
        },
      }
    )).not.toBe(original);
    expect(fingerprint({
      ...base,
      response: {
        ...a5001Response(),
        professionalPackage: {
          ...TEST_A5001_PACKAGE,
          contentHash: 'sha256:different-a5001-package',
        },
      },
    })).not.toBe(original);
    expect(fingerprint(base, {
      outcome: 'SAME',
      note: 'Different normalized response.',
    })).not.toBe(original);
  });

  it('T1510 A5002 fingerprint binds server exact Contract revision and package identity', () => {
    const base = {
      actor,
      familyId: a5002ExactSubject.familyId,
      caseId: a5002ExactSubject.caseId,
      nodeCode: 'A5002',
      expectedCaseVersion: 5,
      expectedNodeRevision: 0,
      expectedScenePackageVersion: 'v1' as const,
      response: a5002Response(),
    };
    const fingerprint = (
      value: Parameters<typeof a5002CanonicalRequestFingerprint>[0],
      normalized = normalizedReviewResponse,
      subject = a5002ExactSubject
    ) => hashPayload(
      a5002CanonicalRequestFingerprint(value, normalized, subject).fingerprint
    );
    const original = fingerprint(base);
    expect(fingerprint(
      base,
      normalizedReviewResponse,
      { ...a5002ExactSubject, contractRevision: 8 }
    )).not.toBe(original);
    expect(fingerprint({
      ...base,
      response: {
        ...a5002Response(),
        professionalPackage: {
          ...TEST_A5002_PACKAGE,
          packageVersion: 'test-v2',
        },
      },
    })).not.toBe(original);
  });

  it('T1510 A5001 and A5002 canonical fingerprints cannot collide under the same actor/Family/Case/revisions', () => {
    const familyId = a5001ExactSubject.familyId;
    const caseId = a5001ExactSubject.caseId;
    const a5001 = hashPayload(
      a5001CanonicalRequestFingerprint(
        {
          actor,
          familyId,
          caseId,
          nodeCode: 'A5001',
          expectedCaseVersion: 5,
          expectedNodeRevision: 0,
          expectedScenePackageVersion: 'v1',
          response: a5001Response(),
        },
        normalizedReviewResponse,
        a5001ExactSubject
      ).fingerprint
    );
    const a5002 = hashPayload(
      a5002CanonicalRequestFingerprint(
        {
          actor,
          familyId,
          caseId,
          nodeCode: 'A5002',
          expectedCaseVersion: 5,
          expectedNodeRevision: 0,
          expectedScenePackageVersion: 'v1',
          response: a5002Response(),
        },
        normalizedReviewResponse,
        {
          ...a5002ExactSubject,
          familyId,
          caseId,
        }
      ).fingerprint
    );
    expect(a5002).not.toBe(a5001);
  });

  it('T1503 production provider has no valid Professional package by default', async () => {
    await expect(
      requireProfessionalReviewPackage(
        unavailableProductionProfessionalReviewContentProvider,
        {
          stream: 'FAMILY_ALLIANCE_REVIEW',
          scenePackageVersion: 'v1',
          ...TEST_A5001_PACKAGE,
        },
        'RESOLVE'
      )
    ).rejects.toMatchObject({ code: 'DEPENDENCY_UNAVAILABLE' });
  });

  it('T1504 provenance contracts require Evidence binding for child/transcribed claims', () => {
    expect(
      A5001FamilyAllianceReviewSubmission.safeParse({
        ...a5001Response(),
        provenance: [{
          kind: 'CHILD_AUTHORED_INPUT',
          sourcePersonId: '00000000-0000-4000-8000-000000000040',
        }],
      }).success
    ).toBe(false);

    expect(
      A5002PhoneUseContractReviewSubmission.safeParse({
        ...a5002Response(),
        provenance: [{
          kind: 'PARENT_TRANSCRIBED_CHILD_CLAIM',
          transcriberPersonId: actor.personId,
          childPersonId: '00000000-0000-4000-8000-000000000041',
        }],
      }).success
    ).toBe(false);
  });


  it('T1502 rejects every non-current Professional package proof state', async () => {
    const input = {
      stream: 'FAMILY_ALLIANCE_REVIEW' as const,
      scenePackageVersion: 'v1',
      ...TEST_A5001_PACKAGE,
    };
    const fixture = new TestProfessionalReviewContentProvider();
    const valid = await fixture.resolve(input);
    if (valid === null) throw new Error('missing test package fixture');

    const providerFor = (
      value: ProfessionalReviewResolvedPackage | null
    ): ProfessionalReviewContentProvider => ({
      async resolve() {
        return value;
      },
      async revalidate() {
        return value;
      },
    });

    const expectUnavailable = async (
      value: ProfessionalReviewResolvedPackage | null
    ) => {
      await expect(
        requireProfessionalReviewPackage(providerFor(value), input, 'RESOLVE')
      ).rejects.toMatchObject({ code: 'DEPENDENCY_UNAVAILABLE' });
    };

    await expectUnavailable(null);
    await expectUnavailable({
      ...valid,
      proof: { ...valid.proof, reviewStatus: 'DRAFT' },
    });
    await expectUnavailable({
      ...valid,
      proof: { ...valid.proof, publicationStatus: 'UNPUBLISHED' },
    });
    await expectUnavailable({
      ...valid,
      proof: {
        ...valid.proof,
        effectiveTo: '2025-01-01T00:00:00.000Z',
      },
    });
    await expectUnavailable({
      ...valid,
      proof: { ...valid.proof, lifecycleStatus: 'RETIRED' },
    });
    await expectUnavailable({
      ...valid,
      proof: { ...valid.proof, lifecycleStatus: 'SUPERSEDED' },
    });
    await expectUnavailable({
      ...valid,
      proof: {
        ...valid.proof,
        scope: [{
          stream: 'PHONE_USE_CONTRACT_REVIEW',
          scenePackageVersion: 'v1',
        }],
      },
    });
    await expectUnavailable({
      ...valid,
      proof: { ...valid.proof, packageVersion: 'wrong-version' },
    });
    await expectUnavailable({
      ...valid,
      loadedContentHash: 'sha256:loaded-content-does-not-match-proof',
    });
    await expectUnavailable({
      ...valid,
      proof: { ...valid.proof, reviewerProofStatus: 'REVOKED' },
    });
    await expectUnavailable({
      ...valid,
      proof: {
        ...valid.proof,
        approvalBinding: {
          ...valid.proof.approvalBinding,
          contentHash: 'sha256:approval-bound-to-different-content',
        },
      },
    });
    await expectUnavailable({
      ...valid,
      proof: {
        ...valid.proof,
        effectiveFrom: '2099-01-01T00:00:00.000Z',
      },
    });
    await expectUnavailable({
      ...valid,
      proof: {
        ...valid.proof,
        publishedAt: '2099-01-01T00:00:00.000Z',
      },
    });

    await expect(
      requireProfessionalReviewPackage(providerFor(valid), input, 'RESOLVE')
    ).resolves.toEqual(valid);
  });
});
