/**
 * T068 — COLD-001 targeted remediation: mechanical authorization for all four
 * approved internal Evidence writers.
 *
 * Frozen semantics (plan.md D-5, contracts/evidence-domain.md §2,
 * contracts/security-idempotency.md §1/§8):
 *
 *   action  = CASE_READ
 *   purpose = FAMILY_MANAGEMENT
 *   resource= specific Case
 *
 * Every writer revalidates the current Case / Family / Purpose authorization
 * BEFORE any sensitive read (Person lookup, guardian lookup, source-message
 * lookup, supersedes lookup, Evidence ref lookup, compliance reads). Any
 * rejection is the single internal reason `EVIDENCE_CASE_NOT_AUTHORIZED` and
 * writes zero Evidence / audit rows.
 *
 * This file is RED before the writer authorization seam exists.
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

const ADMIN_URL = process.env['TEST_ADMIN_DATABASE_URL']!;
const APP_URL = process.env['DATABASE_URL']!;

interface Fixture {
  familyId: string;
  caseId: string;
  accountId: string;
  managerPersonId: string;
  memberAccountId: string;
  memberPersonId: string;
  childPersonId: string;
  familyB: string;
  caseB: string;
  managerB: string;
  accountB: string;
}

let admin: pg.Client;
let pool: pg.Pool;
let fx: Fixture;

const AUTHORIZED = 'EVIDENCE_CASE_NOT_AUTHORIZED';

function context(overrides: Record<string, unknown> = {}) {
  return {
    familyId: fx.familyId,
    caseId: fx.caseId,
    actorAccountId: fx.accountId,
    actorPersonId: fx.managerPersonId,
    purpose: 'FAMILY_MANAGEMENT',
    ...overrides,
  } as any;
}

function memberContext(overrides: Record<string, unknown> = {}) {
  return context({
    actorAccountId: fx.memberAccountId,
    actorPersonId: fx.memberPersonId,
    ...overrides,
  });
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
    content: 'authorization matrix statement',
    ...overrides,
  } as any;
}

function observationDraft(overrides: Record<string, unknown> = {}) {
  return {
    subjectPersonId: fx.childPersonId,
    sourceKind: 'GUARDIAN_OBSERVATION',
    sourcePersonId: fx.managerPersonId,
    sourceMessageId: null,
    occurredTimeState: 'UNKNOWN',
    occurredAt: null,
    validFrom: null,
    validUntil: null,
    confirmationStatus: 'UNCONFIRMED',
    supersedesId: null,
    observationCode: 'auth_matrix',
    value: { state: 'UNKNOWN' },
    ...overrides,
  } as any;
}

async function runWrite<T>(
  fn: (tx: pg.PoolClient) => Promise<T>,
  ctx: any,
  rlsPurpose = 'FAMILY_MANAGEMENT'
): Promise<T> {
  return withRlsTransaction(
    pool,
    {
      familyId: ctx.familyId,
      accountId: ctx.actorAccountId,
      personId: ctx.actorPersonId,
      purpose: rlsPurpose,
    },
    fn
  );
}

async function counts(familyId: string) {
  const { rows } = await admin.query(
    `SELECT
       (SELECT count(*)::int FROM assertions WHERE family_id = $1) AS assertions,
       (SELECT count(*)::int FROM observations WHERE family_id = $1) AS observations,
       (SELECT count(*)::int FROM business_audit_events WHERE family_id = $1) AS audits`,
    [familyId]
  );
  return rows[0] as { assertions: number; observations: number; audits: number };
}

async function expectNoWrite<T>(
  promise: Promise<T>,
  code: string = AUTHORIZED
): Promise<any> {
  let error: any = null;
  try {
    await promise;
  } catch (err) {
    error = err;
  }
  expect(error, 'expected the writer to fail closed').not.toBeNull();
  expect(error.code).toBe(code);
  return error;
}

/** Records every SQL statement the writer executes inside its transaction. */
function recordingTx(client: pg.PoolClient, statements: string[]): pg.PoolClient {
  return {
    query: async (sql: string, params?: unknown[]) => {
      statements.push(sql);
      return client.query(sql, params as any);
    },
  } as any;
}

