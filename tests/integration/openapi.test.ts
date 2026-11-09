/**
 * T066 (F5): real OpenAPI contract tests.
 *
 * The frozen YAML is the Source of Truth. These tests prove the generated
 * artifact carries real components/schemas AND that the live endpoints accept
 * requests built from the frozen shapes (and reject the old flat shapes).
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type pg from 'pg';
import { buildApp } from '../../apps/server/api/src/app.js';
import { createAdminPool } from '../setup/db.js';
import {
  auth,
  commandHeaders,
  createConsentRequest,
  createFamily,
  createMember,
  grantConsent,
  loginWithLabel,
  revokeConsent,
  updateMember,
} from '../setup/api.js';

const ROOT = join(import.meta.dirname, '..', '..');
const SPEC_PATH = join(ROOT, 'packages', 'generated', 'openapi.json');

const FROZEN_SCHEMAS = [
  'AgeBand',
  'BindingBootstrapCommittedResponse',
  'BindingBootstrapGenericResponse',
  'BindingBootstrapRequest',
  'BindingBootstrapReusedResponse',
  'BindingCandidateDecisionRequest',
  'BindingCandidatePairingResponse',
  'BindingConfirmerDecisionRequest',
  'BindingConfirmerDecisionResponse',
  'BindingContextInvalidError',
  'BindingGenericResponse',
  'BindingNotFoundError',
  'BindingPendingListResponse',
  'BindingSessionCommittedResponse',
  'BindingStatusResponse',
  'CaseAccessDeniedError',
  'CaseParticipationState',
  'CaseListResponse',
  'CaseMessageResponse',
  'CaseNotFoundError',
  'CasePhase',
  'CaseResponse',
  'CaseStatus',
  'ComplianceProfile',
  'ComplianceProfileSummary',
  'ConsentRecord',
  'ConsentRequestResponse',
  'CreateCaseMessageRequest',
  'CreateCaseRequest',
  'CreateConsentRequestRequest',
  'CreateFamilyRequest',
  'CreateMemberRequest',
  'CreateParticipationInviteRequest',
  'CreateParticipationInviteResponse',
  'CreatorInput',
  'CurrentFamilyAmbiguousError',
  'CurrentFamilyNotFoundError',
  'Error',
  'FamilyResponse',
  'GrantConsentRequest',
  'IdempotencyPayloadMismatchError',
  'InternalError',
  'InvitationNotAvailableError',
  'LoginResponse',
  'MeResponse',
  'MemberResponse',
  'Notice',
  'ParticipationAlreadyExistsError',
  'ParticipationInvitePublicView',
  'ParticipationNotFoundError',
  'ParticipationNotice',
  'ParticipationResource',
  'ParticipationStateConflictError',
  'ParticipationTargetIneligibleError',
  'PersonSummary',
  'ProfileAttribute',
  'ProfileValue',
  'ProvenanceValueInput',
  'UnauthenticatedError',
  'UpdateMemberRequest',
  'ValidationError',
  'WithdrawParticipationRequest',
  'DeclineParticipationRequest',
  'AcceptParticipationRequest',
  'WritableSource',
];

describe('OpenAPI Contract (T066 / F5)', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let verifyPool: pg.Pool;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
    verifyPool = createAdminPool();
  });

  afterAll(async () => {
    await verifyPool.end();
    await app.close();
  });

  it('generated spec has real components/schemas matching the frozen contract', () => {
    expect(existsSync(SPEC_PATH)).toBe(true);
    const spec = JSON.parse(readFileSync(SPEC_PATH, 'utf-8'));
    expect(spec.openapi).toBe('3.1.0');

    const schemas = spec.components?.schemas ?? {};
    expect(Object.keys(schemas).sort()).toEqual([...FROZEN_SCHEMAS].sort());
    for (const name of FROZEN_SCHEMAS) {
      expect(schemas[name], `missing schema ${name}`).toBeDefined();
      expect(
        schemas[name].type ??
          schemas[name].$ref ??
          schemas[name].oneOf ??
          schemas[name].anyOf
      ).toBeDefined();
    }
  });

  it('contains exactly the 29 frozen business operations including Slice 4 six participation surfaces)', () => {    const spec = JSON.parse(readFileSync(SPEC_PATH, 'utf-8'));
    const operations: string[] = [];
    for (const [path, methods] of Object.entries<any>(spec.paths)) {
      for (const method of Object.keys(methods)) {
        if (['get', 'post', 'put', 'patch', 'delete'].includes(method)) {
          operations.push(`${method.toUpperCase()} ${path}`);
        }
      }
    }
    expect(operations.sort()).toEqual([
      'GET /api/v1/cases',
      'GET /api/v1/cases/{id}',
      'GET /api/v1/compliance/notices',
      'GET /api/v1/compliance/profile',
      'GET /api/v1/consents',
      'GET /api/v1/families/current',
      'GET /api/v1/identity-bindings/pending',
      'GET /api/v1/identity-bindings/status',
      'GET /api/v1/me',
      'GET /api/v1/participation-invites/{token}',
      'GET /api/v1/participations/{id}',
      'PATCH /api/v1/families/{id}/members/{personId}',
      'POST /api/v1/auth/logout',
      'POST /api/v1/auth/wechat',
      'POST /api/v1/cases',
      'POST /api/v1/cases/{id}/messages',
      'POST /api/v1/cases/{id}/participation-invites',
      'POST /api/v1/compliance/guardian-consents',
      'POST /api/v1/compliance/guardian-consents/requests',
      'POST /api/v1/consents/{id}/revoke',
      'POST /api/v1/families',
      'POST /api/v1/families/{id}/members',
      'POST /api/v1/identity-bindings/bootstrap',
      'POST /api/v1/identity-bindings/candidate-decision',
      'POST /api/v1/identity-bindings/session',
      'POST /api/v1/identity-bindings/pairing-decision',
      'POST /api/v1/participation-invites/{token}/accept',
      'POST /api/v1/participations/{id}/decline',
      'POST /api/v1/participations/{id}/withdraw',
    ].sort());
  });

  it('every mutating command declares the Idempotency-Key header parameter', () => {
    const spec = JSON.parse(readFileSync(SPEC_PATH, 'utf-8'));
    const commands = [
      ['post', '/api/v1/families'],
      ['post', '/api/v1/families/{id}/members'],
      ['patch', '/api/v1/families/{id}/members/{personId}'],
      ['post', '/api/v1/compliance/guardian-consents/requests'],
      ['post', '/api/v1/compliance/guardian-consents'],
      ['post', '/api/v1/consents/{id}/revoke'],
      ['post', '/api/v1/cases'],
      ['post', '/api/v1/cases/{id}/messages'],
    ] as const;
    for (const [method, path] of commands) {
      const params = spec.paths[path][method].parameters ?? [];
      const hasHeader = params.some((p: any) =>
        p.$ref === '#/components/parameters/IdempotencyKey' ||
        p.$ref === '#/components/parameters/IdempotencyKeyHeader'
      );
      expect(hasHeader, `${method.toUpperCase()} ${path} missing Idempotency-Key`).toBe(true);
    }
  });

  it('no unplanned business endpoints', () => {
    const spec = JSON.parse(readFileSync(SPEC_PATH, 'utf-8'));
    const allowedPaths = new Set([
      '/healthz',
      '/api/v1/auth/wechat',
      '/api/v1/auth/logout',
      '/api/v1/me',
      '/api/v1/families',
      '/api/v1/families/current',
      '/api/v1/families/{id}/members',
      '/api/v1/families/{id}/members/{personId}',
      '/api/v1/compliance/guardian-consents/requests',
      '/api/v1/compliance/guardian-consents',
      '/api/v1/consents/{id}/revoke',
      '/api/v1/consents',
      '/api/v1/compliance/profile',
      '/api/v1/compliance/notices',
      // Slice 2 (002-case-core) — three Case operations.
      '/api/v1/cases',
      '/api/v1/cases/{id}',
      // Business Slice 5 (repo feature 006) — exactly six binding surfaces.
      '/api/v1/identity-bindings/bootstrap',
      '/api/v1/identity-bindings/candidate-decision',
      '/api/v1/identity-bindings/status',
      '/api/v1/identity-bindings/session',
      '/api/v1/identity-bindings/pending',
      '/api/v1/identity-bindings/pairing-decision',
      // Slice 3 (003-evidence-core) — the single approved message POST.
      '/api/v1/cases/{id}/messages',
      // Slice 4 — exactly six participation surfaces.
      '/api/v1/cases/{id}/participation-invites',
      '/api/v1/participation-invites/{token}',
      '/api/v1/participation-invites/{token}/accept',
      '/api/v1/participations/{id}/decline',
      '/api/v1/participations/{id}/withdraw',
      '/api/v1/participations/{id}',
    ]);
    for (const path of Object.keys(spec.paths)) {
      expect(allowedPaths, `Unplanned endpoint: ${path}`).toContain(path);
    }
  });

  it('live endpoints accept the frozen request shapes', async () => {
    const actor = await loginWithLabel(app, 'oapi_flow');

    const family = await createFamily(app, actor.token, 'oapi-flow');
    expect(family.statusCode).toBe(201);
    const familyId = family.json().id as string;

    const member = await createMember(app, actor.token, familyId, 'oapi-flow', {
      ageBand: 'MINOR_14_17',
      ageBandSource: 'GUARDIAN_OBSERVATION',
      values: [{ attribute: 'DISPLAY_NAME', value: '小明', source: 'GUARDIAN_OBSERVATION' }],
    });
    expect(member.statusCode).toBe(201);
    const personId = member.json().personId as string;

    const patch = await updateMember(app, actor.token, familyId, personId, 'oapi-flow', [
      { attribute: 'DISPLAY_NAME', value: '小明明', source: 'GUARDIAN_OBSERVATION' },
    ]);
    expect(patch.statusCode).toBe(200);

    const req = await createConsentRequest(app, actor.token, 'oapi-flow');
    expect(req.statusCode).toBe(201);

    const grant = await grantConsent(app, actor.token, 'oapi-flow', req.json().requestId);
    expect(grant.statusCode).toBe(201);

    const revoke = await revokeConsent(app, actor.token, 'oapi-flow', grant.json().id);
    expect(revoke.statusCode).toBe(200);
  });

  it('old flat field names are rejected with 422 (no dual long-term API)', async () => {
    const actor = await loginWithLabel(app, 'oapi_old');

    // Old body-level idempotencyKey + flat creator fields.
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/families',
      headers: auth(actor.token),
      payload: {
        displayName: '旧字段',
        ageBand: 'ADULT',
        ageBandSource: 'SELF_STATEMENT',
        idempotencyKey: 'legacy-key-123',
      },
    });
    expect(res.statusCode).toBe(422);

    const family = await createFamily(app, actor.token, 'oapi-old');
    expect(family.statusCode).toBe(201);

    // Old profileValues / valueText / sourceKind member shape.
    const member = await app.inject({
      method: 'POST',
      url: `/api/v1/families/${family.json().id}/members`,
      headers: commandHeaders(actor.token, 'oapi-old-m'),
      payload: {
        ageBand: 'MINOR_14_17',
        ageBandSource: 'GUARDIAN_OBSERVATION',
        profileValues: [
          { attribute: 'DISPLAY_NAME', valueText: '旧', sourceKind: 'GUARDIAN_OBSERVATION' },
        ],
      },
    });
    expect(member.statusCode).toBe(422);
  });

  it('header idempotency replays the original response', async () => {
    const actor = await loginWithLabel(app, 'oapi_replay');
    const key = `oapi-replay-${Date.now()}`;
    const payload = {
      displayName: '幂等家庭',
      creator: { ageBand: 'ADULT', ageBandSource: 'SELF_STATEMENT' },
    };

    const first = await app.inject({
      method: 'POST',
      url: '/api/v1/families',
      headers: { ...auth(actor.token), 'idempotency-key': key },
      payload,
    });
    expect(first.statusCode).toBe(201);

    const replay = await app.inject({
      method: 'POST',
      url: '/api/v1/families',
      headers: { ...auth(actor.token), 'idempotency-key': key },
      payload,
    });
    expect(replay.statusCode).toBe(201);
    expect(replay.json()).toEqual(first.json());
  });
});