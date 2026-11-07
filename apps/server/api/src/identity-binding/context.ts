/**
 * Shared pending-context loader for candidate routes.
 * Invalid / expired X-Binding-Context is a 401, never a business result.
 */

import type pg from 'pg';
import { bindingError } from './errors.js';
import {
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
  if (!context || isExpired(context)) throw bindingError('BINDING_CONTEXT_INVALID');
  return context;
}