import { describe, expect, it } from 'vitest';
import {
  ConfirmPhoneUseContractRequest,
  PhoneUseContractDto,
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

describe('Slice 14 phone-use Contract content authority boundary', () => {
  it('separates the frozen product baseline from Professional approval authority', () => {
    expect(PHONE_USE_CONTRACT_CONTENT_VERSION).toBe('phone-use-contract-v1');
    expect(PHONE_USE_CONTRACT_SOURCE_BLOB).toBe('97a8db200013746faff64230ab7cbf5f15b41615');
    expect(PHONE_USE_CONTRACT_CONTENT_META).toEqual({
      contentVersion: PHONE_USE_CONTRACT_CONTENT_VERSION,
      sourceBlob: PHONE_USE_CONTRACT_SOURCE_BLOB,
      approved: true,
      productBaselineStatus: 'FROZEN',
      professionalReviewStatus: 'NOT_APPROVED',
    });
    expect(PHONE_USE_CONTRACT_CONTENT_META.approved).toBe(true);
    expect(PHONE_USE_CONTRACT_CONTENT_META.productBaselineStatus).toBe('FROZEN');
    expect(PHONE_USE_CONTRACT_CONTENT_META.professionalReviewStatus).toBe('NOT_APPROVED');
    expect(PHONE_USE_CONTRACT_CONTENT_META).not.toHaveProperty('professionalApproval');
    const resolved = resolvePhoneUseContractContent(
      PHONE_USE_CONTRACT_CONTENT_VERSION
    );
    expect(resolved.meta).toEqual({
      contentVersion: PHONE_USE_CONTRACT_CONTENT_VERSION,
      sourceBlob: PHONE_USE_CONTRACT_SOURCE_BLOB,
      approved: true,
    });
    expect(resolved.authorityMeta).toEqual(PHONE_USE_CONTRACT_CONTENT_META);
    expect(() => resolvePhoneUseContractContent('stale-version')).toThrow(
      'PHONE_USE_CONTRACT_CONTENT_STALE'
    );
  });

  it('projects the five A4001 canonical questions, answers and explanations exactly', () => {
    expect(PHONE_USE_CONTRACT_QUIZ).toEqual([
      {
        id: 'Q1',
        statement: '手机使用合约的每一个项目都要由家长和孩子一起来制订',
        answer: true,
        explanation: '合约条款由家长邀请孩子共同制订，并由双方确认、同意；不是家长单方面制定。',
      },
      {
        id: 'Q2',
        statement: '制订手机使用合约以后，孩子必须做到合约里的要求，否则这份合约就失败了',
        answer: false,
        explanation: '合约强调可行性、执行后的持续沟通与必要调整；一次未做到不等于整个合约失败。',
      },
      {
        id: 'Q3',
        statement: '家长不应该和孩子讨价还价，否则孩子就会不断提出不合理的要求',
        answer: false,
        explanation: '原合约原则明确协商与妥协是双方的，禁止协商与当前产品原则相反。',
      },
      {
        id: 'Q4',
        statement: '手机使用合约应该用来约束孩子，对家长不具有约束力',
        answer: false,
        explanation: '合约包含家长配合措施及家长未配合时的责任，对双方都有约束。',
      },
      {
        id: 'Q5',
        statement: '手机使用合约的期限越长越好',
        answer: false,
        explanation: '合约期限取决于改变难度与可行性；原 FAQ 明确不支持“越长越好”。',
      },
    ]);
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
    expect(PHONE_USE_CONTRACT_TEMPLATE.sourceText).toContain('制订合约的');
    expect(PHONE_USE_CONTRACT_TEMPLATE.sourceText).toContain('违约责任：');
    expect(PHONE_USE_CONTRACT_TEMPLATE.sourceText).toContain('如果家长没有配合，应负责任：');
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
    const { childParticipationId: _omitted, ...withoutParticipation } = base;
    expect(SavePhoneUseContractDraftRequest.safeParse(withoutParticipation).success).toBe(true);
    expect(PhoneUseContractDto.safeParse({
      id: '00000000-0000-7000-8000-000000000010',
      familyId: '00000000-0000-7000-8000-000000000011',
      caseId: '00000000-0000-7000-8000-000000000012',
      version: 1,
      draftRevision: 1,
      status: 'DRAFT',
      adultPartyPersonId: base.adultPartyPersonId,
      childPartyPersonId: base.childPartyPersonId,
      childParticipationId: null,
      terms,
      sourceTemplateVersion: base.sourceTemplateVersion,
      dependencyRefs: [],
      parentConfirmation: null,
      childConfirmation: null,
      supersedesId: null,
      updateReason: null,
      updateTrigger: null,
      createdByPersonId: base.adultPartyPersonId,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      activatedAt: null,
      supersededAt: null,
      pausedAt: null,
    }).success).toBe(true);
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
