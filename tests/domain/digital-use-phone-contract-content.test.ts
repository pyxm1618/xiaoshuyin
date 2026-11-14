import { describe, expect, it } from 'vitest';
import {
  ConfirmPhoneUseContractRequest,
  PhoneUseContractTerms,
  SavePhoneUseContractDraftRequest,
} from '@xiaoshuyin/contracts';
import { IDEMPOTENCY_COMMAND_TYPES } from '@xiaoshuyin/domain';
import {
  PHONE_USE_CONTRACT_CONTENT_META,
  PHONE_USE_CONTRACT_CONTENT_VERSION,
  PHONE_USE_CONTRACT_EXAMPLES,
  PHONE_USE_CONTRACT_FAQ,
  PHONE_USE_CONTRACT_QUIZ,
  PHONE_USE_CONTRACT_SOURCE_BLOB,
  PHONE_USE_CONTRACT_TEMPLATE,
  resolvePhoneUseContractContent,
} from '@xiaoshuyin/scenes/digital-use';
import {
  unavailableProductionRoleplayAdapter,
} from '../../apps/server/api/src/services/digital-use-roleplay-adapter.js';

describe('Slice 14 phone-use Contract professional content boundary', () => {
  it('binds the exact approved source blob and exposes one immutable V1 content identity', () => {
    expect(PHONE_USE_CONTRACT_CONTENT_VERSION).toBe('phone-use-contract-v1');
    expect(PHONE_USE_CONTRACT_SOURCE_BLOB).toBe('97a8db200013746faff64230ab7cbf5f15b41615');
    expect(PHONE_USE_CONTRACT_CONTENT_META).toEqual({
      contentVersion: PHONE_USE_CONTRACT_CONTENT_VERSION,
      sourceBlob: PHONE_USE_CONTRACT_SOURCE_BLOB,
      approved: true,
    });
    expect(resolvePhoneUseContractContent(PHONE_USE_CONTRACT_CONTENT_VERSION).meta)
      .toEqual(PHONE_USE_CONTRACT_CONTENT_META);
    expect(() => resolvePhoneUseContractContent('stale-version')).toThrow(
      'PHONE_USE_CONTRACT_CONTENT_STALE'
    );
  });

  it('contains exactly five preparation questions with the frozen answer key', () => {
    expect(PHONE_USE_CONTRACT_QUIZ).toHaveLength(5);
    expect(PHONE_USE_CONTRACT_QUIZ.map((q) => q.answer)).toEqual([
      true, false, false, false, false,
    ]);
    for (const question of PHONE_USE_CONTRACT_QUIZ) {
      expect(question.statement.length).toBeGreaterThan(0);
      expect(question.explanation.length).toBeGreaterThan(0);
    }
  });

  it('keeps the template, four professional examples and FAQ as assets rather than family facts', () => {
    expect(PHONE_USE_CONTRACT_TEMPLATE.sections).toEqual([
      'CONTRACT_PARTIES',
      'PURPOSE',
      'PHONE_USE_RULES',
      'EXECUTION_PERIOD',
      'PARENT_SUPPORT_MEASURES',
      'SUPERVISION_MEASURES',
      'INCENTIVES',
      'BREACH_RESPONSIBILITIES',
    ]);
    expect(PHONE_USE_CONTRACT_TEMPLATE.sourceText).toContain('手机使用合约');
    expect(PHONE_USE_CONTRACT_TEMPLATE.sourceText).toContain('使用手机的主要目的');
    expect(PHONE_USE_CONTRACT_TEMPLATE.sourceText).toContain('违反合约时的责任');
    expect(PHONE_USE_CONTRACT_EXAMPLES).toHaveLength(4);
    expect(PHONE_USE_CONTRACT_EXAMPLES.map((x) => x.id)).toEqual([
      'EXAMPLE_1','EXAMPLE_2','EXAMPLE_3','EXAMPLE_4',
    ]);
    expect(PHONE_USE_CONTRACT_EXAMPLES.map((x) => x.title)).toEqual([
      '王一涵，四年级学生',
      '李跃，初一学生',
      '高麒，高二学生',
      '徐玲玲，小学二年级',
    ]);
    for (const example of PHONE_USE_CONTRACT_EXAMPLES) {
      expect(example.sourceText.length).toBeGreaterThan(100);
    }
    expect(PHONE_USE_CONTRACT_FAQ.topics.length).toBeGreaterThanOrEqual(15);
    expect(PHONE_USE_CONTRACT_FAQ.sourceText.length).toBeGreaterThan(1500);
  });
});

