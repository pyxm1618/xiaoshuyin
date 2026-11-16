/**
 * Slice 14 Phase-2 bounded roleplay adapter seam.
 *
 * Production intentionally has no Phase-3 model implementation. Tests may
 * inject a deterministic adapter; production never returns canned AI output.
 */
/**
 * Professional content authority is deliberately separate from product-frozen
 * Phone Contract content. Production currently supplies no approved package.
 * Tests may inject an explicit approved/published package without changing
 * production authority.
 */
export interface RoleplayProfessionalContentAuthority {
  readonly status: 'APPROVED_PUBLISHED';
  readonly version: string;
  readonly authorityRef: string;
}

export interface RoleplayCapabilityContext {
  readonly scenePackageVersion: string;
  readonly professionalContentVersion: string;
  readonly featureCode: 'DIGITAL_USE_ROLEPLAY_A4003';
}

export interface RoleplayTurnInput {
  readonly sessionId: string;
  readonly roundNumber: number;
  readonly simulatedChildInput: string;
  readonly actorPersonId: string;
  readonly scenePackageVersion: string;
  readonly professionalContentVersion: string;
}

export interface RoleplayTurnOutput {
  readonly simulatedParentOutput: string;
  readonly adapterRef: string;
  readonly modelRef: string;
  readonly promptVersionRef: string;
}

export interface RoleplayAdapter {
  readonly adapterRef: string;
  isAvailable(context: RoleplayCapabilityContext): Promise<boolean>;
  createTurn(input: RoleplayTurnInput): Promise<RoleplayTurnOutput>;
}

export const unavailableProductionRoleplayAdapter: RoleplayAdapter = Object.freeze({
  adapterRef: 'phase3:unavailable',
  async isAvailable() { return false; },
  async createTurn(): Promise<RoleplayTurnOutput> {
    throw Object.assign(new Error('DOWNSTREAM_AI_UNAVAILABLE'), {
      code: 'DOWNSTREAM_AI_UNAVAILABLE',
    });
  },
});
