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

// ─── Rule 7: Slice 9 — unique Safety entry/exit ───
// EnterSafetyHold is the only formal production path INTO SAFETY_HOLD;
// ResolveRisk is the only formal production path OUT of it. Every Case status
// write must go through the one reviewed transition primitive.

const SAFETY_TRANSITION_FILE = 'packages/domain/src/safety/case-transition.ts';
const SAFETY_COMMAND_FILES = new Set([
  'apps/server/api/src/safety/enter-safety-hold.ts',
  'apps/server/api/src/safety/resolve-risk.ts',
]);

function checkSafetyUniqueEntry(relPath, content, report) {
  // Test fixtures may construct state directly; production may not.
  if (relPath.startsWith('tests/')) return;

  content.split('\n').forEach((line, i) => {
    if (isComment(line)) return;

    if (relPath !== SAFETY_TRANSITION_FILE) {
      if (/\bUPDATE\s+cases\b/i.test(line) && /\bstatus\s*=/i.test(line)) {
        report('R7-safety-unique-entry', relPath, i + 1,
          'Direct SQL status write on cases outside the reviewed Safety transition');
      }
      if (/\.update\(\s*cases\s*\)/.test(line)) {
        report('R7-safety-unique-entry', relPath, i + 1,
          'Drizzle cases UPDATE outside the reviewed Safety transition');
      }
      if (
        !SAFETY_COMMAND_FILES.has(relPath) &&
        /status\s*:\s*'SAFETY_HOLD'/.test(line)
      ) {
        report('R7-safety-unique-entry', relPath, i + 1,
          'SAFETY_HOLD may only be written by EnterSafetyHold');
      }
    }

    if (
      /transitionCaseStatus\s*\(/.test(line) &&
      relPath !== SAFETY_TRANSITION_FILE &&
      !SAFETY_COMMAND_FILES.has(relPath) &&
      !relPath.startsWith('tests/')
    ) {
      report('R7-safety-unique-entry', relPath, i + 1,
        'transitionCaseStatus called outside EnterSafetyHold / ResolveRisk');
    }
  });
}

// ─── Rule 8: Slice 9 — executable scope negatives ───
const FORBIDDEN_SAFETY_IMPORTS = [
  'guardrails',
  'dashscope',
  'openai',
  'anthropic',
  'ollama',
  'langchain',
  '@alicloud',
  'risk_review',
  'support_resources',
  'referral',
  'staff_queue',
];

function checkSafetyScopeNegatives(relPath, content, report) {
  if (!/\.(ts|tsx|js|mjs|cjs)$/.test(relPath)) return;

  content.split('\n').forEach((line, i) => {
    if (isComment(line)) return;
    const importMatch = /from\s+['"]([^'"]+)['"]/.exec(line);
    if (importMatch) {
      const specifier = importMatch[1].toLowerCase();
      for (const forbidden of FORBIDDEN_SAFETY_IMPORTS) {
        if (specifier.includes(forbidden)) {
          report('R8-safety-scope', relPath, i + 1,
            `Forbidden Safety-adjacent dependency: ${forbidden}`);
        }
      }
    }

    // No public Safety mutation route may be registered.
    if (
      relPath.startsWith('apps/') &&
      /\b(app|server)\.(get|post|put|patch|delete)\s*\(\s*['"`][^'"`]*(safety|enter-hold|resolve-risk)/i.test(line)
    ) {
      report('R8-safety-scope', relPath, i + 1,
        'Public Safety mutation route registered (Slice 9 forbids it)');
    }
  });
}

function runSafetyRules() {
  scanDir(ROOT, (file) => {
    const relPath = getRelPath(file);
    if (!CODE_EXTENSIONS.has(relPath.slice(relPath.lastIndexOf('.')))) return;
    const content = readFileSync(file, 'utf-8');
    checkSafetyUniqueEntry(relPath, content, (rule, f, line, message) =>
      addViolation(rule, f, line, message)
    );
    checkSafetyScopeNegatives(relPath, content, (rule, f, line, message) =>
      addViolation(rule, f, line, message)
    );
  }, CODE_EXTENSIONS);
}

runSafetyRules();

// ─── Rule 9: Slice 10 — compliance feature-policy scope negatives ───
// Narrow mechanical negatives. They forbid shipping a policy product or a
// later-phase runtime, without forbidding future Scene-owned descriptor
// registration (which enters only as data).
const FORBIDDEN_COMPLIANCE_TABLES = [
  'interaction_usage_sessions',
  'usage_sessions',
  'compliance_release_evidence',
  'pipia_assessments',
  'pipia_reviews',
  'feature_policy_admin_users',
  'compliance_policy_reviews',
];
const FORBIDDEN_COMPLIANCE_TABLE_NAME = FORBIDDEN_COMPLIANCE_TABLES.join('|');
const FORBIDDEN_COMPLIANCE_CREATE_TABLE = new RegExp(
  `\\bCREATE\\s+(?:UNLOGGED\\s+)?TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?` +
    `(?:${SQL_IDENT}\\s*\\.\\s*)?["'\`]?(${FORBIDDEN_COMPLIANCE_TABLE_NAME})["'\`]?`,
  'gi'
);
const FORBIDDEN_COMPLIANCE_PGTABLE = new RegExp(
  `pgTable\\s*\\(\\s*["'\`](${FORBIDDEN_COMPLIANCE_TABLE_NAME})["'\`]`,
  'gi'
);

function checkComplianceScopeNegatives(relPath, content, report) {
  content.split('\n').forEach((line, i) => {
    if (isComment(line)) return;

    if (
      relPath.startsWith('apps/') &&
      /\b(app|server)\.(get|post|put|patch|delete)\s*\(\s*['"`][^'"`]*(?:feature-polic|compliance-polic|\/polic(?:y|ies))/i.test(line)
    ) {
      report('R9-compliance-scope', relPath, i + 1,
        'Public compliance policy route registered (Slice 10 forbids it)');
    }

    if (
      relPath.startsWith('apps/server/api/src/routes/') &&
      /\bfeatureCode\b|\bfeature_code\b/.test(line)
    ) {
      report('R9-compliance-scope', relPath, i + 1,
        'Client route must not accept a feature code as policy authority');
    }

    if (
      relPath.startsWith('packages/compliance/src/') &&
      /===\s*['"](?:A4003|DIGITAL_USE_[A-Z0-9_]*)['"]/.test(line)
    ) {
      report('R9-compliance-scope', relPath, i + 1,
        'Scene-specific product branch in Common Core compliance evaluator');
    }
  });

  if (relPath.startsWith('db/')) {
    const normalized = normalizeSql(content);
    for (const match of normalized.matchAll(FORBIDDEN_COMPLIANCE_CREATE_TABLE)) {
      report('R9-compliance-scope', relPath, lineOf(normalized, match.index ?? 0),
        `Forbidden later-phase table definition: ${match[1]}`);
    }
  }

  if (relPath.startsWith('packages/') && content.includes('pgTable')) {
    for (const match of content.matchAll(FORBIDDEN_COMPLIANCE_PGTABLE)) {
      report('R9-compliance-scope', relPath, lineOf(content, match.index ?? 0),
        `Forbidden later-phase table declared via pgTable: ${match[1]}`);
    }
  }
}

function runComplianceRules() {
  scanDir(ROOT, (file) => {
    const relPath = getRelPath(file);
    if (!CODE_EXTENSIONS.has(relPath.slice(relPath.lastIndexOf('.')))) return;
    const content = readFileSync(file, 'utf-8');
    checkComplianceScopeNegatives(relPath, content, (rule, f, line, message) =>
      addViolation(rule, f, line, message)
    );
  }, CODE_EXTENSIONS);
}

runComplianceRules();

// ─── Rule 10: Slice 11 — Digital Use Scene foundation architecture ───
const DIGITAL_USE_SCENE_ROOT = 'packages/scenes/digital-use/';
const DIGITAL_USE_MANIFEST = `${DIGITAL_USE_SCENE_ROOT}node-manifest.ts`;
const DIGITAL_USE_ROUTING = `${DIGITAL_USE_SCENE_ROOT}routing.ts`;

function checkSceneFoundationFile(relPath, content, report) {
  const isProduction = relPath.startsWith('apps/') || relPath.startsWith('packages/');

  if (
    isProduction &&
    /tests[\\/]+fixtures[\\/]+digital-use|tests\/fixtures\/digital-use/.test(content)
  ) {
    report('R10-scenes-single-truth', relPath, 1,
      'Production code must never import/reference the Digital Use canonical test snapshot');
  }

  if (!relPath.startsWith(DIGITAL_USE_SCENE_ROOT)) return;

  if (/node[-_]registry\.(?:ts|tsx|js|mjs|cjs)$/i.test(relPath)) {
    report('R10-scenes-single-truth', relPath, 1,
      'node-registry is forbidden; node-manifest.ts is the only production node truth');
  }

  if (relPath !== DIGITAL_USE_MANIFEST) {
    const literalRegistryShape =
      /nodeCode\s*:\s*['"][A0-9]/.test(content) &&
      /sourceNodeCode\s*:\s*['"][A0-9]/.test(content) &&
      /allowedNext\s*:\s*\[/.test(content);
    if (literalRegistryShape) {
      report('R10-scenes-single-truth', relPath, 1,
        'Second registry-shaped node table detected outside node-manifest.ts');
    }
  }

  if (relPath === DIGITAL_USE_MANIFEST) {
    content.split('\n').forEach((line, i) => {
      if (isComment(line)) return;
      if (/\bArray\.from\b|\bnew\s+Array\b|\.fill\s*\(|\bfor\s*\(|\bwhile\s*\(/.test(line)) {
        report('R10-scenes-numeric-generation', relPath, i + 1,
          'Manifest identities must be explicit; range/loop generation is forbidden');
      }
      if (/parseInt\s*\([^)]*node|Number\s*\([^)]*node|\+\s*1\b/.test(line)) {
        report('R10-scenes-numeric-generation', relPath, i + 1,
          'Numeric next-node inference is forbidden');
      }
    });
  }

  if (relPath === DIGITAL_USE_ROUTING) {
    let importsManifest = false;
    content.split('\n').forEach((line, i) => {
      if (isComment(line)) return;
      const importMatch = /from\s+['"]([^'"]+)['"]/.exec(line);
      if (importMatch) {
        const specifier = importMatch[1].toLowerCase();
        if (specifier === './node-manifest.js' || specifier === './node-manifest') {
          importsManifest = true;
        }
        if (
          /(^|\/)(?:pg|fastify|xstate|axios|undici)(?:$|\/)|openai|anthropic|langchain|rag|provider|model|\/db(?:\/|$)|database/.test(specifier)
        ) {
          report('R10-scenes-routing-purity', relPath, i + 1,
            `Forbidden deterministic-routing dependency: ${importMatch[1]}`);
        }
      }
      if (/\bfetch\s*\(/.test(line)) {
        report('R10-scenes-routing-purity', relPath, i + 1,
          'Network fetch is forbidden in deterministic routing');
      }
    });
    if (!importsManifest) {
      report('R10-scenes-single-truth', relPath, 1,
        'routing.ts must consume node-manifest.ts instead of a second route table');
    }
  }
}

function runSceneFoundationRules() {
  const manifestPaths = [];
  scanDir(join(ROOT, 'packages', 'scenes'), (file) => {
    const relPath = getRelPath(file);
    if (!CODE_EXTENSIONS.has(relPath.slice(relPath.lastIndexOf('.')))) return;
    if (relPath.endsWith('/node-manifest.ts') || relPath === 'packages/scenes/node-manifest.ts') {
      manifestPaths.push(relPath);
    }
  }, CODE_EXTENSIONS);

  if (manifestPaths.length !== 1 || manifestPaths[0] !== DIGITAL_USE_MANIFEST) {
    addViolation('R10-scenes-single-truth', 'packages/scenes', 0,
      `Expected exactly one Digital Use production node-manifest.ts at ${DIGITAL_USE_MANIFEST}; found ${manifestPaths.join(', ') || 'none'}`);
  }

  scanDir(ROOT, (file) => {
    const relPath = getRelPath(file);
    if (!CODE_EXTENSIONS.has(relPath.slice(relPath.lastIndexOf('.')))) return;
    checkSceneFoundationFile(relPath, readFileSync(file, 'utf-8'), (rule, f, line, message) =>
      addViolation(rule, f, line, message)
    );
  }, CODE_EXTENSIONS);
}

runSceneFoundationRules();

// ─── Self-test: synthetic forbidden bypass fixtures ───
// `node scripts/guard-static.mjs --self-test` proves the Safety rules detect a
// bypass even when the real tree is clean. Not part of `bun run guard:static`.
if (process.argv.includes('--self-test')) {
  const synthetic = [
    {
      name: 'direct SQL status write',
      path: 'apps/server/api/src/routes/evil.ts',
      content: "await tx.query(\"UPDATE cases SET status = 'SAFETY_HOLD' WHERE id = $1\", [id]);",
      rule: 'R7-safety-unique-entry',
    },
    {
      name: 'drizzle cases update',
      path: 'packages/domain/src/evil.ts',
      content: 'await tx.update(cases).set({ status: \'WAITING\' });',
      rule: 'R7-safety-unique-entry',
    },
    {
      name: 'safety hold literal write',
      path: 'apps/server/api/src/routes/evil2.ts',
      content: "const patch = { status: 'SAFETY_HOLD' };",
      rule: 'R7-safety-unique-entry',
    },
    {
      name: 'transition called outside commands',
      path: 'apps/server/api/src/routes/evil3.ts',
      content: 'await transitionCaseStatus(tx, input);',
      rule: 'R7-safety-unique-entry',
    },
    {
      name: 'public safety route',
      path: 'apps/server/api/src/routes/evil4.ts',
      content: "app.post('/api/v1/safety/resolve-risk', handler);",
      rule: 'R8-safety-scope',
    },
    {
      name: 'guardrails dependency',
      path: 'packages/domain/src/evil5.ts',
      content: "import { Guard } from '@alibaba/guardrails';",
      rule: 'R8-safety-scope',
    },
    {
      name: 'public compliance policy route',
      path: 'apps/server/api/src/routes/evil6.ts',
      content: "app.get('/api/v1/compliance/feature-policy', handler);",
      rule: 'R9-compliance-scope',
    },
    {
      name: 'client-authoritative feature code',
      path: 'apps/server/api/src/routes/evil7.ts',
      content: 'const featureCode = request.body.featureCode;',
      rule: 'R9-compliance-scope',
    },
    {
      name: 'scene branch in common core',
      path: 'packages/compliance/src/evil8.ts',
      content: "if (featureCode === 'A4003') { return true; }",
      rule: 'R9-compliance-scope',
    },
    {
      name: 'usage runtime table',
      path: 'db/migrations/evil9.sql',
      content: 'CREATE TABLE usage_sessions (id uuid PRIMARY KEY);',
      rule: 'R9-compliance-scope',
    },
    {
      name: 'second digital-use node registry',
      path: 'packages/scenes/digital-use/node-registry.ts',
      content: "export const registry = [{ nodeCode: 'A1001', sourceNodeCode: 'A1001', allowedNext: [] }];",
      rule: 'R10-scenes-single-truth',
    },
    {
      name: 'production snapshot import',
      path: 'packages/scenes/digital-use/evil-snapshot.ts',
      content: "import snapshot from '../../../tests/fixtures/digital-use/v1-product-node-manifest.snapshot.json';",
      rule: 'R10-scenes-single-truth',
    },
    {
      name: 'routing database dependency',
      path: 'packages/scenes/digital-use/routing.ts',
      content: "import { pool } from '../../../apps/server/api/src/db/pool.js';\nimport { digitalUseNodeManifest } from './node-manifest.js';",
      rule: 'R10-scenes-routing-purity',
    },
    {
      name: 'numeric manifest generation',
      path: 'packages/scenes/digital-use/node-manifest.ts',
      content: "const nodes = Array.from({length: 10}, (_, i) => ({ nodeCode: 'A' + (3000 + i) }));",
      rule: 'R10-scenes-numeric-generation',
    },
    {
      name: 'duplicate route table shape',
      path: 'packages/scenes/digital-use/evil-routes.ts',
      content: "export const x = [{ nodeCode: 'A1001', sourceNodeCode: 'A1001', allowedNext: [] }];",
      rule: 'R10-scenes-single-truth',
    },
  ];

  let selfTestFailures = 0;
  for (const sample of synthetic) {
    const hits = [];
    const report = (rule, file, line, message) => hits.push({ rule, message });
    if (sample.rule === 'R8-safety-scope') {
      checkSafetyScopeNegatives(sample.path, sample.content, report);
    } else if (sample.rule === 'R9-compliance-scope') {
      checkComplianceScopeNegatives(sample.path, sample.content, report);
    } else if (sample.rule.startsWith('R10-scenes-')) {
      checkSceneFoundationFile(sample.path, sample.content, report);
    } else {
      checkSafetyUniqueEntry(sample.path, sample.content, report);
    }
    if (!hits.some((hit) => hit.rule === sample.rule)) {
      selfTestFailures += 1;
      console.error(`guard-static self-test: MISSED ${sample.name}`);
    }
  }
  if (selfTestFailures === 0) {
    console.log(`guard-static self-test: PASS (${synthetic.length} synthetic bypass fixtures detected)`);
    process.exit(0);
  }
  console.error(`guard-static self-test: FAIL (${selfTestFailures} missed)`);
  process.exit(1);
}

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
