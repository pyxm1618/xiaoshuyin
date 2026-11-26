/**
 * Finding #19 / N-2 — the migration runner must execute under its shipped name.
 *
 * The audited defect: `scripts/db-migrate.mjs` decided "am I the CLI entry?"
 * by matching a filename suffix (`db-migrate.mjs` / `db-migrate.js`). The
 * production image bundles the runner to `dist/migrate.js`
 * (apps/server/api/Dockerfile), which matched neither suffix, so
 * `node dist/migrate.js` exited 0 without applying a single migration and the
 * container ran on an unmigrated database.
 *
 * The regression surface is therefore the entry decision itself: the runner
 * must execute no matter what the artifact is called, and importing it must
 * stay side-effect free.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const RUNNER_SOURCE = join(process.cwd(), 'scripts', 'db-migrate.mjs');
const REQUIRED_MESSAGE = 'MIGRATION_DATABASE_URL is required';
const tempRoots: string[] = [];

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

/**
 * Isolated repository-shaped fixture. It must live inside the repository so the
 * copied runner resolves the workspace `pg` dependency exactly as it does from
 * `scripts/`.
 */
function fixtureRoot(): string {
  const root = mkdtempSync(join(process.cwd(), 'tests', '.tmp-migration-entry-'));
  tempRoots.push(root);
  mkdirSync(join(root, 'dist'), { recursive: true });
  mkdirSync(join(root, 'db', 'migrations'), { recursive: true });
  return root;
}

/** Environment without MIGRATION_DATABASE_URL, so the runner must fail loudly. */
function withoutMigrationUrl(extra: Record<string, string> = {}): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env };
  delete env['MIGRATION_DATABASE_URL'];
  return { ...env, ...extra };
}

function runNode(entry: string, env: NodeJS.ProcessEnv, cwd: string) {
  const result = spawnSync('node', [entry], {
    cwd,
    env,
    encoding: 'utf8',
    timeout: 30_000,
  });
  return {
    status: result.status,
    signal: result.signal,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    output: `${result.stdout ?? ''}${result.stderr ?? ''}`,
  };
}

function hasBun(): boolean {
  return spawnSync('bun', ['--version'], { encoding: 'utf8' }).status === 0;
}

describe('Finding #19 N-2 — migration runner CLI entry detection', () => {
  it('executes the canonical scripts/db-migrate.mjs entry', () => {
    const result = runNode(RUNNER_SOURCE, withoutMigrationUrl(), process.cwd());

    expect(result.status).toBe(1);
    expect(result.output).toContain(REQUIRED_MESSAGE);
  });

  it('executes when the artifact is named dist/migrate.js', () => {
    const root = fixtureRoot();
    const entry = join(root, 'dist', 'migrate.js');
    copyFileSync(RUNNER_SOURCE, entry);

    const result = runNode(entry, withoutMigrationUrl(), root);

    // Pre-fix behavior was exit 0 with entirely empty output.
    expect(result.output.trim()).not.toBe('');
    expect(result.status).toBe(1);
    expect(result.output).toContain(REQUIRED_MESSAGE);
  });

  it('executes when the artifact has an unrelated name', () => {
    const root = fixtureRoot();
    const entry = join(root, 'dist', 'runner.mjs');
    copyFileSync(RUNNER_SOURCE, entry);

    const result = runNode(entry, withoutMigrationUrl(), root);

    expect(result.status).toBe(1);
    expect(result.output).toContain(REQUIRED_MESSAGE);
  });

  it('actually attempts the connection instead of succeeding silently', () => {
    const root = fixtureRoot();
    const entry = join(root, 'dist', 'migrate.js');
    copyFileSync(RUNNER_SOURCE, entry);

    // Valid URL shape, guaranteed-closed port: a real execution attempt must
    // surface a failure, never a successful exit.
    const result = runNode(
      entry,
      withoutMigrationUrl({
        MIGRATION_DATABASE_URL: 'postgres://xiaoshuyin_migrator:fixture@127.0.0.1:1/xiaoshuyin',
      }),
      root
    );

    expect(result.status).toBe(1);
    expect(result.output).toContain('Migration failed');
  });

  it('stays side-effect free when imported as a module', () => {
    const result = spawnSync(
      'node',
      [
        '--input-type=module',
        '-e',
        'const mod = await import(process.env.MIGRATE_MODULE_URL); console.log("IMPORTED", typeof mod.DEFAULT_MIGRATIONS_DIR);',
      ],
      {
        cwd: process.cwd(),
        env: {
          ...withoutMigrationUrl(),
          MIGRATE_MODULE_URL: pathToFileURL(RUNNER_SOURCE).href,
        },
        encoding: 'utf8',
        timeout: 30_000,
      }
    );

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('IMPORTED string');
    expect(`${result.stdout}${result.stderr}`).not.toContain(REQUIRED_MESSAGE);
  });

  it('executes the real Bun-bundled production artifact built by the Dockerfile', () => {
    if (!hasBun()) {
      // CI always provisions Bun (setup-bun) for every job, so this only skips
      // on a workstation without it. The copied-artifact tests above still run.
      return;
    }

    const root = fixtureRoot();
    const entry = join(root, 'dist', 'migrate.js');
    const build = spawnSync(
      'bun',
      ['build', RUNNER_SOURCE, '--target=node', `--outfile=${entry}`],
      { cwd: root, encoding: 'utf8', timeout: 120_000 }
    );
    expect(build.status, `${build.stdout}${build.stderr}`).toBe(0);
    expect(existsSync(entry)).toBe(true);

    const result = runNode(entry, withoutMigrationUrl(), root);

    expect(result.output.trim()).not.toBe('');
    expect(result.status).toBe(1);
    expect(result.output).toContain(REQUIRED_MESSAGE);
  });
});
