/**
 * T915 — atomicity and failure injection (real PostgreSQL trigger failures).
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import pg from 'pg';
import { buildApp } from '../../apps/server/api/src/app.js';
import { enterSafetyHold } from '../../apps/server/api/src/safety/enter-safety-hold.js';
import { resolveRisk } from '../../apps/server/api/src/safety/resolve-risk.js';
import {
  runSafetyPrecheck,
  type ApprovedPolicyIdentity,
} from '../../packages/domain/src/safety/index.js';
import { createVerifiedTestSafetyResolutionAuthoritySource } from '../setup/safety-resolver.js';
import { createAdminPool } from '../setup/db.js';
import { createSafetyFixture, type SafetyFixture } from '../setup/safety.js';

const PREFIX = 't915_';
const INJ = 't915_inject_';

const IDENTITY: ApprovedPolicyIdentity = {
  policyRef: 'policy.t915',
  policyVersion: '1',
  ruleRef: 'rule.t915',
  ruleVersion: '1',
};

let keySeq = 0;
const nextKey = (label: string) => `t915-${label}-${Date.now()}-${keySeq++}`;

describe('T915 Safety atomicity', () => {
  let fixture: SafetyFixture;
  let admin: pg.Pool;
  let owner: { token: string; accountId: string; personId: string };
  const injected: Array<{ table: string; name: string }> = [];

  beforeAll(async () => {
    const app = await buildApp();
    await app.ready();
    admin = createAdminPool();
    fixture = createSafetyFixture({ app, admin, prefix: PREFIX });
    owner = await fixture.login('owner');
    await fixture.createFamily(owner, 'main');
  });

  afterEach(async () => {
    for (const object of injected.splice(0)) {
      await admin.query(`DROP TRIGGER IF EXISTS ${object.name} ON ${object.table}`);
      await admin.query(`DROP FUNCTION IF EXISTS ${object.name}()`);
    }
    expect(injected).toHaveLength(0);
  });

  afterAll(async () => {
    await fixture.cleanup();
    await fixture.close();
    await admin.end();
    await fixture.app.close();
  });

  async function injectOn(table: string, event: 'INSERT' | 'UPDATE', label: string) {
    const name = `${INJ}${label}`;
    await admin.query(
      `CREATE FUNCTION ${name}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'INJECTED_${label}'; END $$;`
    );
    await admin.query(
      `CREATE TRIGGER ${name} BEFORE ${event} ON ${table} FOR EACH ROW EXECUTE FUNCTION ${name}()`
    );
    injected.push({ table, name });
  }

  async function snapshot(caseId: string) {
    const row = await fixture.getCase(caseId);
    const { rows } = await admin.query<{ idem: string }>(
      `SELECT count(*)::text AS idem FROM idempotency_keys WHERE actor_account_id = $1`,
      [owner.accountId]
    );
    return {
      status: row.status,
      version: row.version,
      phase: row.phase,
      riskEvents: await fixture.countRiskEvents(caseId),
      caseEvents: await fixture.countCaseEvents(caseId),
      auditEvents: await fixture.countAuditEvents(caseId),
      idempotencyRows: Number(rows[0]!.idem),
    };
  }

  function enter(caseId: string, version: number, key: string) {
    const decision = runSafetyPrecheck({
      case: { caseId, status: 'OPEN', version },
      trustedPolicyIdentity: IDENTITY,
      approvedEvaluation: {
        outcome: 'HOLD_REQUIRED',
        ...IDENTITY,
        riskCategoryRef: 'CATEGORY_T915',
        evidenceRefs: [],
      },
    });
    return enterSafetyHold(fixture.pool, {
      accountId: owner.accountId,
      personId: owner.personId,
      caseId,
      idempotencyKey: key,
      expectedCaseVersion: version,
      decision,
      trustedPolicyIdentity: IDENTITY,
    });
  }

  it('Scenario A: Case updated, Risk Event insert fails -> full rollback', async () => {
    const created = await fixture.createCase(owner);
    const before = await snapshot(created.id);
    await injectOn('risk_events', 'INSERT', 'a');
    await expect(enter(created.id, before.version, nextKey('a'))).rejects.toBeTruthy();
    expect(await snapshot(created.id)).toEqual(before);
  });

  it('Scenario B: Risk Event inserted, Business Audit fails -> full rollback', async () => {
    const created = await fixture.createCase(owner);
    const before = await snapshot(created.id);
    await injectOn('business_audit_events', 'INSERT', 'b');
    await expect(enter(created.id, before.version, nextKey('b'))).rejects.toBeTruthy();
    expect(await snapshot(created.id)).toEqual(before);
  });

  it('Case Event insert failure rolls the whole command back', async () => {
    const created = await fixture.createCase(owner);
    const before = await snapshot(created.id);
    await injectOn('case_events', 'INSERT', 'c');
    await expect(enter(created.id, before.version, nextKey('c'))).rejects.toBeTruthy();
    expect(await snapshot(created.id)).toEqual(before);
  });

  it('idempotency completion failure rolls the whole command back', async () => {
    const created = await fixture.createCase(owner);
    const before = await snapshot(created.id);
    await injectOn('idempotency_keys', 'UPDATE', 'd');
    await expect(enter(created.id, before.version, nextKey('d'))).rejects.toBeTruthy();
    expect(await snapshot(created.id)).toEqual(before);
  });

  it('ResolveRisk trace failure keeps the Case held and rolls back', async () => {
    const created = await fixture.createCase(owner);
    const open = await fixture.getCase(created.id);
    await enter(created.id, open.version, nextKey('enter'));
    const held = await fixture.getCase(created.id);

    const message = await fixture.app.inject({
      method: 'POST',
      url: `/api/v1/cases/${created.id}/messages`,
      headers: { authorization: `Bearer ${owner.token}`, 'idempotency-key': nextKey('msg') },
      payload: { content: 'failure injection evidence' },
    });
    expect(message.statusCode).toBe(201);
    const before = await snapshot(created.id);

    await injectOn('risk_events', 'INSERT', 'e');
    await expect(
      resolveRisk(fixture.pool, {
        accountId: owner.accountId,
        personId: owner.personId,
        caseId: created.id,
        idempotencyKey: nextKey('resolve-fail'),
        expectedCaseVersion: held.version,
        reviewEvidenceRefs: [{ kind: 'MESSAGE', ref: message.json().id }],
        authoritySource: createVerifiedTestSafetyResolutionAuthoritySource(),
      })
    ).rejects.toBeTruthy();

    const after = await snapshot(created.id);
    expect(after).toEqual(before);
    expect(after.status).toBe('SAFETY_HOLD');
  });
});