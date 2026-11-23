/**
 * Finding #22 — database error classification must never turn infrastructure
 * failure into a business denial.
 *
 * Only a structured PostgreSQL SQLSTATE 42501 carrying the known
 * `FAMILY_MEMBERSHIP_REQUIRED` RLS identity may map to a 404 business denial.
 * Everything else must propagate unchanged so the caller sees a 5xx / the raw
 * driver error.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { classifyFamilyMembershipDenial } from '../../apps/server/api/src/services/professional-knowledge-consumption.js';

function pgError(code: string, message: string): Error {
  return Object.assign(new Error(message), { code });
}

describe('Finding #22: FAMILY_MEMBERSHIP_REQUIRED denial classification', () => {
  it('accepts the real RLS identity: SQLSTATE 42501 + known marker', () => {
    expect(
      classifyFamilyMembershipDenial(
        pgError('42501', 'FAMILY_MEMBERSHIP_REQUIRED')
      )
    ).toBe('DENIED');
  });

  it('propagates a message-only fake error with no SQLSTATE', () => {
    expect(
      classifyFamilyMembershipDenial(
        new Error('FAMILY_MEMBERSHIP_REQUIRED')
      )
    ).toBe('PROPAGATE');
  });

  it('propagates SQLSTATE 42501 without the known identity', () => {
    expect(
      classifyFamilyMembershipDenial(
        pgError('42501', 'permission denied for table consent_records')
      )
    ).toBe('PROPAGATE');
  });

  it.each([
    ['08000', 'connection_exception'],
    ['08003', 'connection_does_not_exist'],
    ['08006', 'connection_failure'],
    ['57P01', 'admin_shutdown'],
    ['57P03', 'cannot_connect_now'],
    ['XX000', 'internal_error'],
    ['40001', 'serialization_failure'],
  ])('propagates class/SQLSTATE %s even with the RLS marker in the message', (code, message) => {
    expect(
      classifyFamilyMembershipDenial(pgError(code, `FAMILY_MEMBERSHIP_REQUIRED: ${message}`))
    ).toBe('PROPAGATE');
  });

  it('propagates ECONNRESET and timeout errors', () => {
    expect(classifyFamilyMembershipDenial(pgError('ECONNRESET', 'socket hang up'))).toBe(
      'PROPAGATE'
    );
    expect(
      classifyFamilyMembershipDenial(
        Object.assign(new Error('Query read timeout'), { name: 'TimeoutError' })
      )
    ).toBe('PROPAGATE');
    expect(
      classifyFamilyMembershipDenial(
        Object.assign(new Error('timeout exceeded when trying to connect'), {
          code: 'ETIMEDOUT',
        })
      )
    ).toBe('PROPAGATE');
  });

  it('accepts a structurally wrapped real denial', () => {
    const wrapper = new Error('query failed', {
      cause: pgError('42501', 'FAMILY_MEMBERSHIP_REQUIRED'),
    });
    expect(classifyFamilyMembershipDenial(wrapper)).toBe('DENIED');
  });

  it('propagates an unknown wrapped cause', () => {
    const wrapper = new Error('query failed', {
      cause: pgError('08006', 'FAMILY_MEMBERSHIP_REQUIRED'),
    });
    expect(classifyFamilyMembershipDenial(wrapper)).toBe('PROPAGATE');
  });

  it('propagates a wrapped message-only fake cause', () => {
    const wrapper = new Error('query failed', {
      cause: new Error('FAMILY_MEMBERSHIP_REQUIRED'),
    });
    expect(classifyFamilyMembershipDenial(wrapper)).toBe('PROPAGATE');
  });

  it('propagates non-error and cyclic shapes', () => {
    expect(classifyFamilyMembershipDenial(undefined)).toBe('PROPAGATE');
    expect(classifyFamilyMembershipDenial('FAMILY_MEMBERSHIP_REQUIRED')).toBe('PROPAGATE');
    const cyclic: { message: string; cause?: unknown } = {
      message: 'FAMILY_MEMBERSHIP_REQUIRED',
    };
    cyclic.cause = cyclic;
    expect(classifyFamilyMembershipDenial(cyclic)).toBe('PROPAGATE');
  });

  it('does not accept an arbitrarily deep wrapper chain', () => {
    let current: Error = pgError('42501', 'FAMILY_MEMBERSHIP_REQUIRED');
    for (let depth = 0; depth < 12; depth += 1) {
      current = new Error(`wrapper ${depth}`, { cause: current });
    }
    expect(classifyFamilyMembershipDenial(current)).toBe('PROPAGATE');
  });

  it('keeps the authoritative REPEATABLE READ consumption snapshot', () => {
    // Finding #22 only tightens error classification: the snapshot isolation
    // that the consumption decision relies on must stay exactly as approved.
    const source = readFileSync(
      fileURLToPath(
        new URL(
          '../../apps/server/api/src/services/professional-knowledge-consumption.ts',
          import.meta.url
        )
      ),
      'utf8'
    );
    expect(source).toContain("isolationLevel: 'REPEATABLE READ'");
  });
});
