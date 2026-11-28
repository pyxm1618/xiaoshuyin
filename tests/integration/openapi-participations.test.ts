import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const spec = JSON.parse(
  readFileSync(join(process.cwd(), 'packages/generated/openapi.json'), 'utf-8')
);

describe('Generated OpenAPI — Slice 4 participation surface', () => {
  it('exposes the six frozen participation operations plus the formalized child response operation', () => {
    const operations: string[] = [];
    for (const [path, item] of Object.entries(spec.paths as Record<string, any>)) {
      if (!path.includes('participation')) continue;
      for (const method of ['get', 'post', 'put', 'patch', 'delete']) {
        if ((item as any)[method]) operations.push(`${method.toUpperCase()} ${path}`);
      }
    }
    expect(operations.sort()).toEqual([
      'GET /api/v1/participation-invites/{token}',
      'GET /api/v1/participations/{id}',
      'POST /api/v1/cases/{id}/participation-invites',
      'POST /api/v1/participation-invites/{token}/accept',
      'POST /api/v1/participations/{id}/decline',
      'POST /api/v1/participations/{id}/responses',
      'POST /api/v1/participations/{id}/withdraw',
    ]);
  });

  it('formalizes the child response operation without widening authority', () => {
    const operation = (spec.paths as Record<string, any>)['/api/v1/participations/{id}/responses']?.post;
    expect(operation).toBeDefined();
    expect(operation.operationId).toBe('createParticipationResponse');
    expect(operation.security).toEqual([{ bearerAuth: [] }]);
    expect((operation.parameters ?? []).map((p: any) => p.$ref)).toEqual([
      '#/components/parameters/ParticipationIdPath',
    ]);
    expect(operation.requestBody.content['application/json'].schema).toEqual({
      $ref: '#/components/schemas/CreateParticipationResponseRequest',
    });
    expect(Object.keys(operation.responses).sort()).toEqual([
      '201', '401', '403', '404', '409', '422',
    ]);
    expect(spec.components.schemas.CreateParticipationResponseRequest.additionalProperties).toBe(false);
    expect(spec.components.schemas.ParticipationResponseDto.additionalProperties).toBe(false);
    expect(Object.keys(spec.components.schemas.ParticipationResponseDto.properties).sort()).toEqual([
      'authorPersonId', 'caseId', 'content', 'createdAt', 'id', 'participationId',
    ]);
  });

  it('does not expose generic participant management routes', () => {
    const paths = Object.keys(spec.paths);
    expect(paths.some((p) => p.endsWith('/participants'))).toBe(false);
  });

  it('keeps the frozen state enum', () => {
    expect(spec.components.schemas.CaseParticipationState.enum).toEqual([
      'PENDING', 'ACTIVE', 'DECLINED', 'EXPIRED', 'WITHDRAWN',
    ]);
  });

  it('create/accept/decline/withdraw requests are strict', () => {
    for (const name of [
      'CreateParticipationInviteRequest',
      'AcceptParticipationRequest',
      'DeclineParticipationRequest',
      'WithdrawParticipationRequest',
    ]) {
      expect(spec.components.schemas[name].additionalProperties, name).toBe(false);
    }
  });

  it('public invite projection excludes private identifiers', () => {
    const schema = spec.components.schemas.ParticipationInvitePublicView;
    expect(Object.keys(schema.properties).sort()).toEqual([
      'expiresAt', 'notice', 'participationId', 'state',
    ]);
    for (const field of ['personId', 'caseId', 'familyId', 'guardianPersonId', 'ageBand', 'consent']) {
      expect(schema.properties[field]).toBeUndefined();
    }
  });
});
