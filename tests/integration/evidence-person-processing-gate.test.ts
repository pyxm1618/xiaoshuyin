/**
 * T070 — COLD-002 targeted remediation: every non-null Person reference
 * processed by an Evidence write must pass the existing compliance gate, not
 * just `subjectPersonId`.
 *
 * Frozen semantics (plan.md D-5, contracts/evidence-domain.md §2,
 * contracts/security-idempotency.md §2/§8):
 *
 *   subjectPersonId !== null → check
 *   sourcePersonId  !== null → check
 *   subject === source       → dedupe (one check), semantics unchanged
 *
 * The gate reuses the existing `assertMinorProcessingAllowed` data source.
 * BLOCK writes zero Evidence rows and zero audit rows.
 *
 * This file is RED before the repository gate covers `sourcePersonId`.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import { recordStatement } from '../../packages/domain/src/evidence.js';
import { withRlsTransaction } from '../../apps/server/api/src/db/tx.js';
import { getCurrentNoticeHash } from '../../packages/compliance/src/notices.js';

const ADMIN_URL = process.env['TEST_ADMIN_DATABASE_URL']!;
const APP_URL = process.env['DATABASE_URL']!;

interface Fixture {
  familyId: string;
  caseId: string;
  accountId: string;
  managerPersonId: string;
  guardianPersonId: string;
  guardianPersonId2: string;
  adultPersonId: string;
  minorPersonId: string;
  under14ValidPersonId: string;
  under14MissingPersonId: string;
  under14RevokedPersonId: string;
  under14StalePersonId: string;
  under14MalformedPersonId: string;
  unknownPersonId: string;
  missingProfilePersonId: string;
}

let admin: pg.Client;
let pool: pg.Pool;
let fx: Fixture;

const NOTICE_HASH = getCurrentNoticeHash();

function context() {
  return {
    familyId: fx.familyId,
    caseId: fx.caseId,
    actorAccountId: fx.accountId,
    actorPersonId: fx.managerPersonId,
    purpose: 'FAMILY_MANAGEMENT' as const,
  };
}

function draft(subjectPersonId: string, sourcePersonId: string, content: string) {
  return {
    subjectPersonId,
    sourceKind: sourcePersonId === subjectPersonId ? 'SELF_STATEMENT' : 'OTHER_MEMBER_RELAY',
    sourcePersonId,
    sourceMessageId: null,
    occurredTimeState: 'UNKNOWN',
    occurredAt: null,
    validFrom: null,
    validUntil: null,
    confirmationStatus: 'UNCONFIRMED',
    supersedesId: null,
    content,
  } as any;
}

function runWrite<T>(fn: (tx: pg.PoolClient) => Promise<T>): Promise<T> {
  return withRlsTransaction(
    pool,
    {
      familyId: fx.familyId,
      accountId: fx.accountId,
      personId: fx.managerPersonId,
      purpose: 'FAMILY_MANAGEMENT',
    },
    fn
  );
}

async function counts(familyId: string) {
  const { rows } = await admin.query(
    `SELECT
       (SELECT count(*)::int FROM assertions WHERE family_id = $1) AS assertions,
       (SELECT count(*)::int FROM observations WHERE family_id = $1) AS observations,
       (SELECT count(*)::int FROM business_audit_events WHERE family_id = $1) AS audits`,
    [familyId]
  );
  return rows[0] as { assertions: number; observations: number; audits: number };
}

async function expectWrite(
  subjectPersonId: string,
  sourcePersonId: string,
  label: string
): Promise<void> {
  const before = await counts(fx.familyId);
  const written = await runWrite((tx) =>
    recordStatement(tx, context(), draft(subjectPersonId, sourcePersonId, label))
  );
  expect(written.id, label).toBeTruthy();
  const after = await counts(fx.familyId);
  expect(after.assertions, `${label} assertion +1`).toBe(before.assertions + 1);
  expect(after.audits, `${label} audit +1`).toBe(before.audits + 1);
}

async function expectBlocked(
  subjectPersonId: string,
  sourcePersonId: string,
  label: string,
  code: string
): Promise<void> {
  const before = await counts(fx.familyId);
  let error: any = null;
  try {
    await runWrite((tx) => recordStatement(tx, context(), draft(subjectPersonId, sourcePersonId, label)));
  } catch (err) {
    error = err;
  }
  expect(error, `${label} must fail closed`).not.toBeNull();
  expect(error.code, label).toBe(code);
  // BLOCK: zero Evidence and zero audit rows.
  expect(await counts(fx.familyId), `${label} zero writes`).toEqual(before);
}

describe('T070 — all processed Persons compliance gate (COLD-002)', () => {
  beforeAll(async () => {
    admin = new pg.Client({ connectionString: ADMIN_URL });
    await admin.connect();
    pool = new pg.Pool({ connectionString: APP_URL, max: 4 });
    fx = await seed(admin);
  });

  afterAll(async () => {
    await cleanup(admin);
    await pool.end();
    await admin.end();
  });

  describe('source compliance matrix (source != subject)', () => {
    it('source = ADULT → ALLOW', async () => {
      await expectWrite(fx.managerPersonId, fx.adultPersonId, 'source-adult');
    });

    it('source = MINOR_14_17 → ALLOW (independent fixture)', async () => {
      await expectWrite(fx.managerPersonId, fx.minorPersonId, 'source-minor');
    });

    it('source = UNDER_14 + valid current guardian consent → ALLOW', async () => {
      await expectWrite(fx.managerPersonId, fx.under14ValidPersonId, 'source-under14-valid');
    });

    it('source = UNDER_14 + missing consent → BLOCK', async () => {
      await expectBlocked(
        fx.managerPersonId,
        fx.under14MissingPersonId,
        'source-under14-missing',
        'GUARDIAN_CONSENT_REQUIRED'
      );
    });

    it('source = UNDER_14 + revoked consent → BLOCK', async () => {
      await expectBlocked(
        fx.managerPersonId,
        fx.under14RevokedPersonId,
        'source-under14-revoked',
        'GUARDIAN_CONSENT_REVOKED'
      );
    });

    it('source = UNDER_14 + stale consent → BLOCK', async () => {
      await expectBlocked(
        fx.managerPersonId,
        fx.under14StalePersonId,
        'source-under14-stale',
        'NOTICE_VERSION_MISMATCH'
      );
    });

    it('source = UNDER_14 + malformed consent → BLOCK', async () => {
      await expectBlocked(
        fx.managerPersonId,
        fx.under14MalformedPersonId,
        'source-under14-malformed',
        'GUARDIAN_CONSENT_REQUIRED'
      );
    });

    it('source = UNKNOWN → BLOCK', async () => {
      await expectBlocked(
        fx.managerPersonId,
        fx.unknownPersonId,
        'source-unknown',
        'AGE_BAND_UNKNOWN'
      );
    });

    it('source profile missing → BLOCK', async () => {
      await expectBlocked(
        fx.managerPersonId,
        fx.missingProfilePersonId,
        'source-profile-missing',
        'PROFILE_MISSING'
      );
    });
  });

  describe('subject compliance matrix (source is a valid ADULT manager)', () => {
    it('subject = ADULT → ALLOW', async () => {
      await expectWrite(fx.adultPersonId, fx.managerPersonId, 'subject-adult');
    });

    it('subject = MINOR_14_17 → ALLOW (independent fixture)', async () => {
      await expectWrite(fx.minorPersonId, fx.managerPersonId, 'subject-minor');
    });

    it('subject = UNDER_14 + valid current guardian consent → ALLOW', async () => {
      await expectWrite(fx.under14ValidPersonId, fx.managerPersonId, 'subject-under14-valid');
    });

    it('subject = UNDER_14 + revoked consent → BLOCK', async () => {
      await expectBlocked(
        fx.under14RevokedPersonId,
        fx.managerPersonId,
        'subject-under14-revoked',
        'GUARDIAN_CONSENT_REVOKED'
      );
    });

    it('subject = UNKNOWN → BLOCK', async () => {
      await expectBlocked(
        fx.unknownPersonId,
        fx.managerPersonId,
        'subject-unknown',
        'AGE_BAND_UNKNOWN'
      );
    });

    it('subject profile missing → BLOCK', async () => {
      await expectBlocked(
        fx.missingProfilePersonId,
        fx.managerPersonId,
        'subject-profile-missing',
        'PROFILE_MISSING'
      );
    });
  });

  describe('subject === source dedupe', () => {
    it('dedupe keeps ALLOW for ADULT', async () => {
      await expectWrite(fx.adultPersonId, fx.adultPersonId, 'dedupe-adult');
    });

    it('dedupe keeps ALLOW for UNDER_14 with valid consent', async () => {
      await expectWrite(fx.under14ValidPersonId, fx.under14ValidPersonId, 'dedupe-under14-valid');
    });

    it('dedupe keeps BLOCK for UNDER_14 with revoked consent', async () => {
      await expectBlocked(
        fx.under14RevokedPersonId,
        fx.under14RevokedPersonId,
        'dedupe-under14-revoked',
        'GUARDIAN_CONSENT_REVOKED'
      );
    });
  });
});

async function seed(client: pg.Client): Promise<Fixture> {
  const suffix = `${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
  const { rows: acc } = await client.query(
    `INSERT INTO accounts (wechat_openid) VALUES ($1) RETURNING id`,
    [`t070_${suffix}`]
  );
  const accountId = acc[0].id as string;

  const { rows: manager } = await client.query(
    `INSERT INTO persons (account_id, created_by_account_id) VALUES ($1, $1) RETURNING id`,
    [accountId]
  );
  const managerPersonId = manager[0].id as string;

  const { rows: fam } = await client.query(
    `INSERT INTO families (display_name, created_by_person_id) VALUES ('t070', $1) RETURNING id`,
    [managerPersonId]
  );
  const familyId = fam[0].id as string;
  await client.query('INSERT INTO family_members (family_id, person_id) VALUES ($1, $2)', [
    familyId,
    managerPersonId,
  ]);
  await client.query(
    `INSERT INTO person_compliance_profiles (person_id, age_band, minor_mode, verified_source)
     VALUES ($1, 'ADULT', false, 'SELF_STATEMENT')`,
    [managerPersonId]
  );

  const { rows: kase } = await client.query(
    `INSERT INTO cases (family_id, created_by_person_id, status, phase, is_primary, version)
     VALUES ($1, $2, 'OPEN', 'INTAKE', true, 1) RETURNING id`,
    [familyId, managerPersonId]
  );
  const caseId = kase[0].id as string;

  const makePerson = async (): Promise<string> => {
    const { rows } = await client.query(
      'INSERT INTO persons (created_by_account_id) VALUES ($1) RETURNING id',
      [accountId]
    );
    const personId = rows[0].id as string;
    await client.query('INSERT INTO family_members (family_id, person_id) VALUES ($1, $2)', [
      familyId,
      personId,
    ]);
    return personId;
  };

  const guardianPersonId = await makePerson();
  await client.query(
    `INSERT INTO person_compliance_profiles (person_id, age_band, minor_mode, verified_source)
     VALUES ($1, 'ADULT', false, 'SELF_STATEMENT')`,
    [guardianPersonId]
  );
  const guardianPersonId2 = await makePerson();
  await client.query(
    `INSERT INTO person_compliance_profiles (person_id, age_band, minor_mode, verified_source)
     VALUES ($1, 'ADULT', false, 'SELF_STATEMENT')`,
    [guardianPersonId2]
  );

  const adultPersonId = await makePerson();
  await client.query(
    `INSERT INTO person_compliance_profiles (person_id, age_band, minor_mode, verified_source)
     VALUES ($1, 'ADULT', false, 'SELF_STATEMENT')`,
    [adultPersonId]
  );

  const minorPersonId = await makePerson();
  await client.query(
    `INSERT INTO person_compliance_profiles
       (person_id, age_band, minor_mode, guardian_person_id, verified_source)
     VALUES ($1, 'MINOR_14_17', true, $2, 'GUARDIAN_OBSERVATION')`,
    [minorPersonId, guardianPersonId]
  );

  const insertProfile = async (
    personId: string,
    ageBand: string,
    extra: {
      consentRecordId?: string | null;
      consentVersion?: number | null;
      guardianPersonId?: string;
    } = {}
  ) => {
    await client.query(
      `INSERT INTO person_compliance_profiles
         (person_id, age_band, minor_mode, guardian_person_id,
          guardian_consent_version, guardian_consent_record_id, verified_source)
       VALUES ($1, $2, true, $3, $4, $5, 'GUARDIAN_RELAY')`,
      [
        personId,
        ageBand,
        extra.guardianPersonId ?? guardianPersonId,
        extra.consentVersion ?? null,
        extra.consentRecordId ?? null,
      ]
    );
  };

  const validEvidence = JSON.stringify({
    channel: 'TEST',
    accepted_text_hash: 'a'.repeat(64),
    declared_age_band: 'UNDER_14',
    client_ip_hash: 'b'.repeat(64),
    user_agent_hash: 'c'.repeat(64),
  });

  const insertConsent = async (
    subjectPersonId: string,
    decision: 'GRANTED' | 'REVOKED',
    noticeHash: string,
    evidence: string,
    version: number
  ): Promise<string> => {
    // Frozen constraint: GRANTED requires an onboarding request, REVOKED must
    // not carry one.
    let onboardingRequestId: string | null = null;
    if (decision === 'GRANTED') {
      const { rows: request } = await client.query(
        `INSERT INTO guardian_consent_requests
           (family_id, guardian_person_id, subject_person_id, declared_age_band,
            notice_version, notice_hash, status, expires_at, completed_at)
         VALUES ($1, $2, $3, 'UNDER_14', 'v1', $4, 'GRANTED',
                 now() + interval '1 hour', now())
         RETURNING id`,
        [familyId, guardianPersonId, subjectPersonId, noticeHash]
      );
      onboardingRequestId = request[0].id as string;
    }
    const { rows } = await client.query(
      `INSERT INTO consent_records
         (family_id, guardian_person_id, guardian_account_id, purpose, decision,
          version, onboarding_request_id, bound_person_id, bound_at,
          notice_version, notice_hash, policy_version, evidence)
       VALUES ($1, $2, $3, 'UNDER_14_GUARDIAN_CONSENT', $4,
               $5, $6, $7, now(), 'v1', $8, 'v1', $9::jsonb)
       RETURNING id`,
      [
        familyId,
        guardianPersonId,
        accountId,
        decision,
        version,
        onboardingRequestId,
        subjectPersonId,
        noticeHash,
        evidence,
      ]
    );
    return rows[0].id as string;
  };

  const under14ValidPersonId = await makePerson();
  const validConsentId = await insertConsent(
    under14ValidPersonId,
    'GRANTED',
    NOTICE_HASH,
    validEvidence,
    1
  );
  await insertProfile(under14ValidPersonId, 'UNDER_14', {
    consentRecordId: validConsentId,
    consentVersion: 1,
  });

  const under14MissingPersonId = await makePerson();
  // The pointer exists (DB CHECK), but the stored consent belongs to a
  // different guardian than the profile, so no usable current consent exists.
  const orphanConsentId = await insertConsent(
    under14MissingPersonId,
    'GRANTED',
    NOTICE_HASH,
    validEvidence,
    5
  );
  await insertProfile(under14MissingPersonId, 'UNDER_14', {
    consentRecordId: orphanConsentId,
    consentVersion: 5,
    guardianPersonId: guardianPersonId2,
  });

  const under14RevokedPersonId = await makePerson();
  const revokedConsentId = await insertConsent(
    under14RevokedPersonId,
    'REVOKED',
    NOTICE_HASH,
    validEvidence,
    2
  );
  await insertProfile(under14RevokedPersonId, 'UNDER_14', {
    consentRecordId: revokedConsentId,
    consentVersion: 2,
  });

  const under14StalePersonId = await makePerson();
  const staleConsentId = await insertConsent(
    under14StalePersonId,
    'GRANTED',
    '0'.repeat(64),
    validEvidence,
    3
  );
  await insertProfile(under14StalePersonId, 'UNDER_14', {
    consentRecordId: staleConsentId,
    consentVersion: 3,
  });

  const under14MalformedPersonId = await makePerson();
  const malformedConsentId = await insertConsent(
    under14MalformedPersonId,
    'GRANTED',
    NOTICE_HASH,
    JSON.stringify({ accepted: true }),
    4
  );
  await insertProfile(under14MalformedPersonId, 'UNDER_14', {
    consentRecordId: malformedConsentId,
    consentVersion: 4,
  });

  const unknownPersonId = await makePerson();
  await client.query(
    `INSERT INTO person_compliance_profiles (person_id, age_band, minor_mode, verified_source)
     VALUES ($1, 'UNKNOWN', false, 'SELF_STATEMENT')`,
    [unknownPersonId]
  );

  // Deliberately no compliance profile row.
  const missingProfilePersonId = await makePerson();

  return {
    familyId,
    caseId,
    accountId,
    managerPersonId,
    guardianPersonId,
    guardianPersonId2,
    adultPersonId,
    minorPersonId,
    under14ValidPersonId,
    under14MissingPersonId,
    under14RevokedPersonId,
    under14StalePersonId,
    under14MalformedPersonId,
    unknownPersonId,
    missingProfilePersonId,
  };
}

async function cleanup(client: pg.Client) {
  try {
    await client.query(
      `DELETE FROM assertions WHERE family_id IN (SELECT id FROM families WHERE display_name = 't070')`
    );
    await client.query(
      `DELETE FROM observations WHERE family_id IN (SELECT id FROM families WHERE display_name = 't070')`
    );
    await client.query(
      `DELETE FROM business_audit_events WHERE family_id IN (SELECT id FROM families WHERE display_name = 't070')`
    );
    await client.query(
      `DELETE FROM cases WHERE family_id IN (SELECT id FROM families WHERE display_name = 't070')`
    );
    await client.query(
      `DELETE FROM person_compliance_profiles WHERE person_id IN (
         SELECT person_id FROM family_members WHERE family_id IN (
           SELECT id FROM families WHERE display_name = 't070'))`
    );
    await client.query(
      `DELETE FROM consent_records WHERE family_id IN (SELECT id FROM families WHERE display_name = 't070')`
    );
    await client.query(
      `DELETE FROM guardian_consent_requests WHERE family_id IN (SELECT id FROM families WHERE display_name = 't070')`
    );
    await client.query(
      `DELETE FROM family_members WHERE family_id IN (SELECT id FROM families WHERE display_name = 't070')`
    );
    await client.query(`DELETE FROM families WHERE display_name = 't070'`);
    await client.query(
      `DELETE FROM persons WHERE created_by_account_id IN (
         SELECT id FROM accounts WHERE wechat_openid LIKE 't070\\_%')`
    );
    await client.query(`DELETE FROM accounts WHERE wechat_openid LIKE 't070\\_%'`);
  } catch {
    // best-effort cleanup
  }
}