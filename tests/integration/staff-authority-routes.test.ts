import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../apps/server/api/src/app.js';
import { createAdminPool } from '../setup/db.js';
import { createSafetyFixture, type ActorSession } from '../setup/safety.js';

const mePath = '/api/v1/staff/me';
const grantsPath = '/api/v1/staff/capability-grants';
const revokePath = (id: string) => `${grantsPath}/${id}/revoke`;
const prefix = 'c3_http_';

interface RuntimeSchema {
  toJSONSchema(options: { io: 'output'; target: 'draft-2020-12'; unrepresentable: 'any' }): Record<string, unknown>;
}

interface StaffRouteSchema {
  operationId: string;
  body?: RuntimeSchema;
  response: Record<string, RuntimeSchema>;
}

describe('C3 production Staff routes', () => {
  let fixture: ReturnType<typeof createSafetyFixture>;
  let operator: ActorSession;
  let familyManager: ActorSession;
  let familyId: string;
  const registered = new Map<string, StaffRouteSchema>();
  const past = new Date(Date.now() - 60_000).toISOString();
  const expired = new Date(Date.now() - 30_000).toISOString();
  const future = new Date(Date.now() + 3_600_000).toISOString();
  const identity = ({ accountId, personId }: ActorSession) => ({ accountId, personId });
  const grantInput = (target: ActorSession) => ({
    ...identity(target), capability: 'SAFETY_RESOLVE', scope: 'GLOBAL', validFrom: past, validUntil: null,
  });
  const headers = (actor: ActorSession | null, key?: string) => ({
    ...(actor ? { authorization: `Bearer ${actor.token}` } : {}),
    ...(key ? { 'idempotency-key': key } : {}),
  });

  async function seed(
    actor: ActorSession, capability: string,
    { validFrom = past, validUntil = null, revoked = false }: {
      validFrom?: string; validUntil?: string | null; revoked?: boolean;
    } = {},
  ) {
    await fixture.admin.query(
      `INSERT INTO staff_assignments
         (account_id, person_id, capability, scope_type, granted_by_account_id,
          valid_from, valid_until, revoked_by_account_id, revoked_at)
       VALUES ($1,$2,$3,'GLOBAL',$1,$4,$5,
               CASE WHEN $6 THEN $1::uuid ELSE NULL END, CASE WHEN $6 THEN clock_timestamp() ELSE NULL END)`,
      [actor.accountId, actor.personId, capability, validFrom, validUntil, revoked],
    );
  }

  beforeAll(async () => {
    const app = await buildApp({
      onRoute(route) {
        if (route.url.startsWith('/api/v1/staff/') && route.method !== 'HEAD') {
          registered.set(`${route.method} ${route.url}`, route.schema as StaffRouteSchema);
        }
      },
    });
    await app.ready();
    fixture = createSafetyFixture({ app, admin: createAdminPool(), prefix });
    operator = await fixture.login('operator');
    familyManager = await fixture.login('manager');
    familyId = await fixture.createFamily(familyManager, 'staff-http');
    await seed(operator, 'SERVICE_CONTROL');
  });

  afterAll(async () => {
    if (!fixture) return;
    await fixture.admin.query(
      `DELETE FROM business_audit_events WHERE resource_type='STAFF_ASSIGNMENT'
       AND actor_account_id = $1`, [operator.accountId],
    );
    await fixture.admin.query(
      `DELETE FROM staff_assignments WHERE account_id IN
       (SELECT id FROM accounts WHERE starts_with(wechat_openid, $1))`, [prefix],
    );
    await fixture.cleanup();
    await fixture.close();
    await fixture.app.close();
    await fixture.admin.end();
  });

  const me = (actor: ActorSession | null) => fixture.app.inject({ method: 'GET', url: mePath, headers: headers(actor) });
  const grant = (actor: ActorSession | null, payload: object, key = randomUUID()) =>
    fixture.app.inject({ method: 'POST', url: grantsPath, headers: headers(actor, key), payload });
  const revoke = (actor: ActorSession | null, id: string, key = randomUUID()) =>
    fixture.app.inject({ method: 'POST', url: revokePath(id), headers: headers(actor, key) });

  it('registers only the three bounded operations with matching OpenAPI schemas', () => {
    const generated = JSON.parse(readFileSync('packages/generated/openapi.json', 'utf8'));
    expect([...registered.keys()].sort()).toEqual([
      `GET ${mePath}`, `POST ${grantsPath}`, `POST ${revokePath(':grantId')}`,
    ].sort());
    for (const [key, route] of registered) {
      const [method, url] = key.split(' ') as [string, string];
      const operation = generated.paths[url.replace(':grantId', '{grantId}')][method.toLowerCase()];
      expect(operation.operationId).toBe(route.operationId);
      expect(Object.keys(operation.responses).sort()).toEqual(Object.keys(route.response).sort());
      const sameSchema = (schema: RuntimeSchema, openApi: unknown) => {
        const { $schema, ...json } = schema.toJSONSchema({
          io: 'output', target: 'draft-2020-12', unrepresentable: 'any',
        });
        expect(json).toEqual(openApi);
      };
      sameSchema(route.response['200']!, operation.responses['200'].content['application/json'].schema);
      if (route.body) sameSchema(route.body, operation.requestBody.content['application/json'].schema);
      else expect(operation.requestBody).toBeUndefined();
    }
  });

  it('requires an authenticated session and current SERVICE_CONTROL for both mutations', async () => {
    const ordinary = await fixture.login('ordinary');
    const staff = await fixture.login('reviewer');
    const expiredOperator = await fixture.login('expired_operator');
    const revokedOperator = await fixture.login('revoked_operator');
    await seed(staff, 'PROFESSIONAL_REVIEW');
    await seed(expiredOperator, 'SERVICE_CONTROL', { validUntil: expired });
    await seed(revokedOperator, 'SERVICE_CONTROL', { revoked: true });
    const payload = grantInput(ordinary);
    expect((await me(null)).statusCode).toBe(401);
    expect((await grant(null, payload)).statusCode).toBe(401);
    expect((await revoke(null, randomUUID())).statusCode).toBe(401);
    for (const actor of [ordinary, familyManager, staff, expiredOperator, revokedOperator]) {
      expect((await grant(actor, payload)).statusCode).toBe(403);
      expect((await revoke(actor, randomUUID())).statusCode).toBe(403);
    }
    expect((await grant(operator, grantInput(operator))).statusCode).toBe(403);
    expect((await grant(operator, { ...payload, actorAccountId: operator.accountId })).statusCode).toBe(422);
    expect((await grant(ordinary, { ...payload, actorAccountId: operator.accountId })).statusCode).toBe(422);
    expect((await fixture.app.inject({
      method: 'POST', url: revokePath(randomUUID()), headers: headers(operator, randomUUID()),
      payload: { operatorId: operator.accountId },
    })).statusCode).toBe(422);
    expect((await fixture.app.inject({
      method: 'POST', url: grantsPath, headers: headers(operator), payload,
    })).statusCode).toBe(422);
  });

  it('grants and revokes through buildApp, preserving exact replay, audit and CASE parent semantics', async () => {
    const target = await fixture.login('resolver');
    const caseId = (await fixture.createCase(familyManager)).id;
    const payload = grantInput(target);
    const grantKey = randomUUID();
    const parent = await grant(operator, payload, grantKey);
    expect(parent.statusCode, parent.body).toBe(200);
    const parentId = parent.json().id as string;
    expect(parent.json()).toMatchObject({ granted_by_account_id: operator.accountId, account_id: target.accountId });
    expect((await grant(operator, payload, grantKey)).json()).toEqual(parent.json());
    const mismatch = await grant(operator, { ...payload, validUntil: future }, grantKey);
    expect(mismatch.statusCode).toBe(409);
    expect(mismatch.json()).toMatchObject({ code: 'IDEMPOTENCY_PAYLOAD_MISMATCH' });
    expect((await grant(operator, payload)).json()).toMatchObject({ code: 'STAFF_AUTHORITY_GRANT_OVERLAP' });
    expect((await grant(operator, { ...payload, capability: 'ADMIN' })).statusCode).toBe(422);
    const caseGrant = { ...payload, scope: 'CASE', familyId, caseId, parentGrantId: parentId };
    expect((await grant(operator, { ...caseGrant, parentGrantId: randomUUID() })).json()).toEqual({
      code: 'VALIDATION_ERROR', message: 'Invalid parent grant',
    });
    const child = await grant(operator, caseGrant);
    expect(child.statusCode, child.body).toBe(200);
    const childId = child.json().id as string;
    expect((await me(target)).json()).toEqual({
      staffPrincipal: identity(target),
      assignments: [
        { id: parentId, capability: 'SAFETY_RESOLVE', scope: 'GLOBAL', caseId: null, familyId: null, parentGrantId: null },
        { id: childId, capability: 'SAFETY_RESOLVE', scope: 'CASE', caseId, familyId, parentGrantId: parentId },
      ],
    });
    expect((await revoke(operator, randomUUID())).statusCode).toBe(404);
    const revokeKey = randomUUID();
    const revoked = await revoke(operator, parentId, revokeKey);
    expect(revoked.statusCode, revoked.body).toBe(200);
    expect(revoked.json()).toMatchObject({ id: parentId, revoked_by_account_id: operator.accountId });
    expect((await revoke(operator, parentId, revokeKey)).json()).toEqual(revoked.json());
    expect((await revoke(operator, childId, revokeKey)).statusCode).toBe(409);
    expect((await me(target)).json()).toEqual({ staffPrincipal: null, assignments: [] });

    const { rows } = await fixture.admin.query(
      'SELECT event_type FROM business_audit_events WHERE resource_id=$1 ORDER BY event_type', [parentId],
    );
    expect(rows).toEqual([{ event_type: 'STAFF_AUTHORITY_GRANTED' }, { event_type: 'STAFF_AUTHORITY_REVOKED' }]);
  });

  it('projects only the current Account’s active Staff assignments', async () => {
    const ordinary = await fixture.login('non_staff');
    const staff = await fixture.login('projection');
    await seed(staff, 'QUALITY_REVIEW');
    await seed(staff, 'DATA_RIGHTS', { revoked: true });
    await seed(staff, 'SAFETY_REVIEW', { validUntil: expired });
    await seed(staff, 'EXCEPTION_SUPPORT', { validFrom: future });
    const nonStaff = await me(ordinary);
    expect(nonStaff.statusCode).toBe(200);
    expect(nonStaff.json()).toEqual({ staffPrincipal: null, assignments: [] });
    const active = await me(staff);
    expect(active.statusCode).toBe(200);
    expect(active.json()).toEqual({
      staffPrincipal: identity(staff),
      assignments: [{
        id: expect.any(String), capability: 'QUALITY_REVIEW', scope: 'GLOBAL',
        caseId: null, familyId: null, parentGrantId: null,
      }],
    });
    await fixture.admin.query("UPDATE accounts SET status='DISABLED' WHERE id=$1", [staff.accountId]);
    expect((await me(staff)).statusCode).toBe(401);
  });
});
