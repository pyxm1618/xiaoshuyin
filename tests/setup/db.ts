/**
 * Test-only database helper.
 * Provides admin pool for test assertions that bypass RLS.
 * Uses TEST_ADMIN_DATABASE_URL (test-only, not in production env contract).
 */

import pg from 'pg';

export function createAdminPool(): pg.Pool {
  const url = process.env['TEST_ADMIN_DATABASE_URL'];
  if (!url) {
    throw new Error(
      'Missing required environment variable: TEST_ADMIN_DATABASE_URL. ' +
        'Set it to the admin/superuser PostgreSQL connection string for test assertions.'
    );
  }
  return new pg.Pool({ connectionString: url, max: 5 });
}