const SENSITIVE_READ = /FROM\s+(assertions|observations|dialogue_messages)|person_compliance_profiles/i;

describe('T068 — Evidence writer authorization (COLD-001)', () => {
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

  describe('recordStatement', () => {
    it('ordinary member is rejected with EVIDENCE_CASE_NOT_AUTHORIZED and zero writes', async () => {
      const before = await counts(fx.familyId);
      await expectNoWrite(
        runWrite((tx) => recordStatement(tx, memberContext(), statementDraft()), memberContext())
      );
      expect(await counts(fx.familyId)).toEqual(before);
    });

    it('actorAccountId ↔ actorPersonId mismatch is rejected with zero writes', async () => {
      const before = await counts(fx.familyId);
      const mismatched = context({ actorPersonId: fx.memberPersonId });
      // Keep the PostgreSQL transaction identity valid and separate from the
      // spoofed writer claim; otherwise withRlsTransaction itself correctly
      // rejects the account/person splice before the writer can run.
      await expectNoWrite(
        runWrite((tx) => recordStatement(tx, mismatched, statementDraft()), context())
      );
      expect(await counts(fx.familyId)).toEqual(before);
    });

    it('missing Case is rejected with zero writes', async () => {
      const before = await counts(fx.familyId);
      const missing = context({ caseId: '00000000-0000-7000-8000-0000000000ff' });
      await expectNoWrite(
        runWrite((tx) => recordStatement(tx, missing, statementDraft()), missing)
      );
      expect(await counts(fx.familyId)).toEqual(before);
    });

    it('cross-Family Case is rejected with zero writes', async () => {
      const before = await counts(fx.familyId);
      const cross = context({ caseId: fx.caseB });
      await expectNoWrite(runWrite((tx) => recordStatement(tx, cross, statementDraft()), cross));
      expect(await counts(fx.familyId)).toEqual(before);
      expect(await counts(fx.familyB)).toEqual({ assertions: 0, observations: 0, audits: 0 });
    });

    it('unsupported Purpose is rejected with zero writes', async () => {
      const before = await counts(fx.familyId);
      const unsupported = context({ purpose: 'SELF_IDENTITY' });
      await expectNoWrite(
        runWrite((tx) => recordStatement(tx, unsupported, statementDraft()), unsupported)
      );
      expect(await counts(fx.familyId)).toEqual(before);
    });

    it('authorized manager continues to the normal Evidence validation', async () => {
      const written = await runWrite(
        (tx) =>
          recordStatement(tx, context(), statementDraft({ content: 'authorized statement' })),
        context()
      );
      expect(written.id).toBeTruthy();
    });
  });

  describe('recordObservation', () => {
    it('ordinary member is rejected with EVIDENCE_CASE_NOT_AUTHORIZED and zero writes', async () => {
      const before = await counts(fx.familyId);
      await expectNoWrite(
        runWrite((tx) => recordObservation(tx, memberContext(), observationDraft()), memberContext())
      );
      expect(await counts(fx.familyId)).toEqual(before);
    });

    it('authorized manager continues to the normal Observation validation', async () => {
      const written = await runWrite(
        (tx) =>
          recordObservation(tx, context(), observationDraft({ observationCode: 'authorized_obs' })),
        context()
      );
      expect(written.id).toBeTruthy();
    });
  });

  describe('recordHypothesis', () => {
    it('unauthorized caller receives EVIDENCE_CASE_NOT_AUTHORIZED FIRST, never the capability result', async () => {
      const before = await counts(fx.familyId);
      const error = await expectNoWrite(
        runWrite(
          (tx) => recordHypothesis(tx, memberContext(), statementDraft({ content: 'hypothesis' })),
          memberContext()
        )
      );
      expect(error.code).toBe(AUTHORIZED);
      expect(error.code).not.toBe('EVIDENCE_HYPOTHESIS_SOURCE_UNAVAILABLE');
      expect(await counts(fx.familyId)).toEqual(before);
    });

    it('authorized manager still reaches the frozen production-disabled result', async () => {
      const before = await counts(fx.familyId);
      await expectNoWrite(
        runWrite(
          (tx) => recordHypothesis(tx, context(), statementDraft({ content: 'hypothesis' })),
          context()
        ),
        'EVIDENCE_HYPOTHESIS_SOURCE_UNAVAILABLE'
      );
      expect(await counts(fx.familyId)).toEqual(before);
    });
  });

  describe('assignConflictGroup', () => {
    async function seedConflictRefs() {
      const assertion = await admin.query(
        `INSERT INTO assertions
           (family_id, case_id, subject_person_id, source_kind, source_person_id,
            occurred_time_state, confirmation_status, kind, content)
         VALUES ($1, $2, $3, 'SELF_STATEMENT', $3, 'UNKNOWN', 'UNCONFIRMED', 'STATEMENT', 'auth conflict')
         RETURNING id`,
        [fx.familyId, fx.caseId, fx.managerPersonId]
      );
      const observation = await admin.query(
        `INSERT INTO observations
           (family_id, case_id, subject_person_id, source_kind, source_person_id,
            occurred_time_state, confirmation_status, observation_code,
            value_state, value_type, value_text, value_number, value_boolean, unit)
         VALUES ($1, $2, $3, 'GUARDIAN_OBSERVATION', $4, 'UNKNOWN', 'UNCONFIRMED',
                 'auth_conflict_obs', 'UNKNOWN', NULL, NULL, NULL, NULL, NULL)
         RETURNING id`,
        [fx.familyId, fx.caseId, fx.memberPersonId, fx.managerPersonId]
      );
      return {
        assertionId: assertion.rows[0].id as string,
        observationId: observation.rows[0].id as string,
      };
    }

    async function conflictGroups(ids: string[]) {
      const a = await admin.query(
        'SELECT conflict_group_id FROM assertions WHERE id = $1',
        [ids[0]]
      );
      const o = await admin.query(
        'SELECT conflict_group_id FROM observations WHERE id = $1',
        [ids[1]]
      );
      return { assertion: a.rows[0].conflict_group_id, observation: o.rows[0].conflict_group_id };
    }

    it('ordinary member is rejected before any Evidence ref read, with unchanged conflict_group_id', async () => {
      const ids = await seedConflictRefs();
      const beforeGroups = await conflictGroups([ids.assertionId, ids.observationId]);
      const beforeCounts = await counts(fx.familyId);

      await expectNoWrite(
        runWrite(
          (tx) =>
            assignConflictGroup(tx, memberContext(), [
              { kind: 'ASSERTION', id: ids.assertionId },
              { kind: 'OBSERVATION', id: ids.observationId },
            ]),
          memberContext()
        )
      );

      // UPDATE capability: zero mutation is stronger than row-count equality.
      expect(await conflictGroups([ids.assertionId, ids.observationId])).toEqual(beforeGroups);
      expect(await counts(fx.familyId)).toEqual(beforeCounts);
    });

    it('unauthorized caller cannot probe Evidence existence through a different error', async () => {
      const error = await expectNoWrite(
        runWrite(
          (tx) =>
            assignConflictGroup(tx, memberContext(), [
              { kind: 'ASSERTION', id: '00000000-0000-7000-8000-0000000000ee' },
              { kind: 'OBSERVATION', id: '00000000-0000-7000-8000-0000000000ed' },
            ]),
          memberContext()
        )
      );
      expect(error.code).toBe(AUTHORIZED);
      expect(error.code).not.toBe('EVIDENCE_CONFLICT_INVALID');
    });

    it('authorized manager can still assign a conflict group', async () => {
      const ids = await seedConflictRefs();
      const result = await runWrite(
        (tx) =>
          assignConflictGroup(tx, context(), [
            { kind: 'ASSERTION', id: ids.assertionId },
            { kind: 'OBSERVATION', id: ids.observationId },
          ]),
        context()
      );
      expect(result.conflictGroupId).toBeTruthy();
    });
  });

  describe('UFA-001 — transaction identity binding', () => {
    it('rejects a real manager writer context when the actual transaction actor is an ordinary member for all four capabilities', async () => {
      const claimedManager = context();
      const actualMember = memberContext();

      const beforeStatement = await counts(fx.familyId);
      await expectNoWrite(
        runWrite(
          (tx) => recordStatement(tx, claimedManager, statementDraft({ content: 'ufa001 spoof statement' })),
          actualMember
        )
      );
      expect(await counts(fx.familyId)).toEqual(beforeStatement);

      const beforeObservation = await counts(fx.familyId);
      await expectNoWrite(
        runWrite(
          (tx) => recordObservation(
            tx,
            claimedManager,
            observationDraft({ observationCode: 'ufa001_spoof_observation' })
          ),
          actualMember
        )
      );
      expect(await counts(fx.familyId)).toEqual(beforeObservation);

      const beforeHypothesis = await counts(fx.familyId);
      const hypothesisError = await expectNoWrite(
        runWrite(
          (tx) => recordHypothesis(
            tx,
            claimedManager,
            statementDraft({ content: 'ufa001 spoof hypothesis' })
          ),
          actualMember
        )
      );
      expect(hypothesisError.code).toBe('EVIDENCE_CASE_NOT_AUTHORIZED');
      expect(hypothesisError.code).not.toBe('EVIDENCE_HYPOTHESIS_SOURCE_UNAVAILABLE');
      expect(await counts(fx.familyId)).toEqual(beforeHypothesis);

      const refs = await seedConflictRowsForOrdering();
      const beforeConflictCounts = await counts(fx.familyId);
      const beforeAssertion = await admin.query(
        'SELECT conflict_group_id FROM assertions WHERE id = $1',
        [refs.assertionId]
      );
      const beforeObservationRef = await admin.query(
        'SELECT conflict_group_id FROM observations WHERE id = $1',
        [refs.observationId]
      );

      await expectNoWrite(
        runWrite(
          (tx) =>
            assignConflictGroup(tx, claimedManager, [
              { kind: 'ASSERTION', id: refs.assertionId },
              { kind: 'OBSERVATION', id: refs.observationId },
            ]),
          actualMember
        )
      );

      const afterAssertion = await admin.query(
        'SELECT conflict_group_id FROM assertions WHERE id = $1',
        [refs.assertionId]
      );
      const afterObservationRef = await admin.query(
        'SELECT conflict_group_id FROM observations WHERE id = $1',
        [refs.observationId]
      );
      expect(afterAssertion.rows[0].conflict_group_id).toBe(
        beforeAssertion.rows[0].conflict_group_id
      );
      expect(afterObservationRef.rows[0].conflict_group_id).toBe(
        beforeObservationRef.rows[0].conflict_group_id
      );
      expect(await counts(fx.familyId)).toEqual(beforeConflictCounts);
    });

    it('withRlsTransaction rejects account/person splicing before family context is established', async () => {
      let callbackReached = false;
      let error: any = null;
      try {
        await withRlsTransaction(
          pool,
          {
            familyId: fx.familyId,
            accountId: fx.memberAccountId,
            personId: fx.managerPersonId,
            purpose: 'FAMILY_MANAGEMENT',
          },
          async () => {
            callbackReached = true;
          }
        );
      } catch (err) {
        error = err;
      }

      expect(callbackReached).toBe(false);
      expect(error).not.toBeNull();
      expect(error.code).toBe('42501');
    });
  });

  describe('authorization-before-sensitive-read ordering', () => {
    it('no unauthorized capability reads Evidence / source-message / compliance data', async () => {
      const ids = await seedConflictRowsForOrdering();

      const probes: Array<{ label: string; run: (tx: pg.PoolClient) => Promise<unknown> }> = [
        {
          label: 'recordStatement',
          run: (tx) => recordStatement(tx, memberContext(), statementDraft()),
        },
        {
          label: 'recordObservation',
          run: (tx) => recordObservation(tx, memberContext(), observationDraft()),
        },
        {
          label: 'recordHypothesis',
          run: (tx) => recordHypothesis(tx, memberContext(), statementDraft()),
        },
        {
          label: 'assignConflictGroup',
          run: (tx) =>
            assignConflictGroup(tx, memberContext(), [
              { kind: 'ASSERTION', id: ids.assertionId },
              { kind: 'OBSERVATION', id: ids.observationId },
            ]),
        },
      ];

      for (const probe of probes) {
        const statements: string[] = [];
        await expectNoWrite(
          runWrite((tx) => probe.run(recordingTx(tx, statements)), memberContext())
        );
        const sensitive = statements.filter((sql) => SENSITIVE_READ.test(sql));
        expect(sensitive, `${probe.label} performed a sensitive read before authorization`).toEqual(
          []
        );
      }
    });
  });
});

