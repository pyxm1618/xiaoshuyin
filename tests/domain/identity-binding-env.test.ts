import { describe, it, expect } from 'vitest';
import { validateEnv } from '../../packages/contracts/src/env.js';

const BASE = {
  DATABASE_URL: 'postgres://localhost:5432/test',
  MIGRATION_DATABASE_URL: 'postgres://localhost:5432/test',
  SESSION_SECRET: 'a'.repeat(32),
  EVIDENCE_HASH_PEPPER: 'b'.repeat(32),
  WECHAT_APP_ID: 'wx123',
  WECHAT_APP_SECRET: 'wx-secret-123',
  IDENTITY_BINDING_SECRET: 'c'.repeat(32),
  IDENTITY_BINDING_CONTEXT_TTL_SECONDS: '600',
  IDENTITY_BINDING_ATTEMPT_TTL_SECONDS: '900',
};

describe('identity binding env contract', () => {
  it('accepts required binding configuration', () => {
    expect(validateEnv(BASE).IDENTITY_BINDING_SECRET).toBe('c'.repeat(32));
  });

  it('rejects a missing or short IDENTITY_BINDING_SECRET', () => {
    const { IDENTITY_BINDING_SECRET: _omit, ...missing } = BASE;
    expect(() => validateEnv(missing)).toThrow();
    expect(() =>
      validateEnv({ ...BASE, IDENTITY_BINDING_SECRET: 'short' })
    ).toThrow();
  });

  it('requires both TTLs to be positive integers with no default', () => {
    for (const key of [
      'IDENTITY_BINDING_CONTEXT_TTL_SECONDS',
      'IDENTITY_BINDING_ATTEMPT_TTL_SECONDS',
    ]) {
      const { [key]: _omit, ...missing } = BASE;
      expect(() => validateEnv(missing)).toThrow();
      expect(() => validateEnv({ ...BASE, [key]: '0' })).toThrow();
      expect(() => validateEnv({ ...BASE, [key]: '-1' })).toThrow();
      expect(() => validateEnv({ ...BASE, [key]: '1.5' })).toThrow();
    }
  });
});