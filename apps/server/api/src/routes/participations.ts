/**
 * Slice 4 — Case Participant Core routes.
 *
 * Exactly six operations. Routes orchestrate only; all case_participants SQL
 * lives in packages/domain/src/participants.ts.
 */
import type { FastifyInstance, FastifyReply } from 'fastify';
import type pg from 'pg';
import { z } from 'zod';
import {
  AcceptParticipationRequest,
  CreateParticipationInviteRequest,
  CreateParticipationInviteResponse,
  DeclineParticipationRequest,
  ErrorSchema,
  InvitationNotAvailableError,
  ParticipationAlreadyExistsError,
  ParticipationInvitePublicView,
  ParticipationNotFoundError,
  ParticipationResource,
  ParticipationStateConflictError,
  ParticipationTargetIneligibleError,
  ParticipationValidationError,
  WithdrawParticipationRequest,
} from '@xiaoshuyin/contracts';
import {
  allocateParticipationId,
  activateParticipation,
  buildParticipationAcceptRequestHash,
  buildParticipationInviteCreateRequestHash,
  buildParticipationResourceCommandHash,
  declineParticipation,
  deriveParticipationInviteToken,
  getCaseById,
  getOwnParticipationByTokenHash,
  getParticipationById,
  getPublicParticipationInvite,
  hasLiveParticipation,
  hashParticipationInviteToken,
  insertParticipationAudit,
  insertParticipationInvite,
  isFamilyMember,
  isParticipationProcessingAllowed,
  lockParticipationById,
  materializeParticipationExpiry,
  PARTICIPATION_NOTICE,
  planParticipationCommand,
  withdrawParticipation,
  type LockedParticipationRow,
  type ParticipationRow,
} from '@xiaoshuyin/domain';
import { authorize } from '@xiaoshuyin/authorization';
import {
  setFamilyContext,
  withIdentityTransaction,
  withInviteTokenTransaction,
  withRlsTransaction,
} from '../db/tx.js';
import { requireCurrentFamily } from '../family-context.js';
import {
  isKnownAuthorizationDenial,
  requireFamilyAction,
} from '../authz.js';
import {
  participationInviteSnapshot,
  rehydrateParticipationInviteReplay,
  runIdempotentCommand,
  sendCommandOutcome,
  type CommandResponse,
} from '../idempotency.js';
import { toHttpError } from '../plugins/error-handler.js';

const TAG = ['participation'];
const BEARER = [{ bearerAuth: [] }];
const IdParams = z.object({ id: z.string().meta({ format: 'uuid' }) });
const TokenParams = z.object({ token: z.string() });
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ParticipationRouteOptions {
  inviteTtlSeconds: number;
  inviteTokenSecret: string;
}

function typedError(code: string, message: string): Error & {
  statusCode: number;
  code: string;
} {
  const mapped = toHttpError(code, message);
  return Object.assign(new Error(mapped.message), mapped);
}

function caseNotFound(): Error {
  return typedError('CASE_NOT_FOUND', 'Case not found');
}

function targetIneligible(): Error {
  return typedError('PARTICIPATION_TARGET_INELIGIBLE', 'Participation target is not eligible');
}

function participationNotFound(): Error {
  return typedError('PARTICIPATION_NOT_FOUND', 'Participation not found');
}

function invitationUnavailable(): Error {
  return typedError('INVITATION_NOT_AVAILABLE', 'Invitation not available');
}

function alreadyExists(): Error {
  return typedError('PARTICIPATION_ALREADY_EXISTS', 'Participation already exists');
}

function stateConflict(state: ParticipationRow['state']): CommandResponse {
  return {
    status: 409,
    body: {
      code: 'PARTICIPATION_STATE_CONFLICT',
      message: 'Participation state conflict',
      currentState: state,
    },
  };
}

function isLiveUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: unknown }).code === '23505' &&
    (error as { constraint?: unknown }).constraint ===
      'case_participants_one_live_per_case_person'
  );
}

