/**
 * Re-consent subject validation (Independent Review Round 2 — new HIGH).
 *
 * F4: validation happens at REQUEST time (before any onboarding row is
 * written) and again at GRANT time. Mode B MUST NOT silently fall back to
 * Mode A. Any failed precondition rejects the whole transaction.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import { buildApp } from '../../apps/server/api/src/app.js';
import { createAdminPool } from '../setup/db.js';
import {
  createConsentRequest,
  createFamily,
  createMember,
  grantConsent,
  loginWithLabel,
  revokeConsent,
} from '../setup/api.js';

let verifyPool: pg.Pool;

async function queryDb(sql: string, params: unknown[] = []) {
  return verifyPool.query(sql, params);
}

describe('Re-consent subject validation (T057 / consent-onboarding §6.1)', () => {
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

  async function loginAndFamily(label: string) {
    const actor = await loginWithLabel(app, `rc_${label}`);
    const fam = await createFamily(app, actor.token, `rc_${label}`);
    expect(fam.statusCode).toBe(201);
    return { ...actor, familyId: fam.json().id as string };
  }

  async function createRequest(token: string, label: string, existingSubjectPersonId?: string) {
    return createConsentRequest(app, token, label,
      existingSubjectPersonId ? { existingSubjectPersonId } : {});
  }

  async function createGrantedAndChild(actor: { token: string; familyId: string }, label: string) {
    const req = await createRequest(actor.token, `${label}-a`);
    expect(req.statusCode).toBe(201);
    const grant = await grantConsent(app, actor.token, `${label}-a`, req.json().requestId);
    expect(grant.statusCode).toBe(201);
    const consentId = grant.json().id as string;

    const child = await createMember(app, actor.token, actor.familyId, label, {
      ageBand: 'UNDER_14',
      ageBandSource: 'GUARDIAN_RELAY',
      guardianConsentId: consentId,
    });
    expect(child.statusCode).toBe(201);
    return { consentId, childId: child.json().personId as string };
  }

  it('Mode B: adult creator as subject → 403 at request time, no row', async () => {
    const actor = await loginAndFamily('adult-subject');
    const before = await queryDb(
      'SELECT count(*)::int AS cnt FROM guardian_consent_requests WHERE family_id = $1',
      [actor.familyId]
    );

    const res = await createRequest(actor.token, 'adult-subject', actor.personId);
    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe('FORBIDDEN');
    expect(JSON.stringify(res.json())).not.toContain(actor.personId);

    const after = await queryDb(
      'SELECT count(*)::int AS cnt FROM guardian_consent_requests WHERE family_id = $1',
      [actor.familyId]
    );
    expect(after.rows[0].cnt).toBe(before.rows[0].cnt);
  });

  it('Mode B: ghost UUID → 403, no row, no leaked id', async () => {
    const actor = await loginAndFamily('ghost-subject');
    const ghostId = '00000000-0000-4000-8000-0000000000aa';
    const before = await queryDb(
      'SELECT count(*)::int AS cnt FROM guardian_consent_requests WHERE family_id = $1',
      [actor.familyId]
    );

    const res = await createRequest(actor.token, 'ghost-subject', ghostId);
    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe('FORBIDDEN');
    expect(JSON.stringify(res.json())).not.toContain(ghostId);

    const after = await queryDb(
      'SELECT count(*)::int AS cnt FROM guardian_consent_requests WHERE family_id = $1',
      [actor.familyId]
    );
    expect(after.rows[0].cnt).toBe(before.rows[0].cnt);
  });

  it('Mode B: subject outside the current family → 403, no row', async () => {
    const outsider = await loginAndFamily('outsider');
    const outsiderMember = await createMember(app, outsider.token, outsider.familyId, 'outsider-member', {
      ageBand: 'MINOR_14_17',
      ageBandSource: 'GUARDIAN_OBSERVATION',
    });
    expect(outsiderMember.statusCode).toBe(201);
    const outsiderPersonId = outsiderMember.json().personId as string;

    const actor = await loginAndFamily('foreign-subject');
    const before = await queryDb(
      'SELECT count(*)::int AS cnt FROM guardian_consent_requests WHERE family_id = $1',
      [actor.familyId]
    );

    const res = await createRequest(actor.token, 'foreign-subject', outsiderPersonId);
    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe('FORBIDDEN');

    const after = await queryDb(
      'SELECT count(*)::int AS cnt FROM guardian_consent_requests WHERE family_id = $1',
      [actor.familyId]
    );
    expect(after.rows[0].cnt).toBe(before.rows[0].cnt);
  });

  it('Mode B: UNDER_14 whose current consent is still GRANTED → 409 conflict', async () => {
    const actor = await loginAndFamily('still-granted');
    const { childId } = await createGrantedAndChild(actor, 'still-granted');

    const before = await queryDb(
      'SELECT count(*)::int AS cnt FROM guardian_consent_requests WHERE family_id = $1',
      [actor.familyId]
    );

    const res = await createRequest(actor.token, 'still-granted-b', childId);
    expect(res.statusCode).toBe(409);
    expect(res.json().code).toBe('GUARDIAN_CONSENT_ALREADY_GRANTED');

    const after = await queryDb(
      'SELECT count(*)::int AS cnt FROM guardian_consent_requests WHERE family_id = $1',
      [actor.familyId]
    );
    expect(after.rows[0].cnt).toBe(before.rows[0].cnt);

    const { rows } = await queryDb(
      'SELECT decision, version FROM consent_records WHERE family_id = $1 ORDER BY version',
      [actor.familyId]
    );
    expect(rows.length).toBe(1);
    expect(rows[0].decision).toBe('GRANTED');
    expect(rows[0].version).toBe(1);
  });

  it('Mode A vs Mode B: null subject → unbound v1; non-null subject continues chain', async () => {
    const actor = await loginAndFamily('mode-ab');
    const { consentId, childId } = await createGrantedAndChild(actor, 'mode-ab');

    const revoke = await revokeConsent(app, actor.token, 'mode-ab', consentId);
    expect(revoke.statusCode).toBe(200);
    expect(revoke.json().version).toBe(2);

    const reqB = await createRequest(actor.token, 'mode-ab-b', childId);
    expect(reqB.statusCode).toBe(201);
    const grantB = await grantConsent(app, actor.token, 'mode-ab-b', reqB.json().requestId);
    expect(grantB.statusCode).toBe(201);
    expect(grantB.json().version).toBe(3);
    expect(grantB.json().boundPersonId).toBe(childId);

    const { rows } = await queryDb(
      `SELECT id, decision, version, supersedes_id, bound_person_id, onboarding_request_id
       FROM consent_records WHERE family_id = $1 ORDER BY version`,
      [actor.familyId]
    );
    expect(rows.map((r: any) => r.version)).toEqual([1, 2, 3]);
    expect(rows[0].decision).toBe('GRANTED');
    expect(rows[1].decision).toBe('REVOKED');
    expect(rows[2].decision).toBe('GRANTED');
    expect(rows[1].supersedes_id).toBe(rows[0].id);
    expect(rows[2].supersedes_id).toBe(rows[1].id);
    expect(rows[2].bound_person_id).toBe(childId);
  });
});