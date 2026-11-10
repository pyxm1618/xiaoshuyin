import { describe, it, expect } from 'vitest';
import { validateEnv } from '../../packages/contracts/src/env.js';

describe('env contract', () => {
  const validEnv = {
    DATABASE_URL: 'postgres://localhost:5432/test',
    MIGRATION_DATABASE_URL: 'postgres://localhost:5432/test',
    SESSION_SECRET: 'a'.repeat(32),
    EVIDENCE_HASH_PEPPER: 'b'.repeat(32),
    WECHAT_APP_ID: 'wx1234567890',
    WECHAT_APP_SECRET: 'secret1234567890',
    IDENTITY_BINDING_SECRET: 'test-identity-binding-secret-32chars',
    IDENTITY_BINDING_CONTEXT_TTL_SECONDS: '600',
    IDENTITY_BINDING_ATTEMPT_TTL_SECONDS: '900',
    IDENTITY_BINDING_PAIRING_TTL_SECONDS: '300',
    PARTICIPATION_INVITE_TTL_SECONDS: '86400',
    PARTICIPATION_INVITE_TOKEN_SECRET: 'p'.repeat(32),
  };

  it('accepts valid environment', () => {
    const result = validateEnv(validEnv);
    expect(result.DATABASE_URL).toBe(validEnv.DATABASE_URL);
  });

  it('rejects missing DATABASE_URL', () => {
    const { DATABASE_URL: _, ...rest } = validEnv;
    expect(() => validateEnv(rest)).toThrow();
  });

  it('rejects missing SESSION_SECRET', () => {
    const { SESSION_SECRET: _, ...rest } = validEnv;
    expect(() => validateEnv(rest)).toThrow();
  });

  it('rejects short SESSION_SECRET', () => {
    expect(() => validateEnv({ ...validEnv, SESSION_SECRET: 'short' })).toThrow();
  });

  it('rejects missing WECHAT_APP_SECRET', () => {
    const { WECHAT_APP_SECRET: _, ...rest } = validEnv;
    expect(() => validateEnv(rest)).toThrow();
  });

  it('.env.example has no secret literals', async () => {
    const { readFileSync } = await import('node:fs');
    const content = readFileSync('.env.example', 'utf-8');
    const lines = content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('#') || trimmed === '') continue;
      const [key, value] = trimmed.split('=', 2);
      if (value && value.length > 0 && !value.startsWith('#')) {
        // Values should be empty (just key=) or placeholder descriptions
        // This is already fine since we set them to empty in .env.example
      }
      // Ensure no actual secret values
      expect(trimmed).not.toMatch(/^[A-Z_]+=.{8,}$/);
    }
  });
});
