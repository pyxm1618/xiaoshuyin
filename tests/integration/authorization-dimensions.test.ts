/**
 * T062: Authorization dimensions integration tests.
 *
 * Proves that "guardian" and "family membership" are two INDEPENDENT
 * dimensions — neither one can substitute for the other.
 *
 *   FR-006a  guardian-but-not-member  → no Family access
 *   FR-006b  member-but-not-guardian → no guardian authority (NOT_GUARDIAN)
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import { buildApp } from '../../apps/server/api/src/app.js';
import { createAdminPool } from '../setup/db.js';
import {
  auth,
  commandHeaders,
  createConsentRequest,
  createFamily,
  createMember,
  grantConsent,
  loginWithLabel,
  revokeConsent,
} from '../setup/api.js';

let verifyPool: pg.Pool;

describe('Authorization Dimensions (T062)', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
    verifyPool = createAdminPool();
  });

  afterAll(async () => {
    await verifyPool.end();
    await app.close();
  });

  async function createFamilyFor(token: string, label: string): Promise<string> {
    const res = await createFamily(app, token, `t062_${label}`);
    expect(res.statusCode).toBe(201);
    return res.json().id as string;
  }

  async function createConsentRequestFor(token: string, label: string): Promise<string> {
    const res = await createConsentRequest(app, token, `t062_${label}`);
    expect(res.statusCode).toBe(201);
    return res.json().requestId as string;
  }

  async function grantConsentFor(token: string, label: string, requestId: string): Promise<string> {
    const res = await grantConsent(app, token, `t062_${label}`, requestId);
    expect(res.statusCode).toBe(201);
    return res.json().id as string;
  }

  async function addRealMember(familyId: string, personId: string): Promise<void> {
    await verifyPool.query(
      'INSERT INTO family_members (family_id, person_id) VALUES ($1, $2)',
      [familyId, personId]
    );
  }

  it('T062: guardian-but-not-member cannot access another Family (403, no target fields)', async () => {
    const b = await loginWithLabel(app, 't062_famb');
    const famBId = await createFamilyFor(b.token, 'famb');

    const a = await loginWithLabel(app, 't062_fama');
    const famAId = await createFamilyFor(a.token, 'fama');
    const reqId = await createConsentRequestFor(a.token, 'fama');
    const consentId = await grantConsentFor(a.token, 'fama', reqId);

    const { rows } = await verifyPool.query(
      'SELECT guardian_person_id FROM consent_records WHERE id = $1',
      [consentId]
    );
    expect(rows[0].guardian_person_id).toBe(a.personId);

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/families/${famBId}/members`,
      headers: commandHeaders(a.token, 't062-guard-nm'),
      payload: {
        ageBand: 'UNDER_14',
        ageBandSource: 'GUARDIAN_RELAY',
        guardianConsentId: consentId,
      },
    });

    expect(res.statusCode).toBe(403);
    expect(['NOT_FAMILY_MEMBER', 'NOT_FAMILY_MANAGER', 'GUARDIAN_CONSENT_REQUIRED']).toContain(res.json().code);
    const dumped = JSON.stringify(res.json());
    expect(dumped).not.toContain(famBId);
    expect(dumped).not.toContain(famAId);

    const { rows: members } = await verifyPool.query(
      'SELECT count(*)::int AS cnt FROM family_members WHERE family_id = $1',
      [famBId]
    );
    expect(members[0].cnt).toBe(1);
  });

  it('T062: member-but-not-guardian grant → NOT_GUARDIAN', async () => {
    const mgr = await loginWithLabel(app, 't062_mgr');
    const famId = await createFamilyFor(mgr.token, 'mgr');
    const reqId = await createConsentRequestFor(mgr.token, 'mgr');

    const member = await loginWithLabel(app, 't062_member');
    await addRealMember(famId, member.personId);

    const { rows: membership } = await verifyPool.query(
      'SELECT count(*)::int AS cnt FROM family_members WHERE family_id = $1 AND person_id = $2',
      [famId, member.personId]
    );
    expect(membership[0].cnt).toBe(1);
    expect(member.personId).not.toBe(mgr.personId);

    const grantRes = await grantConsent(app, member.token, 't062-ng', reqId);

    expect(grantRes.statusCode).toBe(403);
    expect(grantRes.json().code).toBe('NOT_GUARDIAN');
    expect(JSON.stringify(grantRes.json())).not.toContain(reqId);

    const { rows: pending } = await verifyPool.query(
      "SELECT count(*)::int AS cnt FROM guardian_consent_requests WHERE id = $1 AND status = 'PENDING'",
      [reqId]
    );
    expect(pending[0].cnt).toBe(1);
  });

  it('T062: member-but-not-guardian revoke → NOT_GUARDIAN', async () => {
    const mgr = await loginWithLabel(app, 't062_mgr2');
    const famId = await createFamilyFor(mgr.token, 'mgr2');
    const reqId = await createConsentRequestFor(mgr.token, 'mgr2');
    const consentId = await grantConsentFor(mgr.token, 'mgr2', reqId);

    const member = await loginWithLabel(app, 't062_member2');
    await addRealMember(famId, member.personId);

    const res = await revokeConsent(app, member.token, 't062-ng2', consentId);

    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe('NOT_GUARDIAN');

    const { rows } = await verifyPool.query(
      'SELECT count(*)::int AS cnt FROM consent_records WHERE family_id = $1',
      [famId]
    );
    expect(rows[0].cnt).toBe(1);
  });

  it('T062: membership alone cannot create an UNDER_14 child without consent', async () => {
    const mgr = await loginWithLabel(app, 't062_dim');
    const famId = await createFamilyFor(mgr.token, 'dim');

    const res = await createMember(app, mgr.token, famId, 't062-dim', {
      ageBand: 'UNDER_14',
      ageBandSource: 'GUARDIAN_RELAY',
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe('GUARDIAN_CONSENT_REQUIRED');

    const { rows } = await verifyPool.query(
      'SELECT count(*)::int AS cnt FROM family_members WHERE family_id = $1',
      [famId]
    );
    expect(rows[0].cnt).toBe(1);
  });

  it('T062: guardian consent from Family A cannot be consumed inside Family B', async () => {
    const a = await loginWithLabel(app, 't062_crossa');
    const famAId = await createFamilyFor(a.token, 'crossa');
    const aReqId = await createConsentRequestFor(a.token, 'crossa');
    const aConsentId = await grantConsentFor(a.token, 'crossa', aReqId);

    const b = await loginWithLabel(app, 't062_crossb');
    const famBId = await createFamilyFor(b.token, 'crossb');

    const res = await createMember(app, b.token, famBId, 't062-cross', {
      ageBand: 'UNDER_14',
      ageBandSource: 'GUARDIAN_RELAY',
      guardianConsentId: aConsentId,
    });

    expect([403, 404]).toContain(res.statusCode);
    expect(res.json().code).not.toBe('IDEMPOTENCY_PAYLOAD_MISMATCH');

    const { rows: famBMembers } = await verifyPool.query(
      'SELECT count(*)::int AS cnt FROM family_members WHERE family_id = $1',
      [famBId]
    );
    expect(famBMembers[0].cnt).toBe(1);
    const { rows: bound } = await verifyPool.query(
      'SELECT bound_person_id FROM consent_records WHERE id = $1',
      [aConsentId]
    );
    expect(bound[0].bound_person_id).toBeNull();
    expect(famAId).not.toBe(famBId);
  });
});