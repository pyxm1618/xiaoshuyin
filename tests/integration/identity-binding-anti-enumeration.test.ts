/**
 * T101/T102 — candidate-facing anti-enumeration: every internal outcome is the
 * same status / body key set / headers, with no reason, attempt or person id.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import {
  bootstrap,
  buildBindingApp,
  candidateDecision,
  candidateSession,
  candidateStatus,
  createTarget,
  type BindingHarness,
} from '../setup/identity-binding.js';
import { loginWithLabel, revokeConsent } from '../setup/api.js';
import type { IncomingHttpHeaders } from 'node:http';

function observable(res: { statusCode: number; body: string; headers: IncomingHttpHeaders }) {
  const parsed = JSON.parse(res.body) as Record<string, unknown>;
  return {
    statusCode: res.statusCode,
    keys: Object.keys(parsed).sort(),
    // Every generic body is `{binding, pendingContextToken}` with only the
    // opaque random token differing. Normalize it so shape comparison is exact.
    shape: {
      ...parsed,
      ...(Object.prototype.hasOwnProperty.call(parsed, 'pendingContextToken')
        ? { pendingContextToken: '<opaque>' }
        : {}),
    },
    setCookie: res.headers['set-cookie'] ?? null,
    location: res.headers['location'] ?? null,
    contentType: res.headers['content-type'],
  };
}

async function codeFor(h: BindingHarness, accountId: string): Promise<string> {
  const openid = await h.admin.query('SELECT wechat_openid FROM accounts WHERE id = $1', [
    accountId,
  ]);
  return (openid.rows[0].wechat_openid as string).replace(/^fake_/, '');
}

describe('candidate-facing anti-enumeration', () => {
  let h: BindingHarness;

  beforeAll(async () => {
    h = await buildBindingApp();
  });

  afterAll(async () => {
    await h.close();
  });

  it('bootstrap generic branches are observationally identical (T101 matrix)', async () => {
    const adult = await createTarget(h, 'enum_adult', { ageBand: 'ADULT' });
    const unknown = await createTarget(h, 'enum_unknown', { ageBand: 'UNKNOWN' });
    const other = await createTarget(h, 'enum_other', { ageBand: 'MINOR_14_17' });
    const multi = await createTarget(h, 'enum_multi', {
      ageBand: 'MINOR_14_17',
      extraFamilyIds: [other.familyId],
    });
    // An UNDER_14 profile cannot legally exist without a guardian
    // (`pcp_under14_requires_consent`), so the reachable "guardian fact
    // missing" fixture is a target with no compliance profile at all.
    const noGuardian = await createTarget(h, 'enum_no_guardian', { ageBand: 'UNDER_14' });
    await h.admin.query('DELETE FROM person_compliance_profiles WHERE person_id = $1', [
      noGuardian.targetPersonId,
    ]);
    const badConsent = await createTarget(h, 'enum_bad_consent', { ageBand: 'UNDER_14' });
    const revoke = await revokeConsent(h.app, badConsent.guardian.token, 'enum_bad_consent', badConsent.consentId!);
    expect([200, 201]).toContain(revoke.statusCode);

    const terminal = await createTarget(h, 'enum_terminal', { ageBand: 'UNDER_14' });
    h.port.remove(terminal.invitationToken);

    // P1 no longer exists for this (still syntactically valid) invitation.
    const ghostToken = `ghost_${randomUUID()}`;
    h.port.add(ghostToken, {
      status: 'VALID',
      participationId: randomUUID(),
      targetPersonId: randomUUID(),
      targetFamilyId: terminal.familyId,
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    });

    // Candidate Account already bound to a different Person (Case B mismatch).
    const candidate = await loginWithLabel(h.app, 'enum_case_b');
    const candidateCode = await codeFor(h, candidate.accountId);
    const caseBTarget = await createTarget(h, 'enum_case_b_target', { ageBand: 'UNDER_14' });

    const runs: Array<{ label: string; res: Awaited<ReturnType<typeof bootstrap>> }> = [
      {
        label: 'invalid invitation',
        res: await bootstrap(h, `missing_${randomUUID()}`, `enum_missing_${randomUUID()}`),
      },
      { label: 'P1 missing', res: await bootstrap(h, ghostToken, `enum_ghost_${randomUUID()}`) },
      { label: 'multi-family', res: await bootstrap(h, multi.invitationToken, `enum_multi_${randomUUID()}`) },
      {
        label: 'guardian missing',
        res: await bootstrap(h, noGuardian.invitationToken, `enum_guardian_${randomUUID()}`),
      },
      {
        label: 'consent invalid',
        res: await bootstrap(h, badConsent.invitationToken, `enum_consent_${randomUUID()}`),
      },
      { label: 'ADULT', res: await bootstrap(h, adult.invitationToken, `enum_adult_${randomUUID()}`) },
      {
        label: 'UNKNOWN',
        res: await bootstrap(h, unknown.invitationToken, `enum_unknown_${randomUUID()}`),
      },
      {
        label: 'Case B mismatch',
        res: await bootstrap(h, caseBTarget.invitationToken, candidateCode, `enum_case_b_${randomUUID()}`),
      },
      {
        label: 'candidate Account bound P2',
        res: await bootstrap(h, caseBTarget.invitationToken, candidateCode, `enum_bound_p2_${randomUUID()}`),
      },
      {
        label: 'invitation terminal',
        res: await bootstrap(h, terminal.invitationToken, `enum_terminal_${randomUUID()}`),
      },
    ];

    const observations = runs.map((run) => observable(run.res));
    const baseline = observations[0]!;
    expect(baseline.statusCode).toBe(200);
    expect(baseline.keys).toEqual(['binding', 'pendingContextToken']);
    expect(baseline.shape).toEqual({ binding: 'NOT_COMPLETED', pendingContextToken: '<opaque>' });
    expect(baseline.setCookie).toBeNull();
    expect(baseline.location).toBeNull();

    runs.forEach((run, i) => {
      const obs = observations[i]!;
      expect(obs, run.label).toEqual(baseline);
      const body = JSON.parse(run.res.body);
      expect(body.binding).toBe('NOT_COMPLETED');
      expect(body).not.toHaveProperty('attemptId');
      expect(body).not.toHaveProperty('personId');
      expect(body).not.toHaveProperty('reason');
      expect(body).not.toHaveProperty('ageBand');
      expect(typeof body.pendingContextToken).toBe('string');
      expect(body.pendingContextToken.length).toBeGreaterThan(0);
    });

    // Next-action capability is identical: every opaque token can call status
    // and receives the same normalized generic result.
    for (const run of runs) {
      const token = run.res.json().pendingContextToken as string;
      const status = await candidateStatus(h, token);
      expect(status.statusCode, run.label).toBe(200);
      expect(status.json(), run.label).toEqual({ binding: 'NOT_COMPLETED' });
    }
  });

  it('PENDING / TERMINAL / expired candidate status are observationally identical', async () => {
    const pendingTarget = await createTarget(h, 'enum_status_pending', { ageBand: 'UNDER_14' });
    const pendingBoot = await bootstrap(h, pendingTarget.invitationToken, `enum_pending_${randomUUID()}`);
    const pendingToken = pendingBoot.json().pendingContextToken as string;

    const terminalTarget = await createTarget(h, 'enum_status_terminal', { ageBand: 'UNDER_14' });
    const terminalBoot = await bootstrap(h, terminalTarget.invitationToken, `enum_term_${randomUUID()}`);
    const terminalToken = terminalBoot.json().pendingContextToken as string;
    await candidateDecision(h, terminalToken, 'REJECT', `enum-rej-${randomUUID()}`);

    const expiredTarget = await createTarget(h, 'enum_status_expired', { ageBand: 'UNDER_14' });
    const expiredBoot = await bootstrap(h, expiredTarget.invitationToken, `enum_exp_${randomUUID()}`);
    const expiredToken = expiredBoot.json().pendingContextToken as string;
    const expiredAttempt = await h.admin.query(
      'SELECT id FROM binding_attempts WHERE target_person_id = $1',
      [expiredTarget.targetPersonId]
    );
    await h.admin.query(
      "UPDATE binding_attempts SET created_at = now() - interval '2 days', expires_at = now() - interval '1 day' WHERE id = $1",
      [expiredAttempt.rows[0].id]
    );

    const responses = await Promise.all([
      candidateStatus(h, pendingToken),
      candidateStatus(h, terminalToken),
      candidateStatus(h, expiredToken),
    ]);
    const observations = responses.map(observable);
    for (const obs of observations) {
      expect(obs.statusCode).toBe(200);
      expect(obs.keys).toEqual(['binding']);
      expect(obs.shape).toEqual({ binding: 'NOT_COMPLETED' });
      expect(obs.setCookie).toBeNull();
      expect(obs.location).toBeNull();
    }
    expect(observations[1]).toEqual(observations[0]);
    expect(observations[2]).toEqual(observations[0]);
  });

  it('generic candidate surfaces expose no internal reason', async () => {
    const adult = await createTarget(h, 'enum_surface', { ageBand: 'ADULT' });
    const boot = await bootstrap(h, adult.invitationToken, `enum_surface_${Date.now()}`);
    const token = boot.json().pendingContextToken as string;

    const decision = await candidateDecision(h, token, 'AFFIRM', undefined, 'candidate-binding-v1');
    expect(decision.statusCode).toBe(200);
    expect(decision.json()).toEqual({ binding: 'NOT_COMPLETED' });

    const status = await candidateStatus(h, token);
    expect(status.statusCode).toBe(200);
    expect(status.json()).toEqual({ binding: 'NOT_COMPLETED' });

    const session = await candidateSession(h, token);
    expect(session.statusCode).toBe(200);
    expect(session.json()).toEqual({ binding: 'NOT_COMPLETED' });
  });
});