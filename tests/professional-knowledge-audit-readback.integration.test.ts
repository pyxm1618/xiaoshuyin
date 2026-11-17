import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Professional Knowledge audit/readback boundary', () => {
  it('reuses business_audit_events and never creates a second audit ledger', () => {
    const migration = readFileSync(
      new URL('../db/migrations/025_professional_knowledge_foundation.sql', import.meta.url),
      'utf8'
    );
    expect(migration).toContain("resource_type = 'PROFESSIONAL_KNOWLEDGE'");
    expect(migration).not.toMatch(/CREATE\s+TABLE\s+knowledge_audit_ledger/i);
  });

  it('keeps audit metadata bounded away from narratives, credentials and raw sources', () => {
    const repository = readFileSync(
      new URL('../packages/domain/src/professional-knowledge-repository.ts', import.meta.url),
      'utf8'
    );
    const audit = repository.slice(repository.indexOf('appendProfessionalKnowledgeAudit'));
    expect(audit).not.toContain('familyNarrative');
    expect(audit).not.toContain('credentialSecret');
    expect(audit).not.toContain('rawSourceDocument');
  });

  it('provides exact version history readback ordered by authoritative audit time/id', () => {
    const repository = readFileSync(
      new URL('../packages/domain/src/professional-knowledge-repository.ts', import.meta.url),
      'utf8'
    );
    expect(repository).toContain('readProfessionalKnowledgeAuditHistory');
    expect(repository).toContain("resource_type = 'PROFESSIONAL_KNOWLEDGE'");
    expect(repository).toContain('ORDER BY occurred_at, id');
  });
});
