export {
  LEGACY_TRANSACTION_WRAPPED_MIGRATIONS,
  sha256,
  scanTopLevelTransactionStatements,
  validateAndPrepareMigrationSql,
} from '../db-migrate.mjs';

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  sha256,
  validateAndPrepareMigrationSql,
} from '../db-migrate.mjs';

export function scanAndValidateMigrations(migrationsDir) {
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const results = [];
  for (const filename of files) {
    const bytes = readFileSync(join(migrationsDir, filename));
    const checksum = sha256(bytes);
    const sql = bytes.toString('utf8');
    const prepared = validateAndPrepareMigrationSql(filename, sql, checksum);
    results.push({
      filename,
      checksum,
      stripped: prepared.stripped,
    });
  }
  return results;
}
