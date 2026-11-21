import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('../db/migrations/025_professional_knowledge_foundation.sql', import.meta.url),
  'utf8'
);
const domain = readFileSync(
  new URL('../packages/domain/src/professional-knowledge.ts', import.meta.url),
  'utf8'
);
const repository = readFileSync(
  new URL('../packages/domain/src/professional-knowledge-repository.ts', import.meta.url),
  'utf8'
);
const service = readFileSync(
  new URL('../apps/server/api/src/services/professional-knowledge.ts', import.meta.url),
  'utf8'
);
const consumption = readFileSync(
  new URL('../apps/server/api/src/services/professional-knowledge-consumption.ts', import.meta.url),
  'utf8'
);
const sceneBinding = readFileSync(
  new URL('../packages/scenes/digital-use/professional-knowledge-binding.ts', import.meta.url),
  'utf8'
);
const production = [migration, domain, repository, service, consumption, sceneBinding].join('\n');
const imports = production
  .split('\n')
  .filter((line) => /^\s*import\b/.test(line))
  .join('\n');

function expectNo(source: string, patterns: RegExp[]) {
  for (const pattern of patterns) expect(source).not.toMatch(pattern);
}

const SLICE_17_HISTORICAL_BASE = '8ac4b22373aa46bc5f86d0f042fa994997ee66d5';
const SLICE_17_HISTORICAL_HEAD = '8a54ad2000e2d15d7d129035b485708c655a2e83';
const SLICE_17_HISTORICAL_MERGE = '1b7a9d817713692cc1b895a7f601f07e8123f8fa';

function changedPathsBetween(base: string, head: string) {
  return execFileSync(
    'git',
    ['diff', '--name-only', `${base}...${head}`],
    { encoding: 'utf8' }
  ).trim().split('\n').filter(Boolean);
}

function commitParents(commit: string) {
  return execFileSync(
    'git',
    ['show', '-s', '--format=%P', commit],
    { encoding: 'utf8' }
  ).trim().split(/\s+/).filter(Boolean);
}

function forbiddenSlice17ScopeChanges(changed: string[]) {
  return changed.filter((path) =>
    path.startsWith('Docs/') ||
    path === '.specify/authority-inputs.json' ||
    path === 'specs/017-professional-knowledge-foundation/spec.md' ||
    path === 'specs/017-professional-knowledge-foundation/plan.md' ||
    path === 'specs/017-professional-knowledge-foundation/checklist.md' ||
    path === 'specs/017-professional-knowledge-foundation/tasks.md' ||
    path.includes('/016-') ||
    /(?:slice18|slice19|018-|019-)/i.test(path)
  );
}

