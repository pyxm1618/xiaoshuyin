import {
  interventionDefinitionContentHash,
  parseInterventionDefinitionSemanticPayload,
  type InterventionDefinitionSemanticPayload,
} from './intervention-definition-schema.js';

export const INTERVENTION_DEFINITION_STATES = [
  'CANDIDATE',
  'CURRENT',
  'SUPERSEDED',
  'RETIRED',
] as const;
export type InterventionDefinitionState = (typeof INTERVENTION_DEFINITION_STATES)[number];

export type InterventionDefinitionErrorCode =
  | 'INTERVENTION_DEFINITION_INVALID'
  | 'INTERVENTION_DEFINITION_NOT_FOUND'
  | 'INTERVENTION_DEFINITION_VERSION_MISMATCH'
  | 'INTERVENTION_DEFINITION_HASH_MISMATCH'
  | 'INTERVENTION_DEFINITION_STALE_REVISION'
  | 'INTERVENTION_DEFINITION_PREDECESSOR_MISMATCH'
  | 'INTERVENTION_DEFINITION_RETIRED'
  | 'INTERVENTION_DEFINITION_SUPERSEDED'
  | 'INTERVENTION_DEFINITION_CONFLICT'
  | 'INTERVENTION_PROFESSIONAL_AUTHORITY_UNAVAILABLE'
  | 'INTERVENTION_PROFESSIONAL_AUTHORITY_INVALID'
  | 'INTERVENTION_QUALIFICATION_MISSING'
  | 'INTERVENTION_STAFF_AUTHORITY_INVALID'
  | 'INTERVENTION_APPROVAL_SCOPE_MISMATCH'
  | 'INTERVENTION_APPROVAL_EXPIRED'
  | 'INTERVENTION_UNPUBLISHED'
  | 'INTERVENTION_PACKAGE_MISMATCH'
  | 'INTERVENTION_FORMULATION_MISSING'
  | 'INTERVENTION_EVIDENCE_MISSING'
  | 'INTERVENTION_AGE_MISMATCH'
  | 'INTERVENTION_EXCLUSION'
  | 'INTERVENTION_CONSENT_BLOCK'
  | 'INTERVENTION_COMPLIANCE_BLOCK'
  | 'INTERVENTION_SAFETY_BLOCK'
  | 'INTERVENTION_COMBINATION_CONFLICT'
  | 'INTERVENTION_DEPENDENCY_UNAVAILABLE'
  | 'INTERVENTION_AUTHORIZATION_DENIED';

export class InterventionDefinitionError extends Error {
  readonly code: InterventionDefinitionErrorCode;
  constructor(code: InterventionDefinitionErrorCode, message: string = code) {
    super(message);
    this.name = 'InterventionDefinitionError';
    this.code = code;
  }
}

export interface InterventionDefinitionExactRef {
  readonly id: string;
  readonly sceneId: string;
  readonly interventionCode: string;
  readonly version: number;
  readonly contentHash: string;
}

export interface InterventionDefinitionRecord extends InterventionDefinitionExactRef {
  readonly state: InterventionDefinitionState;
  readonly revision: number;
  readonly semantic: InterventionDefinitionSemanticPayload;
  readonly supersedesId: string | null;
  readonly createdByPersonId: string;
  readonly createdAt: Date;
  readonly supersededAt: Date | null;
  readonly retiredAt: Date | null;
}

export interface PrepareInterventionDefinitionInput {
  readonly sceneId: string;
  readonly interventionCode: string;
  readonly version: number;
  readonly semantic: unknown;
}

export function normalizeInterventionCode(value: string): string {
  const code = value.trim().toUpperCase();
  if (!/^[A-Z][A-Z0-9_]{1,63}$/.test(code)) {
    throw new InterventionDefinitionError('INTERVENTION_DEFINITION_INVALID', 'invalid interventionCode');
  }
  return code;
}

export function prepareInterventionDefinition(
  input: PrepareInterventionDefinitionInput
): Omit<InterventionDefinitionExactRef, 'id'> & { readonly semantic: InterventionDefinitionSemanticPayload } {
  if (!Number.isInteger(input.version) || input.version < 1 || input.sceneId.trim().length === 0) {
    throw new InterventionDefinitionError('INTERVENTION_DEFINITION_INVALID');
  }
  const semantic = parseInterventionDefinitionSemanticPayload(input.semantic);
  return {
    sceneId: input.sceneId,
    interventionCode: normalizeInterventionCode(input.interventionCode),
    version: input.version,
    contentHash: interventionDefinitionContentHash(semantic),
    semantic,
  };
}

export function assertExactInterventionDefinition(
  definition: InterventionDefinitionRecord,
  expected: Pick<InterventionDefinitionExactRef, 'id' | 'version' | 'contentHash'>
): void {
  if (definition.id !== expected.id) throw new InterventionDefinitionError('INTERVENTION_DEFINITION_NOT_FOUND');
  if (definition.version !== expected.version) throw new InterventionDefinitionError('INTERVENTION_DEFINITION_VERSION_MISMATCH');
  if (definition.contentHash !== expected.contentHash) throw new InterventionDefinitionError('INTERVENTION_DEFINITION_HASH_MISMATCH');
}

export function assertDefinitionAvailableForNewFormalUse(definition: InterventionDefinitionRecord): void {
  if (definition.state === 'RETIRED') throw new InterventionDefinitionError('INTERVENTION_DEFINITION_RETIRED');
  if (definition.state === 'SUPERSEDED') throw new InterventionDefinitionError('INTERVENTION_DEFINITION_SUPERSEDED');
}
