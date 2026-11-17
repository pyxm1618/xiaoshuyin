import { describe, expect, it } from 'vitest';
import {
  PRODUCTION_DIGITAL_USE_INTERVENTION_INCLUSIONS,
  resolveDigitalUseInterventionInclusion,
  resolveProductionDigitalUseInterventionInclusion,
} from '../../../packages/scenes/digital-use/index.js';

const exact = {
  scenePackageVersion: 'v1',
  definitionId: '00000000-0000-7000-8000-000000000016',
  definitionVersion: 1,
  contentHash: 'a'.repeat(64),
};

describe('Slice 16 exact Scene/package inclusion', () => {
  it('production has no developer-authored formal inclusion', () => {
    expect(PRODUCTION_DIGITAL_USE_INTERVENTION_INCLUSIONS).toEqual([]);
    expect(resolveProductionDigitalUseInterventionInclusion(exact).status).toBe('NOT_INCLUDED');
  });

  it('requires exact package + id + version + content hash', () => {
    expect(resolveDigitalUseInterventionInclusion([exact], exact).status).toBe('INCLUDED');
    for (const mismatch of [
      { ...exact, scenePackageVersion: 'v2' },
      { ...exact, definitionId: '00000000-0000-7000-8000-000000000017' },
      { ...exact, definitionVersion: 2 },
      { ...exact, contentHash: 'b'.repeat(64) },
    ]) {
      expect(resolveDigitalUseInterventionInclusion([exact], mismatch).status).toBe('NOT_INCLUDED');
    }
  });

  it('does not expose latest/nearest resolution', () => {
    const source = resolveDigitalUseInterventionInclusion.toString();
    expect(source).not.toMatch(/latest|nearest|fallback/i);
  });
});
