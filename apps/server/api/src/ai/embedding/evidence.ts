import type { ProviderModelEchoStatus } from './port.js';

export type CapabilityEvidenceState =
  | 'CONTRACT_VERIFIED'
  | 'PROVIDER_NOT_VERIFIED'
  | 'PROVIDER_VERIFIED';

export type ExternalAvailabilityStatus = 'PROVIDER_NOT_VERIFIED' | 'READY';

export type ExternalVerificationCoverageId =
  | 'EVC-01'
  | 'EVC-02'
  | 'EVC-03'
  | 'EVC-04'
  | 'EVC-05'
  | 'EVC-06'
  | 'EVC-07'
  | 'EVC-08'
  | 'EVC-09'
  | 'EVC-10';

export interface ProviderVerificationRecord {
  readonly source: 'REAL_ALIBABA_DASHSCOPE_CALL';
  readonly executedAt: string;
  readonly environmentId: string;
  readonly configuredModelId: string;
  readonly configuredModelVersionOrRevision: string;
  readonly providerRequestId: string;
  readonly providerModelEcho: ProviderModelEchoStatus;
  readonly observedResponseEnvelope: 'HTTP_OUTPUT_WRAPPED';
  readonly evcCoverage: readonly ExternalVerificationCoverageId[];
  readonly command: string;
  readonly inputDigest: string;
  readonly resultSummary: string;
}

export interface CapabilityEvidenceRecord {
  readonly capabilityEvidenceState: CapabilityEvidenceState;
  readonly externalAvailabilityStatus: ExternalAvailabilityStatus;
  readonly contractEvidence: boolean;
  readonly providerEvidence: boolean;
  readonly missingEvc: readonly ExternalVerificationCoverageId[];
}

const REQUIRED_EVC: readonly ExternalVerificationCoverageId[] = Object.freeze([
  'EVC-01', 'EVC-02', 'EVC-03', 'EVC-04', 'EVC-05',
  'EVC-06', 'EVC-07', 'EVC-08', 'EVC-09', 'EVC-10',
]);

function isNonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function hasValidProviderRecord(record: ProviderVerificationRecord | null): boolean {
  if (!record) return false;
  if (record.source !== 'REAL_ALIBABA_DASHSCOPE_CALL') return false;
  if (record.observedResponseEnvelope !== 'HTTP_OUTPUT_WRAPPED') return false;
  if (!isNonEmpty(record.executedAt) || Number.isNaN(Date.parse(record.executedAt))) return false;
  if (!isNonEmpty(record.environmentId)) return false;
  if (!isNonEmpty(record.configuredModelId)) return false;
  if (!isNonEmpty(record.configuredModelVersionOrRevision)) return false;
  if (!isNonEmpty(record.providerRequestId)) return false;
  if (!isNonEmpty(record.command) || !isNonEmpty(record.resultSummary)) return false;
  if (!/^[a-f0-9]{64}$/i.test(record.inputDigest)) return false;
  return true;
}

export function deriveCapabilityEvidence(input: {
  readonly contractChecksAllPassed: boolean;
  readonly configComplete: boolean;
  readonly providerVerification: ProviderVerificationRecord | null;
}): CapabilityEvidenceRecord {
  const coverage = new Set<ExternalVerificationCoverageId>(input.providerVerification?.evcCoverage ?? []);
  const missingEvc = Object.freeze(REQUIRED_EVC.filter((id) => !coverage.has(id)));
  const contractEvidence = input.contractChecksAllPassed === true;
  const providerEvidence =
    contractEvidence &&
    input.configComplete === true &&
    missingEvc.length === 0 &&
    hasValidProviderRecord(input.providerVerification);

  if (providerEvidence) {
    return Object.freeze({
      capabilityEvidenceState: 'PROVIDER_VERIFIED' as const,
      externalAvailabilityStatus: 'READY' as const,
      contractEvidence: true,
      providerEvidence: true,
      missingEvc,
    });
  }

  return Object.freeze({
    capabilityEvidenceState: contractEvidence ? 'CONTRACT_VERIFIED' as const : 'PROVIDER_NOT_VERIFIED' as const,
    externalAvailabilityStatus: 'PROVIDER_NOT_VERIFIED' as const,
    contractEvidence,
    providerEvidence: false,
    missingEvc,
  });
}
