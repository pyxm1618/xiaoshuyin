import type { CasePhaseValue } from '@xiaoshuyin/domain';

export const DIGITAL_USE_SCENE_CODE = 'DIGITAL_USE' as const;
export const DIGITAL_USE_PACKAGE_VERSION = 'v1' as const;

export type DigitalUseEntryMode = 'ROUTED' | 'USER_INITIATED' | 'SCHEDULED';

export type DigitalUseStream =
  | 'FAMILY_ALLIANCE'
  | 'PHONE_USE_CONTRACT'
  | 'FAMILY_ALLIANCE_REVIEW'
  | 'PHONE_USE_CONTRACT_REVIEW';

export interface DigitalUseRecordContract {
  readonly refs: readonly string[];
  readonly semantics: string;
}

export interface DigitalUseNodeRoute {
  readonly kind: 'NODE';
  readonly targetNodeCode: string;
  readonly conditionRef: string;
  readonly reasonCode: string;
  readonly reason: string;
  readonly authorityRefs: readonly string[];
}

export interface DigitalUseTerminalRoute {
  readonly kind: 'TERMINAL';
  readonly terminalCode: string;
  readonly conditionRef: string;
  readonly reasonCode: string;
  readonly reason: string;
  readonly authorityRefs: readonly string[];
}

export type DigitalUseAllowedNext = DigitalUseNodeRoute | DigitalUseTerminalRoute;

export interface DigitalUseNodeManifestEntry {
  readonly nodeCode: string;
  readonly sourceNodeCode: string;
  readonly phase: CasePhaseValue;
  readonly stream?: DigitalUseStream;
  readonly role: string;
  readonly prerequisites: readonly string[];
  readonly inputSchemaRefs: readonly string[];
  readonly decisionSchemaRefs: readonly string[];
  readonly interactionRefs: readonly string[];
  readonly outputRefs: readonly string[];
  readonly recordContract: DigitalUseRecordContract;
  readonly allowedNext: readonly DigitalUseAllowedNext[];
  readonly canRunInParallelWith: readonly string[];
  readonly entryMode: readonly DigitalUseEntryMode[];
  readonly helpOrReentryRefs: readonly string[];
  readonly policyRefs: readonly string[];
  readonly authorityRefs: readonly string[];
}

export type DigitalUseConditionState =
  | boolean
  | 'UNKNOWN'
  | 'NOT_COLLECTED'
  | 'DECLINED'
  | 'CONFLICT';

export type DigitalUseEvidenceBasisCategory =
  | 'PURPOSE'
  | 'FUNCTIONAL_IMPACT'
  | 'SLEEP'
  | 'REAL_WORLD_ACTIVITY_DISPLACEMENT'
  | 'EMOTION'
  | 'FAMILY_RELATIONSHIP_OR_CONFLICT'
  | 'OTHER_APPROVED_EVIDENCE'
  | 'TOTAL_DURATION'
  | 'HISTORICAL_DURATION_BAND';

export interface DigitalUseRoutingInput {
  readonly sceneCode: typeof DIGITAL_USE_SCENE_CODE;
  readonly packageVersion: typeof DIGITAL_USE_PACKAGE_VERSION;
  readonly currentNodeCode: string;
  readonly conditions: Readonly<Record<string, DigitalUseConditionState>>;
  readonly evidenceBasis?: readonly DigitalUseEvidenceBasisCategory[];
}

export type DigitalUseRoutingResult =
  | {
      readonly kind: 'NODE_ROUTE';
      readonly authority: 'TOPOLOGY_ONLY';
      readonly fromNodeCode: string;
      readonly nextNodeCode: string;
      readonly reasonCode: string;
      readonly packageVersion: typeof DIGITAL_USE_PACKAGE_VERSION;
    }
  | {
      readonly kind: 'TERMINAL_ROUTE';
      readonly authority: 'TOPOLOGY_ONLY';
      readonly fromNodeCode: string;
      readonly terminalCode: string;
      readonly reasonCode: string;
      readonly packageVersion: typeof DIGITAL_USE_PACKAGE_VERSION;
    }
  | {
      readonly kind: 'BLOCKED';
      readonly authority: 'TOPOLOGY_ONLY';
      readonly fromNodeCode?: string;
      readonly code: 'NO_APPROVED_ROUTE' | 'AMBIGUOUS_ROUTE' | 'INVALID_ROUTING_INPUT' | 'INSUFFICIENT_INTEGRATED_EVIDENCE';
      readonly packageVersion: typeof DIGITAL_USE_PACKAGE_VERSION;
    }
  | {
      readonly kind: 'UNKNOWN';
      readonly authority: 'TOPOLOGY_ONLY';
      readonly fromNodeCode?: string;
      readonly code: 'UNKNOWN_NODE' | 'UNKNOWN_OR_UNSUPPORTED_CONDITION' | 'PACKAGE_MISMATCH';
      readonly packageVersion: typeof DIGITAL_USE_PACKAGE_VERSION;
    };

export interface DigitalUseValidationIssue {
  readonly code: string;
  readonly nodeCode?: string;
  readonly detail: string;
}

export interface DigitalUseValidationResult {
  readonly valid: boolean;
  readonly issues: readonly DigitalUseValidationIssue[];
}
