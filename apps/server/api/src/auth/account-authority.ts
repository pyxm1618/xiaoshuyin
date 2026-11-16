import type pg from 'pg';
/**
 * Single authoritative Account eligibility boundary for authenticated authority.
 *
 * Session-token cryptography proves token integrity/expiry. Current Account
 * facts decide whether that token (or a new session issuance) may carry
 * authenticated authority.
 */

export type AccountStatus = 'ACTIVE' | 'DISABLED';

export interface AccountAuthorityFacts {
  status: AccountStatus;
  sessionEpoch: number;
}

export function isAccountAuthorityEligible(
  account: Pick<AccountAuthorityFacts, 'status'>
): boolean {
  return account.status === 'ACTIVE';
}

export function hasAuthenticatedSessionAuthority(
  account: AccountAuthorityFacts,
  tokenEpoch: number
): boolean {
  return isAccountAuthorityEligible(account) && account.sessionEpoch === tokenEpoch;
}


/**
 * Transaction-time Account authority gate for high-impact commands.
 *
 * Locks the authoritative Account row so DISABLED cannot race a successful
 * commit. This extends the existing Account authority owner; consumers do not
 * duplicate Account-status semantics.
 */
export async function assertCurrentAccountAuthority(
  tx: pg.PoolClient,
  accountId: string
): Promise<void> {
  const { rows } = await tx.query<{ status: AccountStatus }>(
    'SELECT status FROM accounts WHERE id=$1 FOR UPDATE',
    [accountId]
  );
  const account = rows[0] ?? null;
  if (account === null || !isAccountAuthorityEligible(account)) {
    throw Object.assign(new Error('Authenticated Account authority unavailable'), {
      code: 'UNAUTHENTICATED',
    });
  }
}
