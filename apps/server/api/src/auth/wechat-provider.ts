/**
 * WeChat auth provider port + deterministic fake for testing.
 * Real code2session is NOT VERIFIED in this slice (§40 Platform gate).
 */

export interface WechatAuthProvider {
  code2session(code: string): Promise<{ openid: string }>;
}

export class FakeWechatProvider implements WechatAuthProvider {
  async code2session(code: string): Promise<{ openid: string }> {
    // Deterministic fake: code becomes openid
    return { openid: `fake_${code}` };
  }
}
