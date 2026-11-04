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
