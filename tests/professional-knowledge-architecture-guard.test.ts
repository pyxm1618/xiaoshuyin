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

const semanticEvidence = JSON.parse(
  readFileSync(
    new URL('./fixtures/professional-knowledge-semantic-evidence.json', import.meta.url),
    'utf8'
  )
) as {
  schemaVersion: number;
  evidence: {
    evidenceId: string;
    task: string;
    type: 'EXECUTABLE' | 'STATIC';
    proofMode: 'RUNNER_RESULT';
    file: string;
    test: string;
    contract: string;
    enabled: boolean;
  }[];
  requirements: {
    requirementId: string;
    taskIds: string[];
    evidenceIds: string[];
  }[];
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

  it('Semantic Evidence Registry: binds exact FR/AS/NS sets to stable runner-result evidence identities', () => {
    const expectedRequirementIds = [
      ...ids('FR', 52),
      ...ids('AS', 50),
      ...ids('NS', 24),
    ];
    expect(semanticEvidence.requirements.map((entry) => entry.requirementId))
      .toEqual(expectedRequirementIds);

    const evidenceById = new Map(
      semanticEvidence.evidence.map((entry) => [entry.evidenceId, entry] as const)
    );
    expect(evidenceById.size).toBe(semanticEvidence.evidence.length);

    const referenced = new Set<string>();
    for (const requirement of semanticEvidence.requirements) {
      expect(requirement.evidenceIds.length, `${requirement.requirementId} needs semantic evidence`)
        .toBeGreaterThan(0);
      expect(new Set(requirement.evidenceIds).size)
        .toBe(requirement.evidenceIds.length);
      for (const evidenceId of requirement.evidenceIds) {
        const evidence = evidenceById.get(evidenceId);
        expect(evidence, `${requirement.requirementId} -> ${evidenceId} must exist`).toBeTruthy();
        expect(evidence?.enabled).toBe(true);
        expect(evidence?.proofMode).toBe('RUNNER_RESULT');
        expect(['EXECUTABLE', 'STATIC']).toContain(evidence?.type);
        expect(evidence?.test.length).toBeGreaterThan(0);
        expect(evidence?.contract.length).toBeGreaterThan(0);
        if (evidence?.task.startsWith('T17')) {
          expect(requirement.taskIds).toContain(evidence.task);
          expect(evidence.file).toBe(traceability.taskEvidence[evidence.task]);
        }
        referenced.add(evidenceId);
      }
    }

    expect(
      semanticEvidence.evidence
        .map((entry) => entry.evidenceId)
        .filter((evidenceId) => !referenced.has(evidenceId))
    ).toEqual([]);
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
