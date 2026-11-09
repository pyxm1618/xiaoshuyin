/**
 * Account access for the identity binding Phase C commit.
 *
 * Kept under `auth/` because it touches `accounts.wechat_openid` (guard R5):
 * routes / commands outside auth must never access the accounts table.
 */

import type pg from 'pg';

export interface AccountRow {
  id: string;
  sessionEpoch: number;
  status: 'ACTIVE' | 'DISABLED';
}

function mapRow(row: any): AccountRow {
  return {
    id: row.id,
    sessionEpoch: row.session_epoch,
    status: row.status,
  };
}

export async function findAccountByOpenid(
  tx: pg.PoolClient,
  openid: string,
  forUpdate = false
): Promise<AccountRow | null> {
  const { rows } = await tx.query(
    `SELECT id, session_epoch, status FROM accounts WHERE wechat_openid = $1${
      forUpdate ? ' FOR UPDATE' : ''
    }`,
    [openid]
  );
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function getAccountById(
  tx: pg.PoolClient,
  accountId: string
): Promise<AccountRow | null> {
  const { rows } = await tx.query(
    'SELECT id, session_epoch, status FROM accounts WHERE id = $1',
    [accountId]
  );
  return rows[0] ? mapRow(rows[0]) : null;
}

/**
 * Phase C Account create / reuse, exactly once under the DB unique constraint.
 * The account is only ever created inside the binding commit transaction.
 */
export async function createOrReuseAccount(
  tx: pg.PoolClient,
  openid: string
): Promise<{ account: AccountRow; inserted: boolean }> {
  const inserted = await tx.query(
    `INSERT INTO accounts (wechat_openid, session_epoch)
     VALUES ($1, 0)
     ON CONFLICT (wechat_openid) DO NOTHING
     RETURNING id, session_epoch, status`,
    [openid]
  );
  if (inserted.rows[0]) {
    return { account: mapRow(inserted.rows[0]), inserted: true };
  }
  const existing = await findAccountByOpenid(tx, openid, true);
  if (!existing) {
    throw Object.assign(new Error('ACCOUNT_CONFLICT_UNRESOLVED'), {
      statusCode: 500,
      code: 'INTERNAL_ERROR',
    });
  }
  return { account: existing, inserted: false };
}