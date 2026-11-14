import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const FAMILY_RUNTIME =
  'tests/integration/digital-use-family-alliance-runtime.test.ts';
const FAMILY_GOV =
  'tests/scenes/digital-use/family-alliance-governance.test.ts';

const hx = [
  ['HX-01', FAMILY_RUNTIME, 'AS-33 concurrent A3002 writes cannot both become current'],
  ['HX-02', FAMILY_RUNTIME, 'HX parallel A3001/A3002 writes are both legal'],
  ['HX-03', FAMILY_RUNTIME, 'AS-34 concurrent target revisions cannot last-write-win'],
  ['HX-04', FAMILY_RUNTIME, 'HX target reselection versus progress preserves one selection truth'],
  ['HX-05', FAMILY_RUNTIME, 'HX A3000 reassessment and independent A3001 write may coexist'],
  ['HX-06', FAMILY_RUNTIME, 'AS-27/28 Compliance publication race and UNKNOWN policy fail closed'],
  ['HX-07', FAMILY_RUNTIME, 'HX-07 Consent revoke race serializes against Family Alliance processing'],
  ['HX-08', FAMILY_RUNTIME, 'HX Scene package replacement race is pinned by the A1001 owner row lock'],
  ['HX-09', FAMILY_RUNTIME, 'AS-03/06/09/38 preserves A3000, A3002 and help/reselection history on re-entry'],
  ['HX-10', FAMILY_RUNTIME, 'client-owned next-node control'],
  ['HX-11', FAMILY_RUNTIME, 'HX-11 dependency unavailable is distinct from denial and infrastructure failure'],
  ['HX-12', FAMILY_RUNTIME, 'AS-01..AS-13 executes legal entry, parallel target management and all ten exact target families'],
  ['HX-13', FAMILY_GOV, 'A3111 exactly'],
  ['HX-14', FAMILY_RUNTIME, 'AS-14/15 rejects fabricated target codes'],
  ['HX-15', FAMILY_RUNTIME, 'AS-35 primary-case race fails stale Family Alliance progression'],
] as const;

describe('Slice 13 HX evidence map', () => {
  it('maps exactly HX-01 through HX-15 to executable evidence', () => {
    expect(hx).toHaveLength(15);
    expect(hx.map(([id]) => id)).toEqual(
      Array.from({ length: 15 }, (_, index) =>
        `HX-${String(index + 1).padStart(2, '0')}`
      )
    );

    for (const [id, file, anchor] of hx) {
      const source = readFileSync(resolve(process.cwd(), file), 'utf8');
      expect(
        source.includes(anchor),
        `${id} missing evidence anchor: ${file} :: ${anchor}`
      ).toBe(true);
    }
  });
});
