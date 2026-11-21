import type pg from 'pg';
import { hashPayload } from '@xiaoshuyin/domain';
import { verifyToken } from '../auth/session-token.js';
import { withIdentityTransaction } from '../db/tx.js';
import { runIdempotentCommandInTransaction, type IdempotentCommandConfig } from '../idempotency.js';

import { assignment, grantInput, idempotencyKey, inventoryEntry, readInput, revokeInput, staffMeResponse, uuid } from './schemas.js';

const purpose = 'STAFF_AUTHORITY_CONTROL';
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
    async readSelf(actor: { accountId: string; personId: string }) {
      return withIdentityTransaction(pool, { accountId: actor.accountId, purpose: 'SELF_IDENTITY' }, async (tx) => {
        const { rows } = await tx.query<{ result: unknown }>(
          `SELECT result FROM app.staff_authority_projection($1,$2,NULL) AS result
           WHERE result->>'status' = 'ACTIVE'`,
          [actor.accountId, actor.personId],
        );
        const assignments = rows.map(({ result }) => {
          const row = inventoryEntry.parse(result);
          return {
            id: row.id,
            capability: row.capability,
            scope: row.scope_type,
            familyId: row.family_id,
            caseId: row.case_id,
            parentGrantId: row.capability_grant_id,
          };
        });
        return staffMeResponse.parse({ staffPrincipal: assignments.length > 0 ? actor : null, assignments });
      });
    },

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
