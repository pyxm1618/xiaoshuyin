import { z } from 'zod';

export const envSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  MIGRATION_DATABASE_URL: z.string().min(1, 'MIGRATION_DATABASE_URL is required'),
  SESSION_SECRET: z.string().min(16, 'SESSION_SECRET must be at least 16 characters'),
  EVIDENCE_HASH_PEPPER: z.string().min(16, 'EVIDENCE_HASH_PEPPER must be at least 16 characters'),
  WECHAT_APP_ID: z.string().min(1, 'WECHAT_APP_ID is required'),
  WECHAT_APP_SECRET: z.string().min(1, 'WECHAT_APP_SECRET is required'),
  // Slice 006 identity binding. Required, no defaults: a missing value must
  // fail startup rather than silently weaken token / crypto / TTL semantics.
  IDENTITY_BINDING_SECRET: z
    .string()
    .min(32, 'IDENTITY_BINDING_SECRET must be at least 32 characters'),
  IDENTITY_BINDING_CONTEXT_TTL_SECONDS: z.coerce
    .number()
    .int()
    .positive('IDENTITY_BINDING_CONTEXT_TTL_SECONDS must be a positive integer'),
  IDENTITY_BINDING_ATTEMPT_TTL_SECONDS: z.coerce
    .number()
    .int()
    .positive('IDENTITY_BINDING_ATTEMPT_TTL_SECONDS must be a positive integer'),
  IDENTITY_BINDING_PAIRING_TTL_SECONDS: z.coerce
    .number()
    .int()
    .positive('IDENTITY_BINDING_PAIRING_TTL_SECONDS must be a positive integer'),
  // Slice 4 participation invitations. Required with no defaults.
  PARTICIPATION_INVITE_TTL_SECONDS: z.coerce
    .number()
    .int()
    .positive('PARTICIPATION_INVITE_TTL_SECONDS must be a positive integer'),
  PARTICIPATION_INVITE_TOKEN_SECRET: z.string().refine(
    (value) => Buffer.byteLength(value, 'utf8') >= 32,
    'PARTICIPATION_INVITE_TOKEN_SECRET must be at least 32 bytes'
  ),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(env: Record<string, string | undefined>): Env {
  return envSchema.parse(env);
}
