import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { describe, expect, it } from 'vitest';
import { createInterventionDefinitionCandidate } from '../../apps/server/api/src/services/intervention-definitions.js';
import type { InterventionProfessionalQualificationProvider } from '../../apps/server/api/src/services/intervention-professional-authority.js';
import { interventionSemantic, TEST_ONLY_QUALIFICATION_PROVIDER } from '../support/intervention.js';

// Only a dedicated, migrated, disposable local test DB is permitted.
const suite = process.env['E2_ACCOUNT_LOCK_CONCURRENCY_TEST'] === '1' ? describe : describe.skip;
function testUrl(name: string, role: string) {
  const url = new URL(process.env[name] ?? '');
  if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
      url.pathname !== '/xiaoshuyin_test' || url.username !== role) {
    throw new Error('Refusing non-test DB or wrong role: ' + name);
  }
  return url;
}
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}
async function bounded<T>(promise: Promise<T>, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([promise, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('INTERVENTION_TEST_TIMEOUT:' + label)), 7000);
    })]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

suite('Finding #17: actual Intervention transaction / Account deactivation', () => {
  it('blocks real deactivation through commit and denies fresh mutation after disable', async () => {
    const a = testUrl('TEST_ADMIN_DATABASE_URL', 'postgres');
    const b = testUrl('DATABASE_URL', 'xiaoshuyin_app');
    expect([b.hostname, b.port || '5432', b.pathname]).toEqual([a.hostname, a.port || '5432', a.pathname]);
    const admin = new pg.Pool({ connectionString: a.toString(), max: 4 });
    const appPool = new pg.Pool({ connectionString: b.toString(), max: 1 });
    const suffix = randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase();
    let accountId: string | undefined;
    let personId: string | undefined;
    let mutation: ReturnType<typeof createInterventionDefinitionCandidate> | undefined;
    let disable: Promise<pg.QueryResult<{ status: string }>> | undefined;
    let disabler: pg.PoolClient | undefined;
    const entered = deferred();
    const release = deferred();
    try {
      const session = (await appPool.query<{ role: string; pid: number; bypass: boolean; superuser: boolean }>(
        'SELECT current_user AS role,pg_backend_pid() AS pid,rolbypassrls AS bypass,rolsuper AS superuser FROM pg_roles WHERE rolname=current_user'
      )).rows[0]!;
      expect(session).toMatchObject({ role: 'xiaoshuyin_app', bypass: false, superuser: false });
      accountId = (await admin.query<{ id: string }>(
        'INSERT INTO accounts (wechat_openid) VALUES ($1) RETURNING id', ['e2_lock_' + suffix]
      )).rows[0]!.id;
      personId = (await admin.query<{ id: string }>(
        'INSERT INTO persons (account_id,created_by_account_id) VALUES ($1,$1) RETURNING id', [accountId]
      )).rows[0]!.id;
      await admin.query(
        "INSERT INTO staff_assignments (account_id,person_id,capability,scope_type,granted_by_account_id) VALUES ($1,$2,'PROFESSIONAL_REVIEW','GLOBAL',$1)",
        [accountId, personId]
      );

      let calls = 0;
      const provider: InterventionProfessionalQualificationProvider = {
        async resolve(input) {
          // Real Account and Staff checks precede the final qualification call.
          if (++calls === 2) { entered.resolve(); await release.promise; }
          return TEST_ONLY_QUALIFICATION_PROVIDER.resolve(input);
        },
      };
      const input = {
        actor: { accountId, personId }, sceneId: 'DIGITAL_USE',
        interventionCode: 'TEST_ACCOUNT_LOCK_' + suffix, semantic: interventionSemantic(),
        approvalScope: 'DIGITAL_USE', idempotencyKey: 'e2-account-lock-' + suffix,
      };
      mutation = createInterventionDefinitionCandidate(appPool, input, provider);
      await bounded(Promise.race([
        entered.promise, mutation.then(() => { throw new Error('Mutation settled before barrier'); }),
      ]), 'final authority barrier');

      disabler = await admin.connect();
      const pid = (await disabler.query<{ pid: number }>('SELECT pg_backend_pid() AS pid')).rows[0]!.pid;
      await disabler.query("SET statement_timeout = '12s'");
      let settled = false;
      disable = disabler.query<{ status: string }>(
        "UPDATE accounts SET status='DISABLED' WHERE id=$1 RETURNING status", [accountId]
      ).finally(() => { settled = true; });
      void disable.catch(() => undefined);
      // Prove the actual UPDATE waits on the actual app backend, not a timer.
      let blocked = false;
      const deadline = Date.now() + 5000;
      while (!settled && Date.now() < deadline) {
        const wait = await admin.query<{ blocked: boolean; wait_event_type: string; wait_event: string }>(
          'SELECT $1::int = ANY(pg_blocking_pids(pid)) AS blocked, wait_event_type, wait_event FROM pg_stat_activity WHERE pid=$2::int',
          [session.pid, pid]
        );
        const observed = wait.rows[0];
        if (observed?.blocked) {
          // An advisory-lock wait alone would also occur with FOR KEY SHARE
          // because the Account UPDATE trigger acquires AUTH_ACCOUNT. Require
          // the real tuple/transaction lock conflict caused by FOR SHARE.
          expect(observed.wait_event_type).toBe('Lock');
          expect(['transactionid', 'tuple']).toContain(observed.wait_event);
          blocked = true;
          break;
        }
        await new Promise(done => setTimeout(done, 20));
      }
      expect(blocked, 'Account UPDATE must wait on service PID').toBe(true);
      expect(settled).toBe(false);
      expect((await admin.query('SELECT status FROM accounts WHERE id=$1', [accountId])).rows[0]?.status).toBe('ACTIVE');
      expect((await admin.query('SELECT id FROM intervention_definitions WHERE created_by_person_id=$1', [personId])).rows).toEqual([]);
      release.resolve();
      const [created, disabled] = await bounded(Promise.all([mutation, disable]), 'transaction settlement');
      expect(created.state).toBe('CANDIDATE');
      expect(created.interventionCode).toBe(input.interventionCode);
      expect(disabled.rows[0]?.status).toBe('DISABLED');

      await expect(createInterventionDefinitionCandidate(appPool, {
        ...input, interventionCode: 'TEST_ACCOUNT_DENIED_' + suffix,
        idempotencyKey: 'e2-account-denied-' + suffix,
      }, TEST_ONLY_QUALIFICATION_PROVIDER)).rejects.toMatchObject({ code: 'INTERVENTION_STAFF_AUTHORITY_INVALID' });
      const [defs, audits, keys] = await Promise.all([
        admin.query('SELECT intervention_code FROM intervention_definitions WHERE created_by_person_id=$1', [personId]),
        admin.query("SELECT resource_id,event_type FROM business_audit_events WHERE actor_account_id=$1 AND resource_type='INTERVENTION_DEFINITION'", [accountId]),
        admin.query("SELECT idempotency_key FROM idempotency_keys WHERE actor_account_id=$1 AND command_type='INTERVENTION_DEFINITION_CREATE'", [accountId]),
      ]);
      expect(defs.rows).toEqual([{ intervention_code: input.interventionCode }]);
      expect(audits.rows).toEqual([{ resource_id: created.id, event_type: 'INTERVENTION_DEFINITION_CANDIDATE_CREATED' }]);
      expect(keys.rows).toEqual([{ idempotency_key: input.idempotencyKey }]);
    } finally {
      release.resolve();
      await Promise.allSettled([mutation, disable]);
      if (disabler) {
        await disabler.query('RESET statement_timeout').catch(() => undefined);
        disabler.release();
      }
      if (accountId) {
        await admin.query('DELETE FROM business_audit_events WHERE actor_account_id=$1', [accountId]).catch(() => undefined);
        await admin.query('DELETE FROM idempotency_keys WHERE actor_account_id=$1', [accountId]).catch(() => undefined);
        await admin.query('DELETE FROM intervention_definitions WHERE created_by_person_id=$1', [personId]).catch(() => undefined);
        await admin.query('DELETE FROM staff_assignments WHERE account_id=$1', [accountId]).catch(() => undefined);
        await admin.query('DELETE FROM persons WHERE id=$1', [personId]).catch(() => undefined);
        await admin.query('DELETE FROM accounts WHERE id=$1', [accountId]).catch(() => undefined);
      }
      await appPool.end();
      await admin.end();
    }
  }, 30000);
});
