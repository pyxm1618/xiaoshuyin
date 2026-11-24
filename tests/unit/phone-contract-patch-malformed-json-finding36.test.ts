import { describe, it, expect, vi } from 'vitest';
import { errorHandler } from '../../apps/server/api/src/plugins/error-handler.js';

describe('Finding #36: Phone Contract PATCH Malformed JSON error contract', () => {
  function makeMockReply() {
    const reply: any = {};
    reply.status = vi.fn().mockReturnValue(reply);
    reply.send = vi.fn().mockReturnValue(reply);
    return reply;
  }

  function makeMockRequest(method: string, routeUrl: string) {
    return {
      method,
      url: routeUrl,
      routeOptions: { url: routeUrl },
      log: { error: vi.fn() },
      id: 'req-1',
    } as any;
  }

  it('maps malformed JSON on PATCH /api/v1/cases/:id/digital-use/contract/drafts/:version to 422 VALIDATION_ERROR', () => {
    const reply = makeMockReply();
    const req = makeMockRequest('PATCH', '/api/v1/cases/:id/digital-use/contract/drafts/:version');
    const err = Object.assign(new Error('Unexpected token in JSON'), {
      code: 'FST_ERR_CTP_INVALID_JSON_BODY',
    });

    errorHandler(err, req, reply);

    expect(reply.status).toHaveBeenCalledWith(422);
    expect(reply.send).toHaveBeenCalledWith({
      code: 'VALIDATION_ERROR',
      message: 'Invalid request body',
    });
  });

  it('keeps existing mapping for POST strict-json routes (e.g. POST /api/v1/cases)', () => {
    const reply = makeMockReply();
    const req = makeMockRequest('POST', '/api/v1/cases');
    const err = Object.assign(new Error('Unexpected token in JSON'), {
      code: 'FST_ERR_CTP_INVALID_JSON_BODY',
    });

    errorHandler(err, req, reply);

    expect(reply.status).toHaveBeenCalledWith(422);
    expect(reply.send).toHaveBeenCalledWith({
      code: 'VALIDATION_ERROR',
      message: 'Invalid request body',
    });
  });

  it('does not map malformed JSON on unrelated routes to 422', () => {
    const reply = makeMockReply();
    const req = makeMockRequest('PATCH', '/api/v1/unrelated-path');
    const err = Object.assign(new Error('Unexpected token in JSON'), {
      code: 'FST_ERR_CTP_INVALID_JSON_BODY',
    });

    errorHandler(err, req, reply);

    // Should not be 422 VALIDATION_ERROR
    expect(reply.status).not.toHaveBeenCalledWith(422);
  });
});
