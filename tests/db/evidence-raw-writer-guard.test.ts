/**
 * ULT-001 (B) — raw repository writer fail-closed defence-in-depth.
 *
 * Closing the package `exports` subpaths is the first line of defence. The raw
 * repository writers must also refuse the frozen-disabled provenance sources /
 * writer compositions when reached directly (relative source import, in-package
 * caller, test helper).
 *
 * FACT is deliberately NOT judged at this layer: it stays rejected by the
 * database hard guard (`assertions_insert ... kind <> 'FACT'`).
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import {
  insertEvidenceAssertion,
  insertEvidenceObservation,
} from '../../packages/domain/src/repository.js';

const ADMIN_URL = process.env['TEST_ADMIN_DATABASE_URL']!;
const APP_URL = process.env['DATABASE_URL']!;

interface Fixture {
  familyId: string;
  caseId: string;
  actorPersonId: string;
  subjectPersonId: string;
  otherMemberPersonId: string;
  outsiderPersonId: string;
  accountId: string;
}

const DISABLED_SOURCES = [
  'AI_HYPOTHESIS',
  'MANUAL_DEVICE_DATA',
  'STAFF_RECORD',
  'SOURCE_CONFIRMED',
] as const;

const NON_OBSERVATION_SOURCES = [
  'SELF_STATEMENT',
  'GUARDIAN_RELAY',
  'OTHER_MEMBER_RELAY',
] as const;

let admin: pg.Client;
let app: pg.Pool;
let fx: Fixture;

async function withContext<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await app.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT app.set_identity_context($1, $2)', [
      fx.accountId,
      'FAMILY_MANAGEMENT',
    ]);
    await client.query('SELECT app.set_family_context($1, $2, $3)', [
      fx.familyId,
      fx.actorPersonId,
      'FAMILY_MANAGEMENT',
    ]);
    return await fn(client);
  } finally {
    await client.query('ROLLBACK').catch(() => {});
    client.release();
  }
}

async function rowCounts() {
  const { rows } = await admin.query(
    `SELECT
       (SELECT count(*)::int FROM assertions WHERE family_id = $1) AS assertions,
       (SELECT count(*)::int FROM observations WHERE family_id = $1) AS observations,
       (SELECT count(*)::int FROM business_audit_events WHERE family_id = $1) AS audits`,
    [fx.familyId]
  );
  return rows[0] as { assertions: number; observations: number; audits: number };
}

function assertionRow(
  sourceKind: string,
  overrides: Partial<{
    subjectPersonId: string | null;
    sourcePersonId: string | null;
    kind: 'STATEMENT' | 'HYPOTHESIS' | 'FACT';
    sourceMessageId: string | null;
  }> = {}
) {
  return {
    familyId: fx.familyId,
    caseId: fx.caseId,
    subjectPersonId: fx.subjectPersonId,
    sourceKind,
    sourcePersonId: fx.subjectPersonId,
    sourceMessageId: null,
    occurredTimeState: 'UNKNOWN',
    occurredAt: null,
    validFrom: null,
    validUntil: null,
    confirmationStatus: 'UNCONFIRMED',
    supersedesId: null,
    kind: 'STATEMENT',
    content: 'raw writer guard probe',
    ...overrides,
  };
}

function observationRow(
  sourceKind: string,
  overrides: Partial<{
    subjectPersonId: string | null;
    sourcePersonId: string | null;
    sourceMessageId: string | null;
  }> = {}
) {
  return {
    familyId: fx.familyId,
    caseId: fx.caseId,
    subjectPersonId: fx.subjectPersonId,
    sourceKind,
    sourcePersonId: fx.actorPersonId,
    sourceMessageId: null,
    occurredTimeState: 'UNKNOWN',
    occurredAt: null,
    validFrom: null,
    validUntil: null,
    confirmationStatus: 'UNCONFIRMED',
    supersedesId: null,
    observationCode: 'raw.guard.probe',
    valueState: 'UNKNOWN',
    valueType: null,
    valueText: null,
    valueNumber: null,
    valueBoolean: null,
    unit: null,
    ...overrides,
  };
}

function expectNoRowsAdded(
  before: { assertions: number; observations: number; audits: number },
  after: { assertions: number; observations: number; audits: number }
) {
  expect(after.assertions).toBe(before.assertions);
  expect(after.observations).toBe(before.observations);
  expect(after.audits).toBe(before.audits);
}

describe('ULT-001 raw Evidence writer fail-closed', () => {
  beforeAll(async () => {
    admin = new pg.Client({ connectionString: ADMIN_URL });
    await admin.connect();
    app = new pg.Pool({ connectionString: APP_URL, max: 4 });
    fx = await seed(admin);
  });

  afterAll(async () => {
    await cleanup(admin);
    await app.end();
    await admin.end();
  });

  it('refuses frozen-disabled provenance and HYPOTHESIS with evidence/audit rows +0', async () => {
    const before = await rowCounts();

    for (const sourceKind of DISABLED_SOURCES) {
      await withContext(async (client) => {
        await expect(
          insertEvidenceAssertion(client, assertionRow(sourceKind) as any),
          'assertion ' + sourceKind
        ).rejects.toMatchObject({ code: 'EVIDENCE_PROVENANCE_INVALID' });
      });
      await withContext(async (client) => {
        await expect(
          insertEvidenceObservation(client, observationRow(sourceKind) as any),
          'observation ' + sourceKind
        ).rejects.toMatchObject({ code: 'EVIDENCE_PROVENANCE_INVALID' });
      });
    }

    await withContext(async (client) => {
      await expect(
        insertEvidenceAssertion(
          client,
          assertionRow('AI_HYPOTHESIS', { kind: 'HYPOTHESIS' }) as any
        )
      ).rejects.toMatchObject({ code: 'EVIDENCE_HYPOTHESIS_SOURCE_UNAVAILABLE' });
    });

    expectNoRowsAdded(before, await rowCounts());
  });

  it('refuses every frozen source/subject/guardian relation bypass with rows +0', async () => {
    const before = await rowCounts();

    const illegalAssertions = [
      {
        label: 'STATEMENT + GUARDIAN_OBSERVATION',
        row: assertionRow('GUARDIAN_OBSERVATION', {
          sourcePersonId: fx.actorPersonId,
        }),
      },
      {
        label: 'SELF_STATEMENT source != subject',
        row: assertionRow('SELF_STATEMENT', {
          sourcePersonId: fx.actorPersonId,
        }),
      },
      {
        label: 'SELF_STATEMENT source missing',
        row: assertionRow('SELF_STATEMENT', {
          sourcePersonId: null,
        }),
      },
      {
        label: 'GUARDIAN_RELAY source == subject',
        row: assertionRow('GUARDIAN_RELAY', {
          sourcePersonId: fx.subjectPersonId,
        }),
      },
      {
        label: 'GUARDIAN_RELAY source is not real guardian',
        row: assertionRow('GUARDIAN_RELAY', {
          sourcePersonId: fx.otherMemberPersonId,
        }),
      },
      {
        label: 'OTHER_MEMBER_RELAY source == subject',
        row: assertionRow('OTHER_MEMBER_RELAY', {
          sourcePersonId: fx.subjectPersonId,
        }),
      },
      {
        label: 'OTHER_MEMBER_RELAY source outside Family',
        row: assertionRow('OTHER_MEMBER_RELAY', {
          sourcePersonId: fx.outsiderPersonId,
        }),
      },
    ];

    for (const probe of illegalAssertions) {
      await withContext(async (client) => {
        await expect(
          insertEvidenceAssertion(client, probe.row as any),
          probe.label
        ).rejects.toMatchObject({ code: 'EVIDENCE_PROVENANCE_INVALID' });
      });
    }

    const illegalObservations = [
      {
        label: 'GUARDIAN_OBSERVATION subject missing',
        row: observationRow('GUARDIAN_OBSERVATION', {
          subjectPersonId: null,
        }),
      },
      {
        label: 'GUARDIAN_OBSERVATION source == subject',
        row: observationRow('GUARDIAN_OBSERVATION', {
          sourcePersonId: fx.subjectPersonId,
        }),
      },
      {
        label: 'GUARDIAN_OBSERVATION source is not real guardian',
        row: observationRow('GUARDIAN_OBSERVATION', {
          sourcePersonId: fx.otherMemberPersonId,
        }),
      },
    ];

    for (const probe of illegalObservations) {
      await withContext(async (client) => {
        await expect(
          insertEvidenceObservation(client, probe.row as any),
          probe.label
        ).rejects.toMatchObject({ code: 'EVIDENCE_PROVENANCE_INVALID' });
      });
    }

    for (const sourceKind of NON_OBSERVATION_SOURCES) {
      await withContext(async (client) => {
        await expect(
          insertEvidenceObservation(client, observationRow(sourceKind) as any),
          'observation + ' + sourceKind
        ).rejects.toMatchObject({ code: 'EVIDENCE_PROVENANCE_INVALID' });
      });
    }

    expectNoRowsAdded(before, await rowCounts());
  });

  it('binds raw source_message_id to the same Family, Case and source Person', async () => {
    const before = await rowCounts();

    const { rows: otherCase } = await admin.query(
      `INSERT INTO cases (family_id, created_by_person_id, status, phase, is_primary, version)
       VALUES ($1, $2, 'OPEN', 'INTAKE', false, 1) RETURNING id`,
      [fx.familyId, fx.actorPersonId]
    );
    const { rows: otherFamily } = await admin.query(
      `INSERT INTO families (display_name, created_by_person_id)
       VALUES ('t_ult001_wrong_family', $1) RETURNING id`,
      [fx.actorPersonId]
    );
    await admin.query(
      'INSERT INTO family_members (family_id, person_id) VALUES ($1, $2)',
      [otherFamily[0].id, fx.actorPersonId]
    );
    const { rows: otherFamilyCase } = await admin.query(
      `INSERT INTO cases (family_id, created_by_person_id, status, phase, is_primary, version)
       VALUES ($1, $2, 'OPEN', 'INTAKE', true, 1) RETURNING id`,
      [otherFamily[0].id, fx.actorPersonId]
    );

    const makeMessage = async (
      familyId: string,
      caseId: string,
      sourcePersonId: string,
      content: string
    ) => {
      const { rows } = await admin.query(
        `INSERT INTO dialogue_messages
           (family_id, case_id, actor_account_id, source_person_id, content)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [familyId, caseId, fx.accountId, sourcePersonId, content]
      );
      return rows[0].id as string;
    };

    const correct = await makeMessage(fx.familyId, fx.caseId, fx.actorPersonId, 'raw correct');
    const wrongSource = await makeMessage(
      fx.familyId, fx.caseId, fx.otherMemberPersonId, 'raw wrong source'
    );
    const wrongCase = await makeMessage(
      fx.familyId, otherCase[0].id, fx.actorPersonId, 'raw wrong case'
    );
    const wrongFamily = await makeMessage(
      otherFamily[0].id, otherFamilyCase[0].id, fx.actorPersonId, 'raw wrong family'
    );
    const missing = '00000000-0000-7000-8000-000000000001';

    for (const [label, sourceMessageId] of [
      ['wrong source Person', wrongSource],
      ['wrong Case', wrongCase],
      ['wrong Family', wrongFamily],
      ['missing message', missing],
    ] as const) {
      await withContext(async (client) => {
        await expect(
          insertEvidenceAssertion(
            client,
            assertionRow('GUARDIAN_RELAY', {
              sourcePersonId: fx.actorPersonId,
              sourceMessageId,
            }) as any
          ),
          'assertion ' + label
        ).rejects.toMatchObject({ code: 'EVIDENCE_PERSON_REFERENCE_INVALID' });
      });
      await withContext(async (client) => {
        await expect(
          insertEvidenceObservation(
            client,
            observationRow('GUARDIAN_OBSERVATION', {
              sourcePersonId: fx.actorPersonId,
              sourceMessageId,
            }) as any
          ),
          'observation ' + label
        ).rejects.toMatchObject({ code: 'EVIDENCE_PERSON_REFERENCE_INVALID' });
      });
    }

    await withContext(async (client) => {
      expect((await insertEvidenceAssertion(
        client,
        assertionRow('GUARDIAN_RELAY', {
          sourcePersonId: fx.actorPersonId,
          sourceMessageId: correct,
        }) as any
      )).id).toBeTruthy();
    });
    await withContext(async (client) => {
      expect((await insertEvidenceObservation(
        client,
        observationRow('GUARDIAN_OBSERVATION', {
          sourcePersonId: fx.actorPersonId,
          sourceMessageId: correct,
        }) as any
      )).id).toBeTruthy();
    });

    expectNoRowsAdded(before, await rowCounts());
  });

  it('FACT remains rejected by the database hard guard with rows +0', async () => {
    const before = await rowCounts();
    await withContext(async (client) => {
      await expect(
        insertEvidenceAssertion(
          client,
          assertionRow('SELF_STATEMENT', { kind: 'FACT' }) as any
        )
      ).rejects.toThrow(/row-level security|42501/i);
    });
    expectNoRowsAdded(before, await rowCounts());
  });

  it('still admits all four frozen approved provenance combinations', async () => {
    const before = await rowCounts();

    await withContext(async (client) => {
      const selfStatement = await insertEvidenceAssertion(
        client,
        assertionRow('SELF_STATEMENT') as any
      );
      expect(selfStatement.id).toBeTruthy();
    });

    await withContext(async (client) => {
      const guardianRelay = await insertEvidenceAssertion(
        client,
        assertionRow('GUARDIAN_RELAY', {
          sourcePersonId: fx.actorPersonId,
        }) as any
      );
      expect(guardianRelay.id).toBeTruthy();
    });

    await withContext(async (client) => {
      const otherMemberRelay = await insertEvidenceAssertion(
        client,
        assertionRow('OTHER_MEMBER_RELAY', {
          sourcePersonId: fx.otherMemberPersonId,
        }) as any
      );
      expect(otherMemberRelay.id).toBeTruthy();
    });

    await withContext(async (client) => {
      const guardianObservation = await insertEvidenceObservation(
        client,
        observationRow('GUARDIAN_OBSERVATION', {
          sourcePersonId: fx.actorPersonId,
        }) as any
      );
      expect(guardianObservation.id).toBeTruthy();
    });

    // Every successful probe runs inside an explicit rollback transaction.
    expectNoRowsAdded(before, await rowCounts());
  });
});

async function seed(admin: pg.Client): Promise<Fixture> {
  const suffix = String(Date.now()) + '_' + String(Math.floor(Math.random() * 1e6));
  const { rows: acc } = await admin.query(
    `INSERT INTO accounts (wechat_openid) VALUES ($1) RETURNING id`,
    ['t_ult001_' + suffix]
  );
  const accountId = acc[0].id as string;

  const { rows: actor } = await admin.query(
    `INSERT INTO persons (account_id, created_by_account_id) VALUES ($1, $1) RETURNING id`,
    [accountId]
  );
  const actorPersonId = actor[0].id as string;

  const { rows: subject } = await admin.query(
    `INSERT INTO persons (account_id, created_by_account_id) VALUES (NULL, $1) RETURNING id`,
    [accountId]
  );
  const subjectPersonId = subject[0].id as string;

  const { rows: other } = await admin.query(
    `INSERT INTO persons (account_id, created_by_account_id) VALUES (NULL, $1) RETURNING id`,
    [accountId]
  );
  const otherMemberPersonId = other[0].id as string;

  const { rows: outsider } = await admin.query(
    `INSERT INTO persons (account_id, created_by_account_id) VALUES (NULL, $1) RETURNING id`,
    [accountId]
  );
  const outsiderPersonId = outsider[0].id as string;

  const { rows: fam } = await admin.query(
    `INSERT INTO families (display_name, created_by_person_id) VALUES ('t_ult001', $1) RETURNING id`,
    [actorPersonId]
  );
  const familyId = fam[0].id as string;

  for (const personId of [actorPersonId, subjectPersonId, otherMemberPersonId]) {
    await admin.query(
      `INSERT INTO family_members (family_id, person_id) VALUES ($1, $2)`,
      [familyId, personId]
    );
  }

  // Real frozen guardian relation: the source must equal this persisted
  // guardian_person_id for GUARDIAN_RELAY / GUARDIAN_OBSERVATION.
  await admin.query(
    `INSERT INTO person_compliance_profiles
       (person_id, age_band, minor_mode, guardian_person_id,
        guardian_consent_version, guardian_consent_record_id, verified_source)
     VALUES ($1, 'MINOR_14_17', true, $2, NULL, NULL, 'GUARDIAN_RELAY')`,
    [subjectPersonId, actorPersonId]
  );

  const { rows: kase } = await admin.query(
    `INSERT INTO cases (family_id, created_by_person_id, status, phase, is_primary, version)
     VALUES ($1, $2, 'OPEN', 'INTAKE', true, 1) RETURNING id`,
    [familyId, actorPersonId]
  );

  return {
    familyId,
    caseId: kase[0].id as string,
    actorPersonId,
    subjectPersonId,
    otherMemberPersonId,
    outsiderPersonId,
    accountId,
  };
}

async function cleanup(admin: pg.Client) {
  try {
    await admin.query(
      `DELETE FROM assertions WHERE family_id IN (SELECT id FROM families WHERE display_name LIKE 't_ult001%')`
    );
    await admin.query(
      `DELETE FROM observations WHERE family_id IN (SELECT id FROM families WHERE display_name LIKE 't_ult001%')`
    );
    await admin.query(
      `DELETE FROM dialogue_messages WHERE family_id IN (SELECT id FROM families WHERE display_name LIKE 't_ult001%')`
    );
    await admin.query(
      `DELETE FROM business_audit_events WHERE family_id IN (SELECT id FROM families WHERE display_name LIKE 't_ult001%')`
    );
    await admin.query(
      `DELETE FROM cases WHERE family_id IN (SELECT id FROM families WHERE display_name LIKE 't_ult001%')`
    );
    await admin.query(
      `DELETE FROM family_members WHERE family_id IN (SELECT id FROM families WHERE display_name LIKE 't_ult001%')`
    );
    await admin.query(`DELETE FROM families WHERE display_name LIKE 't_ult001%'`);
    await admin.query(
      `DELETE FROM person_compliance_profiles
       WHERE person_id IN (
         SELECT id FROM persons WHERE created_by_account_id IN (
           SELECT id FROM accounts WHERE wechat_openid LIKE 't\\_ult001\\_%'
         )
       )`
    );
    await admin.query(
      `DELETE FROM persons WHERE created_by_account_id IN (
         SELECT id FROM accounts WHERE wechat_openid LIKE 't\\_ult001\\_%')`
    );
    await admin.query(`DELETE FROM accounts WHERE wechat_openid LIKE 't\\_ult001\\_%'`);
  } catch {
    // best-effort cleanup
  }
}