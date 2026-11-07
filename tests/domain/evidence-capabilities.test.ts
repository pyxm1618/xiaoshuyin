/**
 * T018 — Evidence capability surface.
 *
 * RED before packages/domain/src/evidence.ts exists (module resolution fails).
 * Proves the approved four writers exist, FACT stays a semantic kind, and no
 * FACT / generic Evidence writer is exported.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as evidence from '../../packages/domain/src/evidence.js';

const FORBIDDEN_EXPORTS = [
  'recordFact',
  'createFact',
  'confirmFact',
  'promoteToFact',
  'updateAssertionKind',
  'createAssertion',
  'createEvidence',
  'createPerson',
];

describe('Evidence capability surface (T018)', () => {
  it('exposes exactly the four approved type-specific writers', () => {
    for (const name of [
      'recordStatement',
      'recordHypothesis',
      'recordObservation',
      'assignConflictGroup',
    ]) {
      expect(typeof (evidence as any)[name], name).toBe('function');
    }
  });

  it('keeps FACT in the semantic assertion-kind union', () => {
    expect(evidence.ASSERTION_KINDS).toEqual(['STATEMENT', 'FACT', 'HYPOTHESIS']);
    expect(evidence.ASSERTION_KINDS).not.toContain('OBSERVATION');
  });

  it('exports no FACT / generic Evidence writer or Person creator', () => {
    for (const name of FORBIDDEN_EXPORTS) {
      expect((evidence as any)[name], `forbidden export ${name}`).toBeUndefined();
    }
  });

  it('recordHypothesis is fail-closed for every current provenance source', async () => {
    for (const sourceKind of [
      'SELF_STATEMENT',
      'GUARDIAN_OBSERVATION',
      'GUARDIAN_RELAY',
      'OTHER_MEMBER_RELAY',
      'MANUAL_DEVICE_DATA',
      'STAFF_RECORD',
      'AI_HYPOTHESIS',
      'SOURCE_CONFIRMED',
    ] as const) {
      const result = evidence.validateProvenance({
        writer: 'RECORD_HYPOTHESIS',
        sourceKind,
        subjectPersonId: 'person-subject',
        sourcePersonId: 'person-source',
        subjectIsFamilyMember: true,
        sourceIsFamilyMember: true,
        sourceIsGuardianOfSubject: true,
      });
      expect(result.ok, sourceKind).toBe(false);
      if (!result.ok) {
        expect(result.code, sourceKind).toBe('EVIDENCE_HYPOTHESIS_SOURCE_UNAVAILABLE');
      }
    }
  });

  it('recordHypothesis rejects before touching any transaction', async () => {
    const hostileTx = {
      query() {
        throw new Error('transaction must not be used');
      },
    };
    await expect(
      evidence.recordHypothesis(
        hostileTx as any,
        {
          familyId: 'f',
          caseId: 'c',
          actorAccountId: 'a',
          actorPersonId: 'p',
        },
        { content: 'candidate hypothesis' } as any
      )
    ).rejects.toMatchObject({ code: 'EVIDENCE_HYPOTHESIS_SOURCE_UNAVAILABLE' });
  });
});