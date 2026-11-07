/**
 * Shared integration-test helpers for the frozen OpenAPI shapes.
 *
 * All mutating commands take `Idempotency-Key` from the HTTP header and the
 * frozen request bodies (`creator`, `values`, `declaredAgeBand`, ...).
 */

import type { FastifyInstance } from 'fastify';

export function auth(token: string) {
  return { authorization: `Bearer ${token}` };
}

export function idemKey(prefix = 'key') {
  return `${prefix}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
}

export function commandHeaders(token: string, prefix = 'key'): Record<string, string> {
  return { ...auth(token), 'idempotency-key': idemKey(prefix) };
}

export interface LoginResult {
  token: string;
  personId: string;
  accountId: string;
  createdAt: string;
}

export async function login(
  app: FastifyInstance,
  code: string
): Promise<LoginResult> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/wechat',
    payload: { code },
  });
  if (res.statusCode !== 200) {
    throw new Error(`login failed: ${res.statusCode} ${res.body}`);
  }
  const body = res.json();
  return {
    token: body.sessionToken,
    personId: body.person.id,
    accountId: body.accountId,
    createdAt: body.person.createdAt,
  };
}

export async function loginWithLabel(app: FastifyInstance, label: string): Promise<LoginResult> {
  return login(app, `t_${label}_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`);
}

export function familyPayload(label: string, overrides: Record<string, unknown> = {}) {
  return {
    displayName: `家庭-${label}`,
    creator: {
      ageBand: 'ADULT',
      ageBandSource: 'SELF_STATEMENT',
      ...overrides,
    },
  };
}

export async function createFamily(
  app: FastifyInstance,
  token: string,
  label: string,
  creatorOverrides: Record<string, unknown> = {}
) {
  return app.inject({
    method: 'POST',
    url: '/api/v1/families',
    headers: commandHeaders(token, `fam-${label}`),
    payload: familyPayload(label, creatorOverrides),
  });
}

export function memberPayload(
  ageBand: string,
  ageBandSource: string,
  extra: Record<string, unknown> = {}
) {
  return { ageBand, ageBandSource, ...extra };
}

export async function createMember(
  app: FastifyInstance,
  token: string,
  familyId: string,
  label: string,
  payload: Record<string, unknown>
) {
  return app.inject({
    method: 'POST',
    url: `/api/v1/families/${familyId}/members`,
    headers: commandHeaders(token, `mem-${label}`),
    payload,
  });
}

export async function updateMember(
  app: FastifyInstance,
  token: string,
  familyId: string,
  personId: string,
  label: string,
  values: unknown
) {
  return app.inject({
    method: 'PATCH',
    url: `/api/v1/families/${familyId}/members/${personId}`,
    headers: commandHeaders(token, `upd-${label}`),
    payload: { values },
  });
}

export function consentRequestPayload(extra: Record<string, unknown> = {}) {
  return {
    declaredAgeBand: 'UNDER_14',
    noticeVersion: 'v1',
    channel: process.env['NODE_ENV'] === 'test' ? 'TEST' : 'MINIPROGRAM',
    ...extra,
  };
}

export async function createConsentRequest(
  app: FastifyInstance,
  token: string,
  label: string,
  extra: Record<string, unknown> = {}
) {
  return app.inject({
    method: 'POST',
    url: '/api/v1/compliance/guardian-consents/requests',
    headers: commandHeaders(token, `cr-${label}`),
    payload: consentRequestPayload(extra),
  });
}

export async function grantConsent(
  app: FastifyInstance,
  token: string,
  label: string,
  onboardingRequestId: string
) {
  return app.inject({
    method: 'POST',
    url: '/api/v1/compliance/guardian-consents',
    headers: commandHeaders(token, `cg-${label}`),
    payload: {
      onboardingRequestId,
      noticeVersion: 'v1',
      accepted: true,
    },
  });
}

export async function revokeConsent(
  app: FastifyInstance,
  token: string,
  label: string,
  consentId: string,
  extra: Record<string, unknown> = {}
) {
  return app.inject({
    method: 'POST',
    url: `/api/v1/consents/${consentId}/revoke`,
    headers: commandHeaders(token, `rv-${label}`),
    payload: extra,
  });
}

export function valueInput(
  value: string,
  source = 'GUARDIAN_RELAY',
  extra: Record<string, unknown> = {}
) {
  return { attribute: 'DISPLAY_NAME', value, source, ...extra };
}