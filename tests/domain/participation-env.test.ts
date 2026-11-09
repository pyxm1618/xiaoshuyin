import { describe, expect, it } from 'vitest';
import { validateEnv } from '../../packages/contracts/src/env.js';

const validEnv = {
  DATABASE_URL: 'postgres://localhost:5432/test',
  MIGRATION_DATABASE_URL: 'postgres://localhost:5432/test',
  SESSION_SECRET: 's'.repeat(32),
  EVIDENCE_HASH_PEPPER: 'e'.repeat(32),
  WECHAT_APP_ID: 'wx-test',
  WECHAT_APP_SECRET: 'wechat-secret',
  IDENTITY_BINDING_SECRET: 'i'.repeat(32),
  IDENTITY_BINDING_CONTEXT_TTL_SECONDS: '600',
  IDENTITY_BINDING_ATTEMPT_TTL_SECONDS: '900',
  IDENTITY_BINDING_PAIRING_TTL_SECONDS: '300',
  PARTICIPATION_INVITE_TTL_SECONDS: '86400',
  PARTICIPATION_INVITE_TOKEN_SECRET: 'p'.repeat(32),
};

describe('Slice 4 participation environment', () => {
  it('accepts required positive TTL and >=32-byte token secret', () => {
    const parsed = validateEnv(validEnv);
    expect(parsed.PARTICIPATION_INVITE_TTL_SECONDS).toBe(86400);
    expect(parsed.PARTICIPATION_INVITE_TOKEN_SECRET).toBe(validEnv.PARTICIPATION_INVITE_TOKEN_SECRET);
  });

  it('accepts multibyte secrets by UTF-8 byte length, not JS character count', () => {
    const multibyte = '密'.repeat(11); // 33 UTF-8 bytes, 11 JS characters.
    const parsed = validateEnv({
      ...validEnv,
      PARTICIPATION_INVITE_TOKEN_SECRET: multibyte,
    });
    expect(parsed.PARTICIPATION_INVITE_TOKEN_SECRET).toBe(multibyte);
  });

  it('uses the same numeric coercion contract as runtime for integer-like env values', () => {
    expect(validateEnv({
      ...validEnv,
      PARTICIPATION_INVITE_TTL_SECONDS: '1e3',
    }).PARTICIPATION_INVITE_TTL_SECONDS).toBe(1000);
  });

  it('has no defaults: each participation setting is required', () => {
    const { PARTICIPATION_INVITE_TTL_SECONDS: _ttl, ...withoutTtl } = validEnv;
    const { PARTICIPATION_INVITE_TOKEN_SECRET: _secret, ...withoutSecret } = validEnv;
    expect(() => validateEnv(withoutTtl)).toThrow();
    expect(() => validateEnv(withoutSecret)).toThrow();
  });

  for (const bad of ['0', '-1', '1.5', 'not-a-number']) {
    it(`rejects invalid TTL ${bad}`, () => {
      expect(() => validateEnv({ ...validEnv, PARTICIPATION_INVITE_TTL_SECONDS: bad })).toThrow();
    });
  }

  it('rejects token secrets shorter than 32 bytes', () => {
    expect(() => validateEnv({
      ...validEnv,
      PARTICIPATION_INVITE_TOKEN_SECRET: 'short-secret',
    })).toThrow();
  });
});
