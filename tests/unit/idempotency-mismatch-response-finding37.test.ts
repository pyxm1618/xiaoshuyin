import { describe, it, expect, vi } from 'vitest';
import { sendCommandOutcome } from '../../apps/server/api/src/idempotency.js';

describe('Finding #37: Idempotency Mismatch Response field leakage prevention', () => {
  function makeMockReply() {
    const reply: any = {};
    reply.status = vi.fn().mockReturnValue(reply);
    reply.send = vi.fn().mockImplementation((payload) => {
      reply.sentBody = payload;
      return reply;
    });
    return reply;
  }

  it('projects safe external response on MISMATCH without internal statusCode or extra properties', () => {
    const reply = makeMockReply();
    const outcome = { action: 'MISMATCH' } as const;

    sendCommandOutcome(reply, outcome);

    expect(reply.status).toHaveBeenCalledWith(409);
    expect(reply.sentBody).toEqual({
      code: 'IDEMPOTENCY_PAYLOAD_MISMATCH',
      message: 'IDEMPOTENCY_PAYLOAD_MISMATCH',
    });

    const keys = Object.keys(reply.sentBody).sort();
    expect(keys).toEqual(['code', 'message']);
    expect(reply.sentBody).not.toHaveProperty('statusCode');
    expect(reply.sentBody).not.toHaveProperty('details');
    expect(reply.sentBody).not.toHaveProperty('stack');
  });

  it('projects normal status and body on REPLAY', () => {
    const reply = makeMockReply();
    const outcome = {
      action: 'REPLAY',
      status: 200,
      body: { ok: true, data: 'test' },
    } as any;

    sendCommandOutcome(reply, outcome);

    expect(reply.status).toHaveBeenCalledWith(200);
    expect(reply.sentBody).toEqual({ ok: true, data: 'test' });
  });
});
