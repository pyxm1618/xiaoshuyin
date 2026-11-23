import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('Finding #42: Spec Governance Node Runtime Pin', () => {
  it('pins exact Node runtime 26.13.0 in spec-governance.yml', () => {
    const workflowPath = path.resolve(
      __dirname,
      '../../.github/workflows/spec-governance.yml'
    );
    const content = fs.readFileSync(workflowPath, 'utf8');

    // Must NOT have loose "26"
    expect(content).not.toMatch(/node-version:\s*["']?26["']?\s*$/m);

    // Must match exact 26.13.0
    expect(content).toMatch(/node-version:\s*["']?26\.13\.0["']?/);
  });
});
