import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('Finding #41: .dockerignore Contract', () => {
  it('defines minimal and correct build context exclusions', () => {
    const dockerignorePath = path.resolve(__dirname, '../../.dockerignore');
    expect(fs.existsSync(dockerignorePath)).toBe(true);

    const content = fs.readFileSync(dockerignorePath, 'utf8');
    const lines = content
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#'));

    // Excluded patterns
    expect(lines).toContain('.git');
    expect(lines).toContain('node_modules');
    expect(lines).toContain('**/node_modules');
    expect(lines).toContain('tests');
    expect(lines).toContain('coverage');
    expect(lines).toContain('.specify');
    expect(lines).toContain('Docs');
    expect(lines).toContain('specs');

    // Required build assets must NOT be ignored
    expect(lines).not.toContain('package.json');
    expect(lines).not.toContain('bun.lock');
    expect(lines).not.toContain('tsconfig.base.json');
    expect(lines).not.toContain('apps');
    expect(lines).not.toContain('packages');
    expect(lines).not.toContain('db');
    expect(lines).not.toContain('scripts');
  });
});