describe('Slice 14 Contract request contracts', () => {
  const value = { state: 'VALUE' as const, value: '明确约定' };
  const terms = {
    purpose: value,
    phoneUseRules: value,
    executionPeriod: value,
    parentSupportMeasures: value,
    supervisionMeasures: value,
    incentives: value,
    breachResponsibilities: value,
  };

  it('requires every formal semantic section to use explicit VALUE / NOT_APPLICABLE / PENDING state', () => {
    expect(PhoneUseContractTerms.parse(terms)).toEqual(terms);
    expect(PhoneUseContractTerms.safeParse({
      ...terms,
      incentives: {},
    }).success).toBe(false);
    expect(PhoneUseContractTerms.safeParse({
      ...terms,
      incentives: { state: 'NOT_APPLICABLE' },
    }).success).toBe(false);
    expect(PhoneUseContractTerms.safeParse({
      ...terms,
      incentives: { state: 'PENDING' },
    }).success).toBe(true);
  });

  it('does not accept client-owned lifecycle, confirmation or route authority', () => {
    const base = {
      expectedCaseVersion: 7,
      adultPartyPersonId: '00000000-0000-7000-8000-000000000001',
      childPartyPersonId: '00000000-0000-7000-8000-000000000002',
      childParticipationId: '00000000-0000-7000-8000-000000000003',
      sourceTemplateVersion: PHONE_USE_CONTRACT_CONTENT_VERSION,
      dependencyRefs: [],
      terms,
    };
    expect(SavePhoneUseContractDraftRequest.safeParse(base).success).toBe(true);
    expect(SavePhoneUseContractDraftRequest.safeParse({
      ...base,
      status: 'ACTIVE',
    }).success).toBe(false);
    expect(SavePhoneUseContractDraftRequest.safeParse({
      ...base,
      childConfirmation: true,
    }).success).toBe(false);
    expect(ConfirmPhoneUseContractRequest.safeParse({
      expectedCaseVersion: 7,
      expectedDraftRevision: 2,
      actorRole: 'CHILD',
    }).success).toBe(false);
  });

  it('registers Contract and roleplay commands in the one shared idempotency vocabulary', () => {
    expect(IDEMPOTENCY_COMMAND_TYPES).toEqual(expect.arrayContaining([
      'PHONE_USE_CONTRACT_DRAFT_SAVE',
      'PHONE_USE_CONTRACT_CONFIRM',
      'PHONE_USE_CONTRACT_REVISE',
      'PHONE_USE_ROLEPLAY_CREATE',
      'PHONE_USE_ROLEPLAY_TURN',
      'PHONE_USE_ROLEPLAY_RATE',
      'PHONE_USE_ROLEPLAY_SELECT',
    ]));
  });
});

describe('Slice 14 Phase-3 boundary', () => {
  it('production adapter is truthfully unavailable and never returns canned AI output', async () => {
    await expect(unavailableProductionRoleplayAdapter.isAvailable({
      scenePackageVersion: 'digital-use-v1',
      professionalContentVersion: PHONE_USE_CONTRACT_CONTENT_VERSION,
      featureCode: 'DIGITAL_USE_ROLEPLAY_A4003',
    })).resolves.toBe(false);

    await expect(unavailableProductionRoleplayAdapter.createTurn({
      sessionId: '00000000-0000-7000-8000-000000000001',
      roundNumber: 1,
      simulatedChildInput: 'test',
      actorPersonId: '00000000-0000-7000-8000-000000000002',
      scenePackageVersion: 'digital-use-v1',
      professionalContentVersion: PHONE_USE_CONTRACT_CONTENT_VERSION,
    })).rejects.toMatchObject({ code: 'DOWNSTREAM_AI_UNAVAILABLE' });
  });
});
