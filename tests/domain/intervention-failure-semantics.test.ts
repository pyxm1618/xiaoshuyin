import { describe, expect, it } from 'vitest';
import {
  discloseInterventionFailure,
  type InterventionDefinitionErrorCode,
} from '../../packages/domain/src/index.js';

describe('Slice 16 bounded intervention failure semantics', () => {
  const cases: Array<{
    code: InterventionDefinitionErrorCode;
    unauthorized:
      | 'INTERVENTION_NOT_AVAILABLE'
      | 'INTERVENTION_CONTEXT_BLOCKED'
      | 'INTERVENTION_CONFLICT'
      | 'DEPENDENCY_UNAVAILABLE';
  }> = [
    { code: 'INTERVENTION_DEFINITION_NOT_FOUND', unauthorized: 'INTERVENTION_NOT_AVAILABLE' },
    { code: 'INTERVENTION_DEFINITION_VERSION_MISMATCH', unauthorized: 'INTERVENTION_NOT_AVAILABLE' },
    { code: 'INTERVENTION_DEFINITION_HASH_MISMATCH', unauthorized: 'INTERVENTION_NOT_AVAILABLE' },
    { code: 'INTERVENTION_PROFESSIONAL_AUTHORITY_UNAVAILABLE', unauthorized: 'INTERVENTION_NOT_AVAILABLE' },
    { code: 'INTERVENTION_PROFESSIONAL_AUTHORITY_INVALID', unauthorized: 'INTERVENTION_NOT_AVAILABLE' },
    { code: 'INTERVENTION_QUALIFICATION_MISSING', unauthorized: 'INTERVENTION_NOT_AVAILABLE' },
    { code: 'INTERVENTION_STAFF_AUTHORITY_INVALID', unauthorized: 'INTERVENTION_NOT_AVAILABLE' },
    { code: 'INTERVENTION_APPROVAL_SCOPE_MISMATCH', unauthorized: 'INTERVENTION_NOT_AVAILABLE' },
    { code: 'INTERVENTION_APPROVAL_EXPIRED', unauthorized: 'INTERVENTION_NOT_AVAILABLE' },
    { code: 'INTERVENTION_UNPUBLISHED', unauthorized: 'INTERVENTION_NOT_AVAILABLE' },
    { code: 'INTERVENTION_RETIRED', unauthorized: 'INTERVENTION_CONTEXT_BLOCKED' },
    { code: 'INTERVENTION_SUPERSEDED', unauthorized: 'INTERVENTION_CONTEXT_BLOCKED' },
    { code: 'INTERVENTION_PACKAGE_MISMATCH', unauthorized: 'INTERVENTION_CONTEXT_BLOCKED' },
    { code: 'INTERVENTION_DEFINITION_STALE_REVISION', unauthorized: 'INTERVENTION_CONFLICT' },
    { code: 'INTERVENTION_FORMULATION_MISSING', unauthorized: 'INTERVENTION_CONTEXT_BLOCKED' },
    { code: 'INTERVENTION_EVIDENCE_MISSING', unauthorized: 'INTERVENTION_CONTEXT_BLOCKED' },
    { code: 'INTERVENTION_AGE_MISMATCH', unauthorized: 'INTERVENTION_CONTEXT_BLOCKED' },
    { code: 'INTERVENTION_EXCLUSION', unauthorized: 'INTERVENTION_CONTEXT_BLOCKED' },
    { code: 'INTERVENTION_CONSENT_BLOCK', unauthorized: 'INTERVENTION_CONTEXT_BLOCKED' },
    { code: 'INTERVENTION_COMPLIANCE_BLOCK', unauthorized: 'INTERVENTION_CONTEXT_BLOCKED' },
    { code: 'INTERVENTION_SAFETY_BLOCK', unauthorized: 'INTERVENTION_CONTEXT_BLOCKED' },
    { code: 'INTERVENTION_COMBINATION_CONFLICT', unauthorized: 'INTERVENTION_CONTEXT_BLOCKED' },
    { code: 'INTERVENTION_DEPENDENCY_UNAVAILABLE', unauthorized: 'DEPENDENCY_UNAVAILABLE' },
    { code: 'INTERVENTION_INFRASTRUCTURE_FAILURE', unauthorized: 'DEPENDENCY_UNAVAILABLE' },
    { code: 'INTERVENTION_IDEMPOTENCY_MISMATCH', unauthorized: 'INTERVENTION_CONFLICT' },
  ];

  for (const row of cases) {
    it('keeps ' + row.code + ' deterministic internally and safely bounded externally', () => {
      expect(
        discloseInterventionFailure(row.code, { authorizedForDiagnostics: false })
      ).toEqual({ code: row.unauthorized });
      const internal = discloseInterventionFailure(row.code, {
        authorizedForDiagnostics: true,
      });
      expect(internal.internalCode).toBe(row.code);
    });
  }

  it('never turns technical unavailable into professional rejection or ALLOW', () => {
    expect(
      discloseInterventionFailure('INTERVENTION_DEPENDENCY_UNAVAILABLE', {
        authorizedForDiagnostics: false,
      }).code
    ).toBe('DEPENDENCY_UNAVAILABLE');
    expect(
      discloseInterventionFailure('INTERVENTION_PROFESSIONAL_AUTHORITY_UNAVAILABLE', {
        authorizedForDiagnostics: false,
      }).code
    ).toBe('INTERVENTION_NOT_AVAILABLE');
  });
});