async function seedConflictRowsForOrdering(): Promise<{
  assertionId: string;
  observationId: string;
}> {
  const assertion = await admin.query(
    `INSERT INTO assertions
       (family_id, case_id, subject_person_id, source_kind, source_person_id,
        occurred_time_state, confirmation_status, kind, content)
     VALUES ($1, $2, $3, 'SELF_STATEMENT', $3, 'UNKNOWN', 'UNCONFIRMED', 'STATEMENT', 'ordering probe')
     RETURNING id`,
    [fx.familyId, fx.caseId, fx.managerPersonId]
  );
  const observation = await admin.query(
    `INSERT INTO observations
       (family_id, case_id, subject_person_id, source_kind, source_person_id,
        occurred_time_state, confirmation_status, observation_code,
        value_state, value_type, value_text, value_number, value_boolean, unit)
     VALUES ($1, $2, $3, 'GUARDIAN_OBSERVATION', $4, 'UNKNOWN', 'UNCONFIRMED',
             'ordering_obs', 'UNKNOWN', NULL, NULL, NULL, NULL, NULL)
     RETURNING id`,
    [fx.familyId, fx.caseId, fx.memberPersonId, fx.managerPersonId]
  );
  return {
    assertionId: assertion.rows[0].id as string,
    observationId: observation.rows[0].id as string,
  };
}

