import { execFileSync } from 'node:child_process';
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
  planBlob: string;
  checklistBlob: string;
  tasksBlob: string;
  taskEvidence: Record<string, string>;
  FR: { id: string; mappings: { task: string; evidence: string }[] }[];
  AS: { id: string; mappings: { task: string; evidence: string }[] }[];
  NS: { id: string; mappings: { task: string; evidence: string }[] }[];
};

const TASK_SEMANTIC_SENTINELS: Readonly<Record<string, string>> = {
  T1701: "creates exactly one normalized Professional Knowledge owner and no forbidden owner tables",
  T1702: "separates lifecycle, review state, and validity state",
  T1703: "creates only the minimal normalized Professional Knowledge tables",
  T1704: "accepts only exact current bounded Staff + qualification + approval facts",
  T1705: "requires opaque refs, exact versions and hashes in the domain contract",
  T1706: "creates a successor exactly once, replays exactly, rejects mismatch, and reserves predecessor revision",
  T1707: "does not promote review activity into Professional Approval",
  T1708: "accepts only an exact synthetic protocol proof",
  T1709: "fails closed on wrong version and never floats to latest",
  T1710: "accepts only the exact fully eligible version",
  T1711: "rolls back lifecycle and audit together on transaction failure",
  T1712: "same exact Knowledge version becomes approval-valid again when a fresh proof replaces an expired proof",
  T1713: "delivers only an authorized exact eligible version with Consent Compliance and Safety passing",
  T1714: "provides exact version history readback ordered by authoritative audit time/id",
  T1715: "has no real production approval/qualification provider while reviewer is unassigned",
  T1716: "lost response converges through shared idempotency replay and mismatched payload is rejected",
};

function git(...args: string[]): string {
  return execFileSync('git', args, {
    cwd: new URL('..', import.meta.url),
    encoding: 'utf8',
  }).trim();
}

function ids(prefix: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) =>
    `${prefix}-${String(i + 1).padStart(3, '0')}`
  );
}

function frozenTaskChunks(): Map<string, string> {
  const frozen = git(
    'show',
    `${traceability.planningFreeze}:specs/017-professional-knowledge-foundation/tasks.md`
  );
  const chunks = new Map<string, string>();
  for (const match of frozen.matchAll(
    /- \[ \] \*\*(T17\d{2})[^]*?(?=\n- \[ \] \*\*T17|\n## Dependencies)/g
  )) {
    const task = match[1]!;
    if (task >= 'T1701' && task <= 'T1716') chunks.set(task, match[0]);
  }
  return chunks;
}

function expectedTasksFor(
  chunks: Map<string, string>,
  id: string
): string[] {
  return [...chunks.entries()]
    .filter(([, body]) => {
      const kind = id.slice(0, 2);
      return (body.match(new RegExp(`${kind}-\\d{3}`, 'g')) ?? []).includes(id);
    })
    .map(([task]) => task)
    .sort();
}

describe('Slice 17 single-owner architecture + mechanical traceability', () => {
  it('binds to exact Frozen Spec and Planning Freeze blobs', () => {
    expect(
      git(
        'rev-parse',
        `${traceability.frozenSpecCommit}:specs/017-professional-knowledge-foundation/spec.md`
      )
    ).toBe(traceability.frozenSpecBlob);
    expect(
      git(
        'rev-parse',
        `${traceability.planningFreeze}:specs/017-professional-knowledge-foundation/plan.md`
      )
    ).toBe(traceability.planBlob);
    expect(
      git(
        'rev-parse',
        `${traceability.planningFreeze}:specs/017-professional-knowledge-foundation/checklist.md`
      )
    ).toBe(traceability.checklistBlob);
    expect(
      git(
        'rev-parse',
        `${traceability.planningFreeze}:specs/017-professional-knowledge-foundation/tasks.md`
      )
    ).toBe(traceability.tasksBlob);
  });

  it('Structural Mapping: covers exactly FR 52/52, AS 50/50, NS 24/24 from authoritative T1701-T1716 mappings', () => {
    const chunks = frozenTaskChunks();
    expect([...chunks.keys()].sort()).toEqual(
      Array.from({ length: 16 }, (_, i) => `T17${String(i + 1).padStart(2, '0')}`)
    );

    for (const [entries, prefix, count] of [
      [traceability.FR, 'FR', 52],
      [traceability.AS, 'AS', 50],
      [traceability.NS, 'NS', 24],
    ] as const) {
      expect(entries.map((entry) => entry.id)).toEqual(ids(prefix, count));
      for (const entry of entries) {
        const expectedTasks = expectedTasksFor(chunks, entry.id);
        expect(expectedTasks.length, `${entry.id} must be mapped by frozen tasks`).toBeGreaterThan(0);
        expect(entry.mappings.map((mapping) => mapping.task).sort()).toEqual(expectedTasks);
        for (const mapping of entry.mappings) {
          expect(mapping.evidence).toBe(traceability.taskEvidence[mapping.task]);
          expect(
            existsSync(new URL(`../${mapping.evidence}`, import.meta.url)),
            `${entry.id} / ${mapping.task} evidence missing`
          ).toBe(true);
        }
      }
    }
  });

  it('Semantic Executable Evidence: every mapped requirement points to assertions and Audit 2 sentinels are non-structural', () => {
    for (const entries of [traceability.FR, traceability.AS, traceability.NS]) {
      for (const entry of entries) {
        for (const mapping of entry.mappings) {
          const evidence = readFileSync(
            new URL(`../${mapping.evidence}`, import.meta.url),
            'utf8'
          );
          expect(evidence, `${entry.id} / ${mapping.task} needs executable/static assertions`)
            .toMatch(/\b(?:it|test)\s*\(/);
          expect(evidence, `${entry.id} / ${mapping.task} needs semantic assertions`)
            .toMatch(/\bexpect\s*\(/);
          const semanticSentinel = TASK_SEMANTIC_SENTINELS[mapping.task];
          expect(
            semanticSentinel,
            `${entry.id} / ${mapping.task} must bind to a task-specific semantic assertion`
          ).toBeTruthy();
          expect(
            evidence,
            `${entry.id} / ${mapping.task} task-specific semantic assertion deleted`
          ).toContain(semanticSentinel);
        }
      }
    }

    const remediation = readFileSync(
      new URL('./professional-knowledge-audit2-remediation.integration.test.ts', import.meta.url),
      'utf8'
    );
    for (const [id, assertion] of Object.entries({
      'FR-028': "expect(Number(reviewEvidence.rows[0]!.n)).toBe(1);",
      'FR-031': "expect(reviewReadback.status).toBe('SETTLED');",
      'FR-046': "expect(Number(releaseEvidence.rows[0]!.n)).toBe(1);",
      'FR-052': "expect(hiddenReviewer.rows[0]!.n).toBe('0');",
    })) {
      expect(remediation, `${id} semantic sentinel deleted`).toContain(assertion);
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

  it('contains no deprecated planning package identity or candidate Slice 16 imports', () => {
    const slice17 = [
      migration,
      domain,
      readFileSync(new URL('../apps/server/api/src/services/professional-knowledge.ts', import.meta.url),'utf8'),
    ].join('\n');
    expect(slice17).not.toContain('a1d4e4390d313502696493573243adf401dbae90');
    expect(slice17).not.toContain('plan/017-professional-knowledge-foundation\n');
    expect(slice17).not.toMatch(/PR\s*#?57|feat\/016-/i);
  });
});
