/**
 * Audit 2 — HIGH-02: Authorization composition boundary.
 *
 * Proves that the server-side composition runs the existing `authorize()` BEFORE
 * compliance inside one RLS transaction, that Compliance ALLOW never overrides
 * an Authorization DENY, that a Compliance BLOCK never mutates the authorization
 * decision, that authorization fact-query failures propagate, and that a denied
 * caller receives no compliance provenance (no new enumeration oracle).
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { buildApp } from '../../apps/server/api/src/app.js';
import { decideFamilyAction } from '../../apps/server/api/src/authz.js';
import { isKnownAuthorizationDenial } from '../../apps/server/api/src/authz.js';
import { evaluateAuthorizedCompliance } from '../../apps/server/api/src/compliance/evaluate-compliance.js';
import { createAdminPool } from '../setup/db.js';
import { createSafetyFixture, type SafetyFixture } from '../setup/safety.js';
import {
  createServerFeatureDescriptor,
  type ComplianceObligation,
} from '@xiaoshuyin/compliance';

const PREFIX = `S10AUTH_${Date.now()}_`;
const SUPPORTED: readonly ComplianceObligation[] = [
  'REQUIRE_GUARDIAN_CONSENT',
  'REQUIRE_SEPARATE_CONSENT',
  'REQUIRE_MINOR_MODE',
  'REQUIRE_AI_DISCLOSURE',
  'REQUIRE_GENERATED_CONTENT_LABEL',
  'REQUIRE_USAGE_REMINDER',
  'REQUIRE_REGULATORY_EVIDENCE',
];

function featureCode(suffix: string): string {
  return `${PREFIX}${suffix}`.toUpperCase().replace(/[^A-Z0-9_]/g, '_').slice(0, 120);
}

describe('authorized compliance composition (Audit 2 HIGH-02)', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let admin: pg.Pool;
  let pool: pg.Pool;
  let fixture: SafetyFixture;
  let owner: { token: string; accountId: string; personId: string };
  let familyId: string;
  let participant: { accountId: string; personId: string };
  let migrator: pg.Client;

  function descriptor(code: string) {
    return createServerFeatureDescriptor({
      featureCode: code,
      featureContractRevision: 'v1',
      capabilityLabel: 'Authorization composition capability',
    });
  }

  async function publish(code: string, applicability: 'REQUIRED' | 'NOT_APPLICABLE' | 'UNKNOWN') {
    const result = await migrator.query<{ id: string }>(
      `SELECT app.publish_compliance_feature_policy(
         $1,'v1',NULL,1,$2,'BASELINE','BASELINE','BASELINE','BASELINE',$3,$4,$5,'migration:authz'
       ) AS id`,
      [
        code,
        applicability,
        applicability === 'UNKNOWN' ? null : 'reviewed basis',
        applicability === 'UNKNOWN' ? null : 'evidence://authz',
        new Date(Date.now() - 60_000),
      ]
    );
    return result.rows[0]!.id;
  }

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
    admin = createAdminPool();
    fixture = createSafetyFixture({ app, admin, prefix: PREFIX });
    owner = await fixture.login('owner');
    familyId = await fixture.createFamily(owner, 'authz');

    // A family member who is NOT the family manager.
    const account = await admin.query<{ id: string }>(
      `INSERT INTO accounts (wechat_openid) VALUES ($1) RETURNING id`,
      [`${PREFIX}participant_account`]
    );
    const accountId = account.rows[0]!.id;
    const person = await admin.query<{ id: string }>(
      `INSERT INTO persons (account_id, created_by_account_id) VALUES ($1, $2) RETURNING id`,
      [accountId, owner.accountId]
    );
    const personId = person.rows[0]!.id;
    await admin.query(`INSERT INTO family_members (family_id, person_id) VALUES ($1,$2)`, [
      familyId,
      personId,
    ]);
    await admin.query(
      `INSERT INTO person_compliance_profiles (person_id, age_band, minor_mode, verified_source)
       VALUES ($1,'ADULT',false,'SELF_STATEMENT')`,
      [personId]
    );
    participant = { accountId, personId };

    pool = new pg.Pool({ connectionString: process.env['DATABASE_URL'], max: 3 });
    migrator = new pg.Client({ connectionString: process.env['MIGRATION_DATABASE_URL'] });
    await migrator.connect();
  }, 120_000);

  afterAll(async () => {
    await admin
      ?.query(`DELETE FROM compliance_feature_policies WHERE feature_code LIKE '${PREFIX}%'`)
      .catch(() => undefined);
    if (participant) {
      await admin
        ?.query(`DELETE FROM person_compliance_profiles WHERE person_id = $1`, [
          participant.personId,
        ])
        .catch(() => undefined);
      await admin
        ?.query(`DELETE FROM family_members WHERE person_id = $1`, [participant.personId])
        .catch(() => undefined);
      await admin?.query(`DELETE FROM persons WHERE id = $1`, [participant.personId]).catch(() => undefined);
      await admin?.query(`DELETE FROM accounts WHERE id = $1`, [participant.accountId]).catch(() => undefined);
    }
    await migrator?.end().catch(() => undefined);
    await fixture?.cleanup();
    await fixture?.close();
    await pool?.end().catch(() => undefined);
    await admin?.end().catch(() => undefined);
    await app?.close();
  }, 120_000);

  it('Authorization ALLOW + Compliance ALLOW allows the downstream effect', async () => {
    const code = featureCode('ALLOW_ALLOW');
    await publish(code, 'NOT_APPLICABLE');

    const decision = await evaluateAuthorizedCompliance(pool, {
      actor: owner,
      familyId,
      authorization: {
        action: 'MEMBER_UPDATE',
        purpose: 'FAMILY_MANAGEMENT',
        resource: { type: 'MEMBER', familyId, personId: participant.personId },
      },
      descriptor: descriptor(code),
      targetPersonId: participant.personId,
      supportedObligations: SUPPORTED,
    });

    expect(decision.decision).toBe('COMPLIANCE_EVALUATED');
    expect(decision.authorization).toBe('ALLOW');
    expect(decision.downstreamAllowed).toBe(true);
    if (decision.decision === 'COMPLIANCE_EVALUATED') {
      expect(decision.compliance.gate).toBe('ALLOW');
    }
  });

  it('Authorization DENY + otherwise-ALLOW compliance keeps the downstream effect blocked', async () => {
    const code = featureCode('DENY_ALLOW');
    await publish(code, 'NOT_APPLICABLE');

    // The same feature/person would evaluate ALLOW, but this actor is only a
    // Family member and MEMBER_UPDATE is manager-only.
    const decision = await evaluateAuthorizedCompliance(pool, {
      actor: participant,
      familyId,
      authorization: {
        action: 'MEMBER_UPDATE',
        purpose: 'FAMILY_MANAGEMENT',
        resource: { type: 'MEMBER', familyId, personId: participant.personId },
      },
      descriptor: descriptor(code),
      targetPersonId: participant.personId,
      supportedObligations: SUPPORTED,
    });

    expect(decision.decision).toBe('AUTHORIZATION_DENIED');
    expect(decision.authorization).toBe('DENY');
    expect(decision.downstreamAllowed).toBe(false);
    if (decision.decision === 'AUTHORIZATION_DENIED') {
      expect(decision.authorizationReason).toBe('NOT_FAMILY_MANAGER');
      // Anti-enumeration: no compliance/policy provenance is exposed.
      expect(decision.compliance).toBeNull();
    }
  });

  it('Compliance BLOCK does not mutate the authorization decision', async () => {
    const code = featureCode('UNKNOWN');
    await publish(code, 'UNKNOWN');

    const decision = await evaluateAuthorizedCompliance(pool, {
      actor: owner,
      familyId,
      authorization: {
        action: 'MEMBER_UPDATE',
        purpose: 'FAMILY_MANAGEMENT',
        resource: { type: 'MEMBER', familyId, personId: participant.personId },
      },
      descriptor: descriptor(code),
      targetPersonId: participant.personId,
      supportedObligations: SUPPORTED,
    });

    expect(decision.decision).toBe('COMPLIANCE_EVALUATED');
    expect(decision.authorization).toBe('ALLOW');
    expect(decision.downstreamAllowed).toBe(false);
    if (decision.decision === 'COMPLIANCE_EVALUATED') {
      expect(decision.compliance.gate).toBe('BLOCK');
      expect(decision.compliance.reasonCode).toBe('COMPLIANCE_APPLICABILITY_UNKNOWN');
    }
  });

  it('authorization fact-query infrastructure failure propagates unchanged', async () => {
    const boom = Object.assign(new Error('INJECTED_AUTHZ_FACT_FAILURE'), { code: '08006' });
    const failingClient = {
      query: async () => {
        throw boom;
      },
    } as unknown as pg.PoolClient;

    await expect(
      decideFamilyAction(failingClient, {
        accountId: owner.accountId,
        personId: owner.personId,
        familyId,
        action: 'MEMBER_UPDATE',
        purpose: 'FAMILY_MANAGEMENT',
        resource: { type: 'MEMBER', familyId, personId: participant.personId },
        targetPersonId: participant.personId,
      })
    ).rejects.toThrow('INJECTED_AUTHZ_FACT_FAILURE');

    try {
      await decideFamilyAction(failingClient, {
        accountId: owner.accountId,
        personId: owner.personId,
        familyId,
        action: 'MEMBER_UPDATE',
        purpose: 'FAMILY_MANAGEMENT',
        resource: { type: 'MEMBER', familyId, personId: participant.personId },
        targetPersonId: participant.personId,
      });
    } catch (error) {
      // An infrastructure failure is not a known business denial.
      expect(isKnownAuthorizationDenial(error)).toBe(false);
    }
  });
});