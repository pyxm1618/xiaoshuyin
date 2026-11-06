/**
 * Round 2 — unexpected-error logging must never leak request-derived data.
 *
 * A real PostgreSQL error is raised with a synthetic secret in MESSAGE and
 * DETAIL. The app runs in a child process so its pino output can be captured;
 * the assertions require the SQLSTATE and request metadata to be present while
 * the secret, the bearer token and the request body are absent.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pg from 'pg';
import { buildApp } from '../../apps/server/api/src/app.js';
import { createAdminPool } from '../setup/db.js';

const execFileAsync = promisify(execFile);
const RUN = process.pid.toString(36) + Math.random().toString(36).slice(2, 8);
const FN = `r2_log_probe_${RUN}`;
const TRIGGER = `r2_log_probe_${RUN}`;

let verifyPool: pg.Pool;

describe('unexpected error logging is redacted', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let owner: pg.Client;
  let scriptPath: string;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
    verifyPool = createAdminPool();
    owner = new pg.Client({ connectionString: process.env['MIGRATION_DATABASE_URL'] });
    await owner.connect();

    scriptPath = join(tmpdir(), `r2-log-probe-${RUN}.ts`);
    writeFileSync(
      scriptPath,
      `const [token, key] = process.argv.slice(2);
const { buildApp } = await import(${JSON.stringify(
        new URL('../../apps/server/api/src/app.ts', import.meta.url).href
      )});
const app = await buildApp();
await app.ready();
const res = await app.inject({
  method: 'POST',
  url: '/api/v1/cases',
  headers: { authorization: 'Bearer ' + token },
  payload: { idempotencyKey: key },
});
process.stderr.write('STATUS=' + res.statusCode + '\\n');
await app.close();
`
    );
  });

  afterAll(async () => {
    await dropFault();
    rmSync(scriptPath, { force: true });
    await owner.end();
    await verifyPool.end();
    await app.close();
  });

  async function dropFault() {
    await owner.query(`DROP TRIGGER IF EXISTS ${TRIGGER} ON case_events`).catch(() => {});
    await owner.query(`DROP FUNCTION IF EXISTS ${FN}()`).catch(() => {});
  }

  it('logs SQLSTATE and request metadata without request-derived values', async () => {
    const secret = `CV1_SECRET_LOG_PROBE_${RUN}`;
    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/wechat',
      payload: { code: `r2log_${Date.now()}` },
    });
    const token = login.json().token as string;
    const family = await app.inject({
      method: 'POST',
      url: '/api/v1/families',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        displayName: 'R2-LOG',
        ageBand: 'ADULT',
        ageBandSource: 'SELF_STATEMENT',
        idempotencyKey: `r2log-fam-${Date.now()}`,
      },
    });
    const familyId = family.json().id as string;

    await dropFault();
    await owner.query(`
      CREATE FUNCTION ${FN}() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        RAISE EXCEPTION '${secret}' USING DETAIL = 'payload ${secret}';
      END $$;
    `);
    await owner.query(`
      CREATE TRIGGER ${TRIGGER} BEFORE INSERT ON case_events
      FOR EACH ROW WHEN (NEW.family_id = '${familyId}'::uuid)
      EXECUTE FUNCTION ${FN}();
    `);

    try {
      const idempotencyKey = `r2log-key-${Date.now()}`;
      const { stdout, stderr } = await execFileAsync(
        'bun',
        [scriptPath, token, idempotencyKey],
        { env: process.env, encoding: 'utf-8', timeout: 60000 }
      );
      const output = `${stdout}${stderr}`;

      expect(output).toContain('STATUS=500');
      // Whitelisted diagnostics are present.
      expect(output).toContain('P0001');
      expect(output).toContain('requestId');
      expect(output).toContain('"route":"/api/v1/cases"');

      // Nothing request-derived leaks.
      expect(output).not.toContain(secret);
      expect(output).not.toContain(token);
      expect(output).not.toContain(idempotencyKey);
      expect(output).not.toContain('authorization');
      expect(output).not.toContain('RAISE EXCEPTION');
    } finally {
      await dropFault();
    }
  }, 120000);
});
