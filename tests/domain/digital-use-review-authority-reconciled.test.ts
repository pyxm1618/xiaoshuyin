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
} from '../../apps/server/api/src/services/digital-use-review-professional-content.js';
import {
  TEST_A5001_PACKAGE,
  TEST_A5002_PACKAGE,
  normalizedReviewResponse,
} from '../support/digital-use-review-professional-content.js';

const actor = {
  accountId: '00000000-0000-4000-8000-000000000010',
  personId: '00000000-0000-4000-8000-000000000011',
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
    normalizedResponse: normalizedReviewResponse,
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
    normalizedResponse: normalizedReviewResponse,
    evidenceRefs: [],
    provenance: [{
      kind: 'PARENT_AUTHORED_OBSERVATION',
      sourcePersonId: actor.personId,
    }],
  } as const;
}

describe('Slice 15 authority-reconciled review contracts and fingerprints', () => {
  it('T1510 A5001 fingerprint binds actor, Case, exact subject, package and normalized response', () => {
    const base = {
      actor,
      familyId: '00000000-0000-4000-8000-000000000020',
      caseId: '00000000-0000-4000-8000-000000000021',
      nodeCode: 'A5001',
      expectedScenePackageVersion: 'v1' as const,
      response: a5001Response(),
    };
    const fingerprint = (
      value: Parameters<typeof a5001CanonicalRequestFingerprint>[0]
    ) => hashPayload(a5001CanonicalRequestFingerprint(value).fingerprint);
    const original = fingerprint(base);
    expect(fingerprint(base)).toBe(original);

    expect(fingerprint({
      ...base,
      actor: { ...actor, personId: '00000000-0000-4000-8000-000000000099' },
    })).not.toBe(original);
    expect(fingerprint({
      ...base,
      response: {
        ...a5001Response(),
        subject: {
          ...a5001Response().subject,
          selectionRevision: 4,
        },
      },
    })).not.toBe(original);
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
    expect(fingerprint({
      ...base,
      response: {
        ...a5001Response(),
        normalizedResponse: {
          outcome: 'SAME',
          note: 'Different normalized response.',
        },
      },
    })).not.toBe(original);
  });

  it('T1510 A5002 fingerprint binds exact Contract version/revision and package identity', () => {
    const base = {
      actor,
      familyId: '00000000-0000-4000-8000-000000000030',
      caseId: '00000000-0000-4000-8000-000000000031',
      nodeCode: 'A5002',
      expectedScenePackageVersion: 'v1' as const,
      response: a5002Response(),
    };
    const fingerprint = (
      value: Parameters<typeof a5002CanonicalRequestFingerprint>[0]
    ) => hashPayload(a5002CanonicalRequestFingerprint(value).fingerprint);
    const original = fingerprint(base);
    expect(fingerprint({
      ...base,
      response: {
        ...a5002Response(),
        subject: {
          ...a5002Response().subject,
          contractRevision: 8,
        },
      },
    })).not.toBe(original);
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
});
