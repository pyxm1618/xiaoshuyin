/**
 * Slice 1 Consent Owner — 01004 narrow post-merge remediation.
 *
 * Integration proof for the ONE internal owner seam inside a caller-owned
 * transaction:
 *   - GRANTED / DECLINED / REVOKED semantics and version chain
 *   - actor == subject + client subject input forbidden
 *   - Family + Case + purpose scope isolation
 *   - approved-disclosure fail closed (no 01004 disclosure authority exists)
 *   - replay / stale version / concurrency
 *   - caller rollback leaves no residue
 *   - audit vocabulary + privacy + public surface non-expansion
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../apps/server/api/src/app.js';
import { withRlsTransaction } from '../../apps/server/api/src/db/tx.js';
import { createAdminPool } from '../setup/db.js';
import { createAppPool } from '../setup/identity-binding.js';
import {
  auth,
  commandHeaders,
  createFamily,
  createMember,
  loginWithLabel,
  memberPayload,
  type LoginResult,
} from '../setup/api.js';
import { createCase } from '../setup/participation.js';
import {
  DIGITAL_USE_SUPPLEMENTAL_ASSESSMENT,
  PurposeScopedConsentError,
  recordPurposeScopedConsentDecision,
  type RecordPurposeScopedConsentDecisionInput,
  type SupplementalAssessmentDisclosureAuthority,
} from '../../packages/compliance/src/supplemental-consent.js';
import {
  APPROVED_SUPPLEMENTAL_ASSESSMENT_DISCLOSURE_AUTHORITY,
  CURRENT_SUPPLEMENTAL_ASSESSMENT_DISCLOSURE,
} from '../../packages/compliance/src/supplemental-assessment-disclosure.js';
import { getConsentRecordForGate, getConsentsByFamily, getValidConsentForBinding } from '../../packages/compliance/src/repository.js';
import { getCurrentNoticeHash, getCurrentNoticeVersion } from '../../packages/compliance/src/notices.js';

const ADMIN_URL = process.env['TEST_ADMIN_DATABASE_URL']!;
const PEPPER = process.env['EVIDENCE_HASH_PEPPER'] ?? 'test-evidence-hash-pepper-fixture';

const sha = (char: string) => char.repeat(64);

// Test-only approved disclosure identity. It is NOT product disclosure content:
// it exists only to prove the owner capability when an authority is supplied.
const TEST_DISCLOSURE = {
  reference: 'test-only-01004-disclosure-fixture',
  version: 'v1',
  hash: sha('a'),
} as const;

/**
 * A second approved identity with the SAME version and hash but a DIFFERENT
 * reference. It exists only to prove that replay equality includes the exact
 * disclosure reference, not just the version/hash pair.
 */
const TEST_DISCLOSURE_B = {
  reference: 'test-only-01004-disclosure-fixture-b',
  version: 'v1',
  hash: sha('a'),
} as const;

const TEST_CONFIRMATION_HASH = sha('b');

const TEST_DISCLOSURE_AUTHORITY: SupplementalAssessmentDisclosureAuthority = {
  resolveApprovedDisclosure(submitted) {
    for (const approved of [TEST_DISCLOSURE, TEST_DISCLOSURE_B]) {
      if (
        submitted.purpose === DIGITAL_USE_SUPPLEMENTAL_ASSESSMENT &&
        submitted.reference === approved.reference &&
        submitted.version === approved.version &&
        submitted.hash === approved.hash
      ) {
        return {
          purpose: DIGITAL_USE_SUPPLEMENTAL_ASSESSMENT,
          reference: approved.reference,
          version: approved.version,
          hash: approved.hash,
        };
      }
    }
    return null;
  },
};

interface Scope {
  manager: LoginResult;
  familyId: string;
  caseId: string;
}

