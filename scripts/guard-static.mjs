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
  'cases', 'case_events',
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
// Forbidden tables that remain out of scope after Slice 4 Case Participant Core.
// `case_participants` is now an explicitly owned Slice 4 table; the remaining
// future-slice tables stay forbidden.
const FORBIDDEN_TABLE_PATTERNS = [
  'participation_invites',
  'evidence_items',

  'scene_node_states',
  'scene_artifacts',
  'safety_states',
  'goals',
  'intervention_instances',
  'plan_versions',
  'tasks',
  'checkins',
  'reviews',
  'case_followup_schedules',
  'notifications',
  'notification_attempts',
  'ai_runs',
  'memory_[a-z0-9_]*',
  'data_requests',
];
const FORBIDDEN_TABLE_NAME = FORBIDDEN_TABLE_PATTERNS.join('|');

// A quoted or bare SQL identifier, optionally quoted schema-qualified.
const SQL_IDENT = '["\'`]?[A-Za-z_][A-Za-z0-9_]*["\'`]?';

// Whole-file DDL match: PostgreSQL allows the keywords, the schema qualifier
// and the table name to be separated by newlines, tabs and comments, so the
// regex must run on normalized content with `\s+` separators.
const FORBIDDEN_CREATE_TABLE = new RegExp(
  `\\bCREATE\\s+(?:UNLOGGED\\s+)?TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?` +
    `(?:${SQL_IDENT}\\s*\\.\\s*)?["'\`]?(${FORBIDDEN_TABLE_NAME})["'\`]?`,
  'gi'
);
const FORBIDDEN_PGTABLE = new RegExp(
  `pgTable\\s*\\(\\s*["'\`](${FORBIDDEN_TABLE_NAME})["'\`]`,
  'gi'
);

/**
 * Minimal SQL lexical normalizer used only for the scope guard.
 *
 * It is NOT a SQL parser: it walks the file once and produces a same-length
 * string where non-code regions are blanked (newlines preserved so reported
 * line numbers stay meaningful):
 *   - line comments      `-- …`                 → blanks
 *   - block comments     `/* … *\/`, nested     → blanks (depth counter)
 *   - single-quoted text `'…'`, `''` escape     → blanks (never DDL)
 *   - dollar-quoted text `$$…$$`, `$tag$…$tag$` → blanks (never DDL)
 *   - double-quoted identifiers `"…"`            → preserved (they ARE names)
 *
 * PostgreSQL allows nested block comments, so a boolean flag would end the
 * comment at the first `*\/` and let the rest of the statement leak through.
 */
function normalizeSql(content) {
  let out = '';
  let i = 0;
  let blockDepth = 0;
  let inLineComment = false;
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let dollarTag = null;

  const blank = (ch) => (ch === '\n' ? '\n' : ' ');

  while (i < content.length) {
    const ch = content[i];
    const next = content[i + 1];

    if (blockDepth > 0) {
      if (ch === '/' && next === '*') {
        blockDepth += 1;
        out += '  ';
        i += 2;
        continue;
      }
      if (ch === '*' && next === '/') {
        blockDepth -= 1;
        out += '  ';
        i += 2;
        continue;
      }
      out += blank(ch);
      i += 1;
      continue;
    }

    if (inLineComment) {
      if (ch === '\n') {
        inLineComment = false;
        out += '\n';
      } else {
        out += ' ';
      }
      i += 1;
      continue;
    }

    if (dollarTag !== null) {
      if (content.startsWith(dollarTag, i)) {
        out += ' '.repeat(dollarTag.length);
        i += dollarTag.length;
        dollarTag = null;
        continue;
      }
      out += blank(ch);
      i += 1;
      continue;
    }

    if (inSingleQuote) {
      if (ch === "'" && next === "'") {
        out += '  ';
        i += 2;
        continue;
      }
      if (ch === "'") {
        inSingleQuote = false;
        out += ' ';
        i += 1;
        continue;
      }
      out += blank(ch);
      i += 1;
      continue;
    }

    if (inDoubleQuote) {
      if (ch === '"' && next === '"') {
        out += '""';
        i += 2;
        continue;
      }
      if (ch === '"') {
        inDoubleQuote = false;
      }
      out += ch;
      i += 1;
      continue;
    }

    if (ch === '-' && next === '-') {
      inLineComment = true;
      out += '  ';
      i += 2;
      continue;
    }
    if (ch === '/' && next === '*') {
      blockDepth = 1;
      out += '  ';
      i += 2;
      continue;
    }
    if (ch === "'") {
      inSingleQuote = true;
      out += ' ';
      i += 1;
      continue;
    }
    if (ch === '"') {
      inDoubleQuote = true;
      out += ch;
      i += 1;
      continue;
    }
    if (ch === '$') {
      const tagMatch = /^\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/.exec(content.slice(i));
      if (tagMatch) {
        dollarTag = tagMatch[0];
        out += ' '.repeat(dollarTag.length);
        i += dollarTag.length;
        continue;
      }
    }

    out += ch;
    i += 1;
  }

  return out;
}

function lineOf(text, index) {
  let line = 1;
  for (let i = 0; i < index && i < text.length; i += 1) {
    if (text[i] === '\n') line += 1;
  }
  return line;
}

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
  const raw = readFileSync(file, 'utf-8');
  const normalized = normalizeSql(raw);

  for (const match of normalized.matchAll(FORBIDDEN_CREATE_TABLE)) {
    addViolation('R6-scope-guard', relPath, lineOf(normalized, match.index ?? 0),
      `Forbidden out-of-scope table definition: ${match[1]}`);
  }
  // pgTable() takes the table name as a string literal, which the normalizer
  // intentionally blanks for DDL matching; scan the raw text for it instead.
  for (const match of raw.matchAll(FORBIDDEN_PGTABLE)) {
    addViolation('R6-scope-guard', relPath, lineOf(raw, match.index ?? 0),
      `Forbidden out-of-scope table declared via pgTable: ${match[1]}`);
  }
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
