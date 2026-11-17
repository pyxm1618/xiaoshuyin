import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('../db/migrations/025_professional_knowledge_foundation.sql', import.meta.url),
  'utf8'
);
const domain = readFileSync(
  new URL('../packages/domain/src/professional-knowledge.ts', import.meta.url),
  'utf8'
);
const traceability = JSON.parse(
  readFileSync(
    new URL('./fixtures/professional-knowledge-traceability.json', import.meta.url),
    'utf8'
  )
) as {
  frozenSpecCommit: string;
  frozenSpecBlob: string;
  planningFreeze: string;
  tasksBlob: string;
  FR: { id: string; evidence: string[] }[];
  AS: { id: string; evidence: string[] }[];
  NS: { id: string; evidence: string[] }[];
};

function ids(prefix: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) =>
    `${prefix}-${String(i + 1).padStart(3, '0')}`
  );
}

describe('Slice 17 single-owner architecture + mechanical traceability', () => {
  it('binds traceability to the exact frozen authority package', () => {
    expect(traceability.frozenSpecCommit).toBe('9763bfd796aca9dbac20a94137dc330ef2b15971');
    expect(traceability.frozenSpecBlob).toBe('83222f41929689f5d98ca45027c78a262ae6449f');
    expect(traceability.planningFreeze).toBe('62020e02c908b870ff4aa445d068d6b09c19405a');
    expect(traceability.tasksBlob).toBe('aee7ae367b74ace5fbb4f9c9b2edde21682ff53a');
  });

  it('covers exactly FR 52/52, AS 50/50, NS 24/24 with existing evidence files', () => {
    expect(traceability.FR.map((x) => x.id)).toEqual(ids('FR', 52));
    expect(traceability.AS.map((x) => x.id)).toEqual(ids('AS', 50));
    expect(traceability.NS.map((x) => x.id)).toEqual(ids('NS', 24));
    for (const entry of [...traceability.FR, ...traceability.AS, ...traceability.NS]) {
      expect(entry.evidence.length).toBeGreaterThan(0);
      for (const evidence of entry.evidence) {
        expect(existsSync(new URL(`../${evidence}`, import.meta.url))).toBe(true);
      }
    }
  });

  it('creates exactly one normalized Professional Knowledge owner and no forbidden owner tables', () => {
    expect((migration.match(/CREATE TABLE professional_knowledge_items/g) ?? []).length).toBe(1);
    expect((migration.match(/CREATE TABLE professional_knowledge_versions/g) ?? []).length).toBe(1);
    for (const forbidden of [
      'knowledge_embeddings','knowledge_chunks','knowledge_package_inclusions',
      'scene_packages','reviewers','qualifications','professional_approvals',
      'knowledge_audit_ledger','knowledge_idempotency',
    ]) {
      expect(migration).not.toMatch(new RegExp(`CREATE\\s+TABLE\\s+${forbidden}`, 'i'));
    }
  });

  it('keeps lifecycle/review/validity truth independent', () => {
    const lifecycle = domain.slice(
      domain.indexOf('PROFESSIONAL_KNOWLEDGE_LIFECYCLE_STATUSES'),
      domain.indexOf('PROFESSIONAL_KNOWLEDGE_REVIEW_STATES')
    );
    expect(lifecycle).not.toContain('NEEDS_REVIEW');
    expect(domain).toContain("'PENDING',\n  'CURRENT',\n  'NEEDS_REVIEW'");
    expect(domain).toContain("'UNKNOWN',\n  'VALID',\n  'INVALID'");
  });

  it('does not reserve or create Slice 16 migration 024', () => {
    expect(
      existsSync(new URL('../db/migrations/024_professional_knowledge_foundation.sql', import.meta.url))
    ).toBe(false);
  });

  it('contains no deprecated planning package identity', () => {
    const slice17 = [
      migration,
      domain,
      readFileSync(new URL('../apps/server/api/src/services/professional-knowledge.ts', import.meta.url),'utf8'),
    ].join('\n');
    expect(slice17).not.toContain('a1d4e4390d313502696493573243adf401dbae90');
    expect(slice17).not.toContain('plan/017-professional-knowledge-foundation\n');
  });
});
