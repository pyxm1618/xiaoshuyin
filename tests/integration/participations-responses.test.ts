import {
  acceptInvite,
  addBoundAdultTargetToFamily,
  addBoundAdultNonManagerToFamily,
  buildParticipationApp,
  createCase,
  createParticipationFixture,
  invite,
  withdrawParticipation,
} from '../setup/participation.js';
import {
  createConsentRequest,
  grantConsent,
  revokeConsent,
} from '../setup/api.js';
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

    // 5.1 Same key reused on a DIFFERENT participation returns 409 IDEMPOTENCY_PAYLOAD_MISMATCH
    const c2 = await createCase(h.app, f.manager.token, 'resp-c2');
    const created2 = await invite(h.app, f.manager.token, c2.json().id, target.personId, 'resp-invite-2');
    const part2Id = created2.json().participationId;
    await acceptInvite(h.app, target.token, created2.json().inviteToken, 'resp-accept-2');

    const crossMismatch = await h.app.inject({
      method: 'POST',
      url: `/api/v1/participations/${part2Id}/responses`,
      headers: {
        authorization: `Bearer ${target.token}`,
        'idempotency-key': idemKey,
      },
      payload: { content },
    });
    expect(crossMismatch.statusCode).toBe(409);
    expect(crossMismatch.json().code).toBe('IDEMPOTENCY_PAYLOAD_MISMATCH');

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

  it('allows MINOR_14_17 responses then blocks UNDER_14 administration-only, revoked and uncovered authority with zero side effects', async () => {
    const f = await createParticipationFixture(h, 'resp-u14', { target: 'manager' });
    const target = await addBoundAdultNonManagerToFamily(h, f.familyId, 'resp-u14-target');
    // Establish a legitimate active MINOR_14_17 participant first. The later
    // UNDER_14 profile change simulates a corrected classification.
    await h.admin.query(
      `UPDATE person_compliance_profiles SET age_band='MINOR_14_17',
         minor_mode=true, verified_source='GUARDIAN_RELAY' WHERE person_id=$1`,
      [target.personId]
    );

    // Invite and accept
    const created = await invite(h.app, f.manager.token, f.caseId, target.personId, 'resp-u14-invite');
    expect(created.statusCode).toBe(201);
    const participationId = created.json().participationId;
    const accepted = await acceptInvite(h.app, target.token, created.json().inviteToken, 'resp-u14-accept');
    expect(accepted.statusCode).toBe(200);

    // 3. ACTIVE + MINOR_14_17 processing authority -> 201
    const res1 = await h.app.inject({
      method: 'POST',
      url: `/api/v1/participations/${participationId}/responses`,
      headers: {
        authorization: `Bearer ${target.token}`,
        'idempotency-key': 'resp-u14-key-1',
      },
      payload: { content: '儿童首次合法回复' },
    });
    expect(res1.statusCode).toBe(201);
    expect(res1.json().id).toBeDefined();

    const baselineMsgCount = (await h.admin.query(
      'SELECT count(*)::int AS cnt FROM dialogue_messages WHERE case_id = $1',
      [f.caseId]
    )).rows[0].cnt;

    // Correct the age classification and attach valid administration-only guardian consent.
    const reqRes = await createConsentRequest(h.app, f.manager.token, 'resp-u14-req');
    expect(reqRes.statusCode).toBe(201);
    const grantRes = await grantConsent(h.app, f.manager.token, 'resp-u14-grant', reqRes.json().requestId);
    expect(grantRes.statusCode).toBe(201);
    const consent = grantRes.json();

    await h.admin.query(
      `UPDATE consent_records SET bound_person_id = $1, bound_at = now() WHERE id = $2`,
      [target.personId, consent.id]
    );

    await h.admin.query(
      `INSERT INTO person_compliance_profiles
         (person_id, age_band, minor_mode, guardian_person_id, guardian_consent_record_id, guardian_consent_version, verified_source)
       VALUES ($1, 'UNDER_14', true, $2, $3, 1, 'GUARDIAN_RELAY')
       ON CONFLICT (person_id) DO UPDATE
         SET age_band='UNDER_14', minor_mode=true, guardian_person_id=$2,
             guardian_consent_record_id=$3, guardian_consent_version=1, verified_source='GUARDIAN_RELAY'`,
      [target.personId, f.manager.personId, consent.id]
    );

    // A current v1 guardian consent covers consent administration ONLY (V1
    // Product Authority §19A.2). It must not authorize Case message processing.
    const blockedGranted = await h.app.inject({
      method: 'POST',
      url: `/api/v1/participations/${participationId}/responses`,
      headers: {
        authorization: `Bearer ${target.token}`,
        'idempotency-key': 'resp-u14-key-granted-blocked',
      },
      payload: { content: '不在同意处理范围内的回复' },
    });
    expect(blockedGranted.statusCode).toBe(403);
    expect(blockedGranted.json().code).toBe('FORBIDDEN');
    expect(blockedGranted.json().message).toBe('PARTICIPATION_PROCESSING_DISALLOWED');
    expect((await h.admin.query(
      'SELECT count(*)::int AS cnt FROM dialogue_messages WHERE case_id = $1',
      [f.caseId]
    )).rows[0].cnt).toBe(baselineMsgCount);
    expect((await h.admin.query(
      `SELECT count(*)::int AS cnt FROM business_audit_events WHERE actor_account_id = $1 AND event_type = 'MESSAGE_RECORDED'`,
      [target.accountId]
    )).rows[0].cnt).toBe(1);

    // 4. Revoke guardian consent via revoke API -> decision becomes 'REVOKED'
    const revokeRes = await revokeConsent(h.app, f.manager.token, 'resp-u14-revoke', consent.id, {
      reason: 'testing revocation',
    });
    expect(revokeRes.statusCode).toBe(200);

    // Attempt to respond -> blocked with 403
    const resRevoked = await h.app.inject({
      method: 'POST',
      url: `/api/v1/participations/${participationId}/responses`,
      headers: {
        authorization: `Bearer ${target.token}`,
        'idempotency-key': 'resp-u14-key-revoked',
      },
      payload: { content: '同意撤销后的回复尝试' },
    });
    expect(resRevoked.statusCode).toBe(403);
    expect(resRevoked.json().code).toBe('FORBIDDEN');
    expect(resRevoked.json().message).toBe('PARTICIPATION_PROCESSING_DISALLOWED');

    // Verify zero dialogue_message and zero audit side effects
    const postRevokeMsgCount = (await h.admin.query(
      'SELECT count(*)::int AS cnt FROM dialogue_messages WHERE case_id = $1',
      [f.caseId]
    )).rows[0].cnt;
    expect(postRevokeMsgCount).toBe(baselineMsgCount);

    const revokedAuditCount = (await h.admin.query(
      `SELECT count(*)::int AS cnt FROM business_audit_events WHERE actor_account_id = $1 AND event_type = 'MESSAGE_RECORDED'`,
      [target.accountId]
    )).rows[0].cnt;
    expect(revokedAuditCount).toBe(1); // Only the initial successful message was recorded

    // 5. Invalid / uncovered current processing authority (e.g. UNKNOWN age_band / uncovered compliance profile)
    await h.admin.query(
      `UPDATE person_compliance_profiles
         SET age_band = 'UNKNOWN',
             minor_mode = false,
             guardian_person_id = NULL,
             guardian_consent_record_id = NULL,
             guardian_consent_version = NULL
       WHERE person_id = $1`,
      [target.personId]
    );

    const resUncovered = await h.app.inject({
      method: 'POST',
      url: `/api/v1/participations/${participationId}/responses`,
      headers: {
        authorization: `Bearer ${target.token}`,
        'idempotency-key': 'resp-u14-key-uncovered',
      },
      payload: { content: '未覆盖合规档案的回复尝试' },
    });
    expect(resUncovered.statusCode).toBe(403);
    expect(resUncovered.json().code).toBe('FORBIDDEN');
    expect(resUncovered.json().message).toBe('PARTICIPATION_PROCESSING_DISALLOWED');

    // Verify zero side effect in DB
    const finalMsgCount = (await h.admin.query(
      'SELECT count(*)::int AS cnt FROM dialogue_messages WHERE case_id = $1',
      [f.caseId]
    )).rows[0].cnt;
    expect(finalMsgCount).toBe(baselineMsgCount);

    const finalAuditCount = (await h.admin.query(
      `SELECT count(*)::int AS cnt FROM business_audit_events WHERE actor_account_id = $1 AND event_type = 'MESSAGE_RECORDED'`,
      [target.accountId]
    )).rows[0].cnt;
    expect(finalAuditCount).toBe(1);
  });

  it('Finding #32 regression: same successful key after withdraw is blocked by preflight with 409 and does not replay 201', async () => {
    const f = await createParticipationFixture(h, 'resp-withdraw-replay', { target: 'manager' });
    const target = await addBoundAdultTargetToFamily(h, f.familyId, 'resp-target-withdraw-replay');

    const created = await invite(h.app, f.manager.token, f.caseId, target.personId, 'resp-w-rep-invite');
    expect(created.statusCode).toBe(201);
    const participationId = created.json().participationId;
    const accepted = await acceptInvite(h.app, target.token, created.json().inviteToken, 'resp-w-rep-accept');
    expect(accepted.statusCode).toBe(200);

    const successfulKey = 'resp-successful-key-withdraw';
    const payload = { content: '撤回前首次成功回复' };

    // 1. Initial response succeeds -> 201
    const res1 = await h.app.inject({
      method: 'POST',
      url: `/api/v1/participations/${participationId}/responses`,
      headers: {
        authorization: `Bearer ${target.token}`,
        'idempotency-key': successfulKey,
      },
      payload,
    });
    expect(res1.statusCode).toBe(201);

    // 2. Exact same key replay before withdraw succeeds with cached 201
    const replayBefore = await h.app.inject({
      method: 'POST',
      url: `/api/v1/participations/${participationId}/responses`,
      headers: {
        authorization: `Bearer ${target.token}`,
        'idempotency-key': successfulKey,
      },
      payload,
    });
    expect(replayBefore.statusCode).toBe(201);
    expect(replayBefore.json().id).toBe(res1.json().id);

    // 3. Withdraw participation -> state becomes WITHDRAWN
    const withdrawn = await withdrawParticipation(
      h.app,
      target.token,
      participationId,
      'resp-w-rep-withdraw-cmd'
    );
    expect(withdrawn.statusCode).toBe(200);

    // 4. Same successful key after withdraw MUST be blocked by preflight with 409 PARTICIPATION_STATE_CONFLICT
    const replayAfterWithdraw = await h.app.inject({
      method: 'POST',
      url: `/api/v1/participations/${participationId}/responses`,
      headers: {
        authorization: `Bearer ${target.token}`,
        'idempotency-key': successfulKey,
      },
      payload,
    });
    expect(replayAfterWithdraw.statusCode).toBe(409);
    expect(replayAfterWithdraw.json().code).toBe('PARTICIPATION_STATE_CONFLICT');
    expect(replayAfterWithdraw.json().currentState).toBe('WITHDRAWN');
  });

  it('Finding #32 regression: replay waiting on command lock rechecks a committed processing-authority change', async () => {
    const f = await createParticipationFixture(h, 'resp-authority-race', { target: 'manager' });
    const target = await addBoundAdultNonManagerToFamily(h, f.familyId, 'resp-race-target');
    await h.admin.query(
      `UPDATE person_compliance_profiles SET age_band='MINOR_14_17',
         minor_mode=true, verified_source='GUARDIAN_RELAY' WHERE person_id=$1`,
      [target.personId]
    );
    const created = await invite(h.app, f.manager.token, f.caseId, target.personId, 'resp-race-invite');
    expect(created.statusCode).toBe(201);
    const participationId = created.json().participationId;
    const accepted = await acceptInvite(h.app, target.token, created.json().inviteToken, 'resp-race-accept');
    expect(accepted.statusCode).toBe(200);

    const key = 'resp-authority-race-key';
    const submit = async () => h.app.inject({
      method: 'POST',
      url: `/api/v1/participations/${participationId}/responses`,
      headers: { authorization: `Bearer ${target.token}`, 'idempotency-key': key },
      payload: { content: '权限变更前的本人回复' },
    });
    expect((await submit()).statusCode).toBe(201);

    const blocker = await h.admin.connect();
    let replay: ReturnType<typeof submit> | undefined;
    try {
      await blocker.query('BEGIN');
      const pid = (await blocker.query<{ pid: number }>('SELECT pg_backend_pid() AS pid')).rows[0]!.pid;
      // Hold the exact repository command lock, not an arbitrary timer.
      await blocker.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0::bigint))',
        [`${target.accountId}:CASE_MESSAGE_CREATE:${key}`]);
      let settled = false;
      replay = submit().finally(() => { settled = true; });

      // Observe the real waiting transaction before changing authority.
      let waiting = false;
      const deadline = Date.now() + 5000;
      while (!settled && Date.now() < deadline) {
        const rows = (await h.admin.query<{ waiting: boolean }>(
          `SELECT EXISTS (
             SELECT 1 FROM pg_stat_activity WHERE $1::int = ANY(pg_blocking_pids(pid))
           ) AS waiting`, [pid]
        )).rows;
        if (rows[0]?.waiting === true) {
          waiting = true;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      expect(waiting, 'replay must wait on the transaction-scoped command lock').toBe(true);
      expect(settled).toBe(false);

      // Commit a newly uncovered age classification before releasing the lock.
      // A replay must use the current profile, not a previously authorized body.
      await blocker.query(
        `UPDATE person_compliance_profiles SET age_band='UNKNOWN',
           minor_mode=false, verified_source='SELF_STATEMENT' WHERE person_id=$1`,
        [target.personId]
      );
      await blocker.query('COMMIT');
      const denied = await replay;
      expect(denied.statusCode).toBe(403);
      expect(denied.json().code).toBe('FORBIDDEN');
      expect(denied.json().message).toBe('PARTICIPATION_PROCESSING_DISALLOWED');
    } finally {
      try {
        await blocker.query('ROLLBACK');
      } finally {
        blocker.release();
        await replay?.catch(() => undefined);
      }
    }

    expect((await h.admin.query(
      'SELECT count(*)::int AS cnt FROM dialogue_messages WHERE case_id = $1',
      [f.caseId]
    )).rows[0].cnt).toBe(1);
    expect((await h.admin.query(
      `SELECT count(*)::int AS cnt FROM business_audit_events WHERE actor_account_id = $1 AND event_type = 'MESSAGE_RECORDED'`,
      [target.accountId]
    )).rows[0].cnt).toBe(1);
  }, 20000);

  it('Finding #32 regression: same successful key after corrected UNDER_14 profile or consent revoke cannot replay 201', async () => {
    const f = await createParticipationFixture(h, 'resp-revoke-replay', { target: 'manager' });
    const target = await addBoundAdultNonManagerToFamily(h, f.familyId, 'resp-target-revoke-replay');
    await h.admin.query(
      `UPDATE person_compliance_profiles SET age_band='MINOR_14_17',
         minor_mode=true, verified_source='GUARDIAN_RELAY' WHERE person_id=$1`,
      [target.personId]
    );

    const created = await invite(h.app, f.manager.token, f.caseId, target.personId, 'resp-rev-rep-invite');
    expect(created.statusCode).toBe(201);
    const participationId = created.json().participationId;
    const accepted = await acceptInvite(h.app, target.token, created.json().inviteToken, 'resp-rev-rep-accept');
    expect(accepted.statusCode).toBe(200);

    const successfulKey = 'resp-successful-key-consent-revoke';
    const payload = { content: '撤销前首次成功回复' };

    // 1. Initial response succeeds -> 201
    const res1 = await h.app.inject({
      method: 'POST',
      url: `/api/v1/participations/${participationId}/responses`,
      headers: {
        authorization: `Bearer ${target.token}`,
        'idempotency-key': successfulKey,
      },
      payload,
    });
    expect(res1.statusCode).toBe(201);

    // 2. Exact same key replay before revoke succeeds with cached 201
    const replayBefore = await h.app.inject({
      method: 'POST',
      url: `/api/v1/participations/${participationId}/responses`,
      headers: {
        authorization: `Bearer ${target.token}`,
        'idempotency-key': successfulKey,
      },
      payload,
    });
    expect(replayBefore.statusCode).toBe(201);
    expect(replayBefore.json().id).toBe(res1.json().id);

    // Setup UNDER_14 compliance profile + consent
    const reqRes = await createConsentRequest(h.app, f.manager.token, 'resp-rev-rep-req');
    expect(reqRes.statusCode).toBe(201);
    const grantRes = await grantConsent(h.app, f.manager.token, 'resp-rev-rep-grant', reqRes.json().requestId);
    expect(grantRes.statusCode).toBe(201);
    const consent = grantRes.json();

    await h.admin.query(
      `UPDATE consent_records SET bound_person_id = $1, bound_at = now() WHERE id = $2`,
      [target.personId, consent.id]
    );

    await h.admin.query(
      `INSERT INTO person_compliance_profiles
         (person_id, age_band, minor_mode, guardian_person_id, guardian_consent_record_id, guardian_consent_version, verified_source)
       VALUES ($1, 'UNDER_14', true, $2, $3, 1, 'GUARDIAN_RELAY')
       ON CONFLICT (person_id) DO UPDATE
         SET age_band='UNDER_14', minor_mode=true, guardian_person_id=$2,
             guardian_consent_record_id=$3, guardian_consent_version=1, verified_source='GUARDIAN_RELAY'`,
      [target.personId, f.manager.personId, consent.id]
    );

    // Even a GRANTED v1 consent does not cover Case processing.
    const replayAfterCorrection = await h.app.inject({
      method: 'POST',
      url: `/api/v1/participations/${participationId}/responses`,
      headers: {
        authorization: `Bearer ${target.token}`,
        'idempotency-key': successfulKey,
      },
      payload,
    });
    expect(replayAfterCorrection.statusCode).toBe(403);
    expect(replayAfterCorrection.json().code).toBe('FORBIDDEN');
    expect(replayAfterCorrection.json().message).toBe('PARTICIPATION_PROCESSING_DISALLOWED');

    // 3. Revoke consent
    const revokeRes = await revokeConsent(h.app, f.manager.token, 'resp-rev-rep-revoke-cmd', consent.id, {
      reason: 'testing revocation replay',
    });
    expect(revokeRes.statusCode).toBe(200);

    // 4. Same successful key after consent revoke MUST be blocked by preflight with 403 PARTICIPATION_PROCESSING_DISALLOWED
    const replayAfterRevoke = await h.app.inject({
      method: 'POST',
      url: `/api/v1/participations/${participationId}/responses`,
      headers: {
        authorization: `Bearer ${target.token}`,
        'idempotency-key': successfulKey,
      },
      payload,
    });
    expect(replayAfterRevoke.statusCode).toBe(403);
    expect(replayAfterRevoke.json().code).toBe('FORBIDDEN');
    expect(replayAfterRevoke.json().message).toBe('PARTICIPATION_PROCESSING_DISALLOWED');
    expect((await h.admin.query(
      'SELECT count(*)::int AS cnt FROM dialogue_messages WHERE case_id = $1',
      [f.caseId]
    )).rows[0].cnt).toBe(1);
    expect((await h.admin.query(
      `SELECT count(*)::int AS cnt FROM business_audit_events WHERE actor_account_id = $1 AND event_type = 'MESSAGE_RECORDED'`,
      [target.accountId]
    )).rows[0].cnt).toBe(1);
  });
});
