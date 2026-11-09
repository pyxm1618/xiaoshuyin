/**
 * T027 / T047 / T050 — internal Evidence writers against the real RLS
 * transaction: provenance, person refs, time/value/validity, supersedes,
 * conflict assignment, audit atomicity and rollback.
 *
 * RED before the Evidence domain writers/schema exist.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
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
    purpose: 'FAMILY_MANAGEMENT' as const,
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

async function idempotencyCount(actorAccountId: string): Promise<number> {
  const { rows } = await admin.query(
    `SELECT count(*)::int AS c FROM idempotency_keys WHERE actor_account_id = $1`,
    [actorAccountId]
  );
  return rows[0].c;
}

interface InjectedObjectResidue {
  trigger_residue: number;
  function_residue: number;
}

async function injectedObjectResidue(
  adminClient: pg.Client,
  triggerName: string,
  functionName: string
): Promise<InjectedObjectResidue> {
  const { rows } = await adminClient.query(
    `SELECT
       (SELECT count(*)::int FROM pg_trigger WHERE tgname = $1) AS trigger_residue,
       (SELECT count(*)::int FROM pg_proc p
          JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE p.proname = $2 AND n.nspname = 'public') AS function_residue`,
    [triggerName, functionName]
  );
  return rows[0];
}

function describeError(error: unknown): string {
  const value = error as { code?: string; message?: string };
  return `${value.code ?? 'NO_CODE'} ${value.message ?? String(error)}`;
}

function catalogVerificationFailureClient(
  realClient: pg.Client,
  injectedFailure: Error
): pg.Client {
  return new Proxy(realClient, {
    get(target, property) {
      if (property !== 'query') {
        return Reflect.get(target, property);
      }
      return (first: unknown, second?: unknown): Promise<unknown> => {
        const text =
          typeof first === 'string'
            ? first
            : String((first as { text?: string } | null)?.text ?? '');
        if (/pg_trigger|pg_proc/.test(text)) {
          return Promise.reject(injectedFailure);
        }
        const forward = Reflect.get(target, 'query') as (
          queryTextOrConfig: unknown,
          values?: unknown
        ) => Promise<unknown>;
        return forward.call(target, first, second);
      };
    },
  });
}

async function s3m01HelperResidue(): Promise<InjectedObjectResidue> {
  const { rows } = await admin.query(
    `SELECT
       (SELECT count(*)::int FROM pg_trigger WHERE tgname LIKE 's3m01\\_%') AS trigger_residue,
       (SELECT count(*)::int FROM pg_proc p
          JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE p.proname LIKE 's3m01\\_%' AND n.nspname = 'public') AS function_residue`
  );
  return rows[0];
}

async function finalizeInjectedObjects(
  adminClient: pg.Client,
  triggerName: string,
  functionName: string,
  businessFailure?: { code?: string; message?: string } | null
): Promise<void> {
  const failures: string[] = [];

  try {
    await adminClient.query(
      `DROP TRIGGER IF EXISTS ${triggerName} ON business_audit_events`
    );
  } catch (error) {
    failures.push(`DROP TRIGGER: ${describeError(error)}`);
  }

  try {
    await adminClient.query(`DROP FUNCTION IF EXISTS ${functionName}()`);
  } catch (error) {
    failures.push(`DROP FUNCTION: ${describeError(error)}`);
  }

  let residue: InjectedObjectResidue | null = null;
  try {
    residue = await injectedObjectResidue(adminClient, triggerName, functionName);
  } catch (error) {
    failures.push(`CATALOG VERIFICATION: ${describeError(error)}`);
  }

  if (residue !== null) {
    if (residue.trigger_residue !== 0) {
      failures.push(`trigger residue = ${residue.trigger_residue}`);
    }
    if (residue.function_residue !== 0) {
      failures.push(`function residue = ${residue.function_residue}`);
    }
  }

  if (failures.length > 0) {
    const original = businessFailure
      ? ` | original business failure: ${businessFailure.code ?? 'NO_CODE'} ${
          businessFailure.message ?? ''
        }`
      : '';
    throw new Error(`S3M01 cleanup failed: ${failures.join(' ; ')}${original}`);
  }
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
    const suffix = randomUUID().replace(/-/g, '');
    const marker = `S3M01_${randomUUID()}`;
    const triggerName = `s3m01_audit_failure_${suffix}`;
    const functionName = `s3m01_audit_failure_fn_${suffix}`;

    // Test-only failure injection. Names are unique per run, the trigger only
    // raises inside a transaction that opts in with the local GUC below, and
    // both objects are dropped in `finally` with residue verification.
    const installAuditFailure = async () => {
      await admin.query(
        `CREATE FUNCTION ${functionName}() RETURNS trigger
         LANGUAGE plpgsql AS $fn$
         BEGIN
           IF current_setting('app.s3m01_audit_fail', true) = 'on' THEN
             IF EXISTS (SELECT 1 FROM assertions WHERE content = 'must roll back') THEN
               RAISE EXCEPTION 'S3M01_AUDIT_STAGE_FAILURE:${marker}' USING ERRCODE = 'P0001';
             END IF;
             RAISE EXCEPTION 'S3M01_EVIDENCE_STAGE_NOT_REACHED:${marker}' USING ERRCODE = 'P0001';
           END IF;
           RETURN NEW;
         END;
         $fn$;`
      );
      await admin.query(
        `CREATE TRIGGER ${triggerName} BEFORE INSERT ON business_audit_events
           FOR EACH ROW EXECUTE FUNCTION ${functionName}()`
      );
    };

    const before = await counts(fx.familyId);
    const idempotencyBefore = await idempotencyCount(fx.accountId);
    let callbackEntered = false;
    let identityAtCallback: Record<string, unknown> | null = null;
    let failure: any = null;
    let cleanupFailure: Error | null = null;

    try {
      await installAuditFailure();
      try {
        await runWrite(async (tx) => {
          callbackEntered = true;
          const { rows } = await tx.query(
            `SELECT app_account_id()::text AS account_id,
                    app_person_id()::text  AS person_id,
                    app_family_id()::text  AS family_id,
                    app_current_purpose()  AS purpose`
          );
          identityAtCallback = rows[0];
          await tx.query(`SELECT set_config('app.s3m01_audit_fail', 'on', true)`);
          return recordStatement(tx, ctx(), statementDraft({ content: 'must roll back' }));
        });
      } catch (error) {
        failure = error;
      }
    } finally {
      try {
        await finalizeInjectedObjects(admin, triggerName, functionName, failure);
      } catch (error) {
        cleanupFailure = error as Error;
      }
    }

    // Cleanup is fail-closed: both DROPs are attempted, errors are never
    // swallowed, and the exact per-run objects must be gone. When cleanup fails
    // the thrown message also carries the original business failure, so the two
    // failure classes stay distinguishable instead of masking each other.
    expect(cleanupFailure).toBeNull();
    expect(await injectedObjectResidue(admin, triggerName, functionName)).toEqual({
      trigger_residue: 0,
      function_residue: 0,
    });

    // The transaction identity gate and family binding really passed.
    expect(callbackEntered).toBe(true);
    expect(identityAtCallback).toMatchObject({
      account_id: fx.accountId,
      person_id: fx.managerPersonId,
      family_id: fx.familyId,
      purpose: 'FAMILY_MANAGEMENT',
    });

    // The failure came from the audit stage, after Evidence INSERT succeeded.
    // It is not `42501`, not an authorization denial, and not a domain error.
    expect(failure).not.toBeNull();
    expect(failure.code).toBe('P0001');
    expect(failure.message).toContain(`S3M01_AUDIT_STAGE_FAILURE:${marker}`);
    expect(failure.message).not.toContain('S3M01_EVIDENCE_STAGE_NOT_REACHED');
    expect(failure.code).not.toBe('42501');
    expect(failure.code).not.toBe('EVIDENCE_CASE_NOT_AUTHORIZED');
    expect(String(failure.message)).not.toMatch(/row-level security/i);

    // Nothing was committed: assertion, observation, audit and case_event all +0.
    expect(await counts(fx.familyId)).toEqual(before);
    expect(await idempotencyCount(fx.accountId)).toBe(idempotencyBefore);

    const leaked = await admin.query(
      `SELECT count(*)::int AS c FROM assertions WHERE content = 'must roll back'`
    );
    expect(leaked.rows[0].c).toBe(0);

    const leakedAudit = await admin.query(
      `SELECT count(*)::int AS c FROM business_audit_events
        WHERE family_id = $1
          AND event_type = 'ASSERTION_RECORDED'
          AND resource_id NOT IN (SELECT id FROM assertions)`,
      [fx.familyId]
    );
    expect(leakedAudit.rows[0].c).toBe(0);
  });

  it('fails closed when test-side cleanup cannot remove its own objects', async () => {
    const suffix = randomUUID().replace(/-/g, '');
    const functionName = `s3m01_cleanup_negative_fn_${suffix}`;
    const viewName = `s3m01_cleanup_negative_view_${suffix}`;
    const missingTrigger = `s3m01_cleanup_negative_trigger_${suffix}`;

    try {
      // A view depends on the function, so DROP FUNCTION fails closed with
      // PostgreSQL 2BP01 while DROP TRIGGER still runs and reports success.
      await admin.query(
        `CREATE FUNCTION ${functionName}() RETURNS integer LANGUAGE sql AS $$ SELECT 1 $$`
      );
      await admin.query(`CREATE VIEW ${viewName} AS SELECT ${functionName}() AS value`);

      const cleanupError = await finalizeInjectedObjects(
        admin,
        missingTrigger,
        functionName,
        { code: 'P0001', message: 'S3M01_AUDIT_STAGE_FAILURE:cleanup-negative-marker' }
      ).catch((error) => error);

      expect(cleanupError).toBeInstanceOf(Error);
      expect(String(cleanupError.message)).toContain('S3M01 cleanup failed');
      expect(String(cleanupError.message)).toContain('2BP01');
      expect(String(cleanupError.message)).toContain('function residue = 1');
      expect(String(cleanupError.message)).toContain(
        'S3M01_AUDIT_STAGE_FAILURE:cleanup-negative-marker'
      );
    } finally {
      await admin.query(`DROP VIEW IF EXISTS ${viewName}`);
      await admin.query(`DROP FUNCTION IF EXISTS ${functionName}()`);
    }

    expect(await injectedObjectResidue(admin, missingTrigger, functionName)).toEqual({
      trigger_residue: 0,
      function_residue: 0,
    });
  });

  it('fails closed with an aggregated report when catalog residue verification throws', async () => {
    const suffix = randomUUID().replace(/-/g, '');
    const triggerName = `s3m01_catalog_failure_${suffix}`;
    const functionName = `s3m01_catalog_failure_fn_${suffix}`;
    const catalogMarker = `S3M01_CATALOG_INJECTED:${randomUUID()}`;
    const businessMarker = `S3M01_AUDIT_STAGE_FAILURE:${randomUUID()}`;

    try {
      await admin.query(
        `CREATE FUNCTION ${functionName}() RETURNS trigger
         LANGUAGE plpgsql AS $fn$
         BEGIN
           RETURN NEW;
         END;
         $fn$;`
      );
      await admin.query(
        `CREATE TRIGGER ${triggerName} BEFORE INSERT ON business_audit_events
           FOR EACH ROW EXECUTE FUNCTION ${functionName}()`
      );

      expect(await injectedObjectResidue(admin, triggerName, functionName)).toEqual({
        trigger_residue: 1,
        function_residue: 1,
      });

      const catalogFailure = Object.assign(new Error(catalogMarker), { code: '55P03' });
      const cleanupError = await finalizeInjectedObjects(
        catalogVerificationFailureClient(admin, catalogFailure),
        triggerName,
        functionName,
        { code: 'P0001', message: businessMarker }
      ).catch((error) => error);

      expect(cleanupError).toBeInstanceOf(Error);
      const message = String(cleanupError.message);
      expect(message).toContain('S3M01 cleanup failed');
      expect(message).toContain(`CATALOG VERIFICATION: 55P03 ${catalogMarker}`);
      expect(message).toContain('original business failure:');
      expect(message).toContain('P0001');
      expect(message).toContain(businessMarker);
      expect(message).not.toContain('trigger residue');
      expect(message).not.toContain('function residue');
      expect(message).not.toContain('DROP TRIGGER:');
      expect(message).not.toContain('DROP FUNCTION:');
    } finally {
      await admin.query(`DROP TRIGGER IF EXISTS ${triggerName} ON business_audit_events`);
      await admin.query(`DROP FUNCTION IF EXISTS ${functionName}()`);
    }

    expect(await injectedObjectResidue(admin, triggerName, functionName)).toEqual({
      trigger_residue: 0,
      function_residue: 0,
    });
    expect(await s3m01HelperResidue()).toEqual({
      trigger_residue: 0,
      function_residue: 0,
    });
  });

  it('keeps DROP and catalog verification failures in one aggregated report', async () => {
    const suffix = randomUUID().replace(/-/g, '');
    const functionName = `s3m01_catalog_cleanup_fn_${suffix}`;
    const viewName = `s3m01_catalog_cleanup_view_${suffix}`;
    const missingTrigger = `s3m01_catalog_cleanup_trigger_${suffix}`;
    const catalogMarker = `S3M01_CATALOG_INJECTED:${randomUUID()}`;
    const businessMarker = `S3M01_AUDIT_STAGE_FAILURE:${randomUUID()}`;

    try {
      await admin.query(
        `CREATE FUNCTION ${functionName}() RETURNS integer LANGUAGE sql AS $$ SELECT 1 $$`
      );
      await admin.query(`CREATE VIEW ${viewName} AS SELECT ${functionName}() AS value`);

      const catalogFailure = Object.assign(new Error(catalogMarker), { code: '55P03' });
      const cleanupError = await finalizeInjectedObjects(
        catalogVerificationFailureClient(admin, catalogFailure),
        missingTrigger,
        functionName,
        { code: 'P0001', message: businessMarker }
      ).catch((error) => error);

      expect(cleanupError).toBeInstanceOf(Error);
      const message = String(cleanupError.message);
      expect(message).toContain('S3M01 cleanup failed');
      expect(message).toContain('DROP FUNCTION: 2BP01');
      expect(message).toContain(`CATALOG VERIFICATION: 55P03 ${catalogMarker}`);
      expect(message).toContain('P0001');
      expect(message).toContain(businessMarker);
      expect(message).not.toContain('DROP TRIGGER:');
      expect(message).not.toContain('function residue =');
    } finally {
      await admin.query(`DROP VIEW IF EXISTS ${viewName}`);
      await admin.query(`DROP FUNCTION IF EXISTS ${functionName}()`);
    }

    expect(await injectedObjectResidue(admin, missingTrigger, functionName)).toEqual({
      trigger_residue: 0,
      function_residue: 0,
    });
    expect(await s3m01HelperResidue()).toEqual({
      trigger_residue: 0,
      function_residue: 0,
    });
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
  // COLD-002: the source Person is also processed, so it needs its own
  // compliance profile (ADULT → ALLOW).
  await admin.query(
    `INSERT INTO person_compliance_profiles
       (person_id, age_band, minor_mode, verified_source)
     VALUES ($1, 'ADULT', false, 'SELF_STATEMENT')`,
    [guardianPersonId]
  );
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