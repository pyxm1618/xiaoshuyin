import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  APPROVED_SUPPLEMENTAL_ASSESSMENT_DISCLOSURE_AUTHORITY,
  CURRENT_SUPPLEMENTAL_ASSESSMENT_DISCLOSURE,
  SUPPLEMENTAL_ASSESSMENT_DISCLOSURE_REFERENCE,
  SUPPLEMENTAL_ASSESSMENT_DISCLOSURE_V1_BODY,
  SUPPLEMENTAL_ASSESSMENT_DISCLOSURE_V1_HASH,
  SUPPLEMENTAL_ASSESSMENT_DISCLOSURE_V1_VERSION,
} from '../../packages/compliance/src/supplemental-assessment-disclosure.js';
import {
  DIGITAL_USE_SUPPLEMENTAL_ASSESSMENT,
  NO_APPROVED_SUPPLEMENTAL_ASSESSMENT_DISCLOSURE_AUTHORITY,
} from '../../packages/compliance/src/supplemental-consent.js';
import { getCurrentNoticeHash, getCurrentNoticeVersion } from '../../packages/compliance/src/notices.js';

const EXPECTED_BODY = "目的：补充测评用于在当前 Digital Use 问题之外，进一步了解是否还存在值得关注的情绪状态、亲子互动 / 家庭关系等信息，为后续反馈和问题判断提供补充参考。补充测评不用于诊断、确诊、治疗、医学判断，也不生成心理疾病筛查结论。\n\n方式：您可以自主选择当前已经批准并可用的补充测评类别，并完成相应测评。当前 01000 只允许情绪测评和亲子互动模式测评。如果当前没有已批准的具体测评工具，系统不得由 AI、RAG 或其他方式临时生成量表、题目、评分、cut-off 或结论，也不会用虚构内容替代 unavailable 状态。\n\n用途：补充测评结果只用于补充当前 Assessment Evidence、提供结果反馈、帮助判断是否建议关注其它问题 / 场景，并支持后续 Problem Formulation。结果不得自动用于确诊、启动治疗、替代专业人员评估或直接激活 Intervention。\n\n预计耗时与负担：具体预计耗时取决于您选择且当前已批准可用的测评内容；在开始具体测评前，系统必须向您显示该测评对应的预计耗时。若没有已批准的耗时信息，系统不得虚构固定时间。\n\n免责声明与选择：补充测评结果仅用于提供辅助信息和产品内反馈，不构成医学、精神科、心理诊断或治疗意见，也不能替代专业人员评估。您可以选择不同意进行补充测评；不同意将终止本次补充测评分支并返回主页面，不进入 01000，不会被伪装成测评结果，也不会生成任何虚构 Evidence。";
const EXPECTED_HASH = '45a4edce1d9b160265ac425facacd1ddbc0a33c7f2b35d76c5257d98301371d7';

