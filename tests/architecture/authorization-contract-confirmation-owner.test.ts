import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const AUTH_PATH = fileURLToPath(
  new URL('../../packages/authorization/src/authorize.ts', import.meta.url)
);
const source = readFileSync(AUTH_PATH, 'utf8');

function extractBetween(startMarker: string, endMarker: string): string {
  const start = source.indexOf(startMarker);
  if (start === -1) throw new Error(`missing start marker: ${startMarker}`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (end === -1) throw new Error(`missing end marker: ${endMarker}`);
  return source.slice(start, end);
}

function occurrences(needle: string): number {
  return source.split(needle).length - 1;
}

const contractDecision = extractBetween(
  'function decidePhoneUseContractAction(',
  '/**\n * Slice 4 participation authorization.'
);
const registeredActions = extractBetween(
  'const REGISTERED_ACTIONS: Action[] = [',
  'const REGISTERED_PURPOSES: Purpose[] = ['
);
const registeredPurposes = extractBetween(
  'const REGISTERED_PURPOSES: Purpose[] = [',
  'const BINDING_ACTIONS: Action[] = ['
);
const caseActions = extractBetween(
  'const CASE_ACTIONS: Action[] = [',
  'const PHONE_USE_CONTRACT_ACTIONS: Action[] = ['
);
const contractActions = extractBetween(
  'const PHONE_USE_CONTRACT_ACTIONS: Action[] = [',
  'const PARTICIPATION_ACTIONS: Action[] = ['
);
const participationActions = extractBetween(
  'const PARTICIPATION_ACTIONS: Action[] = [',
  'const EMPTY_FACTS: AuthorizeFacts = {'
);

describe('Authorization owner narrow Contract-confirmation architecture', () => {
  it('preserves one authoritative authorize() entry point', () => {
    expect(occurrences('export function authorize(')).toBe(1);
    expect(source).not.toContain('export function authorizeContract');
    expect(source).not.toContain('export function canConfirmContract');
  });

  it('keeps the action and purpose in closed registries', () => {
    expect(registeredActions).toContain("'PHONE_USE_CONTRACT_CONFIRM_SELF'");
    expect(registeredPurposes).toContain("'PHONE_USE_CONTRACT'");
    expect(contractActions).toContain("'PHONE_USE_CONTRACT_CONFIRM_SELF'");
  });

  it('does not smuggle Contract confirmation into generic Case or Participation actions', () => {
    expect(caseActions).not.toContain('PHONE_USE_CONTRACT_CONFIRM_SELF');
    expect(participationActions).not.toContain('PHONE_USE_CONTRACT_CONFIRM_SELF');
    expect(contractDecision).not.toContain('CASE_RESPOND_ASSESSMENT_SCENE');
    expect(contractDecision).not.toContain('PARTICIPATION_READ_SELF');
  });

  it('keeps authorize() pure and database-free', () => {
    for (const forbidden of [
      "from 'pg'",
      'from "pg"',
      '.query(',
      'SELECT ',
      'INSERT ',
      'UPDATE ',
      'DELETE ',
      'pool.',
      '.connect(',
    ]) {
      expect(contractDecision).not.toContain(forbidden);
    }
  });

  it('requires explicit Contract, party and ACTIVE participation facts', () => {
    for (const required of [
      "input.resource.type !== 'PHONE_USE_CONTRACT_VERSION'",
      'facts.phoneUseContractConfirmation',
      "input.resource.partyRole !== 'CHILD'",
      'confirmation.contractPartyPersonId !== actorPersonId',
      "participation.state !== 'ACTIVE'",
      "confirmation.participationState !== 'ACTIVE'",
      'confirmation.contractVersionId !== input.resource.contractVersionId',
      'confirmation.participationId !== participation.participationId',
      'confirmation.participationCaseId !== input.case.caseId',
      'confirmation.participationFamilyId !== input.family.familyId',
    ]) {
      expect(contractDecision).toContain(required);
    }
  });

  it('keeps lifecycle/business transition policy out of Authorization', () => {
    for (const forbidden of [
      "status === 'DRAFT'",
      "status === 'PENDING_CONFIRMATION'",
      "status === 'ACTIVE'",
      'supersedes',
      'draftRevision',
      'draft_revision',
    ]) {
      expect(contractDecision).not.toContain(forbidden);
    }
  });
});
