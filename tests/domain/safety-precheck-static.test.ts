/**
 * T904 — Safety precheck has no model/network/external-service dependency.
 *
 * Static source inspection only: the deterministic contract must not be able to
 * reach a network, model, RAG, Guardrails or external Safety client.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('../..', import.meta.url).pathname;

const SOURCES = [
  'packages/domain/src/safety/precheck.ts',
  'packages/domain/src/safety/errors.ts',
] as const;

const FORBIDDEN = [
  /\bfetch\s*\(/,
  /node:https?/,
  /\bhttps?\.request\b/,
  /\baxios\b/,
  /\bundici\b/,
  /\bopenai\b/i,
  /\banthropic\b/i,
  /\bollama\b/i,
  /\bdashscope\b/i,
  /\bguardrails\b/i,
  /\bembedding/i,
  /\bprompt\b/i,
  /\brag\b/i,
  /\bllm\b/i,
  /\bmodel\.(complete|generate|chat)\b/i,
  /\bMath\.random\b/,
  /\bDate\.now\b/,
  /\bnew\s+Date\b/,
] as const;

function source(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), 'utf-8');
}

describe('Safety precheck dependency boundary (T904)', () => {
  it('imports only local domain modules', () => {
    for (const file of SOURCES) {
      const content = source(file);
      const imports = [...content.matchAll(/^\s*(?:import|export)[^;]*from\s+'([^']+)'/gm)].map(
        (match) => match[1]!
      );
      for (const specifier of imports) {
        expect(specifier.startsWith('./') || specifier.startsWith('../')).toBe(true);
      }
    }
  });

  it('contains no network, model, RAG, Guardrails, clock or randomness dependency', () => {
    for (const file of SOURCES) {
      const lines = source(file).split('\n');
      lines.forEach((line, index) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('*') || trimmed.startsWith('//') || trimmed.startsWith('/*')) {
          return;
        }
        for (const pattern of FORBIDDEN) {
          expect(
            pattern.test(line),
            `${file}:${index + 1} must not match ${pattern}: ${line.trim()}`
          ).toBe(false);
        }
      });
    }
  });

  it('does not declare a professional risk catalog in code', () => {
    // Comments legitimately state that no catalog exists; only executable code
    // is inspected here.
    const content = source('packages/domain/src/safety/precheck.ts')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');
    expect(content).not.toMatch(/H?IGH[_-]?RISK[_-]?(WORD|KEYWORD|PHRASE|PATTERN)/i);
    expect(content).not.toMatch(/keyword|catalog|threshold|score/i);
  });
});