import type { FastifyInstance, FastifyRequest } from 'fastify';
import type pg from 'pg';
import { ErrorSchema, InternalError, UnauthenticatedError } from '@xiaoshuyin/contracts';
import { readIdempotencyKey } from '../idempotency.js';
import { toHttpError } from '../plugins/error-handler.js';
import { createStaffAuthorityCommands } from './commands.js';
import {
  staffGrantRequest, staffMeResponse, staffMutationHeaders, staffMutationResponse, staffRevokeParams,
} from './schemas.js';

const tags = ['staff'];
const security = [{ bearerAuth: [] }];
const errors = { 401: UnauthenticatedError, 500: InternalError };
const mutationResponse = {
  ...errors,
  200: staffMutationResponse,
  403: ErrorSchema,
  409: ErrorSchema,
  422: ErrorSchema,
};

function requestSession(req: FastifyRequest): string {
  const authorization = req.headers.authorization;
  if (!req.actor || !authorization?.startsWith('Bearer ')) throw toHttpError('UNAUTHENTICATED');
  return authorization.slice(7);
}

function mapStaffCommandError(error: unknown): never {
  if (!(error instanceof Error) || !('code' in error)) throw error;
  switch (error.code) {
    case 'UNAUTHENTICATED':
      throw toHttpError('UNAUTHENTICATED');
    case '42501':
      if (error.message === 'STAFF_AUTHORITY_SELF_GRANT_DENIED') {
        throw toHttpError('FORBIDDEN', 'Self-grant is forbidden');
      }
      if (error.message === 'STAFF_AUTHORITY_CONTROL_DENIED') throw toHttpError('FORBIDDEN');
      break;
    case '22023':
      if (error.message === 'STAFF_AUTHORITY_PARENT_INVALID') {
        throw toHttpError('VALIDATION_ERROR', 'Invalid parent grant');
      }
      if (error.message === 'STAFF_AUTHORITY_GRANT_INVALID') {
        throw toHttpError('VALIDATION_ERROR', 'Invalid Staff grant');
      }
      break;
    case '23503':
    case '23514':
      throw toHttpError('VALIDATION_ERROR', 'Invalid Staff grant');
    case '23505':
      if (error.message === 'STAFF_AUTHORITY_GRANT_OVERLAP') {
        throw { statusCode: 409, code: 'STAFF_AUTHORITY_GRANT_OVERLAP', message: 'Staff authority window overlaps an existing grant' };
      }
      break;
    case 'P0002':
      if (error.message === 'STAFF_AUTHORITY_ASSIGNMENT_NOT_FOUND') {
        throw { statusCode: 404, code: 'STAFF_AUTHORITY_ASSIGNMENT_NOT_FOUND', message: 'Staff assignment not found' };
      }
      break;
    case 'IDEMPOTENCY_MISMATCH':
      throw toHttpError('IDEMPOTENCY_PAYLOAD_MISMATCH');
  }
  throw error;
}

export function registerStaffAuthorityRoutes(app: FastifyInstance, pool: pg.Pool, sessionSecret: string): void {
  const commands = createStaffAuthorityCommands(pool, sessionSecret);
  const onRequest = app.authenticate;

  app.get('/api/v1/staff/me', {
    onRequest,
    schema: { operationId: 'getStaffMe', tags, security, response: { ...errors, 200: staffMeResponse } },
  }, async (req) => {
    const actor = req.actor;
    if (!actor?.personId) throw toHttpError('UNAUTHENTICATED');
    return commands.readSelf({ accountId: actor.accountId, personId: actor.personId });
  });

  app.post('/api/v1/staff/capability-grants', {
    onRequest,
    schema: {
      operationId: 'grantStaffCapability', tags, security,
      headers: staffMutationHeaders, body: staffGrantRequest, response: mutationResponse,
    },
  }, async (req) => {
    const token = requestSession(req);
    const key = readIdempotencyKey(req);
    return commands.grant(token, key, req.body).catch(mapStaffCommandError);
  });

  app.post<{ Params: { grantId: string } }>('/api/v1/staff/capability-grants/:grantId/revoke', {
    onRequest,
    schema: {
      operationId: 'revokeStaffCapability', tags, security,
      headers: staffMutationHeaders, params: staffRevokeParams,
      response: { ...mutationResponse, 404: ErrorSchema },
    },
  }, async (req) => {
    if (req.body !== undefined) throw toHttpError('VALIDATION_ERROR', 'Revoke does not accept a request body');
    const token = requestSession(req);
    const key = readIdempotencyKey(req);
    return commands.revoke(token, key, { assignmentId: req.params.grantId }).catch(mapStaffCommandError);
  });
}
