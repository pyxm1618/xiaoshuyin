/**
 * T027 / T047 / T050 — internal Evidence writers against the real RLS
 * transaction: provenance, person refs, time/value/validity, supersedes,
 * conflict assignment, audit atomicity and rollback.
 *
 * RED before the Evidence domain writers/schema exist.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import {
  recordStatement,
  recordHypothesis,
  recordObservation,
  assignConflictGroup,
} from '../../packages/domain/src/evidence.js';
import { withRlsTransaction } from '../../apps/server/api/src/db/tx.js';
import { getCurrentNoticeHash } from '../../packages/compliance/src/notices.js';

const ADMIN_URL = process.env['TEST_ADMIN_DATABASE_URL']!;
const APP_URL = process.env['DATABASE_URL']!;

interface Fixture {
  familyId: string;
  caseId: string;
  accountId: string;
  managerPersonId: string;
  childPersonId: string;
  guardianPersonId: string;
  under14PersonId: string;
  under14ConsentId: string;
  messageId: string;
  familyB: string;
  caseB: string;
  managerB: string;
  accountB: string;
}

let admin: pg.Client;
let pool: pg.Pool;
let fx: Fixture;

function ctx() {
  return {
    familyId: fx.familyId,
    caseId: fx.caseId,
    actorAccountId: fx.accountId,
    actorPersonId: fx.managerPersonId,
  };
}

function statementDraft(overrides: Record<string, unknown> = {}) {
  return {
    subjectPersonId: fx.managerPersonId,
    sourceKind: 'SELF_STATEMENT',
    sourcePersonId: fx.managerPersonId,
    sourceMessageId: null,
    occurredTimeState: 'UNKNOWN',
    occurredAt: null,
    validFrom: null,
    validUntil: null,
    confirmationStatus: 'UNCONFIRMED',
    supersedesId: null,
    content: 'statement content',
    ...overrides,
  } as any;
}

function observationDraft(overrides: Record<string, unknown> = {}) {
  return {
    subjectPersonId: fx.childPersonId,
    sourceKind: 'GUARDIAN_OBSERVATION',
    sourcePersonId: fx.guardianPersonId,
    sourceMessageId: null,
    occurredTimeState: 'UNKNOWN',
    occurredAt: null,
    validFrom: null,
    validUntil: null,
    confirmationStatus: 'UNCONFIRMED',
    supersedesId: null,
    observationCode: 'sleep_hours',
    value: { state: 'KNOWN', type: 'NUMBER', valueNumber: 0, unit: 'hours' },
    ...overrides,
  } as any;
}

function runWrite<T>(fn: (tx: pg.PoolClient) => Promise<T>, context = ctx()): Promise<T> {
  return withRlsTransaction(
    pool,
    {
      familyId: context.familyId,
      accountId: context.actorAccountId,
      personId: context.actorPersonId,
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
       (SELECT count(*)::int FROM case_events WHERE family_id = $1) AS case_events,
       (SELECT count(*)::int FROM business_audit_events WHERE family_id = $1) AS audits`,
    [familyId]
  );
  return rows[0];
}

describe('Internal Evidence writers (T027)', () => {
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

  it('records a SELF_STATEMENT with audit metadata {} and no case_event', async () => {
    const before = await counts(fx.familyId);
    const written = await runWrite((tx) => recordStatement(tx, ctx(), statementDraft()));

    expect(written.id).toBeDefined();
    const after = await counts(fx.familyId);
    expect(after.assertions).toBe(before.assertions + 1);
    expect(after.audits).toBe(before.audits + 1);
    expect(after.observations).toBe(before.observations);
    expect(after.case_events).toBe(before.case_events);

    const { rows } = await admin.query(
      `SELECT kind, source_kind, subject_person_id, source_person_id, content, recorded_at
         FROM assertions WHERE id = $1`,
      [written.id]
    );
    expect(rows[0]).toMatchObject({
      kind: 'STATEMENT',
      source_kind: 'SELF_STATEMENT',
      subject_person_id: fx.managerPersonId,
      source_person_id: fx.managerPersonId,
      content: 'statement content',
    });
    expect(rows[0].recorded_at).toBeInstanceOf(Date);

    const audit = await admin.query(
      `SELECT event_type, resource_type, resource_id, metadata
         FROM business_audit_events WHERE resource_id = $1`,
      [written.id]
    );
    expect(audit.rows).toEqual([
      expect.objectContaining({
        event_type: 'ASSERTION_RECORDED',
        resource_type: 'ASSERTION',
        metadata: {},
      }),
    ]);
  });

  it('keeps a guardian relay as STATEMENT with separate subject/source', async () => {
    const written = await runWrite((tx) =>
      recordStatement(
        tx,
        ctx(),
        statementDraft({
          subjectPersonId: fx.childPersonId,
          sourceKind: 'GUARDIAN_RELAY',
          sourcePersonId: fx.guardianPersonId,
          content: 'guardian relay',
        })
      )
    );
    const { rows } = await admin.query(
      'SELECT kind, subject_person_id, source_person_id FROM assertions WHERE id = $1',
      [written.id]
    );
    expect(rows[0]).toEqual({
      kind: 'STATEMENT',
      subject_person_id: fx.childPersonId,
      source_person_id: fx.guardianPersonId,
    });
  });

  it('records a GUARDIAN_OBSERVATION in the separate observations table', async () => {
    const before = await counts(fx.familyId);
    const written = await runWrite((tx) => recordObservation(tx, ctx(), observationDraft()));

    const after = await counts(fx.familyId);
    expect(after.observations).toBe(before.observations + 1);
    expect(after.assertions).toBe(before.assertions);
    expect(after.audits).toBe(before.audits + 1);

    const { rows } = await admin.query(
      `SELECT value_state, value_type, value_number, unit, observation_code
         FROM observations WHERE id = $1`,
      [written.id]
    );
    expect(rows[0]).toMatchObject({
      value_state: 'KNOWN',
      value_type: 'NUMBER',
      observation_code: 'sleep_hours',
      unit: 'hours',
    });
    expect(Number(rows[0].value_number)).toBe(0);

    const audit = await admin.query(
      'SELECT event_type, resource_type FROM business_audit_events WHERE resource_id = $1',
      [written.id]
    );
    expect(audit.rows[0]).toEqual({
      event_type: 'OBSERVATION_RECORDED',
      resource_type: 'OBSERVATION',
    });
  });

  it('rejects wrong writer/source combinations without writing', async () => {
    const before = await counts(fx.familyId);

    await expect(
      runWrite((tx) =>
        recordStatement(
          tx,
          ctx(),
          statementDraft({
            subjectPersonId: fx.childPersonId,
            sourceKind: 'GUARDIAN_OBSERVATION',
            sourcePersonId: fx.guardianPersonId,
          })
        )
      )
    ).rejects.toMatchObject({ code: 'EVIDENCE_PROVENANCE_INVALID' });

    await expect(
      runWrite((tx) =>
        recordObservation(
          tx,
          ctx(),
          observationDraft({ sourceKind: 'GUARDIAN_RELAY' })
        )
      )
    ).rejects.toMatchObject({ code: 'EVIDENCE_PROVENANCE_INVALID' });

    expect(await counts(fx.familyId)).toEqual(before);
  });

  it('recordHypothesis fails closed with no current production source', async () => {
    const before = await counts(fx.familyId);
    await expect(
      runWrite((tx) =>
        recordHypothesis(tx, ctx(), statementDraft({ content: 'hypothesis' }))
      )
    ).rejects.toMatchObject({ code: 'EVIDENCE_HYPOTHESIS_SOURCE_UNAVAILABLE' });
    expect(await counts(fx.familyId)).toEqual(before);
  });

  it('rejects a cross-Family Person reference with the normalized code', async () => {
    const before = await counts(fx.familyId);
    await expect(
      runWrite((tx) =>
        recordStatement(
          tx,
          ctx(),
          statementDraft({ subjectPersonId: fx.managerB, sourcePersonId: fx.managerB })
        )
      )
    ).rejects.toMatchObject({ code: 'EVIDENCE_PERSON_REFERENCE_INVALID' });
    expect(await counts(fx.familyId)).toEqual(before);
  });

  it('validates source-message family/case/source-person consistency', async () => {
    // A second raw message whose source Person is the manager (not the guardian).
    const { rows: otherMessage } = await admin.query(
      `INSERT INTO dialogue_messages (family_id, case_id, actor_account_id, source_person_id, content)
       VALUES ($1, $2, $3, $4, 'manager raw message') RETURNING id`,
      [fx.familyId, fx.caseId, fx.accountId, fx.managerPersonId]
    );

    // Provenance itself is valid (guardian relay), but the referenced message's
    // source Person does not match the Evidence source Person.
    await expect(
      runWrite((tx) =>
        recordStatement(
          tx,
          ctx(),
          statementDraft({
            subjectPersonId: fx.childPersonId,
            sourceKind: 'GUARDIAN_RELAY',
            sourcePersonId: fx.guardianPersonId,
            sourceMessageId: otherMessage[0].id,
          })
        )
      )
    ).rejects.toMatchObject({ code: 'EVIDENCE_PERSON_REFERENCE_INVALID' });

    const ok = await runWrite((tx) =>
      recordStatement(
        tx,
        ctx(),
        statementDraft({
          subjectPersonId: fx.childPersonId,
          sourceKind: 'GUARDIAN_RELAY',
          sourcePersonId: fx.guardianPersonId,
          sourceMessageId: fx.messageId,
          content: 'from source message',
        })
      )
    );
    const { rows } = await admin.query(
      'SELECT source_message_id, source_person_id FROM assertions WHERE id = $1',
      [ok.id]
    );
    expect(rows[0]).toEqual({
      source_message_id: fx.messageId,
      source_person_id: fx.guardianPersonId,
    });
  });

  it('revalidates current UNDER_14 consent before the final Evidence insert', async () => {
    const allowed = await runWrite((tx) =>
      recordStatement(
        tx,
        ctx(),
        statementDraft({
          subjectPersonId: fx.under14PersonId,
          sourceKind: 'GUARDIAN_RELAY',
          sourcePersonId: fx.guardianPersonId,
          content: 'under14 valid consent',
        })
      )
    );
    expect(allowed.id).toBeTruthy();

    const validEvidence = JSON.stringify({
      channel: 'TEST',
      accepted_text_hash: 'a'.repeat(64),
      declared_age_band: 'UNDER_14',
      client_ip_hash: 'b'.repeat(64),
      user_agent_hash: 'c'.repeat(64),
    });

    const { rows: revoked } = await admin.query(
      `INSERT INTO consent_records
         (family_id, guardian_person_id, guardian_account_id, purpose, decision,
          version, onboarding_request_id, bound_person_id, bound_at,
          notice_version, notice_hash, policy_version, evidence)
       VALUES ($1, $2, $3, 'UNDER_14_GUARDIAN_CONSENT', 'REVOKED',
               2, NULL, $4, now(), 'v1', $5, 'v1', $6::jsonb)
       RETURNING id`,
      [
        fx.familyId, fx.guardianPersonId, fx.accountId, fx.under14PersonId,
        getCurrentNoticeHash(), validEvidence,
      ]
    );
    await admin.query(
      `UPDATE person_compliance_profiles
       SET guardian_consent_record_id = $1, guardian_consent_version = 2
       WHERE person_id = $2`,
      [revoked[0].id, fx.under14PersonId]
    );

    let before = await counts(fx.familyId);
    await expect(
      runWrite((tx) =>
        recordObservation(
          tx,
          ctx(),
          observationDraft({
            subjectPersonId: fx.under14PersonId,
            sourcePersonId: fx.guardianPersonId,
            content: 'blocked after revoke',
          })
        )
      )
    ).rejects.toMatchObject({ code: 'GUARDIAN_CONSENT_REVOKED' });
    expect(await counts(fx.familyId)).toEqual(before);

    const insertGrantedConsent = async (
      version: number,
      noticeHash: string,
      evidence: string
    ) => {
      const { rows: request } = await admin.query(
        `INSERT INTO guardian_consent_requests
           (family_id, guardian_person_id, subject_person_id, declared_age_band,
            notice_version, notice_hash, status, expires_at, completed_at)
         VALUES ($1, $2, $3, 'UNDER_14', 'v1', $4, 'GRANTED',
                 now() + interval '1 hour', now())
         RETURNING id`,
        [fx.familyId, fx.guardianPersonId, fx.under14PersonId, noticeHash]
      );
      const { rows } = await admin.query(
        `INSERT INTO consent_records
           (family_id, guardian_person_id, guardian_account_id, purpose, decision,
            version, onboarding_request_id, bound_person_id, bound_at,
            notice_version, notice_hash, policy_version, evidence)
         VALUES ($1, $2, $3, 'UNDER_14_GUARDIAN_CONSENT', 'GRANTED',
                 $4, $5, $6, now(), 'v1', $7, 'v1', $8::jsonb)
         RETURNING id`,
        [
          fx.familyId, fx.guardianPersonId, fx.accountId, version, request[0].id,
          fx.under14PersonId, noticeHash, evidence,
        ]
      );
      return rows[0].id as string;
    };

    const staleId = await insertGrantedConsent(3, '0'.repeat(64), validEvidence);
    await admin.query(
      `UPDATE person_compliance_profiles
       SET guardian_consent_record_id = $1, guardian_consent_version = 3
       WHERE person_id = $2`,
      [staleId, fx.under14PersonId]
    );
    before = await counts(fx.familyId);
    await expect(
      runWrite((tx) =>
        recordStatement(
          tx,
          ctx(),
          statementDraft({
            subjectPersonId: fx.under14PersonId,
            sourceKind: 'GUARDIAN_RELAY',
            sourcePersonId: fx.guardianPersonId,
            content: 'blocked stale consent',
          })
        )
      )
    ).rejects.toMatchObject({ code: 'NOTICE_VERSION_MISMATCH' });
    expect(await counts(fx.familyId)).toEqual(before);

    const unusableId = await insertGrantedConsent(
      4,
      getCurrentNoticeHash(),
      JSON.stringify({ accepted: true })
    );
    await admin.query(
      `UPDATE person_compliance_profiles
       SET guardian_consent_record_id = $1, guardian_consent_version = 4
       WHERE person_id = $2`,
      [unusableId, fx.under14PersonId]
    );
    before = await counts(fx.familyId);
    await expect(
      runWrite((tx) =>
        recordStatement(
          tx,
          ctx(),
          statementDraft({
            subjectPersonId: fx.under14PersonId,
            sourceKind: 'GUARDIAN_RELAY',
            sourcePersonId: fx.guardianPersonId,
            content: 'blocked missing usable consent',
          })
        )
      )
    ).rejects.toMatchObject({ code: 'GUARDIAN_CONSENT_REQUIRED' });
    expect(await counts(fx.familyId)).toEqual(before);
  });

  it('appends a superseding row while preserving the old row', async () => {
    const old = await runWrite((tx) =>
      recordStatement(tx, ctx(), statementDraft({ content: 'old assertion' }))
    );
    const next = await runWrite((tx) =>
      recordStatement(
        tx,
        ctx(),
        statementDraft({ content: 'new assertion', supersedesId: old.id })
      )
    );

    const { rows } = await admin.query(
      'SELECT id, content, supersedes_id FROM assertions WHERE id IN ($1, $2)',
      [old.id, next.id]
    );
    expect(rows).toHaveLength(2);
    const oldRow = rows.find((r: any) => r.id === old.id);
    expect(oldRow.content).toBe('old assertion');
    expect(oldRow.supersedes_id).toBeNull();
    expect(rows.find((r: any) => r.id === next.id).supersedes_id).toBe(old.id);
  });

  it('links an Assertion and an Observation into one conflict group without a winner', async () => {
    const assertion = await runWrite((tx) =>
      recordStatement(tx, ctx(), statementDraft({ content: 'six hours' }))
    );
    const observation = await runWrite((tx) =>
      recordObservation(
        tx,
        ctx(),
        observationDraft({
          value: { state: 'KNOWN', type: 'NUMBER', valueNumber: 2, unit: 'hours' },
          observationCode: 'conflict_hours',
        })
      )
    );

    const group = await runWrite((tx) =>
      assignConflictGroup(tx, ctx(), [
        { kind: 'ASSERTION', id: assertion.id },
        { kind: 'OBSERVATION', id: observation.id },
      ])
    );
    expect(group.conflictGroupId).toBeTruthy();

    const a = await admin.query('SELECT conflict_group_id FROM assertions WHERE id = $1', [
      assertion.id,
    ]);
    const o = await admin.query('SELECT conflict_group_id FROM observations WHERE id = $1', [
      observation.id,
    ]);
    expect(a.rows[0].conflict_group_id).toBe(group.conflictGroupId);
    expect(o.rows[0].conflict_group_id).toBe(group.conflictGroupId);

    const cols = await admin.query(
      `SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name IN ('assertions', 'observations')`
    );
    const names = cols.rows.map((r: any) => r.column_name);
    for (const forbidden of ['winner', 'rank', 'confidence', 'majority']) {
      expect(names).not.toContain(forbidden);
    }
  });

  it('rolls the evidence row back when the audit write fails', async () => {
    const before = await counts(fx.familyId);
    const broken = {
      ...ctx(),
      actorAccountId: '00000000-0000-7000-8000-000000000000',
    };
    await expect(
      runWrite(
        (tx) => recordStatement(tx, broken, statementDraft({ content: 'must roll back' })),
        broken
      )
    ).rejects.toThrow();
    expect(await counts(fx.familyId)).toEqual(before);
    const leaked = await admin.query(
      `SELECT count(*)::int AS c FROM assertions WHERE content = 'must roll back'`
    );
    expect(leaked.rows[0].c).toBe(0);
  });
});

async function seed(admin: pg.Client): Promise<Fixture> {
  const suffix = `${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
  const makeFamily = async (key: string, label: string) => {
    const { rows: acc } = await admin.query(
      `INSERT INTO accounts (wechat_openid) VALUES ($1) RETURNING id`,
      [`t027_${key}_${suffix}`]
    );
    const { rows: person } = await admin.query(
      `INSERT INTO persons (account_id, created_by_account_id) VALUES ($1, $1) RETURNING id`,
      [acc[0].id]
    );
    const { rows: fam } = await admin.query(
      `INSERT INTO families (display_name, created_by_person_id) VALUES ($1, $2) RETURNING id`,
      [label, person[0].id]
    );
    await admin.query(
      'INSERT INTO family_members (family_id, person_id) VALUES ($1, $2)',
      [fam[0].id, person[0].id]
    );
    await admin.query(
      `INSERT INTO person_compliance_profiles
         (person_id, age_band, minor_mode, verified_source)
       VALUES ($1, 'ADULT', false, 'SELF_STATEMENT')`,
      [person[0].id]
    );
    const { rows: c } = await admin.query(
      `INSERT INTO cases (family_id, created_by_person_id, status, phase, is_primary, version)
       VALUES ($1, $2, 'OPEN', 'INTAKE', true, 1) RETURNING id`,
      [fam[0].id, person[0].id]
    );
    return {
      accountId: acc[0].id as string,
      personId: person[0].id as string,
      familyId: fam[0].id as string,
      caseId: c[0].id as string,
    };
  };

  const a = await makeFamily('a', 't027-a');
  const b = await makeFamily('b', 't027-b');

  const { rows: child } = await admin.query(
    'INSERT INTO persons (created_by_account_id) VALUES ($1) RETURNING id',
    [a.accountId]
  );
  const childPersonId = child[0].id;
  await admin.query('INSERT INTO family_members (family_id, person_id) VALUES ($1, $2)', [
    a.familyId,
    childPersonId,
  ]);

  const { rows: guardian } = await admin.query(
    'INSERT INTO persons (created_by_account_id) VALUES ($1) RETURNING id',
    [a.accountId]
  );
  const guardianPersonId = guardian[0].id;
  await admin.query('INSERT INTO family_members (family_id, person_id) VALUES ($1, $2)', [
    a.familyId,
    guardianPersonId,
  ]);
  await admin.query(
    `INSERT INTO person_compliance_profiles
       (person_id, age_band, minor_mode, guardian_person_id, verified_source)
     VALUES ($1, 'MINOR_14_17', true, $2, 'GUARDIAN_OBSERVATION')`,
    [childPersonId, guardianPersonId]
  );

  const { rows: under14 } = await admin.query(
    'INSERT INTO persons (created_by_account_id) VALUES ($1) RETURNING id',
    [a.accountId]
  );
  const under14PersonId = under14[0].id as string;
  await admin.query(
    'INSERT INTO family_members (family_id, person_id) VALUES ($1, $2)',
    [a.familyId, under14PersonId]
  );

  const currentNoticeHash = getCurrentNoticeHash();
  const { rows: consentRequest } = await admin.query(
    `INSERT INTO guardian_consent_requests
       (family_id, guardian_person_id, subject_person_id, declared_age_band,
        notice_version, notice_hash, status, expires_at, completed_at)
     VALUES ($1, $2, $3, 'UNDER_14', 'v1', $4, 'GRANTED',
             now() + interval '1 hour', now())
     RETURNING id`,
    [a.familyId, guardianPersonId, under14PersonId, currentNoticeHash]
  );
  const consentEvidence = JSON.stringify({
    channel: 'TEST',
    accepted_text_hash: 'a'.repeat(64),
    declared_age_band: 'UNDER_14',
    client_ip_hash: 'b'.repeat(64),
    user_agent_hash: 'c'.repeat(64),
  });
  const { rows: consent } = await admin.query(
    `INSERT INTO consent_records
       (family_id, guardian_person_id, guardian_account_id, purpose, decision,
        version, onboarding_request_id, bound_person_id, bound_at,
        notice_version, notice_hash, policy_version, evidence)
     VALUES ($1, $2, $3, 'UNDER_14_GUARDIAN_CONSENT', 'GRANTED',
             1, $4, $5, now(), 'v1', $6, 'v1', $7::jsonb)
     RETURNING id`,
    [
      a.familyId, guardianPersonId, a.accountId, consentRequest[0].id,
      under14PersonId, currentNoticeHash, consentEvidence,
    ]
  );
  const under14ConsentId = consent[0].id as string;
  await admin.query(
    `INSERT INTO person_compliance_profiles
       (person_id, age_band, minor_mode, guardian_person_id,
        guardian_consent_version, guardian_consent_record_id, verified_source)
     VALUES ($1, 'UNDER_14', true, $2, 1, $3, 'GUARDIAN_RELAY')`,
    [under14PersonId, guardianPersonId, under14ConsentId]
  );

  const { rows: msg } = await admin.query(
    `INSERT INTO dialogue_messages (family_id, case_id, actor_account_id, source_person_id, content)
     VALUES ($1, $2, $3, $4, 'raw guardian message') RETURNING id`,
    [a.familyId, a.caseId, a.accountId, guardianPersonId]
  );

  return {
    familyId: a.familyId,
    caseId: a.caseId,
    accountId: a.accountId,
    managerPersonId: a.personId,
    childPersonId,
    guardianPersonId,
    under14PersonId,
    under14ConsentId,
    messageId: msg[0].id,
    familyB: b.familyId,
    caseB: b.caseId,
    managerB: b.personId,
    accountB: b.accountId,
  };
}

async function cleanup(admin: pg.Client) {
  try {
    await admin.query(
      `DELETE FROM assertions WHERE family_id IN (SELECT id FROM families WHERE display_name LIKE 't027%')`
    );
    await admin.query(
      `DELETE FROM observations WHERE family_id IN (SELECT id FROM families WHERE display_name LIKE 't027%')`
    );
    await admin.query(
      `DELETE FROM dialogue_messages WHERE family_id IN (SELECT id FROM families WHERE display_name LIKE 't027%')`
    );
    await admin.query(
      `DELETE FROM business_audit_events WHERE family_id IN (SELECT id FROM families WHERE display_name LIKE 't027%')`
    );
    await admin.query(
      `DELETE FROM case_events WHERE family_id IN (SELECT id FROM families WHERE display_name LIKE 't027%')`
    );
    await admin.query(
      `DELETE FROM cases WHERE family_id IN (SELECT id FROM families WHERE display_name LIKE 't027%')`
    );
    await admin.query(
      `DELETE FROM person_compliance_profiles WHERE person_id IN (
         SELECT person_id FROM family_members WHERE family_id IN (
           SELECT id FROM families WHERE display_name LIKE 't027%'))`
    );
    await admin.query(
      `DELETE FROM consent_records WHERE family_id IN (
         SELECT id FROM families WHERE display_name LIKE 't027%')`
    );
    await admin.query(
      `DELETE FROM guardian_consent_requests WHERE family_id IN (
         SELECT id FROM families WHERE display_name LIKE 't027%')`
    );
    await admin.query(
      `DELETE FROM family_members WHERE family_id IN (SELECT id FROM families WHERE display_name LIKE 't027%')`
    );
    await admin.query(`DELETE FROM families WHERE display_name LIKE 't027%'`);
    await admin.query(
      `DELETE FROM persons WHERE created_by_account_id IN (
         SELECT id FROM accounts WHERE wechat_openid LIKE 't027\\_%')`
    );
    await admin.query(`DELETE FROM accounts WHERE wechat_openid LIKE 't027\\_%'`);
  } catch {
    // best-effort cleanup
  }
}