async function seed(client: pg.Client): Promise<Fixture> {
  const suffix = `${Date.now()}_${Math.floor(Math.random() * 1e6)}`;

  const makeFamily = async (key: string) => {
    const { rows: acc } = await client.query(
      `INSERT INTO accounts (wechat_openid) VALUES ($1) RETURNING id`,
      [`t068_${key}_${suffix}`]
    );
    const { rows: person } = await client.query(
      `INSERT INTO persons (account_id, created_by_account_id) VALUES ($1, $1) RETURNING id`,
      [acc[0].id]
    );
    const { rows: fam } = await client.query(
      `INSERT INTO families (display_name, created_by_person_id) VALUES ($1, $2) RETURNING id`,
      [`t068-${key}`, person[0].id]
    );
    await client.query('INSERT INTO family_members (family_id, person_id) VALUES ($1, $2)', [
      fam[0].id,
      person[0].id,
    ]);
    await client.query(
      `INSERT INTO person_compliance_profiles (person_id, age_band, minor_mode, verified_source)
       VALUES ($1, 'ADULT', false, 'SELF_STATEMENT')`,
      [person[0].id]
    );
    const { rows: kase } = await client.query(
      `INSERT INTO cases (family_id, created_by_person_id, status, phase, is_primary, version)
       VALUES ($1, $2, 'OPEN', 'INTAKE', true, 1) RETURNING id`,
      [fam[0].id, person[0].id]
    );
    return {
      accountId: acc[0].id as string,
      personId: person[0].id as string,
      familyId: fam[0].id as string,
      caseId: kase[0].id as string,
    };
  };

  const a = await makeFamily('a');
  const b = await makeFamily('b');

  const { rows: memberAcc } = await client.query(
    `INSERT INTO accounts (wechat_openid) VALUES ($1) RETURNING id`,
    [`t068_member_${suffix}`]
  );
  const { rows: memberPerson } = await client.query(
    `INSERT INTO persons (account_id, created_by_account_id) VALUES ($1, $1) RETURNING id`,
    [memberAcc[0].id]
  );
  await client.query('INSERT INTO family_members (family_id, person_id) VALUES ($1, $2)', [
    a.familyId,
    memberPerson[0].id,
  ]);
  await client.query(
    `INSERT INTO person_compliance_profiles (person_id, age_band, minor_mode, verified_source)
     VALUES ($1, 'ADULT', false, 'SELF_STATEMENT')`,
    [memberPerson[0].id]
  );

  const { rows: childPerson } = await client.query(
    'INSERT INTO persons (created_by_account_id) VALUES ($1) RETURNING id',
    [a.accountId]
  );
  await client.query('INSERT INTO family_members (family_id, person_id) VALUES ($1, $2)', [
    a.familyId,
    childPerson[0].id,
  ]);
  await client.query(
    `INSERT INTO person_compliance_profiles
       (person_id, age_band, minor_mode, guardian_person_id, verified_source)
     VALUES ($1, 'MINOR_14_17', true, $2, 'GUARDIAN_OBSERVATION')`,
    [childPerson[0].id, a.personId]
  );

  return {
    familyId: a.familyId,
    caseId: a.caseId,
    accountId: a.accountId,
    managerPersonId: a.personId,
    memberAccountId: memberAcc[0].id,
    memberPersonId: memberPerson[0].id,
    childPersonId: childPerson[0].id,
    familyB: b.familyId,
    caseB: b.caseId,
    managerB: b.personId,
    accountB: b.accountId,
  };
}

