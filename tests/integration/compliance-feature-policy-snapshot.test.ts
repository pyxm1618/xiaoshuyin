/**
 * Audit 2 — HIGH-01: one authoritative consistent snapshot.
 *
 * These are real interleaving tests on the shared Drizzle/RLS seam. T1 opens a
 * REPEATABLE READ transaction, reads the policy, blocks; T2 commits a change;
 * T1 then continues reading Person/profile/consent facts. T1 must keep observing
 * the snapshot taken at its start, so it can never stitch facts from different
 * committed states into one decision.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { buildApp } from '../../apps/server/api/src/app.js';
import { withDrizzleRlsTransaction } from '../../apps/server/api/src/db/drizzle-tx.js';
import { createAdminPool } from '../setup/db.js';
import { createSafetyFixture, type SafetyFixture } from '../setup/safety.js';
import {
  createServerFeatureDescriptor,
  evaluateComplianceAtTransactionTime,
  getCurrentNoticeHash,
  loadCompliancePersonSnapshot,
  loadCompliancePolicySnapshot,
  type ComplianceFeatureDescriptor,
  type ComplianceObligation,
} from '@xiaoshuyin/compliance';

const PREFIX = `S10SNAP_${Date.now()}_`;
const SUPPORTED: readonly ComplianceObligation[] = [
  'REQUIRE_GUARDIAN_CONSENT',
  'REQUIRE_SEPARATE_CONSENT',
  'REQUIRE_MINOR_MODE',
  'REQUIRE_AI_DISCLOSURE',
  'REQUIRE_GENERATED_CONTENT_LABEL',
  'REQUIRE_USAGE_REMINDER',
  'REQUIRE_REGULATORY_EVIDENCE',
];

function deferred<T = void>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
} {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

function featureCode(suffix: string): string {
  return `${PREFIX}${suffix}`.toUpperCase().replace(/[^A-Z0-9_]/g, '_').slice(0, 120);
}

describe('compliance consistent snapshot (Audit 2 HIGH-01)', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let admin: pg.Pool;
  let pool: pg.Pool;
  let fixture: SafetyFixture;
  let owner: { token: string; accountId: string; personId: string };
  let familyId: string;
  let migrator: pg.Client;

  function descriptor(code: string): ComplianceFeatureDescriptor {
    return createServerFeatureDescriptor({
      featureCode: code,
      featureContractRevision: 'v1',
      capabilityLabel: 'Snapshot capability',
    });
  }

  async function publish(input: {
    code: string;
    expectedVersion: number | null;
    version: number;
    effectiveFrom: Date;
    applicability?: 'REQUIRED' | 'NOT_APPLICABLE' | 'UNKNOWN';
  }): Promise<string> {
    const applicability = input.applicability ?? 'NOT_APPLICABLE';
    const result = await migrator.query<{ id: string }>(
      `SELECT app.publish_compliance_feature_policy(
         $1,'v1',$2,$3,$4,'BASELINE','BASELINE','BASELINE','BASELINE',$5,$6,$7,'migration:snapshot'
       ) AS id`,
      [
        input.code,
        input.expectedVersion,
        input.version,
        applicability,
        applicability === 'UNKNOWN' ? null : 'reviewed basis',
        applicability === 'UNKNOWN' ? null : 'evidence://snapshot',
        input.effectiveFrom,
      ]
    );
    return result.rows[0]!.id;
  }

  function rlsOptions() {
    return {
      familyId,
      accountId: owner.accountId,
      personId: owner.personId,
      purpose: 'COMPLIANCE_EVALUATION',
      isolationLevel: 'REPEATABLE READ' as const,
    };
  }

  let under14PersonId: string | null = null;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
    admin = createAdminPool();
    fixture = createSafetyFixture({ app, admin, prefix: PREFIX });
    owner = await fixture.login('owner');
    familyId = await fixture.createFamily(owner, 'snapshot');

    await admin.query(
      `INSERT INTO person_compliance_profiles (person_id, age_band, minor_mode, verified_source)
       VALUES ($1, 'ADULT', false, 'SELF_STATEMENT')
       ON CONFLICT (person_id) DO UPDATE
         SET age_band = 'ADULT', minor_mode = false, guardian_person_id = NULL,
             guardian_consent_record_id = NULL, guardian_consent_version = NULL`,
      [owner.personId]
    );

    pool = new pg.Pool({ connectionString: process.env['DATABASE_URL'], max: 4 });
    migrator = new pg.Client({ connectionString: process.env['MIGRATION_DATABASE_URL'] });
    await migrator.connect();
  }, 120_000);

  afterAll(async () => {
    await admin
      ?.query(`DELETE FROM compliance_feature_policies WHERE feature_code LIKE '${PREFIX}%'`)
      .catch(() => undefined);
    if (under14PersonId !== null) {
      await admin
        .query(`DELETE FROM person_compliance_profiles WHERE person_id = $1`, [under14PersonId])
        .catch(() => undefined);
      await admin
        .query(`DELETE FROM consent_records WHERE bound_person_id = $1`, [under14PersonId])
        .catch(() => undefined);
      await admin
        .query(`DELETE FROM guardian_consent_requests WHERE subject_person_id = $1`, [
          under14PersonId,
        ])
        .catch(() => undefined);
      await admin
        .query(`DELETE FROM family_members WHERE person_id = $1`, [under14PersonId])
        .catch(() => undefined);
      await admin.query(`DELETE FROM persons WHERE id = $1`, [under14PersonId]).catch(() => undefined);
    }
    await migrator?.end().catch(() => undefined);
    await fixture?.cleanup();
    await fixture?.close();
    await pool?.end().catch(() => undefined);
    await admin?.end().catch(() => undefined);
    await app?.close();
  }, 120_000);

  it('Case A — policy race: the decision keeps the policy version read in its snapshot', async () => {
    const code = featureCode('POLICY_RACE');
    const v1Start = new Date(Date.now() - 10 * 60_000);
    await publish({ code, expectedVersion: null, version: 1, effectiveFrom: v1Start });

    const firstReadDone = deferred();
    const releaseT1 = deferred();

    const t1 = withDrizzleRlsTransaction(pool, rlsOptions(), async (tx, client) => {
      const firstSnapshot = await loadCompliancePolicySnapshot(tx, descriptor(code));
      firstReadDone.resolve();
      await releaseT1.promise;

      const person = await loadCompliancePersonSnapshot(client, owner.personId);
      const evaluated = await evaluateComplianceAtTransactionTime(tx, client, {
        descriptor: descriptor(code),
        personId: owner.personId,
        supportedObligations: SUPPORTED,
      });
      const secondSnapshot = await loadCompliancePolicySnapshot(tx, descriptor(code));
      return { firstSnapshot, secondSnapshot, person, evaluated };
    });

    await firstReadDone.promise;
    try {
      // v2 becomes effective BEFORE T1's transaction start, so a READ COMMITTED
      // re-read would switch to v2; REPEATABLE READ must keep v1.
      await publish({
        code,
        expectedVersion: 1,
        version: 2,
        effectiveFrom: new Date(Date.now() - 5 * 60_000),
      });
    } finally {
      releaseT1.resolve();
    }

    const result = await t1;
    expect(result.firstSnapshot.policies.map((policy) => policy.policyVersion)).toEqual([1]);
    expect(result.secondSnapshot.policies.map((policy) => policy.policyVersion)).toEqual([1]);
    expect(result.evaluated.policyVersion).toBe(1);
    expect(result.evaluated.applicability).toBe('NOT_APPLICABLE');
    expect(result.person?.ageBand).toBe('ADULT');

    // A fresh transaction sees the new committed version.
    const fresh = await withDrizzleRlsTransaction(pool, rlsOptions(), async (tx) => {
      const snapshot = await loadCompliancePolicySnapshot(tx, descriptor(code));
      return snapshot.policies.map((policy) => policy.policyVersion);
    });
    expect(fresh).toEqual([2]);
  }, 120_000);

  it('Case B — profile race: the decision keeps the profile read in its snapshot', async () => {
    const code = featureCode('PROFILE_RACE');
    await publish({
      code,
      expectedVersion: null,
      version: 1,
      effectiveFrom: new Date(Date.now() - 10 * 60_000),
    });

    const firstReadDone = deferred();
    const releaseT1 = deferred();

    const t1 = withDrizzleRlsTransaction(pool, rlsOptions(), async (tx, client) => {
      await loadCompliancePolicySnapshot(tx, descriptor(code));
      firstReadDone.resolve();
      await releaseT1.promise;
      return loadCompliancePersonSnapshot(client, owner.personId);
    });

    await firstReadDone.promise;
    try {
      await admin.query(
        `UPDATE person_compliance_profiles
            SET age_band = 'MINOR_14_17', minor_mode = true
          WHERE person_id = $1`,
        [owner.personId]
      );
    } finally {
      releaseT1.resolve();
    }

    const person = await t1;
    expect(person?.ageBand).toBe('ADULT');
    expect(person?.minorMode).toBe(false);

    await admin.query(
      `UPDATE person_compliance_profiles
          SET age_band = 'ADULT', minor_mode = false
        WHERE person_id = $1`,
      [owner.personId]
    );
  }, 120_000);

  it('Case C — guardian consent race: the decision keeps the consent read in its snapshot', async () => {
    const code = featureCode('CONSENT_RACE');
    await publish({
      code,
      expectedVersion: null,
      version: 1,
      effectiveFrom: new Date(Date.now() - 10 * 60_000),
    });

    // Existing UNDER_14 truth with a current valid guardian consent.
    const person = await admin.query<{ id: string }>(
      `INSERT INTO persons (created_by_account_id) VALUES ($1) RETURNING id`,
      [owner.accountId]
    );
    const personId = person.rows[0]!.id;
    under14PersonId = personId;
    await admin.query(`INSERT INTO family_members (family_id, person_id) VALUES ($1,$2)`, [
      familyId,
      personId,
    ]);

    const request = await admin.query<{ id: string }>(
      `INSERT INTO guardian_consent_requests
         (family_id, guardian_person_id, subject_person_id, declared_age_band,
          notice_version, notice_hash, status, expires_at, completed_at)
       VALUES ($1,$2,$3,'UNDER_14','v1',$4,'GRANTED',now()+interval '1 hour',now())
       RETURNING id`,
      [familyId, owner.personId, personId, getCurrentNoticeHash()]
    );
    const validConsent = await admin.query<{ id: string; version: number }>(
      `INSERT INTO consent_records
         (family_id, guardian_person_id, guardian_account_id, purpose, decision,
          version, onboarding_request_id, bound_person_id, bound_at,
          notice_version, notice_hash, policy_version, evidence)
       VALUES ($1,$2,$3,'UNDER_14_GUARDIAN_CONSENT','GRANTED',1,$4,$5,now(),'v1',$6,'v1',$7::jsonb)
       RETURNING id, version`,
      [
        familyId,
        owner.personId,
        owner.accountId,
        request.rows[0]!.id,
        personId,
        getCurrentNoticeHash(),
        JSON.stringify({
          channel: 'TEST',
          accepted_text_hash: 'b'.repeat(64),
          declared_age_band: 'UNDER_14',
          client_ip_hash: 'c'.repeat(64),
          user_agent_hash: 'd'.repeat(64),
        }),
      ]
    );
    const validConsentId = validConsent.rows[0]!.id;
    await admin.query(
      `INSERT INTO person_compliance_profiles
         (person_id, age_band, minor_mode, guardian_person_id, guardian_consent_record_id,
          guardian_consent_version, verified_source)
       VALUES ($1,'UNDER_14',true,$2,$3,$4,'GUARDIAN_RELAY')`,
      [personId, owner.personId, validConsentId, validConsent.rows[0]!.version]
    );

    const firstReadDone = deferred();
    const releaseT1 = deferred();

    const t1 = withDrizzleRlsTransaction(
      pool,
      { ...rlsOptions(), personId: owner.personId },
      async (tx, client) => {
        await loadCompliancePolicySnapshot(tx, descriptor(code));
        firstReadDone.resolve();
        await releaseT1.promise;

        const snapshot = await loadCompliancePersonSnapshot(client, personId);
        const evaluated = await evaluateComplianceAtTransactionTime(tx, client, {
          descriptor: descriptor(code),
          personId,
          supportedObligations: SUPPORTED,
        });
        return { snapshot, evaluated };
      }
    );

    await firstReadDone.promise;
    try {
      // Replace the profile's consent reference with a REVOKED successor.
      const revoked = await admin.query<{ id: string; version: number }>(
        `INSERT INTO consent_records
           (family_id, guardian_person_id, guardian_account_id, purpose, decision,
            version, onboarding_request_id, bound_person_id, bound_at,
            notice_version, notice_hash, policy_version, evidence, supersedes_id)
         VALUES ($1,$2,$3,'UNDER_14_GUARDIAN_CONSENT','REVOKED',2,NULL,$4,now(),'v1',$5,'v1',$6::jsonb,$7)
         RETURNING id, version`,
        [
          familyId,
          owner.personId,
          owner.accountId,
          personId,
          getCurrentNoticeHash(),
          JSON.stringify({
            channel: 'TEST',
            accepted_text_hash: 'e'.repeat(64),
            declared_age_band: 'UNDER_14',
            client_ip_hash: 'f'.repeat(64),
            user_agent_hash: 'a'.repeat(64),
          }),
          validConsentId,
        ]
      );
      await admin.query(
        `UPDATE person_compliance_profiles
            SET guardian_consent_record_id = $2, guardian_consent_version = $3
          WHERE person_id = $1`,
        [personId, revoked.rows[0]!.id, revoked.rows[0]!.version]
      );
    } finally {
      releaseT1.resolve();
    }

    const result = await t1;
    expect(result.snapshot?.guardianConsent?.id).toBe(validConsentId);
    expect(result.snapshot?.guardianConsent?.decision).toBe('GRANTED');
    expect(result.evaluated.gate).toBe('ALLOW');
    expect(result.evaluated.reasonCode).toBeNull();
  }, 120_000);
});