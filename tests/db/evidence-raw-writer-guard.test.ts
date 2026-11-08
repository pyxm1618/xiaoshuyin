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
  personId: string;
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
      fx.personId,
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
       (SELECT count(*)::int FROM observations WHERE family_id = $1) AS observations`,
    [fx.familyId]
  );
  return rows[0] as { assertions: number; observations: number };
}

function assertionRow(sourceKind: string, kind: 'STATEMENT' | 'HYPOTHESIS' = 'STATEMENT') {
  return {
    familyId: fx.familyId,
    caseId: fx.caseId,
    subjectPersonId: fx.personId,
    sourceKind,
    sourcePersonId: fx.personId,
    sourceMessageId: null,
    occurredTimeState: 'UNKNOWN',
    occurredAt: null,
    validFrom: null,
    validUntil: null,
    confirmationStatus: 'UNCONFIRMED',
    supersedesId: null,
    kind,
    content: 'raw writer guard probe',
  };
}

function observationRow(sourceKind: string) {
  return {
    familyId: fx.familyId,
    caseId: fx.caseId,
    subjectPersonId: fx.personId,
    sourceKind,
    sourcePersonId: fx.personId,
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
  };
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

  it('raw assertion writer refuses every frozen-disabled provenance source', async () => {
    const before = await rowCounts();
    for (const sourceKind of DISABLED_SOURCES) {
      await withContext(async (client) => {
        await expect(
          insertEvidenceAssertion(client, assertionRow(sourceKind) as any),
          sourceKind
        ).rejects.toMatchObject({ code: 'EVIDENCE_PROVENANCE_INVALID' });
      });
    }
    const after = await rowCounts();
    expect(after.assertions).toBe(before.assertions);
  });

  it('raw assertion writer refuses HYPOTHESIS (no admissible hypothesis source)', async () => {
    const before = await rowCounts();
    await withContext(async (client) => {
      await expect(
        insertEvidenceAssertion(client, assertionRow('AI_HYPOTHESIS', 'HYPOTHESIS') as any)
      ).rejects.toMatchObject({ code: 'EVIDENCE_HYPOTHESIS_SOURCE_UNAVAILABLE' });
    });
    const after = await rowCounts();
    expect(after.assertions).toBe(before.assertions);
  });

  it('raw observation writer refuses every frozen-disabled provenance source', async () => {
    const before = await rowCounts();
    for (const sourceKind of DISABLED_SOURCES) {
      await withContext(async (client) => {
        await expect(
          insertEvidenceObservation(client, observationRow(sourceKind) as any),
          sourceKind
        ).rejects.toMatchObject({ code: 'EVIDENCE_PROVENANCE_INVALID' });
      });
    }
    const after = await rowCounts();
    expect(after.observations).toBe(before.observations);
  });

  it('raw observation writer refuses non-observation writer compositions', async () => {
    const before = await rowCounts();
    for (const sourceKind of NON_OBSERVATION_SOURCES) {
      await withContext(async (client) => {
        await expect(
          insertEvidenceObservation(client, observationRow(sourceKind) as any),
          sourceKind
        ).rejects.toMatchObject({ code: 'EVIDENCE_PROVENANCE_INVALID' });
      });
    }
    const after = await rowCounts();
    expect(after.observations).toBe(before.observations);
  });

  it('FACT is still rejected by the database hard guard, not relabelled', async () => {
    const before = await rowCounts();
    await withContext(async (client) => {
      // The application guard intentionally lets FACT reach the database.
      await expect(
        insertEvidenceAssertion(client, assertionRow('SELF_STATEMENT', 'FACT' as any) as any)
      ).rejects.toThrow(/row-level security|42501/i);
    });
    const after = await rowCounts();
    expect(after.assertions).toBe(before.assertions);
  });

  it('still admits the frozen-writable provenance combinations', async () => {
    const before = await rowCounts();
    await withContext(async (client) => {
      const assertion = await insertEvidenceAssertion(
        client,
        assertionRow('SELF_STATEMENT') as any
      );
      expect(assertion.id).toBeTruthy();

      const observation = await insertEvidenceObservation(
        client,
        observationRow('GUARDIAN_OBSERVATION') as any
      );
      expect(observation.id).toBeTruthy();
    });
    const after = await rowCounts();
    // Both inserts were rolled back with the fixture transaction.
    expect(after.assertions).toBe(before.assertions);
    expect(after.observations).toBe(before.observations);
  });
});

async function seed(admin: pg.Client): Promise<Fixture> {
  const suffix = `${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
  const { rows: acc } = await admin.query(
    `INSERT INTO accounts (wechat_openid) VALUES ($1) RETURNING id`,
    [`t_ult001_${suffix}`]
  );
  const accountId = acc[0].id;
  const { rows: person } = await admin.query(
    `INSERT INTO persons (account_id, created_by_account_id) VALUES ($1, $1) RETURNING id`,
    [accountId]
  );
  const personId = person[0].id;
  const { rows: fam } = await admin.query(
    `INSERT INTO families (display_name, created_by_person_id) VALUES ('t_ult001', $1) RETURNING id`,
    [personId]
  );
  const familyId = fam[0].id;
  await admin.query(`INSERT INTO family_members (family_id, person_id) VALUES ($1, $2)`, [
    familyId,
    personId,
  ]);
  const { rows: c } = await admin.query(
    `INSERT INTO cases (family_id, created_by_person_id, status, phase, is_primary, version)
     VALUES ($1, $2, 'OPEN', 'INTAKE', true, 1) RETURNING id`,
    [familyId, personId]
  );
  return { familyId, caseId: c[0].id, personId, accountId };
}

async function cleanup(admin: pg.Client) {
  try {
    await admin.query(
      `DELETE FROM assertions WHERE family_id IN (SELECT id FROM families WHERE display_name = 't_ult001')`
    );
    await admin.query(
      `DELETE FROM observations WHERE family_id IN (SELECT id FROM families WHERE display_name = 't_ult001')`
    );
    await admin.query(
      `DELETE FROM dialogue_messages WHERE family_id IN (SELECT id FROM families WHERE display_name = 't_ult001')`
    );
    await admin.query(
      `DELETE FROM cases WHERE family_id IN (SELECT id FROM families WHERE display_name = 't_ult001')`
    );
    await admin.query(
      `DELETE FROM family_members WHERE family_id IN (SELECT id FROM families WHERE display_name = 't_ult001')`
    );
    await admin.query(`DELETE FROM families WHERE display_name = 't_ult001'`);
    await admin.query(
      `DELETE FROM persons WHERE created_by_account_id IN (
         SELECT id FROM accounts WHERE wechat_openid LIKE 't\\_ult001\\_%')`
    );
    await admin.query(`DELETE FROM accounts WHERE wechat_openid LIKE 't\\_ult001\\_%'`);
  } catch {
    // best-effort cleanup
  }
}