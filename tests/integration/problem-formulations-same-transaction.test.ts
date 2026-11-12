/**
 * Slice 8 post-merge owner remediation — same-transaction composition seam.
 *
 * Proves that the authoritative StartAssessment / PresentProblemFormulation
 * commands run correctly inside a CALLER-OWNED transaction:
 *   - the provided `pg.PoolClient` is the ONLY connection used and the ONLY
 *     transaction involved (no second pool checkout, no BEGIN/COMMIT issued
 *     by the seam, no independent ROLLBACK);
 *   - outer rollback removes every Slice 8 fact: Case phase/version change,
 *     Case event, business audit, idempotency completion, formulation write;
 *   - outer commit publishes each fact exactly once;
 *   - the canonical Family -> Case lock order is preserved and the locks are
 *     held by the caller's own backend/transaction;
 *   - RLS / authorization stay fail-closed for a caller-owned client;
 *   - the existing public commands keep their exact external behavior.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import { buildApp } from '../../apps/server/api/src/app.js';
import { createAdminPool } from '../setup/db.js';
import { login } from '../setup/api.js';
import {
  presentProblemFormulation,
  presentProblemFormulationInTransaction,
  startAssessment,
  startAssessmentInTransaction,
} from '../../apps/server/api/src/services/problem-formulations.js';

const PREFIX = 't8tx_';
const PURPOSE = 'FAMILY_MANAGEMENT';

type FormulationCommand = 'CASE_START_ASSESSMENT' | 'PROBLEM_FORMULATION_PRESENT';

const EVENT_TYPES: Record<FormulationCommand, string> = {
  CASE_START_ASSESSMENT: 'CASE_ASSESSMENT_STARTED',
  PROBLEM_FORMULATION_PRESENT: 'CASE_PROBLEM_FORMULATION_PRESENTED',
};

interface Facts {
  version: number;
  phase: string;
  formulations: number;
  events: number;
  audits: number;
  idempotency: number;
}

describe('Slice 8 same-transaction composition seam', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let admin: pg.Pool;
  let pool: pg.Pool;
  let seq = 0;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
    admin = createAdminPool();
    pool = new pg.Pool({ connectionString: process.env['DATABASE_URL'], max: 20 });
  });

  afterAll(async () => {
    const fam = `(SELECT id FROM families WHERE display_name LIKE 'T8TX-%')`;
    const acct = `(SELECT id FROM accounts WHERE wechat_openid LIKE 'fake_${PREFIX}%')`;
    try {
      await admin.query(`DELETE FROM problem_formulations WHERE family_id IN ${fam}`);
      await admin.query(`DELETE FROM business_audit_events WHERE family_id IN ${fam}`);
      await admin.query(`DELETE FROM case_events WHERE family_id IN ${fam}`);
      await admin.query(`DELETE FROM cases WHERE family_id IN ${fam}`);
      await admin.query(`DELETE FROM dialogue_messages WHERE family_id IN ${fam}`);
      await admin.query(`DELETE FROM idempotency_keys WHERE actor_account_id IN ${acct}`);
      await admin.query(`DELETE FROM family_members WHERE family_id IN ${fam}`);
      await admin.query(`DELETE FROM families WHERE display_name LIKE 'T8TX-%'`);
      await admin.query(`DELETE FROM persons WHERE created_by_account_id IN ${acct}`);
      await admin.query(`DELETE FROM accounts WHERE wechat_openid LIKE 'fake_${PREFIX}%'`);
    } catch {
      // best-effort cleanup: real assertion failures must still be reported
    }
    await pool.end();
    await admin.end();
    await app.close();
  });

  async function newOwner(label: string) {
    const owner = await login(app, `${PREFIX}${label}_${Date.now()}_${seq++}`);
    return { token: owner.token, accountId: owner.accountId, personId: owner.personId };
  }

  async function newFamily(owner: { token: string }, label: string): Promise<string> {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/families',
      headers: {
        authorization: `Bearer ${owner.token}`,
        'idempotency-key': `${PREFIX}f_${label}_${Date.now()}_${seq++}`,
      },
      payload: {
        displayName: `T8TX-${label}`,
        creator: { ageBand: 'ADULT', ageBandSource: 'SELF_STATEMENT' },
      },
    });
    expect(res.statusCode).toBe(201);
    return res.json().id as string;
  }

  async function newCase(
    owner: { token: string },
    label: string,
    withMessage = true
  ): Promise<{ caseId: string; caseVersion: number; messageId: string | null }> {
    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/cases',
      headers: {
        authorization: `Bearer ${owner.token}`,
        'idempotency-key': `${PREFIX}c_${label}_${Date.now()}_${seq++}`,
      },
      payload: {},
    });
    expect(created.statusCode).toBe(201);
    const row = created.json() as { id: string; version: number };
    if (!withMessage) {
      return { caseId: row.id, caseVersion: row.version, messageId: null };
    }
    const message = await app.inject({
      method: 'POST',
      url: `/api/v1/cases/${row.id}/messages`,
      headers: {
        authorization: `Bearer ${owner.token}`,
        'idempotency-key': `${PREFIX}m_${label}_${Date.now()}_${seq++}`,
      },
      payload: { content: '同一事务组合' },
    });
    expect(message.statusCode).toBe(201);
    return {
      caseId: row.id,
      caseVersion: row.version,
      messageId: message.json().id as string,
    };
  }

  /** Baseline fixture: owner + family + INTAKE case (+ one dialogue message). */
  async function prepare(label: string, withMessage = true) {
    const owner = await newOwner(label);
    const familyId = await newFamily(owner, label);
    const created = await newCase(owner, label, withMessage);
    return {
      owner,
      actor: { accountId: owner.accountId, personId: owner.personId },
      familyId,
      ...created,
    };
  }

  function formulationContent(messageId: string | null) {
    if (messageId === null) throw new Error('fixture is missing a dialogue message');
    const ref = { type: 'DIALOGUE_MESSAGE' as const, id: messageId };
    return {
      primaryProblem: { text: '同一事务组合', evidenceRefs: [ref] },
      keyFactors: [],
      evidenceRefs: [ref],
      unknowns: [],
      conflicts: [],
      sceneFit: 'family_common_core',
      alternativeExplanations: [],
      reassessmentConditions: [],
      exitConditions: [],
      dependencyRefs: [{ type: 'EVIDENCE' as const, evidence: ref }],
    };
  }

  /** Only the Slice 8 facts of THIS command, never unrelated Case events. */
  async function facts(
    caseId: string,
    familyId: string,
    accountId: string,
    command: FormulationCommand
  ): Promise<Facts> {
    const eventType = EVENT_TYPES[command];
    const { rows } = await admin.query(
      `SELECT
         (SELECT version FROM cases WHERE id = $1) AS version,
         (SELECT phase FROM cases WHERE id = $1) AS phase,
         (SELECT count(*)::int FROM problem_formulations WHERE case_id = $1) AS formulations,
         (SELECT count(*)::int FROM case_events
            WHERE case_id = $1 AND event_type = $4) AS events,
         (SELECT count(*)::int FROM business_audit_events
            WHERE family_id = $2 AND event_type = $4) AS audits,
         (SELECT count(*)::int FROM idempotency_keys
            WHERE actor_account_id = $3 AND command_type = $5) AS idempotency`,
      [caseId, familyId, accountId, eventType, command]
    );
    return rows[0] as Facts;
  }

  /**
   * Mirrors exactly what `withRlsTransaction` establishes, but on a client the
   * CALLER owns. The seam must never re-establish or overwrite this context.
   */
  async function beginCallerTransaction(
    client: pg.PoolClient,
    opts: { accountId: string; personId: string; familyId: string }
  ): Promise<void> {
    await client.query('BEGIN');
    await client.query('SELECT app.set_identity_context($1, $2)', [
      opts.accountId,
      PURPOSE,
    ]);
    await client.query('SELECT app.set_family_context($1, $2, $3)', [
      opts.familyId,
      opts.personId,
      PURPOSE,
    ]);
  }

  async function currentTransactionId(client: pg.PoolClient): Promise<string> {
    const { rows } = await client.query<{ txid: string }>(
      'SELECT txid_current()::text AS txid'
    );
    return rows[0].txid;
  }

  /** Always leave the pooled client outside a transaction, even on failure. */
  async function endCallerTransaction(
    client: pg.PoolClient,
    action: 'ROLLBACK' | 'COMMIT'
  ): Promise<void> {
    try {
      await client.query(action);
    } catch {
      await client.query('ROLLBACK').catch(() => undefined);
    }
  }

  // ── StartAssessment: outer rollback removes every fact ─────────────

  it('StartAssessment rolls back completely when the caller transaction fails afterwards', async () => {
    const p = await prepare('start_rollback');
    const baseline = await facts(
      p.caseId,
      p.familyId,
      p.actor.accountId,
      'CASE_START_ASSESSMENT'
    );
    expect(baseline).toMatchObject({
      version: p.caseVersion,
      phase: 'INTAKE',
      events: 0,
      audits: 0,
      idempotency: 0,
    });

    const idempotencyKey = `${PREFIX}s_${Date.now()}_${seq++}`;
    const client = await pool.connect();
    try {
      await beginCallerTransaction(client, {
        accountId: p.actor.accountId,
        personId: p.actor.personId,
        familyId: p.familyId,
      });
      const result = await startAssessmentInTransaction(client, {
        actor: p.actor,
        familyId: p.familyId,
        caseId: p.caseId,
        expectedCaseVersion: p.caseVersion,
        idempotencyKey,
      });
      expect(result.status).toBe(200);
      expect((result.body as { caseVersion: number }).caseVersion).toBe(
        p.caseVersion + 1
      );

      // Inside the caller's own transaction the write is fully present: every
      // Slice 8 fact exists and is only waiting for the outer COMMIT.
      const inside = await client.query<Facts>(
        `SELECT
           (SELECT version FROM cases WHERE id = $1) AS version,
           (SELECT phase FROM cases WHERE id = $1) AS phase,
           (SELECT count(*)::int FROM case_events
              WHERE case_id = $1 AND event_type = 'CASE_ASSESSMENT_STARTED') AS events,
           (SELECT count(*)::int FROM business_audit_events
              WHERE family_id = $2 AND event_type = 'CASE_ASSESSMENT_STARTED') AS audits,
           (SELECT count(*)::int FROM idempotency_keys
              WHERE actor_account_id = $3 AND command_type = 'CASE_START_ASSESSMENT') AS idempotency`,
        [p.caseId, p.familyId, p.actor.accountId]
      );
      expect(inside.rows[0]).toMatchObject({
        version: p.caseVersion + 1,
        phase: 'ASSESSMENT',
        events: 1,
        audits: 1,
        idempotency: 1,
      });

      // Injected caller-owned failure: a real statement error aborts the
      // caller's transaction, exactly like a later downstream business write.
      await expect(client.query('SELECT 1 / 0')).rejects.toThrow();
    } finally {
      await endCallerTransaction(client, 'ROLLBACK');
      client.release();
    }

    expect(
      await facts(p.caseId, p.familyId, p.actor.accountId, 'CASE_START_ASSESSMENT')
    ).toEqual(baseline);

    // Idempotency completion rolled back too: the same key must re-execute
    // rather than replay the discarded response.
    const retried = await startAssessment(pool, {
      actor: p.actor,
      familyId: p.familyId,
      caseId: p.caseId,
      expectedCaseVersion: p.caseVersion,
      idempotencyKey,
    });
    expect(retried.status).toBe(200);
    expect((retried.body as { caseVersion: number }).caseVersion).toBe(
      p.caseVersion + 1
    );
    expect(
      await facts(p.caseId, p.familyId, p.actor.accountId, 'CASE_START_ASSESSMENT')
    ).toMatchObject({
      version: p.caseVersion + 1,
      phase: 'ASSESSMENT',
      events: 1,
      audits: 1,
      idempotency: 1,
    });
  });

  // ── PresentProblemFormulation: outer rollback removes every fact ───

  it('PresentProblemFormulation rolls back completely when the caller transaction fails afterwards', async () => {
    const p = await prepare('present_rollback');
    const started = await startAssessment(pool, {
      actor: p.actor,
      familyId: p.familyId,
      caseId: p.caseId,
      expectedCaseVersion: p.caseVersion,
      idempotencyKey: `${PREFIX}s_${Date.now()}_${seq++}`,
    });
    expect(started.status).toBe(200);
    const assessmentVersion = (started.body as { caseVersion: number }).caseVersion;
    const baseline = await facts(
      p.caseId,
      p.familyId,
      p.actor.accountId,
      'PROBLEM_FORMULATION_PRESENT'
    );
    expect(baseline).toMatchObject({
      version: assessmentVersion,
      phase: 'ASSESSMENT',
      formulations: 0,
      events: 0,
      audits: 0,
      idempotency: 0,
    });

    const input = {
      actor: p.actor,
      familyId: p.familyId,
      caseId: p.caseId,
      expectedCaseVersion: assessmentVersion,
      idempotencyKey: `${PREFIX}p_${Date.now()}_${seq++}`,
      content: formulationContent(p.messageId),
    };

    // max:1: any second pool checkout inside the seam would block or show up
    // in totalCount, so this also proves Present uses only the caller client.
    const dedicated = new pg.Pool({
      connectionString: process.env['DATABASE_URL'],
      max: 1,
    });
    const client = await dedicated.connect();
    try {
      await beginCallerTransaction(client, {
        accountId: p.actor.accountId,
        personId: p.actor.personId,
        familyId: p.familyId,
      });
      const beforeTxid = await currentTransactionId(client);
      const result = await presentProblemFormulationInTransaction(client, input);
      expect(result.status).toBe(200);
      expect((result.body as { caseVersion: number }).caseVersion).toBe(
        assessmentVersion + 1
      );
      // Same transaction id and exactly one connection: no second checkout and
      // no BEGIN/COMMIT underneath the caller.
      expect(await currentTransactionId(client)).toBe(beforeTxid);
      expect(dedicated.totalCount).toBe(1);
      expect(dedicated.idleCount).toBe(0);
      expect(dedicated.waitingCount).toBe(0);

      const inside = await client.query<{ formulations: number; version: number }>(
        `SELECT
           (SELECT count(*)::int FROM problem_formulations WHERE case_id = $1) AS formulations,
           (SELECT version FROM cases WHERE id = $1) AS version`,
        [p.caseId]
      );
      expect(inside.rows[0]).toMatchObject({
        formulations: 1,
        version: assessmentVersion + 1,
      });

      await expect(client.query('SELECT 1 / 0')).rejects.toThrow();
    } finally {
      await endCallerTransaction(client, 'ROLLBACK');
      client.release();
      await dedicated.end();
    }

    expect(
      await facts(p.caseId, p.familyId, p.actor.accountId, 'PROBLEM_FORMULATION_PRESENT')
    ).toEqual(baseline);

    // Same key re-executes after the rollback (no stale replay snapshot).
    const retried = await presentProblemFormulation(pool, input);
    expect(retried.status).toBe(200);
    expect(
      await facts(p.caseId, p.familyId, p.actor.accountId, 'PROBLEM_FORMULATION_PRESENT')
    ).toMatchObject({
      version: assessmentVersion + 1,
      phase: 'PROBLEM_FORMULATION',
      formulations: 1,
      events: 1,
      audits: 1,
      idempotency: 1,
    });
  });

  // ── The real Slice 12 composition shape ────────────────────────────

  it('composes StartAssessment + PresentProblemFormulation in one caller-owned transaction', async () => {
    const p = await prepare('compose');
    const startKey = `${PREFIX}s_${Date.now()}_${seq++}`;
    const presentKey = `${PREFIX}p_${Date.now()}_${seq++}`;

    const client = await pool.connect();
    let committedVersion = 0;
    try {
      await beginCallerTransaction(client, {
        accountId: p.actor.accountId,
        personId: p.actor.personId,
        familyId: p.familyId,
      });

      const started = await startAssessmentInTransaction(client, {
        actor: p.actor,
        familyId: p.familyId,
        caseId: p.caseId,
        expectedCaseVersion: p.caseVersion,
        idempotencyKey: startKey,
      });
      expect(started.status).toBe(200);

      const presented = await presentProblemFormulationInTransaction(client, {
        actor: p.actor,
        familyId: p.familyId,
        caseId: p.caseId,
        expectedCaseVersion: (started.body as { caseVersion: number }).caseVersion,
        idempotencyKey: presentKey,
        content: formulationContent(p.messageId),
      });
      expect(presented.status).toBe(200);
      committedVersion = (presented.body as { caseVersion: number }).caseVersion;

      // Nothing is visible to other connections before the caller commits.
      expect(
        await facts(p.caseId, p.familyId, p.actor.accountId, 'CASE_START_ASSESSMENT')
      ).toMatchObject({
        version: p.caseVersion,
        phase: 'INTAKE',
        events: 0,
        audits: 0,
        idempotency: 0,
      });

      await endCallerTransaction(client, 'COMMIT');
    } finally {
      client.release();
    }

    expect(committedVersion).toBe(p.caseVersion + 2);
    expect(
      await facts(p.caseId, p.familyId, p.actor.accountId, 'CASE_START_ASSESSMENT')
    ).toMatchObject({
      version: p.caseVersion + 2,
      phase: 'PROBLEM_FORMULATION',
      events: 1,
      audits: 1,
      idempotency: 1,
    });
    expect(
      await facts(p.caseId, p.familyId, p.actor.accountId, 'PROBLEM_FORMULATION_PRESENT')
    ).toMatchObject({
      version: p.caseVersion + 2,
      phase: 'PROBLEM_FORMULATION',
      formulations: 1,
      events: 1,
      audits: 1,
      idempotency: 1,
    });
  });

  // ── Same client / same transaction proof ───────────────────────────

  it('uses only the provided client and never opens or commits its own transaction', async () => {
    const p = await prepare('single_client');
    const dedicated = new pg.Pool({
      connectionString: process.env['DATABASE_URL'],
      max: 1,
    });
    const client = await dedicated.connect();
    try {
      await beginCallerTransaction(client, {
        accountId: p.actor.accountId,
        personId: p.actor.personId,
        familyId: p.familyId,
      });
      const beforeTxid = await currentTransactionId(client);

      const result = await startAssessmentInTransaction(client, {
        actor: p.actor,
        familyId: p.familyId,
        caseId: p.caseId,
        expectedCaseVersion: p.caseVersion,
        idempotencyKey: `${PREFIX}s_${Date.now()}_${seq++}`,
      });
      expect(result.status).toBe(200);

      // Same transaction id: no BEGIN/COMMIT happened underneath the caller.
      expect(await currentTransactionId(client)).toBe(beforeTxid);
      // The max:1 pool holds exactly one connection: no second checkout.
      expect(dedicated.totalCount).toBe(1);
      expect(dedicated.idleCount).toBe(0);
      expect(dedicated.waitingCount).toBe(0);

      // Lock ownership: the Family and Case row locks belong to THIS backend,
      // so the seam acquired them on the caller's connection and transaction.
      const locks = await client.query<{ relname: string }>(
        `SELECT DISTINCT c.relname
           FROM pg_locks l
           JOIN pg_class c ON c.oid = l.relation
          WHERE l.pid = pg_backend_pid()
            AND l.mode = 'RowShareLock'
            AND c.relname IN ('families', 'cases')
          ORDER BY c.relname`
      );
      expect(locks.rows.map((row) => row.relname)).toEqual(['cases', 'families']);

      // Still invisible outside the transaction until the caller commits.
      expect(
        await facts(p.caseId, p.familyId, p.actor.accountId, 'CASE_START_ASSESSMENT')
      ).toMatchObject({ version: p.caseVersion, phase: 'INTAKE', idempotency: 0 });

      await endCallerTransaction(client, 'ROLLBACK');
    } finally {
      client.release();
      await dedicated.end();
    }

    expect(
      await facts(p.caseId, p.familyId, p.actor.accountId, 'CASE_START_ASSESSMENT')
    ).toMatchObject({ version: p.caseVersion, phase: 'INTAKE', idempotency: 0 });
  });

  // ── Idempotency parity inside the caller transaction ───────────────

  it('replays the same key + payload in-tx and rejects a different payload', async () => {
    const p = await prepare('in_tx_idempotency');
    const input = {
      actor: p.actor,
      familyId: p.familyId,
      caseId: p.caseId,
      expectedCaseVersion: p.caseVersion,
      idempotencyKey: `${PREFIX}s_${Date.now()}_${seq++}`,
    };

    const client = await pool.connect();
    try {
      await beginCallerTransaction(client, {
        accountId: p.actor.accountId,
        personId: p.actor.personId,
        familyId: p.familyId,
      });
      const first = await startAssessmentInTransaction(client, input);
      expect(first.status).toBe(200);

      // Same key + same payload inside the same transaction: replay, no second
      // phase/version transition.
      const replay = await startAssessmentInTransaction(client, input);
      expect(replay).toMatchObject({ status: first.status, etag: first.etag });
      expect(replay.body).toEqual(first.body);

      // Same key + different payload: the frozen 409 mismatch vocabulary.
      await expect(
        startAssessmentInTransaction(client, {
          ...input,
          expectedCaseVersion: p.caseVersion + 41,
        })
      ).rejects.toMatchObject({
        statusCode: 409,
        code: 'IDEMPOTENCY_PAYLOAD_MISMATCH',
      });

      await endCallerTransaction(client, 'COMMIT');
    } finally {
      client.release();
    }

    expect(
      await facts(p.caseId, p.familyId, p.actor.accountId, 'CASE_START_ASSESSMENT')
    ).toMatchObject({
      version: p.caseVersion + 1,
      phase: 'ASSESSMENT',
      events: 1,
      audits: 1,
      idempotency: 1,
    });
  });

  it('replays the same key + payload in-tx for PresentProblemFormulation and rejects a different payload', async () => {
    const p = await prepare('present_in_tx_idempotency');
    const started = await startAssessment(pool, {
      actor: p.actor,
      familyId: p.familyId,
      caseId: p.caseId,
      expectedCaseVersion: p.caseVersion,
      idempotencyKey: `${PREFIX}s_${Date.now()}_${seq++}`,
    });
    expect(started.status).toBe(200);
    const assessmentVersion = (started.body as { caseVersion: number }).caseVersion;
    const content = formulationContent(p.messageId);
    const input = {
      actor: p.actor,
      familyId: p.familyId,
      caseId: p.caseId,
      expectedCaseVersion: assessmentVersion,
      idempotencyKey: `${PREFIX}p_${Date.now()}_${seq++}`,
      content,
    };

    const client = await pool.connect();
    try {
      await beginCallerTransaction(client, {
        accountId: p.actor.accountId,
        personId: p.actor.personId,
        familyId: p.familyId,
      });
      const first = await presentProblemFormulationInTransaction(client, input);
      expect(first.status).toBe(200);

      // Same key + same payload inside the same transaction: replay, no second
      // formulation write and no second Case version bump.
      const replay = await presentProblemFormulationInTransaction(client, input);
      expect(replay).toMatchObject({ status: first.status, etag: first.etag });
      expect(replay.body).toEqual(first.body);

      // Same key + different payload: the frozen 409 mismatch vocabulary.
      await expect(
        presentProblemFormulationInTransaction(client, {
          ...input,
          content: {
            ...content,
            primaryProblem: {
              ...content.primaryProblem,
              text: 'different candidate content',
            },
          },
        })
      ).rejects.toMatchObject({
        statusCode: 409,
        code: 'IDEMPOTENCY_PAYLOAD_MISMATCH',
      });

      await endCallerTransaction(client, 'COMMIT');
    } finally {
      client.release();
    }

    expect(
      await facts(p.caseId, p.familyId, p.actor.accountId, 'PROBLEM_FORMULATION_PRESENT')
    ).toMatchObject({
      version: assessmentVersion + 1,
      phase: 'PROBLEM_FORMULATION',
      formulations: 1,
      events: 1,
      audits: 1,
      idempotency: 1,
    });
  });

  // ── Savepoint scope: an in-tx 4xx must not poison the caller ───────

  it('keeps the caller transaction usable after an in-tx business 4xx', async () => {
    // No dialogue message: the traceable-statement guard rejects with a 422
    // business outcome that the authoritative core answers via SAVEPOINT.
    const p = await prepare('savepoint_scope', false);
    const client = await pool.connect();
    try {
      await beginCallerTransaction(client, {
        accountId: p.actor.accountId,
        personId: p.actor.personId,
        familyId: p.familyId,
      });
      const result = await startAssessmentInTransaction(client, {
        actor: p.actor,
        familyId: p.familyId,
        caseId: p.caseId,
        expectedCaseVersion: p.caseVersion,
        idempotencyKey: `${PREFIX}s_${Date.now()}_${seq++}`,
      });
      expect(result.status).toBe(422);
      expect(result.body).toMatchObject({
        code: 'TRACEABLE_PROBLEM_STATEMENT_REQUIRED',
      });

      // The caller's transaction is NOT aborted: the seam rolled back to its
      // own savepoint, never the caller transaction.
      const probe = await client.query<{ ok: number }>('SELECT 1 AS ok');
      expect(probe.rows[0].ok).toBe(1);

      await endCallerTransaction(client, 'ROLLBACK');
    } finally {
      client.release();
    }

    expect(
      await facts(p.caseId, p.familyId, p.actor.accountId, 'CASE_START_ASSESSMENT')
    ).toMatchObject({
      version: p.caseVersion,
      phase: 'INTAKE',
      events: 0,
      audits: 0,
      idempotency: 0,
    });
  });

  // ── RLS / authorization cannot be bypassed through the seam ────────

  it('fails closed when the caller client has no RLS context', async () => {
    const p = await prepare('no_context');
    const baseline = await facts(
      p.caseId,
      p.familyId,
      p.actor.accountId,
      'CASE_START_ASSESSMENT'
    );

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const error = (await startAssessmentInTransaction(client, {
        actor: p.actor,
        familyId: p.familyId,
        caseId: p.caseId,
        expectedCaseVersion: p.caseVersion,
        idempotencyKey: `${PREFIX}s_${Date.now()}_${seq++}`,
      }).then(
        () => null,
        (err: unknown) => err as { statusCode?: number; code?: string }
      )) as { statusCode?: number; code?: string } | null;

      expect(error, 'the seam must not run without an established RLS context').not.toBeNull();
      // Existing 404 CASE_NOT_FOUND vocabulary only — no new error class.
      expect(error).toMatchObject({ statusCode: 404, code: 'CASE_NOT_FOUND' });
    } finally {
      await endCallerTransaction(client, 'ROLLBACK');
      client.release();
    }

    expect(
      await facts(p.caseId, p.familyId, p.actor.accountId, 'CASE_START_ASSESSMENT')
    ).toEqual(baseline);
  });

  it('fails closed when the caller client identity does not match the acting actor', async () => {
    const p = await prepare('wrong_identity');
    const other = await newOwner('wrong_identity_other');
    const otherFamilyId = await newFamily(other, 'wrong_identity_other');
    const baseline = await facts(
      p.caseId,
      p.familyId,
      p.actor.accountId,
      'CASE_START_ASSESSMENT'
    );

    const client = await pool.connect();
    try {
      // A perfectly valid RLS context — for a different account and Family.
      await beginCallerTransaction(client, {
        accountId: other.accountId,
        personId: other.personId,
        familyId: otherFamilyId,
      });
      await expect(
        startAssessmentInTransaction(client, {
          actor: p.actor,
          familyId: p.familyId,
          caseId: p.caseId,
          expectedCaseVersion: p.caseVersion,
          idempotencyKey: `${PREFIX}s_${Date.now()}_${seq++}`,
        })
      ).rejects.toMatchObject({ statusCode: 404, code: 'CASE_NOT_FOUND' });
    } finally {
      await endCallerTransaction(client, 'ROLLBACK');
      client.release();
    }

    expect(
      await facts(p.caseId, p.familyId, p.actor.accountId, 'CASE_START_ASSESSMENT')
    ).toEqual(baseline);
  });
});