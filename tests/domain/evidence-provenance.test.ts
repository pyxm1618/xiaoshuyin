/**
 * T019 — frozen 8-row provenance admissibility matrix.
 *
 * RED before the Evidence domain validator exists.
 */

import { describe, it, expect } from 'vitest';
import { validateProvenance } from '../../packages/domain/src/evidence.js';

const SUBJECT = 'person-subject';
const SOURCE = 'person-source';

function facts(overrides: Record<string, unknown>) {
  return {
    writer: 'RECORD_STATEMENT',
    sourceKind: 'SELF_STATEMENT',
    subjectPersonId: SUBJECT,
    sourcePersonId: SUBJECT,
    subjectIsFamilyMember: true,
    sourceIsFamilyMember: true,
    sourceIsGuardianOfSubject: false,
    ...overrides,
  } as any;
}

describe('Provenance admissibility (T019)', () => {
  it('SELF_STATEMENT is allowed only for recordStatement with source = subject', () => {
    expect(validateProvenance(facts({})).ok).toBe(true);

    expect(
      validateProvenance(facts({ writer: 'RECORD_OBSERVATION' })).ok
    ).toBe(false);
    expect(
      validateProvenance(facts({ sourcePersonId: SOURCE, sourceIsGuardianOfSubject: true })).ok
    ).toBe(false);
  });

  it('GUARDIAN_OBSERVATION is allowed only for recordObservation with a real guardian', () => {
    const base = facts({
      writer: 'RECORD_OBSERVATION',
      sourceKind: 'GUARDIAN_OBSERVATION',
      sourcePersonId: SOURCE,
      sourceIsGuardianOfSubject: true,
    });
    expect(validateProvenance(base).ok).toBe(true);
    expect(validateProvenance({ ...base, writer: 'RECORD_STATEMENT' }).ok).toBe(false);
    expect(
      validateProvenance({ ...base, sourceIsGuardianOfSubject: false }).ok
    ).toBe(false);
  });

  it('GUARDIAN_RELAY is allowed only for recordStatement with a real guardian', () => {
    const base = facts({
      writer: 'RECORD_STATEMENT',
      sourceKind: 'GUARDIAN_RELAY',
      sourcePersonId: SOURCE,
      sourceIsGuardianOfSubject: true,
    });
    expect(validateProvenance(base).ok).toBe(true);
    expect(validateProvenance({ ...base, writer: 'RECORD_OBSERVATION' }).ok).toBe(false);
    expect(
      validateProvenance({ ...base, sourceIsGuardianOfSubject: false }).ok
    ).toBe(false);
  });

  it('OTHER_MEMBER_RELAY is allowed only for recordStatement with distinct members', () => {
    const base = facts({
      writer: 'RECORD_STATEMENT',
      sourceKind: 'OTHER_MEMBER_RELAY',
      sourcePersonId: SOURCE,
    });
    expect(validateProvenance(base).ok).toBe(true);
    expect(validateProvenance({ ...base, writer: 'RECORD_OBSERVATION' }).ok).toBe(false);
    expect(validateProvenance({ ...base, sourcePersonId: SUBJECT }).ok).toBe(false);
    expect(validateProvenance({ ...base, sourceIsFamilyMember: false }).ok).toBe(false);
  });

  it('fails closed for MANUAL_DEVICE_DATA / STAFF_RECORD / AI_HYPOTHESIS / SOURCE_CONFIRMED', () => {
    for (const sourceKind of [
      'MANUAL_DEVICE_DATA',
      'STAFF_RECORD',
      'AI_HYPOTHESIS',
      'SOURCE_CONFIRMED',
    ] as const) {
      for (const writer of [
        'RECORD_STATEMENT',
        'RECORD_OBSERVATION',
        'RECORD_HYPOTHESIS',
      ] as const) {
        const result = validateProvenance(
          facts({ writer, sourceKind, sourcePersonId: SOURCE, sourceIsGuardianOfSubject: true })
        );
        expect(result.ok, `${writer}/${sourceKind}`).toBe(false);
      }
    }
  });

  it('guardian relationship true never substitutes for Family membership', () => {
    const result = validateProvenance(
      facts({
        sourceKind: 'GUARDIAN_RELAY',
        sourcePersonId: SOURCE,
        sourceIsGuardianOfSubject: true,
        sourceIsFamilyMember: false,
      })
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('EVIDENCE_PROVENANCE_INVALID');
  });

  it('requires an existing subject for every allowed relay / observation row', () => {
    for (const sourceKind of [
      'SELF_STATEMENT',
      'GUARDIAN_OBSERVATION',
      'GUARDIAN_RELAY',
      'OTHER_MEMBER_RELAY',
    ] as const) {
      const result = validateProvenance(
        facts({
          writer: sourceKind === 'GUARDIAN_OBSERVATION' ? 'RECORD_OBSERVATION' : 'RECORD_STATEMENT',
          sourceKind,
          subjectPersonId: null,
          sourcePersonId: SOURCE,
          sourceIsGuardianOfSubject: true,
        })
      );
      expect(result.ok, sourceKind).toBe(false);
    }
  });
});