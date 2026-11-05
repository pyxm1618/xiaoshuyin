/**
 * Versioned notice catalog + sha256 hash.
 * Per plan.md D-3.3: consent must reference displayed notice version+hash.
 */

import { createHash } from 'node:crypto';

export interface Notice {
  version: string;
  title: string;
  body: string;
}

export const NOTICE_CATALOG: Notice[] = [
  {
    version: 'v1',
    title: '监护人同意告知书',
    body: '您正在为一名不满14周岁的未成年人建立档案。根据相关法律法规，我们需要取得您的明确同意。' +
      '我们将仅处理完成监护身份确认、必要告知与取得同意所严格必要的信息。' +
      '您可以随时撤回同意。同意撤回后，我们将停止对该未成年人的后续个人信息处理。',
  },
];

export function getNotice(version: string): Notice | null {
  return NOTICE_CATALOG.find((n) => n.version === version) ?? null;
}

export function getNoticeHash(version: string): string | null {
  const notice = getNotice(version);
  if (!notice) return null;
  return createHash('sha256').update(notice.body).digest('hex');
}

export function getCurrentNoticeVersion(): string {
  return NOTICE_CATALOG[NOTICE_CATALOG.length - 1]!.version;
}

export function getCurrentNoticeHash(): string {
  return getNoticeHash(getCurrentNoticeVersion())!;
}

export function getCatalog() {
  return NOTICE_CATALOG.map((n) => ({
    version: n.version,
    hash: getNoticeHash(n.version)!,
    title: n.title,
  }));
}
