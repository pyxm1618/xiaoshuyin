/**
 * Shared current-family resolution for routes whose path has no family_id.
 *
 * Routes must not re-implement current-family selection. The domain resolver
 * keeps NONE / RESOLVED / AMBIGUOUS distinguishable; this module maps the two
 * error states to the frozen HTTP contract without ever exposing Family fields.
 */

import type pg from 'pg';
import { resolveCurrentFamily } from '@xiaoshuyin/domain';

export function currentFamilyNotFoundError(): Error & { statusCode: number; code: string } {
  return Object.assign(new Error('Current family not found'), {
    statusCode: 404,
    code: 'CURRENT_FAMILY_NOT_FOUND',
  });
}

export function currentFamilyAmbiguousError(): Error & { statusCode: number; code: string } {
  return Object.assign(new Error('Current family is ambiguous'), {
    statusCode: 409,
    code: 'CURRENT_FAMILY_AMBIGUOUS',
  });
}

/**
 * Resolve a current family for endpoints where "no family" is an error.
 * AMBIGUOUS always fails closed — it is never collapsed into NONE or a guess.
 */
export async function requireCurrentFamily(
  tx: pg.PoolClient,
  personId: string
): Promise<string> {
  const resolution = await resolveCurrentFamily(tx, personId);
  if (resolution.status === 'NONE') throw currentFamilyNotFoundError();
  if (resolution.status === 'AMBIGUOUS') throw currentFamilyAmbiguousError();
  return resolution.family.id;
}

export { resolveCurrentFamily };