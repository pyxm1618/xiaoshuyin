/**
 * Frozen `ConsentRecord` response projection (OpenAPI components/schemas).
 */

export function consentRecordDto(row: any) {
  return {
    id: row.id,
    purpose: row.purpose,
    decision: row.decision,
    version: row.version,
    guardianPersonId: row.guardian_person_id,
    onboardingRequestId: row.onboarding_request_id,
    boundPersonId: row.bound_person_id,
    boundAt: row.bound_at ? new Date(row.bound_at).toISOString() : null,
    noticeVersion: row.notice_version,
    noticeHash: row.notice_hash,
    policyVersion: row.policy_version,
    decidedAt: new Date(row.decided_at).toISOString(),
    supersedesId: row.supersedes_id,
  };
}