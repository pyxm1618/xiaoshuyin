/**
 * Digital Use node content delivery — the minimum registered content surface.
 *
 * Only content that already exists in the frozen product Authority is served.
 * Nodes whose questions/options are professional questionnaire content are not
 * reconstructed here; they fail closed with the exact missing content list.
 */
import {
  FAMILY_ALLIANCE_CONTENT_NODE_CODES,
  FAMILY_ALLIANCE_CONTENT_VERSION,
  resolveFamilyAllianceContent,
  type FamilyAllianceContentNodeCode,
} from './family-alliance-content.js';

export const DIGITAL_USE_NODE_CONTENT_VERSION = 'digital-use-node-content-v1' as const;
export const DIGITAL_USE_TARGET_CATALOG_VERSION = 'family-alliance-target-catalog-v1' as const;

export const DIGITAL_USE_PRODUCT_AUTHORITY = Object.freeze({
  authorityDocument: 'Docs/V1产品需求.md',
  authorityDocumentVersion: 'v3.9',
  // Registration snapshot; later Authority revisions must not re-point it silently.
  sourceBlob: '379cb8cfb377924cd21ccfe55baa5aecdf207f5e',
  sectionHeading: '## 目标清单',
});

export const DIGITAL_USE_TARGET_OPTIONS = Object.freeze([
  Object.freeze({ code: 'SLEEP', displayName: '改善睡眠', mandatoryBasis: '无（可选项）' }),
  Object.freeze({ code: 'EXERCISE', displayName: '运动', mandatoryBasis: '无（可选项）' }),
  Object.freeze({ code: 'HOBBIES', displayName: '兴趣爱好', mandatoryBasis: '无（可选项）' }),
  Object.freeze({ code: 'CHORES', displayName: '家务', mandatoryBasis: '无（可选项）' }),
  Object.freeze({ code: 'FAMILY_GATHERING', displayName: '家庭聚会', mandatoryBasis: '无（可选项）' }),
  Object.freeze({ code: 'OUTDOOR_ACTIVITY', displayName: '外出活动', mandatoryBasis: '无（可选项）' }),
  Object.freeze({
    code: 'EMOTION_REGULATION_1',
    displayName: '情绪调节技能1',
    mandatoryBasis: '01002B / 01002C 时必选',
  }),
  Object.freeze({
    code: 'TIME_MANAGEMENT',
    displayName: '时间管理技能',
    mandatoryBasis: '01003B / 01003C / 01003D / 01003E / 01003F 时必选（V1 保留）',
  }),
  Object.freeze({
    code: 'FAMILY_RELATIONSHIP',
    displayName: '家庭关系',
    mandatoryBasis: '01003D / 01003E / 01003F 时必选',
  }),
  Object.freeze({
    code: 'EMOTION_REGULATION_2',
    displayName: '情绪调节技能2',
    mandatoryBasis: '01002D / 01002E / 01002F 时必选',
  }),
] as const);

export type DigitalUseTargetOption = (typeof DIGITAL_USE_TARGET_OPTIONS)[number];
export type DigitalUseTargetOptionCode = DigitalUseTargetOption['code'];

export const DIGITAL_USE_TARGET_SELECTION_CONTENT = Object.freeze({
  nodeCode: 'A3002' as const,
  contentVersion: DIGITAL_USE_NODE_CONTENT_VERSION,
  availability: 'AVAILABLE' as const,
  authorityKind: 'PRODUCT_FROZEN' as const,
  provenance: Object.freeze({
    ...DIGITAL_USE_PRODUCT_AUTHORITY,
    contentVersion: FAMILY_ALLIANCE_CONTENT_VERSION,
  }),
  body: null,
  question: Object.freeze({
    text: '目标清单以选项的方式列举出来供用户选择，其中有一些是可选项，有一些是必选项，必选项的依据是用户前面的测评结果（用户标签）',
    selection: 'MULTI' as const,
    submissionKind: 'TARGET_SELECTION' as const,
    minSelections: 0,
    maxSelections: 10,
    options: Object.freeze(
      DIGITAL_USE_TARGET_OPTIONS.map((option) =>
        Object.freeze({ value: option.code, label: option.displayName })
      )
    ),
  }),
});

/**
 * Target-definition pages. Each target's A30x0 page text is transcribed
 * verbatim from the frozen product Authority section for that target; nodes
 * whose section has no narrative body keep `body: null` and still carry the
 * section provenance.
 */
