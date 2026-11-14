/**
 * S7-II-H01 — shared CHECK vocabularies must be a superset of the current
 * main baseline. Slice 7 may only append its own literals; it must not rebuild
 * an older whitelist that drops Slice 4 participation values.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import { createAdminPool } from '../setup/db.js';

const EXPECTED_AUDIT_EVENTS = [
  'FAMILY_CREATED',
  'MEMBER_CREATED',
  'MEMBER_PROFILE_VALUE_RECORDED',
  'CONSENT_REQUEST_CREATED',
  'CONSENT_GRANTED',
  'CONSENT_REVOKED',
  'CASE_CREATED',
  'MESSAGE_RECORDED',
  'ASSERTION_RECORDED',
  'OBSERVATION_RECORDED',
  'PARTICIPATION_INVITE_CREATED',
  'PARTICIPATION_ACCEPTED',
  'PARTICIPATION_DECLINED',
  'PARTICIPATION_EXPIRED',
  'PARTICIPATION_WITHDRAWN',
  'CASE_PRIMARY_SWITCHED',
  'CASE_ASSESSMENT_STARTED',
  'CASE_PROBLEM_FORMULATION_PRESENTED',
  'CASE_PROBLEM_FORMULATION_CONFIRMED',
  'CASE_PROBLEM_FORMULATION_DISPUTED',
  'CASE_PROBLEM_FORMULATION_CORRECTED',
  'CASE_REASSESSMENT_STARTED',
  // Slice 9 Safety control foundation appends two literals; every earlier
  // value above must survive.
  'CASE_SAFETY_HOLD_ENTERED',
  'CASE_RISK_RESOLVED',
  // Slice 1 Consent Owner 01004 remediation appends exactly three
  // supplemental-assessment consent outcomes.
  'CONSENT_SUPPLEMENTAL_ASSESSMENT_GRANTED',
  'CONSENT_SUPPLEMENTAL_ASSESSMENT_DECLINED',
  'CONSENT_SUPPLEMENTAL_ASSESSMENT_REVOKED',
  'DIGITAL_USE_NODE_COMPLETED',
];

const EXPECTED_COMMANDS = [
  'FAMILY_CREATE',
  'MEMBER_CREATE',
  'MEMBER_UPDATE',
  'GUARDIAN_CONSENT_REQUEST',
  'GUARDIAN_CONSENT_GRANT',
  'GUARDIAN_CONSENT_REVOKE',
  'CASE_CREATE',
  'CASE_MESSAGE_CREATE',
  'PARTICIPATION_INVITE_CREATE',
  'PARTICIPATION_ACCEPT',
  'PARTICIPATION_DECLINE',
  'PARTICIPATION_WITHDRAW',
  'CASE_SWITCH_PRIMARY',
  'CASE_START_ASSESSMENT',
  'PROBLEM_FORMULATION_PRESENT',
  'PROBLEM_FORMULATION_CONFIRM',
  'PROBLEM_FORMULATION_DISPUTE',
  'PROBLEM_FORMULATION_CORRECT',
  'CASE_REASSESS_FROM_FORMULATION',
  // Slice 9 Safety commands use the same idempotency store/vocabulary.
  'CASE_ENTER_SAFETY_HOLD',
  'CASE_RESOLVE_RISK',
  'DIGITAL_USE_ASSESSMENT_RESUME',
  'DIGITAL_USE_NODE_RESPONSE',
];

const EXPECTED_RESOURCE_TYPES = [
  'FAMILY',
  'PERSON',
  'CONSENT',
  'CASE',
  'DIALOGUE_MESSAGE',
  'ASSERTION',
  'OBSERVATION',
  'CASE_PARTICIPANT',
  'PROBLEM_FORMULATION',
];

function literalsOf(definition: string): string[] {
  return [...definition.matchAll(/'([A-Z_]+)'/g)].map((match) => match[1]);
}

describe('shared CHECK vocabulary (S7-II-H01)', () => {
  let admin: pg.Pool;

  beforeAll(() => {
    admin = createAdminPool();
  });

  afterAll(async () => {
    await admin.end();
  });

  async function definition(conname: string): Promise<string> {
    const { rows } = await admin.query(
      `SELECT pg_get_constraintdef(oid) AS definition
         FROM pg_constraint
        WHERE conname = $1`,
      [conname]
    );
    expect(rows, conname).toHaveLength(1);
    return rows[0].definition as string;
  }

  it('business_audit_events.event_type preserves the exact reviewed vocabulary through Slice 12', async () => {
    const values = literalsOf(await definition('business_audit_events_event_type_check'));
    expect(new Set(values)).toEqual(new Set(EXPECTED_AUDIT_EVENTS));
  });

  it('business_audit_events.resource_type remains the main eight values', async () => {
    const values = literalsOf(await definition('business_audit_events_resource_type_check'));
    expect(new Set(values)).toEqual(new Set(EXPECTED_RESOURCE_TYPES));
  });

  it('idempotency_keys.command_type preserves the exact reviewed vocabulary through Slice 12', async () => {
    const values = literalsOf(await definition('idempotency_keys_command_type_check'));
    expect(new Set(values)).toEqual(new Set(EXPECTED_COMMANDS));
  });

  it('case_events.event_type is the exact reviewed vocabulary through Slice 12', async () => {
    const values = literalsOf(await definition('case_events_event_type_check'));
    expect(new Set(values)).toEqual(
      new Set([
        'CASE_CREATED',
        'CASE_PRIMARY_ASSIGNED',
        'CASE_PRIMARY_REVOKED',
        'CASE_ASSESSMENT_STARTED',
        'CASE_PROBLEM_FORMULATION_PRESENTED',
        'CASE_PROBLEM_FORMULATION_CONFIRMED',
        'CASE_PROBLEM_FORMULATION_DISPUTED',
        'CASE_PROBLEM_FORMULATION_CORRECTED',
        'CASE_REASSESSMENT_STARTED',
        'CASE_SAFETY_HOLD_ENTERED',
        'CASE_RISK_RESOLVED',
        'CASE_DIGITAL_USE_NODE_COMPLETED',
      ])
    );
  });

  it('idempotency key representation stays text-only for participation and bytea-only for switch/Safety commands', async () => {
    const text = await definition('idempotency_keys_key_representation_check');
    expect(text).toContain('CASE_CREATE');
    expect(text).toContain('CASE_SWITCH_PRIMARY');
    expect(text).toContain('CASE_ENTER_SAFETY_HOLD');
    expect(text).toContain('CASE_RESOLVE_RISK');
    expect(text).toContain('idempotency_key_bytes');
  });
});