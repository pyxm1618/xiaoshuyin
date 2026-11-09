import { describe, expect, it } from 'vitest';
import {
  requestLogSerializer,
  sanitizeRequestUrlForLogs,
} from '../../apps/server/api/src/app.js';

describe('Slice 4 participation token log privacy', () => {
  it('redacts bearer token from public lookup and accept URLs', () => {
    const token='secret_bearer_token_123';
    expect(sanitizeRequestUrlForLogs(
      `/api/v1/participation-invites/${token}`
    )).toBe('/api/v1/participation-invites/[REDACTED]');
    expect(sanitizeRequestUrlForLogs(
      `/api/v1/participation-invites/${token}/accept?x=1`
    )).toBe('/api/v1/participation-invites/[REDACTED]/accept?x=1');
  });

  it('request serializer never returns the raw participation bearer token', () => {
    const token='another-secret-token';
    const serialized=requestLogSerializer({
      method:'GET',
      url:`/api/v1/participation-invites/${token}`,
      headers:{host:'localhost',authorization:'Bearer not-logged'},
      id:'req-1',
    });
    expect(JSON.stringify(serialized)).not.toContain(token);
    expect(serialized.url).toBe('/api/v1/participation-invites/[REDACTED]');
  });

  it('leaves unrelated URLs unchanged', () => {
    expect(sanitizeRequestUrlForLogs('/api/v1/cases/abc')).toBe('/api/v1/cases/abc');
  });
});
