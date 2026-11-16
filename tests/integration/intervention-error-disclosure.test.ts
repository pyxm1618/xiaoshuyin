import { describe, expect, it } from 'vitest';
import { discloseInterventionFailure } from '../../packages/domain/src/index.js';

describe('Slice 16 intervention safe disclosure / anti-enumeration contract', () => {
  it('anti-enumerates definition guessing and professional-authority detail for unauthorized consumers', () => {
    const sensitive = [
      'INTERVENTION_DEFINITION_NOT_FOUND',
      'INTERVENTION_DEFINITION_VERSION_MISMATCH',
      'INTERVENTION_DEFINITION_HASH_MISMATCH',
      'INTERVENTION_STAFF_AUTHORITY_INVALID',
      'INTERVENTION_QUALIFICATION_MISSING',
      'INTERVENTION_APPROVAL_SCOPE_MISMATCH',
      'INTERVENTION_APPROVAL_EXPIRED',
      'INTERVENTION_AUTHORIZATION_DENIED',
    ] as const;
    const disclosed = sensitive.map((code) =>
      discloseInterventionFailure(code, { authorizedForDiagnostics: false })
    );
    expect(new Set(disclosed.map((entry) => entry.code))).toEqual(
      new Set(['INTERVENTION_NOT_AVAILABLE'])
    );
    for (const entry of disclosed) {
      expect(entry).not.toHaveProperty('internalCode');
      const wire = JSON.stringify(entry);
      expect(wire).not.toMatch(/qualification|staff|reviewer|wrong.*hash|wrong.*version/i);
    }
  });

  it('does not create a public HTTP route surface', async () => {
    const service = await import('../../apps/server/api/src/services/intervention-eligibility.js');
    expect(service).toHaveProperty('evaluateCurrentInterventionEligibility');
    expect(Object.keys(service).some((key) => /route|handler|http/i.test(key))).toBe(false);
  });
});
