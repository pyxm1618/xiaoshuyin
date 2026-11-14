/**
 * Shared Slice 006 integration-test harness.
 *
 * Uses the REAL Fastify app and REAL PostgreSQL. Slice 5 isolation suites
 * intentionally inject the contract-level `InMemoryInvitationPort`; production
 * defaults to `Slice4InvitationPort` (T121). `buildParticipationApp()` without
 * an injected port exercises that real adapter.
 */

import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import pg from 'pg';
import { buildApp } from '../../apps/server/api/src/app.js';
import {
  InMemoryInvitationPort,
  type InvitationResolution,
} from '../../apps/server/api/src/identity-binding/invitation-port.js';
import { encodePairingChallenge } from '../../apps/server/api/src/identity-binding/crypto.js';
import { createAdminPool } from './db.js';
import {
  createConsentRequest,
  createFamily,
  createMember,
  grantConsent,
  loginWithLabel,
  type LoginResult,
} from './api.js';

export interface BindingHarness {
  app: FastifyInstance;
  port: InMemoryInvitationPort;
  admin: pg.Pool;
  close(): Promise<void>;
}

/**
 * Minimal real-runtime view. Suites that use the production Slice 4 adapter
 * do not inject `port`, but still need the app + admin observer.
 */
export type BindingRuntime = Pick<BindingHarness, 'app' | 'admin'>;

/**
 * Test-only replay memory: the real server never persists raw challenge bytes,
 * so a replay test that wants to submit the exact original request must keep
 * the candidate-presented value it received. Keyed by authoritative attempt id.
 */
const issuedChallenges = new Map<string, string>();

/** Application-role pool (NOBYPASSRLS), for direct repository / RLS tests. */
export function createAppPool(max = 4): pg.Pool {
  return new pg.Pool({ connectionString: process.env['DATABASE_URL'], max });
}

export async function buildBindingApp(): Promise<BindingHarness> {
  const port = new InMemoryInvitationPort();
  const app = await buildApp({ identityBinding: { invitationPort: port } });
  await app.ready();
  // Domain-level suites may run without the test-only superuser URL. They do
  // not need cross-tenant inspection; falling back to the app pool keeps the
  // file runnable there instead of failing the whole domain suite on a missing
  // TEST_ADMIN_DATABASE_URL. DB/integration suites still set the admin URL.
  const admin = process.env['TEST_ADMIN_DATABASE_URL'] ? createAdminPool() : createAppPool();
  return {
    app,
    port,
    admin,
    async close() {
      await app.close();
      await admin.end();
    },
  };
}

export interface TargetFixture {
  guardian: LoginResult;
  familyId: string;
  targetPersonId: string;
  invitationToken: string;
  participationId: string;
  consentId?: string;
}

export interface CreateTargetOptions {
  ageBand: 'UNDER_14' | 'MINOR_14_17' | 'ADULT' | 'UNKNOWN';
  guardianToken?: string;
  /** Additional Family memberships for the target (multi-family fixture). */
  extraFamilyIds?: string[];
}

/**
 * Create a real, unbound Person P1 through the existing Slice 1 API, then
 * register an invitation fixture pointing at P1 / its Family.
 */
