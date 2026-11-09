import { describe, expect, it } from 'vitest';
import {
  CASE_PARTICIPATION_STATES,
  PARTICIPATION_ERROR_CODES,
} from '../../packages/domain/src/participants.js';

describe('Slice 4 participation domain vocabulary', () => {
  it('has exactly the frozen lifecycle states', () => {
    expect(CASE_PARTICIPATION_STATES).toEqual([
      'PENDING', 'ACTIVE', 'DECLINED', 'EXPIRED', 'WITHDRAWN',
    ]);
    expect(CASE_PARTICIPATION_STATES).not.toContain('REVOKED');
    expect(CASE_PARTICIPATION_STATES).not.toContain('CANCELLED');
  });

  it('registers the frozen public participation errors without identity-oracle codes', () => {
    expect(PARTICIPATION_ERROR_CODES).toEqual([
      'PARTICIPATION_ALREADY_EXISTS',
      'PARTICIPATION_TARGET_INELIGIBLE',
      'INVITATION_NOT_AVAILABLE',
      'PARTICIPATION_NOT_FOUND',
      'PARTICIPATION_STATE_CONFLICT',
    ]);
    expect(PARTICIPATION_ERROR_CODES).not.toContain('IDENTITY_BINDING_REQUIRED');
    expect(PARTICIPATION_ERROR_CODES).not.toContain('ACCOUNT_MISMATCH');
  });
});
