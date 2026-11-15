/**
 * AUTH-007 + AUTH-008 — production Safety-resolution authority source.
 *
 * This module is the one production fact source for ResolveRisk authority.
 * Household roles never participate in this decision.  A verified result
 * requires, in one database snapshot:
 *
 *   ACTIVE reviewer Account/Person identity
 *   + current GLOBAL SAFETY_RESOLVE capability grant
 *   + current CASE SAFETY_RESOLVE assignment linked to that grant
 *   + exact target Case scope
 *
 * Review Evidence and approved Safety Policy context remain owned by the
 * existing ResolveRisk/Safety trace path; this source does not create a second
 * evidence or policy model.
 */

export type SafetyResolutionAuthorityResult =
  | {
      status: 'VERIFIED';
      authorityRef: string;
      capability: 'SAFETY_RESOLVE';
      capabilityGrantId: string;
      assignmentId: string;
      familyId: string;
      caseId: string;
      accountId: string;
      personId: string;
    }
  | { status: 'DENIED' }
  | { status: 'UNAVAILABLE' };

export interface SafetyResolutionAuthorityInput {
  caseId: string;
  accountId: string;
  personId: string;
}

export interface SafetyResolutionAuthoritySource {
  resolve(
    input: SafetyResolutionAuthorityInput
  ): Promise<SafetyResolutionAuthorityResult>;
}

interface SafetyResolutionAuthorityRow {
  assignment_id: string;
  capability_grant_id: string;
  family_id: string;
  case_id: string;
  account_id: string;
  person_id: string;
}

export interface SafetyResolutionAuthorityQuery {
  query(
    text: string,
    values: unknown[]
  ): Promise<{ rows: SafetyResolutionAuthorityRow[] }>;
}

function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

/**
 * Construct the database-backed production authority source.
 *
 * The caller supplies the query handle from the SAME transaction used by
 * ResolveRisk. PostgreSQL CURRENT_TIMESTAMP is transaction-stable, so grant
 * validity and Case assignment are evaluated against one authoritative time
 * snapshot. Database/infrastructure errors are intentionally not converted to
 * DENIED/UNAVAILABLE: they propagate as infrastructure failures.
 */
export function createProductionSafetyResolutionAuthoritySource(
  reader: SafetyResolutionAuthorityQuery
): SafetyResolutionAuthoritySource {
  return {
    async resolve(
      input: SafetyResolutionAuthorityInput
    ): Promise<SafetyResolutionAuthorityResult> {
      const result = await reader.query(
        `SELECT
           assignment.id::text AS assignment_id,
           capability_grant.id::text AS capability_grant_id,
           assignment.family_id::text AS family_id,
           assignment.case_id::text AS case_id,
           assignment.account_id::text AS account_id,
           assignment.person_id::text AS person_id
         FROM staff_assignments assignment
         JOIN staff_assignments capability_grant
           ON capability_grant.id = assignment.capability_grant_id
         JOIN accounts reviewer_account
           ON reviewer_account.id = assignment.account_id
        WHERE assignment.account_id = $1
          AND assignment.person_id = $2
          AND assignment.case_id = $3
          AND assignment.scope_type = 'CASE'
          AND assignment.capability = 'SAFETY_RESOLVE'
          AND assignment.revoked_at IS NULL
          AND assignment.valid_from <= CURRENT_TIMESTAMP
          AND (
            assignment.valid_until IS NULL
            OR assignment.valid_until > CURRENT_TIMESTAMP
          )
          AND capability_grant.scope_type = 'GLOBAL'
          AND capability_grant.capability = 'SAFETY_RESOLVE'
          AND capability_grant.account_id = assignment.account_id
          AND capability_grant.person_id = assignment.person_id
          AND capability_grant.revoked_at IS NULL
          AND capability_grant.valid_from <= CURRENT_TIMESTAMP
          AND (
            capability_grant.valid_until IS NULL
            OR capability_grant.valid_until > CURRENT_TIMESTAMP
          )
          AND reviewer_account.status = 'ACTIVE'
        ORDER BY assignment.id
        LIMIT 2`,
        [input.accountId, input.personId, input.caseId]
      );

      // Ambiguous duplicate current assignments fail closed instead of choosing
      // an arbitrary authority fact.
      if (result.rows.length !== 1) return { status: 'DENIED' };

      const row = result.rows[0]!;
      if (
        !nonEmpty(row.assignment_id) ||
        !nonEmpty(row.capability_grant_id) ||
        !nonEmpty(row.family_id) ||
        !nonEmpty(row.case_id) ||
        !nonEmpty(row.account_id) ||
        !nonEmpty(row.person_id) ||
        row.case_id !== input.caseId ||
        row.account_id !== input.accountId ||
        row.person_id !== input.personId
      ) {
        return { status: 'DENIED' };
      }

      return {
        status: 'VERIFIED',
        authorityRef: `staff_assignment:${row.assignment_id}`,
        capability: 'SAFETY_RESOLVE',
        capabilityGrantId: row.capability_grant_id,
        assignmentId: row.assignment_id,
        familyId: row.family_id,
        caseId: row.case_id,
        accountId: row.account_id,
        personId: row.person_id,
      };
    },
  };
}
