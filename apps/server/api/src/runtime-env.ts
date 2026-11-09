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
  // Slice 006 identity binding (plan D-3.3). Required in every mode; no
  // fallback, no default TTL.
  identityBindingSecret: string;
  identityBindingContextTtlSeconds: number;
  identityBindingAttemptTtlSeconds: number;
  identityBindingPairingTtlSeconds: number;
  // Slice 4 participation invitations. Required in every mode; no fallback.
  participationInviteTtlSeconds: number;
  participationInviteTokenSecret: string;
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

function requiredBytes(env: NodeJS.ProcessEnv, key: string, minBytes: number): string {
  const value = env[key];
  if (!value || Buffer.byteLength(value, 'utf8') < minBytes) {
    fail('RUNTIME_ENV_INVALID', `${key} is missing or shorter than ${minBytes} bytes`);
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
  const identityBindingSecret = required(env, 'IDENTITY_BINDING_SECRET', 32);
  const contextTtl = requiredPositiveInt(env, 'IDENTITY_BINDING_CONTEXT_TTL_SECONDS');
  const attemptTtl = requiredPositiveInt(env, 'IDENTITY_BINDING_ATTEMPT_TTL_SECONDS');
  const pairingTtl = requiredPositiveInt(env, 'IDENTITY_BINDING_PAIRING_TTL_SECONDS');
  const participationInviteTtl = requiredCoercedPositiveInt(env, 'PARTICIPATION_INVITE_TTL_SECONDS');
  const participationInviteTokenSecret = requiredBytes(env, 'PARTICIPATION_INVITE_TOKEN_SECRET', 32);

  return {
    mode,
    sessionSecret,
    evidencePepper,
    wechatAppId,
    wechatAppSecret,
    consentChannel: mode === 'test' ? 'TEST' : 'MINIPROGRAM',
    identityBindingSecret,
    identityBindingContextTtlSeconds: contextTtl,
    identityBindingAttemptTtlSeconds: attemptTtl,
    identityBindingPairingTtlSeconds: pairingTtl,
    participationInviteTtlSeconds: participationInviteTtl,
    participationInviteTokenSecret,
  };
}

function requiredPositiveInt(env: NodeJS.ProcessEnv, key: string): number {
  const raw = env[key];
  if (!raw || !/^\d+$/.test(raw) || Number(raw) <= 0) {
    fail('RUNTIME_ENV_INVALID', `${key} must be a positive integer`);
  }
  return Number(raw);
}

function requiredCoercedPositiveInt(env: NodeJS.ProcessEnv, key: string): number {
  const raw = env[key];
  const value = raw === undefined ? Number.NaN : Number(raw);
  if (!raw || !Number.isInteger(value) || value <= 0) {
    fail('RUNTIME_ENV_INVALID', `${key} must be a positive integer`);
  }
  return value;
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