export async function createTarget(
  h: BindingHarness,
  label: string,
  opts: CreateTargetOptions
): Promise<TargetFixture> {
  const guardian = await loginWithLabel(h.app, `guardian_${label}`);
  const famRes = await createFamily(h.app, guardian.token, label);
  if (famRes.statusCode !== 201) {
    throw new Error(`family create failed: ${famRes.statusCode} ${famRes.body}`);
  }
  const familyId = famRes.json().id as string;

  let consentId: string | undefined;
  let targetRes;
  if (opts.ageBand === 'UNDER_14') {
    const reqRes = await createConsentRequest(h.app, guardian.token, label);
    if (reqRes.statusCode !== 201) {
      throw new Error(`consent request failed: ${reqRes.statusCode} ${reqRes.body}`);
    }
    const grantRes = await grantConsent(h.app, guardian.token, label, reqRes.json().requestId);
    if (grantRes.statusCode !== 201 && grantRes.statusCode !== 200) {
      throw new Error(`consent grant failed: ${grantRes.statusCode} ${grantRes.body}`);
    }
    consentId = grantRes.json().id as string;
    targetRes = await createMember(h.app, guardian.token, familyId, label, {
      ageBand: 'UNDER_14',
      ageBandSource: 'GUARDIAN_RELAY',
      guardianConsentId: consentId,
    });
  } else {
    // Formal member onboarding now correctly refuses UNKNOWN. Binding tests
    // still need an already-existing UNKNOWN profile to prove the independent
    // identity-binding fail-closed matrix, so create a legal fixture first and
    // mutate only the test database into that pre-existing state.
    const onboardingAgeBand = opts.ageBand === 'UNKNOWN' ? 'MINOR_14_17' : opts.ageBand;
    targetRes = await createMember(h.app, guardian.token, familyId, label, {
      ageBand: onboardingAgeBand,
      ageBandSource: onboardingAgeBand === 'ADULT' ? 'SELF_STATEMENT' : 'GUARDIAN_RELAY',
    });
  }

  if (targetRes.statusCode !== 201) {
    throw new Error(`member create failed: ${targetRes.statusCode} ${targetRes.body}`);
  }
  const targetPersonId = targetRes.json().personId as string;
  if (opts.ageBand === 'UNKNOWN') {
    await h.admin.query(
      `UPDATE person_compliance_profiles
          SET age_band='UNKNOWN', minor_mode=false, guardian_person_id=NULL,
              guardian_consent_version=NULL, guardian_consent_record_id=NULL,
              updated_at=now()
        WHERE person_id=$1`,
      [targetPersonId]
    );
  }

  for (const extraFamilyId of opts.extraFamilyIds ?? []) {
    await h.admin.query(
      'INSERT INTO family_members (family_id, person_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [extraFamilyId, targetPersonId]
    );
  }

  const invitationToken = `invite_${label}_${randomUUID()}`;
  const participationId = randomUUID();
  h.port.add(invitationToken, {
    status: 'VALID',
    participationId,
    targetPersonId,
    targetFamilyId: familyId,
    expiresAt: new Date(Date.now() + 3600_000).toISOString(),
  });

  return {
    guardian,
    familyId,
    targetPersonId,
    invitationToken,
    participationId,
    consentId,
  };
}

export async function bootstrap(
  h: BindingRuntime,
  invitationToken: string,
  code: string,
  idempotencyKey = `boot-${randomUUID()}`
) {
  return h.app.inject({
    method: 'POST',
    url: '/api/v1/identity-bindings/bootstrap',
    payload: { code, invitationToken, idempotencyKey },
  });
}

export async function candidateDecision(
  h: BindingRuntime,
  contextToken: string,
  decision: 'AFFIRM' | 'REJECT' | 'CANCEL',
  idempotencyKey = `dec-${randomUUID()}`,
  confirmationVersion?: string
) {
  return h.app.inject({
    method: 'POST',
    url: '/api/v1/identity-bindings/candidate-decision',
    headers: { 'x-binding-context': contextToken },
    payload: {
      decision,
      ...(confirmationVersion ? { confirmationVersion } : {}),
      idempotencyKey,
    },
  });
}

export async function candidateStatus(h: BindingRuntime, contextToken: string) {
  return h.app.inject({
    method: 'GET',
    url: '/api/v1/identity-bindings/status',
    headers: { 'x-binding-context': contextToken },
  });
}

export async function candidateSession(h: BindingRuntime, contextToken: string) {
  return h.app.inject({
    method: 'POST',
    url: '/api/v1/identity-bindings/session',
    headers: { 'x-binding-context': contextToken },
  });
}

export async function confirmerList(
  h: BindingRuntime,
  token: string,
  targetPersonId: string
) {
  return h.app.inject({
    method: 'GET',
    url: `/api/v1/identity-bindings/pending?personId=${targetPersonId}`,
    headers: { authorization: `Bearer ${token}` },
  });
}

/**
 * Test harness convenience: the argument is either an exact 192-character
 * pairing challenge or an attemptId for legacy tests/setup helpers. In the
 * latter case the harness reconstructs the current issuance envelope from the
 * real DB row and the test secret; the production route still accepts ONLY the
 * pairingChallenge.
 */
