/**
 * Finding 7 — scope guard must reject both the original patterns and the new
 * Case-Core vocabulary, in every DDL form.
 *
 * Each case injects a temporary file, runs the real guard script and requires
 * a non-zero exit; the file is always removed and the guard must end clean.
 */

import { describe, it, expect, afterAll } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const GUARD = join(ROOT, 'scripts', 'guard-static.mjs');
const execFileAsync = promisify(execFile);

// Async so the guard's filesystem walk never blocks the vitest RPC loop.
async function runGuard(): Promise<{ code: number; output: string }> {
  try {
    const { stdout, stderr } = await execFileAsync('node', [GUARD], { cwd: ROOT, encoding: 'utf-8' });
    return { code: 0, output: `${stdout}${stderr}` };
  } catch (err: any) {
    return { code: err.code ?? 1, output: `${err.stdout ?? ''}${err.stderr ?? ''}` };
  }
}

function inject(file: string, content: string) {
  const full = join(ROOT, file);
  writeFileSync(full, content);
  return () => rmSync(full, { force: true });
}

const SQL_CASES: Array<[string, string]> = [
  ['bare case_participants mention', '-- case_participants is out of scope\nSELECT 1;\n'],
  ['CREATE TABLE case_participants', 'CREATE TABLE case_participants (id uuid);\n'],
  ['CREATE TABLE public.case_participants', 'CREATE TABLE public.case_participants (id uuid);\n'],
  [
    'CREATE TABLE IF NOT EXISTS public.case_participants',
    'CREATE TABLE IF NOT EXISTS public."case_participants" (id uuid);\n',
  ],
  ['CREATE TABLE assertions', 'CREATE TABLE assertions (id uuid);\n'],
  ['CREATE TABLE observations', 'CREATE TABLE observations (id uuid);\n'],
  ['CREATE TABLE problem_formulations', 'CREATE TABLE problem_formulations (id uuid);\n'],
  ['CREATE TABLE notifications', 'CREATE TABLE notifications (id uuid);\n'],
  ['CREATE TABLE safety_states', 'CREATE TABLE safety_states (id uuid);\n'],
  ['CREATE TABLE tasks', 'CREATE TABLE tasks (id uuid);\n'],
  ['CREATE TABLE case_followup_schedules', 'CREATE TABLE case_followup_schedules (id uuid);\n'],
  ['CREATE TABLE goals', 'CREATE TABLE goals (id uuid);\n'],
  ['CREATE TABLE intervention_instances', 'CREATE TABLE intervention_instances (id uuid);\n'],
  ['CREATE TABLE data_requests', 'CREATE TABLE data_requests (id uuid);\n'],
  ['CREATE TABLE memory_snapshots', 'CREATE TABLE memory_snapshots (id uuid);\n'],
  [
    'CREATE UNLOGGED TABLE IF NOT EXISTS "public"."observations"',
    'CREATE UNLOGGED TABLE IF NOT EXISTS "public"."observations" (id uuid);\n',
  ],
];

afterAll(async () => {
  const { code } = await runGuard();
  expect(code).toBe(0);
});

describe('Scope guard rejection (finding 7)', () => {
  for (const [name, content] of SQL_CASES) {
    it(`rejects: ${name}`, async () => {
      const cleanup = inject('db/__guard_probe__.sql', content);
      try {
        const { code, output } = await runGuard();
        expect(code, output).not.toBe(0);
        expect(output).toContain('R6-scope-guard');
      } finally {
        cleanup();
      }
    });
  }

  it("rejects pgTable('case_participants', ...)", async () => {
    const cleanup = inject(
      'db/__guard_probe__.ts',
      "import { pgTable, uuid } from 'drizzle-orm/pg-core';\n" +
        "export const forbidden = pgTable('case_participants', { id: uuid('id') });\n"
    );
    try {
      const { code, output } = await runGuard();
      expect(code, output).not.toBe(0);
      expect(output).toContain('pgTable');
    } finally {
      cleanup();
    }
  });

  it('rejects family-scoped SQL inside apps/ (R4)', async () => {
    const cleanup = inject(
      'apps/server/api/src/__guard_probe__.ts',
      "export const q = 'SELECT * FROM cases';\n"
    );
    try {
      const { code, output } = await runGuard();
      expect(code, output).not.toBe(0);
      expect(output).toContain('R4-family-table-access');
    } finally {
      cleanup();
    }
  });

  it('returns to PASS once every probe is removed', async () => {
    const { code, output } = await runGuard();
    expect(code, output).toBe(0);
    expect(output).toContain('PASS (0 violations)');
  });
});
