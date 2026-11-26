import { describe, it, expect, vi } from 'vitest';
import { registerMemberRoutes } from '../../apps/server/api/src/routes/members.js';

describe('Finding #38: Members Route Malformed UUID validation', () => {
  function makeMockApp() {
    const routes: Record<string, { method: string; handler: Function }> = {};
    return {
      routes,
      post(path: string, handler: Function) {
        routes[`POST ${path}`] = { method: 'POST', handler };
      },
      patch(path: string, handler: Function) {
        routes[`PATCH ${path}`] = { method: 'PATCH', handler };
      },
    } as any;
  }

  function makeMockReply() {
    const reply: any = {};
    reply.status = vi.fn().mockReturnValue(reply);
    reply.send = vi.fn().mockImplementation((payload) => {
      reply.sentBody = payload;
      return reply;
    });
    return reply;
  }

  const app = makeMockApp();
  const pool = {} as any;
  registerMemberRoutes(app, pool);

  it('rejects malformed family UUID on POST /api/v1/families/:id/members with 422 VALIDATION_ERROR', async () => {
    const handler = app.routes['POST /api/v1/families/:id/members'].handler;
    const req = {
      actor: { accountId: '018f0000-0000-7000-8000-000000000001', personId: '018f0000-0000-7000-8000-000000000002' },
      params: { id: 'invalid-family-uuid' },
      body: {},
    };
    const reply = makeMockReply();

    await handler(req, reply);

    expect(reply.status).toHaveBeenCalledWith(422);
    expect(reply.sentBody.code).toBe('VALIDATION_ERROR');
  });

  it('rejects malformed family UUID on PATCH /api/v1/families/:id/members/:personId with 422 VALIDATION_ERROR', async () => {
    const handler = app.routes['PATCH /api/v1/families/:id/members/:personId'].handler;
    const req = {
      actor: { accountId: '018f0000-0000-7000-8000-000000000001', personId: '018f0000-0000-7000-8000-000000000002' },
      params: { id: 'bad-uuid', personId: '018f0000-0000-7000-8000-000000000003' },
      body: {},
    };
    const reply = makeMockReply();

    await handler(req, reply);

    expect(reply.status).toHaveBeenCalledWith(422);
    expect(reply.sentBody.code).toBe('VALIDATION_ERROR');
  });

  it('rejects malformed person UUID on PATCH /api/v1/families/:id/members/:personId with 422 VALIDATION_ERROR', async () => {
    const handler = app.routes['PATCH /api/v1/families/:id/members/:personId'].handler;
    const req = {
      actor: { accountId: '018f0000-0000-7000-8000-000000000001', personId: '018f0000-0000-7000-8000-000000000002' },
      params: { id: '018f0000-0000-7000-8000-000000000003', personId: 'not-a-uuid' },
      body: {},
    };
    const reply = makeMockReply();

    await handler(req, reply);

    expect(reply.status).toHaveBeenCalledWith(422);
    expect(reply.sentBody.code).toBe('VALIDATION_ERROR');
  });
});
