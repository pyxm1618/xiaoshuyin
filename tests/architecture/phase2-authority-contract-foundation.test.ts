import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const SPEC = 'specs/phase2-authority-contract-foundation/spec.md';

describe('Phase 2 Authority Contract Foundation slot', () => {
  const text = readFileSync(SPEC, 'utf8');

  it('is explicitly pending Authority reconciliation', () => {
    expect(text).toContain('Status: **PENDING_AUTHORITY_RECONCILIATION**');
    expect(text).toContain('P2-SLOT-002');
  });

  it('cannot be treated as runtime or product authority', () => {
    expect(text).toContain('downstream projection, never an Authority source');
    expect(text).toContain('No production code, database object, public API, UI behavior');
  });

  it('requires later Authority convergence to change both requirements and evidence', () => {
    expect(text).toContain('P2-SLOT-004');
    expect(text).toContain('update the registered verification artifact in the same change');
  });
});
