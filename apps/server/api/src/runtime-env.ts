/**
 * Runtime environment boundary (F1).
 *
 * Production must fail fast when any required secret is missing/short, and it
 * MUST NEVER fall back to a hard-coded session secret or to the fake WeChat
 * provider. Test / approved local Stage A may use the deterministic fake.
 *
 * `NODE_ENV` is treated as production when unset (fail-closed default).
 */

import {
  FakeWechatProvider,
  type WechatAuthProvider,
} from './auth/wechat-provider.js';

export type RuntimeMode = 'production' | 'development' | 'test';

export const MIN_SECRET_LENGTH = 16;

export interface RuntimeConfig {
  mode: RuntimeMode;
  sessionSecret: string;
  evidencePepper: string;
  wechatAppId: string;
  wechatAppSecret: string;
  consentChannel: 'MINIPROGRAM' | 'TEST';
}

function fail(code: string, detail: string): never {
  throw Object.assign(new Error(`${code}: ${detail}`), {
    statusCode: 500,
    code: 'INTERNAL_ERROR',
  });
}

export function runtimeMode(env: NodeJS.ProcessEnv = process.env): RuntimeMode {
  const raw = env['NODE_ENV'];
  if (!raw) return 'production';
  if (raw === 'test') return 'test';
  if (raw === 'development') return 'development';
  return 'production';
}

function required(env: NodeJS.ProcessEnv, key: string, minLength = 1): string {
  const value = env[key];
  if (!value || value.length < minLength) {
    fail('RUNTIME_ENV_INVALID', `${key} is missing or shorter than ${minLength}`);
  }
  return value;
}

export function loadRuntimeConfig(env: NodeJS.ProcessEnv = process.env): RuntimeConfig {
  const mode = runtimeMode(env);

  // Required in every mode: there is deliberately no fallback value.
  const sessionSecret = required(env, 'SESSION_SECRET', MIN_SECRET_LENGTH);
  const evidencePepper = required(env, 'EVIDENCE_HASH_PEPPER', MIN_SECRET_LENGTH);
  const wechatAppId = required(env, 'WECHAT_APP_ID');
  const wechatAppSecret = required(env, 'WECHAT_APP_SECRET');

  return {
    mode,
    sessionSecret,
    evidencePepper,
    wechatAppId,
    wechatAppSecret,
    consentChannel: mode === 'test' ? 'TEST' : 'MINIPROGRAM',
  };
}

/**
 * Resolve the WeChat provider. Production has no verified `code2session`
 * integration in this slice, so it fails closed instead of silently using the
 * fake provider. Only test / development may select the fake.
 */
export function createWechatProvider(config: RuntimeConfig): WechatAuthProvider {
  if (config.mode === 'test' || config.mode === 'development') {
    return new FakeWechatProvider();
  }
  fail(
    'WECHAT_PROVIDER_NOT_VERIFIED',
    'real code2session is NOT VERIFIED in this slice; the fake provider is not allowed in production'
  );
}