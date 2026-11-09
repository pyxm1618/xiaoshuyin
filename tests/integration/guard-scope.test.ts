/**
 * Finding 7 — scope guard must reject still-future objects in every DDL form.
 * Slice 4 now owns case_participants, so that former future-table probe is retired.
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
  // Removing the probe is preferred; some sandboxes deny unlink, so an empty
  // file is an equivalent clean state for the guard (no pattern can match).
  return () => {
    try {
      rmSync(full, { force: true });
    } catch {
      writeFileSync(full, '');
    }
  };
}

const SQL_CASES: Array<[string, string]> = [
  ['CREATE TABLE evidence_items', 'CREATE TABLE evidence_items (id uuid);\n'],
  ['CREATE TABLE evidence_items (second probe)', 'CREATE TABLE evidence_items (id uuid);\n'],
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
    'CREATE UNLOGGED TABLE IF NOT EXISTS "public"."evidence_items"',
    'CREATE UNLOGGED TABLE IF NOT EXISTS "public"."evidence_items" (id uuid);\n',
  ],
  // Newline-separated DDL (valid PostgreSQL, previously undetected).
  [
    'CREATE TABLE\n"public"."evidence_items"',
    'CREATE TABLE\n"public"."evidence_items" (id uuid);\n',
  ],
  [
    'CREATE\nTABLE\ntasks',
    'CREATE\nTABLE\ntasks (id uuid);\n',
  ],
  // SQL comments between keywords / before the table name.
  [
    'CREATE TABLE /* probe */\n"public"."evidence_items"',
    'CREATE TABLE /* probe */\n"public"."evidence_items" (id uuid);\n',
  ],
  [
    'CREATE /* probe */\nUNLOGGED TABLE IF NOT EXISTS\n"public"."evidence_items"',
    'CREATE /* probe */\nUNLOGGED TABLE IF NOT EXISTS\n"public"."evidence_items" (id uuid);\n',
  ],
  [
    'CREATE TABLE /*\nmulti-line\ncomment\n*/ case_followup_schedules',
    'CREATE TABLE /*\nmulti-line\ncomment\n*/ case_followup_schedules (id uuid);\n',
  ],
  // Line comment between keywords.
  [
    'CREATE TABLE -- probe\nevidence_items',
    'CREATE TABLE -- probe\nevidence_items (id uuid);\n',
  ],
  // Nested block comments (PostgreSQL nests them; a boolean flag would stop
  // at the first */ and leak the rest of the statement).
  [
    'nested comment before TABLE',
    'CREATE /* outer /* inner */ tail */\nTABLE public.evidence_items (id uuid);\n',
  ],
  [
    'triple nested comment',
    'CREATE /* a /* b /* c */ b */ a */\nUNLOGGED TABLE IF NOT EXISTS\n"public"."tasks" (id uuid);\n',
  ],
  [
    'nested comment between TABLE and name',
    'CREATE TABLE /* a /* b */ a */ "public"."evidence_items" (id uuid);\n',
  ],
];

// SQL where the forbidden text only appears inside a literal: PostgreSQL does
// not create a table, so the guard must stay silent.
const ALLOWED_SQL: Array<[string, string]> = [
  ['single-quoted literal', "SELECT 'CREATE TABLE evidence_items (id uuid)';\n"],
  ['single-quoted literal (tasks)', "SELECT 'CREATE TABLE tasks (id uuid)';\n"],
  ['single-quoted doubled quote', "SELECT 'CREATE TABLE evidence_items (id uuid)''x';\n"],
  ['dollar-quoted literal', 'SELECT $$CREATE TABLE evidence_items (id uuid)$$;\n'],
  [
    'tagged dollar-quoted literal',
    'SELECT $probe$CREATE TABLE case_followup_schedules (id uuid)$probe$;\n',
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

  for (const [name, content] of ALLOWED_SQL) {
    it(`allows: ${name} (literal is not DDL)`, async () => {
      const cleanup = inject('db/__guard_probe__.sql', content);
      try {
        const { code, output } = await runGuard();
        expect(code, output).toBe(0);
        expect(output).toContain('PASS (0 violations)');
      } finally {
        cleanup();
      }
    });
  }

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