const TARGET_PAGE_CONTENT: Readonly<
  Record<string, { readonly sectionHeading: string; readonly body: string | null }>
> = Object.freeze({
  A3010: Object.freeze({
    sectionHeading: '### 改善睡眠。',
    body:
      '如果孩子总是在深夜玩手机，或者是因为用手机造成写作业拖延，影响了入睡时间，那么家长应该在帮助孩子控制手机使用时间的同时帮助孩子改善睡眠。\n\n改善睡眠包括睡眠卫生教育和睡眠习惯养成两个部分。',
  }),
  A3020: Object.freeze({
    sectionHeading: '### 运动。',
    body:
      '对于成长中的孩子来说，建议每周进行中等强度的运动3-6次，每次30分钟以上。家长如果有时间，可以陪孩子一起运动。',
  }),
  A3040: Object.freeze({
    sectionHeading: '### 兴趣爱好。',
    body:
      '帮助孩子养成一些长期持续的兴趣爱好。使用手机不能作为一种兴趣爱好。有时候，兴趣爱好和运动可能重叠，那么把运动作为兴趣爱好也可以。可以让孩子上兴趣班，或者家长和孩子一起来培养兴趣爱好，如果孩子不愿意和家长一起，也可以让他独自探索自己的爱好。',
  }),
  A3050: Object.freeze({
    sectionHeading: '### 家务。',
    body: null,
  }),
  A3060: Object.freeze({
    sectionHeading: '### 家庭聚会。',
    body: '全家人一起参与的活动，座谈会、游戏等，可以每周一次或者每个月一次',
  }),
  A3070: Object.freeze({
    sectionHeading: '### 外出活动。',
    body:
      '旅游或者其他户外活动。旅游经常可以作为家长对孩子的奖励，其他的户外活动或者外出就餐，去游乐场或和电影院，可以是家长和孩子一起，或者孩子和他的同学或朋友一起',
  }),
  A3080: Object.freeze({
    sectionHeading: '**情绪调节1**',
    body:
      '这个任务要求家长和孩子配合一起来进行。适合家长和孩子之间偶尔有冲突，闹一些情绪，容易发脾气、冲动、不耐烦、焦虑等',
  }),
  A3090: Object.freeze({
    sectionHeading: '**时间管理。**',
    body: null,
  }),
  A3100: Object.freeze({
    sectionHeading: '### 家庭关系。',
    body: '这个任务要求家长和孩子配合一起来进行，适合由于手机的问题而导致亲子关系紧张的情形。',
  }),
  A3110: Object.freeze({
    sectionHeading: '### 情绪调节2. ',
    body:
      '这个任务要求家长和孩子配合一起来进行，适合比较严重的情绪问题，如焦虑、愤怒、压力、消沉，容易产生冲突或者冲动行为、破坏行为，言语攻击等',
  }),
});

export interface DigitalUseMissingContentItem {
  readonly contentKind:
    | 'PROFESSIONAL_APPROVED_CONTENT'
    | 'APPROVED_CONTENT_VERSION'
    | 'INTEGRATED_TRIAGE_EVIDENCE'
    | 'NODE_CONTENT_NOT_REGISTERED';
  readonly authorityRef: string;
  readonly reason: string;
}

const PROFESSIONAL_CONTENT_MISSING: readonly DigitalUseMissingContentItem[] = Object.freeze([
  Object.freeze({
    contentKind: 'PROFESSIONAL_APPROVED_CONTENT',
    authorityRef:
      'Docs/V1产品需求.md 文档使用规则第5条（专业问卷题目/维度必须绑定真实批准的专业内容版本）',
    reason: '该节点的题目、选项与输入维度属于专业问卷内容，仓库内没有已批准的专业内容。',
  }),
  Object.freeze({
    contentKind: 'APPROVED_CONTENT_VERSION',
    authorityRef: 'Docs/V1技术设计.md Professional Reviewer / Professional Content authority',
    reason: '没有可引用的专业内容版本、批准身份与 provenance，运行时不得自行补造。',
  }),
]);

const UNAVAILABLE_CONTENT: Readonly<Record<string, readonly DigitalUseMissingContentItem[]>> =
  Object.freeze({
    A1001: PROFESSIONAL_CONTENT_MISSING,
    '01002': PROFESSIONAL_CONTENT_MISSING,
    '01003': PROFESSIONAL_CONTENT_MISSING,
  });

