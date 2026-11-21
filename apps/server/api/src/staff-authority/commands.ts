import type pg from 'pg';
import { z } from 'zod';
import { hashPayload } from '@xiaoshuyin/domain';
import { verifyToken } from '../auth/session-token.js';
import { withIdentityTransaction } from '../db/tx.js';
import { runIdempotentCommandInTransaction, type IdempotentCommandConfig } from '../idempotency.js';

const purpose = 'STAFF_AUTHORITY_CONTROL';
const uuid = z.uuid().transform((value) => value.toLowerCase());
const idempotencyKey = z.string().min(8).max(128);
const identity = { accountId: uuid, personId: uuid };
const grantFields = {
  ...identity,
  capability: z.string().min(1),
  validFrom: z.iso.datetime({ offset: true }),
  validUntil: z.iso.datetime({ offset: true }).nullable(),
};
const grantInput = z.discriminatedUnion('scope', [
  z.strictObject({ ...grantFields, scope: z.literal('GLOBAL') }),
  z.strictObject({
    ...grantFields,
    scope: z.literal('CASE'),
    familyId: uuid,
    caseId: uuid,
    parentGrantId: uuid,
  }),
]);
const revokeInput = z.strictObject({ assignmentId: uuid });
const readInput = z.union([
  z.strictObject(identity),
  z.strictObject({ caseId: uuid }),
]);
const assignment = z.strictObject({
  id: uuid,
  account_id: uuid,
  person_id: uuid,
  capability: z.string(),
  scope_type: z.enum(['GLOBAL', 'CASE']),
  family_id: uuid.nullable(),
  case_id: uuid.nullable(),
  capability_grant_id: uuid.nullable(),
  granted_by_account_id: uuid,
  granted_at: z.string(),
  valid_from: z.string(),
  valid_until: z.string().nullable(),
  revoked_by_account_id: uuid.nullable(),
  revoked_at: z.string().nullable(),
  created_at: z.string(),
});
const inventoryEntry = assignment.extend({
  status: z.enum(['ACTIVE', 'REVOKED', 'EXPIRED', 'FUTURE', 'DISABLED', 'INVALID_PARENT']),
});

/** Internal commands take an existing signed session, never a caller-supplied StaffPrincipal. */
export function createStaffAuthorityCommands(pool: pg.Pool, sessionSecret: string) {
  async function withStaffControl<T>(
    session: string,
    mutation: boolean,
    command: (tx: pg.PoolClient, principal: { accountId: string; personId: string; epoch: number }) => Promise<T>,
  ): Promise<T> {
    const token = verifyToken(session, sessionSecret, -1);
    const account = uuid.safeParse(token?.accountId);
    if (!token || !account.success || !Number.isInteger(token.epoch) || !Number.isFinite(token.exp)) {
      throw Object.assign(new Error('STAFF_AUTHORITY_SESSION_INVALID'), { code: 'UNAUTHENTICATED' });
    }
    return withIdentityTransaction(pool, { accountId: account.data, purpose }, async (tx) => {
      const { rows } = await tx.query<{ person_id: string }>(
        'SELECT app.require_staff_authority_control($1,$2) AS person_id',
        [token.epoch, mutation],
      );
      if (Date.now() / 1000 > token.exp) {
        throw Object.assign(new Error('STAFF_AUTHORITY_SESSION_EXPIRED'), { code: 'UNAUTHENTICATED' });
      }
      return command(tx, {
        accountId: account.data,
        personId: uuid.parse(rows[0]?.person_id),
        epoch: token.epoch,
      });
    });
  }

  async function mutate(
    session: string,
    key: string,
    commandType: Extract<IdempotentCommandConfig['commandType'], 'STAFF_AUTHORITY_GRANT' | 'STAFF_AUTHORITY_REVOKE'>,
    payload: unknown,
    statement: string,
    parameters: readonly unknown[],
  ) {
    return withStaffControl(session, true, async (tx, principal) => {
      const outcome = await runIdempotentCommandInTransaction(tx, {
        ...principal,
        purpose,
        commandType,
        idempotencyKey: idempotencyKey.parse(key),
        requestHash: hashPayload(payload),
      }, async () => {
        const { rows } = await tx.query<{ result: unknown }>(statement, [principal.epoch, ...parameters]);
        return { status: 200, body: assignment.parse(rows[0]?.result) };
      });
      if (outcome.action === 'MISMATCH') {
        throw Object.assign(new Error('STAFF_AUTHORITY_IDEMPOTENCY_MISMATCH'), { code: 'IDEMPOTENCY_MISMATCH' });
      }
      return assignment.parse(outcome.body);
    });
  }

  return {
    async grant(session: string, key: string, input: unknown) {
      const grant = grantInput.parse(input);
      const caseScope = grant.scope === 'CASE' ? grant : null;
      return mutate(session, key, 'STAFF_AUTHORITY_GRANT', grant,
        'SELECT app.grant_staff_authority($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) AS result',
        [grant.accountId, grant.personId, grant.capability, grant.scope, caseScope?.familyId ?? null,
          caseScope?.caseId ?? null, caseScope?.parentGrantId ?? null, grant.validFrom, grant.validUntil],
      );
    },

    async revoke(session: string, key: string, input: unknown) {
      const revoke = revokeInput.parse(input);
      return mutate(session, key, 'STAFF_AUTHORITY_REVOKE', revoke,
        'SELECT app.revoke_staff_authority($1,$2) AS result', [revoke.assignmentId]);
    },

    async read(session: string, input: unknown) {
      const filter = readInput.parse(input);
      return withStaffControl(session, false, async (tx, principal) => {
        const { rows } = await tx.query<{ result: unknown }>(
          'SELECT result FROM app.read_staff_authority($1,$2,$3,$4) AS result',
          'caseId' in filter
            ? [principal.epoch, null, null, filter.caseId]
            : [principal.epoch, filter.accountId, filter.personId, null],
        );
        return rows.map((row) => inventoryEntry.parse(row.result));
      });
    },
  };
}