function participationBody(row: ParticipationRow) {
  return {
    id: row.id,
    caseId: row.case_id,
    personId: row.person_id,
    state: row.state,
    createdAt: new Date(row.created_at).toISOString(),
    acceptedAt: row.accepted_at ? new Date(row.accepted_at).toISOString() : null,
    declinedAt: row.declined_at ? new Date(row.declined_at).toISOString() : null,
    expiredAt: row.expired_at ? new Date(row.expired_at).toISOString() : null,
    withdrawnAt: row.withdrawn_at ? new Date(row.withdrawn_at).toISOString() : null,
  };
}

function inviteCreateBody(row: ParticipationRow, token: string) {
  return {
    participationId: row.id,
    caseId: row.case_id,
    personId: row.person_id,
    state: 'PENDING' as const,
    inviteToken: token,
    expiresAt: new Date(row.invite_expires_at).toISOString(),
    createdAt: new Date(row.created_at).toISOString(),
  };
}

async function recordExpiry(
  tx: pg.PoolClient,
  locked: ParticipationRow,
  accountId: string
): Promise<ParticipationRow | null> {
  const expired = await materializeParticipationExpiry(tx, locked.id);
  if (!expired) return null;
  await insertParticipationAudit(tx, {
    familyId: expired.family_id,
    actorAccountId: accountId,
    participationId: expired.id,
    eventType: 'PARTICIPATION_EXPIRED',
    metadata: {
      caseId: expired.case_id,
      personId: expired.person_id,
      fromState: 'PENDING',
      toState: 'EXPIRED',
      expiresAt: new Date(expired.invite_expires_at).toISOString(),
      materializedOnAccess: true,
    },
  });
  return expired;
}

function requireSelfDecision(
  accountId: string,
  personId: string,
  row: ParticipationRow,
  action:
    | 'PARTICIPATION_READ_SELF'
    | 'PARTICIPATION_ACCEPT_SELF'
    | 'PARTICIPATION_DECLINE_SELF'
    | 'PARTICIPATION_WITHDRAW_SELF'
): void {
  const decision = authorize({
    actor: { accountId, personId },
    product: 'V1',
    family: null,
    case: null,
    participation: { personId: row.person_id, state: row.state },
    resource: { type: 'PARTICIPATION', participationId: row.id },
    action,
    purpose: 'PARTICIPATION',
  });
  if (decision.decision === 'DENY') throw participationNotFound();
}

async function resolveOwnByToken(
  pool: pg.Pool,
  accountId: string,
  personId: string,
  tokenHash: string
): Promise<ParticipationRow> {
  const row = await withIdentityTransaction(
    pool,
    { accountId, purpose: 'PARTICIPATION' },
    (tx) => getOwnParticipationByTokenHash(tx, tokenHash)
  );
  if (!row) throw participationNotFound();
  requireSelfDecision(accountId, personId, row, 'PARTICIPATION_ACCEPT_SELF');
  return row;
}

