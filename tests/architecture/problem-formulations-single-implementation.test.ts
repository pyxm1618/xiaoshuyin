/**
 * Slice 8 post-merge owner remediation — single-implementation static guard.
 *
 * The same-transaction seam must never become a second copy of the business
 * rules. These structural assertions fail if a future change:
 *   - gives the in-tx seam its own business body instead of delegating to the
 *     one authoritative command core,
 *   - lets the in-tx seam open/close a transaction or check out a client,
 *   - inverts or drops the canonical Family -> Case -> formulation lock order,
 *   - writes business facts (events/audits/phase changes) from a wrapper.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const SERVICE_PATH = fileURLToPath(
  new URL(
    '../../apps/server/api/src/services/problem-formulations.ts',
    import.meta.url
  )
);

const source = readFileSync(SERVICE_PATH, 'utf8');

/**
 * Extract a function body by brace matching, ignoring braces inside comments,
 * string/template literals, and inside the parameter list (a parameter may
 * itself be an object type such as `input: { ... }`).
 */
function extractFunctionBody(text: string, signature: string): string {
  const start = text.indexOf(signature);
  if (start === -1) throw new Error(`function signature not found: ${signature}`);

  let parenDepth = 0;
  let inSingle = false;
  let inDouble = false;
  let inTemplate = false;
  let inLineComment = false;
  let inBlockComment = false;
  let open = -1;

  for (let i = start; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];

    if (inLineComment) {
      if (ch === '\n') inLineComment = false;
      continue;
    }
    if (inBlockComment) {
      if (ch === '*' && next === '/') {
        inBlockComment = false;
        i += 1;
      }
      continue;
    }
    if (inSingle) {
      if (ch === '\\') i += 1;
      else if (ch === "'") inSingle = false;
      continue;
    }
    if (inDouble) {
      if (ch === '\\') i += 1;
      else if (ch === '"') inDouble = false;
      continue;
    }
    if (inTemplate) {
      if (ch === '\\') i += 1;
      else if (ch === '`') inTemplate = false;
      continue;
    }
    if (ch === '/' && next === '/') {
      inLineComment = true;
      i += 1;
      continue;
    }
    if (ch === '/' && next === '*') {
      inBlockComment = true;
      i += 1;
      continue;
    }
    if (ch === "'") {
      inSingle = true;
      continue;
    }
    if (ch === '"') {
      inDouble = true;
      continue;
    }
    if (ch === '`') {
      inTemplate = true;
      continue;
    }
    if (ch === '(') parenDepth += 1;
    if (ch === ')') parenDepth -= 1;
    if (ch === '{' && parenDepth === 0) {
      open = i;
      break;
    }
  }
  if (open === -1) throw new Error(`function body not found: ${signature}`);

  let depth = 0;
  inSingle = false;
  inDouble = false;
  inTemplate = false;
  inLineComment = false;
  inBlockComment = false;

  for (let i = open; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];

    if (inLineComment) {
      if (ch === '\n') inLineComment = false;
      continue;
    }
    if (inBlockComment) {
      if (ch === '*' && next === '/') {
        inBlockComment = false;
        i += 1;
      }
      continue;
    }
    if (inSingle) {
      if (ch === '\\') i += 1;
      else if (ch === "'") inSingle = false;
      continue;
    }
    if (inDouble) {
      if (ch === '\\') i += 1;
      else if (ch === '"') inDouble = false;
      continue;
    }
    if (inTemplate) {
      if (ch === '\\') i += 1;
      else if (ch === '`') inTemplate = false;
      continue;
    }
    if (ch === '/' && next === '/') {
      inLineComment = true;
      i += 1;
      continue;
    }
    if (ch === '/' && next === '*') {
      inBlockComment = true;
      i += 1;
      continue;
    }
    if (ch === "'") {
      inSingle = true;
      continue;
    }
    if (ch === '"') {
      inDouble = true;
      continue;
    }
    if (ch === '`') {
      inTemplate = true;
      continue;
    }
    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) return text.slice(open, i + 1);
    }
  }
  throw new Error(`unterminated function body: ${signature}`);
}

function occurrences(text: string, needle: string): number {
  return text.split(needle).length - 1;
}

/** Comment-free source: documentation may legitimately name future slices. */
function stripComments(text: string): string {
  let out = '';
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];
    if (ch === '/' && next === '/') {
      while (i < text.length && text[i] !== '\n') i += 1;
      out += '\n';
      continue;
    }
    if (ch === '/' && next === '*') {
      i += 2;
      while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) i += 1;
      i += 1;
      continue;
    }
    out += ch;
  }
  return out;
}

const codeOnly = stripComments(source);

