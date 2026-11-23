import { describe, it, expect, vi } from 'vitest';
import type pg from 'pg';
import { createInterventionDefinitionCandidate } from '../../apps/server/api/src/services/intervention-definitions.js';
import { interventionSemantic, TEST_ONLY_QUALIFICATION_PROVIDER } from '../support/intervention.js';

describe('Finding #15: Sensitive Intervention Staff Writes Account ACTIVE Revalidation', () => {
  it('rejects mutation with INTERVENTION_STAFF_AUTHORITY_INVALID if account status is INACTIVE', async () => {
    const mockTx = {
      query: vi.fn().mockImplementation((sql: string, params?: unknown[]) => {
        if (typeof sql === 'string' && sql.includes('SELECT status FROM accounts')) {
          return Promise.resolve({ rows: [{ status: 'SUSPENDED' }] });
        }
        if (typeof sql === 'string' && sql.includes('SELECT id FROM staff_assignments')) {
          return Promise.resolve({ rows: [{ id: 'staff-assign-1' }] });
        }
        return Promise.resolve({ rows: [] });
      }),
      on: vi.fn(),
      removeListener: vi.fn(),
      release: vi.fn(),
    };

    const mockPool = {
      connect: vi.fn().mockResolvedValue(mockTx),
    } as unknown as pg.Pool;

    await expect(
      createInterventionDefinitionCandidate(mockPool, {
        actor: { accountId: 'acc-suspended', personId: 'p-1' },
        sceneId: 'DIGITAL_USE',
        interventionCode: 'DU_CODE_01',
        semantic: interventionSemantic(),
        approvalScope: 'DIGITAL_USE',
        idempotencyKey: 'idem-key-1',
      })
    ).rejects.toMatchObject({
      code: 'INTERVENTION_STAFF_AUTHORITY_INVALID',
    });

    // Verify row lock was requested with FOR KEY SHARE
    expect(mockTx.query).toHaveBeenCalledWith(
      'SELECT status FROM accounts WHERE id = $1 FOR KEY SHARE',
      ['acc-suspended']
    );

    // Verify mutation insert was never called
    const insertCalls = mockTx.query.mock.calls.filter(([sql]) =>
      typeof sql === 'string' && sql.includes('INSERT INTO intervention_definitions')
    );
    expect(insertCalls.length).toBe(0);
  });

  it('rejects mutation if account row is missing', async () => {
    const mockTx = {
      query: vi.fn().mockImplementation((sql: string) => {
        if (typeof sql === 'string' && sql.includes('SELECT status FROM accounts')) {
          return Promise.resolve({ rows: [] });
        }
        return Promise.resolve({ rows: [] });
      }),
      on: vi.fn(),
      removeListener: vi.fn(),
      release: vi.fn(),
    };

    const mockPool = {
      connect: vi.fn().mockResolvedValue(mockTx),
    } as unknown as pg.Pool;

    await expect(
      createInterventionDefinitionCandidate(mockPool, {
        actor: { accountId: 'acc-missing', personId: 'p-1' },
        sceneId: 'DIGITAL_USE',
        interventionCode: 'DU_CODE_01',
        semantic: interventionSemantic(),
        approvalScope: 'DIGITAL_USE',
        idempotencyKey: 'idem-key-2',
      })
    ).rejects.toMatchObject({
      code: 'INTERVENTION_STAFF_AUTHORITY_INVALID',
    });
  });

  it('catches status change between earlier authorization and final write to prevent TOCTOU', async () => {
    let callCount = 0;
    const mockTx = {
      query: vi.fn().mockImplementation((sql: string) => {
        if (typeof sql === 'string' && sql.includes('SELECT status FROM accounts')) {
          callCount++;
          // First check passes (callCount 1: earlier authorization)
          // Second check fails (callCount 2: final revalidation inside locked command)
          if (callCount === 1) {
            return Promise.resolve({ rows: [{ status: 'ACTIVE' }] });
          }
          return Promise.resolve({ rows: [{ status: 'INACTIVE' }] });
        }
        if (typeof sql === 'string' && sql.includes('SELECT id FROM staff_assignments')) {
          return Promise.resolve({ rows: [{ id: 'staff-assign-1' }] });
        }
        if (typeof sql === 'string' && sql.includes('idempotency_keys')) {
          return Promise.resolve({ rows: [] });
        }
        return Promise.resolve({ rows: [] });
      }),
      on: vi.fn(),
      removeListener: vi.fn(),
      release: vi.fn(),
    };

    const mockPool = {
      connect: vi.fn().mockResolvedValue(mockTx),
    } as unknown as pg.Pool;

    await expect(
      createInterventionDefinitionCandidate(
        mockPool,
        {
          actor: { accountId: 'acc-toctou', personId: 'p-1' },
          sceneId: 'DIGITAL_USE',
          interventionCode: 'DU_CODE_01',
          semantic: interventionSemantic(),
          approvalScope: 'DIGITAL_USE',
          idempotencyKey: 'idem-key-toctou',
        },
        TEST_ONLY_QUALIFICATION_PROVIDER
      )
    ).rejects.toMatchObject({
      code: 'INTERVENTION_STAFF_AUTHORITY_INVALID',
    });

    // Final revalidation must have checked the locked account row twice
    expect(callCount).toBe(2);

    // Mutation must not have been inserted
    const insertCalls = mockTx.query.mock.calls.filter(([sql]) =>
      typeof sql === 'string' && sql.includes('INSERT INTO intervention_definitions')
    );
    expect(insertCalls.length).toBe(0);
  });
});
