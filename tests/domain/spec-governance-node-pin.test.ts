import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// Validate the complete scalar on every node-version entry. An exact match
// must not accept a longer version, range, suffix, or mismatched quote.
function hasExactNodePin(content: string): boolean {
  const values = [...content.matchAll(/^[ \t]*node-version[ \t]*:[ \t]*([^\r\n]*)$/gm)];
  return values.length > 0 && values.every((match) =>
    /^(?:26\.13\.0|"26\.13\.0"|'26\.13\.0')[ \t]*$/.test(match[1] ?? '')
  );
}

describe('Finding #42: Spec Governance Node Runtime Pin', () => {
  it('pins every node-version entry to exact Node 26.13.0 in spec-governance.yml', () => {
    const workflowPath = path.resolve(
      __dirname,
      '../../.github/workflows/spec-governance.yml'
    );
    expect(hasExactNodePin(fs.readFileSync(workflowPath, 'utf8'))).toBe(true);
  });

  it.each(['26.13.0', '"26.13.0"', "'26.13.0'"])(
    'accepts exact scalar %s', (version) => {
      expect(hasExactNodePin('    node-version: ' + version + '\n')).toBe(true);
    }
  );

  it.each([
    '26', '26.x', '26.13', '26.13.01', '26.13.0-beta', '26.13.0+build',
    '26.13.0 || 27', '26.13.0 - 27.0.0', '"26.13.0-beta"',
    '"26.13.0', "26.13.0'", '"26.13.0' + "'", 'latest', '',
  ])('rejects non-exact scalar %s', (version) => {
    expect(hasExactNodePin('    node-version: ' + version + '\n')).toBe(false);
  });

  it('rejects a missing pin or a second loose pin despite one exact match', () => {
    expect(hasExactNodePin('# node-version: 26.13.0\n')).toBe(false);
    expect(hasExactNodePin('    node-version: "26.13.0"\n    node-version: 26\n')).toBe(false);
  });
});
