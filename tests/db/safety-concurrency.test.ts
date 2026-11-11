/**
 * T916 — concurrency and stale-decision suite (real concurrent transactions).
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import { buildApp } from '../../apps/server/api/src/app.js';
import { enterSafetyHold } from '../../apps/server/api/src/safety/enter-safety-hold.js';
import { resolveRisk } from '../../apps/server/api/src/safety/resolve-risk.js';
import {
  runSafetyPrecheck,
  type ApprovedPolicyIdentity,
  type SafetyPrecheckDecision,
} from '../../packages/domain/src/safety/index.js';
import { createVerifiedTestSafetyResolutionAuthoritySource } from '../setup/safety-resolver.js';
import { createAdminPool } from '../setup/db.js';
import { createSafetyFixture, type SafetyFixture } from '../setup/safety.js';

const PREFIX = 't916_';

const IDENTITY: ApprovedPolicyIdentity = {
  policyRef: 'policy.t916',
  policyVersion: '1',
  ruleRef: 'rule.t916',
  ruleVersion: '1',
};

let keySeq = 0;
const nextKey = (label: string) => `t916-${label}-${Date.now()}-${keySeq++}`;

describe('T916 Safety concurrency', () => {
  let fixture: SafetyFixture;
  let admin: pg.Pool;
  let owner: { token: string; accountId: string; personId: string };

  beforeAll(async () => {
    const app = await buildApp();
    await app.ready();
    admin = createAdminPool();
    fixture = createSafetyFixture({ app, admin, prefix: PREFIX });
    owner = await fixture.login('owner');
    await fixture.createFamily(owner, 'main');
  });

  afterAll(async () => {
    await fixture.cleanup();
    await fixture.close();
    await admin.end();
    await fixture.app.close();
  });

  function decision(caseId: string, version: number): SafetyPrecheckDecision {
    return runSafetyPrecheck({
      case: { caseId, status: 'OPEN', version },
      trustedPolicyIdentity: IDENTITY,
      approvedEvaluation: {
        outcome: 'HOLD_REQUIRED',
        ...IDENTITY,
        riskCategoryRef: 'CATEGORY_T916',
        evidenceRefs: [],
      },
    });
  }

  function enter(caseId: string, version: number, key: string) {
    return enterSafetyHold(fixture.pool, {
      accountId: owner.accountId,
      personId: owner.personId,
      caseId,
      idempotencyKey: key,
      expectedCaseVersion: version,
      decision: decision(caseId, version),
      trustedPolicyIdentity: IDENTITY,
    });
  }

  it('two concurrent Enter commands produce exactly one transition', async () => {
    const created = await fixture.createCase(owner);
    const before = await fixture.getCase(created.id);

    const results = await Promise.allSettled([
      enter(created.id, before.version, nextKey('race-a')),
      enter(created.id, before.version, nextKey('race-b')),
    ]);

    const fulfilled = results.filter((result) => result.status === 'fulfilled');
    expect(fulfilled).toHaveLength(1);

    const after = await fixture.getCase(created.id);
    expect(after.status).toBe('SAFETY_HOLD');
    expect(after.version).toBe(before.version + 1);

    const { rows } = await admin.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM risk_events WHERE case_id = $1 AND event_kind = 'HOLD_ENTERED'`,
      [created.id]
    );
    expect(rows[0]!.count).toBe('1');
  });

  it('concurrent same-key Enter executes once and replays', async () => {
    const created = await fixture.createCase(owner);
    const before = await fixture.getCase(created.id);
    const key = nextKey('same');

    const results = await Promise.allSettled([
      enter(created.id, before.version, key),
      enter(created.id, before.version, key),
    ]);

    for (const result of results) {
      expect(result.status).toBe('fulfilled');
    }
    const bodies = results.map((result) =>
      result.status === 'fulfilled' ? result.value.body : null
    );
    // Replay must return the SAME stored result, not a second transition.
    expect(bodies[0]).toEqual(bodies[1]);

    expect((await fixture.getCase(created.id)).version).toBe(before.version + 1);
    const { rows } = await admin.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM risk_events WHERE case_id = $1`,
      [created.id]
    );
    expect(rows[0]!.count).toBe('1');
  });

  it('two concurrent Resolve commands produce exactly one transition', async () => {
    const created = await fixture.createCase(owner);
    const open = await fixture.getCase(created.id);
    await enter(created.id, open.version, nextKey('enter'));
    const held = await fixture.getCase(created.id);

    const message = await fixture.app.inject({
      method: 'POST',
      url: `/api/v1/cases/${created.id}/messages`,
      headers: { authorization: `Bearer ${owner.token}`, 'idempotency-key': nextKey('msg') },
      payload: { content: 'concurrency evidence' },
    });
    expect(message.statusCode).toBe(201);
    const refs = [{ kind: 'MESSAGE', ref: message.json().id }];

    const resolve = (key: string) =>
      resolveRisk(fixture.pool, {
        accountId: owner.accountId,
        personId: owner.personId,
        caseId: created.id,
        idempotencyKey: key,
        expectedCaseVersion: held.version,
        reviewEvidenceRefs: refs,
        authoritySource: createVerifiedTestSafetyResolutionAuthoritySource(),
      });

    const results = await Promise.allSettled([
      resolve(nextKey('res-a')),
      resolve(nextKey('res-b')),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);

    const after = await fixture.getCase(created.id);
    expect(after.status).toBe('WAITING');
    expect(after.version).toBe(held.version + 1);

    const { rows } = await admin.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM risk_events WHERE case_id = $1 AND event_kind = 'RISK_RESOLVED'`,
      [created.id]
    );
    expect(rows[0]!.count).toBe('1');
  });

  it('concurrent same-key Resolve executes once and replays', async () => {
    const created = await fixture.createCase(owner);
    const open = await fixture.getCase(created.id);
    await enter(created.id, open.version, nextKey('enter2'));
    const held = await fixture.getCase(created.id);

    const message = await fixture.app.inject({
      method: 'POST',
      url: `/api/v1/cases/${created.id}/messages`,
      headers: { authorization: `Bearer ${owner.token}`, 'idempotency-key': nextKey('msg2') },
      payload: { content: 'same key evidence' },
    });
    const refs = [{ kind: 'MESSAGE', ref: message.json().id }];
    const key = nextKey('res-same');

    const resolve = () =>
      resolveRisk(fixture.pool, {
        accountId: owner.accountId,
        personId: owner.personId,
        caseId: created.id,
        idempotencyKey: key,
        expectedCaseVersion: held.version,
        reviewEvidenceRefs: refs,
        authoritySource: createVerifiedTestSafetyResolutionAuthoritySource(),
      });

    const results = await Promise.allSettled([resolve(), resolve()]);
    for (const result of results) expect(result.status).toBe('fulfilled');
    const bodies = results.map((result) =>
      result.status === 'fulfilled' ? result.value.body : null
    );
    expect(bodies[0]).toEqual(bodies[1]);
    expect((await fixture.getCase(created.id)).version).toBe(held.version + 1);
  });

  it('rejects a decision made for a revision the Case has already left', async () => {
    const created = await fixture.createCase(owner);
    const before = await fixture.getCase(created.id);
    const stale = decision(created.id, before.version);

    // A concurrent legal mutation wins first and advances the revision.
    await admin.query('UPDATE cases SET version = version + 1 WHERE id = $1', [created.id]);

    await expect(
      enterSafetyHold(fixture.pool, {
        accountId: owner.accountId,
        personId: owner.personId,
        caseId: created.id,
        idempotencyKey: nextKey('stale'),
        expectedCaseVersion: before.version,
        decision: stale,
        trustedPolicyIdentity: IDENTITY,
      })
    ).rejects.toMatchObject({ code: 'SAFETY_PRECHECK_STALE' });

    expect((await fixture.getCase(created.id)).status).toBe('OPEN');
  });

  it('rejects a stale policy identity instead of applying it blindly', async () => {
    const created = await fixture.createCase(owner);
    const before = await fixture.getCase(created.id);
    const staleDecision = runSafetyPrecheck({
      case: { caseId: created.id, status: 'OPEN', version: before.version },
      trustedPolicyIdentity: { ...IDENTITY },
      approvedEvaluation: {
        outcome: 'HOLD_REQUIRED',
        ...IDENTITY,
        riskCategoryRef: 'CATEGORY_T916',
        evidenceRefs: [],
      },
    });

    await expect(
      enterSafetyHold(fixture.pool, {
        accountId: owner.accountId,
        personId: owner.personId,
        caseId: created.id,
        idempotencyKey: nextKey('policy'),
        expectedCaseVersion: before.version,
        decision: staleDecision,
        trustedPolicyIdentity: { ...IDENTITY, ruleVersion: '2' },
      })
    ).rejects.toMatchObject({ code: 'SAFETY_PRECHECK_STALE' });

    expect((await fixture.getCase(created.id)).status).toBe('OPEN');
  });
});