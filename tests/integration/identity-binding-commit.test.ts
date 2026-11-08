/**
 * Happy-path runtime projection of AS-01: bootstrap → Candidate AFFIRM →
 * confirmer AFFIRM → COMMITTED → session exchange.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  buildBindingApp,
  createTarget,
  startBinding,
  confirmerDecision,
  candidateStatus,
  candidateSession,
  personAccountId,
  type BindingHarness,
} from '../setup/identity-binding.js';

describe('Identity binding happy path (AS-01)', () => {
  let h: BindingHarness;

  beforeAll(async () => {
    h = await buildBindingApp();
  });

  afterAll(async () => {
    await h.close();
  });

  it('binds Account A ↔ existing P1 exactly once; no Person increment', async () => {
    const target = await createTarget(h, 'hf', { ageBand: 'UNDER_14' });
    // Other suites run in parallel and create their own Persons; the
    // deterministic no-P2 assertion is scoped to the Account created by THIS
    // binding flow (a P2 would be created with that account).
    const { contextToken, attemptId } = await startBinding(
      h,
      target,
      `happy_code_${Date.now()}_${Math.random().toString(36).slice(2)}`
    );


    const pending = await h.app.inject({
      method: 'GET',
      url: `/api/v1/identity-bindings/pending?personId=${target.targetPersonId}`,
      headers: { authorization: `Bearer ${target.guardian.token}` },
    });
    expect(pending.statusCode).toBe(200);
    expect(pending.json().attempts).toHaveLength(1);
    expect(pending.json().attempts[0].attemptId).toBe(attemptId);

    const confirm = await confirmerDecision(
      h,
      target.guardian.token,
      attemptId,
      { personId: target.targetPersonId, decision: 'AFFIRM' }
    );
    expect(confirm.statusCode).toBe(200);
    expect(confirm.json().state).toBe('COMMITTED');

    expect(await personAccountId(h, target.targetPersonId)).not.toBeNull();
    const boundAccountId = await personAccountId(h, target.targetPersonId);
    const p2 = await h.admin.query(
      'SELECT count(*)::int AS cnt FROM persons WHERE created_by_account_id = $1',
      [boundAccountId]
    );
    expect(p2.rows[0].cnt).toBe(0);

    const status = await candidateStatus(h, contextToken);
    expect(status.statusCode).toBe(200);
    expect(status.json()).toEqual({ binding: 'COMMITTED' });

    const session = await candidateSession(h, contextToken);
    expect(session.statusCode).toBe(200);
    expect(session.json().binding).toBe('COMMITTED');
    expect(session.json().account.id).toBe(await personAccountId(h, target.targetPersonId));

    const me = await h.app.inject({
      method: 'GET',
      url: '/api/v1/me',
      headers: { authorization: `Bearer ${session.json().sessionToken}` },
    });
    expect(me.statusCode).toBe(200);
    expect(me.json().person.id).toBe(target.targetPersonId);
  });

  it('MINOR_14_17 with a current guardian commits via that guardian (AS-02)', async () => {
    const target = await createTarget(h, 'minor_guardian', { ageBand: 'MINOR_14_17' });
    await h.admin.query(
      'UPDATE person_compliance_profiles SET guardian_person_id = $1 WHERE person_id = $2',
      [target.guardian.personId, target.targetPersonId]
    );

    const profile = await h.admin.query(
      'SELECT guardian_person_id FROM person_compliance_profiles WHERE person_id = $1',
      [target.targetPersonId]
    );
    expect(profile.rows[0].guardian_person_id).toBe(target.guardian.personId);

    const { attemptId } = await startBinding(
      h,
      target,
      `minor_guardian_${Date.now()}_${Math.random().toString(36).slice(2)}`
    );
    const confirm = await confirmerDecision(h, target.guardian.token, attemptId, {
      personId: target.targetPersonId,
      decision: 'AFFIRM',
    });
    expect(confirm.statusCode).toBe(200);
    expect(confirm.json().state).toBe('COMMITTED');
    expect(await personAccountId(h, target.targetPersonId)).not.toBeNull();
  });

  it('MINOR_14_17 without a guardian commits via the Family creator (AS-03)', async () => {
    const target = await createTarget(h, 'minor_manager', { ageBand: 'MINOR_14_17' });
    const profile = await h.admin.query(
      'SELECT guardian_person_id FROM person_compliance_profiles WHERE person_id = $1',
      [target.targetPersonId]
    );
    expect(profile.rows[0].guardian_person_id).toBeNull();

    const family = await h.admin.query(
      'SELECT created_by_person_id FROM families WHERE id = $1',
      [target.familyId]
    );
    expect(family.rows[0].created_by_person_id).toBe(target.guardian.personId);

    const { attemptId } = await startBinding(
      h,
      target,
      `minor_manager_${Date.now()}_${Math.random().toString(36).slice(2)}`
    );
    const confirm = await confirmerDecision(h, target.guardian.token, attemptId, {
      personId: target.targetPersonId,
      decision: 'AFFIRM',
    });
    expect(confirm.statusCode).toBe(200);
    expect(confirm.json().state).toBe('COMMITTED');
    expect(await personAccountId(h, target.targetPersonId)).not.toBeNull();
  });

});
