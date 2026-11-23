/**
 * Finding #4 — Family Alliance ownership split.
 *
 *   ACTOR   → Authorization   (already decided by the caller's authorize step)
 *   TARGET  → Compliance / Consent
 *
 * The residual actor-side consent gate is gone: an actor who is themselves a
 * minor with a revoked/stale consent must not be able to block (or be required
 * for) a Family Alliance command whose target child holds a current consent.
 * The target-child gate and `assertBoundAssessmentCompliance` stay in force.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { buildApp } from '../../apps/server/api/src/app.js';
import { withRlsTransaction } from '../../apps/server/api/src/db/tx.js';
import {
  pinAndAssertFamilyAllianceGates,
  revalidateFamilyAllianceGates,
} from '../../apps/server/api/src/services/digital-use-family-alliance.js';
import { insertDigitalUseAssessmentTarget } from '@xiaoshuyin/domain';
import { getCurrentNoticeHash } from '@xiaoshuyin/compliance';
import { createAdminPool } from '../setup/db.js';
import { createSafetyFixture, type SafetyFixture } from '../setup/safety.js';

const PREFIX = `S13F4_${Date.now()}_`;

const VALID_EVIDENCE = JSON.stringify({
  channel: 'TEST',
  accepted_text_hash: 'b'.repeat(64),
  declared_age_band: 'UNDER_14',
  client_ip_hash: 'c'.repeat(64),
  user_agent_hash: 'd'.repeat(64),
});

describe('Finding #4: Family Alliance actor authorization vs target consent', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let admin: pg.Pool;
  let appDb: pg.Pool;
  let migrator: pg.Client;
  let fixture: SafetyFixture;
  let manager: { token: string; accountId: string; personId: string };
  let familyId: string;
  let caseId: string;
  const publishedFeatureCodes: string[] = [];

  async function createPerson(): Promise<string> {
    const row = await admin.query<{ id: string }>(
      `INSERT INTO persons (created_by_account_id) VALUES ($1) RETURNING id`,
      [manager.accountId]
    );
    const personId = row.rows[0]!.id;
    await admin.query(`INSERT INTO family_members (family_id, person_id) VALUES ($1,$2)`, [
      familyId,
      personId,
    ]);
    return personId;
  }

  async function createUnder14WithConsent(
    guardianPersonId: string,
    options: { decision?: 'GRANTED' | 'REVOKED'; noticeHash?: string } = {}
  ): Promise<string> {
    const personId = await createPerson();
    const decision = options.decision ?? 'GRANTED';
    let onboardingRequestId: string | null = null;
    if (decision === 'GRANTED') {
      const request = await admin.query<{ id: string }>(
        `INSERT INTO guardian_consent_requests
           (family_id, guardian_person_id, subject_person_id, declared_age_band,
            notice_version, notice_hash, status, expires_at, completed_at)
         VALUES ($1,$2,$3,'UNDER_14','v1',$4,'GRANTED',now()+interval '1 hour',now())
         RETURNING id`,
        [familyId, guardianPersonId, personId, getCurrentNoticeHash()]
      );
      onboardingRequestId = request.rows[0]!.id;
    }
    const consent = await admin.query<{ id: string }>(
      `INSERT INTO consent_records
         (family_id, guardian_person_id, guardian_account_id, purpose, decision,
          version, onboarding_request_id, bound_person_id, bound_at,
          notice_version, notice_hash, policy_version, evidence, supersedes_id)
       VALUES ($1,$2,$3,'UNDER_14_GUARDIAN_CONSENT',$4,1,$5,$6,now(),'v1',$7,'v1',$8::jsonb,NULL)
       RETURNING id`,
      [
        familyId,
        guardianPersonId,
        manager.accountId,
        decision,
        onboardingRequestId,
        personId,
        options.noticeHash ?? getCurrentNoticeHash(),
        VALID_EVIDENCE,
      ]
    );
    await admin.query(
      `INSERT INTO person_compliance_profiles
         (person_id, age_band, minor_mode, guardian_person_id, guardian_consent_record_id,
          guardian_consent_version, verified_source)
       VALUES ($1,'UNDER_14',true,$2,$3,1,'GUARDIAN_RELAY')`,
      [personId, guardianPersonId, consent.rows[0]!.id]
    );
    return personId;
  }

  async function ensureAdultProfile(personId: string): Promise<void> {
    await admin.query(
      `INSERT INTO person_compliance_profiles
         (person_id, age_band, minor_mode, verified_source)
       VALUES ($1,'ADULT',false,'SELF_STATEMENT')
       ON CONFLICT (person_id) DO UPDATE
         SET age_band='ADULT', minor_mode=false, guardian_person_id=NULL,
             guardian_consent_record_id=NULL, guardian_consent_version=NULL`,
      [personId]
    );
  }

  /** Bind a target child to a fresh Case and run the real Family Alliance gates. */
  async function runGates(input: {
    actorPersonId: string;
    targetPersonId: string;
  }): Promise<void> {
    const kase = await fixture.createCase(manager, `f4-${Date.now()}`);
    caseId = kase.id;
    await withRlsTransaction(
      appDb,
      {
        familyId,
        accountId: manager.accountId,
        personId: manager.personId,
        purpose: 'FAMILY_MANAGEMENT',
      },
      (tx) =>
        insertDigitalUseAssessmentTarget(
          tx,
          caseId,
          familyId,
          input.targetPersonId,
          manager.personId
        )
    );

    await withRlsTransaction(
      appDb,
      {
        familyId,
        accountId: manager.accountId,
        personId: manager.personId,
        purpose: 'FAMILY_MANAGEMENT',
      },
      async (tx) => {
        await pinAndAssertFamilyAllianceGates(
          tx,
          caseId,
          input.actorPersonId,
          input.targetPersonId
        );
        await revalidateFamilyAllianceGates(
          tx,
          caseId,
          input.actorPersonId,
          input.targetPersonId
        );
      }
    );
  }

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
    admin = createAdminPool();
    appDb = new pg.Pool({ connectionString: process.env['DATABASE_URL']! });
    migrator = new pg.Client({ connectionString: process.env['MIGRATION_DATABASE_URL'] });
    await migrator.connect();
    const existing = await migrator.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM compliance_feature_policies
        WHERE feature_code = 'DIGITAL_USE_FAMILY_ALLIANCE_RUNTIME'
          AND feature_contract_revision = 'v1'
          AND effective_from <= now()
          AND (effective_until IS NULL OR now() < effective_until)`
    );
    if (Number(existing.rows[0]!.count) === 0) {
      await migrator.query(
        `SELECT app.publish_compliance_feature_policy(
           'DIGITAL_USE_FAMILY_ALLIANCE_RUNTIME','v1',NULL,1,
           'NOT_APPLICABLE','BASELINE','BASELINE','BASELINE','BASELINE',
           'Finding 4 ownership split basis','evidence://finding4/ownership',
           now() - interval '1 minute','migration:finding4-ownership'
         )`
      );
      publishedFeatureCodes.push('DIGITAL_USE_FAMILY_ALLIANCE_RUNTIME');
    }

    fixture = createSafetyFixture({ app, admin, prefix: PREFIX });
    manager = await fixture.login('manager');
    familyId = await fixture.createFamily(manager, 'finding4');
    await ensureAdultProfile(manager.personId);
  }, 120_000);

  afterAll(async () => {
    // Only remove the policies this suite actually published, so suites that
    // publish the same feature codes unconditionally are not disturbed.
    for (const featureCode of publishedFeatureCodes) {
      await migrator
        .query(
          `UPDATE compliance_feature_policies SET superseded_by_policy_id = NULL
            WHERE feature_code = $1 AND feature_contract_revision = 'v1'`,
          [featureCode]
        )
        .catch(() => undefined);
      await migrator
        .query(
          `DELETE FROM compliance_feature_policies
            WHERE feature_code = $1 AND feature_contract_revision = 'v1'`,
          [featureCode]
        )
        .catch(() => undefined);
    }
    await fixture?.cleanup();
    await fixture?.close();
    await appDb?.end().catch(() => undefined);
    await migrator?.end().catch(() => undefined);
    await admin?.end().catch(() => undefined);
    await app?.close();
  }, 120_000);

  it('an actor minor whose own consent was revoked does not block a consented target child', async () => {
    const actorPersonId = await createUnder14WithConsent(manager.personId, {
      decision: 'REVOKED',
    });
    const targetPersonId = await createUnder14WithConsent(manager.personId);

    await expect(
      runGates({ actorPersonId, targetPersonId })
    ).resolves.toBeUndefined();
  }, 120_000);

  it('an actor minor with a stale-notice consent does not block a consented target child', async () => {
    const actorPersonId = await createUnder14WithConsent(manager.personId, {
      noticeHash: 'a'.repeat(64),
    });
    const targetPersonId = await createUnder14WithConsent(manager.personId);

    await expect(
      runGates({ actorPersonId, targetPersonId })
    ).resolves.toBeUndefined();
  }, 120_000);

  it('a target child without a current consent is blocked even when the actor is allowed', async () => {
    const targetPersonId = await createUnder14WithConsent(manager.personId, {
      decision: 'REVOKED',
    });

    await expect(
      runGates({ actorPersonId: manager.personId, targetPersonId })
    ).rejects.toMatchObject({ code: 'CONSENT_BLOCKED' });
  }, 120_000);

  it('a revoked target consent blocks even when the actor is a consented minor', async () => {
    const actorPersonId = await createUnder14WithConsent(manager.personId);
    const targetPersonId = await createUnder14WithConsent(manager.personId, {
      noticeHash: 'b'.repeat(64),
    });

    await expect(
      runGates({ actorPersonId, targetPersonId })
    ).rejects.toMatchObject({ code: 'CONSENT_BLOCKED' });
  }, 120_000);

  it('the Family Alliance gate keeps the target gate and required composition, with no actor-side consent call', () => {
    const source = readFileSync(
      fileURLToPath(
        new URL(
          '../../apps/server/api/src/services/digital-use-family-alliance.ts',
          import.meta.url
        )
      ),
      'utf8'
    );

    // Target-child consent authority stays.
    expect(source).toContain('assertFamilyAllianceConsentOwnerGate(tx, targetPersonId)');
    // The bound-assessment compliance composition stays in the execution path.
    expect(source).toContain('assertBoundAssessmentCompliance(tx, input)');
    // Actor authorization is the caller's responsibility; no actor-side gate.
    expect(source).not.toContain('assertFamilyAllianceConsentOwnerGate(tx, actorPersonId)');
  });
});
