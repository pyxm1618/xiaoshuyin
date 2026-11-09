/**
 * F11: production log privacy.
 *
 * At `LOG_LEVEL=info` Fastify's default request serializer would emit
 * `remoteAddress`. The frozen consent evidence rule requires raw IP / UA and
 * the pepper to never reach logs.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type pg from 'pg';
import { buildApp } from '../../apps/server/api/src/app.js';
import { createAdminPool } from '../setup/db.js';
import {
  commandHeaders,
  createConsentRequest,
  createFamily,
  loginWithLabel,
} from '../setup/api.js';

class CaptureStream {
  chunks: string[] = [];
  write(chunk: unknown): boolean {
    this.chunks.push(String(chunk));
    return true;
  }
  text(): string {
    return this.chunks.join('');
  }
}

const RAW_IP = '203.0.113.77';
const RAW_UA = 'LogPrivacyAgent/9.9';

describe('Log privacy (F11)', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let verifyPool: pg.Pool;
  let capture: CaptureStream;

  beforeAll(async () => {
    capture = new CaptureStream();
    app = await buildApp({
      env: { ...process.env, NODE_ENV: 'test', LOG_LEVEL: 'info' },
      loggerStream: capture,
    });
    await app.ready();
    verifyPool = createAdminPool();
  });

  afterAll(async () => {
    await verifyPool.end();
    await app.close();
  });

  it('info-level consent grant/revoke logs contain no raw IP / UA / pepper', async () => {
    const actor = await loginWithLabel(app, 'logpriv');
    const fam = await createFamily(app, actor.token, 'logpriv');
    expect(fam.statusCode).toBe(201);

    const req = await createConsentRequest(app, actor.token, 'logpriv');
    expect(req.statusCode).toBe(201);

    const grant = await app.inject({
      method: 'POST',
      url: '/api/v1/compliance/guardian-consents',
      headers: {
        ...commandHeaders(actor.token, 'logpriv-grant'),
        'user-agent': RAW_UA,
      },
      remoteAddress: RAW_IP,
      payload: {
        onboardingRequestId: req.json().requestId,
        noticeVersion: 'v1',
        accepted: true,
      },
    });
    expect(grant.statusCode).toBe(201);

    const revoke = await app.inject({
      method: 'POST',
      url: `/api/v1/consents/${grant.json().id}/revoke`,
      headers: {
        ...commandHeaders(actor.token, 'logpriv-revoke'),
        'user-agent': RAW_UA,
      },
      remoteAddress: RAW_IP,
      payload: {},
    });
    expect(revoke.statusCode).toBe(200);

    const logs = capture.text();
    // Prove the logger really emitted request logs at info level.
    expect(logs.length).toBeGreaterThan(0);
    expect(logs).toContain('/api/v1/compliance/guardian-consents');

    expect(logs).not.toContain(RAW_IP);
    expect(logs).not.toContain(RAW_UA);
    expect(logs).not.toContain(process.env['EVIDENCE_HASH_PEPPER']!);
    expect(logs).not.toContain('Bearer ');
  });
});