describe('Slice 17 negative-scope semantic static evidence', () => {
  it('NS-001: adds no embeddings, vector storage, sparse vectors, or embedding generation', () => {
    expectNo(migration + imports, [
      /knowledge_embeddings/i, /pgvector/i, /sparsevec/i, /embedding_generation/i,
    ]);
  });

  it('NS-002: adds no retrieval, ranking, fusion, RRF, reranker, or RAG runtime', () => {
    expectNo(imports, [
      /hybrid[-_/ ]search/i, /retrieval[-_/ ]runtime/i, /reranker/i, /\brrf\b/i, /rag[-_/ ]runtime/i,
    ]);
  });

  it('NS-003: adds no chunking, OCR, crawler, parser, or generic ingestion platform', () => {
    expectNo(domain + repository + migration, [
      /knowledge_chunks/i, /raw_pdf/i, /\bocr\b/i, /crawler/i, /document_parser/i, /ingestion_platform/i,
    ]);
  });

  it('NS-004: adds no generic CMS owner', () => {
    expectNo(migration + imports, [
      /create\s+table\s+(?:cms|content_pages|content_entries)/i, /generic_cms/i, /content_management_system/i,
    ]);
  });

  it('NS-005: adds no reviewer marketplace owner', () => {
    expectNo(migration + imports, [
      /create\s+table\s+reviewers\b/i, /reviewer_marketplace/i, /reviewer_profiles/i,
    ]);
  });

  it('NS-006: adds no credentialing or qualification-management platform', () => {
    expectNo(migration, [
      /create\s+table\s+(?:professional_)?qualifications\b/i,
      /credentialing_platform/i,
      /qualification_management/i,
    ]);
  });

  it('NS-007: adds no generic approval workflow engine', () => {
    expectNo(migration, [
      /create\s+table\s+approval_workflows\b/i,
      /create\s+table\s+approval_steps\b/i,
      /create\s+table\s+professional_approvals\b/i,
    ]);
  });

  it('NS-008: adds no generic RBAC or ADMIN=true bypass', () => {
    expectNo(migration + service + repository, [
      /create\s+table\s+(?:rbac_)?roles\b/i,
      /\bADMIN\s*=\s*true\b/i,
      /\bisAdmin\b/,
    ]);
  });

  it('NS-009: adds no second Staff Authority owner', () => {
    expect(migration).not.toMatch(/create\s+table\s+staff_assignments\b/i);
    expect(service).toContain('staffAssignment');
  });

  it('NS-010: adds no second Professional Content Package registry', () => {
    expectNo(migration, [
      /create\s+table\s+professional_content_packages\b/i,
      /create\s+table\s+knowledge_package_inclusions\b/i,
    ]);
  });

  it('NS-011: adds no second Scene Package registry, Manifest, or router', () => {
    expect(migration).not.toMatch(/create\s+table\s+scene_packages\b/i);
    expectNo(imports, [/scene[-_/ ]package[-_/ ]router/i, /scene[-_/ ]manifest/i]);
  });

  it('NS-012: adds no duplicate InterventionDefinition lifecycle, eligibility gate, or InterventionInstance owner', () => {
    expect(migration).not.toMatch(/create\s+table\s+(?:intervention_definitions|intervention_instances)\b/i);
    expect(service).not.toContain('evaluateInterventionEligibility');
  });

  it('NS-013: adds no new Safety, Authorization, Consent, or Compliance owner', () => {
    expectNo(migration, [
      /create\s+table\s+safety_/i,
      /create\s+table\s+authorization_/i,
      /create\s+table\s+consent_/i,
      /create\s+table\s+compliance_/i,
    ]);
  });

  it('NS-014: adds no second Case, Evidence, Problem Formulation, or Family Memory truth store', () => {
    expectNo(migration, [
      /create\s+table\s+cases\b/i,
      /create\s+table\s+(?:assertions|observations)\b/i,
      /create\s+table\s+problem_formulations\b/i,
      /create\s+table\s+family_memor(?:y|ies)\b/i,
    ]);
  });

  it('NS-015: adds no AI Task Runtime, Context Builder, TaskModelRegistry, model gateway, or agent framework', () => {
    expectNo(imports, [
      /TaskModelRegistry/i, /Context Builder/i, /AI Task Runtime/i, /model[-_/ ]gateway/i, /agent[-_/ ]framework/i,
    ]);
  });

  it('NS-016: adds no Jev or Promptfoo production runtime', () => {
    expectNo(imports, [/\bJev\b/i, /promptfoo/i]);
  });

  it('NS-017: adds no A4003 roleplay, Problem Formulation AI, or execution-support AI runtime', () => {
    expectNo(imports, [/a4003/i, /roleplay/i, /problem[-_/ ]formulation[-_/ ]ai/i, /execution[-_/ ]support[-_/ ]ai/i]);
  });

  it('NS-018: adds no Phase 4 Goal, Plan, Task, Checkin, Review, Outcome, Schedule, or Notification runtime', () => {
    expectNo(migration, [
      /create\s+table\s+goals\b/i,
      /create\s+table\s+plans\b/i,
      /create\s+table\s+tasks\b/i,
      /create\s+table\s+checkins\b/i,
      /create\s+table\s+outcomes\b/i,
      /create\s+table\s+schedules\b/i,
      /create\s+table\s+notifications\b/i,
    ]);
  });

  it('NS-019: adds no raw professional-document archive or source redistribution store', () => {
    expectNo(migration + domain + repository, [
      /raw_pdf/i, /knowledge_source_archive/i, /source_body/i, /source_text/i, /document_blob/i,
    ]);
  });

  it('NS-020: adds no automatic Family-private-record promotion into Professional Knowledge', () => {
    expectNo(domain + repository + service, [
      /family_evidence_to_knowledge/i,
      /from\s+['"][^'"]*(?:assertions|observations|dialogue-messages|problem-formulations)/i,
    ]);
  });

  it('NS-021: adds no fake reviewer, qualification, developer, AI, fixture, or approved=true authority path', () => {
    expectNo(production, [
      /from\s+['"][^'"]*(?:tests|fixtures)\//i,
      /process\.env[^\n]*(?:APPROV|QUALIF|SYNTHETIC|FAKE)/i,
      /approved\s*=\s*true/i,
    ]);
  });

  it('NS-022: adds no floating latest binding or historical Scene binding rewrite', () => {
    expect(sceneBinding.toLowerCase()).not.toContain('latest');
    expect(sceneBinding).toContain('entry.scenePackageVersion === scenePackageVersion');
    expect(sceneBinding).toContain('Object.freeze');
  });

  it('NS-023: creates no local Professional Approval authority owner', () => {
    expect(migration).not.toMatch(/create\s+table\s+professional_approvals\b/i);
    expect(service).toContain('unavailableProductionProfessionalApprovalProvider');
    expect(service).not.toMatch(/productionProfessionalApprovalProvider\s*=\s*\{[^}]*status:\s*['"]RESOLVED/i);
  });

  it('NS-024: historical exact Slice 17 delta mutates no Docs, frozen Slice 17 spec/planning, Slice 16, or later authority artifacts', () => {
    // PR #58 historical identity: merge commit parents must remain exact Base + Head.
    expect(commitParents(SLICE_17_HISTORICAL_MERGE)).toEqual([
      SLICE_17_HISTORICAL_BASE,
      SLICE_17_HISTORICAL_HEAD,
    ]);

    // This is deliberately the Slice 17 historical delta, not the current PR delta.
    // Legal later Slice 18/19 work therefore cannot trip this historical contract.
    const changed = changedPathsBetween(
      SLICE_17_HISTORICAL_BASE,
      SLICE_17_HISTORICAL_HEAD
    );
    expect(forbiddenSlice17ScopeChanges(changed)).toEqual([]);
  });

  it('NS-025: historical Slice 17 scope classifier still rejects protected-path counterfactuals', () => {
    const counterfactualForbidden = [
      'Docs/V1产品需求.md',
      '.specify/authority-inputs.json',
      'specs/017-professional-knowledge-foundation/spec.md',
      'specs/017-professional-knowledge-foundation/plan.md',
      'specs/017-professional-knowledge-foundation/checklist.md',
      'specs/017-professional-knowledge-foundation/tasks.md',
      'specs/016-counterfactual-authority/spec.md',
      'specs/018-counterfactual-authority/spec.md',
      'specs/019-counterfactual-authority/plan.md',
    ];

    expect(forbiddenSlice17ScopeChanges(counterfactualForbidden)).toEqual(
      counterfactualForbidden
    );
  });
});
