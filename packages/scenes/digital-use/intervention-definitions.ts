export interface DigitalUseInterventionDefinitionRef {
  readonly definitionId: string;
  readonly definitionVersion: number;
  readonly contentHash: string;
}

export interface DigitalUseInterventionInclusion extends DigitalUseInterventionDefinitionRef {
  readonly scenePackageVersion: string;
}

/**
 * Production formal inclusion is deliberately empty while Professional
 * Approval / release authority is operationally unavailable.
 */
export const PRODUCTION_DIGITAL_USE_INTERVENTION_INCLUSIONS:
  readonly DigitalUseInterventionInclusion[] = Object.freeze([]);

export type InterventionPackageInclusionResult =
  | { readonly status: 'INCLUDED'; readonly inclusion: DigitalUseInterventionInclusion }
  | { readonly status: 'NOT_INCLUDED' };

export function resolveDigitalUseInterventionInclusion(
  inclusions: readonly DigitalUseInterventionInclusion[],
  input: DigitalUseInterventionInclusion
): InterventionPackageInclusionResult {
  const inclusion = inclusions.find(
    (candidate) =>
      candidate.scenePackageVersion === input.scenePackageVersion &&
      candidate.definitionId === input.definitionId &&
      candidate.definitionVersion === input.definitionVersion &&
      candidate.contentHash === input.contentHash
  );
  return inclusion ? { status: 'INCLUDED', inclusion } : { status: 'NOT_INCLUDED' };
}

export function resolveProductionDigitalUseInterventionInclusion(
  input: DigitalUseInterventionInclusion
): InterventionPackageInclusionResult {
  return resolveDigitalUseInterventionInclusion(
    PRODUCTION_DIGITAL_USE_INTERVENTION_INCLUSIONS,
    input
  );
}


export interface DigitalUseInterventionInclusionProvider {
  resolve(
    input: DigitalUseInterventionInclusion
  ): Promise<InterventionPackageInclusionResult>;
}

/**
 * Production package consumer. It deliberately resolves only the package-owned
 * production inclusion set, which remains empty while release authority is
 * operationally unavailable. Tests may inject a provider; production never
 * imports a fixture.
 */
export const productionDigitalUseInterventionInclusionProvider:
  DigitalUseInterventionInclusionProvider = Object.freeze({
    async resolve(
      input: DigitalUseInterventionInclusion
    ): Promise<InterventionPackageInclusionResult> {
      return resolveProductionDigitalUseInterventionInclusion(input);
    },
  });
