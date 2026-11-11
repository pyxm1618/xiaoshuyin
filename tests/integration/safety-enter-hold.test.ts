/**
 * T907 — `EnterSafetyHold` internal Domain Command.
 *
 * Real service composition: authorization, RLS transaction, idempotency,
 * Family/Case locking, Case transition, Risk Event, Case Event, Business Audit.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import { buildApp } from '../../apps/server/api/src/app.js';
import { enterSafetyHold } from '../../apps/server/api/src/safety/enter-safety-hold.js';
import {
  runSafetyPrecheck,
  type ApprovedPolicyIdentity,
  type SafetyPrecheckDecision,
} from '../../packages/domain/src/safety/index.js';
import { createAdminPool } from '../setup/db.js';
import { createSafetyFixture, type SafetyFixture } from '../setup/safety.js';

const PREFIX = 't907_';

const IDENTITY: ApprovedPolicyIdentity = {
  policyRef: 'policy.t907',
  policyVersion: '1',
  ruleRef: 'rule.t907',
  ruleVersion: '1',
};

function holdDecision(caseId: string, version: number, identity = IDENTITY): SafetyPrecheckDecision {
  return runSafetyPrecheck({
    case: { caseId, status: 'OPEN', version },
    trustedPolicyIdentity: identity,
    approvedEvaluation: {
      outcome: 'HOLD_REQUIRED',
      ...identity,
      riskCategoryRef: 'CATEGORY_T907',
      evidenceRefs: [{ kind: 'EVIDENCE', ref: 'ref-t907' }],
    },
  });
}

let keySeq = 0;
const nextKey = (label: string) => `t907-${label}-${Date.now()}-${keySeq++}`;

describe('T907 EnterSafetyHold', () => {
  let fixture: SafetyFixture;
  let admin: pg.Pool;
  let owner: { token: string; accountId: string; personId: string };
  let familyId: string;

  beforeAll(async () => {
    const app = await buildApp();
    await app.ready();
    admin = createAdminPool();
    fixture = createSafetyFixture({ app, admin, prefix: PREFIX });
    owner = await fixture.login('owner');
    familyId = await fixture.createFamily(owner, 'main');
  });

  afterAll(async () => {
    await fixture.cleanup();
    await fixture.close();
    await admin.end();
    await fixture.app.close();
  });

  async function newCase(): Promise<{ id: string; version: number; phase: string }> {
    const created = await fixture.createCase(owner);
    return { id: created.id, version: created.version, phase: created.phase };
  }

  function enter(caseId: string, expectedCaseVersion: number, decision: SafetyPrecheckDecision, key = nextKey('enter')) {
    return enterSafetyHold(fixture.pool, {
      accountId: owner.accountId,
      personId: owner.personId,
      caseId,
      idempotencyKey: key,
      expectedCaseVersion,
      decision,
      trustedPolicyIdentity: IDENTITY,
    });
  }

  it('enters SAFETY_HOLD from OPEN preserving phase and advancing version by exactly one', async () => {
    const created = await newCase();
    const before = await fixture.getCase(created.id);
    const decision = holdDecision(created.id, before.version);

    const result = await enter(created.id, before.version, decision);
    expect(result.status).toBe(200);
    const body = result.body as Record<string, unknown>;
    expect(body).toMatchObject({
      caseId: created.id,
      status: 'SAFETY_HOLD',
      phase: before.phase,
      fromStatus: 'OPEN',
      fromVersion: before.version,
      version: before.version + 1,
    });

    const after = await fixture.getCase(created.id);
    expect(after.status).toBe('SAFETY_HOLD');
    expect(after.phase).toBe(before.phase);
    expect(after.version).toBe(before.version + 1);

    // Exactly one of each record.
    const { rows: risk } = await admin.query('SELECT * FROM risk_events WHERE case_id = $1', [created.id]);
    expect(risk).toHaveLength(1);
    expect(risk[0]).toMatchObject({
      event_kind: 'HOLD_ENTERED',
      decision_case_version: before.version,
      policy_ref: IDENTITY.policyRef,
      policy_version: IDENTITY.policyVersion,
      rule_ref: IDENTITY.ruleRef,
      rule_version: IDENTITY.ruleVersion,
      risk_category_ref: 'CATEGORY_T907',
    });

    const { rows: events } = await admin.query(
      `SELECT event_type, metadata FROM case_events WHERE case_id = $1 AND event_type = 'CASE_SAFETY_HOLD_ENTERED'`,
      [created.id]
    );
    expect(events).toHaveLength(1);
    expect(events[0].metadata).toEqual({
      fromStatus: 'OPEN',
      toStatus: 'SAFETY_HOLD',
      fromVersion: before.version,
      toVersion: before.version + 1,
      riskEventId: body.riskEventId,
    });

    const { rows: audit } = await admin.query(
      `SELECT resource_type, metadata FROM business_audit_events
        WHERE resource_id = $1 AND event_type = 'CASE_SAFETY_HOLD_ENTERED'`,
      [created.id]
    );
    expect(audit).toHaveLength(1);
    expect(audit[0].resource_type).toBe('CASE');
    expect(audit[0].metadata).toEqual({
      riskEventId: body.riskEventId,
      fromVersion: before.version,
      toVersion: before.version + 1,
    });

    const { rows: idem } = await admin.query(
      `SELECT command_type, response_status FROM idempotency_keys WHERE actor_account_id = $1 AND command_type = 'CASE_ENTER_SAFETY_HOLD'`,
      [owner.accountId]
    );
    expect(idem.length).toBeGreaterThanOrEqual(1);
    expect(idem.every((row: { response_status: number }) => row.response_status === 200)).toBe(true);
  });

  it('enters from WAITING and from LOST_CONTACT while preserving phase', async () => {
    for (const status of ['WAITING', 'LOST_CONTACT'] as const) {
      const created = await newCase();
      await fixture.setCaseStatus(created.id, status);
      const before = await fixture.getCase(created.id);
      const decision = holdDecision(created.id, before.version);

      await expect(enter(created.id, before.version, decision)).resolves.toBeTruthy();
      const after = await fixture.getCase(created.id);
      expect(after.status).toBe('SAFETY_HOLD');
      expect(after.phase).toBe(before.phase);
      expect(after.version).toBe(before.version + 1);
    }
  });

  it('refuses CLOSED with zero writes', async () => {
    const created = await newCase();
    await fixture.setCaseStatus(created.id, 'CLOSED');
    const before = await fixture.getCase(created.id);
    const decision = holdDecision(created.id, before.version);

    const riskBefore = await fixture.countRiskEvents(created.id);
    const eventsBefore = await fixture.countCaseEvents(created.id);
    const auditBefore = await fixture.countAuditEvents(created.id);

    await expect(enter(created.id, before.version, decision)).rejects.toMatchObject({
      code: 'CASE_CLOSED',
    });

    const after = await fixture.getCase(created.id);
    expect(after.status).toBe('CLOSED');
    expect(after.version).toBe(before.version);
    expect(await fixture.countRiskEvents(created.id)).toBe(riskBefore);
    expect(await fixture.countCaseEvents(created.id)).toBe(eventsBefore);
    expect(await fixture.countAuditEvents(created.id)).toBe(auditBefore);
  });

  it('refuses a second entry on an already-held Case without new trace', async () => {
    const created = await newCase();
    const before = await fixture.getCase(created.id);
    await enter(created.id, before.version, holdDecision(created.id, before.version));

    const held = await fixture.getCase(created.id);
    const riskBefore = await fixture.countRiskEvents(created.id);

    await expect(
      enter(created.id, held.version, holdDecision(created.id, held.version), nextKey('second'))
    ).rejects.toMatchObject({ code: 'SAFETY_HOLD_ALREADY_ACTIVE' });

    const after = await fixture.getCase(created.id);
    expect(after.version).toBe(held.version);
    expect(await fixture.countRiskEvents(created.id)).toBe(riskBefore);
  });

  it('replays the same key/payload without duplicating anything', async () => {
    const created = await newCase();
    const before = await fixture.getCase(created.id);
    const key = nextKey('replay');
    const decision = holdDecision(created.id, before.version);

    const first = await enter(created.id, before.version, decision, key);
    const riskAfterFirst = await fixture.countRiskEvents(created.id);
    const eventsAfterFirst = await fixture.countCaseEvents(created.id);
    const auditAfterFirst = await fixture.countAuditEvents(created.id);

    const second = await enter(created.id, before.version, decision, key);
    expect(second).toEqual(first);

    const after = await fixture.getCase(created.id);
    expect(after.version).toBe(before.version + 1);
    expect(await fixture.countRiskEvents(created.id)).toBe(riskAfterFirst);
    expect(await fixture.countCaseEvents(created.id)).toBe(eventsAfterFirst);
    expect(await fixture.countAuditEvents(created.id)).toBe(auditAfterFirst);
  });

  it('rejects the same key with a changed payload', async () => {
    const created = await newCase();
    const before = await fixture.getCase(created.id);
    const key = nextKey('mismatch');

    await enter(created.id, before.version, holdDecision(created.id, before.version), key);

    const other = await newCase();
    const otherBefore = await fixture.getCase(other.id);

    await expect(
      enter(other.id, otherBefore.version, holdDecision(other.id, otherBefore.version), key)
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_PAYLOAD_MISMATCH' });
  });

  it('rejects a stale precheck after the Case revision moved', async () => {
    const created = await newCase();
    const before = await fixture.getCase(created.id);
    const staleDecision = holdDecision(created.id, before.version);

    // A separate legal Case mutation advances the revision to N+1.
    await admin.query('UPDATE cases SET version = version + 1 WHERE id = $1', [created.id]);
    const moved = await fixture.getCase(created.id);
    expect(moved.version).toBe(before.version + 1);

    await expect(enter(created.id, before.version, staleDecision)).rejects.toMatchObject({
      code: 'SAFETY_PRECHECK_STALE',
    });

    const after = await fixture.getCase(created.id);
    expect(after.status).toBe('OPEN');
    expect(after.version).toBe(moved.version);
  });

  it('rejects a decision produced by a superseded policy/rule identity', async () => {
    const created = await newCase();
    const before = await fixture.getCase(created.id);
    const oldIdentity: ApprovedPolicyIdentity = { ...IDENTITY, policyVersion: '0' };
    const decision = holdDecision(created.id, before.version, oldIdentity);

    await expect(enter(created.id, before.version, decision)).rejects.toMatchObject({
      code: 'SAFETY_PRECHECK_STALE',
    });
    expect((await fixture.getCase(created.id)).status).toBe('OPEN');
  });

  it('hides a Case of another Family without leaking it', async () => {
    const other = await fixture.login('other');
    const otherFamilyId = await fixture.createFamily(other, 'other');
    const otherCase = await fixture.createCase(other);
    expect(otherFamilyId).toBeTruthy();

    const before = await fixture.getCase(otherCase.id);
    const decision = holdDecision(otherCase.id, before.version);

    await expect(enter(otherCase.id, before.version, decision)).rejects.toMatchObject({
      code: 'CASE_NOT_FOUND',
    });
    expect((await fixture.getCase(otherCase.id)).status).toBe('OPEN');
  });

  it('rejects a decision that is not an ENTER_HOLD authority', async () => {
    const created = await newCase();
    const before = await fixture.getCase(created.id);
    const allow = runSafetyPrecheck({
      case: { caseId: created.id, status: 'OPEN', version: before.version },
      trustedPolicyIdentity: IDENTITY,
      approvedEvaluation: {
        outcome: 'NO_HOLD',
        ...IDENTITY,
        evidenceRefs: [],
      },
    });

    await expect(enter(created.id, before.version, allow)).rejects.toMatchObject({
      code: 'SAFETY_PRECHECK_INVALID',
    });
    expect((await fixture.getCase(created.id)).status).toBe('OPEN');
  });

  it('registers no public route for the command', async () => {
    const routes = fixture.app.printRoutes({ commonPrefix: false });
    expect(routes).not.toContain('/enter-hold');
    expect(routes).not.toContain('/safety');
    expect(routes).not.toContain('/resolve-risk');
  });
});