const UNREGISTERED_CONTENT: readonly DigitalUseMissingContentItem[] = Object.freeze([
  Object.freeze({
    contentKind: 'NODE_CONTENT_NOT_REGISTERED',
    authorityRef: 'Docs/V1产品需求.md / Docs/V1技术设计.md',
    reason: '该节点没有登记为已批准的可交付内容，运行时不得推测、拼接或补造。',
  }),
]);

export interface DigitalUseAvailableNodeContent {
  readonly nodeCode: string;
  readonly contentVersion: string;
  readonly availability: 'AVAILABLE';
  readonly authorityKind: 'PRODUCT_FROZEN';
  readonly provenance: {
    readonly authorityDocument: string;
    readonly authorityDocumentVersion: string;
    readonly sourceBlob: string;
    readonly sectionHeading: string;
    readonly contentVersion: string;
  };
  readonly body: string | null;
  readonly question: {
    readonly text: string;
    readonly selection: 'SINGLE' | 'MULTI';
    readonly submissionKind: 'TARGET_SELECTION';
    readonly minSelections: number;
    readonly maxSelections: number;
    readonly options: readonly { readonly value: string; readonly label: string }[];
  } | null;
}

export interface DigitalUseUnavailableNodeContent {
  readonly nodeCode: string;
  readonly contentVersion: string;
  readonly availability: 'UNAVAILABLE';
  readonly authorityKind: null;
  readonly provenance: null;
  readonly body: null;
  readonly question: null;
  readonly missing: readonly DigitalUseMissingContentItem[];
}

export type DigitalUseNodeContentDefinition =
  | DigitalUseAvailableNodeContent
  | DigitalUseUnavailableNodeContent;

function helpContent(
  nodeCode: FamilyAllianceContentNodeCode
): DigitalUseAvailableNodeContent {
  const asset = resolveFamilyAllianceContent(nodeCode);
  return Object.freeze({
    nodeCode: asset.nodeCode,
    contentVersion: DIGITAL_USE_NODE_CONTENT_VERSION,
    availability: 'AVAILABLE' as const,
    authorityKind: 'PRODUCT_FROZEN' as const,
    provenance: Object.freeze({
      authorityDocument: asset.authorityDocument,
      authorityDocumentVersion: asset.authorityDocumentVersion,
      sourceBlob: asset.sourceBlob,
      sectionHeading: asset.sectionHeading,
      contentVersion: DIGITAL_USE_NODE_CONTENT_VERSION,
    }),
    body: asset.body,
    question: null,
  });
}

/**
 * Resolve registered node content. `null` means the node is not part of the
 * Digital Use manifest at all; known nodes without approved content return an
 * explicit `UNAVAILABLE` projection instead.
 */
export function resolveDigitalUseNodeContent(
  nodeCode: string
): DigitalUseNodeContentDefinition | null {
  if (nodeCode === 'A3002') return DIGITAL_USE_TARGET_SELECTION_CONTENT;
  const targetPage = TARGET_PAGE_CONTENT[nodeCode];
  if (targetPage !== undefined) {
    return Object.freeze({
      nodeCode,
      contentVersion: DIGITAL_USE_NODE_CONTENT_VERSION,
      availability: 'AVAILABLE' as const,
      authorityKind: 'PRODUCT_FROZEN' as const,
      provenance: Object.freeze({
        ...DIGITAL_USE_PRODUCT_AUTHORITY,
        sectionHeading: targetPage.sectionHeading,
        contentVersion: DIGITAL_USE_NODE_CONTENT_VERSION,
      }),
      body: targetPage.body,
      question: null,
    });
  }
  if (
    FAMILY_ALLIANCE_CONTENT_NODE_CODES.includes(nodeCode as FamilyAllianceContentNodeCode)
  ) {
    return helpContent(nodeCode as FamilyAllianceContentNodeCode);
  }
  const missing = UNAVAILABLE_CONTENT[nodeCode];
  if (missing) {
    return Object.freeze({
      nodeCode,
      contentVersion: DIGITAL_USE_NODE_CONTENT_VERSION,
      availability: 'UNAVAILABLE' as const,
      authorityKind: null,
      provenance: null,
      body: null,
      question: null,
      missing,
    });
  }
  return Object.freeze({
    nodeCode,
    contentVersion: DIGITAL_USE_NODE_CONTENT_VERSION,
    availability: 'UNAVAILABLE' as const,
    authorityKind: null,
    provenance: null,
    body: null,
    question: null,
    missing: UNREGISTERED_CONTENT,
  });
}
