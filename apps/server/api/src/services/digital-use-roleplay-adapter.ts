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

/**
 * A4003-only current Model / Prompt authority.
 *
 * This is intentionally narrower than the future TaskModelRegistry. It is a
 * server-side authority seam only: production has no implicit/default approval,
 * while tests may inject deterministic current authority.
 */
export interface RoleplayModelPromptAuthority {
  readonly model: {
    readonly status: 'CURRENT_APPROVED';
    readonly modelRef: string;
    readonly authorityRef: string;
  } | null;
  readonly prompt: {
    readonly status: 'CURRENT_APPROVED';
    readonly promptVersionRef: string;
    readonly authorityRef: string;
  } | null;
}

export type RoleplayModelPromptAuthorityProvider =
  () => Promise<RoleplayModelPromptAuthority | null>;

export interface RoleplayCapabilityContext {
  readonly scenePackageVersion: string;
  readonly professionalContentVersion: string;
  readonly featureCode: 'DIGITAL_USE_ROLEPLAY_A4003';
  readonly expectedModelRef: string;
  readonly expectedPromptVersionRef: string;
  readonly modelAuthorityRef: string;
  readonly promptAuthorityRef: string;
}

export interface RoleplayTurnInput {
  readonly sessionId: string;
  readonly roundNumber: number;
  readonly simulatedChildInput: string;
  readonly actorPersonId: string;
  readonly scenePackageVersion: string;
  readonly professionalContentVersion: string;
  readonly expectedModelRef: string;
  readonly expectedPromptVersionRef: string;
  readonly modelAuthorityRef: string;
  readonly promptAuthorityRef: string;
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

export interface RoleplayDownstreamExecutionProvider {
  readonly providerRef: string;
  isAvailable(context: RoleplayCapabilityContext): Promise<boolean>;
  executeTurn(input: RoleplayTurnInput): Promise<RoleplayTurnOutput>;
}

export interface ProductionRoleplayAdapterOptions {
  /**
   * Verified downstream execution provider. If missing, null, or reporting
   * false, the adapter strictly fails closed (isAvailable = false).
   */
  readonly downstreamExecutionProvider?: RoleplayDownstreamExecutionProvider | null;
  /**
   * Verified professional content authority. If missing or status is not
   * APPROVED_PUBLISHED, the adapter reports unavailable.
   */
  readonly professionalContentAuthority?: RoleplayProfessionalContentAuthority | null;
  /**
   * Verified Model / Prompt authority provider. Both model and prompt must
   * resolve to CURRENT_APPROVED and match requested references.
   */
  readonly modelPromptAuthorityProvider?: RoleplayModelPromptAuthorityProvider | null;
}

/**
 * Creates a bounded production RoleplayAdapter that is available only when
 * professional content is approved, model/prompt authorities are valid, and
 * downstream execution provider is operational.
 *
 * If any authority or provider is absent, it strictly fails closed (isAvailable = false,
 * createTurn throws DOWNSTREAM_AI_UNAVAILABLE) without canned output.
 */
export function createProductionRoleplayAdapter(
  options: ProductionRoleplayAdapterOptions = {}
): RoleplayAdapter {
  const adapterRef =
    options.downstreamExecutionProvider?.providerRef ?? 'phase3:production-adapter';

  return Object.freeze({
    adapterRef,
    async isAvailable(context: RoleplayCapabilityContext): Promise<boolean> {
      // 1. Professional content authority must be present, approved, and match version
      const content = options.professionalContentAuthority;
      if (
        !content ||
        content.status !== 'APPROVED_PUBLISHED' ||
        content.version !== context.professionalContentVersion
      ) {
        return false;
      }

      // 2. Model & Prompt authority provider must resolve valid CURRENT_APPROVED references
      if (!options.modelPromptAuthorityProvider) {
        return false;
      }
      let authority: RoleplayModelPromptAuthority | null;
      try {
        authority = await options.modelPromptAuthorityProvider();
      } catch {
        return false;
      }
      if (!authority || !authority.model || !authority.prompt) {
        return false;
      }
      if (
        authority.model.status !== 'CURRENT_APPROVED' ||
        authority.model.modelRef !== context.expectedModelRef ||
        authority.model.authorityRef !== context.modelAuthorityRef
      ) {
        return false;
      }
      if (
        authority.prompt.status !== 'CURRENT_APPROVED' ||
        authority.prompt.promptVersionRef !== context.expectedPromptVersionRef ||
        authority.prompt.authorityRef !== context.promptAuthorityRef
      ) {
        return false;
      }

      // 3. Downstream execution provider must be present and available
      const downstream = options.downstreamExecutionProvider;
      if (!downstream) {
        return false;
      }
      try {
        const available = await downstream.isAvailable(context);
        return available === true;
      } catch {
        return false;
      }
    },

    async createTurn(input: RoleplayTurnInput): Promise<RoleplayTurnOutput> {
      const context: RoleplayCapabilityContext = {
        scenePackageVersion: input.scenePackageVersion,
        professionalContentVersion: input.professionalContentVersion,
        featureCode: 'DIGITAL_USE_ROLEPLAY_A4003',
        expectedModelRef: input.expectedModelRef,
        expectedPromptVersionRef: input.expectedPromptVersionRef,
        modelAuthorityRef: input.modelAuthorityRef,
        promptAuthorityRef: input.promptAuthorityRef,
      };

      const available = await this.isAvailable(context);
      if (!available || !options.downstreamExecutionProvider) {
        throw Object.assign(new Error('DOWNSTREAM_AI_UNAVAILABLE'), {
          code: 'DOWNSTREAM_AI_UNAVAILABLE',
        });
      }

      return options.downstreamExecutionProvider.executeTurn(input);
    },
  });
}
