/**
 * T101/T102 — candidate-facing anti-enumeration: every internal outcome is the
 * same status / body key set / headers, with no reason, attempt or person id.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  bootstrap,
  buildBindingApp,
  candidateDecision,
  candidateSession,
  candidateStatus,
  createTarget,
  type BindingHarness,
} from '../setup/identity-binding.js';
import type { IncomingHttpHeaders } from 'node:http';

function observable(res: { statusCode: number; body: string; headers: IncomingHttpHeaders }) {
  return {
    statusCode: res.statusCode,
    keys: Object.keys(JSON.parse(res.body)).sort(),
    setCookie: res.headers['set-cookie'] ?? null,
    location: res.headers['location'] ?? null,
    contentType: res.headers['content-type'],
  };
}

describe('candidate-facing anti-enumeration', () => {
  let h: BindingHarness;

  beforeAll(async () => {
    h = await buildBindingApp();
  });

  afterAll(async () => {
    await h.close();
  });

  it('bootstrap generic branches are observationally identical', async () => {
    const adult = await createTarget(h, 'enum_adult', { ageBand: 'ADULT' });
    const other = await createTarget(h, 'enum_other', { ageBand: 'MINOR_14_17' });
    const multi = await createTarget(h, 'enum_multi', {
      ageBand: 'MINOR_14_17',
      extraFamilyIds: [other.familyId],
    });

    const responses = await Promise.all([
      bootstrap(h, `missing_${Date.now()}`, `enum_missing_${Date.now()}`),
      bootstrap(h, adult.invitationToken, `enum_adult_${Date.now()}`),
      bootstrap(h, multi.invitationToken, `enum_multi_${Date.now()}`),
    ]);

    const observations = responses.map(observable);
    for (const obs of observations) {
      expect(obs.statusCode).toBe(200);
      expect(obs.keys).toEqual(['binding', 'pendingContextToken']);
      expect(obs.setCookie).toBeNull();
      expect(obs.location).toBeNull();
    }
    expect(observations[1]).toEqual(observations[0]);
    expect(observations[2]).toEqual(observations[0]);

    for (const res of responses) {
      const body = JSON.parse(res.body);
      expect(body.binding).toBe('NOT_COMPLETED');
      expect(body).not.toHaveProperty('attemptId');
      expect(body).not.toHaveProperty('personId');
      expect(body).not.toHaveProperty('reason');
      expect(body).not.toHaveProperty('ageBand');
    }
  });

  it('generic candidate surfaces expose no internal reason', async () => {
    const adult = await createTarget(h, 'enum_surface', { ageBand: 'ADULT' });
    const boot = await bootstrap(h, adult.invitationToken, `enum_surface_${Date.now()}`);
    const token = boot.json().pendingContextToken as string;

    const decision = await candidateDecision(h, token, 'AFFIRM', undefined, 'candidate-binding-v1');
    expect(decision.statusCode).toBe(200);
    expect(decision.json()).toEqual({ binding: 'NOT_COMPLETED' });

    const status = await candidateStatus(h, token);
    expect(status.statusCode).toBe(200);
    expect(status.json()).toEqual({ binding: 'NOT_COMPLETED' });

    const session = await candidateSession(h, token);
    expect(session.statusCode).toBe(200);
    expect(session.json()).toEqual({ binding: 'NOT_COMPLETED' });
  });
});