describe('01004 supplemental-assessment disclosure authority', () => {
  it('freezes the current V1 disclosure body and identity', () => {
    expect(CURRENT_SUPPLEMENTAL_ASSESSMENT_DISCLOSURE).toEqual({
      purpose: DIGITAL_USE_SUPPLEMENTAL_ASSESSMENT,
      reference: 'digital-use-01004-supplemental-assessment-disclosure',
      version: 'v1',
      hash: EXPECTED_HASH,
      body: EXPECTED_BODY,
    });
    expect(SUPPLEMENTAL_ASSESSMENT_DISCLOSURE_REFERENCE).toBe('digital-use-01004-supplemental-assessment-disclosure');
    expect(SUPPLEMENTAL_ASSESSMENT_DISCLOSURE_V1_VERSION).toBe('v1');
    expect(SUPPLEMENTAL_ASSESSMENT_DISCLOSURE_V1_BODY).toBe(EXPECTED_BODY);
    expect(SUPPLEMENTAL_ASSESSMENT_DISCLOSURE_V1_HASH).toBe(EXPECTED_HASH);
  });

  it('resolves the exact approved reference/version/hash', () => {
    expect(
      APPROVED_SUPPLEMENTAL_ASSESSMENT_DISCLOSURE_AUTHORITY.resolveApprovedDisclosure({
        purpose: DIGITAL_USE_SUPPLEMENTAL_ASSESSMENT,
        reference: 'digital-use-01004-supplemental-assessment-disclosure',
        version: 'v1',
        hash: EXPECTED_HASH,
      })
    ).toEqual({
      purpose: DIGITAL_USE_SUPPLEMENTAL_ASSESSMENT,
      reference: 'digital-use-01004-supplemental-assessment-disclosure',
      version: 'v1',
      hash: EXPECTED_HASH,
    });
  });

  it.each([
    ['wrong reference', { reference: 'wrong-reference' }],
    ['wrong version', { version: 'v999' }],
    ['wrong hash', { hash: '0'.repeat(64) }],
  ])('rejects %s', (_label, patch) => {
    const submitted = {
      purpose: DIGITAL_USE_SUPPLEMENTAL_ASSESSMENT,
      reference: 'digital-use-01004-supplemental-assessment-disclosure',
      version: 'v1',
      hash: EXPECTED_HASH,
      ...patch,
    };
    expect(
      APPROVED_SUPPLEMENTAL_ASSESSMENT_DISCLOSURE_AUTHORITY.resolveApprovedDisclosure(submitted)
    ).toBeNull();
  });

  it('rejects a wrong purpose', () => {
    expect(
      APPROVED_SUPPLEMENTAL_ASSESSMENT_DISCLOSURE_AUTHORITY.resolveApprovedDisclosure({
        purpose: 'UNDER_14_GUARDIAN_CONSENT',
        reference: 'digital-use-01004-supplemental-assessment-disclosure',
        version: 'v1',
        hash: EXPECTED_HASH,
      } as never)
    ).toBeNull();
  });

  it('hashes the exact canonical body deterministically', () => {
    const digest = createHash('sha256')
      .update(SUPPLEMENTAL_ASSESSMENT_DISCLOSURE_V1_BODY, 'utf8')
      .digest('hex');
    expect(digest).toBe(EXPECTED_HASH);
  });

  it('pins V1 body so the same version cannot silently drift', () => {
    expect(SUPPLEMENTAL_ASSESSMENT_DISCLOSURE_V1_VERSION).toBe('v1');
    expect(SUPPLEMENTAL_ASSESSMENT_DISCLOSURE_V1_BODY).toBe(EXPECTED_BODY);
    expect(SUPPLEMENTAL_ASSESSMENT_DISCLOSURE_V1_HASH).toBe(
      createHash('sha256').update(EXPECTED_BODY, 'utf8').digest('hex')
    );
  });

  it('guardian notice identity cannot satisfy the 01004 authority', () => {
    expect(
      APPROVED_SUPPLEMENTAL_ASSESSMENT_DISCLOSURE_AUTHORITY.resolveApprovedDisclosure({
        purpose: DIGITAL_USE_SUPPLEMENTAL_ASSESSMENT,
        reference: 'guardian-notice',
        version: getCurrentNoticeVersion(),
        hash: getCurrentNoticeHash(),
      })
    ).toBeNull();
  });

  it('preserves the explicit fail-closed default authority', () => {
    expect(
      NO_APPROVED_SUPPLEMENTAL_ASSESSMENT_DISCLOSURE_AUTHORITY.resolveApprovedDisclosure({
        purpose: DIGITAL_USE_SUPPLEMENTAL_ASSESSMENT,
        reference: 'digital-use-01004-supplemental-assessment-disclosure',
        version: 'v1',
        hash: EXPECTED_HASH,
      })
    ).toBeNull();
  });

  it('contains no AI/RAG/network generation dependency', () => {
    const modulePath = fileURLToPath(
      new URL('../../packages/compliance/src/supplemental-assessment-disclosure.ts', import.meta.url)
    );
    const imports = readFileSync(modulePath, 'utf8')
      .split('\n')
      .filter((line) => /^import\s/.test(line.trim()))
      .join('\n');

    expect(imports).not.toMatch(/openai|anthropic|model|provider|langchain|rag|fetch|axios|undici/i);
  });

  it('keeps caller-authored disclosure body outside the owner authority input', () => {
    const ownerPath = fileURLToPath(
      new URL('../../packages/compliance/src/supplemental-consent.ts', import.meta.url)
    );
    const source = readFileSync(ownerPath, 'utf8');
    expect(source).toContain("'disclosureText'");
    expect(source).toContain("'noticeBody'");
    expect(source).toContain('CONSENT_INPUT_INVALID');
  });
});
