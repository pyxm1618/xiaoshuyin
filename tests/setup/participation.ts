/**
 * Shared Slice 4 participation integration helpers.
 *
 * These helpers use only the public API for business setup except where a test
 * explicitly needs an application-independent observer (admin pool).
 */
import type { FastifyInstance } from 'fastify';
import pg from 'pg';
import { buildApp } from '../../apps/server/api/src/app.js';
import type { InvitationResolutionPort } from '../../apps/server/api/src/identity-binding/invitation-port.js';
import { createAdminPool } from './db.js';
import {
  auth,
  commandHeaders,
  createFamily,
  createMember,
  idemKey,
  loginWithLabel,
  memberPayload,
  type LoginResult,
} from './api.js';

export interface ParticipationHarness {
  app: FastifyInstance;
  admin: pg.Pool;
  close(): Promise<void>;
}

export interface ParticipationFixture {
  manager: LoginResult;
  familyId: string;
  caseId: string;
  targetPersonId: string;
}

export async function buildParticipationApp(
  invitationPort?: InvitationResolutionPort
): Promise<ParticipationHarness> {
  const app = await buildApp(
    invitationPort ? { identityBinding: { invitationPort } } : undefined
  );
  await app.ready();
  const admin = createAdminPool();
  return {
    app,
    admin,
    async close() {
      await admin.end();
      await app.close();
    },
  };
}

export async function createCase(app: FastifyInstance, token: string, label: string) {
  return app.inject({
    method: 'POST',
    url: '/api/v1/cases',
    headers: commandHeaders(token, `case-${label}`),
    payload: {},
  });
}

export async function createParticipationFixture(
  h: ParticipationHarness,
  label: string,
  opts: {
    target?: 'manager' | 'member';
    ageBand?: 'ADULT' | 'MINOR_14_17' | 'UNDER_14' | 'UNKNOWN';
    ageBandSource?: string;
    memberExtra?: Record<string, unknown>;
  } = {}
): Promise<ParticipationFixture> {
  const manager = await loginWithLabel(h.app, `s4-manager-${label}`);
  const family = await createFamily(h.app, manager.token, `s4-${label}`);
  if (family.statusCode !== 201) {
    throw new Error(`family create failed: ${family.statusCode} ${family.body}`);
  }
  const familyId = family.json().id as string;

  let targetPersonId = manager.personId;
  if ((opts.target ?? 'member') === 'member') {
    const member = await createMember(
      h.app,
      manager.token,
      familyId,
      `s4-target-${label}`,
      memberPayload(
        opts.ageBand ?? 'ADULT',
        opts.ageBandSource ?? 'GUARDIAN_RELAY',
        opts.memberExtra ?? {}
      )
    );
    if (member.statusCode !== 201) {
      throw new Error(`member create failed: ${member.statusCode} ${member.body}`);
    }
    targetPersonId = member.json().personId as string;
  }

  const c = await createCase(h.app, manager.token, label);
  if (c.statusCode !== 201) {
    throw new Error(`case create failed: ${c.statusCode} ${c.body}`);
  }

  return {
    manager,
    familyId,
    caseId: c.json().id as string,
    targetPersonId,
  };
}

export async function addBoundAdultNonManagerToFamily(
  h: ParticipationHarness,
  familyId: string,
  label: string
): Promise<LoginResult> {
  const target = await loginWithLabel(h.app, `s4-non-manager-${label}`);
  await h.admin.query(
    `INSERT INTO person_compliance_profiles
       (person_id,age_band,minor_mode,guardian_person_id,
        guardian_consent_version,guardian_consent_record_id,verified_source)
     VALUES ($1,'ADULT',false,NULL,NULL,NULL,'SELF_STATEMENT')
     ON CONFLICT (person_id) DO UPDATE
       SET age_band='ADULT',
           minor_mode=false,
           guardian_person_id=NULL,
           guardian_consent_version=NULL,
           guardian_consent_record_id=NULL,
           verified_source='SELF_STATEMENT',
           updated_at=now()`,
    [target.personId]
  );
  await h.admin.query(
    `INSERT INTO family_members (family_id, person_id)
     VALUES ($1,$2) ON CONFLICT DO NOTHING`,
    [familyId, target.personId]
  );
  return target;
}

export async function addBoundAdultTargetToFamily(
  h: ParticipationHarness,
  familyId: string,
  label: string
): Promise<LoginResult> {
  const target = await loginWithLabel(h.app, `s4-bound-target-${label}`);
  // Use the public Family flow to establish the target's own verified ADULT
  // compliance profile. The direct membership insert is fixture setup only.
  const ownFamily = await createFamily(h.app, target.token, `s4-target-own-${label}`);
  if (ownFamily.statusCode !== 201) {
    throw new Error(
      `target family create failed: ${ownFamily.statusCode} ${ownFamily.body}`
    );
  }
  await h.admin.query(
    `INSERT INTO family_members (family_id, person_id)
     VALUES ($1,$2) ON CONFLICT DO NOTHING`,
    [familyId, target.personId]
  );
  return target;
}

export async function invite(
  app: FastifyInstance,
  token: string,
  caseId: string,
  personId: string,
  idempotencyKey = idemKey('s4-invite')
) {
  return app.inject({
    method: 'POST',
    url: `/api/v1/cases/${caseId}/participation-invites`,
    headers: auth(token),
    payload: { personId, idempotencyKey },
  });
}

export async function lookupInvite(app: FastifyInstance, inviteToken: string) {
  return app.inject({
    method: 'GET',
    url: `/api/v1/participation-invites/${encodeURIComponent(inviteToken)}`,
  });
}

export async function acceptInvite(
  app: FastifyInstance,
  token: string,
  inviteToken: string,
  idempotencyKey = idemKey('s4-accept')
) {
  return app.inject({
    method: 'POST',
    url: `/api/v1/participation-invites/${encodeURIComponent(inviteToken)}/accept`,
    headers: auth(token),
    payload: { idempotencyKey },
  });
}

export async function declineParticipation(
  app: FastifyInstance,
  token: string,
  participationId: string,
  idempotencyKey = idemKey('s4-decline')
) {
  return app.inject({
    method: 'POST',
    url: `/api/v1/participations/${participationId}/decline`,
    headers: auth(token),
    payload: { idempotencyKey },
  });
}

export async function withdrawParticipation(
  app: FastifyInstance,
  token: string,
  participationId: string,
  idempotencyKey = idemKey('s4-withdraw')
) {
  return app.inject({
    method: 'POST',
    url: `/api/v1/participations/${participationId}/withdraw`,
    headers: auth(token),
    payload: { idempotencyKey },
  });
}

export async function getParticipation(
  app: FastifyInstance,
  token: string,
  participationId: string
) {
  return app.inject({
    method: 'GET',
    url: `/api/v1/participations/${participationId}`,
    headers: auth(token),
  });
}
