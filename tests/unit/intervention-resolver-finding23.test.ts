import { describe, it, expect, vi } from 'vitest';
import { resolveCurrentInterventionDefinition } from '../../apps/server/api/src/services/professional-knowledge.js';
import * as interventionRepo from '../../packages/domain/src/intervention-definition-repository.js';

describe('Finding #23: resolveCurrentInterventionDefinition fail-closed contract', () => {
  const ref = {
    definitionId: '018f0000-0000-7000-8000-000000000001',
    definitionVersion: 1,
    contentHash: 'a'.repeat(64),
  };

  const fakeTx = {} as any;

  it('accepts CURRENT intervention definition -> RESOLVED', async () => {
    vi.spyOn(interventionRepo, 'getExactInterventionDefinition').mockResolvedValueOnce({
      id: ref.definitionId,
      version: ref.definitionVersion,
      contentHash: ref.contentHash,
      state: 'CURRENT',
    } as any);

    const result = await resolveCurrentInterventionDefinition(fakeTx, ref);
    expect(result).toEqual({
      status: 'RESOLVED',
      ref: {
        definitionId: ref.definitionId,
        definitionVersion: ref.definitionVersion,
        contentHash: ref.contentHash,
      },
    });
  });

  it('rejects CANDIDATE intervention definition -> INVALID (fail closed)', async () => {
    vi.spyOn(interventionRepo, 'getExactInterventionDefinition').mockResolvedValueOnce({
      id: ref.definitionId,
      version: ref.definitionVersion,
      contentHash: ref.contentHash,
      state: 'CANDIDATE',
    } as any);

    const result = await resolveCurrentInterventionDefinition(fakeTx, ref);
    expect(result).toEqual({
      status: 'INVALID',
      reason: 'INTERVENTION_DEFINITION_CANDIDATE',
    });
  });

  it('rejects SUPERSEDED intervention definition -> INVALID', async () => {
    vi.spyOn(interventionRepo, 'getExactInterventionDefinition').mockResolvedValueOnce({
      id: ref.definitionId,
      version: ref.definitionVersion,
      contentHash: ref.contentHash,
      state: 'SUPERSEDED',
    } as any);

    const result = await resolveCurrentInterventionDefinition(fakeTx, ref);
    expect(result).toEqual({
      status: 'INVALID',
      reason: 'INTERVENTION_DEFINITION_SUPERSEDED',
    });
  });

  it('rejects RETIRED intervention definition -> INVALID', async () => {
    vi.spyOn(interventionRepo, 'getExactInterventionDefinition').mockResolvedValueOnce({
      id: ref.definitionId,
      version: ref.definitionVersion,
      contentHash: ref.contentHash,
      state: 'RETIRED',
    } as any);

    const result = await resolveCurrentInterventionDefinition(fakeTx, ref);
    expect(result).toEqual({
      status: 'INVALID',
      reason: 'INTERVENTION_DEFINITION_RETIRED',
    });
  });

  it('rejects unknown intervention definition state -> INVALID (fail closed)', async () => {
    vi.spyOn(interventionRepo, 'getExactInterventionDefinition').mockResolvedValueOnce({
      id: ref.definitionId,
      version: ref.definitionVersion,
      contentHash: ref.contentHash,
      state: 'SOME_UNKNOWN_STATE' as any,
    } as any);

    const result = await resolveCurrentInterventionDefinition(fakeTx, ref);
    expect(result).toEqual({
      status: 'INVALID',
      reason: 'INTERVENTION_DEFINITION_INVALID',
    });
  });

  it('rejects nonexistent intervention definition -> INVALID (NOT_EXACT)', async () => {
    vi.spyOn(interventionRepo, 'getExactInterventionDefinition').mockResolvedValueOnce(null);

    const result = await resolveCurrentInterventionDefinition(fakeTx, ref);
    expect(result).toEqual({
      status: 'INVALID',
      reason: 'INTERVENTION_DEFINITION_NOT_EXACT',
    });
  });
});