function inputFor(
  scope: Scope,
  overrides: Partial<RecordPurposeScopedConsentDecisionInput> = {}
): RecordPurposeScopedConsentDecisionInput {
  return {
    familyId: scope.familyId,
    caseId: scope.caseId,
    actor: { accountId: scope.manager.accountId, personId: scope.manager.personId },
    purpose: DIGITAL_USE_SUPPLEMENTAL_ASSESSMENT,
    decision: 'GRANTED',
    expectedVersion: null,
    disclosure: { ...TEST_DISCLOSURE },
    confirmationStatementHash: TEST_CONFIRMATION_HASH,
    sceneAuthorization: { nodeCode: '01004', verified: true },
    evidence: { clientIp: '203.0.113.7', userAgent: 'raw-agent-fixture/1.0', pepper: PEPPER },
    ...overrides,
  };
}

async function expectCode(promise: Promise<unknown>, code: string): Promise<void> {
  await expect(promise).rejects.toSatisfy((error: unknown) => {
    return error instanceof PurposeScopedConsentError && error.code === code;
  });
}

describe('Consent owner — 01004 supplemental assessment owner seam', () => {
  let app: FastifyInstance;
  let appPool: pg.Pool;
  let admin: pg.Pool;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
    appPool = createAppPool(6);
    admin = createAdminPool();
  });

  afterAll(async () => {
    await admin.end();
    await appPool.end();
    await app.close();
  });

  async function newScope(label: string): Promise<Scope> {
    const manager = await loginWithLabel(app, `co-${label}`);
    const family = await createFamily(app, manager.token, `co-${label}`);
    if (family.statusCode !== 201) throw new Error(`family create failed: ${family.body}`);
    const familyId = family.json().id as string;
    const kase = await createCase(app, manager.token, `co-${label}`);
    if (kase.statusCode !== 201) throw new Error(`case create failed: ${kase.body}`);
    return { manager, familyId, caseId: kase.json().id as string };
  }

  function record(
    scope: Scope,
    input: RecordPurposeScopedConsentDecisionInput,
    authority: SupplementalAssessmentDisclosureAuthority = TEST_DISCLOSURE_AUTHORITY
  ) {
    return withRlsTransaction(
      appPool,
      {
        familyId: scope.familyId,
        accountId: scope.manager.accountId,
        personId: scope.manager.personId,
        purpose: 'DIGITAL_USE_ASSESSMENT',
      },
      (tx) => recordPurposeScopedConsentDecision(tx, input, authority)
    );
  }

  function recordWithDefaultAuthority(
    scope: Scope,
    input: RecordPurposeScopedConsentDecisionInput
  ) {
    return withRlsTransaction(
      appPool,
      {
        familyId: scope.familyId,
        accountId: scope.manager.accountId,
        personId: scope.manager.personId,
        purpose: 'DIGITAL_USE_ASSESSMENT',
      },
      (tx) => recordPurposeScopedConsentDecision(tx, input)
    );
  }

  async function supplementalRows(scope: Scope) {
    const { rows } = await admin.query(
      `SELECT id, decision, version, case_id, decision_actor_person_id,
              supersedes_id, disclosure_reference, notice_version, notice_hash,
              confirmation_statement_hash, evidence
         FROM consent_records
        WHERE family_id = $1 AND purpose = 'DIGITAL_USE_SUPPLEMENTAL_ASSESSMENT'
        ORDER BY decided_at, version`,
      [scope.familyId]
    );
    return rows;
  }

  async function currentRows(scope: Scope) {
    const rows = await supplementalRows(scope);
    const superseded = new Set(rows.map((r: any) => r.supersedes_id).filter(Boolean));
    return rows.filter((r: any) => !superseded.has(r.id));
  }

  async function supplementalAudit(scope: Scope) {
    const { rows } = await admin.query(
      `SELECT event_type, resource_id
         FROM business_audit_events
        WHERE family_id = $1 AND event_type LIKE 'CONSENT_SUPPLEMENTAL_ASSESSMENT_%'
        ORDER BY occurred_at, event_type`,
      [scope.familyId]
    );
    return rows;
  }

  it('records a first GRANTED as version 1 current truth + audit', async () => {
    const scope = await newScope('grant');
    const result = await record(scope, inputFor(scope));

    expect(result).toMatchObject({
      purpose: DIGITAL_USE_SUPPLEMENTAL_ASSESSMENT,
      caseId: scope.caseId,
      decisionActorPersonId: scope.manager.personId,
      decision: 'GRANTED',
      version: 1,
      supersedesId: null,
      replayed: false,
    });

    const stored = await admin.query(
      `SELECT guardian_person_id, guardian_account_id, onboarding_request_id,
              bound_person_id, bound_at, decision_actor_account_id
         FROM consent_records WHERE id = $1`,
      [result.consentRecordId]
    );
    expect(stored.rows[0]).toEqual({
      guardian_person_id: null,
      guardian_account_id: null,
      onboarding_request_id: null,
      bound_person_id: null,
      bound_at: null,
      decision_actor_account_id: scope.manager.accountId,
    });

    const audit = await supplementalAudit(scope);
    expect(audit).toEqual([
      {
        event_type: 'CONSENT_SUPPLEMENTAL_ASSESSMENT_GRANTED',
        resource_id: result.consentRecordId,
      },
    ]);
  });

  it('records a first explicit refusal as DECLINED, never REVOKED', async () => {
    const scope = await newScope('declined');
    const result = await record(scope, inputFor(scope, { decision: 'DECLINED' }));
    expect(result.decision).toBe('DECLINED');
    expect(result.version).toBe(1);

    const rows = await supplementalRows(scope);
    expect(rows.map((r: any) => r.decision)).toEqual(['DECLINED']);
  });

  it('rejects REVOKED when no prior GRANTED exists', async () => {
    const scope = await newScope('revoke-first');
    await expectCode(
      record(scope, inputFor(scope, { decision: 'REVOKED' })),
      'CONSENT_DECISION_CONFLICT'
    );
    expect(await supplementalRows(scope)).toHaveLength(0);
    expect(await supplementalAudit(scope)).toHaveLength(0);
  });

  it('DECLINED v1 → GRANTED v2 supersedes the refused version', async () => {
    const scope = await newScope('decline-grant');
    const v1 = await record(scope, inputFor(scope, { decision: 'DECLINED' }));
    const v2 = await record(
      scope,
      inputFor(scope, { decision: 'GRANTED', expectedVersion: v1.version })
    );
    expect(v2).toMatchObject({ decision: 'GRANTED', version: 2, supersedesId: v1.consentRecordId });

    const history = await supplementalRows(scope);
    expect(history.map((r: any) => [r.version, r.decision, r.supersedes_id])).toEqual([
      [1, 'DECLINED', null],
      [2, 'GRANTED', v1.consentRecordId],
    ]);
  });

  it('GRANTED v1 → REVOKED v2 supersedes the granted version', async () => {
    const scope = await newScope('grant-revoke');
    const v1 = await record(scope, inputFor(scope));
    const v2 = await record(
      scope,
      inputFor(scope, { decision: 'REVOKED', expectedVersion: v1.version })
    );
    expect(v2).toMatchObject({ decision: 'REVOKED', version: 2, supersedesId: v1.consentRecordId });

    const current = await currentRows(scope);
    expect(current).toHaveLength(1);
    expect(current[0].decision).toBe('REVOKED');
  });

  it('rejects a non-revocation refusal after GRANTED and never rewrites it', async () => {
    const scope = await newScope('grant-decline');
    const v1 = await record(scope, inputFor(scope));
    await expectCode(
      record(scope, inputFor(scope, { decision: 'DECLINED', expectedVersion: v1.version })),
      'CONSENT_DECISION_CONFLICT'
    );

    const history = await supplementalRows(scope);
    expect(history).toHaveLength(1);
    expect(history[0].decision).toBe('GRANTED');
    expect((await supplementalAudit(scope)).map((e: any) => e.event_type)).toEqual([
      'CONSENT_SUPPLEMENTAL_ASSESSMENT_GRANTED',
    ]);
  });

  it('same semantic replay is a no-op (no duplicate row / audit)', async () => {
    const scope = await newScope('replay');
    const v1 = await record(scope, inputFor(scope));
    const replay = await record(scope, inputFor(scope, { expectedVersion: v1.version }));
    expect(replay).toMatchObject({
      consentRecordId: v1.consentRecordId,
      version: v1.version,
      replayed: true,
    });
    const rows = await supplementalRows(scope);
    expect(rows).toHaveLength(1);
    expect(rows[0].disclosure_reference).toBe(TEST_DISCLOSURE.reference);
    expect(await supplementalAudit(scope)).toHaveLength(1);
  });

  it('same version/hash but a different approved disclosure reference is NOT a replay', async () => {
    const scope = await newScope('replay-reference-mismatch');
    const v1 = await record(scope, inputFor(scope));

    await expectCode(
      record(
        scope,
        inputFor(scope, {
          expectedVersion: v1.version,
          disclosure: { ...TEST_DISCLOSURE_B },
        })
      ),
      'CONSENT_DECISION_CONFLICT'
    );

    const rows = await supplementalRows(scope);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: v1.consentRecordId,
      decision: 'GRANTED',
      version: v1.version,
      disclosure_reference: TEST_DISCLOSURE.reference,
    });
    expect(await supplementalAudit(scope)).toHaveLength(1);
  });

  it('same decision with a different semantic payload is a conflict', async () => {
    const scope = await newScope('replay-mismatch');
    const v1 = await record(scope, inputFor(scope));
    await expectCode(
      record(
        scope,
        inputFor(scope, { expectedVersion: v1.version, confirmationStatementHash: sha('e') })
      ),
      'CONSENT_DECISION_CONFLICT'
    );
    expect(await supplementalRows(scope)).toHaveLength(1);
  });

  it('stale expected version fails closed without touching history', async () => {
    const scope = await newScope('stale');
    const v1 = await record(scope, inputFor(scope));
    await expectCode(
      record(scope, inputFor(scope, { decision: 'REVOKED', expectedVersion: v1.version + 3 })),
      'CONSENT_STALE_VERSION'
    );
    expect(await supplementalRows(scope)).toHaveLength(1);
  });

  it('Case isolation: a decision in Case A neither satisfies nor supersedes Case B', async () => {
    const scope = await newScope('case-isolation');
    const caseB = await createCase(app, scope.manager.token, 'case-isolation-b');
    const caseBId = caseB.json().id as string;

    const a = await record(scope, inputFor(scope));
    const b = await record(scope, inputFor(scope, { caseId: caseBId }));
    expect(b.version).toBe(1);
    expect(b.supersedesId).toBeNull();

    const rows = await supplementalRows(scope);
    expect(rows.map((r: any) => [r.case_id, r.version, r.supersedes_id])).toEqual([
      [scope.caseId, 1, null],
      [caseBId, 1, null],
    ]);

    // Case B never becomes satisfied by Case A's expected version.
    await expectCode(
      record(scope, inputFor(scope, { caseId: caseBId, expectedVersion: 2 })),
      'CONSENT_STALE_VERSION'
    );
  });

  it('actor isolation: another authorized actor forms its own scope (actor == subject)', async () => {
    const scope = await newScope('actor-isolation');
    const second = await loginWithLabel(app, 'co-second-actor');
    await admin.query(
      `INSERT INTO person_compliance_profiles
         (person_id, age_band, minor_mode, verified_source)
       VALUES ($1, 'ADULT', false, 'SELF_STATEMENT')
       ON CONFLICT (person_id) DO NOTHING`,
      [second.personId]
    );
    await admin.query(
      `INSERT INTO family_members (family_id, person_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [scope.familyId, second.personId]
    );

    const p1 = await record(scope, inputFor(scope));
    const p2 = await record(
      scope,
      inputFor(scope, { actor: { accountId: second.accountId, personId: second.personId } })
    );
    expect(p2.version).toBe(1);
    expect(p2.supersedesId).toBeNull();

    const current = await currentRows(scope);
    expect(current).toHaveLength(2);
    expect(current.map((r: any) => r.decision_actor_person_id).sort()).toEqual(
      [scope.manager.personId, second.personId].sort()
    );
    expect((await supplementalRows(scope)).find((r: any) => r.id === p1.consentRecordId))
      .toBeDefined();
  });

  it('client-supplied subject identity is rejected with zero writes', async () => {
    const scope = await newScope('client-subject');
    await expectCode(
      record(
        scope,
        inputFor(scope, {
        // Deliberately smuggled through a non-typed request shape.
          subjectPersonId: crypto.randomUUID(),
        } as unknown as Partial<RecordPurposeScopedConsentDecisionInput>)
      ),
      'CONSENT_INPUT_INVALID'
    );
    expect(await supplementalRows(scope)).toHaveLength(0);
  });

  it('another Person cannot be substituted as actor/subject', async () => {
    const scope = await newScope('actor-substitution');
    const member = await createMember(
      app,
      scope.manager.token,
      scope.familyId,
      'actor-substitution',
      memberPayload('ADULT', 'SELF_STATEMENT')
    );
    expect(member.statusCode).toBe(201);
    const otherPersonId = member.json().personId as string;

    await expectCode(
      record(
        scope,
        inputFor(scope, {
          actor: { accountId: scope.manager.accountId, personId: otherPersonId },
        })
      ),
      'CONSENT_ACTOR_SUBJECT_INVALID'
    );
    expect(await supplementalRows(scope)).toHaveLength(0);
  });

  it('missing verified 01004 Scene/Assessment authorization fails closed', async () => {
    const scope = await newScope('no-scene-auth');
    await expectCode(
      record(
        scope,
        inputFor(scope, { sceneAuthorization: { nodeCode: '01004', verified: false } as never })
      ),
      'CONSENT_AUTHORIZATION_CONTEXT_MISSING'
    );
    expect(await supplementalRows(scope)).toHaveLength(0);
  });

  it('empty pepper fails closed before any owner-seam database read/write', async () => {
    const scope = await newScope('pepper-empty');
    const base = inputFor(scope);
    const bad = { ...base, evidence: { ...base.evidence, pepper: '' } };

    // The authoritative client is deliberately absent: if pepper validation
    // touched the database first, this would fail with a non-domain error.
    await expectCode(
      recordPurposeScopedConsentDecision(null as never, bad),
      'CONSENT_EVIDENCE_PEPPER_INVALID'
    );

    await expectCode(record(scope, bad), 'CONSENT_EVIDENCE_PEPPER_INVALID');
    expect(await supplementalRows(scope)).toHaveLength(0);
    expect(await supplementalAudit(scope)).toHaveLength(0);
  });

  it('missing pepper fails closed with zero consent / audit residue', async () => {
    const scope = await newScope('pepper-missing');
    const base = inputFor(scope);
    const bad = {
      ...base,
      evidence: { ...base.evidence, pepper: undefined as unknown as string },
    };
    await expectCode(record(scope, bad), 'CONSENT_EVIDENCE_PEPPER_INVALID');
    expect(await supplementalRows(scope)).toHaveLength(0);
    expect(await supplementalAudit(scope)).toHaveLength(0);
  });

  it('15-character pepper fails closed with zero consent / audit residue', async () => {
    const scope = await newScope('pepper-short');
    const base = inputFor(scope);
    const bad = {
      ...base,
      evidence: { ...base.evidence, pepper: 'x'.repeat(15) },
    };
    await expectCode(record(scope, bad), 'CONSENT_EVIDENCE_PEPPER_INVALID');
    expect(await supplementalRows(scope)).toHaveLength(0);
    expect(await supplementalAudit(scope)).toHaveLength(0);
  });

  it('exactly 16-character pepper passes validation and records normally', async () => {
    const scope = await newScope('pepper-minimum');
    const base = inputFor(scope);
    const minimumPepper = 'x'.repeat(16);
    const result = await record(scope, {
      ...base,
      evidence: { ...base.evidence, pepper: minimumPepper },
    });
    expect(result).toMatchObject({ decision: 'GRANTED', version: 1, replayed: false });

    const rows = await supplementalRows(scope);
    expect(rows).toHaveLength(1);
    expect(JSON.stringify(rows[0].evidence)).not.toContain(minimumPepper);
    expect(await supplementalAudit(scope)).toHaveLength(1);
  });

  it('Case from another Family fails closed', async () => {
    const scope = await newScope('foreign-case');
    const otherScope = await newScope('foreign-case-other');
    await expectCode(
      record(scope, inputFor(scope, { caseId: otherScope.caseId })),
      'CONSENT_SCOPE_UNAVAILABLE'
    );
    expect(await supplementalRows(scope)).toHaveLength(0);
  });

  it('production 01004 authority lets the owner record the exact approved disclosure', async () => {
    const scope = await newScope('production-disclosure-grant');
    const disclosure = CURRENT_SUPPLEMENTAL_ASSESSMENT_DISCLOSURE;
    const result = await record(
      scope,
      inputFor(scope, {
        disclosure: {
          reference: disclosure.reference,
          version: disclosure.version,
          hash: disclosure.hash,
        },
      }),
      APPROVED_SUPPLEMENTAL_ASSESSMENT_DISCLOSURE_AUTHORITY
    );

    expect(result).toMatchObject({ decision: 'GRANTED', version: 1, replayed: false });
    const rows = await supplementalRows(scope);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      disclosure_reference: disclosure.reference,
      notice_version: disclosure.version,
      notice_hash: disclosure.hash,
    });
  });

  it('production 01004 authority rejects an unknown disclosure identity', async () => {
    const scope = await newScope('production-disclosure-unknown');
    const disclosure = CURRENT_SUPPLEMENTAL_ASSESSMENT_DISCLOSURE;
    await expectCode(
      record(
        scope,
        inputFor(scope, {
          disclosure: {
            reference: disclosure.reference,
            version: 'v999',
            hash: disclosure.hash,
          },
        }),
        APPROVED_SUPPLEMENTAL_ASSESSMENT_DISCLOSURE_AUTHORITY
      ),
      'CONSENT_DISCLOSURE_NOT_APPROVED'
    );
    expect(await supplementalRows(scope)).toHaveLength(0);
  });

  it('DECLINED records the same exact approved disclosure identity shown to the user', async () => {
    const scope = await newScope('production-disclosure-declined');
    const disclosure = CURRENT_SUPPLEMENTAL_ASSESSMENT_DISCLOSURE;
    const result = await record(
      scope,
      inputFor(scope, {
        decision: 'DECLINED',
        disclosure: {
          reference: disclosure.reference,
          version: disclosure.version,
          hash: disclosure.hash,
        },
      }),
      APPROVED_SUPPLEMENTAL_ASSESSMENT_DISCLOSURE_AUTHORITY
    );

    expect(result.decision).toBe('DECLINED');
    const rows = await supplementalRows(scope);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      decision: 'DECLINED',
      disclosure_reference: disclosure.reference,
      notice_version: disclosure.version,
      notice_hash: disclosure.hash,
    });
  });

  it('caller-authored disclosureText / noticeBody are rejected even with approved identity', async () => {
    const scope = await newScope('production-disclosure-caller-text');
    const disclosure = CURRENT_SUPPLEMENTAL_ASSESSMENT_DISCLOSURE;
    const base = inputFor(scope, {
      disclosure: {
        reference: disclosure.reference,
        version: disclosure.version,
        hash: disclosure.hash,
      },
    });

    for (const injected of [
      { disclosureText: disclosure.body },
      { noticeBody: disclosure.body },
    ]) {
      await expectCode(
        record(
          scope,
          { ...base, ...injected } as unknown as RecordPurposeScopedConsentDecisionInput,
          APPROVED_SUPPLEMENTAL_ASSESSMENT_DISCLOSURE_AUTHORITY
        ),
        'CONSENT_INPUT_INVALID'
      );
    }
    expect(await supplementalRows(scope)).toHaveLength(0);
  });

  it('no explicitly supplied authority → no Consent record (default fail closed)', async () => {
    const scope = await newScope('no-disclosure');
    const disclosure = CURRENT_SUPPLEMENTAL_ASSESSMENT_DISCLOSURE;
    await expectCode(
      recordWithDefaultAuthority(
        scope,
        inputFor(scope, {
          disclosure: {
            reference: disclosure.reference,
            version: disclosure.version,
            hash: disclosure.hash,
          },
        })
      ),
      'CONSENT_DISCLOSURE_NOT_APPROVED'
    );
    expect(await supplementalRows(scope)).toHaveLength(0);
    expect(await supplementalAudit(scope)).toHaveLength(0);
  });

  it('the guardian notice cannot be reused as the 01004 disclosure', async () => {
    const scope = await newScope('guardian-notice-reuse');
    await expectCode(
      record(
        scope,
        inputFor(scope, {
          disclosure: {
            reference: 'guardian-notice',
            version: getCurrentNoticeVersion(),
            hash: getCurrentNoticeHash(),
          },
        }),
        APPROVED_SUPPLEMENTAL_ASSESSMENT_DISCLOSURE_AUTHORITY
      ),
      'CONSENT_DISCLOSURE_NOT_APPROVED'
    );
    expect(await supplementalRows(scope)).toHaveLength(0);
  });

  it('purpose isolation: supplemental truth never satisfies guardian gates', async () => {
    const scope = await newScope('purpose-isolation');
    const supplemental = await record(scope, inputFor(scope));

    const result = await withRlsTransaction(
      appPool,
      {
        familyId: scope.familyId,
        accountId: scope.manager.accountId,
        personId: scope.manager.personId,
        purpose: 'GUARDIAN_CONSENT',
      },
      async (tx) => {
        const gate = await getConsentRecordForGate(tx, supplemental.consentRecordId);
        const binding = await getValidConsentForBinding(tx, supplemental.consentRecordId, {
          familyId: scope.familyId,
          guardianPersonId: scope.manager.personId,
          guardianAccountId: scope.manager.accountId,
          currentNoticeHash: getCurrentNoticeHash(),
        });
        const list = await getConsentsByFamily(tx, scope.familyId);
        return { gate, binding, list };
      }
    );
    expect(result.gate).toBeNull();
    expect(result.binding).toBeNull();
    expect(result.list.map((r: any) => r.id)).not.toContain(supplemental.consentRecordId);
  });

  it('purpose isolation: guardian consent never satisfies the supplemental scope', async () => {
    const scope = await newScope('guardian-cannot-satisfy');

    // An existing guardian GRANTED row in the same Family is irrelevant here.
    const request = await admin.query(
      `INSERT INTO guardian_consent_requests
         (family_id, guardian_person_id, declared_age_band, notice_version, notice_hash,
          status, expires_at, completed_at)
       VALUES ($1, $2, 'UNDER_14', 'v1', $3, 'GRANTED', now() + interval '24 hours', now())
       RETURNING id`,
      [scope.familyId, scope.manager.personId, sha('f')]
    );
    const guardian = await admin.query(
      `INSERT INTO consent_records (
         family_id, guardian_person_id, guardian_account_id, purpose, decision, version,
         onboarding_request_id, notice_version, notice_hash, policy_version, evidence
       ) VALUES ($1, $2, $3, 'UNDER_14_GUARDIAN_CONSENT', 'GRANTED', 1, $4, 'v1', $5, 'v1', '{}')
       RETURNING id`,
      [scope.familyId, scope.manager.personId, scope.manager.accountId, request.rows[0].id, sha('f')]
    );

    // The supplemental owner sees no current supplemental decision and writes v1.
    const supplemental = await record(scope, inputFor(scope));
    expect(supplemental.version).toBe(1);

    const guardianRow = await admin.query(
      `SELECT purpose, decision, version FROM consent_records WHERE id = $1`,
      [guardian.rows[0].id]
    );
    expect(guardianRow.rows[0]).toEqual({
      purpose: 'UNDER_14_GUARDIAN_CONSENT',
      decision: 'GRANTED',
      version: 1,
    });
  });

  it('double GRANTED race leaves at most one current GRANTED truth', async () => {
    const scope = await newScope('race-double-grant');
    const results = await Promise.allSettled([
      record(scope, inputFor(scope)),
      record(scope, inputFor(scope)),
    ]);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason.code).toBe('CONSENT_STALE_VERSION');

    const current = await currentRows(scope);
    expect(current).toHaveLength(1);
    expect(current[0].decision).toBe('GRANTED');
    expect(await supplementalRows(scope)).toHaveLength(1);
  });

  it('GRANTED vs DECLINED race leaves exactly one legal current decision', async () => {
    const scope = await newScope('race-grant-decline');
    const results = await Promise.allSettled([
      record(scope, inputFor(scope, { decision: 'GRANTED' })),
      record(scope, inputFor(scope, { decision: 'DECLINED' })),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);

    const current = await currentRows(scope);
    expect(current).toHaveLength(1);
    expect(['GRANTED', 'DECLINED']).toContain(current[0].decision);
    expect(await supplementalRows(scope)).toHaveLength(1);
  });

  it('caller-owned transaction rollback leaves no consent / audit / idempotency residue', async () => {
    const scope = await newScope('atomic-rollback');
    const idempotencyBefore = await admin.query(
      `SELECT count(*)::int AS count FROM idempotency_keys WHERE actor_account_id = $1`,
      [scope.manager.accountId]
    );

    await expect(
      withRlsTransaction(
        appPool,
        {
          familyId: scope.familyId,
          accountId: scope.manager.accountId,
          personId: scope.manager.personId,
          purpose: 'DIGITAL_USE_ASSESSMENT',
        },
        async (tx) => {
          await recordPurposeScopedConsentDecision(tx, inputFor(scope), TEST_DISCLOSURE_AUTHORITY);
          throw new Error('CALLER_FAILURE_AFTER_CONSENT_WRITE');
        }
      )
    ).rejects.toThrow('CALLER_FAILURE_AFTER_CONSENT_WRITE');

    expect(await supplementalRows(scope)).toHaveLength(0);
    expect(await supplementalAudit(scope)).toHaveLength(0);
    const idempotencyAfter = await admin.query(
      `SELECT count(*)::int AS count FROM idempotency_keys WHERE actor_account_id = $1`,
      [scope.manager.accountId]
    );
    expect(idempotencyAfter.rows[0].count).toBe(idempotencyBefore.rows[0].count);
  });

  it('does not persist raw IP / User-Agent in consent evidence', async () => {
    const scope = await newScope('privacy');
    const result = await record(scope, inputFor(scope));
    const row = await admin.query(`SELECT evidence FROM consent_records WHERE id = $1`, [
      result.consentRecordId,
    ]);
    const evidence = row.rows[0].evidence;
    expect(evidence.client_ip_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(evidence.user_agent_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(evidence)).not.toContain('203.0.113.7');
    expect(JSON.stringify(evidence)).not.toContain('raw-agent-fixture');
  });

  it('does not expose supplemental records through the existing public consent surface', async () => {
    const scope = await newScope('public-surface');
    const supplemental = await record(scope, inputFor(scope));

    const list = await app.inject({
      method: 'GET',
      url: '/api/v1/consents',
      headers: auth(scope.manager.token),
    });
    expect(list.statusCode).toBe(200);
    const body = list.json();
    expect(body.items.map((r: any) => r.id)).not.toContain(supplemental.consentRecordId);
    for (const item of body.items) {
      expect(item.purpose).toBe('UNDER_14_GUARDIAN_CONSENT');
    }

    const revoke = await app.inject({
      method: 'POST',
      url: `/api/v1/consents/${supplemental.consentRecordId}/revoke`,
      headers: commandHeaders(scope.manager.token, 'co-public-revoke'),
      payload: {},
    });
    expect(revoke.statusCode).toBe(403);
    const rows = await supplementalRows(scope);
    expect(rows).toHaveLength(1);
    expect(rows[0].decision).toBe('GRANTED');
  });
});