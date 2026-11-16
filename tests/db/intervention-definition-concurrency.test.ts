import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import crypto from 'node:crypto';
import pg from 'pg';
import {
  createInterventionDefinitionCandidate,
  createInterventionDefinitionSuccessor,
  retireInterventionDefinition,
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
  const prefix = 's16race_' + crypto.randomUUID();
  const key = (label: string) => 's16-race-' + label + '-' + crypto.randomUUID();
  const actor = () => ({ accountId, personId });
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
  });

  afterAll(async () => {
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
});
