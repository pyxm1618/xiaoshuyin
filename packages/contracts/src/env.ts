import { z } from 'zod';

export const envSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  MIGRATION_DATABASE_URL: z.string().min(1, 'MIGRATION_DATABASE_URL is required'),
  SESSION_SECRET: z.string().min(16, 'SESSION_SECRET must be at least 16 characters'),
  EVIDENCE_HASH_PEPPER: z.string().min(16, 'EVIDENCE_HASH_PEPPER must be at least 16 characters'),
  WECHAT_APP_ID: z.string().min(1, 'WECHAT_APP_ID is required'),
  WECHAT_APP_SECRET: z.string().min(1, 'WECHAT_APP_SECRET is required'),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(env: Record<string, string | undefined>): Env {
  return envSchema.parse(env);
}
