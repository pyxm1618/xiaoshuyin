#!/usr/bin/env node
/**
 * guard-static.mjs — Zero-dependency static guard for Xiaoshuyin Slice 001.
 *
 * Scans only implementation directories (apps/, packages/, db/, scripts/, tests/)
 * and migration files. Does NOT scan Docs/ or specs/ text content.
 *
 * Checks (all must pass for exit 0):
 *  1. No `drizzle-kit push` in implementation code
 *  2. No `sql.raw` concatenation with family/person/purpose
 *  3. No password/secret literals in implementation code
 *  4. No family-scoped table access outside packages/**
 *  5. Accounts narrow access + no wechat_openid leak
 *  6. Scope guard: no forbidden directories or modules
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;

const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', '.workbuddy', '.specify', '.codeartsdoer',
  '.github', 'tests/evidence', 'Docs', 'specs',
]);
const SKIP_FILES = new Set([
  '.DS_Store', 'package-lock.json', 'bun.lock', 'bun.lockb',
  'guard-static.mjs',
]);

const CODE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs']);
const ALL_SCAN_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.mjs', '.cjs', '.json', '.sql', '.yml', '.yaml',
]);

let violations = [];

function scanDir(dir, callback, extensions) {
  let entries;
  try { entries = readdirSync(dir); } catch { return; }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry) || SKIP_FILES.has(entry)) continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      scanDir(full, callback, extensions);
    } else {
      const ext = entry.slice(entry.lastIndexOf('.'));
      if ((extensions ?? ALL_SCAN_EXTENSIONS).has(ext)) {
        callback(full);
      }
    }
  }
}

function getRelPath(full) {
  return relative(ROOT, full);
}

function isComment(line) {
  const t = line.trim();
  return t.startsWith('//') || t.startsWith('*') || t.startsWith('/*') || t.startsWith('#');
}

function addViolation(rule, file, line, message) {
  violations.push({ rule, file, line, message });
}

// ─── Rule 1: No drizzle-kit push ───
scanDir(ROOT, (file) => {
  const content = readFileSync(file, 'utf-8');
  content.split('\n').forEach((line, i) => {
    if (/drizzle-kit\s+push/.test(line) && !isComment(line)) {
      addViolation('R1-no-drizzle-push', getRelPath(file), i + 1,
        'drizzle-kit push is forbidden; use reviewed migrations only');
    }
  });
});

// ─── Rule 2: No sql.raw with family/person/purpose ───
scanDir(ROOT, (file) => {
  const content = readFileSync(file, 'utf-8');
  content.split('\n').forEach((line, i) => {
    if (/sql\.raw/.test(line) && /family|person|purpose/i.test(line) && !isComment(line)) {
      addViolation('R2-no-sql-raw-concat', getRelPath(file), i + 1,
        'sql.raw must not concatenate family/person/purpose identifiers');
    }
  });
});

// ─── Rule 3: No password/secret literals ───
scanDir(ROOT, (file) => {
  const relPath = getRelPath(file);
  if (relPath.endsWith('.env.example')) return;
  if (relPath.startsWith('tests/')) return; // test fixtures may use test secrets
  const content = readFileSync(file, 'utf-8');
  content.split('\n').forEach((line, i) => {
    if (isComment(line)) return;
    const secretMatch = line.match(
      /(?:password|passwd|secret|pepper|token|app_secret)\s*[:=]\s*["']([^"']{4,})["']/i
    );
    if (secretMatch) {
      const value = secretMatch[1];
      if (!/^(placeholder|changeme|xxx|your[-_]|<.*>|\$\{|process\.env|a{16,}|b{16,}|test[-_])/i.test(value)) {
        addViolation('R3-no-secret-literal', relPath, i + 1,
          `Possible secret literal: ${secretMatch[0].replace(/["']([^"']+)["']/, '"***"')}`);
      }
    }
  });
});

// ─── Rule 4: No family-scoped table access in apps/ outside packages ───
const FAMILY_TABLES = [
  'families', 'family_members', 'guardian_consent_requests', 'consent_records',
  'person_compliance_profiles', 'person_profile_values', 'business_audit_events',
];

scanDir(ROOT, (file) => {
  const relPath = getRelPath(file);
  if (!relPath.startsWith('apps/')) return;
  if (!CODE_EXTENSIONS.has(relPath.slice(relPath.lastIndexOf('.')))) return;

  const content = readFileSync(file, 'utf-8');
  content.split('\n').forEach((line, i) => {
    if (isComment(line)) return;
    if (/^\s*import\s/.test(line)) return; // skip import statements
    for (const table of FAMILY_TABLES) {
      const regex = new RegExp(`\\b${table}\\b`, 'i');
      if (regex.test(line) && /(?:FROM|INTO|UPDATE|JOIN|TABLE)\s+/i.test(line)) {
        addViolation('R4-family-table-access', relPath, i + 1,
          `Family table '${table}' accessed in apps/ (use packages/ for data access)`);
      }
    }
  });
}, CODE_EXTENSIONS);

// ─── Rule 5: Accounts narrow access + wechat_openid leak ───
scanDir(ROOT, (file) => {
  const relPath = getRelPath(file);
  const content = readFileSync(file, 'utf-8');
  content.split('\n').forEach((line, i) => {
    // 5a: wechat_openid must not appear outside allowed locations
    if (/wechat_openid/.test(line)) {
      const isAllowed =
        relPath.startsWith('db/') ||
        relPath.startsWith('tests/') ||
        relPath.startsWith('scripts/') ||
        relPath.includes('/auth/') ||
        /(^|\/)auth\.(ts|js)$/.test(relPath) || // auth module files
        relPath.includes('env') ||
        relPath.endsWith('.yaml') ||
        relPath.endsWith('.yml') ||
        isComment(line);
      if (!isAllowed) {
        addViolation('R5-wechat-openid-leak', relPath, i + 1,
          'wechat_openid must not appear outside auth/db/tests');
      }
    }
    // 5b: non-auth commands/routes must not access accounts table
    if ((relPath.includes('/commands/') || relPath.includes('/routes/')) &&
        !relPath.includes('/auth/') &&
        !/(^|\/)auth\.(ts|js)$/.test(relPath)) {
      if (/\baccounts\b/.test(line) && /(?:FROM|INTO|UPDATE|SELECT)\s+/i.test(line)) {
        addViolation('R5-accounts-narrow-access', relPath, i + 1,
          'Non-auth commands/routes must not directly access accounts table');
      }
    }
  });
});

// ─── Rule 6: Scope guard ───
const FORBIDDEN_PATHS = [
  'apps/miniprogram',
  'apps/operations',
  'packages/scenes',
  'packages/ai',
  'packages/rag',
  'packages/memory',
  'packages/notifications',
];

for (const p of FORBIDDEN_PATHS) {
  if (existsSync(join(ROOT, p))) {
    addViolation('R6-scope-guard', p, 0,
      `Forbidden path exists: ${p} (not in Slice 001 scope)`);
  }
}

scanDir(join(ROOT, 'db'), (file) => {
  const relPath = getRelPath(file);
  const content = readFileSync(file, 'utf-8');
  content.split('\n').forEach((line, i) => {
    if (/case_participants|CREATE\s+TABLE\s+(?:assertions|observations)/i.test(line)) {
      addViolation('R6-scope-guard', relPath, i + 1,
        'Forbidden table definition (case_participants/assertions/observations)');
    }
  });
});

// ─── Report ───
if (violations.length === 0) {
  console.log('guard-static: PASS (0 violations)');
  process.exit(0);
} else {
  console.error(`guard-static: FAIL (${violations.length} violations)`);
  for (const v of violations) {
    console.error(`  [${v.rule}] ${v.file}:${v.line} — ${v.message}`);
  }
  process.exit(1);
}
