import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import crypto from 'node:crypto';
import pg from 'pg';
import {
  interventionDefinitionContentHash,
  prepareInterventionDefinition,
} from '../../packages/domain/src/index.js';
import {
  createInterventionDefinitionCandidate,
  createInterventionDefinitionSuccessor,
  retireInterventionDefinition,
  supersedeInterventionDefinition,
} from '../../apps/server/api/src/services/intervention-definitions.js';
import { createAdminPool } from '../setup/db.js';
import {
  TEST_ONLY_QUALIFICATION_PROVIDER,
  interventionSemantic,
} from '../support/intervention.js';
import type { InterventionProfessionalQualificationProvider } from '../../apps/server/api/src/services/intervention-professional-authority.js';

describe('Slice 16 InterventionDefinition real concurrency / atomicity', () => {
  let admin: pg.Pool;
  let appPool: pg.Pool;
  let accountId: string;
  let personId: string;
  let assignmentId: string;
  let secondAccountId: string;
  let secondPersonId: string;
  const prefix = 's16race_' + crypto.randomUUID();
  const key = (label: string) => 's16-race-' + label + '-' + crypto.randomUUID();
  const actor = () => ({ accountId, personId });
  const secondActor = () => ({ accountId: secondAccountId, personId: secondPersonId });
  const code = (label: string) =>
    ('TEST_' + label + '_' + crypto.randomUUID().replaceAll('-', '').slice(0, 12)).toUpperCase();

  beforeAll(async () => {
    admin = createAdminPool();
    appPool = new pg.Pool({ connectionString: process.env['DATABASE_URL']!, max: 8 });
    const account = await admin.query<{ id: string }>(
      'INSERT INTO accounts (wechat_openid) VALUES ($1) RETURNING id',
      [prefix]
    );
    accountId = account.rows[0]!.id;
    const person = await admin.query<{ id: string }>(
      'INSERT INTO persons (account_id,created_by_account_id) VALUES ($1,$1) RETURNING id',
      [accountId]
    );
    personId = person.rows[0]!.id;
    const assignment = await admin.query<{ id: string }>(
      "INSERT INTO staff_assignments " +
        "(account_id,person_id,capability,scope_type,granted_by_account_id) " +
        "VALUES ($1,$2,'PROFESSIONAL_REVIEW','GLOBAL',$1) RETURNING id",
      [accountId, personId]
    );
    assignmentId = assignment.rows[0]!.id;

    const secondAccount = await admin.query<{ id: string }>(
      'INSERT INTO accounts (wechat_openid) VALUES ($1) RETURNING id',
      [prefix + '_second']
    );
    secondAccountId = secondAccount.rows[0]!.id;
    const secondPerson = await admin.query<{ id: string }>(
      'INSERT INTO persons (account_id,created_by_account_id) VALUES ($1,$1) RETURNING id',
      [secondAccountId]
    );
    secondPersonId = secondPerson.rows[0]!.id;
    await admin.query(
      "INSERT INTO staff_assignments " +
        "(account_id,person_id,capability,scope_type,granted_by_account_id) " +
        "VALUES ($1,$2,'PROFESSIONAL_REVIEW','GLOBAL',$1)",
      [secondAccountId, secondPersonId]
    );
  });

  afterAll(async () => {
    await admin.query('DELETE FROM business_audit_events WHERE actor_account_id=$1', [secondAccountId]).catch(() => undefined);
    await admin.query('DELETE FROM idempotency_keys WHERE actor_account_id=$1', [secondAccountId]).catch(() => undefined);
    await admin.query('DELETE FROM intervention_definitions WHERE created_by_person_id=$1', [secondPersonId]).catch(() => undefined);
    await admin.query('DELETE FROM staff_assignments WHERE account_id=$1', [secondAccountId]).catch(() => undefined);
    await admin.query('DELETE FROM persons WHERE id=$1', [secondPersonId]).catch(() => undefined);
    await admin.query('DELETE FROM accounts WHERE id=$1', [secondAccountId]).catch(() => undefined);
    await admin.query('DELETE FROM business_audit_events WHERE actor_account_id=$1', [accountId]).catch(() => undefined);
    await admin.query('DELETE FROM idempotency_keys WHERE actor_account_id=$1', [accountId]).catch(() => undefined);
    await admin.query('DELETE FROM intervention_definitions WHERE created_by_person_id=$1', [personId]).catch(() => undefined);
    await admin.query('DELETE FROM staff_assignments WHERE account_id=$1', [accountId]).catch(() => undefined);
    await admin.query('DELETE FROM persons WHERE id=$1', [personId]).catch(() => undefined);
    await admin.query('DELETE FROM accounts WHERE id=$1', [accountId]).catch(() => undefined);
    await appPool.end();
    await admin.end();
  });

  async function ensureActiveAssignment(): Promise<void> {
    const existing = await admin.query('SELECT 1 FROM staff_assignments WHERE id=$1 AND revoked_at IS NULL', [assignmentId]);
    if ((existing.rowCount ?? 0) === 0) {
      const assignment = await admin.query<{ id: string }>(
        "INSERT INTO staff_assignments " +
          "(account_id,person_id,capability,scope_type,granted_by_account_id) " +
          "VALUES ($1,$2,'PROFESSIONAL_REVIEW','GLOBAL',$1) RETURNING id",
        [accountId, personId]
      );
      assignmentId = assignment.rows[0]!.id;
    }
  }

  async function waitForQueuedChainWaiters(
    gatePid: number,
    minimum: number
  ): Promise<void> {
    for (let attempt = 0; attempt < 500; attempt += 1) {
      const result = await admin.query<{ waiters: number }>(
        `SELECT count(*)::int AS waiters
           FROM pg_locks waiting
           JOIN pg_locks gate
             ON waiting.locktype = gate.locktype
            AND waiting.database IS NOT DISTINCT FROM gate.database
            AND waiting.classid = gate.classid
            AND waiting.objid = gate.objid
            AND waiting.objsubid = gate.objsubid
          WHERE gate.pid=$1
            AND gate.locktype='advisory'
            AND gate.granted
            AND NOT waiting.granted`,
        [gatePid]
      );
      if ((result.rows[0]?.waiters ?? 0) >= minimum) return;
    }
    throw new Error('INTERVENTION_TEST_BARRIER_NOT_REACHED:' + minimum);
  }

  async function runDifferentReviewerSuccessorVsTerminal(
    terminal: 'retire' | 'supersede'
  ): Promise<void> {
    await ensureActiveAssignment();
    const interventionCode = code(
      terminal === 'retire' ? 'DIFF_REVIEWER_RETIRE' : 'DIFF_REVIEWER_SUPERSEDE'
    );
    const first = await createInterventionDefinitionCandidate(
      appPool,
      {
        actor: actor(),
        sceneId: 'DIGITAL_USE',
        interventionCode,
        semantic: interventionSemantic(),
        approvalScope: 'DIGITAL_USE',
        idempotencyKey: key('different-reviewer-pred'),
      },
      TEST_ONLY_QUALIFICATION_PROVIDER
    );
    const exact = {
      id: first.id,
      version: first.version,
      contentHash: first.contentHash,
      expectedRevision: first.revision,
    };

    const gate = await admin.connect();
    let gateCommitted = false;
    try {
      await gate.query('BEGIN');
      const pid = await gate.query<{ pid: number }>('SELECT pg_backend_pid() AS pid');
      const gatePid = pid.rows[0]!.pid;
      await gate.query(
        'SELECT pg_advisory_xact_lock(hashtextextended($1, 0::bigint))',
        ['INTERVENTION_DEFINITION:DIGITAL_USE:' + interventionCode]
      );

      const successor = createInterventionDefinitionSuccessor(
        appPool,
        {
          actor: actor(),
          predecessor: exact,
          semantic: interventionSemantic({ rationale: 'DIFFERENT_REVIEWER_SUCCESSOR' }),
          approvalScope: 'DIGITAL_USE',
          idempotencyKey: key('different-reviewer-successor'),
        },
        TEST_ONLY_QUALIFICATION_PROVIDER
      );
      await waitForQueuedChainWaiters(gatePid, 1);

      const terminalMutation =
        terminal === 'retire'
          ? retireInterventionDefinition(
              appPool,
              {
                actor: secondActor(),
                definition: exact,
                approvalScope: 'DIGITAL_USE',
                idempotencyKey: key('different-reviewer-retire'),
              },
              TEST_ONLY_QUALIFICATION_PROVIDER
            )
          : supersedeInterventionDefinition(
              appPool,
              {
                actor: secondActor(),
                definition: exact,
                approvalScope: 'DIGITAL_USE',
                idempotencyKey: key('different-reviewer-supersede'),
              },
              TEST_ONLY_QUALIFICATION_PROVIDER
            );

      await waitForQueuedChainWaiters(gatePid, 2);
      await gate.query('COMMIT');
      gateCommitted = true;

      const results = await Promise.allSettled([successor, terminalMutation]);
      expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
      const rejected = results.find(
        (result): result is PromiseRejectedResult => result.status === 'rejected'
      );
      expect(rejected).toBeDefined();
      expect(rejected!.reason?.code).not.toBe('40P01');
      expect(rejected!.reason).toMatchObject({
        code: 'INTERVENTION_DEFINITION_STALE_REVISION',
      });

      const rows = await admin.query<{ version: number; definition_state: string }>(
        'SELECT version,definition_state FROM intervention_definitions ' +
          'WHERE intervention_code=$1 ORDER BY version',
        [interventionCode]
      );
      if (rows.rows.length === 1) {
        expect(rows.rows[0]!.definition_state).toBe(
          terminal === 'retire' ? 'RETIRED' : 'SUPERSEDED'
        );
      } else {
        expect(rows.rows).toHaveLength(2);
        expect(rows.rows[0]!.definition_state).toBe('SUPERSEDED');
        expect(rows.rows[1]!.definition_state).toBe('CANDIDATE');
      }
    } finally {
      if (!gateCommitted) await gate.query('ROLLBACK').catch(() => undefined);
      gate.release();
    }
  }

  it('two concurrent version-1 creates produce one authoritative winner', async () => {
    await ensureActiveAssignment();
    const interventionCode = code('CREATE_RACE');
    const results = await Promise.allSettled([
      createInterventionDefinitionCandidate(appPool, {
        actor: actor(), sceneId: 'DIGITAL_USE', interventionCode,
        semantic: interventionSemantic({ rationale: 'RACE_A' }),
        approvalScope: 'DIGITAL_USE', idempotencyKey: key('create-a'),
      }, TEST_ONLY_QUALIFICATION_PROVIDER),
      createInterventionDefinitionCandidate(appPool, {
        actor: actor(), sceneId: 'DIGITAL_USE', interventionCode,
        semantic: interventionSemantic({ rationale: 'RACE_B' }),
        approvalScope: 'DIGITAL_USE', idempotencyKey: key('create-b'),
      }, TEST_ONLY_QUALIFICATION_PROVIDER),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const count = await admin.query<{ count: string }>(
      'SELECT count(*)::text AS count FROM intervention_definitions WHERE intervention_code=$1',
      [interventionCode]
    );
    expect(count.rows[0]!.count).toBe('1');
  });

  it('concurrent same-key same-payload executes once and replays the one committed identity', async () => {
    await ensureActiveAssignment();
    const interventionCode = code('SAME_KEY');
    const idem = key('same');
    const input = {
      actor: actor(), sceneId: 'DIGITAL_USE', interventionCode,
      semantic: interventionSemantic({ rationale: 'SAME_PAYLOAD' }),
      approvalScope: 'DIGITAL_USE', idempotencyKey: idem,
    };
    const [a,b] = await Promise.all([
      createInterventionDefinitionCandidate(appPool, input, TEST_ONLY_QUALIFICATION_PROVIDER),
      createInterventionDefinitionCandidate(appPool, input, TEST_ONLY_QUALIFICATION_PROVIDER),
    ]);
    expect(a.id).toBe(b.id);
    const count = await admin.query<{ count: string }>(
      'SELECT count(*)::text AS count FROM intervention_definitions WHERE intervention_code=$1',
      [interventionCode]
    );
    expect(count.rows[0]!.count).toBe('1');
  });

  it('two concurrent successor creates yield one next version and a stale-writer loser', async () => {
    await ensureActiveAssignment();
    const interventionCode = code('SUCCESSOR_RACE');
    const first = await createInterventionDefinitionCandidate(appPool, {
      actor: actor(), sceneId: 'DIGITAL_USE', interventionCode,
      semantic: interventionSemantic(), approvalScope: 'DIGITAL_USE',
      idempotencyKey: key('pred'),
    }, TEST_ONLY_QUALIFICATION_PROVIDER);

    const predecessor = {
      id: first.id, version: first.version, contentHash: first.contentHash,
      expectedRevision: first.revision,
    };
    const results = await Promise.allSettled([
      createInterventionDefinitionSuccessor(appPool, {
        actor: actor(), predecessor,
        semantic: interventionSemantic({ rationale: 'SUCCESSOR_A' }),
        approvalScope: 'DIGITAL_USE', idempotencyKey: key('succ-a'),
      }, TEST_ONLY_QUALIFICATION_PROVIDER),
      createInterventionDefinitionSuccessor(appPool, {
        actor: actor(), predecessor,
        semantic: interventionSemantic({ rationale: 'SUCCESSOR_B' }),
        approvalScope: 'DIGITAL_USE', idempotencyKey: key('succ-b'),
      }, TEST_ONLY_QUALIFICATION_PROVIDER),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const versions = await admin.query<{ version: number; definition_state: string }>(
      'SELECT version,definition_state FROM intervention_definitions WHERE intervention_code=$1 ORDER BY version',
      [interventionCode]
    );
    expect(versions.rows).toHaveLength(2);
    expect(versions.rows.map((r) => r.version)).toEqual([1,2]);
    expect(versions.rows[0]!.definition_state).toBe('SUPERSEDED');
  });

  it('retire versus successor has one authoritative winner and cannot resurrect the chain', async () => {
    await ensureActiveAssignment();
    const interventionCode = code('RETIRE_RACE');
    const first = await createInterventionDefinitionCandidate(appPool, {
      actor: actor(), sceneId: 'DIGITAL_USE', interventionCode,
      semantic: interventionSemantic(), approvalScope: 'DIGITAL_USE',
      idempotencyKey: key('rpred'),
    }, TEST_ONLY_QUALIFICATION_PROVIDER);
    const exact = {
      id: first.id, version: first.version, contentHash: first.contentHash,
      expectedRevision: first.revision,
    };

    const results = await Promise.allSettled([
      retireInterventionDefinition(appPool, {
        actor: actor(), definition: exact, approvalScope: 'DIGITAL_USE',
        idempotencyKey: key('retire'),
      }, TEST_ONLY_QUALIFICATION_PROVIDER),
      createInterventionDefinitionSuccessor(appPool, {
        actor: actor(), predecessor: exact,
        semantic: interventionSemantic({ rationale: 'RACE_SUCCESSOR' }),
        approvalScope: 'DIGITAL_USE', idempotencyKey: key('successor'),
      }, TEST_ONLY_QUALIFICATION_PROVIDER),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);

    const rows = await admin.query<{ version: number; definition_state: string }>(
      'SELECT version,definition_state FROM intervention_definitions WHERE intervention_code=$1 ORDER BY version',
      [interventionCode]
    );
    if (rows.rows.length === 1) {
      expect(rows.rows[0]!.definition_state).toBe('RETIRED');
    } else {
      expect(rows.rows).toHaveLength(2);
      expect(rows.rows[0]!.definition_state).toBe('SUPERSEDED');
      expect(rows.rows[1]!.definition_state).toBe('CANDIDATE');
    }
  });

  it('different reviewers: successor versus retire has no lock-order deadlock', async () => {
    await runDifferentReviewerSuccessorVsTerminal('retire');
  });

  it('different reviewers: successor versus supersede has no lock-order deadlock', async () => {
    await runDifferentReviewerSuccessorVsTerminal('supersede');
  });

  it('qualification proof changing between prepare and mutation rolls back definition, audit and idempotency', async () => {
    await ensureActiveAssignment();
    let call = 0;
    const changingProvider: InterventionProfessionalQualificationProvider = {
      async resolve(input) {
        call++;
        return {
          qualificationRef: call === 1 ? 'Q:A' : 'Q:B',
          scopeRef: input.approvalScope,
          status: 'VALID',
        };
      },
    };
    const interventionCode = code('ROLLBACK');
    const idem = key('rollback');
    const auditBefore = await admin.query<{ count: string }>(
      "SELECT count(*)::text AS count FROM business_audit_events " +
        "WHERE actor_account_id=$1 AND resource_type='INTERVENTION_DEFINITION'",
      [accountId]
    );
    await expect(
      createInterventionDefinitionCandidate(appPool, {
        actor: actor(), sceneId: 'DIGITAL_USE', interventionCode,
        semantic: interventionSemantic(), approvalScope: 'DIGITAL_USE',
        idempotencyKey: idem,
      }, changingProvider)
    ).rejects.toMatchObject({ code: 'INTERVENTION_DEPENDENCY_UNAVAILABLE' });

    const [defs, audits, idems] = await Promise.all([
      admin.query<{ count: string }>('SELECT count(*)::text AS count FROM intervention_definitions WHERE intervention_code=$1', [interventionCode]),
      admin.query<{ count: string }>("SELECT count(*)::text AS count FROM business_audit_events WHERE actor_account_id=$1 AND resource_type='INTERVENTION_DEFINITION'", [accountId]),
      admin.query<{ count: string }>("SELECT count(*)::text AS count FROM idempotency_keys WHERE actor_account_id=$1 AND command_type='INTERVENTION_DEFINITION_CREATE' AND idempotency_key=$2", [accountId, idem]),
    ]);
    expect(defs.rows[0]!.count).toBe('0');
    expect(idems.rows[0]!.count).toBe('0');
    expect(audits.rows[0]!.count).toBe(auditBefore.rows[0]!.count);
  });

  it('revoked Staff authority cannot authorize a fresh mutation, while historical exact replay stays replay-only', async () => {
    await ensureActiveAssignment();
    const interventionCode = code('REVOKE');
    const idem = key('replay-after-revoke');
    const input = {
      actor: actor(), sceneId: 'DIGITAL_USE', interventionCode,
      semantic: interventionSemantic(), approvalScope: 'DIGITAL_USE',
      idempotencyKey: idem,
    };
    const committed = await createInterventionDefinitionCandidate(
      appPool, input, TEST_ONLY_QUALIFICATION_PROVIDER
    );
    await admin.query(
      'UPDATE staff_assignments SET revoked_at=clock_timestamp(),revoked_by_account_id=$1 WHERE id=$2',
      [accountId, assignmentId]
    );

    const replay = await createInterventionDefinitionCandidate(
      appPool, input, TEST_ONLY_QUALIFICATION_PROVIDER
    );
    expect(replay.id).toBe(committed.id);

    await expect(
      createInterventionDefinitionCandidate(appPool, {
        ...input,
        interventionCode: code('AFTER_REVOKE'),
        idempotencyKey: key('fresh-after-revoke'),
      }, TEST_ONLY_QUALIFICATION_PROVIDER)
    ).rejects.toMatchObject({ code: 'INTERVENTION_STAFF_AUTHORITY_INVALID' });
  });

  it('serializes a fresh mutation ahead of a truly concurrent Staff revocation', async () => {
    await ensureActiveAssignment();

    let call = 0;
    let enteredSecond!: () => void;
    let releaseSecond!: () => void;
    const entered = new Promise<void>((resolve) => { enteredSecond = resolve; });
    const release = new Promise<void>((resolve) => { releaseSecond = resolve; });
    const stableQualification: InterventionProfessionalQualificationProvider = {
      async resolve(input) {
        call += 1;
        if (call === 2) {
          enteredSecond();
          await release;
        }
        return {
          qualificationRef: 'Q:STABLE',
          scopeRef: input.approvalScope,
          status: 'VALID',
        };
      },
    };

    const interventionCode = code('STAFF_REVOKE_RACE');
    const mutation = createInterventionDefinitionCandidate(
      appPool,
      {
        actor: actor(),
        sceneId: 'DIGITAL_USE',
        interventionCode,
        semantic: interventionSemantic(),
        approvalScope: 'DIGITAL_USE',
        idempotencyKey: key('staff-revoke-race'),
      },
      stableQualification
    );

    await entered;

    let revokeSettled = false;
    const revoke = admin.query(
      'UPDATE staff_assignments ' +
        'SET revoked_at=clock_timestamp(),revoked_by_account_id=$1 WHERE id=$2',
      [accountId, assignmentId]
    ).finally(() => {
      revokeSettled = true;
    });

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(revokeSettled).toBe(false);

    releaseSecond();
    const [created] = await Promise.all([mutation, revoke]);
    expect(created.interventionCode).toBe(interventionCode);
    expect(revokeSettled).toBe(true);

    await expect(
      createInterventionDefinitionCandidate(
        appPool,
        {
          actor: actor(),
          sceneId: 'DIGITAL_USE',
          interventionCode: code('POST_CONCURRENT_REVOKE'),
          semantic: interventionSemantic(),
          approvalScope: 'DIGITAL_USE',
          idempotencyKey: key('post-concurrent-revoke'),
        },
        TEST_ONLY_QUALIFICATION_PROVIDER
      )
    ).rejects.toMatchObject({ code: 'INTERVENTION_STAFF_AUTHORITY_INVALID' });
  });


  it('same idempotency key under a different actor cannot replay the first actor result', async () => {
    await ensureActiveAssignment();
    const sharedKey = 's16-cross-actor-' + crypto.randomUUID();
    const first = await createInterventionDefinitionCandidate(
      appPool,
      {
        actor: actor(),
        sceneId: 'DIGITAL_USE',
        interventionCode: code('ACTOR_ONE'),
        semantic: interventionSemantic(),
        approvalScope: 'DIGITAL_USE',
        idempotencyKey: sharedKey,
      },
      TEST_ONLY_QUALIFICATION_PROVIDER
    );

    const account = await admin.query<{ id: string }>(
      'INSERT INTO accounts (wechat_openid) VALUES ($1) RETURNING id',
      ['s16-second-actor-' + crypto.randomUUID()]
    );
    const secondAccountId = account.rows[0]!.id;
    const person = await admin.query<{ id: string }>(
      'INSERT INTO persons (account_id,created_by_account_id) VALUES ($1,$1) RETURNING id',
      [secondAccountId]
    );
    const secondPersonId = person.rows[0]!.id;
    await admin.query(
      "INSERT INTO staff_assignments " +
        "(account_id,person_id,capability,scope_type,granted_by_account_id) " +
        "VALUES ($1,$2,'PROFESSIONAL_REVIEW','GLOBAL',$1)",
      [secondAccountId, secondPersonId]
    );

    try {
      const second = await createInterventionDefinitionCandidate(
        appPool,
        {
          actor: { accountId: secondAccountId, personId: secondPersonId },
          sceneId: 'DIGITAL_USE',
          interventionCode: code('ACTOR_TWO'),
          semantic: interventionSemantic(),
          approvalScope: 'DIGITAL_USE',
          idempotencyKey: sharedKey,
        },
        TEST_ONLY_QUALIFICATION_PROVIDER
      );
      expect(second.id).not.toBe(first.id);
      expect(second.createdByPersonId).toBe(secondPersonId);
    } finally {
      await admin.query(
        'DELETE FROM business_audit_events WHERE actor_account_id=$1',
        [secondAccountId]
      ).catch(() => undefined);
      await admin.query(
        'DELETE FROM idempotency_keys WHERE actor_account_id=$1',
        [secondAccountId]
      ).catch(() => undefined);
      await admin.query(
        'DELETE FROM intervention_definitions WHERE created_by_person_id=$1',
        [secondPersonId]
      ).catch(() => undefined);
      await admin.query(
        'DELETE FROM staff_assignments WHERE account_id=$1',
        [secondAccountId]
      ).catch(() => undefined);
      await admin.query('DELETE FROM persons WHERE id=$1', [secondPersonId])
        .catch(() => undefined);
      await admin.query('DELETE FROM accounts WHERE id=$1', [secondAccountId])
        .catch(() => undefined);
    }
  });

  it('supersede versus retire on the same revision has exactly one terminal winner', async () => {
    await ensureActiveAssignment();
    const interventionCode = code('TERMINAL_RACE');
    const first = await createInterventionDefinitionCandidate(
      appPool,
      {
        actor: actor(),
        sceneId: 'DIGITAL_USE',
        interventionCode,
        semantic: interventionSemantic(),
        approvalScope: 'DIGITAL_USE',
        idempotencyKey: key('terminal-pred'),
      },
      TEST_ONLY_QUALIFICATION_PROVIDER
    );
    const exact = {
      id: first.id,
      version: first.version,
      contentHash: first.contentHash,
      expectedRevision: first.revision,
    };

    const results = await Promise.allSettled([
      retireInterventionDefinition(
        appPool,
        {
          actor: actor(),
          definition: exact,
          approvalScope: 'DIGITAL_USE',
          idempotencyKey: key('terminal-retire'),
        },
        TEST_ONLY_QUALIFICATION_PROVIDER
      ),
      supersedeInterventionDefinition(
        appPool,
        {
          actor: actor(),
          definition: exact,
          approvalScope: 'DIGITAL_USE',
          idempotencyKey: key('terminal-supersede'),
        },
        TEST_ONLY_QUALIFICATION_PROVIDER
      ),
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const row = await admin.query<{ definition_state: string; revision: number }>(
      'SELECT definition_state,revision FROM intervention_definitions WHERE id=$1',
      [first.id]
    );
    expect(['RETIRED', 'SUPERSEDED']).toContain(row.rows[0]!.definition_state);
    expect(row.rows[0]!.revision).toBe(2);
  });


  it('detaches the validated semantic snapshot before qualification await and persists the same hashed value', async () => {
    await ensureActiveAssignment();
    const semantic = structuredClone(
      interventionSemantic({
        applicable_conditions: [
          { fact_ref: 'family.state', operator: 'IN', value: ['READY', 'STABLE'] },
        ],
      })
    ) as any;
    const interventionCode = code('ALIAS_SNAPSHOT');
    const expected = prepareInterventionDefinition({
      sceneId: 'DIGITAL_USE',
      interventionCode,
      version: 1,
      semantic,
    });

    let entered!: () => void;
    let release!: () => void;
    const atBarrier = new Promise<void>((resolve) => { entered = resolve; });
    const continueBarrier = new Promise<void>((resolve) => { release = resolve; });
    let calls = 0;
    const barrierProvider: InterventionProfessionalQualificationProvider = {
      async resolve(input) {
        calls += 1;
        if (calls === 1) {
          entered();
          await continueBarrier;
        }
        return {
          qualificationRef: 'Q:ALIAS_SNAPSHOT',
          scopeRef: input.approvalScope,
          status: 'VALID',
        };
      },
    };

    const mutation = createInterventionDefinitionCandidate(
      appPool,
      {
        actor: actor(),
        sceneId: 'DIGITAL_USE',
        interventionCode,
        semantic,
        approvalScope: 'DIGITAL_USE',
        idempotencyKey: key('alias-snapshot'),
      },
      barrierProvider
    );
    await atBarrier;

    const mutateArrays = (value: unknown): void => {
      if (Array.isArray(value)) {
        value.push('__CALLER_MUTATION__');
        for (const nested of value) mutateArrays(nested);
        return;
      }
      if (typeof value === 'object' && value !== null) {
        for (const nested of Object.values(value as Record<string, unknown>)) {
          mutateArrays(nested);
        }
      }
    };
    mutateArrays(semantic);
    semantic.target_problem_or_mechanism = 'CALLER_MUTATED_AFTER_HASH';
    semantic.age_and_development_scope.min_age_years = 99;
    release();

    const created = await mutation;
    expect(created.semantic).toEqual(expected.semantic);
    expect(created.contentHash).toBe(expected.contentHash);
    expect(interventionDefinitionContentHash(created.semantic)).toBe(created.contentHash);

    const stored = await admin.query<{
      content_hash: string;
      target_problem_or_mechanism: string;
      applicable_conditions: unknown;
      age_and_development_scope: unknown;
      intervention_steps: unknown;
      professional_source_refs: unknown;
    }>(
      'SELECT content_hash,target_problem_or_mechanism,applicable_conditions,' +
        'age_and_development_scope,intervention_steps,professional_source_refs ' +
        'FROM intervention_definitions WHERE id=$1',
      [created.id]
    );
    expect(stored.rows[0]!.content_hash).toBe(expected.contentHash);
    expect(stored.rows[0]!.target_problem_or_mechanism)
      .toBe(expected.semantic.target_problem_or_mechanism);
    expect(stored.rows[0]!.applicable_conditions)
      .toEqual(expected.semantic.applicable_conditions);
    expect(stored.rows[0]!.age_and_development_scope)
      .toEqual(expected.semantic.age_and_development_scope);
    expect(stored.rows[0]!.intervention_steps)
      .toEqual(expected.semantic.intervention_steps);
    expect(stored.rows[0]!.professional_source_refs)
      .toEqual(expected.semantic.professional_source_refs);
  });

  it('derives qualification scope from authoritative Definition context, never caller assertion', async () => {
    await ensureActiveAssignment();
    let providerCalls = 0;
    const otherOnly: InterventionProfessionalQualificationProvider = {
      async resolve(input) {
        providerCalls += 1;
        return input.approvalScope === 'OTHER'
          ? { qualificationRef: 'Q:OTHER', scopeRef: 'OTHER', status: 'VALID' }
          : null;
      },
    };

    await expect(
      createInterventionDefinitionCandidate(
        appPool,
        {
          actor: actor(),
          sceneId: 'DIGITAL_USE',
          interventionCode: code('WRONG_SCOPE_CREATE'),
          semantic: interventionSemantic(),
          approvalScope: 'OTHER',
          idempotencyKey: key('wrong-scope-create'),
        },
        otherOnly
      )
    ).rejects.toMatchObject({ code: 'INTERVENTION_APPROVAL_SCOPE_MISMATCH' });
    expect(providerCalls).toBe(0);

    const created = await createInterventionDefinitionCandidate(
      appPool,
      {
        actor: actor(),
        sceneId: 'DIGITAL_USE',
        interventionCode: code('RIGHT_SCOPE_BASE'),
        semantic: interventionSemantic(),
        approvalScope: 'DIGITAL_USE',
        idempotencyKey: key('right-scope-base'),
      },
      TEST_ONLY_QUALIFICATION_PROVIDER
    );
    const exact = {
      id: created.id,
      version: created.version,
      contentHash: created.contentHash,
      expectedRevision: created.revision,
    };

    for (const mutate of [
      () => retireInterventionDefinition(
        appPool,
        {
          actor: actor(),
          definition: exact,
          approvalScope: 'OTHER',
          idempotencyKey: key('wrong-scope-retire'),
        },
        otherOnly
      ),
      () => supersedeInterventionDefinition(
        appPool,
        {
          actor: actor(),
          definition: exact,
          approvalScope: 'OTHER',
          idempotencyKey: key('wrong-scope-supersede'),
        },
        otherOnly
      ),
      () => createInterventionDefinitionSuccessor(
        appPool,
        {
          actor: actor(),
          predecessor: exact,
          semantic: interventionSemantic({ rationale: 'WRONG_SCOPE_SUCCESSOR' }),
          approvalScope: 'OTHER',
          idempotencyKey: key('wrong-scope-successor'),
        },
        otherOnly
      ),
    ]) {
      await expect(mutate()).rejects.toMatchObject({
        code: 'INTERVENTION_APPROVAL_SCOPE_MISMATCH',
      });
    }
    const unchanged = await admin.query<{ definition_state: string; revision: number }>(
      'SELECT definition_state,revision FROM intervention_definitions WHERE id=$1',
      [created.id]
    );
    expect(unchanged.rows[0]).toEqual({
      definition_state: 'CANDIDATE',
      revision: 1,
    });
  });

  it('revalidates qualification after a real chain-lock wait and rolls back when qualification was revoked', async () => {
    await ensureActiveAssignment();
    const interventionCode = code('QUALIFICATION_REVOKE_WAIT');
    let qualificationValid = true;
    let calls = 0;
    const revocableProvider: InterventionProfessionalQualificationProvider = {
      async resolve(input) {
        calls += 1;
        return qualificationValid
          ? {
              qualificationRef: 'Q:REVOCABLE',
              scopeRef: input.approvalScope,
              status: 'VALID',
            }
          : {
              qualificationRef: 'Q:REVOCABLE',
              scopeRef: input.approvalScope,
              status: 'REVOKED',
            };
      },
    };
    const idem = key('qualification-revoke-wait');
    const auditBefore = await admin.query<{ count: string }>(
      "SELECT count(*)::text AS count FROM business_audit_events " +
        "WHERE actor_account_id=$1 AND event_type='INTERVENTION_DEFINITION_CANDIDATE_CREATED'",
      [accountId]
    );
    const gate = await admin.connect();
    let gateCommitted = false;
    try {
      await gate.query('BEGIN');
      const pid = await gate.query<{ pid: number }>('SELECT pg_backend_pid() AS pid');
      const gatePid = pid.rows[0]!.pid;
      await gate.query(
        'SELECT pg_advisory_xact_lock(hashtextextended($1, 0::bigint))',
        ['INTERVENTION_DEFINITION:DIGITAL_USE:' + interventionCode]
      );

      const mutation = createInterventionDefinitionCandidate(
        appPool,
        {
          actor: actor(),
          sceneId: 'DIGITAL_USE',
          interventionCode,
          semantic: interventionSemantic(),
          approvalScope: 'DIGITAL_USE',
          idempotencyKey: idem,
        },
        revocableProvider
      );
      await waitForQueuedChainWaiters(gatePid, 1);
      expect(calls).toBe(1);

      qualificationValid = false;
      await gate.query('COMMIT');
      gateCommitted = true;

      await expect(mutation).rejects.toMatchObject({
        code: 'INTERVENTION_QUALIFICATION_MISSING',
      });
      expect(calls).toBeGreaterThanOrEqual(2);

      const [defs, audits, idems] = await Promise.all([
        admin.query<{ count: string }>(
          'SELECT count(*)::text AS count FROM intervention_definitions WHERE intervention_code=$1',
          [interventionCode]
        ),
        admin.query<{ count: string }>(
          "SELECT count(*)::text AS count FROM business_audit_events " +
            "WHERE actor_account_id=$1 AND event_type='INTERVENTION_DEFINITION_CANDIDATE_CREATED'",
          [accountId]
        ),
        admin.query<{ count: string }>(
          "SELECT count(*)::text AS count FROM idempotency_keys " +
            "WHERE actor_account_id=$1 AND command_type='INTERVENTION_DEFINITION_CREATE' " +
            "AND idempotency_key=$2",
          [accountId, idem]
        ),
      ]);
      expect(defs.rows[0]!.count).toBe('0');
      expect(idems.rows[0]!.count).toBe('0');
      expect(audits.rows[0]!.count).toBe(auditBefore.rows[0]!.count);
    } finally {
      if (!gateCommitted) await gate.query('ROLLBACK').catch(() => undefined);
      gate.release();
    }
  });

  it('AS-035 fails after the domain INSERT and rolls back definition, audit and idempotency settlement', async () => {
    await ensureActiveAssignment();
    const interventionCode = code('POST_WRITE_ROLLBACK');
    const idem = key('post-write-rollback');
    const suffix = crypto.randomUUID().replaceAll('-', '').slice(0, 16);
    const functionName = 'test_s16_post_write_' + suffix;
    const triggerName = 'test_s16_post_write_' + suffix;
    const auditBefore = await admin.query<{ count: string }>(
      "SELECT count(*)::text AS count FROM business_audit_events " +
        "WHERE actor_account_id=$1 AND resource_type='INTERVENTION_DEFINITION'",
      [accountId]
    );

    try {
      await admin.query(
        `CREATE FUNCTION app.${functionName}() RETURNS trigger
         LANGUAGE plpgsql SECURITY INVOKER
         SET search_path=pg_catalog,public
         AS $$
         BEGIN
           IF NEW.actor_account_id = '${accountId}'::uuid
              AND NEW.event_type = 'INTERVENTION_DEFINITION_CANDIDATE_CREATED' THEN
             PERFORM 1 FROM intervention_definitions WHERE id=NEW.resource_id;
             IF FOUND THEN
               RAISE EXCEPTION 'POST_DOMAIN_WRITE_FAILURE_INJECTED';
             END IF;
           END IF;
           RETURN NEW;
         END
         $$`
      );
      await admin.query(
        `CREATE TRIGGER ${triggerName}
         BEFORE INSERT ON business_audit_events
         FOR EACH ROW EXECUTE FUNCTION app.${functionName}()`
      );

      await expect(
        createInterventionDefinitionCandidate(
          appPool,
          {
            actor: actor(),
            sceneId: 'DIGITAL_USE',
            interventionCode,
            semantic: interventionSemantic(),
            approvalScope: 'DIGITAL_USE',
            idempotencyKey: idem,
          },
          TEST_ONLY_QUALIFICATION_PROVIDER
        )
      ).rejects.toThrow(/POST_DOMAIN_WRITE_FAILURE_INJECTED/);

      const [defs, audits, idems] = await Promise.all([
        admin.query<{ count: string }>(
          'SELECT count(*)::text AS count FROM intervention_definitions WHERE intervention_code=$1',
          [interventionCode]
        ),
        admin.query<{ count: string }>(
          "SELECT count(*)::text AS count FROM business_audit_events " +
            "WHERE actor_account_id=$1 AND resource_type='INTERVENTION_DEFINITION'",
          [accountId]
        ),
        admin.query<{ count: string }>(
          "SELECT count(*)::text AS count FROM idempotency_keys " +
            "WHERE actor_account_id=$1 AND command_type='INTERVENTION_DEFINITION_CREATE' " +
            "AND idempotency_key=$2",
          [accountId, idem]
        ),
      ]);
      expect(defs.rows[0]!.count).toBe('0');
      expect(audits.rows[0]!.count).toBe(auditBefore.rows[0]!.count);
      expect(idems.rows[0]!.count).toBe('0');
    } finally {
      await admin.query(
        `DROP TRIGGER IF EXISTS ${triggerName} ON business_audit_events`
      ).catch(() => undefined);
      await admin.query(
        `DROP FUNCTION IF EXISTS app.${functionName}()`
      ).catch(() => undefined);
    }
  });

});