async function cleanup(client: pg.Client) {
  try {
    await client.query(
      `DELETE FROM assertions WHERE family_id IN (SELECT id FROM families WHERE display_name LIKE 't068-%')`
    );
    await client.query(
      `DELETE FROM observations WHERE family_id IN (SELECT id FROM families WHERE display_name LIKE 't068-%')`
    );
    await client.query(
      `DELETE FROM business_audit_events WHERE family_id IN (SELECT id FROM families WHERE display_name LIKE 't068-%')`
    );
    await client.query(
      `DELETE FROM cases WHERE family_id IN (SELECT id FROM families WHERE display_name LIKE 't068-%')`
    );
    await client.query(
      `DELETE FROM person_compliance_profiles WHERE person_id IN (
         SELECT person_id FROM family_members WHERE family_id IN (
           SELECT id FROM families WHERE display_name LIKE 't068-%'))`
    );
    await client.query(
      `DELETE FROM family_members WHERE family_id IN (SELECT id FROM families WHERE display_name LIKE 't068-%')`
    );
    await client.query(`DELETE FROM families WHERE display_name LIKE 't068-%'`);
    await client.query(
      `DELETE FROM persons WHERE created_by_account_id IN (
         SELECT id FROM accounts WHERE wechat_openid LIKE 't068\\_%')`
    );
    await client.query(`DELETE FROM accounts WHERE wechat_openid LIKE 't068\\_%'`);
  } catch {
    // best-effort cleanup
  }
}