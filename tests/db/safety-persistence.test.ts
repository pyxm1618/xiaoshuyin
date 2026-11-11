/**
 * T905 — Risk Event / Case Event / Business Audit persistence.
 *
 * Proves the three artifacts have distinct, minimal responsibilities and that
 * no raw user content can reach them.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import { and, eq } from 'drizzle-orm';
import { buildApp } from '../../apps/server/api/src/app.js';
import { withDrizzleRlsTransaction } from '../../apps/server/api/src/db/drizzle-tx.js';
import {
  insertHoldEnteredRiskEvent,
  insertRiskResolvedRiskEvent,
  insertSafetyAuditEvent,
  insertSafetyCaseEvent,
  buildSafetyAuditMetadata,
  buildSafetyCaseEventMetadata,
  safetySchema,
  type SafetyWriteTx,
} from '../../packages/domain/src/safety/index.js';
import * as safetySurface from '../../packages/domain/src/safety/index.js';
import { createAdminPool } from '../setup/db.js';
import { createSafetyFixture, type SafetyFixture } from '../setup/safety.js';

const PREFIX = 't905_';
const { riskEvents, caseEvents, businessAuditEvents } = safetySchema;

describe('T905 Safety persistence responsibilities', () => {
  let fixture: SafetyFixture;
  let admin: pg.Pool;
  let session: { token: string; accountId: string; personId: string };
  let familyId: string;
  let caseId: string;

  beforeAll(async () => {
    const app = await buildApp();
    await app.ready();
    admin = createAdminPool();
    fixture = createSafetyFixture({ app, admin, prefix: PREFIX });
    session = await fixture.login('owner');
    familyId = await fixture.createFamily(session, 'main');
    caseId = (await fixture.createCase(session)).id;
  });

  afterAll(async () => {
    await fixture.cleanup();
    await fixture.close();
    await admin.end();
    await fixture.app.close();
  });

  const rls = () => ({
    familyId,
    accountId: session.accountId,
    personId: session.personId,
    purpose: 'FAMILY_MANAGEMENT',
  });

  async function writeSafetyTriplet(): Promise<{
    holdEventId: string;
    caseEventId: string;
    auditEventId: string;
  }> {
    return withDrizzleRlsTransaction(fixture.pool, rls(), async (tx) => {
      const holdEventId = await insertHoldEnteredRiskEvent(tx as unknown as SafetyWriteTx, {
        familyId,
        caseId,
        actorAccountId: session.accountId,
        decisionCaseVersion: 1,
        identity: {
          policyRef: 'policy.fixture',
          policyVersion: '1',
          ruleRef: 'rule.fixture',
          ruleVersion: '1',
        },
        riskCategoryRef: 'CATEGORY_FIXTURE',
        evidenceRefs: [{ kind: 'EVIDENCE', ref: 'ref-fixture' }],
      });
      await insertSafetyCaseEvent(tx as unknown as SafetyWriteTx, {
        familyId,
        caseId,
        actorAccountId: session.accountId,
        eventType: 'CASE_SAFETY_HOLD_ENTERED',
        fromStatus: 'OPEN',
        toStatus: 'SAFETY_HOLD',
        fromVersion: 1,
        toVersion: 2,
        riskEventId: holdEventId,
      });
      await insertSafetyAuditEvent(tx as unknown as SafetyWriteTx, {
        familyId,
        caseId,
        actorAccountId: session.accountId,
        eventType: 'CASE_SAFETY_HOLD_ENTERED',
        riskEventId: holdEventId,
        fromVersion: 1,
        toVersion: 2,
      });
      const [caseEventRow] = await tx
        .select({ id: caseEvents.id })
        .from(caseEvents)
        .where(and(eq(caseEvents.caseId, caseId), eq(caseEvents.eventType, 'CASE_SAFETY_HOLD_ENTERED')));
      const [auditRow] = await tx
        .select({ id: businessAuditEvents.id })
        .from(businessAuditEvents)
        .where(
          and(
            eq(businessAuditEvents.resourceId, caseId),
            eq(businessAuditEvents.eventType, 'CASE_SAFETY_HOLD_ENTERED')
          )
        );
      return {
        holdEventId,
        caseEventId: caseEventRow!.id,
        auditEventId: auditRow!.id,
      };
    });
  }

  it('writes three records with distinct minimal responsibilities', async () => {
    const ids = await writeSafetyTriplet();

    const risk = await admin.query('SELECT * FROM risk_events WHERE id = $1', [ids.holdEventId]);
    const caseEvent = await admin.query('SELECT * FROM case_events WHERE id = $1', [
      ids.caseEventId,
    ]);
    const audit = await admin.query('SELECT * FROM business_audit_events WHERE id = $1', [
      ids.auditEventId,
    ]);

    expect(risk.rows).toHaveLength(1);
    expect(caseEvent.rows).toHaveLength(1);
    expect(audit.rows).toHaveLength(1);

    // Risk Event: policy/rule/category identity + decision revision + refs.
    expect(risk.rows[0]).toMatchObject({
      family_id: familyId,
      case_id: caseId,
      actor_account_id: session.accountId,
      event_kind: 'HOLD_ENTERED',
      decision_case_version: 1,
      policy_ref: 'policy.fixture',
      policy_version: '1',
      rule_ref: 'rule.fixture',
      rule_version: '1',
      risk_category_ref: 'CATEGORY_FIXTURE',
      resolution_of_risk_event_id: null,
      resolution_authority_ref: null,
    });
    expect(risk.rows[0].evidence_refs).toEqual([{ kind: 'EVIDENCE', ref: 'ref-fixture' }]);

    // Case Event: exactly the five frozen keys.
    expect(caseEvent.rows[0].metadata).toEqual({
      fromStatus: 'OPEN',
      toStatus: 'SAFETY_HOLD',
      fromVersion: 1,
      toVersion: 2,
      riskEventId: ids.holdEventId,
    });

    // Business Audit: resource stays CASE; no policy/evidence payload.
    expect(audit.rows[0]).toMatchObject({
      event_type: 'CASE_SAFETY_HOLD_ENTERED',
      resource_type: 'CASE',
      resource_id: caseId,
    });
    expect(audit.rows[0].metadata).toEqual({
      riskEventId: ids.holdEventId,
      fromVersion: 1,
      toVersion: 2,
    });
  });

  it('stores the resolution authority reference only on the resolution audit', async () => {
    const holdId = await writeSafetyTriplet();
    const resolvedId = await withDrizzleRlsTransaction(fixture.pool, rls(), async (tx) =>
      insertRiskResolvedRiskEvent(tx as unknown as SafetyWriteTx, {
        familyId,
        caseId,
        actorAccountId: session.accountId,
        decisionCaseVersion: 2,
        resolutionOfRiskEventId: holdId.holdEventId,
        evidenceRefs: [{ kind: 'EVIDENCE', ref: 'review-fixture' }],
        resolutionAuthorityRef: 'authority.fixture',
      })
    );

    const resolution = await admin.query('SELECT * FROM risk_events WHERE id = $1', [resolvedId]);
    expect(resolution.rows[0]).toMatchObject({
      event_kind: 'RISK_RESOLVED',
      resolution_of_risk_event_id: holdId.holdEventId,
      resolution_authority_ref: 'authority.fixture',
      policy_ref: null,
      risk_category_ref: null,
    });

    await withDrizzleRlsTransaction(fixture.pool, rls(), async (tx) => {
      await insertSafetyAuditEvent(tx as unknown as SafetyWriteTx, {
        familyId,
        caseId,
        actorAccountId: session.accountId,
        eventType: 'CASE_RISK_RESOLVED',
        riskEventId: resolvedId,
        fromVersion: 2,
        toVersion: 3,
        resolutionAuthorityRef: 'authority.fixture',
      });
    });

    const { rows } = await admin.query(
      `SELECT metadata FROM business_audit_events WHERE resource_id = $1 AND event_type = 'CASE_RISK_RESOLVED'`,
      [caseId]
    );
    expect(rows[0].metadata).toEqual({
      riskEventId: resolvedId,
      fromVersion: 2,
      toVersion: 3,
      resolutionAuthorityRef: 'authority.fixture',
    });
  });

  it('builds metadata with no raw content keys at all', () => {
    const caseMetadata = buildSafetyCaseEventMetadata({
      fromStatus: 'OPEN',
      toStatus: 'SAFETY_HOLD',
      fromVersion: 1,
      toVersion: 2,
      riskEventId: 'risk-event-id',
    });
    const auditMetadata = buildSafetyAuditMetadata({
      riskEventId: 'risk-event-id',
      fromVersion: 1,
      toVersion: 2,
    });

    for (const metadata of [caseMetadata, auditMetadata]) {
      const keys = Object.keys(metadata);
      for (const forbidden of [
        'content',
        'message',
        'text',
        'body',
        'note',
        'notes',
        'reviewNotes',
        'reason',
        'policy',
        'policyRef',
        'evidenceRefs',
        'riskCategoryRef',
        'transcript',
        'prompt',
      ]) {
        expect(keys).not.toContain(forbidden);
      }
    }
  });

  it('exposes no UPDATE or DELETE primitive for Risk Events', () => {
    const exported = Object.keys(safetySurface);
    for (const name of exported) {
      expect(name).not.toMatch(/update.*risk|delete.*risk|risk.*update|risk.*delete/i);
    }
    // Append-only posture: only these insert entry points exist.
    expect(exported).toContain('insertHoldEnteredRiskEvent');
    expect(exported).toContain('insertRiskResolvedRiskEvent');
  });

  it('lets the database reject extra Case Event metadata keys', async () => {
    let caught: unknown;
    try {
      await withDrizzleRlsTransaction(fixture.pool, rls(), async (tx) => {
        await tx.insert(caseEvents).values({
          familyId,
          caseId,
          actorAccountId: session.accountId,
          eventType: 'CASE_SAFETY_HOLD_ENTERED',
          metadata: {
            fromStatus: 'OPEN',
            toStatus: 'SAFETY_HOLD',
            fromVersion: 1,
            toVersion: 2,
            riskEventId: 'risk-event-id',
            reviewNotes: 'raw review text',
          },
        });
      });
    } catch (error) {
      caught = error;
    }
    // Drizzle wraps the server error; the CHECK name lives on the cause.
    const text = `${(caught as { message?: string } | undefined)?.message ?? ''} ${
      (caught as { cause?: { message?: string } } | undefined)?.cause?.message ?? ''
    }`;
    expect(caught).toBeTruthy();
    expect(text).toMatch(/case_events_metadata_shape_check|violates check constraint/i);
  });
});