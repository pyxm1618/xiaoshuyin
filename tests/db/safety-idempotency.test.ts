/**
 * T911 — Safety commands reuse the ONE idempotency system.
 *
 * Proves: the two command types are registered in the single vocabulary used by
 * both the domain constant and the database CHECK; there is no second
 * idempotency store; an incomplete/poisoned slot fails safely with zero
 * business writes; and each command key owns exactly one row.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import { buildApp } from '../../apps/server/api/src/app.js';
import { enterSafetyHold } from '../../apps/server/api/src/safety/enter-safety-hold.js';
import {
  caseIdempotencyKeyBytes,
  hashPayload,
  IDEMPOTENCY_COMMAND_TYPES,
  runSafetyPrecheck,
  type ApprovedPolicyIdentity,
} from '../../packages/domain/src/index.js';
import { createAdminPool } from '../setup/db.js';
import { createSafetyFixture, type SafetyFixture } from '../setup/safety.js';

const PREFIX = 't911_';

const IDENTITY: ApprovedPolicyIdentity = {
  policyRef: 'policy.t911',
  policyVersion: '1',
  ruleRef: 'rule.t911',
  ruleVersion: '1',
};

describe('T911 Safety idempotency', () => {
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

  it('registers exactly the two Safety commands in the single vocabulary', async () => {
    expect(IDEMPOTENCY_COMMAND_TYPES).toContain('CASE_ENTER_SAFETY_HOLD');
    expect(IDEMPOTENCY_COMMAND_TYPES).toContain('CASE_RESOLVE_RISK');

    const { rows } = await admin.query<{ definition: string }>(
      `SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint
        WHERE conname = 'idempotency_keys_command_type_check'`
    );
    const definition = rows[0]!.definition;
    expect(definition).toContain('CASE_ENTER_SAFETY_HOLD');
    expect(definition).toContain('CASE_RESOLVE_RISK');

    // Every domain literal must be admitted by the database CHECK.
    for (const command of IDEMPOTENCY_COMMAND_TYPES) {
      expect(definition).toContain(`'${command}'`);
    }
  });

  it('has no second idempotency store', async () => {
    const { rows } = await admin.query<{ tablename: string }>(
      `SELECT tablename FROM pg_tables
        WHERE schemaname = 'public' AND tablename ILIKE '%idempotenc%'`
    );
    expect(rows.map((row) => row.tablename)).toEqual(['idempotency_keys']);
  });

  it('fails safely on an incomplete (poisoned) slot with zero business writes', async () => {
    const created = await fixture.createCase(owner);
    const before = await fixture.getCase(created.id);
    const key = `t911-poison-${Date.now()}`;
    const keyBytes = caseIdempotencyKeyBytes(key);
    const requestHash = hashPayload({
      familyId,
      caseId: created.id,
      expectedCaseVersion: before.version,
      decisionKind: 'ENTER_HOLD',
      identity: IDENTITY,
      riskCategoryRef: 'CATEGORY_T911',
      evidenceRefs: [],
    });

    // A crashed command left the placeholder row (response_status = 0).
    await admin.query(
      `INSERT INTO idempotency_keys
         (actor_account_id, command_type, idempotency_key, idempotency_key_bytes,
          request_hash, response_status, response_body)
       VALUES ($1, 'CASE_ENTER_SAFETY_HOLD', NULL, $2, $3, 0, '{}'::jsonb)`,
      [owner.accountId, keyBytes, requestHash]
    );

    const decision = runSafetyPrecheck({
      case: { caseId: created.id, status: before.status as never, version: before.version },
      trustedPolicyIdentity: IDENTITY,
      approvedEvaluation: {
        outcome: 'HOLD_REQUIRED',
        ...IDENTITY,
        riskCategoryRef: 'CATEGORY_T911',
        evidenceRefs: [],
      },
    });

    await expect(
      enterSafetyHold(fixture.pool, {
        accountId: owner.accountId,
        personId: owner.personId,
        caseId: created.id,
        idempotencyKey: key,
        expectedCaseVersion: before.version,
        decision,
        trustedPolicyIdentity: IDENTITY,
      })
    ).rejects.toMatchObject({ code: 'INTERNAL_ERROR' });

    const after = await fixture.getCase(created.id);
    expect(after.status).toBe('OPEN');
    expect(after.version).toBe(before.version);
    expect(await fixture.countRiskEvents(created.id)).toBe(0);
  });

  it('owns exactly one row per successful command key', async () => {
    const created = await fixture.createCase(owner);
    const before = await fixture.getCase(created.id);
    const key = `t911-unique-${Date.now()}`;
    const decision = runSafetyPrecheck({
      case: { caseId: created.id, status: before.status as never, version: before.version },
      trustedPolicyIdentity: IDENTITY,
      approvedEvaluation: {
        outcome: 'HOLD_REQUIRED',
        ...IDENTITY,
        riskCategoryRef: 'CATEGORY_T911',
        evidenceRefs: [],
      },
    });

    const input = {
      accountId: owner.accountId,
      personId: owner.personId,
      caseId: created.id,
      idempotencyKey: key,
      expectedCaseVersion: before.version,
      decision,
      trustedPolicyIdentity: IDENTITY,
    } as const;
    await enterSafetyHold(fixture.pool, input);
    await enterSafetyHold(fixture.pool, input);

    const { rows } = await admin.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM idempotency_keys
        WHERE actor_account_id = $1 AND command_type = 'CASE_ENTER_SAFETY_HOLD' AND idempotency_key_bytes = $2`,
      [owner.accountId, caseIdempotencyKeyBytes(key)]
    );
    expect(rows[0]!.count).toBe('1');
  });
});