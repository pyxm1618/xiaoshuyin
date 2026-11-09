/**
 * UFA-002 — real PostgreSQL connection-loss regression.
 *
 * This suite intentionally runs the real Fastify app in a separate production
 * Node process, uses the real pg.Pool and Message route, identifies the exact
 * checked-out PostgreSQL backend by application_name + blocked production SQL,
 * and terminates that backend with pg_terminate_backend().
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import pg from 'pg';

const DATABASE_URL = process.env['DATABASE_URL']!;
const ADMIN_URL = process.env['TEST_ADMIN_DATABASE_URL']!;
const APP_NAME = `ufa002_node_${process.pid}_${Date.now()}`;

let admin: pg.Pool;
let nodeProcess: ReturnType<typeof spawn> | null = null;
let baseUrl = '';
let nodeStdout = '';
let nodeStderr = '';
let seq = 0;

function childDatabaseUrl(): string {
  const url = new URL(DATABASE_URL);
  url.searchParams.set('application_name', APP_NAME);
  return url.toString();
}

async function startNodeApi(): Promise<string> {
  const script = `
    import { buildApp } from './apps/server/api/src/app.ts';
    const app = await buildApp();
    const address = await app.listen({ port: 0, host: '127.0.0.1' });
    process.stdout.write('UFA002_NODE_API=' + address + '\\n');

    let stopping = false;
    const stop = async () => {
      if (stopping) return;
      stopping = true;
      try { await app.close(); } finally { process.exit(0); }
    };
    process.on('SIGTERM', () => { void stop(); });
    process.on('SIGINT', () => { void stop(); });
  `;

  return new Promise<string>((resolve, reject) => {
    const child = spawn(
      'node',
      ['--input-type=module', '--eval', script],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          NODE_ENV: 'test',
          DATABASE_URL: childDatabaseUrl(),
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      }
    );
    nodeProcess = child;

    let settled = false;
    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        child.kill('SIGKILL');
        reject(new Error(`Node API startup timeout\nstdout:\n${nodeStdout}\nstderr:\n${nodeStderr}`));
      }
    }, 10_000);

    child.stdout?.on('data', (chunk) => {
      nodeStdout += chunk.toString();
      const match = nodeStdout.match(/UFA002_NODE_API=(http:\/\/[^\s]+)/);
      if (match?.[1] && !settled) {
        settled = true;
        clearTimeout(timeout);
        resolve(match[1]);
      }
    });
    child.stderr?.on('data', (chunk) => {
      nodeStderr += chunk.toString();
    });
    child.once('exit', (code, signal) => {
      if (!settled) {
        settled = true;
        clearTimeout(timeout);
        reject(
          new Error(
            `Node API exited before ready (code=${code}, signal=${signal})\n` +
              `stdout:\n${nodeStdout}\nstderr:\n${nodeStderr}`
          )
        );
      }
    });
  });
}

async function jsonRequest(
  method: string,
  path: string,
  body?: unknown,
  headers: Record<string, string> = {}
): Promise<{ status: number; body: any }> {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      ...headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return {
    status: response.status,
    body: await response.json(),
  };
}

async function setup(label: string) {
  const suffix = `${label}_${Date.now()}_${seq++}`;
  const login = await jsonRequest('POST', '/api/v1/auth/wechat', {
    code: `ufa002_${suffix}`,
  });
  expect(login.status).toBe(200);

  const token = login.body.sessionToken as string;
  const accountId = login.body.accountId as string;

  const family = await jsonRequest(
    'POST',
    '/api/v1/families',
    {
      displayName: `UFA002-${suffix}`,
      creator: { ageBand: 'ADULT', ageBandSource: 'SELF_STATEMENT' },
    },
    {
      authorization: `Bearer ${token}`,
      'idempotency-key': `ufa002-fam-${suffix}`,
    }
  );
  expect(family.status).toBe(201);
  const familyId = family.body.id as string;

  const kase = await jsonRequest(
    'POST',
    '/api/v1/cases',
    {},
    {
      authorization: `Bearer ${token}`,
      'idempotency-key': `ufa002-case-${suffix}`,
    }
  );
  expect(kase.status).toBe(201);

  return {
    token,
    accountId,
    familyId,
    caseId: kase.body.id as string,
  };
}

function postMessage(
  token: string,
  caseId: string,
  key: string,
  content: string
): Promise<{ status: number; body: any }> {
  return jsonRequest(
    'POST',
    `/api/v1/cases/${caseId}/messages`,
    { content },
    {
      authorization: `Bearer ${token}`,
      'idempotency-key': key,
    }
  );
}

async function counts(familyId: string, accountId: string, key: string) {
  const { rows } = await admin.query(
    `SELECT
       (SELECT count(*)::int
          FROM dialogue_messages
         WHERE family_id = $1) AS messages,
       (SELECT count(*)::int
          FROM business_audit_events
         WHERE family_id = $1
           AND event_type = 'MESSAGE_RECORDED') AS audits,
       (SELECT count(*)::int
          FROM idempotency_keys
         WHERE actor_account_id = $2
           AND command_type = 'CASE_MESSAGE_CREATE'
           AND idempotency_key = $3) AS idempotency`,
    [familyId, accountId, key]
  );
  return rows[0] as { messages: number; audits: number; idempotency: number };
}

async function waitForBlockedBackend(queryFragment: string): Promise<number> {
  const deadline = Date.now() + 8_000;
  while (Date.now() < deadline) {
    const { rows } = await admin.query(
      `SELECT pid, query, wait_event_type, wait_event
         FROM pg_stat_activity
        WHERE application_name = $1
          AND state = 'active'
        ORDER BY query_start DESC`,
      [APP_NAME]
    );
    const row = rows.find(
      (candidate: any) =>
        candidate.wait_event_type === 'Lock' &&
        typeof candidate.query === 'string' &&
        candidate.query.includes(queryFragment)
    );
    if (row) return Number(row.pid);
    await new Promise((resolve) => setTimeout(resolve, 20));
  }

  const { rows } = await admin.query(
    `SELECT pid, state, wait_event_type, wait_event, query
       FROM pg_stat_activity
      WHERE application_name = $1`,
    [APP_NAME]
  );
  throw new Error(
    `Did not observe blocked Node API backend for fragment "${queryFragment}": ${JSON.stringify(rows)}`
  );
}

async function terminateBackend(pid: number): Promise<void> {
  const { rows } = await admin.query(
    'SELECT pg_terminate_backend($1) AS terminated',
    [pid]
  );
  expect(rows[0]?.terminated).toBe(true);
}

async function expectAliveAndHealthy() {
  expect(nodeProcess).not.toBeNull();
  expect(nodeProcess!.exitCode).toBeNull();
  const health = await jsonRequest('GET', '/healthz');
  expect(health.status).toBe(200);
  expect(health.body).toEqual({ status: 'ok' });
}

describe.sequential('UFA-002 — real Node + PostgreSQL backend termination', () => {
  beforeAll(async () => {
    admin = new pg.Pool({ connectionString: ADMIN_URL, max: 5 });
    baseUrl = await startNodeApi();
    await expectAliveAndHealthy();
  }, 15_000);

  afterAll(async () => {
    if (nodeProcess?.exitCode === null) {
      nodeProcess.kill('SIGTERM');
      await once(nodeProcess, 'exit');
    }
    await admin.end();
  });

  it('authorization-phase connection loss returns 500, leaves zero residue, and Node survives', async () => {
    const fx = await setup('authorization');
    const key = `ufa002-authz-message-${Date.now()}-${seq++}`;
    const content = 'authorization phase connection loss';
    const before = await counts(fx.familyId, fx.accountId, key);

    const blocker = await admin.connect();
    let failed: Awaited<ReturnType<typeof postMessage>>;
    try {
      await blocker.query('BEGIN');
      await blocker.query('LOCK TABLE cases IN ACCESS EXCLUSIVE MODE');

      const pending = postMessage(fx.token, fx.caseId, key, content);
      const pid = await waitForBlockedBackend('FROM cases');
      await terminateBackend(pid);
      failed = await pending;
    } finally {
      await blocker.query('ROLLBACK').catch(() => undefined);
      blocker.release();
    }

    expect(failed.status).toBe(500);
    expect(failed.body).toEqual({
      code: 'INTERNAL_ERROR',
      message: 'An internal error occurred',
    });
    await expectAliveAndHealthy();

    const afterFailure = await counts(fx.familyId, fx.accountId, key);
    expect(afterFailure).toEqual(before);

    // The exact same request must work after the broken client is destroyed.
    const recovered = await postMessage(fx.token, fx.caseId, key, content);
    expect(recovered.status).toBe(201);
    const afterRecovery = await counts(fx.familyId, fx.accountId, key);
    expect(afterRecovery.messages).toBe(before.messages + 1);
    expect(afterRecovery.audits).toBe(before.audits + 1);
    expect(afterRecovery.idempotency).toBe(1);
  }, 20_000);

  it('EXECUTE-phase connection loss returns 500, leaves zero residue, and Node survives', async () => {
    const fx = await setup('execute');
    const key = `ufa002-execute-message-${Date.now()}-${seq++}`;
    const content = 'execute phase connection loss';
    const scope = `${fx.accountId}:CASE_MESSAGE_CREATE:${key}`;
    const before = await counts(fx.familyId, fx.accountId, key);

    const blocker = await admin.connect();
    let failed: Awaited<ReturnType<typeof postMessage>>;
    try {
      await blocker.query(
        'SELECT pg_advisory_lock(hashtextextended($1, 0::bigint))',
        [scope]
      );

      const pending = postMessage(fx.token, fx.caseId, key, content);
      const pid = await waitForBlockedBackend('pg_advisory_xact_lock');
      await terminateBackend(pid);
      failed = await pending;
    } finally {
      await blocker
        .query(
          'SELECT pg_advisory_unlock(hashtextextended($1, 0::bigint))',
          [scope]
        )
        .catch(() => undefined);
      blocker.release();
    }

    expect(failed.status).toBe(500);
    expect(failed.body).toEqual({
      code: 'INTERNAL_ERROR',
      message: 'An internal error occurred',
    });
    await expectAliveAndHealthy();

    const afterFailure = await counts(fx.familyId, fx.accountId, key);
    expect(afterFailure).toEqual(before);

    const recovered = await postMessage(fx.token, fx.caseId, key, content);
    expect(recovered.status).toBe(201);
    const afterRecovery = await counts(fx.familyId, fx.accountId, key);
    expect(afterRecovery.messages).toBe(before.messages + 1);
    expect(afterRecovery.audits).toBe(before.audits + 1);
    expect(afterRecovery.idempotency).toBe(1);
  }, 20_000);
});