async function runSelfStateCommand(
  tx: pg.PoolClient,
  input: {
    accountId: string;
    personId: string;
    participationId: string;
    action:
      | 'PARTICIPATION_ACCEPT_SELF'
      | 'PARTICIPATION_DECLINE_SELF'
      | 'PARTICIPATION_WITHDRAW_SELF';
    command: 'ACCEPT' | 'DECLINE' | 'WITHDRAW';
    requireCompliance: boolean;
  }
): Promise<CommandResponse> {
  const visible = await getParticipationById(tx, input.participationId);
  if (!visible) throw participationNotFound();
  requireSelfDecision(
    input.accountId,
    input.personId,
    visible,
    input.action
  );

  await setFamilyContext(
    tx,
    visible.family_id,
    input.personId,
    'PARTICIPATION'
  );

  const locked = await lockParticipationById(tx, visible.id);
  if (!locked) throw participationNotFound();
  requireSelfDecision(
    input.accountId,
    input.personId,
    locked,
    input.action
  );

  if (locked.state === 'PENDING') {
    const expired = await recordExpiry(tx, locked, input.accountId);
    if (expired) return stateConflict('EXPIRED');
  }

  const plan = planParticipationCommand(
    locked.state,
    input.command,
    locked.invite_expires_at,
    (locked as LockedParticipationRow).database_now
  );

  if (plan.action === 'CONVERGED') {
    return { status: 200, body: participationBody(locked) };
  }
  if (plan.action === 'CONFLICT' || plan.action === 'EXPIRE_AND_CONFLICT') {
    return stateConflict(plan.currentState);
  }

  if (
    input.command === 'ACCEPT' &&
    input.requireCompliance &&
    !(await isParticipationProcessingAllowed(tx, locked.person_id))
  ) {
    throw participationNotFound();
  }

  let changed: ParticipationRow | null = null;
  let event:
    | 'PARTICIPATION_ACCEPTED'
    | 'PARTICIPATION_DECLINED'
    | 'PARTICIPATION_WITHDRAWN';
  if (input.command === 'ACCEPT') {
    changed = await activateParticipation(tx, locked.id);
    event = 'PARTICIPATION_ACCEPTED';
  } else if (input.command === 'DECLINE') {
    changed = await declineParticipation(tx, locked.id);
    event = 'PARTICIPATION_DECLINED';
  } else {
    changed = await withdrawParticipation(tx, locked.id);
    event = 'PARTICIPATION_WITHDRAWN';
  }

  // The deadline can cross between lock/check and the conditional UPDATE.
  if (!changed && locked.state === 'PENDING') {
    const expired = await recordExpiry(tx, locked, input.accountId);
    if (expired) return stateConflict('EXPIRED');
  }
  if (!changed) {
    throw Object.assign(new Error('Participation transition lost after row lock'), {
      statusCode: 500,
      code: 'INTERNAL_ERROR',
    });
  }

  await insertParticipationAudit(tx, {
    familyId: changed.family_id,
    actorAccountId: input.accountId,
    participationId: changed.id,
    eventType: event,
    metadata: {
      caseId: changed.case_id,
      personId: changed.person_id,
      fromState: plan.from,
      toState: plan.to,
    },
  });

  return { status: 200, body: participationBody(changed) };
}

