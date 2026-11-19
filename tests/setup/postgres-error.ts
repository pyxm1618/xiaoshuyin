import { expect } from 'vitest';

export interface PostgresErrorIdentity {
  readonly code?: string;
  readonly constraint?: string;
  readonly table?: string;
  readonly column?: string;
}

function pgErrorFrom(error: unknown): PostgresErrorIdentity | null {
  let current: unknown = error;
  const seen = new Set<unknown>();
  for (let depth = 0; depth < 8 && current && typeof current === 'object'; depth += 1) {
    if (seen.has(current)) break;
    seen.add(current);
    const candidate = current as {
      code?: unknown;
      constraint?: unknown;
      table?: unknown;
      column?: unknown;
      cause?: unknown;
    };
    if (typeof candidate.code === 'string') {
      return {
        code: candidate.code,
        ...(typeof candidate.constraint === 'string' ? { constraint: candidate.constraint } : {}),
        ...(typeof candidate.table === 'string' ? { table: candidate.table } : {}),
        ...(typeof candidate.column === 'string' ? { column: candidate.column } : {}),
      };
    }
    current = candidate.cause;
  }
  return null;
}

export async function capturePostgresError(
  operation: Promise<unknown> | (() => Promise<unknown>)
): Promise<PostgresErrorIdentity> {
  try {
    await (typeof operation === 'function' ? operation() : operation);
  } catch (error) {
    const identity = pgErrorFrom(error);
    expect(identity, 'expected a structured PostgreSQL error with SQLSTATE').not.toBeNull();
    return identity!;
  }
  throw new Error('EXPECTED_POSTGRES_ERROR');
}

export async function expectPostgresError(
  operation: Promise<unknown> | (() => Promise<unknown>),
  expected: { readonly code: string; readonly constraint?: string }
): Promise<PostgresErrorIdentity> {
  const identity = await capturePostgresError(operation);
  expect(identity.code).toBe(expected.code);
  if (expected.constraint !== undefined) expect(identity.constraint).toBe(expected.constraint);
  return identity;
}
