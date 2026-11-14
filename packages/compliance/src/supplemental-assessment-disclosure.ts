/**
 * 01004 Supplemental Assessment Disclosure Authority.
 *
 * This module owns approved disclosure CONTENT + IDENTITY only. It is not a
 * Consent ledger, state machine, Scene runtime, assessment instrument catalog,
 * or AI/RAG generation surface.
 */

import { createHash } from 'node:crypto';
import {
  DIGITAL_USE_SUPPLEMENTAL_ASSESSMENT,
  type ApprovedSupplementalAssessmentDisclosure,
  type SupplementalAssessmentDisclosureAuthority,
} from './supplemental-consent.js';

export const SUPPLEMENTAL_ASSESSMENT_DISCLOSURE_REFERENCE =
  'digital-use-01004-supplemental-assessment-disclosure' as const;

export const SUPPLEMENTAL_ASSESSMENT_DISCLOSURE_V1_VERSION = 'v1' as const;

/**
 * Canonical UTF-8 body for 01004 Disclosure V1.
 *
 * Canonicalization rule: exactly these five paragraphs joined by two LF
 * characters ("\\n\\n"). The title/reference/version are NOT part of the
 * hashed body. Any body change requires a new disclosure version and hash.
 */
export const SUPPLEMENTAL_ASSESSMENT_DISCLOSURE_V1_BODY = [
  '目的：补充测评用于在当前 Digital Use 问题之外，进一步了解是否还存在值得关注的情绪状态、亲子互动 / 家庭关系等信息，为后续反馈和问题判断提供补充参考。补充测评不用于诊断、确诊、治疗、医学判断，也不生成心理疾病筛查结论。',
  '方式：您可以自主选择当前已经批准并可用的补充测评类别，并完成相应测评。当前 01000 只允许情绪测评和亲子互动模式测评。如果当前没有已批准的具体测评工具，系统不得由 AI、RAG 或其他方式临时生成量表、题目、评分、cut-off 或结论，也不会用虚构内容替代 unavailable 状态。',
  '用途：补充测评结果只用于补充当前 Assessment Evidence、提供结果反馈、帮助判断是否建议关注其它问题 / 场景，并支持后续 Problem Formulation。结果不得自动用于确诊、启动治疗、替代专业人员评估或直接激活 Intervention。',
  '预计耗时与负担：具体预计耗时取决于您选择且当前已批准可用的测评内容；在开始具体测评前，系统必须向您显示该测评对应的预计耗时。若没有已批准的耗时信息，系统不得虚构固定时间。',
  '免责声明与选择：补充测评结果仅用于提供辅助信息和产品内反馈，不构成医学、精神科、心理诊断或治疗意见，也不能替代专业人员评估。您可以选择不同意进行补充测评；不同意将终止本次补充测评分支并返回主页面，不进入 01000，不会被伪装成测评结果，也不会生成任何虚构 Evidence。',
].join('\n\n');

export const SUPPLEMENTAL_ASSESSMENT_DISCLOSURE_V1_HASH =
  '45a4edce1d9b160265ac425facacd1ddbc0a33c7f2b35d76c5257d98301371d7' as const;

function sha256(body: string): string {
  return createHash('sha256').update(body, 'utf8').digest('hex');
}

// Fail at module load if V1 body drifts while its frozen identity remains v1.
if (sha256(SUPPLEMENTAL_ASSESSMENT_DISCLOSURE_V1_BODY) !== SUPPLEMENTAL_ASSESSMENT_DISCLOSURE_V1_HASH) {
  throw new Error(
    '01004 Supplemental Assessment Disclosure V1 body/hash drift: create a new version instead'
  );
}

export interface SupplementalAssessmentDisclosureArtifact
  extends ApprovedSupplementalAssessmentDisclosure {
  readonly body: string;
}

export const SUPPLEMENTAL_ASSESSMENT_DISCLOSURE_V1: SupplementalAssessmentDisclosureArtifact =
  Object.freeze({
    purpose: DIGITAL_USE_SUPPLEMENTAL_ASSESSMENT,
    reference: SUPPLEMENTAL_ASSESSMENT_DISCLOSURE_REFERENCE,
    version: SUPPLEMENTAL_ASSESSMENT_DISCLOSURE_V1_VERSION,
    hash: SUPPLEMENTAL_ASSESSMENT_DISCLOSURE_V1_HASH,
    body: SUPPLEMENTAL_ASSESSMENT_DISCLOSURE_V1_BODY,
  });

const APPROVED_SUPPLEMENTAL_ASSESSMENT_DISCLOSURES = Object.freeze([
  SUPPLEMENTAL_ASSESSMENT_DISCLOSURE_V1,
] as const);

export const CURRENT_SUPPLEMENTAL_ASSESSMENT_DISCLOSURE =
  SUPPLEMENTAL_ASSESSMENT_DISCLOSURE_V1;

/**
 * Production approved-content authority. Resolution is exact on all four
 * identity dimensions; no fuzzy matching, fallback, guardian notice reuse, or
 * caller/model-authored content is accepted.
 */
export const APPROVED_SUPPLEMENTAL_ASSESSMENT_DISCLOSURE_AUTHORITY: SupplementalAssessmentDisclosureAuthority =
  Object.freeze({
    resolveApprovedDisclosure(submitted: {
      readonly purpose: typeof DIGITAL_USE_SUPPLEMENTAL_ASSESSMENT;
      readonly reference: string;
      readonly version: string;
      readonly hash: string;
    }) {
      const approved = APPROVED_SUPPLEMENTAL_ASSESSMENT_DISCLOSURES.find(
        (candidate) =>
          submitted.purpose === candidate.purpose &&
          submitted.reference === candidate.reference &&
          submitted.version === candidate.version &&
          submitted.hash === candidate.hash
      );
      if (!approved) return null;

      return Object.freeze({
        purpose: approved.purpose,
        reference: approved.reference,
        version: approved.version,
        hash: approved.hash,
      });
    },
  });
