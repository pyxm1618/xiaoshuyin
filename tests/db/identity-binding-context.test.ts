/**
 * Pending authentication context repository evidence.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import {
  buildBindingApp,
  createAppPool,
  createTarget,
  bootstrap,
  type BindingHarness,
} from '../setup/identity-binding.js';
import { withBindingContextTransaction } from '../../apps/server/api/src/db/tx.js';
import {
  clearOpenid,
  findByTokenHash,
} from '../../apps/server/api/src/identity-binding/pending-context-repository.js';
import { hashToken } from '../../apps/server/api/src/identity-binding/crypto.js';
import { requireContext } from '../../apps/server/api/src/identity-binding/context.js';

describe('pending context repository', () => {
  let h: BindingHarness;
  let pool: pg.Pool;

  beforeAll(async () => {
    h = await buildBindingApp();
    pool = createAppPool();
  });

  afterAll(async () => {
    await pool.end();
    await h.close();
  });

  it('stores hashed token + encrypted openid + expiry; never plaintext', async () => {
    const target = await createTarget(h, 'ctx_store', { ageBand: 'UNDER_14' });
    const res = await bootstrap(h, target.invitationToken, `ctx_${Date.now()}`);
    expect(res.statusCode).toBe(200);
    const token = res.json().pendingContextToken as string;

    const { rows } = await h.admin.query(
      `SELECT token_hash, candidate_identity_digest, openid_ciphertext,
              openid_nonce, openid_tag, expires_at > created_at AS later,
              attempt_id
       FROM binding_pending_contexts WHERE token_hash = $1`,
      [hashToken(token)]
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].openid_ciphertext).not.toBeNull();
    expect(rows[0].openid_nonce).not.toBeNull();
    expect(rows[0].openid_tag).not.toBeNull();
    expect(rows[0].later).toBe(true);
    expect(rows[0].attempt_id).not.toBeNull();
    expect(JSON.stringify(rows[0])).not.toContain(token);
  });

  it('loads by token hash inside the binding context transaction', async () => {
    const target = await createTarget(h, 'ctx_load', { ageBand: 'UNDER_14' });
    const res = await bootstrap(h, target.invitationToken, `ctxl_${Date.now()}`);
    const token = res.json().pendingContextToken as string;

    const row = await withBindingContextTransaction(
      pool,
      { tokenHash: hashToken(token) },
      (tx) => findByTokenHash(tx, hashToken(token))
    );
    expect(row).not.toBeNull();
    expect(row!.id).toBeDefined();
  });

  it('clears decryptable openid without touching attempt linkage', async () => {
    const target = await createTarget(h, 'ctx_clear', { ageBand: 'UNDER_14' });
    const res = await bootstrap(h, target.invitationToken, `ctxc_${Date.now()}`);
    const token = res.json().pendingContextToken as string;
    const before = await h.admin.query(
      'SELECT id, attempt_id FROM binding_pending_contexts WHERE token_hash = $1',
      [hashToken(token)]
    );
    const id = before.rows[0].id as string;

    await withBindingContextTransaction(
      pool,
      { tokenHash: hashToken(token) },
      (tx) => clearOpenid(tx, id)
    );

    const after = await h.admin.query(
      'SELECT openid_ciphertext, attempt_id FROM binding_pending_contexts WHERE id = $1',
      [id]
    );
    expect(after.rows[0].openid_ciphertext).toBeNull();
    expect(after.rows[0].attempt_id).toBe(before.rows[0].attempt_id);
  });

  it('expired context is rejected with 401 BINDING_CONTEXT_INVALID', async () => {
    const target = await createTarget(h, 'ctx_exp', { ageBand: 'UNDER_14' });
    const res = await bootstrap(h, target.invitationToken, `ctxe_${Date.now()}`);
    const token = res.json().pendingContextToken as string;

    await h.admin.query(
      `UPDATE binding_pending_contexts
       SET created_at = now() - interval '20 seconds',
           expires_at = now() - interval '10 seconds'
       WHERE token_hash = $1`,
      [hashToken(token)]
    );

    await expect(
      withBindingContextTransaction(pool, { tokenHash: hashToken(token) }, (tx) =>
        requireContext(tx, token)
      )
    ).rejects.toMatchObject({ code: 'BINDING_CONTEXT_INVALID', statusCode: 401 });
  });
});