export function registerParticipationRoutes(
  app: FastifyInstance,
  pool: pg.Pool,
  options: ParticipationRouteOptions
) {
  app.post(
    '/api/v1/cases/:id/participation-invites',
    {
      onRequest: app.authenticate,
      schema: {
        operationId: 'createParticipationInvite',
        summary: 'Create a Case participation invitation',
        tags: TAG,
        security: BEARER,
        params: IdParams,
        body: CreateParticipationInviteRequest,
        response: {
          201: CreateParticipationInviteResponse,
          401: ErrorSchema,
          403: ParticipationTargetIneligibleError,
          404: ErrorSchema,
          409: z.union([ParticipationAlreadyExistsError, ErrorSchema]),
          422: ParticipationValidationError,
          500: ErrorSchema,
        },
      },
    },
    async (req, reply: FastifyReply) => {
      const actor = req.actor;
      if (!actor?.accountId || !actor.personId) throw typedError('UNAUTHENTICATED', 'Unauthenticated');

      const parsed = CreateParticipationInviteRequest.safeParse(req.body ?? {});
      if (!parsed.success) throw typedError('VALIDATION_ERROR', 'Invalid request body');
      const caseId = (req.params as { id: string }).id;
      if (!UUID_PATTERN.test(caseId)) throw caseNotFound();

      const familyId = await withIdentityTransaction(
        pool,
        { accountId: actor.accountId, purpose: 'FAMILY_MANAGEMENT' },
        (tx) => requireCurrentFamily(tx, actor.personId!)
      );

      const requestHash = buildParticipationInviteCreateRequestHash({
        familyId,
        caseId,
        personId: parsed.data.personId,
      });

      const outcome = await runIdempotentCommand(
        pool,
        {
          accountId: actor.accountId,
          personId: actor.personId,
          purpose: 'FAMILY_MANAGEMENT',
          commandType: 'PARTICIPATION_INVITE_CREATE',
          idempotencyKey: parsed.data.idempotencyKey,
          requestHash,
          persistResponseBody: participationInviteSnapshot,
        },
        async (tx) => {
          await setFamilyContext(tx, familyId, actor.personId!, 'FAMILY_MANAGEMENT');

          const caseRow = await getCaseById(tx, caseId);
          if (!caseRow) throw caseNotFound();

          try {
            await requireFamilyAction(tx, {
              accountId: actor.accountId,
              personId: actor.personId!,
              familyId,
              caseId,
              action: 'PARTICIPATION_INVITE_CREATE',
              purpose: 'FAMILY_MANAGEMENT',
              resource: { type: 'CASE', familyId, caseId },
            });
          } catch (error) {
            if (isKnownAuthorizationDenial(error)) throw caseNotFound();
            throw error;
          }

          const targetMember = await isFamilyMember(tx, familyId, parsed.data.personId);
          if (!targetMember) throw targetIneligible();
          if (!(await isParticipationProcessingAllowed(tx, parsed.data.personId))) {
            throw targetIneligible();
          }

          if (await hasLiveParticipation(tx, caseId, parsed.data.personId)) {
            return {
              status: 409,
              body: {
                code: 'PARTICIPATION_ALREADY_EXISTS',
                message: 'Participation already exists',
              },
            };
          }

          const participationId = await allocateParticipationId(tx);
          const inviteToken = deriveParticipationInviteToken(
            options.inviteTokenSecret,
            participationId
          );
          const inviteTokenHash = hashParticipationInviteToken(inviteToken);

          let row: ParticipationRow;
          try {
            row = await insertParticipationInvite(tx, {
              id: participationId,
              familyId,
              caseId,
              personId: parsed.data.personId,
              inviteTokenHash,
              ttlSeconds: options.inviteTtlSeconds,
              createdByPersonId: actor.personId!,
            });
          } catch (error) {
            if (isLiveUniqueViolation(error)) throw alreadyExists();
            throw error;
          }

          await insertParticipationAudit(tx, {
            familyId,
            actorAccountId: actor.accountId,
            participationId: row.id,
            eventType: 'PARTICIPATION_INVITE_CREATED',
            metadata: {
              caseId: row.case_id,
              personId: row.person_id,
              state: 'PENDING',
              expiresAt: new Date(row.invite_expires_at).toISOString(),
            },
          });

          return { status: 201, body: inviteCreateBody(row, inviteToken) };
        }
      );

      return sendCommandOutcome(
        reply,
        rehydrateParticipationInviteReplay(outcome, options.inviteTokenSecret)
      );
    }
  );

  app.get(
    '/api/v1/participation-invites/:token',
    {
      exposeHeadRoute: false,
      schema: {
        operationId: 'getParticipationInvite',
        summary: 'Read the public participation invitation view',
        tags: TAG,
        params: TokenParams,
        response: {
          200: ParticipationInvitePublicView,
          404: InvitationNotAvailableError,
          500: ErrorSchema,
        },
      },
    },
    async (req, reply: FastifyReply) => {
      const token = (req.params as { token: string }).token;
      if (token.length < 1 || token.length > 256) throw invitationUnavailable();
      const tokenHash = hashParticipationInviteToken(token);
      const row = await withInviteTokenTransaction(
        pool,
        { tokenHash },
        (tx) => getPublicParticipationInvite(tx)
      );
      if (!row) throw invitationUnavailable();
      return reply.status(200).send({
        participationId: row.participation_id,
        state: 'PENDING',
        expiresAt: new Date(row.expires_at).toISOString(),
        notice: PARTICIPATION_NOTICE,
      });
    }
  );

  app.post(
    '/api/v1/participation-invites/:token/accept',
    {
      onRequest: app.authenticate,
      schema: {
        operationId: 'acceptParticipationInvite',
        summary: 'Accept a participation invitation',
        tags: TAG,
        security: BEARER,
        params: TokenParams,
        body: AcceptParticipationRequest,
        response: {
          200: ParticipationResource,
          401: ErrorSchema,
          404: ParticipationNotFoundError,
          409: z.union([ParticipationStateConflictError, ErrorSchema]),
          422: ParticipationValidationError,
          500: ErrorSchema,
        },
      },
    },
    async (req, reply: FastifyReply) => {
      const actor = req.actor;
      if (!actor?.accountId || !actor.personId) throw typedError('UNAUTHENTICATED', 'Unauthenticated');
      const parsed = AcceptParticipationRequest.safeParse(req.body ?? {});
      if (!parsed.success) throw typedError('VALIDATION_ERROR', 'Invalid request body');
      const token = (req.params as { token: string }).token;
      if (token.length < 1 || token.length > 256) throw participationNotFound();
      const inviteTokenHash = hashParticipationInviteToken(token);

      const prelim = await resolveOwnByToken(
        pool,
        actor.accountId,
        actor.personId,
        inviteTokenHash
      );
      const requestHash = buildParticipationAcceptRequestHash({
        inviteTokenHash,
        participationId: prelim.id,
      });

      const outcome = await runIdempotentCommand(
        pool,
        {
          accountId: actor.accountId,
          personId: actor.personId,
          purpose: 'PARTICIPATION',
          commandType: 'PARTICIPATION_ACCEPT',
          idempotencyKey: parsed.data.idempotencyKey,
          requestHash,
        },
        async (tx) => {
          const current = await getOwnParticipationByTokenHash(tx, inviteTokenHash);
          if (!current || current.id !== prelim.id) throw participationNotFound();
          return runSelfStateCommand(tx, {
            accountId: actor.accountId,
            personId: actor.personId!,
            participationId: current.id,
            action: 'PARTICIPATION_ACCEPT_SELF',
            command: 'ACCEPT',
            requireCompliance: true,
          });
        }
      );
      return sendCommandOutcome(reply, outcome);
    }
  );

  app.post(
    '/api/v1/participations/:id/decline',
    {
      onRequest: app.authenticate,
      schema: {
        operationId: 'declineParticipation',
        summary: 'Decline a participation invitation',
        tags: TAG,
        security: BEARER,
        params: IdParams,
        body: DeclineParticipationRequest,
        response: {
          200: ParticipationResource,
          401: ErrorSchema,
          404: ParticipationNotFoundError,
          409: z.union([ParticipationStateConflictError, ErrorSchema]),
          422: ParticipationValidationError,
          500: ErrorSchema,
        },
      },
    },
    async (req, reply: FastifyReply) => {
      const actor = req.actor;
      if (!actor?.accountId || !actor.personId) throw typedError('UNAUTHENTICATED', 'Unauthenticated');
      const parsed = DeclineParticipationRequest.safeParse(req.body ?? {});
      if (!parsed.success) throw typedError('VALIDATION_ERROR', 'Invalid request body');
      const participationId = (req.params as { id: string }).id;
      if (!UUID_PATTERN.test(participationId)) throw participationNotFound();

      const prelim = await withIdentityTransaction(
        pool,
        { accountId: actor.accountId, purpose: 'PARTICIPATION' },
        (tx) => getParticipationById(tx, participationId)
      );
      if (!prelim) throw participationNotFound();
      requireSelfDecision(actor.accountId, actor.personId, prelim, 'PARTICIPATION_DECLINE_SELF');

      const outcome = await runIdempotentCommand(
        pool,
        {
          accountId: actor.accountId,
          personId: actor.personId,
          purpose: 'PARTICIPATION',
          commandType: 'PARTICIPATION_DECLINE',
          idempotencyKey: parsed.data.idempotencyKey,
          requestHash: buildParticipationResourceCommandHash(participationId),
        },
        (tx) =>
          runSelfStateCommand(tx, {
            accountId: actor.accountId,
            personId: actor.personId!,
            participationId,
            action: 'PARTICIPATION_DECLINE_SELF',
            command: 'DECLINE',
            requireCompliance: false,
          })
      );
      return sendCommandOutcome(reply, outcome);
    }
  );

  app.post(
    '/api/v1/participations/:id/withdraw',
    {
      onRequest: app.authenticate,
      schema: {
        operationId: 'withdrawParticipation',
        summary: 'Withdraw an active participation',
        tags: TAG,
        security: BEARER,
        params: IdParams,
        body: WithdrawParticipationRequest,
        response: {
          200: ParticipationResource,
          401: ErrorSchema,
          404: ParticipationNotFoundError,
          409: z.union([ParticipationStateConflictError, ErrorSchema]),
          422: ParticipationValidationError,
          500: ErrorSchema,
        },
      },
    },
    async (req, reply: FastifyReply) => {
      const actor = req.actor;
      if (!actor?.accountId || !actor.personId) throw typedError('UNAUTHENTICATED', 'Unauthenticated');
      const parsed = WithdrawParticipationRequest.safeParse(req.body ?? {});
      if (!parsed.success) throw typedError('VALIDATION_ERROR', 'Invalid request body');
      const participationId = (req.params as { id: string }).id;
      if (!UUID_PATTERN.test(participationId)) throw participationNotFound();

      const prelim = await withIdentityTransaction(
        pool,
        { accountId: actor.accountId, purpose: 'PARTICIPATION' },
        (tx) => getParticipationById(tx, participationId)
      );
      if (!prelim) throw participationNotFound();
      requireSelfDecision(actor.accountId, actor.personId, prelim, 'PARTICIPATION_WITHDRAW_SELF');

      const outcome = await runIdempotentCommand(
        pool,
        {
          accountId: actor.accountId,
          personId: actor.personId,
          purpose: 'PARTICIPATION',
          commandType: 'PARTICIPATION_WITHDRAW',
          idempotencyKey: parsed.data.idempotencyKey,
          requestHash: buildParticipationResourceCommandHash(participationId),
        },
        (tx) =>
          runSelfStateCommand(tx, {
            accountId: actor.accountId,
            personId: actor.personId!,
            participationId,
            action: 'PARTICIPATION_WITHDRAW_SELF',
            command: 'WITHDRAW',
            requireCompliance: false,
          })
      );
      return sendCommandOutcome(reply, outcome);
    }
  );

  app.get(
    '/api/v1/participations/:id',
    {
      exposeHeadRoute: false,
      onRequest: app.authenticate,
      schema: {
        operationId: 'getParticipation',
        summary: 'Read minimal participation state',
        tags: TAG,
        security: BEARER,
        params: IdParams,
        response: {
          200: ParticipationResource,
          401: ErrorSchema,
          404: ParticipationNotFoundError,
          500: ErrorSchema,
        },
      },
    },
    async (req, reply: FastifyReply) => {
      const actor = req.actor;
      if (!actor?.accountId || !actor.personId) throw typedError('UNAUTHENTICATED', 'Unauthenticated');
      const participationId = (req.params as { id: string }).id;
      if (!UUID_PATTERN.test(participationId)) throw participationNotFound();

      const self = await withIdentityTransaction(
        pool,
        { accountId: actor.accountId, purpose: 'PARTICIPATION' },
        async (tx) => {
          const visible = await getParticipationById(tx, participationId);
          if (!visible) return null;
          requireSelfDecision(actor.accountId, actor.personId!, visible, 'PARTICIPATION_READ_SELF');
          await setFamilyContext(tx, visible.family_id, actor.personId!, 'PARTICIPATION');
          const locked = await lockParticipationById(tx, visible.id);
          if (!locked) return null;
          if (locked.state === 'PENDING') {
            const expired = await recordExpiry(tx, locked, actor.accountId);
            if (expired) return expired;
          }
          return locked;
        }
      );
      if (self) return reply.status(200).send(participationBody(self));

      let familyId: string;
      try {
        familyId = await withIdentityTransaction(
          pool,
          { accountId: actor.accountId, purpose: 'FAMILY_MANAGEMENT' },
          (tx) => requireCurrentFamily(tx, actor.personId!)
        );
      } catch (error) {
        const code = (error as { code?: unknown })?.code;
        if (code === 'CURRENT_FAMILY_NOT_FOUND' || code === 'CURRENT_FAMILY_AMBIGUOUS') {
          throw participationNotFound();
        }
        throw error;
      }

      const managed = await withRlsTransaction(
        pool,
        {
          familyId,
          accountId: actor.accountId,
          personId: actor.personId,
          purpose: 'FAMILY_MANAGEMENT',
        },
        async (tx) => {
          const visible = await getParticipationById(tx, participationId);
          if (!visible) return null;
          try {
            await requireFamilyAction(tx, {
              accountId: actor.accountId,
              personId: actor.personId!,
              familyId,
              action: 'PARTICIPATION_READ_MANAGER',
              purpose: 'FAMILY_MANAGEMENT',
              resource: { type: 'PARTICIPATION', participationId },
              participation: {
                personId: visible.person_id,
                state: visible.state,
              },
            });
          } catch (error) {
            if (isKnownAuthorizationDenial(error)) return null;
            throw error;
          }

          const locked = await lockParticipationById(tx, visible.id);
          if (!locked) return null;
          if (locked.state === 'PENDING') {
            const expired = await recordExpiry(tx, locked, actor.accountId);
            if (expired) return expired;
          }
          return locked;
        }
      );

      if (!managed) throw participationNotFound();
      return reply.status(200).send(participationBody(managed));
    }
  );
}
