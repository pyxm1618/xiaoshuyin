import {
  acceptInvite,
  addBoundAdultTargetToFamily,
  buildParticipationApp,
  createParticipationFixture,
  invite,
  withdrawParticipation,
} from '../setup/participation.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import crypto from 'node:crypto';

describe('Finding #32 Child-authored Participation Responses API', () => {
  let h: Awaited<ReturnType<typeof buildParticipationApp>>;
  beforeAll(async () => {
    h = await buildParticipationApp();
  });
  afterAll(async () => {
    await h.close();
  });

  it('active participant submits response message with dialogue message and audit creation', async () => {
    const f = await createParticipationFixture(h, 'resp-active', { target: 'manager' });
    const target = await addBoundAdultTargetToFamily(h, f.familyId, 'resp-target');
    const created = await invite(h.app, f.manager.token, f.caseId, target.personId, 'resp-invite');
    expect(created.statusCode).toBe(201);
    const participationId = created.json().participationId;

    // 1. PENDING state cannot submit response -> 409 PARTICIPATION_STATE_CONFLICT
    const pendingRes = await h.app.inject({
      method: 'POST',
      url: `/api/v1/participations/${participationId}/responses`,
      headers: {
        authorization: `Bearer ${target.token}`,
        'idempotency-key': 'resp-pending-key-1',
      },
      payload: {
        content: '提前回复尝试',
      },
    });
    expect(pendingRes.statusCode).toBe(409);
    expect(pendingRes.json().code).toBe('PARTICIPATION_STATE_CONFLICT');
    expect(pendingRes.json().currentState).toBe('PENDING');

    // 2. Accept invite to become ACTIVE
    const accepted = await acceptInvite(
      h.app,
      target.token,
      created.json().inviteToken,
      'resp-accept-cmd'
    );
    expect(accepted.statusCode).toBe(200);

    // 3. Child/target submits response successfully -> 201
    const idemKey = 'resp-active-key-' + crypto.randomUUID();
    const content = '我希望每天晚上九点后不再使用手机';
    const res = await h.app.inject({
      method: 'POST',
      url: `/api/v1/participations/${participationId}/responses`,
      headers: {
        authorization: `Bearer ${target.token}`,
        'idempotency-key': idemKey,
      },
      payload: { content },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.id).toBeDefined();
    expect(body.caseId).toBe(f.caseId);
    expect(body.participationId).toBe(participationId);
    expect(body.authorPersonId).toBe(target.personId);
    expect(body.content).toBe(content);
    expect(body.createdAt).toBeDefined();

    // Verify DB dialogue_messages and audit events
    const msg = await h.admin.query(
      'SELECT id, case_id, source_person_id, content FROM dialogue_messages WHERE id = $1',
      [body.id]
    );
    expect(msg.rows[0]).toMatchObject({
      id: body.id,
      case_id: f.caseId,
      source_person_id: target.personId,
      content,
    });

    const audit = await h.admin.query(
      `SELECT event_type, actor_account_id FROM business_audit_events
       WHERE resource_id = $1 AND event_type = 'MESSAGE_RECORDED'`,
      [body.id]
    );
    expect(audit.rows.length).toBe(1);
    expect(audit.rows[0].actor_account_id).toBe(target.accountId);

    // 4. Exact replay with same key and same content returns 201 with identical id
    const replay = await h.app.inject({
      method: 'POST',
      url: `/api/v1/participations/${participationId}/responses`,
      headers: {
        authorization: `Bearer ${target.token}`,
        'idempotency-key': idemKey,
      },
      payload: { content },
    });
    expect(replay.statusCode).toBe(201);
    expect(replay.json().id).toBe(body.id);

    // No duplicate message in DB
    const count = await h.admin.query(
      'SELECT count(*)::int AS cnt FROM dialogue_messages WHERE case_id = $1',
      [f.caseId]
    );
    expect(count.rows[0].cnt).toBe(1);

    // 5. Payload mismatch with same key returns 409 IDEMPOTENCY_PAYLOAD_MISMATCH
    const mismatch = await h.app.inject({
      method: 'POST',
      url: `/api/v1/participations/${participationId}/responses`,
      headers: {
        authorization: `Bearer ${target.token}`,
        'idempotency-key': idemKey,
      },
      payload: { content: '不同的内容尝试重放' },
    });
    expect(mismatch.statusCode).toBe(409);
    expect(mismatch.json().code).toBe('IDEMPOTENCY_PAYLOAD_MISMATCH');

    // 6. Another user (e.g. manager) attempts to respond on child's participation -> 404 PARTICIPATION_NOT_FOUND
    const impostor = await h.app.inject({
      method: 'POST',
      url: `/api/v1/participations/${participationId}/responses`,
      headers: {
        authorization: `Bearer ${f.manager.token}`,
        'idempotency-key': 'resp-impostor-key-1',
      },
      payload: { content: '冒充提交' },
    });
    expect(impostor.statusCode).toBe(404);
    expect(impostor.json().code).toBe('PARTICIPATION_NOT_FOUND');

    // 7. Withdraw participation -> state becomes WITHDRAWN -> 409 PARTICIPATION_STATE_CONFLICT
    const withdrawn = await withdrawParticipation(
      h.app,
      target.token,
      participationId,
      'resp-withdraw-cmd'
    );
    expect(withdrawn.statusCode).toBe(200);

    const postWithdraw = await h.app.inject({
      method: 'POST',
      url: `/api/v1/participations/${participationId}/responses`,
      headers: {
        authorization: `Bearer ${target.token}`,
        'idempotency-key': 'resp-post-withdraw-key',
      },
      payload: { content: '撤回后的提交尝试' },
    });
    expect(postWithdraw.statusCode).toBe(409);
    expect(postWithdraw.json().code).toBe('PARTICIPATION_STATE_CONFLICT');
    expect(postWithdraw.json().currentState).toBe('WITHDRAWN');
  });
});
