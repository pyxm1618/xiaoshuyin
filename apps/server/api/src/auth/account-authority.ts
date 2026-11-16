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
