/**
 * T906 — real authorization adapter paths for the two Safety actions.
 *
 * Proves through the real `authorize()` adapter (`requireFamilyAction`) that:
 *   - Enter needs Family/Case access only (resolver capability is irrelevant);
 *   - Resolve denies without a separately verified capability fact;
 *   - a controlled verified fact can allow the same actor;
 *   - an unknown infrastructure error is NOT collapsed into a business denial.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import { buildApp } from '../../apps/server/api/src/app.js';
import { withRlsTransaction } from '../../apps/server/api/src/db/tx.js';
import {
  denyToError,
  isKnownAuthorizationDenial,
  requireFamilyAction,
} from '../../apps/server/api/src/authz.js';
import { toHttpError } from '../../apps/server/api/src/plugins/error-handler.js';
import { createAdminPool } from '../setup/db.js';
import { createSafetyFixture, type SafetyFixture } from '../setup/safety.js';

const PREFIX = 't906_';

describe('T906 Safety authorization fail-closed composition', () => {
  let fixture: SafetyFixture;
  let admin: pg.Pool;
  let owner: { token: string; accountId: string; personId: string };
  let member: { token: string; accountId: string; personId: string };
  let familyId: string;
  let caseId: string;

  beforeAll(async () => {
    const app = await buildApp();
    await app.ready();
    admin = createAdminPool();
    fixture = createSafetyFixture({ app, admin, prefix: PREFIX });

    owner = await fixture.login('owner');
    member = await fixture.login('member');
    familyId = await fixture.createFamily(owner, 'main');
    caseId = (await fixture.createCase(owner)).id;

  });

  afterAll(async () => {
    await fixture.cleanup();
    await fixture.close();
    await admin.end();
    await fixture.app.close();
  });

  const rls = (actor: { accountId: string; personId: string }) => ({
    familyId,
    accountId: actor.accountId,
    personId: actor.personId,
    purpose: 'FAMILY_MANAGEMENT',
  });

  const request = (
    actor: { accountId: string; personId: string },
    action: 'CASE_ENTER_SAFETY_HOLD' | 'CASE_RESOLVE_RISK',
    safetyResolution?: { verified: boolean; authorityRef: string } | null
  ) => ({
    accountId: actor.accountId,
    personId: actor.personId,
    familyId,
    action,
    purpose: 'FAMILY_MANAGEMENT' as const,
    resource: { type: 'CASE' as const, familyId, caseId },
    caseId,
    ...(safetyResolution === undefined ? {} : { safetyResolution }),
  });

  it('allows Enter for the manager without any resolver capability', async () => {
    const decision = await withRlsTransaction(fixture.pool, rls(owner), (tx) =>
      requireFamilyAction(tx, request(owner, 'CASE_ENTER_SAFETY_HOLD'))
    );
    expect(decision.decision).toBe('ALLOW');
  });

  it('denies Resolve without a verified capability fact', async () => {
    await expect(
      withRlsTransaction(fixture.pool, rls(owner), (tx) =>
        requireFamilyAction(tx, request(owner, 'CASE_RESOLVE_RISK', null))
      )
    ).rejects.toMatchObject({ code: 'SAFETY_RESOLUTION_AUTHORITY_DENIED', statusCode: 403 });
  });

  it('denies Resolve for an actor outside the Family (RLS + authorization fail closed)', async () => {
    // `member` is an authenticated account of a DIFFERENT Family. Establishing
    // the owner's Family context cannot succeed, and no capability fact exists.
    await expect(
      withRlsTransaction(fixture.pool, rls(member), (tx) =>
        requireFamilyAction(tx, request(member, 'CASE_RESOLVE_RISK', null))
      )
    ).rejects.toBeTruthy();
  });

  it('allows Resolve only when the verified capability fact is present', async () => {
    const decision = await withRlsTransaction(fixture.pool, rls(owner), (tx) =>
      requireFamilyAction(
        tx,
        request(owner, 'CASE_RESOLVE_RISK', {
          verified: true,
          authorityRef: 'test-verified-authority',
        })
      )
    );
    expect(decision.decision).toBe('ALLOW');
    if (decision.decision === 'ALLOW') {
      expect(decision.basis.authority).toBe('SAFETY_RESOLVER');
    }
  });

  it('keeps unknown infrastructure failures out of the authorization-denial class', () => {
    // A route collapses only known denials into the anti-enumeration 404; an
    // unexpected database error must propagate to the generic 500 path.
    const infrastructure = Object.assign(new Error('canceling statement due to statement timeout'), {
      code: '57014',
    });
    expect(isKnownAuthorizationDenial(infrastructure)).toBe(false);

    const denial = denyToError('NOT_SAFETY_RESOLVER');
    expect(isKnownAuthorizationDenial(denial)).toBe(true);
    expect(denial.code).toBe('SAFETY_RESOLUTION_AUTHORITY_DENIED');
  });

  it('maps the Safety error vocabulary to non-5xx contracts', () => {
    const expected: Record<string, number> = {
      SAFETY_HOLD_ALREADY_ACTIVE: 409,
      STALE_CASE_VERSION: 409,
      SAFETY_PRECHECK_STALE: 409,
      SAFETY_PRECHECK_INVALID: 422,
      SAFETY_REVIEW_EVIDENCE_INVALID: 422,
      SAFETY_RESOLUTION_AUTHORITY_DENIED: 403,
      SAFETY_RESOLUTION_AUTHORITY_UNAVAILABLE: 403,
      SAFETY_HOLD_REQUIRED: 409,
      CASE_CLOSED: 409,
      SAFETY_HOLD_BLOCKED: 409,
    };
    for (const [code, status] of Object.entries(expected)) {
      expect(toHttpError(code).statusCode, code).toBe(status);
    }
  });
});