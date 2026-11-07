/**
 * F10: API-created primary keys must be UUIDv7 (PostgreSQL 18 `uuidv7()`).
 *
 * This asserts the ids actually returned by the API, not the DB default.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import { buildApp } from '../../apps/server/api/src/app.js';
import { createAdminPool } from '../setup/db.js';
import {
  createFamily,
  createMember,
  loginWithLabel,
} from '../setup/api.js';

let verifyPool: pg.Pool;

function versionOf(uuid: string): number {
  return Number(uuid[14]);
}

describe('UUIDv7 primary keys (F10)', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
    verifyPool = createAdminPool();
  });

  afterAll(async () => {
    await verifyPool.end();
    await app.close();
  });

  it('login-created Person id is UUIDv7', async () => {
    const actor = await loginWithLabel(app, 'uuid_login');
    expect(versionOf(actor.personId)).toBe(7);

    const { rows } = await verifyPool.query('SELECT id FROM persons WHERE id = $1', [actor.personId]);
    expect(versionOf(rows[0].id)).toBe(7);
  });

  it('API-created family id is UUIDv7', async () => {
    const actor = await loginWithLabel(app, 'uuid_family');
    const fam = await createFamily(app, actor.token, 'uuid-family');
    expect(fam.statusCode).toBe(201);
    expect(versionOf(fam.json().id)).toBe(7);

    const { rows } = await verifyPool.query('SELECT id FROM families WHERE id = $1', [fam.json().id]);
    expect(versionOf(rows[0].id)).toBe(7);
  });

  it('API-created member Person id is UUIDv7', async () => {
    const actor = await loginWithLabel(app, 'uuid_member');
    const fam = await createFamily(app, actor.token, 'uuid-member');
    expect(fam.statusCode).toBe(201);

    const member = await createMember(app, actor.token, fam.json().id, 'uuid-member', {
      ageBand: 'MINOR_14_17',
      ageBandSource: 'GUARDIAN_OBSERVATION',
    });
    expect(member.statusCode).toBe(201);
    expect(versionOf(member.json().personId)).toBe(7);

    const { rows } = await verifyPool.query('SELECT id FROM persons WHERE id = $1', [
      member.json().personId,
    ]);
    expect(versionOf(rows[0].id)).toBe(7);
  });
});