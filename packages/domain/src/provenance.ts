/**
 * Per-value provenance rules — pure functions, no I/O.
 * Per plan.md D-4: same (person, attribute, source_kind) supersedes;
 * different source_kind rows coexist.
 */

export type ProvenanceSource =
  | 'SELF_STATEMENT' | 'GUARDIAN_OBSERVATION' | 'GUARDIAN_RELAY'
  | 'OTHER_MEMBER_RELAY' | 'MANUAL_DEVICE_DATA' | 'STAFF_RECORD'
  | 'AI_HYPOTHESIS' | 'SOURCE_CONFIRMED';

export type ProfileAttribute = 'DISPLAY_NAME';

export type ValueStatus = 'RECORDED' | 'SUPERSEDED' | 'RETRACTED';

export interface ProfileValue {
  id: string;
  personId: string;
  attribute: ProfileAttribute;
  valueText: string;
  sourceKind: ProvenanceSource;
  providedByPersonId: string | null;
  status: ValueStatus;
  supersedesId: string | null;
}

export interface WriteResult {
  newValues: ProfileValue[];
  supersededIds: string[];
}

/**
 * Determine which existing rows to supersede when writing a new value.
 * Rule: same (personId, attribute, sourceKind) RECORDED rows get SUPERSEDED.
 * Different sourceKind rows remain RECORDED (coexist).
 */
export function computeSupersede(
  existing: ProfileValue[],
  newValue: Omit<ProfileValue, 'id' | 'status' | 'supersedesId'>
): WriteResult {
  const toSupersede = existing.filter(
    (v) =>
      v.personId === newValue.personId &&
      v.attribute === newValue.attribute &&
      v.sourceKind === newValue.sourceKind &&
      v.status === 'RECORDED'
  );

  return {
    newValues: [
      {
        ...newValue,
        id: '', // will be assigned
        status: 'RECORDED',
        supersedesId: toSupersede.length > 0 ? toSupersede[toSupersede.length - 1]!.id : null,
      },
    ],
    supersededIds: toSupersede.map((v) => v.id),
  };
}

/**
 * Source acceptability by path (CHK023).
 * Returns error code if not allowed, null if OK.
 */
export function checkSourceAcceptability(
  path: 'FAMILY_CREATE' | 'MEMBER_CREATE_UNDER_14' | 'MEMBER_CREATE_OTHER',
  ageBand: string,
  ageBandSource: string
): string | null {
  if (path === 'FAMILY_CREATE') {
    if (ageBand !== 'ADULT') return 'FAMILY_MANAGER_MUST_BE_ADULT';
    if (ageBandSource !== 'SELF_STATEMENT') return 'AGE_BAND_SOURCE_NOT_ALLOWED';
    return null;
  }

  if (path === 'MEMBER_CREATE_UNDER_14') {
    if (ageBandSource !== 'GUARDIAN_RELAY' && ageBandSource !== 'GUARDIAN_OBSERVATION') {
      return 'AGE_BAND_SOURCE_NOT_ALLOWED';
    }
    return null;
  }

  // MEMBER_CREATE_OTHER: all 4 writable sources allowed
  const allowed = ['SELF_STATEMENT', 'GUARDIAN_OBSERVATION', 'GUARDIAN_RELAY', 'OTHER_MEMBER_RELAY'];
  if (!allowed.includes(ageBandSource)) return 'AGE_BAND_SOURCE_NOT_ALLOWED';
  return null;
}

/**
 * Provider resolution for a single profile-value write.
 *
 * contracts/provenance.md:
 *  - SELF_STATEMENT: provider MUST be the subject Person (FR-004: unrelated to Account)
 *  - GUARDIAN_* / OTHER_MEMBER_RELAY: provider MUST be a Person with membership
 *    in that family (anti-impersonation)
 *  - UNDER_14 creation: provider is PINNED to consent.guardian_person_id
 *
 * Returns the provider to persist, or the frozen error code
 * `AGE_BAND_SOURCE_NOT_ALLOWED` (422) when the client tried to forge it.
 */
const WRITABLE_SOURCES: ProvenanceSource[] = [
  'SELF_STATEMENT', 'GUARDIAN_OBSERVATION', 'GUARDIAN_RELAY', 'OTHER_MEMBER_RELAY',
];

export type ProviderResolution =
  | { kind: 'FIXED'; provider: string }
  | { kind: 'CANDIDATE'; provider: string }
  | { kind: 'INVALID' };

export function resolveProvenanceProvider(args: {
  sourceKind: ProvenanceSource;
  /** the Person the value is about */
  subjectPersonId: string;
  /** the Person recording the value (always a member of the target family) */
  actorPersonId: string;
  providedByPersonId?: string | null;
  /** set when the contract pins the provider (UNDER_14 → consent.guardian_person_id) */
  pinnedProvider?: string | null;
}): ProviderResolution {
  const { sourceKind, subjectPersonId, actorPersonId, providedByPersonId, pinnedProvider } = args;

  // Contract-pinned provider (UNDER_14 creation). The pin is NOT a bypass for
  // source validation: a pinned provider implies guardian-origin information, so
  // only GUARDIAN_RELAY / GUARDIAN_OBSERVATION are acceptable. SELF_STATEMENT
  // and OTHER_MEMBER_RELAY are rejected rather than silently rewritten.
  if (pinnedProvider) {
    if (sourceKind !== 'GUARDIAN_RELAY' && sourceKind !== 'GUARDIAN_OBSERVATION') {
      return { kind: 'INVALID' };
    }
    if (providedByPersonId && providedByPersonId !== pinnedProvider) {
      return { kind: 'INVALID' };
    }
    return { kind: 'FIXED', provider: pinnedProvider };
  }

  if (!WRITABLE_SOURCES.includes(sourceKind)) return { kind: 'INVALID' };

  if (sourceKind === 'SELF_STATEMENT') {
    if (providedByPersonId && providedByPersonId !== subjectPersonId) {
      return { kind: 'INVALID' };
    }
    return { kind: 'FIXED', provider: subjectPersonId };
  }

  // Relay / observation: an explicit provider must belong to the family.
  if (providedByPersonId) {
    return { kind: 'CANDIDATE', provider: providedByPersonId };
  }
  // Default: the Person recording the value (already a family member).
  return { kind: 'FIXED', provider: actorPersonId };
}
