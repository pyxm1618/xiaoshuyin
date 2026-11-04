import { describe, it, expect } from 'vitest';
import { getNoticeHash, getCurrentNoticeHash, getNotice } from '../../packages/compliance/src/notices.js';

describe('Notices (T037)', () => {
  it('same version hash is stable', () => {
    const h1 = getNoticeHash('v1');
    const h2 = getNoticeHash('v1');
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[0-9a-f]{64}$/);
  });

  it('unknown version returns null', () => {
    expect(getNoticeHash('v999')).toBeNull();
    expect(getNotice('v999')).toBeNull();
  });

  it('current notice hash is available', () => {
    const h = getCurrentNoticeHash();
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });
});
