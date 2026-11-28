/**
 * Post-Merge P2 — Compliance Feature Policy Advisory-Lock Concurrency & Regressions.
 *
 * Proves the shared/exclusive advisory lock protocol for
 * `lockComplianceFeatureEvaluationBasis`:
 *   - consumer <-> consumer (shared / shared)        => concurrent
 *   - consumer <-> publisher (shared / exclusive)    => mutually exclusive (publisher waits)
 *   - publisher <-> consumer (exclusive / shared)    => mutually exclusive (consumer waits)
 *   - publisher <-> publisher (exclusive / exclusive)=> serialized
 *   - different featureCode or featureContractRevision => no blocking
 *
 * Also preserves end-to-end regressions for:
 *   - Assessment (concurrent unrelated families + publisher wait + idempotency replay)
 *   - Roleplay (session creation + idempotency replay after policy drift)
 *   - Family Alliance (A3000 + idempotency replay after policy drift + UNKNOWN block)
 *
 * Synchronization uses explicit deferred barriers + pg_locks / pg_stat_activity /
 * pg_blocking_pids observations rather than arbitrary sleeps.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import pg from 'pg';
import crypto from 'node:crypto';
import { buildApp } from '../../apps/server/api/src/app.js';
import { createAdminPool } from '../setup/db.js';
import {
  auth,
  commandHeaders,
  createFamily,
  createMember,
  loginWithLabel,
  type LoginResult,
} from '../setup/api.js';
import { createCase } from '../setup/participation.js';
import {
  createServerFeatureDescriptor,
  lockComplianceFeatureEvaluationBasis,
  type ComplianceFeatureDescriptor,
} from '@xiaoshuyin/compliance';
import {
  DIGITAL_USE_PACKAGE_VERSION,
  PHONE_USE_CONTRACT_CONTENT_VERSION,
} from '@xiaoshuyin/scenes/digital-use';

const PREFIX = `P2CONC_${Date.now()}_`;

function featureCode(suffix: string): string {
  return `${PREFIX}${suffix}`.toUpperCase().replace(/[^A-Z0-9_]/g, '_').slice(0, 120);
}

function descriptor(code: string, revision = 'v1'): ComplianceFeatureDescriptor {
  return createServerFeatureDescriptor({
    featureCode: code,
    featureContractRevision: revision,
    capabilityLabel: 'P2 concurrency test feature',
  });
}

function deferred<T = void>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (err: unknown) => void;
} {
  let resolve!: (value: T) => void;
  let reject!: (err: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function waitForAdvisoryBlock(
  admin: pg.Pool,
  blockerPid: number,
  blockedPid: number,
  timeoutMs = 10_000
): Promise<{ wait_event_type: string; wait_event: string }> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await admin.query<{
      blocked: boolean;
      wait_event_type: string | null;
      wait_event: string | null;
    }>(
      `SELECT $1::int = ANY(pg_blocking_pids($2::int)) AS blocked,
              wait_event_type,
              wait_event
         FROM pg_stat_activity
        WHERE pid = $2::int`,
      [blockerPid, blockedPid]
    );
    const row = res.rows[0];
    if (row?.blocked && row.wait_event_type === 'Lock' && row.wait_event === 'advisory') {
      return { wait_event_type: row.wait_event_type, wait_event: row.wait_event };
    }
    await new Promise((r) => setTimeout(r, 15));
  }
  const diag = await admin.query(
    `SELECT pid, state, wait_event_type, wait_event, pg_blocking_pids(pid) AS blockers, left(query, 120) AS query
       FROM pg_stat_activity WHERE pid IN ($1, $2)`,
    [blockerPid, blockedPid]
  );
  throw new Error(
    `Timed out waiting for pid ${blockedPid} to block on advisory lock held by ${blockerPid}: ${JSON.stringify(diag.rows)}`
  );
}

async function waitForAdvisoryLockHeld(
  admin: pg.Pool,
  pid: number,
  expectedMode: 'ShareLock' | 'ExclusiveLock',
  timeoutMs = 10_000
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await admin.query<{ n: number }>(
      `SELECT count(*)::int AS n
         FROM pg_locks
        WHERE pid = $1::int
          AND locktype = 'advisory'
          AND mode = $2
          AND granted = true`,
      [pid, expectedMode]
    );
    if ((res.rows[0]?.n ?? 0) >= 1) return;
    await new Promise((r) => setTimeout(r, 15));
  }
  throw new Error(`Timed out waiting for pid ${pid} to hold ${expectedMode} advisory lock`);
}

describe('Post-Merge P2: Compliance feature-policy advisory-lock concurrency', () => {
  let app: FastifyInstance;
  let admin: pg.Pool;
  let migrator: pg.Client;

  async function publishPolicy(
    client: pg.Client,
    input: {
      code: string;
      revision?: string;
      expectedVersion: number | null;
      version: number;
      applicability?: 'REQUIRED' | 'NOT_APPLICABLE' | 'UNKNOWN';
      minorRule?: 'BASELINE' | 'MINORS_BLOCKED';
    }
  ): Promise<string> {
    const applicability = input.applicability ?? 'NOT_APPLICABLE';
    const aiRule = applicability === 'REQUIRED' ? 'REQUIRED' : 'BASELINE';
    const usageRule = applicability === 'REQUIRED' ? 'REQUIRED' : 'BASELINE';
    const res = await client.query<{ id: string }>(
      `SELECT app.publish_compliance_feature_policy(
         $1,$2,$3,$4,$5,$6,$7,'BASELINE',$8,$9,$10,now() - interval '1 minute',$11
       ) AS id`,
      [
        input.code,
        input.revision ?? 'v1',
        input.expectedVersion,
        input.version,
        applicability,
        input.minorRule ?? 'BASELINE',
        aiRule,
        usageRule,
        applicability === 'UNKNOWN' ? null : 'P2 concurrency reviewed basis',
        applicability === 'UNKNOWN' ? null : 'evidence://p2/concurrency',
        `migration:${PREFIX}`,
      ]
    );
    return res.rows[0]!.id;
  }

  async function ensureRealFeaturePolicy(
    code: string,
    minorRule: 'BASELINE' | 'MINORS_BLOCKED' = 'BASELINE'
  ): Promise<void> {
    const existing = await migrator.query<{ id: string }>(
      `SELECT id FROM compliance_feature_policies
        WHERE feature_code = $1 AND feature_contract_revision = 'v1' AND effective_until IS NULL`,
      [code]
    );
    if (existing.rows.length === 0) {
      const maxRes = await migrator.query<{ max_ver: number | null }>(
        `SELECT MAX(policy_version) AS max_ver FROM compliance_feature_policies
          WHERE feature_code = $1 AND feature_contract_revision = 'v1'`,
        [code]
      );
      const nextVer = (maxRes.rows[0]?.max_ver ?? 0) + 1;
      await publishPolicy(migrator, {
        code,
        expectedVersion: null,
        version: nextVer,
        minorRule,
      });
    }
  }

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
    admin = createAdminPool();
    migrator = new pg.Client({ connectionString: process.env['MIGRATION_DATABASE_URL']! });
    await migrator.connect();

    await ensureRealFeaturePolicy('DIGITAL_USE_ASSESSMENT_RUNTIME', 'BASELINE');
    await ensureRealFeaturePolicy('DIGITAL_USE_FAMILY_ALLIANCE_RUNTIME', 'BASELINE');
    await ensureRealFeaturePolicy('DIGITAL_USE_ROLEPLAY_A4003', 'MINORS_BLOCKED');
  }, 60_000);

  afterAll(async () => {
    await admin
      .query(`DELETE FROM compliance_feature_policies WHERE feature_code LIKE '${PREFIX}%'`)
      .catch(() => undefined);
    await admin
      .query(
        `UPDATE compliance_feature_policies
            SET superseded_by_policy_id = NULL
          WHERE feature_code IN (
            'DIGITAL_USE_ASSESSMENT_RUNTIME',
            'DIGITAL_USE_FAMILY_ALLIANCE_RUNTIME',
            'DIGITAL_USE_ROLEPLAY_A4003'
          ) AND feature_contract_revision = 'v1'`
      )
      .catch(() => undefined);
    await admin
      .query(
        `DELETE FROM compliance_feature_policies
          WHERE feature_code IN (
            'DIGITAL_USE_ASSESSMENT_RUNTIME',
            'DIGITAL_USE_FAMILY_ALLIANCE_RUNTIME',
            'DIGITAL_USE_ROLEPLAY_A4003'
          ) AND feature_contract_revision = 'v1'`
      )
      .catch(() => undefined);
    await migrator?.end().catch(() => undefined);
    await admin?.end().catch(() => undefined);
    await app?.close();
  }, 60_000);

  it('consumer A + consumer B on same feature hold ShareLock concurrently without blocking', async () => {
    const code = featureCode('CONSUMER_CONCURRENT');
    await publishPolicy(migrator, { code, expectedVersion: null, version: 1 });

    const clientA = new pg.Client({ connectionString: process.env['DATABASE_URL']! });
    const clientB = new pg.Client({ connectionString: process.env['DATABASE_URL']! });
    await Promise.all([clientA.connect(), clientB.connect()]);

    try {
      const pidA = (await clientA.query<{ pid: number }>('SELECT pg_backend_pid() AS pid')).rows[0]!.pid;
      const pidB = (await clientB.query<{ pid: number }>('SELECT pg_backend_pid() AS pid')).rows[0]!.pid;

      await clientA.query('BEGIN');
      await lockComplianceFeatureEvaluationBasis(clientA, descriptor(code));
      await waitForAdvisoryLockHeld(admin, pidA, 'ShareLock');

      // While Consumer A is still holding the shared lock inside an open tx,
      // Consumer B acquires the same shared lock and completes its transaction.
      await clientB.query('BEGIN');
      await lockComplianceFeatureEvaluationBasis(clientB, descriptor(code));
      await waitForAdvisoryLockHeld(admin, pidB, 'ShareLock');

      const bothLocks = await admin.query<{ pid: number; mode: string; granted: boolean }>(
        `SELECT pid, mode, granted
           FROM pg_locks
          WHERE pid IN ($1, $2) AND locktype = 'advisory'
          ORDER BY pid`,
        [pidA, pidB]
      );
      expect(bothLocks.rows).toHaveLength(2);
      expect(bothLocks.rows.every((row) => row.mode === 'ShareLock' && row.granted)).toBe(true);

      const seenB = await clientB.query<{ policy_version: number }>(
        `SELECT policy_version FROM compliance_feature_policies
          WHERE feature_code = $1 AND feature_contract_revision = 'v1'`,
        [code]
      );
      expect(seenB.rows).toEqual([{ policy_version: 1 }]);
      await clientB.query('COMMIT');
      await clientA.query('COMMIT');
    } finally {
      await clientB.query('ROLLBACK').catch(() => undefined);
      await clientA.query('ROLLBACK').catch(() => undefined);
      await Promise.all([clientA.end(), clientB.end()]);
    }
  });

  it('consumer holding shared lock blocks publisher exclusive lock until consumer commits', async () => {
    const code = featureCode('CONSUMER_BLOCKS_PUB');
    await publishPolicy(migrator, { code, expectedVersion: null, version: 1 });

    const consumer = new pg.Client({ connectionString: process.env['DATABASE_URL']! });
    const publisher = new pg.Client({ connectionString: process.env['MIGRATION_DATABASE_URL']! });
    await Promise.all([consumer.connect(), publisher.connect()]);

    try {
      const consumerPid = (await consumer.query<{ pid: number }>('SELECT pg_backend_pid() AS pid')).rows[0]!.pid;
      const publisherPid = (await publisher.query<{ pid: number }>('SELECT pg_backend_pid() AS pid')).rows[0]!.pid;

      await consumer.query('BEGIN');
      await lockComplianceFeatureEvaluationBasis(consumer, descriptor(code));
      await waitForAdvisoryLockHeld(admin, consumerPid, 'ShareLock');

      let publisherSettled = false;
      await publisher.query('BEGIN');
      const publishPromise = publishPolicy(publisher, {
        code,
        expectedVersion: 1,
        version: 2,
      }).then((id) => {
        publisherSettled = true;
        return id;
      });

      const observed = await waitForAdvisoryBlock(admin, consumerPid, publisherPid);
      expect(observed).toEqual({ wait_event_type: 'Lock', wait_event: 'advisory' });
      expect(publisherSettled).toBe(false);

      await consumer.query('COMMIT');
      const v2Id = await publishPromise;
      expect(v2Id).toBeTruthy();
      expect(publisherSettled).toBe(true);
      await publisher.query('COMMIT');
    } finally {
      await publisher.query('ROLLBACK').catch(() => undefined);
      await consumer.query('ROLLBACK').catch(() => undefined);
      await Promise.all([consumer.end(), publisher.end()]);
    }
  });

  it('publisher holding exclusive lock blocks consumer shared lock until publisher commits (M-03 preserved)', async () => {
    const code = featureCode('PUB_BLOCKS_CONSUMER');
    await publishPolicy(migrator, { code, expectedVersion: null, version: 1 });

    const publisher = new pg.Client({ connectionString: process.env['MIGRATION_DATABASE_URL']! });
    const consumer = new pg.Client({ connectionString: process.env['DATABASE_URL']! });
    await Promise.all([publisher.connect(), consumer.connect()]);

    try {
      const publisherPid = (await publisher.query<{ pid: number }>('SELECT pg_backend_pid() AS pid')).rows[0]!.pid;
      const consumerPid = (await consumer.query<{ pid: number }>('SELECT pg_backend_pid() AS pid')).rows[0]!.pid;

      await publisher.query('BEGIN');
      await publishPolicy(publisher, {
        code,
        expectedVersion: 1,
        version: 2,
        applicability: 'REQUIRED',
      });
      await waitForAdvisoryLockHeld(admin, publisherPid, 'ExclusiveLock');

      let consumerSettled = false;
      await consumer.query('BEGIN');
      const consumerPromise = (async () => {
        await lockComplianceFeatureEvaluationBasis(consumer, descriptor(code));
        const rows = await consumer.query<{ policy_version: number }>(
          `SELECT policy_version FROM compliance_feature_policies
            WHERE feature_code = $1 AND feature_contract_revision = 'v1'`,
          [code]
        );
        consumerSettled = true;
        return rows.rows;
      })();

      const observed = await waitForAdvisoryBlock(admin, publisherPid, consumerPid);
      expect(observed).toEqual({ wait_event_type: 'Lock', wait_event: 'advisory' });
      expect(consumerSettled).toBe(false);

      await publisher.query('COMMIT');
      const seen = await consumerPromise;
      expect(consumerSettled).toBe(true);
      expect(seen).toEqual([{ policy_version: 2 }]);
      await consumer.query('COMMIT');
    } finally {
      await consumer.query('ROLLBACK').catch(() => undefined);
      await publisher.query('ROLLBACK').catch(() => undefined);
      await Promise.all([publisher.end(), consumer.end()]);
    }
  });

  it('publisher / publisher on same feature remains serialized, while different feature or revision never blocks', async () => {
    const codeA = featureCode('FEAT_A');
    const codeB = featureCode('FEAT_B');
    await publishPolicy(migrator, { code: codeA, revision: 'v1', expectedVersion: null, version: 1 });
    await publishPolicy(migrator, { code: codeA, revision: 'v2', expectedVersion: null, version: 1 });
    await publishPolicy(migrator, { code: codeB, revision: 'v1', expectedVersion: null, version: 1 });

    const pub1 = new pg.Client({ connectionString: process.env['MIGRATION_DATABASE_URL']! });
    const pub2 = new pg.Client({ connectionString: process.env['MIGRATION_DATABASE_URL']! });
    const diffFeatureConsumer = new pg.Client({ connectionString: process.env['DATABASE_URL']! });
    const diffRevConsumer = new pg.Client({ connectionString: process.env['DATABASE_URL']! });
    await Promise.all([
      pub1.connect(),
      pub2.connect(),
      diffFeatureConsumer.connect(),
      diffRevConsumer.connect(),
    ]);

    try {
      const pub1Pid = (await pub1.query<{ pid: number }>('SELECT pg_backend_pid() AS pid')).rows[0]!.pid;
      const pub2Pid = (await pub2.query<{ pid: number }>('SELECT pg_backend_pid() AS pid')).rows[0]!.pid;

      await pub1.query('BEGIN');
      await publishPolicy(pub1, { code: codeA, revision: 'v1', expectedVersion: 1, version: 2 });
      await waitForAdvisoryLockHeld(admin, pub1Pid, 'ExclusiveLock');

      // Different featureCode proceeds immediately without blocking.
      await diffFeatureConsumer.query('BEGIN');
      await lockComplianceFeatureEvaluationBasis(diffFeatureConsumer, descriptor(codeB, 'v1'));
      await diffFeatureConsumer.query('COMMIT');

      // Same featureCode, different featureContractRevision proceeds immediately without blocking.
      await diffRevConsumer.query('BEGIN');
      await lockComplianceFeatureEvaluationBasis(diffRevConsumer, descriptor(codeA, 'v2'));
      await diffRevConsumer.query('COMMIT');

      // Second publisher on same (featureCode, revision) must wait for pub1.
      let pub2Settled = false;
      await pub2.query('BEGIN');
      const pub2Promise = publishPolicy(pub2, {
        code: codeA,
        revision: 'v1',
        expectedVersion: 2,
        version: 3,
      }).catch((err) => {
        pub2Settled = true;
        return err;
      });

      const observed = await waitForAdvisoryBlock(admin, pub1Pid, pub2Pid);
      expect(observed).toEqual({ wait_event_type: 'Lock', wait_event: 'advisory' });
      expect(pub2Settled).toBe(false);

      await pub1.query('COMMIT');
      const pub2Result = await pub2Promise;
      // pub2 expectedVersion=2 matches pub1's newly committed v2, or if pub2 had expected 1 it would fail;
      // either way it resumed only after pub1 committed.
      expect(typeof pub2Result).toBe('string');
      await pub2.query('COMMIT');
    } finally {
      await diffFeatureConsumer.query('ROLLBACK').catch(() => undefined);
      await diffRevConsumer.query('ROLLBACK').catch(() => undefined);
      await pub2.query('ROLLBACK').catch(() => undefined);
      await pub1.query('ROLLBACK').catch(() => undefined);
      await Promise.all([
        pub1.end(),
        pub2.end(),
        diffFeatureConsumer.end(),
        diffRevConsumer.end(),
      ]);
    }
  });

  it('Assessment end-to-end: unrelated families proceed concurrently while holding shared policy lock, and idempotency replay is preserved', async () => {
    const setupFamilyCase = async (label: string) => {
      const manager = await loginWithLabel(app, `p2-assess-${label}`);
      const fam = await createFamily(app, manager.token, `p2-assess-${label}`);
      expect(fam.statusCode).toBe(201);
      const familyId = fam.json().id as string;
      const member = await createMember(app, manager.token, familyId, `p2-child-${label}`, {
        ageBand: 'MINOR_14_17',
        ageBandSource: 'GUARDIAN_RELAY',
      });
      expect(member.statusCode).toBe(201);
      const targetPersonId = member.json().personId as string;
      const kase = await createCase(app, manager.token, `p2-case-${label}`);
      expect(kase.statusCode).toBe(201);
      const caseId = kase.json().id as string;
      const msg = await app.inject({
        method: 'POST',
        url: `/api/v1/cases/${caseId}/messages`,
        headers: commandHeaders(manager.token, `p2-msg-${label}-${crypto.randomUUID()}`),
        payload: { content: 'Assessment statement for concurrency regression' },
      });
      expect(msg.statusCode).toBe(201);
      return { manager, familyId, targetPersonId, caseId, caseVersion: kase.json().version as number };
    };

    const f1 = await setupFamilyCase('f1');
    const f2 = await setupFamilyCase('f2');

    // Deterministic barrier right AFTER assertAssessmentCompliance (which already
    // acquired ShareLock on DIGITAL_USE_ASSESSMENT_RUNTIME) when inserting
    // digital_use_assessment_context for f1.caseId.
    const barrierKey = Math.floor(Math.random() * 1_000_000) + 500_000;
    const fnName = `p2_assessment_barrier_${Date.now()}_${Math.floor(Math.random() * 1e5)}`;
    const trigName = `p2_assessment_barrier_trg`;

    const holder = new pg.Client({ connectionString: process.env['TEST_ADMIN_DATABASE_URL']! });
    const publisher = new pg.Client({ connectionString: process.env['MIGRATION_DATABASE_URL']! });
    await Promise.all([holder.connect(), publisher.connect()]);

    try {
      await admin.query(`
        CREATE OR REPLACE FUNCTION ${fnName}() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
          IF NEW.case_id = '${f1.caseId}'::uuid THEN
            PERFORM pg_advisory_xact_lock(${barrierKey});
          END IF;
          RETURN NEW;
        END $$`);
      await admin.query(
        `CREATE TRIGGER ${trigName}
           BEFORE INSERT ON digital_use_assessment_context
           FOR EACH ROW EXECUTE FUNCTION ${fnName}()`
      );

      await holder.query('BEGIN');
      await holder.query(`SELECT pg_advisory_xact_lock(${barrierKey})`);
      const holderPid = (await holder.query<{ pid: number }>('SELECT pg_backend_pid() AS pid')).rows[0]!.pid;

      const f1Key = `p2-assess-f1-${crypto.randomUUID()}`;
      let f1Settled = false;
      const f1Promise = app
        .inject({
          method: 'POST',
          url: `/api/v1/cases/${f1.caseId}/assessments`,
          headers: { ...auth(f1.manager.token), 'idempotency-key': f1Key },
          payload: { expectedCaseVersion: f1.caseVersion, targetPersonId: f1.targetPersonId },
        })
        .then((res) => {
          f1Settled = true;
          return res;
        });

      // Wait deterministically until f1 backend is paused on the trigger barrier
      // (meaning it ALREADY acquired ShareLock on DIGITAL_USE_ASSESSMENT_RUNTIME).
      const deadline = Date.now() + 10_000;
      let f1Pid: number | null = null;
      while (Date.now() < deadline) {
        const res = await admin.query<{ pid: number }>(
          `SELECT pid FROM pg_stat_activity
            WHERE $1::int = ANY(pg_blocking_pids(pid))
              AND wait_event_type = 'Lock'
              AND wait_event = 'advisory'`,
          [holderPid]
        );
        if (res.rows[0]) {
          f1Pid = res.rows[0].pid;
          break;
        }
        await new Promise((r) => setTimeout(r, 15));
      }
      expect(f1Pid).not.toBeNull();
      await waitForAdvisoryLockHeld(admin, f1Pid!, 'ShareLock');

      // 1. Unrelated Family f2 starts Assessment for the SAME feature concurrently -> succeeds immediately!
      const f2Key = `p2-assess-f2-${crypto.randomUUID()}`;
      const f2Res = await app.inject({
        method: 'POST',
        url: `/api/v1/cases/${f2.caseId}/assessments`,
        headers: { ...auth(f2.manager.token), 'idempotency-key': f2Key },
        payload: { expectedCaseVersion: f2.caseVersion, targetPersonId: f2.targetPersonId },
      });
      expect(f2Res.statusCode, f2Res.body).toBe(200);
      expect(f2Res.json().currentNode?.nodeCode).toBe('A1001');
      expect(f1Settled).toBe(false);

      // 2. Publisher trying to supersede DIGITAL_USE_ASSESSMENT_RUNTIME waits for f1's shared lock.
      const currentVer = (
        await migrator.query<{ policy_version: number }>(
          `SELECT policy_version FROM compliance_feature_policies
            WHERE feature_code = 'DIGITAL_USE_ASSESSMENT_RUNTIME'
              AND feature_contract_revision = 'v1'
              AND effective_until IS NULL`
        )
      ).rows[0]!.policy_version;
      const pubPid = (await publisher.query<{ pid: number }>('SELECT pg_backend_pid() AS pid')).rows[0]!.pid;
      let pubSettled = false;
      await publisher.query('BEGIN');
      const pubPromise = publishPolicy(publisher, {
        code: 'DIGITAL_USE_ASSESSMENT_RUNTIME',
        expectedVersion: currentVer,
        version: currentVer + 1,
        applicability: 'UNKNOWN',
      }).then((id) => {
        pubSettled = true;
        return id;
      });
      await waitForAdvisoryBlock(admin, f1Pid!, pubPid);
      expect(pubSettled).toBe(false);

      // Release f1 barrier -> f1 finishes 200, then publisher completes UNKNOWN publication.
      await holder.query('COMMIT');
      const f1Res = await f1Promise;
      expect(f1Res.statusCode, f1Res.body).toBe(200);
      await pubPromise;
      expect(pubSettled).toBe(true);
      await publisher.query('COMMIT');

      // 3. Idempotency replay on f2 succeeds with exact original 200 even after policy became UNKNOWN.
      const f2Replay = await app.inject({
        method: 'POST',
        url: `/api/v1/cases/${f2.caseId}/assessments`,
        headers: { ...auth(f2.manager.token), 'idempotency-key': f2Key },
        payload: { expectedCaseVersion: f2.caseVersion, targetPersonId: f2.targetPersonId },
      });
      expect(f2Replay.statusCode, f2Replay.body).toBe(200);
      expect(f2Replay.json()).toEqual(f2Res.json());

      // Restore policy to NOT_APPLICABLE for clean state.
      await publishPolicy(migrator, {
        code: 'DIGITAL_USE_ASSESSMENT_RUNTIME',
        expectedVersion: currentVer + 1,
        version: currentVer + 2,
      });
    } finally {
      await publisher.query('ROLLBACK').catch(() => undefined);
      await holder.query('ROLLBACK').catch(() => undefined);
      await admin
        .query(`DROP TRIGGER IF EXISTS ${trigName} ON digital_use_assessment_context`)
        .catch(() => undefined);
      await admin.query(`DROP FUNCTION IF EXISTS ${fnName}()`).catch(() => undefined);
      await Promise.all([holder.end(), publisher.end()]);
    }
  }, 60_000);

  it('Roleplay & Family Alliance regressions preserve compliance gating and idempotency replay', async () => {
    const setupConfirmedCase = async (label: string, child?: LoginResult) => {
      const manager = await loginWithLabel(app, `p2-reg-${label}`);
      const fam = await createFamily(app, manager.token, `p2-reg-${label}`);
      expect(fam.statusCode).toBe(201);
      const familyId = fam.json().id as string;
      let targetPersonId: string;
      if (child) {
        targetPersonId = child.personId;
        await admin.query('INSERT INTO family_members (family_id,person_id) VALUES ($1,$2)', [
          familyId,
          targetPersonId,
        ]);
        await admin.query(
          `INSERT INTO person_compliance_profiles (person_id,age_band,minor_mode,verified_source)
             VALUES ($1,'MINOR_14_17',true,'OTHER_MEMBER_RELAY')
             ON CONFLICT (person_id) DO UPDATE SET age_band='MINOR_14_17',minor_mode=true,
               verified_source='OTHER_MEMBER_RELAY'`,
          [targetPersonId]
        );
      } else {
        const target = await createMember(app, manager.token, familyId, `p2-reg-c-${label}`, {
          ageBand: 'MINOR_14_17',
          ageBandSource: 'GUARDIAN_RELAY',
        });
        expect(target.statusCode).toBe(201);
        targetPersonId = target.json().personId as string;
      }
      const kase = await createCase(app, manager.token, `p2-reg-k-${label}`);
      expect(kase.statusCode).toBe(201);
      const caseId = kase.json().id as string;

      await admin.query(
        `INSERT INTO digital_use_assessment_context (family_id, case_id, target_person_id, created_by_person_id)
         VALUES ($1, $2, $3, $4)`,
        [familyId, caseId, targetPersonId, manager.personId]
      );
      const msg = await admin.query<{ id: string }>(
        `INSERT INTO dialogue_messages (family_id, case_id, actor_account_id, source_person_id, content)
         VALUES ($1, $2, $3, $4, 'Regression statement') RETURNING id`,
        [familyId, caseId, manager.accountId, manager.personId]
      );
      await admin.query(
        `INSERT INTO problem_formulations
           (family_id, case_id, version, status, review_state, primary_problem, key_factors,
            evidence_refs, unknowns, conflicts, scene_fit, alternative_explanations,
            reassessment_conditions, exit_conditions, user_response,
            confirmed_by_person_id, confirmed_at, dependency_refs, supersedes_version)
         VALUES
           ($1, $2, 1, 'CONFIRMED', 'CURRENT', $3::jsonb, '[]'::jsonb,
            $4::jsonb, '[]'::jsonb, '[]'::jsonb, 'DIGITAL_USE', '[]'::jsonb,
            '[]'::jsonb, '[]'::jsonb, $5::jsonb, $6, now(), '[]'::jsonb, NULL)`,
        [
          familyId,
          caseId,
          JSON.stringify({ text: 'Confirmed formulation' }),
          JSON.stringify([{ type: 'DIALOGUE_MESSAGE', id: msg.rows[0]!.id }]),
          JSON.stringify({ kind: 'CONFIRM' }),
          manager.personId,
        ]
      );
      await admin.query(
        `INSERT INTO scene_node_states
           (family_id, case_id, scene_package_version, node_code, source_node_code,
            status, revision, branch_reason_codes, input_refs, output_refs, completed_at)
         VALUES ($1, $2, $3, 'A1001', 'ROOT', 'COMPLETED', 1, ARRAY[]::text[], '[]'::jsonb, '[]'::jsonb, now())`,
        [familyId, caseId, DIGITAL_USE_PACKAGE_VERSION]
      );
      await admin.query(`UPDATE cases SET phase = 'GOALS' WHERE id = $1`, [caseId]);
      return { manager, familyId, targetPersonId, caseId, caseVersion: 1 };
    };

    // 1. Roleplay regression + idempotency replay
    const roleplayApp = await buildApp({
      phoneUseContract: {
        roleplayAdapter: {
          adapterRef: 'test:p2-roleplay-v1',
          async isAvailable() {
            return true;
          },
          async createTurn() {
            return {
              simulatedParentOutput: 'simulated parent',
              adapterRef: 'test:p2-roleplay-v1',
              modelRef: 'test-model',
              promptVersionRef: 'test-prompt-v1',
            };
          },
        },
        roleplayProfessionalContent: {
          status: 'APPROVED_PUBLISHED',
          version: PHONE_USE_CONTRACT_CONTENT_VERSION,
          authorityRef: 'test-authority:roleplay-v1',
        },
        roleplayModelPromptAuthority: async () => ({
          model: {
            status: 'CURRENT_APPROVED',
            modelRef: 'test-model',
            authorityRef: 'test-authority:model-v1',
          },
          prompt: {
            status: 'CURRENT_APPROVED',
            promptVersionRef: 'test-prompt-v1',
            authorityRef: 'test-authority:prompt-v1',
          },
        }),
      },
    });
    await roleplayApp.ready();
    try {
      const rpFix = await setupConfirmedCase(`rp-${crypto.randomUUID().slice(0, 8)}`);
      await admin.query(
        `INSERT INTO scene_node_states
           (family_id, case_id, scene_package_version, node_code, source_node_code,
            status, revision, branch_reason_codes, input_refs, output_refs)
         VALUES ($1, $2, $3, 'A4003', 'A4002', 'AVAILABLE', 1, ARRAY[]::text[], '[]'::jsonb, '[]'::jsonb)`,
        [rpFix.familyId, rpFix.caseId, DIGITAL_USE_PACKAGE_VERSION]
      );
      const rpKey = `p2-rp-${crypto.randomUUID()}`;
      const rpPayload = {
        expectedCaseVersion: rpFix.caseVersion,
        professionalContentVersion: PHONE_USE_CONTRACT_CONTENT_VERSION,
      };
      const rp1 = await roleplayApp.inject({
        method: 'POST',
        url: `/api/v1/cases/${rpFix.caseId}/digital-use/roleplays`,
        headers: { ...auth(rpFix.manager.token), 'idempotency-key': rpKey },
        payload: rpPayload,
      });
      expect(rp1.statusCode, rp1.body).toBe(201);

      const rpVer = (
        await migrator.query<{ policy_version: number }>(
          `SELECT policy_version FROM compliance_feature_policies
            WHERE feature_code = 'DIGITAL_USE_ROLEPLAY_A4003'
              AND feature_contract_revision = 'v1'
              AND effective_until IS NULL`
        )
      ).rows[0]!.policy_version;
      await publishPolicy(migrator, {
        code: 'DIGITAL_USE_ROLEPLAY_A4003',
        expectedVersion: rpVer,
        version: rpVer + 1,
        applicability: 'UNKNOWN',
      });

      const rpReplay = await roleplayApp.inject({
        method: 'POST',
        url: `/api/v1/cases/${rpFix.caseId}/digital-use/roleplays`,
        headers: { ...auth(rpFix.manager.token), 'idempotency-key': rpKey },
        payload: rpPayload,
      });
      expect(rpReplay.statusCode, rpReplay.body).toBe(201);
      expect(rpReplay.json()).toEqual(rp1.json());

      const rpBlocked = await roleplayApp.inject({
        method: 'POST',
        url: `/api/v1/cases/${rpFix.caseId}/digital-use/roleplays`,
        headers: { ...auth(rpFix.manager.token), 'idempotency-key': `${rpKey}-new` },
        payload: rpPayload,
      });
      expect(rpBlocked.statusCode, rpBlocked.body).toBe(409);
      expect(rpBlocked.json().code).toBe('COMPLIANCE_BLOCKED');

      await publishPolicy(migrator, {
        code: 'DIGITAL_USE_ROLEPLAY_A4003',
        expectedVersion: rpVer + 1,
        version: rpVer + 2,
        minorRule: 'MINORS_BLOCKED',
      });
    } finally {
      await roleplayApp.close();
    }

    // 2. Family Alliance regression + idempotency replay
    const faFix = await setupConfirmedCase(`fa-${crypto.randomUUID().slice(0, 8)}`);
    await admin.query(
      `INSERT INTO scene_node_states
         (family_id, case_id, scene_package_version, node_code, source_node_code,
          status, revision, branch_reason_codes, input_refs, output_refs, completed_at)
       VALUES ($1, $2, $3, 'A2010', 'A2002', 'COMPLETED', 1, ARRAY[]::text[], '[]'::jsonb, '[]'::jsonb, now())`,
      [faFix.familyId, faFix.caseId, DIGITAL_USE_PACKAGE_VERSION]
    );
    const faKey = `p2-fa-${crypto.randomUUID()}`;
    const faPayload = {
      targetPersonId: faFix.targetPersonId,
      expectedCaseVersion: faFix.caseVersion,
      expectedNodeRevision: 0,
      expectedScenePackageVersion: 'v1',
      response: {
        kind: 'SELF_ASSESSMENT',
        answers: {
          emotionAttention: 'YES',
          negotiatedAgreement: 'YES',
          trustsAgreement: 'YES',
          familyCoordination: 'YES',
          parentEmotionFluctuation: 'YES',
          keepsPromises: 'YES',
        },
      },
    };
    const fa1 = await app.inject({
      method: 'POST',
      url: `/api/v1/cases/${faFix.caseId}/scene/nodes/A3000/responses`,
      headers: { ...auth(faFix.manager.token), 'idempotency-key': faKey },
      payload: faPayload,
    });
    expect(fa1.statusCode, fa1.body).toBe(200);

    const faVer = (
      await migrator.query<{ policy_version: number }>(
        `SELECT policy_version FROM compliance_feature_policies
          WHERE feature_code = 'DIGITAL_USE_FAMILY_ALLIANCE_RUNTIME'
            AND feature_contract_revision = 'v1'
            AND effective_until IS NULL`
      )
    ).rows[0]!.policy_version;
    await publishPolicy(migrator, {
      code: 'DIGITAL_USE_FAMILY_ALLIANCE_RUNTIME',
      expectedVersion: faVer,
      version: faVer + 1,
      applicability: 'UNKNOWN',
    });

    const faReplay = await app.inject({
      method: 'POST',
      url: `/api/v1/cases/${faFix.caseId}/scene/nodes/A3000/responses`,
      headers: { ...auth(faFix.manager.token), 'idempotency-key': faKey },
      payload: faPayload,
    });
    expect(faReplay.statusCode, faReplay.body).toBe(200);
    expect(faReplay.json()).toEqual(fa1.json());

    const faBlocked = await app.inject({
      method: 'POST',
      url: `/api/v1/cases/${faFix.caseId}/scene/nodes/A3000/responses`,
      headers: { ...auth(faFix.manager.token), 'idempotency-key': `${faKey}-new` },
      payload: faPayload,
    });
    expect(faBlocked.statusCode, faBlocked.body).toBe(409);
    expect(faBlocked.json().code).toBe('COMPLIANCE_BLOCKED');

    await publishPolicy(migrator, {
      code: 'DIGITAL_USE_FAMILY_ALLIANCE_RUNTIME',
      expectedVersion: faVer + 1,
      version: faVer + 2,
    });
  }, 60_000);
});
