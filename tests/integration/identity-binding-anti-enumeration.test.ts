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
  confirmerDecision,
  candidateStatus,
  createTarget,
  personAccountId,
  type BindingHarness,
} from '../setup/identity-binding.js';
import { loginWithLabel, revokeConsent } from '../setup/api.js';
import type { IncomingHttpHeaders } from 'node:http';

// Headers that no business branch can influence: `date` is wall-clock,
// `content-length` follows the randomized opaque token, and `connection` /
// `keep-alive` are transport-level. Every other header — including every
// `x-*` header, `set-cookie`, `location` and `content-type` — is compared
// verbatim. There is no "assume the remaining headers are equal" shortcut.
const INFRASTRUCTURE_HEADERS = new Set(['date', 'content-length', 'connection', 'keep-alive']);

function observableHeaders(headers: IncomingHttpHeaders): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  for (const [rawName, value] of Object.entries(headers)) {
    const name = rawName.toLowerCase();
    if (INFRASTRUCTURE_HEADERS.has(name) || value === undefined) continue;
    out[name] = value;
  }
  return out;
}

function observable(res: { statusCode: number; body: string; headers: IncomingHttpHeaders }) {
  const parsed = JSON.parse(res.body) as Record<string, unknown>;
  const hasToken = Object.prototype.hasOwnProperty.call(parsed, 'pendingContextToken');
  const token = parsed['pendingContextToken'];
  return {
    statusCode: res.statusCode,
    headers: observableHeaders(res.headers),
    keys: Object.keys(parsed).sort(),
    // Every generic body is `{binding, pendingContextToken}` with only the
    // opaque random token differing. Normalize the value but still compare the
    // field's type / length / encoding class below.
    shape: {
      ...parsed,
      ...(hasToken ? { pendingContextToken: '<opaque>' } : {}),
    },
    tokenShape: hasToken
      ? {
          type: typeof token,
          length: typeof token === 'string' ? token.length : -1,
          format:
            typeof token === 'string' && /^[A-Za-z0-9_-]{43}$/.test(token)
              ? 'base64url32'
              : 'unexpected',
        }
      : null,
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
    expect(baseline.headers['set-cookie']).toBeUndefined();
    expect(baseline.headers['location']).toBeUndefined();
    expect(baseline.headers['content-type']).toContain('application/json');
    expect(Object.keys(baseline.headers).filter((name) => name.startsWith('x-'))).toEqual([]);
    expect(baseline.tokenShape).toEqual({ type: 'string', length: 43, format: 'base64url32' });

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
      expect(obs.headers['set-cookie']).toBeUndefined();
      expect(obs.headers['location']).toBeUndefined();
      expect(obs.headers['content-type']).toContain('application/json');
      expect(Object.keys(obs.headers).filter((name) => name.startsWith('x-'))).toEqual([]);
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
    expect(decision.json().binding).toBe('NOT_COMPLETED');
    expect(decision.json().pairingChallenge).toMatch(/^[A-Za-z0-9_-]{192}$/);

    const status = await candidateStatus(h, token);
    expect(status.statusCode).toBe(200);
    expect(status.json()).toEqual({ binding: 'NOT_COMPLETED' });

    const session = await candidateSession(h, token);
    expect(session.statusCode).toBe(200);
    expect(session.json()).toEqual({ binding: 'NOT_COMPLETED' });
  });

  it('H-01: valid and decoy AFFIRM challenges are externally indistinguishable', async () => {
    const eligible = await createTarget(h, 'enum_valid', { ageBand: 'UNDER_14' });
    const eligibleBoot = await bootstrap(
      h,
      eligible.invitationToken,
      `enum_valid_${randomUUID()}`
    );
    const validRes = await candidateDecision(
      h,
      eligibleBoot.json().pendingContextToken as string,
      'AFFIRM',
      `enum-valid-${randomUUID()}`,
      'candidate-binding-v1'
    );

    const hidden = await createTarget(h, 'enum_hidden', { ageBand: 'UNDER_14' });
    const hiddenBoot = await bootstrap(
      h,
      hidden.invitationToken,
      `enum_hidden_${randomUUID()}`
    );
    await revokeConsent(h.app, hidden.guardian.token, 'enum_hidden', hidden.consentId!);
    const decoyRes = await candidateDecision(
      h,
      hiddenBoot.json().pendingContextToken as string,
      'AFFIRM',
      `enum-hidden-${randomUUID()}`,
      'candidate-binding-v1'
    );

    for (const res of [validRes, decoyRes]) {
      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toContain('application/json');
      expect(Object.keys(res.json()).sort()).toEqual(['binding', 'pairingChallenge']);
      expect(res.json().binding).toBe('NOT_COMPLETED');
      expect(res.json().pairingChallenge).toMatch(/^[A-Za-z0-9_-]{192}$/);
      expect(res.json()).not.toHaveProperty('expiresAt');
      expect(res.json()).not.toHaveProperty('pairingExpiresAt');
    }
  });

  it('REM2-005: repeated real and decoy AFFIRM calls have the same stability policy', async () => {
    const eligible = await createTarget(h, 'enum_stability_real', { ageBand: 'UNDER_14' });
    const eligibleBoot = await bootstrap(
      h,
      eligible.invitationToken,
      `enum_stability_real_${randomUUID()}`
    );
    const eligibleToken = eligibleBoot.json().pendingContextToken as string;
    const realFirst = await candidateDecision(
      h,
      eligibleToken,
      'AFFIRM',
      `enum-stability-real-1-${randomUUID()}`,
      'candidate-binding-v1'
    );
    const realReplay = await candidateDecision(
      h,
      eligibleToken,
      'AFFIRM',
      `enum-stability-real-2-${randomUUID()}`,
      'candidate-binding-v1'
    );

    const hidden = await createTarget(h, 'enum_stability_decoy', { ageBand: 'UNDER_14' });
    const hiddenBoot = await bootstrap(
      h,
      hidden.invitationToken,
      `enum_stability_decoy_${randomUUID()}`
    );
    const hiddenToken = hiddenBoot.json().pendingContextToken as string;
    const revoked = await revokeConsent(
      h.app,
      hidden.guardian.token,
      'enum_stability_decoy',
      hidden.consentId!
    );
    expect([200, 201]).toContain(revoked.statusCode);
    const decoyFirst = await candidateDecision(
      h,
      hiddenToken,
      'AFFIRM',
      `enum-stability-decoy-1-${randomUUID()}`,
      'candidate-binding-v1'
    );
    const decoyReplay = await candidateDecision(
      h,
      hiddenToken,
      'AFFIRM',
      `enum-stability-decoy-2-${randomUUID()}`,
      'candidate-binding-v1'
    );

    for (const res of [realFirst, realReplay, decoyFirst, decoyReplay]) {
      expect(res.statusCode).toBe(200);
      expect(Object.keys(res.json()).sort()).toEqual(['binding', 'pairingChallenge']);
      expect(res.json().pairingChallenge).toMatch(/^[A-Za-z0-9_-]{192}$/);
    }
    expect(realReplay.json().pairingChallenge).toBe(realFirst.json().pairingChallenge);
    expect(decoyReplay.json().pairingChallenge).toBe(decoyFirst.json().pairingChallenge);

    // Real issuance stays consumable while the attempt is PENDING; the decoy
    // path is stateless after terminal settlement and must not recreate any
    // pairing_issuance_* row state that could violate one-time/cleanup semantics.
    const realIssuance = await h.admin.query(
      `SELECT count(*)::int AS n
         FROM binding_pending_contexts c
         JOIN binding_attempts a ON a.id = c.attempt_id
        WHERE a.target_person_id = $1
          AND c.pairing_issuance_id IS NOT NULL
          AND c.pairing_issued_at IS NOT NULL
          AND c.pairing_expires_at IS NOT NULL`,
      [eligible.targetPersonId]
    );
    expect(realIssuance.rows[0].n).toBe(1);

    const decoyIssuance = await h.admin.query(
      `SELECT count(*)::int AS n
         FROM binding_pending_contexts c
         JOIN binding_attempts a ON a.id = c.attempt_id
        WHERE a.target_person_id = $1
          AND (
            c.pairing_issuance_id IS NOT NULL
            OR c.pairing_issued_at IS NOT NULL
            OR c.pairing_expires_at IS NOT NULL
          )`,
      [hidden.targetPersonId]
    );
    expect(decoyIssuance.rows[0].n).toBe(0);
  });

  it('REM2-005-M01: attempt expiry is not a REAL-only challenge transition', async () => {
    const ttlKeys = [
      'IDENTITY_BINDING_CONTEXT_TTL_SECONDS',
      'IDENTITY_BINDING_ATTEMPT_TTL_SECONDS',
      'IDENTITY_BINDING_PAIRING_TTL_SECONDS',
    ] as const;
    const previous = Object.fromEntries(ttlKeys.map((key) => [key, process.env[key]]));
    process.env['IDENTITY_BINDING_CONTEXT_TTL_SECONDS'] = '600';
    process.env['IDENTITY_BINDING_ATTEMPT_TTL_SECONDS'] = '100';
    process.env['IDENTITY_BINDING_PAIRING_TTL_SECONDS'] = '60';

    let boundaryHarness: BindingHarness | null = null;
    try {
      boundaryHarness = await buildBindingApp();
      const real = await createTarget(boundaryHarness, 'm01_boundary_real', {
        ageBand: 'UNDER_14',
      });
      const hidden = await createTarget(boundaryHarness, 'm01_boundary_decoy', {
        ageBand: 'UNDER_14',
      });

      const realBoot = await bootstrap(
        boundaryHarness,
        real.invitationToken,
        `m01_boundary_real_${randomUUID()}`
      );
      const hiddenBoot = await bootstrap(
        boundaryHarness,
        hidden.invitationToken,
        `m01_boundary_decoy_${randomUUID()}`
      );
      const realToken = realBoot.json().pendingContextToken as string;
      const hiddenToken = hiddenBoot.json().pendingContextToken as string;

      const realAttempt = await boundaryHarness.admin.query(
        'SELECT id FROM binding_attempts WHERE target_person_id = $1 ORDER BY created_at DESC LIMIT 1',
        [real.targetPersonId]
      );
      const hiddenAttempt = await boundaryHarness.admin.query(
        'SELECT id FROM binding_attempts WHERE target_person_id = $1 ORDER BY created_at DESC LIMIT 1',
        [hidden.targetPersonId]
      );
      const realAttemptId = realAttempt.rows[0].id as string;
      const hiddenAttemptId = hiddenAttempt.rows[0].id as string;

      // Deterministically reproduce the audited t=90 point without sleeping:
      // context=600s, attempt=100s, pairing=60s. Shift the immutable creation
      // epoch and both deadlines together, leaving ~510s of context and ~10s
      // of attempt lifetime. The current context pairing window still has ~30s.
      await boundaryHarness.admin.query(
        `UPDATE binding_pending_contexts
            SET created_at = created_at - interval '90 seconds',
                expires_at = expires_at - interval '90 seconds'
          WHERE attempt_id = ANY($1::uuid[])`,
        [[realAttemptId, hiddenAttemptId]]
      );
      await boundaryHarness.admin.query(
        `UPDATE binding_attempts
            SET created_at = created_at - interval '90 seconds',
                expires_at = expires_at - interval '90 seconds'
          WHERE id = ANY($1::uuid[])`,
        [[realAttemptId, hiddenAttemptId]]
      );

      const revoked = await revokeConsent(
        boundaryHarness.app,
        hidden.guardian.token,
        'm01_boundary_decoy',
        hidden.consentId!
      );
      expect([200, 201]).toContain(revoked.statusCode);

      const realBefore = await candidateDecision(
        boundaryHarness,
        realToken,
        'AFFIRM',
        `m01-real-before-${randomUUID()}`,
        'candidate-binding-v1'
      );
      const decoyBefore = await candidateDecision(
        boundaryHarness,
        hiddenToken,
        'AFFIRM',
        `m01-decoy-before-${randomUUID()}`,
        'candidate-binding-v1'
      );

      for (const res of [realBefore, decoyBefore]) {
        expect(res.statusCode).toBe(200);
        expect(Object.keys(res.json()).sort()).toEqual(['binding', 'pairingChallenge']);
        expect(res.json().pairingChallenge).toMatch(/^[A-Za-z0-9_-]{192}$/);
      }

      // Cross only the hidden attempt boundary. This is the deterministic DB
      // equivalent of advancing from t=90 to t=101 while the context remains
      // live and in the same public 60-second context pairing window.
      await boundaryHarness.admin.query(
        "UPDATE binding_attempts SET expires_at = now() - interval '1 second' WHERE id = $1",
        [realAttemptId]
      );

      const realAfter = await candidateDecision(
        boundaryHarness,
        realToken,
        'AFFIRM',
        `m01-real-after-${randomUUID()}`,
        'candidate-binding-v1'
      );
      const decoyAfter = await candidateDecision(
        boundaryHarness,
        hiddenToken,
        'AFFIRM',
        `m01-decoy-after-${randomUUID()}`,
        'candidate-binding-v1'
      );

      for (const res of [realAfter, decoyAfter]) {
        expect(res.statusCode).toBe(200);
        expect(Object.keys(res.json()).sort()).toEqual(['binding', 'pairingChallenge']);
        expect(res.json().pairingChallenge).toMatch(/^[A-Za-z0-9_-]{192}$/);
      }

      // The observable request must have the same transition policy. In this
      // unchanged context window both sides stay byte-stable: attempt expiry
      // itself is not allowed to create a REAL-only challenge rotation.
      expect(realAfter.json().pairingChallenge).toBe(realBefore.json().pairingChallenge);
      expect(decoyAfter.json().pairingChallenge).toBe(decoyBefore.json().pairingChallenge);

      const realState = await boundaryHarness.admin.query(
        'SELECT state, terminal_reason FROM binding_attempts WHERE id = $1',
        [realAttemptId]
      );
      expect(realState.rows[0]).toEqual({
        state: 'TERMINAL',
        terminal_reason: 'ATTEMPT_EXPIRED',
      });

      // ATTEMPT_EXPIRED retains the complete non-secret historical issuance
      // tuple so the exact old bytes can be replayed without violating the
      // existing all-null/all-non-null DB constraint. It is not authority:
      // the attempt is TERMINAL and the original pairing expiry is bounded by
      // the attempt expiry in the real protocol.
      const retired = await boundaryHarness.admin.query(
        `SELECT pairing_issuance_id, pairing_issued_at, pairing_expires_at
           FROM binding_pending_contexts
          WHERE attempt_id = $1`,
        [realAttemptId]
      );
      expect(retired.rows[0].pairing_issuance_id).not.toBeNull();
      expect(retired.rows[0].pairing_issued_at).not.toBeNull();
      expect(retired.rows[0].pairing_expires_at).not.toBeNull();

      // The stable bytes are observable continuity only. They cannot revive an
      // expired attempt or be consumed by a confirmer under a new operation.
      const expiredConsume = await confirmerDecision(
        boundaryHarness,
        real.guardian.token,
        realBefore.json().pairingChallenge as string,
        {
          personId: real.targetPersonId,
          decision: 'AFFIRM',
          idempotencyKey: `m01-expired-consume-${randomUUID()}`,
        }
      );
      expect(expiredConsume.statusCode).toBe(404);
      expect(expiredConsume.json().code).toBe('BINDING_NOT_FOUND');
    } finally {
      if (boundaryHarness) await boundaryHarness.close();
      for (const key of ttlKeys) {
        const value = previous[key];
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  });

  it('REM2-005-M01: context-shorter and equal TTL relations keep the public boundary aligned', async () => {
    const ttlKeys = [
      'IDENTITY_BINDING_CONTEXT_TTL_SECONDS',
      'IDENTITY_BINDING_ATTEMPT_TTL_SECONDS',
      'IDENTITY_BINDING_PAIRING_TTL_SECONDS',
    ] as const;
    const previous = Object.fromEntries(ttlKeys.map((key) => [key, process.env[key]]));

    try {
      for (const relation of [
        { label: 'context-shorter', contextTtl: 100, attemptTtl: 600 },
        { label: 'equal', contextTtl: 100, attemptTtl: 100 },
      ] as const) {
        process.env['IDENTITY_BINDING_CONTEXT_TTL_SECONDS'] = String(relation.contextTtl);
        process.env['IDENTITY_BINDING_ATTEMPT_TTL_SECONDS'] = String(relation.attemptTtl);
        process.env['IDENTITY_BINDING_PAIRING_TTL_SECONDS'] = '60';

        const matrixHarness = await buildBindingApp();
        try {
          const real = await createTarget(matrixHarness, `m01_${relation.label}_real`, {
            ageBand: 'UNDER_14',
          });
          const hidden = await createTarget(matrixHarness, `m01_${relation.label}_decoy`, {
            ageBand: 'UNDER_14',
          });
          const realBoot = await bootstrap(
            matrixHarness,
            real.invitationToken,
            `m01_${relation.label}_real_${randomUUID()}`
          );
          const hiddenBoot = await bootstrap(
            matrixHarness,
            hidden.invitationToken,
            `m01_${relation.label}_decoy_${randomUUID()}`
          );
          const realToken = realBoot.json().pendingContextToken as string;
          const hiddenToken = hiddenBoot.json().pendingContextToken as string;

          const ids = await matrixHarness.admin.query(
            `SELECT id, target_person_id
               FROM binding_attempts
              WHERE target_person_id = ANY($1::uuid[])`,
            [[real.targetPersonId, hidden.targetPersonId]]
          );
          const realAttemptId = ids.rows.find(
            (row: any) => row.target_person_id === real.targetPersonId
          ).id as string;
          const hiddenAttemptId = ids.rows.find(
            (row: any) => row.target_person_id === hidden.targetPersonId
          ).id as string;

          await matrixHarness.admin.query(
            `UPDATE binding_pending_contexts
                SET created_at = created_at - interval '90 seconds',
                    expires_at = expires_at - interval '90 seconds'
              WHERE attempt_id = ANY($1::uuid[])`,
            [[realAttemptId, hiddenAttemptId]]
          );
          await matrixHarness.admin.query(
            `UPDATE binding_attempts
                SET created_at = created_at - interval '90 seconds',
                    expires_at = expires_at - interval '90 seconds'
              WHERE id = ANY($1::uuid[])`,
            [[realAttemptId, hiddenAttemptId]]
          );

          const revoked = await revokeConsent(
            matrixHarness.app,
            hidden.guardian.token,
            `m01_${relation.label}_decoy`,
            hidden.consentId!
          );
          expect([200, 201]).toContain(revoked.statusCode);

          const before = await Promise.all([
            candidateDecision(
              matrixHarness,
              realToken,
              'AFFIRM',
              `m01-${relation.label}-real-before-${randomUUID()}`,
              'candidate-binding-v1'
            ),
            candidateDecision(
              matrixHarness,
              hiddenToken,
              'AFFIRM',
              `m01-${relation.label}-decoy-before-${randomUUID()}`,
              'candidate-binding-v1'
            ),
          ]);
          for (const res of before) {
            expect(res.statusCode, relation.label).toBe(200);
            expect(Object.keys(res.json()).sort(), relation.label).toEqual([
              'binding',
              'pairingChallenge',
            ]);
            expect(res.json().pairingChallenge, relation.label).toMatch(
              /^[A-Za-z0-9_-]{192}$/
            );
          }

          // Cross the public context boundary for both branches. When context
          // is the shorter lifetime, and when context==attempt, the transport
          // credential itself becomes invalid identically before any hidden
          // attempt fact can create a different candidate-facing transition.
          await matrixHarness.admin.query(
            `UPDATE binding_pending_contexts
                SET pairing_issuance_id = NULL,
                    pairing_issued_at = NULL,
                    pairing_expires_at = NULL,
                    expires_at = now() - interval '1 second'
              WHERE attempt_id = ANY($1::uuid[])`,
            [[realAttemptId, hiddenAttemptId]]
          );
          if (relation.label === 'equal') {
            await matrixHarness.admin.query(
              `UPDATE binding_attempts
                  SET expires_at = now() - interval '1 second'
                WHERE id = ANY($1::uuid[])`,
              [[realAttemptId, hiddenAttemptId]]
            );
          }

          const after = await Promise.all([
            candidateDecision(
              matrixHarness,
              realToken,
              'AFFIRM',
              `m01-${relation.label}-real-after-${randomUUID()}`,
              'candidate-binding-v1'
            ),
            candidateDecision(
              matrixHarness,
              hiddenToken,
              'AFFIRM',
              `m01-${relation.label}-decoy-after-${randomUUID()}`,
              'candidate-binding-v1'
            ),
          ]);
          expect(after[0].statusCode, relation.label).toBe(401);
          expect(after[1].statusCode, relation.label).toBe(401);
          expect(after[0].json(), relation.label).toEqual(after[1].json());
          expect(after[0].json().code, relation.label).toBe('BINDING_CONTEXT_INVALID');
        } finally {
          await matrixHarness.close();
        }
      }
    } finally {
      for (const key of ttlKeys) {
        const value = previous[key];
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  });

  it('true Case B mismatch (P1 bound to A, candidate authenticates as B) is generically indistinguishable', async () => {
    const target = await createTarget(h, 'enum_true_caseb', { ageBand: 'UNDER_14' });
    const codeA = `enum_true_caseb_a_${randomUUID()}`;
    const account = await h.admin.query(
      'INSERT INTO accounts (wechat_openid, session_epoch) VALUES ($1, 0) RETURNING id',
      [`fake_${codeA}`]
    );
    const boundAccountId = account.rows[0].id as string;
    await h.admin.query('UPDATE persons SET account_id = $1 WHERE id = $2', [
      boundAccountId,
      target.targetPersonId,
    ]);

    const baseline = observable(
      await bootstrap(h, `missing_${randomUUID()}`, `enum_true_base_${randomUUID()}`)
    );
    const codeB = `enum_true_caseb_b_${randomUUID()}`;
    const mismatchRes = await bootstrap(
      h,
      target.invitationToken,
      codeB,
      `enum_true_mismatch_${randomUUID()}`
    );
    const mismatch = observable(mismatchRes);
    expect(mismatch).toEqual(baseline);

    // No attempt, no confirmation, no rebind, no P1 leak.
    const attempts = await h.admin.query(
      'SELECT count(*)::int AS n FROM binding_attempts WHERE target_person_id = $1',
      [target.targetPersonId]
    );
    expect(attempts.rows[0].n).toBe(0);
    const confirmations = await h.admin.query(
      `SELECT count(*)::int AS n FROM binding_confirmations c
         JOIN binding_attempts a ON a.id = c.attempt_id
        WHERE a.target_person_id = $1`,
      [target.targetPersonId]
    );
    expect(confirmations.rows[0].n).toBe(0);
    expect(await personAccountId(h, target.targetPersonId)).toBe(boundAccountId);
    expect(mismatchRes.body).not.toContain(target.targetPersonId);
    expect(mismatchRes.body).not.toContain(boundAccountId);
  });

});
