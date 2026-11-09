/**
 * ULT-001 (A) — real package-resolution boundary.
 *
 * The frozen Evidence writer boundary must hold for a *real package consumer*,
 * not merely because `src/index.ts` omits an export. Every assertion below
 * resolves `@xiaoshuyin/domain` from the actual consumer workspace
 * (`apps/server/api`) in a native Bun process.
 */

import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { recordDialogueMessage } from '../../packages/domain/src/internal/message-writer.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const CONSUMER = join(ROOT, 'apps', 'server', 'api');

function bunEval(script: string) {
  return spawnSync('bun', ['-e', script], {
    cwd: CONSUMER,
    encoding: 'utf8',
    timeout: 30000,
  });
}

function blockedScript(specifier: string) {
  return `
    import(${JSON.stringify(specifier)}).then(() => {
      console.error('SUBGRAPH REACHABLE');
      process.exit(7);
    }).catch((e) => {
      console.error('BLOCKED ' + (e && e.code ? e.code : e && e.message));
      process.exit(0);
    });
  `;
}

describe('ULT-001 real package resolution boundary', () => {
  it('resolves the approved public entrypoint', () => {
    const res = bunEval(`
      import('@xiaoshuyin/domain').then((m) => {
        const writers = [
          'recordStatement', 'recordHypothesis', 'recordObservation', 'assignConflictGroup'
        ];
        for (const w of writers) {
          if (typeof m[w] !== 'function') { console.error('MISSING ' + w); process.exit(2); }
        }
        console.log('ENTRY_OK');
      }).catch((e) => {
        console.error('ENTRY_FAIL ' + (e && e.code ? e.code : e && e.message));
        process.exit(1);
      });
    `);
    expect(res.stderr, res.stderr).not.toContain('MISSING');
    expect(res.status, res.stderr).toBe(0);
    expect(res.stdout).toContain('ENTRY_OK');
  });

  it('keeps the internal message writer off the public package API', () => {
    const res = bunEval(`
      import('@xiaoshuyin/domain').then((m) => {
        const forbidden = [
          'recordDialogueMessage', 'insertDialogueMessage',
          'insertEvidenceAssertion', 'insertEvidenceObservation',
          'setAssertionConflictGroup', 'setObservationConflictGroup',
          'recordFact', 'createFact', 'confirmFact', 'promoteToFact',
          'createAssertion', 'createEvidence'
        ];
        for (const f of forbidden) {
          if (m[f] !== undefined) { console.error('LEAKED ' + f); process.exit(3); }
        }
        console.log('SURFACE_OK');
      }).catch((e) => {
        console.error('ENTRY_FAIL ' + (e && e.code ? e.code : e && e.message));
        process.exit(1);
      });
    `);
    expect(res.stderr, res.stderr).not.toContain('LEAKED');
    expect(res.status, res.stderr).toBe(0);
    expect(res.stdout).toContain('SURFACE_OK');
  });

  const BLOCKED_SUBPATHS = [
    '@xiaoshuyin/domain/src/repository.js',
    '@xiaoshuyin/domain/src/repository',
    '@xiaoshuyin/domain/repository.js',
    '@xiaoshuyin/domain/src/internal/message-writer.js',
    '@xiaoshuyin/domain/internal/message-writer.js',
  ];

  for (const specifier of BLOCKED_SUBPATHS) {
    it(`refuses package subpath ${specifier}`, () => {
      const res = bunEval(blockedScript(specifier));
      const output = `${res.stdout}${res.stderr}`;
      expect(output).toContain('BLOCKED');
      expect(res.status, output).toBe(0);
    });
  }

  it('keeps the workspace-internal message seam importable for the server route', () => {
    // The route uses a workspace relative source reference (not a package
    // subpath); the seam still exists and is callable in-process.
    expect(typeof recordDialogueMessage).toBe('function');
  });
});