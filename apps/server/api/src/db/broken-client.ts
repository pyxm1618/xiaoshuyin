/**
 * Canonical DB client failure classifier (Findings #31 and #18).
 *
 * Identifies fatal connection and transport failures that render a checked-out
 * PostgreSQL client unsafe for return to the pool. When this function returns
 * true, the connection must be discarded / destroyed (e.g. `client.release(true)`).
 *
 * Query / business failures (such as unique-constraint violations or ordinary
 * transaction rollbacks) must NOT mark the client broken.
 */
export function isBrokenClientError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;

  const code = (error as { code?: unknown }).code;
  if (typeof code === 'string') {
    // 1. Node.js network / transport level system errors (Finding #31)
    if (code === 'ECONNRESET' || code === 'ETIMEDOUT' || code === 'EPIPE') {
      return true;
    }
    // 2. PostgreSQL connection exceptions (08xxx), admin shutdown (57P01),
    // and "current transaction is aborted" (25P02 — a failed ROLLBACK leaves the
    // session unusable for further work).
    if (/^08/.test(code) || code === '57P01' || code === '25P02') {
      return true;
    }
  }

  const errno = (error as { errno?: unknown }).errno;
  if (
    typeof errno === 'string' &&
    (errno === 'ECONNRESET' || errno === 'ETIMEDOUT' || errno === 'EPIPE')
  ) {
    return true;
  }

  return false;
}
