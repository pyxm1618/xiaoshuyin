/**
 * MEDIUM-02 — H-02 post-Gate2 concurrency barrier matrix.
 *
 * The binding transaction is paused INSIDE Gate 2, after
 * `lockBindingGateFacts()` has taken the authoritative row locks but before
 * `evaluateGateForTarget()` reads current facts. The pause point is the
 * invitation port (commit.ts calls it between the lock acquisition and the Gate
 * evaluation), so no production code is modified for the test.
 *
 * For each fact class we prove one of:
 *   - binding-first: the concurrent invalidating DML is REAL and BLOCKED by the
 *     Gate lock (PostgreSQL 55P03 under lock_timeout); the binding then commits.
 *   - invalidation-first: the invalidator holds the row lock first, the binding
 *     transaction is observably blocked on it (`pg_blocking_pids`), and after
 *     the invalidator commits the binding fails closed.
 *   - candidate conflict: Gate 2 saw a stale PASS, but Phase C must still fail
 *     closed and never COMMIT.
 *
 * Invitation state is a CONTRACT-SEAM proof only (in-memory port fixture).
 * It is NOT a production Slice 4 barrier; T121–T124 remain BLOCKED.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import {
  buildBindingApp,
  createAppPool,
  createTarget,
  startBinding,
  type BindingHarness,
  type TargetFixture,
} from '../setup/identity-binding.js';
import { createFamily, login, loginWithLabel } from '../setup/api.js';
import {
  InMemoryInvitationPort,
  type InvitationResolution,
  type InvitationResolutionPort,
} from '../../apps/server/api/src/identity-binding/invitation-port.js';
import { commitAttempt } from '../../apps/server/api/src/identity-binding/commit.js';
import { evaluateGateForTarget } from '../../apps/server/api/src/identity-binding/gate.js';
import { withBindingGateTransaction } from '../../apps/server/api/src/db/tx.js';

const LOCK_TIMEOUT_MS = 500;
const WAIT_MS = 8000;

class BarrierPort implements InvitationResolutionPort {
  private hook: (() => Promise<void>) | null = null;
  private reachedResolve!: () => void;
  readonly reached = new Promise<void>((resolve) => {
    this.reachedResolve = resolve;
  });

  constructor(private readonly inner: InMemoryInvitationPort) {}

  arm(hook: () => Promise<void>): void {
    this.hook = hook;
  }

  async resolveByToken(_tx: any, invitationToken: string): Promise<InvitationResolution> {
    return this.inner.resolveByToken(_tx, invitationToken);
  }

  async resolveByParticipationId(tx: any, participationId: string): Promise<InvitationResolution> {
    const resolution = await this.inner.resolveByParticipationId(tx, participationId);
    const hook = this.hook;
    if (hook) {
      this.hook = null;
      this.reachedResolve();
      await hook();
    }
    return resolution;
  }
}

function requireValidInvitation(invitation: { status: string }) {
  expect(invitation.status).toBe('VALID');
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor<T>(check: () => Promise<T | null>, label: string): Promise<T> {
  const deadline = Date.now() + WAIT_MS;
  while (Date.now() < deadline) {
    const value = await check();
    if (value !== null) return value;
    await sleep(50);
  }
  throw new Error(`timeout waiting for ${label}`);
}

describe('H-02 Gate 2 barrier matrix (MEDIUM-02)', () => {
  let h: BindingHarness;
  let appPool: ReturnType<typeof createAppPool>;

  beforeAll(async () => {
    h = await buildBindingApp();
    appPool = createAppPool();
  });

  afterAll(async () => {
    await appPool.end();
    await h.close();
  });

  async function assertGate2InitialPass(
    target: TargetFixture,
    confirmerPersonId: string,
    confirmerAccountId: string
  ): Promise<void> {
    const result = await withBindingGateTransaction(
      appPool,
      { targetPersonId: target.targetPersonId, targetFamilyId: target.familyId },
      async (tx) => {
        const invitation = await h.port.resolveByParticipationId(tx, target.participationId);
        requireValidInvitation(invitation);
        const { result: gate } = await evaluateGateForTarget(tx, {
          stage: 'GATE_2',
          targetPersonId: target.targetPersonId,
          targetFamilyId: target.familyId,
          invitation,
          candidateAccountId: null,
          candidateAccountBoundPersonId: null,
          confirmer: { accountId: confirmerAccountId, personId: confirmerPersonId },
          confirmations: { candidate: true, secondParty: true },
        });
        return gate;
      }
    );
    expect(result.decision).toBe('PASS');
  }

  async function seedSecondPartyConfirmation(
    target: TargetFixture,
    confirmerPersonId: string,
    attemptId: string,
    authority: 'GUARDIAN' | 'FAMILY_MANAGER' = 'GUARDIAN'
  ): Promise<void> {
    await h.admin.query(
      `INSERT INTO binding_confirmations
         (attempt_id, kind, actor_account_id, actor_person_id, authority,
          target_confirmed, candidate_recognized, statement_version)
       VALUES ($1, 'SECOND_PARTY', $2, $3, $4, true, true, 'second-party-recognition-v1')`,
      [attemptId, target.guardian.accountId, confirmerPersonId, authority]
    );
  }

  async function taggedAppPool(tag: string) {
    const pool = createAppPool(1);
    const client = await pool.connect();
    await client.query(`SET application_name = '${tag}'`);
    client.release();
    return pool;
  }

  async function backendOf(tag: string) {
    const { rows } = await h.admin.query(
      `SELECT pid, usename, state, wait_event_type, wait_event
         FROM pg_stat_activity WHERE application_name = $1
        ORDER BY backend_start DESC LIMIT 1`,
      [tag]
    );
    return rows[0] ?? null;
  }

  async function gateLockRelations(pid: number): Promise<string[]> {
    const { rows } = await h.admin.query(
      `SELECT DISTINCT c.relname
         FROM pg_locks l
         JOIN pg_class c ON c.oid = l.relation
        WHERE l.pid = $1
          AND l.locktype = 'relation'
          AND c.relname = ANY($2::text[])`,
      [
        pid,
        [
          'persons',
          'families',
          'family_members',
          'person_compliance_profiles',
          'consent_records',
        ],
      ]
    );
    return rows.map((r: any) => r.relname as string);
  }

  async function terminalAuditCount(attemptId: string, reason: string): Promise<number> {
    const { rows } = await h.admin.query(
      `SELECT count(*)::int AS n FROM identity_binding_audit_events
        WHERE attempt_id = $1 AND event_type = 'BINDING_TERMINAL'
          AND terminal_reason = $2`,
      [attemptId, reason]
    );
    return rows[0].n as number;
  }

  async function assertNoResidualSecret(attemptId: string): Promise<void> {
    const { rows } = await h.admin.query(
      `SELECT count(*)::int AS n FROM binding_pending_contexts
        WHERE attempt_id = $1
          AND (openid_ciphertext IS NOT NULL OR openid_nonce IS NOT NULL OR openid_tag IS NOT NULL)`,
      [attemptId]
    );
    expect(rows[0].n).toBe(0);
  }

  async function assertTerminalNoBinding(
    target: TargetFixture,
    attemptId: string,
    reason: string
  ): Promise<void> {
    const attempt = await h.admin.query(
      'SELECT state, terminal_reason, committed_account_id FROM binding_attempts WHERE id = $1',
      [attemptId]
    );
    expect(attempt.rows[0].state).toBe('TERMINAL');
    expect(attempt.rows[0].terminal_reason).toBe(reason);
    expect(attempt.rows[0].committed_account_id).toBeNull();
    expect(attempt.rows[0]).toMatchObject({
      state: 'TERMINAL',
      terminal_reason: reason,
      committed_account_id: null,
    });
    const person = await h.admin.query('SELECT account_id FROM persons WHERE id = $1', [
      target.targetPersonId,
    ]);
    expect(person.rows[0].account_id).toBeNull();
    expect(await terminalAuditCount(attemptId, reason)).toBe(1);
    await assertNoResidualSecret(attemptId);
    const committed = await h.admin.query(
      `SELECT count(*)::int AS n FROM identity_binding_audit_events
        WHERE attempt_id = $1 AND event_type = 'BINDING_COMMITTED'`,
      [attemptId]
    );
    expect(committed.rows[0].n).toBe(0);
  }

  /**
   * Binding-first: commit is paused inside Gate 2 holding the Gate locks.
   * `invalidate` must be real DML that is blocked by those locks.
   */
  async function runBindingFirst(input: {
    target: TargetFixture;
    attemptId: string;
    tag: string;
    invalidate: () => Promise<{ blocked: boolean; code?: string }>;
  }): Promise<void> {
    const port = new BarrierPort(h.port);
    let release!: () => void;
    const paused = new Promise<void>((resolve) => {
      release = resolve;
    });
    port.arm(() => paused);

    const commitPool = await taggedAppPool(input.tag);
    let commit: Promise<any> | null = null;
    let released = false;
    try {
      commit = commitAttempt(
        {
          pool: commitPool,
          invitationPort: port,
          identityBindingSecret: process.env['IDENTITY_BINDING_SECRET']!,
        },
        {
          attemptId: input.attemptId,
          targetPersonId: input.target.targetPersonId,
          targetFamilyId: input.target.familyId,
          actorAccountId: input.target.guardian.accountId,
        }
      );

      await Promise.race([
        port.reached,
        sleep(WAIT_MS).then(() => {
          throw new Error('binding transaction never reached the Gate 2 pause point');
        }),
      ]);

      const backend = await waitFor(() => backendOf(input.tag), `backend ${input.tag}`);
      expect(backend.usename).toBe('xiaoshuyin_app');
      // The binding transaction already holds relation locks for the Gate facts.
      const lockedRelations = await gateLockRelations(backend.pid);
      expect(lockedRelations).toEqual(
        expect.arrayContaining([
          'persons',
          'families',
          'family_members',
          'person_compliance_profiles',
          'consent_records',
        ])
      );

      const blocked = await input.invalidate();
      expect(blocked.blocked).toBe(true);

      release();
      released = true;
      const outcome = await commit;
      expect(outcome.outcome).toBe('COMMITTED');
    } finally {
      if (!released) release();
      if (commit) await commit.catch(() => {});
      await commitPool.end();
    }
  }

  /** Admin DML with a bounded lock wait; returns whether it was blocked. */
  async function adminBlocked(
    sql: string,
    params: unknown[],
    opts: { immediateConstraints?: boolean } = {}
  ): Promise<{ blocked: boolean; code?: string }> {
    const client = await h.admin.connect();
    try {
      await client.query('BEGIN');
      if (opts.immediateConstraints) {
        // family_members.person_id FK is DEFERRABLE INITIALLY DEFERRED. Forcing
        // immediate constraint checking makes the concurrent INSERT itself take
        // the P1 FOR KEY SHARE and therefore collide with the binding
        // transaction's P1 FOR UPDATE.
        await client.query('SET CONSTRAINTS ALL IMMEDIATE');
      }
      await client.query(`SET LOCAL lock_timeout = '${LOCK_TIMEOUT_MS}ms'`);
      try {
        await client.query(sql, params as any[]);
        await client.query('ROLLBACK');
        return { blocked: false };
      } catch (err: any) {
        await client.query('ROLLBACK');
        return { blocked: err.code === '55P03', code: err.code };
      }
    } finally {
      client.release();
    }
  }

  /** App-role consent DML with bounded lock wait (runtime role). */
  async function appConsentBlocked(target: TargetFixture): Promise<{ blocked: boolean; code?: string }> {
    const pool = createAppPool(1);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT app.set_identity_context($1, $2)', [
        target.guardian.accountId,
        'GUARDIAN_CONSENT',
      ]);
      await client.query('SELECT app.set_family_context($1, $2, $3)', [
        target.familyId,
        target.guardian.personId,
        'GUARDIAN_CONSENT',
      ]);
      await client.query(`SET LOCAL lock_timeout = '${LOCK_TIMEOUT_MS}ms'`);
      try {
        await client.query('UPDATE consent_records SET bound_at = bound_at WHERE id = $1', [
          target.consentId,
        ]);
        await client.query('ROLLBACK');
        return { blocked: false };
      } catch (err: any) {
        await client.query('ROLLBACK');
        return { blocked: err.code === '55P03', code: err.code };
      }
    } finally {
      client.release();
      await pool.end();
    }
  }

  /** Open a real admin transaction that holds the invalidation lock. */
  async function adminInvalidator(sql: string, params: unknown[]) {
    const client = await h.admin.connect();
    await client.query('BEGIN');
    await client.query(sql, params as any[]);
    return {
      pid: client.processID as number,
      commit: async () => {
        await client.query('COMMIT');
      },
      rollback: async () => {
        try {
          await client.query('ROLLBACK');
        } catch {
          // Already committed.
        } finally {
          client.release();
        }
      },
    };
  }

  /**
   * Invalidation-first: the invalidator holds the authoritative fact lock, the
   * binding transaction is observably parked on it (`pg_blocking_pids`), then
   * the invalidator commits and the binding must settle TERMINAL with no write.
   */
  async function runInvalidationFirst(input: {
    target: TargetFixture;
    attemptId: string;
    tag: string;
    openInvalidator: () => Promise<{
      pid: number;
      commit: () => Promise<void>;
      rollback: () => Promise<void>;
    }>;
    reason: string;
  }): Promise<void> {
    const invalidator = await input.openInvalidator();
    const commitPool = await taggedAppPool(input.tag);
    let commit: Promise<any> | null = null;
    try {
      commit = commitAttempt(
        {
          pool: commitPool,
          invitationPort: h.port,
          identityBindingSecret: process.env['IDENTITY_BINDING_SECRET']!,
        },
        {
          attemptId: input.attemptId,
          targetPersonId: input.target.targetPersonId,
          targetFamilyId: input.target.familyId,
          actorAccountId: input.target.guardian.accountId,
        }
      );

      const waiting = await waitFor(async () => {
        const backend = await backendOf(input.tag);
        if (!backend) return null;
        return backend.wait_event_type === 'Lock' ? backend : null;
      }, `binding transaction blocked on ${input.tag}`);
      expect(waiting.usename).toBe('xiaoshuyin_app');
      const blockers = await h.admin.query('SELECT pg_blocking_pids($1) AS pids', [waiting.pid]);
      expect(blockers.rows[0].pids).toContain(invalidator.pid);

      await invalidator.commit();
      const outcome = await commit;
      expect(outcome.outcome).toBe('TERMINAL');
      expect(outcome).toMatchObject({ outcome: 'TERMINAL', reason: input.reason });
    } finally {
      await invalidator.rollback();
      if (commit) await commit.catch(() => {});
      await commitPool.end();
    }

    await assertTerminalNoBinding(input.target, input.attemptId, input.reason);
  }

  it('profile / age-band: Gate lock blocks the concurrent profile UPDATE', async () => {
    const target = await createTarget(h, 'h02_age_lock', { ageBand: 'MINOR_14_17' });
    const { attemptId } = await startBinding(h, target, `h02_age_lock_${randomUUID()}`);
    await seedSecondPartyConfirmation(target, target.guardian.personId, attemptId);
    await assertGate2InitialPass(target, target.guardian.personId, target.guardian.accountId);

    await runBindingFirst({
      target,
      attemptId,
      tag: 'h02_age_lock',
      invalidate: () =>
        adminBlocked(
          "UPDATE person_compliance_profiles SET age_band = 'ADULT', minor_mode = false WHERE person_id = $1",
          [target.targetPersonId]
        ),
    });
  });

  it('missing compliance profile: Gate lock blocks the concurrent profile DELETE', async () => {
    const target = await createTarget(h, 'h02_profile_lock', { ageBand: 'MINOR_14_17' });
    const { attemptId } = await startBinding(h, target, `h02_profile_lock_${randomUUID()}`);
    await seedSecondPartyConfirmation(target, target.guardian.personId, attemptId);
    await assertGate2InitialPass(target, target.guardian.personId, target.guardian.accountId);

    await runBindingFirst({
      target,
      attemptId,
      tag: 'h02_profile_lock',
      invalidate: () =>
        adminBlocked('DELETE FROM person_compliance_profiles WHERE person_id = $1', [
          target.targetPersonId,
        ]),
    });
  });

  it('consent: Gate lock blocks the concurrent runtime-role consent UPDATE', async () => {
    const target = await createTarget(h, 'h02_consent_lock', { ageBand: 'UNDER_14' });
    const { attemptId } = await startBinding(h, target, `h02_consent_lock_${randomUUID()}`);
    await seedSecondPartyConfirmation(target, target.guardian.personId, attemptId);
    await assertGate2InitialPass(target, target.guardian.personId, target.guardian.accountId);

    await runBindingFirst({
      target,
      attemptId,
      tag: 'h02_consent_lock',
      invalidate: () => appConsentBlocked(target),
    });
  });

  it('guardian relationship: Gate lock blocks the concurrent guardian UPDATE', async () => {
    const target = await createTarget(h, 'h02_guardian_lock', { ageBand: 'MINOR_14_17' });
    const alt = await createTarget(h, 'h02_guardian_lock_alt', { ageBand: 'MINOR_14_17' });
    await h.admin.query(
      'UPDATE person_compliance_profiles SET guardian_person_id = $1 WHERE person_id = $2',
      [target.guardian.personId, target.targetPersonId]
    );
    const { attemptId } = await startBinding(h, target, `h02_guardian_lock_${randomUUID()}`);
    await seedSecondPartyConfirmation(target, target.guardian.personId, attemptId);
    await assertGate2InitialPass(target, target.guardian.personId, target.guardian.accountId);

    await runBindingFirst({
      target,
      attemptId,
      tag: 'h02_guardian_lock',
      invalidate: () =>
        adminBlocked(
          'UPDATE person_compliance_profiles SET guardian_person_id = $1 WHERE person_id = $2',
          [alt.guardian.personId, target.targetPersonId]
        ),
    });
  });

  it('membership: Gate lock blocks the concurrent membership DELETE', async () => {
    const target = await createTarget(h, 'h02_member_lock', { ageBand: 'MINOR_14_17' });
    const { attemptId } = await startBinding(h, target, `h02_member_lock_${randomUUID()}`);
    await seedSecondPartyConfirmation(target, target.guardian.personId, attemptId);
    await assertGate2InitialPass(target, target.guardian.personId, target.guardian.accountId);

    await runBindingFirst({
      target,
      attemptId,
      tag: 'h02_member_lock',
      invalidate: () =>
        adminBlocked('DELETE FROM family_members WHERE family_id = $1 AND person_id = $2', [
          target.familyId,
          target.targetPersonId,
        ]),
    });
  });

  it('P1 binding conflict: Gate lock blocks the concurrent P1 binding UPDATE', async () => {
    const target = await createTarget(h, 'h02_p1_lock', { ageBand: 'MINOR_14_17' });
    const { attemptId } = await startBinding(h, target, `h02_p1_lock_${randomUUID()}`);
    await seedSecondPartyConfirmation(target, target.guardian.personId, attemptId);
    await assertGate2InitialPass(target, target.guardian.personId, target.guardian.accountId);

    const external = await h.admin.query(
      'INSERT INTO accounts (wechat_openid, session_epoch) VALUES ($1, 0) RETURNING id',
      [`h02_p1_lock_${randomUUID()}`]
    );

    await runBindingFirst({
      target,
      attemptId,
      tag: 'h02_p1_lock',
      invalidate: () =>
        adminBlocked('UPDATE persons SET account_id = $1 WHERE id = $2', [
          external.rows[0].id,
          target.targetPersonId,
        ]),
    });
  });

  it('candidate Account conflict: stale Gate PASS still fails closed in Phase C', async () => {
    const target = await createTarget(h, 'h02_cand_lock', { ageBand: 'MINOR_14_17' });
    const code = `h02_cand_lock_${randomUUID()}`;
    const { attemptId } = await startBinding(h, target, code);
    await seedSecondPartyConfirmation(target, target.guardian.personId, attemptId);
    await assertGate2InitialPass(target, target.guardian.personId, target.guardian.accountId);

    const port = new BarrierPort(h.port);
    let release!: () => void;
    const paused = new Promise<void>((resolve) => {
      release = resolve;
    });
    port.arm(() => paused);

    const commitPool = await taggedAppPool('h02_cand_lock');
    let commit: Promise<any> | null = null;
    let released = false;
    try {
      commit = commitAttempt(
        {
          pool: commitPool,
          invitationPort: port,
          identityBindingSecret: process.env['IDENTITY_BINDING_SECRET']!,
        },
        {
          attemptId,
          targetPersonId: target.targetPersonId,
          targetFamilyId: target.familyId,
          actorAccountId: target.guardian.accountId,
        }
      );
      await Promise.race([
        port.reached,
        sleep(WAIT_MS).then(() => {
          throw new Error('binding transaction never reached the Gate 2 pause point');
        }),
      ]);

      // Real ordinary login for the candidate's WeChat identity, concurrently
      // binding that Account to another Person. It does not touch the frozen
      // Gate lock set (new rows), so Gate 2 already saw a stale PASS.
      await login(h.app, code);

      release();
      released = true;
      const outcome = await commit;
      expect(outcome.outcome).toBe('TERMINAL');
      expect(outcome).toMatchObject({ outcome: 'TERMINAL', reason: 'IDENTITY_CONFLICT' });
    } finally {
      if (!released) release();
      if (commit) await commit.catch(() => {});
      await commitPool.end();
    }

    await assertTerminalNoBinding(target, attemptId, 'IDENTITY_CONFLICT');
  });

  it('invitation seam: invalidation-first fails closed (CONTRACT-SEAM PROOF ONLY)', async () => {
    const target = await createTarget(h, 'h02_invite_seam', { ageBand: 'MINOR_14_17' });
    const { attemptId } = await startBinding(h, target, `h02_invite_seam_${randomUUID()}`);
    await seedSecondPartyConfirmation(target, target.guardian.personId, attemptId);
    await assertGate2InitialPass(target, target.guardian.personId, target.guardian.accountId);

    h.port.remove(target.invitationToken);

    const commitPool = createAppPool(1);
    try {
      const outcome = await commitAttempt(
        {
          pool: commitPool,
          invitationPort: h.port,
          identityBindingSecret: process.env['IDENTITY_BINDING_SECRET']!,
        },
        {
          attemptId,
          targetPersonId: target.targetPersonId,
          targetFamilyId: target.familyId,
          actorAccountId: target.guardian.accountId,
        }
      );
      expect(outcome.outcome).toBe('TERMINAL');
      expect(outcome).toMatchObject({ outcome: 'TERMINAL', reason: 'INVITATION_TERMINAL' });
    } finally {
      await commitPool.end();
    }

    await assertTerminalNoBinding(target, attemptId, 'INVITATION_TERMINAL');
  });

  it('invalidation-first: the binding transaction observably waits on the Gate fact lock', async () => {
    const target = await createTarget(h, 'h02_p1_wait', { ageBand: 'MINOR_14_17' });
    const { attemptId } = await startBinding(h, target, `h02_p1_wait_${randomUUID()}`);
    await seedSecondPartyConfirmation(target, target.guardian.personId, attemptId);
    await assertGate2InitialPass(target, target.guardian.personId, target.guardian.accountId);

    const external = await h.admin.query(
      'INSERT INTO accounts (wechat_openid, session_epoch) VALUES ($1, 0) RETURNING id',
      [`h02_p1_wait_${randomUUID()}`]
    );

    const invalidator = await h.admin.connect();
    const commitPool = await taggedAppPool('h02_p1_wait');
    let commit: Promise<any> | null = null;
    try {
      await invalidator.query('BEGIN');
      await invalidator.query('UPDATE persons SET account_id = $1 WHERE id = $2', [
        external.rows[0].id,
        target.targetPersonId,
      ]);

      commit = commitAttempt(
        {
          pool: commitPool,
          invitationPort: h.port,
          identityBindingSecret: process.env['IDENTITY_BINDING_SECRET']!,
        },
        {
          attemptId,
          targetPersonId: target.targetPersonId,
          targetFamilyId: target.familyId,
          actorAccountId: target.guardian.accountId,
        }
      );

      const waiting = await waitFor(async () => {
        const backend = await backendOf('h02_p1_wait');
        if (!backend) return null;
        return backend.wait_event_type === 'Lock' ? backend : null;
      }, 'binding transaction blocked on the Gate fact lock');
      expect(waiting.usename).toBe('xiaoshuyin_app');

      const blockers = await h.admin.query('SELECT pg_blocking_pids($1) AS pids', [waiting.pid]);
      expect(blockers.rows[0].pids).toContain(invalidator.processID);

      await invalidator.query('COMMIT');
      const outcome = await commit;
      expect(outcome.outcome).toBe('TERMINAL');
      expect(outcome).toMatchObject({ outcome: 'TERMINAL', reason: 'TARGET_ALREADY_BOUND' });
    } finally {
      try {
        await invalidator.query('ROLLBACK');
      } catch {
        // Already committed.
      }
      invalidator.release();
      if (commit) await commit.catch(() => {});
      await commitPool.end();
    }

    const attempt = await h.admin.query(
      'SELECT state, terminal_reason, committed_account_id FROM binding_attempts WHERE id = $1',
      [attemptId]
    );
    expect(attempt.rows[0]).toMatchObject({
      state: 'TERMINAL',
      terminal_reason: 'TARGET_ALREADY_BOUND',
      committed_account_id: null,
    });
    const person = await h.admin.query('SELECT account_id FROM persons WHERE id = $1', [
      target.targetPersonId,
    ]);
    // The invalidation linearized first: P1 keeps the external binding, while
    // the binding transaction itself never writes a second/partial binding.
    expect(person.rows[0].account_id).toBe(external.rows[0].id);
    expect(await terminalAuditCount(attemptId, 'TARGET_ALREADY_BOUND')).toBe(1);
    await assertNoResidualSecret(attemptId);
    const committed = await h.admin.query(
      `SELECT count(*)::int AS n FROM identity_binding_audit_events
        WHERE attempt_id = $1 AND event_type = 'BINDING_COMMITTED'`,
      [attemptId]
    );
    expect(committed.rows[0].n).toBe(0);
  });

  it('membership insert: binding-first second-family INSERT cannot cross the linearization point', async () => {
    const target = await createTarget(h, 'h02_member_insert', { ageBand: 'MINOR_14_17' });
    const otherOwner = await loginWithLabel(
      h.app,
      `h02_mi_${randomUUID().slice(0, 8)}`
    );
    const otherFamily = await createFamily(
      h.app,
      otherOwner.token,
      `h02_mi_${randomUUID().slice(0, 8)}`
    );
    expect(otherFamily.statusCode).toBe(201);
    const otherFamilyId = otherFamily.json().id as string;

    const { attemptId } = await startBinding(
      h,
      target,
      `h02_member_insert_${randomUUID()}`
    );
    await seedSecondPartyConfirmation(target, target.guardian.personId, attemptId);
    await assertGate2InitialPass(target, target.guardian.personId, target.guardian.accountId);

    await runBindingFirst({
      target,
      attemptId,
      tag: 'h02_member_insert',
      invalidate: () =>
        adminBlocked(
          'INSERT INTO family_members (family_id, person_id) VALUES ($1, $2)',
          [otherFamilyId, target.targetPersonId],
          { immediateConstraints: true }
        ),
    });

    // The invalidator rolled back, so the second membership only becomes
    // possible AFTER the binding linearization point.
    const before = await h.admin.query(
      'SELECT count(*)::int AS n FROM family_members WHERE person_id = $1',
      [target.targetPersonId]
    );
    expect(before.rows[0].n).toBe(1);
    await h.admin.query(
      'INSERT INTO family_members (family_id, person_id) VALUES ($1, $2)',
      [otherFamilyId, target.targetPersonId]
    );
    const after = await h.admin.query(
      'SELECT count(*)::int AS n FROM family_members WHERE person_id = $1',
      [target.targetPersonId]
    );
    expect(after.rows[0].n).toBe(2);

    const committed = await h.admin.query(
      `SELECT count(*)::int AS n FROM identity_binding_audit_events
        WHERE attempt_id = $1 AND event_type = 'BINDING_COMMITTED'`,
      [attemptId]
    );
    expect(committed.rows[0].n).toBe(1);
    expect(await terminalAuditCount(attemptId, 'MULTI_FAMILY_BLOCK')).toBe(0);
  });

  it('membership insert: invalidation-first second-family INSERT settles MULTI_FAMILY_BLOCK with zero commit', async () => {
    const target = await createTarget(h, 'h02_member_insert_first', { ageBand: 'MINOR_14_17' });
    const otherOwner = await loginWithLabel(
      h.app,
      `h02_mif_${randomUUID().slice(0, 8)}`
    );
    const otherFamily = await createFamily(
      h.app,
      otherOwner.token,
      `h02_mif_${randomUUID().slice(0, 8)}`
    );
    expect(otherFamily.statusCode).toBe(201);
    const otherFamilyId = otherFamily.json().id as string;
    const code = `h02_member_insert_first_${randomUUID()}`;

    const { attemptId } = await startBinding(h, target, code);
    await seedSecondPartyConfirmation(target, target.guardian.personId, attemptId);
    await assertGate2InitialPass(target, target.guardian.personId, target.guardian.accountId);

    // The second Family membership linearizes first.
    await h.admin.query(
      'INSERT INTO family_members (family_id, person_id) VALUES ($1, $2)',
      [otherFamilyId, target.targetPersonId]
    );

    const commitPool = createAppPool(1);
    try {
      const outcome = await commitAttempt(
        {
          pool: commitPool,
          invitationPort: h.port,
          identityBindingSecret: process.env['IDENTITY_BINDING_SECRET']!,
        },
        {
          attemptId,
          targetPersonId: target.targetPersonId,
          targetFamilyId: target.familyId,
          actorAccountId: target.guardian.accountId,
        }
      );
      expect(outcome.outcome).toBe('TERMINAL');
      expect(outcome).toMatchObject({ outcome: 'TERMINAL', reason: 'MULTI_FAMILY_BLOCK' });
    } finally {
      await commitPool.end();
    }

    await assertTerminalNoBinding(target, attemptId, 'MULTI_FAMILY_BLOCK');
    const accounts = await h.admin.query(
      'SELECT count(*)::int AS n FROM accounts WHERE wechat_openid = $1',
      [`fake_${code}`]
    );
    expect(accounts.rows[0].n).toBe(0);
  });

  it('guardian authority: invalidation-first guardian change yields TERMINAL / WRONG_CONFIRMER', async () => {
    const target = await createTarget(h, 'h02_guardian_inv', { ageBand: 'MINOR_14_17' });
    const alt = await createTarget(h, 'h02_guardian_inv_alt', { ageBand: 'MINOR_14_17' });
    await h.admin.query(
      'UPDATE person_compliance_profiles SET guardian_person_id = $1 WHERE person_id = $2',
      [target.guardian.personId, target.targetPersonId]
    );
    const { attemptId } = await startBinding(h, target, `h02_guardian_inv_${randomUUID()}`);
    await seedSecondPartyConfirmation(target, target.guardian.personId, attemptId);
    await assertGate2InitialPass(target, target.guardian.personId, target.guardian.accountId);

    await runInvalidationFirst({
      target,
      attemptId,
      tag: 'h02_guardian_inv',
      reason: 'WRONG_CONFIRMER',
      openInvalidator: () =>
        adminInvalidator(
          'UPDATE person_compliance_profiles SET guardian_person_id = $1 WHERE person_id = $2',
          [alt.guardian.personId, target.targetPersonId]
        ),
    });
  });

  it('family manager authority: binding-first family creator UPDATE cannot cross the linearization point', async () => {
    const target = await createTarget(h, 'h02_fm_lock', { ageBand: 'MINOR_14_17' });
    const alt = await loginWithLabel(h.app, `h02_fm_lock_alt_${randomUUID()}`);
    const { attemptId } = await startBinding(h, target, `h02_fm_lock_${randomUUID()}`);
    await seedSecondPartyConfirmation(
      target,
      target.guardian.personId,
      attemptId,
      'FAMILY_MANAGER'
    );
    await assertGate2InitialPass(target, target.guardian.personId, target.guardian.accountId);

    await runBindingFirst({
      target,
      attemptId,
      tag: 'h02_fm_lock',
      invalidate: () =>
        adminBlocked('UPDATE families SET created_by_person_id = $1 WHERE id = $2', [
          alt.personId,
          target.familyId,
        ]),
    });
  });

  it('family manager authority: invalidation-first family creator change yields TERMINAL / WRONG_CONFIRMER', async () => {
    const target = await createTarget(h, 'h02_fm_inv', { ageBand: 'MINOR_14_17' });
    const alt = await loginWithLabel(h.app, `h02_fm_inv_alt_${randomUUID()}`);
    const { attemptId } = await startBinding(h, target, `h02_fm_inv_${randomUUID()}`);
    await seedSecondPartyConfirmation(
      target,
      target.guardian.personId,
      attemptId,
      'FAMILY_MANAGER'
    );
    await assertGate2InitialPass(target, target.guardian.personId, target.guardian.accountId);

    await runInvalidationFirst({
      target,
      attemptId,
      tag: 'h02_fm_inv',
      reason: 'WRONG_CONFIRMER',
      openInvalidator: () =>
        adminInvalidator('UPDATE families SET created_by_person_id = $1 WHERE id = $2', [
          alt.personId,
          target.familyId,
        ]),
    });
  });
});