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

  const rls = (
    actor: { accountId: string; personId: string },
    purpose: 'FAMILY_MANAGEMENT' | 'SAFETY_RESOLUTION' = 'FAMILY_MANAGEMENT'
  ) => ({
    familyId,
    accountId: actor.accountId,
    personId: actor.personId,
    purpose,
  });

  const request = (
    actor: { accountId: string; personId: string },
    action: 'CASE_ENTER_SAFETY_HOLD' | 'CASE_RESOLVE_RISK',
    safetyResolution?: {
      verified: boolean;
      authorityRef: string;
      capability: 'SAFETY_RESOLVE';
      capabilityGrantId: string;
      assignmentId: string;
      familyId: string;
      caseId: string;
      accountId: string;
      personId: string;
    } | null
  ) => ({
    accountId: actor.accountId,
    personId: actor.personId,
    familyId,
    action,
    purpose:
      action === 'CASE_RESOLVE_RISK'
        ? ('SAFETY_RESOLUTION' as const)
        : ('FAMILY_MANAGEMENT' as const),
    resource: { type: 'CASE' as const, familyId, caseId },
    caseId,
    ...(safetyResolution === undefined ? {} : { safetyResolution }),
  });

  const verifiedResolverFact = (actor: { accountId: string; personId: string }) => ({
    verified: true,
    authorityRef: 'staff_assignment:11111111-1111-1111-1111-111111111111',
    capability: 'SAFETY_RESOLVE' as const,
    capabilityGrantId: '22222222-2222-2222-2222-222222222222',
    assignmentId: '11111111-1111-1111-1111-111111111111',
    familyId,
    caseId,
    accountId: actor.accountId,
    personId: actor.personId,
  });

  it('denies direct business request for CASE_ENTER_SAFETY_HOLD even for the manager (Finding #14)', async () => {
    await expect(
      withRlsTransaction(fixture.pool, rls(owner), (tx) =>
        requireFamilyAction(tx, request(owner, 'CASE_ENTER_SAFETY_HOLD'))
      )
    ).rejects.toMatchObject({ code: 'FORBIDDEN', statusCode: 403 });
  });

  it('denies Resolve without a verified capability fact', async () => {
    await expect(
      withRlsTransaction(fixture.pool, rls(owner, 'SAFETY_RESOLUTION'), (tx) =>
        requireFamilyAction(tx, request(owner, 'CASE_RESOLVE_RISK', null))
      )
    ).rejects.toMatchObject({ code: 'SAFETY_RESOLUTION_AUTHORITY_DENIED', statusCode: 403 });
  });

  it('denies Resolve for an actor outside the Family (RLS + authorization fail closed)', async () => {
    // `member` is an authenticated account of a DIFFERENT Family. Establishing
    // the owner's Family context cannot succeed, and no capability fact exists.
    await expect(
      withRlsTransaction(fixture.pool, rls(member, 'SAFETY_RESOLUTION'), (tx) =>
        requireFamilyAction(tx, request(member, 'CASE_RESOLVE_RISK', null))
      )
    ).rejects.toBeTruthy();
  });

  it('allows Resolve only when the verified capability fact is present', async () => {
    const decision = await withRlsTransaction(
      fixture.pool,
      rls(owner, 'SAFETY_RESOLUTION'),
      (tx) =>
        requireFamilyAction(
          tx,
          request(owner, 'CASE_RESOLVE_RISK', verifiedResolverFact(owner))
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