/**
 * Shared pending-context loader for candidate routes.
 * Invalid / expired X-Binding-Context is a 401, never a business result.
 */

import type pg from 'pg';
import { bindingError } from './errors.js';
import {
  clearOpenid,
  findByTokenHash,
  isExpired,
  type PendingContextRow,
} from './pending-context-repository.js';
import { hashToken } from './crypto.js';

export async function requireContext(
  tx: pg.PoolClient,
  token: string
): Promise<PendingContextRow> {
  const context = await findByTokenHash(tx, hashToken(token));
  if (!context) throw bindingError('BINDING_CONTEXT_INVALID');
  if (isExpired(context)) {
    // M-03: a context-only expiry must at least scrub its own decryptable
    // OpenID. It is NOT an attempt terminal event and must not fabricate one.
    await clearOpenid(tx, context.id);
    const error = bindingError('BINDING_CONTEXT_INVALID') as Error & {
      bindingContextScrubbed?: boolean;
    };
    error.bindingContextScrubbed = true;
    throw error;
  }
  return context;
}