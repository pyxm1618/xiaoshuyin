/**
 * T018 — Evidence capability surface.
 *
 * RED before packages/domain/src/evidence.ts exists (module resolution fails).
 * Proves the approved four writers exist, FACT stays a semantic kind, and no
 * FACT / generic Evidence writer is exported.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as evidence from '../../packages/domain/src/evidence.js';
import * as domain from '../../packages/domain/src/index.js';

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
/**
 * AUD-II-001 — production export boundary.
 *
 * The package entrypoint must expose exactly the approved Evidence writers
 * (plus the sole message command writer) and must NOT expose low-level Evidence
 * repository write primitives that could bypass provenance/FACT validation.
 */
describe('Evidence production export boundary (AUD-II-001)', () => {
  const APPROVED_WRITERS = [
    'recordStatement',
    'recordHypothesis',
    'recordObservation',
    'assignConflictGroup',
    'recordDialogueMessage',
  ];

  const FORBIDDEN_REPOSITORY_WRITES = [
    'insertDialogueMessage',
    'insertEvidenceAssertion',
    'insertEvidenceObservation',
    'setAssertionConflictGroup',
    'setObservationConflictGroup',
    'getAssertionRef',
    'getObservationRef',
  ];

  it('exposes the approved writers through the production package entrypoint', () => {
    for (const name of APPROVED_WRITERS) {
      expect(typeof (domain as any)[name], name).toBe('function');
    }
  });

  it('does not expose any Evidence repository write primitive', () => {
    for (const name of FORBIDDEN_REPOSITORY_WRITES) {
      expect((domain as any)[name], `leaked repository primitive ${name}`).toBeUndefined();
    }
  });

  it('does not expose a FACT / generic Evidence writer', () => {
    for (const name of FORBIDDEN_EXPORTS) {
      expect((domain as any)[name], `forbidden export ${name}`).toBeUndefined();
    }
  });

  const DISABLED_SOURCES = [
    'MANUAL_DEVICE_DATA',
    'STAFF_RECORD',
    'AI_HYPOTHESIS',
    'SOURCE_CONFIRMED',
  ] as const;

  /** Minimal tx stub: memberships exist, guardian lookup returns none. */
  function stubTx() {
    return {
      async query(sql: string) {
        if (sql.includes('person_compliance_profiles')) {
          return { rows: [{ guardian_person_id: null }] };
        }
        return { rows: [{ id: 'member' }] };
      },
    } as any;
  }

  function statementDraft(sourceKind: string) {
    return {
      subjectPersonId: 'subject-person',
      sourceKind,
      sourcePersonId: 'source-person',
      occurredTimeState: 'UNKNOWN',
      confirmationStatus: 'UNCONFIRMED',
      content: 'relay content',
    } as any;
  }

  it('disabled provenance cannot bypass recordStatement', async () => {
    for (const sourceKind of DISABLED_SOURCES) {
      await expect(
        evidence.recordStatement(
          stubTx(),
          {
            familyId: 'f',
            caseId: 'c',
            actorAccountId: 'a',
            actorPersonId: 'p',
          },
          statementDraft(sourceKind)
        ),
        sourceKind
      ).rejects.toMatchObject({ code: 'EVIDENCE_PROVENANCE_INVALID' });
    }
  });

  it('disabled provenance cannot bypass recordObservation', async () => {
    for (const sourceKind of DISABLED_SOURCES) {
      await expect(
        evidence.recordObservation(
          stubTx(),
          {
            familyId: 'f',
            caseId: 'c',
            actorAccountId: 'a',
            actorPersonId: 'p',
          },
          {
            ...statementDraft(sourceKind),
            observationCode: 'play.hours',
            value: { state: 'UNKNOWN' },
          }
        ),
        sourceKind
      ).rejects.toMatchObject({ code: 'EVIDENCE_PROVENANCE_INVALID' });
    }
  });
});