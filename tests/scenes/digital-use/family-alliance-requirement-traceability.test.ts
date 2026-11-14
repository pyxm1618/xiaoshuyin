import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function root(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

describe('Slice 13 frozen requirement traceability', () => {
  it('keeps exactly S13-FR-001 through S13-FR-035 mechanically linked to tasks and evidence', () => {
    const plan = root('specs/013-digital-use-family-alliance-runtime/plan.md');
    const acceptance = root(
      'tests/scenes/digital-use/family-alliance-acceptance-evidence.test.ts'
    );
    const hx = root(
      'tests/scenes/digital-use/family-alliance-concurrency-evidence.test.ts'
    );

    const rows = plan
      .split('\n')
      .filter((line) => /^\| S13-FR-\d{3} \|/.test(line));
    expect(rows).toHaveLength(35);
    expect(
      rows.map((row) => row.match(/S13-FR-\d{3}/)?.[0])
    ).toEqual(
      Array.from({ length: 35 }, (_, index) =>
        `S13-FR-${String(index + 1).padStart(3, '0')}`
      )
    );

    for (const row of rows) {
      const cells = row.split('|').map((cell) => cell.trim());
      const id = cells[1]!;
      const taskCell = cells[5]!;
      const evidenceCell = cells[6]!;
      expect(taskCell, `${id} task ownership`).toMatch(/T13\d{2}/);
      expect(evidenceCell.length, `${id} evidence ownership`).toBeGreaterThan(0);

      for (const asId of evidenceCell.match(/AS-\d{2}/g) ?? []) {
        expect(acceptance, `${id} -> ${asId}`).toContain(
          `id: '${asId}'`
        );
      }
      for (const hxId of evidenceCell.match(/HX-\d{2}/g) ?? []) {
        expect(hx, `${id} -> ${hxId}`).toContain(`['${hxId}'`);
      }
    }
  });
});
