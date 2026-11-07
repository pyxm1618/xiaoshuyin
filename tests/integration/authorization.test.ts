/**
 * T061: Cross-family authorization integration tests.
 * Verifies real API-level authorization boundaries between families.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../apps/server/api/src/app.js';
import { createAdminPool } from '../setup/db.js';
import {
  auth,
  commandHeaders,
  createFamily,
  createMember,
  loginWithLabel,
  updateMember,
  valueInput,
} from '../setup/api.js';

describe('Cross-Family Authorization (T061)', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let verifyPool: ReturnType<typeof createAdminPool>;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
    verifyPool = createAdminPool();
  });

  afterAll(async () => {
    await verifyPool.end();
    await app.close();
  });

  async function setupFamily(label: string) {
    const actor = await loginWithLabel(app, `t061_${label}`);
    const famRes = await createFamily(app, actor.token, `t061_${label}`);
    expect(famRes.statusCode).toBe(201);
    return { token: actor.token, personId: actor.personId, familyId: famRes.json().id as string };
  }

  async function createMemberInFamily(familyToken: string, familyId: string, label: string) {
    const res = await createMember(app, familyToken, familyId, `t061_${label}`, {
      ageBand: 'MINOR_14_17',
      ageBandSource: 'GUARDIAN_OBSERVATION',
      values: [valueInput(`成员-${label}`, 'GUARDIAN_OBSERVATION')],
    });
    expect(res.statusCode).toBe(201);
    return { memberPersonId: res.json().personId as string };
  }

  it('T061: Family A manager accessing Family B members → 403', async () => {
    const famA = await setupFamily('a1');
    const famB = await setupFamily('b1');

    const res = await createMember(app, famA.token, famB.familyId, 't061-x-a', {
      ageBand: 'MINOR_14_17',
      ageBandSource: 'GUARDIAN_OBSERVATION',
    });
    expect(res.statusCode).toBe(403);
  });

  it('T061: Family A manager PATCH Family B member → 403', async () => {
    const famA = await setupFamily('a2');
    const famB = await setupFamily('b2');
    const { memberPersonId } = await createMemberInFamily(famB.token, famB.familyId, 'b2m');

    const res = await updateMember(app, famA.token, famB.familyId, memberPersonId, 't061-x-p', [
      valueInput('hack', 'GUARDIAN_OBSERVATION'),
    ]);
    expect(res.statusCode).toBe(403);
  });

  it('T061: cross-family response contains no target family fields', async () => {
    const famA = await setupFamily('a3');
    const famB = await setupFamily('b3');

    const res = await createMember(app, famA.token, famB.familyId, 't061-x-n', {
      ageBand: 'MINOR_14_17',
      ageBandSource: 'GUARDIAN_OBSERVATION',
    });
    expect(res.statusCode).toBe(403);
    const body = res.json();
    expect(body.displayName).toBeUndefined();
    expect(body.createdAt).toBeUndefined();
    expect(body.familyId).toBeUndefined();
  });

  it('T061: forged family_id is rejected', async () => {
    const famA = await setupFamily('a4');
    const forgedId = '00000000-0000-0000-0000-000000000000';

    const res = await createMember(app, famA.token, forgedId, 't061-x-f', {
      ageBand: 'MINOR_14_17',
      ageBandSource: 'GUARDIAN_OBSERVATION',
    });
    expect([403, 404]).toContain(res.statusCode);
  });

  it('T061: non-manager member creating member → 403', async () => {
    const famA = await setupFamily('a5');
    const nm = await loginWithLabel(app, 't061_nm');

    const addRes = await createMember(app, famA.token, famA.familyId, 't061-mem-nm', {
      ageBand: 'MINOR_14_17',
      ageBandSource: 'GUARDIAN_OBSERVATION',
    });
    expect(addRes.statusCode).toBe(201);

    const res = await createMember(app, nm.token, famA.familyId, 't061-x-nm', {
      ageBand: 'MINOR_14_17',
      ageBandSource: 'GUARDIAN_OBSERVATION',
    });
    expect(res.statusCode).toBe(403);
  });

  it('T061: non-manager member PATCHing member → 403', async () => {
    const famA = await setupFamily('a6');
    const { memberPersonId } = await createMemberInFamily(famA.token, famA.familyId, 'a6m');

    const np = await loginWithLabel(app, 't061_np');
    await createMember(app, famA.token, famA.familyId, 't061-mem-np', {
      ageBand: 'MINOR_14_17',
      ageBandSource: 'GUARDIAN_OBSERVATION',
    });

    const res = await updateMember(app, np.token, famA.familyId, memberPersonId, 't061-x-npu', [
      valueInput('hack', 'GUARDIAN_OBSERVATION'),
    ]);
    expect(res.statusCode).toBe(403);
  });

  it('T061: PATCH member from wrong family → 403/404', async () => {
    const famA = await setupFamily('a7');
    const famB = await setupFamily('b7');
    const { memberPersonId } = await createMemberInFamily(famB.token, famB.familyId, 'b7m');

    const res = await updateMember(app, famA.token, famA.familyId, memberPersonId, 't061-x-xp', [
      valueInput('hack', 'GUARDIAN_OBSERVATION'),
    ]);
    expect([403, 404]).toContain(res.statusCode);
  });
});