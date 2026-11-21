import { z } from 'zod';

export const uuid = z.uuid().overwrite((value) => value.toLowerCase());
export const idempotencyKey = z.string().min(8).max(128);
const identity = { accountId: uuid, personId: uuid };
const grantFields = {
  ...identity,
  capability: z.string().min(1),
  validFrom: z.iso.datetime({ offset: true }),
  validUntil: z.iso.datetime({ offset: true }).nullable(),
};
export const grantInput = z.discriminatedUnion('scope', [
  z.strictObject({ ...grantFields, scope: z.literal('GLOBAL') }),
  z.strictObject({
    ...grantFields,
    scope: z.literal('CASE'),
    familyId: uuid,
    caseId: uuid,
    parentGrantId: uuid,
  }),
]);
export const revokeInput = z.strictObject({ assignmentId: uuid });
export const readInput = z.union([
  z.strictObject(identity),
  z.strictObject({ caseId: uuid }),
]);
export const assignment = z.strictObject({
  id: uuid,
  account_id: uuid,
  person_id: uuid,
  capability: z.string(),
  scope_type: z.enum(['GLOBAL', 'CASE']),
  family_id: uuid.nullable(),
  case_id: uuid.nullable(),
  capability_grant_id: uuid.nullable(),
  granted_by_account_id: uuid,
  granted_at: z.string(),
  valid_from: z.string(),
  valid_until: z.string().nullable(),
  revoked_by_account_id: uuid.nullable(),
  revoked_at: z.string().nullable(),
  created_at: z.string(),
});
export const inventoryEntry = assignment.extend({
  status: z.enum(['ACTIVE', 'REVOKED', 'EXPIRED', 'FUTURE', 'DISABLED', 'INVALID_PARENT']),
});

const capability = z.enum([
  'PROFESSIONAL_REVIEW', 'SAFETY_REVIEW', 'SAFETY_RESOLVE', 'DATA_RIGHTS',
  'QUALITY_REVIEW', 'EXCEPTION_SUPPORT', 'SERVICE_CONTROL',
]);
const [globalGrant, caseGrant] = grantInput.options;
export const staffGrantRequest = z.discriminatedUnion('scope', [
  globalGrant.extend({ capability }),
  caseGrant.extend({ capability }),
]);
export const staffMutationResponse = assignment.extend({ capability });
export const staffMutationHeaders = z.looseObject({ 'idempotency-key': idempotencyKey });
export const staffRevokeParams = z.strictObject({ grantId: uuid });
export const staffMeResponse = z.strictObject({
  staffPrincipal: z.strictObject(identity).nullable(),
  assignments: z.array(z.strictObject({
    id: uuid,
    capability,
    scope: z.enum(['GLOBAL', 'CASE']),
    familyId: uuid.nullable(),
    caseId: uuid.nullable(),
    parentGrantId: uuid.nullable(),
  })),
});
