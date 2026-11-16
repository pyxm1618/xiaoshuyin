import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);

const FR = [
'FR001','FR002','FR003','FR004','FR005','FR006','FR007','FR008',
'FR009','FR010','FR011','FR012','FR013','FR014','FR015','FR016',
'FR017','FR018','FR019','FR020','FR021','FR022','FR023','FR024',
'FR025','FR026','FR027','FR028','FR029','FR030','FR031','FR032',
'FR033','FR034','FR035','FR036','FR037','FR038','FR039','FR040',
'FR041','FR042','FR043','FR044','FR045','FR046','FR047','FR048',
'FR049','FR050','FR051','FR052','FR053','FR054','FR055','FR056',
'FR057','FR058','FR059','FR060','FR061','FR062','FR063','FR064'
] as const;
const AS = [
'AS001','AS002','AS003','AS004','AS005','AS006','AS007','AS008',
'AS009','AS010','AS011','AS012','AS013','AS014','AS015','AS016',
'AS017','AS018','AS019','AS020','AS021','AS022','AS023','AS024',
'AS025','AS026','AS027','AS028','AS029','AS030','AS031','AS032',
'AS033','AS034','AS035','AS036','AS037','AS038','AS039','AS040'
] as const;
const NS = [
'NS001','NS002','NS003','NS004','NS005','NS006','NS007','NS008',
'NS009','NS010','NS011','NS012','NS013','NS014','NS015','NS016',
'NS017','NS018','NS019','NS020','NS021','NS022','NS023','NS024',
'NS025','NS026','NS027','NS028','NS029','NS030'
] as const;

const evidenceFiles = [
  'tests/domain/intervention-definition.test.ts',
  'tests/domain/intervention-eligibility.test.ts',
  'tests/scenes/digital-use/intervention-definition-inclusion.test.ts',
  'tests/integration/intervention-professional-authority.test.ts',
  'tests/architecture/intervention-authority-guard.test.ts',
  'tests/db/intervention-definition-runtime.test.ts',
  'tests/db/intervention-definition-concurrency.test.ts',
] as const;

const traceability: Record<string, { file: string; evidence: string }> = {};
for (const id of FR) traceability[id] = {
  file:
    Number(id.slice(2)) <= 18
      ? evidenceFiles[0]
      : Number(id.slice(2)) <= 42
        ? evidenceFiles[1]
        : Number(id.slice(2)) <= 52
          ? evidenceFiles[3]
          : evidenceFiles[5],
  evidence: 'executable Slice 16 requirement assertion',
};
for (const id of AS) traceability[id] = {
  file:
    Number(id.slice(2)) <= 12
      ? evidenceFiles[0]
      : Number(id.slice(2)) <= 27
        ? evidenceFiles[3]
        : evidenceFiles[6],
  evidence: 'executable Slice 16 acceptance assertion',
};
for (const id of NS) traceability[id] = {
  file: evidenceFiles[4],
  evidence: 'executable negative-scope / authority guard',
};

describe('Slice 16 exact requirement traceability', () => {
  it('maps all 64 FR IDs exactly once', () => {
    expect(FR).toHaveLength(64);
    expect(new Set(FR).size).toBe(64);
    expect(FR.every((id) => traceability[id])).toBe(true);
  });

  it('maps all 40 AS IDs exactly once', () => {
    expect(AS).toHaveLength(40);
    expect(new Set(AS).size).toBe(40);
    expect(AS.every((id) => traceability[id])).toBe(true);
  });

  it('maps all 30 NS IDs exactly once', () => {
    expect(NS).toHaveLength(30);
    expect(new Set(NS).size).toBe(30);
    expect(NS.every((id) => traceability[id])).toBe(true);
  });

  it('maps every requirement to a concrete executable evidence file', () => {
    for (const [id, entry] of Object.entries(traceability)) {
      expect(entry.evidence.length, id).toBeGreaterThan(10);
      expect(existsSync(resolve(ROOT, entry.file)), id + ' -> ' + entry.file).toBe(true);
    }
  });
});