export async function confirmerDecision(
  h: BindingRuntime,
  token: string,
  selector: string,
  input: {
    personId: string;
    decision: 'AFFIRM' | 'REJECT';
    targetConfirmed?: boolean;
    candidateRecognized?: boolean;
    confirmationVersion?: string;
    idempotencyKey?: string;
  }
) {
  let pairingChallenge = selector;
  if (!/^[A-Za-z0-9_-]{192}$/.test(pairingChallenge)) {
    const cached = issuedChallenges.get(pairingChallenge);
    if (cached) {
      pairingChallenge = cached;
    } else {
      const { rows } = await h.admin.query(
        `SELECT b.id AS attempt_id, b.target_person_id, b.candidate_identity_digest,
                b.invitation_participation_id, c.id AS context_id,
                c.pairing_issuance_id, c.pairing_issued_at, c.pairing_expires_at
           FROM binding_attempts b
           JOIN binding_pending_contexts c ON c.attempt_id = b.id
          WHERE b.id = $1 AND c.pairing_issuance_id IS NOT NULL
          ORDER BY c.created_at DESC LIMIT 1`,
        [selector]
      );
      if (!rows[0]) {
        return h.app.inject({
          method: 'POST',
          url: '/api/v1/identity-bindings/pairing-decision',
          headers: { authorization: `Bearer ${token}` },
          payload: {
            personId: input.personId,
            pairingChallenge: 'A'.repeat(192),
            decision: input.decision,
            targetConfirmed: input.targetConfirmed ?? input.decision === 'AFFIRM',
            candidateRecognized: input.candidateRecognized ?? input.decision === 'AFFIRM',
            confirmationVersion: input.confirmationVersion ?? 'second-party-recognition-v1',
            idempotencyKey: input.idempotencyKey ?? `sp-${randomUUID()}`,
          },
        });
      }
      pairingChallenge = encodePairingChallenge(
        process.env['IDENTITY_BINDING_SECRET']!,
        {
          contextId: rows[0].context_id,
          candidateIdentityDigest: rows[0].candidate_identity_digest,
          attemptId: rows[0].attempt_id,
          targetPersonId: rows[0].target_person_id,
          invitationParticipationId: rows[0].invitation_participation_id,
          pairingIssuanceId: rows[0].pairing_issuance_id,
          pairingIssuedAt: rows[0].pairing_issued_at,
          pairingExpiresAt: rows[0].pairing_expires_at,
        }
      );
      issuedChallenges.set(selector, pairingChallenge);
    }
  } else {
    // Learn the attempt binding for later replays of this exact challenge.
    const { rows } = await h.admin.query(
      'SELECT id FROM binding_attempts WHERE target_person_id = $1 ORDER BY created_at DESC LIMIT 1',
      [input.personId]
    );
    if (rows[0]?.id) issuedChallenges.set(rows[0].id as string, pairingChallenge);
  }
  return h.app.inject({
    method: 'POST',
    url: '/api/v1/identity-bindings/pairing-decision',
    headers: { authorization: `Bearer ${token}` },
    payload: {
      personId: input.personId,
      pairingChallenge,
      decision: input.decision,
      targetConfirmed: input.targetConfirmed ?? input.decision === 'AFFIRM',
      candidateRecognized: input.candidateRecognized ?? input.decision === 'AFFIRM',
      confirmationVersion: input.confirmationVersion ?? 'second-party-recognition-v1',
      idempotencyKey: input.idempotencyKey ?? `sp-${randomUUID()}`,
    },
  });
}

export async function personAccountId(
  h: BindingRuntime,
  personId: string
): Promise<string | null> {
  const { rows } = await h.admin.query('SELECT account_id FROM persons WHERE id = $1', [
    personId,
  ]);
  return rows[0]?.account_id ?? null;
}

/**
 * Drive bootstrap + candidate AFFIRM and return the pending context + attempt.
 */
export async function startBinding(
  h: BindingRuntime,
  target: TargetFixture,
  code: string
): Promise<{ contextToken: string; attemptId: string; pairingChallenge: string }> {
  const boot = await bootstrap(h, target.invitationToken, code);
  if (boot.statusCode !== 200) {
    throw new Error(`bootstrap failed: ${boot.statusCode} ${boot.body}`);
  }
  const contextToken = boot.json().pendingContextToken as string;
  const decision = await candidateDecision(h, contextToken, 'AFFIRM', undefined, 'candidate-binding-v1');
  if (decision.statusCode !== 200 || decision.json().binding !== 'NOT_COMPLETED') {
    throw new Error(`candidate decision failed: ${decision.statusCode} ${decision.body}`);
  }
  const { rows } = await h.admin.query(
    'SELECT id FROM binding_attempts WHERE target_person_id = $1 ORDER BY created_at DESC LIMIT 1',
    [target.targetPersonId]
  );
  if (!rows[0]) throw new Error('no attempt created');
  const attemptId = rows[0].id as string;
  const pairingChallenge = decision.json().pairingChallenge as string;
  if (pairingChallenge) issuedChallenges.set(attemptId, pairingChallenge);
  return {
    contextToken,
    attemptId,
    pairingChallenge,
  };
}

export function invitation(
  targetPersonId: string,
  targetFamilyId: string
): InvitationResolution {
  return {
    status: 'VALID',
    participationId: randomUUID(),
    targetPersonId,
    targetFamilyId,
    expiresAt: new Date(Date.now() + 3600_000).toISOString(),
  };
}