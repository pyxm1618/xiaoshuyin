/**
 * Slice 1 Consent Owner — 01004 narrow post-merge remediation.
 *
 * Database-level purpose-discriminated invariants for the ONE Consent truth.
 * These tests use the admin/superuser connection on purpose: they assert the
 * schema guards themselves, independently of the TypeScript owner seam.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from 'pg';

const ADMIN_URL = process.env['TEST_ADMIN_DATABASE_URL']!;

interface Scope {
  accountId: string;
  actorPersonId: string;
  familyId: string;
  caseId: string;
  secondCaseId: string;
}

interface SupplementalRowInput {
  scope: Scope;
  decision: 'GRANTED' | 'DECLINED' | 'REVOKED';
  version: number;
  supersedesId?: string | null;
  caseId?: string;
  actorPersonId?: string;
  actorAccountId?: string;
  decisionOverrideEvidence?: string;
  guardianPersonId?: string | null;
  guardianAccountId?: string | null;
}

function sha(char: string): string {
  return char.repeat(64);
}

function evidenceFor(scope: Scope, decision: string, caseId: string, actorPersonId: string) {
  return {
    evidence_kind: 'DIGITAL_USE_SUPPLEMENTAL_ASSESSMENT',
    purpose: 'DIGITAL_USE_SUPPLEMENTAL_ASSESSMENT',
    disclosure_reference: 'test-only-01004-disclosure-fixture',
    disclosure_version: 'v1',
    disclosure_hash: sha('a'),
    confirmation_statement_hash: sha('b'),
    decision,
    decision_actor_person_id: actorPersonId,
    case_id: caseId,
    decided_at: new Date().toISOString(),
    client_ip_hash: sha('c'),
    user_agent_hash: sha('d'),
  };
}

async function insertSupplemental(client: Client, input: SupplementalRowInput) {
  const caseId = input.caseId ?? input.scope.caseId;
  const actorPersonId = input.actorPersonId ?? input.scope.actorPersonId;
  const actorAccountId = input.actorAccountId ?? input.scope.accountId;
  const evidence = evidenceFor(input.scope, input.decision, caseId, actorPersonId);
  if (input.decisionOverrideEvidence !== undefined) {
    evidence.decision = input.decisionOverrideEvidence;
  }
  return client.query(
    `INSERT INTO consent_records (
       family_id, guardian_person_id, guardian_account_id, purpose, decision, version,
       onboarding_request_id, bound_person_id, bound_at,
       case_id, decision_actor_person_id, decision_actor_account_id,
       disclosure_reference, confirmation_statement_hash,
       notice_version, notice_hash, policy_version, evidence, decided_at, supersedes_id
     ) VALUES (
       $1, $2, $3, 'DIGITAL_USE_SUPPLEMENTAL_ASSESSMENT', $4, $5,
       NULL, NULL, NULL,
       $6, $7, $8,
       $9, $10,
       'v1', $11, 'v1', $12, now(), $13
     ) RETURNING id, decision, version, case_id, decision_actor_person_id, supersedes_id`,
    [
      input.scope.familyId,
      input.guardianPersonId ?? null,
      input.guardianAccountId ?? null,
      input.decision,
      input.version,
      caseId,
      actorPersonId,
      actorAccountId,
      evidence.disclosure_reference,
      evidence.confirmation_statement_hash,
      evidence.disclosure_hash,
      JSON.stringify(evidence),
      input.supersedesId ?? null,
    ]
  );
}

async function seedScope(client: Client, label: string): Promise<Scope> {
  const account = await client.query(
    `INSERT INTO accounts (wechat_openid) VALUES ($1) RETURNING id`,
    [`csa_${label}_${crypto.randomUUID()}`]
  );
  const accountId = account.rows[0].id;
  const person = await client.query(
    `INSERT INTO persons (account_id, created_by_account_id) VALUES ($1, $1) RETURNING id`,
    [accountId]
  );
  const actorPersonId = person.rows[0].id;
  const family = await client.query(
    `INSERT INTO families (created_by_person_id) VALUES ($1) RETURNING id`,
    [actorPersonId]
  );
  const familyId = family.rows[0].id;
  await client.query(`INSERT INTO family_members (family_id, person_id) VALUES ($1, $2)`, [
    familyId,
    actorPersonId,
  ]);
  const kase = await client.query(
    `INSERT INTO cases (family_id, created_by_person_id, status, phase, is_primary, version)
     VALUES ($1, $2, 'OPEN', 'INTAKE', false, 1) RETURNING id`,
    [familyId, actorPersonId]
  );
  const secondCase = await client.query(
    `INSERT INTO cases (family_id, created_by_person_id, status, phase, is_primary, version)
     VALUES ($1, $2, 'OPEN', 'INTAKE', false, 1) RETURNING id`,
    [familyId, actorPersonId]
  );
  return {
    accountId,
    actorPersonId,
    familyId,
    caseId: kase.rows[0].id,
    secondCaseId: secondCase.rows[0].id,
  };
}

async function insertGuardianConsent(
  client: Client,
  scope: Scope,
  decision: 'GRANTED' | 'DECLINED' | 'REVOKED',
  overrides: {
    guardianPersonId?: string | null;
    guardianAccountId?: string | null;
    version?: number;
    supersedesId?: string | null;
  } = {}
) {
  let requestId: string | null = null;
  if (decision === 'GRANTED') {
    const request = await client.query(
      `INSERT INTO guardian_consent_requests
         (family_id, guardian_person_id, declared_age_band, notice_version, notice_hash,
          status, expires_at, completed_at)
       VALUES ($1, $2, 'UNDER_14', 'v1', $3, 'GRANTED', now() + interval '24 hours', now())
       RETURNING id`,
      [scope.familyId, scope.actorPersonId, sha('a')]
    );
    requestId = request.rows[0].id;
  }
  return client.query(
    `INSERT INTO consent_records (
       family_id, guardian_person_id, guardian_account_id, purpose, decision, version,
       onboarding_request_id, notice_version, notice_hash, policy_version, evidence, supersedes_id
     ) VALUES ($1, $2, $3, 'UNDER_14_GUARDIAN_CONSENT', $4, $5, $6, 'v1', $7, 'v1', '{}', $8)
     RETURNING id, decision, version, supersedes_id`,
    [
      scope.familyId,
      overrides.guardianPersonId === undefined ? scope.actorPersonId : overrides.guardianPersonId,
      overrides.guardianAccountId === undefined ? scope.accountId : overrides.guardianAccountId,
      decision,
      overrides.version ?? 1,
      requestId,
      sha('a'),
      overrides.supersedesId ?? null,
    ]
  );
}

async function currentSupplementalRows(client: Client, scope: Scope) {
  const { rows } = await client.query(
    `SELECT c.id, c.decision, c.version
       FROM consent_records c
      WHERE c.family_id = $1
        AND c.case_id = $2
        AND c.purpose = 'DIGITAL_USE_SUPPLEMENTAL_ASSESSMENT'
        AND c.decision_actor_person_id = $3
        AND NOT EXISTS (
          SELECT 1
            FROM consent_records s
           WHERE s.supersedes_id = c.id
             AND s.purpose = c.purpose
             AND s.family_id = c.family_id
             AND s.case_id = c.case_id
             AND s.decision_actor_person_id = c.decision_actor_person_id
        )`,
    [scope.familyId, scope.caseId, scope.actorPersonId]
  );
  return rows;
}

describe('Consent Owner — 01004 supplemental schema invariants', () => {
  let admin: Client;

  beforeAll(async () => {
    admin = new Client({ connectionString: ADMIN_URL });
    await admin.connect();
  });

  afterAll(async () => {
    await admin.end();
  });

  it('supplemental GRANTED v1 is legal without any guardian / onboarding facts', async () => {
    const scope = await seedScope(admin, 'grant');
    const { rows } = await insertSupplemental(admin, {
      scope,
      decision: 'GRANTED',
      version: 1,
    });
    expect(rows[0]).toMatchObject({
      decision: 'GRANTED',
      version: 1,
      case_id: scope.caseId,
      decision_actor_person_id: scope.actorPersonId,
      supersedes_id: null,
    });

    const stored = await admin.query(
      `SELECT guardian_person_id, guardian_account_id, onboarding_request_id,
              bound_person_id, bound_at
         FROM consent_records WHERE id = $1`,
      [rows[0].id]
    );
    expect(stored.rows[0]).toEqual({
      guardian_person_id: null,
      guardian_account_id: null,
      onboarding_request_id: null,
      bound_person_id: null,
      bound_at: null,
    });
  });

  it('supplemental first DECLINED is legal (and is not REVOKED)', async () => {
    const scope = await seedScope(admin, 'decline');
    const { rows } = await insertSupplemental(admin, {
      scope,
      decision: 'DECLINED',
      version: 1,
    });
    expect(rows[0].decision).toBe('DECLINED');
    const history = await admin.query(
      `SELECT decision FROM consent_records WHERE case_id = $1 AND purpose = 'DIGITAL_USE_SUPPLEMENTAL_ASSESSMENT'`,
      [scope.caseId]
    );
    expect(history.rows.map((r: any) => r.decision)).toEqual(['DECLINED']);
  });

  it('supplemental first REVOKED is rejected', async () => {
    const scope = await seedScope(admin, 'revoke-first');
    await expect(
      insertSupplemental(admin, { scope, decision: 'REVOKED', version: 1 })
    ).rejects.toThrow(/CONSENT_SUPPLEMENTAL_REVOKE_WITHOUT_GRANT/);
  });

  it('UNDER_14_GUARDIAN_CONSENT + DECLINED is rejected at database level', async () => {
    const scope = await seedScope(admin, 'guardian-declined');
    await expect(insertGuardianConsent(admin, scope, 'DECLINED')).rejects.toThrow();
  });

  it('guardian rows still require guardian person/account and onboarding binding', async () => {
    const scope = await seedScope(admin, 'guardian-fields');
    await expect(
      insertGuardianConsent(admin, scope, 'GRANTED', { guardianPersonId: null })
    ).rejects.toThrow();
    await expect(
      insertGuardianConsent(admin, scope, 'GRANTED', { guardianAccountId: null })
    ).rejects.toThrow();
  });

  it('supplemental rows may never fabricate guardian facts', async () => {
    const scope = await seedScope(admin, 'fake-guardian');
    await expect(
      insertSupplemental(admin, {
        scope,
        decision: 'GRANTED',
        version: 1,
        guardianPersonId: scope.actorPersonId,
        guardianAccountId: scope.accountId,
      })
    ).rejects.toThrow();
  });

  it('supplemental DECLINED → GRANTED appends v2 and supersedes v1', async () => {
    const scope = await seedScope(admin, 'decline-grant');
    const v1 = await insertSupplemental(admin, { scope, decision: 'DECLINED', version: 1 });
    const v2 = await insertSupplemental(admin, {
      scope,
      decision: 'GRANTED',
      version: 2,
      supersedesId: v1.rows[0].id,
    });
    expect(v2.rows[0]).toMatchObject({ decision: 'GRANTED', version: 2 });
    expect(v2.rows[0].supersedes_id).toBe(v1.rows[0].id);

    const rows = await admin.query(
      `SELECT version, decision, supersedes_id FROM consent_records
        WHERE case_id = $1 AND purpose = 'DIGITAL_USE_SUPPLEMENTAL_ASSESSMENT'
        ORDER BY version`,
      [scope.caseId]
    );
    expect(rows.rows).toHaveLength(2);
  });

  it('supplemental GRANTED → REVOKED appends v2', async () => {
    const scope = await seedScope(admin, 'grant-revoke');
    const v1 = await insertSupplemental(admin, { scope, decision: 'GRANTED', version: 1 });
    const v2 = await insertSupplemental(admin, {
      scope,
      decision: 'REVOKED',
      version: 2,
      supersedesId: v1.rows[0].id,
    });
    expect(v2.rows[0].decision).toBe('REVOKED');
  });

  it('DECLINED after a current truth is rejected (never silently becomes REVOKED)', async () => {
    const scope = await seedScope(admin, 'grant-decline');
    const v1 = await insertSupplemental(admin, { scope, decision: 'GRANTED', version: 1 });
    await expect(
      insertSupplemental(admin, {
        scope,
        decision: 'DECLINED',
        version: 2,
        supersedesId: v1.rows[0].id,
      })
    ).rejects.toThrow(/CONSENT_SUPPLEMENTAL_DECLINE_AFTER_CURRENT/);
  });

  it('guardian → supplemental cross-purpose supersession is rejected and current truth survives', async () => {
    const scope = await seedScope(admin, 'cross-purpose-guardian-over-supplemental');
    const supplemental = await insertSupplemental(admin, {
      scope,
      decision: 'GRANTED',
      version: 1,
    });
    const supplementalId = supplemental.rows[0].id;

    await expect(
      insertGuardianConsent(admin, scope, 'GRANTED', {
        version: 2,
        supersedesId: supplementalId,
      })
    ).rejects.toThrow(/CONSENT_SUPERSEDE_CROSS_PURPOSE/);

    // Mechanical read-back: the legal supplemental row is still current truth.
    expect(await currentSupplementalRows(admin, scope)).toEqual([
      { id: supplementalId, decision: 'GRANTED', version: 1 },
    ]);
    const counts = await admin.query(
      `SELECT count(*)::int AS c FROM consent_records WHERE family_id = $1`,
      [scope.familyId]
    );
    expect(counts.rows[0].c).toBe(1);
  });

  it('supplemental → guardian cross-purpose supersession is rejected without residue', async () => {
    const scope = await seedScope(admin, 'cross-purpose-supplemental-over-guardian');
    const guardian = await insertGuardianConsent(admin, scope, 'GRANTED');
    const guardianId = guardian.rows[0].id;

    await expect(
      insertSupplemental(admin, {
        scope,
        decision: 'REVOKED',
        version: 2,
        supersedesId: guardianId,
      })
    ).rejects.toThrow(
      /CONSENT_(SUPERSEDE_CROSS_PURPOSE|SUPPLEMENTAL_SUPERSEDE_SCOPE_MISMATCH)/
    );

    const guardianRow = await admin.query(
      `SELECT id, purpose, decision, version FROM consent_records WHERE id = $1`,
      [guardianId]
    );
    expect(guardianRow.rows[0]).toMatchObject({
      purpose: 'UNDER_14_GUARDIAN_CONSENT',
      decision: 'GRANTED',
      version: 1,
    });
    const supplementalCount = await admin.query(
      `SELECT count(*)::int AS c FROM consent_records
        WHERE family_id = $1 AND purpose = 'DIGITAL_USE_SUPPLEMENTAL_ASSESSMENT'`,
      [scope.familyId]
    );
    expect(supplementalCount.rows[0].c).toBe(0);
  });

  it('guardian → guardian same-purpose supersession remains legal', async () => {
    const scope = await seedScope(admin, 'guardian-same-purpose');
    const v1 = await insertGuardianConsent(admin, scope, 'GRANTED');
    const v2 = await insertGuardianConsent(admin, scope, 'REVOKED', {
      version: 2,
      supersedesId: v1.rows[0].id,
    });
    expect(v2.rows[0]).toMatchObject({
      decision: 'REVOKED',
      version: 2,
      supersedes_id: v1.rows[0].id,
    });

    const rows = await admin.query(
      `SELECT version, decision FROM consent_records
        WHERE family_id = $1 AND purpose = 'UNDER_14_GUARDIAN_CONSENT'
        ORDER BY version`,
      [scope.familyId]
    );
    expect(rows.rows).toEqual([
      { version: 1, decision: 'GRANTED' },
      { version: 2, decision: 'REVOKED' },
    ]);
  });

  it('supersession across Case scope is rejected', async () => {
    const scope = await seedScope(admin, 'cross-case');
    const v1 = await insertSupplemental(admin, { scope, decision: 'GRANTED', version: 1 });
    await expect(
      insertSupplemental(admin, {
        scope,
        decision: 'REVOKED',
        version: 2,
        caseId: scope.secondCaseId,
        supersedesId: v1.rows[0].id,
      })
    ).rejects.toThrow(/CONSENT_SUPPLEMENTAL_SUPERSEDE_SCOPE_MISMATCH/);
  });

  it('a superseded node cannot be superseded twice', async () => {
    const scope = await seedScope(admin, 'double-supersede');
    const v1 = await insertSupplemental(admin, { scope, decision: 'DECLINED', version: 1 });
    await insertSupplemental(admin, {
      scope,
      decision: 'GRANTED',
      version: 2,
      supersedesId: v1.rows[0].id,
    });
    await expect(
      insertSupplemental(admin, {
        scope,
        decision: 'REVOKED',
        version: 3,
        supersedesId: v1.rows[0].id,
      })
    ).rejects.toThrow();
  });

  it('duplicate version inside one logical scope is rejected', async () => {
    const scope = await seedScope(admin, 'duplicate-version');
    await insertSupplemental(admin, { scope, decision: 'GRANTED', version: 1 });
    await expect(
      insertSupplemental(admin, { scope, decision: 'GRANTED', version: 1 })
    ).rejects.toThrow();
  });

  it('actor/subject identity must match a real person/account in the Family', async () => {
    const scope = await seedScope(admin, 'actor-invalid');
    await expect(
      insertSupplemental(admin, {
        scope,
        decision: 'GRANTED',
        version: 1,
        actorPersonId: crypto.randomUUID(),
      })
    ).rejects.toThrow();
  });

  it('evidence must be the purpose-discriminated shape and agree with the columns', async () => {
    const scope = await seedScope(admin, 'evidence-shape');
    await expect(
      insertSupplemental(admin, {
        scope,
        decision: 'GRANTED',
        version: 1,
        decisionOverrideEvidence: 'DECLINED',
      })
    ).rejects.toThrow();
  });

  it('supplemental decisions are append-only (UPDATE is rejected)', async () => {
    const scope = await seedScope(admin, 'immutable');
    const inserted = await insertSupplemental(admin, {
      scope,
      decision: 'GRANTED',
      version: 1,
    });
    await expect(
      admin.query(`UPDATE consent_records SET decision = 'REVOKED' WHERE id = $1`, [
        inserted.rows[0].id,
      ])
    ).rejects.toThrow();
  });

  it('three supplemental audit event types are accepted; unknown types are not', async () => {
    const scope = await seedScope(admin, 'audit-vocab');
    for (const eventType of [
      'CONSENT_SUPPLEMENTAL_ASSESSMENT_GRANTED',
      'CONSENT_SUPPLEMENTAL_ASSESSMENT_DECLINED',
      'CONSENT_SUPPLEMENTAL_ASSESSMENT_REVOKED',
    ]) {
      await admin.query(
        `INSERT INTO business_audit_events
           (family_id, actor_account_id, event_type, resource_type, resource_id)
         VALUES ($1, $2, $3, 'CONSENT', $4)`,
        [scope.familyId, scope.accountId, eventType, crypto.randomUUID()]
      );
    }
    await expect(
      admin.query(
        `INSERT INTO business_audit_events
           (family_id, actor_account_id, event_type, resource_type, resource_id)
         VALUES ($1, $2, 'CONSENT_SUPPLEMENTAL_ASSESSMENT_UNKNOWN', 'CONSENT', $3)`,
        [scope.familyId, scope.accountId, crypto.randomUUID()]
      )
    ).rejects.toThrow();
  });
});