const startCore = extractFunctionBody(
  source,
  'async function startAssessmentAuthoritativeCommand('
);
const presentCore = extractFunctionBody(
  source,
  'async function presentProblemFormulationAuthoritativeCommand('
);
const startPublic = extractFunctionBody(source, 'export async function startAssessment(');
const startInTransaction = extractFunctionBody(
  source,
  'export async function startAssessmentInTransaction('
);
const presentPublic = extractFunctionBody(
  source,
  'export async function presentProblemFormulation('
);
const presentInTransaction = extractFunctionBody(
  source,
  'export async function presentProblemFormulationInTransaction('
);
const savepointHelper = extractFunctionBody(source, 'async function executeIdempotentBusiness(');
const savepointNameHelper = extractFunctionBody(
  source,
  'function nextBusinessSavepointName('
);

describe('Slice 8 single authoritative implementation (static)', () => {
  it('has exactly one authoritative command core per command', () => {
    expect(occurrences(source, 'async function startAssessmentAuthoritativeCommand(')).toBe(1);
    expect(
      occurrences(source, 'async function presentProblemFormulationAuthoritativeCommand(')
    ).toBe(1);
  });

  it('public commands keep owning the RLS transaction and delegate to the core', () => {
    expect(startPublic).toContain('withRlsTransaction(');
    expect(startPublic).toContain('startAssessmentAuthoritativeCommand(tx, input)');
    expect(presentPublic).toContain('withRlsTransaction(');
    expect(presentPublic).toContain(
      'presentProblemFormulationAuthoritativeCommand(tx, input)'
    );
  });

  it('caller-owned seams delegate to the same core and keep the same error mapping', () => {
    expect(startInTransaction).toContain('startAssessmentAuthoritativeCommand(tx, input)');
    expect(startInTransaction).toContain('mapServiceError(');
    expect(presentInTransaction).toContain(
      'presentProblemFormulationAuthoritativeCommand(tx, input)'
    );
    expect(presentInTransaction).toContain('mapServiceError(');
    // No new error vocabulary entry point.
    expect(startInTransaction).not.toContain('toHttpError(');
    expect(presentInTransaction).not.toContain('toHttpError(');
  });

  it('does not duplicate the business body into the seam wrappers', () => {
    // Each command writes its Case event + audit exactly once, inside its core.
    expect(occurrences(source, 'CASE_ASSESSMENT_STARTED')).toBe(2);
    expect(occurrences(startCore, 'CASE_ASSESSMENT_STARTED')).toBe(2);
    expect(occurrences(source, 'CASE_PROBLEM_FORMULATION_PRESENTED')).toBe(2);
    expect(occurrences(presentCore, 'CASE_PROBLEM_FORMULATION_PRESENTED')).toBe(2);

    for (const wrapper of [startPublic, startInTransaction, presentPublic, presentInTransaction]) {
      expect(wrapper).not.toContain('lockFamily(');
      expect(wrapper).not.toContain('lockCase(');
      expect(wrapper).not.toContain('insertProblemFormulationCaseEvent(');
      expect(wrapper).not.toContain('insertProblemFormulationAudit(');
      expect(wrapper).not.toContain('advanceCasePhaseAndVersion(');
    }
  });

  it('caller-owned seams never open, commit or independently roll back', () => {
    for (const seam of [startInTransaction, presentInTransaction]) {
      expect(seam).not.toContain('BEGIN');
      expect(seam).not.toContain('COMMIT');
      expect(seam).not.toContain('ROLLBACK');
      expect(seam).not.toContain('withRlsTransaction');
      expect(seam).not.toContain('.connect(');
      expect(seam).not.toContain('withTransactionClient');
    }
    // The service layer never checks out its own client.
    expect(source).not.toContain('pool.connect(');
  });

  it('keeps the canonical Family -> Case -> Problem Formulation lock order', () => {
    for (const core of [startCore, presentCore]) {
      expect(occurrences(core, 'lockFamily(')).toBe(1);
      expect(occurrences(core, 'lockCase(')).toBe(1);
      expect(core.indexOf('lockFamily(')).toBeLessThan(core.indexOf('lockCase('));
    }
    expect(presentCore.indexOf('lockCase(')).toBeLessThan(
      presentCore.indexOf('lockCurrentProblemFormulation(')
    );
  });

  it('keeps a savepoint (never a nested transaction) with caller-safe unique names', () => {
    expect(savepointHelper).toContain('SAVEPOINT');
    expect(savepointHelper).toContain('ROLLBACK TO SAVEPOINT');
    expect(savepointHelper).not.toContain("'BEGIN'");
    expect(savepointHelper).not.toContain("'COMMIT'");
    expect(savepointHelper).toContain('nextBusinessSavepointName()');
    // One counter-derived name per invocation: no collision with caller names.
    expect(savepointNameHelper).toContain('pf_business_');
    expect(savepointNameHelper).toContain('savepointSequence += 1');
  });

  it('adds no Slice 12 production surface', () => {
    for (const forbidden of ['scene_node_states', 'scene_artifacts', 'A1001', 'digital_use']) {
      expect(codeOnly).not.toContain(forbidden);
    }
  });
});