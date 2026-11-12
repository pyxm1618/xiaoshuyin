/**
 * T1006 / T1007 / T1009 / T1010 — Integration over the authoritative Drizzle
 * same-client RLS transaction seam.
 *
 * Proves: current-effective policy evaluation, exact provenance, active-only
 * runtime visibility, cross-family isolation, infrastructure-failure
 * propagation, evaluation/supersession snapshot semantics and independent
 * Safety/Compliance gate precedence (Frozen Scenarios 13 and 15).
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { buildApp } from '../../apps/server/api/src/app.js';
import { withDrizzleRlsTransaction } from '../../apps/server/api/src/db/drizzle-tx.js';
import { createAdminPool } from '../setup/db.js';
import { createSafetyFixture, type SafetyFixture } from '../setup/safety.js';
import {
  assertOrdinaryProgressionAllowedRaw,
  decideOrdinaryProgression,
} from '@xiaoshuyin/domain';
import {
  createServerFeatureDescriptor,
  evaluateComplianceAtTransactionTime,
  loadCompliancePersonSnapshot,
  type ComplianceFeatureDescriptor,
  type ComplianceObligation,
} from '@xiaoshuyin/compliance';

const PREFIX = `S10INT_${Date.now()}_`;
const SUPPORTED: readonly ComplianceObligation[] = [
  'REQUIRE_GUARDIAN_CONSENT',
  'REQUIRE_SEPARATE_CONSENT',
  'REQUIRE_MINOR_MODE',
  'REQUIRE_AI_DISCLOSURE',
  'REQUIRE_GENERATED_CONTENT_LABEL',
  'REQUIRE_USAGE_REMINDER',
  'REQUIRE_REGULATORY_EVIDENCE',
];

function featureCode(suffix: string): string {
  return `${PREFIX}${suffix}`.toUpperCase().replace(/[^A-Z0-9_]/g, '_').slice(0, 120);
}

describe('compliance feature policy integration', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let admin: pg.Pool;
  let pool: pg.Pool;
  let fixture: SafetyFixture;
  let owner: { token: string; accountId: string; personId: string };
  let other: { token: string; accountId: string; personId: string };
  let familyId: string;
  let otherFamilyId: string;
  let migrator: pg.Client;

  function descriptor(code: string): ComplianceFeatureDescriptor {
    return createServerFeatureDescriptor({
      featureCode: code,
      featureContractRevision: 'v1',
      capabilityLabel: 'Integration capability',
    });
  }

  async function publish(
    code: string,
    input: {
      expectedVersion: number | null;
      version: number;
      effectiveFrom: Date;
      applicability?: 'REQUIRED' | 'NOT_APPLICABLE' | 'UNKNOWN';
    }
  ): Promise<string> {
    const applicability = input.applicability ?? 'NOT_APPLICABLE';
    const result = await migrator.query<{ id: string }>(
      `SELECT app.publish_compliance_feature_policy(
         $1,'v1',$2,$3,$4,'BASELINE',$5,'BASELINE',$5,$6,$7,$8,'migration:integration'
       ) AS id`,
      [
        code,
        input.expectedVersion,
        input.version,
        applicability,
        applicability === 'REQUIRED' ? 'REQUIRED' : 'BASELINE',
        applicability === 'UNKNOWN' ? null : 'reviewed basis',
        applicability === 'UNKNOWN' ? null : 'evidence://integration',
        input.effectiveFrom,
      ]
    );
    return result.rows[0]!.id;
  }

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
    admin = createAdminPool();
    fixture = createSafetyFixture({ app, admin, prefix: PREFIX });
    owner = await fixture.login('owner');
    other = await fixture.login('other');
    familyId = await fixture.createFamily(owner, 'main');
    otherFamilyId = await fixture.createFamily(other, 'other');

    // The creator already has a server-side profile; keep the fixture idempotent
    // if a future change stops creating it automatically.
    await admin.query(
      `INSERT INTO person_compliance_profiles (person_id, age_band, minor_mode, verified_source)
       VALUES ($1, 'ADULT', false, 'SELF_STATEMENT')
       ON CONFLICT (person_id) DO NOTHING`,
      [owner.personId]
    );

    pool = new pg.Pool({ connectionString: process.env['DATABASE_URL'], max: 3 });
    migrator = new pg.Client({ connectionString: process.env['MIGRATION_DATABASE_URL'] });
    await migrator.connect();
  }, 120_000);

  afterAll(async () => {
    await admin
      ?.query(`DELETE FROM compliance_feature_policies WHERE feature_code LIKE '${PREFIX}%'`)
      .catch(() => undefined);
    await migrator?.end().catch(() => undefined);
    await fixture?.cleanup();
    await fixture?.close();
    await pool?.end().catch(() => undefined);
    await admin?.end().catch(() => undefined);
    await app?.close();
  }, 120_000);

  it('evaluates the current policy inside the shared client with exact provenance (SC-15)', async () => {
    const code = featureCode('CURRENT');
    const policyId = await publish(code, {
      expectedVersion: null,
      version: 1,
      effectiveFrom: new Date(Date.now() - 60_000),
    });

    const result = await withDrizzleRlsTransaction(
      pool,
      {
        familyId,
        accountId: owner.accountId,
        personId: owner.personId,
        purpose: 'COMPLIANCE_EVALUATION',
      },
      async (tx, client) =>
        evaluateComplianceAtTransactionTime(tx, client, {
          descriptor: descriptor(code),
          personId: owner.personId,
          supportedObligations: SUPPORTED,
        })
    );

    expect(result.gate).toBe('ALLOW');
    expect(result.policyId).toBe(policyId);
    expect(result.policyVersion).toBe(1);
    expect(result.featureCode).toBe(code);
    expect(result.featureContractRevision).toBe('v1');
    expect(result.applicability).toBe('NOT_APPLICABLE');
    expect(result.evaluatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('runtime sees only the currently effective row; future-only fails closed', async () => {
    const code = featureCode('FUTURE');
    await publish(code, {
      expectedVersion: null,
      version: 1,
      effectiveFrom: new Date(Date.now() + 86_400_000),
    });

    const result = await withDrizzleRlsTransaction(
      pool,
      {
        familyId,
        accountId: owner.accountId,
        personId: owner.personId,
        purpose: 'COMPLIANCE_EVALUATION',
      },
      async (tx, client) => {
        const visible = await client.query(
          `SELECT count(*)::int AS n FROM compliance_feature_policies WHERE feature_code = $1`,
          [code]
        );
        expect(visible.rows[0]).toEqual({ n: 0 });

        return evaluateComplianceAtTransactionTime(tx, client, {
          descriptor: descriptor(code),
          personId: null,
          supportedObligations: SUPPORTED,
        });
      }
    );

    expect(result.gate).toBe('BLOCK');
    expect(result.reasonCode).toBe('COMPLIANCE_POLICY_MISSING');
    expect(result.policyId).toBeNull();
  });

  it('cross-family Person facts stay invisible and do not become an enumeration oracle', async () => {
    const code = featureCode('X_FAMILY');
    await publish(code, {
      expectedVersion: null,
      version: 1,
      effectiveFrom: new Date(Date.now() - 60_000),
    });

    const result = await withDrizzleRlsTransaction(
      pool,
      {
        familyId,
        accountId: owner.accountId,
        personId: owner.personId,
        purpose: 'COMPLIANCE_EVALUATION',
      },
      async (tx, client) => {
        const otherProfile = await loadCompliancePersonSnapshot(client, other.personId);
        expect(otherProfile).toBeNull();

        return evaluateComplianceAtTransactionTime(tx, client, {
          descriptor: descriptor(code),
          personId: other.personId,
          supportedObligations: SUPPORTED,
        });
      }
    );

    // The cross-family Person is indistinguishable from a missing profile.
    expect(result.gate).toBe('BLOCK');
    expect(result.reasonCode).toBe('COMPLIANCE_PROFILE_MISSING');
    expect(otherFamilyId).not.toBe(familyId);
  });

  it('infrastructure / database failure propagates instead of becoming a business denial', async () => {
    const boom = Object.assign(new Error('INJECTED_DB_FAILURE'), { code: '08006' });
    const failingExecutor = {
      execute: async (): Promise<{ rows: readonly unknown[] }> => {
        throw boom;
      },
    };

    await expect(
      withDrizzleRlsTransaction(
        pool,
        {
          familyId,
          accountId: owner.accountId,
          personId: owner.personId,
          purpose: 'COMPLIANCE_EVALUATION',
        },
        async (_tx, client) =>
          evaluateComplianceAtTransactionTime(failingExecutor, client, {
            descriptor: descriptor(featureCode('FAILURE')),
            personId: owner.personId,
            supportedObligations: SUPPORTED,
          })
      )
    ).rejects.toThrow('INJECTED_DB_FAILURE');
  });

  it('policy supersession after the snapshot does not mutate returned provenance (SC-14)', async () => {
    const code = featureCode('SUPERSEDE_SNAPSHOT');
    await publish(code, {
      expectedVersion: null,
      version: 1,
      effectiveFrom: new Date(Date.now() - 120_000),
    });

    const firstResult = await withDrizzleRlsTransaction(
      pool,
      {
        familyId,
        accountId: owner.accountId,
        personId: owner.personId,
        purpose: 'COMPLIANCE_EVALUATION',
      },
      async (tx, client) => {
        const evaluated = await evaluateComplianceAtTransactionTime(tx, client, {
          descriptor: descriptor(code),
          personId: owner.personId,
          supportedObligations: SUPPORTED,
        });
        // A concurrent reviewed publication happens after the result was read.
        await publish(code, {
          expectedVersion: 1,
          version: 2,
          effectiveFrom: new Date(),
        });
        return evaluated;
      }
    );

    expect(firstResult.policyVersion).toBe(1);

    const secondResult = await withDrizzleRlsTransaction(
      pool,
      {
        familyId,
        accountId: owner.accountId,
        personId: owner.personId,
        purpose: 'COMPLIANCE_EVALUATION',
      },
      async (tx, client) =>
        evaluateComplianceAtTransactionTime(tx, client, {
          descriptor: descriptor(code),
          personId: owner.personId,
          supportedObligations: SUPPORTED,
        })
    );
    expect(secondResult.policyVersion).toBe(2);
    expect(firstResult.policyVersion).toBe(1);
  });

  it('SC-13: Compliance ALLOW is possible while held, but Safety still blocks ordinary progression', async () => {
    const code = featureCode('SAFETY');
    await publish(code, {
      expectedVersion: null,
      version: 1,
      effectiveFrom: new Date(Date.now() - 60_000),
    });
    const safetyCase = await fixture.createCase(owner);
    await fixture.setCaseStatus(safetyCase.id, 'SAFETY_HOLD');

    const result = await withDrizzleRlsTransaction(
      pool,
      {
        familyId,
        accountId: owner.accountId,
        personId: owner.personId,
        purpose: 'COMPLIANCE_EVALUATION',
      },
      async (tx, client) => {
        const evaluated = await evaluateComplianceAtTransactionTime(tx, client, {
          descriptor: descriptor(code),
          personId: owner.personId,
          supportedObligations: SUPPORTED,
        });
        expect(evaluated.gate).toBe('ALLOW');

        await expect(
          assertOrdinaryProgressionAllowedRaw(client, { caseId: safetyCase.id })
        ).rejects.toMatchObject({ code: 'SAFETY_HOLD_BLOCKED' });

        return evaluated;
      }
    );

    expect(result.gate).toBe('ALLOW');
    expect(decideOrdinaryProgression('SAFETY_HOLD')).toEqual({
      allowed: false,
      code: 'SAFETY_HOLD_BLOCKED',
    });
    // A Compliance BLOCK is independent of Safety: an allowed Safety state
    // never converts UNKNOWN compliance into ALLOW.
    expect(decideOrdinaryProgression('OPEN')).toEqual({ allowed: true });
  });
});