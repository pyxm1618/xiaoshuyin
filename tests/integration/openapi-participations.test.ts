import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const spec = JSON.parse(
  readFileSync(join(process.cwd(), 'packages/generated/openapi.json'), 'utf-8')
);

describe('Generated OpenAPI — Slice 4 participation surface', () => {
  it('exposes exactly the six frozen participation operations', () => {
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
      'POST /api/v1/participations/{id}/withdraw',
    ]);
  });

  it('does not expose generic participant response or management routes', () => {
    const paths = Object.keys(spec.paths);
    expect(paths.some((p) => p.includes('/participations/{id}/responses'))).toBe(false);
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
