/**
 * Finding #3 — Guardian Consent Authority is strictly fail-closed.
 *
 * These are REAL regression tests over the production composition chain:
 *
 *   repository (`loadCompliancePersonSnapshot` reading the real tables)
 *     → snapshot (`ComplianceEvaluationSnapshot`)
 *     → evaluator (`evaluateCompliance`)
 *
 * Each case seeds only authoritative DB rows and then asserts the decision. No
 * test fabricates a snapshot by hand for the repository-level cases, so a
 * future loader change that hides a mismatch would fail here.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { buildApp } from '../../apps/server/api/src/app.js';
import { withDrizzleRlsTransaction } from '../../apps/server/api/src/db/drizzle-tx.js';
import { createAdminPool } from '../setup/db.js';
import { createSafetyFixture, type SafetyFixture } from '../setup/safety.js';
import {
  assertMinorProcessingAllowed,
  createServerFeatureDescriptor,
  evaluateCompliance,
  getCurrentNoticeHash,
  getCurrentNoticeVersion,
  loadCompliancePersonSnapshot,
  type ComplianceEvaluationSnapshot,
  type ComplianceFeaturePolicyRecord,
  type CompliancePersonSnapshot,
  type MinorProcessingCategory,
} from '@xiaoshuyin/compliance';

const PREFIX = `S10F3_${Date.now()}_`;

const FEATURE = createServerFeatureDescriptor({
  featureCode: `${PREFIX}GUARDIAN_AUTHORITY`.toUpperCase().replace(/[^A-Z0-9_]/g, '_'),
  featureContractRevision: 'v1',
  capabilityLabel: 'Guardian consent authority regression',
});

const EVALUATED_AT = new Date().toISOString();

function policy(): ComplianceFeaturePolicyRecord {
  return {
    policyId: '00000000-0000-7000-8000-000000000001',
    featureCode: FEATURE.featureCode,
    featureContractRevision: FEATURE.featureContractRevision,
    policyVersion: 1,
    anthropomorphicApplicability: 'NOT_APPLICABLE',
    minorAccessRule: 'BASELINE',
    aiDisclosureRule: 'BASELINE',
    generatedContentLabelRule: 'BASELINE',
    usageReminderRule: 'BASELINE',
    effectiveFrom: '2026-01-01T00:00:00.000Z',
    effectiveUntil: null,
  };
}

function snapshotOf(
  person: CompliancePersonSnapshot | null
): ComplianceEvaluationSnapshot {
  return {
    feature: FEATURE,
    evaluatedAt: EVALUATED_AT,
    candidatePolicies: [policy()],
    actor: person,
    personProcessingRequired: true,
    person,
    currentNoticeHash: getCurrentNoticeHash(),
  };
}

const VALID_EVIDENCE = JSON.stringify({
  channel: 'TEST',
  accepted_text_hash: 'b'.repeat(64),
  declared_age_band: 'UNDER_14',
  client_ip_hash: 'c'.repeat(64),
  user_agent_hash: 'd'.repeat(64),
});

describe('Finding #3: guardian consent authority is fail-closed end to end', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let admin: pg.Pool;
  let pool: pg.Pool;
  let fixture: SafetyFixture;
  let owner: { token: string; accountId: string; personId: string };
  let familyId: string;
  let childPersonId: string;

  function rlsOptions() {
    return {
      familyId,
      accountId: owner.accountId,
      personId: owner.personId,
      purpose: 'COMPLIANCE_EVALUATION',
      isolationLevel: 'REPEATABLE READ' as const,
    };
  }

  async function loadPerson(): Promise<CompliancePersonSnapshot | null> {
    return withDrizzleRlsTransaction(pool, rlsOptions(), async (_tx, client) =>
      loadCompliancePersonSnapshot(client, childPersonId)
    );
  }

  let versionSeq = 0;
  /**
   * `consent_subject_version_key` is unique per (subject, version), so every
   * seeded row takes the next version number unless a case needs a specific one.
   */
  function allocateVersion(explicit?: number): number {
    if (explicit !== undefined) {
      versionSeq = Math.max(versionSeq, explicit);
      return explicit;
    }
    versionSeq += 1;
    return versionSeq;
  }

  /** Insert one guardian consent row with the exact overrides the case needs. */
  async function insertConsent(overrides: {
    decision?: 'GRANTED' | 'REVOKED';
    version?: number;
    noticeVersion?: string;
    noticeHash?: string;
    policyVersion?: string;
    evidence?: unknown;
    guardianPersonId?: string;
    boundPersonId?: string | null;
    supersedesId?: string | null;
  } = {}): Promise<{ id: string; version: number }> {
    const decision = overrides.decision ?? 'GRANTED';
    const version = allocateVersion(overrides.version);
    // consent_purpose_field_binding: a GRANTED guardian row must reference its
    // onboarding request, a REVOKED one must not.
    let onboardingRequestId: string | null = null;
    if (decision === 'GRANTED') {
      const request = await admin.query<{ id: string }>(
        `INSERT INTO guardian_consent_requests
           (family_id, guardian_person_id, subject_person_id, declared_age_band,
            notice_version, notice_hash, status, expires_at, completed_at)
         VALUES ($1,$2,$3,'UNDER_14',$4,$5,'GRANTED',now()+interval '1 hour',now())
         RETURNING id`,
        [
          familyId,
          overrides.guardianPersonId ?? owner.personId,
          childPersonId,
          overrides.noticeVersion ?? 'v1',
          overrides.noticeHash ?? getCurrentNoticeHash(),
        ]
      );
      onboardingRequestId = request.rows[0]!.id;
    }

    const result = await admin.query<{ id: string; version: number }>(
      `INSERT INTO consent_records
         (family_id, guardian_person_id, guardian_account_id, purpose, decision,
          version, onboarding_request_id, bound_person_id, bound_at,
          notice_version, notice_hash, policy_version, evidence, supersedes_id)
       VALUES ($1,$2,$3,'UNDER_14_GUARDIAN_CONSENT',$4,$5,$6,$7,now(),$8,$9,$10,$11::jsonb,$12)
       RETURNING id, version`,
      [
        familyId,
        overrides.guardianPersonId ?? owner.personId,
        owner.accountId,
        decision,
        version,
        onboardingRequestId,
        overrides.boundPersonId === undefined ? childPersonId : overrides.boundPersonId,
        overrides.noticeVersion ?? 'v1',
        overrides.noticeHash ?? getCurrentNoticeHash(),
        overrides.policyVersion ?? 'v1',
        JSON.stringify(overrides.evidence ?? JSON.parse(VALID_EVIDENCE)),
        overrides.supersedesId ?? null,
      ]
    );
    return result.rows[0]!;
  }

  /**
   * Insert a purpose-scoped supplemental-assessment consent for the SAME child.
   * This is real persisted truth of the other purpose: it must never satisfy a
   * guardian gate.
   */
  async function insertSupplementalConsent(
    caseId: string
  ): Promise<{ id: string; version: number }> {
    const disclosureReference = '01004-supplemental-assessment-disclosure';
    const disclosureVersion = 'v1';
    const disclosureHash = '1'.repeat(64);
    const confirmationHash = '2'.repeat(64);
    const evidence = {
      evidence_kind: 'DIGITAL_USE_SUPPLEMENTAL_ASSESSMENT',
      purpose: 'DIGITAL_USE_SUPPLEMENTAL_ASSESSMENT',
      disclosure_reference: disclosureReference,
      disclosure_version: disclosureVersion,
      disclosure_hash: disclosureHash,
      confirmation_statement_hash: confirmationHash,
      decision: 'GRANTED',
      decision_actor_person_id: owner.personId,
      case_id: caseId,
      decided_at: new Date().toISOString(),
      client_ip_hash: '3'.repeat(64),
      user_agent_hash: '4'.repeat(64),
    };
    const result = await admin.query<{ id: string; version: number }>(
      `INSERT INTO consent_records
         (family_id, guardian_person_id, guardian_account_id, purpose, decision,
          version, onboarding_request_id, bound_person_id, bound_at, case_id,
          decision_actor_person_id, decision_actor_account_id, disclosure_reference,
          confirmation_statement_hash, notice_version, notice_hash, policy_version,
          evidence, supersedes_id)
       VALUES ($1,NULL,NULL,'DIGITAL_USE_SUPPLEMENTAL_ASSESSMENT','GRANTED',1,NULL,NULL,NULL,$2,
               $3,$4,$5,$6,$7,$8,$9,$10::jsonb,NULL)
       RETURNING id, version`,
      [
        familyId,
        caseId,
        owner.personId,
        owner.accountId,
        disclosureReference,
        confirmationHash,
        disclosureVersion,
        disclosureHash,
        disclosureVersion,
        JSON.stringify(evidence),
      ]
    );
    return result.rows[0]!;
  }

  async function pointProfileAt(
    consentId: string | null,
    consentVersion: number | null
  ): Promise<void> {
    await admin.query(
      `UPDATE person_compliance_profiles
          SET guardian_consent_record_id = $2, guardian_consent_version = $3
        WHERE person_id = $1`,
      [childPersonId, consentId, consentVersion]
    );
  }

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
    admin = createAdminPool();
    fixture = createSafetyFixture({ app, admin, prefix: PREFIX });
    owner = await fixture.login('owner');
    familyId = await fixture.createFamily(owner, 'finding3');
    pool = new pg.Pool({ connectionString: process.env['DATABASE_URL'], max: 4 });

    const child = await admin.query<{ id: string }>(
      `INSERT INTO persons (created_by_account_id) VALUES ($1) RETURNING id`,
      [owner.accountId]
    );
    childPersonId = child.rows[0]!.id;
    await admin.query(`INSERT INTO family_members (family_id, person_id) VALUES ($1,$2)`, [
      familyId,
      childPersonId,
    ]);

    // The database itself forbids an UNDER_14 profile without a consent
    // pointer (pcp_under14_requires_consent), so the loader can never observe a
    // pointer-less UNDER_14 profile. Start from one valid pointer and mutate it
    // per case.
    const seed = await insertConsent();
    await admin.query(
      `INSERT INTO person_compliance_profiles
         (person_id, age_band, minor_mode, guardian_person_id, guardian_consent_record_id,
          guardian_consent_version, verified_source)
       VALUES ($1,'UNDER_14',true,$2,$3,$4,'GUARDIAN_RELAY')`,
      [childPersonId, owner.personId, seed.id, seed.version]
    );
  }, 120_000);

  afterAll(async () => {
    if (familyId) {
      await admin
        .query(`DELETE FROM person_compliance_profiles WHERE person_id = $1`, [childPersonId])
        .catch(() => undefined);
      await admin
        .query(`DELETE FROM consent_records WHERE family_id = $1`, [familyId])
        .catch(() => undefined);
      await admin
        .query(`DELETE FROM guardian_consent_requests WHERE family_id = $1`, [familyId])
        .catch(() => undefined);
    }
    await fixture?.cleanup();
    await fixture?.close();
    await pool?.end().catch(() => undefined);
    await admin?.end().catch(() => undefined);
    await app?.close();
  }, 120_000);

  it('a current GRANTED consent with the exact profile pointer cannot authorize downstream processing', async () => {
    const consent = await insertConsent();
    await pointProfileAt(consent.id, consent.version);

    const person = await loadPerson();
    expect(person?.guardianConsentRecordId).toBe(consent.id);
    expect(person?.guardianConsentVersion).toBe(consent.version);

    const result = evaluateCompliance(snapshotOf(person));
    expect(result.gate).toBe('BLOCK');
    expect(result.reasonCode).toBe('COMPLIANCE_GUARDIAN_CONSENT_INVALID');
    expect(result.obligations).toContain('REQUIRE_GUARDIAN_CONSENT');
  }, 120_000);

  it.each([
    ['GUARDIAN_CONSENT_ADMINISTRATION', 'ALLOW'],
    ['FAMILY_ALLIANCE', 'BLOCK'],
    ['ASSESSMENT', 'BLOCK'],
    ['UNRECOGNIZED_CATEGORY', 'BLOCK'],
  ])('checks processing intent %s against a current persisted v1 grant', async (category, decision) => {
    const consent = await insertConsent();
    await pointProfileAt(consent.id, consent.version);
    const person = await loadPerson();
    expect(person?.guardianConsent?.id).toBe(consent.id);
    const result = assertMinorProcessingAllowed(childPersonId, category as MinorProcessingCategory, {
      getProfile: () => person,
      getConsentRecord: () => person?.guardianConsent ?? null,
      getCurrentNoticeHash,
      getCurrentNoticeVersion,
      getCurrentPolicyVersion: () => 'v1',
    });

    expect(result).toEqual(decision === 'ALLOW'
      ? { decision: 'ALLOW', minorMode: true }
      : { decision: 'BLOCK', reason: 'CONSENT_SCOPE_NOT_COVERED' });
  });

  it.each(['', 'v0'])('blocks downstream processing with persisted policy version %j', async (policyVersion) => {
    const consent = await insertConsent({ policyVersion });
    await pointProfileAt(consent.id, consent.version);
    const person = await loadPerson();
    expect(person?.guardianConsent?.policyVersion).toBe(policyVersion);
    expect(evaluateCompliance(snapshotOf(person))).toMatchObject({
      gate: 'BLOCK',
      reasonCode: 'COMPLIANCE_GUARDIAN_CONSENT_INVALID',
    });
  });

  it('wrong-purpose consent (supplemental assessment) never satisfies the guardian gate', async () => {
    const kase = await fixture.createCase(owner, 'finding3');
    const consent = await insertSupplementalConsent(kase.id);
    await pointProfileAt(consent.id, consent.version);

    const person = await loadPerson();
    // The loader projects the real purpose; the evaluator must reject it.
    expect(person?.guardianConsent?.purpose).toBe(
      'DIGITAL_USE_SUPPLEMENTAL_ASSESSMENT'
    );
    const result = evaluateCompliance(snapshotOf(person));
    expect(result.gate).toBe('BLOCK');
    expect(result.reasonCode).toBe('COMPLIANCE_GUARDIAN_CONSENT_INVALID');
  }, 120_000);

  it('malformed evidence fails closed', async () => {
    const consent = await insertConsent({
      evidence: { accepted: true, timestamp: '2026-01-01T00:00:00.000Z' },
    });
    await pointProfileAt(consent.id, consent.version);

    const person = await loadPerson();
    expect(person?.guardianConsent?.evidenceValid).toBe(false);
    const result = evaluateCompliance(snapshotOf(person));
    expect(result.gate).toBe('BLOCK');
    expect(result.reasonCode).toBe('COMPLIANCE_GUARDIAN_CONSENT_INVALID');
  }, 120_000);

  it('a superseded (non chain head) consent fails closed', async () => {
    const head = await insertConsent();
    const successor = await insertConsent({ supersedesId: head.id });
    // Point the profile at the historical row: its chain head is the successor.
    await pointProfileAt(head.id, head.version);

    const person = await loadPerson();
    expect(person?.guardianConsent?.id).toBe(head.id);
    expect(person?.guardianConsent?.isChainHead).toBe(false);
    expect(successor.version).toBeGreaterThan(head.version);
    const result = evaluateCompliance(snapshotOf(person));
    expect(result.gate).toBe('BLOCK');
    expect(result.reasonCode).toBe('COMPLIANCE_GUARDIAN_CONSENT_INVALID');
  }, 120_000);

  it('a profile consent version that is stale versus the row fails closed', async () => {
    const consent = await insertConsent();
    await pointProfileAt(consent.id, consent.version + 1);

    const person = await loadPerson();
    expect(person?.guardianConsentVersion).toBe(consent.version + 1);
    expect(person?.guardianConsent?.version).toBe(consent.version);
    const result = evaluateCompliance(snapshotOf(person));
    expect(result.gate).toBe('BLOCK');
    expect(result.reasonCode).toBe('COMPLIANCE_GUARDIAN_CONSENT_INVALID');
  }, 120_000);

  it('the schema itself forbids an UNDER_14 profile without a consent pointer', async () => {
    // The "no pointer" branch is unreachable from persisted truth: the
    // authoritative schema refuses to store it. The pure gate still fails
    // closed for such a snapshot (covered by the domain composition suite).
    await expect(
      admin.query(
        `UPDATE person_compliance_profiles
            SET guardian_consent_record_id = NULL, guardian_consent_version = NULL
          WHERE person_id = $1`,
        [childPersonId]
      )
    ).rejects.toThrow(/pcp_under14_requires_consent/);
  }, 120_000);

  it('a guardian identity mismatch fails closed', async () => {
    const otherGuardian = await admin.query<{ id: string }>(
      `INSERT INTO persons (created_by_account_id) VALUES ($1) RETURNING id`,
      [owner.accountId]
    );
    const otherGuardianId = otherGuardian.rows[0]!.id;
    await admin.query(`INSERT INTO family_members (family_id, person_id) VALUES ($1,$2)`, [
      familyId,
      otherGuardianId,
    ]);
    const consent = await insertConsent({ guardianPersonId: otherGuardianId });
    await pointProfileAt(consent.id, consent.version);

    const person = await loadPerson();
    const result = evaluateCompliance(snapshotOf(person));
    expect(result.gate).toBe('BLOCK');
  }, 120_000);

  it('a subject mismatch (consent bound to another child) fails closed', async () => {
    const otherChild = await admin.query<{ id: string }>(
      `INSERT INTO persons (created_by_account_id) VALUES ($1) RETURNING id`,
      [owner.accountId]
    );
    const otherChildId = otherChild.rows[0]!.id;
    await admin.query(`INSERT INTO family_members (family_id, person_id) VALUES ($1,$2)`, [
      familyId,
      otherChildId,
    ]);
    const consent = await insertConsent({ boundPersonId: otherChildId });
    await pointProfileAt(consent.id, consent.version);

    const person = await loadPerson();
    const result = evaluateCompliance(snapshotOf(person));
    expect(result.gate).toBe('BLOCK');
    expect(result.reasonCode).toBe('COMPLIANCE_GUARDIAN_CONSENT_INVALID');
  }, 120_000);

  it('a stale notice hash fails closed', async () => {
    const consent = await insertConsent({ noticeHash: 'a'.repeat(64) });
    await pointProfileAt(consent.id, consent.version);

    const person = await loadPerson();
    const result = evaluateCompliance(snapshotOf(person));
    expect(result.gate).toBe('BLOCK');
    expect(result.reasonCode).toBe('COMPLIANCE_GUARDIAN_CONSENT_INVALID');
  }, 120_000);

  it('a stale notice version label fails closed', async () => {
    const consent = await insertConsent({ noticeVersion: 'v0' });
    await pointProfileAt(consent.id, consent.version);

    const person = await loadPerson();
    const result = evaluateCompliance(snapshotOf(person));
    expect(result.gate).toBe('BLOCK');
    expect(result.reasonCode).toBe('COMPLIANCE_GUARDIAN_CONSENT_INVALID');
  }, 120_000);

  it('a consent recorded under another policy scope fails closed', async () => {
    const consent = await insertConsent({ policyVersion: 'v0' });
    await pointProfileAt(consent.id, consent.version);

    const person = await loadPerson();
    const result = evaluateCompliance(snapshotOf(person));
    expect(result.gate).toBe('BLOCK');
    expect(result.reasonCode).toBe('COMPLIANCE_GUARDIAN_CONSENT_INVALID');
  }, 120_000);

  it('a revoked consent fails closed', async () => {
    const consent = await insertConsent({ decision: 'REVOKED' });
    await pointProfileAt(consent.id, consent.version);

    const person = await loadPerson();
    const result = evaluateCompliance(snapshotOf(person));
    expect(result.gate).toBe('BLOCK');
    expect(result.reasonCode).toBe('COMPLIANCE_GUARDIAN_CONSENT_INVALID');
  }, 120_000);
});
