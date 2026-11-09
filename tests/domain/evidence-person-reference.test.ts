/**
 * T022 — Person reference / source message security boundary.
 *
 * RED before the Evidence domain validators exist.
 */

import { describe, it, expect } from 'vitest';
import * as evidence from '../../packages/domain/src/evidence.js';
import { EvidenceDomainError } from '../../packages/domain/src/evidence.js';

const FAMILY = 'family-a';
const CASE = 'case-a';

describe('Person reference validation (T022)', () => {
  it('accepts null refs and members of the target Family', () => {
    expect(
      evidence.validatePersonReferences({
        subjectPersonId: null,
        sourcePersonId: null,
        subjectIsFamilyMember: false,
        sourceIsFamilyMember: false,
      }).ok
    ).toBe(true);
    expect(
      evidence.validatePersonReferences({
        subjectPersonId: 'p1',
        sourcePersonId: 'p2',
        subjectIsFamilyMember: true,
        sourceIsFamilyMember: true,
      }).ok
    ).toBe(true);
  });

  it('rejects a subject / source that is not a member of the target Family', () => {
    for (const input of [
      { subjectPersonId: 'p-b', sourcePersonId: null, subjectIsFamilyMember: false, sourceIsFamilyMember: false },
      { subjectPersonId: null, sourcePersonId: 'p-b', subjectIsFamilyMember: false, sourceIsFamilyMember: false },
    ]) {
      const result = evidence.validatePersonReferences(input);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.code).toBe('EVIDENCE_PERSON_REFERENCE_INVALID');
    }
  });

  it('normalizes errors without leaking UUIDs or raw FK/RLS details', () => {
    const error = new EvidenceDomainError('EVIDENCE_PERSON_REFERENCE_INVALID');
    expect(error.code).toBe('EVIDENCE_PERSON_REFERENCE_INVALID');
    expect(error.message).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}/i);
    expect(error.message).not.toMatch(/foreign key|row-level security|42501/i);
  });

  it('guardian relationship does not substitute for membership', () => {
    const result = evidence.validateProvenance({
      writer: 'RECORD_STATEMENT',
      sourceKind: 'GUARDIAN_RELAY',
      subjectPersonId: 'child',
      sourcePersonId: 'guardian',
      subjectIsFamilyMember: true,
      sourceIsFamilyMember: false,
      sourceIsGuardianOfSubject: true,
    });
    expect(result.ok).toBe(false);
  });

  it('does not create Persons (no creation capability is exported)', () => {
    for (const name of ['createPerson', 'createChildPerson', 'ensurePerson']) {
      expect((evidence as any)[name], name).toBeUndefined();
    }
  });
});

describe('Source message provenance validation (T022)', () => {
  const message = {
    id: 'm1',
    familyId: FAMILY,
    caseId: CASE,
    sourcePersonId: 'p1',
  };

  it('accepts a message in the same Family/Case with the same source person', () => {
    expect(
      evidence.validateSourceMessage({
        sourceMessageId: 'm1',
        sourcePersonId: 'p1',
        message,
        familyId: FAMILY,
        caseId: CASE,
      }).ok
    ).toBe(true);
  });

  it('accepts an absent source message', () => {
    expect(
      evidence.validateSourceMessage({
        sourceMessageId: null,
        sourcePersonId: 'p1',
        message: null,
        familyId: FAMILY,
        caseId: CASE,
      }).ok
    ).toBe(true);
  });

  it('rejects cross-Family / cross-Case / source-person mismatch / missing message', () => {
    for (const input of [
      { ...message, familyId: 'family-b' },
      { ...message, caseId: 'case-b' },
      { ...message, sourcePersonId: 'p2' },
    ]) {
      const result = evidence.validateSourceMessage({
        sourceMessageId: 'm1',
        sourcePersonId: 'p1',
        message: input,
        familyId: FAMILY,
        caseId: CASE,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.code).toBe('EVIDENCE_PERSON_REFERENCE_INVALID');
    }

    const missing = evidence.validateSourceMessage({
      sourceMessageId: 'missing',
      sourcePersonId: 'p1',
      message: null,
      familyId: FAMILY,
      caseId: CASE,
    });
    expect(missing.ok).toBe(false);
  });
});