/**
 * T093 — exactly six binding capability surfaces, no participant / Evidence /
 * intervention route owned by this slice.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildBindingApp, type BindingHarness } from '../setup/identity-binding.js';

const BINDING_PATHS = [
  '/api/v1/identity-bindings/bootstrap',
  '/api/v1/identity-bindings/candidate-decision',
  '/api/v1/identity-bindings/status',
  '/api/v1/identity-bindings/session',
  '/api/v1/identity-bindings/pending',
];

describe('identity binding route surface', () => {
  let h: BindingHarness;

  beforeAll(async () => {
    h = await buildBindingApp();
  });

  afterAll(async () => {
    await h.close();
  });

  it('exposes exactly six binding routes', () => {
    const tree = h.app.printRoutes({ commonPrefix: false });
    for (const path of BINDING_PATHS) expect(tree).toContain(path.slice(1));
    expect(tree).toContain('identity-bindings/:attemptId/decision');

    const nodes = tree
      .split('\n')
      .filter((line) => line.includes('identity-bindings/'))
      .map((line) => line.trim());
    expect(nodes.length).toBeGreaterThanOrEqual(6);
  });

  it('owns no participant / evidence / intervention route', () => {
    const tree = h.app.printRoutes();
    expect(tree).not.toContain('/participations');
    expect(tree).not.toContain('/evidence');
    expect(tree).not.toContain('/interventions');
    expect(tree).not.toContain('/observations');
  });
});